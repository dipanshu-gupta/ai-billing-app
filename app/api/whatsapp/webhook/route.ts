import { NextResponse } from 'next/server';
import {
  masterClient, findConfigOwners, pickTenantByLastOutbound, verifyMetaSignature,
  type WaDestination,
} from '@/lib/whatsappServer';

/**
 * GET — Meta's one-time webhook verification handshake.
 * Accepts the platform-wide WHATSAPP_WEBHOOK_VERIFY_TOKEN, or a verify token
 * a tenant saved in its own WhatsApp settings (for tenants running their own
 * Meta app). Anything else is rejected.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token) {
    if (token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) return new NextResponse(challenge, { status: 200 });
    try {
      const { data } = await masterClient().from('whatsapp_config').select('id').eq('webhook_verify_token', token).limit(1);
      if (data && data.length) return new NextResponse(challenge, { status: 200 });
    } catch { /* fall through to Forbidden */ }
  }
  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * Inserts an inbound message exactly once. Meta retries deliveries, and the
 * same message id arriving twice used to create duplicate rows.
 */
async function logInbound(dest: { tenantId: string | null; supabase: any }, msg: any) {
  if (msg.id) {
    const { data: existing } = await dest.supabase.from('whatsapp_message_log').select('id').eq('meta_message_id', msg.id).limit(1);
    if (existing && existing.length) return;
  }
  const { error } = await dest.supabase.from('whatsapp_message_log').insert({
    tenant_id: dest.tenantId,
    record_type: 'inbound',
    record_id: msg.from,
    recipient_phone: msg.from,
    recipient_type: 'customer',
    send_mode: 'inbound',
    status: 'received',
    direction: 'inbound',
    meta_message_id: msg.id,
    message_body: msg.text?.body || '[non-text message]',
  });
  // 23505 = lost a race with a concurrent retry of the same message: already stored.
  if (error && error.code !== '23505') console.error('[WhatsApp webhook] failed to log inbound message:', error.message);
}

/**
 * POST — message status updates and incoming customer messages.
 * Must respond 200 quickly for valid events or Meta retries and eventually
 * disables the subscription, so processing failures are logged, never thrown.
 * Unsigned/forged requests are the one exception: they get a 403.
 */
export async function POST(request: Request) {
  try {
    const raw = await request.text();

    const sig = verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'));
    if (sig === 'bad') return new NextResponse('Invalid signature', { status: 403 });
    if (sig === 'unconfigured') console.warn('[WhatsApp webhook] WHATSAPP_APP_SECRET is not set - request signatures are NOT being verified.');

    const body = JSON.parse(raw);

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        // Which tenant(s) does this business number belong to? Looked up in
        // the shared DB and in each dedicated tenant's own DB.
        const owners: WaDestination[] = await findConfigOwners(phoneNumberId);
        if (!owners.length) {
          console.warn(`[WhatsApp webhook] no tenant is configured for phone_number_id ${phoneNumberId} - ignoring event.`);
          continue;
        }

        // Delivery/read receipts: the row was written at send time in the
        // owning tenant's database; a Meta message id is globally unique, so
        // updating by it in each candidate destination only ever touches the
        // one real row - scoped by tenant on the shared DB as well.
        for (const status of value.statuses || []) {
          for (const dest of owners) {
            let q = dest.supabase.from('whatsapp_message_log')
              .update({ status: status.status, error_message: status.errors?.[0]?.title || null })
              .eq('meta_message_id', status.id);
            if (!dest.dedicated) q = q.eq('tenant_id', dest.tenantId);
            const { error } = await q;
            if (error) console.error('[WhatsApp webhook] failed to update message log:', error.message);
          }
        }

        // Incoming customer messages -> the owning tenant's inbox.
        for (const msg of value.messages || []) {
          let dest: WaDestination | null = owners.length === 1 ? owners[0] : null;
          if (!dest) {
            // The same business number is configured on more than one
            // tenant (a misconfiguration - it should be unique). Attribute
            // the reply to whoever last messaged this customer; if that's
            // not clear-cut, keep the message UNattributed (tenant_id NULL,
            // visible only to the platform workspace) rather than risk
            // showing one company's customer replies to another.
            dest = await pickTenantByLastOutbound(owners, msg.from);
            if (!dest) console.warn(`[WhatsApp webhook] phone_number_id ${phoneNumberId} is configured on ${owners.length} tenants and the reply from ${msg.from} could not be attributed.`);
          }
          if (dest) await logInbound({ tenantId: dest.tenantId, supabase: dest.supabase }, msg);
          else await logInbound({ tenantId: null, supabase: masterClient() }, msg);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[WhatsApp webhook] error:', err.message);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
