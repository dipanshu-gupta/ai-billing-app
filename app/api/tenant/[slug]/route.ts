// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Try multiple key names
  const key = process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('[tenant/manage] Missing env vars:', { url: !!url, key: !!key });
    return null;
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured — missing SUPABASE_SERVICE_KEY in .env.local' }, { status: 500 });
  }

  const body = await req.json();
  const { action, id, payload } = body;

  if (action === 'upsert') {
    if (id) {
      const { data, error } = await supabase
        .from('tenants')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ data });
    } else {
      const { data, error } = await supabase
        .from('tenants')
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ data });
    }
  }

  if (action === 'suspend') {
    const { id: tid, status } = body;
    const { error } = await supabase.from('tenants').update({ status }).eq('id', tid);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
