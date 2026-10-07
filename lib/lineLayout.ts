// @ts-nocheck
'use client';
/**
 * Page Layout Designer support for LINE-ITEM grids (retail order/invoice, quotation, order, invoice).
 *  - `useLineLayout(lineObjectType, scope)` resolves, per column key, label / visible / read-only / order
 *    for the page the grid is rendered on ('detail' or 'create'), using the same precedence rule as every
 *    other page (Create/Detail-only row beats a Both-Pages row; redundant default rows never mask).
 *  - `createGridEnabled(rows)` — the "Show line items grid on Create page" switch (pseudo-field
 *    `__create_grid`, default OFF so existing tenants' create forms are unchanged until an admin opts in).
 *  Pure presentation + config: nothing here touches data, tenant scoping happens in useFieldLayout.
 */
import { useFieldLayout, resolveFieldRow, resolveFieldDisplay, cfKey } from './useFieldLayout';

export const CREATE_GRID_KEY = '__create_grid';
export const LINE_OBJECT_FOR_PAGE = {
  retailOrders: 'retailOrderLineItems', retailInvoices: 'retailInvoiceLineItems',
  quotations: 'quotationLineItems', orders: 'orderLineItems', invoices: 'invoiceLineItems',
};

export function createGridEnabled(rows) {
  const list = (rows || []).filter(r => r.field_key === CREATE_GRID_KEY && r.is_published !== false);
  const own = list.find(r => r.page_scope === 'create');
  const both = list.find(r => r.page_scope === 'both' || !r.page_scope);
  const row = own || both;
  return !!row && row.visibility_mode === 'visible';
}

export function useLineLayout(lineObjectType, scope = 'detail') {
  const layout = useFieldLayout(lineObjectType);
  const rows = layout.fields || [];
  const col = (key, defLabel, values = {}) => {
    const r = resolveFieldDisplay(key, defLabel, rows, values, scope);
    const row = resolveFieldRow(key, rows, scope);
    return { key, label: r.label, visible: r.visible, readOnly: !r.editable, order: row ? row.display_order : null };
  };
  // Custom (App Composer) line-item fields: label / hidden / read-only / order via cf_ keys.
  const customCols = (customFields) => (customFields || [])
    .filter(f => !f.show_on || f.show_on === 'both' || f.show_on === (scope === 'create' ? 'create' : 'detail'))
    .map((f, i) => { const c = col(cfKey(f.api_name), f.label); return { ...f, label: c.label, _visible: c.visible, _readOnly: c.readOnly, _order: c.order ?? 10000 + (f.sort_order || i) }; })
    .filter(f => f._visible)
    .sort((a, b) => a._order - b._order);
  // Sort an array of column defs ({key,...}) by designer order, keeping original order for unconfigured ones.
  const orderCols = (defs) => defs
    .map((d, i) => ({ d, o: d.order ?? (d.layout?.order ?? i) }))
    .sort((a, b) => a.o - b.o).map(x => x.d);
  return { rows, loading: layout.loading, col, customCols, orderCols, createEnabled: createGridEnabled(rows) };
}
