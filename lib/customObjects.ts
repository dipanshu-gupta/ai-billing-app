// @ts-nocheck
'use client';
/**
 * Custom Objects engine — the generic flexfield layer behind the "create
 * your own object" feature (Oracle Fusion-style). This file is the one
 * place that knows how a named, typed field ("rental_days", a number) maps
 * onto a physical generic storage column ("number_3") on the shared
 * custom_object_records / custom_object_line_items tables — every other
 * component (CustomObjectManager, DynamicObjectPage) works with named
 * fields only and never touches a storage_column directly.
 *
 * Deliberately mirrors the createRetailRecord/updateRetailRecord/
 * upsertRetailLineItems pattern in AppContext.tsx, parameterized by object
 * metadata instead of a hardcoded table/column list, and consumes the SAME
 * tenant-scoping convention (tenant_id column + RLS) rather than inventing
 * a parallel one.
 */
import { inMemoryLock } from './tenant';
import { createClient } from '@supabase/supabase-js';

export const STORAGE_SLOT_COUNTS_HEADER = { text: 20, number: 10, date: 10, datetime: 10, boolean: 5, select: 10, long_text: 3 };
export const STORAGE_SLOT_COUNTS_LINE   = { text: 10, number: 5,  date: 5,  datetime: 5,  boolean: 3, select: 5 };

export const CUSTOM_FIELD_TYPES = [
  { v: 'text',          l: 'Text' },
  { v: 'long_text',     l: 'Long Text' },
  { v: 'number',        l: 'Number' },
  { v: 'currency',      l: 'Currency' },
  { v: 'date',          l: 'Date' },
  { v: 'datetime',      l: 'Date & Time' },
  { v: 'checkbox',      l: 'Checkbox' },
  { v: 'single_select', l: 'Single Select' },
  { v: 'multi_select',  l: 'Multi Select' },
  { v: 'url',           l: 'URL' },
  { v: 'email',         l: 'Email' },
  { v: 'lookup',        l: 'Lookup (links to another object)' },
];

// Standard objects a Lookup field can point at — kept here (not imported
// from FieldLayoutDesigner.tsx) to avoid a client/admin-component import
// cycle; DynamicObjectPage and CustomObjectManager both just need the
// {table, idField, labelField} triple to resolve/display a lookup value.
export const LOOKUP_STANDARD_OBJECTS: Record<string, { label: string; table: string; idField: string; labelField: string }> = {
  retailCustomers:  { label: 'Retail Customers', table: 'retail_customers', idField: 'customer_number', labelField: 'name' },
  retailProducts:   { label: 'Retail Products',  table: 'retail_products',  idField: 'product_number',  labelField: 'name' },
  retailOrders:     { label: 'Retail Orders',    table: 'retail_orders',    idField: 'order_number',    labelField: 'order_number' },
  retailInvoices:   { label: 'Retail Invoices',  table: 'retail_invoices',  idField: 'invoice_number',  labelField: 'invoice_number' },
  customers:        { label: 'Customers (CRM)',  table: 'customers',       idField: 'customer_number', labelField: 'name' },
  contacts:         { label: 'Contacts (CRM)',   table: 'contacts',        idField: 'contact_number',  labelField: 'name' },
  products:         { label: 'Products (CRM)',   table: 'products',        idField: 'product_number',  labelField: 'name' },
  leads:            { label: 'Leads (CRM)',      table: 'leads',           idField: 'lead_number',     labelField: 'name' },
  opportunities:    { label: 'Opportunities (CRM)', table: 'opportunities', idField: 'opportunity_number', labelField: 'name' },
};

function getClient() {
  try {
    if (typeof window !== 'undefined' && (window as any).__bp_supabase) return (window as any).__bp_supabase;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) return createClient(url, key, { auth: { lock: inMemoryLock } });
  } catch (e) {}
  return null;
}

function getTenantId() {
  return typeof window !== 'undefined' ? (window as any).__bp_tenant?.id || null : null;
}

// ─── Module-level caches (same pattern as useCustomFields.ts) ─────────────
let _objectsCache: any[] | null = null;
let _fieldsCache: Record<string, any[]> = {};

export function invalidateCustomObjectCache(customObjectId?: string) {
  _objectsCache = null;
  if (customObjectId) {
    Object.keys(_fieldsCache).forEach(k => { if (k.startsWith(customObjectId + ':')) delete _fieldsCache[k]; });
  } else {
    _fieldsCache = {};
  }
}

// Published custom objects for the current tenant — used by nav, Page
// Layout Designer / App Composer dropdowns, and routing.
export async function fetchCustomObjects(forceRefresh = false) {
  if (_objectsCache && !forceRefresh) return _objectsCache;
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client
    .from('custom_objects')
    .select('*')
    .eq('status', 'published')
    .eq('is_active', true)
    .order('sort_order');
  if (error) { console.error('[fetchCustomObjects]', error.message); return []; }
  _objectsCache = data || [];
  return _objectsCache;
}

// ALL custom objects (draft + published) — used by the admin manager itself.
export async function fetchAllCustomObjects() {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from('custom_objects').select('*').order('sort_order');
  if (error) { console.error('[fetchAllCustomObjects]', error.message); return []; }
  return data || [];
}

export async function fetchCustomObjectFields(customObjectId: string, scope: 'header' | 'line_item' = 'header', forceRefresh = false, includeInactive = false) {
  const cacheKey = `${customObjectId}:${scope}${includeInactive ? ':all' : ''}`;
  if (_fieldsCache[cacheKey] && !forceRefresh) return _fieldsCache[cacheKey];
  const client = getClient();
  if (!client) return [];
  let q = client
    .from('custom_object_fields')
    .select('*')
    .eq('custom_object_id', customObjectId)
    .eq('scope', scope);
  // The admin manager needs inactive fields too: they still own a storage slot and their data.
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q.order('sort_order');
  if (error) { console.error('[fetchCustomObjectFields]', error.message); return []; }
  _fieldsCache[cacheKey] = data || [];
  return _fieldsCache[cacheKey];
}

// ─── Slot allocation ───────────────────────────────────────────────────────
// Given the fields already defined on an object (any scope) and the type of
// a brand-new field, returns the next free physical storage_column, or null
// once every slot of that type is exhausted (caller falls back to jsonb
// overflow for multi_select, or should block creation for anything else —
// exhausting 20 text slots on one object is the generous ceiling working as
// intended, not a bug to silently paper over).
export function allocateStorageSlot(existingFields: any[], fieldType: string, scope: 'header' | 'line_item' = 'header') {
  if (fieldType === 'multi_select') return 'custom_data'; // always overflow — arrays don't fit a scalar column
  const typeToPrefix: Record<string, string> = {
    text: 'text', long_text: 'long_text', url: 'text', email: 'text', lookup: 'text',
    number: 'number', currency: 'number',
    date: 'date', datetime: 'datetime',
    checkbox: 'boolean',
    single_select: 'select',
  };
  const prefix = typeToPrefix[fieldType] || 'text';
  const counts = scope === 'line_item' ? STORAGE_SLOT_COUNTS_LINE : STORAGE_SLOT_COUNTS_HEADER;
  const max = (counts as any)[prefix] || 0;
  const used = new Set(existingFields.filter(f => f.storage_column?.startsWith(prefix + '_')).map(f => f.storage_column));
  for (let i = 1; i <= max; i++) {
    const col = `${prefix}_${i}`;
    if (!used.has(col)) return col;
  }
  return null; // exhausted — only reachable for long_text/boolean/select/date/number, never multi_select
}

// ─── Pack / unpack between named field values and physical DB columns ─────
export function packFieldValues(fields: any[], values: Record<string, any>) {
  const row: Record<string, any> = {};
  const overflow: Record<string, any> = {};
  fields.forEach(f => {
    const v = values[f.api_name];
    if (v === undefined) return;
    if (f.storage_column === 'custom_data') {
      overflow[f.api_name] = v;
    } else if (f.field_type === 'checkbox') {
      row[f.storage_column] = !!v;
    } else if (f.field_type === 'number' || f.field_type === 'currency') {
      row[f.storage_column] = v === '' || v == null ? null : Number(v);
    } else if (f.field_type === 'datetime') {
      // form value is local 'YYYY-MM-DDTHH:mm' -> store as a real timestamp
      const d = v ? new Date(v) : null;
      row[f.storage_column] = d && !isNaN(d.getTime()) ? d.toISOString() : null;
    } else {
      row[f.storage_column] = v === '' ? null : v;
    }
  });
  row.custom_data = overflow;
  return row;
}

export function unpackFieldValues(fields: any[], row: Record<string, any>) {
  const values: Record<string, any> = {};
  fields.forEach(f => {
    let v = f.storage_column === 'custom_data' ? (row.custom_data || {})[f.api_name] : row[f.storage_column];
    if (f.field_type === 'datetime' && v) {
      // timestamptz -> the local 'YYYY-MM-DDTHH:mm' a datetime-local input needs
      const d = new Date(v);
      if (!isNaN(d.getTime())) {
        const p = (n) => String(n).padStart(2, '0');
        v = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
      }
    }
    values[f.api_name] = v;
  });
  return values;
}

// ─── Lookup resolution ─────────────────────────────────────────────────────
// Resolves a single lookup field's stored id to a display label — used by
// DynamicObjectPage's grid/detail views. `allObjects` is the tenant's full
// published custom_objects list (passed in rather than re-fetched) so a
// custom→custom lookup can be resolved without an extra round trip per row.
export async function resolveLookupLabel(field: any, id: string, allCustomObjects: any[] = []) {
  if (!id) return '';
  const client = getClient();
  if (!client) return id;
  if (field.lookup_target_type === 'standard') {
    const target = LOOKUP_STANDARD_OBJECTS[field.lookup_target_object];
    if (!target) return id;
    const prefix = field.lookup_target_object === 'retailOrders' ? 'RORD' : field.lookup_target_object === 'retailInvoices' ? 'RINV' : null;
    const cols = Array.from(new Set([target.idField, target.labelField, ...(prefix ? ['display_number'] : [])])).join(',');
    const { data } = await client.from(target.table).select(cols).eq(target.idField, id).maybeSingle();
    if (data && prefix && data.display_number) return `${prefix}-${String(data.display_number).padStart(5, '0')}`;
    return data ? (data[target.labelField] || id) : id;
  }
  // custom → custom
  const targetObj = allCustomObjects.find(o => o.api_name === field.lookup_target_object);
  if (!targetObj) return id;
  const { data } = await client.from('custom_object_records').select('id,record_number,name').eq('id', id).maybeSingle();
  return data ? (data.name || data.record_number || id) : id;
}

/**
 * Batch version of resolveLookupLabel: turns the raw ids stored in lookup fields
 * into readable names for a whole set of records with ONE query per lookup field
 * (not one per cell). Used by reports, list pages and related lists so a lookup
 * never shows a database id. Orders / invoices resolve to their short display
 * number (RORD-00012) rather than the long internal order number.
 *
 * Returns { [fieldApiName]: { [rawValue]: label } }.
 */
export async function resolveLookupLabelMap(lookupFields: any[], records: any[], allCustomObjects: any[] = []) {
  const client = getClient();
  const out: Record<string, Record<string, string>> = {};
  if (!client) return out;
  for (const f of (lookupFields || [])) {
    if (f.field_type !== 'lookup') continue;
    const ids = Array.from(new Set((records || []).map(r => r?.[f.api_name]).filter(v => v !== undefined && v !== null && v !== '').map(String)));
    out[f.api_name] = {};
    if (!ids.length) continue;
    try {
      if (f.lookup_target_type === 'standard') {
        const target = LOOKUP_STANDARD_OBJECTS[f.lookup_target_object];
        if (!target) continue;
        const prefix = f.lookup_target_object === 'retailOrders' ? 'RORD' : f.lookup_target_object === 'retailInvoices' ? 'RINV' : null;
        const cols = Array.from(new Set([target.idField, target.labelField, ...(prefix ? ['display_number'] : [])])).join(',');
        const { data } = await client.from(target.table).select(cols).in(target.idField, ids);
        (data || []).forEach(row => {
          const lbl = prefix && row.display_number ? `${prefix}-${String(row.display_number).padStart(5, '0')}` : (row[target.labelField] || row[target.idField]);
          out[f.api_name][String(row[target.idField])] = lbl;
        });
      } else {
        const target = (allCustomObjects || []).find(o => o.api_name === f.lookup_target_object);
        const { data } = await client.from('custom_object_records').select('id,record_number,name,display_number').in('id', ids);
        (data || []).forEach(row => {
          out[f.api_name][String(row.id)] = row.name || (target ? formatCustomDisplayNumber(target, row.display_number) : '') || row.record_number || String(row.id);
        });
      }
    } catch (e) { console.warn('[resolveLookupLabelMap]', f.api_name, e); }
  }
  return out;
}

// ─── Record number generation ──────────────────────────────────────────────
function generateRecordNumber(apiName: string) {
  const prefix = 'C' + apiName.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase();
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(Math.random() * 90 + 10);
  return `${prefix}-${ts}${rand}`;
}

// ─── CRUD ───────────────────────────────────────────────────────────────────
// Every function below takes the ctx object AppContext.tsx's wrapper passes
// in — { supabase, tenantId, currentUser, buildSystemFields, showAlert } —
// so this file consumes the exact same RBAC/tenant primitives every
// standard-object CRUD function already uses, rather than a parallel one.

export async function createCustomObjectRecord(ctx: any, customObject: any, headerFields: any[], values: Record<string, any>, lineItems: any[] = [], lineFields: any[] = []) {
  const { supabase, currentUser, buildSystemFields, showAlert } = ctx;
  if (!supabase || !currentUser) return null;
  try {
    const payload: any = {
      ...packFieldValues(headerFields, values),
      custom_object_id: customObject.id,
      record_number: generateRecordNumber(customObject.api_name),
      name: String(values.__name ?? '').trim() || null,
      status: values.__status || 'Active',
      owner: values.__owner || currentUser.email,
      owner_id: values.__owner_id || currentUser.id,
      owner_name: values.__owner_name || `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim(),
      created_by: currentUser.email,
      updated_by: currentUser.email,
      organization_id: currentUser.organization_id,
      business_unit_id: currentUser.business_unit_id,
      ...(ctx.tenantId ? { tenant_id: ctx.tenantId } : {}),
    };
    const { data: inserted, error } = await supabase.from('custom_object_records').insert([payload]).select().single();
    if (error) { showAlert?.('Save failed: ' + error.message); return null; }
    if (!inserted.name) {
      // no name given: fall back to the record number so it is never blank
      const fallback = formatCustomDisplayNumber(customObject, inserted.display_number) || inserted.record_number;
      await supabase.from('custom_object_records').update({ name: fallback }).eq('id', inserted.id);
      inserted.name = fallback;
    }
    if (customObject.supports_line_items && lineItems.length) {
      const { error: liErr } = await upsertCustomObjectLineItems(ctx, customObject, inserted.id, lineItems, lineFields);
      if (liErr) { showAlert?.('Save failed: ' + liErr.message); return null; }
    }
    return inserted;
  } catch (e: any) {
    console.error('[createCustomObjectRecord]', e);
    showAlert?.('Save failed: ' + (e?.message || 'Unexpected error.'));
    return null;
  }
}

export async function updateCustomObjectRecord(ctx: any, customObject: any, recordId: string, headerFields: any[], values: Record<string, any>, lineItems: any[] | null = null, lineFields: any[] = []) {
  const { supabase, currentUser, showAlert } = ctx;
  if (!supabase) return null;
  try {
    const payload: any = {
      ...packFieldValues(headerFields, values),
      ...(values.__name !== undefined ? { name: String(values.__name ?? '').trim() || null } : {}),
      ...(values.__status !== undefined ? { status: values.__status } : {}),
      ...(values.__owner !== undefined ? { owner: values.__owner } : {}),
      ...(values.__owner_id !== undefined ? { owner_id: values.__owner_id } : {}),
      ...(values.__owner_name !== undefined ? { owner_name: values.__owner_name } : {}),
      updated_by: currentUser?.email,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('custom_object_records').update(payload).eq('id', recordId);
    if (error) { showAlert?.('Save failed: ' + error.message); return null; }
    if (customObject.supports_line_items && lineItems !== null) {
      const { error: liErr } = await upsertCustomObjectLineItems(ctx, customObject, recordId, lineItems, lineFields);
      if (liErr) { showAlert?.('Save failed: ' + liErr.message); return null; }
    }
    return true;
  } catch (e: any) {
    console.error('[updateCustomObjectRecord]', e);
    showAlert?.('Save failed: ' + (e?.message || 'Unexpected error.'));
    return null;
  }
}

export async function upsertCustomObjectLineItems(ctx: any, customObject: any, parentRecordId: string, items: any[], lineFields: any[]) {
  const { supabase } = ctx;
  if (!supabase || !parentRecordId) return { error: null };
  await supabase.from('custom_object_line_items').delete().eq('parent_record_id', parentRecordId);
  if (!items || !items.length) return { error: null };
  const rows = items.map((item, idx) => ({
    parent_record_id: parentRecordId,
    custom_object_id: customObject.id,
    sort_order: idx,
    ...packFieldValues(lineFields, item),
    ...(ctx.tenantId ? { tenant_id: ctx.tenantId } : {}),
  }));
  const { error } = await supabase.from('custom_object_line_items').insert(rows);
  return { error };
}

export async function deleteCustomObjectRecord(ctx: any, recordId: string) {
  const { supabase, showAlert } = ctx;
  if (!supabase) return;
  try {
    await supabase.from('custom_object_line_items').delete().eq('parent_record_id', recordId);
    await supabase.from('custom_object_records').delete().eq('id', recordId);
  } catch (e: any) {
    console.error('[deleteCustomObjectRecord]', e);
    showAlert?.('Delete failed: ' + (e?.message || 'Unexpected error.'));
  }
}

export async function fetchCustomObjectRecords(customObjectId: string) {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from('custom_object_records').select('*').eq('custom_object_id', customObjectId).order('created_at', { ascending: false }).limit(500);
  if (error) { console.error('[fetchCustomObjectRecords]', error.message); return []; }
  return data || [];
}

export async function fetchCustomObjectLineItems(parentRecordId: string) {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from('custom_object_line_items').select('*').eq('parent_record_id', parentRecordId).order('sort_order');
  if (error) { console.error('[fetchCustomObjectLineItems]', error.message); return []; }
  return data || [];
}

// ─── RBAC auto-registration ─────────────────────────────────────────────────
// Registers custom_<api_name>_view/create/edit/delete/export into the
// existing `permissions` table the moment an object is published — so the
// object immediately shows up in Roles & Permissions with zero schema
// change to permissions/roles/role_permissions. SYSADMIN-equivalent roles
// (data_scope = 'all' and already holding __admin__) see it automatically
// via the existing __admin__ bypass; everyone else needs the role granted
// these new codes explicitly in Security Console, exactly like any other
// module's permissions.
const RBAC_ACTIONS = ['view', 'create', 'edit', 'delete', 'export'];

export async function publishCustomObject(ctx: any, customObject: any) {
  const { supabase, showAlert } = ctx;
  if (!supabase) return false;
  try {
    const moduleName = `custom_${customObject.api_name}`;
    const codes = RBAC_ACTIONS.map(a => `${moduleName}_${a}`);
    const { data: existing } = await supabase.from('permissions').select('permission_code').in('permission_code', codes);
    const have = new Set((existing || []).map((p: any) => p.permission_code));
    const toInsert = codes.filter(c => !have.has(c)).map(code => {
      const action = code.slice(moduleName.length + 1);
      const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
      return {
        permission_code: code,
        module_name: moduleName,
        permission_name: `${actionLabel} ${customObject.plural_label}`,
      };
    });
    if (toInsert.length) {
      const { error } = await supabase.from('permissions').insert(toInsert);
      if (error) { showAlert?.('Could not register permissions: ' + error.message); return false; }
    }
    const { error: updErr } = await supabase.from('custom_objects').update({ status: 'published', updated_at: new Date().toISOString() }).eq('id', customObject.id);
    if (updErr) { showAlert?.('Publish failed: ' + updErr.message); return false; }
    invalidateCustomObjectCache();
    return true;
  } catch (e: any) {
    console.error('[publishCustomObject]', e);
    showAlert?.('Publish failed: ' + (e?.message || 'Unexpected error.'));
    return false;
  }
}

export async function unpublishCustomObject(ctx: any, customObject: any) {
  const { supabase, showAlert } = ctx;
  if (!supabase) return false;
  const { error } = await supabase.from('custom_objects').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', customObject.id);
  if (error) { showAlert?.('Unpublish failed: ' + error.message); return false; }
  invalidateCustomObjectCache();
  return true;
}


// ─── System fields (every custom object, existing or new) ──────────────────
// Virtual metadata - no per-object rows needed, so every object (including
// ones created before this existed) gets them automatically. `key` is what
// list columns / filters / saved searches / Page Layout Designer use; `col`
// is the real column on custom_object_records.
export const CUSTOM_STATUS_OPTIONS = ['Active', 'Inactive', 'Draft', 'On Hold', 'Closed'];

export const CUSTOM_SYSTEM_FIELDS: { key: string; col: string; label: string; type: string; editable?: boolean }[] = [
  { key: 'display_number', col: 'display_number', label: 'Record Number',    type: 'number' },
  { key: 'name',           col: 'name',           label: 'Name',             type: 'text',   editable: true },
  { key: 'status',         col: 'status',         label: 'Status',           type: 'select', editable: true },
  { key: 'owner',          col: 'owner',          label: 'Owner',            type: 'text',   editable: true },
  { key: 'id',             col: 'id',             label: 'Record ID',        type: 'text' },
  { key: 'created_at',     col: 'created_at',     label: 'Created Date',     type: 'date' },
  { key: 'created_by',     col: 'created_by',     label: 'Created By',       type: 'text' },
  { key: 'updated_at',     col: 'updated_at',     label: 'Last Updated Date',type: 'date' },
  { key: 'updated_by',     col: 'updated_by',     label: 'Last Updated By',  type: 'text' },
  { key: 'organization_id',  col: 'organization_id',  label: 'Organization',  type: 'text' },
  { key: 'business_unit_id', col: 'business_unit_id', label: 'Business Unit', type: 'text' },
];
export const CUSTOM_SYSTEM_KEYS = new Set(CUSTOM_SYSTEM_FIELDS.map(f => f.key));

export function customObjectPrefix(customObject: any) {
  return (String(customObject?.api_name || 'REC').replace(/[^A-Za-z0-9]/g, '').slice(0, 4) || 'REC').toUpperCase();
}
export function formatCustomDisplayNumber(customObject: any, n: number | null | undefined) {
  return n ? `${customObjectPrefix(customObject)}-${String(n).padStart(5, '0')}` : '';
}

const SERVER_TYPE: Record<string, string> = {
  number: 'number', currency: 'number', date: 'date', datetime: 'date', checkbox: 'boolean',
  single_select: 'select',
};

// Combined list/filter/column metadata: system fields first, then the
// object's own fields. A custom field whose api_name collides with a system
// key is exposed as cf_<api_name> so neither shadows the other.
export function buildCustomFieldMeta(headerFields: any[]) {
  const sys = CUSTOM_SYSTEM_FIELDS.map(f => ({ key: f.key, col: f.col, label: f.label, type: f.type, system: true, sortable: true }));
  const custom = headerFields.map(f => ({
    key: CUSTOM_SYSTEM_KEYS.has(f.api_name) ? `cf_${f.api_name}` : f.api_name,
    apiName: f.api_name,
    col: f.storage_column === 'custom_data' ? null : f.storage_column, // jsonb overflow can't be sorted/filtered server-side
    label: f.label,
    type: SERVER_TYPE[f.field_type] || 'text',
    options: f.options,
    field: f,
    system: false,
    sortable: f.storage_column !== 'custom_data',
  }));
  return [...sys, ...custom];
}

// Flattens a raw DB row to {system keys..., custom api_name keys...} so a
// list cell / detail form reads every value from one place.
export function flattenCustomRecord(headerFields: any[], row: any) {
  const out: any = { ...row };
  headerFields.forEach(f => {
    const v = f.storage_column === 'custom_data' ? (row.custom_data || {})[f.api_name] : row[f.storage_column];
    out[CUSTOM_SYSTEM_KEYS.has(f.api_name) ? `cf_${f.api_name}` : f.api_name] = v;
  });
  return out;
}

// Paged, server-side listing used by DynamicObjectPage - the same
// fetchServerPage engine the standard list pages use, scoped to one object.
export async function fetchCustomRecordsPage(customObjectId: string, base: any) {
  const { fetchServerPage } = await import('./serverList');
  const client = getClient();
  return fetchServerPage(client, { ...base, table: 'custom_object_records', extraEq: { custom_object_id: customObjectId } });
}


// ─── Field lifecycle: type change + delete (admin) ─────────────────────────
export const slotPrefixOf = (fieldType: string) => ({
  text: 'text', long_text: 'long_text', url: 'text', email: 'text', lookup: 'text',
  number: 'number', currency: 'number', date: 'date', datetime: 'datetime',
  checkbox: 'boolean', single_select: 'select', multi_select: 'custom_data',
} as Record<string, string>)[fieldType] || 'text';

const tableForScope = (scope: string) => scope === 'line_item' ? 'custom_object_line_items' : 'custom_object_records';

/** Best-effort value conversion between field types; returns null when the value can't be represented. */
export function convertSlotValue(v: any, from: string, to: string) {
  if (v === null || v === undefined || v === '') return null;
  const asText = Array.isArray(v) ? v.join(', ') : (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));
  switch (slotPrefixOf(to)) {
    case 'text': case 'long_text': case 'select':
      if (from === 'date' || from === 'datetime') return String(v).slice(0, 10);
      return asText;
    case 'number': { const n = Number(String(Array.isArray(v) ? v[0] : v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; }
    case 'date': { const m = String(v).match(/^\d{4}-\d{2}-\d{2}/); return m ? m[0] : null; }
    case 'datetime': { const d = new Date(String(v).length === 10 ? v + 'T00:00:00' : v); return isNaN(d.getTime()) ? null : d.toISOString(); }
    case 'boolean': return v === true || /^(true|yes|y|1)$/i.test(String(v));
    case 'custom_data': return Array.isArray(v) ? v : [asText];
  }
  return null;
}

async function forEachRow(supabase: any, table: string, objectId: string, cols: string, fn: (row: any) => Promise<void>) {
  const PAGE = 500; let from = 0;
  for (;;) {
    const { data, error } = await supabase.from(table).select('id,custom_data' + (cols ? ',' + cols : '')).eq('custom_object_id', objectId).order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) return;
    for (let i = 0; i < data.length; i += 25) await Promise.all(data.slice(i, i + 25).map(fn));
    if (data.length < PAGE) return;
    from += PAGE;
  }
}

/** Moves one field's stored values to a new slot (converting them) and clears the old slot. */
export async function migrateFieldData(supabase: any, o: { objectId: string; scope: string; apiName: string; fromCol: string; toCol: string; fromType: string; toType: string }) {
  const table = tableForScope(o.scope);
  const physical = [o.fromCol, o.toCol].filter(c => c !== 'custom_data');
  await forEachRow(supabase, table, o.objectId, physical.join(','), async (row) => {
    const raw = o.fromCol === 'custom_data' ? (row.custom_data || {})[o.apiName] : row[o.fromCol];
    const patch: any = {};
    const cd = { ...(row.custom_data || {}) };
    let touched = false;
    if (o.fromCol === 'custom_data') { delete cd[o.apiName]; touched = true; } else { patch[o.fromCol] = null; }
    const conv = convertSlotValue(raw, o.fromType, o.toType);
    if (o.toCol === 'custom_data') { if (conv !== null) { cd[o.apiName] = conv; touched = true; } }
    else patch[o.toCol] = conv;
    if (touched) patch.custom_data = cd;
    if (raw === null || raw === undefined || raw === '') { if (!touched) return; }
    const { error } = await supabase.from(table).update(patch).eq('id', row.id);
    if (error) throw new Error(error.message);
  });
}

/** Permanently removes a field's definition, its stored values on every record, and its Page Layout rows. */
export async function deleteCustomField(supabase: any, f: { id: string; custom_object_id: string; scope: string; api_name: string; storage_column: string }, objectType: string) {
  const table = tableForScope(f.scope);
  if (f.storage_column === 'custom_data') {
    await forEachRow(supabase, table, f.custom_object_id, '', async (row) => {
      const cd = { ...(row.custom_data || {}) };
      if (!(f.api_name in cd)) return;
      delete cd[f.api_name];
      const { error } = await supabase.from(table).update({ custom_data: cd }).eq('id', row.id);
      if (error) throw new Error(error.message);
    });
  } else if (f.storage_column) {
    const { error } = await supabase.from(table).update({ [f.storage_column]: null }).eq('custom_object_id', f.custom_object_id);
    if (error) throw new Error(error.message);
  }
  const { error: de } = await supabase.from('custom_object_fields').delete().eq('id', f.id);
  if (de) throw new Error(de.message);
  // Layout rows keyed by api_name (custom objects use object type custom_<api_name>); tenant isolated by RLS.
  await supabase.from('field_layout_config').delete().eq('object_type', objectType).eq('field_key', f.api_name);
}
