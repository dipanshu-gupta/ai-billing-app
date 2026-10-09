// @ts-nocheck
'use client';
import { relabelText } from '@/lib/useRelabel';
import React, { useRef, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { getPageLabel } from '@/lib/utils';
import { t } from '@/lib/i18n';
import GlobalSearch from '@/components/layout/GlobalSearch';
import RedwoodChromeSkin from '@/components/shared/RedwoodChromeSkin';
import { Bot, User, Info, LogOut, ClipboardList, Settings, CheckCircle2, Clock, Bell } from 'lucide-react';

// Page mapping from record_type to app page key — module scope since it's
// static and now shared between the dropdown and the full Notification
// Center below.
const NOTIFICATION_PAGE_MAP = {
  lead: 'leads', leads: 'leads',
  opportunity: 'opportunities', opportunities: 'opportunities',
  customer: 'customers', customers: 'customers',
  contact: 'contacts', contacts: 'contacts',
  order: 'orders', orders: 'orders',
  invoice: 'invoices', invoices: 'invoices',
  quotation: 'quotations', quotations: 'quotations',
  activity: 'activities', activities: 'activities',
  product: 'products', products: 'products',
  // Retail (B2C) object types were entirely missing here — a notification
  // created for e.g. a retail order (record_type: 'retailOrders', the exact
  // page key retail workflow/assignment/SLA rules use as objectType) had no
  // entry, so resolveNotificationTarget() always returned null for it and
  // the row rendered as non-navigable no matter what. This is why clicking
  // a retail notification did nothing even though CRM notifications already
  // worked.
  retailCustomers: 'retailCustomers', retailProducts: 'retailProducts',
  retailActivities: 'retailActivities', retailOrders: 'retailOrders',
  retailInvoices: 'retailInvoices',
  workflow: null, assignment: null, sla: null, approval: 'approvals',
};

const NOTIFICATION_TYPE_ICONS = {
  assignment: ClipboardList, workflow: Settings, approval: CheckCircle2,
  sla: Clock, notification: Bell, info: Info,
};

// B2B/B2C record-type visibility filtering — shared between the dropdown
// and the full Notification Center so "View all" doesn't briefly show
// notifications for the other business mode before navigating away.
const B2B_RECORD_TYPES = new Set([
  'lead','leads','opportunity','opportunities','customer','customers',
  'contact','contacts','order','orders','invoice','invoices',
  'quotation','quotations','activity','activities','product','products',
]);
const B2C_RECORD_TYPES = new Set([
  'retailCustomers','retailProducts','retailActivities',
  'retailOrders','retailInvoices',
]);

function visibleNotificationsFor(notifications, isB2C) {
  return (notifications || []).filter(n => {
    if (!n.record_type) return true; // system notifications always visible
    if (isB2C) return !B2B_RECORD_TYPES.has(n.record_type);
    return !B2C_RECORD_TYPES.has(n.record_type);
  });
}

function notificationTimeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// Resolves a notification's target record so both the dropdown and the
// full Notification Center can navigate to it the same way — extracted so
// that logic (and the id-field guessing it has to do, since notifications
// only ever store one generic record_id) lives in exactly one place.
function resolveNotificationTarget(n, recordArrays) {
  const page = NOTIFICATION_PAGE_MAP[n.record_type];
  if (!page || !n.record_id) return null;
  if (page === 'approvals') return { page: 'approvals', record: null };
  const arr = recordArrays[page] || [];
  const fullRecord = arr.find(r =>
    r.id === n.record_id || r._uuid === n.record_id || r.lead_number === n.record_id ||
    r.opportunity_number === n.record_id || r.customer_number === n.record_id ||
    r.order_number === n.record_id || r.invoice_number === n.record_id ||
    r.quote_number === n.record_id || r.contact_number === n.record_id ||
    r.activity_number === n.record_id || r.product_number === n.record_id
  );
  return { page, record: fullRecord || { id: n.record_id } };
}


function NotifItem({ n, isNavigable, IconCmp, onClick, timeAgo }) {
  return (
    <div onClick={onClick} className={`rwc-item ${isNavigable ? 'nav' : ''} ${!n.is_read ? 'unread' : ''}`}>
      <div className="rwc-ico">
        <IconCmp className="w-[16px] h-[16px]" strokeWidth={1.75}/>
        {!n.is_read && <span className="rwc-dot"/>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <p className="rwc-item-title">{relabelText(n.title)}</p>
          <span className="rwc-time">{timeAgo(n.created_at)}</span>
        </div>
        {(n.body || n.message) && <p className="rwc-item-body">{relabelText(n.body || n.message)}</p>}
        {isNavigable && <p className="rwc-open">Open record →</p>}
      </div>
    </div>
  );
}

function NotificationBell() {
  const {
    notifications, markNotificationRead, markAllNotificationsRead,
    leads, opportunities, customers, contacts, orders,
    invoices, quotations, activities, products,
    retailCustomers, retailProducts, retailActivities, retailOrders, retailInvoices,
    appPreferences, notificationDrawerOpen, setNotificationDrawerOpen,
  } = useApp();
  const isB2C = appPreferences?.b2c_mode === true;

  const visibleNotifications = visibleNotificationsFor(notifications, isB2C);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unread = visibleNotifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const PAGE_MAP = NOTIFICATION_PAGE_MAP;
  const TYPE_ICONS = NOTIFICATION_TYPE_ICONS;
  const timeAgo = notificationTimeAgo;

  const handleClick = async (n) => {
    // Mark as read first
    if (!n.is_read) await markNotificationRead(n.id);
    setOpen(false);

    const target = resolveNotificationTarget(n, {
      leads, opportunities, customers, contacts, orders,
      invoices, quotations, activities, products,
      retailCustomers, retailProducts, retailActivities, retailOrders, retailInvoices,
    });
    if (!target) return;

    if (target.page === 'approvals') {
      // Use the same event mechanism as global search / Customer360
      window.dispatchEvent(new CustomEvent('open-record', { detail: { page: 'approvals' } }));
      return;
    }

    // Dispatch open-crm-record event — handled by page.tsx which has the real setActivePage
    window.dispatchEvent(new CustomEvent('open-crm-record', {
      detail: { page: target.page, record: target.record, tab: null }
    }));
  };

  const handleMarkAll = async (e) => {
    e.stopPropagation();
    await markAllNotificationsRead();
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
        <div className="rwc-pop" style={{ width: 384 }}>
          <RedwoodChromeSkin />
          <div className="rwc-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 className="rwc-title" style={{ fontSize: 18 }}>Notifications</h3>
              {unread > 0 && <span className="rwc-badge">{unread} unread</span>}
            </div>
            {unread > 0 && <button onClick={handleMarkAll} className="rwc-link">Mark all read</button>}
          </div>
          <div className="rwc-stripe"/>
          <div className="rwc-list" style={{ maxHeight: 380 }}>
            {!visibleNotifications?.length ? (
              <div className="rwc-empty"><Bell className="w-8 h-8 mx-auto mb-2"/>No notifications yet</div>
            ) : (
              visibleNotifications.slice(0, 20).map(n => {
                const page = PAGE_MAP[n.record_type];
                const isNavigable = page && n.record_id;
                return <NotifItem key={n.id} n={n} isNavigable={isNavigable} IconCmp={TYPE_ICONS[n.type] || Bell} onClick={() => handleClick(n)} timeAgo={timeAgo}/>;
              })
            )}
          </div>
          <div className="rwc-foot">
            <span>{visibleNotifications.length > 0 ? `${visibleNotifications.length} shown here` : 'No notifications yet'}</span>
            <button onClick={() => { setOpen(false); setNotificationDrawerOpen(true); }} className="rwc-link">View all →</button>
          </div>
        </div>
      )}

      {notificationDrawerOpen && <NotificationCenter onClose={() => setNotificationDrawerOpen(false)} />}
    </div>
  );
}

// ─── Notification Center — full history, beyond the dropdown's 20-row preview ──
function NotificationCenter({ onClose }) {
  const {
    notifications, notificationsHasMore, loadMoreNotifications,
    markNotificationRead, markAllNotificationsRead,
    leads, opportunities, customers, contacts, orders,
    invoices, quotations, activities, products,
    retailCustomers, retailProducts, retailActivities, retailOrders, retailInvoices,
    appPreferences,
  } = useApp();
  const isB2C = appPreferences?.b2c_mode === true;
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [loadingMore, setLoadingMore] = useState(false);

  const visibleNotifications = visibleNotificationsFor(notifications, isB2C);
  const shown = tab === 'unread' ? visibleNotifications.filter(n => !n.is_read) : visibleNotifications;
  const unread = visibleNotifications.filter(n => !n.is_read).length;

  const handleClick = async (n) => {
    if (!n.is_read) await markNotificationRead(n.id);
    const target = resolveNotificationTarget(n, {
      leads, opportunities, customers, contacts, orders,
      invoices, quotations, activities, products,
      retailCustomers, retailProducts, retailActivities, retailOrders, retailInvoices,
    });
    if (!target) return;
    onClose();
    if (target.page === 'approvals') {
      window.dispatchEvent(new CustomEvent('open-record', { detail: { page: 'approvals' } }));
      return;
    }
    window.dispatchEvent(new CustomEvent('open-crm-record', {
      detail: { page: target.page, record: target.record, tab: null }
    }));
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try { await loadMoreNotifications(); } finally { setLoadingMore(false); }
  };

  return (
    <div className="rwc-overlay right" onClick={onClose} role="dialog" aria-modal="true" aria-label="Notification Center">
      <RedwoodChromeSkin />
      <div className="rwc-drawer" onClick={e => e.stopPropagation()}>
        <div className="rwc-head">
          <div>
            <h3 className="rwc-title">Notification Center</h3>
            <p className="rwc-subtitle">{unread} unread of {visibleNotifications.length}</p>
          </div>
          <button onClick={onClose} className="rwc-x" aria-label="Close">×</button>
        </div>
        <div className="rwc-stripe"/>
        <div className="rwc-bar">
          <div className="rwc-seg" role="tablist">
            {(['all', 'unread'] as const).map(k => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                {k === 'all' ? 'All' : `Unread (${unread})`}
              </button>
            ))}
          </div>
          {unread > 0 && <button onClick={() => markAllNotificationsRead()} className="rwc-link">Mark all read</button>}
        </div>
        <div className="rwc-list">
          {!shown.length ? (
            <div className="rwc-empty"><Bell className="w-10 h-10 mx-auto mb-2"/>{tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}</div>
          ) : (
            shown.map(n => {
              const page = NOTIFICATION_PAGE_MAP[n.record_type];
              const isNavigable = page && n.record_id;
              return <NotifItem key={n.id} n={n} isNavigable={isNavigable} IconCmp={NOTIFICATION_TYPE_ICONS[n.type] || Bell} onClick={() => handleClick(n)} timeAgo={notificationTimeAgo}/>;
            })
          )}
        </div>
        {tab === 'all' && notificationsHasMore && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--rw-border)', background: '#fff' }}>
            <button onClick={handleLoadMore} disabled={loadingMore} className="rwc-btn" style={{ width: '100%' }}>
              {loadingMore ? 'Loading…' : 'Load older notifications'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── About Dialog ────────────────────────────────────────────────────────────
function AboutDialog({ onClose }) {
  const rows = [
    { label: 'Version',   value: '26.3' },
    { label: 'Build',     value: 'July 2026' },
    { label: 'Modules',   value: 'CRM · B2C Retail · AI Advisor · CPQ · Reports' },
    { label: 'Platform',  value: 'Multi-tenant SaaS' },
    { label: 'Copyright', value: '© 2026 Umbrella Suite. All rights reserved.' },
  ];
  return (
    <div className="rwc-overlay center" style={{ zIndex: 300 }} onClick={onClose} role="dialog" aria-modal="true" aria-label="About Umbrella Suite">
      <RedwoodChromeSkin />
      <div className="rwc-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="rwc-head" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src="/umbrella-logo.png" alt="Umbrella Suite" style={{ width: 48, height: 48, borderRadius: 12 }}/>
            <div>
              <h2 className="rwc-title" style={{ fontSize: 22 }}>Umbrella Suite</h2>
              <p className="rwc-subtitle">Enterprise CRM &amp; ERP Platform</p>
            </div>
          </div>
          <button onClick={onClose} className="rwc-x" aria-label="Close">×</button>
        </div>
        <div className="rwc-stripe"/>
        <div className="rwc-modal-body">
          <div className="rwc-card">
            <dl className="rwc-kv">
              {rows.map(r => (<React.Fragment key={r.label}><dt>{r.label}</dt><dd style={{ fontWeight: 500 }}>{r.value}</dd></React.Fragment>))}
              <dt>Website</dt>
              <dd><a href="https://www.umbrellasuite.com" target="_blank" rel="noopener noreferrer" className="rwc-link" style={{ fontSize: 14 }}>www.umbrellasuite.com ↗</a></dd>
            </dl>
          </div>
        </div>
        <div className="rwc-modal-foot"><button onClick={onClose} className="rwc-btn primary">Close</button></div>
      </div>
    </div>
  );
}

export default function Header({ activePage, onNavigate }) {
  const { currentUser, handleLogout, appPreferences, appearance } = useApp();
  const [profileOpen, setProfileOpen] = useState(false);
  const [aboutOpen,   setAboutOpen]   = useState(false);
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
    home:'Home', dashboard:'Dashboard', customers:'Customers', contacts:'Contacts',
    leads:'Leads', opportunities:'Opportunities', activities:'Activities',
    quotations:'Quotations', orders:'Orders', invoices:'Invoices',
    products:'Products', reports:'Fast Reports', approvals:'My Approvals',
    adminTools:'Admin Tools',
  };
  const pageTitle = PAGE_LABELS[activePage] || getPageLabel(activePage) || 'Umbrella Suite';

  return (
    <>
    <header className="h-16 flex items-center justify-between px-6 shadow-lg border-b-2 border-black/25 flex-shrink-0 sticky top-0 z-30 bg-[#1C1917]">
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
        {/* Company name always sits above the date - previously it was only
            rendered when NO logo was uploaded, so a tenant with a logo saw
            just the date and their configured company name never appeared. */}
        <div className="min-w-0">
          <div className="text-base font-bold text-white leading-tight truncate max-w-[220px]">{appearance?.company_name||'Umbrella Suite'}</div>
          <p className="text-xs text-blue-300 leading-tight h-4" suppressHydrationWarning>{today}</p>
        </div>
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
          <Bot className="w-4 h-4" strokeWidth={1.75}/>
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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-md border-2 border-white/30 overflow-hidden">
              {currentUser?.avatar_url
                ? <img src={currentUser.avatar_url} alt="Profile" className="w-full h-full object-cover"/>
                : initials}
            </div>
            <svg className="w-3.5 h-3.5 text-white/60 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          {profileOpen && (
            <div className="rwc-pop" style={{ width: 272 }}>
              <RedwoodChromeSkin />
              <div className="rwc-head" style={{ justifyContent: 'flex-start', gap: 12 }}>
                <div className="rwc-avatar">
                  {currentUser?.avatar_url ? <img src={currentUser.avatar_url} alt="Profile"/> : initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p className="rwc-title" style={{ fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
                  <p className="rwc-subtitle" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser?.email}</p>
                </div>
              </div>
              <div className="rwc-stripe"/>
              <div>
                <button onClick={() => { window.dispatchEvent(new CustomEvent('open-profile')); setProfileOpen(false); }} className="rwc-menu-item">
                  <User className="w-4 h-4" strokeWidth={1.75}/> {t(appearance?.language||'en','myProfile')}
                </button>
                <button onClick={() => { setAboutOpen(true); setProfileOpen(false); }} className="rwc-menu-item">
                  <Info className="w-4 h-4" strokeWidth={1.75}/> About Umbrella Suite
                </button>
                <button onClick={() => { handleLogout(); setProfileOpen(false); }} className="rwc-menu-item danger" style={{ borderBottom: 0 }}>
                  <LogOut className="w-4 h-4" strokeWidth={1.75}/> {t(appearance?.language||'en','signOut')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
    {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)}/>}
    </>
  );
}
