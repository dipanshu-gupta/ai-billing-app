// @ts-nocheck
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useObjectLabels } from '@/lib/useObjectLabels';
import { getStatusColor } from '@/lib/utils';
import { ObjectIcon } from '@/lib/lineIcons';
import { NavIcon } from '@/lib/icons';
import { useTenant } from '@/context/TenantContext';
import { fetchCustomObjectFields, formatCustomDisplayNumber } from '@/lib/customObjects';
import { fetchServerPage } from '@/lib/serverList';
import { tenantScope, formatDisplayNumber } from '@/lib/utils';
import { useRbac } from '@/lib/useRbac';
import { toCrmRecord } from '@/lib/crmRecordShape';

// Searched in the DATABASE (not the first few hundred records held in memory), tenant-scoped, inside the user's
// data-security scope, and only for objects their role may view. Record numbers (INV-00012, 12) match too.
const B2B_SEARCH_CONFIG = [
  { page:'customers',     table:'customers',     key:'customer_number',    prefix:'CUST', icon:'👥', label:'Customers',    cols:['name','email','phone','company','city','gst_number'], secondary: r => [r.industry, r.email || r.phone, r.city].filter(Boolean).join(' · ') },
  { page:'leads',         table:'leads',         key:'lead_number',        prefix:'LEAD', icon:'🎯', label:'Leads',        cols:['name','customer','source','email','phone'],          secondary: r => `${r.customer||''} · ${r.status||''}` },
  { page:'opportunities', table:'opportunities', key:'opportunity_number', prefix:'OPP',  icon:'💼', label:'Opportunities',cols:['name','customer','stage'],                          secondary: r => `${r.customer||''} · ${r.stage||''}` },
  { page:'contacts',      table:'contacts',      key:'contact_number',     prefix:'CONT', icon:'📇', label:'Contacts',     cols:['name','email','phone','mobile','customer','designation'], secondary: r => `${r.customer||''} · ${r.designation||''}` },
  { page:'activities',    table:'activities',    key:'activity_number',    prefix:'ACT',  icon:'📅', label:'Activities',   cols:['name','subject','customer','activity_type'],        secondary: r => `${r.customer||''} · ${r.activity_type||''}` },
  { page:'quotations',    table:'quotations',    key:'quote_number',       prefix:'QUO',  icon:'📄', label:'Quotations',   cols:['name','customer','quote_number'],                   secondary: r => `${r.customer||''} · ${r.status||''}`, raw: true },
  { page:'orders',        table:'orders',        key:'order_number',       prefix:'ORD',  icon:'🛒', label:'Orders',       cols:['name','customer','order_number'],                   secondary: r => `${r.customer||''} · ${r.status||''}` },
  { page:'invoices',      table:'invoices',      key:'invoice_number',     prefix:'INV',  icon:'🧾', label:'Invoices',     cols:['name','customer','invoice_number'],                 secondary: r => `${r.customer||''} · ${r.status||''}` },
  { page:'products',      table:'products',      key:'product_number',     prefix:'PROD', icon:'📦', label:'Products',     cols:['name','sku','category','product_family'],           secondary: r => `${r.category||''} · ${r.product_family||''}` },
];

const B2C_SEARCH_CONFIG = [
  { page:'retailCustomers',  table:'retail_customers',  key:'customer_number', prefix:'RCUST', icon:'🧑', label:'Customers',  cols:['name','email','phone','customer_number','city'], secondary: r => [r.phone, r.loyalty_tier, r.status].filter(Boolean).join(' · ') },
  { page:'retailProducts',   table:'retail_products',   key:'product_number',  prefix:'RPROD', icon:'📦', label:'Products',   cols:['name','sku','barcode','brand','category'],       secondary: r => `${r.brand||''} · ${r.category||''}` },
  { page:'retailOrders',     table:'retail_orders',     key:'order_number',    prefix:'RORD',  icon:'🛒', label:'Orders',     cols:['customer','customer_phone','order_number','channel'], secondary: r => `${r.customer||''} · ${r.status||''}` },
  { page:'retailInvoices',   table:'retail_invoices',   key:'invoice_number',  prefix:'RINV',  icon:'🧾', label:'Invoices',   cols:['customer','customer_phone','invoice_number'],    secondary: r => `${r.customer||''} · ${r.status||''}` },
  { page:'retailActivities', table:'retail_activities', key:'activity_number', prefix:'RACT',  icon:'📅', label:'Activities', cols:['subject','customer','customer_phone','activity_type'], secondary: r => `${r.customer||''} · ${r.activity_type||''}` },
];

const toRecord = (cfg, r) => toCrmRecord(cfg.page, r);

export default function GlobalSearch({ onNavigate }) {
  const {
    customers, leads, opportunities, contacts, activities,
    quotations, orders, invoices, products,
    retailCustomers, retailProducts, retailOrders, retailInvoices, retailActivities,
    appPreferences, customObjects, hasPermission, applyDataSecurity, dataSecurityScope, permissionsLoaded,
  } = useApp();
  const { can } = useRbac();
  const { supabase } = useTenant();
  const isB2C = appPreferences?.b2c_mode === true;
  const { getObjectLabel } = useObjectLabels();
  const SEARCH_CONFIG = isB2C ? B2C_SEARCH_CONFIG : B2B_SEARCH_CONFIG;

  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [open,    setOpen]    = useState(false);
  const [focused, setFocused] = useState(0);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  const dataMap = { customers, leads, opportunities, contacts, activities, quotations, orders, invoices, products, retailCustomers, retailProducts, retailOrders, retailInvoices, retailActivities };

  // Debounced, server-side search
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) { setResults([]); setOpen(false); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!supabase) return;
      setSearching(true);
      const term = query.trim().replace(/[%,()"'\\]/g, ' ').trim();
      const found = [];
      // "INV-00012" / "12" also finds the record with that number
      const num = (/^[A-Za-z]{2,6}-0*(\d{1,9})$/.exec(term) || /^0*(\d{1,9})$/.exec(term) || [])[1];
      const pfx = (/^([A-Za-z]{2,6})-/.exec(term) || [])[1]?.toUpperCase();
      const allowed = SEARCH_CONFIG.filter(cfg => can(cfg.page, 'view'));
      const groups = await Promise.all(allowed.map(async (cfg) => {
        try {
          const tasks = [fetchServerPage(supabase, { table: cfg.table, searchTerm: term, searchColumns: cfg.cols, pageSize: 5, security: dataSecurityScope })];
          if (num && (!pfx || pfx === cfg.prefix)) tasks.push(fetchServerPage(supabase, { table: cfg.table, advFilters: [{ column: 'display_number', op: 'eq', value: Number(num) }], pageSize: 1, security: dataSecurityScope }));
          const res = await Promise.all(tasks);
          const rows = []; const seen = new Set();
          res.reverse().forEach(r => (r.data || []).forEach(x => { if (!seen.has(x.id)) { seen.add(x.id); rows.push(x); } }));
          if (!rows.length) return null;
          return { ...cfg, label: getObjectLabel(cfg.page, cfg.label), matches: rows.slice(0, 5).map(r => toRecord(cfg, r)) };
        } catch (e) { return null; }
      }));
      groups.filter(Boolean).forEach(g => found.push(g));
      // Custom objects the user may view (tenant-scoped; RLS also applies).
      try {
        const mode = isB2C ? 'b2c' : 'b2b';
        const visible = (customObjects || []).filter(o => (o.module === 'both' || o.module === mode) && can(`custom_${o.api_name}`, 'view'));
        if (term && visible.length) {
          const cgroups = await Promise.all(visible.map(async (o) => {
            const fields = await fetchCustomObjectFields(o.id, 'header');
            const textCols = fields.filter(f => ['text','email','url','phone'].includes(f.field_type) && /^text_\d+$/.test(f.storage_column)).slice(0, 6).map(f => f.storage_column);
            const { data } = await fetchServerPage(supabase, { table: 'custom_object_records', extraEq: { custom_object_id: o.id }, searchTerm: term, searchColumns: ['name', 'record_number', ...textCols], pageSize: 5, security: dataSecurityScope });
            if (!data?.length) return null;
            return {
              page: `custom_${o.api_name}`, icon: o.icon, label: o.plural_label, isCustom: true,
              secondary: r => [formatCustomDisplayNumber(o, r.display_number), r.status].filter(Boolean).join(' · '),
              matches: data.map(r => ({ ...r, name: r.name || r.record_number })),
            };
          }));
          cgroups.filter(Boolean).forEach(g => found.push(g));
        }
      } catch (e) { console.error('[GlobalSearch custom objects]', e); }
      if (cancelled) return;
      setSearching(false);
      setResults(found);
      setOpen(true);            // also open when nothing matched, so the user sees "No records found"
      setFocused(0);
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, customObjects, supabase, isB2C, getObjectLabel, dataSecurityScope, permissionsLoaded]);

  // Close on outside click
  useEffect(() => {
    const h = (e) => {
      if (!panelRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Keyboard navigation
  const handleKey = (e) => {
    const flat = results.flatMap(g => g.matches.map(r => ({ page: g.page, record: r })));
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f+1, flat.length-1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f-1, 0)); }
    if (e.key === 'Enter' && flat[focused]) { handleSelect(flat[focused].page, flat[focused].record); }
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  const handleSelect = (page, record) => {
    // Capture where the user actually was before this search, so closing
    // the record later returns them there instead of dumping them on the
    // searched object's list page - the previous behavior regardless of
    // where a search was made from.
    const returnToPage = typeof window !== 'undefined' ? sessionStorage.getItem('bp_active_page') : null;
    const returnTo = (returnToPage && returnToPage !== page) ? { page: returnToPage } : null;
    // Dispatch a single event — AppShell handles both navigation AND opening the record
    window.dispatchEvent(new CustomEvent('open-record', { detail: { page, record, returnTo } }));
    setQuery('');
    setOpen(false);
  };

  const totalCount = results.reduce((s, g) => s + g.matches.length, 0);
  let globalIdx = 0;

  return (
    <div className="relative flex-1 max-w-lg mx-4">
      {/* Search input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
          </svg>
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => query.length >= 2 && results.length > 0 && setOpen(true)}
          placeholder="Search records across all objects..."
          className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/20 focus:border-white/40 text-white placeholder-white/40 rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none transition-all"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors">
            ✕
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div ref={panelRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[20px] shadow-2xl border border-blue-100 overflow-hidden z-[100]"
          style={{maxHeight:'70vh', overflowY:'auto'}}>

          {/* Header */}
          <div className="px-4 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-900 flex items-center justify-between">
            <span className="text-white text-xs font-semibold">Search results for "{query}"</span>
            <span className="text-blue-300 text-xs">{totalCount} record{totalCount!==1?'s':''} found</span>
          </div>

          {/* Grouped results */}
          {results.map(group => (
            <div key={group.page}>
              {/* Group header */}
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                {group.isCustom ? <ObjectIcon icon={group.icon} className="w-4 h-4"/> : <NavIcon iconKey={group.page} className="w-4 h-4 text-gray-500"/>}
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{group.label}</span>
                <span className="ml-auto text-xs text-gray-400">{group.matches.length} result{group.matches.length!==1?'s':''}</span>
              </div>

              {/* Records */}
              {group.matches.map(record => {
                const idx  = globalIdx++;
                const isFocused = idx === focused;
                const name = record.name || record.subject || record.customer || record.quote_number || record.id;
                const sec  = group.secondary(record);
                return (
                  <button key={record.id || idx}
                    onClick={() => handleSelect(group.page, record)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 transition-all hover:bg-blue-50
                      ${isFocused ? 'bg-blue-50' : 'bg-white'}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
                      ${isFocused ? 'bg-[#0F172A] text-white' : 'bg-blue-100 text-blue-700'}`}>
                      {group.isCustom ? <ObjectIcon icon={group.icon} className="w-4 h-4"/> : <NavIcon iconKey={group.page} className="w-4 h-4"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#0F172A] truncate">{name}</div>
                      <div className="text-xs text-gray-400 truncate">{sec}</div>
                    </div>
                    {record.status && (
                      <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    )}
                    <span className="flex-shrink-0 text-gray-300 text-sm">→</span>
                  </button>
                );
              })}
            </div>
          ))}

          <div className="px-4 py-2.5 text-center text-xs text-gray-300 bg-gray-50">
            ↑↓ Navigate · Enter to open · Esc to close
          </div>
        </div>
      )}

      {/* No results */}
      {open && query.length >= 2 && results.length === 0 && (() => {
        const totalItems = searching ? 0 : 1;
        return (
          <div ref={panelRef} className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[20px] shadow-2xl border border-blue-100 px-6 py-8 text-center z-[100]">
            <div className="text-3xl mb-2">{totalItems === 0 ? '⏳' : '🔍'}</div>
            <div className="text-sm font-semibold text-gray-600">
              {totalItems === 0 ? 'Searching…' : `No records found for "${query}"`}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {totalItems === 0 ? 'One moment' : 'Try a different keyword, a phone number, or a record number like INV-00012'}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
