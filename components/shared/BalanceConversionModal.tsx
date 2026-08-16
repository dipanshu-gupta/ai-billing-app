// @ts-nocheck
'use client';
import { useState, useMemo } from 'react';

// Shared "balance conversion" modal used for both:
//   - Quotation → Order (partial fulfillment): items = quotation_line_items,
//     doneField = 'ordered_qty'
//   - Order → Invoice (partial invoicing): items = order_line_items,
//     doneField = 'invoiced_qty'
//
// Shows each line item's total qty, how much has already been converted, the
// remaining balance, and lets the user pick how much to convert now (defaults
// to full remaining balance for every line — one click reproduces the old
// "convert everything" behavior).
export default function BalanceConversionModal({
  open, onClose, onConfirm,
  title, confirmLabel, confirmClass,
  items, doneField, priceField = 'price', currency = 'INR',
  submitting = false,
}) {
  const rows = useMemo(() => (items || []).map(i => {
    const qty = Number(i.quantity || 0);
    const already = Number(i[doneField] || 0);
    const remaining = Math.max(0, qty - already);
    return { ...i, qty, already, remaining };
  }), [items, doneField]);

  const [qtyByRow, setQtyByRow] = useState(() =>
    Object.fromEntries(rows.map(r => [r.id, r.remaining]))
  );

  if (!open) return null;

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style:'currency', currency, maximumFractionDigits:2 }).format(n||0);
  const setQty = (id, v, max) => setQtyByRow(p => ({ ...p, [id]: Math.max(0, Math.min(Number(v)||0, max)) }));
  const selectAllRemaining = () => setQtyByRow(Object.fromEntries(rows.map(r => [r.id, r.remaining])));
  const selectNone = () => setQtyByRow(Object.fromEntries(rows.map(r => [r.id, 0])));

  const totalSelected = rows.reduce((s, r) => s + (Number(qtyByRow[r.id]) || 0) * Number(r[priceField] || 0), 0);
  const anySelected = rows.some(r => (Number(qtyByRow[r.id]) || 0) > 0);
  const eligibleRows = rows.filter(r => r.remaining > 0);

  const handleConfirm = () => {
    const selections = rows
      .filter(r => (Number(qtyByRow[r.id]) || 0) > 0)
      .map(r => ({ _id: r.id, qty: Number(qtyByRow[r.id]) }));
    onConfirm(selections);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-8 py-6 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-xl font-bold text-[#0F172A]">{title}</h3>
          <p className="text-gray-500 text-sm mt-2 leading-relaxed">
            Choose how much of each line item to convert now. Defaults to the full remaining balance — adjust any row to convert only part of it.
          </p>
        </div>

        <div className="px-8 py-4 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <span className="text-xs text-gray-400">{eligibleRows.length} of {rows.length} line item{rows.length!==1?'s':''} have a remaining balance</span>
          <div className="flex gap-2">
            <button onClick={selectAllRemaining} className="text-xs font-semibold text-blue-600 hover:underline">Select all remaining</button>
            <span className="text-gray-300">·</span>
            <button onClick={selectNone} className="text-xs font-semibold text-gray-400 hover:underline">Clear</button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-8 py-4">
          {eligibleRows.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">All line items are already fully converted — nothing left to convert.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                  <th className="pb-2">Item</th>
                  <th className="pb-2 text-right">Total Qty</th>
                  <th className="pb-2 text-right">Already Done</th>
                  <th className="pb-2 text-right">Remaining</th>
                  <th className="pb-2 text-right w-28">Qty Now</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className={`border-t border-gray-100 ${r.remaining<=0?'opacity-40':''}`}>
                    <td className="py-2.5 pr-2">
                      <div className="font-semibold text-[#0F172A]">{r.product_name || '-'}</div>
                      {r.product_code && <div className="text-xs text-gray-400 font-mono">{r.product_code}</div>}
                    </td>
                    <td className="py-2.5 text-right text-gray-600">{r.qty}</td>
                    <td className="py-2.5 text-right text-gray-400">{r.already}</td>
                    <td className="py-2.5 text-right font-semibold text-[#0F172A]">{r.remaining}</td>
                    <td className="py-2.5 text-right">
                      <input
                        type="number" min={0} max={r.remaining} step="any"
                        value={qtyByRow[r.id] ?? 0}
                        onChange={e => setQty(r.id, e.target.value, r.remaining)}
                        disabled={r.remaining <= 0}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-300"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-8 py-5 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div className="text-sm">
            <span className="text-gray-500">Selected value: </span>
            <span className="font-bold text-[#0F172A]">{fmt(totalSelected)}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
            <button
              onClick={handleConfirm}
              disabled={!anySelected || submitting}
              className={`px-6 py-2.5 rounded-2xl text-sm font-bold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${confirmClass || 'bg-gradient-to-r from-[#0F172A] to-blue-800'}`}
            >
              {submitting ? 'Working…' : (confirmLabel || 'Confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
