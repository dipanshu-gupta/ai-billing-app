// @ts-nocheck
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Target, ShoppingBag, Receipt, CalendarCheck, MessageCircle, CheckCircle2, BarChart3, Settings } from 'lucide-react';
import { AppProvider, useApp } from '@/context/AppContext';
import { THEMES } from '@/lib/i18n';
import { TenantProvider, useTenant } from '@/context/TenantContext';
import { AlertProvider, useAlert } from '@/components/shared/AlertProvider';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DashboardPage from '@/components/dashboard/DashboardPage';
import ExpressDashboard from '@/components/dashboard/ExpressDashboard';
import { useRbac } from '@/lib/useRbac';
import CRMListPage from '@/components/crm/CRMListPage';
import RetailListPage from '@/components/retail/RetailListPage';
import ManageBookingsPage from '@/components/retail/ManageBookingsPage';
import WhatsAppInboxPage from '@/components/whatsapp/WhatsAppInboxPage';
import SpringboardPage from '@/components/layout/SpringboardPage';
import RetailDashboard from '@/components/retail/RetailDashboard';
import AdminToolsPage from '@/components/admin/AdminToolsPage';
import ApprovalsInboxPage from '@/components/approvals/ApprovalsInboxPage';
import QuotationsPage from '@/components/quotations/QuotationsPage';
import AIAdvisorChat from '@/components/ai/AIAdvisorChat';
import FastReportsPage from '@/components/reports/FastReportsPage';
import RecordDetailPanel from '@/components/crm/RecordDetailPanel';
import DynamicObjectPage from '@/components/shared/DynamicObjectPage';
import Modal from '@/components/shared/Modal';
import { inputClass, Button } from '@/components/shared';

// ─── Login Page ───────────────────────────────────────────────────────────────

function LoginPage() {
  const { handleLogin } = useApp();
  const { tenant } = useTenant();
  const [email,      setEmail]      = React.useState('');
  const [password,   setPassword]   = React.useState('');
  const [loading,    setLoading]    = React.useState(false);
  const [workspace,  setWorkspace]  = React.useState('');
  const [showWS,     setShowWS]     = React.useState(false);

  // Detect if this is master app (no ?tenant= param)
  const isMaster = typeof window !== 'undefined'
    ? !new URLSearchParams(window.location.search).get('tenant')
    : false;

  // Tenant-level logo from appearance (set in app preferences)
  const { appearance } = useApp();
  const themeObj = THEMES.find(th => th.id === (appearance?.theme || 'navy')) || THEMES[0];
  const tenantLogo = appearance?.company_logo_url || tenant?.logo_url || null;
  const tenantName = appearance?.company_name || tenant?.app_name || tenant?.name || 'Umbrella Suite';
  const isDemo     = !tenant?.slug || tenant?.slug === 'demo';

  // A different thought each day - deterministic by day-of-year, so it's
  // stable across reloads within the same day but genuinely changes
  // tomorrow, rather than reshuffling randomly on every visit.
  const DAILY_THOUGHTS = [
    "The best time to follow up with a customer was yesterday. The second best time is now.",
    "A system you trust is worth more than a memory you rely on.",
    "Every closed deal started as someone willing to send one more message.",
    "Small, consistent follow-through beats occasional bursts of effort.",
    "The customer who feels remembered is the customer who comes back.",
    "Good records today save a difficult conversation tomorrow.",
    "Momentum is built one completed task at a time, not one big push.",
    "The businesses that grow are the ones that make it easy to say yes.",
    "Clarity in your pipeline is clarity in your next decision.",
    "A quick reply is often worth more than a perfect one.",
  ];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const dailyThought = DAILY_THOUGHTS[dayOfYear % DAILY_THOUGHTS.length];

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await handleLogin(email, password);
    setLoading(false);
  };

  const goToWorkspace = (e) => {
    e.preventDefault();
    const slug = workspace.trim().toLowerCase().replace(/\s+/g, '-');
    if (!slug) return;
    window.location.href = `${window.location.origin}/?tenant=${slug}`;
  };

  // The platform's actual modules, sheltered under the umbrella illustration —
  // not generic ERP terms, the real feature set this specific app ships.
  // Line-art icons (lucide-react, same set used in the app's own nav —
  // see lib/icons.tsx ICON_MAP) rather than emoji, for a cleaner, more
  // professional first impression.
  const MODULES = [
    { Icon: Target,        label: 'CRM & Sales' },
    { Icon: ShoppingBag,   label: 'Retail & Orders' },
    { Icon: Receipt,       label: 'Invoicing' },
    { Icon: CalendarCheck, label: 'Bookings' },
    { Icon: MessageCircle, label: 'WhatsApp' },
    { Icon: CheckCircle2,  label: 'Workflows' },
    { Icon: BarChart3,     label: 'Reports' },
    { Icon: Settings,      label: 'Automation' },
  ];

  return (
    <div className="min-h-screen flex bg-white">
      {/* ── Left panel: sign-in form — kept deliberately restrained, no
          decoration competing with the hero on the right */}
      <div className="w-full lg:w-[440px] flex-shrink-0 flex flex-col justify-center px-8 sm:px-14 py-12">
        <div className="w-full max-w-sm mx-auto space-y-8">
          {/* Logo header */}
          <div>
            <div className="flex items-center gap-4 mb-8">
              <div style={{ background: themeObj.colors[0] }} className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
                <img src="/umbrella-logo-white.png" alt="Umbrella Suite" className="w-9 h-9 object-contain"/>
              </div>
              {!isDemo && tenantLogo && (
                <>
                  <div className="h-8 w-px bg-gray-200"/>
                  <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden p-1 flex-shrink-0">
                    <img src={tenantLogo} alt={tenantName} className="w-full h-full object-contain"/>
                  </div>
                </>
              )}
            </div>
            {isDemo ? (
              <div>
                <h1 className="text-lg font-bold text-[#0F172A]">Umbrella Suite</h1>
                <p className="text-gray-400 text-sm mt-0.5">Enterprise CRM &amp; ERP Platform</p>
              </div>
            ) : (
              <div>
                <h1 className="text-lg font-bold text-[#0F172A]">{tenantName}</h1>
              </div>
            )}
          </div>

          {/* Sign in form */}
          {!showWS && (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-[#0F172A]">Welcome</h2>
                <p className="text-gray-400 text-sm mt-1">Sign in to your workspace</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@company.com" className={inputClass}/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••" className={inputClass}/>
              </div>
              <button type="submit" disabled={loading}
                style={{ background: themeObj.colors[0] }}
                className="w-full text-white py-3.5 rounded-xl font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60">
                {loading ? 'Signing In...' : 'Sign In →'}
              </button>

              {/* Switch workspace — only show on master app */}
              {isMaster && (
                <button type="button" onClick={() => setShowWS(true)}
                  className="w-full text-center text-sm text-gray-400 hover:text-[#0F172A] transition-colors pt-1">
                  🏢 Sign in to a different workspace →
                </button>
              )}
            </form>
          )}

          {/* Workspace entry */}
          {showWS && (
            <form onSubmit={goToWorkspace} className="space-y-5">
              <div>
                <div className="text-2xl mb-1">🏢</div>
                <h2 className="text-xl font-bold text-[#0F172A]">Enter your workspace</h2>
                <p className="text-sm text-gray-400 mt-1">Type your workspace name to navigate to it</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Workspace Name</label>
                <input type="text" value={workspace} onChange={e => setWorkspace(e.target.value)} required
                  placeholder="e.g. infunity, jumpandjoy"
                  className={inputClass}
                  autoFocus/>
                <p className="text-xs text-gray-400 mt-1">
                  cloud.umbrellasuite.com/?tenant=<span className="font-mono text-blue-600">{workspace||'yourworkspace'}</span>
                </p>
              </div>
              <button type="submit"
                style={{ background: themeObj.colors[0] }}
                className="w-full text-white py-3.5 rounded-xl font-bold shadow-sm hover:opacity-90 transition-opacity">
                Go to Workspace →
              </button>
              <button type="button" onClick={() => setShowWS(false)}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors">
                ← Back to sign in
              </button>
            </form>
          )}

          <p className="text-center text-gray-500 text-xs pt-4">
            Powered by Umbrella Suite · Enterprise ERP &amp; CRM
          </p>
        </div>
      </div>

      {/* ── Right panel: hero — hidden below lg, since a split-screen visual
          is a nice-to-have on desktop, not something worth the scroll cost
          on a phone signing in. border-l creates a clear seam against the
          left panel, which previously had no visible separation at all. */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-b from-[#DBEAFE] via-[#EFF6FF] to-white border-l border-black/10">
        <div className="relative z-10 flex flex-col w-full h-full px-16 pt-16 pb-10">
          <div>
            {/* No max-w cap (previously max-w-lg/512px forced an awkward
                3-line wrap with a lot of unused width to the right) —
                lets the line use the full panel width, growing with the
                viewport so it reads as one clean line on typical desktop
                sizes instead of a cramped ragged wrap. */}
            <h2 className="text-[2rem] md:text-[2.5rem] xl:text-[2.9rem] 2xl:text-[3.25rem] leading-[1.15] font-bold text-[#0F172A] text-balance">
              Every part of your business, under one umbrella.
            </h2>
            <p className="text-slate-500 text-lg mt-4 max-w-md">
              {dailyThought}
            </p>
          </div>

          {/* Umbrella illustration sheltering the module cards — the actual
              brand mark itself, scaled up, not a redrawn approximation.
              Centered in the remaining vertical space (rather than pushed
              to the bottom) and given a slow, gentle float for a touch of
              life on an otherwise static screen. */}
          <div className="relative flex-1 flex flex-col items-center justify-center gap-8">
            <div style={{ background: themeObj.colors[0] }} className="float-umbrella w-40 h-40 rounded-[28px] shadow-xl shadow-blue-900/20 flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src="/umbrella-logo-white.png" alt="Umbrella Suite" className="w-full h-full object-contain"/>
            </div>

            {/* Module cards, beneath the umbrella */}
            <div className="grid grid-cols-4 gap-3 w-full max-w-2xl">
              {MODULES.map(m => (
                <div key={m.label} className="bg-white rounded-xl border border-blue-100 shadow-sm px-3 py-3 flex flex-col items-center gap-1.5 text-center">
                  <m.Icon size={20} strokeWidth={1.75} style={{ color: themeObj.colors[0] }} />
                  <span className="text-[11px] font-semibold text-slate-600 leading-tight">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Modal ────────────────────────────────────────────────────────────

function ProfileModal({ open, onClose }) {
  const { currentUser, saveMyProfile, resetMyPassword } = useApp();
  const { supabase } = useTenant();
  const { showAlert } = useAlert();
  const [form, setForm] = useState({
    first_name: currentUser?.first_name || '',
    last_name:  currentUser?.last_name  || '',
    phone:      currentUser?.phone      || '',
    avatar_url: currentUser?.avatar_url || '',
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  // Re-sync form when currentUser loads (e.g. after provisioning)
  useEffect(() => {
    if (currentUser) {
      setForm({
        first_name: currentUser.first_name || '',
        last_name:  currentUser.last_name  || '',
        phone:      currentUser.phone      || '',
        avatar_url: currentUser.avatar_url || '',
      });
    }
  }, [currentUser?.id]);
  const [newPassword, setNewPassword] = useState('');

  // Uploads a profile photo to the same Supabase storage bucket already
  // used for the company logo, just under a per-user path - reuses an
  // established, working pattern rather than a new upload mechanism.
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !supabase || !currentUser) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `avatars/${currentUser.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('company-assets')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) { showAlert('Upload failed: ' + upErr.message, { variant:'danger', title:'Upload Failed' }); return; }
      const { data } = supabase.storage.from('company-assets').getPublicUrl(path);
      const url = data.publicUrl + '?t=' + Date.now();
      setForm(f => ({ ...f, avatar_url: url }));
    } catch (err) {
      showAlert('Upload error: ' + err.message, { variant:'danger', title:'Upload Failed' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="My Profile"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={async () => { await saveMyProfile(form); onClose(); }}>Save Changes</Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Profile photo */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xl font-bold shadow-md overflow-hidden flex-shrink-0">
            {form.avatar_url
              ? <img src={form.avatar_url} alt="Profile" className="w-full h-full object-cover"/>
              : (`${currentUser?.first_name?.[0]||''}${currentUser?.last_name?.[0]||''}`.toUpperCase() || '?')}
          </div>
          <div>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload}/>
            <button type="button" disabled={uploadingPhoto} onClick={() => photoInputRef.current?.click()}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-60">
              {uploadingPhoto ? 'Uploading...' : form.avatar_url ? 'Change Photo' : 'Add Photo'}
            </button>
            {form.avatar_url && (
              <button type="button" onClick={() => setForm(f => ({ ...f, avatar_url: '' }))}
                className="text-sm text-gray-400 hover:text-gray-600 ml-3">Remove</button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[['First Name', 'first_name'], ['Last Name', 'last_name'], ['Phone', 'phone']].map(([label, field]) => (
            <div key={field} className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</label>
              <input value={form[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} className={inputClass} />
            </div>
          ))}
        </div>
        <div className="bg-gray-50 rounded-2xl p-4 space-y-1 text-sm">
          <div><span className="text-gray-400">Email: </span><span className="font-semibold">{currentUser?.email}</span></div>
          <div><span className="text-gray-400">Employee Code: </span><span className="font-semibold">{currentUser?.employee_code}</span></div>
          <div><span className="text-gray-400">Designation: </span><span className="font-semibold">{currentUser?.designation}</span></div>
        </div>
        <div className="border-t border-blue-100 pt-4 space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1.5">Change My Password</label>
            <p className="text-xs text-gray-400 mb-3">Enter a new password to update your login credentials. Minimum 6 characters.</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className={inputClass}
              />
            </div>
            <Button
              onClick={async () => {
                if (!newPassword) { showAlert('Please enter a new password.', { variant:'warning' }); return; }
                if (newPassword.length < 6) { showAlert('Password must be at least 6 characters.', { variant:'warning' }); return; }
                await resetMyPassword(newPassword);
                setNewPassword('');
              }}
            >
              Update Password
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────

const CRM_PAGES = ['customers', 'products', 'leads', 'opportunities', 'activities', 'contacts', 'orders', 'invoices'];
const NON_CRM_PAGES = ['home', 'dashboard', 'expressDashboard', 'approvals', 'adminTools', 'quotations', 'reports'];
const RETAIL_PAGES = ['retailCustomers', 'retailProducts', 'retailActivities', 'retailOrders', 'retailInvoices'];

function AppShell() {
  const { session, authLoading, appPreferences, setPendingReturnTo, setPendingRecord, customObjects } = useApp();
  const { tenant } = useTenant();
  const rbac = useRbac();
  // Persist active page in sessionStorage so refresh doesn't reset to home
  const [activePage, setActivePage] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('bp_active_page') || 'home';
    }
    return 'home';
  });
  // Save to sessionStorage on every page change
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('bp_active_page', activePage);
    }
  }, [activePage]);
  // Listen for profile open event from Header
  React.useEffect(() => {
    const h = () => setProfileOpen(true);
    window.addEventListener('open-profile', h);
    return () => window.removeEventListener('open-profile', h);
  }, []);

  // Listen for open-record event from GlobalSearch — open panel directly from AppShell
  React.useEffect(() => {
    const h = (e) => {
      const { page, record, returnTo, tab } = e.detail;
      // Store the target record in AppContext so it survives the page switch,
      // even though CRMListPage for the new page hasn't mounted yet.
      setPendingRecord({ page, record, tab });
      setActivePage(page);
      if (returnTo) setPendingReturnTo(returnTo);
    };
    // open-record: from global search
    // open-crm-record: from Customer360 sub-tab click
    const rn = (e: any) => {
      const { page: targetPage } = e.detail || {};
      if (targetPage) setActivePage(targetPage);
    };
    window.addEventListener('open-record',     h);
    window.addEventListener('open-crm-record', h);
    window.addEventListener('retail-navigate', rn);
    return () => {
      window.removeEventListener('open-record',     h);
      window.removeEventListener('open-crm-record', h);
      window.removeEventListener('retail-navigate', rn);
    };
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authShowRetry, setAuthShowRetry] = useState(false);

  // Same failsafe as the tenant-loading gate — never leave the user stuck
  // on a spinner indefinitely, regardless of the exact root cause.
  useEffect(() => {
    if (!authLoading) { setAuthShowRetry(false); return; }
    const t = setTimeout(() => setAuthShowRetry(true), 20000);
    return () => clearTimeout(t);
  }, [authLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F172A] to-blue-900 flex items-center justify-center">
        <div className="text-white text-center space-y-4">
          <img src="/umbrella-logo.png" alt="Umbrella Suite" className="w-16 h-16 rounded-[20px] mx-auto animate-pulse opacity-80"/>
          <div className="font-semibold text-lg">Loading Umbrella Suite...</div>
          <div className="text-blue-300 text-sm">Initialising enterprise platform</div>
          {authShowRetry && (
            <div className="pt-2">
              <p className="text-blue-300/70 text-xs mb-3">This is taking longer than expected.</p>
              <button onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold border border-white/20">
                ↻ Reload Page
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  // h-screen + overflow-hidden bounds this row to the viewport, so <main>
  // below is the only thing that scrolls — previously this was min-h-screen
  // (unbounded), which meant the whole document scrolled and took the
  // "sticky" sidebar along with it instead of pinning it.
  const viewBlocked = (CRM_PAGES.includes(activePage) || RETAIL_PAGES.includes(activePage) || activePage === 'quotations' || activePage === 'manageBookings') && !rbac.can(activePage, 'view');

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header activePage={activePage} onNavigate={(page) => setActivePage(page)} />
        <main className="flex-1 p-6 overflow-y-auto">
          {activePage === 'home' && <SpringboardPage onNavigate={(page) => setActivePage(page)} />}
          {activePage === 'expressDashboard' && <ExpressDashboard onNavigate={(page) => setActivePage(page)} />}
          {activePage === 'dashboard' && (appPreferences?.b2c_mode === true ? <RetailDashboard /> : <DashboardPage />)}
          {viewBlocked && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] bg-white rounded-[20px] border border-gray-100 p-12 text-center">
              <div className="text-5xl mb-3">🔒</div>
              <h2 className="text-xl font-bold text-[#0F172A] mb-1">You don’t have access to this area</h2>
              <p className="text-gray-500 text-sm max-w-md">Your role doesn’t include permission to view this object. Ask an administrator to grant it in Security Console.</p>
            </div>
          )}
          {!viewBlocked && CRM_PAGES.includes(activePage) && !NON_CRM_PAGES.includes(activePage) && <CRMListPage page={activePage} />}
          {!viewBlocked && RETAIL_PAGES.includes(activePage) && <RetailListPage page={activePage} />}
          {activePage === 'manageBookings' && appPreferences?.b2c_mode === true && appPreferences?.business_type === 'rental' && !viewBlocked && <ManageBookingsPage />}
          {activePage === 'whatsappInbox' && appPreferences?.b2c_mode === true && <WhatsAppInboxPage />}
          {!viewBlocked && activePage === 'quotations' && appPreferences?.cpq_enabled !== false && <QuotationsPage />}
          {activePage === 'reports' && <FastReportsPage />}
          {activePage === 'approvals' && <ApprovalsInboxPage />}
          {activePage === 'adminTools' && <AdminToolsPage />}
          {activePage.startsWith('custom_') && (() => {
            const apiName = activePage.slice('custom_'.length);
            const obj = (customObjects || []).find(o => o.api_name === apiName);
            return obj ? <DynamicObjectPage customObject={obj} /> : null;
          })()}
        </main>
      </div>
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />

      <AIAdvisorChat />
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function AppWithTenant() {
  const { supabase, tenant, loading } = useTenant();
  const [showRetry, setShowRetry] = useState(false);

  // Failsafe — regardless of the exact root cause of a hang here, the user
  // should never be stuck on a spinner with zero recourse. If this gate is
  // still blocking after a generous window, offer an explicit retry rather
  // than an indefinite wait.
  useEffect(() => {
    if (!(loading || !supabase)) { setShowRetry(false); return; }
    const t = setTimeout(() => setShowRetry(true), 20000);
    return () => clearTimeout(t);
  }, [loading, supabase]);

  // Wait for tenant + supabase to be ready before mounting AppProvider
  // This ensures AppContext always gets a real supabase client, never null
  if (loading || !supabase) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"/>
          <p className="text-white/60 text-sm font-medium">Loading workspace…</p>
          {showRetry && (
            <div className="mt-6">
              <p className="text-white/40 text-xs mb-3">This is taking longer than expected.</p>
              <button onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold border border-white/20">
                ↻ Reload Page
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <AppProvider supabase={supabase} tenant={tenant}>
      <AppShell />
    </AppProvider>
  );
}

export default function RootPage() {
  return (
    <AlertProvider>
      <TenantProvider>
        <AppWithTenant />
      </TenantProvider>
    </AlertProvider>
  );
}
