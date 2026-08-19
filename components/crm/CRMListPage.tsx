// @ts-nocheck
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { getPageLabel, getStatusOptions, getStatusColor, formatCurrency, formatDate, formatDisplayNumber, PAGE_DISPLAY_PREFIX, getObjectFields } from '@/lib/utils';
import RecordDetailPanel from '@/components/crm/RecordDetailPanel';
import CreateRecordModal from '@/components/crm/CreateRecordModal';
import CPQRecordDetail from '@/components/crm/CPQRecordDetail';
import { useAlert } from '@/components/shared/AlertProvider';

const FIELD_LABELS = {
  name:'Name', customer:'Customer', contact:'Contact', owner:'Owner', status:'Status',
  amount:'Amount', price:'Price', cost:'Cost', stage:'Stage', source:'Source',
  industry:'Industry', phone:'Phone', email:'Email', website:'Website', gstNumber:'GST Number',
  billingAddress:'Billing Address', shippingAddress:'Shipping Address', city:'City', state:'State',
  postalCode:'Postal Code', country:'Country', description:'Description', designation:'Designation',
  department:'Department', mobile:'Mobile', isPrimary:'Primary Contact', linkedIn:'LinkedIn',
  productFamily:'Product Family', category:'Category', sku:'SKU', unit:'Unit', taxRate:'Tax Rate (%)',
  stock_quantity:'Stock on Hand', reorder_level:'Reorder Level', track_inventory:'Inventory Tracking',
  expectedCloseDate:'Expected Close Date', closeDate:'Close Date', probability:'Probability (%)',
  campaign:'Campaign', currency:'Currency', paymentTerms:'Payment Terms', deliveryDate:'Delivery Date',
  dueDate:'Due Date', activityType:'Activity Type', activityDate:'Activity Date', priority:'Priority',
  notes:'Notes', created_at:'Created Date', updated_at:'Updated Date',
};
const fieldLabel = (k) => FIELD_LABELS[k] || k.replace(/([A-Z])/g,' $1').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase()).trim();

// Every field on the object is filterable/sortable/addable-as-a-column —
// derived from getObjectFields() (the same registry the detail-panel forms
// use), plus id/created_at which every list needs but detail forms don't.
const DATE_FIELDS   = new Set(['created_at','updated_at','closeDate','expectedCloseDate','dueDate','deliveryDate','activityDate']);
const NUMBER_FIELDS = new Set(['amount','price','cost','probability','stock_quantity','reorder_level','taxRate']);
const BOOL_FIELDS   = new Set(['isPrimary','track_inventory']);
const fieldType = (page, k) => k==='status' ? 'select' : DATE_FIELDS.has(k) ? 'date' : NUMBER_FIELDS.has(k) ? 'number' : BOOL_FIELDS.has(k) ? 'boolean' : 'text';
const getFieldMeta = (page) => {
  const keys = Array.from(new Set(['id', ...getObjectFields(page), 'created_at']));
  return keys.map(k => ({ key:k, label: k==='id' ? 'ID' : fieldLabel(k), type: fieldType(page,k) }));
};

const OPERATORS = {
  text:    [{v:'contains',l:'contains'},{v:'equals',l:'is exactly'},{v:'not_equals',l:'is not'},{v:'is_empty',l:'is empty'},{v:'is_not_empty',l:'is not empty'}],
  number:  [{v:'eq',l:'='},{v:'neq',l:'≠'},{v:'gt',l:'>'},{v:'gte',l:'≥'},{v:'lt',l:'<'},{v:'lte',l:'≤'},{v:'is_empty',l:'is empty'}],
  date:    [{v:'on',l:'on'},{v:'before',l:'before'},{v:'after',l:'after'},{v:'is_empty',l:'is empty'}],
  select:  [{v:'equals',l:'is'},{v:'not_equals',l:'is not'}],
  boolean: [{v:'is_true',l:'is true'},{v:'is_false',l:'is false'}],
};
// Human-readable operator text for any type — used when describing a saved
// search in plain English instead of showing raw operator codes like 'gte'.
const operatorLabel = (op) => {
  for (const list of Object.values(OPERATORS)) {
    const found = (list as any[]).find(o => o.v === op);
    if (found) return found.l;
  }
  return op;
};

const matchesCondition = (record, cond) => {
  const raw = record[cond.field];
  switch (cond.type) {
    case 'number': {
      const n = Number(raw); const v = Number(cond.value);
      if (cond.op==='is_empty') return raw===''||raw==null;
      if (Number.isNaN(n)) return false;
      if (cond.op==='eq') return n===v; if (cond.op==='neq') return n!==v;
      if (cond.op==='gt') return n>v;   if (cond.op==='gte') return n>=v;
      if (cond.op==='lt') return n<v;   if (cond.op==='lte') return n<=v;
      return true;
    }
    case 'date': {
      if (cond.op==='is_empty') return !raw;
      if (!raw || !cond.value) return false;
      const d = new Date(raw).setHours(0,0,0,0); const v = new Date(cond.value).setHours(0,0,0,0);
      if (cond.op==='on') return d===v; if (cond.op==='before') return d<v; if (cond.op==='after') return d>v;
      return true;
    }
    case 'boolean': {
      const b = !!raw;
      return cond.op==='is_true' ? b : !b;
    }
    default: {
      const s = String(raw??'').toLowerCase(); const v = String(cond.value??'').toLowerCase();
      if (cond.op==='is_empty') return s==='';
      if (cond.op==='is_not_empty') return s!=='';
      if (cond.op==='equals') return s===v;
      if (cond.op==='not_equals') return s!==v;
      return s.includes(v); // contains (default)
    }
  }
};

const TIME_PERIODS = [
  { v:'',           l:'All Time' },
  { v:'today',      l:'Today' },
  { v:'yesterday',  l:'Yesterday' },
  { v:'last_7',     l:'Last 7 Days' },
  { v:'last_30',    l:'Last 30 Days' },
  { v:'last_90',    l:'Last 90 Days' },
  { v:'this_month', l:'This Month' },
  { v:'last_month', l:'Last Month' },
  { v:'this_year',  l:'This Year' },
];

const applyTimePeriod = (records, period) => {
  if (!period) return records;
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start, end;
  switch (period) {
    case 'today':      start = sod; break;
    case 'yesterday':  start = new Date(sod - 86400000); end = sod; break;
    case 'last_7':     start = new Date(now - 7  * 86400000); break;
    case 'last_30':    start = new Date(now - 30 * 86400000); break;
    case 'last_90':    start = new Date(now - 90 * 86400000); break;
    case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'last_month': start = new Date(now.getFullYear(), now.getMonth()-1, 1); end = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'this_year':  start = new Date(now.getFullYear(), 0, 1); break;
    default: return records;
  }
  return records.filter(r => {
    const d = new Date(r.created_at);
    if (start && d < start) return false;
    if (end   && d >= end)  return false;
    return true;
  });
};

function StatusBadge({ status }) {
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>{status}</span>;
}

function SavedSearchPanel({ page, currentFilters, onApply, onClose }) {
  const { currentUser, savedSearches, fetchSavedSearches, createSavedSearch, updateSavedSearch, deleteSavedSearch, setDefaultSavedSearch,
    appPreferences, createOrderFromOpportunity, fetchOrders, pendingRecord, setPendingRecord,
  } = useApp();
  const { showAlert, showConfirm } = useAlert();
  const [saveName,   setSaveName]   = useState('');
  const [saveDef,    setSaveDef]    = useState(false);
  const [saveGlobal, setSaveGlobal] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [filterText, setFilterText] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal,  setRenameVal]  = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  useEffect(() => { fetchSavedSearches(page); }, [page]);

  const describe = (f) => {
    const parts = [];
    if (f.search)       parts.push(`Search: "${f.search}"`);
    if (f.status && f.status !== 'All') parts.push(`Status: ${f.status}`);
    if (f.timePeriod)   parts.push(TIME_PERIODS.find(t=>t.v===f.timePeriod)?.l || f.timePeriod);
    (f.advFilters||[]).forEach(c => { if (c.field && (c.value || c.op==='is_empty' || c.op==='is_not_empty' || c.op==='is_true' || c.op==='is_false')) parts.push(`${fieldLabel(c.field)} ${operatorLabel(c.op)} ${c.value||''}`.trim()); });
    if (f.owner)        parts.push(`Owner: ${f.owner}`);
    if (f.sortField)    parts.push(`Sorted by ${fieldLabel(f.sortField)} (${f.sortDir==='desc'?'descending':'ascending'})`);
    return parts.length ? parts.join(' · ') : 'All records, no filters';
  };

  // A search "matches" the currently active filters if applying it would be
  // a no-op — used to show a clear "Currently Applied" badge so users can
  // tell at a glance which saved view (if any) they're looking at.
  const isCurrentlyApplied = (s) => JSON.stringify(s.filters||{}) === JSON.stringify(currentFilters);

  const allForPage = savedSearches.filter(s => s.object_type === page);
  const q = filterText.trim().toLowerCase();
  const matchesQuery = (s) => !q || s.name.toLowerCase().includes(q) || describe(s.filters||{}).toLowerCase().includes(q);
  const mySearches     = allForPage.filter(s => s.created_by === currentUser?.email && matchesQuery(s));
  const globalSearches = allForPage.filter(s => s.is_global_default && s.created_by !== currentUser?.email && matchesQuery(s));

  const startRename = (s) => { setRenamingId(s.id); setRenameVal(s.name); };
  const confirmRename = async (s) => {
    if (renameVal.trim() && renameVal.trim() !== s.name) await updateSavedSearch(s.id, { name: renameVal.trim() });
    setRenamingId(null);
  };
  const updateToCurrentFilters = async (s) => {
    const ok = await showConfirm(`Update "${s.name}" to match your current filters? This replaces what it currently searches for.`, { title:'Update Saved Search', variant:'warning', confirmLabel:'Update' });
    if (ok) await updateSavedSearch(s.id, { filters: currentFilters });
  };

  const SearchCard = ({ s }) => {
    const applied = isCurrentlyApplied(s);
    const isRenaming = renamingId === s.id;
    return (
      <div className={`border rounded-2xl p-4 transition-all ${applied ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-blue-100 hover:border-blue-300'}`}>
        <div className="flex items-center gap-2 mb-1">
          {isRenaming ? (
            <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') confirmRename(s); if(e.key==='Escape') setRenamingId(null); }}
              onBlur={()=>confirmRename(s)}
              className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-400"/>
          ) : (
            <button onClick={()=>startRename(s)} title="Click to rename" className="font-semibold text-[#0F172A] hover:text-blue-700 text-left">
              {s.name}
            </button>
          )}
          {s.is_global_default && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full flex-shrink-0">🌐 Team Default</span>}
          {s.is_default && !s.is_global_default && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full flex-shrink-0">⭐ My Default</span>}
          {applied && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full flex-shrink-0">✓ Applied</span>}
        </div>
        <div className="text-xs text-gray-400 mb-3">{describe(s.filters || {})}</div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=>{onApply(s.filters||{});onClose();}} disabled={applied}
            className="flex-1 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-2 rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-default">
            {applied ? 'Currently Applied' : 'Apply'}
          </button>
          {!applied && <button onClick={()=>updateToCurrentFilters(s)} title="Update this search to match your current filters" className="bg-amber-100 text-amber-700 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-amber-200">🔄</button>}
          {!s.is_default && <button onClick={()=>setDefaultSavedSearch(s.id,s.is_global_default)} title="Set as default" className="bg-blue-100 text-blue-700 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-blue-200">⭐</button>}
          <button onClick={()=>startRename(s)} title="Rename" className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-200">✎</button>
          <button onClick={()=>deleteSavedSearch(s.id, s.name)} title="Delete" className="bg-red-100 text-red-500 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-red-200">🗑</button>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute right-0 top-14 w-96 bg-white rounded-[28px] shadow-2xl border border-blue-100 z-50 overflow-hidden" style={{maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-4 flex items-center justify-between flex-shrink-0">
        <h3 className="text-white font-bold">🔖 Saved Searches</h3>
        <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
      </div>

      {allForPage.length >= 5 && (
        <div className="px-4 pt-3 flex-shrink-0">
          <input value={filterText} onChange={e=>setFilterText(e.target.value)} placeholder="Filter your saved searches..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-400"/>
        </div>
      )}

      <div className="p-4 space-y-4 overflow-y-auto">
        <div className="bg-blue-50 rounded-2xl overflow-hidden">
          <button onClick={()=>setShowSaveForm(!showSaveForm)} className="w-full flex items-center justify-between px-4 py-3 text-left">
            <span className="font-bold text-[#0F172A] text-sm">+ Save Current Filters</span>
            <span className="text-blue-600 text-xs">{showSaveForm ? 'Hide ▲' : 'Show ▼'}</span>
          </button>
          {showSaveForm && (
            <div className="px-4 pb-4 space-y-3">
              <input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="Name this search..." className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-400"/>
              <div className="text-xs text-gray-500 bg-white rounded-xl px-3 py-2 border border-blue-100">{describe(currentFilters)}</div>
              <label className="flex items-center gap-2 text-sm text-[#0F172A] cursor-pointer">
                <input type="checkbox" checked={saveDef} onChange={e=>setSaveDef(e.target.checked)} className="w-4 h-4 accent-blue-600"/>
                Set as my default
              </label>
              <label className="flex items-center gap-2 text-sm text-[#0F172A] cursor-pointer">
                <input type="checkbox" checked={saveGlobal} onChange={e=>setSaveGlobal(e.target.checked)} className="w-4 h-4 accent-purple-600"/>
                Make this the team default for everyone
              </label>
              <button onClick={async()=>{if(!saveName.trim()){showAlert('Enter a name.', { variant:'warning' });return;}setSaving(true);const r=await createSavedSearch({name:saveName,object_type:page,filters:currentFilters,is_default:saveDef,is_global_default:saveGlobal});setSaving(false);if(r){setSaveName('');setSaveDef(false);setSaveGlobal(false);setShowSaveForm(false);}}} disabled={saving} className="w-full bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Search'}
              </button>
            </div>
          )}
        </div>
        {globalSearches.length > 0 && (
          <div>
            <h4 className="font-bold text-gray-500 text-xs uppercase tracking-wider mb-2">Team Defaults</h4>
            <div className="space-y-2">{globalSearches.map(s=><SearchCard key={s.id} s={s}/>)}</div>
          </div>
        )}
        <div>
          <h4 className="font-bold text-gray-500 text-xs uppercase tracking-wider mb-2">My Searches ({mySearches.length})</h4>
          {mySearches.length === 0
            ? <div className="text-gray-400 text-sm text-center py-6">
                {q ? 'No saved searches match your filter.' : 'No saved searches yet — set some filters above and save them for one-click access next time.'}
              </div>
            : <div className="space-y-2">{mySearches.map(s=><SearchCard key={s.id} s={s}/>)}</div>
          }
        </div>
      </div>
    </div>
  );
}

export default function CRMListPage({ page }) {
  const {
    customers, products, leads, opportunities, orders, invoices, contacts, activities,
    enterpriseUsers, savedSearches, fetchSavedSearches,
    convertLeadToOpportunity, createOrderFromOpportunity, createInvoiceFromOrder,
    createQuotationFromOpportunity, fetchQuotations,
    currentUserPermissions, permissionsLoaded, appPreferences, hasPermission,
    fetchOrders, pendingReturnTo, setPendingReturnTo, pendingRecord, setPendingRecord,
    fetchListCount, listViewPrefs, fetchListViewPrefs, saveListViewPrefs,
  } = useApp();
  const { showAlert, showConfirm } = useAlert();

  const [successDialog, setSuccessDialog] = useState(null); // { title, message }

  // RBAC: map page to permission codes
  const PAGE_PERMS = {
    customers:'customers_view', leads:'leads_view', opportunities:'opportunities_view',
    contacts:'contacts_view', activities:'activities_view', products:'products_view',
    orders:'orders_view', invoices:'invoices_view',
  };
  const PAGE_EDIT_PERMS = {
    customers:'customers_edit', leads:'leads_edit', opportunities:'opportunities_edit',
    contacts:'contacts_edit', activities:'activities_edit', products:'products_edit',
    orders:'orders_edit', invoices:'invoices_edit',
  };
  const PAGE_CREATE_PERMS = {
    customers:'customers_create', leads:'leads_create', opportunities:'opportunities_create',
    contacts:'contacts_create', activities:'activities_create', products:'products_create',
    orders:'orders_create', invoices:'invoices_create',
  };
  const PAGE_DELETE_PERMS = {
    customers:'customers_delete', leads:'leads_delete', opportunities:'opportunities_delete',
    contacts:'contacts_delete', activities:'activities_delete', products:'products_delete',
    orders:'orders_delete', invoices:'invoices_delete',
  };
  const canView   = hasPermission ? hasPermission(PAGE_PERMS[page] || page+'_view') : true;
  const canCreate = hasPermission ? hasPermission(PAGE_CREATE_PERMS[page] || page+'_create') : true;
  const canEdit   = hasPermission ? hasPermission(PAGE_EDIT_PERMS[page] || page+'_edit') : true;
  const canDelete = hasPermission ? hasPermission(PAGE_DELETE_PERMS[page] || page+'_delete') : true;

  // Pick up a record-to-open that AppShell stashed in AppContext when navigating
  // here from Customer 360 sub-tabs or global search. This survives the page
  // switch/remount race that a plain window event cannot.
  useEffect(() => {
    if (pendingRecord && pendingRecord.page === page && pendingRecord.record) {
      setSelectedRecord(pendingRecord.record);
      if (pendingRecord.tab) setInitialTab(pendingRecord.tab);
      setPendingRecord(null);
    }
  }, [pendingRecord, page]);
  const [search,       setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [serverTotal,  setServerTotal]  = useState(null);
  const [initialTab,   setInitialTab]   = useState(null);
  const [pageSize,     setPageSize]     = useState(25);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [statusFilter, setStatusFilter] = useState('All');
  const [timePeriod,   setTimePeriod]   = useState('');
  const [advFilters,   setAdvFilters]   = useState([]); // [{field, op, value, type}]
  const [ownerFilter,  setOwnerFilter]  = useState('');
  const [sortField,    setSortField]    = useState('');
  const [sortDir,      setSortDir]      = useState('asc'); // 'asc' | 'desc'
  const [columnsOpen,  setColumnsOpen]  = useState(false);
  const fieldMeta = useMemo(() => getFieldMeta(page), [page]);
  const DEFAULT_COLUMNS = useMemo(() => {
    const base = ['id','name'];
    if (page !== 'products' && page !== 'customers' && fieldMeta.some(f=>f.key==='customer')) base.push('customer');
    base.push('owner','status');
    if (fieldMeta.some(f=>f.key==='amount')) base.push('amount');
    if (fieldMeta.some(f=>f.key==='price'))  base.push('price');
    return base;
  }, [page, fieldMeta]);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);

  // Load persisted column/sort prefs whenever the page changes.
  useEffect(() => {
    let cancelled = false;
    setVisibleColumns(DEFAULT_COLUMNS); setSortField(''); setSortDir('asc');
    if (fetchListViewPrefs) fetchListViewPrefs(page).then(saved => {
      if (cancelled || !saved) return;
      if (saved.columns?.length) setVisibleColumns(saved.columns);
      if (saved.sort?.field) { setSortField(saved.sort.field); setSortDir(saved.sort.direction||'asc'); }
    });
    return () => { cancelled = true; };
  }, [page]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [createOpen,   setCreateOpen]   = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [menuOpenId,   setMenuOpenId]   = useState(null);
  const [defaultLoaded,setDefaultLoaded]= useState(false);

  // Permission helper
  const menuRef = useRef(null);

  // Close 3-dot menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('[data-menu-container]')) setMenuOpenId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const canDo = (action) => {
    if (!permissionsLoaded || currentUserPermissions.length === 0) return true;
    if (currentUserPermissions.includes('__admin__')) return true;
    return currentUserPermissions.includes(`${page}_${action}`);
  };

  useEffect(() => {
    fetchSavedSearches(page);
    setSearch(''); setStatusFilter('All'); setTimePeriod('');
    setAdvFilters([]); setOwnerFilter('');
    setDefaultLoaded(false);
    setTimeout(() => setDefaultLoaded(true), 300);
  }, [page]);

  // Debounce search input (300ms) so filtering doesn't recompute on every
  // keystroke against a potentially large in-memory array.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Server-side exact row count — accurate even though only LIST_FETCH_LIMIT
  // rows are loaded into `customers`/`orders`/etc. client-side (see the
  // pagination TODO in AppContext.tsx).
  useEffect(() => {
    let cancelled = false;
    fetchListCount(page).then(c => { if (!cancelled) setServerTotal(c); });
    return () => { cancelled = true; };
  }, [page]);

  useEffect(() => {
    if (!defaultLoaded || !savedSearches.length) return;
    const def = savedSearches.find(s => s.object_type === page && s.is_default)
             || savedSearches.find(s => s.object_type === page && s.is_global_default);
    if (def?.filters) applyFilters(def.filters);
  }, [defaultLoaded]);

  const applyFilters = (f) => {
    if (f.search      !== undefined) setSearch(f.search || '');
    if (f.status      !== undefined) setStatusFilter(f.status || 'All');
    if (f.timePeriod  !== undefined) setTimePeriod(f.timePeriod || '');
    if (f.advFilters  !== undefined) setAdvFilters(f.advFilters || []);
    if (f.owner       !== undefined) setOwnerFilter(f.owner || '');
    if (f.sortField   !== undefined) { setSortField(f.sortField||''); setSortDir(f.sortDir||'asc'); }
  };

  const currentFilters = { search, status: statusFilter, timePeriod, advFilters, owner: ownerFilter, sortField, sortDir };

  const getData = () => {
    switch (page) {
      case 'customers':     return customers;
      case 'products':      return products;
      case 'leads':         return leads;
      case 'opportunities': return opportunities;
      case 'orders':        return orders;
      case 'invoices':      return invoices;
      case 'contacts':      return contacts;
      case 'activities':    return activities;
      default:              return [];
    }
  };

  const filtered = useMemo(() => {
    let data = getData();
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      const fmtNum = r => r.displayNumber ? formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', r.displayNumber) : '';
      data = data.filter(r => [r.name, r.id, r.customer, r.email, r.subject, r.phone, fmtNum(r)].some(v => String(v||'').toLowerCase().includes(q)));
    }
    if (statusFilter !== 'All') data = data.filter(r => r.status === statusFilter);
    data = applyTimePeriod(data, timePeriod);
    // Advanced filters — every condition must match (AND), covering any field
    // on the object (not a single hardcoded field like before).
    advFilters.forEach(cond => {
      if (!cond.field) return;
      const needsValue = !['is_empty','is_not_empty','is_true','is_false'].includes(cond.op);
      if (needsValue && (cond.value===undefined || cond.value==='')) return;
      data = data.filter(r => matchesCondition(r, cond));
    });
    if (ownerFilter) data = data.filter(r => r.owner === ownerFilter || r.owner_id === ownerFilter);
    return data;
  }, [page, customers, products, leads, opportunities, orders, invoices, contacts, activities, debouncedSearch, statusFilter, timePeriod, advFilters, ownerFilter]);

  // Sorting — applied after filtering, before pagination.
  const sorted = useMemo(() => {
    if (!sortField) return filtered;
    const meta = fieldMeta.find(f => f.key === sortField);
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      if (meta?.type === 'number') return (Number(av) - Number(bv)) * dir;
      if (meta?.type === 'date')   return (new Date(av).getTime() - new Date(bv).getTime()) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sortField, sortDir, fieldMeta]);

  const toggleSort = (key) => {
    if (sortField !== key) { setSortField(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortField(''); setSortDir('asc'); }
  };

  // Pagination
  const totalRecords = sorted.length;
  const totalPages   = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage     = Math.min(currentPage, totalPages);
  const pagedRecords = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pageLabel    = getPageLabel(page);
  const activeCount  = (search?1:0) + (statusFilter!=='All'?1:0) + (timePeriod?1:0) + advFilters.filter(c=>c.field).length + (ownerFilter?1:0);
  const clearFilters = () => { setSearch(''); setStatusFilter('All'); setTimePeriod(''); setAdvFilters([]); setOwnerFilter(''); };
  const getSecondary = (r) => r.customer || r.company || r.category || r.email || '';
  const addFilterRow = () => { const f = fieldMeta.find(f=>f.key!=='id')||fieldMeta[0]; setAdvFilters(p=>[...p,{field:f.key,type:f.type,op:OPERATORS[f.type][0].v,value:''}]); };
  const updateFilterRow = (idx, patch) => setAdvFilters(p => p.map((c,i) => i===idx ? {...c,...patch} : c));
  const removeFilterRow = (idx) => setAdvFilters(p => p.filter((_,i) => i!==idx));
  const persistColumns = (cols, sf=sortField, sd=sortDir) => { setVisibleColumns(cols); if (saveListViewPrefs) saveListViewPrefs(page, { columns: cols, sort: { field: sf, direction: sd } }); };
  const toggleColumn = (key) => persistColumns(visibleColumns.includes(key) ? visibleColumns.filter(c=>c!==key) : [...visibleColumns, key]);
  const moveColumn = (idx, dir) => { const cols=[...visibleColumns]; const j=idx+dir; if (j<0||j>=cols.length) return; [cols[idx],cols[j]]=[cols[j],cols[idx]]; persistColumns(cols); };
  const fmtCell = (r, meta) => {
    const v = r[meta.key];
    if (meta.key==='id') return r.displayNumber ? formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', r.displayNumber) : (r.id||'');
    if (meta.type==='date')    return v ? formatDate(v) : '—';
    if (meta.type==='boolean') return v ? 'Yes' : 'No';
    if (['amount','price','cost'].includes(meta.key)) return v!=null ? formatCurrency(Number(v), appPreferences?.default_currency) : '—';
    if (meta.key==='status') return <StatusBadge status={v}/>;
    return v!=null && v!=='' ? String(v) : '—';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] capitalize">{page}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} of {getData().length} record{getData().length!==1?'s':''}</p>
        </div>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-[#0F172A] flex items-center gap-1 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50">
              ✕ Clear <span className="bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{activeCount}</span>
            </button>
          )}
          {canDo('create') && (
            <button onClick={() => setCreateOpen(true)} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90 transition-all">
              + Create {pageLabel}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${page}…`}
            className="border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-400"/>
          <select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setCurrentPage(1);}} className="border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option>All</option>
            {getStatusOptions(page).map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={timePeriod} onChange={e=>setTimePeriod(e.target.value)} className="border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
            {TIME_PERIODS.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <select value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)} className="border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Owners</option>
            {enterpriseUsers.map(u=><option key={u.id} value={u.email}>{u.first_name} {u.last_name}</option>)}
          </select>
        </div>

        {/* Advanced filters — any field on the object, AND-combined */}
        {advFilters.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-50 space-y-2">
            {advFilters.map((cond, idx) => {
              const meta = fieldMeta.find(f=>f.key===cond.field) || fieldMeta[0];
              const needsValue = !['is_empty','is_not_empty','is_true','is_false'].includes(cond.op);
              return (
                <div key={idx} className="flex flex-wrap gap-2 items-center bg-blue-50/50 rounded-xl p-2">
                  <select value={cond.field} onChange={e=>{const m=fieldMeta.find(f=>f.key===e.target.value);updateFilterRow(idx,{field:e.target.value,type:m.type,op:OPERATORS[m.type][0].v,value:''});}}
                    className="border border-blue-200 rounded-lg px-2 py-1.5 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                    {fieldMeta.filter(f=>f.key!=='id').map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                  <select value={cond.op} onChange={e=>updateFilterRow(idx,{op:e.target.value})}
                    className="border border-blue-200 rounded-lg px-2 py-1.5 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                    {OPERATORS[meta.type].map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                  {needsValue && (
                    meta.type==='select'
                      ? <select value={cond.value} onChange={e=>updateFilterRow(idx,{value:e.target.value})} className="flex-1 min-w-[100px] border border-blue-200 rounded-lg px-2 py-1.5 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                          <option value="">Select…</option>
                          {getStatusOptions(page).map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      : <input type={meta.type==='date'?'date':meta.type==='number'?'number':'text'} value={cond.value} onChange={e=>updateFilterRow(idx,{value:e.target.value})} placeholder="Value"
                          className="flex-1 min-w-[100px] border border-blue-200 rounded-lg px-2 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-400"/>
                  )}
                  <button onClick={()=>removeFilterRow(idx)} className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-xs font-bold flex items-center justify-center flex-shrink-0">✕</button>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-blue-50">
          <button onClick={addFilterRow} className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">+ Add Filter</button>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-blue-50">
          <div className="text-xs text-blue-600 font-medium">{activeCount > 0 ? `${activeCount} filter${activeCount>1?'s':''} active` : ''}</div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={()=>setColumnsOpen(!columnsOpen)} className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all ${columnsOpen?'bg-[#0F172A] text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                ⚙️ Columns <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${columnsOpen?'bg-white/20 text-white':'bg-gray-200 text-gray-600'}`}>{visibleColumns.length}</span>
              </button>
              {columnsOpen && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-[24px] shadow-2xl border border-blue-100 z-50 overflow-hidden" style={{maxHeight:'70vh',overflowY:'auto'}}>
                  <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3 flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm">Customize Columns</h3>
                    <button onClick={()=>setColumnsOpen(false)} className="text-white/70 hover:text-white">✕</button>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-400 px-2 pb-2">Shown, in order — use ↑↓ to reorder.</p>
                    {visibleColumns.map((key, idx) => {
                      const meta = fieldMeta.find(f=>f.key===key);
                      if (!meta) return null;
                      return (
                        <div key={key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 rounded-xl">
                          <span className="flex-1 text-sm text-[#0F172A]">{meta.label}</span>
                          <button onClick={()=>moveColumn(idx,-1)} disabled={idx===0} className="w-6 h-6 rounded text-gray-400 hover:text-[#0F172A] disabled:opacity-20 text-xs">▲</button>
                          <button onClick={()=>moveColumn(idx,1)} disabled={idx===visibleColumns.length-1} className="w-6 h-6 rounded text-gray-400 hover:text-[#0F172A] disabled:opacity-20 text-xs">▼</button>
                          <button onClick={()=>toggleColumn(key)} className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-xs font-bold flex items-center justify-center">✕</button>
                        </div>
                      );
                    })}
                    <div className="border-t border-gray-100 mt-2 pt-2">
                      <p className="text-xs text-gray-400 px-2 pb-1">Add a column</p>
                      {fieldMeta.filter(f=>!visibleColumns.includes(f.key)).map(f => (
                        <button key={f.key} onClick={()=>toggleColumn(f.key)} className="w-full text-left px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-xl">+ {f.label}</button>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 mt-2 pt-2 px-2">
                      <button onClick={()=>persistColumns(DEFAULT_COLUMNS)} className="text-xs text-gray-400 hover:text-[#0F172A]">Reset to default</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={()=>setSearchPanelOpen(!searchPanelOpen)} className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all ${searchPanelOpen?'bg-[#0F172A] text-white':'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                🔖 Saved Searches
                {savedSearches.filter(s=>s.object_type===page).length > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${searchPanelOpen?'bg-white/20 text-white':'bg-blue-200 text-blue-700'}`}>{savedSearches.filter(s=>s.object_type===page).length}</span>
                )}
              </button>
              {searchPanelOpen && <SavedSearchPanel page={page} currentFilters={currentFilters} onApply={applyFilters} onClose={()=>setSearchPanelOpen(false)}/>}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-[#0F172A] to-blue-900 text-white">
              <tr>
                {visibleColumns.map(key => {
                  const meta = fieldMeta.find(f=>f.key===key);
                  if (!meta) return null;
                  const align = ['amount','price','cost'].includes(key) ? 'text-right' : 'text-left';
                  return (
                    <th key={key} onClick={()=>toggleSort(key)} className={`px-5 py-3.5 ${align} text-sm font-semibold cursor-pointer select-none hover:bg-white/10 whitespace-nowrap`}>
                      {meta.label} {sortField===key && (sortDir==='asc' ? '▲' : '▼')}
                    </th>
                  );
                })}
                <th className="px-5 py-3.5 text-center text-sm font-semibold w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length+1} className="px-5 py-16 text-center">
                    <div className="text-5xl mb-3">🔍</div>
                    <div className="font-bold text-[#0F172A] text-lg">{activeCount > 0 ? 'No matching records' : `No ${page} yet`}</div>
                    <div className="text-gray-400 text-sm mt-1">{activeCount > 0 ? 'Try adjusting your filters.' : `Create your first ${pageLabel.toLowerCase()}.`}</div>
                    {activeCount > 0 && <button onClick={clearFilters} className="mt-3 text-blue-600 text-sm font-semibold hover:underline">Clear all filters</button>}
                  </td>
                </tr>
              ) : pagedRecords.map(record => {
                const ownerUser = enterpriseUsers.find(u => u.email === record.owner || u.id === record.owner_id);
                return (
                  <tr key={record.id} className="border-t border-blue-50 hover:bg-blue-50/40 transition-all">
                    {visibleColumns.map(key => {
                      const meta = fieldMeta.find(f=>f.key===key);
                      if (!meta) return null;
                      if (key === 'id') return (
                        <td key={key} className="px-5 py-3.5">
                          <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                            {record.displayNumber ? formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', record.displayNumber) : record.id}
                          </span>
                        </td>
                      );
                      if (key === 'name') return (
                        <td key={key} className="px-5 py-3.5">
                          {canDo('view')
                            ? <button onClick={()=>setSelectedRecord(record)} className="font-semibold text-[#0F172A] hover:text-blue-700 hover:underline text-sm text-left">{record.name||record.subject||'—'}</button>
                            : <span className="font-semibold text-[#0F172A] text-sm">{record.name||record.subject||'—'}</span>
                          }
                        </td>
                      );
                      if (key === 'owner') return (
                        <td key={key} className="px-5 py-3.5">
                          {ownerUser
                            ? <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{ownerUser.first_name?.charAt(0)}{ownerUser.last_name?.charAt(0)}</div>
                                <span className="text-sm text-[#0F172A] font-medium">{ownerUser.first_name} {ownerUser.last_name}</span>
                              </div>
                            : record.owner ? <span className="text-sm text-gray-600">{record.owner}</span> : <span className="text-gray-300 text-sm">—</span>
                          }
                        </td>
                      );
                      const align = ['amount','price','cost'].includes(key) ? 'text-right' : 'text-left';
                      const weight = ['amount','price','cost'].includes(key) ? 'font-semibold text-[#0F172A]' : 'text-gray-600';
                      return <td key={key} className={`px-5 py-3.5 text-sm ${align} ${weight}`}>{fmtCell(record, meta)}</td>;
                    })}
                    <td className="px-5 py-3.5">
                      <div className="relative flex justify-center" data-menu-container>
                        <button onClick={()=>setMenuOpenId(menuOpenId===record.id?null:record.id)} className="w-9 h-9 rounded-full bg-[#0F172A] text-white hover:bg-blue-800 flex items-center justify-center text-lg font-bold shadow transition-all">⋮</button>
                        {menuOpenId === record.id && (
                          <div className="absolute right-0 top-10 bg-[#0F172A] border border-blue-800 shadow-2xl rounded-2xl p-2 z-[999] min-w-[220px]">
                            {canDo('view') && <button onClick={()=>{setSelectedRecord(record);setMenuOpenId(null);}} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">Open Details</button>}
                            {page==='leads' && record.status==='Qualified' && (
                              <button onClick={()=>{convertLeadToOpportunity(record);setMenuOpenId(null);}} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">🔀 Convert to Opportunity</button>
                            )}
                            {page==='opportunities' && (<>
                              {appPreferences?.cpq_enabled !== false ? (
                                <button onClick={async()=>{setMenuOpenId(null);const q=await createQuotationFromOpportunity(record);await fetchQuotations();if(q)setSuccessDialog({ title: '✅ Quotation Created', message: `Quotation ${q.quote_number} has been created successfully. You can view and edit it in the Quotations page.` });}} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">📄 Create Quotation</button>
                              ) : (
                                <button onClick={async()=>{setMenuOpenId(null);await createOrderFromOpportunity(record);await fetchOrders();showAlert('Order created successfully!', { variant:'success', title:'Order Created' });}} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">🛒 Create Order</button>
                              )}
                            </>)}
                            {page==='orders' && (
                              <button onClick={()=>{createInvoiceFromOrder(record);setMenuOpenId(null);}} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">🧾 Create Invoice</button>
                            )}
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

        {/* Truncation warning — loaded rows capped at LIST_FETCH_LIMIT but the table has more */}
        {serverTotal !== null && getData().length >= 500 && serverTotal > getData().length && (
          <div className="px-6 py-2.5 bg-amber-50 border-t border-amber-100 flex items-center gap-2 text-xs text-amber-700">
            <span>⚠️</span>
            <span>Showing the {getData().length.toLocaleString()} most recent {pageLabel.toLowerCase()}s of <strong>{serverTotal.toLocaleString()}</strong> total — search and filters only apply to loaded records. Use search to find specific older records.</span>
          </div>
        )}

        {/* Pagination footer */}
        {totalRecords > 0 && (
          <div className="px-6 py-3 border-t border-blue-50 bg-white flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                Showing <strong className="text-[#0F172A]">{(safePage-1)*pageSize+1}–{Math.min(safePage*pageSize,totalRecords)}</strong> of <strong className="text-[#0F172A]">{totalRecords}</strong> {pageLabel.toLowerCase()}s
                {serverTotal !== null && !debouncedSearch.trim() && statusFilter==='All' && !timePeriod && !advFilters.some(c=>c.field) && !ownerFilter && serverTotal !== totalRecords && (
                  <span className="text-gray-300"> ({serverTotal.toLocaleString()} total)</span>
                )}
              </span>
              <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setCurrentPage(1);}}
                className="border border-blue-200 rounded-lg px-2 py-1 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                {[10,25,50,100].map(n=><option key={n} value={n}>{n} per page</option>)}
              </select>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={()=>setCurrentPage(1)} disabled={safePage===1} className="px-2 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-30">«</button>
                <button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={safePage===1} className="px-3 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-30">‹ Prev</button>
                {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
                  const pg = Math.max(1,Math.min(totalPages-4,safePage-2))+i;
                  return (
                    <button key={pg} onClick={()=>setCurrentPage(pg)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${pg===safePage?'bg-[#0F172A] text-white':'text-gray-500 hover:bg-blue-50'}`}>
                      {pg}
                    </button>
                  );
                })}
                <button onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={safePage===totalPages} className="px-3 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-30">Next ›</button>
                <button onClick={()=>setCurrentPage(totalPages)} disabled={safePage===totalPages} className="px-2 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-30">»</button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedRecord && (() => {
        const isCPQPage = ['orders','invoices'].includes(page);
        const cpqEnabled = appPreferences?.cpq_enabled !== false;
        if (isCPQPage && cpqEnabled) {
          return <CPQRecordDetail page={page} record={selectedRecord} onClose={()=>{
            setSelectedRecord(null);
            if (pendingReturnTo) {
              const rt = pendingReturnTo;
              setPendingReturnTo(null);
              window.dispatchEvent(new CustomEvent('open-crm-record', { detail: rt }));
            }
          }}/>;
        }
        return <RecordDetailPanel page={page} record={selectedRecord} initialTab={initialTab} onClose={()=>{
          setInitialTab(null); setSelectedRecord(null);
          if (pendingReturnTo) {
            const rt = pendingReturnTo;
            setPendingReturnTo(null);
            window.dispatchEvent(new CustomEvent('open-crm-record', { detail: rt }));
          }
        }}/>;
      })()}
      {successDialog && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setSuccessDialog(null)}/>
          <div className="relative bg-white rounded-[24px] shadow-2xl max-w-md w-full p-6 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h3 className="text-lg font-bold text-[#0F172A] mb-2">{successDialog.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">{successDialog.message}</p>
            <button onClick={()=>setSuccessDialog(null)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0F172A] to-blue-800 text-white text-sm font-bold hover:opacity-90 shadow-md">
              Got it
            </button>
          </div>
        </div>
      )}
      <CreateRecordModal page={page} open={createOpen} onClose={()=>setCreateOpen(false)}/>
    </div>
  );
}
