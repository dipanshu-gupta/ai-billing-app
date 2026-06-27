// @ts-nocheck
/**
 * POST /api/tenant/provision
 *
 * Provisions a new client database:
 * 1. Creates a Supabase Auth user via Management API
 * 2. Creates an enterprise_user record with SYSADMIN role
 * 3. Returns credentials to show the admin
 *
 * Uses the client's own Supabase credentials (db_url + service key)
 * for the enterprise_user insert.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    db_url,           // client's Supabase URL
    db_service_key,   // client's service role key (needed for admin operations)
    admin_email,      // email to create
    admin_name,       // e.g. "John Smith"
    tenant_name,      // e.g. "ABC Corp"
  } = body;

  if (!db_url || !db_service_key || !admin_email) {
    return NextResponse.json({
      error: 'db_url, db_service_key and admin_email are required'
    }, { status: 400 });
  }

  // Generate a temporary password
  const tempPassword = 'Admin@' + Math.random().toString(36).slice(2, 8).toUpperCase() + '1!';

  // Create admin client pointing to CLIENT's Supabase using their service key
  const clientAdmin = createClient(db_url, db_service_key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Step 1: Create auth user via Supabase Admin API
  const firstName = admin_name?.split(' ')[0] || 'System';
  const lastName  = admin_name?.split(' ').slice(1).join(' ') || 'Administrator';

  const { data: authUser, error: authError } = await clientAdmin.auth.admin.createUser({
    email:          admin_email,
    password:       tempPassword,
    email_confirm:  true,  // auto-confirm email
    user_metadata: {
      first_name: firstName,
      last_name:  lastName,
    },
  });

  if (authError) {
    return NextResponse.json({
      error: 'Failed to create auth user: ' + authError.message
    }, { status: 400 });
  }

  const authUserId = authUser.user?.id;

  // Step 2: Get SYSADMIN role id from client DB
  const { data: roleData } = await clientAdmin
    .from('roles')
    .select('id')
    .eq('role_code', 'SYSADMIN')
    .maybeSingle();

  // Step 3: Create enterprise_user with SYSADMIN role
  const { error: euError } = await clientAdmin
    .from('enterprise_users')
    .upsert({
      auth_user_id: authUserId,
      first_name:   firstName,
      last_name:    lastName,
      email:        admin_email,
      designation:  'System Administrator',
      status:       'Active',
      is_admin:     true,
      role_id:      roleData?.id || null,
    }, { onConflict: 'email' });

  if (euError) {
    console.warn('[Provision] enterprise_user insert failed:', euError.message);
    // Don't fail — auth user was created, admin can fix enterprise_user manually
  }

  return NextResponse.json({
    success:      true,
    email:        admin_email,
    password:     tempPassword,
    auth_user_id: authUserId,
    message:      `Admin user created. Share credentials with ${tenant_name} securely.`,
  });
}
