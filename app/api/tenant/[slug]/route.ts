// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const masterSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const s = slug?.toLowerCase().trim();
  if (!s || s.length < 2) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });

  if (s === 'demo') {
    return NextResponse.json({
      id:'00000000-0000-0000-0000-000000000001', slug:'demo', name:'Business Pro Demo',
      plan:'shared', status:'active', db_url:null, db_anon_key:null,
      logo_url:null, brand_color:'#0F172A', app_name:'Business Pro',
      custom_domain:null, b2c_enabled:true, max_users:999,
      modules:['crm','invoicing','retail','reports','ai','admin'], trial_ends_at:null,
    });
  }

  const COLS = 'id,slug,name,plan,status,db_url,db_anon_key,logo_url,brand_color,app_name,custom_domain,b2c_enabled,max_users,modules,trial_ends_at,created_at';

  let { data: tenant } = await masterSupabase
    .from('tenants').select(COLS).eq('slug', s).eq('status','active').maybeSingle();

  if (!tenant) {
    const host = (req.headers.get('x-tenant-host') || '').split(':')[0];
    if (host) {
      const { data } = await masterSupabase
        .from('tenants').select(COLS).eq('custom_domain', host).eq('status','active').maybeSingle();
      tenant = data;
    }
  }

  if (!tenant) return NextResponse.json({ error: `Tenant "${s}" not found` }, { status: 404 });

  if (tenant.trial_ends_at && new Date(tenant.trial_ends_at) < new Date()) {
    return NextResponse.json({ error: 'Trial expired' }, { status: 402 });
  }

  return NextResponse.json(tenant, { headers: { 'Cache-Control': 'private, max-age=60' } });
}
