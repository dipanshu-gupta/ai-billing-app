// @ts-nocheck
/**
 * lib/supabase.ts
 *
 * IMPORTANT: Always prefer using useTenant() from TenantContext for component-level code.
 * This module exists for compatibility — it returns the tenant-aware client from window.
 * For server-side code, use createClient() directly with env vars.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Returns the tenant-aware Supabase client set by TenantContext
// Falls back to a basic anon client if window client not available (SSR, etc.)
function getClient(): SupabaseClient | null {
  if (typeof window !== 'undefined' && (window as any).__bp_supabase) {
    return (window as any).__bp_supabase;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) return createClient(url, key, { auth: { lock: async (_n: string, _t: number, fn: () => Promise<any>) => fn() } });
  return null;
}

// Proxy object that always delegates to the current tenant-aware client
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    if (!client) return undefined;
    const val = (client as any)[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  }
});
