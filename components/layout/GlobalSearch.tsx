// @ts-nocheck
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { getStatusColor } from '@/lib/utils';

const SEARCH_CONFIG = [
  { page:'customers',     icon:'👥', label:'Customers',    fields:['name','email','company','city'],                  secondary: r => r.industry || r.email || r.city },
  { page:'leads',         icon:'🎯', label:'Leads',        fields:['name','customer','source','email'],               secondary: r => `${r.customer||''} · ${r.status||''}` },
  { page:'opportunities', icon:'💼', label:'Opportunities',fields:['name','customer','stage'],                        secondary: r => `${r.customer||''} · ${r.stage||''}` },
  { page:'contacts',      icon:'📇', label:'Contacts',     fields:['name','email','customer','designation'],          secondary: r => `${r.customer||''} · ${r.designation||''}` },
  { page:'activities',    icon:'📅', label:'Activities',   fields:['name','customer','subject','activityType'],       secondary: r => `${r.customer||''} · ${r.activityType||''}` },
  { page:'quotations',    icon:'📄', label:'Quotations',   fields:['name','customer','quote_number'],                 secondary: r => `${r.customer||''} · ${r.status||''}` },
  { page:'orders',        icon:'🛒', label:'Orders',       fields:['name','customer'],                               secondary: r => `${r.customer||''} · ${r.status||''}` },
  { page:'invoices',      icon:'🧾', label:'Invoices',     fields:['name','customer'],                               secondary: r => `${r.customer||''} · ${r.status||''}` },
  { page:'products',      icon:'📦', label:'Products',     fields:['name','category','productFamily'],               secondary: r => `${r.category||''} · ${r.productFamily||''}` },
];

export default function GlobalSearch({ onNavigate }) {
  const {
    customers, leads, opportunities, contacts, activities,
    quotations, orders, invoices, products,
  } = useApp();

  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [open,    setOpen]    = useState(false);
  const [focused, setFocused] = useState(0);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  const dataMap = { customers, leads, opportunities, contacts, activities, quotations, orders, invoices, products };

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); setOpen(false); return; }
    const timer = setTimeout(() => {
      const q = query.toLowerCase();
      const found = [];
      SEARCH_CONFIG.forEach(cfg => {
        const items = dataMap[cfg.page] || [];
        const matches = items.filter(r =>
          cfg.fields.some(f => String(r[f] || '').toLowerCase().includes(q))
        ).slice(0, 4);
        if (matches.length) {
          found.push({ ...cfg, matches });
        }
      });
      setResults(found);
      setOpen(found.length > 0);
      setFocused(0);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, customers, leads, opportunities, contacts, activities, quotations, orders, invoices, products]);

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
    // Dispatch a single event — AppShell handles both navigation AND opening the record
    window.dispatchEvent(new CustomEvent('open-record', { detail: { page, record } }));
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
                <span className="text-base">{group.icon}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{group.label}</span>
                <span className="ml-auto text-xs text-gray-400">{group.matches.length} result{group.matches.length!==1?'s':''}</span>
              </div>

              {/* Records */}
              {group.matches.map(record => {
                const idx  = globalIdx++;
                const isFocused = idx === focused;
                const name = record.name || record.quote_number || record.id;
                const sec  = group.secondary(record);
                return (
                  <button key={record.id || idx}
                    onClick={() => handleSelect(group.page, record)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 transition-all hover:bg-blue-50
                      ${isFocused ? 'bg-blue-50' : 'bg-white'}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0
                      ${isFocused ? 'bg-[#0F172A] text-white' : 'bg-blue-100 text-blue-700'}`}>
                      {group.icon}
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
      {open && query.length >= 2 && results.length === 0 && (
        <div ref={panelRef} className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[20px] shadow-2xl border border-blue-100 px-6 py-8 text-center z-[100]">
          <div className="text-3xl mb-2">🔍</div>
          <div className="text-sm font-semibold text-gray-600">No records found for "{query}"</div>
          <div className="text-xs text-gray-400 mt-1">Try a different keyword</div>
        </div>
      )}
    </div>
  );
}
