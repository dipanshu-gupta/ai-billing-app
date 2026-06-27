// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { db_url, db_service_key, admin_email, admin_name, tenant_name } = body;

  if (!db_url || !db_service_key || !admin_email) {
    return NextResponse.json({ error: 'db_url, db_service_key and admin_email are required' }, { status: 400 });
  }

  const firstName   = admin_name?.split(' ')[0] || 'System';
  const lastName    = admin_name?.split(' ').slice(1).join(' ') || 'Administrator';
  const chars       = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand        = Array.from({length:8}, ()=>chars[Math.floor(Math.random()*chars.length)]).join('');
  const tempPassword = `Bpro@${rand}!`;

  const adminClient = createClient(db_url, db_service_key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // ── Step 1: Ensure temporary_password column exists ──────────────
  // Use raw SQL via rpc if available, or just try the upsert and handle error
  try {
    await adminClient.rpc('exec_sql', {
      sql: `alter table enterprise_users add column if not exists temporary_password text;`
    });
  } catch(e) {
    // rpc may not exist — column may already exist — continue anyway
  }

  // ── Step 2: Create or update auth user ───────────────────────────
  let authUserId = null;

  // Check if user already exists
  const { data: listData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const existingAuthUser = listData?.users?.find(u => u.email?.toLowerCase() === admin_email.toLowerCase());

  if (existingAuthUser) {
    // Update existing auth user password + confirm email
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(
      existingAuthUser.id,
      {
        password:      tempPassword,
        email_confirm: true,
      }
    );
    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update password: ' + updateErr.message }, { status: 400 });
    }
    authUserId = existingAuthUser.id;
  } else {
    // Create new auth user
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email:         admin_email,
      password:      tempPassword,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (createErr) {
      return NextResponse.json({ error: 'Failed to create auth user: ' + createErr.message }, { status: 400 });
    }
    authUserId = newUser?.user?.id;
  }

  if (!authUserId) {
    return NextResponse.json({ error: 'Could not resolve auth user ID' }, { status: 500 });
  }

  // ── Step 3: Get SYSADMIN role ─────────────────────────────────────
  const { data: roleData } = await adminClient
    .from('roles').select('id').eq('role_code', 'SYSADMIN').maybeSingle();

  // ── Step 4: Upsert enterprise_user ───────────────────────────────
  const euPayload: any = {
    auth_user_id: authUserId,
    first_name:   firstName,
    last_name:    lastName,
    email:        admin_email,
    designation:  'System Administrator',
    status:       'Active',
    is_admin:     true,
    role_id:      roleData?.id || null,
  };

  // Try with temporary_password first
  const { error: euErr1 } = await adminClient
    .from('enterprise_users')
    .upsert({ ...euPayload, temporary_password: tempPassword }, { onConflict: 'email' });

  if (euErr1) {
    // Column might not exist — try without it
    console.warn('[Provision] temporary_password column missing, inserting without it');
    const { error: euErr2 } = await adminClient
      .from('enterprise_users')
      .upsert(euPayload, { onConflict: 'email' });
    if (euErr2) {
      console.warn('[Provision] enterprise_user upsert failed:', euErr2.message);
    }
  }

  return NextResponse.json({
    success:      true,
    email:        admin_email,
    password:     tempPassword,
    auth_user_id: authUserId,
    note:         existingAuthUser ? 'Existing user password reset' : 'New user created',
  });
}
