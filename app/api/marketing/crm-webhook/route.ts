// @ts-nocheck
import { NextResponse } from 'next/server';
import { masterClient } from '@/lib/whatsappServer';
import { verifyOrbitRequest, resolveTenantTarget, businessMode } from '@/lib/marketingServer';

/**
 * POST /api/marketing/crm-webhook
 *
 * Receives Orbit (Marketing Cloud) `lead.upsert` events and writes them into
 * the tenant's own CRM:
 *   - B2B tenants  -> public.leads             (matched on orbit_lead_id, then email)
 *   - B2C tenants  -> public.retail_customers  (matched on orbit_lead_id, then phone/email)
 *
 * Security: the body is signed with a key derived for THIS tenant only
 * (derive('crm', tenantId)), so one tenant's key cannot write into another
 * tenant. Events are de-duplicated on (tenant_id, event id) before any write;
 * a failed write releases the event so Orbit's retry can succeed.
 * Returning non-2xx makes Orbit raise an approval item instead of guessing.
 */
const STATUS_B2B: Record<string, string> = { new: 'New', contacted: 'Contacted', review: 'Contacted', 'needs-review': 'Contacted', handoff: 'Qualified', unsubscribed: 'Unqualified' };
const clip = (v: any, n: number) => (v == null ? '' : String(v)).slice(0, n);
const digits = (v: any) => String(v || '').replace(/\D/g, '');
const newNumber = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 200_000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  let event: any;
  try { event = verifyOrbitRequest(raw, request.headers, 'crm'); }
  catch (e: any) { console.error('[marketing/crm-webhook] misconfigured:', e?.message); return NextResponse.json({ error: 'Integration is not configured.' }, { status: 503 }); }
  if (!event) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  if (event.type !== 'lead.upsert' || !event.lead || typeof event.lead !== 'object' || !/^[A-Za-z0-9._:-]{1,120}$/.test(String(event.id || ''))) {
    return NextResponse.json({ error: 'Unsupported event' }, { status: 400 });
  }
  const lead = event.lead;
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(String(lead.id || ''))) return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });

  const target = await resolveTenantTarget(event.tenantId, { requireModule: false });
  if ('error' in target) return NextResponse.json({ error: target.error }, { status: target.status });

  const master = masterClient();
  const { error: dupErr } = await master.from('marketing_sync_events').insert({ tenant_id: event.tenantId, event_id: String(event.id), lead_id: String(lead.id) });
  if (dupErr) {
    if (dupErr.code === '23505') return NextResponse.json({ ok: true, duplicate: true });
    console.error('[marketing/crm-webhook] dedupe insert failed:', dupErr.message);
    return NextResponse.json({ error: 'Could not record event' }, { status: 503 });
  }

  try {
    const mode = await businessMode(target);
    const meta = {
      orbit_lead_id: String(lead.id),
      source: clip(lead.source, 120),
      campaign_id: clip(lead.campaignId, 100),
      interest: clip(lead.interest, 2000),
      status: clip(lead.status, 40),
      email_consent: lead.consent === true,
      email_consent_at: lead.consentAt || null,
      whatsapp_consent: lead.whatsappConsent === true,
      voice_consent: lead.voiceConsent === true,
      suppressed: lead.suppressed === true,
      score: Number.isFinite(Number(lead.score)) ? Number(lead.score) : null,
      synced_at: new Date().toISOString(),
    };
    const result = mode === 'B2C' ? await upsertRetailCustomer(target, lead, meta) : await upsertLead(target, lead, meta);
    if (lead.status === 'handoff') await notifyAdmins(target, lead, result).catch(() => {});
    await master.from('marketing_sync_events').update({ record_type: result.recordType, record_id: result.recordId }).eq('tenant_id', event.tenantId).eq('event_id', String(event.id));
    return NextResponse.json({ ok: true, mode, ...result });
  } catch (e: any) {
    console.error('[marketing/crm-webhook] write failed:', e?.message);
    await master.from('marketing_sync_events').delete().eq('tenant_id', event.tenantId).eq('event_id', String(event.id));
    return NextResponse.json({ error: 'CRM write failed' }, { status: 500 });
  }
}

async function upsertLead(t: any, lead: any, meta: any) {
  const db = t.supabase;
  let { data: row } = await t.scope(db.from('leads').select('id, lead_number, status, email, phone, customer, custom_data').eq('orbit_lead_id', meta.orbit_lead_id)).limit(1).maybeSingle();
  const email = clip(lead.email, 250).toLowerCase();
  if (!row && email) {
    ({ data: row } = await t.scope(db.from('leads').select('id, lead_number, status, email, phone, customer, custom_data').is('orbit_lead_id', null).ilike('email', email)).order('created_at', { ascending: false }).limit(1).maybeSingle());
  }
  const now = new Date().toISOString();
  if (!row) {
    const leadNumber = newNumber('LEAD');
    const { error } = await db.from('leads').insert([{
      ...t.stamp,
      lead_number: leadNumber,
      orbit_lead_id: meta.orbit_lead_id,
      name: clip(lead.name || lead.phone || email || 'Marketing lead', 200),
      email, phone: clip(lead.phone, 40), customer: clip(lead.company, 200),
      source: clip(`Marketing Cloud${meta.source ? ' - ' + meta.source : ''}`, 120),
      status: STATUS_B2B[meta.status] || 'New',
      description: meta.interest, amount: 0,
      created_by: 'marketing-cloud', updated_by: 'marketing-cloud', created_at: now, updated_at: now,
      custom_data: { marketing_cloud: meta },
    }]);
    if (error) throw new Error(error.message);
    return { recordType: 'leads', recordId: leadNumber, created: true };
  }
  // Existing lead: never overwrite what sales has entered. Fill blanks only,
  // refresh the marketing metadata, and advance status only from early stages.
  const patch: any = { orbit_lead_id: meta.orbit_lead_id, updated_by: 'marketing-cloud', updated_at: now, custom_data: { ...(row.custom_data || {}), marketing_cloud: meta } };
  if (!row.email && email) patch.email = email;
  if (!row.phone && lead.phone) patch.phone = clip(lead.phone, 40);
  if (!row.customer && lead.company) patch.customer = clip(lead.company, 200);
  if (meta.status === 'handoff' && ['New', 'Contacted'].includes(row.status)) patch.status = 'Qualified';
  else if (meta.status === 'contacted' && row.status === 'New') patch.status = 'Contacted';
  const { error } = await t.scope(db.from('leads').update(patch).eq('id', row.id));
  if (error) throw new Error(error.message);
  return { recordType: 'leads', recordId: row.lead_number, created: false };
}

async function upsertRetailCustomer(t: any, lead: any, meta: any) {
  const db = t.supabase;
  const cols = 'id, customer_number, email, phone, marketing_opt_in, custom_data';
  let { data: row } = await t.scope(db.from('retail_customers').select(cols).eq('orbit_lead_id', meta.orbit_lead_id)).limit(1).maybeSingle();
  const email = clip(lead.email, 250).toLowerCase();
  const phone = digits(lead.phone);
  if (!row && phone.length >= 8) {
    // Stored phones are free-form ("+91 98765 43210"), so narrow by the last
    // four digits in SQL and compare the normalised last ten digits here.
    const { data: cands } = await t.scope(db.from('retail_customers').select(cols).is('orbit_lead_id', null).like('phone', `%${phone.slice(-4)}`)).limit(50);
    row = (cands || []).find((c: any) => digits(c.phone).slice(-10) === phone.slice(-10)) || null;
  }
  if (!row && email) {
    ({ data: row } = await t.scope(db.from('retail_customers').select(cols).is('orbit_lead_id', null).ilike('email', email)).limit(1).maybeSingle());
  }
  const optIn = !meta.suppressed && (meta.email_consent || meta.whatsapp_consent);
  const now = new Date().toISOString();
  if (!row) {
    const number = newNumber('RCUST');
    const { error } = await db.from('retail_customers').insert([{
      ...t.stamp,
      customer_number: number,
      orbit_lead_id: meta.orbit_lead_id,
      name: clip(lead.name || lead.phone || email || 'Marketing contact', 200),
      email, phone: clip(lead.phone, 40),
      marketing_opt_in: optIn,
      preferred_contact: phone ? 'WhatsApp' : 'Email',
      notes: meta.interest,
      status: 'Active',
      owner: 'marketing-cloud',
      created_at: now, updated_at: now,
      custom_data: { marketing_cloud: meta },
    }]);
    if (error) throw new Error(error.message);
    return { recordType: 'retail_customers', recordId: number, created: true };
  }
  const patch: any = { orbit_lead_id: meta.orbit_lead_id, updated_at: now, custom_data: { ...(row.custom_data || {}), marketing_cloud: meta } };
  if (!row.email && email) patch.email = email;
  if (!row.phone && lead.phone) patch.phone = clip(lead.phone, 40);
  // An opt-out always wins; an opt-in is only recorded when consent was given.
  if (meta.suppressed) patch.marketing_opt_in = false;
  else if (optIn && row.marketing_opt_in !== true) patch.marketing_opt_in = true;
  const { error } = await t.scope(db.from('retail_customers').update(patch).eq('id', row.id));
  if (error) throw new Error(error.message);
  return { recordType: 'retail_customers', recordId: row.customer_number, created: false };
}

// Sales handoff: tell the workspace administrators in the ERP bell.
async function notifyAdmins(t: any, lead: any, result: any) {
  const { data: admins } = await t.scope(t.supabase.from('enterprise_users').select('email, status').eq('is_admin', true)).limit(20);
  const rows = (admins || []).filter((a: any) => a.email && String(a.status || '').toLowerCase() !== 'inactive').map((a: any) => ({
    ...t.stamp,
    recipient_email: a.email,
    type: 'marketing_handoff',
    title: `Marketing Cloud handoff: ${clip(lead.name || lead.phone || lead.email, 120)}`,
    body: clip(lead.interest || 'A marketing lead asked to speak with your team.', 500),
    record_type: result.recordType === 'leads' ? 'leads' : 'retailCustomers',
    record_id: result.recordId,
    is_read: false,
  }));
  if (rows.length) await t.supabase.from('notifications').insert(rows);
}
