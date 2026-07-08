// @ts-nocheck
'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { getPageLabel } from '@/lib/utils';
import { t } from '@/lib/i18n';
import GlobalSearch from '@/components/layout/GlobalSearch';

function NotificationBell() {
  const {
    notifications, markNotificationRead, markAllNotificationsRead,
    leads, opportunities, customers, contacts, orders,
    invoices, quotations, activities, products,
    appPreferences,
  } = useApp();
  const isB2C = appPreferences?.b2c_mode === true;

  // B2B record types — hidden in B2C mode
  const B2B_RECORD_TYPES = new Set([
    'lead','leads','opportunity','opportunities','customer','customers',
    'contact','contacts','order','orders','invoice','invoices',
    'quotation','quotations','activity','activities','product','products',
  ]);
  // B2C record types — hidden in B2B mode
  const B2C_RECORD_TYPES = new Set([
    'retailCustomers','retailProducts','retailActivities',
    'retailOrders','retailInvoices',
  ]);

  const visibleNotifications = (notifications || []).filter(n => {
    if (!n.record_type) return true; // system notifications always visible
    if (isB2C) return !B2B_RECORD_TYPES.has(n.record_type);
    return !B2C_RECORD_TYPES.has(n.record_type);
  });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unread = visibleNotifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Page mapping from record_type to app page key
  const PAGE_MAP = {
    lead: 'leads', leads: 'leads',
    opportunity: 'opportunities', opportunities: 'opportunities',
    customer: 'customers', customers: 'customers',
    contact: 'contacts', contacts: 'contacts',
    order: 'orders', orders: 'orders',
    invoice: 'invoices', invoices: 'invoices',
    quotation: 'quotations', quotations: 'quotations',
    activity: 'activities', activities: 'activities',
    product: 'products', products: 'products',
    workflow: null, assignment: null, sla: null, approval: 'approvals',
  };

  const TYPE_ICONS = {
    assignment: '📋', workflow: '⚙️', approval: '✅',
    sla: '⏱️', notification: '🔔', info: 'ℹ️',
  };

  const handleClick = async (n) => {
    // Mark as read first
    if (!n.is_read) await markNotificationRead(n.id);

    const page = PAGE_MAP[n.record_type];
    if (!page || !n.record_id) { setOpen(false); return; }

    setOpen(false);

    if (page === 'approvals') {
      // Use the same event mechanism as global search / Customer360
      window.dispatchEvent(new CustomEvent('open-record', { detail: { page: 'approvals' } }));
      return;
    }

    // Look up full record from local arrays
    const RECORD_ARRAYS: Record<string, any[]> = {
      leads, opportunities, customers, contacts, orders,
      invoices, quotations, activities, products,
    };
    const arr = RECORD_ARRAYS[page] || [];
    const fullRecord = arr.find(r =>
      r.id === n.record_id || r._uuid === n.record_id || r.lead_number === n.record_id ||
      r.opportunity_number === n.record_id || r.customer_number === n.record_id ||
      r.order_number === n.record_id || r.invoice_number === n.record_id ||
      r.quote_number === n.record_id || r.contact_number === n.record_id ||
      r.activity_number === n.record_id || r.product_number === n.record_id
    );

    // Dispatch open-crm-record event — handled by page.tsx which has the real setActivePage
    window.dispatchEvent(new CustomEvent('open-crm-record', {
      detail: { page, record: fullRecord || { id: n.record_id }, tab: null }
    }));
  };

  const handleMarkAll = async (e) => {
    e.stopPropagation();
    await markAllNotificationsRead();
  };

  const timeAgo = (ts) => {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors">
        <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold border-2 border-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-[#0F172A] to-blue-900">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">Notifications</span>
              {unread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unread} unread
                </span>
              )}
            </div>
            {unread > 0 && (
              <button onClick={handleMarkAll}
                className="text-xs text-blue-300 hover:text-white font-medium transition-colors">
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto divide-y divide-gray-50" style={{maxHeight:'380px'}}>
            {!visibleNotifications?.length ? (
              <div className="px-4 py-12 text-center">
                <div className="text-4xl mb-2">🔔</div>
                <p className="text-gray-400 text-sm">No notifications yet</p>
              </div>
            ) : (
              visibleNotifications.slice(0, 20).map(n => {
                const page = PAGE_MAP[n.record_type];
                const isNavigable = page && n.record_id;
                const icon = TYPE_ICONS[n.type] || '🔔';
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`px-4 py-3.5 transition-all ${
                      isNavigable ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default hover:bg-gray-50'
                    } ${!n.is_read ? 'bg-blue-50/60' : 'bg-white'}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon + unread dot */}
                      <div className="relative flex-shrink-0 mt-0.5">
                        <span className="text-lg">{icon}</span>
                        {!n.is_read && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full"/>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-tight ${!n.is_read ? 'font-semibold text-[#0F172A]' : 'font-medium text-gray-700'}`}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">{timeAgo(n.created_at)}</span>
                        </div>
                        {(n.body || n.message) && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body || n.message}</p>
                        )}
                        {isNavigable && (
                          <p className="text-[10px] text-blue-500 mt-1 font-medium">Click to open record →</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {visibleNotifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-center">
              <span className="text-xs text-gray-400">{visibleNotifications.length} total notification{visibleNotifications.length !== 1 ? 's' : ''}</span>
            </div>
          )}
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
  const pageTitle = PAGE_LABELS[activePage] || getPageLabel(activePage) || 'Umbrella Suite';

  return (
    <header className="h-16 flex items-center justify-between px-6 shadow-lg flex-shrink-0 sticky top-0 z-30"
      style={{background: appearance?.themeColors
        ? `linear-gradient(135deg, ${appearance.themeColors.sidebar}, ${appearance.themeColors.to})`
        : `linear-gradient(135deg, var(--bp-primary, #0F172A), var(--bp-secondary, #1e3a8a))`}}>
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
            <div className="text-base font-bold text-white leading-tight">{appearance?.company_name||'Umbrella Suite'}</div>
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
