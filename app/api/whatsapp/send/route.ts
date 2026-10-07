import { NextResponse } from 'next/server';
import { authorizeWhatsAppRequest } from '@/lib/whatsappServer';

const META_API_VERSION = 'v20.0';

// Caller identity and tenant are verified server-side (lib/whatsappServer.ts):
// the tenant is derived from the signed-in user's membership, never taken on
// trust from the request body.

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      db_url, tenantId,           // which tenant's config to use
      to: toRaw,                   // recipient phone, with country code. Optional when recipientType is 'business' (resolved server-side from the saved business_notify_phone)
      recordType, recordId,        // for logging + reminder dedup, e.g. 'retailOrders', 'RORD-00042'
      recipientType,               // 'customer' | 'owner' | 'business'
      sendMode = 'manual',         // 'manual' | 'automatic'
      templateKey,                 // internal key looked up in whatsapp_templates, e.g. 'rental_return_reminder'
      templateParams = [],         // array of strings, filled into the template's {{1}}, {{2}}, ... placeholders in order - used as a fallback when the template has no param_mappings configured
      record,                      // optional: the full source record (with custom_data), used to auto-resolve params via the template's param_mappings when configured
      freeformText,                // only valid within Meta's 24h customer-service window — used instead of templateKey
      documentMediaId,             // optional: a media ID from /api/whatsapp/upload-media, to attach a document (e.g. an invoice PDF)
      documentFilename,            // display filename for the attached document, e.g. "Invoice RINV-00042.pdf"
      dedupeHours,                 // optional: skip if this same template was already sent for this same record within N hours (used by the recurring rental-return reminder check)
    } = body;

    if (!toRaw && recipientType !== 'business') return NextResponse.json({ error: 'Recipient phone number is required.' }, { status: 400 });
    if (!templateKey && !freeformText && !documentMediaId) return NextResponse.json({ error: 'One of templateKey, freeformText, or documentMediaId is required.' }, { status: 400 });

    const auth = await authorizeWhatsAppRequest(request, { db_url, tenantId });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.supabase;
    const effectiveTenantId = auth.tenantId;

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('tenant_id', effectiveTenantId)
      .maybeSingle();

    // Background (automatic) sends - reminders, workflow actions - run for
    // every tenant whether or not WhatsApp is set up, so "not set up" is a
    // quiet skip for them, not an error. Manual sends still get a clear
    // message telling the user what to configure.
    const notReady = (msg: string) => sendMode === 'automatic'
      ? NextResponse.json({ skipped: true, reason: msg })
      : NextResponse.json({ error: msg }, { status: 400 });
    if (configError || !config) return notReady('WhatsApp is not configured for this workspace yet. Set it up in Admin Tools first.');
    if (!config.is_active) return notReady('WhatsApp sending is turned off for this workspace. Enable it in Admin Tools.');
    if (!config.phone_number_id || !config.access_token) return notReady('WhatsApp configuration is incomplete — missing phone number ID or access token.');

    // Recipient: digits only. 'business' messages go to the number saved in
    // this tenant's own settings, so the browser never needs to read it.
    let to = String(toRaw || '').replace(/\D/g, '');
    if (!to && recipientType === 'business') to = String(config.business_notify_phone || '').replace(/\D/g, '');
    if (to.length < 8) return notReady('No valid recipient phone number is available.');

    // Idempotency for recurring background checks: the rental-return reminder
    // runs on every app load, so the server (not the caller) guarantees the
    // same customer isn't messaged twice about the same booking. A failed
    // earlier attempt doesn't count, so it can be retried.
    if (Number(dedupeHours) > 0 && recordType && recordId && templateKey) {
      const since = new Date(Date.now() - Number(dedupeHours) * 3600_000).toISOString();
      const { data: dup } = await supabase.from('whatsapp_message_log').select('id')
        .eq('tenant_id', effectiveTenantId).eq('record_type', recordType).eq('record_id', recordId)
        .eq('template_key', templateKey).neq('status', 'failed').gte('created_at', since).limit(1);
      if (dup && dup.length) return NextResponse.json({ skipped: true, reason: 'Already sent recently.' });
    }

    let metaBody: any;
    let effectiveParamsForLog: string[] = [];
    let renderedTemplateTextForLog: string | null = null;
    let resolvedParamsForLog: string[] = [];
    let resolvedTemplateName: string | null = null;

    if (templateKey) {
      const { data: template } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('tenant_id', effectiveTenantId)
        .eq('template_key', templateKey)
        .eq('is_active', true)
        .maybeSingle();

      if (!template?.meta_template_name) {
        return NextResponse.json({ error: `No approved WhatsApp template is configured for "${templateKey}" — add its Meta template name in Admin Tools first.` }, { status: 400 });
      }
      resolvedTemplateName = template.meta_template_name;
      // Resolve parameters from the template's configured field mappings
      // when set - this is what makes a template's content admin-editable
      // rather than hardcoded in React code. Falls back to the
      // caller-provided templateParams for any template with no mappings
      // configured yet, so existing call sites keep working unchanged.
      const mappings: Array<{ field_key: string; field_type: 'standard'|'custom' }> = template.param_mappings || [];
      let resolvedParams: string[];
      if (mappings.length > 0 && record) {
        resolvedParams = mappings.map(m => {
          if (!m) return ''; // this placeholder position was left unmapped
          const val = m.field_type === 'custom' ? (record.custom_data || {})[m.field_key] : record[m.field_key];
          return val !== undefined && val !== null ? String(val) : '';
        });
      } else {
        resolvedParams = templateParams;
      }
      // Send exactly as many parameters as this tenant's actual approved
      // template declares (param_count), not however many the caller
      // happened to pass — a plain static template with param_count=0 gets
      // no components block at all, since Meta rejects a template call that
      // includes parameters the template itself has no placeholders for.
      const expectedCount = template.param_count ?? resolvedParams.length;
      const effectiveParams = resolvedParams.slice(0, expectedCount);
      effectiveParamsForLog = effectiveParams;
      // Renders the actual readable message text for conversation logging,
      // by substituting resolved params into the admin-entered preview
      // text - purely cosmetic for the log, has zero effect on what's
      // actually sent to Meta (which still uses template.meta_template_name
      // and the raw params directly, exactly as before).
      if (template.preview_text) {
        let rendered = template.preview_text;
        effectiveParams.forEach((p: string, i: number) => { rendered = rendered.replaceAll(`{{${i + 1}}}`, String(p)); });
        renderedTemplateTextForLog = rendered;
      }
      resolvedParamsForLog = resolvedParams;
      const bodyComponent = effectiveParams.length > 0 ? [{ type: 'body', parameters: effectiveParams.map((p: string) => ({ type: 'text', text: String(p) })) }] : [];
      // Document header — only valid if the approved Meta template was
      // itself configured with a Document header component in Meta
      // Business Manager. If it wasn't, Meta will reject this with an
      // error naming the mismatch, surfaced back as-is.
      const headerComponent = documentMediaId ? [{ type: 'header', parameters: [{ type: 'document', document: { id: documentMediaId, filename: documentFilename || 'document.pdf' } }] }] : [];
      const components = [...bodyComponent, ...headerComponent];
      metaBody = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template.meta_template_name,
          language: { code: template.language_code || 'en_US' },
          ...(components.length > 0 ? { components } : {}),
        },
      };
    } else if (documentMediaId) {
      // A document sent on its own (or alongside freeform text isn't
      // supported by Meta as a single message — send the document itself,
      // with any freeform text as its caption). Only deliverable within
      // Meta's 24h customer-service window, the same restriction as any
      // other freeform/session message.
      metaBody = {
        messaging_product: 'whatsapp', to, type: 'document',
        document: { id: documentMediaId, filename: documentFilename || 'document.pdf', ...(freeformText ? { caption: freeformText } : {}) },
      };
    } else {
      // Free-form text — only deliverable within 24h of the customer's last
      // message to this business number. Meta will reject this outside that
      // window; the error is surfaced back to the caller as-is so the UI can
      // explain it rather than silently failing.
      metaBody = { messaging_product: 'whatsapp', to, type: 'text', text: { body: freeformText } };
    }

    let metaResult: any = null;
    let sendError: string | null = null;
    try {
      const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${config.phone_number_id}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(metaBody),
      });
      metaResult = await res.json();
      if (!res.ok) sendError = metaResult?.error?.message || `Meta API returned ${res.status}`;
    } catch (fetchErr: any) {
      sendError = fetchErr?.message || 'Network error calling the WhatsApp API';
    }

    // Log every attempt regardless of outcome — this is also what the
    // automated-reminder dedup check queries against, so a failed send
    // still needs a row (marked failed, not silently dropped) or a retry
    // loop could spam the same failing message repeatedly.
    const loggedBody = freeformText
      || (renderedTemplateTextForLog ? `${renderedTemplateTextForLog}${resolvedParamsForLog?.length && effectiveParamsForLog?.length !== resolvedParamsForLog?.length ? ` (WARNING: only ${effectiveParamsForLog?.length || 0} of ${resolvedParamsForLog.length} values were actually sent - check this template's configured placeholder count in Admin Tools)` : ''}` : null)
      || (templateKey ? `[Template: ${templateKey}]${resolvedParamsForLog?.length ? ' ' + resolvedParamsForLog.join(' | ') : ''}${resolvedParamsForLog?.length && effectiveParamsForLog?.length !== resolvedParamsForLog?.length ? ` (WARNING: only ${effectiveParamsForLog?.length || 0} of ${resolvedParamsForLog.length} values were actually sent - check this template's configured placeholder count in Admin Tools)` : ''}` : null)
      || (documentMediaId ? `[Document: ${documentFilename || 'document.pdf'}]` : null);
    await supabase.from('whatsapp_message_log').insert({
      tenant_id: effectiveTenantId,
      record_type: recordType || null,
      record_id: recordId || null,
      recipient_phone: to,
      recipient_type: recipientType || null,
      send_mode: sendMode,
      template_key: templateKey || null,
      status: sendError ? 'failed' : 'sent',
      error_message: sendError,
      direction: 'outbound',
      message_body: loggedBody,
      meta_message_id: metaResult?.messages?.[0]?.id || null,
    });

    if (sendError) return NextResponse.json({ error: sendError }, { status: 502 });
    return NextResponse.json({ success: true, messageId: metaResult?.messages?.[0]?.id, templateUsed: resolvedTemplateName });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
