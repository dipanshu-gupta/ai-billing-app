// @ts-nocheck
import { NextResponse } from 'next/server';
import { verifyOrbitRequest, resolveTenantTarget, orbitConfigured, businessMode } from '@/lib/marketingServer';

/**
 * POST /api/marketing/products   (server-to-server, Orbit -> ERP)
 *
 * Returns the sellable catalogue of ONE tenant (the one in the signed body). Signed with
 * derive('products', tenantId): a valid signature proves the request is for that tenant only, and the
 * query is scoped to it (tenant_id filter on the shared DB, the tenant's own database when dedicated).
 * Works for the master/demo tenant and does not require the "marketing" module.
 * Only public-facing fields are returned: never cost, stock, reorder level, supplier or tax internals.
 * B2C tenants read retail_products, B2B tenants read products.
 */
const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_ITEMS = 500;
const INACTIVE = /^(inactive|discontinued|archived|retired|disabled|deleted)/i;

/** Public HTTPS PNG/JPEG/WebP only (checked by extension; size/content checks are Orbit's on fetch). */
function cleanImage(u: any): string | null {
  const s = String(u || '').trim();
  if (!s || s.length > 2000) return null;
  try {
    const url = new URL(s);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':') || host.endsWith('.local') || host.endsWith('.internal')) return null;
    if (!/\.(png|jpe?g|webp)$/i.test(url.pathname)) return null;
    return url.toString();
  } catch { return null; }
}

const txt = (v: any, max: number): string | null => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};

export async function POST(request: Request) {
  if (!orbitConfigured()) return NextResponse.json({ error: 'Marketing Cloud is not configured.' }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 10_000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  let body: any;
  try { body = verifyOrbitRequest(raw, request.headers, 'products'); }
  catch (e: any) { return NextResponse.json({ error: 'Integration is not configured.' }, { status: 503 }); }
  if (!body) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  try {
    const target = await resolveTenantTarget(body.tenantId, { requireModule: false });
    if ('error' in target) return NextResponse.json({ products: [] }, { headers: NO_STORE });

    const mode = await businessMode(target);
    const table = mode === 'B2C' ? 'retail_products' : 'products';

    // Currency: tenant's default currency preference (ISO code), INR when unset.
    let currency = 'INR';
    try {
      const { data: pref } = await target.scope(target.supabase.from('app_preferences').select('*'))
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      const c = String(pref?.settings?.default_currency || pref?.default_currency || '').trim().toUpperCase();
      if (/^[A-Z]{3}$/.test(c)) currency = c;
    } catch { /* keep default */ }

    const { data, error } = await target.scope(
      target.supabase.from(table).select('id, name, price, unit, description, category, image_url, status')
    ).order('name', { ascending: true }).limit(MAX_ITEMS);
    if (error) {
      console.error('[marketing/products] query failed:', error.message);
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }
    const products = (data || [])
      .filter((p: any) => p.id && String(p.name || '').trim())
      .slice(0, MAX_ITEMS)
      .map((p: any) => {
        const price = Number(p.price);
        return {
          id: String(p.id),
          name: String(p.name).trim().slice(0, 200),
          price: Number.isFinite(price) ? price : 0,
          currency,
          unit: txt(p.unit, 30),
          description: txt(p.description, 2000),
          category: txt(p.category, 100),
          image_url: cleanImage(p.image_url),
          url: null,
          active: !INACTIVE.test(String(p.status || '')),
        };
      });
    return NextResponse.json({ products }, { headers: NO_STORE });
  } catch (e: any) {
    console.error('[marketing/products]', e?.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
