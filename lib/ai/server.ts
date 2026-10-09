// Server-only helpers shared by the /api/ai routes.
import { NextResponse } from 'next/server';
import { authorizeWhatsAppRequest, masterClient } from '@/lib/whatsappServer';
import { decryptSecret } from '@/lib/ai/crypto';
import { AiError } from '@/lib/ai/providers';

export type AiCtx = { tenantId: string; userEmail: string; isAdmin: boolean; master: any };

/** Verify session + membership of THAT tenant (+ admin when asked) + tenant active. */
export async function authorizeAi(request: Request, opts: { db_url?: string | null; tenantId?: string | null; requireAdmin?: boolean }): Promise<{ ctx: AiCtx } | { res: NextResponse }> {
  const a = await authorizeWhatsAppRequest(request, opts);
  if (!a.ok) return { res: NextResponse.json({ error: a.error }, { status: a.status }) };
  const master = masterClient();
  const { data: t } = await master.from('tenants').select('id, status').eq('id', a.tenantId).maybeSingle();
  if (!t) return { res: NextResponse.json({ error: 'Unknown workspace.' }, { status: 403 }) };
  if (['suspended', 'expired', 'cancelled'].includes(String(t.status || '').toLowerCase()))
    return { res: NextResponse.json({ error: 'Workspace is not active.' }, { status: 403 }) };
  return { ctx: { tenantId: a.tenantId, userEmail: a.email, isAdmin: a.isAdmin, master } };
}

export async function loadTenantAi(master: any, tenantId: string) {
  const { data } = await master.from('tenant_ai_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
  return data || null;
}

/** Decrypted settings for chat(); throws AI_NOT_CONFIGURED when missing. */
export async function getTenantAiSettings(master: any, tenantId: string) {
  const row = await loadTenantAi(master, tenantId);
  if (!row) throw new AiError('AI_NOT_CONFIGURED', 'AI is not set up for this business yet.', 409);
  try {
    return { provider: row.provider, model: row.model, baseUrl: row.base_url, apiKey: decryptSecret(row.key_ciphertext) };
  } catch {
    throw new AiError('AI_NOT_CONFIGURED', 'AI is not set up for this business yet.', 409);
  }
}

export function aiErrorResponse(e: any) {
  if (e instanceof AiError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
  if (e?.message === 'AI_KEYS_SECRET_MISSING')
    return NextResponse.json({ error: 'AI storage is not configured on this deployment (AI_KEYS_SECRET).', code: 'SERVER_CONFIG' }, { status: 500 });
  return NextResponse.json({ error: 'AI request failed - please try again.' }, { status: 500 });
}

// Per-tenant sliding-window limiter (per server instance; best-effort).
const hits = new Map<string, number[]>();
export function rateLimited(tenantId: string, limit = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const arr = (hits.get(tenantId) || []).filter(t => now - t < windowMs);
  if (arr.length >= limit) { hits.set(tenantId, arr); return true; }
  arr.push(now); hits.set(tenantId, arr);
  return false;
}
