// @ts-nocheck
'use client';
/**
 * Product "Barcode" field: type it, scan it with a handheld scanner (it just types into the box), or tap 📷 to use
 * the camera. Warns straight away when the code already belongs to another product in this workspace, or when a
 * typed EAN/UPC has a wrong check digit. On a saved product it also manages extra barcodes with a pack quantity
 * (e.g. the carton barcode that adds 12).
 */
import { useEffect, useRef, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useApp } from '@/context/AppContext';
import { useAlert } from '@/components/shared/AlertProvider';
import BarcodeScanner from '@/components/shared/BarcodeScanner';
import {
  normalizeBarcode, gtinCheckOk, findBarcodeOwner, fetchProductBarcodes, invalidateBarcodeCache, barcodeVariants,
} from '@/lib/barcode';

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';

export function useBarcodeOwnerCheck(kind, code, productId) {
  const { supabase } = useTenant();
  const [owner, setOwner] = useState(null);
  useEffect(() => {
    const c = normalizeBarcode(code);
    if (!c || c.length < 3) { setOwner(null); return; }
    let on = true;
    const t = setTimeout(async () => {
      try { const o = await findBarcodeOwner(supabase, kind, c, productId); if (on) setOwner(o); } catch { if (on) setOwner(null); }
    }, 350);
    return () => { on = false; clearTimeout(t); };
  }, [code, productId, kind, supabase]);
  return owner;
}

export default function BarcodeField({ value, onChange, kind = 'b2b', productId = null, readOnly = false, showExtras = true }) {
  const [scan, setScan] = useState(false);
  const code = normalizeBarcode(value);
  const owner = useBarcodeOwnerCheck(kind, code, productId);
  const badCheck = code && !gtinCheckOk(code);
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2" data-barcode-input>
        <input value={value || ''} disabled={readOnly} autoComplete="off" inputMode="text"
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); /* a scanner ends with Enter: never submit the form */ }}
          onBlur={e => { const n = normalizeBarcode(e.target.value); if (n !== (value || '')) onChange(n); }}
          placeholder="Scan or type the barcode" className={`${iCls} font-mono ${owner ? 'border-red-400' : ''}`} />
        {!readOnly && (
          <button type="button" onClick={() => setScan(true)} title="Scan with camera"
            className="px-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-bold hover:bg-blue-100 whitespace-nowrap">📷 Scan</button>
        )}
      </div>
      {owner && <p className="text-xs text-red-600">This barcode is already used by “{owner.productName}”{owner.where !== 'main' ? ` (${owner.where})` : ''}. Each barcode can belong to one product only.</p>}
      {!owner && badCheck && <p className="text-xs text-amber-600">The last digit doesn’t match an EAN/UPC check digit — please double-check the number.</p>}
      <BarcodeScanner open={scan} onClose={() => setScan(false)} mode="single" title="Scan product barcode"
        onDetected={async (c) => { onChange(c); return { ok: true, message: c }; }} />
      {showExtras && productId && <ExtraBarcodes kind={kind} productId={productId} readOnly={readOnly} mainCode={code} />}
    </div>
  );
}

/** Extra barcodes (pack sizes) of a saved product. Saved immediately — they don't wait for the form's Save. */
function ExtraBarcodes({ kind, productId, readOnly: lockedByForm, mainCode }) {
  const { supabase, tenant } = useTenant();
  const { hasPermission } = useApp();
  // Pack barcodes save straight away, so they follow the product Edit permission themselves.
  const readOnly = lockedByForm || (hasPermission ? !hasPermission(kind === 'b2c' ? 'retailProducts_edit' : 'products_edit') : false);
  const { showAlert, showConfirm } = useAlert();
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState({ barcode: '', pack_qty: 12, label: '' });
  const [scan, setScan] = useState(false);
  const [saving, setSaving] = useState(false);
  const owner = useBarcodeOwnerCheck(kind, draft.barcode, productId);

  const load = async () => { setRows(await fetchProductBarcodes(supabase, kind, String(productId))); setLoaded(true); };
  useEffect(() => { load(); }, [productId, kind]);

  const add = async () => {
    const bc = normalizeBarcode(draft.barcode);
    const qty = Number(draft.pack_qty);
    if (!bc) { showAlert('Enter or scan a barcode first.', { variant: 'warning' }); return; }
    if (!(qty > 0)) { showAlert('Pack quantity must be more than 0.', { variant: 'warning' }); return; }
    if (barcodeVariants(bc).includes(mainCode) || rows.some(r => barcodeVariants(bc).includes(r.barcode))) { showAlert('This product already has that barcode.', { variant: 'warning' }); return; }
    const other = await findBarcodeOwner(supabase, kind, bc, productId);
    if (other) { showAlert(`That barcode already belongs to “${other.productName}”.`, { variant: 'warning' }); return; }
    setSaving(true);
    const tid = tenant?.id || (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null);
    const { error } = await supabase.from('product_barcodes').insert([{
      ...(tid ? { tenant_id: tid } : {}),
      product_type: kind, product_id: String(productId), barcode: bc, pack_qty: qty, label: draft.label.trim() || null,
    }]);
    setSaving(false);
    if (error) {
      showAlert(/unique|duplicate/i.test(error.message) ? 'That barcode is already used in this workspace.' : /product_barcodes/.test(error.message) && /exist/.test(error.message) ? 'Pack barcodes need a one-time database update (sql/57). Ask your administrator.' : 'Could not add the barcode: ' + error.message, { variant: 'danger' });
      return;
    }
    invalidateBarcodeCache();
    setDraft({ barcode: '', pack_qty: 12, label: '' });
    load();
  };
  const remove = async (r) => {
    const ok = await showConfirm(`Remove barcode ${r.barcode} (pack of ${r.pack_qty})?`, { title: 'Remove barcode', variant: 'danger', confirmLabel: 'Remove' });
    if (!ok) return;
    const { error } = await supabase.from('product_barcodes').delete().eq('id', r.id);
    if (error) { showAlert('Could not remove the barcode: ' + error.message, { variant: 'danger' }); return; }
    invalidateBarcodeCache();
    load();
  };

  if (!loaded) return null;
  if (readOnly && !rows.length) return null;
  return (
    <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-2">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pack barcodes</div>
      {rows.length === 0 && <p className="text-xs text-gray-500">Add a barcode for a box or carton — scanning it adds the whole pack quantity.</p>}
      {rows.map(r => (
        <div key={r.id} className="flex items-center gap-2 text-sm bg-white rounded-lg px-3 py-1.5 border border-blue-100">
          <span className="font-mono flex-1 truncate">{r.barcode}</span>
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">× {Number(r.pack_qty)}</span>
          {r.label && <span className="text-xs text-gray-500 truncate max-w-[120px]">{r.label}</span>}
          {!readOnly && <button type="button" onClick={() => remove(r)} className="w-6 h-6 rounded-full bg-red-50 text-red-500 text-xs font-bold hover:bg-red-100" aria-label={`Remove ${r.barcode}`}>✕</button>}
        </div>
      ))}
      {!readOnly && (
        <div className="space-y-1">
          <div className="grid grid-cols-12 gap-2" data-barcode-input>
            <input value={draft.barcode} onChange={e => setDraft(d => ({ ...d, barcode: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              placeholder="Pack barcode" className="col-span-5 border border-blue-200 rounded-lg px-2 py-2 text-sm font-mono bg-white" />
            <input type="number" min={1} step="any" value={draft.pack_qty} onChange={e => setDraft(d => ({ ...d, pack_qty: e.target.value }))}
              title="Quantity one scan adds" className="col-span-2 border border-blue-200 rounded-lg px-2 py-2 text-sm bg-white" />
            <input value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} placeholder="Label (optional)"
              className="col-span-3 border border-blue-200 rounded-lg px-2 py-2 text-sm bg-white" />
            <div className="col-span-2 flex gap-1">
              <button type="button" onClick={() => setScan(true)} className="flex-1 rounded-lg border border-blue-200 bg-white text-sm" title="Scan with camera">📷</button>
              <button type="button" onClick={add} disabled={saving} className="flex-1 rounded-lg bg-[#0F172A] text-white text-sm font-bold disabled:opacity-40">+</button>
            </div>
          </div>
          {owner && <p className="text-xs text-red-600">Already used by “{owner.productName}”.</p>}
        </div>
      )}
      <BarcodeScanner open={scan} onClose={() => setScan(false)} mode="single" title="Scan pack barcode"
        onDetected={async (c) => { setDraft(d => ({ ...d, barcode: c })); return { ok: true, message: c }; }} />
    </div>
  );
}
