// @ts-nocheck
'use client';

import { useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { navigationItems } from '@/lib/utils';

export default function Sidebar({ activePage, setActivePage, collapsed, setCollapsed }) {
  const { currentUser, currentUserPermissions, permissionsLoaded } = useApp();
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setCollapsed(true);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setCollapsed]);

  const canSee = (item) => {
    if (!item.permission) return true;
    if (permissionsLoaded && currentUserPermissions.length > 0 && !currentUserPermissions.includes(item.permission)) return false;
    return true;
  };

  return (
    <aside ref={ref} className={`${collapsed ? 'w-20' : 'w-64'} bg-[#0F172A] text-white transition-all duration-300 min-h-screen sticky top-0 shadow-2xl flex-shrink-0 flex flex-col`}>
      <div className={`p-5 border-b border-white/10 ${collapsed ? 'flex justify-center' : ''}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 rounded-2xl bg-white text-[#0F172A] flex items-center justify-center font-bold text-lg flex-shrink-0">BP</div>
          {!collapsed && <div><div className="font-bold text-white">Business Pro</div><div className="text-xs text-blue-300">Enterprise CRM</div></div>}
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navigationItems.filter(canSee).map((item) => {
          const active = activePage === item.key;
          return (
            <button key={item.key} onClick={() => { setActivePage(item.key); setCollapsed(true); }} title={collapsed ? item.label : ''}
              className={`w-full flex items-center gap-3 rounded-2xl transition-all duration-200 py-3 px-3 text-sm font-medium ${active ? 'bg-white text-[#0F172A] shadow-lg' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}>
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>
      {!collapsed && currentUser && (
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm flex-shrink-0">
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