import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { authUserId, password, db_url } = await request.json();
    if (!authUserId || !password) return NextResponse.json({ error: 'Auth user ID and password are required.' }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });

    const masterUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const masterKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
    let targetUrl = masterUrl;
    let targetKey = masterKey;

    // Support tenant databases
    if (db_url && db_url !== masterUrl && masterKey) {
      const master = createClient(masterUrl, masterKey, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: tenant } = await master.from('tenants').select('db_service_key').eq('db_url', db_url).maybeSingle();
      if (tenant?.db_service_key) { targetUrl = db_url; targetKey = tenant.db_service_key; }
    }

    const supabaseAdmin = createClient(targetUrl, targetKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}