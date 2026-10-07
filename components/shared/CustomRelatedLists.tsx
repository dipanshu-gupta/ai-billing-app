// @ts-nocheck
'use client';
/**
 * Related lists - zero-configuration parent/child relationships.
 *
 * A relationship is simply a Lookup field. When an admin adds a Lookup field
 * "Coach" to a "Salary" object pointing at the "Coaches" object, every Coach
 * record automatically shows a "Salaries" section listing its salary records,
 * with a "+ New" button that opens the Salary create form with the Coach
 * already filled in and locked. Works for any number of relationships, any
 * object (custom -> custom, custom -> standard such as Customers), in both
 * directions, with no per-relationship setup. Numeric / currency columns get
 * a totals row, so "total salary paid to this coach" needs no extra build.
 *
 * Tenant-safe: reads only through the signed-in user's own Supabase client,
 * so row-level security and the user's data-security scope apply.
 */
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { ObjectIcon } from '@/lib/lineIcons';

import { useTenant } from '@/context/TenantContext';
import { fetchCustomObjectFields, resolveLookupLabelMap, flattenCustomRecord, formatCustomDisplayNumber } from '@/lib/customObjects';
import { formatDate, formatDateTime, formatCurrency, getStatusColor } from '@/lib/utils';
import CustomObjectCreateModal from '@/components/shared/CustomObjectCreateModal';

const MAX_ROWS = 50;

/** True when at least one other published, permitted object has a Lookup field pointing at this parent object —
 *  i.e. the record has "related lists" and deserves its own 360 tab. Cheap (field metadata is cached). */
export function useHasRelated(parentKind, parentKey) {
  const { customObjects, hasPermission, appPreferences } = useApp();
  const [has, setHas] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mode = appPreferences?.b2c_mode === true ? 'b2c' : 'b2b';
      const children = (customObjects || []).filter(o => o.status === 'published' && (o.module === 'both' || o.module === mode));
      for (const child of children) {
        if (hasPermission && !hasPermission(`custom_${child.api_name}_view`)) continue;
        const hf = await fetchCustomObjectFields(child.id, 'header');
        if (hf.some(f => f.field_type === 'lookup' && f.lookup_target_type === parentKind && f.lookup_target_object === parentKey && f.storage_column && f.storage_column !== 'custom_data')) { if (!cancelled) setHas(true); return; }
      }
      if (!cancelled) setHas(false);
    })();
    return () => { cancelled = true; };
  }, [parentKind, parentKey, (customObjects || []).length]);
  return has;
}

export default function CustomRelatedLists({ parentKind, parentKey, parentId, parentName, parentPage, parentRecord, returnTab }) {
  const { customObjects, hasPermission, applyDataSecurity, appPreferences } = useApp();
  const { supabase } = useTenant();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null); // section being created for
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!supabase || !parentId) { setSections([]); setLoading(false); return; }
    const mode = appPreferences?.b2c_mode === true ? 'b2c' : 'b2b';
    const children = (customObjects || []).filter(o => o.status === 'published' && (o.module === 'both' || o.module === mode));
    const out = [];
    for (const child of children) {
      if (hasPermission && !hasPermission(`custom_${child.api_name}_view`)) continue;
      const hf = await fetchCustomObjectFields(child.id, 'header');
      const links = hf.filter(f => f.field_type === 'lookup' && f.lookup_target_type === parentKind && f.lookup_target_object === parentKey && f.storage_column && f.storage_column !== 'custom_data');
      if (!links.length) continue;
      const lf = child.supports_line_items ? await fetchCustomObjectFields(child.id, 'line_item') : [];
      for (const link of links) {
        const { data, count } = await supabase.from('custom_object_records').select('*', { count: 'exact' })
          .eq('custom_object_id', child.id).eq(link.storage_column, String(parentId))
          .order('display_number', { ascending: false }).limit(MAX_ROWS);
        const rows = (applyDataSecurity ? applyDataSecurity(data || []) : (data || [])).map(r => flattenCustomRecord(hf, r));
        const lmap = await resolveLookupLabelMap(hf.filter(f => f.field_type === 'lookup'), rows, customObjects || []);
        out.push({ key: `${child.id}:${link.api_name}`, child, link, hf, lf, rows, lmap, count: count ?? rows.length });
      }
    }
    setSections(out);
    setLoading(false);
  }, [supabase, parentId, parentKind, parentKey, (customObjects || []).length, tick]);

  useEffect(() => { load(); }, [load]);

  const openChild = (s, row) => {
    window.dispatchEvent(new CustomEvent('open-record', {
      detail: { page: `custom_${s.child.api_name}`, record: row, returnTo: parentPage ? { page: parentPage, record: parentRecord, ...(returnTab ? { tab: returnTab } : {}) } : null },
    }));
  };

  if (loading || !sections.length) return null;

  return (
    <>
      {sections.map(s => {
        // columns: every field except the one pointing back at the parent
        const cols = s.hf.filter(f => f.api_name !== s.link.api_name && f.storage_column !== 'custom_data' && f.field_type !== 'long_text').slice(0, 4);
        const totals = cols.filter(f => ['number', 'currency'].includes(f.field_type)).map(f => ({
          f, sum: s.rows.reduce((t, r) => t + (Number(r[f.api_name]) || 0), 0),
        }));
        const cell = (r, f) => {
          const v = r[f.api_name];
          if (v === undefined || v === null || v === '') return '—';
          if (f.field_type === 'currency') return formatCurrency(Number(v), appPreferences?.default_currency);
          if (f.field_type === 'date') return formatDate(v);
          if (f.field_type === 'datetime') return formatDateTime(v);
          if (f.field_type === 'checkbox') return v ? 'Yes' : 'No';
          if (f.field_type === 'lookup') return (s.lmap && s.lmap[f.api_name] && s.lmap[f.api_name][String(v)]) || String(v);
          return String(v);
        };
        const canCreate = !hasPermission || hasPermission(`custom_${s.child.api_name}_create`);
        return (
          <div key={s.key} className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-lg"><span className="inline-flex items-center gap-2"><ObjectIcon icon={s.child.icon} className="w-5 h-5"/>{s.child.plural_label}</span> <span className="ml-2 bg-white/20 text-xs font-bold px-2 py-0.5 rounded-full">{s.count}</span></h3>
                <p className="text-blue-300 text-xs mt-0.5">Related via “{s.link.label}”</p>
              </div>
              {canCreate && (
                <button onClick={() => setCreating(s)} className="bg-white text-[#0F172A] px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50">+ New {s.child.singular_label}</button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">#</th><th className="px-4 py-3">Name</th>
                    {cols.map(f => <th key={f.api_name} className="px-4 py-3 whitespace-nowrap">{f.label}</th>)}
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {s.rows.length === 0 && <tr><td colSpan={cols.length + 3} className="px-4 py-8 text-center text-gray-400">No {s.child.plural_label.toLowerCase()} for this record yet.</td></tr>}
                  {s.rows.map(r => (
                    <tr key={r.id} onClick={() => openChild(s, r)} className="border-t border-blue-50 hover:bg-blue-50/40 cursor-pointer">
                      <td className="px-4 py-3"><span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{formatCustomDisplayNumber(s.child, r.display_number) || r.record_number}</span></td>
                      <td className="px-4 py-3 font-semibold text-[#0F172A]">{r.name || '—'}</td>
                      {cols.map(f => <td key={f.api_name} className="px-4 py-3 text-gray-600">{cell(r, f)}</td>)}
                      <td className="px-4 py-3"><span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(r.status)}`}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
                {totals.length > 0 && s.rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-blue-100 bg-blue-50/50 font-bold text-[#0F172A]">
                      <td className="px-4 py-3" colSpan={2}>Total{s.count > s.rows.length ? ` (latest ${s.rows.length})` : ''}</td>
                      {cols.map(f => {
                        const t = totals.find(x => x.f.api_name === f.api_name);
                        return <td key={f.api_name} className="px-4 py-3">{t ? (f.field_type === 'currency' ? formatCurrency(t.sum, appPreferences?.default_currency) : t.sum.toLocaleString()) : ''}</td>;
                      })}
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        );
      })}

      {creating && (
        <CustomObjectCreateModal
          customObject={creating.child} headerFields={creating.hf} lineFields={creating.lf}
          open={true} onClose={() => setCreating(null)}
          prefill={{ [creating.link.api_name]: String(parentId) }}
          lockedKeys={[creating.link.api_name]}
          onCreated={() => { setCreating(null); setTick(x => x + 1); }}
        />
      )}
    </>
  );
}
