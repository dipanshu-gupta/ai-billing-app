import { NextResponse } from 'next/server';
import { authorizeWhatsAppRequest } from '@/lib/whatsappServer';

const META_API_VERSION = 'v20.0';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { db_url, tenantId, fileBase64, filename, mimeType = 'application/pdf' } = body;

    if (!fileBase64) return NextResponse.json({ error: 'No file data provided.' }, { status: 400 });

    const buffer = Buffer.from(fileBase64, 'base64');
    if (buffer.length < 100) {
      return NextResponse.json({ error: `The generated file is suspiciously small (${buffer.length} bytes) - this usually means PDF generation failed silently rather than producing a real document. Try again, or check the browser console for errors during PDF creation.` }, { status: 400 });
    }

    const auth = await authorizeWhatsAppRequest(request, { db_url, tenantId });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.supabase;
    const { data: config } = await supabase.from('whatsapp_config').select('*').eq('tenant_id', auth.tenantId).maybeSingle();

    if (!config?.is_active) return NextResponse.json({ error: 'WhatsApp is not active for this workspace.' }, { status: 400 });
    if (!config.phone_number_id || !config.access_token) {
      return NextResponse.json({ error: 'WhatsApp configuration is incomplete.' }, { status: 400 });
    }

    // Meta's media endpoint requires multipart/form-data, not JSON - the
    // client sends base64 (simpler over a JSON API route), converted back
    // into a real file here for the actual upload to Meta.
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    // 'type' is a required field in its own right per Meta's official docs
    // (separate from the file part's own Content-Type header) - previously
    // missing here entirely, which is a plausible explanation for an
    // upload that reports success but the resulting media never actually
    // delivers when referenced in a later send.
    formData.append('type', mimeType);
    formData.append('file', new Blob([buffer], { type: mimeType }), filename || 'document.pdf');

    const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${config.phone_number_id}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.access_token}` },
      body: formData,
    });
    const result = await res.json();

    if (!res.ok || !result.id) {
      return NextResponse.json({ error: result?.error?.message || 'Upload to WhatsApp failed.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, mediaId: result.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
