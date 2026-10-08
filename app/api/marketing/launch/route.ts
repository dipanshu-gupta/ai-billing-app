// @ts-nocheck
import { NextResponse } from 'next/server';
import { authorizeWhatsAppRequest } from '@/lib/whatsappServer';
import { signSsoToken, orbitUrl, resolveTenantTarget, businessMode, orbitConfigured, DEMO_TENANT_ID } from '@/lib/marketingServer';

/**
 * POST /api/marketing/launch
 *
 * Called from the Marketing Cloud menu item with the user's Supabase access
 * token (Authorization: Bearer). The caller's identity and tenant membership
 * are verified server-side exactly like the WhatsApp routes; the tenant is
 * derived from the verified membership, never trusted from the body. Returns
 * a 90-second single-use token that the browser POSTs to Orbit's /sso.
 *
 * Role claim: tenant administrators -> "owner", everyone else -> "editor". The master/demo tenant
 * may launch without the "marketing" module flag.
 */
export async function POST(request: Request) {
  if (!orbitConfigured()) return NextResponse.json({ error: 'Marketing Cloud is not configured.' }, { status: 503 });
  try {
    const body = await request.json().catch(() => ({}));
    const auth = await authorizeWhatsAppRequest(request, { db_url: body?.db_url, tenantId: body?.tenantId });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const target = await resolveTenantTarget(auth.tenantId, { requireModule: auth.tenantId !== DEMO_TENANT_ID });
    if ('error' in target) return NextResponse.json({ error: target.error }, { status: target.status });

    let person: any = null;
    try {
      let q = auth.supabase.from('enterprise_users').select('first_name, last_name, email, status').ilike('email', auth.email);
      if (!auth.dbUrl) q = q.eq('tenant_id', auth.tenantId);
      ({ data: person } = await q.limit(1).maybeSingle());
    } catch (e) { /* name is cosmetic */ }
    if (person && String(person.status || '').toLowerCase() === 'inactive') {
      return NextResponse.json({ error: 'Your account is inactive in this workspace.' }, { status: 403 });
    }
    const name = [person?.first_name, person?.last_name].filter(Boolean).join(' ').trim() || auth.email;

    const token = signSsoToken({
      tid: target.tenant.id,
      slug: target.tenant.slug,
      tname: target.tenant.name || target.tenant.slug,
      email: auth.email.toLowerCase(),
      name,
      role: auth.isAdmin ? 'owner' : 'editor', // tenant admins -> owner
      mode: await businessMode(target),
    });
    return NextResponse.json({ action: `${orbitUrl()}/sso`, token }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('[marketing/launch]', e?.message);
    return NextResponse.json({ error: 'Marketing Cloud could not be opened. Please try again.' }, { status: 500 });
  }
}
