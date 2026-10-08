// @ts-nocheck
'use client';
/**
 * Marketing Cloud (Orbit) launcher.
 *
 * Shown only when the tenant has the "marketing" module. Clicking it:
 *   1. opens a named tab synchronously (so popup blockers allow it),
 *   2. asks /api/marketing/launch for a 90-second single-use sign-in token
 *      (the server re-verifies the session and tenant membership),
 *   3. POSTs that token to Orbit's /sso in the opened tab. A POST keeps the
 *      token out of the address bar, browser history and server access logs.
 */
import { useState, useEffect, useRef } from 'react';
import { useTenant } from '@/context/TenantContext';
import { waFetch } from '@/lib/waFetch';
import { hasMarketing } from '@/lib/marketingClient';

export default function MarketingCloudLauncher({ collapsed }: { collapsed: boolean }) {
  const { tenant } = useTenant();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(false);
  const autoRan = useRef(false);

  const open = async (auto = false) => {
    if (busy || !tenant) return;
    setBusy(true); setError('');
    const tabName = `umbrella-marketing-${tenant.slug}`;
    const tab = window.open('about:blank', tabName);
    if (auto && !tab) {
      // Auto-launch has no user click, so the browser may block the new tab:
      // offer a one-click button instead (a click is allowed to open a tab).
      setBusy(false); setToast(true);
      return;
    }
    setToast(false);
    try {
      const res = await waFetch('/api/marketing/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db_url: tenant?.db_url || undefined, tenantId: tenant?.id || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token || !data.action) throw new Error(data.error || 'Marketing Cloud could not be opened.');
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.action;
      form.target = tab ? tabName : '_self';
      const input = document.createElement('input');
      input.type = 'hidden'; input.name = 'token'; input.value = data.token;
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
      form.remove();
    } catch (e: any) {
      try { tab?.close(); } catch {}
      setError(e.message || 'Marketing Cloud could not be opened.');
      setTimeout(() => setError(''), 6000);
    } finally {
      setBusy(false);
    }
  };

  // ?launch=marketing -> open Marketing Cloud once the user is signed in and the tenant is loaded.
  useEffect(() => {
    if (autoRan.current || !tenant?.id || !hasMarketing(tenant)) return;
    let want = false;
    try { want = new URLSearchParams(window.location.search).get('launch') === 'marketing'; } catch {}
    if (!want) return;
    autoRan.current = true;
    try {
      const u = new URL(window.location.href); u.searchParams.delete('launch');
      window.history.replaceState({}, '', u.pathname + u.search + u.hash);
    } catch {}
    open(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  if (!hasMarketing(tenant)) return null;

  return (
    <div>
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-[200] bg-[#0F172A] text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 text-sm">
          <span>Your browser blocked the new tab.</span>
          <button onClick={() => open(false)} className="bg-blue-600 hover:bg-blue-500 rounded-xl px-3 py-1.5 font-semibold">Open Marketing Cloud</button>
          <button onClick={() => setToast(false)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">x</button>
        </div>
      )}
      <button
        onClick={() => open(false)}
        title="Marketing Cloud"
        disabled={busy}
        className="w-full flex items-center gap-3 rounded-2xl transition-all duration-200 py-2.5 px-3 text-sm font-medium text-blue-100 hover:bg-white/10 hover:text-white disabled:opacity-60"
      >
        <span className="flex-shrink-0">
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 11l18-7-7 18-2-8-9-3z"/>
          </svg>
        </span>
        {!collapsed && <span className="truncate flex-1 text-left">{busy ? 'Opening…' : 'Marketing Cloud'}</span>}
        {!collapsed && !busy && (
          <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7M10 14L21 3M21 14v7H3V3h7"/>
          </svg>
        )}
      </button>
      {error && !collapsed && <div className="mx-3 mt-1 text-xs text-red-300">{error}</div>}
    </div>
  );
}
