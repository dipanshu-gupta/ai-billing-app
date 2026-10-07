// @ts-nocheck
'use client';
/**
 * DynamicObjectPage - the list page every published Custom Object routes
 * through. It deliberately mirrors the standard CRM list page
 * (components/crm/CRMListPage.tsx) feature for feature: server-side search /
 * filter / sort / pagination, advanced filters on any field, saved searches
 * (default + team default), column picker with reorder and persisted
 * per-user preferences, table + board views, row menu, and the standard
 * full-screen detail panel and create modal. Records carry the same system
 * fields as any standard object (record number, name, status, owner,
 * created/updated date and user, organization, business unit, record ID).
 */
import RedwoodSkin from '@/components/shared/RedwoodSkin';
import { resolveStatusOptions } from '@/lib/statusOptions';
import { ObjectIcon } from '@/lib/lineIcons';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';
import { useAlert } from '@/components/shared/AlertProvider';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import KanbanBoard from '@/components/shared/KanbanBoard';
import CustomObjectDetailPanel from '@/components/shared/CustomObjectDetailPanel';
import CustomObjectCreateModal from '@/components/shared/CustomObjectCreateModal';
import { OPERATORS, TIME_PERIODS } from '@/components/crm/CRMListPage';
import RedwoodSavedSearchBar from '@/components/shared/RedwoodSavedSearchBar';
import { timePeriodToRange, splitAdvFilters } from '@/lib/serverList';
import { distinctValues } from '@/lib/searchCatalog';
import { useCustomLookups } from '@/components/shared/CustomObjectForm';
import { useFieldLayout } from '@/lib/useFieldLayout';
import { formatDate, formatDateTime, formatCurrency, getStatusColor } from '@/lib/utils';
import { t } from '@/lib/i18n';
import {
  fetchCustomObjectFields, fetchCustomRecordsPage, updateCustomObjectRecord, deleteCustomObjectRecord,
  buildCustomFieldMeta, flattenCustomRecord, unpackFieldValues, formatCustomDisplayNumber,
  resolveLookupLabel, CUSTOM_STATUS_OPTIONS,
} from '@/lib/customObjects';

const NON_FILTERABLE = new Set(['id', 'organization_id', 'business_unit_id']);
const TS_COLS = new Set(['created_at', 'updated_at']);
const dayAfter = (d) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); };

function StatusBadge({ status }) {
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>{status}</span>;
}

export default function DynamicObjectPage({ customObject }) {
  const {
    currentUser, hasPermission, applyDataSecurity, dataSecurityScope, permissionsLoaded, appearance, appPreferences,
    customObjects, enterpriseUsers, organizations, businessUnits, savedSearches, fetchSavedSearches,
    fetchListViewPrefs, saveListViewPrefs, pendingRecord, setPendingRecord, pendingReturnTo, setPendingReturnTo,
  } = useApp();
  const { supabase, tenant } = useTenant();
  const { showAlert, showConfirm } = useAlert();
  const lang = appearance?.language || 'en';

  const page = `custom_${customObject.api_name}`; // key for permissions, saved searches, list prefs, Page Layout Designer
  const canView = hasPermission(`${page}_view`);
  const canCreate = hasPermission(`${page}_create`);
  const canEdit = hasPermission(`${page}_edit`);
  const canDelete = hasPermission(`${page}_delete`);
  const ctx = useMemo(() => ({ supabase, tenantId: tenant?.id, currentUser, showAlert }), [supabase, tenant?.id, currentUser]);
  const layoutHook = useFieldLayout(page);

  const [headerFields, setHeaderFields] = useState([]);
  const [lineFields, setLineFields] = useState([]);
  const [fieldsReady, setFieldsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFieldsReady(false);
    Promise.all([
      fetchCustomObjectFields(customObject.id, 'header', true),
      customObject.supports_line_items ? fetchCustomObjectFields(customObject.id, 'line_item', true) : Promise.resolve([]),
    ]).then(([hf, lf]) => { if (cancelled) return; setHeaderFields(hf); setLineFields(lf); setFieldsReady(true); });
    return () => { cancelled = true; };
  }, [customObject.id]);

  // Every system field + every custom field is filterable / sortable /
  // addable as a column; Page Layout Designer labels apply.
  const fieldMeta = useMemo(() => {
    const base = buildCustomFieldMeta(headerFields);
    return base.map(m => {
      const row = layoutHook.fields.find(r => r.field_key === (m.apiName || m.key));
      return row?.custom_label ? { ...m, label: row.custom_label } : m;
    });
  }, [headerFields, layoutHook.fields]);
  const metaOf = (key) => fieldMeta.find(m => m.key === key);
  const labelOf = (key) => metaOf(key)?.label || key;

  const DEFAULT_COLUMNS = useMemo(() => {
    const customKeys = fieldMeta.filter(m => !m.system && m.col).slice(0, 3).map(m => m.key);
    return ['display_number', 'name', ...customKeys, 'owner', 'status'];
  }, [fieldMeta]);

  // ── State (mirrors CRMListPage) ──────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [timePeriod, setTimePeriod] = useState('');
  const [advFilters, setAdvFilters] = useState([]);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [initialTab, setInitialTab] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [defaultLoaded, setDefaultLoaded] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [viewMode, setViewMode] = useState('table');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [boardRows, setBoardRows] = useState([]);
  const [boardTotal, setBoardTotal] = useState(0);
  const [lookupLabels, setLookupLabels] = useState({});
  const prefsLoadedFor = useRef(null);

  useEffect(() => {
    try { setViewMode(sessionStorage.getItem(`bp_view_mode_${page}`) || 'table'); } catch (e) {}
  }, [page]);
  useEffect(() => { try { sessionStorage.setItem(`bp_view_mode_${page}`, viewMode); } catch (e) {} }, [viewMode, page]);

  // Per-user column / sort prefs, loaded once the field metadata is known.
  useEffect(() => {
    if (!fieldsReady) return;
    let cancelled = false;
    setVisibleColumns(DEFAULT_COLUMNS); setSortField(''); setSortDir('asc');
    if (fetchListViewPrefs) fetchListViewPrefs(page).then(saved => {
      if (cancelled || !saved) return;
      if (saved.columns?.length) setVisibleColumns(saved.columns);
      if (saved.sort?.field) { setSortField(saved.sort.field); setSortDir(saved.sort.direction || 'asc'); }
    });
    return () => { cancelled = true; };
  }, [page, fieldsReady]);

  // Saved searches + clean filter state when switching object.
  useEffect(() => {
    fetchSavedSearches && fetchSavedSearches(page);
    setSearch(''); setStatusFilter('All'); setTimePeriod(''); setAdvFilters([]); setOwnerFilter('');
    setSelectedRecord(null); setCurrentPage(1); setDefaultLoaded(false);
    const tm = setTimeout(() => setDefaultLoaded(true), 300);
    return () => clearTimeout(tm);
  }, [page]);

  useEffect(() => {
    if (!defaultLoaded || !savedSearches?.length) return;
    const def = savedSearches.find(s => s.object_type === page && s.is_default) || savedSearches.find(s => s.object_type === page && s.is_global_default);
    if (def?.filters) applyFilters(def.filters);
  }, [defaultLoaded]);

  // Record opened from global search / a link elsewhere.
  useEffect(() => {
    if (pendingRecord && pendingRecord.page === page && pendingRecord.record) {
      setSelectedRecord(pendingRecord.record);
      setInitialTab(pendingRecord.tab || null);
      setPendingRecord(null);
    } else if (pendingRecord && pendingRecord.page === page && pendingRecord.openCreate) {
      setCreateOpen(true); setPendingRecord(null);
    }
  }, [pendingRecord, page]);

  useEffect(() => {
    const h = (e) => { if (!e.target.closest('[data-menu-container]')) setMenuOpenId(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => { const tm = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(tm); }, [search]);
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, statusFilter, timePeriod, advFilters, ownerFilter, sortField, sortDir]);

  const applyFilters = (f) => {
    if (f.search !== undefined) setSearch(f.search || '');
    if (f.status !== undefined) setStatusFilter(f.status || 'All');
    if (f.timePeriod !== undefined) setTimePeriod(f.timePeriod || '');
    if (f.advFilters !== undefined) setAdvFilters(f.advFilters || []);
    if (f.owner !== undefined) setOwnerFilter(f.owner || '');
    if (f.sortField !== undefined) { setSortField(f.sortField || ''); setSortDir(f.sortDir || 'asc'); }
    if (f.columns?.length) persistColumns(f.columns, f.sortField ?? sortField, f.sortDir || sortDir);
  };
  const currentFilters = { search, status: statusFilter, timePeriod, advFilters, owner: ownerFilter, sortField, sortDir, columns: visibleColumns };

  // Server query shared by the table page and the board.
  const buildQuery = (overrides = {}) => {
    const { from: dateFrom, to: dateTo } = timePeriodToRange(timePeriod);
    const textCols = headerFields.filter(f => ['text', 'email', 'url'].includes(f.field_type) && /^text_\d+$/.test(f.storage_column)).map(f => f.storage_column);
    const mapped = [];
    const lineSplit = splitAdvFilters(advFilters.filter(c => c.scope === 'line'), (f) => f);
    advFilters
      .filter(c => c.scope !== 'line' && c.field && (['is_empty', 'is_not_empty', 'is_true', 'is_false'].includes(c.op) || (c.value !== undefined && c.value !== '')))
      .forEach(c => {
        const m = metaOf(c.field);
        if (!m?.col) return;
        if ((TS_COLS.has(m.col) || /^datetime_/.test(m.col)) && ['on', 'before', 'after'].includes(c.op)) {
          // timestamps: compare by calendar day, not by exact instant
          if (c.op === 'on') { mapped.push({ column: m.col, op: 'gte', value: c.value }, { column: m.col, op: 'lt', value: dayAfter(c.value) }); }
          else if (c.op === 'before') mapped.push({ column: m.col, op: 'lt', value: c.value });
          else mapped.push({ column: m.col, op: 'gte', value: dayAfter(c.value) });
          return;
        }
        mapped.push({ column: m.col, op: c.op, value: c.value });
      });
    const sortMeta = sortField ? metaOf(sortField) : null;
    return {
      searchTerm: debouncedSearch,
      searchColumns: ['name', 'record_number', ...textCols],
      statusColumn: 'status', statusFilter,
      ownerColumn: 'owner', ownerIdColumn: 'owner_id', ownerFilter,
      dateColumn: 'created_at', dateFrom, dateTo,
      advFilters: mapped, lineFilters: lineSplit.lineFilters,
      sortColumn: sortMeta?.col || 'display_number',
      sortAscending: sortMeta?.col ? sortDir === 'asc' : false,
      page: currentPage, pageSize,
      security: dataSecurityScope,
      ...overrides,
    };
  };

  useEffect(() => {
    if (!supabase || !fieldsReady) return;
    let cancelled = false;
    setLoading(true);
    fetchCustomRecordsPage(customObject.id, buildQuery()).then(({ data, error, totalCount }) => {
      if (cancelled) return;
      if (error) { console.error('[DynamicObjectPage fetch]', error.message); setRows([]); setTotal(0); }
      else {
        const secured = applyDataSecurity ? applyDataSecurity(data) : data;
        setRows(secured.map(r => flattenCustomRecord(headerFields, r)));
        setTotal(totalCount);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [supabase, customObject.id, fieldsReady, debouncedSearch, statusFilter, timePeriod, advFilters, ownerFilter, sortField, sortDir, currentPage, pageSize, tenant?.id, currentUser, permissionsLoaded, refreshTick, dataSecurityScope]);

  const BOARD_CAP = 2000;
  useEffect(() => {
    if (viewMode !== 'board' || !supabase || !fieldsReady) return;
    let cancelled = false;
    fetchCustomRecordsPage(customObject.id, buildQuery({ statusFilter: 'All', sortColumn: 'created_at', sortAscending: false, page: 1, pageSize: BOARD_CAP }))
      .then(({ data, error, totalCount }) => {
        if (cancelled) return;
        if (error) { setBoardRows([]); setBoardTotal(0); return; }
        setBoardRows((applyDataSecurity ? applyDataSecurity(data) : data).map(r => flattenCustomRecord(headerFields, r)));
        setBoardTotal(totalCount);
      });
    return () => { cancelled = true; };
  }, [viewMode, supabase, customObject.id, fieldsReady, debouncedSearch, timePeriod, advFilters, ownerFilter, tenant?.id, currentUser, permissionsLoaded, dataSecurityScope, refreshTick]);

  // Lookup cells show the linked record's name, not its id.
  useEffect(() => {
    const lookupMetas = fieldMeta.filter(m => m.field?.field_type === 'lookup' && visibleColumns.includes(m.key));
    if (!lookupMetas.length) return;
    let cancelled = false;
    (async () => {
      const next = {};
      for (const m of lookupMetas) {
        const ids = Array.from(new Set(rows.map(r => r[m.key]).filter(Boolean)));
        for (const id of ids) {
          const k = `${m.key}:${id}`;
          if (lookupLabels[k] !== undefined) continue;
          next[k] = await resolveLookupLabel(m.field, id, customObjects || []);
        }
      }
      if (!cancelled && Object.keys(next).length) setLookupLabels(p => ({ ...p, ...next }));
    })();
    return () => { cancelled = true; };
  }, [rows, visibleColumns, fieldMeta]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const activeCount = (search ? 1 : 0) + (statusFilter !== 'All' ? 1 : 0) + (timePeriod ? 1 : 0) + advFilters.filter(c => c.field).length + (ownerFilter ? 1 : 0);
  const clearFilters = () => { setSearch(''); setStatusFilter('All'); setTimePeriod(''); setAdvFilters([]); setOwnerFilter(''); };
  const filterableMeta = fieldMeta.filter(m => m.col && !NON_FILTERABLE.has(m.key) && m.key !== 'display_number');
  const lookupOpts = useCustomLookups(headerFields);
  const [lineDefs, setLineDefs] = useState([]);
  useEffect(() => {
    if (!customObject.supports_line_items) { setLineDefs([]); return; }
    fetchCustomObjectFields(customObject.id, 'line_item').then(setLineDefs);
  }, [customObject.id, customObject.supports_line_items]);
  const searchOwners = useMemo(() => (enterpriseUsers || []).map(u => ({ value: u.email, label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email })), [enterpriseUsers]);
  const searchCatalog = useMemo(() => {
    const head = filterableMeta.map(m => ({ key: m.key, label: m.label, type: m.type, opts: m.options || [], lookup: m.field?.field_type === 'lookup', group: m.system ? 'Fields' : 'Custom fields' }));
    const lineRef = { table: 'custom_object_line_items', fk: 'parent_record_id', parentColumn: 'id', extraEq: { custom_object_id: customObject.id } };
    const lines = (lineDefs || []).filter(f => f.is_active !== false).map(f => ({
      key: `line.${f.api_name}`, label: f.label, group: 'Line items', scope: 'line', line: lineRef,
      type: ({ number: 'number', currency: 'number', date: 'date', datetime: 'date', checkbox: 'boolean' })[f.field_type] || 'text',
      column: f.storage_column === 'custom_data' ? `custom_data->>${f.api_name}` : f.storage_column,
    }));
    return [...head, ...lines];
  }, [filterableMeta, lineDefs, customObject.id]);
  const addFilterRow = () => { const f = filterableMeta.find(x => x.key !== 'name') || filterableMeta[0]; if (!f) return; setAdvFilters(p => [...p, { field: f.key, type: f.type, op: OPERATORS[f.type][0].v, value: '' }]); };
  const updateFilterRow = (idx, p) => setAdvFilters(a => a.map((c, i) => i === idx ? { ...c, ...p } : c));
  const removeFilterRow = (idx) => setAdvFilters(a => a.filter((_, i) => i !== idx));
  const toggleSort = (key) => {
    if (!metaOf(key)?.sortable) return;
    if (sortField !== key) { setSortField(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortField(''); setSortDir('asc'); }
  };
  const persistColumns = (cols, sf = sortField, sd = sortDir) => { setVisibleColumns(cols); saveListViewPrefs && saveListViewPrefs(page, { columns: cols, sort: { field: sf, direction: sd } }); };
  const toggleColumn = (key) => persistColumns(visibleColumns.includes(key) ? visibleColumns.filter(c => c !== key) : [...visibleColumns, key]);
  const moveColumn = (idx, dir) => { const c = [...visibleColumns]; const j = idx + dir; if (j < 0 || j >= c.length) return; [c[idx], c[j]] = [c[j], c[idx]]; persistColumns(c); };

  const fmtCell = (r, m) => {
    const v = r[m.key];
    if (m.key === 'display_number') return formatCustomDisplayNumber(customObject, v) || r.record_number || '—';
    if (m.key === 'status') return <StatusBadge status={v} />;
    if (m.key === 'organization_id') return (organizations || []).find(o => o.id === v)?.name || '—';
    if (m.key === 'business_unit_id') return (businessUnits || []).find(b => b.id === v)?.name || '—';
    if (m.key === 'created_at' || m.key === 'updated_at') return v ? formatDate(v) : '—';
    if (m.field?.field_type === 'lookup') return v ? (lookupLabels[`${m.key}:${v}`] ?? '…') : '—';
    if (m.field?.field_type === 'checkbox') return v ? 'Yes' : 'No';
    if (m.field?.field_type === 'currency') return v != null && v !== '' ? formatCurrency(Number(v), appPreferences?.default_currency) : '—';
    if (m.field?.field_type === 'date') return v ? formatDate(v) : '—';
    if (m.field?.field_type === 'datetime') return v ? formatDateTime(v) : '—';
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    return v != null && v !== '' ? String(v) : '—';
  };

  const handleStatusChange = async (record, newStatus) => {
    // Full current values go back with the status so nothing else is
    // overwritten; line items are left untouched (null).
    const vals = { ...unpackFieldValues(headerFields, record), __status: newStatus };
    const ok = await updateCustomObjectRecord(ctx, customObject, record.id, headerFields, vals, null, lineFields);
    if (ok) setRefreshTick(x => x + 1);
  };
  const handleDelete = async (record) => {
    const ok = await showConfirm(`Delete "${record.name || record.record_number}"? This cannot be undone.`, { variant: 'danger', confirmLabel: 'Delete', title: 'Delete Record' });
    if (!ok) return;
    await deleteCustomObjectRecord(ctx, record.id);
    setRefreshTick(x => x + 1);
  };

  const closeDetail = () => {
    setSelectedRecord(null); setInitialTab(null);
    if (pendingReturnTo) {
      const rt = pendingReturnTo; setPendingReturnTo(null);
      window.dispatchEvent(new CustomEvent('open-crm-record', { detail: rt }));
    }
  };

  if (!canView) {
    return <div className="p-8 text-center text-gray-400 text-sm">You don't have permission to view {customObject.plural_label}.</div>;
  }

  const statusOptions = Array.from(new Set([...resolveStatusOptions(page, CUSTOM_STATUS_OPTIONS), ...rows.map(r => r.status).filter(Boolean)]));
  const pageLabel = customObject.plural_label;

  return (
    <div className="rw-list space-y-4">
      <RedwoodSkin />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]"><span className="mr-2 inline-flex align-middle"><ObjectIcon icon={customObject.icon} className="w-7 h-7"/></span>{customObject.plural_label}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{loading ? 'Loading…' : `${total.toLocaleString()} record${total !== 1 ? 's' : ''}`}</p>
        </div>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-[#0F172A] flex items-center gap-1 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50">
              ✕ Clear <span className="bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{activeCount}</span>
            </button>
          )}
          {canCreate && (
            <button onClick={() => setCreateOpen(true)} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90 transition-all">
              + Create {customObject.singular_label}
            </button>
          )}
        </div>
      </div>

      <RedwoodSavedSearchBar page={page} filters={currentFilters} onApply={applyFilters} onClear={clearFilters} labelOf={labelOf}
        fields={searchCatalog} statusOptions={statusOptions} owners={searchOwners}
        valuesOf={(f,q)=>{
          if (f.lookup) { const ql=String(q||'').toLowerCase(); return Promise.resolve(((lookupOpts[f.key]||[]).filter(o=>!ql||String(o.label).toLowerCase().includes(ql))).slice(0,50).map(o=>({value:o.id,label:o.label}))); }
          if (f.scope==='line') return distinctValues(supabase,{ table:'custom_object_line_items', column:f.column, q, extraEq:{ custom_object_id: customObject.id } });
          const m = metaOf(f.key); const col = m?.col; if (!col) return Promise.resolve([]);
          return distinctValues(supabase,{ table:'custom_object_records', column: col==='custom_data' ? `custom_data->>${m.apiName||f.key}` : col, q, extraEq:{ custom_object_id: customObject.id } });
        }} />

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-blue-50">
          <div className="text-xs text-blue-600 font-medium">{activeCount > 0 ? `${activeCount} filter${activeCount > 1 ? 's' : ''} active` : ''}</div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setColumnsOpen(!columnsOpen)} className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all ${columnsOpen ? 'bg-[#0F172A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                ⚙️ {t(lang, 'columns')} <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${columnsOpen ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>{visibleColumns.length}</span>
              </button>
              {columnsOpen && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-[24px] shadow-2xl border border-blue-100 z-50 overflow-hidden" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3 flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm">Customize Columns</h3>
                    <button onClick={() => setColumnsOpen(false)} className="text-white/70 hover:text-white">✕</button>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-400 px-2 pb-2">Shown, in order — use ↑↓ to reorder.</p>
                    {visibleColumns.map((key, idx) => {
                      const m = metaOf(key);
                      if (!m) return null;
                      return (
                        <div key={key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 rounded-xl">
                          <span className="flex-1 text-sm text-[#0F172A]">{m.label}</span>
                          <button onClick={() => moveColumn(idx, -1)} disabled={idx === 0} className="w-6 h-6 rounded text-gray-400 hover:text-[#0F172A] disabled:opacity-20 text-xs">▲</button>
                          <button onClick={() => moveColumn(idx, 1)} disabled={idx === visibleColumns.length - 1} className="w-6 h-6 rounded text-gray-400 hover:text-[#0F172A] disabled:opacity-20 text-xs">▼</button>
                          <button onClick={() => toggleColumn(key)} className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-xs font-bold flex items-center justify-center">✕</button>
                        </div>
                      );
                    })}
                    <div className="border-t border-gray-100 mt-2 pt-2">
                      <p className="text-xs text-gray-400 px-2 pb-1">Add a column</p>
                      {fieldMeta.filter(f => !visibleColumns.includes(f.key)).map(f => (
                        <button key={f.key} onClick={() => toggleColumn(f.key)} className="w-full text-left px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-xl">+ {f.label}</button>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 mt-2 pt-2 px-2">
                      <button onClick={() => persistColumns(DEFAULT_COLUMNS)} className="text-xs text-gray-400 hover:text-[#0F172A]">Reset to default</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center bg-gray-100 rounded-xl p-1">
              <button onClick={() => setViewMode('table')} title="Table view" className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-[#0F172A]' : 'text-gray-500 hover:text-gray-700'}`}>☰ Table</button>
              <button onClick={() => setViewMode('board')} title="Board view" className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'board' ? 'bg-white shadow-sm text-[#0F172A]' : 'text-gray-500 hover:text-gray-700'}`}>🗂️ Board</button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'board' ? (
        <div>
          {boardTotal > BOARD_CAP && (
            <p className="text-xs text-amber-600 font-semibold mb-2">Showing the {BOARD_CAP.toLocaleString()} most recent of {boardTotal.toLocaleString()} matching records — narrow with search or filters to see others on the board.</p>
          )}
          <KanbanBoard
            records={boardRows}
            statusOptions={statusOptions}
            getStatus={r => r.status}
            getId={r => r.id}
            onStatusChange={canEdit ? handleStatusChange : undefined}
            onCardClick={setSelectedRecord}
            renderCard={r => (
              <div>
                <div className="font-bold text-sm text-[#0F172A] mb-1.5 truncate">{r.name || r.record_number || '—'}</div>
                <div className="text-xs text-gray-500 flex items-center justify-between gap-2 py-0.5">
                  <span className="text-gray-400 flex-shrink-0">Record</span>
                  <span className="truncate text-right text-gray-700">{formatCustomDisplayNumber(customObject, r.display_number) || r.record_number}</span>
                </div>
                {r.owner_name || r.owner ? (
                  <div className="text-xs text-gray-500 flex items-center justify-between gap-2 py-0.5">
                    <span className="text-gray-400 flex-shrink-0">Owner</span>
                    <span className="truncate text-right text-gray-700">{r.owner_name || r.owner}</span>
                  </div>
                ) : null}
              </div>
            )}
          />
        </div>
      ) : (
        <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-[#0F172A] to-blue-900 text-white">
                <tr>
                  {visibleColumns.map(key => {
                    const m = metaOf(key);
                    if (!m) return null;
                    return (
                      <th key={key} onClick={() => toggleSort(key)} className={`px-5 py-3.5 text-left text-sm font-semibold ${m.sortable ? 'cursor-pointer hover:bg-white/10' : ''} select-none whitespace-nowrap`}>
                        {m.label} {sortField === key && (sortDir === 'asc' ? '▲' : '▼')}
                      </th>
                    );
                  })}
                  <th className="px-5 py-3.5 text-center text-sm font-semibold w-28">{t(lang, 'actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr><td colSpan={visibleColumns.length + 1} className="px-5 py-20 text-center"><LoadingSpinner size={44} label="Loading records..." /></td></tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 1} className="px-5 py-16 text-center">
                      <div className="text-5xl mb-3">🔍</div>
                      <div className="font-bold text-[#0F172A] text-lg">{activeCount > 0 ? t(lang, 'noRecordsFound') : `No ${pageLabel.toLowerCase()} yet`}</div>
                      <div className="text-gray-400 text-sm mt-1">{activeCount > 0 ? t(lang, 'tryAdjustingFilters') : `Create your first ${customObject.singular_label.toLowerCase()}.`}</div>
                      {activeCount > 0 && <button onClick={clearFilters} className="mt-3 text-blue-600 text-sm font-semibold hover:underline">{t(lang, 'clearFilters')}</button>}
                    </td>
                  </tr>
                ) : rows.map(record => {
                  const ownerUser = (enterpriseUsers || []).find(u => u.email === record.owner || u.id === record.owner_id);
                  return (
                    <tr key={record.id} className="border-t border-blue-50 hover:bg-blue-50/40 transition-all">
                      {visibleColumns.map(key => {
                        const m = metaOf(key);
                        if (!m) return null;
                        if (key === 'display_number') return (
                          <td key={key} className="px-5 py-3.5">
                            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">{fmtCell(record, m)}</span>
                          </td>
                        );
                        if (key === 'name') return (
                          <td key={key} className="px-5 py-3.5">
                            <button onClick={() => setSelectedRecord(record)} className="font-semibold text-[#0F172A] hover:text-blue-700 hover:underline text-sm text-left">{record.name || record.record_number || '—'}</button>
                          </td>
                        );
                        if (key === 'owner') return (
                          <td key={key} className="px-5 py-3.5">
                            {ownerUser
                              ? <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{ownerUser.first_name?.charAt(0)}{ownerUser.last_name?.charAt(0)}</div>
                                  <span className="text-sm text-[#0F172A] font-medium">{ownerUser.first_name} {ownerUser.last_name}</span>
                                </div>
                              : record.owner ? <span className="text-sm text-gray-600">{record.owner}</span> : <span className="text-gray-300 text-sm">—</span>}
                          </td>
                        );
                        return <td key={key} className={`px-5 py-3.5 text-sm text-gray-600 ${key === 'id' ? 'font-mono text-xs' : ''}`}>{fmtCell(record, m)}</td>;
                      })}
                      <td className="px-5 py-3.5">
                        <div className="relative flex justify-center" data-menu-container>
                          <button onClick={() => setMenuOpenId(menuOpenId === record.id ? null : record.id)} className="w-9 h-9 rounded-full bg-[#0F172A] text-white hover:bg-blue-800 flex items-center justify-center text-lg font-bold shadow transition-all">⋮</button>
                          {menuOpenId === record.id && (
                            <div className="absolute right-0 top-10 bg-[#0F172A] border border-blue-800 shadow-2xl rounded-2xl p-2 z-[999] min-w-[200px]">
                              <button onClick={() => { setSelectedRecord(record); setMenuOpenId(null); }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">Open Details</button>
                              {canDelete && <button onClick={() => { setMenuOpenId(null); handleDelete(record); }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-red-700 text-red-200">🗑 Delete</button>}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div className="px-6 py-3 border-t border-blue-50 bg-white flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  Showing <strong className="text-[#0F172A]">{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, total)}</strong> of <strong className="text-[#0F172A]">{total}</strong> {pageLabel.toLowerCase()}
                </span>
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="border border-blue-200 rounded-lg px-2 py-1 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                  {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} per page</option>)}
                </select>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(1)} disabled={safePage === 1} className="px-2 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-30">«</button>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-3 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-30">‹ Prev</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pg = Math.max(1, Math.min(totalPages - 4, safePage - 2)) + i;
                    return <button key={pg} onClick={() => setCurrentPage(pg)} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${pg === safePage ? 'bg-[#0F172A] text-white' : 'text-gray-500 hover:bg-blue-50'}`}>{pg}</button>;
                  })}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-3 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-30">Next ›</button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages} className="px-2 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-30">»</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectedRecord && (
        <CustomObjectDetailPanel
          customObject={customObject} headerFields={headerFields} lineFields={lineFields}
          record={selectedRecord} initialTab={initialTab}
          onSaved={() => setRefreshTick(x => x + 1)}
          onClose={closeDetail}
        />
      )}
      <CustomObjectCreateModal
        customObject={customObject} headerFields={headerFields} lineFields={lineFields}
        open={createOpen} onClose={() => setCreateOpen(false)}
        onCreated={(rec) => { setCurrentPage(1); setRefreshTick(x => x + 1); if (rec) setSelectedRecord(rec); }}
      />
    </div>
  );
}
