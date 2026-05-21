import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) return NextResponse.json({ error: 'Missing NEXT_PUBLIC_SUPABASE_URL in .env.local' }, { status: 500 });
    if (!key) return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY in .env.local' }, { status: 500 });

    const { email, password } = await request.json();
    if (!email || !password) return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });

    const supabaseAdmin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ authUserId: data.user.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}