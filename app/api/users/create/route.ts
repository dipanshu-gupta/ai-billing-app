// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    email, password, first_name, last_name,
    role_id, designation, organization_id, business_unit_id,
    status = 'Active', is_admin = false,
    employee_code, username, phone,
    db_url, db_service_key, tenant_slug,
  } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  // ── Resolve which Supabase to use ────────────────────────────────
  const masterUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const masterServiceKey = process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY!;

  let targetUrl        = db_url || masterUrl;
  let targetServiceKey = db_service_key || null;

  // If dedicated tenant and no service key passed, look it up from master tenants table
  if (db_url && !targetServiceKey && masterServiceKey) {
    const masterClient = createClient(masterUrl, masterServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    // Find by db_url in tenants table
    const { data: tenant } = await masterClient
      .from('tenants')
      .select('db_service_key, slug')
      .eq('db_url', db_url)
      .maybeSingle();
    if (tenant?.db_service_key) {
      targetServiceKey = tenant.db_service_key;
    }
  }

  // For your own Supabase (no db_url), use master service key
  if (!targetServiceKey) {
    targetServiceKey = masterServiceKey;
  }

  if (!targetServiceKey) {
    return NextResponse.json({
      error: 'No service key available. Add SUPABASE_SERVICE_KEY to .env.local'
    }, { status: 500 });
  }

  // ── Create admin client ───────────────────────────────────────────
  const adminClient = createClient(targetUrl, targetServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // ── Step 1: Create or update Auth user ───────────────────────────
  let authUserId: string | null = null;
  const { data: listData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const existingAuth = listData?.users?.find(
    u => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingAuth) {
    await adminClient.auth.admin.updateUserById(existingAuth.id, {
      password, email_confirm: true
    });
    authUserId = existingAuth.id;
  } else {
    const { data: newAuth, error: authErr } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { first_name: first_name||'', last_name: last_name||'' },
    });
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });
    authUserId = newAuth?.user?.id || null;
    // Wait for auth trigger
    await new Promise(r => setTimeout(r, 1500));
  }

  if (!authUserId) {
    return NextResponse.json({ error: 'Failed to get auth user ID' }, { status: 500 });
  }

  // ── Step 2: Upsert enterprise_user ───────────────────────────────
  const payload: any = {
    auth_user_id:  authUserId,
    email,
    first_name:    first_name    || '',
    last_name:     last_name     || '',
    designation:   designation   || '',
    status,
    is_admin:      !!is_admin,
    role_id:       role_id       || null,
    employee_code: employee_code || null,
    username:      username      || null,
    phone:         phone         || null,
  };
  if (organization_id)  payload.organization_id  = organization_id;
  if (business_unit_id) payload.business_unit_id = business_unit_id;

  const { error: e1 } = await adminClient.from('enterprise_users')
    .upsert({ ...payload, temporary_password: password }, { onConflict: 'email' });
  if (e1) {
    await adminClient.from('enterprise_users').upsert(payload, { onConflict: 'email' });
  }

  // ── Step 3: Force update role (overrides auth trigger) ───────────
  await adminClient.from('enterprise_users')
    .update({ role_id: role_id||null, is_admin: !!is_admin, auth_user_id: authUserId })
    .eq('email', email);

  return NextResponse.json({ success: true, auth_user_id: authUserId });
}
