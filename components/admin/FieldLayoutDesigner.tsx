// @ts-nocheck
'use client';
/**
 * Field Layout Designer
 * Enterprise standard-field customization for BOTH Retail (B2C) and CRM
 * (B2B) objects — comparable to Oracle Fusion's Application Composer /
 * Salesforce Page Layouts. Distinct from AppComposer (which defines
 * brand-new custom fields): this only changes how EXISTING standard fields
 * display and behave — custom label, hidden/visible, read-only/editable,
 * conditional rules based on the record's own data, and field ordering.
 * - Save Draft → persists to field_layout_config/field_layout_sections
 * - Publish → sets is_published=true, changes take effect on real pages
 */
import { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAlert } from '@/components/shared/AlertProvider';
import { RETAIL_CONFIG } from '@/components/retail/RetailListPage';
import { FIELD_LABELS as CRM_FIELD_LABELS } from '@/components/crm/CRMListPage';
import { getObjectFields, withTimeout } from '@/lib/utils';
import { invalidateFieldLayoutCache } from '@/lib/useFieldLayout';
import { invalidateObjectLabelCache } from '@/lib/useObjectLabels';

// ─── Object registry — spans both Retail and CRM from the start ───────────
const RETAIL_OBJECTS = [
  { v: 'retailCustomers',  l: 'Retail Customers',  group: 'Retail' },
  { v: 'retailProducts',   l: 'Retail Products',   group: 'Retail' },
  { v: 'retailActivities', l: 'Retail Activities', group: 'Retail' },
  { v: 'retailOrders',     l: 'Retail Orders',     group: 'Retail' },
  { v: 'retailInvoices',   l: 'Retail Invoices',   group: 'Retail' },
];
const CRM_OBJECTS = [
  { v: 'customers',     l: 'Customers',     group: 'CRM' },
  { v: 'contacts',      l: 'Contacts',      group: 'CRM' },
  { v: 'products',      l: 'Products',      group: 'CRM' },
  { v: 'leads',         l: 'Leads',         group: 'CRM' },
  { v: 'opportunities', l: 'Opportunities', group: 'CRM' },
  { v: 'orders',        l: 'Orders',        group: 'CRM' },
  { v: 'invoices',      l: 'Invoices',      group: 'CRM' },
  { v: 'activities',    l: 'Activities',    group: 'CRM' },
];
const ALL_OBJECTS = [...RETAIL_OBJECTS, ...CRM_OBJECTS];

const OPERATORS = [
  { v: 'equals',        l: 'equals' },
  { v: 'not_equals',    l: 'does not equal' },
  { v: 'is_empty',      l: 'is empty' },
  { v: 'is_not_empty',  l: 'is not empty' },
];

// Returns the standard field list (key + original label) for any object,
// pulling from each side's real, existing source of truth rather than a
// separately maintained duplicate that could drift out of sync.
function getStandardFields(objectType: string): { key: string; label: string }[] {
  const isRetail = objectType.startsWith('retail');
  if (isRetail) {
    const cfg = RETAIL_CONFIG[objectType];
    if (!cfg) return [];
    const fields: { key: string; label: string }[] = [];
    for (const section of cfg.sections || []) {
      const sectionFields = Array.isArray(section.fields) ? section.fields : [];
      for (const f of sectionFields) fields.push({ key: f.key, label: f.label });
    }
    return fields;
  }
  const keys = getObjectFields(objectType);
  return keys.map(k => ({ key: k, label: CRM_FIELD_LABELS[k] || k }));
}

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400';

function emptyRule() {
  return { condition_field: '', operator: 'equals', condition_value: '', then_visibility: '', then_editability: '' };
}

const PAGE_SCOPES = [
  { v: 'both',   l: 'Both Pages', desc: 'Applies to Detail and Create' },
  { v: 'detail', l: 'Detail Page Only', desc: 'Only overrides the record detail page' },
  { v: 'create', l: 'Create Page Only', desc: 'Only overrides the new-record form' },
];

export default function FieldLayoutDesigner() {
  const { supabase, tenant } = useTenant();
  const { showAlert, showConfirm } = useAlert();
  const [selectedObj, setSelectedObj] = useState('retailOrders');
  const [pageScope, setPageScope] = useState('both');
  const [rows, setRows] = useState<any[]>([]); // one row per standard field, merged with any saved override
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [expandedRules, setExpandedRules] = useState<Record<string, boolean>>({});
  const [objectLabelForm, setObjectLabelForm] = useState({ singular: '', plural: '', is_published: false, id: null });
  const [savingObjectLabel, setSavingObjectLabel] = useState(false);

  const standardFields = getStandardFields(selectedObj);

  useEffect(() => { load(); loadObjectLabel(); }, [selectedObj, pageScope]);

  async function loadObjectLabel() {
    if (!supabase) return;
    const { data } = await supabase.from('object_label_overrides').select('*').eq('object_type', selectedObj).eq('tenant_id', tenant?.id || null).maybeSingle();
    setObjectLabelForm({ singular: data?.custom_label_singular || '', plural: data?.custom_label_plural || '', is_published: data?.is_published || false, id: data?.id || null });
  }

  async function saveObjectLabel(publish: boolean) {
    if (!supabase) return;
    setSavingObjectLabel(true);
    try {
      const payload = {
        tenant_id: tenant?.id || null,
        object_type: selectedObj,
        custom_label_singular: objectLabelForm.singular || null,
        custom_label_plural: objectLabelForm.plural || null,
        is_published: publish ? true : objectLabelForm.is_published,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('object_label_overrides').upsert(payload, { onConflict: 'tenant_id,object_type' });
      if (error) throw new Error(error.message);
      invalidateObjectLabelCache();
      await loadObjectLabel();
      showAlert(publish ? 'Object name published — now shown throughout the nav and page headers.' : 'Draft saved.', { variant: 'success' });
    } catch (e: any) {
      showAlert('Could not save: ' + (e?.message || 'Unknown error'), { variant: 'danger' });
    } finally {
      setSavingObjectLabel(false);
    }
  }

  async function load() {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data } = await withTimeout(
        supabase.from('field_layout_config').select('*')
          .eq('object_type', selectedObj).eq('tenant_id', tenant?.id || null).eq('page_scope', pageScope),
        15000, 'Load field layout'
      );
      const overrideMap: Record<string, any> = {};
      (data || []).forEach(r => { overrideMap[r.field_key] = r; });

      const merged = standardFields.map((f, idx) => {
        const o = overrideMap[f.key];
        return {
          field_key: f.key,
          default_label: f.label,
          custom_label: o?.custom_label || '',
          visibility_mode: o?.visibility_mode || 'visible',
          editability_mode: o?.editability_mode || 'editable',
          conditional_rules: o?.conditional_rules || [],
          display_order: o?.display_order ?? idx,
          is_published: o?.is_published || false,
          id: o?.id || null,
        };
      }).sort((a, b) => a.display_order - b.display_order);

      setRows(merged);
    } catch (e) {
      console.error('[FieldLayoutDesigner] load', e);
      showAlert('Could not load field layout — the field_layout_config table may not exist yet. Run the SQL migration first.', { variant: 'warning' });
    }
    setLoading(false);
  }

  function upd(idx: number, key: string, value: any) {
    setRows(p => p.map((r, i) => i === idx ? { ...r, [key]: value } : r));
  }

  function addRule(idx: number) {
    setRows(p => p.map((r, i) => i === idx ? { ...r, conditional_rules: [...(r.conditional_rules || []), emptyRule()] } : r));
  }
  function updRule(idx: number, ruleIdx: number, key: string, value: any) {
    setRows(p => p.map((r, i) => i === idx ? { ...r, conditional_rules: r.conditional_rules.map((rule: any, ri: number) => ri === ruleIdx ? { ...rule, [key]: value } : rule) } : r));
  }
  function removeRule(idx: number, ruleIdx: number) {
    setRows(p => p.map((r, i) => i === idx ? { ...r, conditional_rules: r.conditional_rules.filter((_: any, ri: number) => ri !== ruleIdx) } : r));
  }

  // Native HTML5 drag-and-drop reordering — same dependency-free approach
  // already used in KanbanBoard.tsx, avoiding a new library for this.
  function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) return;
    setRows(p => {
      const arr = [...p];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(targetIdx, 0, moved);
      return arr.map((r, i) => ({ ...r, display_order: i }));
    });
    setDragIdx(null);
  }

  async function persist(publish: boolean) {
    if (!supabase) return;
    publish ? setPublishing(true) : setSaving(true);
    try {
      for (const row of rows) {
        const { error } = await withTimeout(
          supabase.from('field_layout_config').upsert({
            tenant_id: tenant?.id || null,
            object_type: selectedObj,
            field_key: row.field_key,
            page_scope: pageScope,
            custom_label: row.custom_label || null,
            visibility_mode: row.visibility_mode,
            editability_mode: row.editability_mode,
            display_order: row.display_order,
            conditional_rules: row.conditional_rules || [],
            is_published: publish ? true : row.is_published,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'tenant_id,object_type,field_key,page_scope' }),
          15000, 'Save field layout'
        );
        if (error) throw new Error(error.message);
      }
      invalidateFieldLayoutCache(selectedObj);
      showAlert(publish ? 'Layout published — changes are now live on record pages.' : 'Draft saved.', { variant: 'success' });
      load();
    } catch (e: any) {
      showAlert('Could not save: ' + (e?.message || 'Unknown error'), { variant: 'danger' });
    } finally {
      setSaving(false); setPublishing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-purple-900 to-purple-700 rounded-[24px] p-6 text-white">
        <h2 className="text-2xl font-bold flex items-center gap-2">🧱 Page Layout Designer</h2>
        <p className="text-purple-200 text-sm mt-1">Relabel, show/hide, lock, and reorder standard fields on any object's record page — no code changes needed.</p>
      </div>

      <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Object</label>
        <select value={selectedObj} onChange={e => setSelectedObj(e.target.value)} className={iCls + ' max-w-sm'}>
          <optgroup label="Retail">{RETAIL_OBJECTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</optgroup>
          <optgroup label="CRM">{CRM_OBJECTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</optgroup>
        </select>

        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 mt-4">Which page</label>
        <div className="flex gap-2 flex-wrap">
          {PAGE_SCOPES.map(p => (
            <button key={p.v} onClick={() => setPageScope(p.v)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${pageScope===p.v ? 'bg-purple-700 text-white border-transparent' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-purple-300'}`}>
              {p.l}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Each tab manages its own independent set of overrides. A field with a rule under "Both Pages" won't show it here on "Detail Page Only" or "Create Page Only" — switch tabs to see or edit each one. A page-specific rule always takes priority over a "Both Pages" rule for the same field.
        </p>
      </div>

      <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-[#0F172A] mb-1">🏷️ Object Display Name</h3>
        <div className="inline-block bg-purple-50 border border-purple-200 rounded-lg px-3 py-1 mb-2">
          <span className="text-xs text-purple-700">Editing: <strong>{[...RETAIL_OBJECTS, ...CRM_OBJECTS].find(o => o.v === selectedObj)?.l}</strong></span>
        </div>
        <p className="text-xs text-gray-400 mb-3">Rename this entire object throughout the app's nav and page headers — e.g. "Customers" → "Patients" for a healthcare tenant. Independent of the field overrides above.</p>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Singular (e.g. "Create ___")</label>
            <input value={objectLabelForm.singular} onChange={e => setObjectLabelForm(p => ({ ...p, singular: e.target.value }))}
              placeholder="Customer" className={iCls} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Plural (nav & page header)</label>
            <input value={objectLabelForm.plural} onChange={e => setObjectLabelForm(p => ({ ...p, plural: e.target.value }))}
              placeholder="Customers" className={iCls} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          {objectLabelForm.is_published && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full mr-auto">LIVE</span>}
          <button onClick={() => saveObjectLabel(false)} disabled={savingObjectLabel}
            className="px-4 py-2 rounded-xl border-2 border-purple-600 text-purple-700 text-xs font-bold hover:bg-purple-50 disabled:opacity-40">
            Save Draft
          </button>
          <button onClick={() => saveObjectLabel(true)} disabled={savingObjectLabel}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-700 to-purple-900 text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 shadow-md">
            {savingObjectLabel ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, idx) => (
            <div
              key={row.field_key}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(idx)}
              className={`bg-white rounded-[20px] border shadow-sm p-4 transition-all ${dragIdx === idx ? 'opacity-40' : 'border-gray-200'}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('text/plain', String(idx)); setDragIdx(idx); }}
                  onDragEnd={() => setDragIdx(null)}
                  className="cursor-move text-gray-300 text-lg select-none"
                  title="Drag to reorder"
                >⠿</span>
                <div className="flex-1">
                  <span className="font-bold text-sm text-[#0F172A]">{row.default_label}</span>
                  <span className="text-xs text-gray-400 font-mono ml-2">{row.field_key}</span>
                </div>
                {row.is_published && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">LIVE</span>}
              </div>

              <div className="grid sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Custom Label</label>
                  <input value={row.custom_label} onChange={e => upd(idx, 'custom_label', e.target.value)} placeholder={row.default_label} className={iCls} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Visibility</label>
                  <div className="flex gap-2">
                    {['visible', 'hidden'].map(m => (
                      <button key={m} onClick={() => upd(idx, 'visibility_mode', m)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${row.visibility_mode === m ? 'bg-[#0F172A] text-white border-transparent' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {m === 'visible' ? 'Visible' : 'Hidden'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Editability</label>
                  <div className="flex gap-2">
                    {['editable', 'readonly'].map(m => (
                      <button key={m} onClick={() => upd(idx, 'editability_mode', m)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${row.editability_mode === m ? 'bg-[#0F172A] text-white border-transparent' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {m === 'editable' ? 'Editable' : 'Read-only'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={() => setExpandedRules(p => ({ ...p, [row.field_key]: !p[row.field_key] }))} className="text-xs font-semibold text-purple-600 hover:underline">
                {expandedRules[row.field_key] ? '▾' : '▸'} Conditional rules {row.conditional_rules?.length > 0 && `(${row.conditional_rules.length})`}
              </button>

              {expandedRules[row.field_key] && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  {(row.conditional_rules || []).map((rule: any, ri: number) => (
                    <div key={ri} className="flex flex-wrap items-center gap-2 bg-purple-50 rounded-xl p-2.5">
                      <span className="text-xs font-semibold text-gray-500">If</span>
                      <select value={rule.condition_field} onChange={e => updRule(idx, ri, 'condition_field', e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[#0F172A]">
                        <option value="">field…</option>
                        {standardFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                      <select value={rule.operator} onChange={e => updRule(idx, ri, 'operator', e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[#0F172A]">
                        {OPERATORS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                      {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
                        <input value={rule.condition_value} onChange={e => updRule(idx, ri, 'condition_value', e.target.value)} placeholder="value" className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[#0F172A] w-28" />
                      )}
                      <span className="text-xs font-semibold text-gray-500">then</span>
                      <select value={rule.then_visibility} onChange={e => updRule(idx, ri, 'then_visibility', e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[#0F172A]">
                        <option value="">(no change)</option>
                        <option value="visible">Show field</option>
                        <option value="hidden">Hide field</option>
                      </select>
                      <select value={rule.then_editability} onChange={e => updRule(idx, ri, 'then_editability', e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[#0F172A]">
                        <option value="">(no change)</option>
                        <option value="editable">Make editable</option>
                        <option value="readonly">Make read-only</option>
                      </select>
                      <button onClick={() => removeRule(idx, ri)} className="text-red-400 hover:text-red-600 text-xs font-bold ml-auto">✕</button>
                    </div>
                  ))}
                  <button onClick={() => addRule(idx)} className="text-xs font-semibold text-purple-600 hover:underline">+ Add condition</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
        <button onClick={() => persist(false)} disabled={saving || publishing}
          className="px-5 py-2.5 rounded-xl border-2 border-purple-600 text-purple-700 text-sm font-bold hover:bg-purple-50 disabled:opacity-40">
          {saving ? 'Saving…' : 'Save Draft'}
        </button>
        <button onClick={() => persist(true)} disabled={saving || publishing}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-purple-900 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 shadow-md">
          {publishing ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    </div>
  );
}
