// @ts-nocheck
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { getPageLabel, getStatusOptions, getStatusColor, formatCurrency, formatDisplayNumber, PAGE_DISPLAY_PREFIX } from '@/lib/utils';
import RecordDetailPanel from '@/components/crm/RecordDetailPanel';
import CreateRecordModal from '@/components/crm/CreateRecordModal';
import CPQRecordDetail from '@/components/crm/CPQRecordDetail';

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

const FIELD_FILTERS = {
  customers:     [{v:'industry',l:'Industry'}],
  leads:         [{v:'source',l:'Source'}],
  opportunities: [{v:'stage',l:'Stage'}],
  orders:        [],
  invoices:      [{v:'paymentTerms',l:'Payment Terms'}],
  contacts:      [{v:'designation',l:'Designation'}],
  activities:    [{v:'activityType',l:'Activity Type'}],
  products:      [{v:'category',l:'Category'},{v:'productFamily',l:'Product Family'}],
};

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
  const { currentUser, savedSearches, fetchSavedSearches, createSavedSearch, deleteSavedSearch, setDefaultSavedSearch,
    appPreferences, createOrderFromOpportunity, fetchOrders, pendingRecord, setPendingRecord,
  } = useApp();
  const [saveName,   setSaveName]   = useState('');
  const [saveDef,    setSaveDef]    = useState(false);
  const [saveGlobal, setSaveGlobal] = useState(false);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => { fetchSavedSearches(page); }, [page]);

  const mySearches     = savedSearches.filter(s => s.object_type === page && s.created_by === currentUser?.email);
  const globalSearches = savedSearches.filter(s => s.object_type === page && s.is_global_default && s.created_by !== currentUser?.email);

  const describe = (f) => {
    const parts = [];
    if (f.search)       parts.push(`Search: "${f.search}"`);
    if (f.status && f.status !== 'All') parts.push(`Status: ${f.status}`);
    if (f.timePeriod)   parts.push(TIME_PERIODS.find(t=>t.v===f.timePeriod)?.l || f.timePeriod);
    if (f.fieldFilter?.value) parts.push(`${f.fieldFilter.field}: ${f.fieldFilter.value}`);
    if (f.owner)        parts.push(`Owner: ${f.owner}`);
    return parts.length ? parts.join(' · ') : 'All records';
  };

  const SearchCard = ({ s }) => (
    <div className="bg-white border border-blue-100 rounded-2xl p-4 hover:border-blue-300 transition-all">
      <div className="font-semibold text-[#0F172A] flex items-center gap-2 mb-1">
        {s.name}
        {s.is_global_default && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">Global Default</span>}
        {s.is_default && !s.is_global_default && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">My Default</span>}
      </div>
      <div className="text-xs text-gray-400 mb-3">{describe(s.filters || {})}</div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={()=>{onApply(s.filters||{});onClose();}} className="flex-1 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-2 rounded-xl text-xs font-bold hover:opacity-90">Apply</button>
        {!s.is_default && <button onClick={()=>setDefaultSavedSearch(s.id,page,false)} className="bg-blue-100 text-blue-700 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-blue-200">Set Default</button>}
        <button onClick={()=>deleteSavedSearch(s.id,page)} className="bg-red-100 text-red-500 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-red-200">Delete</button>
      </div>
    </div>
  );

  return (
    <div className="absolute right-0 top-14 w-96 bg-white rounded-[28px] shadow-2xl border border-blue-100 z-50 overflow-hidden" style={{maxHeight:'85vh',overflowY:'auto'}}>
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-4 flex items-center justify-between">
        <h3 className="text-white font-bold">Saved Searches</h3>
        <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
      </div>
      <div className="p-4 space-y-5">
        <div className="bg-blue-50 rounded-2xl p-4 space-y-3">
          <h4 className="font-bold text-[#0F172A] text-sm">Save Current Filters</h4>
          <input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="Name this search..." className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-400"/>
          <div className="text-xs text-gray-500 bg-white rounded-xl px-3 py-2 border border-blue-100">{describe(currentFilters)}</div>
          <label className="flex items-center gap-2 text-sm text-[#0F172A] cursor-pointer">
            <input type="checkbox" checked={saveDef} onChange={e=>setSaveDef(e.target.checked)} className="w-4 h-4 accent-blue-600"/>
            Set as my default
          </label>
          <button onClick={async()=>{if(!saveName.trim()){alert('Enter a name.');return;}setSaving(true);await createSavedSearch(saveName,page,currentFilters,saveDef,saveGlobal);setSaveName('');setSaveDef(false);setSaving(false);}} disabled={saving} className="w-full bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Search'}
          </button>
        </div>
        {globalSearches.length > 0 && (
          <div>
            <h4 className="font-bold text-gray-500 text-xs uppercase tracking-wider mb-2">Global Defaults</h4>
            <div className="space-y-2">{globalSearches.map(s=><SearchCard key={s.id} s={s}/>)}</div>
          </div>
        )}
        <div>
          <h4 className="font-bold text-gray-500 text-xs uppercase tracking-wider mb-2">My Searches ({mySearches.length})</h4>
          {mySearches.length === 0
            ? <div className="text-gray-400 text-sm text-center py-4">No saved searches yet.</div>
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
  } = useApp();

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
  const [initialTab,   setInitialTab]   = useState(null);
  const [pageSize,     setPageSize]     = useState(25);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [statusFilter, setStatusFilter] = useState('All');
  const [timePeriod,   setTimePeriod]   = useState('');
  const [fieldFilter,  setFieldFilter]  = useState({ field:'', value:'' });
  const [ownerFilter,  setOwnerFilter]  = useState('');
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
    setFieldFilter({field:'',value:''}); setOwnerFilter('');
    setDefaultLoaded(false);
    setTimeout(() => setDefaultLoaded(true), 300);
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
    if (f.fieldFilter !== undefined) setFieldFilter(f.fieldFilter || {field:'',value:''});
    if (f.owner       !== undefined) setOwnerFilter(f.owner || '');
  };

  const currentFilters = { search, status: statusFilter, timePeriod, fieldFilter, owner: ownerFilter };

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
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(r => [r.name,r.id,r.customer,r.email,r.subject].some(v=>String(v||'').toLowerCase().includes(q)));
    }
    if (statusFilter !== 'All') data = data.filter(r => r.status === statusFilter);
    data = applyTimePeriod(data, timePeriod);
    if (fieldFilter.field && fieldFilter.value) {
      data = data.filter(r => String(r[fieldFilter.field]||'').toLowerCase() === fieldFilter.value.toLowerCase());
    }
    if (ownerFilter) data = data.filter(r => r.owner === ownerFilter || r.owner_id === ownerFilter);
    return data;
  }, [page, customers, products, leads, opportunities, orders, invoices, contacts, activities, search, statusFilter, timePeriod, fieldFilter, ownerFilter]);

  // Pagination
  const totalRecords = filtered.length;
  const totalPages   = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage     = Math.min(currentPage, totalPages);
  const pagedRecords = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pageLabel    = getPageLabel(page);
  const hasAmount    = ['leads','opportunities','orders','invoices'].includes(page);
  const hasPrice     = page === 'products';
  const objFieldDefs = FIELD_FILTERS[page] || [];
  const activeCount  = [search, statusFilter!=='All', timePeriod, fieldFilter.value, ownerFilter].filter(Boolean).length;
  const clearFilters = () => { setSearch(''); setStatusFilter('All'); setTimePeriod(''); setFieldFilter({field:'',value:''}); setOwnerFilter(''); };
  const getSecondary = (r) => r.customer || r.company || r.category || r.email || '';

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${page}…`}
            className="border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-400"/>
          <select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setCurrentPage(1);}} className="border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option>All</option>
            {getStatusOptions(page).map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={timePeriod} onChange={e=>setTimePeriod(e.target.value)} className="border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
            {TIME_PERIODS.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          {objFieldDefs.length > 0 && (
            <div className="flex gap-2">
              <select value={fieldFilter.field} onChange={e=>setFieldFilter(f=>({...f,field:e.target.value,value:''}))} className="flex-1 border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">All Fields</option>
                {objFieldDefs.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
              </select>
              {fieldFilter.field && <input value={fieldFilter.value} onChange={e=>setFieldFilter(f=>({...f,value:e.target.value}))} placeholder="Value" className="flex-1 border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-400"/>}
            </div>
          )}
          <select value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)} className="border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Owners</option>
            {enterpriseUsers.map(u=><option key={u.id} value={u.email}>{u.first_name} {u.last_name}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-blue-50">
          <div className="text-xs text-blue-600 font-medium">{activeCount > 0 ? `${activeCount} filter${activeCount>1?'s':''} active` : ''}</div>
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

      {/* Table */}
      <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-[#0F172A] to-blue-900 text-white">
              <tr>
                <th className="px-5 py-3.5 text-left text-sm font-semibold">ID</th>
                <th className="px-5 py-3.5 text-left text-sm font-semibold">Name</th>
                {page !== 'products' && page !== 'customers' && <th className="px-5 py-3.5 text-left text-sm font-semibold">Customer</th>}
                <th className="px-5 py-3.5 text-left text-sm font-semibold">Owner</th>
                <th className="px-5 py-3.5 text-left text-sm font-semibold">Status</th>
                {hasAmount && <th className="px-5 py-3.5 text-right text-sm font-semibold">Amount</th>}
                {hasPrice  && <th className="px-5 py-3.5 text-right text-sm font-semibold">Price</th>}
                <th className="px-5 py-3.5 text-center text-sm font-semibold w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
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
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                        {record.displayNumber ? formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', record.displayNumber) : record.id}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {canDo('view')
                        ? <button onClick={()=>setSelectedRecord(record)} className="font-semibold text-[#0F172A] hover:text-blue-700 hover:underline text-sm text-left">{record.name||record.subject||'—'}</button>
                        : <span className="font-semibold text-[#0F172A] text-sm">{record.name||record.subject||'—'}</span>
                      }
                    </td>
                    {page !== 'products' && page !== 'customers' && <td className="px-5 py-3.5 text-sm text-gray-600">{record.customer||record.email||'—'}</td>}
                    <td className="px-5 py-3.5">
                      {ownerUser
                        ? <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{ownerUser.first_name?.charAt(0)}{ownerUser.last_name?.charAt(0)}</div>
                            <span className="text-sm text-[#0F172A] font-medium">{ownerUser.first_name} {ownerUser.last_name}</span>
                          </div>
                        : record.owner ? <span className="text-sm text-gray-600">{record.owner}</span> : <span className="text-gray-300 text-sm">—</span>
                      }
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={record.status}/></td>
                    {hasAmount && <td className="px-5 py-3.5 text-right text-sm font-semibold text-[#0F172A]">{formatCurrency(record.amount||0)}</td>}
                    {hasPrice  && <td className="px-5 py-3.5 text-right text-sm font-semibold text-[#0F172A]">{formatCurrency(record.price||0)}</td>}
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
                                <button onClick={async()=>{setMenuOpenId(null);await createOrderFromOpportunity(record);await fetchOrders();alert('Order created successfully!');}} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">🛒 Create Order</button>
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

        {/* Pagination footer */}
        {totalRecords > 0 && (
          <div className="px-6 py-3 border-t border-blue-50 bg-white flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                Showing <strong className="text-[#0F172A]">{(safePage-1)*pageSize+1}–{Math.min(safePage*pageSize,totalRecords)}</strong> of <strong className="text-[#0F172A]">{totalRecords}</strong> {pageLabel.toLowerCase()}s
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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setSuccessDialog(null)}/>
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
