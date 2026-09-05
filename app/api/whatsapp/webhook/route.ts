import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Mirrors the same tenant-resolution pattern used by the other WhatsApp routes.
async function getMasterClient() {
  const masterUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const masterKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(masterUrl, masterKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * GET — Meta's one-time webhook verification handshake.
 * When you click "Verify and Save" in Meta for Developers, Meta sends a
 * GET request here with hub.mode=subscribe, hub.verify_token=<whatever you
 * configured>, and hub.challenge=<a random string>. This must check the
 * token matches WHATSAPP_WEBHOOK_VERIFY_TOKEN and echo the challenge back
 * as plain text - anything else and Meta considers verification failed.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * POST — actual webhook events from Meta: message status updates
 * (sent/delivered/read/failed) and incoming customer messages.
 * Must always respond 200 quickly, or Meta will retry and eventually
 * disable the webhook - so failures here are logged, never thrown.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await getMasterClient();

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;
        const phoneNumberId = value.metadata?.phone_number_id;

        // Message status updates (sent/delivered/read/failed) - matched
        // back to the row already logged at send time via meta_message_id.
        for (const status of value.statuses || []) {
          const metaStatus = status.status; // 'sent' | 'delivered' | 'read' | 'failed'
          const mapped = metaStatus === 'failed' ? 'failed' : metaStatus === 'sent' ? 'sent' : metaStatus; // keep 'delivered'/'read' as-is for finer-grained tracking than the original sent/failed/pending
          const { error } = await supabase.from('whatsapp_message_log')
            .update({ status: mapped, error_message: status.errors?.[0]?.title || null })
            .eq('meta_message_id', status.id);
          if (error) console.error('[WhatsApp webhook] failed to update message log:', error.message);
        }

        // Incoming customer messages - logged for now. Not yet building
        // full two-way conversation handling (auto-replies, routing into
        // an inbox UI) - that's a larger, separate feature. This at least
        // captures that a reply came in, rather than silently discarding it.
        for (const msg of value.messages || []) {
          if (!phoneNumberId) continue;
          const { data: config } = await supabase.from('whatsapp_config')
            .select('tenant_id').eq('phone_number_id', phoneNumberId).maybeSingle();
          await supabase.from('whatsapp_message_log').insert({
            tenant_id: config?.tenant_id || null,
            record_type: 'inbound',
            record_id: msg.from,
            recipient_phone: msg.from,
            recipient_type: 'customer',
            send_mode: 'inbound',
            status: 'received',
            meta_message_id: msg.id,
            error_message: msg.text?.body ? `Reply: ${msg.text.body.slice(0, 500)}` : '[non-text message]',
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    // Always 200 here too - Meta retries aggressively on non-2xx and will
    // eventually disable the webhook subscription if it keeps failing.
    console.error('[WhatsApp webhook] error:', err.message);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
