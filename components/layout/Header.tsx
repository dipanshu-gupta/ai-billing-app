// @ts-nocheck
'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { getPageLabel } from '@/lib/utils';
import { t } from '@/lib/i18n';
import GlobalSearch from '@/components/layout/GlobalSearch';

function NotificationBell() {
  const { notifications } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unread = (notifications || []).filter(n => !n.is_read).length;

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors">
        <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-400 text-white text-[10px] rounded-full flex items-center justify-center font-bold border border-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-800 text-sm">Notifications</span>
            {unread > 0 && <span className="text-xs text-blue-600 font-medium">{unread} unread</span>}
          </div>
          <div className="overflow-y-auto" style={{maxHeight:'320px'}}>
            {!notifications?.length
              ? <div className="px-4 py-8 text-center text-gray-400 text-sm">No notifications</div>
              : notifications.slice(0,10).map(n => (
                <div key={n.id} className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${!n.is_read?'bg-blue-50/50':''}`}>
                  <div className="text-sm font-medium text-gray-800">{n.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body||n.message}</div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header({ activePage, onNavigate }) {
  const { currentUser, handleLogout, appPreferences, appearance } = useApp();
  const [profileOpen, setProfileOpen] = useState(false);
  const [today, setToday] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    setToday(new Date().toLocaleDateString('en-IN', {
      weekday:'long', day:'numeric', month:'long', year:'numeric',
    }));
  }, []);

  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setProfileOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const displayName = currentUser
    ? `${currentUser.first_name||''} ${currentUser.last_name||''}`.trim() || currentUser.email
    : '';
  const initials = displayName
    ? displayName.split(' ').filter(Boolean).map(n=>n[0]).join('').toUpperCase().slice(0,2)
    : '?';

  const PAGE_LABELS = {
    dashboard:'Dashboard', customers:'Customers', contacts:'Contacts',
    leads:'Leads', opportunities:'Opportunities', activities:'Activities',
    quotations:'Quotations', orders:'Orders', invoices:'Invoices',
    products:'Products', reports:'Fast Reports', approvals:'My Approvals',
    adminTools:'Admin Tools',
  };
  const pageTitle = PAGE_LABELS[activePage] || getPageLabel(activePage) || 'Business Pro';

  return (
    <header className="h-16 flex items-center justify-between px-6 shadow-lg flex-shrink-0 sticky top-0 z-30"
      style={{background: `linear-gradient(135deg, var(--bp-primary, #0F172A), var(--bp-secondary, #1e3a8a))`}}>
      {/* Left: Company logo / branding */}
      <div className="flex items-center gap-3">
        {appearance?.company_logo_url
          ? <img src={appearance.company_logo_url} alt="logo"
              className="h-10 object-contain rounded-xl bg-white/10 p-1 max-w-[160px]"
              onError={e => { e.currentTarget.style.display='none'; }}/>
          : <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center font-black text-[#0F172A] text-sm shadow-md flex-shrink-0">
              {(appearance?.company_name||'BP').slice(0,2).toUpperCase()}
            </div>
        }
        {!appearance?.company_logo_url && (
          <div>
            <div className="text-base font-bold text-white leading-tight">{appearance?.company_name||'Business Pro'}</div>
            <p className="text-xs text-blue-300 leading-tight h-4" suppressHydrationWarning>{today}</p>
          </div>
        )}
        {appearance?.company_logo_url && (
          <p className="text-xs text-blue-300 leading-tight" suppressHydrationWarning>{today}</p>
        )}
      </div>

      {/* Center: Global Search */}
      {appPreferences?.global_search_enabled && (
        <GlobalSearch onNavigate={onNavigate}/>
      )}

      {/* Right: AI + Bell + Profile */}
      <div className="flex items-center gap-2">

        {/* AI Advisor */}
        <button onClick={() => window.dispatchEvent(new CustomEvent('toggle-ai-chat'))}
          title="Business Advisor Agent"
          className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all border border-white/20 text-sm font-semibold">
          <span>🤖</span>
          <span className="hidden sm:inline">{t(appearance?.language||'en','aiAdvisor')}</span>
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0F172A]"/>
        </button>

        {/* Notification bell */}
        <NotificationBell />

        {/* Divider */}
        <div className="w-px h-6 bg-white/20 mx-1"/>

        {/* Profile */}
        <div ref={menuRef} className="relative">
          <button onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-xl hover:bg-white/10 transition-all">
            {/* Company logo / avatar */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-md border-2 border-white/30">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-white leading-tight">{displayName}</p>
              <p className="text-xs text-blue-300 leading-tight">{currentUser?.designation || 'User'}</p>
            </div>
            <svg className="w-3.5 h-3.5 text-white/60 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-60 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-4 bg-gradient-to-r from-[#0F172A] to-blue-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm border-2 border-white/30">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{displayName}</p>
                  <p className="text-xs text-blue-300 mt-0.5">{currentUser?.email}</p>
                </div>
              </div>
              <div className="py-1">
                <button onClick={() => { window.dispatchEvent(new CustomEvent('open-profile')); setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <span>👤</span> My Profile
                </button>
                <button onClick={() => { handleLogout(); setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <span>🚪</span> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
