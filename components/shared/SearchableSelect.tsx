// @ts-nocheck
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

interface Option {
  value: string;
  label: string;
  sub?: string;      // secondary line
  icon?: string;     // emoji/icon prefix
}

interface SearchableSelectProps {
  options:      Option[];
  value:        string;
  onChange:     (value: string) => void;
  placeholder?:  string;
  disabled?:    boolean;
  className?:   string;
  emptyLabel?:  string;    // label for the blank/none option
  showEmpty?:   boolean;
  onCreateNew?: (query: string) => void;  // if provided, shows "+ Create New" button
  createLabel?: string;                   // e.g. "Create Customer"
}

export default function SearchableSelect({
  options, value, onChange,
  placeholder = 'Search or select...',
  disabled = false,
  className = '',
  emptyLabel = 'None',
  showEmpty = true,
  onCreateNew,
  createLabel = 'Create New',
}: SearchableSelectProps) {
  const [open,   setOpen]   = useState(false);
  const [query,  setQuery]  = useState('');
  const [focused,setFocused]= useState(-1);
  const [dropPos, setDropPos] = useState<{top:number,left:number,width:number} | null>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);

  // Selected label
  const selectedOption = options.find(o => o.value === value);
  const displayLabel   = selectedOption?.label || '';

  // Filter options
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      (o.sub  && o.sub.toLowerCase().includes(q))
    );
  }, [query, options]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        setFocused(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll focused item into view
  useEffect(() => {
    if (focused >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-option]');
      items[focused]?.scrollIntoView({ block: 'nearest' });
    }
  }, [focused]);

  const openDropdown = () => {
    if (disabled) return;
    // Calculate position for fixed dropdown — escapes any overflow:hidden parent
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropHeight = 240;
      // Open upward if not enough space below
      const openUp = spaceBelow < dropHeight && spaceAbove > spaceBelow;
      setDropPos({
        top: openUp ? rect.top - dropHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
    setOpen(true);
    setQuery('');
    setFocused(-1);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const selectOption = (val: string) => {
    onChange(val);
    setOpen(false);
    setQuery('');
    setFocused(-1);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    const total = filtered.length + (showEmpty ? 1 : 0);
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, total - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, showEmpty ? -1 : 0)); }
    if (e.key === 'Escape')    { setOpen(false); setQuery(''); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (focused === -1 && showEmpty) { selectOption(''); return; }
      const idx = showEmpty ? focused : focused;
      const opt = showEmpty ? (focused === 0 ? null : filtered[focused - 1]) : filtered[focused];
      if (opt) selectOption(opt.value);
      else if (focused === 0 && showEmpty) selectOption('');
    }
  };

  const highlight = (text: string) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-100 text-yellow-800 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const base = `w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400'} ${className}`;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      {!open ? (
        <div
          role="combobox"
          aria-expanded={false}
          onClick={openDropdown}
          className={`${base} flex items-center justify-between gap-2 select-none`}
        >
          <span className={`truncate flex-1 ${!displayLabel ? 'text-gray-400' : ''}`}>
            {selectedOption?.icon && <span className="mr-1.5">{selectedOption.icon}</span>}
            {displayLabel || placeholder}
          </span>
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      ) : (
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setFocused(-1); }}
          onKeyDown={handleKey}
          placeholder={`Search ${displayLabel || placeholder}...`}
          className={`${base} ring-2 ring-blue-400 border-blue-400`}
          autoComplete="off"
        />
      )}

      {/* Dropdown — fixed position to escape overflow:hidden parents (tables etc) */}
      {open && dropPos && (
        <div
          ref={listRef}
          className="bg-white rounded-2xl border border-blue-100 shadow-2xl overflow-hidden"
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            maxHeight: '240px',
            overflowY: 'auto',
            zIndex: 9999,
          }}
        >
          {showEmpty && (
            <div
              data-option
              onMouseDown={() => selectOption('')}
              className={`px-4 py-2.5 text-sm cursor-pointer flex items-center gap-2 transition-colors
                ${focused === 0 ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <span className="text-base">✕</span> {emptyLabel}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="px-4 py-4 text-center text-sm text-gray-400">
              {query ? `No results for "${query}"` : 'No options available'}
              {onCreateNew && (
                <button
                  onMouseDown={e=>{e.preventDefault();e.stopPropagation();onCreateNew(query);setOpen(false);setQuery('');}}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors">
                  <span>+</span> {query ? `Create "${query}"` : `${createLabel}`}
                </button>
              )}
            </div>
          ) : (
            filtered.map((opt, i) => {
              const idx   = showEmpty ? i + 1 : i;
              const isSelected = opt.value === value;
              const isFocused  = idx === focused;
              return (
                <div
                  key={opt.value}
                  data-option
                  onMouseDown={() => selectOption(opt.value)}
                  className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-start gap-2.5
                    ${isFocused   ? 'bg-blue-50' : ''}
                    ${isSelected  ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  `}
                >
                  {opt.icon && <span className="text-base flex-shrink-0 mt-0.5">{opt.icon}</span>}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${isSelected ? 'text-blue-700' : 'text-[#0F172A]'}`}>
                      {highlight(opt.label)}
                    </div>
                    {opt.sub && (
                      <div className="text-xs text-gray-400 truncate mt-0.5">{opt.sub}</div>
                    )}
                  </div>
                  {isSelected && <span className="text-blue-500 text-base flex-shrink-0">✓</span>}
                </div>
              );
            })
          )}
          {onCreateNew && (
            <div
              onMouseDown={e=>{e.preventDefault();e.stopPropagation();onCreateNew(query);setOpen(false);setQuery('');}}
              className="px-4 py-2.5 border-t border-blue-50 flex items-center gap-2 cursor-pointer text-blue-600 hover:bg-blue-50 transition-colors sticky bottom-0 bg-white"
            >
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">+</span>
              <span className="text-sm font-semibold">{query ? `Create "${query}"` : createLabel}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
