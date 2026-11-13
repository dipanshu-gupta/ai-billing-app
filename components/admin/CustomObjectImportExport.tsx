// @ts-nocheck
'use client';
/**
 * Data Import & Export for Custom Objects (records and their line items).
 *
 * Custom object records live in the shared custom_object_records / custom_object_line_items tables with named fields
 * packed into generic storage columns, so the standard importer (one physical table per object, fixed columns) cannot
 * handle them. This works purely with NAMED fields: CSV headers are field api_names (labels are accepted too), values
 * are validated against each field's type and options, lookups accept the related record's name, and rows are packed
 * into storage columns with packFieldValues (the same helper every custom-object form uses).
 *
 * Security: export needs custom_<api>_export (or _view for admins) and is filtered by the user's data scope;
 * import needs custom_<api>_create (and _edit for updates). Every query is tenant-scoped.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';
import { tenantScope, withTimeout } from '@/lib/utils';
import {
  fetchCustomObjectFields, packFieldValues, unpackFieldValues, formatCustomDisplayNumber,
  resolveLookupLabelMap, LOOKUP_STANDARD_OBJECTS, CUSTOM_STATUS_OPTIONS,
} from '@/lib/customObjects';
import { resolveStatusOptions } from '@/lib/statusOptions';

const BATCH = 50;
const card = 'bg-white rounded-[20px] border border-gray-200 shadow-sm p-5';
const btnDark = 'px-5 py-2.5 rounded-2xl bg-[#0F172A] text-white text-sm font-bold disabled:opacity-40';
const btnLight = 'px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40';

// ─── CSV helpers (RFC 4180 quoting, BOM-safe) ─────────────────────────────────────────────────────────────────────
const csvCell = (v: any) => {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const parseCsv = (text: string) => {
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  const t = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur); if (row.some(x => x.trim() !== '')) rows.push(row);
  const headers = (rows.shift() || []).map(h => h.trim());
  return { headers, rows: rows.map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))) };
};
const download = (name: string, content: string, type = 'text/csv;charset=utf-8;') => {
  const blob = new Blob([type.startsWith('text/csv') ? '﻿' + content : content], { type });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
};
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const today = () => new Date().toISOString().slice(0, 10);

export default function CustomObjectImportExport({ customObject, tab, onHistory }) {
  const { currentUser, hasPermission, applyDataSecurity, permissionsLoaded, enterpriseUsers, customObjects } = useApp();
  const { supabase, tenant } = useTenant();
  const page = `custom_${customObject.api_name}`;
  const canExport = hasPermission(`${page}_export`) || (hasPermission(`${page}_view`) && hasPermission('__admin__'));
  const canCreate = hasPermission(`${page}_create`);
  const canEdit = hasPermission(`${page}_edit`);
  const hasLines = !!customObject.supports_line_items;

  const [scope, setScope] = useState<'records' | 'lines'>('records');
  const [header, setHeader] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  useEffect(() => {
    let on = true;
    Promise.all([
      fetchCustomObjectFields(customObject.id, 'header'),
      hasLines ? fetchCustomObjectFields(customObject.id, 'line_item') : Promise.resolve([]),
    ]).then(([h, l]) => { if (on) { setHeader(h || []); setLines(l || []); } });
    setScope('records');
    return () => { on = false; };
  }, [customObject.id]);

  const statuses = resolveStatusOptions(page, CUSTOM_STATUS_OPTIONS);
  const recordLabel = (r) => formatCustomDisplayNumber(customObject, r.display_number) || r.record_number;

  // Column catalog for the current scope: system columns first, then the object's own fields (by api_name).
  const columns = useMemo(() => {
    if (scope === 'lines') {
      return [
        { key: '__parent', label: `${customObject.singular_label} Number`, required: true, system: true },
        ...lines.map(f => ({ key: f.api_name, label: f.label, field: f, required: !!f.required })),
      ];
    }
    return [
      { key: '__number', label: 'Record Number', system: true, exportOnly: false },
      { key: 'name', label: 'Name', system: true, required: true },
      { key: 'status', label: 'Status', system: true },
      { key: 'owner', label: 'Owner (email)', system: true },
      ...header.map(f => ({ key: f.api_name, label: f.label, field: f, required: !!f.required && f.show_on !== 'detail' })),
      { key: 'created_at', label: 'Created Date', system: true, exportOnly: true },
      { key: 'created_by', label: 'Created By', system: true, exportOnly: true },
    ];
  }, [scope, header, lines, customObject.singular_label]);

  // ════════════════════════════════════════ EXPORT ════════════════════════════════════════
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => { setPicked(columns.map(c => c.key)); }, [columns]);
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [status, setStatus] = useState('');
  const [fmt, setFmt] = useState<'csv' | 'json'>('csv');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');

  const fetchAll = async () => {
    const out: any[] = [];
    for (let p = 0; p < 200; p++) {
      let q = tenantScope(supabase.from('custom_object_records').select('*')).eq('custom_object_id', customObject.id);
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lte('created_at', to + 'T23:59:59');
      if (status && scope === 'records') q = q.eq('status', status);
      q = q.order('created_at', { ascending: false }).range(p * 1000, p * 1000 + 999);
      const { data, error } = await withTimeout(q, 20000, 'Custom object export');
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return out;
  };

  const runExport = async () => {
    if (!supabase) return;
    if (!permissionsLoaded) { setMsg('✗ Your permissions are still loading — try again in a moment.'); return; }
    setBusy(true); setMsg('');
    try {
      const recs = applyDataSecurity ? applyDataSecurity(await fetchAll()) : await fetchAll();
      let rows: any[] = [];
      if (scope === 'records') {
        const flat = recs.map(r => ({ ...r, ...unpackFieldValues(header, r) }));
        const lookupMap = await resolveLookupLabelMap(header, flat, customObjects);
        rows = flat.map(r => {
          const o: any = { __number: recordLabel(r), name: r.name, status: r.status, owner: r.owner, created_at: r.created_at, created_by: r.created_by };
          header.forEach(f => { const v = r[f.api_name]; o[f.api_name] = f.field_type === 'lookup' ? (lookupMap[f.api_name]?.[String(v)] || v || '') : v; });
          return o;
        });
      } else {
        const byId = new Map(recs.map(r => [r.id, r]));
        const ids = recs.map(r => r.id);
        const all: any[] = [];
        for (let i = 0; i < ids.length; i += 200) {
          const { data, error } = await tenantScope(supabase.from('custom_object_line_items').select('*')).in('parent_record_id', ids.slice(i, i + 200)).order('sort_order');
          if (error) throw error;
          all.push(...(data || []));
        }
        const flat = all.map(li => ({ ...li, ...unpackFieldValues(lines, li) }));
        const lookupMap = await resolveLookupLabelMap(lines, flat, customObjects);
        rows = flat.map(li => {
          const o: any = { __parent: recordLabel(byId.get(li.parent_record_id) || {}) };
          lines.forEach(f => { const v = li[f.api_name]; o[f.api_name] = f.field_type === 'lookup' ? (lookupMap[f.api_name]?.[String(v)] || v || '') : v; });
          return o;
        });
      }
      const cols = columns.filter(c => picked.includes(c.key));
      const base = `${customObject.api_name}${scope === 'lines' ? '_line_items' : ''}_export_${today()}`;
      if (fmt === 'csv') {
        download(`${base}.csv`, [cols.map(c => csvCell(c.label)).join(','), ...rows.map(r => cols.map(c => csvCell(r[c.key])).join(','))].join('\n'));
      } else {
        download(`${base}.json`, JSON.stringify(rows.map(r => Object.fromEntries(cols.map(c => [c.key === '__number' ? 'record_number' : c.key === '__parent' ? 'parent_record_number' : c.key, r[c.key]]))), null, 2), 'application/json');
      }
      onHistory?.('export', page, rows.length, 'ok');
      setMsg(`✓ Exported ${rows.length} ${scope === 'lines' ? 'line items' : 'records'}`);
    } catch (e: any) {
      onHistory?.('export', page, 0, 'error');
      setMsg('✗ Export failed: ' + (e?.message || 'Unknown error'));
    }
    setBusy(false);
  };

  // ════════════════════════════════════════ IMPORT ════════════════════════════════════════
  const importCols = columns.filter(c => !c.exportOnly && !(scope === 'records' && c.key === '__number'));
  const [step, setStep] = useState<'upload' | 'map' | 'check' | 'done'>('upload');
  const [parsed, setParsed] = useState<any>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'create' | 'upsert'>('create');
  const [matchOn, setMatchOn] = useState<'number' | 'name'>('number');
  const [checked, setChecked] = useState<{ valid: any[]; errors: string[] }>({ valid: [], errors: [] });
  const [result, setResult] = useState<any>(null);
  const [progress, setProgress] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setStep('upload'); setParsed(null); setMap({}); setResult(null); setChecked({ valid: [], errors: [] }); if (fileRef.current) fileRef.current.value = ''; }, [scope, customObject.id]);

  const template = () => {
    const ex = (c) => {
      if (c.key === '__parent') return formatCustomDisplayNumber(customObject, 1);
      if (c.key === 'name') return `Sample ${customObject.singular_label}`;
      if (c.key === 'status') return statuses[0] || 'Active';
      if (c.key === 'owner') return currentUser?.email || '';
      const f = c.field; if (!f) return '';
      return ({ number: '10', currency: '1500', date: today(), datetime: `${today()} 10:00`, checkbox: 'Yes', email: 'name@example.com', url: 'https://example.com' })[f.field_type]
        || (f.options?.length ? (f.field_type === 'multi_select' ? f.options.slice(0, 2).join('; ') : f.options[0]) : '');
    };
    download(`${customObject.api_name}${scope === 'lines' ? '_line_items' : ''}_import_template.csv`,
      [importCols.map(c => c.key === '__parent' ? 'parent_record_number' : c.key).join(','), importCols.map(c => csvCell(ex(c))).join(',')].join('\n'));
  };

  const onFile = (file: File) => {
    const r = new FileReader();
    r.onload = (e) => {
      const p = parseCsv(String(e.target?.result || ''));
      setParsed(p);
      const norm = (s) => String(s || '').toLowerCase().replace(/[\s_*()-]+/g, '');
      const auto: Record<string, string> = {};
      importCols.forEach(c => {
        const keys = [c.key === '__parent' ? 'parent_record_number' : c.key, c.label, c.key === 'owner' ? 'owner' : null].filter(Boolean).map(norm);
        auto[c.key] = p.headers.find(h => keys.includes(norm(h))) || '';
      });
      setMap(auto); setStep('map');
    };
    r.readAsText(file);
  };

  // Lookup values can be given as the related record's name (or its id).
  const resolveLookups = async (fields: any[], rows: any[]) => {
    const out: Record<string, Record<string, string>> = {};
    for (const f of fields.filter(x => x.field_type === 'lookup')) {
      const names = Array.from(new Set(rows.map(r => r[f.api_name]).filter(v => v && !isUuid(String(v))).map(String)));
      out[f.api_name] = {};
      if (!names.length) continue;
      if (f.lookup_target_type === 'standard') {
        const t = LOOKUP_STANDARD_OBJECTS[f.lookup_target_object]; if (!t) continue;
        const { data } = await tenantScope(supabase.from(t.table).select(`${t.idField},${t.labelField}`)).in(t.labelField, names);
        (data || []).forEach(d => { out[f.api_name][String(d[t.labelField]).toLowerCase()] = d[t.idField]; });
      } else {
        const target = (customObjects || []).find(o => o.api_name === f.lookup_target_object); if (!target) continue;
        const { data } = await tenantScope(supabase.from('custom_object_records').select('id,name')).eq('custom_object_id', target.id).in('name', names);
        (data || []).forEach(d => { out[f.api_name][String(d.name).toLowerCase()] = d.id; });
      }
    }
    return out;
  };

  const validate = async () => {
    const errors: string[] = []; const valid: any[] = [];
    const fields = scope === 'lines' ? lines : header;
    const raw = parsed.rows.map(r => Object.fromEntries(importCols.map(c => [c.key, map[c.key] ? (r[map[c.key]] ?? '').trim() : ''])));
    const lk = await resolveLookups(fields, raw);
    // Parent records (line import) by display number or record number, within this workspace only.
    let parents = new Map();
    if (scope === 'lines') {
      const recs = await fetchAll();
      recs.forEach(r => { parents.set(recordLabel(r).toUpperCase(), r.id); parents.set(String(r.record_number).toUpperCase(), r.id); });
    }
    const users = new Map((enterpriseUsers || []).map(u => [String(u.email || '').toLowerCase(), u]));
    raw.forEach((r, i) => {
      const rowNo = i + 2; const errs: string[] = []; const rec: any = { __row: rowNo };
      for (const c of importCols) {
        let v = r[c.key];
        if (c.required && !v) { errs.push(`"${c.label}" is required`); continue; }
        if (!v) continue;
        if (c.key === '__parent') { const id = parents.get(v.toUpperCase()); if (!id) errs.push(`${customObject.singular_label} "${v}" not found`); else rec.__parent = id; continue; }
        if (c.key === 'name') { rec.__name = v; continue; }
        if (c.key === 'status') { const m = statuses.find(s => s.toLowerCase() === v.toLowerCase()); if (!m) errs.push(`Status must be one of: ${statuses.join(', ')}`); else rec.__status = m; continue; }
        if (c.key === 'owner') { const u = users.get(v.toLowerCase()); if (!u) errs.push(`Owner "${v}" is not a user in this workspace`); else { rec.__owner = u.email; rec.__owner_id = u.id; rec.__owner_name = `${u.first_name || ''} ${u.last_name || ''}`.trim(); } continue; }
        const f = c.field;
        switch (f.field_type) {
          case 'number': case 'currency': { const n = Number(String(v).replace(/,/g, '')); if (isNaN(n)) errs.push(`"${f.label}" must be a number`); else rec[f.api_name] = n; break; }
          case 'date': { const d = new Date(v); if (isNaN(d.getTime())) errs.push(`"${f.label}" must be a date (YYYY-MM-DD)`); else rec[f.api_name] = d.toISOString().slice(0, 10); break; }
          case 'datetime': { const d = new Date(v.replace(' ', 'T')); if (isNaN(d.getTime())) errs.push(`"${f.label}" must be a date and time`); else rec[f.api_name] = v.replace(' ', 'T').slice(0, 16); break; }
          case 'checkbox': { const t = v.toLowerCase(); if (!['yes', 'no', 'true', 'false', '1', '0', 'y', 'n'].includes(t)) errs.push(`"${f.label}" must be Yes or No`); else rec[f.api_name] = ['yes', 'true', '1', 'y'].includes(t); break; }
          case 'single_select': { const m = (f.options || []).find(o => String(o).toLowerCase() === v.toLowerCase()); if (!m) errs.push(`"${f.label}" must be one of: ${(f.options || []).join(', ')}`); else rec[f.api_name] = m; break; }
          case 'multi_select': { const parts = v.split(/[;|]/).map(s => s.trim()).filter(Boolean); const bad = parts.filter(p => !(f.options || []).some(o => String(o).toLowerCase() === p.toLowerCase())); if (bad.length) errs.push(`"${f.label}": ${bad.join(', ')} not allowed`); else rec[f.api_name] = parts.map(p => (f.options || []).find(o => String(o).toLowerCase() === p.toLowerCase())); break; }
          case 'email': { if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) errs.push(`"${f.label}" is not a valid email`); else rec[f.api_name] = v; break; }
          case 'lookup': { const id = isUuid(v) ? v : lk[f.api_name]?.[v.toLowerCase()]; if (!id) errs.push(`"${f.label}": "${v}" not found`); else rec[f.api_name] = id; break; }
          default: rec[f.api_name] = v;
        }
      }
      if (errs.length) errors.push(`Row ${rowNo}: ${errs.join('; ')}`); else valid.push(rec);
    });
    setChecked({ valid, errors }); setStep('check');
  };

  const runImport = async () => {
    if (!supabase || !currentUser) return;
    setBusy(true); setProgress('');
    const res = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
    const tid = tenant?.id || (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null);
    const sysBase = (extra = {}) => ({ ...(tid ? { tenant_id: tid } : {}), custom_object_id: customObject.id, ...extra });
    const stamp = Date.now().toString().slice(-6);
    const prefix = 'C' + customObject.api_name.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase();
    try {
      if (scope === 'lines') {
        // Line items are appended after the parent's existing lines (never replace what is there).
        const groups = new Map<string, any[]>();
        checked.valid.forEach(r => { groups.set(r.__parent, [...(groups.get(r.__parent) || []), r]); });
        let n = 0;
        for (const [parentId, items] of groups) {
          const { data: last } = await supabase.from('custom_object_line_items').select('sort_order').eq('parent_record_id', parentId).order('sort_order', { ascending: false }).limit(1);
          let so = (last?.[0]?.sort_order ?? -1) + 1;
          const rows = items.map(it => sysBase({ parent_record_id: parentId, sort_order: so++, ...packFieldValues(lines, it) }));
          const { error } = await supabase.from('custom_object_line_items').insert(rows);
          if (error) { res.errors.push(`${items.length} line(s) not saved: ${error.message}`); res.skipped += items.length; } else res.created += items.length;
          n += items.length; setProgress(`${n} / ${checked.valid.length}`);
        }
      } else {
        // Existing records for upsert matching (this workspace + this object only).
        let existing = new Map();
        if (mode === 'upsert') {
          const recs = await fetchAll();
          recs.forEach(r => {
            if (matchOn === 'name') { if (r.name) existing.set(String(r.name).toLowerCase(), r); }
            else { existing.set(recordLabel(r).toUpperCase(), r); existing.set(String(r.record_number).toUpperCase(), r); }
          });
        }
        for (let i = 0; i < checked.valid.length; i += BATCH) {
          const batch = checked.valid.slice(i, i + BATCH);
          const inserts: any[] = [];
          for (const [j, r] of batch.entries()) {
            const key = matchOn === 'name' ? String(r.__name || '').toLowerCase() : String(r.__numberValue || '').toUpperCase();
            const hit = mode === 'upsert' && key ? existing.get(key) : null;
            const payload: any = {
              ...packFieldValues(header, r),
              ...(r.__status ? { status: r.__status } : {}),
              ...(r.__owner ? { owner: r.__owner, owner_id: r.__owner_id, owner_name: r.__owner_name } : {}),
            };
            if (hit) {
              if (!canEdit) { res.skipped++; res.errors.push(`Row ${r.__row}: no permission to update existing records`); continue; }
              // Keep values the file did not mention: only overwrite the columns that were mapped.
              const mappedKeys = new Set(importCols.filter(c => map[c.key]).map(c => c.key));
              const partial: any = { updated_by: currentUser.email, updated_at: new Date().toISOString() };
              header.forEach(f => { if (mappedKeys.has(f.api_name) && f.storage_column !== 'custom_data') partial[f.storage_column] = payload[f.storage_column] ?? null; });
              const overflow = header.filter(f => f.storage_column === 'custom_data' && mappedKeys.has(f.api_name));
              if (overflow.length) partial.custom_data = { ...(hit.custom_data || {}), ...Object.fromEntries(overflow.map(f => [f.api_name, r[f.api_name] ?? null])) };
              if (mappedKeys.has('name') && r.__name) partial.name = r.__name;
              if (payload.status) partial.status = payload.status;
              if (payload.owner) Object.assign(partial, { owner: payload.owner, owner_id: payload.owner_id, owner_name: payload.owner_name });
              const { error } = await supabase.from('custom_object_records').update(partial).eq('id', hit.id);
              if (error) { res.skipped++; res.errors.push(`Row ${r.__row}: ${error.message}`); } else res.updated++;
            } else {
              inserts.push(sysBase({
                ...payload,
                record_number: `${prefix}-${stamp}${String(i + j).padStart(4, '0')}`,
                name: r.__name || null,
                status: payload.status || statuses[0] || 'Active',
                owner: payload.owner || currentUser.email,
                owner_id: payload.owner_id || currentUser.id,
                owner_name: payload.owner_name || `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim(),
                created_by: currentUser.email, updated_by: currentUser.email,
                organization_id: currentUser.organization_id, business_unit_id: currentUser.business_unit_id,
              }));
            }
          }
          if (inserts.length) {
            if (!canCreate) { res.skipped += inserts.length; res.errors.push(`${inserts.length} new record(s) skipped: no permission to create`); }
            else {
              const { data, error } = await supabase.from('custom_object_records').insert(inserts).select('id,name,display_number,record_number');
              if (error) { res.skipped += inserts.length; res.errors.push(`Rows ${i + 2}–${i + 1 + batch.length}: ${error.message}`); }
              else {
                res.created += inserts.length;
                // Records imported without a name get their record number as the name (same rule as the form).
                const unnamed = (data || []).filter(d => !d.name);
                for (const d of unnamed) await supabase.from('custom_object_records').update({ name: formatCustomDisplayNumber(customObject, d.display_number) || d.record_number }).eq('id', d.id);
              }
            }
          }
          setProgress(`${Math.min(i + BATCH, checked.valid.length)} / ${checked.valid.length}`);
        }
      }
      onHistory?.('import', page, res.created + res.updated, res.errors.length ? 'error' : 'ok');
      window.dispatchEvent(new CustomEvent('custom-records-changed', { detail: { page } }));
    } catch (e: any) {
      res.errors.push(e?.message || 'Unexpected error');
      onHistory?.('import', page, res.created + res.updated, 'error');
    }
    setResult(res); setStep('done'); setBusy(false);
  };

  // Upsert by record number needs a number column in the file.
  const [numberHeader, setNumberHeader] = useState('');
  useEffect(() => {
    if (!parsed) return;
    const h = parsed.headers.find(x => ['recordnumber', 'record_number', 'number', '__number'].includes(x.toLowerCase().replace(/\s+/g, '')));
    setNumberHeader(h || '');
  }, [parsed]);
  const validateWithNumber = async () => {
    await validate();
    if (mode === 'upsert' && matchOn === 'number' && numberHeader) {
      setChecked(c => ({ ...c, valid: c.valid.map(v => ({ ...v, __numberValue: (parsed.rows[v.__row - 2] || {})[numberHeader] || '' })) }));
    }
  };

  const Scope = () => hasLines ? (
    <div className="flex gap-2 mb-4">
      {[['records', customObject.plural_label], ['lines', customObject.line_item_plural_label || 'Line Items']].map(([k, l]) => (
        <button key={k} onClick={() => setScope(k as any)} className={`px-4 py-2 rounded-xl text-sm font-semibold border ${scope === k ? 'bg-[#0F172A] text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}>{l}</button>
      ))}
    </div>
  ) : null;

  if (tab === 'export') {
    if (!canExport) return <div className={card}><p className="text-sm text-gray-600">🔒 Your role does not allow exporting {customObject.plural_label}. Ask an administrator to grant “Export” in Security Console.</p></div>;
    return (
      <div className="space-y-4">
        <div className={card}>
          <Scope />
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#0F172A]">Fields to Export</h3>
            <div className="flex gap-2">
              <button className={btnLight} onClick={() => setPicked(columns.map(c => c.key))}>Select all</button>
              <button className={btnLight} onClick={() => setPicked([])}>Clear</button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {columns.map(c => (
              <label key={c.key} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2">
                <input type="checkbox" checked={picked.includes(c.key)} onChange={e => setPicked(p => e.target.checked ? [...p, c.key] : p.filter(x => x !== c.key))} />
                <span className="truncate">{c.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className={card}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <label className="text-xs font-bold text-gray-500">Created from<input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></label>
            <label className="text-xs font-bold text-gray-500">Created to<input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></label>
            {scope === 'records' && <label className="text-xs font-bold text-gray-500">Status<select value={status} onChange={e => setStatus(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"><option value="">All</option>{statuses.map(s => <option key={s}>{s}</option>)}</select></label>}
            <label className="text-xs font-bold text-gray-500">Format<select value={fmt} onChange={e => setFmt(e.target.value as any)} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"><option value="csv">CSV</option><option value="json">JSON</option></select></label>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button className={btnDark} disabled={busy || !picked.length} onClick={runExport}>{busy ? 'Exporting…' : `⬇️ Export ${scope === 'lines' ? (customObject.line_item_plural_label || 'Line Items') : customObject.plural_label}`}</button>
            {msg && <span className={`text-sm font-semibold ${msg.startsWith('✓') ? 'text-green-700' : 'text-red-600'}`}>{msg}</span>}
          </div>
          <p className="text-xs text-gray-400 mt-2">Only records your role can see are exported. Lookup fields export the related record’s name.</p>
        </div>
      </div>
    );
  }

  // Import tab
  if (!canCreate && !canEdit) return <div className={card}><p className="text-sm text-gray-600">🔒 Your role does not allow importing {customObject.plural_label}. Ask an administrator to grant “Create” in Security Console.</p></div>;
  return (
    <div className="space-y-4">
      <div className={card}>
        <Scope />
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button className={btnLight} onClick={template}>📄 Download template</button>
              <span className="text-xs text-gray-500">Headers are field names; labels work too. Lookups take the related record’s name. Multi-select values are separated with “;”.</span>
            </div>
            {scope === 'records' && (
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="radio" checked={mode === 'create'} onChange={() => setMode('create')} /> Create new records only</label>
                <label className="flex items-center gap-2"><input type="radio" checked={mode === 'upsert'} onChange={() => setMode('upsert')} disabled={!canEdit} /> Update existing, create the rest</label>
                {mode === 'upsert' && (
                  <select value={matchOn} onChange={e => setMatchOn(e.target.value as any)} className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm">
                    <option value="number">Match on Record Number</option>
                    <option value="name">Match on Name</option>
                  </select>
                )}
              </div>
            )}
            {scope === 'lines' && <p className="text-sm text-gray-600">Each row is one line item. “{customObject.singular_label} Number” (for example {formatCustomDisplayNumber(customObject, 12)}) links it to its record; lines are added after any existing lines.</p>}
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} className="block text-sm" />
          </div>
        )}

        {step === 'map' && parsed && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{parsed.rows.length} row(s) found. Check how the file’s columns map to fields:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {importCols.map(c => (
                <div key={c.key} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-sm font-medium text-gray-700 w-1/2 truncate">{c.label}{c.required ? ' *' : ''}</span>
                  <select value={map[c.key] || ''} onChange={e => setMap(m => ({ ...m, [c.key]: e.target.value }))} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white">
                    <option value="">— not imported —</option>
                    {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
              {scope === 'records' && mode === 'upsert' && matchOn === 'number' && (
                <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2 md:col-span-2">
                  <span className="text-sm font-medium text-amber-800 w-1/2">Record Number (to match existing)</span>
                  <select value={numberHeader} onChange={e => setNumberHeader(e.target.value)} className="flex-1 border border-amber-200 rounded-lg px-2 py-1.5 text-sm bg-white">
                    <option value="">— none: every row is created —</option>
                    {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button className={btnLight} onClick={() => setStep('upload')}>← Back</button>
              <button className={btnDark} onClick={validateWithNumber}>Validate</button>
            </div>
          </div>
        )}

        {step === 'check' && (
          <div className="space-y-3">
            <div className="flex gap-3 text-sm">
              <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 font-semibold">{checked.valid.length} ready</span>
              <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 font-semibold">{checked.errors.length} with errors</span>
            </div>
            {checked.errors.length > 0 && (
              <div className="max-h-56 overflow-y-auto bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 space-y-1">
                {checked.errors.slice(0, 200).map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button className={btnLight} onClick={() => setStep('map')}>← Back</button>
              <button className={btnDark} disabled={busy || !checked.valid.length} onClick={runImport}>{busy ? `Importing… ${progress}` : `⬆️ Import ${checked.valid.length} row(s)`}</button>
              {checked.errors.length > 0 && <span className="text-xs text-gray-500">Rows with errors are skipped.</span>}
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#0F172A]">Import finished: {result.created} created · {result.updated} updated · {result.skipped} skipped</p>
            {result.errors.length > 0 && <div className="max-h-56 overflow-y-auto bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 space-y-1">{result.errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
            <button className={btnLight} onClick={() => { setStep('upload'); setParsed(null); setResult(null); if (fileRef.current) fileRef.current.value = ''; }}>Import another file</button>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 px-1">Imported records don’t trigger workflow rules (same as the standard importer), so a large file can’t flood notifications.</p>
    </div>
  );
}
