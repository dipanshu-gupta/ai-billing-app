// @ts-nocheck
'use client';

import { useState, useRef, useEffect } from 'react';
import { t, THEMES } from '@/lib/i18n';
import { useApp } from '@/context/AppContext';

const TOP_ITEMS = [
  { key:'dashboard', label:'dashboard', icon:'🏠', permission:null },
];

const SALES_GROUP = [
  { key:'customers',     label:'customers',     icon:'👥', permission:'customers_view'  },
  { key:'contacts',      label:'contacts',      icon:'📇', permission:'contacts_view',      requiresCRM:true },
  { key:'leads',         label:'leads',         icon:'🎯', permission:'leads_view',          requiresCRM:true },
  { key:'opportunities', label:'opportunities', icon:'💼', permission:'opportunities_view',  requiresCRM:true },
  { key:'activities',    label:'activities',    icon:'📅', permission:'activities_view' },
  { key:'products',      label:'products',      icon:'📦', permission:'products_view'   },
  { key:'quotations',    label:'quotations',    icon:'📄', permission:null, requiresCPQ:true },
];

const BOTTOM_ITEMS = [
  { key:'orders',     label:'orders',      icon:'🛒', permission:'orders_view' },
  { key:'invoices',   label:'invoices',    icon:'🧾', permission:'invoices_view' },
  { key:'reports',    label:'reports',     icon:'⚡', permission:null },
  { key:'approvals',  label:'approvals',   icon:'✅', permission:null },
  { key:'adminTools', label:'adminTools',  icon:'⚙️', permission:'admin_tools_view' },
];

export default function Sidebar({ activePage, setActivePage, collapsed, setCollapsed }) {
  const { currentUser, currentUserPermissions, permissionsLoaded, appPreferences, appearance } = useApp();
  const [salesOpen, setSalesOpen] = useState(true);
  const ref = useRef(null);

  // Auto-collapse when clicking outside the sidebar
  useEffect(() => {
    const handler = (e) => {
      if (!collapsed && ref.current && !ref.current.contains(e.target)) {
        setCollapsed(true);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [collapsed, setCollapsed]);

  const canSee = (item) => {
    if (item.requiresCRM && appPreferences?.crm_enabled === false) return false;
    if (item.requiresCPQ && appPreferences?.cpq_enabled === false) return false;
    if (!item.permission) return true;
    if (!permissionsLoaded) return true;
    if (currentUserPermissions.includes('__admin__')) return true;
    return currentUserPermissions.includes(item.permission);
  };

  const NavItem = ({ item }) => {
    if (!canSee(item)) return null;
    const active = activePage === item.key;
    return (
      <button
        onClick={() => { setActivePage(item.key); setCollapsed(true); }}
        title={t(lang, item.label)}
        className={`w-full flex items-center gap-3 rounded-2xl transition-all duration-200 py-2.5 px-3 text-sm font-medium
          ${active
            ? 'bg-white text-[#0F172A] shadow-lg'
            : 'text-blue-100 hover:bg-white/10 hover:text-white'
          }`}
      >
        <span className="text-lg flex-shrink-0">{item.icon}</span>
        {!collapsed && <span className="truncate flex-1 text-left">{t(lang, item.label)}</span>}
      </button>
    );
  };

  const lang      = appearance?.language || 'en';
  const themeObj  = THEMES.find(th => th.id === (appearance?.theme || 'navy')) || THEMES[0];
  const sidebarBg = themeObj.sidebar;

  return (
    <aside
      ref={ref}
      className={`${collapsed ? 'w-16' : 'w-64'} text-white transition-all duration-300 min-h-screen sticky top-0 shadow-2xl flex-shrink-0 flex flex-col z-40`}
      style={{background: sidebarBg}}
    >
      {/* Top: Hamburger menu */}
      <div className="h-16 flex items-center justify-center px-3 border-b border-white/10 flex-shrink-0">
        {collapsed ? (
          // Collapsed: show hamburger icon
          <button
            onClick={() => setCollapsed(false)}
            className="w-10 h-10 flex flex-col items-center justify-center gap-1.5 rounded-xl hover:bg-white/10 transition-colors"
            title="Open menu"
          >
            <span className="w-5 h-0.5 bg-white rounded-full"/>
            <span className="w-5 h-0.5 bg-white rounded-full"/>
            <span className="w-5 h-0.5 bg-white rounded-full"/>
          </button>
        ) : (
          // Expanded: show logo + close (X) button
          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              </div>
              <div className="font-bold text-white text-base leading-tight">Navigator</div>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors text-lg"
              title="Collapse menu"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">

        {/* Dashboard */}
        {TOP_ITEMS.map(item => <NavItem key={item.key} item={item}/>)}

        {/* Sales group */}
        <div className="mt-2">
          {!collapsed ? (
            <button
              onClick={() => setSalesOpen(!salesOpen)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-bold text-blue-400 uppercase tracking-widest hover:text-blue-200 transition-colors"
            >
              <span>Sales</span>
              <span style={{transform: salesOpen?'rotate(180deg)':'rotate(0)', transition:'transform 0.2s'}}>▾</span>
            </button>
          ) : (
            <div className="border-t border-white/10 my-2"/>
          )}
          <div style={{overflow:'hidden', maxHeight: (!collapsed && !salesOpen) ? '0' : '500px', transition:'max-height 0.3s ease'}}>
            {SALES_GROUP.map(item => <NavItem key={item.key} item={item}/>)}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-2"/>

        {/* Operations */}
        {!collapsed && (
          <div className="px-3 py-1 text-xs font-bold text-blue-400 uppercase tracking-widest">Operations</div>
        )}
        {BOTTOM_ITEMS.map(item => <NavItem key={item.key} item={item}/>)}
      </nav>

      {/* User info at bottom */}
      {!collapsed && currentUser && (
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center font-bold text-xs text-white flex-shrink-0 border border-white/20">
              {currentUser.first_name?.charAt(0)}{currentUser.last_name?.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-semibold text-white truncate">{currentUser.first_name} {currentUser.last_name}</div>
              <div className="text-xs text-blue-300 truncate">{currentUser.designation || 'Employee'}</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
