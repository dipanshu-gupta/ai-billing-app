// @ts-nocheck
import { tenantScope } from './utils';

// ─── RBAC push-down for server-side pagination ──────────────────────────────
// applyDataSecurity() (context/AppContext.tsx) filters an already-fetched
// JS array by the current user's data_scope. That's fine for the context's
// own small "load once, keep in memory" arrays, but fetchServerPage() below
// runs a fresh DB query + COUNT + range() per page — filtering AFTER that
// query still returns a totalCount and a page of rows drawn from the WHOLE
// tenant table, not the scoped subset, so a scoped user sees an inflated
// "N records" total and can have their own rows scattered across pages
// (page 1 may come back empty even though they have visible records on
// page 3). This mirrors applyDataSecurity's exact same branches as real
// PostgREST filters, applied to the query itself, so the count and the
// page both reflect only what the user is allowed to see — same decision,
// same fields (organization_id, business_unit_id, owner_id, owner,
// created_by), just expressed as SQL instead of an array filter.
//
// `security` is context's `dataSecurityScope` (useApp().dataSecurityScope),
// passed straight through by the caller — see CRMListPage.tsx/
// RetailListPage.tsx/QuotationsPage.tsx for the call-site pattern.
function applySecurityScope(q, security) {
  if (!security) return q; // no security object passed — caller opted out (e.g. genuinely tenant-wide by design)
  const { ready, isAdmin, dataScope, viewAll, viewTeam, userId, authUserId, userEmail, organizationId, businessUnitId } = security;
  // Not loaded yet: fail closed exactly like applyDataSecurity does (returns
  // [] until permissions resolve) — an impossible filter yields zero rows
  // rather than a moment of unfiltered data.
  if (!ready) return q.eq('id', '00000000-0000-0000-0000-000000000000');
  if (isAdmin || dataScope === 'all' || viewAll) return q; // no filtering, same as applyDataSecurity

  // Every id/email is guarded before being spliced into a filter string —
  // an undefined/null value embedded literally (e.g. "organization_id.eq.
  // undefined") would either throw a PostgREST 400 or, worse, silently
  // fail to match anything, so a missing value just drops that OR branch
  // instead (falls back to the "is.null" branch, same net effect as
  // applyDataSecurity's `!r.organization_id || r.organization_id === undefined`).
  const orgOr = (col) => [`${col}.is.null`, organizationId ? `${col}.eq.${organizationId}` : null].filter(Boolean).join(',');

  // Same branch ORDER as applyDataSecurity: 'org' and 'bu' are checked
  // first regardless of viewTeam, and viewTeam only matters for any other
  // scope value (falling through to the 'own' default otherwise).
  if (dataScope === 'org') {
    return q.or(orgOr('organization_id'));
  }
  if (dataScope === 'bu') {
    // Cartesian product of {org is null, org eq X} × {bu is null, bu eq Y}
    // — mirrors applyDataSecurity's independent orgMatch/buMatch booleans
    // ANDed together, expressed as SQL's and(...) groups ORed together.
    const clauses = [];
    for (const oClause of [`organization_id.is.null`, organizationId ? `organization_id.eq.${organizationId}` : null].filter(Boolean)) {
      for (const bClause of [`business_unit_id.is.null`, businessUnitId ? `business_unit_id.eq.${businessUnitId}` : null].filter(Boolean)) {
        clauses.push(`and(${oClause},${bClause})`);
      }
    }
    return q.or(clauses.join(','));
  }
  if (viewTeam) {
    return q.or(orgOr('organization_id'));
  }
  // Default 'own' scope — same OR set as applyDataSecurity: owned by this
  // user (by id, auth id, or email), created by this user's email, or has
  // no owner/created_by at all (unassigned records stay visible to all,
  // matching the client-side behavior exactly).
  const ors = [
    userId ? `owner_id.eq.${userId}` : null,
    authUserId ? `owner_id.eq.${authUserId}` : null,
    userEmail ? `owner.eq.${userEmail}` : null,
    userEmail ? `created_by.eq.${userEmail}` : null,
    'and(owner_id.is.null,owner.is.null,created_by.is.null)',
  ].filter(Boolean).join(',');
  return q.or(ors);
}

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
    extraEq = null,  // { column: value } hard filters, e.g. custom_object_id
    security = null, // useApp().dataSecurityScope — see applySecurityScope() above
  } = opts;

  if (!supabase || !table) return { data: [], error: null, totalCount: 0 };

  let q = tenantScope(supabase.from(table).select('*', { count: 'exact' }));
  if (extraEq) for (const [k, v] of Object.entries(extraEq)) q = q.eq(k, v);
  q = applySecurityScope(q, security);

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

  q = q.order(sortColumn, { ascending: sortAscending, nullsFirst: false }).order('created_at', { ascending: false });

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
