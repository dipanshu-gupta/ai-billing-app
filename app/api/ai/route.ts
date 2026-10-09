// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { authorizeAi, getTenantAiSettings, aiErrorResponse, rateLimited } from '@/lib/ai/server';
import { chat } from '@/lib/ai/providers';

// Advisor / Insights. Uses the calling tenant's OWN provider, model and key
// (set in Admin Tools > AI Settings). No platform key, no default model.
export async function POST(request: NextRequest) {
  let isAdminFlag = false;
  try {
    const body = await request.json();
    const a = await authorizeAi(request, { tenantId: body.tenantId, db_url: body.tenantDbUrl });
    if ('res' in a) return a.res;
    const { ctx } = a;
    isAdminFlag = ctx.isAdmin;

    if (rateLimited(ctx.tenantId)) {
      return NextResponse.json({ error: 'Too many AI requests - please wait a moment.' }, { status: 429 });
    }

    const settings = await getTenantAiSettings(ctx.master, ctx.tenantId);
    const max_tokens = Math.min(Number(body.max_tokens) || 1024, 1500);
    const safeMessages = (Array.isArray(body.messages) ? body.messages : []).slice(-12);
    const { text } = await chat(settings, {
      system: String(body.system || '').slice(0, 24000),
      messages: safeMessages,
      maxTokens: max_tokens,
    });
    return NextResponse.json({ content: [{ type: 'text', text }] });
  } catch (e) {
    if (e?.code === 'AI_NOT_CONFIGURED') {
      return NextResponse.json({ error: e.message, code: e.code, isAdmin: !!isAdminFlag }, { status: 409 });
    }
    return aiErrorResponse(e);
  }
}
