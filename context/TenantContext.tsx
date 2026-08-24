// @ts-nocheck
'use client';
/**
 * TenantContext
 *
 * Resolves the current tenant on app load (client-side).
 * All child components can call useTenant() to get:
 *   - tenant:   the resolved Tenant object
 *   - supabase: the correct SupabaseClient for this tenant
 *   - loading:  true while resolving
 *
 * This is the ONLY component that knows about multi-tenancy.
 * AppContext, pages, and components consume useTenant() instead of
 * importing supabase directly.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  Tenant, DEMO_TENANT,
  extractTenantSlug, resolveTenantBySlug, getTenantSupabaseClient,
} from '@/lib/tenant';

interface TenantContextValue {
  tenant:   Tenant;
  supabase: SupabaseClient | null;
  loading:  boolean;
  blocked:  boolean;
  blockReason: string;
}

const TenantContext = createContext<TenantContextValue>({
  tenant:   DEMO_TENANT,
  supabase: null,
  loading:  true,
  blocked:  false,
  blockReason: '',
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant,      setTenant]      = useState<Tenant>(DEMO_TENANT);
  const [supabase,    setSupabase]    = useState<SupabaseClient | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [blocked,     setBlocked]     = useState(false);
  const [blockReason, setBlockReason] = useState('');
  // Tracks the URL's query string directly (where ?tenant= lives) so
  // resolution correctly re-runs if it changes after mount — a plain
  // useEffect(fn, []) only ever runs once, so if the tenant context changed
  // via client-side navigation afterward (e.g. testing different tenants on
  // localhost via ?tenant=), resolution would never re-run and
  // window.__bp_tenant would silently keep pointing at whichever tenant was
  // resolved first. Deliberately framework-independent (plain browser APIs,
  // not Next.js's useSearchParams/usePathname) since those require a
  // Suspense boundary that doesn't exist anywhere in this app, and this is
  // too security-sensitive a fix to risk on an unverified build change.
  const [urlSearch, setUrlSearch] = useState(() => typeof window !== 'undefined' ? window.location.search : '');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => setUrlSearch(window.location.search);
    window.addEventListener('popstate', check);
    // pushState/replaceState (client-side navigation) fire no native browser
    // event — poll as a reliable catch-all for those.
    const interval = setInterval(check, 500);
    return () => { window.removeEventListener('popstate', check); clearInterval(interval); };
  }, []);

  useEffect(() => {
    setLoading(true);
    async function resolve() {
      const t0 = Date.now();
      try {
        const slug = extractTenantSlug();
        console.log('[TenantContext] Resolving tenant, slug:', slug);

        let resolved;
        if (slug === 'demo') {
          resolved = await resolveTenantBySlug(slug);
        } else {
          // Fetch tenant from API — handles status checks + returns full tenant object.
          // Browser fetch() has no built-in timeout, so a hung request here
          // (a slow cold start, a stuck DB connection on that route) would
          // leave the entire app stuck on a loading spinner indefinitely
          // with no way to recover short of closing the tab. A bounded
          // timeout turns that into a clear, recoverable error state.
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          let res;
          try {
            res = await fetch(`/api/tenant/${slug}`, { cache: 'no-store', signal: controller.signal });
          } catch (fetchErr: any) {
            clearTimeout(timeoutId);
            if (fetchErr?.name === 'AbortError') {
              setBlocked(true); setBlockReason('Workspace took too long to respond — please try refreshing.'); setLoading(false); return;
            }
            throw fetchErr;
          }
          clearTimeout(timeoutId);
          if (res.status === 403) { setBlocked(true); setBlockReason('Account Suspended'); setLoading(false); return; }
          if (res.status === 402) { setBlocked(true); setBlockReason('Trial Expired'); setLoading(false); return; }
          if (res.status === 404) { setBlocked(true); setBlockReason('Workspace Not Found'); setLoading(false); return; }
          if (!res.ok) { setBlocked(true); setBlockReason('Workspace Unavailable'); setLoading(false); return; }
          resolved = await res.json();
        }

        // Block suspended tenants
        if (resolved.status === 'suspended') {
          setBlocked(true); setBlockReason('Account Suspended'); setLoading(false); return;
        }
        if (resolved.status === 'expired') {
          setBlocked(true); setBlockReason('Trial Expired'); setLoading(false); return;
        }

        const client = getTenantSupabaseClient(resolved);
        setTenant(resolved);
        setSupabase(client);
        // Expose client + tenant info globally
        if (typeof window !== 'undefined') {
          (window as any).__bp_supabase = client;
          (window as any).__bp_tenant = {
            slug:        resolved.slug,
            id:          resolved.id          || null,
            db_url:      resolved.db_url      || null,
            plan:        resolved.plan         || 'shared',
            b2c_enabled: resolved.b2c_enabled ?? false,
            app_name:    resolved.app_name     || 'Umbrella Suite',
          };
        }
      } catch (e) {
        console.error('[TenantProvider] Resolution failed, using demo:', e);
        const client = getTenantSupabaseClient(DEMO_TENANT);
        setTenant(DEMO_TENANT);
        setSupabase(client);
      } finally {
        console.log('[TenantContext] Resolution finished in', Date.now() - t0, 'ms');
        setLoading(false);
      }
    }
    resolve();
  }, [urlSearch]);

  // Show blocked screen for suspended/expired/not found tenants
  if (blocked) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6">
        <div className="bg-white rounded-[24px] shadow-2xl p-10 text-center max-w-md w-full">
          <div className="text-6xl mb-4">{blockReason.includes('Suspended') ? '🔒' : blockReason.includes('Expired') ? '⏰' : '❌'}</div>
          <h1 className="text-2xl font-bold text-[#0F172A] mb-2">{blockReason}</h1>
          <p className="text-gray-500 text-sm mt-2">
            {blockReason.includes('Suspended')
              ? 'This workspace has been suspended. Please contact your administrator.'
              : blockReason.includes('Expired')
              ? 'The trial period for this workspace has expired. Please upgrade to continue.'
              : 'This workspace could not be found. Please check the URL and try again.'}
          </p>
          <p className="text-gray-400 text-xs mt-4">Contact support if you believe this is an error.</p>
          {blockReason.includes('too long') && (
            <button onClick={() => window.location.reload()} className="mt-4 px-5 py-2.5 rounded-xl bg-[#0F172A] text-white text-sm font-semibold hover:opacity-90">
              ↻ Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <TenantContext.Provider value={{ tenant, supabase, loading, blocked, blockReason }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}
