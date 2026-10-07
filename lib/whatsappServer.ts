// @ts-nocheck
/**
 * Server-only helpers for the /api/whatsapp/* routes.
 *
 * Why this exists: these routes use the service-role key (which bypasses RLS)
 * on a tenant's WhatsApp credentials and message history. They previously
 * trusted a `tenantId` and `db_url` sent in the request body and performed no
 * authentication, so anyone who knew a tenant's UUID could send messages from
 * that tenant's WhatsApp number or overwrite its configuration. Here the
 * caller's identity is verified from their Supabase session token, and the
 * tenant is DERIVED from that verified user's membership - a tenantId in the
 * body is only ever checked against it, never believed.
 */
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

const NO_PERSIST = { auth: { autoRefreshToken: false, persistSession: false } };

export function masterUrl() { return process.env.NEXT_PUBLIC_SUPABASE_URL!; }
function masterKey() { return (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!; }
export function masterClient() { return createClient(masterUrl(), masterKey(), NO_PERSIST); }

function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out`)), ms)),
  ]);
}

export type WaAuthOk = { ok: true; supabase: any; tenantId: string; dbUrl: string | null; email: string; isAdmin: boolean };
export type WaAuthFail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): WaAuthFail => ({ ok: false, status, error });

async function userIsAdmin(target: any, membership: any): Promise<boolean> {
  if (membership?.is_admin === true) return true;
  if (!membership?.role_id) return false;
  const { data: rp } = await target.from('role_permissions').select('permission_id').eq('role_id', membership.role_id);
  const ids = (rp || []).map((x: any) => x.permission_id);
  if (!ids.length) return false;
  const { data: perms } = await target.from('permissions').select('permission_code').in('id', ids);
  const codes = (perms || []).map((p: any) => p.permission_code);
  return codes.includes('__admin__') || codes.includes('admin_tools_view');
}

export async function authorizeWhatsAppRequest(
  request: Request,
  opts: { db_url?: string | null; tenantId?: string | null; requireAdmin?: boolean }
): Promise<WaAuthOk | WaAuthFail> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return fail(401, 'Not authenticated');
  if (!masterUrl() || !masterKey()) return fail(500, 'Server misconfigured: missing Supabase credentials.');

  const master = masterClient();
  let target: any = master;
  let dbUrl: string | null = null;
  let dedicatedTenantId: string | null = null;

  // Dedicated-database tenant: the session token was issued by THAT
  // tenant's own Supabase project, so it must be validated there. The
  // db_url is only honoured if it matches a real tenants row - an arbitrary
  // URL can't be used to pick up some other tenant's service key.
  if (opts.db_url && opts.db_url !== masterUrl()) {
    const { data: trow } = await master.from('tenants').select('id, db_service_key').eq('db_url', opts.db_url).maybeSingle();
    if (!trow?.db_service_key) return fail(403, 'Unknown workspace.');
    target = createClient(opts.db_url, trow.db_service_key, NO_PERSIST);
    dbUrl = opts.db_url;
    dedicatedTenantId = trow.id;
  }

  let user: any;
  try {
    const r: any = await withTimeout(target.auth.getUser(token), 10000, 'Authentication check');
    if (r.error || !r.data?.user) return fail(401, 'Session expired — please log in again.');
    user = r.data.user;
  } catch (e: any) {
    return fail(504, 'Authentication check timed out — please try again.');
  }

  // Membership: the verified user must have an enterprise_users row. On the
  // shared database the auth pool is shared by every workspace, so a valid
  // login alone proves nothing about THIS tenant - the row must belong to the
  // tenant being asked about.
  const wantedTenant = dedicatedTenantId ? null : (opts.tenantId || null);
  let q1 = target.from('enterprise_users').select('*').eq('auth_user_id', user.id);
  if (wantedTenant) q1 = q1.eq('tenant_id', wantedTenant);
  let { data: rows } = await q1;
  if ((!rows || !rows.length) && user.email) {
    let q2 = target.from('enterprise_users').select('*').is('auth_user_id', null).ilike('email', user.email);
    if (wantedTenant) q2 = q2.eq('tenant_id', wantedTenant);
    ({ data: rows } = await q2);
  }
  if (!rows || !rows.length) return fail(403, 'You are not a member of this workspace.');

  let membership = rows[0];
  let tenantId: string | null = dedicatedTenantId;
  if (!dedicatedTenantId) {
    if (!wantedTenant && rows.length > 1) return fail(400, 'Workspace could not be determined — tenantId is required.');
    tenantId = membership.tenant_id || null;
    if (!tenantId) return fail(403, 'Your account is not assigned to a workspace.');
  }

  const isAdmin = await userIsAdmin(target, membership);
  if (opts.requireAdmin && !isAdmin) return fail(403, 'Only workspace administrators can do this.');

  return { ok: true, supabase: target, tenantId: tenantId!, dbUrl, email: user.email || '', isAdmin };
}

// ─── Webhook-side helpers ───────────────────────────────────────────────────
export type WaDestination = { tenantId: string; supabase: any; dedicated: boolean };

const _ownersCache = new Map<string, { at: number; value: WaDestination[] }>();

/**
 * Which tenant(s) own a given WhatsApp phone_number_id? Looks in the shared
 * database AND in every dedicated tenant's own database (a dedicated
 * tenant's authoritative config lives in its own DB, so the shared table
 * alone can't see it). Cached briefly - Meta can deliver bursts of events.
 */
export async function findConfigOwners(phoneNumberId: string, bypassCache = false): Promise<WaDestination[]> {
  const hit = _ownersCache.get(phoneNumberId);
  if (!bypassCache && hit && Date.now() - hit.at < 60_000) return hit.value;

  const master = masterClient();
  const out: WaDestination[] = [];
  const { data: tenants } = await master.from('tenants').select('id, db_url, db_service_key');
  const dedicated = new Map<string, { url: string; key: string }>();
  (tenants || []).forEach((t: any) => { if (t.db_url && t.db_service_key) dedicated.set(t.id, { url: t.db_url, key: t.db_service_key }); });

  const { data: rows } = await master.from('whatsapp_config').select('tenant_id').eq('phone_number_id', phoneNumberId);
  for (const r of rows || []) {
    if (!r.tenant_id || dedicated.has(r.tenant_id)) continue; // dedicated tenants are resolved from their own DB below
    out.push({ tenantId: r.tenant_id, supabase: master, dedicated: false });
  }
  await Promise.all(Array.from(dedicated.entries()).map(async ([tid, d]) => {
    try {
      const c = createClient(d.url, d.key, NO_PERSIST);
      const { data } = await withTimeout(c.from('whatsapp_config').select('tenant_id').eq('phone_number_id', phoneNumberId).limit(1), 4000, 'dedicated scan');
      if (data && data.length) out.push({ tenantId: tid, supabase: c, dedicated: true });
    } catch (e) { /* unreachable dedicated DB - skip, never fail the webhook */ }
  }));

  _ownersCache.set(phoneNumberId, { at: Date.now(), value: out });
  return out;
}

/**
 * When one phone_number_id is (mis)configured on several tenants, a reply
 * can't be attributed from the webhook payload alone. The sound tiebreak: a
 * customer's reply belongs to whichever tenant most recently messaged that
 * customer's number. Returns null when there is no single clear winner -
 * the caller then stores the message unattributed rather than guessing.
 */
export async function pickTenantByLastOutbound(cands: WaDestination[], senderPhone: string): Promise<WaDestination | null> {
  const last10 = String(senderPhone).replace(/\D/g, '').slice(-10);
  if (!last10) return null;
  let best: WaDestination | null = null, bestTs = 0, tie = false;
  for (const c of cands) {
    try {
      let q = c.supabase.from('whatsapp_message_log').select('created_at')
        .eq('direction', 'outbound').like('recipient_phone', `%${last10}`)
        .order('created_at', { ascending: false }).limit(1);
      if (!c.dedicated) q = q.eq('tenant_id', c.tenantId);
      const { data } = await q;
      const ts = data?.[0] ? Date.parse(data[0].created_at) : 0;
      if (ts > bestTs) { best = c; bestTs = ts; tie = false; }
      else if (ts > 0 && ts === bestTs) tie = true;
    } catch (e) { /* ignore a failing candidate */ }
  }
  return best && !tie ? best : null;
}

/**
 * Verifies Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body
 * with the Meta app secret). Without this, anyone could POST forged
 * "incoming customer messages" or delivery statuses at the webhook URL.
 * WHATSAPP_APP_SECRET may hold several comma-separated secrets when tenants
 * use different Meta apps. Returns 'unconfigured' when no secret is set so a
 * rollout can't instantly break an existing integration - set it in the
 * hosting environment to turn enforcement on.
 */
export function verifyMetaSignature(rawBody: string, header: string | null): 'ok' | 'bad' | 'unconfigured' {
  const secrets = (process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!secrets.length) return 'unconfigured';
  if (!header || !header.startsWith('sha256=')) return 'bad';
  let given: Buffer;
  try { given = Buffer.from(header.slice(7), 'hex'); } catch { return 'bad'; }
  for (const s of secrets) {
    const expected = createHmac('sha256', s).update(rawBody, 'utf8').digest();
    if (given.length === expected.length && timingSafeEqual(given, expected)) return 'ok';
  }
  return 'bad';
}
