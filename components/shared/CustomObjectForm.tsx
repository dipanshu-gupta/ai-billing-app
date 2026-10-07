// @ts-nocheck
'use client';
/**
 * Building blocks shared by the custom-object detail panel and create
 * modal, so both render fields, lookups, owner picking and line items
 * identically - and identically to the standard CRM detail/create screens
 * (same input classes, same section cards, same line-item card).
 */
import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';
import SearchableSelect from '@/components/shared/SearchableSelect';
import LineItemCustomFieldInput from '@/components/shared/LineItemCustomFieldInput';
import { LOOKUP_STANDARD_OBJECTS, CUSTOM_STATUS_OPTIONS } from '@/lib/customObjects';
import { resolveStatusOptions } from '@/lib/statusOptions';
import { resolveFieldRow } from '@/lib/useFieldLayout';

export const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';

// ─── Lookup option cache for every lookup field on the object ─────────────
export function useCustomLookups(headerFields: any[]) {
  const { customObjects } = useApp();
  const { supabase } = useTenant();
  const [cache, setCache] = useState<Record<string, { id: string; label: string }[]>>({});

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      for (const f of headerFields.filter(x => x.field_type === 'lookup')) {
        let opts: any[] = [];
        if (f.lookup_target_type === 'standard') {
          const t = LOOKUP_STANDARD_OBJECTS[f.lookup_target_object];
          if (t) {
            const prefix = f.lookup_target_object === 'retailOrders' ? 'RORD' : f.lookup_target_object === 'retailInvoices' ? 'RINV' : null;
            const cols = Array.from(new Set([t.idField, t.labelField, ...(prefix ? ['display_number'] : [])])).join(',');
            const { data } = await supabase.from(t.table).select(cols).limit(300);
            opts = (data || []).map(r => ({ id: r[t.idField], label: (prefix && r.display_number) ? `${prefix}-${String(r.display_number).padStart(5, '0')}` : (r[t.labelField] || r[t.idField]) }));
          }
        } else {
          const target = (customObjects || []).find(o => o.api_name === f.lookup_target_object);
          if (target) {
            const { data } = await supabase.from('custom_object_records').select('id,record_number,name').eq('custom_object_id', target.id).order('created_at', { ascending: false }).limit(300);
            opts = (data || []).map(r => ({ id: r.id, label: r.name || r.record_number }));
          }
        }
        if (!cancelled) setCache(p => ({ ...p, [f.api_name]: opts }));
      }
    })();
    return () => { cancelled = true; };
  }, [headerFields.map(f => f.id).join(','), supabase, (customObjects || []).length]);

  return cache;
}

// ─── One typed field input (lookup-aware) ─────────────────────────────────
export function CustomFieldControl({ field, value, onChange, lookupOptions }) {
  if (field.field_type === 'lookup') {
    return (
      <SearchableSelect
        value={value || ''}
        onChange={onChange}
        options={(lookupOptions || []).map(o => ({ value: o.id, label: o.label }))}
        placeholder="Select…"
        emptyLabel="—"
      />
    );
  }
  if (field.field_type === 'long_text') {
    return <textarea rows={3} value={value || ''} onChange={e => onChange(e.target.value)} className={iCls + ' resize-none'} />;
  }
  if (field.field_type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 cursor-pointer py-2">
        <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" checked={!!value} onChange={e => onChange(e.target.checked)} />
        <span className="text-sm text-[#0F172A]">{value ? 'Yes' : 'No'}</span>
      </label>
    );
  }
  if (field.field_type === 'multi_select') {
    const sel = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5">
        {(field.options || []).map(o => (
          <label key={o} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" checked={sel.includes(o)}
              onChange={e => onChange(e.target.checked ? [...sel, o] : sel.filter(x => x !== o))} />
            <span className="text-sm text-[#0F172A]">{o}</span>
          </label>
        ))}
      </div>
    );
  }
  return <LineItemCustomFieldInput field={field} value={value} onChange={onChange} className={iCls} />;
}

// ─── Owner picker (same behaviour as the standard OwnerField) ─────────────
export function CustomOwnerPicker({ ownerId, ownerEmail, createdBy, onPick, disabled }) {
  const { enterpriseUsers, currentUser } = useApp();
  const users = enterpriseUsers || [];
  const resolved =
    users.find(u => ownerId && u.id === ownerId) ||
    users.find(u => ownerEmail && u.email === ownerEmail) ||
    users.find(u => createdBy && u.email === createdBy) ||
    users.find(u => currentUser && u.id === currentUser.id);

  useEffect(() => { if (resolved && !ownerId && !disabled) onPick(resolved); }, [resolved?.id]);

  if (disabled) {
    return <div className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-500">{resolved ? `${resolved.first_name || ''} ${resolved.last_name || ''}`.trim() : (ownerEmail || '—')}</div>;
  }
  return (
    <SearchableSelect
      value={resolved?.id || ''}
      onChange={uid => onPick(users.find(x => x.id === uid) || null)}
      options={users.map(u => ({ value: u.id, label: (`${u.first_name || ''} ${u.last_name || ''}`.trim()) || u.email || 'User', sub: [u.designation, u.email].filter(Boolean).join(' · ') }))}
      placeholder={users.length === 0 ? 'Loading users...' : 'Select owner'}
      emptyLabel="Unassigned"
    />
  );
}

export function ownerPatch(u: any) {
  return u ? { __owner_id: u.id, __owner: u.email, __owner_name: `${u.first_name || ''} ${u.last_name || ''}`.trim() } : { __owner_id: null, __owner: null, __owner_name: null };
}

// ─── Line items card (matches the standard Line Items card styling) ───────
export function CustomLineItemsCard({ customObject, lineFields, rows, setRows, readOnly, lookupOptions }) {
  if (!customObject.supports_line_items) return null;
  const add = () => setRows(p => [...p, Object.fromEntries(lineFields.filter(f => f.default_value).map(f => [f.api_name, f.default_value]))]);
  const upd = (idx, k, v) => setRows(p => p.map((r, i) => i === idx ? { ...r, [k]: v } : r));
  const del = (idx) => setRows(p => p.filter((_, i) => i !== idx));
  return (
    <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 flex items-center justify-between">
        <div><h3 className="text-white font-bold text-lg">{customObject.line_item_plural_label || 'Line Items'}</h3></div>
        {!readOnly && <button onClick={add} className="bg-white text-[#0F172A] px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50">+ Add {customObject.line_item_singular_label || 'Item'}</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase">
            <tr>
              {lineFields.map(f => <th key={f.api_name} className="px-4 py-3 whitespace-nowrap">{f.label}</th>)}
              {!readOnly && <th className="px-4 py-3 w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={lineFields.length + 1} className="px-4 py-8 text-center text-gray-400">No {(customObject.line_item_plural_label || 'items').toLowerCase()} added yet.</td></tr>}
            {rows.map((row, idx) => (
              <tr key={idx} className="border-t border-blue-50">
                {lineFields.map(f => (
                  <td key={f.api_name} className="px-3 py-2 min-w-[140px]">
                    {readOnly
                      ? <span className="text-[#0F172A]">{String(row[f.api_name] ?? '') || '—'}</span>
                      : <LineItemCustomFieldInput field={f} value={row[f.api_name]} onChange={v => upd(idx, f.api_name, v)} />}
                  </td>
                ))}
                {!readOnly && <td className="px-3 py-2"><button onClick={() => del(idx)} className="w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-xs font-bold">✕</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Section building (honours Page Layout Designer order/sections) ───────
// Standard objects ship fixed sections; a custom object's default is
//   Basic Info (name + its own fields) / Ownership (owner, status)
// and Page Layout Designer can move any field to another section, relabel
// sections, reorder fields and hide/lock them - same engine as elsewhere.
export function buildCustomSections({ headerFields, layout, layoutSections, pageScope, values, defaultTitle = 'Basic Info' }) {
  const rows = (layout || []).filter(r => r.is_published !== false);
  // Same precedence rule as every other page (a redundant default Detail/Create row never masks a Both-Pages rule).
  const rowFor = (key) => resolveFieldRow(key, rows, pageScope);
  const items = [
    { key: 'name', label: 'Name', kind: 'sys', def: 'basic', required: true, order: -2 },
    ...headerFields.filter(f => f.show_on !== (pageScope === 'create' ? 'detail' : 'create')).map((f, i) => ({ key: f.api_name, label: f.label, kind: 'field', field: f, def: 'basic', required: !!f.required, order: i })),
    { key: 'owner', label: 'Owner', kind: 'sys', def: 'ownership', order: 1000 },
    { key: 'status', label: 'Status', kind: 'sys', def: 'ownership', order: 1001 },
  ];
  const sectionLabel = (sk, fallback) => (layoutSections || []).find(s => s.section_key === sk)?.custom_label || fallback;
  const sectionOrder = (sk, fallback) => (layoutSections || []).find(s => s.section_key === sk)?.display_order ?? fallback;
  const bucket: Record<string, any> = {};
  items.forEach(it => {
    const row = rowFor(it.key);
    let visible = row ? row.visibility_mode !== 'hidden' : true;
    let editable = row ? row.editability_mode !== 'readonly' : true;
    for (const rule of (row?.conditional_rules || [])) {
      const v = values?.[rule.condition_field];
      const empty = v === undefined || v === null || v === '';
      const hit = rule.operator === 'equals' ? String(v ?? '') === String(rule.condition_value ?? '')
        : rule.operator === 'not_equals' ? String(v ?? '') !== String(rule.condition_value ?? '')
        : rule.operator === 'is_empty' ? empty : rule.operator === 'is_not_empty' ? !empty : false;
      if (hit) {
        if (rule.then_visibility) visible = rule.then_visibility === 'visible';
        if (rule.then_editability) editable = rule.then_editability === 'editable';
      }
    }
    if (!visible) return;
    const sk = row?.section_key || it.def;
    const title = sk === 'basic' ? sectionLabel('basic', defaultTitle) : sk === 'ownership' ? sectionLabel('ownership', 'Ownership') : sectionLabel(sk, sk);
    const icon = sk === 'ownership' ? '👤' : '📋';
    if (!bucket[sk]) bucket[sk] = { key: sk, title, icon, order: sectionOrder(sk, sk === 'basic' ? 0 : sk === 'ownership' ? 900 : 100), items: [] };
    bucket[sk].items.push({ ...it, label: row?.custom_label || it.label, editable, order: row?.display_order ?? it.order });
  });
  return Object.values(bucket)
    .sort((a: any, b: any) => a.order - b.order)
    .map((s: any) => ({ ...s, items: s.items.sort((a, b) => a.order - b.order) }));
}

export const statusOptionsFor = (current?: string, objectType?: string) => {
  const base = objectType ? resolveStatusOptions(objectType, CUSTOM_STATUS_OPTIONS) : CUSTOM_STATUS_OPTIONS;
  return current && !base.includes(current) ? [...base, current] : base;
};

// ─── Renders the sections produced by buildCustomSections ─────────────────
// `values` holds api_name keys + __name/__status/__owner*; `patch` merges a
// partial update into it (so picking an owner can set three keys at once).
export function CustomSectionsView({ sections, values, patch, lookups, createdBy, cols = 'md:grid-cols-2 xl:grid-cols-3', cardClass = 'bg-white rounded-[20px] border border-blue-100 shadow-sm', locked = false, lockedKeys = [], objectType = undefined }) {
  const readonlyBox = (txt) => <div className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" title="Read-only">{txt || <span className="text-gray-300">—</span>}</div>;
  const show = (v) => Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v ?? '');
  return (
    <div className="space-y-5">
      {sections.map(section => (
        <div key={section.key} className={cardClass}>
          <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 flex items-center gap-2 rounded-t-[20px]">
            <span className="text-lg">{section.icon}</span>
            <span className="font-bold text-[#0F172A] text-sm">{section.title}</span>
          </div>
          <div className={`p-5 grid grid-cols-1 ${cols} gap-4`}>
            {section.items.map(it => {
              const ro = locked || !it.editable || lockedKeys.includes(it.key);
              const wide = it.kind === 'field' && (it.field.field_type === 'long_text' || it.field.field_type === 'multi_select');
              return (
                <div key={it.key} className={`space-y-1.5 ${wide ? 'md:col-span-2 xl:col-span-3' : ''}`}>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">{it.label}{it.required && <span className="text-red-400 ml-1">*</span>}</label>
                  {it.kind === 'sys' && it.key === 'name' && (ro ? readonlyBox(values.__name) :
                    <input value={values.__name || ''} onChange={e => patch({ __name: e.target.value })} className={iCls} placeholder="Name" />)}
                  {it.kind === 'sys' && it.key === 'status' && (ro ? readonlyBox(values.__status) :
                    <select value={values.__status || 'Active'} onChange={e => patch({ __status: e.target.value })} className={iCls}>
                      {statusOptionsFor(values.__status, objectType).map(s => <option key={s}>{s}</option>)}
                    </select>)}
                  {it.kind === 'sys' && it.key === 'owner' &&
                    <CustomOwnerPicker ownerId={values.__owner_id} ownerEmail={values.__owner} createdBy={createdBy} disabled={ro} onPick={u => patch(ownerPatch(u))} />}
                  {it.kind === 'field' && (ro ? readonlyBox(it.field.field_type === 'lookup' ? ((lookups[it.key] || []).find(o => o.id === values[it.key])?.label || show(values[it.key])) : show(values[it.key])) :
                    <CustomFieldControl field={it.field} value={values[it.key]} onChange={v => patch({ [it.key]: v })} lookupOptions={lookups[it.key]} />)}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
