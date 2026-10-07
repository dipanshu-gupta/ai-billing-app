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
import { getObjectFields, withTimeout, tenantScope } from '@/lib/utils';
import { invalidateFieldLayoutCache } from '@/lib/useFieldLayout';
import { invalidateObjectLabelCache } from '@/lib/useObjectLabels';
import { useCustomFields, invalidateCustomFieldCache } from '@/lib/useCustomFields';
import { useApp } from '@/context/AppContext';
import StatusValuesCard from '@/components/admin/StatusValuesCard';
import { fetchCustomObjects, fetchCustomObjectFields } from '@/lib/customObjects';

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
  { v: 'quotations',    l: 'Quotations',    group: 'CRM' },
  { v: 'orders',        l: 'Orders',        group: 'CRM' },
  { v: 'invoices',      l: 'Invoices',      group: 'CRM' },
  { v: 'activities',    l: 'Activities',    group: 'CRM' },
];
// Line items use the same object_type-as-distinct-object convention
// already established for line-item custom fields (migration 11) rather
// than a new field_scope column - object_type is a plain text column in
// both field_layout_config and app_custom_fields, so a line-item "object"
// works with the existing schema as-is.
export const RETAIL_LINE_ITEM_OBJECTS = [
  { v: 'retailOrderLineItems',   l: 'Retail Order Line Items',   group: 'Retail Line Items' },
  { v: 'retailInvoiceLineItems', l: 'Retail Invoice Line Items', group: 'Retail Line Items' },
];
export const CRM_LINE_ITEM_OBJECTS = [
  { v: 'quotationLineItems', l: 'Quotation Line Items', group: 'CRM Line Items' },
  { v: 'orderLineItems',     l: 'Order Line Items',     group: 'CRM Line Items' },
  { v: 'invoiceLineItems',   l: 'Invoice Line Items',   group: 'CRM Line Items' },
];
const ALL_OBJECTS = [...RETAIL_OBJECTS, ...CRM_OBJECTS, ...RETAIL_LINE_ITEM_OBJECTS, ...CRM_LINE_ITEM_OBJECTS];
export const LINE_ITEM_OBJECT_TYPES = new Set([...RETAIL_LINE_ITEM_OBJECTS, ...CRM_LINE_ITEM_OBJECTS].map(o => o.v));

// Standard line-item fields - hardcoded here the same way RETAIL_CONFIG's
// header sections are the source of truth for header fields, since line
// item columns are defined directly in each grid's own JSX rather than a
// shared config object.
export const LINE_ITEM_STANDARD_FIELDS: Record<string, { key: string; label: string; type: string; computed?: boolean; defaultHidden?: boolean }[]> = {
  retailOrderLineItems: [
    { key: '__create_grid', label: '▶ Show this Line Items grid on the Create page (Visible = shown)', type: 'toggle', computed: true, defaultHidden: true },
    { key: 'product_name',      label: 'Product',       type: 'text' },
    { key: 'rental_start_date', label: 'Rental Start',  type: 'date' },
    { key: 'rental_end_date',   label: 'Rental End',    type: 'date' },
    { key: 'quantity',          label: 'Qty',           type: 'number' },
    { key: 'unit_price',        label: 'Unit Price',    type: 'number' },
    { key: 'discount_pct',      label: 'Disc %',        type: 'number' },
    // Tax columns vary by the tenant's configured tax regime - all four
    // possible sets are listed here so a layout override is available
    // regardless of which regime a given tenant is actually on (only the
    // fields matching their real regime ever render in the grid itself,
    // so an unused override here is simply inert, not incorrect).
    { key: 'hsn_code',          label: 'HSN/SAC',       type: 'text' },          // India GST
    { key: 'gst_rate',          label: 'GST %',         type: 'select' },        // India GST
    { key: 'taxable',           label: 'Taxable',       type: 'select' },        // US Sales Tax
    { key: 'sales_tax_rate',    label: 'Sales Tax %',   type: 'number' },        // US Sales Tax
    { key: 'vat_rate',          label: 'VAT %',         type: 'select' },        // UK VAT
    { key: 'tax_pct',           label: 'Tax %',         type: 'number' },        // Generic
    // Computed grid totals — not stored as their own editable input, so
    // they get relabel/hide only (no Editability toggle, no Default Value).
    { key: 'net_amount',        label: 'Net Amount',    type: 'number', computed: true },
    { key: 'extended_price',    label: 'Line Total',    type: 'number', computed: true },
  ],
  retailInvoiceLineItems: [
    { key: '__create_grid', label: '▶ Show this Line Items grid on the Create page (Visible = shown)', type: 'toggle', computed: true, defaultHidden: true },
    { key: 'product_name',      label: 'Product',       type: 'text' },
    { key: 'rental_start_date', label: 'Rental Start',  type: 'date' },
    { key: 'rental_end_date',   label: 'Rental End',    type: 'date' },
    { key: 'quantity',          label: 'Qty',           type: 'number' },
    { key: 'unit_price',        label: 'Unit Price',    type: 'number' },
    { key: 'discount_pct',      label: 'Disc %',        type: 'number' },
    { key: 'hsn_code',          label: 'HSN/SAC',       type: 'text' },
    { key: 'gst_rate',          label: 'GST %',         type: 'select' },
    { key: 'taxable',           label: 'Taxable',       type: 'select' },
    { key: 'sales_tax_rate',    label: 'Sales Tax %',   type: 'number' },
    { key: 'vat_rate',          label: 'VAT %',         type: 'select' },
    { key: 'tax_pct',           label: 'Tax %',         type: 'number' },
    { key: 'net_amount',        label: 'Net Amount',    type: 'number', computed: true },
    { key: 'extended_price',    label: 'Line Total',    type: 'number', computed: true },
  ],
  quotationLineItems: [
    { key: '__create_grid', label: '▶ Show this Line Items grid on the Create page (Visible = shown)', type: 'toggle', computed: true, defaultHidden: true },
    { key: 'product_name', label: 'Product',     type: 'text' },
    { key: 'quantity',     label: 'Quantity',    type: 'number' },
    { key: 'unit_price',   label: 'Unit Price',  type: 'number' },
    { key: 'discount_pct', label: 'Discount %',  type: 'number' },
    { key: 'tax_pct',      label: 'Tax %',       type: 'number' },
    { key: 'extended_price', label: 'Extended (Line Total)', type: 'number', computed: true },
  ],
  // orderLineItems/invoiceLineItems previously listed 'unit_price' and
  // 'discount_pct' here, copied from the retail/quotation line-item field
  // lists above — but order_line_items and invoice_line_items (verified
  // directly against the live DB schema) were never given those columns;
  // their real columns are 'price' and 'discount' (LineItemsTable.tsx,
  // the actual editor for these two objects, reads/writes item.price
  // throughout — never unit_price). Since this same field list feeds the
  // "Line Items" group in the Workflow Rules notification field picker and
  // the line-item condition scope in Workflow/Assignment/SLA rules
  // (getLineItemFieldsFor/getLineItemFieldsWithCustom in AdminToolsPage.tsx),
  // picking "Unit Price" or "Discount %" for an Order or Invoice always
  // resolved to nothing server-side — the same class of bug as the
  // "Customer" field, just on line items instead of the header record.
  orderLineItems: [
    { key: '__create_grid', label: '▶ Show this Line Items grid on the Create page (Visible = shown)', type: 'toggle', computed: true, defaultHidden: true },
    { key: 'product_name', label: 'Product',     type: 'text' },
    { key: 'quantity',     label: 'Quantity',    type: 'number' },
    { key: 'price',        label: 'Price',       type: 'number' },
    { key: 'discount',     label: 'Discount',    type: 'number' },
    { key: 'tax_pct',      label: 'Tax %',       type: 'number' },
    { key: 'extended_price', label: 'Extended (Line Total)', type: 'number', computed: true },
  ],
  invoiceLineItems: [
    { key: '__create_grid', label: '▶ Show this Line Items grid on the Create page (Visible = shown)', type: 'toggle', computed: true, defaultHidden: true },
    { key: 'product_name', label: 'Product',     type: 'text' },
    { key: 'quantity',     label: 'Quantity',    type: 'number' },
    { key: 'price',        label: 'Price',       type: 'number' },
    { key: 'discount',     label: 'Discount',    type: 'number' },
    { key: 'tax_pct',      label: 'Tax %',       type: 'number' },
    { key: 'extended_price', label: 'Extended (Line Total)', type: 'number', computed: true },
  ],
};

const OPERATORS = [
  { v: 'equals',        l: 'equals' },
  { v: 'not_equals',    l: 'does not equal' },
  { v: 'is_empty',      l: 'is empty' },
  { v: 'is_not_empty',  l: 'is not empty' },
];

// Returns the standard field list (key + original label) for any object,
// pulling from each side's real, existing source of truth rather than a
// separately maintained duplicate that could drift out of sync.
const CRM_DATE_FIELDS = new Set(['created_at','updated_at','closeDate','expectedCloseDate','dueDate','deliveryDate','activityDate','validity_date']);
const CRM_NUMBER_FIELDS = new Set(['amount','price','cost','probability','stock_quantity','reorder_level','taxRate']);

export function getStandardFields(objectType: string): { key: string; label: string; type: string }[] {
  if (LINE_ITEM_OBJECT_TYPES.has(objectType)) return LINE_ITEM_STANDARD_FIELDS[objectType] || [];
  const isRetail = objectType.startsWith('retail');
  if (isRetail) {
    const cfg = RETAIL_CONFIG[objectType];
    if (!cfg) return [];
    const fields: { key: string; label: string; type: string }[] = [];
    for (const section of cfg.sections || []) {
      const sectionFields = Array.isArray(section.fields) ? section.fields : [];
      for (const f of sectionFields) fields.push({ key: f.key, label: f.label, type: f.type || 'text' });
    }
    return fields;
  }
  const keys = [...getObjectFields(objectType)];
  // Header blocks of the B2B Order / Invoice detail that the page also honours.
  if (objectType === 'orders' || objectType === 'invoices') {
    for (const k of ['billingAddress','shippingAddress','overall_discount','shipping_cost','notes']) if (!keys.includes(k)) keys.push(k);
  }
  const EXTRA_LABELS: Record<string,string> = { validity_date:'Validity Date', payment_terms:'Payment Terms', shipping_terms:'Shipping Terms', template_id:'Template', internal_notes:'Internal Notes', billingAddress:'Billing Address', shippingAddress:'Shipping Address', overall_discount:'Overall Discount (%)', shipping_cost:'Shipping Cost', notes:'Notes' };
  return keys.map(k => ({ key: k, label: CRM_FIELD_LABELS[k] || EXTRA_LABELS[k] || k, type: CRM_DATE_FIELDS.has(k) ? 'date' : (CRM_NUMBER_FIELDS.has(k) || k==='overall_discount' || k==='shipping_cost') ? 'number' : 'text' }));
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

// Parses a stored default_value string into its editable parts. A relative
// reference looks like "rental_start_date+3" or "rental_start_date-1" -
// unambiguous against a fixed value since a real field key is always an
// identifier (letters/digits/underscore, never starting with a digit),
// never a valid date string or the reserved word "today".
const RELATIVE_DEFAULT_RE = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*([+-]\d+)?$/;
// "rental_start_date+duration:rental_duration" - a date field's end value
// driven by a custom select field on the same line item (e.g. a "Rental
// Duration" dropdown with options like "1 Month"/"Quarter"/"Half Year"/
// "Full Year") instead of a fixed day offset. durationField is that custom
// field's api_name; checked before RELATIVE_DEFAULT_RE since its shape
// ("+duration:xxx") never matches a plain signed-integer offset anyway, but
// being explicit keeps the two parse paths obviously distinct.
const DURATION_DEFAULT_RE = /^([a-zA-Z_][a-zA-Z0-9_]*)\+duration:([a-zA-Z_][a-zA-Z0-9_]*)$/;
function parseDefaultValue(raw: string) {
  if (!raw) return { mode: 'fixed', fixedValue: '', refField: '', offset: 0, durationField: '' };
  if (raw === 'today') return { mode: 'today', fixedValue: '', refField: '', offset: 0, durationField: '' };
  const dm = raw.match(DURATION_DEFAULT_RE);
  if (dm) return { mode: 'duration', fixedValue: '', refField: dm[1], offset: 0, durationField: dm[2] };
  const m = raw.match(RELATIVE_DEFAULT_RE);
  if (m) return { mode: 'relative', fixedValue: '', refField: m[1], offset: m[2] ? parseInt(m[2], 10) : 0, durationField: '' };
  return { mode: 'fixed', fixedValue: raw, refField: '', offset: 0, durationField: '' };
}
function serializeDefaultValue(parts: { mode: string; fixedValue: string; refField: string; offset: number; durationField?: string }) {
  if (parts.mode === 'today') return 'today';
  if (parts.mode === 'duration') {
    if (!parts.refField || !parts.durationField) return '';
    return `${parts.refField}+duration:${parts.durationField}`;
  }
  if (parts.mode === 'relative') {
    if (!parts.refField) return '';
    return parts.offset ? `${parts.refField}${parts.offset > 0 ? '+' : ''}${parts.offset}` : parts.refField;
  }
  return parts.fixedValue || '';
}

export default function FieldLayoutDesigner() {
  const { supabase, tenant } = useTenant();
  const { showAlert, showConfirm } = useAlert();
  const { fetchCustomObjects: refreshCustomObjects } = useApp();
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

  // Custom Objects — same Page Layout Designer, same relabel/hide/readonly/
  // default-value mechanism, just sourced from custom_object_fields instead
  // of a hardcoded standard-field list. object_type for a custom object's
  // header is 'custom_<api_name>' (a plain text column already, so this
  // needs zero schema change to field_layout_config).
  const isCustomObject = selectedObj.startsWith('custom_');
  const [customObjectsList, setCustomObjectsList] = useState<any[]>([]);
  const [customObjFieldRows, setCustomObjFieldRows] = useState<any[]>([]);
  useEffect(() => { fetchCustomObjects().then(setCustomObjectsList); }, []);
  useEffect(() => {
    if (!isCustomObject) { setCustomObjFieldRows([]); return; }
    const obj = customObjectsList.find(o => `custom_${o.api_name}` === selectedObj);
    if (!obj) { setCustomObjFieldRows([]); return; }
    fetchCustomObjectFields(obj.id, 'header').then(setCustomObjFieldRows);
  }, [isCustomObject, selectedObj, customObjectsList]);

  const standardFields = isCustomObject
    ? [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'status', label: 'Status', type: 'single_select' },
        ...customObjFieldRows.map(f => ({ key: f.api_name, label: f.label, type: f.field_type === 'lookup' ? 'text' : f.field_type })),
      ]
    : getStandardFields(selectedObj);
  // Candidate "duration" fields for the Default Value "From Duration Field"
  // mode below — any custom SELECT/DROPDOWN field already defined on this
  // object in App Composer. Fetched for every selectedObj (not just line
  // items) since there's no reason to restrict it, though in practice this
  // mode only makes sense on a date field of a line-item object.
  const { fields: objCustomFields } = useCustomFields(selectedObj);
  const durationCandidateFields = (objCustomFields || []).filter(f => f.field_type === 'single_select');

  const cfSig = (objCustomFields || []).map(f => f.id).join(',');
  useEffect(() => { load(); }, [selectedObj, pageScope, cfSig, customObjFieldRows.length]);
  useEffect(() => { loadObjectLabel(); }, [selectedObj, customObjectsList.length]);

  async function loadObjectLabel() {
    if (!supabase) return;
    if (isCustomObject) {
      // A custom object's name lives on the object itself (custom_objects), so every
      // screen that reads it updates the moment it is renamed here.
      const co = customObjectsList.find(o => `custom_${o.api_name}` === selectedObj);
      setObjectLabelForm({ singular: co?.singular_label || '', plural: co?.plural_label || '', is_published: true, id: null });
      return;
    }
    const { data } = await supabase.from('object_label_overrides').select('*').eq('object_type', selectedObj).eq('tenant_id', tenant?.id || null).maybeSingle();
    setObjectLabelForm({ singular: data?.custom_label_singular || '', plural: data?.custom_label_plural || '', is_published: data?.is_published || false, id: data?.id || null });
  }

  async function saveObjectLabel(publish: boolean) {
    if (!supabase) return;
    setSavingObjectLabel(true);
    try {
      if (isCustomObject) {
        const co = customObjectsList.find(o => `custom_${o.api_name}` === selectedObj);
        if (!co) throw new Error('Custom object not found');
        if (!objectLabelForm.singular.trim() || !objectLabelForm.plural.trim()) throw new Error('Both names are required for a custom object.');
        const { error: ce } = await supabase.from('custom_objects').update({ singular_label: objectLabelForm.singular.trim(), plural_label: objectLabelForm.plural.trim() }).eq('id', co.id);
        if (ce) throw new Error(ce.message);
        await supabase.from('object_label_overrides').delete().eq('object_type', selectedObj).eq('tenant_id', tenant?.id || null);
        invalidateObjectLabelCache();
        await refreshCustomObjects();
        setCustomObjectsList(await fetchCustomObjects());
        showAlert('Object renamed - now shown everywhere (navigator, springboard, buttons, reports, search).', { variant: 'success' });
        setSavingObjectLabel(false);
        return;
      }
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
      // Tenant-scoped. For a page tab we also read the "Both Pages" rows: they are what this
      // page inherits when it has no override of its own, so the designer starts from the truth.
      const { data } = await withTimeout(
        tenantScope(supabase.from('field_layout_config').select('*'))
          .eq('object_type', selectedObj).in('page_scope', pageScope === 'both' ? ['both'] : ['both', pageScope]),
        15000, 'Load field layout'
      );
      const overrideMap: Record<string, any> = {};
      (data || []).filter(r => r.page_scope === 'both').forEach(r => { overrideMap[r.field_key] = { ...r, _inherited: pageScope !== 'both' }; });
      (data || []).filter(r => r.page_scope === pageScope && pageScope !== 'both').forEach(r => {
        // ignore legacy redundant default rows so they show what the page really uses
        const redundant = !r.is_override && !r.custom_label && r.visibility_mode !== 'hidden' && r.editability_mode !== 'readonly'
          && !(r.conditional_rules || []).length && !r.default_value && overrideMap[r.field_key];
        if (!redundant) overrideMap[r.field_key] = { ...r, _inherited: false };
      });
      // keep the real scope-row ids around so a save can update / delete them
      const ownRowId: Record<string, string> = {};
      (data || []).filter(r => r.page_scope === pageScope).forEach(r => { ownRowId[r.field_key] = r.id; });

      // App Composer custom fields on standard objects join the list so they
      // can be re-ordered too (their order is stored on the field itself).
      const cfEntries = isCustomObject ? [] : (objCustomFields || []).map(f => ({
        key: 'cf_' + f.api_name, label: f.label, type: 'custom', isCustomField: true, cfId: f.id, cfSort: f.sort_order || 0,
      }));
      const merged = [...standardFields, ...cfEntries].map((f, idx) => {
        const o = overrideMap[f.key];
        return {
          field_key: f.key,
          field_type: f.type || 'text',
          computed: (f as any).computed || false,
          default_hidden: !!(f as any).defaultHidden,
          default_label: f.label,
          custom_label: o?.custom_label || '',
          visibility_mode: o?.visibility_mode || ((f as any).defaultHidden ? 'hidden' : 'visible'),
          // Computed fields (Net Amount, Line Total, etc.) are never
          // user-editable - force 'readonly' regardless of any stale saved
          // value, since the Editability toggle is hidden for these rows.
          editability_mode: (f as any).computed ? 'readonly' : (o?.editability_mode || 'editable'),
          conditional_rules: o?.conditional_rules || [],
          isCustomField: !!(f as any).isCustomField, cfId: (f as any).cfId || null,
          display_order: o?.display_order ?? ((f as any).isCustomField ? 10000 + ((f as any).cfSort || 0) : idx),
          is_published: o?.is_published || false,
          default_value: o?.default_value || '',
          _defaultMode: parseDefaultValue(o?.default_value || '').mode,
          id: ownRowId[f.key] || null,
          _inherited: !!o?._inherited,
          _baseOrder: (f as any).isCustomField ? 10000 + ((f as any).cfSort || 0) : idx,
          // what this page would use with no override of its own (for save-time diffing)
          _inh: (() => { const b = pageScope !== 'both' ? (data || []).find(r => r.page_scope === 'both' && r.field_key === f.key) : null; return {
            custom_label: b?.custom_label || '', visibility_mode: b?.visibility_mode || ((f as any).defaultHidden ? 'hidden' : 'visible'),
            editability_mode: (f as any).computed ? 'readonly' : (b?.editability_mode || 'editable'),
            rules: JSON.stringify(b?.conditional_rules || []), default_value: b?.default_value || '',
            display_order: b?.display_order ?? (((f as any).isCustomField) ? 10000 + ((f as any).cfSort || 0) : idx),
          }; })(),
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

  function moveRow(idx: number, to: number) {
    setRows(p => {
      if (to < 0 || to >= p.length || to === idx) return p;
      const arr = [...p];
      const [m] = arr.splice(idx, 1);
      arr.splice(to, 0, m);
      return arr.map((r, i) => ({ ...r, display_order: i }));
    });
  }

  async function persist(publish: boolean) {
    if (!supabase) return;
    publish ? setPublishing(true) : setSaving(true);
    try {
      // Custom (App Composer) fields: only their relative order is stored,
      // on the field definition itself.
      const cfRows = rows.filter(r => r.isCustomField);
      for (let i = 0; i < cfRows.length; i++) {
        await supabase.from('app_custom_fields').update({ sort_order: i + 1 }).eq('id', cfRows[i].cfId);
      }
      if (cfRows.length) invalidateCustomFieldCache(selectedObj);
      // Store only what differs from what this page already inherits (defaults, or the
      // "Both Pages" row). Untouched fields get NO row, so saving one page tab can never
      // mask customizations made under "Both Pages" - and rows that became redundant are removed.
      for (const row of rows) {
        const inh = row._inh || { custom_label: '', visibility_mode: row.default_hidden ? 'hidden' : 'visible', editability_mode: row.computed ? 'readonly' : 'editable', rules: '[]', default_value: '', display_order: row._baseOrder };
        const same =
          (row.custom_label || '') === (inh.custom_label || '') &&
          row.visibility_mode === inh.visibility_mode &&
          (row.computed ? 'readonly' : row.editability_mode) === inh.editability_mode &&
          JSON.stringify(row.conditional_rules || []) === inh.rules &&
          (row.computed ? '' : (row.default_value || '')) === (inh.default_value || '') &&
          row.display_order === inh.display_order;
        if (same) {
          if (row.id) {
            const del = await tenantScope(supabase.from('field_layout_config').delete()).eq('id', row.id);
            if (del.error) throw new Error(del.error.message);
          }
          continue;
        }
        const payload: any = {
          tenant_id: tenant?.id || null,
          object_type: selectedObj,
          field_key: row.field_key,
          page_scope: pageScope,
          custom_label: row.custom_label || null,
          visibility_mode: row.visibility_mode,
          editability_mode: row.computed ? 'readonly' : row.editability_mode,
          display_order: row.display_order,
          conditional_rules: row.conditional_rules || [],
          default_value: row.computed ? null : (row.default_value || null),
          is_published: publish ? true : (row.is_published && !row._inherited),
          is_override: pageScope !== 'both',
          updated_at: new Date().toISOString(),
        };
        let res = await withTimeout(
          supabase.from('field_layout_config').upsert(payload, { onConflict: 'tenant_id,object_type,field_key,page_scope' }),
          15000, 'Save field layout'
        );
        if (res.error && /is_override/.test(res.error.message || '')) {
          // SQL 47 not applied yet: save without the marker (the resolver still handles it)
          delete payload.is_override;
          res = await withTimeout(supabase.from('field_layout_config').upsert(payload, { onConflict: 'tenant_id,object_type,field_key,page_scope' }), 15000, 'Save field layout');
        }
        if (res.error) throw new Error(res.error.message);
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
        <p className="text-purple-200 text-sm mt-1">Relabel, show/hide, lock, reorder, and set default values for standard fields on any object's record page — header or line item — no code changes needed.</p>
      </div>

      <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Object</label>
        <select value={selectedObj} onChange={e => setSelectedObj(e.target.value)} className={iCls + ' max-w-sm'}>
          <optgroup label="Retail">{RETAIL_OBJECTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</optgroup>
          <optgroup label="CRM">{CRM_OBJECTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</optgroup>
          <optgroup label="Retail Line Items">{RETAIL_LINE_ITEM_OBJECTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</optgroup>
          <optgroup label="CRM Line Items">{CRM_LINE_ITEM_OBJECTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</optgroup>
          {customObjectsList.length > 0 && (
            <optgroup label="Custom Objects">{customObjectsList.map(o => <option key={o.api_name} value={`custom_${o.api_name}`}>{o.plural_label}</option>)}</optgroup>
          )}
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
          "Both Pages" is the base layout. "Detail Page Only" and "Create Page Only" start from it and only store the fields you change there; those changes win over "Both Pages" for that page. Fields you don't touch keep following "Both Pages".
        </p>
      </div>

      {!LINE_ITEM_OBJECT_TYPES.has(selectedObj) && (
      <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-[#0F172A] mb-1">🏷️ Object Display Name</h3>
        <div className="inline-block bg-purple-50 border border-purple-200 rounded-lg px-3 py-1 mb-2">
          <span className="text-xs text-purple-700">Editing: <strong>{ALL_OBJECTS.find(o => o.v === selectedObj)?.l}</strong></span>
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
      )}

      {!LINE_ITEM_OBJECT_TYPES.has(selectedObj) && (
        <StatusValuesCard objectType={selectedObj} customObject={isCustomObject ? customObjectsList.find(o => `custom_${o.api_name}` === selectedObj) : null} />
      )}

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
                <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                  <button onClick={() => moveRow(idx, 0)} disabled={idx === 0} title="Move to top" className="px-1.5 py-0.5 rounded border border-gray-200 hover:bg-purple-50 disabled:opacity-30">⤒</button>
                  <button onClick={() => moveRow(idx, idx - 1)} disabled={idx === 0} title="Move up" className="px-1.5 py-0.5 rounded border border-gray-200 hover:bg-purple-50 disabled:opacity-30">▲</button>
                  <button onClick={() => moveRow(idx, idx + 1)} disabled={idx === rows.length - 1} title="Move down" className="px-1.5 py-0.5 rounded border border-gray-200 hover:bg-purple-50 disabled:opacity-30">▼</button>
                  <span className="text-gray-300 font-mono">{idx + 1}</span>
                </span>
                <div className="flex-1">
                  <span className="font-bold text-sm text-[#0F172A]">{row.default_label}</span>
                  {row._inherited && pageScope !== 'both' && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500" title="Following the Both Pages layout. Change anything here to override it for this page only.">from Both Pages</span>}
                  <span className="text-xs text-gray-400 font-mono ml-2">{row.field_key}</span>
                </div>
                {row.isCustomField && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">CUSTOM FIELD</span>}
                {row.is_published && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">LIVE</span>}
              </div>
              {row.isCustomField && <p className="text-[11px] text-gray-400">Order is applied among custom fields. Label, required and options are managed in App Composer.</p>}

              {!row.isCustomField && (<>
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
                {row.computed ? (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Editability</label>
                    <div className="flex-1 py-2 rounded-xl text-xs font-semibold border border-dashed border-gray-200 bg-gray-50 text-gray-400 text-center">
                      Computed — always read-only
                    </div>
                  </div>
                ) : (
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
                )}
              </div>

              {row.computed ? (
                <p className="text-[11px] text-gray-400 mb-3">
                  This is a computed value (calculated at display time, not stored) — it can be relabeled or hidden above, but has no editability or default value to configure.
                </p>
              ) : (() => {
                const parsed = parseDefaultValue(row.default_value);
                const mode = row._defaultMode || parsed.mode;
                // Selecting a mode is a separate action from producing a
                // valid serialized string - "relative mode, no field chosen
                // yet" has no valid string form (it would serialize to ''),
                // but is still a real, meaningful UI state. Tracking it in
                // its own field means the segmented control doesn't silently
                // snap back to "Fixed" the instant "Relative" is clicked.
                // The in-progress picks (start field, duration field, offset)
                // live in their own row-local `_defaultParts`, not only in
                // the serialized default_value string. "Start field chosen,
                // duration field not yet" has no valid serialized form (it
                // serializes to ''), so re-deriving the dropdowns purely
                // from the string made each first pick vanish the instant
                // it was made - the select snapped straight back to its
                // placeholder, which read as "it doesn't select". The
                // string is only written once the combination is complete.
                const parts = { ...parsed, ...(row._defaultParts || {}) };
                const setMode = (m: string) => {
                  upd(idx, '_defaultMode', m);
                  if (m === 'today') upd(idx, 'default_value', 'today');
                  else if (m === 'fixed' && parsed.mode !== 'fixed') upd(idx, 'default_value', '');
                  else if (m === 'relative' || m === 'duration') upd(idx, 'default_value', serializeDefaultValue({ ...parts, mode: m }));
                };
                const setParts = (patch: any) => {
                  const merged = { ...parts, mode, ...patch };
                  upd(idx, '_defaultParts', { refField: merged.refField, durationField: merged.durationField, offset: merged.offset, fixedValue: merged.fixedValue });
                  upd(idx, 'default_value', serializeDefaultValue(merged));
                };
                const otherDateFields = standardFields.filter(f => f.type === 'date' && f.key !== row.field_key);
                // "From Duration Field" only makes sense on a line-item
                // object, and only once at least one custom select field
                // exists there to drive it from (e.g. a "Rental Duration"
                // dropdown built in App Composer with options like "1
                // Month"/"1 Quarter"/"Half Year"/"Full Year").
                const showDurationMode = LINE_ITEM_OBJECT_TYPES.has(selectedObj) && durationCandidateFields.length > 0;
                return (
                  <div className="mb-3">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1 flex items-center justify-between">
                      <span>Default Value {LINE_ITEM_OBJECT_TYPES.has(selectedObj) && <span className="normal-case font-normal text-gray-400">(applied to every new line added to the grid)</span>}</span>
                      {row.default_value && (
                        <button onClick={() => { upd(idx, 'default_value', ''); upd(idx, '_defaultMode', 'fixed'); upd(idx, '_defaultParts', null); }}
                          className="normal-case font-semibold text-red-500 hover:text-red-700 hover:underline">
                          ✕ Clear
                        </button>
                      )}
                    </label>
                    {row.field_type === 'date' ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          {[{v:'fixed',l:'Fixed Date'},{v:'today',l:'Today'},{v:'relative',l:'Relative to Another Field'},...(showDurationMode?[{v:'duration',l:'From Duration Field'}]:[])].map(m => (
                            <button key={m.v} onClick={() => setMode(m.v)}
                              className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${mode === m.v ? 'bg-[#0F172A] text-white border-transparent' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                              {m.l}
                            </button>
                          ))}
                        </div>
                        {mode === 'fixed' && (
                          <input type="date" value={parts.fixedValue} onChange={e => setParts({ fixedValue: e.target.value })} className={iCls} />
                        )}
                        {mode === 'relative' && (
                          <div className="flex items-center gap-2 flex-wrap bg-purple-50 rounded-xl p-2.5">
                            <select value={parts.refField} onChange={e => setParts({ refField: e.target.value })} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[#0F172A]">
                              <option value="">field…</option>
                              {otherDateFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                            </select>
                            <span className="text-xs font-semibold text-gray-500">+</span>
                            <input type="number" value={parts.offset} onChange={e => setParts({ offset: parseInt(e.target.value, 10) || 0 })}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[#0F172A] w-20 text-center" />
                            <span className="text-xs font-semibold text-gray-500">day(s) — use a negative number for "before"</span>
                          </div>
                        )}
                        {mode === 'relative' && (
                          <p className="text-[11px] text-gray-400">
                            Recalculates live whenever {otherDateFields.find(f=>f.key===parts.refField)?.label || 'the referenced field'} changes on the same {LINE_ITEM_OBJECT_TYPES.has(selectedObj) ? 'line' : 'record'} — not just once when the {LINE_ITEM_OBJECT_TYPES.has(selectedObj) ? 'line is added' : 'record is created'}.
                          </p>
                        )}
                        {mode === 'duration' && (
                          <div className="flex items-center gap-2 flex-wrap bg-purple-50 rounded-xl p-2.5">
                            <select value={parts.refField} onChange={e => setParts({ refField: e.target.value })} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[#0F172A]">
                              <option value="">start from…</option>
                              {otherDateFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                            </select>
                            <span className="text-xs font-semibold text-gray-500">+ duration from</span>
                            <select value={parts.durationField} onChange={e => setParts({ durationField: e.target.value })} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[#0F172A]">
                              <option value="">field…</option>
                              {durationCandidateFields.map(f => <option key={f.api_name} value={f.api_name}>{f.label}</option>)}
                            </select>
                          </div>
                        )}
                        {mode === 'duration' && (
                          <p className="text-[11px] text-gray-400">
                            Recalculates live whenever {otherDateFields.find(f=>f.key===parts.refField)?.label || 'the start field'} or {durationCandidateFields.find(f=>f.api_name===parts.durationField)?.label || 'the duration field'} changes on the same line. Recognizes "1 Month", "1 Quarter"/"3 Months", "Half Year"/"6 Months", and "Full Year"/"12 Months"/"Annual" as option values on the duration field (case/spacing-insensitive) — months are added calendar-accurately (e.g. Jan 31 + 1 Month lands on Feb 28/29, not Mar 3), and the result is the last day of that period (inclusive), not the first day of the next one.
                          </p>
                        )}
                      </div>
                    ) : (
                      <input value={row.default_value} onChange={e => upd(idx, 'default_value', e.target.value)}
                        placeholder="Leave blank for no default"
                        className={iCls} />
                    )}
                  </div>
                );
              })()}

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
              </>)}
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
