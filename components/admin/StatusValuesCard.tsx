// @ts-nocheck
'use client';
/**
 * Status Values - edit the pick-list behind the Status field of ANY object
 * (standard or custom). Add, rename (existing records are updated to the new
 * name), reorder, colour, remove, or reset to the built-in list. Stored per
 * tenant in status_options and picked up app-wide (forms, filters, boards).
 */
import { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useApp } from '@/context/AppContext';
import { useAlert } from '@/components/shared/AlertProvider';
import { getDefaultStatusOptions, getStatusColor } from '@/lib/utils';
import { STATUS_COLORS, statusColorClass } from '@/lib/statusOptions';
import { CUSTOM_STATUS_OPTIONS } from '@/lib/customObjects';

// Statuses the application itself acts on (revenue totals, rental blocking, invoice raising, locking,
// conversions). Renaming or removing one is allowed, but the admin is told what it affects.
const ANCHOR_STATUSES = ['Paid', 'Completed', 'Cancelled', 'Refunded', 'Closed Won', 'Closed Lost', 'Converted', 'Pending Approval', 'Approved', 'Draft', 'Pending', 'Discontinued'];

const RETAIL_TABLES = {
  retailCustomers: 'retail_customers', retailProducts: 'retail_products',
  retailActivities: 'retail_activities', retailOrders: 'retail_orders', retailInvoices: 'retail_invoices',
};

export default function StatusValuesCard({ objectType, customObject = null }) {
  const { supabase, tenant } = useTenant();
  const { statusOptionRows, fetchStatusOptions } = useApp();
  const { showAlert, showConfirm } = useAlert();
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [newVal, setNewVal] = useState('');

  const defaults = customObject ? CUSTOM_STATUS_OPTIONS : getDefaultStatusOptions(objectType, false);
  const saved = (statusOptionRows || []).filter(r => r.object_type === objectType && r.is_active !== false)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const usingDefaults = saved.length === 0;

  useEffect(() => {
    const src = saved.length ? saved.map(r => ({ value: r.value, color: r.color || 'gray', original: r.value }))
      : defaults.map(v => ({ value: v, color: guessColor(v), original: v }));
    setList(src);
  }, [objectType, (statusOptionRows || []).length, (statusOptionRows || []).map(r => r.value + r.color + r.sort_order).join('|')]);

  function guessColor(v) {
    const cls = getStatusColor(v);
    const hit = STATUS_COLORS.find(c => cls.includes(`bg-${c}-100`));
    return hit || 'gray';
  }
  const move = (i, d) => setList(p => { const a = [...p]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const upd = (i, patch) => setList(p => p.map((x, k) => k === i ? { ...x, ...patch } : x));

  async function propagateRename(from, to) {
    if (customObject) {
      await supabase.from('custom_object_records').update({ status: to }).eq('custom_object_id', customObject.id).eq('status', from);
    } else {
      const table = RETAIL_TABLES[objectType] || objectType;
      await supabase.from(table).update({ status: to }).eq('status', from);
    }
  }

  async function save() {
    const clean = list.map(x => ({ ...x, value: x.value.trim() })).filter(x => x.value);
    if (!clean.length) { showAlert('Add at least one status value.', { variant: 'warning' }); return; }
    if (new Set(clean.map(x => x.value.toLowerCase())).size !== clean.length) { showAlert('Status values must be unique.', { variant: 'warning' }); return; }
    setBusy(true);
    try {
      const renames = clean.filter(x => x.original && x.original !== x.value);
      const removed = (saved.length ? saved.map(r => r.value) : defaults).filter(v => !clean.some(x => x.original === v));
      const touchedAnchors = [...renames.map(r => r.original), ...removed].filter(v => ANCHOR_STATUSES.includes(v));
      if (touchedAnchors.length) {
        const okAnchor = await showConfirm(`"${Array.from(new Set(touchedAnchors)).join('", "')}" is a status the application itself relies on (for example revenue and paid totals, rental blocking, automatic invoicing, record locking and conversions). Renaming or removing it can change those results. Continue?`, { title: 'System status', variant: 'warning', confirmLabel: 'Continue' });
        if (!okAnchor) { setBusy(false); return; }
      }
      if (renames.length) {
        const ok = await showConfirm(`${renames.length} status value(s) renamed. Existing records using the old name will be updated to the new name. Continue?`, { title: 'Rename status values', confirmLabel: 'Rename & Save' });
        if (!ok) { setBusy(false); return; }
        for (const r of renames) await propagateRename(r.original, r.value);
      }
      const del = await supabase.from('status_options').delete().eq('object_type', objectType).eq('tenant_id', tenant?.id || null);
      if (del.error) throw new Error(del.error.message);
      const ins = await supabase.from('status_options').insert(clean.map((x, i) => ({
        tenant_id: tenant?.id || null, object_type: objectType, value: x.value, color: x.color, sort_order: i, is_active: true,
      })));
      if (ins.error) throw new Error(ins.error.message);
      await fetchStatusOptions();
      showAlert('Status values saved - live on all pages.', { variant: 'success' });
    } catch (e) {
      showAlert('Could not save status values: ' + (e?.message || e) + ' (has SQL 44 been run?)', { variant: 'danger' });
    }
    setBusy(false);
  }

  async function reset() {
    const ok = await showConfirm('Reset this object to the built-in status list? Records keep their current status text.', { title: 'Reset status values', variant: 'warning', confirmLabel: 'Reset' });
    if (!ok) return;
    setBusy(true);
    await supabase.from('status_options').delete().eq('object_type', objectType).eq('tenant_id', tenant?.id || null);
    await fetchStatusOptions();
    setBusy(false);
    showAlert('Reset to defaults.', { variant: 'success' });
  }

  return (
    <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-[#0F172A]">Status Values</h3>
        {usingDefaults ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">DEFAULT LIST</span>
          : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">CUSTOMISED</span>}
      </div>
      <p className="text-xs text-gray-400 mb-3">The options in this object's Status drop-down, filters and boards. Rename updates existing records; removing a value does not change records already using it.</p>
      <div className="space-y-2">
        {list.map((x, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-purple-700 disabled:opacity-20 text-[10px] leading-none">▲</button>
              <button onClick={() => move(i, 1)} disabled={i === list.length - 1} className="text-gray-400 hover:text-purple-700 disabled:opacity-20 text-[10px] leading-none">▼</button>
            </div>
            <input value={x.value} onChange={e => upd(i, { value: e.target.value })} className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white text-[#0F172A]" />
            <select value={x.color} onChange={e => upd(i, { color: e.target.value })} className="border border-gray-200 rounded-xl px-2 py-1.5 text-xs bg-white text-[#0F172A] capitalize">
              {STATUS_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold min-w-[70px] text-center ${statusColorClass(x.color)}`}>{x.value || '-'}</span>
            <button onClick={() => setList(p => p.filter((_, k) => k !== i))} className="text-red-400 hover:text-red-600 text-sm font-bold px-1">✕</button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="New status value"
          onKeyDown={e => { if (e.key === 'Enter' && newVal.trim()) { setList(p => [...p, { value: newVal.trim(), color: 'gray', original: null }]); setNewVal(''); } }}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white text-[#0F172A]" />
        <button onClick={() => { if (newVal.trim()) { setList(p => [...p, { value: newVal.trim(), color: 'gray', original: null }]); setNewVal(''); } }}
          className="px-3 py-1.5 rounded-xl border border-purple-300 text-purple-700 text-xs font-bold hover:bg-purple-50">+ Add</button>
      </div>
      <div className="flex items-center justify-end gap-3 mt-4">
        {!usingDefaults && <button onClick={reset} disabled={busy} className="text-xs font-semibold text-gray-500 hover:text-red-600 mr-auto">Reset to default list</button>}
        <button onClick={save} disabled={busy} className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-700 to-purple-900 text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 shadow-md">
          {busy ? 'Saving…' : 'Save Status Values'}
        </button>
      </div>
    </div>
  );
}
