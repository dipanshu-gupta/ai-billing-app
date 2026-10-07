// @ts-nocheck
'use client';
/**
 * Copy Maps (Field Mapping) — Admin Tools.
 *
 * Three kinds of copy map, all stored in field_mapping_rules (tenant-isolated, SQL 46):
 *   1. Product → Line Item        : picking a product in a grid copies product fields onto the line.
 *   2. Record Conversion (header) : Order → Invoice, Lead → Opportunity, Quotation → Order, ...
 *   3. Record Conversion (lines)  : the same conversion, copying line-item fields row by row.
 *
 * Every field picker lists ALL standard fields (honouring Page Layout Designer relabels) and ALL
 * published custom fields of the real object — header objects and line-item objects alike.
 * Everything is read and written through the signed-in tenant's own client, scoped by tenant.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';
import { useAlert } from '@/components/shared/AlertProvider';
import { invalidateFieldMappingCache } from '@/lib/useFieldMappingRules';
import { useObjectLabels } from '@/lib/useObjectLabels';
import { tenantScope } from '@/lib/utils';
import { COPY_CONVERSIONS, PRODUCT_LINE_TARGETS, conversionByKey, EXTRA_STANDARD_FIELDS, LINE_EXTRA_FIELDS } from '@/lib/copyMaps';
import { getStandardFields } from '@/components/admin/FieldLayoutDesigner';

const OBJECT_LABELS = {
  retailProducts: 'Retail Products', retailOrders: 'Retail Orders', retailInvoices: 'Retail Invoices',
  retailOrderLineItems: 'Retail Order Line Items', retailInvoiceLineItems: 'Retail Invoice Line Items',
  products: 'Products', leads: 'Leads', opportunities: 'Opportunities', quotations: 'Quotations', orders: 'Orders', invoices: 'Invoices',
  quotationLineItems: 'Quotation Line Items', orderLineItems: 'Order Line Items', invoiceLineItems: 'Invoice Line Items',
};
const PROTECTED = new Set(['id', 'owner', 'owner_id', 'created_at', 'updated_at', 'created_by', 'updated_by']);

const kind = (t) => {
  t = String(t || 'text').toLowerCase();
  if (['number', 'currency', 'decimal', 'integer', 'percent'].includes(t)) return 'number';
  if (['date', 'datetime'].includes(t)) return 'date';
  if (['checkbox', 'boolean'].includes(t)) return 'bool';
  return 'text';
};

const TABS = [
  { v: 'product_to_line_item', l: '📦 Product → Line Item' },
  { v: 'record_conversion', l: '🔄 Record Conversion' },
];

const sel = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400';

export default function FieldMappingPanel() {
  const { appPreferences } = useApp();
  const { supabase, tenant } = useTenant();
  const { showAlert, showConfirm } = useAlert();
  const { getObjectLabel } = useObjectLabels();
  const objLabel = (o) => getObjectLabel(o, OBJECT_LABELS[o] || o);

  const isB2C = appPreferences?.b2c_mode === true;
  const [tab, setTab] = useState('product_to_line_item');
  const [module, setModule] = useState(isB2C ? 'Retail' : 'CRM / B2B');
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customByObj, setCustomByObj] = useState({});    // object -> { fields, relabel, error } (loaded from the tenant's DB)
  const asked = useRef(new Set());
  const [conversion, setConversion] = useState(COPY_CONVERSIONS.find(c => c.group === (isB2C ? 'Retail' : 'CRM / B2B'))?.v || COPY_CONVERSIONS[0].v);
  const [lineTarget, setLineTarget] = useState(PRODUCT_LINE_TARGETS.find(t => t.group === (isB2C ? 'Retail' : 'CRM / B2B'))?.v);
  const [modal, setModal] = useState(null);              // { scope:'product'|'header'|'line', editing? }
  const [form, setForm] = useState({ name: '', source: '', target: '', is_active: true });
  const [saving, setSaving] = useState(false);

  const conv = conversionByKey(conversion);
  const lt = PRODUCT_LINE_TARGETS.find(t => t.v === lineTarget);
  const convOptions = COPY_CONVERSIONS.filter(c => c.group === module);
  const lineOptions = PRODUCT_LINE_TARGETS.filter(t => t.group === module);

  // keep selections inside the chosen module
  useEffect(() => {
    if (!convOptions.find(c => c.v === conversion)) setConversion(convOptions[0]?.v);
    if (!lineOptions.find(t => t.v === lineTarget)) setLineTarget(lineOptions[0]?.v);
  }, [module]);

  // ── rules (tenant scoped; RLS enforces it again server-side) ──
  const fetchRules = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await tenantScope(supabase.from('field_mapping_rules').select('*')).order('created_at', { ascending: false });
    if (error) showAlert('Could not load copy maps: ' + error.message, { variant: 'danger' });
    setRules(data || []);
    setLoading(false);
  }, [supabase]);
  useEffect(() => { fetchRules(); }, [fetchRules]);

  // ── field catalogue for an object: ALL standard fields (built in code, always available) +
  //    all published custom fields and layout relabels (loaded from the tenant's own data) ──
  const stdFor = (obj) => {
    try {
      const base = getStandardFields(obj) || [];
      const snake = (k) => k.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
      const have = new Set(base.map(f => snake(f.key)));
      const extra = [...(EXTRA_STANDARD_FIELDS[obj] || []), ...(LINE_EXTRA_FIELDS[obj] || [])].filter(f => !have.has(snake(f.key)));
      return [...base, ...extra];
    } catch (e) { console.error('[CopyMaps] standard fields failed for', obj, e); return []; }
  };

  const loadCustom = useCallback(async (obj) => {
    if (!supabase || !obj || asked.current.has(obj)) return;
    asked.current.add(obj);
    let fields = [], relabel = {}, error = null;
    try {
      const cf = await tenantScope(supabase.from('app_custom_fields').select('api_name,label,field_type,sort_order')
        .eq('object_type', obj).eq('is_published', true).eq('is_active', true)).order('sort_order');
      if (cf.error) error = cf.error.message; else fields = cf.data || [];
    } catch (e) { error = e?.message || String(e); }
    try {
      const fl = await tenantScope(supabase.from('field_layout_config').select('field_key,custom_label').eq('object_type', obj).eq('is_published', true));
      (fl.data || []).forEach(r => { if (r.custom_label) relabel[r.field_key] = r.custom_label; });
    } catch (e) { /* relabels are optional */ }
    setCustomByObj(p => ({ ...p, [obj]: { fields, relabel, error } }));
  }, [supabase]);

  const objectsNeeded = useMemo(() => {
    const out = new Set();
    if (lt) { out.add(lt.productObject); out.add(lt.lineObject); }
    if (conv) { out.add(conv.source); out.add(conv.target); if (conv.lineSource) { out.add(conv.lineSource); out.add(conv.lineTarget); } }
    return [...out];
  }, [lt, conv]);
  useEffect(() => { objectsNeeded.forEach(loadCustom); }, [objectsNeeded, loadCustom]);

  // Standard fields are available immediately; custom fields join as soon as they load.
  const catalogs = useMemo(() => {
    const out = {};
    objectsNeeded.forEach(obj => {
      const c = customByObj[obj] || { fields: [], relabel: {}, error: null };
      const std = stdFor(obj).map(f => ({
        value: `standard:${f.key}`, field: f.key, type: 'standard', label: c.relabel[f.key] || f.label, vtype: kind(f.type), computed: !!f.computed, group: 'Standard fields',
      }));
      const cus = c.fields.map(f => ({
        value: `custom:${f.api_name}`, field: f.api_name, type: 'custom', label: c.relabel['custom:' + f.api_name] || f.label, vtype: kind(f.field_type), computed: false, group: 'Custom fields',
      }));
      const options = [...std, ...cus];
      out[obj] = { options, byValue: Object.fromEntries(options.map(o => [o.value, o])), nStd: std.length, nCus: cus.length, error: c.error, customLoaded: !!customByObj[obj] };
    });
    return out;
  }, [objectsNeeded, customByObj]);

  const labelOf = (obj, type, field) => {
    const hit = catalogs[obj]?.byValue?.[`${type}:${field}`];
    return hit ? hit.label : field;
  };

  // ── which rules belong to the current view ──
  const view = useMemo(() => {
    if (tab === 'product_to_line_item') {
      return [{ scope: 'product', title: `${objLabel(lt?.productObject)} → ${objLabel(lt?.lineObject)}`, srcObj: lt?.productObject, tgtObj: lt?.lineObject,
        rules: rules.filter(r => r.rule_type === 'product_to_line_item' && r.source_object === lt?.productObject && (r.target_object === lt?.lineObject || legacyMatches(r, lt?.lineObject))) }];
    }
    const secs = [{ scope: 'header', title: `Header fields: ${objLabel(conv?.source)} → ${objLabel(conv?.target)}`, srcObj: conv?.source, tgtObj: conv?.target,
      rules: rules.filter(r => r.rule_type === 'record_conversion' && r.conversion_context === conversion) }];
    if (!conv?.lineSource) secs.push({ scope: 'none', title: 'Line items', note: 'This conversion does not carry line items, so there is nothing to map at line level.', rules: [] });
    if (conv?.lineSource) secs.push({ scope: 'line', title: `Line items: ${objLabel(conv.lineSource)} → ${objLabel(conv.lineTarget)}`, srcObj: conv.lineSource, tgtObj: conv.lineTarget,
      rules: rules.filter(r => r.rule_type === 'record_conversion_line' && r.conversion_context === conversion) });
    return secs;
  }, [tab, rules, lt, conv, conversion, catalogs, getObjectLabel]);

  function legacyMatches(r, lineObject) {
    const alias = { retail_order_line_items: ['retailOrderLineItems', 'retailInvoiceLineItems'], retail_invoice_line_items: ['retailInvoiceLineItems'] };
    return (alias[r.target_object] || []).includes(lineObject);
  }

  // ── modal helpers ──
  const openNew = (sec) => { setForm({ name: '', source: '', target: '', is_active: true }); setModal({ sec, editing: null }); };
  const openEdit = (sec, r) => {
    setForm({ name: r.name || '', source: `${r.source_field_type}:${r.source_field}`, target: `${r.target_field_type}:${r.target_field}`, is_active: r.is_active !== false });
    setModal({ sec, editing: r });
  };

  const buildPayload = (sec, src, tgt, extra = {}) => ({
    ...(tenant?.id ? { tenant_id: tenant.id } : {}),
    rule_type: sec.scope === 'product' ? 'product_to_line_item' : sec.scope === 'header' ? 'record_conversion' : 'record_conversion_line',
    source_object: sec.srcObj, target_object: sec.tgtObj,
    source_field: src.field, source_field_type: src.type,
    target_field: tgt.field, target_field_type: tgt.type,
    conversion_context: sec.scope === 'product' ? null : conversion,
    updated_at: new Date().toISOString(),
    ...extra,
  });

  const handleSave = async () => {
    const sec = modal.sec;
    const src = catalogs[sec.srcObj]?.byValue?.[form.source];
    const tgt = catalogs[sec.tgtObj]?.byValue?.[form.target];
    if (!src || !tgt) { showAlert('Pick both a source and a target field.', { variant: 'warning' }); return; }
    if (tgt.type === 'standard' && PROTECTED.has(tgt.field)) { showAlert('That target field is system-managed and cannot be overwritten.', { variant: 'warning' }); return; }
    if (tgt.computed) { showAlert('That target is a calculated field (it is recomputed from other values), so it cannot be a copy target.', { variant: 'warning' }); return; }
    const dup = sec.rules.find(r => r.id !== modal.editing?.id && r.target_field === tgt.field && r.target_field_type === tgt.type);
    if (dup) {
      const ok = await showConfirm(`"${tgt.label}" is already the target of another map in this section. When two maps write the same field the later one wins. Save anyway?`);
      if (!ok) return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(sec, src, tgt, { name: form.name || null, is_active: form.is_active });
      const res = modal.editing
        ? await supabase.from('field_mapping_rules').update(payload).eq('id', modal.editing.id)
        : await supabase.from('field_mapping_rules').insert([payload]);
      if (res.error) throw new Error(res.error.message);
      invalidateFieldMappingCache();
      setModal(null);
      await fetchRules();
    } catch (e) {
      showAlert('Save failed: ' + (e?.message || 'Unknown error'), { variant: 'danger' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (r) => {
    const ok = await showConfirm('Delete this copy map?', { variant: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    const { error } = await supabase.from('field_mapping_rules').delete().eq('id', r.id);
    if (error) { showAlert('Delete failed: ' + error.message, { variant: 'danger' }); return; }
    invalidateFieldMappingCache(); await fetchRules();
  };
  const toggleActive = async (r) => {
    const { error } = await supabase.from('field_mapping_rules').update({ is_active: !r.is_active, updated_at: new Date().toISOString() }).eq('id', r.id);
    if (error) { showAlert('Update failed: ' + error.message, { variant: 'danger' }); return; }
    invalidateFieldMappingCache(); await fetchRules();
  };

  // Auto-map: custom fields with the same API name on both sides
  const autoMap = async (sec) => {
    const a = catalogs[sec.srcObj]?.options || [], b = catalogs[sec.tgtObj]?.options || [];
    const have = new Set(sec.rules.map(r => `${r.source_field_type}:${r.source_field}>${r.target_field_type}:${r.target_field}`));
    const pairs = a.filter(x => x.type === 'custom').map(x => [x, b.find(y => y.type === 'custom' && y.field === x.field)])
      .filter(([x, y]) => y && !have.has(`${x.type}:${x.field}>${y.type}:${y.field}`));
    if (!pairs.length) { showAlert('No unmapped custom fields share the same API name on both objects.', { variant: 'info' }); return; }
    const ok = await showConfirm(`Create ${pairs.length} copy map${pairs.length > 1 ? 's' : ''} for custom fields with matching API names?\n\n${pairs.map(([x]) => '• ' + x.label).join('\n')}`);
    if (!ok) return;
    const { error } = await supabase.from('field_mapping_rules').insert(pairs.map(([x, y]) => buildPayload(sec, x, y, { name: `Auto: ${x.label}`, is_active: true })));
    if (error) { showAlert('Auto-map failed: ' + error.message, { variant: 'danger' }); return; }
    invalidateFieldMappingCache(); await fetchRules();
  };

  const renderPicker = ({ obj, value, onChange, forTarget }) => {
    const cat = catalogs[obj];
    if (!cat) return <div className="text-xs text-gray-400 py-2">No field list for this object.</div>;
    const groups = ['Standard fields', 'Custom fields'];
    return (
      <>
      <select value={value} onChange={e => onChange(e.target.value)} className={sel}>
        <option value="">Select field…</option>
        {groups.map(g => {
          const opts = cat.options.filter(o => o.group === g && !(forTarget && (o.computed || (o.type === 'standard' && PROTECTED.has(o.field)))));
          return opts.length ? (
            <optgroup key={g} label={g}>
              {opts.map(o => <option key={o.value} value={o.value}>{o.label}{o.type === 'custom' ? ` (${o.field})` : ''}</option>)}
            </optgroup>
          ) : null;
        })}
      </select>
      <p className="text-[11px] text-gray-500">
        {cat.nStd} standard field{cat.nStd === 1 ? '' : 's'} · {cat.customLoaded ? `${cat.nCus} custom field${cat.nCus === 1 ? '' : 's'}` : 'loading custom fields…'}
        {cat.error && <span className="text-red-600"> · custom fields could not be loaded ({cat.error})</span>}
      </p>
      </>
    );
  };

  const srcSel = modal ? catalogs[modal.sec.srcObj]?.byValue?.[form.source] : null;
  const tgtSel = modal ? catalogs[modal.sec.tgtObj]?.byValue?.[form.target] : null;
  const typeWarn = srcSel && tgtSel && kind(srcSel.vtype) !== kind(tgtSel.vtype) && tgtSel.vtype !== 'text';

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
        <h3 className="text-lg font-bold text-[#0F172A] mb-1">🔗 Copy Maps <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 align-middle">v2 · tenant-isolated</span></h3>
        <p className="text-sm text-gray-500 mb-4">
          Copy values automatically: from a product onto its line item, or from a record (and its line items) onto the record created from it.
          Every standard and custom field — header and line item — is available. Maps are private to your organisation.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {TABS.map(t => (
            <button key={t.v} onClick={() => setTab(t.v)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.v ? 'bg-[#0F172A] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>{t.l}</button>
          ))}
          <div className="ml-auto flex gap-1 bg-gray-50 rounded-xl p-1">
            {['CRM / B2B', 'Retail'].map(m => (
              <button key={m} onClick={() => setModule(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${module === m ? 'bg-white shadow text-[#0F172A]' : 'text-gray-500'}`}>{m}</button>
            ))}
          </div>
        </div>

        {tab === 'product_to_line_item' ? (
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">When a product is picked in…</label>
            <select value={lineTarget} onChange={e => setLineTarget(e.target.value)} className={sel + ' max-w-sm'}>
              {lineOptions.map(t => <option key={t.v} value={t.v}>{objLabel(t.lineObject)}</option>)}
            </select>
          </div>
        ) : (
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">When this conversion happens…</label>
            <select value={conversion} onChange={e => setConversion(e.target.value)} className={sel + ' max-w-sm'}>
              {convOptions.map(c => <option key={c.v} value={c.v}>{objLabel(c.source)} → {objLabel(c.target)}</option>)}
            </select>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
        ) : view.map(sec => sec.scope === 'none' ? (
          <div key="none" className="border border-dashed border-gray-200 rounded-2xl mb-4 px-4 py-3 text-xs text-gray-500"><b>{sec.title}:</b> {sec.note}</div>
        ) : (
          <div key={sec.scope} className="border border-gray-100 rounded-2xl mb-4 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="font-bold text-sm text-[#0F172A]">{sec.title} <span className="text-gray-400 font-normal">({sec.rules.length})</span></div>
              <div className="flex gap-2">
                <button onClick={() => autoMap(sec)} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-semibold">✨ Auto-map same-named custom fields</button>
                <button onClick={() => openNew(sec)} className="px-3 py-1.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-xl text-xs font-semibold">+ New map</button>
              </div>
            </div>
            {sec.rules.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No copy maps here yet.</div>
            ) : sec.rules.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-[#0F172A] truncate">
                    {labelOf(sec.srcObj, r.source_field_type, r.source_field)} <span className="text-gray-400">→</span> {labelOf(sec.tgtObj, r.target_field_type, r.target_field)}
                    {!r.is_active && <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">INACTIVE</span>}
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono truncate">
                    {r.name ? r.name + ' · ' : ''}{r.source_field} ({r.source_field_type}) → {r.target_field} ({r.target_field_type})
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => toggleActive(r)} className="px-3 py-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-xl text-xs font-semibold border border-gray-200">{r.is_active ? 'Disable' : 'Enable'}</button>
                  <button onClick={() => openEdit(sec, r)} className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold border border-blue-200">Edit</button>
                  <button onClick={() => handleDelete(r)} className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-semibold border border-red-200">Delete</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-5 flex items-center justify-between">
              <h2 className="text-white text-lg font-bold">{modal.editing ? 'Edit' : 'New'} copy map</h2>
              <button onClick={() => setModal(null)} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-xs text-gray-500">{modal.sec.title}</div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name (optional)</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Copy security deposit" className={sel} />
              </div>
              <div className="bg-blue-50 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-bold text-blue-700 uppercase">Copy from: {objLabel(modal.sec.srcObj)}</div>
                {renderPicker({ obj: modal.sec.srcObj, value: form.source, onChange: v => setForm(f => ({ ...f, source: v })) })}
              </div>
              <div className="bg-purple-50 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-bold text-purple-700 uppercase">Copy to: {objLabel(modal.sec.tgtObj)}</div>
                {renderPicker({ obj: modal.sec.tgtObj, value: form.target, onChange: v => setForm(f => ({ ...f, target: v })), forTarget: true })}
                <p className="text-[11px] text-purple-600">Calculated and system fields are not offered as targets.</p>
              </div>
              {typeWarn && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">These fields have different types ({srcSel.vtype} → {tgtSel.vtype}); the value is copied as-is, so make sure it fits.</p>}
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} /> Active
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-[2] bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 shadow hover:opacity-90">
                  {saving ? 'Saving…' : (modal.editing ? 'Save changes' : 'Create map')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
