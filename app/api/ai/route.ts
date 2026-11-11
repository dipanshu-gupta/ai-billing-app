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
    // RBAC: "Use AI Advisor" (manage_ai) is a role permission; enforced here, not only by hiding the button.
    if (!ctx.canUseAi) return NextResponse.json({ error: 'Your role does not include the AI Advisor. Ask your administrator to enable "Use AI Advisor" for your role.', code: 'AI_FORBIDDEN' }, { status: 403 });

    if (rateLimited(ctx.tenantId)) {
      return NextResponse.json({ error: 'Too many AI requests - please wait a moment.' }, { status: 429 });
    }

    const settings = await getTenantAiSettings(ctx.master, ctx.tenantId);
    const max_tokens = Math.min(Number(body.max_tokens) || 1024, 2500);
    const safeMessages = (Array.isArray(body.messages) ? body.messages : []).slice(-30)
      .map((m: any) => ({ role: m?.role === 'assistant' ? 'assistant' : 'user', content: String(m?.content ?? '').slice(0, 16000) }));
    const { text } = await chat(settings, {
      system: String(body.system || '').slice(0, 60000),
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
