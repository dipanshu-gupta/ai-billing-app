import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

// Masks a secret for display — shows only the last 4 characters, so the
// admin can confirm "yes, a token is saved" and roughly which one, without
// the full value ever reaching the browser after the initial save.
function maskSecret(value: string | null) {
  if (!value) return null;
  if (value.length <= 4) return '••••';
  return '••••' + value.slice(-4);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const db_url = searchParams.get('db_url') || undefined;
    const tenantId = searchParams.get('tenantId') || null;

    const supabase = await resolveClient(db_url);
    const { data: config } = await supabase.from('whatsapp_config').select('*').eq('tenant_id', tenantId).maybeSingle();
    const { data: templates } = await supabase.from('whatsapp_templates').select('*').eq('tenant_id', tenantId);

    return NextResponse.json({
      config: config ? { ...config, access_token: maskSecret(config.access_token), webhook_verify_token: maskSecret(config.webhook_verify_token) } : null,
      templates: templates || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { db_url, tenantId, config, templates } = body;
    const supabase = await resolveClient(db_url);

    if (config) {
      const payload: any = {
        tenant_id: tenantId || null,
        is_active: !!config.is_active,
        phone_number_id: config.phone_number_id || null,
        business_account_id: config.business_account_id || null,
        display_phone_number: config.display_phone_number || null,
        updated_at: new Date().toISOString(),
      };
      // Only overwrite the access token if a new, real value was actually
      // provided — the UI sends back the masked "••••1234" placeholder on
      // every save unless the admin explicitly typed a new token, and
      // writing that placeholder string over the real token would silently
      // break sending until someone noticed.
      if (config.access_token && !config.access_token.startsWith('••••')) payload.access_token = config.access_token;
      if (config.webhook_verify_token && !config.webhook_verify_token.startsWith('••••')) payload.webhook_verify_token = config.webhook_verify_token;

      const { error } = await supabase.from('whatsapp_config').upsert(payload, { onConflict: 'tenant_id' });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (Array.isArray(templates)) {
      for (const tpl of templates) {
        await supabase.from('whatsapp_templates').upsert({
          tenant_id: tenantId || null,
          template_key: tpl.template_key,
          meta_template_name: tpl.meta_template_name || null,
          language_code: tpl.language_code || 'en_US',
          is_active: tpl.is_active !== false,
          param_count: tpl.param_count ?? 3,
        }, { onConflict: 'tenant_id,template_key' });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
