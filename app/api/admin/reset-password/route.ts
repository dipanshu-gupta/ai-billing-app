// @ts-nocheck
import { NextResponse } from 'next/server';
import { authorizeWhatsAppRequest } from '@/lib/whatsappServer';

/**
 * Set a user's password. Allowed for:
 *   - the signed-in user themself, or
 *   - an administrator of the workspace the target user belongs to.
 * The caller is verified from their session; the workspace and database come from that verified session, never
 * from the request body (previously anyone could change any user's password by sending their auth id).
 */
export async function POST(request: Request) {
  try {
    const { authUserId, password, db_url, tenantId } = await request.json();
    if (!authUserId || !password) return NextResponse.json({ error: 'Auth user ID and password are required.' }, { status: 400 });
    if (String(password).length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });

    const auth = await authorizeWhatsAppRequest(request, { db_url, tenantId });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const target = auth.supabase;

    const { data: tu, error: tuErr } = await target.auth.admin.getUserById(authUserId);
    if (tuErr || !tu?.user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    const isSelf = String(tu.user.email || '').toLowerCase() === String(auth.email || '').toLowerCase();

    if (!isSelf) {
      if (!auth.isAdmin) return NextResponse.json({ error: 'Only workspace administrators can change another user\'s password.' }, { status: 403 });
      let q = target.from('enterprise_users').select('id').or(`auth_user_id.eq.${authUserId},email.ilike.${String(tu.user.email || '').replace(/[,()"']/g, '')}`);
      if (!auth.dbUrl) q = q.eq('tenant_id', auth.tenantId);
      const { data: member } = await q.limit(1);
      if (!member || !member.length) return NextResponse.json({ error: 'This user is not in your workspace.' }, { status: 403 });
    }

    const { error } = await target.auth.admin.updateUserById(authUserId, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
