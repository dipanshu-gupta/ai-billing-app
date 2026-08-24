// @ts-nocheck
'use client';

import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from '@/context/AppContext';
import { TenantProvider, useTenant } from '@/context/TenantContext';
import { AlertProvider, useAlert } from '@/components/shared/AlertProvider';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DashboardPage from '@/components/dashboard/DashboardPage';
import CRMListPage from '@/components/crm/CRMListPage';
import RetailListPage from '@/components/retail/RetailListPage';
import ManageBookingsPage from '@/components/retail/ManageBookingsPage';
import RetailDashboard from '@/components/retail/RetailDashboard';
import AdminToolsPage from '@/components/admin/AdminToolsPage';
import ApprovalsInboxPage from '@/components/approvals/ApprovalsInboxPage';
import QuotationsPage from '@/components/quotations/QuotationsPage';
import AIAdvisorChat from '@/components/ai/AIAdvisorChat';
import FastReportsPage from '@/components/reports/FastReportsPage';
import RecordDetailPanel from '@/components/crm/RecordDetailPanel';
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
  const tenantLogo = appearance?.company_logo_url || tenant?.logo_url || null;
  const tenantName = tenant?.app_name || tenant?.name || 'Umbrella Suite';
  const isDemo     = !tenant?.slug || tenant?.slug === 'demo';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-blue-950 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo header */}
        <div className="text-center">
          {/* Always show Umbrella Suite logo */}
          <div className="flex flex-col items-center mb-6">
            {/* Co-branding: side by side when tenant has a logo */}
            <div className="flex items-center justify-center gap-5 mb-4">
              {/* Umbrella Suite logo */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-xl overflow-hidden">
                  <img src="/umbrella-logo.png" alt="Umbrella Suite" className="w-11 h-11 object-contain"/>
                </div>
                <span className="text-white/50 text-[10px] font-semibold uppercase tracking-widest">Umbrella Suite</span>
              </div>
              {/* Show tenant logo if available */}
              {!isDemo && tenantLogo && (<>
                <div className="h-12 w-px bg-white/20 rounded-full"/>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-white/30 flex items-center justify-center shadow-xl overflow-hidden p-1.5">
                    <img src={tenantLogo} alt={tenantName} className="w-full h-full object-contain"/>
                  </div>
                  <span className="text-white/50 text-[10px] font-semibold uppercase tracking-widest truncate max-w-[90px] text-center">{tenantName}</span>
                </div>
              </>)}
            </div>
            {/* Title */}
            {isDemo ? (
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white tracking-tight">Umbrella Suite</h1>
                <p className="text-blue-300 text-sm mt-0.5">Enterprise CRM & ERP Platform</p>
              </div>
            ) : (
              <div className="text-center">
                <h1 className="text-xl font-bold text-white tracking-tight">{tenantName}</h1>
                <p className="text-blue-300/80 text-sm mt-0.5">Sign in to your workspace</p>
              </div>
            )}
          </div>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-[32px] shadow-2xl p-8">

          {/* Sign in form */}
          {!showWS && (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@company.com" className={inputClass}/>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••" className={inputClass}/>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-3.5 rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-60">
                {loading ? 'Signing In...' : 'Sign In →'}
              </button>

              {/* Switch workspace — only show on master app */}
              {isMaster && (
                <button type="button" onClick={() => setShowWS(true)}
                  className="w-full text-center text-sm text-gray-400 hover:text-blue-600 transition-colors pt-2">
                  🏢 Sign in to a different workspace →
                </button>
              )}
            </form>
          )}

          {/* Workspace entry */}
          {showWS && (
            <form onSubmit={goToWorkspace} className="space-y-4">
              <div className="text-center mb-4">
                <div className="text-2xl mb-1">🏢</div>
                <h2 className="text-lg font-bold text-[#0F172A]">Enter your workspace</h2>
                <p className="text-sm text-gray-400">Type your workspace name to navigate to it</p>
              </div>
              <div className="space-y-1">
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
                className="w-full bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-3.5 rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all">
                Go to Workspace →
              </button>
              <button type="button" onClick={() => setShowWS(false)}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors">
                ← Back to sign in
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-blue-400/50 text-xs">
          Powered by Umbrella Suite · Enterprise ERP & CRM
        </p>
      </div>
    </div>
  );
}

// ─── Profile Modal ────────────────────────────────────────────────────────────

function ProfileModal({ open, onClose }) {
  const { currentUser, saveMyProfile, resetMyPassword } = useApp();
  const { showAlert } = useAlert();
  const [form, setForm] = useState({
    first_name: currentUser?.first_name || '',
    last_name:  currentUser?.last_name  || '',
    phone:      currentUser?.phone      || '',
  });

  // Re-sync form when currentUser loads (e.g. after provisioning)
  useEffect(() => {
    if (currentUser) {
      setForm({
        first_name: currentUser.first_name || '',
        last_name:  currentUser.last_name  || '',
        phone:      currentUser.phone      || '',
      });
    }
  }, [currentUser?.id]);
  const [newPassword, setNewPassword] = useState('');

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
const NON_CRM_PAGES = ['dashboard', 'approvals', 'adminTools', 'quotations', 'reports'];
const RETAIL_PAGES = ['retailCustomers', 'retailProducts', 'retailActivities', 'retailOrders', 'retailInvoices'];

function AppShell() {
  const { session, authLoading, appPreferences, setPendingReturnTo, setPendingRecord } = useApp();
  const { tenant } = useTenant();
  // Persist active page in sessionStorage so refresh doesn't reset to dashboard
  const [activePage, setActivePage] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('bp_active_page') || 'dashboard';
    }
    return 'dashboard';
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

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header activePage={activePage} onNavigate={(page) => setActivePage(page)} />
        <main className="flex-1 p-6 overflow-y-auto">
          {activePage === 'dashboard' && (appPreferences?.b2c_mode === true ? <RetailDashboard /> : <DashboardPage />)}
          {CRM_PAGES.includes(activePage) && !NON_CRM_PAGES.includes(activePage) && <CRMListPage page={activePage} />}
          {RETAIL_PAGES.includes(activePage) && <RetailListPage page={activePage} />}
          {activePage === 'manageBookings' && appPreferences?.b2c_mode === true && appPreferences?.business_type === 'rental' && <ManageBookingsPage />}
          {activePage === 'quotations' && appPreferences?.cpq_enabled !== false && <QuotationsPage />}
          {activePage === 'reports' && <FastReportsPage />}
          {activePage === 'approvals' && <ApprovalsInboxPage />}
          {activePage === 'adminTools' && <AdminToolsPage />}
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
