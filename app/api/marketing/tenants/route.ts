// @ts-nocheck
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { masterClient, masterUrl } from '@/lib/whatsappServer';
import { verifyOrbitRequest, hasMarketingModule, orbitConfigured, businessMode } from '@/lib/marketingServer';

const PLATFORM_TENANT = '00000000-0000-0000-0000-000000000000';
const NO_PERSIST = { auth: { autoRefreshToken: false, persistSession: false } };

/**
 * POST /api/marketing/tenants   (server-to-server, Orbit -> ERP, platform-level)
 *
 * Lists every ACTIVE tenant (suspended / expired / cancelled and expired trials are left out) with
 * its business mode and whether the Marketing module is enabled. Signed with
 * derive('tenants', '00000000-0000-0000-0000-000000000000'). Only id, slug, name, mode, status and
 * marketing are returned - no credentials, users or other data.
 */
export async function POST(request: Request) {
  if (!orbitConfigured()) return NextResponse.json({ error: 'Marketing Cloud is not configured.' }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 10_000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  let body: any;
  try { body = verifyOrbitRequest(raw, request.headers, 'tenants'); }
  catch (e: any) { return NextResponse.json({ error: 'Integration is not configured.' }, { status: 503 }); }
  if (!body || body.tenantId !== PLATFORM_TENANT) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  try {
    const master = masterClient();
    const { data, error } = await master.from('tenants')
      .select('id, slug, name, status, plan, modules, trial_ends_at, b2c_enabled, db_url, db_service_key');
    if (error) return NextResponse.json({ error: 'Could not read tenants' }, { status: 503 });

    const now = Date.now();
    const active = (data || []).filter((t: any) => {
      const status = String(t.status || '').toLowerCase();
      if (!['active', 'trial'].includes(status)) return false;
      if (t.plan === 'trial' && t.trial_ends_at && Date.parse(t.trial_ends_at) < now) return false;
      return true;
    });

    const tenants: any[] = [];
    for (const t of active) {
      let mode: 'B2B' | 'B2C' = t.b2c_enabled === true ? 'B2C' : 'B2B';
      try {
        const dedicated = !!(t.db_url && t.db_service_key && t.db_url !== masterUrl());
        const supabase = dedicated ? createClient(t.db_url, t.db_service_key, NO_PERSIST) : master;
        mode = await businessMode({ tenant: t, supabase, dedicated, scope: (q: any) => (dedicated ? q : q.eq('tenant_id', t.id)) } as any);
      } catch (e) { /* keep the tenant-level default */ }
      tenants.push({ id: t.id, slug: t.slug, name: t.name || t.slug, mode, status: 'active', marketing: hasMarketingModule(t) });
    }
    return NextResponse.json({ tenants }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('[marketing/tenants]', e?.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
