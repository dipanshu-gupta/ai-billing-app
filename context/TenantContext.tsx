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
}

const TenantContext = createContext<TenantContextValue>({
  tenant:   DEMO_TENANT,
  supabase: null,
  loading:  true,
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant,  setTenant]  = useState<Tenant>(DEMO_TENANT);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function resolve() {
      try {
        const slug = extractTenantSlug();
        const resolved = await resolveTenantBySlug(slug);
        const client = getTenantSupabaseClient(resolved);
        setTenant(resolved);
        setSupabase(client);
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

  return (
    <TenantContext.Provider value={{ tenant, supabase, loading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}
