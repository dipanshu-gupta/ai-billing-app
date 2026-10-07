// @ts-nocheck
/**
 * Express Dashboard engine (Oracle-Redwood-Sales-dashboard style).
 *
 *  • SOURCES      – every object a widget can read (CRM / Retail / published custom objects), data-driven.
 *  • field catalog – standard fields + custom fields (app_custom_fields / custom_object_fields) per source.
 *  • loadRows      – tenant-scoped + RBAC-scoped (data security) server queries, reusing fetchServerPage,
 *                    so a dashboard can never show a user more than the list pages would.
 *  • aggregate     – group-by / measure (count, sum, avg, min, max) with date bucketing, done client-side
 *                    over at most MAX_ROWS rows (flagged when truncated).
 *  • defaultConfig – role-aware starter layout (cards + widgets) that users then make their own.
 */
import { fetchServerPage, timePeriodToRange, splitAdvFilters } from '@/lib/serverList';
import { fetchCustomObjectFields } from '@/lib/customObjects';

export const MAX_ROWS = 5000;
const PAGE = 1000;

export const AGGS = [
  { v: 'count', l: 'Count of records' },
  { v: 'sum', l: 'Sum of' },
  { v: 'avg', l: 'Average of' },
  { v: 'min', l: 'Minimum of' },
  { v: 'max', l: 'Maximum of' },
];

export const TIME_PERIODS = [
  { v: 'all', l: 'All time' },
  { v: 'today', l: 'Today' },
  { v: 'this_week', l: 'This week' },
  { v: 'this_month', l: 'This month' },
  { v: 'last_month', l: 'Last month' },
  { v: 'this_quarter', l: 'This quarter' },
  { v: 'this_year', l: 'This year' },
  { v: 'last_7', l: 'Last 7 days' },
  { v: 'last_30', l: 'Last 30 days' },
  { v: 'last_90', l: 'Last 90 days' },
  { v: 'next_7', l: 'Next 7 days' },
  { v: 'next_30', l: 'Next 30 days' },
  { v: 'overdue', l: 'Overdue (before today)' },
];

export const CHART_TYPES = [
  { v: 'bar', l: 'Column' },
  { v: 'hbar', l: 'Bar (horizontal)' },
  { v: 'line', l: 'Line' },
  { v: 'area', l: 'Area' },
  { v: 'pie', l: 'Pie' },
  { v: 'donut', l: 'Donut' },
  { v: 'funnel', l: 'Funnel' },
];

export const DATE_BUCKETS = [
  { v: 'day', l: 'Day' }, { v: 'week', l: 'Week' }, { v: 'month', l: 'Month' }, { v: 'quarter', l: 'Quarter' }, { v: 'year', l: 'Year' },
];

export const FILTER_OPS = {
  text:     [['contains', 'contains'], ['equals', 'is'], ['not_equals', 'is not'], ['is_empty', 'is empty'], ['is_not_empty', 'is not empty']],
  select:   [['equals', 'is'], ['not_equals', 'is not'], ['is_empty', 'is empty'], ['is_not_empty', 'is not empty']],
  number:   [['equals', '='], ['gt', '>'], ['gte', '≥'], ['lt', '<'], ['lte', '≤'], ['is_empty', 'is empty']],
  date:     [['after', 'after'], ['before', 'before'], ['on', 'on'], ['is_empty', 'is empty']],
  datetime: [['after', 'after'], ['before', 'before'], ['is_empty', 'is empty']],
  boolean:  [['is_true', 'is Yes'], ['is_false', 'is No']],
};

// Words that mean "this record is finished" — "Open only" excludes them. Status vocabularies are tenant-configurable,
// so users can always pick explicit statuses instead.
const TERMINAL = ['Closed Won', 'Closed Lost', 'Won', 'Lost', 'Completed', 'Complete', 'Converted', 'Cancelled', 'Canceled', 'Paid', 'Delivered', 'Done', 'Rejected', 'Closed', 'Fulfilled', 'Void', 'Refunded', 'Expired'];

const F = (key, label, type, extra: any = {}) => ({ key, label, type, column: extra.column || key, ...extra });
const AMT = (key, label) => F(key, label, 'number', { currency: true });

const OWN_B2B = { ownerColumn: 'owner', ownerIdColumn: 'owner_id', ownerLabelKey: 'owner' };
const OWN_B2C = { ownerColumn: 'owner', ownerIdColumn: 'owner_id', ownerLabelKey: 'owner_name' };

// key == the app's page key (so saved searches, permissions and navigation all line up).
const STANDARD_SOURCES = [
  { key: 'opportunities', label: 'Opportunities', module: 'b2b', table: 'opportunities', objType: 'opportunities', perm: 'opportunities_view', titleKey: 'name', numberKey: 'opportunity_number', amountKey: 'amount', statusKey: 'status', dateKey: 'close_date', openKeys: ['stage', 'status'], searchCols: ['name', 'customer', 'opportunity_number'], ...OWN_B2B,
    fields: [F('name', 'Name', 'text'), F('customer', 'Customer', 'text'), F('stage', 'Stage', 'select'), F('status', 'Status', 'select'), AMT('amount', 'Amount'), F('probability', 'Probability %', 'number'), F('close_date', 'Close date', 'date'), F('owner', 'Owner', 'text'), F('campaign', 'Campaign', 'text'), F('created_at', 'Created', 'datetime')] },
  { key: 'leads', label: 'Leads', module: 'b2b', table: 'leads', objType: 'leads', perm: 'leads_view', titleKey: 'name', numberKey: 'lead_number', amountKey: 'amount', statusKey: 'status', dateKey: 'created_at', openKeys: ['status'], searchCols: ['name', 'customer', 'lead_number'], ...OWN_B2B,
    fields: [F('name', 'Name', 'text'), F('customer', 'Customer', 'text'), F('source', 'Source', 'select'), F('status', 'Status', 'select'), AMT('amount', 'Amount'), F('expected_close_date', 'Expected close', 'date'), F('owner', 'Owner', 'text'), F('created_at', 'Created', 'datetime')] },
  { key: 'customers', label: 'Customers', module: 'b2b', table: 'customers', objType: 'customers', perm: 'customers_view', titleKey: 'name', numberKey: 'customer_number', statusKey: 'status', dateKey: 'created_at', openKeys: [], searchCols: ['name', 'company', 'customer_number'], ...OWN_B2B,
    fields: [F('name', 'Name', 'text'), F('company', 'Company', 'text'), F('industry', 'Industry', 'select'), F('status', 'Status', 'select'), F('city', 'City', 'text'), F('state', 'State', 'text'), F('country', 'Country', 'text'), F('owner', 'Owner', 'text'), F('created_at', 'Created', 'datetime')] },
  { key: 'quotations', label: 'Quotations', module: 'b2b', table: 'quotations', objType: 'quotations', perm: null, titleKey: 'name', numberKey: 'quote_number', amountKey: 'grand_total', statusKey: 'status', dateKey: 'validity_date', openKeys: ['status'], searchCols: ['name', 'customer', 'quote_number'], ...OWN_B2B,
    fields: [F('name', 'Name', 'text'), F('customer', 'Customer', 'text'), F('status', 'Status', 'select'), AMT('grand_total', 'Grand total'), AMT('subtotal', 'Subtotal'), F('validity_date', 'Valid until', 'date'), F('owner', 'Owner', 'text'), F('created_at', 'Created', 'datetime')] },
  { key: 'orders', label: 'Orders', module: 'b2b', table: 'orders', objType: 'orders', perm: 'orders_view', titleKey: 'name', numberKey: 'order_number', amountKey: 'amount', statusKey: 'status', dateKey: 'delivery_date', openKeys: ['status'], searchCols: ['name', 'customer', 'order_number'], ...OWN_B2B,
    fields: [F('name', 'Name', 'text'), F('customer', 'Customer', 'text'), F('status', 'Status', 'select'), AMT('amount', 'Amount'), F('delivery_date', 'Delivery date', 'date'), F('payment_terms', 'Payment terms', 'text'), F('owner', 'Owner', 'text'), F('created_at', 'Created', 'datetime')] },
  { key: 'invoices', label: 'Invoices', module: 'b2b', table: 'invoices', objType: 'invoices', perm: 'invoices_view', titleKey: 'name', numberKey: 'invoice_number', amountKey: 'amount', statusKey: 'status', dateKey: 'due_date', openKeys: ['status'], searchCols: ['name', 'customer', 'invoice_number'], ...OWN_B2B,
    fields: [F('customer', 'Customer', 'text'), F('status', 'Status', 'select'), AMT('amount', 'Amount'), F('due_date', 'Due date', 'date'), F('payment_terms', 'Payment terms', 'text'), F('owner', 'Owner', 'text'), F('created_at', 'Created', 'datetime')] },
  { key: 'activities', label: 'Activities / Tasks', module: 'b2b', table: 'activities', objType: 'activities', perm: 'activities_view', titleKey: 'subject', numberKey: 'activity_number', statusKey: 'status', dateKey: 'due_date', openKeys: ['status'], searchCols: ['subject', 'customer', 'activity_number'], ...OWN_B2B,
    fields: [F('subject', 'Subject', 'text'), F('customer', 'Customer', 'text'), F('activity_type', 'Type', 'select'), F('status', 'Status', 'select'), F('priority', 'Priority', 'select'), F('due_date', 'Due date', 'date'), F('owner', 'Owner', 'text'), F('created_at', 'Created', 'datetime')] },

  { key: 'retailCustomers', label: 'Customers (Retail)', module: 'b2c', table: 'retail_customers', objType: 'retailCustomers', perm: null, titleKey: 'name', numberKey: 'customer_number', statusKey: 'status', dateKey: 'created_at', openKeys: [], searchCols: ['name', 'phone', 'customer_number'], ...OWN_B2C,
    fields: [F('name', 'Name', 'text'), F('phone', 'Phone', 'text'), F('status', 'Status', 'select'), F('loyalty_tier', 'Loyalty tier', 'select'), F('loyalty_points', 'Loyalty points', 'number'), F('city', 'City', 'text'), F('gender', 'Gender', 'select'), F('owner_name', 'Owner', 'text'), F('created_at', 'Created', 'datetime')] },
  { key: 'retailOrders', label: 'Orders (Retail)', module: 'b2c', table: 'retail_orders', objType: 'retailOrders', perm: null, titleKey: 'customer', numberKey: 'order_number', amountKey: 'amount', statusKey: 'status', dateKey: 'order_date', openKeys: ['status'], searchCols: ['customer', 'order_number', 'customer_phone'], ...OWN_B2C,
    fields: [F('customer', 'Customer', 'text'), F('status', 'Status', 'select'), AMT('amount', 'Amount'), F('channel', 'Channel', 'select'), F('payment_method', 'Payment method', 'select'), F('payment_status', 'Payment status', 'select'), F('delivery_method', 'Delivery method', 'select'), F('order_date', 'Order date', 'date'), F('delivery_date', 'Delivery date', 'date'), F('owner_name', 'Owner', 'text'), F('created_at', 'Created', 'datetime')] },
  { key: 'retailInvoices', label: 'Invoices (Retail)', module: 'b2c', table: 'retail_invoices', objType: 'retailInvoices', perm: null, titleKey: 'customer', numberKey: 'invoice_number', amountKey: 'amount', statusKey: 'status', dateKey: 'invoice_date', openKeys: ['status'], searchCols: ['customer', 'invoice_number', 'customer_phone'], ...OWN_B2C,
    fields: [F('customer', 'Customer', 'text'), F('status', 'Status', 'select'), AMT('amount', 'Amount'), F('payment_status', 'Payment status', 'select'), F('payment_method', 'Payment method', 'select'), F('invoice_date', 'Invoice date', 'date'), F('due_date', 'Due date', 'date'), F('owner_name', 'Owner', 'text'), F('created_at', 'Created', 'datetime')] },
  { key: 'retailActivities', label: 'Activities (Retail)', module: 'b2c', table: 'retail_activities', objType: 'retailActivities', perm: null, titleKey: 'subject', numberKey: 'activity_number', statusKey: 'status', dateKey: 'due_date', openKeys: ['status'], searchCols: ['subject', 'customer', 'activity_number'], ...OWN_B2C,
    fields: [F('subject', 'Subject', 'text'), F('customer', 'Customer', 'text'), F('activity_type', 'Type', 'select'), F('status', 'Status', 'select'), F('priority', 'Priority', 'select'), F('due_date', 'Due date', 'date'), F('owner_name', 'Owner', 'text'), F('created_at', 'Created', 'datetime')] },
];

/** All sources visible to this tenant mode + user, including published custom objects. */
export function getSources({ b2c, customObjects, canView }: { b2c: boolean; customObjects?: any[]; canView?: (perm: string | null) => boolean }) {
  const can = canView || (() => true);
  const std = STANDARD_SOURCES.filter(s => (b2c ? s.module === 'b2c' : s.module === 'b2b') && can(s.perm));
  const custom = (customObjects || [])
    .filter(o => o.status === 'published' && o.is_active !== false && (o.module === (b2c ? 'b2c' : 'b2b') || !o.module))
    .filter(o => can(`custom_${o.api_name}_view`))
    .map(o => ({
      key: `custom_${o.api_name}`, label: o.plural_label || o.label || o.api_name, module: o.module, table: 'custom_object_records',
      extraEq: { custom_object_id: o.id }, customObjectId: o.id, objType: null, perm: `custom_${o.api_name}_view`,
      titleKey: 'name', numberKey: 'record_number', statusKey: 'status', dateKey: 'created_at', openKeys: ['status'], searchCols: ['name', 'record_number'],
      ownerColumn: 'owner', ownerIdColumn: 'owner_id', ownerLabelKey: 'owner_name', isCustomObject: true,
      fields: [F('name', 'Name', 'text'), F('status', 'Status', 'select'), F('owner_name', 'Owner', 'text'), F('created_at', 'Created', 'datetime')],
    }));
  return [...std, ...custom];
}

const cfType = (t: string) => ({ number: 'number', currency: 'number', date: 'date', datetime: 'datetime', checkbox: 'boolean', single_select: 'select', multi_select: 'text' } as any)[t] || 'text';

const _cfCache: Record<string, any[]> = {};
const tenantKey = () => (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : '') || 'default';
export function invalidateDashboardFieldCache() { Object.keys(_cfCache).forEach(k => delete _cfCache[k]); }

/** Standard + custom fields of a source (custom fields stay dynamic: new ones appear with no code change). */
export async function loadSourceFields(supabase: any, source: any) {
  if (!source) return [];
  const ck = `${tenantKey()}:${source.key}`;
  if (_cfCache[ck]) return _cfCache[ck];
  let extra: any[] = [];
  try {
    if (source.isCustomObject) {
      const defs = await fetchCustomObjectFields(source.customObjectId, 'header');
      extra = (defs || []).map(d => F(`cf_${d.api_name}`, d.label, cfType(d.field_type), {
        column: d.storage_column ? d.storage_column : `custom_data->>${d.api_name}`, custom: true, options: d.options || [],
        currency: d.field_type === 'currency', api: d.api_name, slot: d.storage_column || null,
      }));
    } else if (source.objType && supabase) {
      const { data } = await supabase.from('app_custom_fields').select('label, api_name, field_type, options, sort_order')
        .eq('object_type', source.objType).eq('is_active', true).eq('is_published', true).order('sort_order');
      extra = (data || []).map(d => F(`cf_${d.api_name}`, d.label, cfType(d.field_type), {
        column: `custom_data->>${d.api_name}`, custom: true, options: d.options || [], currency: d.field_type === 'currency', api: d.api_name,
      }));
    }
  } catch (e) { extra = []; }
  const all = [...source.fields, ...extra];
  _cfCache[ck] = all;
  return all;
}

// ── value helpers ───────────────────────────────────────────────────────────────────────────────────
export function rawValue(row: any, field: any) {
  if (!row || !field) return undefined;
  if (field.api && !field.slot) return row.custom_data?.[field.api];
  if (field.api && field.slot) { const v = row[field.slot]; return v !== undefined && v !== null ? v : row.custom_data?.[field.api]; }
  return row[field.column];
}
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfWeek = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

/** Bucket a date value into a sortable key + label. */
export function bucketDate(v: any, bucket: string) {
  if (!v) return { key: '—', label: '—' };
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : v);
  if (isNaN(d.getTime())) return { key: '—', label: '—' };
  const mon = d.toLocaleString(undefined, { month: 'short' });
  switch (bucket) {
    case 'day': return { key: ymd(d), label: `${d.getDate()} ${mon}` };
    case 'week': { const s = startOfWeek(d); return { key: ymd(s), label: `Wk ${s.getDate()} ${s.toLocaleString(undefined, { month: 'short' })}` }; }
    case 'quarter': return { key: `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`, label: `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}` };
    case 'year': return { key: String(d.getFullYear()), label: String(d.getFullYear()) };
    default: return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: `${mon} ${String(d.getFullYear()).slice(2)}` };
  }
}

/** Resolve a period to {start,end} Dates (end inclusive). */
export function periodBounds(period: string) {
  const now = new Date(); const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const addD = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  switch (period) {
    case 'today': return { start: sod, end: eod(sod) };
    case 'this_week': { const s = startOfWeek(now); return { start: s, end: eod(addD(s, 6)) }; }
    case 'this_month': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: eod(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case 'last_month': return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: eod(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case 'this_quarter': { const q = Math.floor(now.getMonth() / 3) * 3; return { start: new Date(now.getFullYear(), q, 1), end: eod(new Date(now.getFullYear(), q + 3, 0)) }; }
    case 'this_year': return { start: new Date(now.getFullYear(), 0, 1), end: eod(new Date(now.getFullYear(), 11, 31)) };
    case 'last_7': return { start: addD(sod, -7), end: eod(sod) };
    case 'last_30': return { start: addD(sod, -30), end: eod(sod) };
    case 'last_90': return { start: addD(sod, -90), end: eod(sod) };
    case 'next_7': return { start: sod, end: eod(addD(sod, 7)) };
    case 'next_30': return { start: sod, end: eod(addD(sod, 30)) };
    case 'overdue': return { start: null, end: new Date(sod.getTime() - 1) };
    default: return { start: null, end: null };
  }
}

// ── data loading ────────────────────────────────────────────────────────────────────────────────────
export interface LoadCtx { user: any; security: any; savedSearches?: any[]; }

function fieldOf(fields: any[], key: string) { return (fields || []).find(f => f.key === key); }

/** Build the fetchServerPage options for a widget / card definition. */
function buildOpts(source: any, fields: any[], cfg: any, ctx: LoadCtx, extra: any = {}) {
  const flt = cfg.filters || {};
  const adv: any[] = [];
  // Open-only: exclude finished statuses/stages.
  if (flt.mode === 'open') (source.openKeys || []).forEach(k => { const f = fieldOf(fields, k) || { column: k }; adv.push({ column: f.column, op: 'not_in', value: TERMINAL }); });
  if (flt.mode === 'closed') { const k = (source.openKeys || [])[0]; if (k) { const f = fieldOf(fields, k) || { column: k }; adv.push({ column: f.column, op: 'in', value: TERMINAL }); } }
  if (flt.statuses?.length) { const f = fieldOf(fields, flt.statusField || source.statusKey) || { column: source.statusKey || 'status' }; adv.push({ column: f.column, op: 'in', value: flt.statuses }); }
  (flt.conds || []).forEach(c => {
    const f = fieldOf(fields, c.field); if (!f) return;
    if (c.op !== 'is_empty' && c.op !== 'is_not_empty' && c.op !== 'is_true' && c.op !== 'is_false' && (c.value === '' || c.value === undefined)) return;
    adv.push({ column: f.column, op: c.op, value: f.type === 'number' ? Number(c.value) : c.value });
  });

  const o: any = {
    table: source.table, extraEq: source.extraEq || null, security: ctx.security,
    ownerColumn: source.ownerColumn, ownerIdColumn: source.ownerIdColumn,
    statusColumn: (fieldOf(fields, source.statusKey) || { column: source.statusKey || 'status' }).column,
    searchColumns: source.searchCols || [], advFilters: adv, sortColumn: 'created_at', sortAscending: false, page: 1, pageSize: PAGE, ...extra,
  };
  if (flt.mine) { const u = ctx.user || {}; o.ownerAny = [u.id, u.auth_user_id, u.email].filter(Boolean); }

  // Saved search of that object (same filter shape the list pages save) — dashboards reuse it as-is.
  const saved = flt.savedSearchId ? (ctx.savedSearches || []).find(s => s.id === flt.savedSearchId) : null;
  if (saved?.filters) {
    const sf = saved.filters;
    if (sf.search) o.searchTerm = sf.search;
    if (sf.status && sf.status !== 'All') o.statusFilter = sf.status;
    if (sf.owner && !o.ownerAny) o.ownerFilter = sf.owner;
    const { adv: a2, lineFilters } = splitAdvFilters(sf.advFilters, k => (fieldOf(fields, k) || { column: k }).column);
    o.advFilters = [...adv, ...a2]; if (lineFilters.length) o.lineFilters = lineFilters;
    if (sf.timePeriod) { const r = timePeriodToRange(sf.timePeriod); o.dateColumn = 'created_at'; o.dateFrom = r.from; o.dateTo = r.to; }
  }
  // Widget's own period wins over the saved search's.
  if (flt.period && flt.period !== 'all') {
    const df = fieldOf(fields, flt.dateField || source.dateKey) || { column: source.dateKey || 'created_at', type: 'datetime' };
    const { start, end } = periodBounds(flt.period);
    const asDate = df.type === 'date';
    o.dateColumn = df.column;
    o.dateFrom = start ? (asDate ? ymd(start) : start.toISOString()) : null;
    o.dateTo = end ? (asDate ? ymd(end) : end.toISOString()) : null;
  }
  return o;
}

/** Rows for a widget. aggregate=true pages up to MAX_ROWS rows; otherwise a single page of `limit`. */
export async function loadRows(supabase: any, source: any, fields: any[], cfg: any, ctx: LoadCtx, { limit = 0, sortKey = '', sortAsc = false } = {} as any) {
  if (!supabase || !source) return { rows: [], total: 0, truncated: false, error: null };
  const sf = sortKey ? fieldOf(fields, sortKey) : null;
  const sortCol = sf ? sf.column : 'created_at';
  if (limit) {
    const o = buildOpts(source, fields, cfg, ctx, { pageSize: limit, sortColumn: sortCol, sortAscending: sortAsc });
    const r = await fetchServerPage(supabase, o);
    return { rows: r.data || [], total: r.totalCount || 0, truncated: (r.totalCount || 0) > (r.data || []).length, error: r.error };
  }
  let rows: any[] = []; let total = 0; let error = null;
  for (let p = 1; p <= Math.ceil(MAX_ROWS / PAGE); p++) {
    const r = await fetchServerPage(supabase, buildOpts(source, fields, cfg, ctx, { page: p, pageSize: PAGE, sortColumn: sortCol, sortAscending: sortAsc }));
    if (r.error) { error = r.error; break; }
    total = r.totalCount || 0;
    rows = rows.concat(r.data || []);
    if (rows.length >= total || !(r.data || []).length) break;
  }
  return { rows, total, truncated: total > rows.length, error };
}

// ── aggregation ─────────────────────────────────────────────────────────────────────────────────────
const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

export function measureOf(rows: any[], agg: string, field: any) {
  if (agg === 'count' || !field) return rows.length;
  const vals = rows.map(r => num(rawValue(r, field))).filter(v => v !== null) as number[];
  if (!vals.length) return 0;
  switch (agg) {
    case 'sum': return vals.reduce((a, b) => a + b, 0);
    case 'avg': return vals.reduce((a, b) => a + b, 0) / vals.length;
    case 'min': return Math.min(...vals);
    case 'max': return Math.max(...vals);
    default: return rows.length;
  }
}

export function aggregate(rows: any[], fields: any[], cfg: any, source: any) {
  const gf = fieldOf(fields, cfg.groupBy);
  const mf = cfg.agg && cfg.agg !== 'count' ? fieldOf(fields, cfg.measureField) : null;
  const groups = new Map<string, { key: string; label: string; rows: any[] }>();
  rows.forEach(r => {
    let key = '—', label = '—';
    if (gf) {
      let v = rawValue(r, gf);
      if (gf.key === source?.ownerLabelKey || gf.key === 'owner' || gf.key === 'owner_name') v = r.owner_name || r.owner || v;
      if (gf.type === 'date' || gf.type === 'datetime') ({ key, label } = bucketDate(v, cfg.bucket || 'month'));
      else if (v === null || v === undefined || v === '') { key = '—'; label = '—'; }
      else if (typeof v === 'boolean') { key = label = v ? 'Yes' : 'No'; }
      else { key = label = String(v); }
    } else { key = label = 'All'; }
    if (!groups.has(key)) groups.set(key, { key, label, rows: [] });
    groups.get(key).rows.push(r);
  });
  let out = Array.from(groups.values()).map(g => ({ key: g.key, label: g.label, value: measureOf(g.rows, cfg.agg || 'count', mf), count: g.rows.length }));
  const sort = cfg.sort || (gf && (gf.type === 'date' || gf.type === 'datetime') ? 'label_asc' : 'value_desc');
  if (sort === 'value_desc') out.sort((a, b) => b.value - a.value);
  else if (sort === 'value_asc') out.sort((a, b) => a.value - b.value);
  else out.sort((a, b) => String(a.key).localeCompare(String(b.key), undefined, { numeric: true }));
  if (cfg.topN && cfg.topN > 0 && out.length > cfg.topN) {
    const keep = out.slice(0, cfg.topN); const rest = out.slice(cfg.topN);
    if (cfg.groupOthers !== false) keep.push({ key: '__others', label: 'Others', value: cfg.agg === 'avg' || cfg.agg === 'min' || cfg.agg === 'max' ? 0 : rest.reduce((a, b) => a + b.value, 0), count: rest.reduce((a, b) => a + b.count, 0) });
    out = keep;
  }
  return out;
}

// ── persistence helpers ─────────────────────────────────────────────────────────────────────────────
export const uid = (p = 'w') => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export function emptyWidget(kind: 'chart' | 'table' | 'metric', sourceKey: string) {
  return {
    id: uid('w'), kind, title: kind === 'table' ? 'New list' : kind === 'metric' ? 'New metric' : 'New chart', source: sourceKey,
    chart: 'bar', groupBy: '', bucket: 'month', agg: 'count', measureField: '', sort: '', topN: 0,
    columns: [], limit: 8, sortKey: '', sortAsc: false, span: kind === 'table' ? 2 : 1,
    filters: { mine: false, mode: 'all', statuses: [], period: 'all', dateField: '', savedSearchId: '', conds: [] },
  };
}

/** Role-aware starter layout. `src` = keys of sources the user can see. */
export function defaultConfig({ b2c, isManager, has }: { b2c: boolean; isManager: boolean; has: (k: string) => boolean }) {
  const W = (o: any) => ({ ...emptyWidget(o.kind || 'chart', o.source), ...o, id: uid('w'), filters: { ...emptyWidget('chart', o.source).filters, ...(o.filters || {}) } });
  const tabs: any[] = [];
  if (!b2c) {
    if (has('opportunities')) tabs.push({
      id: uid('t'), label: 'Open Pipeline', icon: '💼',
      metric: W({ kind: 'metric', source: 'opportunities', title: 'Open Pipeline', agg: 'sum', measureField: 'amount', filters: { mine: !isManager, mode: 'open' } }),
      widgets: [
        W({ source: 'opportunities', title: 'Pipeline by Stage', chart: 'funnel', groupBy: 'stage', agg: 'sum', measureField: 'amount', filters: { mine: !isManager, mode: 'open' }, span: 1 }),
        W({ source: 'opportunities', title: 'Closing by Month', chart: 'bar', groupBy: 'close_date', bucket: 'month', agg: 'sum', measureField: 'amount', filters: { mine: !isManager, mode: 'open' }, span: 1 }),
        W({ source: 'opportunities', title: 'Opportunities by Owner', chart: 'hbar', groupBy: 'owner', agg: 'count', filters: { mode: 'open' }, topN: 8, span: 1 }),
        W({ kind: 'table', source: 'opportunities', title: isManager ? 'Open Opportunities' : 'My Open Opportunities', columns: ['name', 'customer', 'stage', 'amount', 'close_date'], limit: 8, sortKey: 'amount', filters: { mine: !isManager, mode: 'open' }, span: 3 }),
      ],
    });
    if (has('leads')) tabs.push({
      id: uid('t'), label: 'Open Leads', icon: '🎯',
      metric: W({ kind: 'metric', source: 'leads', title: 'Open Leads', agg: 'count', filters: { mine: !isManager, mode: 'open' } }),
      widgets: [
        W({ source: 'leads', title: 'Leads by Status', chart: 'donut', groupBy: 'status', agg: 'count', filters: { mine: !isManager }, span: 1 }),
        W({ source: 'leads', title: 'Lead Amount by Source', chart: 'bar', groupBy: 'source', agg: 'sum', measureField: 'amount', filters: { mine: !isManager }, span: 1 }),
        W({ source: 'leads', title: 'New Leads by Month', chart: 'line', groupBy: 'created_at', bucket: 'month', agg: 'count', filters: { mine: !isManager, period: 'this_year' }, span: 1 }),
        W({ kind: 'table', source: 'leads', title: isManager ? 'Open Leads' : 'My Open Leads', columns: ['name', 'customer', 'source', 'status', 'amount'], limit: 8, filters: { mine: !isManager, mode: 'open' }, span: 3 }),
      ],
    });
    if (has('activities')) tabs.push({
      id: uid('t'), label: 'My Open Tasks', icon: '✅',
      metric: W({ kind: 'metric', source: 'activities', title: 'My Open Tasks', agg: 'count', filters: { mine: true, mode: 'open' } }),
      widgets: [
        W({ kind: 'table', source: 'activities', title: 'My Overdue Tasks', columns: ['subject', 'customer', 'priority', 'due_date'], limit: 6, sortKey: 'due_date', sortAsc: true, filters: { mine: true, mode: 'open', period: 'overdue', dateField: 'due_date' }, span: 2 }),
        W({ source: 'activities', title: 'Tasks by Priority', chart: 'donut', groupBy: 'priority', agg: 'count', filters: { mine: true, mode: 'open' }, span: 1 }),
        W({ kind: 'table', source: 'activities', title: 'Tasks Due in Next 30 Days', columns: ['subject', 'customer', 'activity_type', 'due_date'], limit: 6, sortKey: 'due_date', sortAsc: true, filters: { mine: true, mode: 'open', period: 'next_30', dateField: 'due_date' }, span: 3 }),
      ],
    });
    if (has('quotations') || has('invoices')) tabs.push({
      id: uid('t'), label: 'Revenue', icon: '💰',
      metric: has('invoices')
        ? W({ kind: 'metric', source: 'invoices', title: 'Invoiced This Month', agg: 'sum', measureField: 'amount', filters: { period: 'this_month', dateField: 'created_at' } })
        : W({ kind: 'metric', source: 'quotations', title: 'Quoted This Month', agg: 'sum', measureField: 'grand_total', filters: { period: 'this_month', dateField: 'created_at' } }),
      widgets: [
        ...(has('invoices') ? [W({ source: 'invoices', title: 'Invoices by Status', chart: 'donut', groupBy: 'status', agg: 'sum', measureField: 'amount', span: 1 }), W({ source: 'invoices', title: 'Invoiced by Month', chart: 'bar', groupBy: 'created_at', bucket: 'month', agg: 'sum', measureField: 'amount', filters: { period: 'this_year', dateField: 'created_at' }, span: 1 })] : []),
        ...(has('quotations') ? [W({ source: 'quotations', title: 'Quotations by Status', chart: 'bar', groupBy: 'status', agg: 'count', span: 1 })] : []),
        ...(has('orders') ? [W({ kind: 'table', source: 'orders', title: 'Recent Orders', columns: ['name', 'customer', 'status', 'amount', 'delivery_date'], limit: 6, span: 3 })] : []),
      ],
    });
  } else {
    if (has('retailOrders')) tabs.push({
      id: uid('t'), label: 'Sales', icon: '🛍️',
      metric: W({ kind: 'metric', source: 'retailOrders', title: 'Sales This Month', agg: 'sum', measureField: 'amount', filters: { period: 'this_month', dateField: 'created_at' } }),
      widgets: [
        W({ source: 'retailOrders', title: 'Orders by Status', chart: 'donut', groupBy: 'status', agg: 'count', span: 1 }),
        W({ source: 'retailOrders', title: 'Sales by Channel', chart: 'bar', groupBy: 'channel', agg: 'sum', measureField: 'amount', span: 1 }),
        W({ source: 'retailOrders', title: 'Sales by Month', chart: 'area', groupBy: 'created_at', bucket: 'month', agg: 'sum', measureField: 'amount', filters: { period: 'this_year', dateField: 'created_at' }, span: 1 }),
        W({ kind: 'table', source: 'retailOrders', title: 'Recent Orders', columns: ['customer', 'status', 'amount', 'payment_status', 'order_date'], limit: 8, span: 3 }),
      ],
    });
    if (has('retailInvoices')) tabs.push({
      id: uid('t'), label: 'Collections', icon: '🧾',
      metric: W({ kind: 'metric', source: 'retailInvoices', title: 'Pending Payments', agg: 'sum', measureField: 'amount', filters: { mode: 'open' } }),
      widgets: [
        W({ source: 'retailInvoices', title: 'Invoices by Payment Status', chart: 'donut', groupBy: 'payment_status', agg: 'sum', measureField: 'amount', span: 1 }),
        W({ source: 'retailInvoices', title: 'Payment Methods', chart: 'bar', groupBy: 'payment_method', agg: 'count', span: 1 }),
        W({ kind: 'table', source: 'retailInvoices', title: 'Invoices Due Soon', columns: ['customer', 'status', 'amount', 'due_date'], limit: 8, sortKey: 'due_date', sortAsc: true, filters: { mode: 'open', period: 'next_30', dateField: 'due_date' }, span: 3 }),
      ],
    });
    if (has('retailCustomers')) tabs.push({
      id: uid('t'), label: 'Customers', icon: '👥',
      metric: W({ kind: 'metric', source: 'retailCustomers', title: 'New Customers (30d)', agg: 'count', filters: { period: 'last_30', dateField: 'created_at' } }),
      widgets: [
        W({ source: 'retailCustomers', title: 'Customers by Loyalty Tier', chart: 'donut', groupBy: 'loyalty_tier', agg: 'count', span: 1 }),
        W({ source: 'retailCustomers', title: 'New Customers by Month', chart: 'line', groupBy: 'created_at', bucket: 'month', agg: 'count', filters: { period: 'this_year', dateField: 'created_at' }, span: 2 }),
      ],
    });
    if (has('retailActivities')) tabs.push({
      id: uid('t'), label: 'My Tasks', icon: '✅',
      metric: W({ kind: 'metric', source: 'retailActivities', title: 'My Open Tasks', agg: 'count', filters: { mine: true, mode: 'open' } }),
      widgets: [
        W({ kind: 'table', source: 'retailActivities', title: 'My To-Dos', columns: ['subject', 'customer', 'priority', 'due_date'], limit: 8, sortKey: 'due_date', sortAsc: true, filters: { mine: true, mode: 'open' }, span: 2 }),
        W({ source: 'retailActivities', title: 'Tasks by Type', chart: 'donut', groupBy: 'activity_type', agg: 'count', filters: { mine: true, mode: 'open' }, span: 1 }),
      ],
    });
  }
  return { tabs, v: 1 };
}

/** Compact number / currency formatting for cards and axes. */
export function fmtCompact(n: number, currency = false, formatCurrency?: (n: number) => string) {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const sym = currency && formatCurrency ? formatCurrency(0).replace(/[\d.,\s]+/g, '').trim() : '';
  const s = a >= 1e7 && sym === '₹' ? `${(v / 1e7).toFixed(1)}Cr` : a >= 1e5 && sym === '₹' ? `${(v / 1e5).toFixed(1)}L`
    : a >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : a >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : (Number.isInteger(v) ? String(v) : v.toFixed(1));
  return currency ? `${sym}${s}` : s;
}
