// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Minimal permission set for SYSADMIN
const ALL_MODULES = [
  'leads','opportunities','customers','contacts','activities',
  'quotations','orders','invoices','products',
  'retail_customers','retail_orders','retail_invoices','retail_products','retail_activities',
  'admin','users','security','reports','workflow','appearance',
];
const ACTIONS = ['view','create','edit','delete','export'];
const SPECIAL = ['__admin__','view_team_records','view_all_records','approve_records','manage_ai'];

async function ensureSysadminRole(client) {
  // Check if SYSADMIN role exists
  let { data: role } = await client.from('roles').select('id').eq('role_code','SYSADMIN').maybeSingle();

  if (!role?.id) {
    // Create all 4 roles
    const roles = [
      { role_name:'System Administrator', role_code:'SYSADMIN',   description:'Full access to all modules.', status:'Active', data_scope:'all' },
      { role_name:'Sales Administrator',  role_code:'SALES_ADMIN', description:'Full access including admin tools.', status:'Active', data_scope:'all' },
      { role_name:'Sales Manager',        role_code:'SALES_MGR',   description:'Full CRM access. No admin tools.', status:'Active', data_scope:'org' },
      { role_name:'Sales Representative', role_code:'SALES_REP',   description:'View/Create/Edit only.', status:'Active', data_scope:'own' },
    ];
    await client.from('roles').upsert(roles, { onConflict: 'role_code' });
    const { data: newRole } = await client.from('roles').select('id').eq('role_code','SYSADMIN').maybeSingle();
    role = newRole;
  }

  if (!role?.id) return null;

  // Check if permissions exist
  const { data: existingPerms } = await client.from('permissions').select('id').limit(1);
  if (!existingPerms?.length) {
    // Seed all permissions
    const perms = [];
    for (const m of ALL_MODULES) {
      for (const a of ACTIONS) {
        perms.push({
          permission_name: `${a.charAt(0).toUpperCase()+a.slice(1)} ${m.replace(/_/g,' ')}`,
          permission_code: `${m}_${a}`,
          module_name: m,
        });
      }
    }
    for (const code of SPECIAL) {
      perms.push({ permission_name: code, permission_code: code, module_name: 'system' });
    }
    await client.from('permissions').upsert(perms, { onConflict: 'permission_code' });
  }

  // Check if SYSADMIN has permissions
  const { data: existingRP } = await client.from('role_permissions').select('id').eq('role_id', role.id).limit(1);
  if (!existingRP?.length) {
    // Assign all permissions to SYSADMIN
    const { data: allPerms } = await client.from('permissions').select('id');
    if (allPerms?.length) {
      const rps = allPerms.map(p => ({ role_id: role.id, permission_id: p.id }));
      // Delete first to avoid any constraint issues, then insert in batches
      await client.from('role_permissions').delete().eq('role_id', role.id);
      for (let i = 0; i < rps.length; i += 50) {
        await client.from('role_permissions').insert(rps.slice(i, i+50));
      }
    }
  }

  return role.id;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { db_url, db_service_key, admin_email, admin_name, tenant_name } = body;

  if (!db_url || !db_service_key || !admin_email) {
    return NextResponse.json({ error: 'db_url, db_service_key and admin_email are required' }, { status: 400 });
  }

  const firstName    = admin_name?.split(' ')[0] || 'System';
  const lastName     = admin_name?.split(' ').slice(1).join(' ') || 'Administrator';
  const chars        = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand         = Array.from({length:8}, ()=>chars[Math.floor(Math.random()*chars.length)]).join('');
  const tempPassword = `Bpro@${rand}!`;

  const client = createClient(db_url, db_service_key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const log = [];

  // ── Step 1: Ensure SYSADMIN role exists (auto-seed if needed) ────
  log.push('Checking SYSADMIN role...');
  const sysadminRoleId = await ensureSysadminRole(client);
  log.push(sysadminRoleId ? `SYSADMIN role ready: ${sysadminRoleId}` : 'FAILED to get/create SYSADMIN role');

  if (!sysadminRoleId) {
    return NextResponse.json({ error: 'Could not create or find SYSADMIN role. Ensure schema_complete_client.sql has been run.', log }, { status: 500 });
  }

  // ── Step 2: Create or update auth user ───────────────────────────
  let authUserId = null;
  let isNewUser  = false;

  const { data: listData } = await client.auth.admin.listUsers({ perPage: 1000 });
  const existingAuthUser = listData?.users?.find(u => u.email?.toLowerCase() === admin_email.toLowerCase());

  if (existingAuthUser) {
    log.push(`Auth user exists: ${existingAuthUser.id} — resetting password`);
    const { error: updateErr } = await client.auth.admin.updateUserById(
      existingAuthUser.id,
      { password: tempPassword, email_confirm: true }
    );
    if (updateErr) return NextResponse.json({ error: 'Failed to update password: ' + updateErr.message, log }, { status: 400 });
    authUserId = existingAuthUser.id;
  } else {
    log.push('Creating new auth user...');
    const { data: newUser, error: createErr } = await client.auth.admin.createUser({
      email: admin_email, password: tempPassword, email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (createErr) return NextResponse.json({ error: 'Failed to create auth user: ' + createErr.message, log }, { status: 400 });
    authUserId = newUser?.user?.id;
    isNewUser  = true;
    log.push(`New auth user created: ${authUserId}`);
  }

  if (!authUserId) return NextResponse.json({ error: 'Could not resolve auth user ID', log }, { status: 500 });

  // ── Step 3: Wait for auth trigger if new user ────────────────────
  if (isNewUser) {
    await new Promise(r => setTimeout(r, 2000));
    log.push('Waited 2s for auth trigger');
  }

  // ── Step 4: Upsert enterprise_user with SYSADMIN role ────────────
  const euBase = {
    auth_user_id: authUserId,
    first_name:   firstName,
    last_name:    lastName,
    email:        admin_email,
    designation:  'System Administrator',
    status:       'Active',
    is_admin:     true,
    role_id:      sysadminRoleId,
  };

  // Try with temporary_password column
  const { error: upsertErr } = await client.from('enterprise_users')
    .upsert({ ...euBase, temporary_password: tempPassword }, { onConflict: 'email' });

  if (upsertErr) {
    log.push(`Upsert with temp_password failed (${upsertErr.message}), trying without...`);
    await client.from('enterprise_users').upsert(euBase, { onConflict: 'email' });
  }

  // ── Step 5: Force update role_id by email (handles trigger conflict) ──
  const { error: forceErr } = await client.from('enterprise_users')
    .update({ role_id: sysadminRoleId, is_admin: true, auth_user_id: authUserId })
    .eq('email', admin_email);

  log.push(forceErr ? `Force update error: ${forceErr.message}` : 'Force update: role_id set');

  // ── Step 6: Verify ───────────────────────────────────────────────
  const { data: finalEU } = await client.from('enterprise_users')
    .select('id, role_id, is_admin, first_name, last_name').eq('email', admin_email).maybeSingle();

  log.push(`Final: role_id=${finalEU?.role_id}, is_admin=${finalEU?.is_admin}`);

  const roleAssigned = finalEU?.role_id === sysadminRoleId;

  return NextResponse.json({
    success:       true,
    email:         admin_email,
    password:      tempPassword,
    auth_user_id:  authUserId,
    role_assigned: roleAssigned,
    is_admin:      finalEU?.is_admin,
    log,
  });
}
