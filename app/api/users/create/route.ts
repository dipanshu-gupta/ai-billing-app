// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { authorizeWhatsAppRequest } from '@/lib/whatsappServer';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    email, password, first_name, last_name,
    role_id, designation, organization_id, business_unit_id,
    status = 'Active', is_admin = false,
    employee_code, username, phone,
    db_url, db_service_key, tenant_slug, tenant_id,
  } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  // ── Who is asking, and for which workspace ───────────────────────
  // Only an administrator of the workspace may add users to it. The workspace and its database come from the
  // caller's verified session (previously this route was open and trusted tenant_id / db_url / service key from the
  // request body, so anyone could create an administrator in any workspace).
  const auth = await authorizeWhatsAppRequest(req, { db_url: db_url || null, tenantId: tenant_id || null, requireAdmin: true });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const shared = !auth.dbUrl;
  const adminClient = auth.supabase;

  // The role must belong to THIS workspace.
  if (role_id) {
    const { data: r } = await adminClient.from('roles').select('id, tenant_id').eq('id', role_id).maybeSingle();
    if (!r || (shared && r.tenant_id && r.tenant_id !== auth.tenantId)) {
      return NextResponse.json({ error: 'That role does not belong to your workspace.' }, { status: 400 });
    }
  }
  // On the shared database one email = one workspace: never move (or reset the password of) another workspace's user.
  if (shared) {
    const { data: other } = await adminClient.from('enterprise_users').select('tenant_id').ilike('email', email).maybeSingle();
    if (other?.tenant_id && other.tenant_id !== auth.tenantId) {
      return NextResponse.json({ error: 'This email already belongs to a user in another workspace. Use a different email.' }, { status: 409 });
    }
  }

  // ── Step 1: Create or update Auth user ───────────────────────────
  let authUserId: string | null = null;
  const { data: listData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const existingAuth = listData?.users?.find(
    u => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingAuth) {
    // Only re-use (and re-password) an existing login that already belongs to a user of THIS workspace.
    let mq = adminClient.from('enterprise_users').select('id').ilike('email', email);
    if (shared) mq = mq.eq('tenant_id', auth.tenantId);
    const { data: mine } = await mq.limit(1);
    if (!mine || !mine.length) {
      return NextResponse.json({ error: 'A login with this email already exists. Use a different email, or ask the platform owner.' }, { status: 409 });
    }
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
  if (shared)           payload.tenant_id         = auth.tenantId;

  const { error: e1 } = await adminClient.from('enterprise_users')
    .upsert({ ...payload, temporary_password: password }, { onConflict: 'email' });
  if (e1) {
    await adminClient.from('enterprise_users').upsert(payload, { onConflict: 'email' });
  }

  // ── Step 3: Force update role (overrides auth trigger) ───────────
  let fq = adminClient.from('enterprise_users')
    .update({ role_id: role_id||null, is_admin: !!is_admin, auth_user_id: authUserId })
    .eq('email', email);
  if (shared) fq = fq.eq('tenant_id', auth.tenantId);
  await fq;

  return NextResponse.json({ success: true, auth_user_id: authUserId });
}
