// @ts-nocheck
/**
 * Server-only helpers for the Marketing Cloud (Orbit) integration.
 *
 * Orbit runs as a separate app at ORBIT_URL (orbit.umbrellasuite.com). The two
 * apps share ONE platform secret, ORBIT_ERP_SHARED_SECRET, which is never used
 * directly: every purpose (SSO tokens, CRM events, WhatsApp export) and every
 * tenant gets its own HMAC-derived key. Orbit derives the same keys.
 *
 *   derive('sso-v1')            -> signs the single sign-on token
 *   derive('crm', tenantId)     -> Orbit signs lead.upsert events with this
 *   derive('wa-export', tenant) -> Orbit signs WhatsApp-settings requests
 */
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { masterClient, masterUrl } from '@/lib/whatsappServer';

const NO_PERSIST = { auth: { autoRefreshToken: false, persistSession: false } };
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function orbitUrl(): string {
  return (process.env.ORBIT_URL || 'https://orbit.umbrellasuite.com').replace(/\/$/, '');
}

export const NOT_CONFIGURED = 'ORBIT_ERP_SHARED_SECRET is missing or shorter than 32 characters.';
export function orbitConfigured(): boolean { return (process.env.ORBIT_ERP_SHARED_SECRET || '').length >= 32; }

function sharedSecret(): string {
  const s = process.env.ORBIT_ERP_SHARED_SECRET || '';
  if (s.length < 32) throw new Error(NOT_CONFIGURED);
  return s;
}

export function derive(purpose: string, tenantId = ''): string {
  return createHmac('sha256', sharedSecret()).update(`${purpose}:${tenantId}`).digest('hex');
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

/** 90-second, single-use (jti) HS256 token that Orbit exchanges for a session. */
export function signSsoToken(claims: Record<string, any>, ttlSeconds = 90): string {
  const iat = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64url(JSON.stringify({ iss: 'umbrella-erp', aud: 'orbit', iat, exp: iat + ttlSeconds, jti: randomUUID().replace(/-/g, ''), ...claims }));
  const s = b64url(createHmac('sha256', derive('sso-v1')).update(`${h}.${p}`).digest());
  return `${h}.${p}.${s}`;
}

/**
 * Verifies a request signed by Orbit: X-Orbit-Timestamp (unix seconds, within
 * 5 minutes) and X-Orbit-Signature = hex HMAC-SHA256(key, ts + "." + rawBody),
 * where key = derive(purpose, tenantId). Returns the parsed body or null.
 */
export function verifyOrbitRequest(rawBody: string, headers: Headers, purpose: string): any | null {
  const stamp = headers.get('x-orbit-timestamp') || '';
  const sig = headers.get('x-orbit-signature') || '';
  if (!/^\d{9,12}$/.test(stamp) || Math.abs(Date.now() / 1000 - Number(stamp)) > 300) return null;
  if (!/^[0-9a-f]{64}$/.test(sig)) return null;
  let body: any;
  try { body = JSON.parse(rawBody); } catch { return null; }
  const tenantId = String(body?.tenantId || '').toLowerCase();
  if (!UUID_RE.test(tenantId)) return null;
  const expected = createHmac('sha256', derive(purpose, tenantId)).update(`${stamp}.${rawBody}`).digest();
  const given = Buffer.from(sig, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return { ...body, tenantId };
}

export type TenantTarget = {
  tenant: any;               // master tenants row
  supabase: any;             // service-role client for the tenant's data
  dedicated: boolean;        // dedicated DB => no tenant_id column filter
  scope: (q: any) => any;    // applies tenant_id filter on the shared DB
  stamp: Record<string, any>;// columns to add on insert (tenant_id on shared DB)
};

export function hasMarketingModule(tenant: any): boolean {
  const m = tenant?.modules;
  const list = Array.isArray(m) ? m : (typeof m === 'string' ? (() => { try { return JSON.parse(m); } catch { return m.split(','); } })() : []);
  return list.map((x: any) => String(x).trim().toLowerCase()).includes('marketing');
}

/**
 * Resolves an ACTIVE tenant to a service-role client. requireModule (default true) also demands the
 * "marketing" module: browser launches need it; Orbit-signed server calls pass requireModule:false
 * because the per-tenant signature is already the authority.
 */
export async function resolveTenantTarget(tenantId: string, opts: { requireModule?: boolean } = {}): Promise<TenantTarget | { error: string; status: number }> {
  const master = masterClient();
  const { data: tenant } = await master.from('tenants')
    .select('id, slug, name, status, plan, modules, b2c_enabled, db_url, db_service_key, trial_ends_at')
    .eq('id', tenantId).maybeSingle();
  if (!tenant) return { error: 'Unknown workspace.', status: 404 };
  if (['suspended', 'expired', 'cancelled'].includes(String(tenant.status || '').toLowerCase())) return { error: 'Workspace is not active.', status: 403 };
  if (tenant.plan === 'trial' && tenant.trial_ends_at && new Date(tenant.trial_ends_at) < new Date()) return { error: 'Workspace trial has ended.', status: 402 };
  if (opts.requireModule !== false && !hasMarketingModule(tenant)) return { error: 'Marketing Cloud is not enabled for this workspace.', status: 403 };
  const dedicated = !!(tenant.db_url && tenant.db_service_key && tenant.db_url !== masterUrl());
  const supabase = dedicated ? createClient(tenant.db_url, tenant.db_service_key, NO_PERSIST) : master;
  return {
    tenant, supabase, dedicated,
    scope: (q: any) => dedicated ? q : q.eq('tenant_id', tenant.id),
    stamp: dedicated ? {} : { tenant_id: tenant.id },
  };
}

/** B2C if the tenant's app preferences say so, else the tenant-level default. */
export async function businessMode(target: TenantTarget): Promise<'B2B' | 'B2C'> {
  try {
    const { data } = await target.scope(target.supabase.from('app_preferences').select('b2c_mode, settings, updated_at'))
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (data) {
      const b2c = data.settings && typeof data.settings === 'object' && 'b2c_mode' in data.settings ? data.settings.b2c_mode : data.b2c_mode;
      return b2c === true ? 'B2C' : 'B2B';
    }
  } catch (e) { /* fall back below */ }
  return target.tenant.b2c_enabled === true ? 'B2C' : 'B2B';
}
