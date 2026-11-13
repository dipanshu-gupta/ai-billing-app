// @ts-nocheck
'use client';
/**
 * Barcode engine: product lookup, scan-to-line-item, handheld-scanner detection and scan feedback.
 *
 * Product barcodes
 *   - Every product has one main barcode (products.barcode / retail_products.barcode).
 *   - Extra barcodes live in product_barcodes, each with a pack quantity (a box of 12 has its own barcode and adds 12).
 *   - A barcode is unique per workspace (database index + the checks below).
 *
 * Lookup order for a scanned code: main barcode -> extra barcodes -> SKU (many businesses print the SKU as a
 * Code-128 label). EAN-13 / UPC-A are treated as the same code ("0" + 12-digit UPC == EAN-13), so a label printed
 * either way matches. Everything is tenant-scoped (tenantScope + RLS); the client product list the grid already holds
 * is searched first so scanning is instant, with a database fallback for products not loaded on this page.
 */
import { tenantScope } from './utils';

export type ProductKind = 'b2b' | 'b2c';
export const productTable = (kind: ProductKind) => (kind === 'b2c' ? 'retail_products' : 'products');

/** Strip scanner noise (control chars, AIM prefixes like "]E0", surrounding spaces). Keeps leading zeros. */
export function normalizeBarcode(raw: any) {
  let s = String(raw ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
  s = s.replace(/^\][A-Za-z]\d/, ''); // symbology identifier some scanners prepend
  return s;
}

/** Equivalent spellings of the same code (EAN-13 <-> UPC-A, case-insensitive for alphanumeric Code-128). */
export function barcodeVariants(code: string) {
  const c = normalizeBarcode(code);
  if (!c) return [];
  const out = new Set([c, c.toUpperCase()]);
  if (/^\d{12}$/.test(c)) out.add('0' + c);
  if (/^0\d{12}$/.test(c)) out.add(c.slice(1));
  return Array.from(out);
}

/** GS1 check digit for EAN-8 / UPC-A / EAN-13 / GTIN-14 (used only to warn about likely typos when typing). */
export function gtinCheckOk(code: string) {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return true; // not a GTIN shape: nothing to check
  const d = code.split('').map(Number);
  const check = d.pop();
  const sum = d.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export const productKeyOf = (p: any, kind: ProductKind) => String(kind === 'b2c' ? (p?._uuid || p?.id) : (p?._uuid ?? p?.id ?? ''));
export const isInactiveProduct = (p: any) => ['inactive', 'discontinued'].includes(String(p?.status || '').toLowerCase());

// ─── Extra barcodes (pack sizes), cached per workspace + kind ─────────────────────────────────────────────────────
const _cache: Record<string, { at: number; rows: any[] }> = {};
const TTL = 60_000;
const cacheKey = (kind: ProductKind) => `${(typeof window !== 'undefined' && (window as any).__bp_tenant?.id) || 'none'}:${kind}`;

export function invalidateBarcodeCache() {
  Object.keys(_cache).forEach(k => delete _cache[k]);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('product-barcodes-changed'));
}

export async function fetchExtraBarcodes(supabase: any, kind: ProductKind, force = false) {
  const k = cacheKey(kind);
  if (!force && _cache[k] && Date.now() - _cache[k].at < TTL) return _cache[k].rows;
  if (!supabase) return [];
  const { data, error } = await tenantScope(supabase.from('product_barcodes').select('id,product_id,barcode,pack_qty,label')).eq('product_type', kind);
  if (error) { console.warn('[barcode] extra barcodes unavailable (run sql/57?)', error.message); return _cache[k]?.rows || []; }
  _cache[k] = { at: Date.now(), rows: data || [] };
  return _cache[k].rows;
}

export async function fetchProductBarcodes(supabase: any, kind: ProductKind, productId: string) {
  if (!supabase || !productId) return [];
  const { data } = await tenantScope(supabase.from('product_barcodes').select('*')).eq('product_type', kind).eq('product_id', String(productId)).order('created_at');
  return data || [];
}

/**
 * Who else already uses this code in the workspace (main or extra barcode, either product kind's table is checked
 * only for its own kind). Returns null when free, otherwise { productName, where }.
 */
export async function findBarcodeOwner(supabase: any, kind: ProductKind, code: string, exceptProductId?: string) {
  const v = barcodeVariants(code);
  if (!v.length || !supabase) return null;
  const t = productTable(kind);
  const { data: main } = await tenantScope(supabase.from(t).select('id,name,barcode')).in('barcode', v).limit(5);
  const hitMain = (main || []).find(r => String(r.id) !== String(exceptProductId ?? ''));
  if (hitMain) return { productName: hitMain.name, productId: String(hitMain.id), where: 'main' };
  const { data: extra } = await tenantScope(supabase.from('product_barcodes').select('product_id,barcode,pack_qty')).eq('product_type', kind).in('barcode', v).limit(5);
  const hitExtra = (extra || []).find(r => String(r.product_id) !== String(exceptProductId ?? ''));
  if (hitExtra) {
    const { data: p } = await supabase.from(t).select('name').eq('id', hitExtra.product_id).maybeSingle();
    return { productName: p?.name || 'another product', productId: String(hitExtra.product_id), where: `pack of ${hitExtra.pack_qty}` };
  }
  return null;
}

/**
 * Resolve a scanned code to a product and the quantity one scan adds.
 * Returns { product, packQty, matchedBy } | { error: 'not_found' | 'inactive', product? }.
 */
export async function resolveBarcode(supabase: any, kind: ProductKind, code: string, products: any[] = []) {
  const variants = barcodeVariants(code);
  if (!variants.length) return { error: 'not_found' };
  const vset = new Set(variants);
  const vlower = new Set(variants.map(x => x.toLowerCase()));
  const byKey = (id: string) => (products || []).find(p => productKeyOf(p, kind) === String(id) || String(p.id) === String(id) || String(p._uuid) === String(id));
  const finish = (product: any, packQty: number, matchedBy: string) =>
    isInactiveProduct(product) ? { error: 'inactive', product } : { product, packQty: Number(packQty) > 0 ? Number(packQty) : 1, matchedBy };

  // 1. main barcode, in the list already on screen
  let p = (products || []).find(x => x.barcode && vset.has(String(x.barcode).trim()));
  if (p) return finish(p, 1, 'barcode');

  // 2. extra barcodes (pack sizes)
  const extras = await fetchExtraBarcodes(supabase, kind);
  const ex = extras.find(r => vset.has(String(r.barcode).trim()));
  if (ex) {
    p = byKey(ex.product_id);
    if (!p && supabase) { const { data } = await supabase.from(productTable(kind)).select('*').eq('id', ex.product_id).maybeSingle(); p = data ? dbRowToProduct(data, kind) : null; }
    if (p) return finish(p, ex.pack_qty, 'pack');
  }

  // 3. SKU printed as the barcode
  p = (products || []).find(x => x.sku && vlower.has(String(x.sku).trim().toLowerCase()));
  if (p) return finish(p, 1, 'sku');

  // 4. database fallback (product not in the list loaded on this page)
  if (supabase) {
    const t = productTable(kind);
    const { data } = await tenantScope(supabase.from(t).select('*')).in('barcode', variants).limit(1);
    let row = data?.[0];
    if (!row) { const r2 = await tenantScope(supabase.from(t).select('*')).in('sku', variants).limit(1); row = r2.data?.[0]; }
    if (row) return finish(byKey(row.id) || dbRowToProduct(row, kind), 1, row.barcode && vset.has(row.barcode) ? 'barcode' : 'sku');
  }
  return { error: 'not_found' };
}

/** A raw products/retail_products row shaped like the client lists (name/price/sku/_uuid...). */
function dbRowToProduct(r: any, kind: ProductKind) {
  return kind === 'b2c'
    ? { ...r, _uuid: r.id, id: r.product_number || r.id }
    : { ...r, _uuid: r.id, id: r.product_number || r.id, productFamily: r.product_family, taxRate: r.tax_rate };
}

/**
 * Add a scanned product to a line-item grid.
 *   - Same product already on a line (and not individually configured) -> quantity += pack quantity.
 *   - Otherwise the first empty line is filled, or a new line is added.
 * The grid supplies how a blank line looks, how a product is applied to a line, and how totals are recomputed,
 * so every grid keeps its own pricing / tax / copy-map rules.
 */
export function scanIntoItems({ setItems, product, qty, makeBlank, applyProduct, recompute, qtyKey = 'quantity', nameKey = 'product_name', onResult }: any) {
  setItems(prev => {
    const p = prev || [];
    const pid = String(product._uuid ?? product.id ?? '');
    const same = (r) => {
      if (r?.configuration && Object.keys(r.configuration || {}).length) return false; // configured lines stay separate
      if (r?.product_id && pid && String(r.product_id) === pid) return true;
      return !!r?.[nameKey] && r[nameKey] === product.name;
    };
    const i = p.findIndex(same);
    if (i >= 0) {
      const newQty = Number(p[i][qtyKey] || 0) + qty;
      onResult?.({ action: 'increment', quantity: newQty, index: i });
      return p.map((r, k) => (k === i ? recompute({ ...r, [qtyKey]: newQty }, qtyKey) : r));
    }
    const blankIdx = p.findIndex(r => !r?.[nameKey] && !r?.product_id);
    const base = blankIdx >= 0 ? p[blankIdx] : makeBlank();
    const row = recompute(applyProduct({ ...base, [qtyKey]: qty }, product), nameKey);
    onResult?.({ action: 'add', quantity: qty, index: blankIdx >= 0 ? blankIdx : p.length });
    return blankIdx >= 0 ? p.map((r, k) => (k === blankIdx ? row : r)) : [...p, row];
  });
}

// ─── Feedback: beep + vibration (no audio files, works offline) ───────────────────────────────────────────────────
let _ctx: any = null;
export function scanFeedback(ok: boolean) {
  try {
    if (typeof window === 'undefined') return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AC) {
      _ctx = _ctx || new AC();
      if (_ctx.state === 'suspended') _ctx.resume();
      const o = _ctx.createOscillator(); const g = _ctx.createGain();
      o.type = 'square'; o.frequency.value = ok ? 1760 : 220;
      g.gain.setValueAtTime(0.0001, _ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, _ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, _ctx.currentTime + (ok ? 0.09 : 0.35));
      o.connect(g); g.connect(_ctx.destination); o.start(); o.stop(_ctx.currentTime + (ok ? 0.1 : 0.36));
    }
    navigator.vibrate?.(ok ? 40 : [80, 60, 80]);
  } catch {}
}

// ─── Handheld (USB / Bluetooth "keyboard wedge") scanner detection ────────────────────────────────────────────────
// A scanner "types" the code far faster than a person (a few ms per character) and ends with Enter. We watch key
// timing globally; a fast burst of 4+ characters ending in Enter is a scan. If the burst landed in a text box, the
// typed characters are taken back out of it. Only the most recently opened grid receives scans (a stack), so a scan
// never lands in a grid hidden behind a modal.
type WedgeHandler = (code: string) => void;
const _stack: { id: number; fn: WedgeHandler }[] = [];
let _seq = 0, _installed = false;
let _buf = '', _times: number[] = [], _target: any = null, _targetStart = '';
const MAX_GAP = 45;       // ms between scanner keystrokes (people type at ~100ms+)
const MIN_LEN = 4;

function setNativeValue(el: any, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter ? setter.call(el, value) : (el.value = value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function onKey(e: KeyboardEvent) {
  if (!_stack.length) return;
  const el: any = e.target;
  if (el?.closest?.('[data-barcode-input]')) return; // a barcode field handles its own input
  const now = performance.now();
  const last = _times[_times.length - 1] ?? 0;
  if (e.key === 'Enter') {
    const fast = _buf.length >= MIN_LEN && _times.length >= MIN_LEN && (_times[_times.length - 1] - _times[0]) / (_times.length - 1) < MAX_GAP && now - last < 120;
    if (fast) {
      e.preventDefault(); e.stopPropagation();
      const code = _buf;
      if (_target && (_target.tagName === 'INPUT' || _target.tagName === 'TEXTAREA') && typeof _target.value === 'string' && _target.value.endsWith(code)) {
        setNativeValue(_target, _targetStart);
      }
      _buf = ''; _times = []; _target = null;
      _stack[_stack.length - 1]?.fn(code);
      return;
    }
    _buf = ''; _times = []; _target = null;
    return;
  }
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
  if (now - last > MAX_GAP * 2) { // a new burst starts
    _buf = ''; _times = [];
    _target = el; _targetStart = (el && typeof el.value === 'string') ? el.value : '';
  }
  _buf += e.key; _times.push(now);
}

/** Register a grid as the receiver of handheld-scanner scans while it is mounted. Returns an unregister function. */
export function registerScannerTarget(fn: WedgeHandler) {
  if (typeof window === 'undefined') return () => {};
  if (!_installed) { window.addEventListener('keydown', onKey, true); _installed = true; }
  const id = ++_seq;
  _stack.push({ id, fn });
  return () => { const i = _stack.findIndex(s => s.id === id); if (i >= 0) _stack.splice(i, 1); };
}
