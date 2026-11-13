// @ts-nocheck
'use client';
/**
 * "Scan" control for a line-item grid.
 *
 * Two ways in, same result:
 *   1. 📷 Scan opens the camera scanner (continuous: keep scanning, press Done).
 *   2. A handheld USB/Bluetooth scanner works any time the grid is on screen and editable — no click needed,
 *      even if the cursor is in another box (the scanned characters are taken back out of it).
 *
 * Each code is resolved to a product of this workspace (main barcode, pack barcode, then SKU). The grid decides how
 * the product lands on a line (onProduct); repeated scans of the same product increase its quantity.
 * Unknown or inactive codes give an error beep and a message and change nothing.
 */
import { useEffect, useRef, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import BarcodeScanner from '@/components/shared/BarcodeScanner';
import { resolveBarcode, registerScannerTarget, scanFeedback, normalizeBarcode } from '@/lib/barcode';

export default function LineScanBar({ kind = 'b2b', products = [], onProduct, readOnly = false, className = '', compact = false }) {
  const { supabase } = useTenant();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<null | { ok: boolean; warn?: boolean; message: string }>(null);
  const latest = useRef({ products, onProduct, kind });
  latest.current = { products, onProduct, kind };

  const handleCode = async (raw: string) => {
    const code = normalizeBarcode(raw);
    const { products: list, onProduct: add, kind: k } = latest.current;
    const res: any = await resolveBarcode(supabase, k, code, list);
    if (res.error === 'not_found') return { ok: false, message: `No product found for barcode ${code}` };
    if (res.error === 'inactive') return { ok: false, message: `${res.product?.name || 'This product'} is ${String(res.product?.status || 'inactive').toLowerCase()} and can't be added` };
    const p = res.product;
    add(p, res.packQty, code);
    const stock = Number(p.stock_quantity);
    const out = p.track_inventory !== false && p.stock_quantity !== undefined && p.stock_quantity !== null && !isNaN(stock) && stock <= 0;
    const pack = res.packQty > 1 ? ` (pack of ${res.packQty})` : '';
    return { ok: true, warn: out, message: `Added ${p.name}${pack}${out ? ' — out of stock' : ''}` };
  };

  // Handheld scanner: active while this grid is mounted and editable.
  useEffect(() => {
    if (readOnly) return;
    return registerScannerTarget(async (code) => {
      const r = await handleCode(code);
      scanFeedback(r.ok);
      setToast(r);
    });
  }, [readOnly]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);

  if (readOnly) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Scan barcodes with the camera. A handheld scanner works any time — just scan."
        className={className || `bg-white/15 hover:bg-white/25 text-white border border-white/30 ${compact ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-xl text-sm font-bold flex items-center gap-1.5`}>
        <span aria-hidden>📷</span> Scan
      </button>
      <BarcodeScanner open={open} onClose={() => setOpen(false)} onDetected={handleCode} mode="continuous" title="Scan items" />
      {toast && !open && (
        <div role="status" aria-live="polite"
          className={`fixed z-[250] bottom-6 left-1/2 -translate-x-1/2 max-w-[92vw] px-4 py-2.5 rounded-xl shadow-xl text-sm font-semibold ${toast.ok ? (toast.warn ? 'bg-amber-500 text-white' : 'bg-green-600 text-white') : 'bg-red-600 text-white'}`}>
          {toast.ok ? '✓ ' : '✗ '}{toast.message}
        </div>
      )}
    </>
  );
}
