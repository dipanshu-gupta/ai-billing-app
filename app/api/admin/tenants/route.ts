import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// ─── Tenant provisioning — server-only, service-role-backed ──────────────────
// The `tenants` table intentionally has RLS enabled with ZERO client policies
// (see 01_shared_db_tenant_isolation_rls.sql: "server-only, service role
// bypasses RLS. No client policy.") — this table holds `db_service_key` for
// every dedicated tenant database, a credential that grants full,
// unrestricted access to that tenant's entire database. It must never be
// written, and never fully read, from browser-side code with a regular
// user's session — regardless of how "admin" that user is within their own
// tenant. This route is the only supported way to manage tenants: it runs
// entirely server-side with the service role key, and independently verifies
// the caller is an explicitly allowlisted platform operator before doing
// anything, rather than trusting any client-supplied "I'm an admin" claim.

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Verifies the request's bearer token identifies a real, currently-valid
// Supabase session, AND that the resulting email is on the explicit platform
// admin allowlist (PLATFORM_ADMIN_EMAILS env var, comma-separated). This is
// intentionally a simple, auditable allowlist rather than a database-driven
// role system — appropriate for the small number of people who should ever
// be able to provision tenants or see their database credentials at all.
async function authorizePlatformAdmin(request: Request): Promise<{ ok: true; email: string } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return { ok: false, status: 401, error: 'Not authenticated' };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ok: false, status: 500, error: 'Server misconfigured: missing Supabase URL/anon key' };

  const supa = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData, error: authErr } = await supa.auth.getUser(token);
  if (authErr || !userData?.user?.email) return { ok: false, status: 401, error: 'Session expired — please log in again.' };

  const allowlist = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);
  if (allowlist.length === 0) {
    return { ok: false, status: 500, error: 'PLATFORM_ADMIN_EMAILS is not configured — no one can manage tenants until this is set.' };
  }
  const email = userData.user.email.toLowerCase();
  if (!allowlist.includes(email)) {
    return { ok: false, status: 403, error: 'You are not authorized to manage tenants.' };
  }
  return { ok: true, email };
}

// Fields that must never leave the server, even to an authorized admin's
// browser, for routine listing — these are full database credentials.
const SENSITIVE_FIELDS = ['db_service_key', 'db_anon_key'] as const;
function maskTenant(t: any) {
  const out = { ...t };
  for (const f of SENSITIVE_FIELDS) out[f] = t[f] ? '••••••••' : null;
  return out;
}

export async function GET(request: Request) {
  const auth = await authorizePlatformAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });

  const { data, error } = await admin.from('tenants').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tenants: (data || []).map(maskTenant) });
}

export async function POST(request: Request) {
  const auth = await authorizePlatformAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });

  const body = await request.json();
  if (!body.slug || !body.name) return NextResponse.json({ error: 'Slug and Name are required.' }, { status: 400 });

  const payload = {
    slug: String(body.slug).toLowerCase().replace(/[^a-z0-9-]/g, ''),
    name: body.name, plan: body.plan, status: body.status,
    admin_email: body.admin_email || '', admin_name: body.admin_name || '',
    company_size: body.company_size || '', industry: body.industry || '',
    country: body.country || 'India',
    brand_color: body.brand_color || '#0F172A', accent_color: body.accent_color || '#2563EB',
    app_name: body.app_name || 'Umbrella Suite',
    b2c_enabled: !!body.b2c_enabled, max_users: Number(body.max_users) || 5,
    modules: body.modules || ['crm', 'invoicing'],
    db_url: body.db_url || null, db_anon_key: body.db_anon_key || null,
    db_service_key: body.db_service_key || null,
    custom_domain: body.custom_domain || null, logo_url: body.logo_url || null,
    trial_ends_at: body.trial_ends_at ? new Date(body.trial_ends_at).toISOString() : null,
    mrr_usd: Number(body.mrr_usd) || 0,
    created_by: auth.email, created_at: new Date().toISOString(),
  };

  const { data, error } = await admin.from('tenants').upsert(payload, { onConflict: 'slug' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tenant: maskTenant(data) });
}

export async function PUT(request: Request) {
  const auth = await authorizePlatformAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: 'Tenant id is required.' }, { status: 400 });

  const payload: any = {
    slug: body.slug ? String(body.slug).toLowerCase().replace(/[^a-z0-9-]/g, '') : undefined,
    name: body.name, plan: body.plan, status: body.status,
    admin_email: body.admin_email, admin_name: body.admin_name,
    company_size: body.company_size, industry: body.industry, country: body.country,
    brand_color: body.brand_color, accent_color: body.accent_color, app_name: body.app_name,
    b2c_enabled: body.b2c_enabled, max_users: body.max_users != null ? Number(body.max_users) : undefined,
    modules: body.modules,
    db_url: body.db_url, db_anon_key: body.db_anon_key, db_service_key: body.db_service_key,
    custom_domain: body.custom_domain, logo_url: body.logo_url,
    trial_ends_at: body.trial_ends_at ? new Date(body.trial_ends_at).toISOString() : undefined,
    mrr_usd: body.mrr_usd != null ? Number(body.mrr_usd) : undefined,
    updated_by: auth.email, updated_at: new Date().toISOString(),
  };
  // Only overwrite a sensitive credential field if the client actually sent a
  // real new value — the edit form shows masked placeholders for these
  // fields, and must never accidentally overwrite the real stored credential
  // with the masked placeholder string itself.
  for (const f of SENSITIVE_FIELDS) {
    if (payload[f] === '••••••••' || payload[f] === undefined) delete payload[f];
  }
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  const { data, error } = await admin.from('tenants').update(payload).eq('id', body.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tenant: maskTenant(data) });
}

export async function PATCH(request: Request) {
  const auth = await authorizePlatformAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });

  const body = await request.json();
  if (!body.id || !body.status) return NextResponse.json({ error: 'Tenant id and status are required.' }, { status: 400 });

  const { error } = await admin.from('tenants').update({ status: body.status, updated_by: auth.email, updated_at: new Date().toISOString() }).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
