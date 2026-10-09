import { NextRequest, NextResponse } from 'next/server';
import { authorizeAi, loadTenantAi, aiErrorResponse } from '@/lib/ai/server';
import { listModels, AiError } from '@/lib/ai/providers';
import { decryptSecret } from '@/lib/ai/crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const a = await authorizeAi(request, { tenantId: body.tenantId, db_url: body.db_url, requireAdmin: true });
    if ('res' in a) return a.res;
    let key = String(body.api_key || '').trim();
    if (!key) {
      const row = await loadTenantAi(a.ctx.master, a.ctx.tenantId);
      if (!row) throw new AiError('NO_KEY', 'Enter the API key first.');
      key = decryptSecret(row.key_ciphertext);
    }
    const models = await listModels(String(body.provider || ''), key, body.base_url);
    return NextResponse.json({ models });
  } catch (e) { return aiErrorResponse(e); }
}
