// @ts-nocheck
import { NextResponse } from 'next/server';
import { verifyOrbitRequest, resolveTenantTarget } from '@/lib/marketingServer';

/**
 * POST /api/marketing/whatsapp-export   (server-to-server, Orbit -> ERP)
 *
 * Marketing Cloud owns WhatsApp conversations. When a tenant first opens it,
 * Orbit asks for the number already configured here so the customer does not
 * reconnect. The request must be signed with derive('wa-export', tenantId),
 * which only the Orbit server can produce; the response goes server-to-server
 * over HTTPS and is stored encrypted by Orbit. The ERP keeps its own copy and
 * continues to send invoices/reminders with it.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  let body: any;
  try { body = verifyOrbitRequest(raw, request.headers, 'wa-export'); }
  catch (e: any) { return NextResponse.json({ error: 'Integration is not configured.' }, { status: 503 }); }
  if (!body) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  const target = await resolveTenantTarget(body.tenantId, { requireModule: false });
  if ('error' in target) return NextResponse.json({ error: target.error }, { status: target.status });

  const { data: cfg } = await target.scope(target.supabase.from('whatsapp_config')
    .select('phone_number_id, business_account_id, access_token, display_phone_number, is_active'))
    .limit(1).maybeSingle();
  if (!cfg?.phone_number_id || !cfg?.access_token || !cfg?.business_account_id) {
    return NextResponse.json({ none: true }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({
    phone_number_id: String(cfg.phone_number_id),
    business_account_id: String(cfg.business_account_id),
    access_token: cfg.access_token,
    display_phone_number: cfg.display_phone_number || null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
