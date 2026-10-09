import { NextRequest, NextResponse } from 'next/server';
import { authorizeAi, getTenantAiSettings, aiErrorResponse } from '@/lib/ai/server';
import { chat } from '@/lib/ai/providers';

// Tests the SAVED settings with a tiny prompt.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const a = await authorizeAi(request, { tenantId: body.tenantId, db_url: body.db_url, requireAdmin: true });
    if ('res' in a) return a.res;
    const s = await getTenantAiSettings(a.ctx.master, a.ctx.tenantId);
    const t0 = Date.now();
    await chat(s, { system: 'Reply with the single word: ok', messages: [{ role: 'user', content: 'ping' }], maxTokens: 16 });
    return NextResponse.json({ ok: true, ms: Date.now() - t0 });
  } catch (e) { return aiErrorResponse(e); }
}
