// @ts-nocheck
/**
 * GET /api/tenant/[slug]
 * Resolves a tenant by slug or custom domain.
 * Queries the master Supabase tenant registry.
 * Returns safe public tenant config (NO secrets).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const masterSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const slug = params.slug?.toLowerCase().trim();
  if (!slug || slug.length < 2) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });

  // Dev demo shortcut
  if (slug === 'demo') {
    return NextResponse.json({
      id:'00000000-0000-0000-0000-000000000001', slug:'demo', name:'Business Pro Demo',
      plan:'shared', status:'active', db_url:null, db_anon_key:null,
      logo_url:null, brand_color:'#0F172A', app_name:'Business Pro',
      custom_domain:null, b2c_enabled:true, max_users:999,
      modules:['crm','invoicing','retail','reports','ai','admin'], trial_ends_at:null,
    });
  }

  // Lookup by slug
  const COLS = 'id,slug,name,plan,status,db_url,db_anon_key,logo_url,brand_color,app_name,custom_domain,b2c_enabled,max_users,modules,trial_ends_at,created_at';
  let { data: tenant } = await masterSupabase.from('tenants').select(COLS).eq('slug', slug).eq('status','active').maybeSingle();

  // Fallback: lookup by custom domain
  if (!tenant) {
    const host = (req.headers.get('x-tenant-host') || '').split(':')[0];
    if (host) {
      const { data } = await masterSupabase.from('tenants').select(COLS).eq('custom_domain', host).eq('status','active').maybeSingle();
      tenant = data;
    }
  }

  if (!tenant) return NextResponse.json({ error: `Tenant "${slug}" not found` }, { status: 404 });
  if (tenant.trial_ends_at && new Date(tenant.trial_ends_at) < new Date()) return NextResponse.json({ error: 'Trial expired' }, { status: 402 });

  return NextResponse.json(tenant, { headers: { 'Cache-Control': 'private, max-age=60' } });
}
