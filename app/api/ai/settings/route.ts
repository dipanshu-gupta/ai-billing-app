import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeAi, loadTenantAi, aiErrorResponse } from '@/lib/ai/server';
import { PROVIDERS, AiError } from '@/lib/ai/providers';
import { encryptSecret, aiCryptoConfigured } from '@/lib/ai/crypto';

// Never returns the key - only provider / model / last4 / updated_at.
const view = (r: any) => r ? { configured: true, provider: r.provider, model: r.model, base_url: r.base_url, key_last4: r.key_last4, updated_at: r.updated_at } : { configured: false };

function q(request: NextRequest) {
  const u = new URL(request.url);
  return { tenantId: u.searchParams.get('tenantId'), db_url: u.searchParams.get('db_url') };
}

export async function GET(request: NextRequest) {
  const a = await authorizeAi(request, { ...q(request), requireAdmin: true });
  if ('res' in a) return a.res;
  const row = await loadTenantAi(a.ctx.master, a.ctx.tenantId);
  return NextResponse.json({ ...view(row), serverReady: aiCryptoConfigured() });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const a = await authorizeAi(request, { tenantId: body.tenantId, db_url: body.db_url, requireAdmin: true });
    if ('res' in a) return a.res;
    const { ctx } = a;
    const provider = String(body.provider || '');
    const model = String(body.model || '').trim().slice(0, 200);
    if (!PROVIDERS[provider]) throw new AiError('BAD_PROVIDER', 'Choose an AI provider.');
    if (!model) throw new AiError('BAD_MODEL', 'Choose or type a model.');
    const baseUrl = provider === 'custom' ? String(body.base_url || '').trim().slice(0, 300) : null;
    if (provider === 'custom' && !baseUrl) throw new AiError('BAD_URL', 'Enter the base URL.');
    const existing = await loadTenantAi(ctx.master, ctx.tenantId);
    const newKey = String(body.api_key || '').trim();
    if (!newKey && !existing) throw new AiError('NO_KEY', 'Enter the API key.');
    const row: any = {
      tenant_id: ctx.tenantId, provider, model, base_url: baseUrl,
      updated_at: new Date().toISOString(),
    };
    if (newKey) { row.key_ciphertext = encryptSecret(newKey); row.key_last4 = newKey.slice(-4); }
    else { row.key_ciphertext = existing.key_ciphertext; row.key_last4 = existing.key_last4; }
    // Best-effort: record who changed it (master auth id).
    try {
      const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!body.db_url) {
        const { data } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).auth.getUser(token);
        row.updated_by = data?.user?.id || null;
      }
    } catch {}
    const { error } = await ctx.master.from('tenant_ai_settings').upsert(row, { onConflict: 'tenant_id' });
    if (error) return NextResponse.json({ error: 'Could not save AI settings.' }, { status: 500 });
    return NextResponse.json(view(await loadTenantAi(ctx.master, ctx.tenantId)));
  } catch (e) { return aiErrorResponse(e); }
}

export async function DELETE(request: NextRequest) {
  const a = await authorizeAi(request, { ...q(request), requireAdmin: true });
  if ('res' in a) return a.res;
  await a.ctx.master.from('tenant_ai_settings').delete().eq('tenant_id', a.ctx.tenantId);
  return NextResponse.json({ configured: false });
}
