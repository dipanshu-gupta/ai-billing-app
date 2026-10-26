// @ts-nocheck
// Server-only: is the caller a PLATFORM owner (allowed to create / provision workspaces)?
// Verified from the caller's Supabase session against the PLATFORM_ADMIN_EMAILS allowlist (comma-separated).
import { createClient } from '@supabase/supabase-js';

export async function authorizePlatformAdmin(request: Request): Promise<{ ok: true; email: string } | { ok: false; status: number; error: string }> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { ok: false, status: 401, error: 'Not authenticated' };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ok: false, status: 500, error: 'Server misconfigured: missing Supabase URL/anon key' };
  const supa = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user?.email) return { ok: false, status: 401, error: 'Session expired - please log in again.' };
  const allow = (process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!allow.length) return { ok: false, status: 500, error: 'PLATFORM_ADMIN_EMAILS is not configured.' };
  const email = data.user.email.toLowerCase();
  if (!allow.includes(email)) return { ok: false, status: 403, error: 'Only the platform owner can do this.' };
  return { ok: true, email };
}
