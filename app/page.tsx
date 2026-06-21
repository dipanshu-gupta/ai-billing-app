// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { AppProvider, useApp } from '@/context/AppContext';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DashboardPage from '@/components/dashboard/DashboardPage';
import CRMListPage from '@/components/crm/CRMListPage';
import RetailListPage from '@/components/retail/RetailListPage';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await handleLogin(email, password);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-blue-950 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] shadow-2xl border border-blue-100 p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-[20px] bg-[#0F172A] text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">BP</div>
          <h1 className="text-3xl font-bold text-[#0F172A]">Business Pro</h1>
          <p className="text-gray-500 mt-2">Enterprise CRM Platform</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className={inputClass} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-3.5 rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all mt-2 disabled:opacity-60">
            {loading ? 'Signing In...' : 'Sign In →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Profile Modal ────────────────────────────────────────────────────────────

function ProfileModal({ open, onClose }) {
  const { currentUser, saveMyProfile, resetMyPassword } = useApp();
  const [form, setForm] = useState({
    first_name: currentUser?.first_name || '',
    last_name: currentUser?.last_name || '',
    phone: currentUser?.phone || '',
  });
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
                if (!newPassword) { alert('Please enter a new password.'); return; }
                if (newPassword.length < 6) { alert('Password must be at least 6 characters.'); return; }
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
  const [activePage,       setActivePage]       = useState('dashboard');
  // Listen for profile open event from Header
  React.useEffect(() => {
    const h = () => setProfileOpen(true);
    window.addEventListener('open-profile', h);
    return () => window.removeEventListener('open-profile', h);
  }, []);

  // Listen for open-record event from GlobalSearch — open panel directly from AppShell
  React.useEffect(() => {
    const h = (e) => {
      const { page, record, returnTo } = e.detail;
      // Store the target record in AppContext so it survives the page switch,
      // even though CRMListPage for the new page hasn't mounted yet.
      setPendingRecord({ page, record });
      setActivePage(page);
      if (returnTo) setPendingReturnTo(returnTo);
    };
    // open-record: from global search
    // open-crm-record: from Customer360 sub-tab click
    window.addEventListener('open-record',     h);
    window.addEventListener('open-crm-record', h);
    return () => {
      window.removeEventListener('open-record',     h);
      window.removeEventListener('open-crm-record', h);
    };
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F172A] to-blue-900 flex items-center justify-center">
        <div className="text-white text-center space-y-4">
          <div className="w-16 h-16 rounded-[20px] bg-white/10 flex items-center justify-center text-2xl font-bold mx-auto animate-pulse">BP</div>
          <div className="font-semibold text-lg">Loading Business Pro...</div>
          <div className="text-blue-300 text-sm">Initialising enterprise platform</div>
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

export default function RootPage() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
