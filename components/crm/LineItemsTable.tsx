// @ts-nocheck
'use client';

import { useApp } from '@/context/AppContext';
import { formatCurrency } from '@/lib/utils';
import type { LineItem } from '@/lib/types';

interface Props {
  lineItems: LineItem[];
  setLineItems: (items: LineItem[]) => void;
  products: any[];
  readOnly?: boolean;
}

export default function LineItemsTable({ lineItems, setLineItems, products, readOnly }: Props) {
  const addItem = () => {
    setLineItems([...lineItems, { id: Date.now(), product: '', quantity: 1, price: 0 }]);
  };

  const update = (index: number, field: keyof LineItem, value: any) => {
    const updated = lineItems.map((item, i) => {
      if (i !== index) return item;
      if (field === 'product') {
        const prod = products.find(p => p.name === value);
        return { ...item, product: value, price: prod?.price ?? item.price };
      }
      return { ...item, [field]: field === 'quantity' || field === 'price' ? Number(value) : value };
    });
    setLineItems(updated);
  };

  const remove = (index: number) => setLineItems(lineItems.filter((_, i) => i !== index));

  const total = lineItems.reduce((sum, item) => sum + item.quantity * item.price, 0);

  return (
    <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 text-white flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg">Line Items</h3>
          <p className="text-blue-300 text-xs mt-0.5">Products / services included in this record</p>
        </div>
        {!readOnly && (
          <button
            onClick={addItem}
            className="bg-white text-[#0F172A] px-4 py-2 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-all"
          >
            + Add Item
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-blue-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase text-gray-500 w-[40%]">Product / Service</th>
              <th className="px-5 py-3 text-center text-xs font-bold uppercase text-gray-500 w-24">Qty</th>
              <th className="px-5 py-3 text-right text-xs font-bold uppercase text-gray-500 w-32">Unit Price</th>
              <th className="px-5 py-3 text-right text-xs font-bold uppercase text-gray-500 w-32">Total</th>
              {!readOnly && <th className="px-5 py-3 w-16" />}
            </tr>
          </thead>
          <tbody>
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 4 : 5} className="px-5 py-8 text-center text-gray-400 text-sm">
                  {readOnly ? 'No line items.' : 'No items yet. Click "+ Add Item" to add products.'}
                </td>
              </tr>
            ) : (
              lineItems.map((item, i) => (
                <tr key={item.id} className="border-t border-blue-50">
                  <td className="px-5 py-3">
                    {readOnly ? (
                      <span className="text-sm font-medium text-[#0F172A]">{item.product || '—'}</span>
                    ) : (
                      <select
                        value={item.product}
                        onChange={e => update(i, 'product', e.target.value)}
                        className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        <option value="">Select product</option>
                        {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {readOnly ? (
                      <span className="block text-center text-sm text-[#0F172A]">{item.quantity}</span>
                    ) : (
                      <input
                        type="number" min={1} value={item.quantity}
                        onChange={e => update(i, 'quantity', e.target.value)}
                        className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm text-center text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {readOnly ? (
                      <span className="block text-right text-sm text-[#0F172A]">{formatCurrency(item.price)}</span>
                    ) : (
                      <input
                        type="number" min={0} value={item.price}
                        onChange={e => update(i, 'price', e.target.value)}
                        className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm text-right text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-[#0F172A] text-sm">
                    {formatCurrency(item.quantity * item.price)}
                  </td>
                  {!readOnly && (
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => remove(i)}
                        className="w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 text-red-600 text-sm flex items-center justify-center transition-all"
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {lineItems.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-blue-200 bg-blue-50">
                <td colSpan={readOnly ? 3 : 4} className="px-5 py-4 text-right font-bold text-[#0F172A]">Grand Total</td>
                <td className={`px-5 py-4 text-right font-bold text-xl text-[#0F172A] ${!readOnly ? 'pr-16' : ''}`}>
                  {formatCurrency(total)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
