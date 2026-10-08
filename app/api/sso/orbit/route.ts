// @ts-nocheck
import { NextResponse } from 'next/server';
import { masterClient } from '@/lib/whatsappServer';
import { verifyOrbitSsoToken, resolveTenantTarget, orbitConfigured } from '@/lib/marketingServer';

/**
 * POST /api/sso/orbit   (Orbit -> ERP single sign-on)
 *
 * Orbit posts an application/x-www-form-urlencoded form with a 5-minute, single-use HS256 token
 * (field "token"). We only sign in someone who ALREADY has an active ERP account in that tenant:
 * no user is ever created here. A Supabase magic-link is generated server-side (no email is sent)
 * and the browser is redirected to it, so the normal ERP session + membership checks then run.
 * Every failure shows the same generic page and never reveals which check failed.
 */
const ERP_URL = 'https://cloud.umbrellasuite.com';
const ORBIT_HOME = () => (process.env.ORBIT_URL || 'https://orbit.umbrellasuite.com').replace(/\/$/, '');

function denied(status = 403) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Umbrella Suite</title></head>
<body style="font-family:system-ui,sans-serif;background:#f8fafc;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center">
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:32px;max-width:420px;text-align:center;box-shadow:0 10px 30px rgba(15,23,42,.08)">
<h1 style="font-size:18px;color:#0f172a;margin:0 0 10px">Umbrella Suite</h1>
<p style="color:#475569;font-size:14px;line-height:1.5;margin:0 0 18px">You don't have an Umbrella Suite account for this business. Ask your ERP administrator to add you.</p>
<a href="${ORBIT_HOME()}" style="color:#2563eb;font-size:14px;font-weight:600">Back to Marketing Cloud</a></div></body></html>`;
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!orbitConfigured()) return NextResponse.json({ error: 'Marketing Cloud is not configured.' }, { status: 503 });
  try {
    let token = '';
    try { token = String((await request.formData()).get('token') || ''); } catch { return denied(401); }
    const claims = verifyOrbitSsoToken(token);
    if (!claims) return denied(401);

    // Single use: the jti may be consumed exactly once.
    const master = masterClient();
    const { error: nonceErr } = await master.from('orbit_sso_nonces').insert({ jti: String(claims.jti) });
    if (nonceErr) return denied(nonceErr.code === '23505' ? 401 : 403);
    // Opportunistic cleanup of old nonces.
    master.from('orbit_sso_nonces').delete().lt('created_at', new Date(Date.now() - 86400000).toISOString()).then(() => {}, () => {});

    const target = await resolveTenantTarget(claims.tid, { requireModule: true });
    if ('error' in target) return denied(403);

    let q = target.supabase.from('enterprise_users').select('email, status, auth_user_id').ilike('email', claims.email.replace(/[%_]/g, (c: string) => '\\' + c));
    q = target.scope(q);
    const { data: person } = await q.limit(1).maybeSingle();
    if (!person || !person.auth_user_id || String(person.status || '').toLowerCase() === 'inactive') return denied(403);

    const { data: au, error: auErr } = await target.supabase.auth.admin.getUserById(person.auth_user_id);
    if (auErr || String(au?.user?.email || '').toLowerCase() !== claims.email) return denied(403);

    const { data: link, error: linkErr } = await target.supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: claims.email,
      options: { redirectTo: `${ERP_URL}/?tenant=${encodeURIComponent(target.tenant.slug)}` },
    });
    const actionLink = link?.properties?.action_link;
    if (linkErr || !actionLink) return denied(403);
    return NextResponse.redirect(actionLink, { status: 303, headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('[sso/orbit]', e?.message);
    return denied(403);
  }
}
