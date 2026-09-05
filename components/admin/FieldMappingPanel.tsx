// @ts-nocheck
'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';
import { useAlert } from '@/components/shared/AlertProvider';
import { invalidateFieldMappingCache } from '@/lib/useFieldMappingRules';
import { useObjectLabels } from '@/lib/useObjectLabels';

// Known conversions this app supports, each with its fixed source/target
// object pair — the admin picks the conversion, not the raw objects,
// since a mapping rule only makes sense for a conversion that actually
// exists in the app.
const CONVERSIONS = [
  { v: 'retailOrder_to_retailInvoice', l: 'Retail Order → Retail Invoice', source: 'retailOrders', target: 'retailInvoices' },
];

const STATIC_OBJECT_LABELS = {
  retailProducts: 'Retail Products', retailOrders: 'Retail Orders', retailInvoices: 'Retail Invoices',
};

export default function FieldMappingPanel() {
  const { appPreferences } = useApp();
  const { supabase, tenant } = useTenant();
  const { showAlert, showConfirm } = useAlert();
  const { getObjectLabel } = useObjectLabels();
  const [ruleType, setRuleType] = useState('product_to_line_item');
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customFieldsByObject, setCustomFieldsByObject] = useState({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '', conversion_context: CONVERSIONS[0].v,
    source_field: '', source_field_type: 'custom',
    target_field: '', target_field_type: 'custom',
    is_active: true,
  });
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const fetchRules = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from('field_mapping_rules').select('*').eq('rule_type', ruleType).order('created_at', { ascending: false });
    setRules(data || []);
    setLoading(false);
  };
  useEffect(() => { fetchRules(); }, [supabase, ruleType]);

  // Fetch custom fields for whichever objects are relevant, so the field
  // pickers below offer a real dropdown of what actually exists rather
  // than free text the admin has to type exactly right.
  const fetchCustomFieldsFor = async (objectType) => {
    if (!supabase || customFieldsByObject[objectType]) return;
    const { data } = await supabase.from('app_custom_fields').select('api_name, label').eq('object_type', objectType).eq('is_published', true);
    setCustomFieldsByObject(p => ({ ...p, [objectType]: data || [] }));
  };
  useEffect(() => {
    if (ruleType === 'product_to_line_item') fetchCustomFieldsFor('retailProducts');
    else {
      const conv = CONVERSIONS.find(c => c.v === form.conversion_context);
      if (conv) { fetchCustomFieldsFor(conv.source); fetchCustomFieldsFor(conv.target); }
    }
  }, [ruleType, form.conversion_context, supabase]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', conversion_context: CONVERSIONS[0].v, source_field: '', source_field_type: 'custom', target_field: '', target_field_type: 'custom', is_active: true });
    setOpen(true);
  };
  const openEdit = (rule) => {
    setEditing(rule);
    setForm({ name: rule.name || '', conversion_context: rule.conversion_context || CONVERSIONS[0].v,
      source_field: rule.source_field, source_field_type: rule.source_field_type,
      target_field: rule.target_field, target_field_type: rule.target_field_type, is_active: rule.is_active });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.source_field || !form.target_field) { showAlert('Both a source and target field are required.', { variant: 'warning' }); return; }
    setSaving(true);
    try {
      const conv = ruleType === 'record_conversion' ? CONVERSIONS.find(c => c.v === form.conversion_context) : null;
      const payload = {
        tenant_id: tenant?.id || null,
        rule_type: ruleType,
        name: form.name || null,
        source_object: ruleType === 'product_to_line_item' ? 'retailProducts' : conv?.source,
        source_field: form.source_field, source_field_type: form.source_field_type,
        target_object: ruleType === 'product_to_line_item' ? 'retail_order_line_items' : conv?.target,
        target_field: form.target_field, target_field_type: form.target_field_type,
        conversion_context: ruleType === 'record_conversion' ? form.conversion_context : null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };
      if (editing) await supabase.from('field_mapping_rules').update(payload).eq('id', editing.id);
      else await supabase.from('field_mapping_rules').insert([payload]);
      invalidateFieldMappingCache();
      setOpen(false);
      await fetchRules();
    } catch (e: any) {
      showAlert('Save failed: ' + (e?.message || 'Unknown error'), { variant: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule) => {
    const ok = await showConfirm('Delete this mapping rule? This cannot be undone.');
    if (!ok) return;
    await supabase.from('field_mapping_rules').delete().eq('id', rule.id);
    invalidateFieldMappingCache();
    await fetchRules();
  };

  const sourceObjectType = ruleType === 'product_to_line_item' ? 'retailProducts' : CONVERSIONS.find(c => c.v === form.conversion_context)?.source;
  const targetObjectType = ruleType === 'record_conversion' ? CONVERSIONS.find(c => c.v === form.conversion_context)?.target : null;
  const sourceObjectLabel = getObjectLabel(sourceObjectType, STATIC_OBJECT_LABELS[sourceObjectType] || sourceObjectType);
  const targetObjectLabel = targetObjectType ? getObjectLabel(targetObjectType, STATIC_OBJECT_LABELS[targetObjectType] || targetObjectType) : 'Line Item';

  const sourceFieldsForForm = ruleType === 'product_to_line_item'
    ? (customFieldsByObject['retailProducts'] || [])
    : (customFieldsByObject[CONVERSIONS.find(c => c.v === form.conversion_context)?.source] || []);
  const targetFieldsForForm = ruleType === 'record_conversion'
    ? (customFieldsByObject[CONVERSIONS.find(c => c.v === form.conversion_context)?.target] || [])
    : []; // line item target fields are free-text — line items don't have their own app_custom_fields registry the way header objects do

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
        <h3 className="text-lg font-bold text-[#0F172A] mb-1">🔗 Field Mapping (Copy Maps)</h3>
        <p className="text-sm text-gray-500 mb-4">Automatically copy a field's value from one record onto another — e.g. a product's Security Deposit custom field onto its line item, or a field from an Order onto the Invoice created from it.</p>

        <div className="flex gap-2 mb-5">
          {[
            { v: 'product_to_line_item', l: '📦 Product → Line Item' },
            { v: 'record_conversion', l: '🔄 Record Conversion' },
          ].map(t => (
            <button key={t.v} onClick={() => setRuleType(t.v)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${ruleType===t.v ? 'bg-[#0F172A] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
              {t.l}
            </button>
          ))}
        </div>

        <button onClick={openNew} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow hover:opacity-90 mb-4">
          + New Mapping Rule
        </button>

        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm">Loading...</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            No {ruleType === 'product_to_line_item' ? 'product-to-line-item' : 'record conversion'} mapping rules yet.
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3">
                <div>
                  <div className="font-semibold text-sm text-[#0F172A]">
                    {rule.name || `${rule.source_field} → ${rule.target_field}`}
                    {!rule.is_active && <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">INACTIVE</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {rule.rule_type === 'record_conversion' && (() => {
                      const conv = CONVERSIONS.find(c => c.v === rule.conversion_context);
                      return conv ? <span className="mr-2 font-mono">{getObjectLabel(conv.source, STATIC_OBJECT_LABELS[conv.source] || conv.source)} → {getObjectLabel(conv.target, STATIC_OBJECT_LABELS[conv.target] || conv.target)}</span> : <span className="mr-2 font-mono">{rule.conversion_context}</span>;
                    })()}
                    <span className="font-mono">{rule.source_field}</span> ({rule.source_field_type}) → <span className="font-mono">{rule.target_field}</span> ({rule.target_field_type})
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(rule)} className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold border border-blue-200">Edit</button>
                  <button onClick={() => handleDelete(rule)} className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-semibold border border-red-200">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-5 flex items-center justify-between">
              <h2 className="text-white text-lg font-bold">{editing ? 'Edit' : 'New'} Mapping Rule</h2>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rule Name (optional)</label>
                <input value={form.name} onChange={e => s('name', e.target.value)} placeholder="e.g. Copy Security Deposit"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>

              {ruleType === 'record_conversion' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Conversion</label>
                  <select value={form.conversion_context} onChange={e => s('conversion_context', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                    {CONVERSIONS.map(c => <option key={c.v} value={c.v}>{getObjectLabel(c.source, STATIC_OBJECT_LABELS[c.source] || c.source)} → {getObjectLabel(c.target, STATIC_OBJECT_LABELS[c.target] || c.target)}</option>)}
                  </select>
                </div>
              )}

              <div className="bg-blue-50 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-bold text-blue-700 uppercase">
                  Source: {sourceObjectLabel}
                </div>
                <select value={form.source_field} onChange={e => s('source_field', e.target.value)}
                  className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                  <option value="">Select field...</option>
                  {sourceFieldsForForm.map(f => <option key={f.api_name} value={f.api_name}>{f.label} ({f.api_name})</option>)}
                </select>
                {sourceFieldsForForm.length === 0 && <p className="text-[11px] text-blue-600">No custom fields found for this object yet — add one via App Composer first.</p>}
              </div>

              <div className="bg-purple-50 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-bold text-purple-700 uppercase">
                  Target: {ruleType === 'product_to_line_item' ? 'Line Item' : targetObjectLabel}
                </div>
                {ruleType === 'product_to_line_item' ? (
                  <>
                    <input value={form.target_field} onChange={e => s('target_field', e.target.value)} placeholder="e.g. security_deposit"
                      className="w-full border border-purple-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-purple-400" />
                    <p className="text-[11px] text-purple-600">The API name of the line-item custom field to write into. If it doesn't exist yet, add it via App Composer for the relevant object with "Show On" set to include line items.</p>
                  </>
                ) : (
                  <select value={form.target_field} onChange={e => s('target_field', e.target.value)}
                    className="w-full border border-purple-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-purple-400">
                    <option value="">Select field...</option>
                    {targetFieldsForForm.map(f => <option key={f.api_name} value={f.api_name}>{f.label} ({f.api_name})</option>)}
                  </select>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={form.is_active} onChange={e => s('is_active', e.target.checked)} />
                Active
              </label>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setOpen(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-[2] bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 shadow hover:opacity-90">
                  {saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Rule')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
