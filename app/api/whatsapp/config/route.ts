import { NextResponse } from 'next/server';
import { authorizeWhatsAppRequest, findConfigOwners } from '@/lib/whatsappServer';

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

    // Any member of the workspace may read the (masked) settings - the order
    // screens need to know whether WhatsApp is switched on - but only for
    // their OWN workspace: the tenant comes from the verified session.
    const auth = await authorizeWhatsAppRequest(request, { db_url, tenantId });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.supabase;
    const { data: config } = await supabase.from('whatsapp_config').select('*').eq('tenant_id', auth.tenantId).maybeSingle();
    const { data: templates } = await supabase.from('whatsapp_templates').select('*').eq('tenant_id', auth.tenantId);

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

    // Changing credentials and templates is an administrator action.
    const auth = await authorizeWhatsAppRequest(request, { db_url, tenantId, requireAdmin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.supabase;
    const effectiveTenantId = auth.tenantId;

    if (config) {
      // One WhatsApp business number can belong to only one workspace:
      // Meta's webhook identifies the receiving number, nothing else, so two
      // workspaces sharing one would have their customers' replies mixed up.
      if (config.phone_number_id) {
        const owners = await findConfigOwners(String(config.phone_number_id), true);
        if (owners.some(o => o.tenantId !== effectiveTenantId)) {
          return NextResponse.json({ error: 'This WhatsApp Phone Number ID is already connected to another workspace. A number can only be used by one workspace — use a different number, or disconnect it there first.' }, { status: 409 });
        }
      }
      const payload: any = {
        tenant_id: effectiveTenantId,
        is_active: !!config.is_active,
        phone_number_id: config.phone_number_id || null,
        business_account_id: config.business_account_id || null,
        display_phone_number: config.display_phone_number || null,
        business_notify_phone: config.business_notify_phone || null,
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
          tenant_id: effectiveTenantId,
          template_key: tpl.template_key,
          meta_template_name: tpl.meta_template_name || null,
          preview_text: tpl.preview_text || null,
          language_code: tpl.language_code || 'en_US',
          is_active: tpl.is_active !== false,
          param_count: tpl.param_count ?? 3,
          object_type: tpl.object_type || null,
          param_mappings: tpl.param_mappings || [],
          attach_document: !!tpl.attach_document,
          document_source: tpl.document_source || null,
          send_conditions: tpl.send_conditions || { logic: 'AND', conditions: [] },
        }, { onConflict: 'tenant_id,template_key' });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
