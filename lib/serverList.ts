// @ts-nocheck
import { tenantScope } from './utils';

// ─── Server-side list query ─────────────────────────────────────────────────
// Replaces the old pattern of loading up to LIST_FETCH_LIMIT rows into
// browser memory once, then filtering/sorting/paginating that fixed
// snapshot in JavaScript. That pattern silently hides any record beyond
// the load cap from search, filters, and sort — invisible, not just
// slower, once a tenant has more rows than the cap. This function instead
// builds a real database query for the CURRENT search/filter/sort/page
// state and executes it fresh every time, so results are always correct
// regardless of how many total records exist — the same behavior at 500
// rows or 5 lakh rows.
//
// All column names passed in (searchColumns, statusColumn, ownerColumn,
// dateColumn, sortColumn, and each advFilter's column) must be the ACTUAL
// database column name, not a JS-side camelCase alias — the caller is
// responsible for that mapping, since it differs per object.
export async function fetchServerPage(supabase, opts) {
  const {
    table,
    searchTerm = '',
    searchColumns = [],
    statusColumn = 'status',
    statusFilter = 'All',
    ownerColumn = 'owner',
    ownerIdColumn = 'owner_id',
    ownerFilter = '',
    dateColumn = 'created_at',
    dateFrom = null,
    dateTo = null,
    advFilters = [],       // [{ column, op, value }] — column already mapped to the real DB column
    sortColumn = 'created_at',
    sortAscending = false,
    page = 1,
    pageSize = 25,
  } = opts;

  if (!supabase || !table) return { data: [], error: null, totalCount: 0 };

  let q = tenantScope(supabase.from(table).select('*', { count: 'exact' }));

  if (searchTerm && searchTerm.trim() && searchColumns.length) {
    const term = searchTerm.trim().replace(/[%,]/g, ''); // strip characters that would break the ilike/or syntax
    if (term) {
      q = q.or(searchColumns.map(c => `${c}.ilike.%${term}%`).join(','));
    }
  }

  if (statusFilter && statusFilter !== 'All') {
    q = q.eq(statusColumn, statusFilter);
  }

  if (ownerFilter) {
    q = q.or(`${ownerColumn}.eq.${ownerFilter},${ownerIdColumn}.eq.${ownerFilter}`);
  }

  if (dateFrom) q = q.gte(dateColumn, dateFrom);
  if (dateTo) q = q.lte(dateColumn, dateTo);

  for (const f of advFilters) {
    if (!f.column) continue;
    switch (f.op) {
      case 'contains':       q = q.ilike(f.column, `%${String(f.value ?? '').replace(/[%,]/g,'')}%`); break;
      case 'equals':         q = q.eq(f.column, f.value); break;
      case 'not_equals':     q = q.neq(f.column, f.value); break;
      case 'gt':              q = q.gt(f.column, f.value); break;
      case 'gte':             q = q.gte(f.column, f.value); break;
      case 'lt':              q = q.lt(f.column, f.value); break;
      case 'lte':             q = q.lte(f.column, f.value); break;
      case 'on':              q = q.eq(f.column, f.value); break;
      case 'before':          q = q.lt(f.column, f.value); break;
      case 'after':           q = q.gt(f.column, f.value); break;
      case 'is_empty':       q = q.or(`${f.column}.is.null,${f.column}.eq.`); break;
      case 'is_not_empty':   q = q.not(f.column, 'is', null); break;
      case 'is_true':        q = q.eq(f.column, true); break;
      case 'is_false':       q = q.eq(f.column, false); break;
      default: break;
    }
  }

  q = q.order(sortColumn, { ascending: sortAscending, nullsFirst: false });

  const from = Math.max(0, (page - 1) * pageSize);
  q = q.range(from, from + pageSize - 1);

  const { data, error, count } = await q;
  return { data: data || [], error, totalCount: count || 0 };
}

// Converts the existing timePeriod string values (exactly matching
// CRMListPage's applyTimePeriod — verified against that implementation
// directly, not guessed) into a { from, to } ISO range, so the same period
// filter that used to run client-side can become a server-side gte/lte.
export function timePeriodToRange(period) {
  if (!period) return { from: null, to: null };
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start, end;
  switch (period) {
    case 'today':      start = sod; break;
    case 'yesterday':  start = new Date(sod.getTime() - 86400000); end = sod; break;
    case 'last_7':     start = new Date(now.getTime() - 7  * 86400000); break;
    case 'last_30':    start = new Date(now.getTime() - 30 * 86400000); break;
    case 'last_90':    start = new Date(now.getTime() - 90 * 86400000); break;
    case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'last_month': start = new Date(now.getFullYear(), now.getMonth()-1, 1); end = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'this_year':  start = new Date(now.getFullYear(), 0, 1); break;
    default: return { from: null, to: null };
  }
  return { from: start ? start.toISOString() : null, to: end ? end.toISOString() : null };
}
