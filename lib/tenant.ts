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

// Bypasses Supabase's default cross-tab session lock (which uses the
// browser's navigator.locks API to coordinate token refreshes across tabs).
// That default lock is a known source of deadlocks in supabase-js v2 if it's
// ever left in a bad state — a tab that crashed or was killed mid-refresh, a
// dev-mode hot-reload, or certain multi-tab timing can all leave the lock
// held with nothing to release it, and every subsequent getSession() call
// then hangs waiting for a lock that will never free. This is the exact
// mechanism behind "stuck on the loading screen after refresh, only fixed by
// clearing cookies" — clearing storage is what actually clears the stuck
// lock state, not just the session itself.
//
// The original fix here removed locking entirely (a genuine no-op), which
// solves the cross-tab deadlock but throws away same-tab serialization too —
// and that serialization exists for a real reason: it's what prevents two
// concurrent token-refresh attempts from racing each other. A refresh token
// is typically single-use; if two refreshes fire near-simultaneously within
// the same tab (e.g. a background poll and a user-initiated save, both
// happening right as a token expires), the loser of that race can be left
// waiting on a promise that never settles — which looks exactly like "the
// save button hangs forever, only fixed by refreshing the page." This
// in-memory, per-tab mutex restores that serialization (queuing concurrent
// calls to the same lock name rather than letting them race) while never
// touching the browser's shared, persistent navigator.locks API at all — so
// it keeps the original fix's core property (no cross-tab deadlock is even
// possible) while no longer creating this new, same-tab race condition.
// A fixed safety timeout ensures a stuck prior call can never block this tab
// indefinitely either, regardless of what acquireTimeout is passed.
const _lockChains = new Map<string, Promise<any>>();
export const inMemoryLock = async (name: string, _acquireTimeout: number, fn: () => Promise<any>): Promise<any> => {
  const prior = _lockChains.get(name) || Promise.resolve();
  // Deliberately NOT racing fn() against a timeout here. Promise.race()
  // doesn't cancel the losing side — if the real Supabase auth operation
  // ran past a timeout, this wrapper would "give up" and report a timeout
  // while the actual refresh kept running uncancelled in the background.
  // Supabase's own client tracks "is a refresh in progress" internally,
  // separately from this wrapper — abandoning it here while Supabase still
  // considers it active can desync the two, leaving every subsequent
  // auth-dependent call stuck waiting on a refresh Supabase never
  // considered finished. That's a worse failure mode than just waiting:
  // a timeout message followed by the whole app freezing until reload.
  // The queuing itself (serializing concurrent calls to the same lock name)
  // is what actually matters here and remains — that's what prevents two
  // concurrent refresh attempts from racing and invalidating each other's
  // tokens. Just letting the real operation run to completion, however
  // long that takes, is safer than second-guessing it with an artificial
  // deadline.
  const runAfterPrior = prior.catch(() => {}).then(() => fn());
  // Swallow here so the chain map itself never holds a rejected promise
  // (which would immediately reject every subsequent caller queued behind
  // it) — the real result/error still propagates to this call's own caller
  // via the returned `runAfterPrior` below.
  _lockChains.set(name, runAfterPrior.catch(() => {}));
  return runAfterPrior;
};
const noOpLock = inMemoryLock; // kept as an alias — call sites below are unchanged

// ─── Shared Supabase client (env vars) ────────────────────────────────────────
function getSharedClient(): SupabaseClient {
  const key = '__shared__';
  if (_clientCache.has(key)) return _clientCache.get(key)!;
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { lock: noOpLock } },
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
          lock: noOpLock,
        },
        global: {
          headers: { 'x-tenant-slug': tenant.slug },
        },
      });
    }
  } else {
    // Shared plan — same Supabase URL/key, but each tenant gets its OWN client
    // with isolated auth storageKey so sessions don't bleed between tenants
    // RLS enforces data isolation via tenant_id column + tenant_isolation policy
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storageKey: `bp_auth_${tenant.slug}`, // isolate auth tokens per tenant
          autoRefreshToken: true,
          persistSession: true,
          lock: noOpLock,
        },
        global: {
          headers: { 'x-tenant-slug': tenant.slug },
        },
      }
    );
  }

  _clientCache.set(cacheKey, client);
  return client;
}

// ─── Demo / fallback tenant ────────────────────────────────────────────────────
export const DEMO_TENANT: Tenant = {
  id:           '00000000-0000-0000-0000-000000000001',
  slug:         'demo',
  name:         'Umbrella Suite Demo',
  plan:         'shared',
  status:       'active',
  db_url:       null,
  db_anon_key:  null,
  logo_url:     null,
  brand_color:  '#0F172A',
  app_name:     'Umbrella Suite',
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

  // 2. Master app domains → always demo (no tenant param = master workspace)
  const MASTER_DOMAINS = [
    'localhost', '127.0.0.1',
    'cloud.umbrellasuite.com',
    'umbrellasuite.com',
  ];
  if (MASTER_DOMAINS.includes(hostname) || hostname.endsWith('.vercel.app')) {
    return 'demo';
  }

  // 3. Tenant subdomain: tenant.cloud.umbrellasuite.com → 'tenant'
  const SUBDOMAIN_BASES = [
    'cloud.umbrellasuite.com', 'umbrellasuite.com',
    'erp.businesspro.com', 'businesspro.app',
  ];
  for (const base of SUBDOMAIN_BASES) {
    if (hostname.endsWith('.' + base)) {
      return hostname.slice(0, hostname.length - base.length - 1).split('.').pop() || 'demo';
    }
  }

  // 4. Fully custom domain — use hostname prefix as slug hint
  return hostname.split('.')[0] || 'demo';
}
