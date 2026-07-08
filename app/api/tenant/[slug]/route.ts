// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const s = slug?.toLowerCase().trim();
  if (!s || s.length < 2) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });

  if (s === 'demo') {
    return NextResponse.json({
      id:'00000000-0000-0000-0000-000000000001', slug:'demo', name:'Umbrella Suite Demo',
      plan:'shared', status:'active', db_url:null, db_anon_key:null,
      logo_url:null, brand_color:'#0F172A', app_name:'Umbrella Suite',
      custom_domain:null, b2c_enabled:true, max_users:999,
      modules:['crm','invoicing','retail','reports','ai','admin'], trial_ends_at:null,
    });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey!,
    { auth: { autoRefreshToken: false, persistSession: false } });

  const COLS = 'id,slug,name,plan,status,db_url,db_anon_key,logo_url,brand_color,app_name,custom_domain,b2c_enabled,max_users,modules,trial_ends_at,created_at';

  // Fetch regardless of status so we can return the right error
  let { data: tenant } = await supabase.from('tenants').select(COLS).eq('slug', s).maybeSingle();

  if (!tenant) {
    const host = (req.headers.get('x-tenant-host') || '').split(':')[0];
    if (host) {
      const { data } = await supabase.from('tenants').select(COLS).eq('custom_domain', host).maybeSingle();
      tenant = data;
    }
  }

  if (!tenant) return NextResponse.json({ error: `Tenant "${s}" not found` }, { status: 404 });

  // Return specific status codes for different states
  if (tenant.status === 'suspended') {
    return NextResponse.json({ error: 'Account Suspended', status: tenant.status }, { status: 403 });
  }
  if (tenant.status === 'expired' || tenant.status === 'cancelled') {
    return NextResponse.json({ error: 'Trial Expired', status: tenant.status }, { status: 402 });
  }
  if (tenant.trial_ends_at && new Date(tenant.trial_ends_at) < new Date() && tenant.plan === 'trial') {
    return NextResponse.json({ error: 'Trial Expired', status: 'expired' }, { status: 402 });
  }

  return NextResponse.json(tenant, { headers: { 'Cache-Control': 'private, max-age=30' } });
}
