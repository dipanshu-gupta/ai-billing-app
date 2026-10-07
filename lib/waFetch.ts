// @ts-nocheck
'use client';
/**
 * waFetch — drop-in replacement for fetch() when calling /api/whatsapp/*.
 *
 * Those routes act with the service-role key on a tenant's WhatsApp
 * credentials, so they must know WHO is asking. This attaches the current
 * Supabase session's access token as a Bearer token; the server verifies it
 * (lib/whatsappServer.ts) and derives the tenant from the verified user's
 * membership instead of trusting a tenantId sent in the request body.
 */
export async function waFetch(input: string, init: RequestInit = {}) {
  let token = '';
  try {
    const client = typeof window !== 'undefined' ? (window as any).__bp_supabase : null;
    if (client?.auth?.getSession) {
      const { data } = await client.auth.getSession();
      token = data?.session?.access_token || '';
    }
  } catch (e) { /* fall through - the server will answer 401 */ }
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
