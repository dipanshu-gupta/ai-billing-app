// @ts-nocheck
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { masterClient, masterUrl } from '@/lib/whatsappServer';
import { verifyOrbitRequest, hasMarketingModule, orbitConfigured, businessMode } from '@/lib/marketingServer';

const PLATFORM_TENANT = '00000000-0000-0000-0000-000000000000';
const NO_PERSIST = { auth: { autoRefreshToken: false, persistSession: false } };

/**
 * POST /api/marketing/entitlements   (server-to-server, Orbit -> ERP, periodic)
 *
 * Returns every tenant currently allowed to use Marketing Cloud (active or in-trial, with the
 * "marketing" module), with its business mode and administrators, so Orbit can create/suspend
 * workspaces and know who its owners are. A tenant whose own database is unreachable is skipped
 * instead of failing the whole response.
 */
export async function POST(request: Request) {
  if (!orbitConfigured()) return NextResponse.json({ error: 'Marketing Cloud is not configured.' }, { status: 503 });
  const raw = await request.text();
  let body: any;
  try { body = verifyOrbitRequest(raw, request.headers, 'entitlements'); }
  catch (e: any) { return NextResponse.json({ error: 'Integration is not configured.' }, { status: 503 }); }
  if (!body || body.tenantId !== PLATFORM_TENANT) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  const master = masterClient();
  const { data, error } = await master.from('tenants').select('id, slug, name, status, plan, modules, trial_ends_at, b2c_enabled, db_url, db_service_key');
  if (error) return NextResponse.json({ error: 'Could not read tenants' }, { status: 503 });
  const now = Date.now();
  const eligible = (data || []).filter((t: any) => {
    const status = String(t.status || '').toLowerCase();
    if (!['active', 'trial'].includes(status)) return false;
    if (t.plan === 'trial' && t.trial_ends_at && Date.parse(t.trial_ends_at) < now) return false;
    return hasMarketingModule(t);
  });

  const tenants: any[] = [];
  for (const t of eligible) {
    try {
      const dedicated = !!(t.db_url && t.db_service_key && t.db_url !== masterUrl());
      const supabase = dedicated ? createClient(t.db_url, t.db_service_key, NO_PERSIST) : master;
      const scope = (q: any) => (dedicated ? q : q.eq('tenant_id', t.id));
      const target = { tenant: t, supabase, dedicated, scope };
      const { data: admins, error: aErr } = await scope(supabase.from('enterprise_users').select('email, first_name, last_name, status').eq('is_admin', true)).limit(60);
      if (aErr) continue; // unreachable / broken tenant DB: skip it
      const list = (admins || [])
        .filter((a: any) => a.email && String(a.status || '').toLowerCase() !== 'inactive')
        .slice(0, 25)
        .map((a: any) => ({ email: String(a.email).toLowerCase(), name: [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.email }));
      tenants.push({ id: t.id, slug: t.slug, name: t.name || t.slug, mode: await businessMode(target as any), admins: list });
    } catch (e) { /* skip this tenant */ }
  }
  return NextResponse.json({ tenants }, { headers: { 'Cache-Control': 'no-store' } });
}
