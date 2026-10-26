// @ts-nocheck
'use client';
/**
 * waFetch - drop-in replacement for fetch() when calling authenticated API routes
 * (/api/whatsapp/*, /api/ai/*, /api/meta/*, ...).
 *
 * Those routes act with the service-role key, so they must know WHO is asking.
 * This attaches the current workspace's Supabase access token as a Bearer token;
 * the server verifies it (lib/whatsappServer.ts) and derives the tenant from the
 * verified user's membership instead of trusting a tenantId sent in the request.
 *
 * If the server answers 401 (token expired or the session was ended elsewhere),
 * the session is refreshed once and the request retried, so a stale token never
 * surfaces as a mysterious "Unauthorized".
 */
async function currentToken(refresh = false) {
  try {
    const client = typeof window !== 'undefined' ? (window as any).__bp_supabase : null;
    if (!client?.auth) return '';
    if (refresh) {
      const { data } = await client.auth.refreshSession();
      return data?.session?.access_token || '';
    }
    const { data } = await client.auth.getSession();
    return data?.session?.access_token || '';
  } catch (e) { return ''; }
}

export async function waFetch(input: string, init: RequestInit = {}) {
  const send = (token: string) => {
    const headers = new Headers(init.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    else headers.delete('Authorization');
    return fetch(input, { ...init, headers });
  };
  const res = await send(await currentToken());
  if (res.status !== 401) return res;
  const fresh = await currentToken(true);
  if (!fresh) return res;
  return send(fresh);
}

/** Friendly text for a 401 that survived the refresh-and-retry. */
export const SESSION_ENDED_TEXT = 'Your sign-in has ended (you may have signed in or out in another tab). Please sign out and sign in again.';
