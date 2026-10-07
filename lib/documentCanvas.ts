// @ts-nocheck
/**
 * Document Canvas engine — ONE renderer + registry shared by every document
 * designer (Retail Invoice, Booking Receipt, Quotation, B2B Invoice).
 *
 * A template is a free-form canvas: every block has its own absolute
 * x / y / w / h / z (px) plus `props`. The designer's live preview, the print
 * window, the PDF download and the WhatsApp/e-mail attachment all call
 * buildDocumentHTML(), so printed output == designed output.
 *
 * Template row (table `document_templates`, or `booking_receipt_templates`
 * for the booking receipt):
 *   { id, tenant_id, doc_type, name, is_default, paper_size, page_width,
 *     page_height, background_color, canvas: { blocks: Block[], meta: {...} } }
 *
 * Block: { id, type, x, y, w, h, z, props }
 *   type: text | field | fieldgroup | image | lineitems | totals |
 *         taxsummary | qr | divider | rect | signature
 *   props (any block): bg, borderColor, borderWidth, borderRadius, padding,
 *         opacity, rotate, visibleWhen {key, op, value}
 *
 * Field keys:
 *   plain key      -> header record column (snake or camelCase both resolve)
 *   custom:<api>   -> record.custom_data[api]
 *   li:<key>       -> same lookup on the FIRST line item
 *   computed keys  -> display_number, company_*, subtotal, total_tax, cgst,
 *                     sgst, grand_total, balance_due, amount_in_words, ...
 * Multi-tenancy: this file is pure (no DB). Tenant scoping happens where
 * templates are loaded/saved (designer + useDocumentTemplates).
 */

// ─── Document type registry ──────────────────────────────────────────────────
export const DOC_TYPES: Record<string, any> = {
  retail_invoice: {
    key: 'retail_invoice', label: 'Retail Invoice', icon: '🧾',
    headerObject: 'retailInvoices', lineObject: 'retailInvoiceLineItems',
    prefix: 'RINV', title: 'TAX INVOICE', numberLabel: 'Invoice #',
    table: 'document_templates', legacyTable: 'retail_invoice_templates',
    customerKeys: ['customer', 'customer_phone', 'customer_gstin', 'place_of_supply'],
    retail: true,
  },
  booking_receipt: {
    key: 'booking_receipt', label: 'Booking Receipt', icon: '🎫',
    headerObject: 'retailOrders', lineObject: 'retailOrderLineItems',
    prefix: 'RORD', title: 'BOOKING RECEIPT', numberLabel: 'Booking #',
    table: 'booking_receipt_templates', legacyTable: null,
    customerKeys: ['customer', 'customer_phone', 'delivery_address'],
    retail: true,
  },
  quotation: {
    key: 'quotation', label: 'Quotation', icon: '📝',
    headerObject: 'quotations', lineObject: 'quotationLineItems',
    prefix: 'QUO', title: 'QUOTATION', numberLabel: 'Quote #',
    table: 'document_templates', legacyTable: 'quote_templates',
    customerKeys: ['customer', 'contact', 'billing_address', 'shipping_address'],
  },
  b2b_invoice: {
    key: 'b2b_invoice', label: 'B2B Invoice', icon: '🏢',
    headerObject: 'invoices', lineObject: 'invoiceLineItems',
    prefix: 'INV', title: 'TAX INVOICE', numberLabel: 'Invoice #',
    table: 'document_templates', legacyTable: 'invoice_templates',
    customerKeys: ['customer', 'contact', 'billing_address', 'shipping_address', 'customer_gstin'],
  },
};

export const PAGE_PRESETS = [
  { v: 'A4',         l: 'A4 (Portrait)',  w: 794,  h: 1123, css: 'A4' },
  { v: 'A4_L',       l: 'A4 (Landscape)', w: 1123, h: 794,  css: 'A4 landscape' },
  { v: 'A5',         l: 'A5',             w: 559,  h: 794,  css: 'A5' },
  { v: 'Letter',     l: 'US Letter',      w: 816,  h: 1056, css: 'Letter' },
  { v: 'thermal_80', l: 'Thermal 80mm',   w: 302,  h: 1000, css: '80mm auto', thermal: true },
  { v: 'thermal_58', l: 'Thermal 58mm',   w: 219,  h: 1000, css: '58mm auto', thermal: true },
  { v: 'thermal_57', l: 'Thermal 57mm',   w: 215,  h: 1000, css: '57mm auto', thermal: true },
  { v: 'custom',     l: 'Custom size',    w: 794,  h: 1123, css: '' },
];
export const isThermal = (paper: string) => String(paper || '').startsWith('thermal');

// ─── Small helpers ───────────────────────────────────────────────────────────
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escKeepBreaks = (s: any) => esc(s).replace(/\n/g, '<br/>');
const camel = (s: string) => s.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
const snake = (s: string) => s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const blank = (v: any) => v === undefined || v === null || v === '';

function getRaw(rec: any, key: string) {
  if (!rec || !key) return undefined;
  let v = rec[key];
  if (!blank(v)) return v;
  const c = rec[camel(key)]; if (!blank(c)) return c;
  const s = rec[snake(key)]; if (!blank(s)) return s;
  return v;
}

const _w = () => (typeof window !== 'undefined' ? (window as any) : {});
const prefs = () => _w().__bp_prefs || {};
const appear = () => _w().__bp_appearance || {};

const SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', GBP: '£', EUR: '€', JPY: '¥', AED: 'AED ', SGD: 'S$', AUD: 'A$', CAD: 'C$' };
export function currencySymbol(code?: string) {
  const c = code || prefs().default_currency || 'INR';
  return SYMBOLS[c] ?? (c + ' ');
}
export function fmtMoney(n: any, code?: string) {
  const c = code || prefs().default_currency || 'INR';
  return currencySymbol(c) + num(n).toLocaleString(c === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
export function fmtDate(v: any) {
  if (blank(v)) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// General "amount in words" (thousand / million grouping; Indian lakh/crore
// grouping when the currency is INR).
export function amountInWords(n: any, code?: string) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x: number) => x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
  const three = (x: number) => (x >= 100 ? ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  const total = Math.abs(num(n));
  let whole = Math.floor(total);
  const paise = Math.round((total - whole) * 100);
  const inr = (code || prefs().default_currency || 'INR') === 'INR';
  const parts: string[] = [];
  if (whole === 0) parts.push('Zero');
  else if (inr) {
    const crore = Math.floor(whole / 10000000); whole %= 10000000;
    const lakh = Math.floor(whole / 100000); whole %= 100000;
    const thou = Math.floor(whole / 1000); whole %= 1000;
    if (crore) parts.push(three(crore) + ' Crore');
    if (lakh) parts.push(two(lakh) + ' Lakh');
    if (thou) parts.push(two(thou) + ' Thousand');
    if (whole) parts.push(three(whole));
  } else {
    const scales = ['', ' Thousand', ' Million', ' Billion'];
    let i = 0; const g: string[] = [];
    while (whole > 0) { const p = whole % 1000; if (p) g.unshift(three(p) + scales[i]); whole = Math.floor(whole / 1000); i++; }
    parts.push(g.join(' '));
  }
  const cur = inr ? 'Rupees' : (code || prefs().default_currency || '');
  return `${cur} ${parts.join(' ')}${paise ? ' and ' + two(paise) + (inr ? ' Paise' : ' Cents') : ''} Only`.trim();
}

// ─── Totals / line maths ─────────────────────────────────────────────────────
export function lineCalc(item: any) {
  const qty = num(item?.quantity ?? item?.qty ?? 1);
  const price = num(item?.unit_price ?? item?.price ?? 0);
  const discPct = num(item?.discount_pct ?? item?.discount ?? 0);
  const taxPct = num(item?.tax_pct ?? item?.gst_rate ?? item?.sales_tax_rate ?? item?.vat_rate ?? 0);
  const gross = qty * price;
  const discAmt = gross * discPct / 100;
  const net = gross - discAmt;
  const taxAmt = net * taxPct / 100;
  const total = item?.extended_price !== undefined && item?.extended_price !== null && item?.extended_price !== ''
    ? num(item.extended_price) : net + taxAmt;
  return { qty, price, discPct, taxPct, gross, discAmt, net, taxAmt, total };
}

export function computeTotals(rec: any, items: any[]) {
  const lines = (items || []).map(lineCalc);
  const cSub = lines.reduce((s, l) => s + l.gross, 0);
  const cDisc = lines.reduce((s, l) => s + l.discAmt, 0);
  const cTax = lines.reduce((s, l) => s + l.taxAmt, 0);
  const pick = (k: string, fallback: number) => { const v = getRaw(rec, k); return blank(v) ? fallback : num(v); };
  const subtotal = pick('subtotal', cSub);
  const totalDiscount = pick('total_discount', cDisc);
  const totalTax = pick('total_tax', cTax);
  const shipping = pick('shipping_cost', 0);
  const overallPct = num(getRaw(rec, 'overall_discount') ?? getRaw(rec, 'header_discount_pct'));
  const overallAmt = blank(getRaw(rec, 'header_discount_amount')) ? (subtotal - totalDiscount) * overallPct / 100 : num(getRaw(rec, 'header_discount_amount'));
  const computedGrand = subtotal - totalDiscount - (blank(getRaw(rec, 'header_discount_amount')) ? overallAmt : 0) + totalTax + shipping;
  const grand = !blank(getRaw(rec, 'amount')) ? num(getRaw(rec, 'amount'))
    : !blank(getRaw(rec, 'grand_total')) ? num(getRaw(rec, 'grand_total')) : computedGrand;
  const paid = blank(getRaw(rec, 'amount_paid')) ? 0 : num(getRaw(rec, 'amount_paid'));
  return {
    subtotal, total_discount: totalDiscount, total_tax: totalTax, cgst: totalTax / 2, sgst: totalTax / 2,
    igst: num(getRaw(rec, 'igst')) || 0, shipping_cost: shipping, overall_discount_amount: overallAmt,
    overall_discount_pct: overallPct, grand_total: grand, round_off: Math.round(grand) - grand,
    amount_paid: paid, balance_due: Math.max(0, grand - paid),
    item_count: (items || []).length, total_qty: lines.reduce((s, l) => s + l.qty, 0),
    taxable_value: lines.reduce((s, l) => s + l.net, 0),
  };
}

const MONEY_KEYS = new Set(['subtotal', 'total_discount', 'total_tax', 'cgst', 'sgst', 'igst', 'shipping_cost',
  'overall_discount_amount', 'round_off', 'grand_total', 'amount_paid', 'balance_due', 'taxable_value',
  'amount', 'header_discount_amount', 'unit_price', 'price', 'net_amount', 'extended_price', 'line_total',
  'tax_amount', 'cgst_amount', 'sgst_amount', 'discount_amount', 'rent_per_day', 'total_amount', 'paid_amount']);
const MONEY_RE = /(_amount|_price|_total|_cost)$/;
const isMoneyKey = (k: string) => MONEY_KEYS.has(k) || MONEY_RE.test(k);

// ─── Document context (company info, numbers, products) ─────────────────────
function displayNumber(rec: any, docType: string) {
  const dt = DOC_TYPES[docType] || DOC_TYPES.retail_invoice;
  const dn = rec?.displayNumber ?? rec?.display_number;
  if (dn) return `${dt.prefix}-${String(dn).padStart(5, '0')}`;
  return rec?.invoice_number || rec?.quote_number || rec?.order_number || rec?.name || (typeof rec?.id === 'string' && rec.id.length < 24 ? rec.id : '') || '';
}

function companyValue(key: string) {
  const p = prefs(), a = appear();
  switch (key) {
    case 'company_name':       return a.company_name || p.company_legal_name || '';
    case 'company_legal_name': return p.company_legal_name || a.company_name || '';
    case 'company_logo_url':   return a.company_logo_url || '';
    case 'company_address':    return p.company_address || '';
    case 'company_city':       return p.company_city || '';
    case 'company_pincode':    return p.company_pincode || '';
    case 'company_gstin':      return p.company_gstin || '';
    case 'company_state_code': return p.company_state_code || '';
    case 'company_phone':      return p.company_phone || '';
    case 'company_email':      return p.company_email || '';
    default: return '';
  }
}

export function makeResolver(rec: any, items: any[], ctx: any = {}) {
  const docType = ctx.docType || 'retail_invoice';
  const totals = computeTotals(rec, items);
  const cur = getRaw(rec, 'currency') || prefs().default_currency || 'INR';
  const resolve = (key: string): any => {
    if (!key) return '';
    if (key.startsWith('li:')) return resolveLine((items || [])[0] || {}, key.slice(3), 0, ctx);
    if (key.startsWith('custom:')) return rec?.custom_data ? rec.custom_data[key.slice(7)] : '';
    if (key === 'display_number') return displayNumber(rec, docType);
    if (key.startsWith('company_')) return companyValue(key);
    if (key === 'today') return new Date().toISOString();
    if (key === 'owner_name') return rec?.owner_name || rec?.owner_display || rec?.ownerName || rec?.owner || '';
    if (key === 'amount_in_words') return amountInWords(totals.grand_total, cur);
    if (key === 'balance_due' || key === 'amount_paid') {
      if (key === 'amount_paid' && blank(getRaw(rec, 'amount_paid'))) return '';
      return (totals as any)[key];
    }
    if (key in totals && !['amount'].includes(key)) {
      const direct = getRaw(rec, key);
      // header-stored values win for the keys the record really carries
      if (['subtotal', 'total_discount', 'total_tax', 'shipping_cost'].includes(key) && !blank(direct)) return direct;
      return (totals as any)[key];
    }
    return getRaw(rec, key);
  };
  return { resolve, totals, currency: cur };
}

export function resolveLine(item: any, key: string, idx = 0, ctx: any = {}) {
  if (!key || !item) return '';
  if (key.startsWith('custom:')) return item.custom_data ? item.custom_data[key.slice(7)] : '';
  const c = lineCalc(item);
  switch (key) {
    case 'sno': return idx + 1;
    case 'quantity': return c.qty;
    case 'unit_price': return c.price;
    case 'discount_pct': return c.discPct;
    case 'tax_pct': return c.taxPct;
    case 'net_amount': return c.net;
    case 'tax_amount': return c.taxAmt;
    case 'cgst_amount': case 'sgst_amount': return c.taxAmt / 2;
    case 'discount_amount': return c.discAmt;
    case 'extended_price': case 'line_total': return c.total;
    case 'sku': return item.product_code || item.sku || '';
    case 'hsn_code': return item.hsn_code || item.hsn || '';
    case 'image': return productImage(item, ctx.products);
    case 'description': return item.description || '';
    default: { const v = getRaw(item, key); return v; }
  }
}

function productImage(item: any, products: any[]) {
  if (item?.image_url) return item.image_url;
  if (!products || !products.length) return '';
  const code = item.product_code || item.sku;
  const p = products.find(x => code && (x.product_code === code || x.sku === code)) || products.find(x => x.name && x.name === item.product_name);
  return p?.image_url || '';
}

// ─── Value formatting ────────────────────────────────────────────────────────
export function formatValue(key: string, value: any, format: string, cur: string) {
  if (blank(value)) return '';
  const fmt = format || 'auto';
  const k = key.startsWith('li:') ? key.slice(3) : key;
  if (fmt === 'text') return String(value);
  if (fmt === 'currency') return fmtMoney(value, cur);
  if (fmt === 'number') return num(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  if (fmt === 'percent') return `${num(value)}%`;
  if (fmt === 'date') return fmtDate(value);
  if (fmt === 'boolean') return value === true || value === 'true' || value === 'Yes' ? 'Yes' : 'No';
  // auto
  if (typeof value === 'string' && ISO_DATE.test(value)) return fmtDate(value);
  if (!k.startsWith('custom:') && isMoneyKey(k) && value !== '' && !isNaN(Number(value))) return fmtMoney(value, cur);
  if (/_(pct|rate)$/.test(k) && !isNaN(Number(value))) return `${num(value)}%`;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function interpolate(text: string, resolve: (k: string) => any, cur: string, raw = false) {
  return String(text || '').replace(/\{\{\s*([\w:.]+)\s*\}\}/g, (_m, key) => {
    const v = resolve(key);
    if (raw) return blank(v) ? '' : String(v);
    return esc(formatValue(key, v, 'auto', cur));
  });
}

function passes(cond: any, resolve: (k: string) => any) {
  if (!cond || !cond.key) return true;
  const v = resolve(cond.key);
  const s = blank(v) ? '' : String(v);
  const target = String(cond.value ?? '');
  switch (cond.op) {
    case 'notempty': return s !== '';
    case 'empty': return s === '';
    case 'eq': return s.toLowerCase() === target.toLowerCase();
    case 'neq': return s.toLowerCase() !== target.toLowerCase();
    case 'gt': return num(v) > num(target);
    case 'lt': return num(v) < num(target);
    default: return true;
  }
}

// ─── Sample data (designer preview) ──────────────────────────────────────────
const SAMPLE_ITEMS = [
  { product_name: 'DSLR Camera Kit', description: 'Body + 18-55mm lens', product_code: 'CAM-001', hsn_code: '8525', unit: 'Pc', quantity: 1, unit_price: 1500, price: 1500, discount_pct: 0, tax_pct: 18, rental_start_date: '2026-09-20', rental_end_date: '2026-09-23', custom_data: {} },
  { product_name: 'Tripod Stand', description: 'Carbon fibre', product_code: 'TRI-014', hsn_code: '9618', unit: 'Pc', quantity: 2, unit_price: 250, price: 250, discount_pct: 10, tax_pct: 18, rental_start_date: '2026-09-20', rental_end_date: '2026-09-23', custom_data: {} },
  { product_name: 'Studio Lighting Set', description: '3-light kit', product_code: 'LGT-203', hsn_code: '9405', unit: 'Set', quantity: 1, unit_price: 4500, price: 4500, discount_pct: 0, tax_pct: 12, rental_start_date: '', rental_end_date: '', custom_data: {} },
];
const SAMPLE_BASE = {
  displayNumber: 108, customer: 'Aarav Mehta', customer_phone: '+91 98765 43210', contact: 'Aarav Mehta',
  customer_gstin: '27AABCR1234M1ZA', place_of_supply: 'Maharashtra',
  billing_address: '221B Linking Road, Bandra West, Mumbai 400050', shipping_address: 'Warehouse 4, MIDC Andheri East, Mumbai 400093',
  delivery_address: '221B Linking Road, Mumbai 400050', order_date: '2026-09-18', invoice_date: '2026-09-18',
  due_date: '2026-10-02', delivery_date: '2026-09-25', validity_date: '2026-10-18', payment_method: 'UPI', payment_status: 'Paid',
  payment_terms: 'Net 15', po_number: 'PO-7781', status: 'Confirmed', owner_name: 'Priya Sharma',
  notes: 'Handle with care — fragile equipment.', currency: 'INR', created_at: '2026-09-18T10:30:00Z', custom_data: {},
};
export function sampleFor(docType: string) {
  const rec: any = { ...SAMPLE_BASE };
  if (docType === 'quotation') rec.quote_number = 'QUO-00108';
  if (docType === 'b2b_invoice' || docType === 'retail_invoice') rec.invoice_number = DOC_TYPES[docType].prefix + '-00108';
  if (docType === 'booking_receipt') rec.order_number = 'RORD-00108';
  const items = SAMPLE_ITEMS.map(i => ({ ...i }));
  const t = computeTotals(rec, items);
  rec.subtotal = t.subtotal; rec.total_discount = t.total_discount; rec.total_tax = t.total_tax;
  rec.amount = t.grand_total; rec.amount_paid = docType === 'retail_invoice' || docType === 'booking_receipt' ? t.grand_total : 0;
  return { record: rec, items };
}
// Back-compat exports used by older imports
export const SAMPLE_ORDER = sampleFor('booking_receipt').record;
export const SAMPLE_LINE_ITEMS = sampleFor('booking_receipt').items;

// ─── Block rendering ─────────────────────────────────────────────────────────
export function shellExtras(p: any) {
  let s = '';
  if (p.bg || p.fill) s += `background:${p.bg || p.fill};`;
  if (p.borderWidth) s += `border:${p.borderWidth}px solid ${p.borderColor || '#D1D5DB'};`;
  if (p.borderRadius) s += `border-radius:${p.borderRadius}px;`;
  if (p.padding) s += `padding:${p.padding}px;`;
  if (p.opacity !== undefined && p.opacity !== null && p.opacity !== '' && Number(p.opacity) < 1) s += `opacity:${p.opacity};`;
  return s;
}
function shell(b: any, inner: string, opts: { grow?: boolean; shiftY?: number } = {}) {
  const p = b.props || {};
  const rot = p.rotate ? `transform:rotate(${p.rotate}deg);` : '';
  const top = b.y + (opts.shiftY || 0);
  const size = opts.grow ? `width:${b.w}px;min-height:${b.h}px;` : `width:${b.w}px;height:${b.h}px;overflow:hidden;`;
  return `<div data-bid="${esc(b.id)}" style="position:absolute;left:${b.x}px;top:${top}px;${size}${rot}box-sizing:border-box;${shellExtras(p)}">${inner}</div>`;
}

function fontStyle(p: any, defWeight = 400, defSize = 13) {
  return `font-size:${p.fontSize || defSize}px;font-weight:${p.fontWeight || defWeight};color:${p.color || '#111827'};` +
    `text-align:${p.align || 'left'};line-height:${p.lineHeight || 1.35};font-family:${p.fontFamily || 'inherit'};` +
    (p.italic ? 'font-style:italic;' : '') + (p.uppercase ? 'text-transform:uppercase;' : '') + (p.letterSpacing ? `letter-spacing:${p.letterSpacing}px;` : '');
}

function fieldDisplay(p: any, key: string, resolve: any, cur: string, ctx: any) {
  const raw = resolve(key);
  const fk = key.startsWith('li:') ? key.slice(3) : key;
  const val = formatValue(fk, raw, p.format || 'auto', cur);
  if (val) return { text: esc(val), empty: false };
  if (ctx.designMode) return { text: `<span style="color:#A78BFA;opacity:.85">‹${esc(p.label || key)}›</span>`, empty: true };
  return { text: esc(p.placeholder || ''), empty: true };
}

function renderText(b: any, resolve: any, cur: string, ctx: any) {
  const p = b.props || {};
  const html = interpolate(p.content || '', resolve, cur).replace(/\n/g, '<br/>');
  return `<div style="${fontStyle(p, 400, 13)}word-break:break-word;">${html}</div>`;
}

function renderField(b: any, resolve: any, cur: string, ctx: any) {
  const p = b.props || {};
  const d = fieldDisplay(p, p.fieldKey || '', resolve, cur, ctx);
  const label = p.showLabel !== false && p.label
    ? `<span style="font-size:${Math.max(6, (p.fontSize || 13) - 2)}px;font-weight:400;color:${p.labelColor || '#6B7280'};margin-right:6px;">${esc(p.label)}${p.labelColon === false ? '' : ':'}</span>` : '';
  if (ctx.hideEmptyFields && d.empty && !ctx.designMode) return '';
  return `<div style="${fontStyle(p, 500, 13)}word-break:break-word;">${label}<span>${d.text}</span></div>`;
}

function renderFieldGroup(b: any, resolve: any, cur: string, ctx: any) {
  const p = b.props || {};
  const rows = (p.fields || []).map((f: any) => {
    const d = fieldDisplay({ ...f, format: f.format }, f.key, resolve, cur, ctx);
    if (d.empty && p.hideEmpty !== false && !ctx.designMode) return '';
    const lab = p.showLabels !== false && f.label
      ? `<span style="color:${p.labelColor || '#6B7280'};font-size:${Math.max(6, (p.fontSize || 12) - 2)}px;${p.labelWidth ? `display:inline-block;width:${p.labelWidth}px;` : 'margin-right:6px;'}">${esc(f.label)}${p.labelColon === false ? '' : ':'}</span>` : '';
    return `<div style="margin-bottom:${p.gap ?? 3}px;${f.bold ? 'font-weight:700;' : ''}">${lab}<span>${d.text}</span></div>`;
  }).join('');
  const title = p.title ? `<div style="font-size:${Math.max(6, (p.fontSize || 12) - 3)}px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${p.titleColor || '#64748B'};margin-bottom:5px;">${esc(p.title)}</div>` : '';
  return `<div style="${fontStyle(p, 400, 12)}word-break:break-word;">${title}${rows}</div>`;
}

function renderImage(b: any, resolve: any, ctx: any) {
  const p = b.props || {};
  let src = p.src || '';
  if (p.source === 'company_logo') src = companyValue('company_logo_url');
  else if (p.source === 'field' && p.fieldKey) src = resolve(p.fieldKey) || '';
  if (!src) {
    if (ctx.designMode || ctx.showImagePlaceholder) return `<div style="width:100%;height:100%;background:#F3F4F6;border:1px dashed #D1D5DB;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:11px;">${p.source === 'company_logo' ? 'Company Logo' : 'Image'}</div>`;
    return '';
  }
  return `<img src="${esc(src)}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:${p.fit || 'contain'};border-radius:${p.imgRadius || 0}px;display:block;"/>`;
}

function renderDivider(b: any) {
  const p = b.props || {};
  return `<div style="width:100%;border-top:${p.thickness || 1}px ${p.style || 'solid'} ${p.color || '#D1D5DB'};margin-top:${Math.max(0, (b.h || 1) / 2)}px;"></div>`;
}
function renderRect(b: any) { return `<div style="width:100%;height:100%;"></div>`; }
function renderSignature(b: any) {
  const p = b.props || {};
  return `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;">
    <div style="border-top:1px solid ${p.lineColor || '#111827'};margin-bottom:4px;"></div>
    <div style="font-size:${p.fontSize || 11}px;color:${p.color || '#6B7280'};text-align:${p.align || 'center'};">${esc(p.label || 'Authorised Signatory')}</div>
  </div>`;
}

function renderQr(b: any, resolve: any, cur: string, ctx: any) {
  const p = b.props || {};
  const data = interpolate(p.data || '{{display_number}}', resolve, cur, true);
  const size = Math.max(40, Math.min(b.w, b.h));
  if (!data) return '';
  return `<img src="https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&margin=0&data=${encodeURIComponent(data)}" crossorigin="anonymous" style="width:${size}px;height:${size}px;display:block;margin:0 auto;"/>${p.caption ? `<div style="text-align:center;font-size:${p.fontSize || 9}px;color:#6B7280;margin-top:2px;">${esc(interpolate(p.caption, resolve, cur))}</div>` : ''}`;
}

// ── line items table ─────────────────────────────────────────────────────────
const DEFAULT_COLS = [
  { key: 'sno', label: '#' }, { key: 'product_name', label: 'Item' }, { key: 'quantity', label: 'Qty' },
  { key: 'unit_price', label: 'Rate' }, { key: 'extended_price', label: 'Total' },
];
const LEFT_KEYS = new Set(['product_name', 'description', 'sku', 'hsn_code', 'unit', 'product_code', 'name']);

function liTable(b: any, items: any[], resolveRec: any, cur: string, ctx: any) {
  const p = b.props || {};
  const cols = (p.columns && p.columns.length ? p.columns : DEFAULT_COLS);
  const fs = p.fontSize || 12;
  const pad = p.cellPadding ?? 4;
  const lineH = fs * 1.35;
  const align = (c: any) => c.align || (LEFT_KEYS.has(c.key) || c.key.startsWith('custom:') && false ? 'left' : (c.key === 'sno' ? 'center' : 'right'));

  // column widths (%) — explicit width wins, name-like columns get double weight
  const weights = cols.map((c: any) => Number(c.width) > 0 ? Number(c.width) : (c.key === 'product_name' ? 34 : c.key === 'description' ? 24 : c.key === 'sno' ? 5 : c.key === 'image' ? 8 : 12));
  const wsum = weights.reduce((a: number, x: number) => a + x, 0) || 1;
  const pct = weights.map((w: number) => (w / wsum) * 100);
  const px = pct.map((x: number) => (x / 100) * b.w);

  const rowsData = (items || []).map((item, i) => {
    const calc = lineCalc(item);
    const cells = cols.map((c: any, ci: number) => {
      if (c.key === 'image') {
        const src = resolveLine(item, 'image', i, ctx);
        return { html: src ? `<img src="${esc(src)}" crossorigin="anonymous" style="width:${Math.min(36, px[ci] - 8)}px;height:${Math.min(36, px[ci] - 8)}px;object-fit:cover;border-radius:4px;"/>` : '', text: src ? 'IMG' : '', img: true };
      }
      const raw = resolveLine(item, c.key, i, ctx);
      const text = formatValue(c.key, raw, c.format || (c.key === 'sno' ? 'text' : 'auto'), cur);
      let extra = '';
      if (c.key === 'product_name') {
        if (p.showDescription && item.description) extra += `<div style="font-size:${fs - 2}px;color:#64748B;">${esc(item.description)}</div>`;
        if (p.showRentalDates !== false && item.rental_start_date && item.rental_end_date) extra += `<div style="font-size:${fs - 3}px;color:${p.accentColor || '#2563EB'};margin-top:1px;">📅 ${fmtDate(item.rental_start_date)} → ${fmtDate(item.rental_end_date)}</div>`;
      }
      return { html: esc(text) + extra, text: text + (extra ? 'x'.repeat(20) : ''), extra: !!extra };
    });
    return { cells };
  });

  // height estimate (drives the "push content below" flow)
  const estLines = (text: string, w: number) => Math.max(1, Math.ceil((String(text).length * fs * 0.5) / Math.max(10, w - pad * 2)));
  let est = 0;
  if (p.showHeader !== false) est += fs * 1.35 + pad * 2 + 2;
  rowsData.forEach((r: any) => {
    let h = lineH + pad * 2 + 1;
    r.cells.forEach((cell: any, ci: number) => {
      const l = cell.img ? 0 : estLines(cell.text, px[ci]);
      const ch = cell.img ? 40 + pad * 2 : l * lineH + pad * 2 + 1 + (cell.extra ? lineH * 0.9 : 0);
      if (ch > h) h = ch;
    });
    est += h;
  });

  const hb = p.headerBg || 'transparent';
  const hc = p.headerColor || '#6B7280';
  const bc = p.borderColor || '#E5E7EB';
  const grid = p.showGrid ? `border:1px solid ${bc};` : `border-bottom:1px solid ${bc};`;
  const head = p.showHeader !== false
    ? `<thead><tr>${cols.map((c: any, ci: number) => `<th style="width:${pct[ci]}%;text-align:${align(c)};font-size:${p.headerFontSize || fs - 2}px;font-weight:700;color:${hc};background:${hb};${p.headerUppercase === false ? '' : 'text-transform:uppercase;'}padding:${pad}px;${p.showGrid ? grid : `border-bottom:${p.headerBorder ?? 1}px solid ${p.headerBorderColor || bc};`}letter-spacing:.3px;">${esc(c.label)}</th>`).join('')}</tr></thead>`
    : `<colgroup>${pct.map((x: number) => `<col style="width:${x}%"/>`).join('')}</colgroup>`;
  const body = rowsData.map((r: any, i: number) => {
    const bg = p.rowAltShade && i % 2 === 1 ? (p.altRowColor || '#F9FAFB') : 'transparent';
    return `<tr style="background:${bg};">${r.cells.map((cell: any, ci: number) => `<td style="text-align:${align(cols[ci])};font-size:${fs}px;padding:${pad}px;color:${p.color || '#111827'};vertical-align:top;word-break:break-word;${grid}">${cell.html}</td>`).join('')}</tr>`;
  }).join('');
  const html = `<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-family:inherit;">${head}<tbody>${body}</tbody></table>`;
  return { html, est };
}

// ── totals block ─────────────────────────────────────────────────────────────
const DEFAULT_TOTAL_ROWS = [
  { key: 'subtotal', label: 'Subtotal' }, { key: 'total_discount', label: 'Discount', hideIfZero: true },
  { key: 'total_tax', label: 'Tax', hideIfZero: true }, { key: 'grand_total', label: 'Total', bold: true, accent: true },
];
function renderTotals(b: any, resolve: any, cur: string, ctx: any) {
  const p = b.props || {};
  const rows = p.rows && p.rows.length ? p.rows : DEFAULT_TOTAL_ROWS;
  const fs = p.fontSize || 12;
  return rows.map((r: any) => {
    const raw = resolve(r.key);
    const val = formatValue(r.key, raw, r.format || 'auto', cur);
    if (r.hideIfZero && !ctx.designMode && (!num(raw))) return '';
    if (blank(raw) && !ctx.designMode) return '';
    const accent = r.accent && (p.accentBg || '#0F172A');
    const st = accent ? `background:${p.accentBg || '#0F172A'};color:${p.accentColor || '#FFFFFF'};padding:5px 8px;border-radius:${p.accentRadius ?? 4}px;margin-top:3px;` : `padding:3px ${p.rowPadX ?? 0}px;${p.rowDivider ? `border-bottom:1px solid ${p.rowDividerColor || '#E5E7EB'};` : ''}`;
    return `<div style="display:flex;justify-content:space-between;gap:10px;font-size:${r.bold ? fs + 2 : fs}px;font-weight:${r.bold ? 700 : 400};color:${accent ? (p.accentColor || '#FFF') : (p.color || '#111827')};${st}"><span style="${accent ? '' : `color:${r.bold ? (p.color || '#111827') : (p.labelColor || '#6B7280')};`}">${esc(r.label)}</span><span>${val || (ctx.designMode ? '—' : '')}</span></div>`;
  }).join('');
}

// ── tax summary (GST) ────────────────────────────────────────────────────────
function taxSummary(b: any, items: any[], cur: string, ctx: any) {
  const p = b.props || {};
  const fs = p.fontSize || 10;
  const pad = p.cellPadding ?? 3;
  const lineH = fs * 1.35;
  const mode = p.mode === 'igst' ? 'igst' : 'cgst_sgst';
  const groupHsn = p.groupBy === 'hsn';
  const map = new Map<string, any>();
  (items || []).forEach(it => {
    const c = lineCalc(it);
    const hsn = groupHsn ? (it.hsn_code || it.hsn || '-') : '';
    const k = `${hsn}|${c.taxPct}`;
    const g = map.get(k) || { hsn, rate: c.taxPct, taxable: 0, tax: 0 };
    g.taxable += c.net; g.tax += c.taxAmt; map.set(k, g);
  });
  const groups = Array.from(map.values()).sort((a, b2) => a.rate - b2.rate);
  const heads = [groupHsn ? 'HSN/SAC' : 'Tax %', 'Taxable', ...(mode === 'igst' ? ['IGST'] : ['CGST', 'SGST']), 'Total Tax'];
  const hc = p.headerColor || '#6B7280', bc = p.borderColor || '#E5E7EB';
  const cell = (t: string, left = false, head = false) => `<${head ? 'th' : 'td'} style="text-align:${left ? 'left' : 'right'};font-size:${head ? fs - 1 : fs}px;padding:${pad}px;border-bottom:1px solid ${bc};${head ? `color:${hc};text-transform:uppercase;font-weight:700;background:${p.headerBg || 'transparent'};` : ''}">${t}</${head ? 'th' : 'td'}>`;
  const rows = groups.map(g => `<tr>${cell(groupHsn ? esc(g.hsn) + ` (${g.rate}%)` : `${g.rate}%`, true)}${cell(fmtMoney(g.taxable, cur))}${mode === 'igst' ? cell(fmtMoney(g.tax, cur)) : cell(fmtMoney(g.tax / 2, cur)) + cell(fmtMoney(g.tax / 2, cur))}${cell(fmtMoney(g.tax, cur))}</tr>`).join('');
  const html = `<table style="width:100%;border-collapse:collapse;table-layout:fixed;"><thead><tr>${heads.map((h, i) => cell(h, i === 0, true)).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
  const est = (fs * 1.35 + pad * 2 + 2) + groups.length * (lineH + pad * 2 + 1);
  return { html, est };
}

// ── single block → inner HTML (used by designer canvas) ─────────────────────
export function renderBlockInner(b: any, record: any, items: any[], ctx: any = {}) {
  const { resolve, currency } = makeResolver(record, items, ctx);
  switch (b.type) {
    case 'text':      return renderText(b, resolve, currency, ctx);
    case 'field':     return renderField(b, resolve, currency, ctx);
    case 'fieldgroup':return renderFieldGroup(b, resolve, currency, ctx);
    case 'image':     return renderImage(b, resolve, ctx);
    case 'divider':   return renderDivider(b);
    case 'rect':      return renderRect(b);
    case 'signature': return renderSignature(b);
    case 'qr':        return renderQr(b, resolve, currency, ctx);
    case 'totals':    return renderTotals(b, resolve, currency, ctx);
    case 'lineitems': return liTable(b, items, resolve, currency, ctx).html;
    case 'taxsummary':return taxSummary(b, items, currency, ctx).html;
    default: return '';
  }
}

// ─── Full document ───────────────────────────────────────────────────────────
export function buildDocumentHTML(template: any, record: any, items: any[] = [], ctx: any = {}): string {
  const t = template || {};
  const docType = ctx.docType || t.doc_type || 'retail_invoice';
  const c2 = { ...ctx, docType };
  const blocks: any[] = ((t.canvas && t.canvas.blocks) || []).filter((b: any) => b && b.type);
  const meta = (t.canvas && t.canvas.meta) || {};
  const paper = t.paper_size || 'A4';
  const preset = PAGE_PRESETS.find(p => p.v === paper);
  const pageW = Number(t.page_width) || preset?.w || 794;
  const pageH = Number(t.page_height) || preset?.h || 1123;
  const bg = t.background_color || '#FFFFFF';
  const font = meta.font_family || 'Arial, Helvetica, sans-serif';
  const { resolve, currency } = makeResolver(record, items, c2);

  // 1. work out how much each growable block (line items / tax summary) grew
  const grow: Record<string, number> = {};
  const rendered: Record<string, string> = {};
  const live = blocks.filter(b => passes(b.props?.visibleWhen, resolve));
  live.forEach(b => {
    if (b.type === 'lineitems' || b.type === 'taxsummary') {
      const r = b.type === 'lineitems' ? liTable(b, items, resolve, currency, c2) : taxSummary(b, items, currency, c2);
      rendered[b.id] = r.html;
      grow[b.id] = Math.max(0, Math.ceil(r.est) - b.h);
    }
  });
  const growers = live.filter(b => grow[b.id] > 0);
  const shiftOf = (b: any) => {
    let s = 0;
    growers.forEach(g => {
      if (g.id === b.id) return;
      const below = b.y >= g.y + g.h - 1;
      const overlapX = b.x < g.x + g.w && b.x + b.w > g.x;
      if (below && overlapX) s += grow[g.id];
    });
    return s;
  };

  let maxBottom = 0;
  const body = live.slice().sort((a, b2) => (a.z || 0) - (b2.z || 0)).map(b => {
    const shiftY = shiftOf(b);
    const own = grow[b.id] || 0;
    maxBottom = Math.max(maxBottom, b.y + shiftY + b.h + own);
    let inner = rendered[b.id];
    if (inner === undefined) inner = renderBlockInner(b, record, items, c2);
    if ((b.type === 'image' || b.type === 'qr' || b.type === 'field') && inner === '') return '';
    return shell(b, inner, { grow: b.type === 'lineitems' || b.type === 'taxsummary', shiftY });
  }).join('');

  const thermal = isThermal(paper);
  const pageHeight = thermal ? Math.max(120, maxBottom + 20) : Math.max(pageH, maxBottom + 24);
  const pageCss = preset?.css || `${pageW}px ${pageH}px`;
  const title = esc(`${DOC_TYPES[docType]?.label || 'Document'} ${displayNumber(record, docType)}`);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  @page { size: ${pageCss}; margin: 0; }
  html, body { margin:0; padding:0; }
  .dc-page, .dc-page * { box-sizing: border-box; }
  .dc-page { position:relative; width:${pageW}px; height:${pageHeight}px; background:${bg}; margin:0 auto; overflow:hidden;
    font-family:${font}; color:#111827; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  ${ctx.preview ? '@media screen { body { background:#E5E7EB; padding:16px 0; } .dc-page { box-shadow:0 4px 20px rgba(0,0,0,.12); } }' : ''}
</style></head><body><div class="dc-page">${body}</div></body></html>`;
}

// Back-compat: the Booking Receipt print flow imports this name.
export function buildBookingReceiptHTML(template: any, order: any, lineItems: any[] = [], ctx: any = {}) {
  return buildDocumentHTML(template, order, lineItems, { ...ctx, docType: 'booking_receipt' });
}
