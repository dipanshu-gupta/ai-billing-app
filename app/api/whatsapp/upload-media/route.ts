import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const META_API_VERSION = 'v20.0';

// Mirrors the same tenant-resolution pattern used by the other WhatsApp routes.
async function resolveClient(db_url?: string) {
  const masterUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const masterKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  let targetUrl = masterUrl;
  let targetKey = masterKey;
  if (db_url && db_url !== masterUrl && masterKey) {
    const master = createClient(masterUrl, masterKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: tenant } = await master.from('tenants').select('db_service_key').eq('db_url', db_url).maybeSingle();
    if (tenant?.db_service_key) { targetUrl = db_url; targetKey = tenant.db_service_key; }
  }
  return createClient(targetUrl, targetKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { db_url, tenantId, fileBase64, filename, mimeType = 'application/pdf' } = body;

    if (!fileBase64) return NextResponse.json({ error: 'No file data provided.' }, { status: 400 });

    const supabase = await resolveClient(db_url);
    const { data: config } = await supabase.from('whatsapp_config').select('*').eq('tenant_id', tenantId || null).maybeSingle();

    if (!config?.is_active) return NextResponse.json({ error: 'WhatsApp is not active for this workspace.' }, { status: 400 });
    if (!config.phone_number_id || !config.access_token) {
      return NextResponse.json({ error: 'WhatsApp configuration is incomplete.' }, { status: 400 });
    }

    // Meta's media endpoint requires multipart/form-data, not JSON - the
    // client sends base64 (simpler over a JSON API route), converted back
    // into a real file here for the actual upload to Meta.
    const buffer = Buffer.from(fileBase64, 'base64');
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
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
