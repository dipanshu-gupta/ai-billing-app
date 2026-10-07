// @ts-nocheck
/**
 * Starter layouts + converters for the Document Canvas designer.
 *  - starterTemplate(): a professional ready-made canvas per document type /
 *    paper size, so a tenant never starts from a blank page.
 *  - legacyRetailToCanvas() / legacySectionsToCanvas(): turn a template made
 *    in the OLD toggle-based designers (retail_invoice_templates,
 *    quote_templates, invoice_templates) into an equivalent canvas, so
 *    existing tenants keep their branding when they move to the new designer.
 */
import { DOC_TYPES, PAGE_PRESETS, isThermal } from '@/lib/documentCanvas';

export const newBlockId = () => 'b' + Math.random().toString(36).slice(2, 10);
const cid = () => 'c' + Math.random().toString(36).slice(2, 8);

const B = (type: string, x: number, y: number, w: number, h: number, props: any = {}, z = 1) =>
  ({ id: newBlockId(), type, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), z, props });
const text = (x, y, w, h, content, o: any = {}) => B('text', x, y, w, h, { content, fontSize: 12, fontWeight: 400, color: '#111827', align: 'left', lineHeight: 1.35, ...o });
const field = (x, y, w, h, key, label, o: any = {}) => B('field', x, y, w, h, { fieldKey: key, label, showLabel: !!label, fontSize: 12, fontWeight: 500, color: '#111827', align: 'left', ...o });
const group = (x, y, w, h, title, fields, o: any = {}) => B('fieldgroup', x, y, w, h, { title, fields: fields.map(f => ({ id: cid(), ...f })), fontSize: 12, showLabels: false, hideEmpty: true, gap: 3, ...o });
const cols = (list: any[]) => list.map(([key, label, extra]) => ({ id: cid(), key, label, ...(extra || {}) }));

export const LINE_COLS: Record<string, any[]> = {
  retail_invoice:  [['sno', '#', { width: 5 }], ['product_name', 'Item'], ['hsn_code', 'HSN', { width: 11 }], ['quantity', 'Qty', { width: 8 }], ['unit_price', 'Rate'], ['discount_pct', 'Disc %', { width: 9 }], ['tax_pct', 'Tax %', { width: 9 }], ['extended_price', 'Amount']],
  booking_receipt: [['product_name', 'Item'], ['quantity', 'Qty', { width: 8 }], ['rental_start_date', 'From', { width: 14 }], ['rental_end_date', 'To', { width: 14 }], ['extended_price', 'Total']],
  quotation:       [['sno', '#', { width: 5 }], ['product_name', 'Item'], ['quantity', 'Qty', { width: 8 }], ['unit_price', 'Unit Price'], ['discount_pct', 'Disc %', { width: 9 }], ['tax_pct', 'Tax %', { width: 9 }], ['extended_price', 'Amount']],
  b2b_invoice:     [['sno', '#', { width: 5 }], ['product_name', 'Item'], ['hsn_code', 'HSN/SAC', { width: 11 }], ['quantity', 'Qty', { width: 8 }], ['unit_price', 'Rate'], ['discount_pct', 'Disc %', { width: 9 }], ['tax_pct', 'Tax %', { width: 9 }], ['extended_price', 'Amount']],
};
const lineProps = (docType: string, o: any = {}) => ({
  columns: cols(o.columns || LINE_COLS[docType] || LINE_COLS.retail_invoice),
  showHeader: true, fontSize: 11, rowAltShade: false, altRowColor: '#F8FAFC', cellPadding: 5,
  headerBg: o.brand || '#0F172A', headerColor: '#FFFFFF', headerFontSize: 10, borderColor: '#E5E7EB',
  showRentalDates: docType === 'booking_receipt' || docType === 'retail_invoice', accentColor: o.accent || '#2563EB',
  showDescription: false, ...(o.line || {}),
});

const META: Record<string, any[]> = {
  retail_invoice:  [['invoice_date', 'Date'], ['payment_method', 'Payment'], ['payment_status', 'Status']],
  booking_receipt: [['order_date', 'Booked on'], ['delivery_date', 'Pickup / Delivery'], ['payment_status', 'Payment']],
  quotation:       [['created_at', 'Date'], ['validity_date', 'Valid until'], ['payment_terms', 'Terms']],
  b2b_invoice:     [['invoice_date', 'Date'], ['due_date', 'Due date'], ['po_number', 'PO #'], ['payment_terms', 'Terms']],
};
const BILL_TO: Record<string, any[]> = {
  retail_invoice:  [{ key: 'customer', bold: true }, { key: 'customer_phone' }, { key: 'customer_gstin', label: 'GSTIN', },],
  booking_receipt: [{ key: 'customer', bold: true }, { key: 'customer_phone' }, { key: 'delivery_address' }],
  quotation:       [{ key: 'customer', bold: true }, { key: 'contact' }, { key: 'billing_address' }],
  b2b_invoice:     [{ key: 'customer', bold: true }, { key: 'contact' }, { key: 'billing_address' }, { key: 'customer_gstin', label: 'GSTIN' }],
};

export interface StarterOpts {
  brand?: string; accent?: string; title?: string; company?: any; footer?: string; terms?: string;
  columns?: any[]; showTax?: boolean; showSignature?: boolean; showBank?: boolean; bank?: string;
  showPayment?: boolean; showTerms?: boolean; showCustomer?: boolean; showFooter?: boolean; line?: any;
  logoUrl?: string; font?: string;
}

export function starterTemplate(docType: string, paper = 'A4', o: StarterOpts = {}) {
  const dt = DOC_TYPES[docType] || DOC_TYPES.retail_invoice;
  const preset = PAGE_PRESETS.find(p => p.v === paper) || PAGE_PRESETS[0];
  const pw = preset.w;
  const brand = o.brand || '#0F172A';
  const accent = o.accent || '#2563EB';
  const title = o.title ?? dt.title;
  const co = o.company || {};
  const showTax = o.showTax ?? (docType === 'retail_invoice' || docType === 'b2b_invoice');
  const blocks: any[] = [];
  const lp = lineProps(docType, { ...o, brand, accent });

  if (isThermal(paper)) {
    const m = 10, w = pw - 20;
    let y = 10;
    blocks.push(B('image', pw / 2 - 30, y, 60, 40, { source: o.logoUrl ? 'upload' : 'company_logo', src: o.logoUrl || '', fit: 'contain' })); y += 46;
    blocks.push(co.name ? text(m, y, w, 20, co.name, { fontSize: 14, fontWeight: 800, align: 'center' }) : field(m, y, w, 20, 'company_name', '', { fontSize: 14, fontWeight: 800, align: 'center' })); y += 22;
    blocks.push(co.address ? text(m, y, w, 30, co.address, { fontSize: 9, align: 'center', color: '#4B5563' }) : field(m, y, w, 30, 'company_address', '', { fontSize: 9, align: 'center', color: '#4B5563' })); y += 32;
    blocks.push(field(m, y, w, 14, 'company_gstin', 'GSTIN', { fontSize: 9, align: 'center' })); y += 18;
    blocks.push(B('divider', m, y, w, 6, { style: 'dashed', color: '#9CA3AF', thickness: 1 })); y += 8;
    blocks.push(text(m, y, w, 18, title, { fontSize: 12, fontWeight: 800, align: 'center' })); y += 20;
    blocks.push(field(m, y, w, 14, 'display_number', dt.numberLabel, { fontSize: 10 })); y += 15;
    blocks.push(field(m, y, w, 14, META[docType][0][0], META[docType][0][1], { fontSize: 10 })); y += 15;
    blocks.push(field(m, y, w, 14, 'customer', 'Customer', { fontSize: 10 })); y += 17;
    blocks.push(B('divider', m, y, w, 6, { style: 'dashed', color: '#9CA3AF', thickness: 1 })); y += 8;
    const tc = [['product_name', 'Item'], ['quantity', 'Qty', { width: 14 }], ['extended_price', 'Amt', { width: 28 }]];
    blocks.push(B('lineitems', m, y, w, 90, { ...lp, columns: cols(tc), fontSize: 10, headerBg: 'transparent', headerColor: '#111827', cellPadding: 2, showRentalDates: false, borderColor: '#D1D5DB' }));
    y += 100;
    blocks.push(B('divider', m, y, w, 6, { style: 'dashed', color: '#9CA3AF', thickness: 1 })); y += 8;
    blocks.push(B('totals', m, y, w, 74, { fontSize: 10, accentBg: '#FFFFFF', accentColor: '#111827', rows: [
      { key: 'subtotal', label: 'Subtotal' }, { key: 'total_discount', label: 'Discount', hideIfZero: true }, { key: 'total_tax', label: 'Tax', hideIfZero: true },
      { key: 'grand_total', label: 'TOTAL', bold: true }, { key: 'amount_paid', label: 'Paid', hideIfZero: true }] })); y += 84;
    blocks.push(text(m, y, w, 30, o.footer || 'Thank you! Visit again.', { fontSize: 10, align: 'center', color: '#4B5563' }));
    return finish(docType, paper, preset, blocks, o);
  }

  // ── Full-page layout ──
  const m = 32, w = pw - 64;
  // header band: logo + company on the left, title + number on the right
  blocks.push(B('image', m, 28, 70, 56, { source: o.logoUrl ? 'upload' : 'company_logo', src: o.logoUrl || '', fit: 'contain' }));
  blocks.push(co.name ? text(m + 82, 30, w * 0.5, 24, co.name, { fontSize: 18, fontWeight: 800, color: brand }) : field(m + 82, 30, w * 0.5, 24, 'company_name', '', { fontSize: 18, fontWeight: 800, color: brand }));
  const addr = [co.tagline, co.address, co.phone && `Ph: ${co.phone}`, co.email, co.gstin && `GSTIN: ${co.gstin}`].filter(Boolean).join('\n');
  blocks.push(addr
    ? text(m + 82, 54, w * 0.5, 44, addr, { fontSize: 9, color: '#4B5563', lineHeight: 1.4 })
    : B('fieldgroup', m + 82, 54, w * 0.5, 44, { fields: [{ id: cid(), key: 'company_address' }, { id: cid(), key: 'company_gstin', label: 'GSTIN' }], showLabels: true, fontSize: 9, color: '#4B5563', hideEmpty: true, gap: 1, labelColon: true }));
  blocks.push(text(pw - m - 260, 28, 260, 34, title, { fontSize: 26, fontWeight: 800, color: brand, align: 'right', letterSpacing: 1 }));
  blocks.push(field(pw - m - 260, 64, 260, 20, 'display_number', dt.numberLabel, { fontSize: 12, fontWeight: 600, align: 'right' }));
  blocks.push(B('rect', 0, 110, pw, 4, { bg: accent }));

  if (o.showCustomer !== false) {
    blocks.push(group(m, 132, w * 0.5, 100, 'Bill To', BILL_TO[docType].map(f => ({ ...f, label: f.label || '' })), { fontSize: 12, showLabels: true, titleColor: '#64748B' }));
    blocks.push(group(pw - m - w * 0.34, 132, w * 0.34, 84, 'Details', META[docType].map(([k, l]) => ({ key: k, label: l })), { fontSize: 11, showLabels: true, hideEmpty: true, labelWidth: 78, titleColor: '#64748B' }));
  }
  blocks.push(B('lineitems', m, 244, w, 150, lp));

  const ty = 414;
  if (showTax) blocks.push(B('taxsummary', m, ty, w * 0.5, 70, { fontSize: 9, mode: 'cgst_sgst', groupBy: 'rate', headerColor: '#64748B' }));
  blocks.push(B('totals', pw - m - 250, ty, 250, 118, { fontSize: 12, accentBg: brand, accentColor: '#FFFFFF', rows: [
    { key: 'subtotal', label: 'Subtotal' }, { key: 'total_discount', label: 'Discount', hideIfZero: true },
    { key: 'shipping_cost', label: 'Shipping', hideIfZero: true }, { key: 'total_tax', label: 'Tax', hideIfZero: true },
    { key: 'grand_total', label: 'Total', bold: true, accent: true },
    ...(o.showPayment !== false && (docType === 'retail_invoice' || docType === 'booking_receipt') ? [{ key: 'amount_paid', label: 'Paid', hideIfZero: true }, { key: 'balance_due', label: 'Balance Due', hideIfZero: true }] : [])] }));
  blocks.push(field(m, ty + 82, w * 0.5, 34, 'amount_in_words', 'In words', { fontSize: 10, fontWeight: 500, color: '#374151' }));

  let y2 = ty + 140;
  if (o.showBank || (docType === 'b2b_invoice' && o.showBank !== false)) {
    blocks.push(B('rect', m, y2, w * 0.5, 70, { bg: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, borderRadius: 6 }, 0));
    blocks.push(text(m + 10, y2 + 8, w * 0.5 - 20, 56, o.bank || 'Bank Details\nBank: ____________\nA/C No: ____________\nIFSC: ____________', { fontSize: 10, color: '#1E3A8A' }));
  }
  if (o.showTerms !== false) {
    blocks.push(text(m, y2 + 90, w * 0.62, 90, o.terms || 'Terms & Conditions\n1. Payment is due by the due date specified.\n2. Goods once sold will not be taken back.\n3. Subject to local jurisdiction.', { fontSize: 9, color: '#475569', lineHeight: 1.5 }));
  }
  if (o.showSignature !== false) blocks.push(B('signature', pw - m - 200, y2 + 100, 200, 60, { label: 'Authorised Signatory', fontSize: 10 }));
  blocks.push(text(m, preset.h - 60, w, 20, o.footer || 'Thank you for your business!', { fontSize: 10, align: 'center', color: '#6B7280' }));
  return finish(docType, paper, preset, blocks, o);
}

function finish(docType: string, paper: string, preset: any, blocks: any[], o: StarterOpts) {
  return {
    doc_type: docType, name: `New ${DOC_TYPES[docType]?.label || 'Document'}`, paper_size: paper,
    page_width: preset.w, page_height: preset.h, background_color: '#FFFFFF', is_default: false,
    canvas: { blocks, meta: { font_family: o.font || 'Arial, Helvetica, sans-serif' } },
  };
}

// ─── Legacy → canvas converters ──────────────────────────────────────────────
const SECTION_COL_MAP: Record<string, string> = {
  sno: 'sno', image: 'image', name: 'product_name', description: 'description', hsn: 'hsn_code', sku: 'sku',
  qty: 'quantity', unit: 'unit', unit_price: 'unit_price', discount: 'discount_pct', tax: 'tax_pct',
  cgst: 'cgst_amount', sgst: 'sgst_amount', igst: 'tax_amount', net_amount: 'net_amount', amount: 'extended_price',
};

export function legacyRetailToCanvas(row: any, docType = 'retail_invoice') {
  const paper = ['A4', 'A5', 'thermal_80', 'thermal_58', 'thermal_57'].includes(row.paper_size) ? row.paper_size : 'A4';
  const lc: any[] = [];
  if (row.col_sno) lc.push(['sno', '#', { width: 5 }]);
  if (row.show_product_images && !isThermal(paper)) lc.push(['image', 'Img', { width: 8 }]);
  if (row.col_item !== false) lc.push(['product_name', 'Item']);
  if (row.col_hsn) lc.push(['hsn_code', 'HSN', { width: 10 }]);
  if (row.col_unit) lc.push(['unit', 'Unit', { width: 8 }]);
  if (row.col_qty !== false) lc.push(['quantity', 'Qty', { width: 8 }]);
  if (row.col_price !== false) lc.push(['unit_price', 'Rate']);
  if (row.col_discount) lc.push(['discount_pct', 'Disc %', { width: 9 }]);
  if (row.col_tax_rate && row.tax_regime !== 'exempt') lc.push(['tax_pct', 'Tax %', { width: 9 }]);
  if (row.col_subtotal_line) lc.push(['net_amount', 'Subtotal']);
  if (row.col_total !== false) lc.push(['extended_price', 'Total']);
  const t = starterTemplate(docType, paper, {
    brand: row.brand_color, accent: row.accent_color, title: row.headline || undefined,
    company: { name: row.store_name, tagline: row.store_tagline, address: row.store_address, phone: row.store_phone, email: row.store_email, gstin: row.show_gst_header ? row.store_gstin : '' },
    footer: row.show_footer === false ? '' : row.footer_msg, terms: row.show_terms ? (row.terms_and_conditions || '').replace(/<[^>]+>/g, '') : '',
    showTerms: !!row.show_terms, showSignature: !!row.show_signature, showCustomer: row.show_customer !== false,
    showTax: row.tax_regime !== 'exempt', showPayment: row.show_payment !== false, logoUrl: row.show_logo ? row.logo_url : '',
    columns: lc.length ? lc : undefined, line: { rowAltShade: !!row.alt_row, altRowColor: row.alt_row_color, showRentalDates: row.show_rental_dates !== false },
    font: row.font_family && row.font_family !== 'monospace' ? row.font_family : undefined,
  });
  t.name = `${row.name || 'Template'} (canvas)`;
  t.background_color = row.bg_color || '#FFFFFF';
  return t;
}

export function legacySectionsToCanvas(row: any, docType: string) {
  const secs: any[] = (row.sections || []).filter(s => s.enabled !== false);
  const find = (...types: string[]) => secs.find(s => types.includes(s.type))?.settings || null;
  const hdr = find('header') || {};
  const items = find('items') || {};
  const terms = find('terms') || {};
  const bank = find('bank') || {};
  const foot = find('footer') || {};
  const has = (...types: string[]) => secs.some(s => types.includes(s.type));
  const colKeys: string[] = items.columns || [];
  const labels = items.columnLabels || {};
  const lc = colKeys.map(k => [SECTION_COL_MAP[k] || k, labels[k] || k, k === 'sno' ? { width: 5 } : undefined]).filter(c => c[0]);
  const bankText = bank && (bank.bankName || bank.accountNumber)
    ? ['Bank Details', bank.bankName && `Bank: ${bank.bankName}`, bank.accountName && `A/C Name: ${bank.accountName}`, bank.accountNumber && `A/C No: ${bank.accountNumber}`, bank.ifscCode && `IFSC: ${bank.ifscCode}`, bank.upiId && `UPI: ${bank.upiId}`].filter(Boolean).join('\n') : '';
  const t = starterTemplate(docType, 'A4', {
    brand: hdr.bgColor || items.headerBgColor || '#0F172A', accent: hdr.accentColor || '#2563EB',
    company: { name: hdr.companyName || row.company_name || '', tagline: hdr.tagline, address: hdr.address, phone: hdr.phone, email: hdr.email, gstin: hdr.gstIn },
    logoUrl: hdr.logoUrl, footer: foot.footerText || foot.centerText || foot.leftText || '',
    terms: terms.content ? 'Terms & Conditions\n' + String(terms.content).replace(/<[^>]+>/g, '') : '',
    showTerms: has('terms'), showSignature: has('signature') || foot.showSignature,
    showBank: !!bankText, bank: bankText || undefined,
    columns: lc.length ? lc : undefined, line: { rowAltShade: !!(items.altRowColor || items.stripedRows), headerBg: items.headerBgColor, headerColor: items.headerTextColor },
    showTax: docType === 'b2b_invoice',
  });
  t.name = `${row.name || 'Template'} (canvas)`;
  return t;
}

// Scale a layout horizontally when the paper width changes.
export function scaleLayout(blocks: any[], fromW: number, toW: number) {
  if (!fromW || fromW === toW) return blocks;
  const k = toW / fromW;
  return blocks.map(b => ({ ...b, x: Math.round(b.x * k), w: Math.max(12, Math.round(b.w * k)) }));
}
