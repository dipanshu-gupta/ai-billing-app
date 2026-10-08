// @ts-nocheck
import { NextResponse } from 'next/server';
import { verifyOrbitRequest, resolveTenantTarget, orbitConfigured } from '@/lib/marketingServer';

/**
 * POST /api/marketing/member   (server-to-server, Orbit -> ERP)
 *
 * Orbit asks: "is this email an active user of this ERP tenant, and are they a tenant admin?"
 * Signed with derive('member', tenantId). Works for customer tenants and the master/demo tenant;
 * it does NOT require the "marketing" module (Orbit gives ERP users access by default).
 * Answers only { member, isAdmin, name, status } - or { member: false } for anything else
 * (unknown/suspended tenant, unknown or inactive user), so nothing else is revealed.
 */
const NO_STORE = { 'Cache-Control': 'no-store' };
const NOT_MEMBER = () => NextResponse.json({ member: false }, { headers: NO_STORE });

export async function POST(request: Request) {
  if (!orbitConfigured()) return NextResponse.json({ error: 'Marketing Cloud is not configured.' }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 10_000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  let body: any;
  try { body = verifyOrbitRequest(raw, request.headers, 'member'); }
  catch (e: any) { return NextResponse.json({ error: 'Integration is not configured.' }, { status: 503 }); }
  if (!body) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NOT_MEMBER();

  try {
    const target = await resolveTenantTarget(body.tenantId, { requireModule: false });
    if ('error' in target) return NOT_MEMBER();

    const { data: person } = await target.scope(
      target.supabase.from('enterprise_users').select('first_name, last_name, email, is_admin, status')
        .ilike('email', email.replace(/[\\%_]/g, (c: string) => '\\' + c))
    ).limit(1).maybeSingle();
    if (!person || String(person.email || '').toLowerCase() !== email) return NOT_MEMBER();
    if (String(person.status || '').toLowerCase() === 'inactive') return NOT_MEMBER();

    const name = [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || email;
    return NextResponse.json({ member: true, isAdmin: person.is_admin === true, name, status: 'active' }, { headers: NO_STORE });
  } catch (e: any) {
    console.error('[marketing/member]', e?.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
