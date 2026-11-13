// @ts-nocheck
'use client';
/**
 * AI Advisor agent engine (client side).
 *
 * The model never touches the database. It asks for TOOLS; this file runs them in the browser with the signed-in
 * user's own Supabase session, so every read and write is:
 *   - tenant-scoped (tenantScope: shared / demo / dedicated rules),
 *   - limited to the user's data-security scope (own / org / bu / all, pushed into the query),
 *   - limited to modules the user's role can view / create (RBAC, same rules as the web UI),
 *   - protected by RLS as the second line of defence.
 * Writes are never executed by the model: a write tool only PREPARES a draft (customer + product resolution,
 * duplicate check, totals) that the user confirms with a button.
 *
 * Everything is dynamic: objects, labels, custom fields, custom objects and statuses come from the tenant's config.
 */
import { fetchServerPage } from '@/lib/serverList';
import { tenantScope, formatDisplayNumber } from '@/lib/utils';
import { labelNow } from '@/lib/useObjectLabels';
import { resolveStatusOptions } from '@/lib/statusOptions';
import { fetchCustomObjectFields, flattenCustomRecord, formatCustomDisplayNumber } from '@/lib/customObjects';
import { getTaxRegime, computeLineGross, computeLineNet } from '@/lib/taxConfig';

// ─── Standard object registry (structure only; labels, custom fields, statuses are loaded per tenant) ─────────────
// key: record key column (CUST-…/RINV-… style internal number); prefix: display number prefix.
export const STD_OBJECTS: Record<string, any> = {
  // B2B
  customers:     { mode: 'b2b', table: 'customers', key: 'customer_number', prefix: 'CUST', name: 'name', single: 'Customer', plural: 'Customers',
                   search: ['name', 'company', 'email', 'phone', 'customer_number', 'city'], status: 'status', statuses: ['Active', 'Prospect', 'Inactive'],
                   fields: 'name, company, industry, email, phone, website, billing_address, shipping_address, city, state, postal_code, country, gst_number, status, description' },
  contacts:      { mode: 'b2b', table: 'contacts', key: 'contact_number', prefix: 'CONT', name: 'name', single: 'Contact', plural: 'Contacts', customerLink: 'b2b',
                   search: ['name', 'email', 'phone', 'customer', 'contact_number'], status: 'status', statuses: ['Active', 'Inactive'],
                   fields: 'name, customer (customer name/number), email, phone, mobile, designation, department, status, description' },
  leads:         { mode: 'b2b', table: 'leads', key: 'lead_number', prefix: 'LEAD', name: 'name', single: 'Lead', plural: 'Leads', customerLink: 'b2b', amount: 'amount',
                   search: ['name', 'customer', 'email', 'phone', 'lead_number', 'source'], status: 'status', statuses: ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'],
                   lines: { table: 'lead_line_items', fk: 'lead_number', price: 'price', disc: 'discount' },
                   fields: 'name, customer, email, phone, source, amount, status, expected_close_date (YYYY-MM-DD), description' },
  opportunities: { mode: 'b2b', table: 'opportunities', key: 'opportunity_number', prefix: 'OPP', name: 'name', single: 'Opportunity', plural: 'Opportunities', customerLink: 'b2b', amount: 'amount', date: 'close_date',
                   search: ['name', 'customer', 'opportunity_number', 'stage'], status: 'stage', statuses: ['Qualification', 'Needs Analysis', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'],
                   lines: { table: 'opportunity_line_items', fk: 'opportunity_number', price: 'price', disc: 'discount' },
                   fields: 'name, customer, stage, amount, probability, close_date (YYYY-MM-DD), campaign, description' },
  quotations:    { mode: 'b2b', table: 'quotations', key: 'quote_number', prefix: 'QUO', name: 'name', single: 'Quotation', plural: 'Quotations', customerLink: 'b2b', amount: 'grand_total', date: 'validity_date',
                   search: ['name', 'customer', 'quote_number'], status: 'status', statuses: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'],
                   lines: { table: 'quotation_line_items', fk: 'quote_number', price: 'unit_price', disc: 'discount_pct' }, doc: 'quotation',
                   fields: 'name, customer, status, validity_date (YYYY-MM-DD), payment_terms, shipping_terms, billing_address, shipping_address, notes' },
  orders:        { mode: 'b2b', table: 'orders', key: 'order_number', prefix: 'ORD', name: 'name', single: 'Order', plural: 'Orders', customerLink: 'b2b', amount: 'amount', date: 'delivery_date',
                   search: ['name', 'customer', 'order_number'], status: 'status', statuses: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
                   lines: { table: 'order_line_items', fk: 'order_number', price: 'price', disc: 'discount' },
                   fields: 'name, customer, status, delivery_date (YYYY-MM-DD), payment_terms, billing_address, shipping_address, notes' },
  invoices:      { mode: 'b2b', table: 'invoices', key: 'invoice_number', prefix: 'INV', name: 'name', single: 'Invoice', plural: 'Invoices', customerLink: 'b2b', amount: 'amount', date: 'due_date',
                   search: ['name', 'customer', 'invoice_number'], status: 'status', statuses: ['Draft', 'Pending', 'Sent', 'Paid', 'Overdue', 'Cancelled'], paid: ['Paid'],
                   lines: { table: 'invoice_line_items', fk: 'invoice_number', price: 'price', disc: 'discount' }, doc: 'b2b_invoice',
                   fields: 'name, customer, status, due_date (YYYY-MM-DD), payment_terms, billing_address, shipping_address, notes' },
  activities:    { mode: 'b2b', table: 'activities', key: 'activity_number', prefix: 'ACT', name: 'subject', single: 'Activity', plural: 'Activities', customerLink: 'b2b', date: 'activity_date',
                   search: ['subject', 'name', 'customer', 'activity_number'], status: 'status', statuses: ['Open', 'In Progress', 'Completed', 'Cancelled'],
                   fields: 'subject, customer, activity_type (Call/Meeting/Email/Task), activity_date (YYYY-MM-DD), due_date, priority (Low/Medium/High), status, notes' },
  products:      { mode: 'b2b', table: 'products', key: 'product_number', prefix: 'PROD', name: 'name', single: 'Product', plural: 'Products', amount: 'price', isProduct: true,
                   search: ['name', 'sku', 'barcode', 'category', 'product_number', 'product_family'], status: 'status', statuses: ['Active', 'Inactive'],
                   fields: 'name, category, product_family, sku, price, cost, unit, tax_rate, gst_rate, hsn_code, stock_quantity, reorder_level, status, description' },
  // B2C / retail
  retailCustomers:  { mode: 'b2c', table: 'retail_customers', key: 'customer_number', prefix: 'RCUST', name: 'name', single: 'Customer', plural: 'Customers',
                      search: ['name', 'phone', 'email', 'customer_number', 'city'], status: 'status', statuses: ['Active', 'VIP', 'Inactive'],
                      fields: 'name, phone, email, date_of_birth (YYYY-MM-DD), gender, address_line1, address_line2, city, state, postal_code, country, preferred_contact, marketing_opt_in (true/false), notes, status' },
  retailProducts:   { mode: 'b2c', table: 'retail_products', key: 'product_number', prefix: 'RPROD', name: 'name', single: 'Product', plural: 'Products', amount: 'price', isProduct: true,
                      search: ['name', 'sku', 'barcode', 'category', 'brand', 'product_number'], status: 'status', statuses: ['Active', 'Inactive'],
                      fields: 'name, category, brand, sku, barcode, unit, price, mrp, cost, stock_quantity, reorder_level, gst_rate, hsn_code, is_rentable, rent_per_day, status, description' },
  retailOrders:     { mode: 'b2c', table: 'retail_orders', key: 'order_number', prefix: 'RORD', name: 'customer', single: 'Order', plural: 'Orders', customerLink: 'b2c', amount: 'amount', date: 'order_date',
                      search: ['customer', 'customer_phone', 'order_number'], status: 'status', statuses: ['Draft', 'Pending', 'Completed', 'Cancelled'],
                      lines: { table: 'retail_order_line_items', fk: 'order_number', price: 'unit_price', disc: 'discount_pct' }, doc: 'booking_receipt',
                      fields: 'customer, status, order_date (YYYY-MM-DD), channel, payment_method, payment_status, delivery_method, delivery_address, delivery_date, notes' },
  retailInvoices:   { mode: 'b2c', table: 'retail_invoices', key: 'invoice_number', prefix: 'RINV', name: 'customer', single: 'Invoice', plural: 'Invoices', customerLink: 'b2c', amount: 'amount', date: 'invoice_date',
                      search: ['customer', 'customer_phone', 'invoice_number', 'order_number'], status: 'status', statuses: ['Draft', 'Pending', 'Paid', 'Cancelled', 'Refunded'], paid: ['Paid'],
                      lines: { table: 'retail_invoice_line_items', fk: 'invoice_number', price: 'unit_price', disc: 'discount_pct' }, doc: 'retail_invoice',
                      fields: 'customer, status, invoice_date (YYYY-MM-DD), due_date, payment_method, payment_status, billing_address, notes' },
  retailActivities: { mode: 'b2c', table: 'retail_activities', key: 'activity_number', prefix: 'RACT', name: 'subject', single: 'Activity', plural: 'Activities', customerLink: 'b2c', date: 'activity_date',
                      search: ['subject', 'customer', 'customer_phone', 'activity_number'], status: 'status', statuses: ['Open', 'In Progress', 'Completed', 'Cancelled'],
                      fields: 'subject, customer, activity_type, activity_date (YYYY-MM-DD), due_date, priority, status, description, notes' },
};

const READ_SKIP = new Set(['tenant_id', 'custom_data', 'organization_id', 'business_unit_id', 'updated_by', 'configuration', 'sections', 'page_settings']);
const clip = (v: any, n = 160) => { const s = String(v); return s.length > n ? s.slice(0, n) + '…' : s; };
const today = () => new Date().toLocaleDateString('en-CA');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safe = (v: any) => String(v ?? '').replace(/[%,()"'\\]/g, ' ').trim();

// ─── Catalog: what THIS user may see / do, built from the tenant's configuration ─────────────────────────────────
export async function buildCatalog(ctx: any) {
  const { supabase, b2cMode, can, customObjects = [] } = ctx;
  const mode = b2cMode ? 'b2c' : 'b2b';
  const objects: Record<string, any> = {};
  const keys = Object.keys(STD_OBJECTS).filter(k => STD_OBJECTS[k].mode === mode && can(k, 'view'));

  // This tenant's published custom fields for those objects (tenant-scoped; RLS also applies).
  let cfRows: any[] = [];
  try {
    const { data } = await tenantScope(supabase.from('app_custom_fields').select('object_type, api_name, label, field_type, options, required, is_published'))
      .in('object_type', keys);
    cfRows = (data || []).filter(r => r.is_published !== false);
  } catch { /* no custom fields */ }

  for (const k of keys) {
    const d = STD_OBJECTS[k];
    objects[k] = {
      ...d, kind: 'standard',
      single: labelNow(k, d.single, 'singular'), plural: labelNow(k, d.plural, 'plural'),
      statuses: resolveStatusOptions(k, d.statuses) || d.statuses,
      customFields: cfRows.filter(r => r.object_type === k).map(r => ({ api: r.api_name, label: r.label, type: r.field_type, options: Array.isArray(r.options) ? r.options : [] , required: !!r.required })),
      canCreate: can(k, 'create'), canEdit: can(k, 'edit'),
    };
  }
  // Custom objects the user may view (module must match the current mode).
  for (const o of customObjects.filter(o => (o.module === 'both' || o.module === mode)).slice(0, 15)) {
    const k = `custom_${o.api_name}`;
    if (!can(k, 'view')) continue;
    let fields: any[] = [];
    try { fields = await fetchCustomObjectFields(o.id, 'header'); } catch { /* skip */ }
    objects[k] = {
      kind: 'custom', obj: o, table: 'custom_object_records', key: 'record_number', name: 'name', single: o.singular_label, plural: o.plural_label,
      search: ['name', 'record_number', ...fields.filter(f => ['text', 'email', 'url', 'phone'].includes(f.field_type) && /^text_\d+$/.test(f.storage_column || '')).slice(0, 6).map(f => f.storage_column)],
      status: 'status', statuses: ['Active', 'Inactive'], fields: 'name, status' + (fields.length ? ', ' + fields.map(f => f.api_name).join(', ') : ''),
      customFields: [], coFields: fields, canCreate: can(k, 'create'), canEdit: can(k, 'edit'),
    };
  }
  return { mode, objects };
}

/** Compact text description of the catalog for the system prompt. */
export function describeCatalog(cat: any) {
  return Object.entries(cat.objects).map(([k, o]: any) => {
    const cfs = (o.customFields || []).map(f => `cf.${f.api} (${f.label}, ${f.type}${f.options?.length ? ': ' + f.options.slice(0, 12).join('/') : ''})`).join('; ');
    const cofs = (o.coFields || []).map(f => `${f.api_name} (${f.label}, ${f.field_type}${f.options?.length ? ': ' + f.options.slice(0, 12).join('/') : ''})`).join('; ');
    return `- ${k}: ${o.plural}${o.prefix ? ` (numbers like ${o.prefix}-00012)` : ''}. Fields: ${o.fields}${cfs ? '; custom: ' + cfs : ''}${cofs ? '; fields: ' + cofs : ''}. ${o.status}: ${(o.statuses || []).join('/')}.${o.lines ? ' Has line items.' : ''}${o.doc ? ' Has a PDF document.' : ''} You may ${o.canCreate ? 'create' : 'NOT create'} these.`;
  }).join('\n');
}

// ─── Helpers ───────────────────────────────────────────────────────────────────────────────────────────────────
function displayNo(o: any, r: any) {
  if (!r) return '';
  if (o.kind === 'custom') return formatCustomDisplayNumber(o.obj, r.display_number) || r.record_number || '';
  return r.display_number ? formatDisplayNumber(o.prefix, r.display_number) : (r[o.key] || '');
}
function compact(o: any, r: any, full = false) {
  if (o.kind === 'custom') {
    const flat = flattenCustomRecord(o.coFields || [], r);
    const out: any = { number: displayNo(o, r), name: r.name, status: r.status, owner: r.owner_name || r.owner, created: String(r.created_at || '').slice(0, 10) };
    (o.coFields || []).forEach(f => { const v = flat[f.api_name]; if (v !== undefined && v !== null && v !== '') out[f.label] = Array.isArray(v) ? v.join(', ') : v; });
    return out;
  }
  const out: any = { number: displayNo(o, r) };
  const keys = full ? Object.keys(r) : Array.from(new Set([o.name, 'customer', 'company', 'email', 'phone', 'customer_phone', o.status, o.amount, o.date, 'created_at', 'stock_quantity', 'reorder_level', 'sku', 'category', 'owner', 'payment_status', 'order_number', 'customer_id', 'source', 'probability']));
  for (const c of keys) {
    if (!c || READ_SKIP.has(c) || c === 'id' || c === 'display_number') continue;
    const v = r[c];
    if (v === null || v === undefined || v === '') continue;
    out[c] = typeof v === 'string' ? clip(v, full ? 400 : 120) : v;
  }
  const cd = r.custom_data || {};
  (o.customFields || []).forEach(f => { if (cd[f.api] !== undefined && cd[f.api] !== null && cd[f.api] !== '') out[f.label] = cd[f.api]; });
  return out;
}
function mapFilterField(o: any, field: string) {
  const f = String(field || '').trim();
  if (!f) return null;
  if (f.startsWith('cf.')) {
    const api = f.slice(3);
    if (!(o.customFields || []).some(x => x.api === api)) return null;
    return `custom_data->>${api}`;
  }
  if (o.kind === 'custom') {
    if (['name', 'status', 'created_at', 'record_number', 'owner'].includes(f)) return f;
    const cf = (o.coFields || []).find(x => x.api_name === f);
    return cf?.storage_column || null;
  }
  return /^[a-z_][a-z0-9_]*$/.test(f) ? f : null;
}
const OPS = new Set(['contains', 'equals', 'not_equals', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'is_empty', 'is_not_empty', 'is_true', 'is_false', 'on', 'before', 'after']);
function toAdvFilters(o: any, filters: any[]) {
  const out = [];
  for (const f of Array.isArray(filters) ? filters.slice(0, 10) : []) {
    const column = mapFilterField(o, f?.field);
    const op = OPS.has(f?.op) ? f.op : 'equals';
    if (column) out.push({ column, op, value: f?.value });
  }
  return out;
}
function periodRange(period: string) {
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
  const iso = (d: Date) => d.toLocaleDateString('en-CA');
  switch (period) {
    case 'today': return { from: iso(now), to: iso(now) };
    case 'this_week': { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return { from: iso(d), to: iso(now) }; }
    case 'this_month': return { from: iso(new Date(y, m, 1)), to: iso(now) };
    case 'last_month': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'this_quarter': return { from: iso(new Date(y, Math.floor(m / 3) * 3, 1)), to: iso(now) };
    case 'this_year': return { from: iso(new Date(y, 0, 1)), to: iso(now) };
    case 'last_30_days': { const d = new Date(now); d.setDate(d.getDate() - 29); return { from: iso(d), to: iso(now) }; }
    case 'last_7_days': { const d = new Date(now); d.setDate(d.getDate() - 6); return { from: iso(d), to: iso(now) }; }
    default: return null;
  }
}

async function scopedPage(ctx: any, o: any, opts: any) {
  return fetchServerPage(ctx.supabase, {
    table: o.table, searchColumns: o.search, statusColumn: o.status || 'status', security: ctx.security,
    extraEq: o.kind === 'custom' ? { custom_object_id: o.obj.id } : null, ...opts,
  });
}

/** Find ONE record the user can see, by display number (RINV-00042), internal number, uuid, or name. */
export async function findOne(ctx: any, o: any, ref: string) {
  const r = String(ref || '').trim();
  if (!r) return null;
  const m = /^([A-Z]+)-0*(\d{1,9})$/i.exec(r);
  const tries: any[] = [];
  if (m && (!o.prefix || m[1].toUpperCase() === o.prefix)) tries.push([{ column: 'display_number', op: 'equals', value: Number(m[2]) }]);
  if (/^\d{1,9}$/.test(r)) tries.push([{ column: 'display_number', op: 'equals', value: Number(r) }]);
  tries.push([{ column: o.key, op: 'equals', value: r }]);
  if (UUID.test(r)) tries.push([{ column: 'id', op: 'equals', value: r }]);
  for (const adv of tries) {
    const { data } = await scopedPage(ctx, o, { advFilters: adv, pageSize: 1 });
    if (data?.[0]) return data[0];
  }
  const { data } = await scopedPage(ctx, o, { searchTerm: safe(r), pageSize: 2 });
  return data?.length === 1 ? data[0] : null;
}

// ─── READ tools (run automatically) ──────────────────────────────────────────────────────────────────────────────
async function tSearch(ctx: any, cat: any, a: any) {
  const o = cat.objects[a.object];
  if (!o) return { error: `Unknown or not permitted object "${a.object}". Use one of: ${Object.keys(cat.objects).join(', ')}.` };
  const limit = Math.min(Math.max(Number(a.limit) || 10, 1), 25);
  const adv = toAdvFilters(o, a.filters);
  const range = a.period ? periodRange(a.period) : null;
  const dateCol = mapFilterField(o, a.date_field) || o.date || 'created_at';
  const sc = a.sort?.field ? mapFilterField(o, a.sort.field) : null;
  const sortCol = sc && !sc.includes('->') ? sc : null; // json paths cannot be sorted server-side
  const { data, error, totalCount } = await scopedPage(ctx, o, {
    searchTerm: safe(a.query), advFilters: adv, pageSize: limit, page: Math.max(Number(a.page) || 1, 1),
    dateColumn: dateCol, dateFrom: range?.from || a.from || null, dateTo: range?.to ? (dateCol.endsWith('_at') ? range.to + 'T23:59:59' : range.to) : (a.to || null),
    sortColumn: sortCol || 'created_at', sortAscending: a.sort?.dir === 'asc',
  });
  if (error) return { error: `Search failed: ${error.message}` };
  return { object: a.object, total_matching: totalCount, showing: (data || []).length, records: (data || []).map(r => compact(o, r)) };
}

async function tGet(ctx: any, cat: any, a: any) {
  const o = cat.objects[a.object];
  if (!o) return { error: `Unknown or not permitted object "${a.object}".` };
  const r = await findOne(ctx, o, a.id);
  if (!r) return { error: `No ${o.single} "${a.id}" found that you can access.` };
  const out: any = { object: a.object, record: compact(o, r, true) };
  if (o.lines) {
    const { data: li } = await tenantScope(ctx.supabase.from(o.lines.table).select('*')).eq(o.lines.fk, r[o.key]).order('sort_order', { ascending: true }).limit(100);
    out.line_items = (li || []).map(l => ({ product: l.product_name, quantity: Number(l.quantity || 0), price: Number(l[o.lines.price] ?? l.price ?? l.unit_price ?? 0),
      discount_pct: Number(l[o.lines.disc] ?? 0), tax_pct: l.tax_pct ?? l.gst_rate ?? undefined, line_total: l.extended_price ?? undefined,
      ...(l.rental_start_date ? { rental_start_date: l.rental_start_date, rental_end_date: l.rental_end_date } : {}) }));
  }
  return out;
}

async function tAggregate(ctx: any, cat: any, a: any) {
  const o = cat.objects[a.object];
  if (!o) return { error: `Unknown or not permitted object "${a.object}".` };
  const metric = ['count', 'sum', 'avg', 'min', 'max'].includes(a.metric) ? a.metric : 'count';
  const field = metric === 'count' ? null : (mapFilterField(o, a.field || o.amount) || o.amount);
  const range = a.period ? periodRange(a.period) : null;
  const dateCol = mapFilterField(o, a.date_field) || o.date || 'created_at';
  const adv = toAdvFilters(o, a.filters);
  const rows: any[] = [];
  let total = 0;
  for (let page = 1; page <= 10; page++) {
    const { data, error, totalCount } = await scopedPage(ctx, o, {
      advFilters: adv, pageSize: 1000, page, dateColumn: dateCol,
      dateFrom: range?.from || a.from || null, dateTo: range?.to ? (dateCol.endsWith('_at') ? range.to + 'T23:59:59' : range.to) : (a.to || null),
    });
    if (error) return { error: `Could not compute: ${error.message}` };
    total = totalCount; rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const val = (r: any) => {
    if (!field) return 0;
    const v = field.startsWith('custom_data->>') ? (r.custom_data || {})[field.slice(14)] : r[field];
    return Number(v) || 0;
  };
  const calc = (list: any[]) => {
    if (metric === 'count') return list.length;
    const nums = list.map(val);
    if (!nums.length) return 0;
    if (metric === 'sum') return Math.round(nums.reduce((s, n) => s + n, 0) * 100) / 100;
    if (metric === 'avg') return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100;
    return metric === 'min' ? Math.min(...nums) : Math.max(...nums);
  };
  const out: any = { object: a.object, metric, field: field || undefined, rows_considered: rows.length, total_matching: total, value: calc(rows) };
  if (rows.length < total) out.note = `Computed over the first ${rows.length} of ${total} matching records.`;
  if (a.group_by) {
    const g = String(a.group_by);
    const keyOf = (r: any) => {
      if (['day', 'week', 'month', 'year'].includes(g)) {
        const d = String(r[dateCol] || '').slice(0, 10); if (!d) return '(no date)';
        if (g === 'day') return d; if (g === 'month') return d.slice(0, 7); if (g === 'year') return d.slice(0, 4);
        const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); return 'week of ' + dt.toLocaleDateString('en-CA');
      }
      const col = mapFilterField(o, g); if (!col) return '(all)';
      const v = col.startsWith('custom_data->>') ? (r.custom_data || {})[col.slice(14)] : r[col];
      return v === null || v === undefined || v === '' ? '(empty)' : String(v);
    };
    const groups: Record<string, any[]> = {};
    rows.forEach(r => { const k = keyOf(r); (groups[k] = groups[k] || []).push(r); });
    let list = Object.entries(groups).map(([k, l]) => ({ group: k, value: calc(l), count: l.length }));
    list = ['day', 'week', 'month', 'year'].includes(g) ? list.sort((x, y) => x.group.localeCompare(y.group)) : list.sort((x, y) => y.value - x.value);
    out.groups = list.slice(0, 31);
  }
  return out;
}

async function tDuplicates(ctx: any, cat: any, a: any) {
  const o = cat.objects[a.object];
  if (!o) return { error: `Unknown or not permitted object "${a.object}".` };
  const matches: any[] = [];
  const add = (rows: any[], why: string) => rows.forEach(r => { if (!matches.some(m => m.r.id === r.id)) matches.push({ r, why }); else matches.find(m => m.r.id === r.id).why += ` + ${why}`; });
  const nm = safe(a.name); const em = safe(a.email).toLowerCase(); const ph = String(a.phone || '').replace(/\D/g, '').slice(-10);
  if (nm) { const { data } = await scopedPage(ctx, o, { advFilters: [{ column: o.name, op: 'contains', value: nm }], pageSize: 8 }); add(data || [], 'similar name'); }
  if (em && o.table !== 'retail_orders') { const { data } = await scopedPage(ctx, o, { advFilters: [{ column: 'email', op: 'contains', value: em }], pageSize: 5 }); add(data || [], 'same email'); }
  if (ph.length >= 7) {
    const col = ['retail_orders', 'retail_invoices', 'retail_activities'].includes(o.table) ? 'customer_phone' : 'phone';
    const { data } = await scopedPage(ctx, o, { advFilters: [{ column: col, op: 'contains', value: ph }], pageSize: 5 }); add(data || [], 'same phone');
  }
  return { object: a.object, possible_duplicates: matches.slice(0, 8).map(m => ({ ...compact(o, m.r), matched_on: m.why })), checked: { name: nm || undefined, email: em || undefined, phone: ph || undefined } };
}

// ─── PREPARE (write) tools: build a draft for the user to confirm ─────────────────────────────────────────────────
async function resolveCustomer(ctx: any, cat: any, mode: string, ref: string) {
  const ck = mode === 'b2c' ? 'retailCustomers' : 'customers';
  const co = cat.objects[ck];
  if (!co) return { error: 'You do not have access to customers.' };
  const r = String(ref || '').trim();
  if (!r) return { error: 'No customer given.' };
  const direct = await findOne(ctx, co, r);
  if (direct) return { row: direct, object: ck };
  const ph = r.replace(/\D/g, '');
  let candidates: any[] = [];
  if (ph.length >= 7) { const { data } = await scopedPage(ctx, co, { advFilters: [{ column: 'phone', op: 'contains', value: ph.slice(-10) }], pageSize: 5 }); candidates = data || []; }
  if (!candidates.length) { const { data } = await scopedPage(ctx, co, { advFilters: [{ column: 'name', op: 'contains', value: safe(r) }], pageSize: 6 }); candidates = data || []; }
  const exact = candidates.filter(c => String(c.name || '').trim().toLowerCase() === r.toLowerCase());
  if (exact.length === 1) return { row: exact[0], object: ck };
  if (candidates.length === 1) return { row: candidates[0], object: ck };
  if (candidates.length > 1) return { ambiguous: candidates.map(c => compact(co, c)) , object: ck };
  return { notFound: true, object: ck };
}

async function resolveProduct(ctx: any, cat: any, mode: string, ref: string) {
  const pk = mode === 'b2c' ? 'retailProducts' : 'products';
  const po = cat.objects[pk];
  if (!po) return { error: 'You do not have access to products.' };
  const r = String(ref || '').trim();
  const direct = await findOne(ctx, po, r);
  if (direct) return { row: direct };
  const { data } = await scopedPage(ctx, po, { advFilters: [{ column: 'name', op: 'contains', value: safe(r) }], pageSize: 6 });
  const list = data || [];
  const exact = list.filter(p => String(p.name || '').trim().toLowerCase() === r.toLowerCase());
  if (exact.length === 1) return { row: exact[0] };
  if (list.length === 1) return { row: list[0] };
  if (list.length > 1) return { ambiguous: list.map(p => ({ name: p.name, number: displayNo(po, p), price: p.price })) };
  return { notFound: true };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
let _draftSeq = 0;

async function tPrepareCreate(ctx: any, cat: any, a: any) {
  const o = cat.objects[a.object];
  if (!o) return { error: `Unknown or not permitted object "${a.object}".` };
  if (!o.canCreate) return { error: `Your role does not allow creating ${o.plural}.` };
  const f = { ...(a.fields || {}) };
  const warnings: string[] = [];
  const missing: string[] = [];
  const draft: any = { id: `d${Date.now()}_${++_draftSeq}`, object: a.object, fields: {}, custom: {}, lines: [], warnings, missing };

  // Custom fields (cf.api or the field label) → custom_data, validated against the field's options.
  for (const cf of o.customFields || []) {
    let v = f[`cf.${cf.api}`] ?? f[cf.api] ?? f[cf.label];
    delete f[`cf.${cf.api}`]; delete f[cf.api]; delete f[cf.label];
    if (v === undefined || v === null || v === '') { if (cf.required) missing.push(cf.label); continue; }
    if (cf.options?.length && cf.type === 'single_select' && !cf.options.includes(v)) {
      const hit = cf.options.find(x => String(x).toLowerCase() === String(v).toLowerCase());
      if (hit) v = hit; else { warnings.push(`"${v}" is not an option for ${cf.label} (${cf.options.join(', ')}).`); continue; }
    }
    draft.custom[cf.api] = v;
  }

  if (o.kind === 'custom') {
    draft.fields = f;
    if (!String(f.name || '').trim()) missing.push('name');
  } else {
    // Customer link: resolve to a REAL record the user can see - never create orphan text links.
    if (o.customerLink) {
      const ref = f.customer || f.customer_id || f.customer_name;
      delete f.customer; delete f.customer_id; delete f.customer_name;
      const needCustomer = ['quotations', 'orders', 'invoices', 'retailOrders', 'retailInvoices', 'contacts'].includes(a.object);
      if (!ref) { if (needCustomer) missing.push('customer'); }
      else {
        const rc = await resolveCustomer(ctx, cat, o.customerLink === 'b2c' ? 'b2c' : 'b2b', ref);
        if (rc.error) return { error: rc.error };
        if (rc.ambiguous) return { needs_choice: true, message: `More than one customer matches "${ref}". Ask the user which one.`, candidates: rc.ambiguous };
        if (rc.notFound) return { customer_not_found: true, message: `No customer "${ref}" exists (or you cannot see it). Ask the user whether to create the customer first (use prepare_create on ${rc.object}).` };
        const c = rc.row;
        draft.customer = { name: c.name, number: displayNo(cat.objects[rc.object], c), phone: c.phone || '', email: c.email || '', status: c.status || '' };
        if (/inactive/i.test(String(c.status || ''))) warnings.push(`${c.name} is marked ${c.status}.`);
        if (o.customerLink === 'b2c') Object.assign(draft.fields, { customer: c.name, customer_id: c.id, customer_phone: c.phone || '' });
        else Object.assign(draft.fields, { customer: c.name, customerId: c.customer_number });
      }
    }
    // Copy the remaining allowed fields (only names this object documents; dates must be YYYY-MM-DD).
    const allowed = new Set(String(o.fields).split(',').map(x => x.trim().split(' ')[0]).filter(Boolean));
    for (const [k, v] of Object.entries(f)) {
      if (!allowed.has(k) || k === 'customer') continue;
      if (/date/.test(k) && v && !DATE_RE.test(String(v))) { warnings.push(`${k} "${v}" is not a date (YYYY-MM-DD) and was left empty.`); continue; }
      draft.fields[k] = v;
    }
    if (o.status && draft.fields[o.status] && o.statuses?.length && !o.statuses.includes(draft.fields[o.status])) {
      warnings.push(`"${draft.fields[o.status]}" is not a ${o.single} ${o.status}; the default will be used.`); delete draft.fields[o.status];
    }
    // The record's own name/subject is required (orders and invoices are named after their customer).
    if (o.name && o.name !== 'customer' && !['orders', 'invoices', 'quotations'].includes(a.object) && !String(draft.fields[o.name] || '').trim()) missing.push(o.name);
    if (['retailOrders'].includes(a.object) && !draft.fields.order_date) draft.fields.order_date = today();
    if (['retailInvoices'].includes(a.object) && !draft.fields.invoice_date) draft.fields.invoice_date = today();

    // Duplicates for master records.
    if (['customers', 'retailCustomers', 'contacts', 'leads', 'products', 'retailProducts'].includes(a.object)) {
      const dup = await tDuplicates(ctx, cat, { object: a.object, name: draft.fields.name, email: draft.fields.email, phone: draft.fields.phone });
      if (dup.possible_duplicates?.length) { draft.duplicates = dup.possible_duplicates; warnings.push(`Possible duplicate: ${dup.possible_duplicates.slice(0, 3).map(d => `${d.name || ''} ${d.number || ''} (${d.matched_on})`).join('; ')}.`); }
    }

    // Line items: resolve every product to a real catalog item, take its price/tax unless the user gave a price.
    if (o.lines && Array.isArray(a.line_items)) {
      const mode = cat.mode;
      for (const li of a.line_items.slice(0, 50)) {
        const rp = await resolveProduct(ctx, cat, mode, li.product || li.name || li.sku);
        if (rp.error) return { error: rp.error };
        if (rp.ambiguous) return { needs_choice: true, message: `More than one product matches "${li.product}". Ask the user which one.`, candidates: rp.ambiguous };
        if (rp.notFound) return { product_not_found: true, message: `No product "${li.product}" exists. Ask the user to pick an existing product or create it first.` };
        const p = rp.row;
        const qty = Number(li.quantity) > 0 ? Number(li.quantity) : 1;
        const price = li.price !== undefined && li.price !== null && li.price !== '' ? Number(li.price) : Number(p.price || p.rent_per_day || 0);
        const line: any = { product_id: p.id, product_name: p.name, product_code: p.sku || p.product_number || '', quantity: qty, unit_price: price, price,
          discount_pct: Number(li.discount_pct ?? li.discount ?? 0), hsn_code: p.hsn_code ?? null, gst_rate: p.gst_rate ?? null,
          tax_pct: p.gst_rate ?? p.tax_rate ?? null, custom_data: {} };
        if (li.rental_start_date || li.rental_end_date) {
          if (!DATE_RE.test(String(li.rental_start_date || '')) || !DATE_RE.test(String(li.rental_end_date || ''))) warnings.push(`${p.name}: rental dates must be YYYY-MM-DD.`);
          else { line.rental_start_date = li.rental_start_date; line.rental_end_date = li.rental_end_date; }
        }
        if (li.custom && typeof li.custom === 'object') line.custom_data = { ...li.custom };
        draft.lines.push(line);
      }
    }
    if (o.lines && ['retailOrders', 'retailInvoices', 'invoices', 'orders', 'quotations'].includes(a.object) && !draft.lines.length) missing.push('at least one product line');
  }
  // Totals with the tenant's own tax regime (same formula as the record screens).
  if (draft.lines.length) {
    const regime = getTaxRegime(ctx.appPreferences?.default_currency);
    const subtotal = draft.lines.reduce((s, l) => s + computeLineGross(l), 0);
    const disc = draft.lines.reduce((s, l) => s + computeLineGross(l) * Number(l.discount_pct || 0) / 100, 0);
    // B2C uses the tenant's tax regime exactly like the retail record screens; B2B lines carry their own tax %.
    const lineTax = (l) => cat.mode === 'b2c' ? (regime.computeLineTax({ ...l, gst_rate: l.gst_rate ?? undefined }).totalTax || 0) : computeLineNet(l) * Number(l.tax_pct || 0) / 100;
    const tax = draft.lines.reduce((s, l) => { const t = lineTax(l); l.extended_price = Math.round((computeLineNet(l) + t) * 100) / 100; return s + t; }, 0);
    draft.totals = { subtotal: Math.round(subtotal * 100) / 100, discount: Math.round(disc * 100) / 100, tax: Math.round(tax * 100) / 100, total: Math.round((subtotal - disc + tax) * 100) / 100 };
  }
  ctx.drafts[draft.id] = draft;
  if (!missing.length) ctx.cards.push({ type: 'draft', draftId: draft.id });
  return {
    draft_ready: missing.length === 0, draft_id: draft.id, object: a.object, customer: draft.customer, fields: draft.fields, custom_fields: draft.custom,
    line_items: draft.lines.map(l => ({ product: l.product_name, quantity: l.quantity, price: l.unit_price, discount_pct: l.discount_pct, ...(l.rental_start_date ? { from: l.rental_start_date, to: l.rental_end_date } : {}) })),
    totals: draft.totals, warnings, missing,
    message: missing.length ? `Cannot create yet - missing: ${missing.join(', ')}. Ask the user for it.` : 'Draft shown to the user with a Create button. Do not say it is created; ask them to review and click Create.',
  };
}

async function tRecordActions(ctx: any, cat: any, a: any) {
  const o = cat.objects[a.object];
  if (!o) return { error: `Unknown or not permitted object "${a.object}".` };
  const r = await findOne(ctx, o, a.id);
  if (!r) return { error: `No ${o.single} "${a.id}" found that you can access.` };
  ctx.cards.push({ type: 'record', object: a.object, row: r, focus: a.action || null });
  return { shown: true, number: displayNo(o, r), pdf_available: !!o.doc, message: `A card for ${displayNo(o, r)} is shown with ${o.doc ? 'PDF, ' : ''}WhatsApp, email and call buttons. Tell the user to use them.` };
}

export const TOOL_FUNCS: Record<string, Function> = {
  search_records: tSearch, get_record: tGet, aggregate: tAggregate, find_duplicates: tDuplicates,
  prepare_create: tPrepareCreate, record_actions: tRecordActions,
};

export const TOOL_GUIDE = `TOOLS - you work like an agent. To use a tool, write exactly one or more blocks:
<tool>{"name":"search_records","args":{"object":"retailInvoices","query":"text","filters":[{"field":"status","op":"equals","value":"Paid"}],"period":"this_month","date_field":"invoice_date","sort":{"field":"amount","dir":"desc"},"limit":10}}</tool>
Available tools:
- search_records {object, query?, filters?[{field, op, value}], period?, date_field?, from?, to?, sort?{field,dir}, limit? (max 25), page?} - find records. ops: contains, equals, not_equals, gt, gte, lt, lte, in, not_in, is_empty, is_not_empty, on, before, after. Custom fields are "cf.<api_name>". periods: today, this_week, this_month, last_month, this_quarter, this_year, last_7_days, last_30_days.
- get_record {object, id} - one record with its line items. id = number like RINV-00042, or the name.
- aggregate {object, metric: count|sum|avg|min|max, field?, filters?, period?, date_field?, from?, to?, group_by?: <field> | day | week | month | year} - totals, trends, breakdowns. ALWAYS use this for numbers (never estimate).
- find_duplicates {object, name?, email?, phone?}
- prepare_create {object, fields:{...}, line_items?:[{product, quantity, price?, discount_pct?, rental_start_date?, rental_end_date?, custom?:{}}]} - builds a draft the USER confirms with a button. It finds the customer and products for you, checks duplicates and computes totals with the tenant's tax rules. Never claim a record is created until you get a "created" note.
- record_actions {object, id, action?: pdf|whatsapp|email|call} - shows a card with PDF, WhatsApp, email and call buttons for an existing record.
After a tool block, STOP writing and wait: you will receive <result> blocks. Then continue (more tools, or the final answer).
AGENT RULES:
1. Look things up before answering about data. Never invent records, numbers, names or numbers like INV-00001.
2. Before creating an order/invoice/quotation/activity: the customer must exist. prepare_create finds them; if "customer_not_found", ask whether to create the customer (then prepare_create on the customer object), and continue after it is created.
3. Before creating a customer/contact/lead/product: prepare_create checks duplicates; if it reports possible duplicates, tell the user and ask before going on.
4. Sales/revenue = invoices whose status is Paid (never Draft, Pending, Cancelled or Refunded) unless the user asks otherwise.
5. If a tool says you are not permitted, tell the user plainly that their role does not allow it. Do not try other ways around it.
6. After a record is created and the user wants the PDF or to send it, call record_actions.
7. Use at most 6 tool rounds per question.`;

/** Runs every <tool> block in a model reply. Returns the result text to feed back, or null when there were none. */
export function parseTools(text: string) {
  const calls: any[] = [];
  const re = /<tool>([\s\S]*?)<\/tool>/g; let m;
  while ((m = re.exec(text))) {
    try { const j = JSON.parse(m[1].trim()); if (j?.name) calls.push(j); } catch { calls.push({ name: '__bad_json__', raw: m[1].slice(0, 200) }); }
  }
  return calls;
}

export async function runTools(ctx: any, cat: any, calls: any[]) {
  const parts: string[] = [];
  for (const c of calls.slice(0, 5)) {
    let res: any;
    try {
      if (c.name === '__bad_json__') res = { error: 'Your tool block was not valid JSON. Send it again as valid JSON.' };
      else if (!TOOL_FUNCS[c.name]) res = { error: `Unknown tool "${c.name}".` };
      else res = await TOOL_FUNCS[c.name](ctx, cat, c.args || {});
    } catch (e: any) { res = { error: e?.message || 'Tool failed.' }; }
    let s = JSON.stringify(res);
    if (s.length > 9000) s = s.slice(0, 9000) + '…(truncated)';
    parts.push(`<result name="${c.name}">${s}</result>`);
  }
  return parts.join('\n');
}

export const stripTools = (t: string) => String(t || '').replace(/<tool>[\s\S]*?<\/tool>/g, '').replace(/<result[\s\S]*?<\/result>/g, '').trim();
export { displayNo };
