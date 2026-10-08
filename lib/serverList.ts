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

// One advanced-filter condition -> PostgREST filter. `column` may be a jsonb path such as
// "custom_data->>api_name" (custom fields live in custom_data on every object).
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayAfterISO = (d) => { const t = new Date(d + 'T00:00:00'); t.setDate(t.getDate() + 1); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
// A picked calendar day against a timestamp column ("created_at on 8 Oct") must cover the whole day in the
// USER's timezone; against a plain date / jsonb text value it is a simple string range.
const dayBound = (column, d) => (/_at$|^datetime_/.test(String(column)) ? new Date(d + 'T00:00:00').toISOString() : d);
function applyCond(q, f) {
  if (!f || !f.column) return q;
  if (ISO_DAY.test(String(f.value ?? ''))) {
    if (f.op === 'on')    return q.gte(f.column, dayBound(f.column, f.value)).lt(f.column, dayBound(f.column, dayAfterISO(f.value)));
    if (f.op === 'after') return q.gte(f.column, dayBound(f.column, dayAfterISO(f.value)));
    if (f.op === 'before') return q.lt(f.column, dayBound(f.column, f.value));
  }
  switch (f.op) {
    case 'contains':       return q.ilike(f.column, `%${String(f.value ?? '').replace(/[%,]/g,'')}%`);
    case 'equals':         return q.eq(f.column, f.value);
    case 'not_equals':     return q.neq(f.column, f.value);
    case 'gt': case 'after':   return q.gt(f.column, f.value);
    case 'gte':            return q.gte(f.column, f.value);
    case 'lt': case 'before':  return q.lt(f.column, f.value);
    case 'lte':            return q.lte(f.column, f.value);
    case 'eq': case 'on':  return q.eq(f.column, f.value);
    case 'neq':            return q.neq(f.column, f.value);
    case 'in':             return q.in(f.column, Array.isArray(f.value) ? f.value : [f.value]);
    case 'not_in': {       const vs = (Array.isArray(f.value) ? f.value : [f.value]).map(v => '"' + String(v).replace(/"/g, '') + '"'); return vs.length ? q.not(f.column, 'in', `(${vs.join(',')})`) : q; }
    case 'is_empty':       return q.or(`${f.column}.is.null,${f.column}.eq.`);
    case 'is_not_empty':   return q.not(f.column, 'is', null);
    case 'is_true':        return q.eq(f.column, true);
    case 'is_false':       return q.eq(f.column, false);
    default:               return q;
  }
}

/**
 * Splits the UI's advFilters into header conditions and line-item filter groups.
 * cond = { field, op, value, column?, scope?: 'line', line?: { table, fk, parentColumn, extraEq? } }
 */
export function splitAdvFilters(advFilters, mapColumn) {
  const ok = (c) => c && c.field && (['is_empty','is_not_empty','is_true','is_false'].includes(c.op) || (c.value !== undefined && c.value !== ''));
  const adv = []; const groups = {};
  (advFilters || []).filter(ok).forEach(c => {
    const column = c.column || mapColumn(c.field);
    if (c.scope === 'line' && c.line?.table) {
      const k = c.line.table + '|' + c.line.fk;
      (groups[k] = groups[k] || { ...c.line, conds: [] }).conds.push({ column, op: c.op, value: c.value });
    } else adv.push({ column, op: c.op, value: c.value });
  });
  return { adv, lineFilters: Object.values(groups) };
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
    ownerAny = null,       // [id, email, …] — match owner OR owner_id against any of these (used by dashboards' "My …")
    dateColumn = 'created_at',
    dateFrom = null,
    dateTo = null,
    advFilters = [],       // [{ column, op, value }] — column already mapped to the real DB column
    lineFilters = [],      // [{ table, fk, parentColumn, extraEq?, conds:[{column,op,value}] }]
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

  if (ownerAny && ownerAny.length) {
    q = q.or(ownerAny.filter(Boolean).map(v => (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v)) ? `${ownerIdColumn}.eq.${v}` : `${ownerColumn}.eq.${v}`)).join(','));
  }

  if (dateFrom) q = q.gte(dateColumn, dateFrom);
  if (dateTo) q = q.lte(dateColumn, dateTo);

  for (const f of advFilters) q = applyCond(q, f);

  // Line-item conditions: "has at least one line where …". Resolved to the parent keys first,
  // then applied as an IN filter on the header table (tenant-scoped like everything else).
  for (const lf of lineFilters) {
    if (!lf?.table || !lf.fk || !lf.conds?.length) continue;
    let lq = tenantScope(supabase.from(lf.table).select(lf.fk));
    if (lf.extraEq) for (const [k, v] of Object.entries(lf.extraEq)) lq = lq.eq(k, v);
    for (const c of lf.conds) lq = applyCond(lq, c);
    const { data: lrows, error: lerr } = await lq.limit(5000);
    if (lerr) return { data: [], error: lerr, totalCount: 0 };
    const keys = Array.from(new Set((lrows || []).map(r => r[lf.fk]).filter(v => v !== null && v !== undefined)));
    q = q.in(lf.parentColumn || lf.fk, keys.length ? keys : ['__no_match__']);
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
