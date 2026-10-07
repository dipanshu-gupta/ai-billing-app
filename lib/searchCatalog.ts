// @ts-nocheck
'use client';
/**
 * Search catalog for the Redwood smart search bar: every filterable thing on an object —
 *   • standard fields (the page's own field meta)
 *   • custom fields (app_custom_fields, stored in custom_data)
 *   • line-item fields of the object's line grid (standard + custom) — "has a line where …"
 * Fully data-driven, so new custom fields / layout labels appear with no code change, per tenant.
 */
import { useMemo } from 'react';
import { useCustomFields } from '@/lib/useCustomFields';
import { tenantScope } from '@/lib/utils';

// Header page -> its line-item grid (table + keys). Columns verified against the live schema.
export const LINE_SEARCH_SOURCES: Record<string, { objType: string; table: string; fk: string; parentColumn: string; keys: string[] }> = {
  orders:        { objType: 'orderLineItems',         table: 'order_line_items',          fk: 'order_number',       parentColumn: 'order_number',       keys: ['product_name', 'quantity', 'price', 'discount', 'tax_pct'] },
  invoices:      { objType: 'invoiceLineItems',       table: 'invoice_line_items',        fk: 'invoice_number',     parentColumn: 'invoice_number',     keys: ['product_name', 'quantity', 'price', 'discount', 'tax_pct'] },
  quotations:    { objType: 'quotationLineItems',     table: 'quotation_line_items',      fk: 'quote_number',       parentColumn: 'quote_number',       keys: ['product_name', 'quantity', 'unit_price', 'discount_pct', 'tax_pct'] },
  leads:         { objType: 'leadLineItems',          table: 'lead_line_items',           fk: 'lead_number',        parentColumn: 'lead_number',        keys: ['product_name', 'quantity', 'price', 'discount'] },
  opportunities: { objType: 'opportunityLineItems',   table: 'opportunity_line_items',    fk: 'opportunity_number', parentColumn: 'opportunity_number', keys: ['product_name', 'quantity', 'price', 'discount'] },
  retailOrders:  { objType: 'retailOrderLineItems',   table: 'retail_order_line_items',   fk: 'order_number',       parentColumn: 'order_number',       keys: ['product_name', 'quantity', 'unit_price', 'discount_pct', 'tax_pct'] },
  retailInvoices:{ objType: 'retailInvoiceLineItems', table: 'retail_invoice_line_items', fk: 'invoice_number',     parentColumn: 'invoice_number',     keys: ['product_name', 'quantity', 'unit_price', 'discount_pct', 'tax_pct'] },
};
// Labels kept local (importing the Designer here would create an import cycle with the list pages).
const LINE_LABELS: Record<string, string> = { product_name: 'Product', quantity: 'Quantity', price: 'Price', unit_price: 'Unit Price', discount: 'Discount', discount_pct: 'Discount %', tax_pct: 'Tax %' };

const cfType = (t: string) => ({ number: 'number', currency: 'number', date: 'date', datetime: 'date', checkbox: 'boolean', single_select: 'select' } as any)[t] || 'text';

export function useSearchCatalog({ baseMeta, headerObjType, page }: { baseMeta: any[]; headerObjType?: string; page?: string }) {
  const { fields: headerCf } = useCustomFields(headerObjType || '__none__');
  const lineSrc = page ? LINE_SEARCH_SOURCES[page] : null;
  const { fields: lineCf } = useCustomFields(lineSrc?.objType || '__none__');

  return useMemo(() => {
    const out: any[] = [];
    const seen = new Set<string>();
    (baseMeta || []).forEach(m => {
      if (!m || m.key === 'id' || seen.has(m.key)) return;
      seen.add(m.key);
      out.push({ ...m, group: 'Fields' });
    });
    if (headerObjType) (headerCf || []).forEach(f => {
      out.push({ key: `cf_${f.api_name}`, label: f.label, type: cfType(f.field_type), opts: f.options || [], group: 'Custom fields', column: `custom_data->>${f.api_name}` });
    });
    if (lineSrc) {
      const list = lineSrc.keys.map(k => ({ key: k, label: LINE_LABELS[k] || k, type: k === 'product_name' ? 'text' : 'number' }));
      const line = { table: lineSrc.table, fk: lineSrc.fk, parentColumn: lineSrc.parentColumn };
      list.forEach(f => out.push({ key: `line.${f.key}`, label: f.label, type: f.type === 'select' ? 'text' : f.type, group: 'Line items', scope: 'line', column: f.key, line }));
      (lineCf || []).forEach(f => out.push({ key: `line.cf_${f.api_name}`, label: f.label, type: cfType(f.field_type), opts: f.options || [], group: 'Line items', scope: 'line', column: `custom_data->>${f.api_name}`, line }));
    }
    return out;
  }, [baseMeta, headerCf, lineCf, headerObjType, page]);
}

/** Distinct values of a column (or jsonb path) for the value picker — tenant scoped, capped. */
export async function distinctValues(supabase: any, { table, column, q = '', extraEq = null, limit = 200 }: any) {
  if (!supabase || !table || !column) return [];
  let query = tenantScope(supabase.from(table).select(`v:${column}`));
  if (extraEq) for (const [k, v] of Object.entries(extraEq)) query = query.eq(k, v);
  query = query.not(column, 'is', null);
  if (q) query = query.ilike(column, `%${String(q).replace(/[%,]/g, '')}%`);
  const { data, error } = await query.limit(limit);
  if (error) return [];
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];
  (data || []).forEach(r => { const v = r.v; if (v === null || v === undefined || v === '') return; const s = String(v); if (!seen.has(s)) { seen.add(s); out.push({ value: s, label: s }); } });
  return out.sort((a, b) => a.label.localeCompare(b.label)).slice(0, 50);
}
