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

  useEffect(() => {
    async function resolve() {
      try {
        const slug = extractTenantSlug();

        // Check for suspension/expiry via API
        if (slug !== 'demo') {
          const res = await fetch(`/api/tenant/${slug}`);
          if (res.status === 403) {
            setBlocked(true); setBlockReason('Account Suspended'); setLoading(false); return;
          }
          if (res.status === 402) {
            setBlocked(true); setBlockReason('Trial Expired'); setLoading(false); return;
          }
          if (res.status === 404) {
            setBlocked(true); setBlockReason('Workspace Not Found'); setLoading(false); return;
          }
          if (!res.ok) {
            setBlocked(true); setBlockReason('Workspace Unavailable'); setLoading(false); return;
          }
        }

        const resolved = await resolveTenantBySlug(slug);

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
            slug:           resolved.slug,
            db_url:         resolved.db_url  || null,
            // Never expose service key to window — server API uses env vars
          };
        }
      } catch (e) {
        console.error('[TenantProvider] Resolution failed, using demo:', e);
        const client = getTenantSupabaseClient(DEMO_TENANT);
        setTenant(DEMO_TENANT);
        setSupabase(client);
      } finally {
        setLoading(false);
      }
    }
    resolve();
  }, []);

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
