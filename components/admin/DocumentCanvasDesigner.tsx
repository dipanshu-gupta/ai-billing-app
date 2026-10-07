// @ts-nocheck
'use client';
/**
 * Document Canvas Designer — ONE designer for every printable document
 * (Retail Invoice, Booking Receipt, Quotation, B2B Invoice).
 *
 * Free-form canvas (drag / resize / snap / nudge / undo / duplicate), with a
 * field palette that exposes EVERY standard field, EVERY custom field (header
 * and line-item), company details, computed totals and tax splits — dragged
 * anywhere on the page, Oracle-CPQ style. Output is rendered by the shared
 * engine in lib/documentCanvas.ts, the same code that prints / makes PDFs.
 *
 * Multi-tenant: templates are loaded through tenantScope() and saved with the
 * tenant_id of the logged-in tenant (RLS + auto_fill_tenant_id enforce it in
 * the shared DB; dedicated-DB tenants use their own project).
 */
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { tenantScope } from '@/lib/utils';
import { useTenant } from '@/context/TenantContext';
import { useApp } from '@/context/AppContext';
import { useCustomFields } from '@/lib/useCustomFields';
import { LINE_ITEM_STANDARD_FIELDS, getStandardFields } from '@/components/admin/FieldLayoutDesigner';
import { DOC_TYPES, PAGE_PRESETS, isThermal, sampleFor, buildDocumentHTML, renderBlockInner, shellExtras } from '@/lib/documentCanvas';
import { starterTemplate, legacyRetailToCanvas, legacySectionsToCanvas, scaleLayout, newBlockId, LINE_COLS } from '@/lib/documentStarters';
import { loadCanvasTemplates } from '@/lib/useDocumentTemplates';

const cid = () => 'c' + Math.random().toString(36).slice(2, 8);
const human = (k: string) => k.replace(/^custom:/, '').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase());

const BLOCK_TYPES = [
  { v: 'text',       l: 'Text',         icon: '🔤' },
  { v: 'field',      l: 'Field',        icon: '🔗' },
  { v: 'fieldgroup', l: 'Field Group',  icon: '🗂️' },
  { v: 'lineitems',  l: 'Line Items',   icon: '📋' },
  { v: 'totals',     l: 'Totals',       icon: '∑' },
  { v: 'taxsummary', l: 'Tax Summary',  icon: '🧮' },
  { v: 'image',      l: 'Image / Logo', icon: '🖼️' },
  { v: 'qr',         l: 'QR Code',      icon: '▦' },
  { v: 'divider',    l: 'Divider',      icon: '➖' },
  { v: 'rect',       l: 'Box',          icon: '▢' },
  { v: 'signature',  l: 'Signature',    icon: '✍️' },
];
const FONTS = [
  { v: 'Arial, Helvetica, sans-serif', l: 'Arial' }, { v: "'Helvetica Neue', Helvetica, sans-serif", l: 'Helvetica' },
  { v: 'Georgia, serif', l: 'Georgia (serif)' }, { v: "'Times New Roman', serif", l: 'Times New Roman' },
  { v: "'Courier New', monospace", l: 'Courier (receipt)' }, { v: 'monospace', l: 'Monospace' },
  { v: "'Trebuchet MS', sans-serif", l: 'Trebuchet' }, { v: 'Verdana, sans-serif', l: 'Verdana' },
];
const FORMATS = [{ v: 'auto', l: 'Auto' }, { v: 'text', l: 'Plain text' }, { v: 'currency', l: 'Currency' }, { v: 'number', l: 'Number' }, { v: 'percent', l: 'Percent' }, { v: 'date', l: 'Date' }, { v: 'boolean', l: 'Yes / No' }];
const ALIGNS = [{ v: 'left', l: 'Left' }, { v: 'center', l: 'Center' }, { v: 'right', l: 'Right' }];
const WEIGHTS = [{ v: '400', l: 'Regular' }, { v: '500', l: 'Medium' }, { v: '600', l: 'Semibold' }, { v: '700', l: 'Bold' }, { v: '800', l: 'Extra bold' }];

// ─── Field catalogue (standard + custom + computed) ──────────────────────────
const TOTAL_FIELDS = [
  ['subtotal', 'Subtotal'], ['total_discount', 'Total Discount'], ['overall_discount_amount', 'Overall Discount Amount'], ['shipping_cost', 'Shipping'],
  ['total_tax', 'Total Tax'], ['cgst', 'CGST (half of tax)'], ['sgst', 'SGST (half of tax)'], ['igst', 'IGST'], ['taxable_value', 'Taxable Value'],
  ['round_off', 'Round Off'], ['grand_total', 'Grand Total'], ['amount_paid', 'Amount Paid'], ['balance_due', 'Balance Due'],
  ['amount_in_words', 'Amount in Words'], ['item_count', 'Number of Items'], ['total_qty', 'Total Quantity'],
];
const COMPANY_FIELDS = [
  ['company_name', 'Company Name'], ['company_legal_name', 'Legal Name'], ['company_address', 'Address'], ['company_city', 'City'],
  ['company_pincode', 'PIN / ZIP'], ['company_state_code', 'State Code'], ['company_gstin', 'GSTIN / Tax ID'],
];
const LOOKUP_TYPES = new Set(['retailCustomer', 'retailInvoiceTemplate', 'owner', 'customer', 'lookup', 'orderRef', 'user', 'multiselect_lookup', 'products', 'lineItems']);
const fmtForType = (t: string) => ['date', 'datetime'].includes(t) ? 'date' : t === 'currency' ? 'currency' : t === 'percent' ? 'percent' : ['checkbox', 'boolean'].includes(t) ? 'boolean' : 'auto';

function buildCatalog(docType: string, hdrCustom: any[], liCustom: any[]) {
  const dt = DOC_TYPES[docType];
  const header: any[] = [];
  const seen = new Set<string>();
  const add = (g: string, v: string, l: string, format = 'auto') => { if (seen.has(v)) return; seen.add(v); header.push({ g, v, l, format }); };
  add('Document', 'display_number', dt.numberLabel);
  add('Document', 'owner_name', 'Owner / Prepared by'); add('Document', 'created_at', 'Created Date', 'date'); add('Document', 'today', 'Print Date', 'date');
  COMPANY_FIELDS.forEach(([v, l]) => add('Company', v, l));
  dt.customerKeys.forEach((k: string) => add('Customer', k, human(k), k.includes('date') ? 'date' : 'auto'));
  TOTAL_FIELDS.forEach(([v, l]) => add('Totals', v, l, v === 'amount_in_words' || v === 'item_count' || v === 'total_qty' ? 'auto' : 'currency'));
  let std: any[] = [];
  try { std = getStandardFields(dt.headerObject) || []; } catch { std = []; }
  std.forEach(f => { if (!LOOKUP_TYPES.has(f.type)) add('Record fields', f.key, f.label || human(f.key), fmtForType(f.type)); });
  hdrCustom.forEach(f => add('Custom fields', `custom:${f.api_name}`, f.label, fmtForType(f.field_type)));

  const line: any[] = [];
  const seenL = new Set<string>();
  const addL = (g: string, v: string, l: string, format = 'auto') => { if (seenL.has(v)) return; seenL.add(v); line.push({ g, v, l, format }); };
  (LINE_ITEM_STANDARD_FIELDS[dt.lineObject] || []).forEach(f => addL('Standard', f.key, f.label, fmtForType(f.type)));
  [['sno', '#'], ['image', 'Product Image'], ['description', 'Description'], ['sku', 'SKU / Product Code'], ['unit', 'Unit'], ['hsn_code', 'HSN / SAC'],
    ['discount_pct', 'Discount %'], ['tax_pct', 'Tax %'], ['net_amount', 'Net Amount']].forEach(([v, l]) => addL('Standard', v, l));
  [['discount_amount', 'Discount Amount'], ['tax_amount', 'Tax Amount'], ['cgst_amount', 'CGST Amount'], ['sgst_amount', 'SGST Amount'], ['extended_price', 'Line Total']]
    .forEach(([v, l]) => addL('Computed', v, l, 'currency'));
  liCustom.forEach(f => addL('Custom fields', `custom:${f.api_name}`, f.label, fmtForType(f.field_type)));
  return { header, line };
}
const groupBy = (list: any[]) => { const m: Record<string, any[]> = {}; list.forEach(i => { (m[i.g] = m[i.g] || []).push(i); }); return Object.entries(m).map(([label, items]) => ({ label, items })); };

// ─── UI atoms ────────────────────────────────────────────────────────────────
const inputCls = 'w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-[#0F172A] bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400';
function Card({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-[14px] border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(p => !p)} className="w-full px-3.5 py-2 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200 flex items-center gap-2 hover:bg-gray-100">
        <span className="text-sm">{icon}</span><span className="font-bold text-[#0F172A] text-xs flex-1 text-left">{title}</span><span className="text-gray-400 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="p-3.5 space-y-2.5">{children}</div>}
    </div>
  );
}
const L = ({ children }) => <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">{children}</label>;
const TI = ({ value, onChange, placeholder, mono }) => <input value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''} style={{ colorScheme: 'light' }} className={`${inputCls} ${mono ? 'font-mono' : ''}`} />;
const NUM = ({ value, onChange, min, max, step }) => <input type="number" value={value ?? 0} min={min} max={max} step={step} onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))} style={{ colorScheme: 'light' }} className={inputCls} />;
const SEL = ({ value, onChange, options }) => (
  <select value={value ?? ''} onChange={e => onChange(e.target.value)} style={{ colorScheme: 'light' }} className={inputCls}>
    {options.map(o => <option key={o.v} value={o.v} className="text-[#0F172A] bg-white">{o.l}</option>)}
  </select>
);
const Toggle = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between py-0.5 cursor-pointer select-none gap-3">
    <span className="text-xs text-[#0F172A] font-medium">{label}</span>
    <div onClick={e => { e.preventDefault(); onChange(); }} className={`relative w-9 h-5 rounded-full flex-shrink-0 cursor-pointer transition-colors ${checked ? 'bg-purple-600' : 'bg-gray-300'}`}>
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </div>
  </label>
);
const ColorRow = ({ label, value, onChange, allowClear }) => (
  <div>
    <L>{label}</L>
    <div className="flex items-center gap-1.5">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'} onChange={e => onChange(e.target.value)} className="w-8 h-8 rounded-lg border border-gray-300 cursor-pointer p-0.5 flex-shrink-0" />
      <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={allowClear ? 'none' : ''} style={{ colorScheme: 'light' }} className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-[#0F172A] bg-white font-mono focus:outline-none focus:ring-1 focus:ring-purple-400" />
      {allowClear && value ? <button onClick={() => onChange('')} className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button> : null}
    </div>
  </div>
);
// Grouped (optgroup) field picker
function FieldSelect({ value, onChange, groups, extra }) {
  const known = groups.some(g => g.items.some(i => i.v === value));
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)} style={{ colorScheme: 'light' }} className={inputCls}>
      {!known && value ? <option value={value}>{value}</option> : null}
      {extra}
      {groups.map(g => <optgroup key={g.label} label={g.label}>{g.items.map(i => <option key={i.v} value={i.v} className="text-[#0F172A] bg-white">{i.l}</option>)}</optgroup>)}
    </select>
  );
}

// ─── Canvas block (drag + resize + snap) ─────────────────────────────────────
const CanvasBlock = memo(function CanvasBlock({ block, selected, zoom, snap, onSelect, onChange, onBegin, onEnd, sample, docType, tick }) {
  const dragRef = useRef(null);
  const sn = (v: number) => (snap > 0 ? Math.round(v / snap) * snap : Math.round(v));

  const onMove = useCallback((e) => {
    const d = dragRef.current; if (!d) return;
    const k = zoom / 100;
    const dx = (e.clientX - d.sx) / k, dy = (e.clientY - d.sy) / k;
    if (d.mode === 'move') onChange(block.id, { x: Math.max(0, sn(d.ox + dx)), y: Math.max(0, sn(d.oy + dy)) });
    else onChange(block.id, { w: d.axis === 'y' ? d.ow : Math.max(16, sn(d.ow + dx)), h: d.axis === 'x' ? d.oh : Math.max(10, sn(d.oh + dy)) });
  }, [zoom, snap, block.id, onChange]);
  const onUp = useCallback(() => {
    dragRef.current = null; onEnd();
    window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
  }, [onMove, onEnd]);
  const start = (e, mode, axis) => {
    e.stopPropagation(); if (mode !== 'move') e.preventDefault();
    onSelect(block.id); onBegin();
    dragRef.current = { mode, axis, sx: e.clientX, sy: e.clientY, ox: block.x, oy: block.y, ow: block.w, oh: block.h };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  };

  const p = block.props || {};
  const html = useMemo(() => {
    const inner = renderBlockInner(block, sample.record, sample.items, { docType, designMode: true, products: [] });
    return `<div style="position:relative;width:100%;height:100%;overflow:hidden;box-sizing:border-box;${shellExtras(p)}">${inner}</div>`;
  }, [block, sample, docType, tick]);

  return (
    <div onMouseDown={e => { if (!e.target.dataset?.handle) start(e, 'move'); }} onClick={e => { e.stopPropagation(); onSelect(block.id); }}
      style={{ position: 'absolute', left: block.x, top: block.y, width: block.w, height: block.h, zIndex: block.z || 1, cursor: 'move', transform: p.rotate ? `rotate(${p.rotate}deg)` : undefined,
        outline: selected ? '2px solid #7C3AED' : '1px dashed rgba(124,58,237,.18)', outlineOffset: 0 }}>
      <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: html }} />
      {selected && <>
        <div data-handle="1" onMouseDown={e => start(e, 'resize', 'xy')} style={{ position: 'absolute', right: -6, bottom: -6, width: 12, height: 12, background: '#7C3AED', borderRadius: 3, cursor: 'nwse-resize', border: '2px solid white' }} />
        <div data-handle="1" onMouseDown={e => start(e, 'resize', 'x')} style={{ position: 'absolute', right: -5, top: '50%', marginTop: -7, width: 8, height: 14, background: '#A78BFA', borderRadius: 3, cursor: 'ew-resize', border: '1.5px solid white' }} />
        <div data-handle="1" onMouseDown={e => start(e, 'resize', 'y')} style={{ position: 'absolute', bottom: -5, left: '50%', marginLeft: -7, width: 14, height: 8, background: '#A78BFA', borderRadius: 3, cursor: 'ns-resize', border: '1.5px solid white' }} />
      </>}
    </div>
  );
});

// ─── Default blocks ──────────────────────────────────────────────────────────
function defaultBlockFor(type: string, docType: string, count: number, pw: number) {
  const dt = DOC_TYPES[docType];
  const off = (count % 8) * 14;
  const base = { id: newBlockId(), x: 40 + off, y: 40 + off, z: count + 1 };
  switch (type) {
    case 'text':       return { ...base, type, w: 260, h: 32, props: { content: 'New text', fontSize: 13, fontWeight: 400, color: '#111827', align: 'left', lineHeight: 1.35 } };
    case 'field':      return { ...base, type, w: 240, h: 22, props: { fieldKey: 'display_number', label: dt.numberLabel, showLabel: true, fontSize: 12, fontWeight: 500, color: '#111827', align: 'left', format: 'auto' } };
    case 'fieldgroup': return { ...base, type, w: 260, h: 90, props: { title: 'Bill To', fields: dt.customerKeys.slice(0, 3).map((k, i) => ({ id: cid(), key: k, label: human(k), bold: i === 0 })), fontSize: 12, showLabels: false, hideEmpty: true, gap: 3 } };
    case 'image':      return { ...base, type, w: 110, h: 56, props: { source: 'company_logo', src: '', fit: 'contain' } };
    case 'lineitems':  return { ...base, type, w: Math.max(200, pw - 80), h: 190, props: { columns: (LINE_COLS[docType] || LINE_COLS.retail_invoice).map(([key, label, ex]) => ({ id: cid(), key, label, ...(ex || {}) })), showHeader: true, fontSize: 11, cellPadding: 5, headerBg: '#0F172A', headerColor: '#FFFFFF', borderColor: '#E5E7EB', rowAltShade: false, altRowColor: '#F8FAFC', showRentalDates: false, accentColor: '#2563EB' } };
    case 'totals':     return { ...base, type, w: 250, h: 112, props: { fontSize: 12, accentBg: '#0F172A', accentColor: '#FFFFFF', rows: [{ key: 'subtotal', label: 'Subtotal' }, { key: 'total_discount', label: 'Discount', hideIfZero: true }, { key: 'total_tax', label: 'Tax', hideIfZero: true }, { key: 'grand_total', label: 'Total', bold: true, accent: true }] } };
    case 'taxsummary': return { ...base, type, w: 380, h: 70, props: { fontSize: 9, mode: 'cgst_sgst', groupBy: 'rate', headerColor: '#64748B' } };
    case 'qr':         return { ...base, type, w: 90, h: 104, props: { data: '{{display_number}}', caption: '{{display_number}}', fontSize: 9 } };
    case 'divider':    return { ...base, type, w: Math.max(100, pw - 64), h: 8, props: { color: '#D1D5DB', thickness: 1, style: 'solid' } };
    case 'rect':       return { ...base, type, w: 200, h: 90, z: 0, props: { bg: '#F8FAFC', borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 8 } };
    case 'signature':  return { ...base, type, w: 200, h: 60, props: { label: 'Authorised Signatory', fontSize: 11, align: 'center' } };
    default:           return { ...base, type: 'text', w: 200, h: 30, props: { content: '', fontSize: 12 } };
  }
}

// ─── Main designer ───────────────────────────────────────────────────────────
export default function DocumentCanvasDesigner({ docType = 'retail_invoice' }) {
  const dt = DOC_TYPES[docType] || DOC_TYPES.retail_invoice;
  const { supabase, tenant } = useTenant();
  const app = useApp();
  const { fields: hdrCustom } = useCustomFields(dt.headerObject);
  const { fields: liCustom } = useCustomFields(dt.lineObject);
  const catalog = useMemo(() => buildCatalog(docType, hdrCustom || [], liCustom || []), [docType, hdrCustom, liCustom]);
  const hdrGroups = useMemo(() => groupBy(catalog.header), [catalog]);
  const liGroups = useMemo(() => groupBy(catalog.line), [catalog]);
  const hdrIndex = useMemo(() => Object.fromEntries(catalog.header.map(f => [f.v, f])), [catalog]);
  const liIndex = useMemo(() => Object.fromEntries(catalog.line.map(f => [f.v, f])), [catalog]);
  const sample = useMemo(() => sampleFor(docType), [docType]);

  const [templates, setTemplates] = useState([]);
  const [legacy, setLegacy] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [t, setT] = useState(() => starterTemplate(docType, 'A4'));
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [zoom, setZoom] = useState(75);
  const [snap, setSnap] = useState(4);
  const [showGrid, setShowGrid] = useState(false);
  const [leftTab, setLeftTab] = useState('blocks');
  const [search, setSearch] = useState('');
  const [delConfirm, setDelConfirm] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [newMenu, setNewMenu] = useState(false);
  const [dirty, setDirty] = useState(false);
  const logoRef = useRef(null);
  const pageRef = useRef(null);
  const past = useRef([]); const future = useRef([]); const lastPush = useRef(0); const locked = useRef(false);
  const [, force] = useState(0);

  const showToast = (m, type = 'ok') => { setToast({ m, type }); setTimeout(() => setToast(null), 2600); };
  const blocks = t.canvas?.blocks || [];
  const selected = blocks.find(b => b.id === selectedId) || null;
  const pw = t.page_width || 794;

  // ── load ──
  const load = useCallback(async () => {
    if (!supabase) return;
    const rows = await loadCanvasTemplates(supabase, docType);
    setTemplates(rows);
    if (dt.legacyTable) {
      const { data } = await tenantScope(supabase.from(dt.legacyTable).select('*')).order('created_at');
      setLegacy(data || []);
    }
    return rows;
  }, [supabase, docType]);
  useEffect(() => {
    (async () => {
      const rows = await load();
      const def = (rows || []).find(r => r.is_default) || (rows || [])[0];
      if (def) openTemplate(def);
    })();
  }, [docType, supabase]);

  function openTemplate(row) {
    past.current = []; future.current = [];
    setActiveId(row.id);
    setT({ ...starterTemplate(docType, 'A4'), ...row, canvas: { blocks: [], meta: {}, ...(row.canvas || {}) } });
    setSelectedId(null); setDirty(false);
  }
  function startNew(kind) {
    past.current = []; future.current = [];
    const paper = kind === 'thermal' ? 'thermal_80' : 'A4';
    const tpl = kind === 'blank' ? { ...starterTemplate(docType, 'A4'), canvas: { blocks: [], meta: { font_family: FONTS[0].v } } } : starterTemplate(docType, paper);
    setActiveId(null); setT(tpl); setSelectedId(null); setNewMenu(false); setDirty(true);
  }

  // ── history ──
  const snapshot = () => JSON.stringify(t.canvas);
  const pushHistory = (force = false) => {
    if (locked.current) return;
    const now = Date.now();
    if (!force && now - lastPush.current < 700) return;
    lastPush.current = now;
    past.current.push(snapshot()); if (past.current.length > 80) past.current.shift();
    future.current = [];
  };
  const setBlocks = (updater, opts: any = {}) => {
    pushHistory(!!opts.force);
    setDirty(true);
    setT(p => ({ ...p, canvas: { ...p.canvas, blocks: typeof updater === 'function' ? updater(p.canvas?.blocks || []) : updater } }));
  };
  const undo = () => { const s = past.current.pop(); if (!s) return; future.current.push(snapshot()); setT(p => ({ ...p, canvas: JSON.parse(s) })); setDirty(true); };
  const redo = () => { const s = future.current.pop(); if (!s) return; past.current.push(snapshot()); setT(p => ({ ...p, canvas: JSON.parse(s) })); setDirty(true); };
  const onBegin = useCallback(() => { /* snapshot taken lazily below */ past.current.push(JSON.stringify(tRef.current.canvas)); future.current = []; locked.current = true; }, []);
  const onEnd = useCallback(() => { locked.current = false; }, []);
  const tRef = useRef(t); tRef.current = t;

  // ── block ops ──
  const updateBlock = useCallback((id, patch) => { setDirty(true); setT(p => ({ ...p, canvas: { ...p.canvas, blocks: (p.canvas?.blocks || []).map(b => b.id === id ? { ...b, ...patch } : b) } })); }, []);
  const updateProps = (id, patch) => setBlocks(prev => prev.map(b => b.id === id ? { ...b, props: { ...b.props, ...patch } } : b));
  const addBlock = (type, at) => {
    const b = defaultBlockFor(type, docType, blocks.length, pw);
    if (at) { b.x = Math.max(0, Math.round(at.x)); b.y = Math.max(0, Math.round(at.y)); }
    setBlocks(prev => [...prev, b], { force: true }); setSelectedId(b.id); return b;
  };
  const addFieldBlock = (f, at) => {
    const b = defaultBlockFor('field', docType, blocks.length, pw);
    b.props = { ...b.props, fieldKey: f.v, label: f.l, format: f.format || 'auto' };
    if (f.v === 'amount_in_words') b.w = 360;
    if (at) { b.x = Math.max(0, Math.round(at.x)); b.y = Math.max(0, Math.round(at.y)); }
    setBlocks(prev => [...prev, b], { force: true }); setSelectedId(b.id);
  };
  const lineTarget = () => (selected?.type === 'lineitems' ? selected : null) || blocks.find(b => b.type === 'lineitems');
  const addLineColumn = (f) => {
    const target = lineTarget();
    // clicking a column that is already in the table removes it (toggle)
    if (target && (target.props.columns || []).some(c => c.key === f.v)) {
      updateProps(target.id, { columns: target.props.columns.filter(c => c.key !== f.v) });
      showToast(`Removed “${f.l}” column`); return;
    }
    if (!target) {
      const b = addBlock('lineitems'); updateProps(b.id, { columns: [{ id: cid(), key: f.v, label: f.l, format: f.format }] }); return;
    }
    updateProps(target.id, { columns: [...(target.props.columns || []), { id: cid(), key: f.v, label: f.l, format: f.format !== 'auto' ? f.format : undefined }] });
    setSelectedId(target.id); showToast(`Added “${f.l}” column`);
  };
  const deleteBlock = (id) => { setBlocks(prev => prev.filter(b => b.id !== id), { force: true }); if (selectedId === id) setSelectedId(null); };
  const duplicateBlock = (id) => {
    const src = blocks.find(b => b.id === id); if (!src) return;
    const copy = { ...JSON.parse(JSON.stringify(src)), id: newBlockId(), x: src.x + 16, y: src.y + 16, z: Math.max(0, ...blocks.map(b => b.z || 0)) + 1 };
    if (copy.props?.columns) copy.props.columns = copy.props.columns.map(c => ({ ...c, id: cid() }));
    if (copy.props?.fields) copy.props.fields = copy.props.fields.map(c => ({ ...c, id: cid() }));
    setBlocks(prev => [...prev, copy], { force: true }); setSelectedId(copy.id);
  };
  const restack = (id, dir) => setBlocks(prev => {
    const z = prev.map(b => b.z || 0); const max = Math.max(0, ...z), min = Math.min(0, ...z);
    return prev.map(b => b.id === id ? { ...b, z: dir === 'front' ? max + 1 : min - 1 } : b);
  }, { force: true });
  const nudgeZ = (id, d) => setBlocks(prev => prev.map(b => b.id === id ? { ...b, z: (b.z || 0) + d } : b), { force: true });

  // keyboard: delete / nudge / duplicate / undo / redo
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (!selectedId) return;
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateBlock(selectedId); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteBlock(selectedId); return; }
      if (e.key === 'Escape') { setSelectedId(null); return; }
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) { e.preventDefault(); setBlocks(prev => prev.map(b => b.id === selectedId ? { ...b, x: Math.max(0, b.x + d[0]), y: Math.max(0, b.y + d[1]) } : b)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── persistence ──
  async function save() {
    if (!supabase) return;
    setSaving(true);
    const payload: any = {
      name: t.name, paper_size: t.paper_size, page_width: t.page_width, page_height: t.page_height,
      background_color: t.background_color, canvas: t.canvas, updated_at: new Date().toISOString(),
    };
    if (dt.table === 'document_templates') payload.doc_type = docType;
    let err = null;
    if (activeId) {
      const { error } = await supabase.from(dt.table).update(payload).eq('id', activeId); err = error;
    } else {
      const first = templates.length === 0;
      const { data: d, error } = await supabase.from(dt.table).insert({
        ...payload, is_default: first, created_at: new Date().toISOString(),
        ...(dt.table === 'document_templates' ? { created_by: app?.currentUser?.email } : {}),
        ...(tenant?.id ? { tenant_id: tenant.id } : {}),
      }).select().single();
      err = error; if (d && !error) setActiveId(d.id);
    }
    setSaving(false);
    if (err) { showToast('Save failed: ' + err.message + (/document_templates|relation/.test(err.message) ? ' — run SQL 45 first' : ''), 'err'); return; }
    setDirty(false); showToast('✓ Template saved'); await load(); await refreshApp();
  }
  async function refreshApp() {
    try { if (docType === 'quotation') await app?.fetchQuoteTemplates?.(); if (docType === 'b2b_invoice') await app?.fetchInvoiceTemplates?.(); } catch { /* non-fatal */ }
  }
  async function del(id) {
    if (!supabase) return;
    await supabase.from(dt.table).delete().eq('id', id);
    if (activeId === id) { setActiveId(null); setT(starterTemplate(docType, 'A4')); setSelectedId(null); }
    setDelConfirm(null); await load(); await refreshApp();
  }
  async function setDefault(id) {
    if (!supabase) return;
    let q = supabase.from(dt.table).update({ is_default: false }).neq('id', id);
    if (dt.table === 'document_templates') q = q.eq('doc_type', docType);
    await tenantScope(q);
    await supabase.from(dt.table).update({ is_default: true }).eq('id', id);
    showToast('★ Set as default'); await load(); await refreshApp();
  }
  async function duplicateTemplate() {
    if (!supabase) return;
    const payload: any = { name: `${t.name} (copy)`, paper_size: t.paper_size, page_width: t.page_width, page_height: t.page_height, background_color: t.background_color, canvas: JSON.parse(JSON.stringify(t.canvas)), is_default: false, created_at: new Date().toISOString(), ...(tenant?.id ? { tenant_id: tenant.id } : {}) };
    if (dt.table === 'document_templates') payload.doc_type = docType;
    const { data, error } = await supabase.from(dt.table).insert(payload).select().single();
    if (error) { showToast('Duplicate failed: ' + error.message, 'err'); return; }
    await load(); if (data) openTemplate(data); showToast('✓ Duplicated');
  }
  function importLegacy(row) {
    const conv = docType === 'retail_invoice' ? legacyRetailToCanvas(row, docType) : legacySectionsToCanvas(row, docType);
    past.current = []; future.current = [];
    setActiveId(null); setT(conv); setSelectedId(null); setDirty(true);
    showToast('Imported — review the layout, then Save');
  }
  async function uploadImage(file, cb) {
    if (!file) return;
    const reader = new FileReader(); reader.onload = e => cb(e.target?.result as string); reader.readAsDataURL(file);
    if (supabase) {
      try {
        const ext = file.name.split('.').pop();
        const path = `logos/doc_${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true });
        if (!error) { const { data: pub } = supabase.storage.from('assets').getPublicUrl(path); if (pub?.publicUrl) cb(pub.publicUrl); }
      } catch (e) { console.warn('[DocumentCanvasDesigner] upload failed', e); }
    }
  }

  const changePaper = (v) => {
    const preset = PAGE_PRESETS.find(p => p.v === v) || PAGE_PRESETS[0];
    pushHistory(true);
    setT(p => {
      const nw = v === 'custom' ? p.page_width : preset.w;
      const nh = v === 'custom' ? p.page_height : preset.h;
      return { ...p, paper_size: v, page_width: nw, page_height: nh, canvas: { ...p.canvas, blocks: scaleLayout(p.canvas?.blocks || [], p.page_width, nw) } };
    });
    setDirty(true);
  };

  // ── drag from palette onto canvas ──
  const dropOnCanvas = (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-dc'); if (!raw) return;
    const rect = pageRef.current?.getBoundingClientRect(); const k = zoom / 100;
    const at = rect ? { x: (e.clientX - rect.left) / k, y: (e.clientY - rect.top) / k } : null;
    try {
      const d = JSON.parse(raw);
      if (d.kind === 'block') addBlock(d.type, at);
      else if (d.kind === 'hdr') addFieldBlock(d.f, at);
      else if (d.kind === 'li') {
        const target = blocks.find(b => b.type === 'lineitems');
        if (target) addLineColumn(d.f); else addFieldBlock({ ...d.f, v: 'li:' + d.f.v }, at);
      }
    } catch { /* ignore */ }
  };
  const dragStart = (payload) => (e) => { e.dataTransfer.setData('application/x-dc', JSON.stringify(payload)); e.dataTransfer.effectAllowed = 'copy'; };

  const previewHtml = useMemo(() => showPreview ? buildDocumentHTML(t, sample.record, sample.items, { docType, preview: true }) : '', [showPreview, t, sample, docType]);

  // ─── render ───
  const filt = (list) => search.trim() ? list.filter(i => (i.l + ' ' + i.v).toLowerCase().includes(search.toLowerCase())) : list;
  const blockName = (b) => {
    const p = b.props || {};
    if (b.type === 'text') return (p.content || '').split('\n')[0].slice(0, 28) || 'Text';
    if (b.type === 'field') return p.label || hdrIndex[p.fieldKey]?.l || p.fieldKey;
    if (b.type === 'fieldgroup') return p.title || 'Field group';
    return BLOCK_TYPES.find(x => x.v === b.type)?.l || b.type;
  };

  return (
    <div className="space-y-4">
      {toast && <div className={`fixed top-5 right-5 z-[9999] px-5 py-3 rounded-2xl shadow-2xl font-semibold text-sm text-white ${toast.type === 'err' ? 'bg-red-500' : 'bg-[#0F172A]'}`}>{toast.m}</div>}

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-purple-700 rounded-[24px] p-5 text-white">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold">{dt.icon} {dt.label} Designer</h2>
            <p className="text-purple-200 text-xs mt-1 max-w-2xl">Free-form canvas — drag any standard or custom field, line-item column, total or tax split anywhere on the page. Paper sizes: A4, A5, Letter, thermal and custom. What you see prints.</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative">
              <button onClick={() => setNewMenu(v => !v)} className="bg-white/15 hover:bg-white/25 border border-white/20 px-4 py-2 rounded-xl text-sm font-semibold">+ New ▾</button>
              {newMenu && (
                <div className="absolute right-0 mt-1 w-56 bg-white text-[#0F172A] rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden text-sm">
                  <button onClick={() => startNew('a4')} className="w-full text-left px-4 py-2.5 hover:bg-purple-50">📄 Starter — A4 / full page</button>
                  <button onClick={() => startNew('thermal')} className="w-full text-left px-4 py-2.5 hover:bg-purple-50">🧾 Starter — Thermal 80mm</button>
                  <button onClick={() => startNew('blank')} className="w-full text-left px-4 py-2.5 hover:bg-purple-50">⬜ Blank canvas</button>
                  {legacy.length > 0 && <div className="border-t border-gray-100 px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase">Import classic template</div>}
                  {legacy.map(l => <button key={l.id} onClick={() => { setNewMenu(false); importLegacy(l); }} className="w-full text-left px-4 py-2 hover:bg-purple-50 truncate">↳ {l.name}</button>)}
                </div>
              )}
            </div>
            <button onClick={() => setShowPreview(true)} className="bg-white/15 hover:bg-white/25 border border-white/20 px-4 py-2 rounded-xl text-sm font-semibold">👁️ Preview</button>
            {activeId && <button onClick={duplicateTemplate} className="bg-white/15 hover:bg-white/25 border border-white/20 px-3 py-2 rounded-xl text-sm font-semibold">⧉ Duplicate</button>}
            <button onClick={save} disabled={saving} className="bg-white text-purple-900 px-5 py-2 rounded-xl text-sm font-bold shadow hover:bg-purple-50 disabled:opacity-50">{saving ? 'Saving…' : `💾 Save${dirty ? ' •' : ''}`}</button>
          </div>
        </div>
        {templates.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {templates.map(tm => (
              <div key={tm.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm border cursor-pointer font-semibold ${activeId === tm.id ? 'bg-white text-purple-900 border-white shadow' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}>
                <span onClick={() => openTemplate(tm)}>{tm.is_default ? '★ ' : ''}{tm.name}</span>
                {activeId === tm.id && !tm.is_default && <button onClick={() => setDefault(tm.id)} title="Set as default" className="opacity-60 hover:opacity-100 text-xs">☆ default</button>}
                <button onClick={() => setDelConfirm(tm.id)} className="opacity-40 hover:opacity-100 text-xs">✕</button>
              </div>
            ))}
          </div>
        )}
        {templates.length === 0 && legacy.length > 0 && (
          <div className="mt-3 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs">
            You have {legacy.length} classic template{legacy.length > 1 ? 's' : ''}. They keep printing until you save a canvas template here — use <b>+ New ▸ Import classic template</b> to carry your branding over.
          </div>
        )}
      </div>

      {delConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-[16px] p-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-red-700">Delete this template permanently?</span>
          <div className="flex gap-2">
            <button onClick={() => setDelConfirm(null)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl font-semibold text-gray-600">Cancel</button>
            <button onClick={() => del(delConfirm)} className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-xl font-bold">Delete</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr_330px] gap-4 items-start">
        {/* ── Left: palette ── */}
        <div className="space-y-3">
          <div className="bg-white rounded-[14px] border border-gray-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-3 text-xs font-bold border-b border-gray-200">
              {[['blocks', '➕ Blocks'], ['fields', '🔗 Fields'], ['layers', '☰ Layers']].map(([k, l]) => (
                <button key={k} onClick={() => setLeftTab(k)} className={`py-2 ${leftTab === k ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>{l}</button>
              ))}
            </div>
            <div className="p-3 max-h-[62vh] overflow-y-auto">
              {leftTab === 'blocks' && (
                <div className="grid grid-cols-2 gap-2">
                  {BLOCK_TYPES.map(bt => (
                    <button key={bt.v} draggable onDragStart={dragStart({ kind: 'block', type: bt.v })} onClick={() => addBlock(bt.v)}
                      className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:border-purple-300 hover:bg-purple-50 text-[11px] font-semibold text-gray-700">
                      <span className="text-lg">{bt.icon}</span>{bt.l}
                    </button>
                  ))}
                  <p className="col-span-2 text-[10px] text-gray-400 mt-1">Click to add, or drag onto the page.</p>
                </div>
              )}
              {leftTab === 'fields' && (
                <div className="space-y-3">
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fields…" style={{ colorScheme: 'light' }} className={inputCls} />
                  <p className="text-[10px] text-gray-400">Click or drag a field onto the page. Line-item fields become table columns.</p>
                  <div className="text-[10px] font-bold uppercase text-purple-700 tracking-wider">{dt.label} fields</div>
                  {hdrGroups.map(g => { const items = filt(g.items); if (!items.length) return null; return (
                    <div key={g.label}>
                      <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">{g.label}</div>
                      <div className="flex flex-col gap-1">
                        {items.map(f => <button key={f.v} draggable onDragStart={dragStart({ kind: 'hdr', f })} onClick={() => addFieldBlock(f)} title={f.v}
                          className="text-left text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50 truncate">{f.l}</button>)}
                      </div>
                    </div>); })}
                  <div className="text-[10px] font-bold uppercase text-purple-700 tracking-wider pt-2 border-t border-gray-100">Line-item columns</div>
                  {liGroups.map(g => { const items = filt(g.items); if (!items.length) return null; return (
                    <div key={'li' + g.label}>
                      <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">{g.label}</div>
                      <div className="flex flex-col gap-1">
                        {items.map(f => { const used = (lineTarget()?.props?.columns || []).some(c => c.key === f.v); return <button key={f.v} draggable onDragStart={dragStart({ kind: 'li', f })} onClick={() => addLineColumn(f)} title={used ? 'In the table — click to remove' : f.v}
                          className={`text-left text-xs px-2 py-1.5 rounded-lg border truncate ${used ? 'border-purple-400 bg-purple-50 text-purple-800 font-semibold' : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'}`}>{used ? '✓ ' : '▦ '}{f.l}{used ? '  ✕' : ''}</button>; })}
                      </div>
                    </div>); })}
                </div>
              )}
              {leftTab === 'layers' && (
                <div className="space-y-1">
                  {blocks.length === 0 && <p className="text-xs text-gray-400">No blocks yet.</p>}
                  {blocks.slice().sort((a, b) => (b.z || 0) - (a.z || 0)).map(b => (
                    <div key={b.id} onClick={() => setSelectedId(b.id)} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs cursor-pointer ${b.id === selectedId ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                      <span>{BLOCK_TYPES.find(x => x.v === b.type)?.icon}</span>
                      <span className="flex-1 truncate">{blockName(b)}</span>
                      <button onClick={e => { e.stopPropagation(); nudgeZ(b.id, 1); }} className="text-gray-400 hover:text-purple-600" title="Forward">▲</button>
                      <button onClick={e => { e.stopPropagation(); nudgeZ(b.id, -1); }} className="text-gray-400 hover:text-purple-600" title="Backward">▼</button>
                      <button onClick={e => { e.stopPropagation(); duplicateBlock(b.id); }} className="text-gray-400 hover:text-purple-600" title="Duplicate">⧉</button>
                      <button onClick={e => { e.stopPropagation(); deleteBlock(b.id); }} className="text-gray-300 hover:text-red-500" title="Delete">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Card title="Page Setup" icon="📄">
            <div><L>Template Name</L><TI value={t.name} onChange={v => { setT(p => ({ ...p, name: v })); setDirty(true); }} placeholder={`e.g. Standard ${dt.label}`} /></div>
            <div><L>Paper Size</L><SEL value={t.paper_size} onChange={changePaper} options={PAGE_PRESETS.map(p => ({ v: p.v, l: p.l }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><L>Width px</L><NUM value={t.page_width} onChange={v => { setT(p => ({ ...p, page_width: v, paper_size: 'custom' })); setDirty(true); }} min={100} /></div>
              <div><L>Height px</L><NUM value={t.page_height} onChange={v => { setT(p => ({ ...p, page_height: v, paper_size: 'custom' })); setDirty(true); }} min={100} /></div>
            </div>
            {isThermal(t.paper_size) && <p className="text-[10px] text-gray-400">Thermal: page height follows the content when printed.</p>}
            <ColorRow label="Background" value={t.background_color} onChange={v => { setT(p => ({ ...p, background_color: v })); setDirty(true); }} />
            <div><L>Default Font</L><SEL value={t.canvas?.meta?.font_family || FONTS[0].v} onChange={v => { setT(p => ({ ...p, canvas: { ...p.canvas, meta: { ...(p.canvas?.meta || {}), font_family: v } } })); setDirty(true); }} options={FONTS} /></div>
            <button onClick={() => { if (confirm('Replace the current layout with the starter layout for this paper size?')) { const st = starterTemplate(docType, t.paper_size === 'custom' ? 'A4' : t.paper_size); pushHistory(true); setT(p => ({ ...p, page_width: st.page_width, page_height: st.page_height, canvas: st.canvas })); setDirty(true); } }}
              className="w-full text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 py-1.5 rounded-lg hover:bg-gray-100">↺ Reset to starter layout</button>
          </Card>
          {activeId && (
            <div className="flex gap-2">
              <button onClick={() => setDefault(activeId)} className="flex-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 py-2 rounded-xl hover:bg-amber-100">★ Set Default</button>
              <button onClick={() => setDelConfirm(activeId)} className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 py-2 px-3 rounded-xl hover:bg-red-100">🗑</button>
            </div>
          )}
        </div>

        {/* ── Canvas ── */}
        <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm overflow-hidden min-w-0">
          <div className="bg-gradient-to-r from-[#0F172A] to-slate-700 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-white font-bold text-xs">Canvas · arrows nudge · Ctrl+D duplicate · Ctrl+Z undo · Del remove</span>
            <div className="flex items-center gap-2 text-white text-xs">
              <button onClick={undo} className="px-2 py-1 rounded-lg hover:bg-white/10" title="Undo">↶</button>
              <button onClick={redo} className="px-2 py-1 rounded-lg hover:bg-white/10" title="Redo">↷</button>
              <label className="flex items-center gap-1">Snap
                <select value={snap} onChange={e => setSnap(Number(e.target.value))} style={{ colorScheme: 'dark' }} className="bg-white/10 rounded px-1 py-0.5 text-white">
                  <option value={0} className="text-black">Off</option><option value={2} className="text-black">2px</option><option value={4} className="text-black">4px</option><option value={8} className="text-black">8px</option><option value={16} className="text-black">16px</option>
                </select></label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} />Grid</label>
              <button onClick={() => setZoom(z => Math.max(30, z - 10))} className="w-6 h-6 rounded hover:bg-white/10 text-base font-bold">−</button>
              <span className="w-9 text-center font-mono">{zoom}%</span>
              <button onClick={() => setZoom(z => Math.min(150, z + 10))} className="w-6 h-6 rounded hover:bg-white/10 text-base font-bold">+</button>
            </div>
          </div>
          <div className="p-5 overflow-auto bg-gray-100" style={{ maxHeight: '82vh' }}>
            <div style={{ width: t.page_width * (zoom / 100), height: t.page_height * (zoom / 100) }}>
              <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left', width: t.page_width, height: t.page_height }}>
                <div ref={pageRef} onClick={() => setSelectedId(null)} onDragOver={e => e.preventDefault()} onDrop={dropOnCanvas}
                  style={{ position: 'relative', width: t.page_width, height: t.page_height, background: t.background_color, boxShadow: '0 4px 24px rgba(0,0,0,.15)', fontFamily: t.canvas?.meta?.font_family || FONTS[0].v,
                    backgroundImage: showGrid ? 'linear-gradient(rgba(124,58,237,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,.10) 1px, transparent 1px)' : 'none', backgroundSize: '16px 16px' }}>
                  {blocks.map(b => (
                    <CanvasBlock key={b.id} block={b} selected={b.id === selectedId} zoom={zoom} snap={snap} onSelect={setSelectedId} onChange={updateBlock}
                      onBegin={onBegin} onEnd={onEnd} sample={sample} docType={docType} tick={0} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-100">Purple ‹placeholders› mark fields that are empty in the sample data — they print real values from the actual record. Tables grow with the number of line items and push the blocks beneath them down automatically.</div>
        </div>

        {/* ── Right: properties ── */}
        <div className="space-y-3 min-w-0">
          {!selected ? (
            <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-6 text-center text-sm text-gray-400">Select a block to edit it, or pick a field from the <b>Fields</b> tab and drop it on the page.</div>
          ) : (
            <Properties key={selected.id} b={selected} pw={pw} docType={docType} hdrGroups={hdrGroups} liGroups={liGroups} hdrIndex={hdrIndex} liIndex={liIndex}
              updateBlock={updateBlock} updateProps={updateProps} setBlocks={setBlocks} restack={restack} duplicateBlock={duplicateBlock} deleteBlock={deleteBlock}
              logoRef={logoRef} uploadImage={uploadImage} />
          )}
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-[20px] shadow-2xl flex flex-col overflow-hidden w-full max-w-5xl" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
            <div className="bg-[#0F172A] px-5 py-3 flex items-center justify-between">
              <span className="text-white font-bold text-sm">Rendered preview · sample data · exactly what prints</span>
              <div className="flex gap-2">
                <button onClick={() => { const w = window.open('', '_blank', 'width=900,height=900'); if (w) { w.document.write(buildDocumentHTML(t, sample.record, sample.items, { docType })); w.document.close(); setTimeout(() => w.print(), 500); } }} className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold">🖨️ Test print</button>
                <button onClick={() => setShowPreview(false)} className="text-white/70 hover:text-white text-xl px-2">✕</button>
              </div>
            </div>
            <div className="overflow-auto bg-gray-200 p-4 flex justify-center">
              <iframe srcDoc={previewHtml} title="Preview" style={{ width: (t.page_width || 794) + 40, height: Math.max(600, (t.page_height || 1123) + 80), border: 'none', background: 'transparent' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Properties panel ────────────────────────────────────────────────────────
function Properties({ b, pw, docType, hdrGroups, liGroups, hdrIndex, liIndex, updateBlock, updateProps, setBlocks, restack, duplicateBlock, deleteBlock, logoRef, uploadImage }) {
  const p = b.props || {};
  const set = (patch) => updateProps(b.id, patch);
  const typeInfo = BLOCK_TYPES.find(x => x.v === b.type);
  const hdrFlat = hdrGroups.flatMap(g => g.items);
  const move = (arr, i, d) => { const a = [...arr]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; };
  const font = (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div><L>Size</L><NUM value={p.fontSize} onChange={v => set({ fontSize: v })} min={6} max={96} /></div>
        <div><L>Weight</L><SEL value={String(p.fontWeight || 400)} onChange={v => set({ fontWeight: Number(v) })} options={WEIGHTS} /></div>
        <div><L>Align</L><SEL value={p.align || 'left'} onChange={v => set({ align: v })} options={ALIGNS} /></div>
        <div><L>Line height</L><NUM value={p.lineHeight ?? 1.35} step={0.05} onChange={v => set({ lineHeight: v })} min={0.8} max={3} /></div>
      </div>
      <ColorRow label="Text color" value={p.color} onChange={v => set({ color: v })} />
      <div className="grid grid-cols-3 gap-2">
        <Toggle label="Italic" checked={!!p.italic} onChange={() => set({ italic: !p.italic })} />
        <Toggle label="CAPS" checked={!!p.uppercase} onChange={() => set({ uppercase: !p.uppercase })} />
        <div><L>Spacing</L><NUM value={p.letterSpacing || 0} step={0.5} onChange={v => set({ letterSpacing: v })} min={0} max={20} /></div>
      </div>
      <div><L>Font (overrides template)</L><SEL value={p.fontFamily || ''} onChange={v => set({ fontFamily: v })} options={[{ v: '', l: '— template default —' }, ...FONTS]} /></div>
    </>
  );
  const cond = p.visibleWhen || { key: '', op: 'notempty', value: '' };

  return (
    <>
      <Card title={`${typeInfo?.icon || ''} ${typeInfo?.l || b.type} block`} icon="⚙️">
        <div className="grid grid-cols-4 gap-1.5">
          <div><L>X</L><NUM value={b.x} onChange={v => updateBlock(b.id, { x: v })} /></div>
          <div><L>Y</L><NUM value={b.y} onChange={v => updateBlock(b.id, { y: v })} /></div>
          <div><L>W</L><NUM value={b.w} onChange={v => updateBlock(b.id, { w: v })} min={10} /></div>
          <div><L>H</L><NUM value={b.h} onChange={v => updateBlock(b.id, { h: v })} min={8} /></div>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[['⇤', 'Left margin', () => updateBlock(b.id, { x: 32 })], ['↔', 'Center on page', () => updateBlock(b.id, { x: Math.round((pw - b.w) / 2) })], ['⇥', 'Right margin', () => updateBlock(b.id, { x: Math.max(0, pw - 32 - b.w) })], ['⟷', 'Full width', () => updateBlock(b.id, { x: 32, w: Math.max(40, pw - 64) })]].map(([ic, tt, fn]) =>
            <button key={tt} title={tt} onClick={fn} className="text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 py-1 rounded-lg hover:bg-gray-100">{ic}</button>)}
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => restack(b.id, 'front')} className="flex-1 text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 py-1.5 rounded-lg hover:bg-gray-100">To front</button>
          <button onClick={() => restack(b.id, 'back')} className="flex-1 text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 py-1.5 rounded-lg hover:bg-gray-100">To back</button>
          <button onClick={() => duplicateBlock(b.id)} className="flex-1 text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 py-1.5 rounded-lg hover:bg-gray-100">Duplicate</button>
        </div>
      </Card>

      {b.type === 'text' && (
        <Card title="Text" icon="🔤">
          <div><L>Content</L>
            <textarea value={p.content || ''} onChange={e => set({ content: e.target.value })} rows={4} style={{ colorScheme: 'light' }} placeholder="Static text. Insert live data with {{field}}, e.g. Thank you, {{customer}}!" className={`${inputCls} resize-y`} /></div>
          <div><L>Insert field</L>
            <FieldSelect value="" onChange={v => v && set({ content: (p.content || '') + `{{${v}}}` })} groups={hdrGroups} extra={<option value="">＋ choose a field…</option>} /></div>
          {font}
        </Card>
      )}

      {b.type === 'field' && (
        <Card title="Field" icon="🔗">
          <div><L>Data field</L>
            <FieldSelect value={p.fieldKey} onChange={v => { const f = hdrIndex[v]; set({ fieldKey: v, label: p.label && p.labelCustom ? p.label : (f?.l || p.label), format: f?.format || 'auto' }); }}
              groups={hdrGroups} extra={<optgroup label="First line item">{liGroups.flatMap(g => g.items).map(i => <option key={'li:' + i.v} value={'li:' + i.v}>First item — {i.l}</option>)}</optgroup>} /></div>
          <Toggle label="Show label" checked={p.showLabel !== false} onChange={() => set({ showLabel: p.showLabel === false })} />
          {p.showLabel !== false && <>
            <div><L>Label text</L><TI value={p.label} onChange={v => set({ label: v, labelCustom: true })} /></div>
            <ColorRow label="Label color" value={p.labelColor || '#6B7280'} onChange={v => set({ labelColor: v })} />
            <Toggle label="Colon after label" checked={p.labelColon !== false} onChange={() => set({ labelColon: p.labelColon === false })} />
          </>}
          <div><L>Format</L><SEL value={p.format || 'auto'} onChange={v => set({ format: v })} options={FORMATS} /></div>
          <div><L>Text when empty</L><TI value={p.placeholder} onChange={v => set({ placeholder: v })} placeholder="e.g. —" /></div>
          {font}
        </Card>
      )}

      {b.type === 'fieldgroup' && (
        <Card title="Field group" icon="🗂️">
          <div><L>Title</L><TI value={p.title} onChange={v => set({ title: v })} placeholder="e.g. Bill To" /></div>
          {(p.fields || []).map((f, i) => (
            <div key={f.id || i} className="border border-gray-200 rounded-lg p-2 space-y-1.5 bg-gray-50">
              <FieldSelect value={f.key} onChange={v => { const arr = [...p.fields]; arr[i] = { ...f, key: v, label: hdrIndex[v]?.l || f.label }; set({ fields: arr }); }} groups={hdrGroups} />
              <div className="flex gap-1.5 items-center">
                <input value={f.label || ''} onChange={e => { const arr = [...p.fields]; arr[i] = { ...f, label: e.target.value }; set({ fields: arr }); }} placeholder="Label" style={{ colorScheme: 'light' }} className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-1.5 py-1 text-[#0F172A] bg-white" />
                <label className="text-[10px] flex items-center gap-1"><input type="checkbox" checked={!!f.bold} onChange={() => { const arr = [...p.fields]; arr[i] = { ...f, bold: !f.bold }; set({ fields: arr }); }} />B</label>
                <button onClick={() => set({ fields: move(p.fields, i, -1) })} className="text-gray-400 hover:text-purple-600 text-xs">▲</button>
                <button onClick={() => set({ fields: move(p.fields, i, 1) })} className="text-gray-400 hover:text-purple-600 text-xs">▼</button>
                <button onClick={() => set({ fields: p.fields.filter((_, k) => k !== i) })} title="Remove" className="text-red-400 hover:text-red-600 text-sm font-bold px-1">✕ Remove</button>
              </div>
            </div>
          ))}
          <button onClick={() => set({ fields: [...(p.fields || []), { id: cid(), key: hdrFlat[0]?.v || 'customer', label: hdrFlat[0]?.l || '' }] })} className="w-full text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 py-1.5 rounded-lg hover:bg-purple-100">+ Add field</button>
          <Toggle label="Show labels" checked={p.showLabels !== false} onChange={() => set({ showLabels: p.showLabels === false })} />
          {p.showLabels !== false && <div className="grid grid-cols-2 gap-2"><div><L>Label width px</L><NUM value={p.labelWidth || 0} onChange={v => set({ labelWidth: v })} min={0} /></div><ColorRow label="Label color" value={p.labelColor || '#6B7280'} onChange={v => set({ labelColor: v })} /></div>}
          <Toggle label="Hide empty fields" checked={p.hideEmpty !== false} onChange={() => set({ hideEmpty: p.hideEmpty === false })} />
          <div className="grid grid-cols-2 gap-2"><div><L>Row gap</L><NUM value={p.gap ?? 3} onChange={v => set({ gap: v })} min={0} max={30} /></div><ColorRow label="Title color" value={p.titleColor || '#64748B'} onChange={v => set({ titleColor: v })} /></div>
          {font}
        </Card>
      )}

      {b.type === 'image' && (
        <Card title="Image" icon="🖼️">
          <div><L>Source</L><SEL value={p.source || 'upload'} onChange={v => set({ source: v })} options={[{ v: 'company_logo', l: 'Company logo (Appearance settings)' }, { v: 'upload', l: 'Upload an image' }, { v: 'field', l: 'From a field (image URL)' }]} /></div>
          {p.source === 'field' && <div><L>Image URL field</L><FieldSelect value={p.fieldKey} onChange={v => set({ fieldKey: v })} groups={hdrGroups} /></div>}
          {(p.source || 'upload') === 'upload' && <>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => uploadImage(e.target.files?.[0], src => set({ src }))} />
            <button onClick={() => logoRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-xl py-2.5 text-sm text-gray-500 hover:text-purple-600 font-semibold">{p.src ? '🔄 Change image' : '+ Upload image'}</button>
            {p.src && <div className="flex items-center gap-2"><img src={p.src} className="h-10 rounded border border-gray-200 object-contain" /><button onClick={() => set({ src: '' })} className="text-xs text-red-500">Remove</button></div>}
          </>}
          <div><L>Fit</L><SEL value={p.fit || 'contain'} onChange={v => set({ fit: v })} options={[{ v: 'contain', l: 'Contain' }, { v: 'cover', l: 'Cover' }, { v: 'fill', l: 'Stretch' }]} /></div>
        </Card>
      )}

      {b.type === 'lineitems' && (
        <Card title="Line-item table" icon="📋">
          <p className="text-[10px] text-gray-400">Any standard or custom line-item field can be a column. Set a width % (blank = auto).</p>
          {(p.columns || []).map((c, i) => (
            <div key={c.id || i} className="border border-gray-200 rounded-lg p-2 space-y-1.5 bg-gray-50">
              <FieldSelect value={c.key} onChange={v => { const arr = [...p.columns]; const f = liIndex[v]; arr[i] = { ...c, key: v, label: f?.l || c.label, format: f && f.format !== 'auto' ? f.format : undefined }; set({ columns: arr }); }} groups={liGroups} />
              <div className="flex gap-1.5 items-center">
                <input value={c.label || ''} onChange={e => { const arr = [...p.columns]; arr[i] = { ...c, label: e.target.value }; set({ columns: arr }); }} placeholder="Header" style={{ colorScheme: 'light' }} className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-1.5 py-1 text-[#0F172A] bg-white" />
                <input type="number" value={c.width || ''} onChange={e => { const arr = [...p.columns]; arr[i] = { ...c, width: e.target.value ? Number(e.target.value) : undefined }; set({ columns: arr }); }} placeholder="W%" style={{ colorScheme: 'light' }} className="w-12 text-xs border border-gray-200 rounded px-1 py-1 text-[#0F172A] bg-white" />
                <select value={c.align || ''} onChange={e => { const arr = [...p.columns]; arr[i] = { ...c, align: e.target.value || undefined }; set({ columns: arr }); }} style={{ colorScheme: 'light' }} className="w-14 text-xs border border-gray-200 rounded px-0.5 py-1 text-[#0F172A] bg-white">
                  <option value="">auto</option><option value="left">L</option><option value="center">C</option><option value="right">R</option></select>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => set({ columns: move(p.columns, i, -1) })} className="text-gray-400 hover:text-purple-600 text-xs">◀</button>
                <button onClick={() => set({ columns: move(p.columns, i, 1) })} className="text-gray-400 hover:text-purple-600 text-xs">▶</button>
                <button onClick={() => set({ columns: p.columns.filter((_, k) => k !== i) })} title="Remove" className="text-red-400 hover:text-red-600 text-sm font-bold px-1">✕ Remove</button>
              </div>
            </div>
          ))}
          <button onClick={() => { const f = liGroups[0]?.items[0]; set({ columns: [...(p.columns || []), { id: cid(), key: f?.v || 'quantity', label: f?.l || 'Qty' }] }); }} className="w-full text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 py-1.5 rounded-lg hover:bg-purple-100">+ Add column</button>
          <Toggle label="Header row" checked={p.showHeader !== false} onChange={() => set({ showHeader: p.showHeader === false })} />
          <Toggle label="Grid lines" checked={!!p.showGrid} onChange={() => set({ showGrid: !p.showGrid })} />
          <Toggle label="Alternate row shading" checked={!!p.rowAltShade} onChange={() => set({ rowAltShade: !p.rowAltShade })} />
          <Toggle label="Description under item" checked={!!p.showDescription} onChange={() => set({ showDescription: !p.showDescription })} />
          <Toggle label="Rental dates under item" checked={!!p.showRentalDates} onChange={() => set({ showRentalDates: !p.showRentalDates })} />
          <div className="grid grid-cols-3 gap-2">
            <div><L>Font</L><NUM value={p.fontSize || 12} onChange={v => set({ fontSize: v })} min={6} max={24} /></div>
            <div><L>Head font</L><NUM value={p.headerFontSize || (p.fontSize || 12) - 2} onChange={v => set({ headerFontSize: v })} min={6} max={24} /></div>
            <div><L>Padding</L><NUM value={p.cellPadding ?? 4} onChange={v => set({ cellPadding: v })} min={0} max={20} /></div>
          </div>
          <ColorRow label="Header background" value={p.headerBg} onChange={v => set({ headerBg: v })} allowClear />
          <ColorRow label="Header text" value={p.headerColor} onChange={v => set({ headerColor: v })} />
          <ColorRow label="Border color" value={p.borderColor || '#E5E7EB'} onChange={v => set({ borderColor: v })} />
          <ColorRow label="Row text" value={p.color || '#111827'} onChange={v => set({ color: v })} />
          {p.rowAltShade && <ColorRow label="Alt row color" value={p.altRowColor || '#F8FAFC'} onChange={v => set({ altRowColor: v })} />}
        </Card>
      )}

      {b.type === 'totals' && (
        <Card title="Totals box" icon="∑">
          {(p.rows || []).map((r, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-2 space-y-1.5 bg-gray-50">
              <FieldSelect value={r.key} onChange={v => { const arr = [...p.rows]; arr[i] = { ...r, key: v, label: hdrIndex[v]?.l || r.label }; set({ rows: arr }); }} groups={hdrGroups} />
              <div className="flex gap-1.5 items-center">
                <input value={r.label || ''} onChange={e => { const arr = [...p.rows]; arr[i] = { ...r, label: e.target.value }; set({ rows: arr }); }} placeholder="Label" style={{ colorScheme: 'light' }} className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-1.5 py-1 text-[#0F172A] bg-white" />
                <label className="text-[10px] flex items-center gap-0.5"><input type="checkbox" checked={!!r.bold} onChange={() => { const arr = [...p.rows]; arr[i] = { ...r, bold: !r.bold }; set({ rows: arr }); }} />B</label>
                <label className="text-[10px] flex items-center gap-0.5" title="Highlight row"><input type="checkbox" checked={!!r.accent} onChange={() => { const arr = [...p.rows]; arr[i] = { ...r, accent: !r.accent }; set({ rows: arr }); }} />★</label>
                <label className="text-[10px] flex items-center gap-0.5" title="Hide when zero"><input type="checkbox" checked={!!r.hideIfZero} onChange={() => { const arr = [...p.rows]; arr[i] = { ...r, hideIfZero: !r.hideIfZero }; set({ rows: arr }); }} />0</label>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => set({ rows: move(p.rows, i, -1) })} className="text-gray-400 hover:text-purple-600 text-xs">▲</button>
                <button onClick={() => set({ rows: move(p.rows, i, 1) })} className="text-gray-400 hover:text-purple-600 text-xs">▼</button>
                <button onClick={() => set({ rows: p.rows.filter((_, k) => k !== i) })} title="Remove" className="text-red-400 hover:text-red-600 text-sm font-bold px-1">✕ Remove</button>
              </div>
            </div>
          ))}
          <button onClick={() => set({ rows: [...(p.rows || []), { key: 'subtotal', label: 'Subtotal' }] })} className="w-full text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 py-1.5 rounded-lg hover:bg-purple-100">+ Add row</button>
          <div className="grid grid-cols-2 gap-2"><div><L>Font</L><NUM value={p.fontSize || 12} onChange={v => set({ fontSize: v })} min={6} max={40} /></div><ColorRow label="Text" value={p.color || '#111827'} onChange={v => set({ color: v })} /></div>
          <ColorRow label="Highlight background" value={p.accentBg || '#0F172A'} onChange={v => set({ accentBg: v })} />
          <ColorRow label="Highlight text" value={p.accentColor || '#FFFFFF'} onChange={v => set({ accentColor: v })} />
          <Toggle label="Row dividers" checked={!!p.rowDivider} onChange={() => set({ rowDivider: !p.rowDivider })} />
        </Card>
      )}

      {b.type === 'taxsummary' && (
        <Card title="Tax summary" icon="🧮">
          <div><L>Tax split</L><SEL value={p.mode || 'cgst_sgst'} onChange={v => set({ mode: v })} options={[{ v: 'cgst_sgst', l: 'CGST + SGST (intra-state)' }, { v: 'igst', l: 'IGST (inter-state)' }]} /></div>
          <div><L>Group by</L><SEL value={p.groupBy || 'rate'} onChange={v => set({ groupBy: v })} options={[{ v: 'rate', l: 'Tax rate' }, { v: 'hsn', l: 'HSN / SAC + rate' }]} /></div>
          <div><L>Font size</L><NUM value={p.fontSize || 10} onChange={v => set({ fontSize: v })} min={6} max={16} /></div>
          <ColorRow label="Header color" value={p.headerColor || '#64748B'} onChange={v => set({ headerColor: v })} />
          <ColorRow label="Header background" value={p.headerBg} onChange={v => set({ headerBg: v })} allowClear />
        </Card>
      )}

      {b.type === 'qr' && (
        <Card title="QR code" icon="▦">
          <div><L>QR content</L><textarea value={p.data || ''} onChange={e => set({ data: e.target.value })} rows={3} style={{ colorScheme: 'light' }} placeholder="e.g. upi://pay?pa=shop@upi&am={{balance_due}}&tn={{display_number}}" className={`${inputCls} resize-y font-mono text-xs`} /></div>
          <div><L>Insert field</L><FieldSelect value="" onChange={v => v && set({ data: (p.data || '') + `{{${v}}}` })} groups={hdrGroups} extra={<option value="">＋ choose a field…</option>} /></div>
          <div><L>Caption</L><TI value={p.caption} onChange={v => set({ caption: v })} /></div>
          <p className="text-[10px] text-gray-400">QR images are generated online when the document is rendered, so printing needs an internet connection.</p>
        </Card>
      )}

      {b.type === 'divider' && (
        <Card title="Divider" icon="➖">
          <ColorRow label="Color" value={p.color} onChange={v => set({ color: v })} />
          <div className="grid grid-cols-2 gap-2"><div><L>Thickness</L><NUM value={p.thickness || 1} onChange={v => set({ thickness: v })} min={1} max={12} /></div><div><L>Style</L><SEL value={p.style || 'solid'} onChange={v => set({ style: v })} options={[{ v: 'solid', l: 'Solid' }, { v: 'dashed', l: 'Dashed' }, { v: 'dotted', l: 'Dotted' }]} /></div></div>
        </Card>
      )}

      {b.type === 'signature' && (
        <Card title="Signature line" icon="✍️">
          <div><L>Label</L><TI value={p.label} onChange={v => set({ label: v })} /></div>
          <div className="grid grid-cols-2 gap-2"><div><L>Font</L><NUM value={p.fontSize || 11} onChange={v => set({ fontSize: v })} min={6} max={30} /></div><div><L>Align</L><SEL value={p.align || 'center'} onChange={v => set({ align: v })} options={ALIGNS} /></div></div>
          <ColorRow label="Line color" value={p.lineColor || '#111827'} onChange={v => set({ lineColor: v })} />
        </Card>
      )}

      <Card title="Appearance" icon="🎨" defaultOpen={b.type === 'rect'}>
        <ColorRow label="Background" value={p.bg ?? p.fill} onChange={v => set({ bg: v, fill: undefined })} allowClear />
        <div className="grid grid-cols-2 gap-2">
          <ColorRow label="Border color" value={p.borderColor} onChange={v => set({ borderColor: v })} />
          <div><L>Border px</L><NUM value={p.borderWidth || 0} onChange={v => set({ borderWidth: v })} min={0} max={12} /></div>
          <div><L>Corner radius</L><NUM value={p.borderRadius || 0} onChange={v => set({ borderRadius: v })} min={0} max={100} /></div>
          <div><L>Padding</L><NUM value={p.padding || 0} onChange={v => set({ padding: v })} min={0} max={60} /></div>
          <div><L>Opacity</L><NUM value={p.opacity ?? 1} step={0.1} onChange={v => set({ opacity: v })} min={0} max={1} /></div>
          <div><L>Rotate °</L><NUM value={p.rotate || 0} onChange={v => set({ rotate: v })} min={-180} max={180} /></div>
        </div>
      </Card>

      <Card title="Show only when…" icon="👁️" defaultOpen={!!p.visibleWhen}>
        <p className="text-[10px] text-gray-400">Hide this block unless a condition on the record is met — e.g. show “Balance Due” only when it is not empty.</p>
        <FieldSelect value={cond.key} onChange={v => set({ visibleWhen: v ? { ...cond, key: v } : undefined })} groups={hdrGroups} extra={<option value="">— always show —</option>} />
        {cond.key && <>
          <SEL value={cond.op} onChange={v => set({ visibleWhen: { ...cond, op: v } })} options={[{ v: 'notempty', l: 'is not empty' }, { v: 'empty', l: 'is empty' }, { v: 'eq', l: 'equals' }, { v: 'neq', l: 'does not equal' }, { v: 'gt', l: 'greater than' }, { v: 'lt', l: 'less than' }]} />
          {['eq', 'neq', 'gt', 'lt'].includes(cond.op) && <TI value={cond.value} onChange={v => set({ visibleWhen: { ...cond, value: v } })} placeholder="value" />}
        </>}
      </Card>

      <button onClick={() => deleteBlock(b.id)} className="w-full text-xs font-semibold text-red-600 bg-red-50 border border-red-200 py-2 rounded-lg hover:bg-red-100">🗑 Delete block</button>
    </>
  );
}
