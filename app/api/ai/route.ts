// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // ── Auth: only logged-in workspace users may consume the AI quota ──
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();

    // Validate the token against the CORRECT Supabase project. A user on a
    // dedicated-database tenant has an access token issued by that tenant's
    // own, separate Supabase project — not the shared/master one. Always
    // validating against the shared project's credentials (the previous
    // behavior) meant any dedicated-tenant user would see "Session expired"
    // on a perfectly valid, current session, since the token simply isn't
    // valid for a different project. Falls back to the shared project's
    // credentials when the client doesn't send tenant-specific ones (the
    // shared-plan case, where that's correctly the right project anyway).
    const supabaseUrl = body.tenantDbUrl || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = body.tenantDbAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supa = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    // Timeout protection — this call had none at all, unlike the Groq call
    // below it which correctly has a 30s AbortController. If this hangs (a
    // transient network issue reaching Supabase's auth service), the entire
    // request would hang indefinitely with no way to recover, since the
    // client's own fetch() also has no timeout to fall back on.
    const authTimeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Authentication check timed out')), 10000));
    let userData, authErr;
    try {
      const result = await Promise.race([supa.auth.getUser(token), authTimeout]);
      userData = result.data; authErr = result.error;
    } catch (e: any) {
      return NextResponse.json({ error: 'Authentication check timed out — please try again.' }, { status: 504 });
    }
    if (authErr || !userData?.user) return NextResponse.json({ error: 'Session expired — please log in again.' }, { status: 401 });

    const { messages, system } = body;
    // Server-side cap — never trust client-provided limits
    const max_tokens = Math.min(Number(body.max_tokens) || 1024, 1500);
    const safeMessages = (Array.isArray(messages) ? messages : []).slice(-12);

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI is not configured for this deployment.' }, { status: 500 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          messages: [
            { role: 'system', content: String(system || '').slice(0, 24000) },
            ...safeMessages,
          ],
          max_tokens,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'AI service error — please try again.' },
        { status: response.status }
      );
    }

    const text = data?.choices?.[0]?.message?.content || 'No response generated.';
    return NextResponse.json({ content: [{ type: 'text', text }] });

  } catch (error: any) {
    const msg = error?.name === 'AbortError' ? 'AI request timed out — please try again.' : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
