// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // ── Auth: only logged-in workspace users may consume the AI quota ──
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: userData, error: authErr } = await supa.auth.getUser(token);
    if (authErr || !userData?.user) return NextResponse.json({ error: 'Session expired — please log in again.' }, { status: 401 });

    const body = await request.json();
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
          model: 'llama-3.1-8b-instant',
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
