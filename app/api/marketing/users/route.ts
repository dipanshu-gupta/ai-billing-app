// @ts-nocheck
import { NextResponse } from 'next/server';
import { verifyOrbitRequest, resolveTenantTarget, orbitConfigured } from '@/lib/marketingServer';

/**
 * POST /api/marketing/users   (server-to-server, Orbit -> ERP)
 *
 * Returns the active users of ONE tenant (the one in the signed body), so Orbit can show who has
 * access. Signed with derive('users', tenantId): a valid signature proves the request is for that
 * tenant only, and the query is scoped to it (tenant_id filter on the shared DB, the tenant's own
 * database when dedicated). Works for the master/demo tenant too and does not require the
 * "marketing" module. Only email, name, isAdmin and status are ever returned.
 */
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  if (!orbitConfigured()) return NextResponse.json({ error: 'Marketing Cloud is not configured.' }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 10_000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  let body: any;
  try { body = verifyOrbitRequest(raw, request.headers, 'users'); }
  catch (e: any) { return NextResponse.json({ error: 'Integration is not configured.' }, { status: 503 }); }
  if (!body) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  try {
    const target = await resolveTenantTarget(body.tenantId, { requireModule: false });
    if ('error' in target) return NextResponse.json({ users: [] }, { headers: NO_STORE });

    const { data, error } = await target.scope(
      target.supabase.from('enterprise_users').select('email, first_name, last_name, is_admin, status')
    ).order('email', { ascending: true }).limit(1000);
    if (error) {
      console.error('[marketing/users] query failed:', error.message);
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }
    const users = (data || [])
      .filter((u: any) => u.email && String(u.status || '').toLowerCase() !== 'inactive')
      .map((u: any) => {
        const email = String(u.email).trim().toLowerCase();
        return { email, name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || email, isAdmin: u.is_admin === true, status: 'active' };
      });
    return NextResponse.json({ users }, { headers: NO_STORE });
  } catch (e: any) {
    console.error('[marketing/users]', e?.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
