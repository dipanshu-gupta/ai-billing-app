// @ts-nocheck
/**
 * lib/tenant.ts
 *
 * Tenant resolution and Supabase client factory.
 * This is the ONLY place that knows about multi-tenancy.
 * The rest of the app stays identical — just receives a resolved tenant object.
 *
 * Architecture:
 *   - Master Supabase (env vars)     → stores tenant registry
 *   - Tenant Supabase (from DB)      → client DB for dedicated tenants
 *   - Shared Supabase (env vars)     → used for 'shared' plan tenants
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Tenant {
  id:           string;
  slug:         string;
  name:         string;
  plan:         'trial' | 'shared' | 'dedicated' | 'enterprise';
  status:       'active' | 'suspended' | 'trial' | 'expired';

  // Database — null = use shared pool
  db_url:       string | null;
  db_anon_key:  string | null;

  // Branding
  logo_url:     string | null;
  brand_color:  string;
  app_name:     string;
  custom_domain: string | null;

  // Feature flags
  b2c_enabled:  boolean;
  max_users:    number;
  modules:      string[];   // ['crm','invoicing','retail','reports','ai']

  // Dates
  trial_ends_at: string | null;
  created_at:   string;
}

export interface TenantConfig {
  tenant:   Tenant;
  supabase: SupabaseClient;
}

// ─── Client cache (module-level, per browser tab) ─────────────────────────────
const _clientCache = new Map<string, SupabaseClient>();

// ─── Shared Supabase client (env vars) ────────────────────────────────────────
function getSharedClient(): SupabaseClient {
  const key = '__shared__';
  if (_clientCache.has(key)) return _clientCache.get(key)!;
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  _clientCache.set(key, client);
  return client;
}

// ─── Tenant-specific Supabase client ─────────────────────────────────────────
export function getTenantSupabaseClient(tenant: Tenant): SupabaseClient {
  const cacheKey = `tenant_${tenant.slug}`;
  if (_clientCache.has(cacheKey)) return _clientCache.get(cacheKey)!;

  let client: SupabaseClient;

  if (tenant.plan === 'dedicated' || tenant.plan === 'enterprise') {
    if (!tenant.db_url || !tenant.db_anon_key) {
      console.warn(`[Tenant] ${tenant.slug} is dedicated but has no DB config — falling back to shared`);
      client = getSharedClient();
    } else {
      // Dedicated Supabase instance for this tenant
      client = createClient(tenant.db_url, tenant.db_anon_key, {
        auth: {
          storageKey: `bp_auth_${tenant.slug}`, // isolate auth tokens per tenant
          autoRefreshToken: true,
          persistSession: true,
        },
        global: {
          headers: { 'x-tenant-slug': tenant.slug },
        },
      });
    }
  } else {
    // Shared plan — same Supabase, but all queries MUST include tenant_id filter
    // RLS policies on the shared DB enforce this automatically
    client = getSharedClient();
  }

  _clientCache.set(cacheKey, client);
  return client;
}

// ─── Demo / fallback tenant ────────────────────────────────────────────────────
export const DEMO_TENANT: Tenant = {
  id:           '00000000-0000-0000-0000-000000000001',
  slug:         'demo',
  name:         'Business Pro Demo',
  plan:         'shared',
  status:       'active',
  db_url:       null,
  db_anon_key:  null,
  logo_url:     null,
  brand_color:  '#0F172A',
  app_name:     'Business Pro',
  custom_domain: null,
  b2c_enabled:  true,
  max_users:    999,
  modules:      ['crm','invoicing','retail','reports','ai','admin'],
  trial_ends_at: null,
  created_at:   new Date().toISOString(),
};

// ─── Resolve tenant by slug (client-side) ────────────────────────────────────
// Called from TenantProvider in the browser — fetches from /api/tenant/[slug]
let _tenantCache: Record<string, Tenant> = {};

export async function resolveTenantBySlug(slug: string): Promise<Tenant> {
  if (_tenantCache[slug]) return _tenantCache[slug];

  // Dev shortcut
  if (!slug || slug === 'demo' || slug === 'localhost') {
    _tenantCache['demo'] = DEMO_TENANT;
    return DEMO_TENANT;
  }

  try {
    const res = await fetch(`/api/tenant/${slug}`, { cache: 'no-store' });
    if (!res.ok) {
      console.warn(`[Tenant] Could not resolve slug "${slug}" — using demo`);
      return DEMO_TENANT;
    }
    const tenant: Tenant = await res.json();
    _tenantCache[slug] = tenant;
    return tenant;
  } catch (e) {
    console.error('[Tenant] Resolution failed:', e);
    return DEMO_TENANT;
  }
}

// ─── Extract slug from hostname (client-side) ─────────────────────────────────
export function extractTenantSlug(): string {
  if (typeof window === 'undefined') return 'demo';

  // 1. Query param — works on any URL including Vercel free plan
  //    e.g. ai-billing-app-xi.vercel.app/?tenant=abc
  const params = new URLSearchParams(window.location.search);
  const tenantParam = params.get('tenant');
  if (tenantParam && tenantParam.length >= 2) return tenantParam.toLowerCase();

  const hostname = window.location.hostname;

  // 2. localhost / Vercel preview → always demo
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.vercel.app')) {
    return 'demo';
  }

  // 3. Custom subdomain (once you have a domain)
  const BASE_DOMAINS = ['erp.businesspro.com', 'businesspro.app'];
  for (const base of BASE_DOMAINS) {
    if (hostname.endsWith('.' + base)) {
      return hostname.slice(0, hostname.length - base.length - 1).split('.')[0];
    }
  }

  return 'demo';
}
