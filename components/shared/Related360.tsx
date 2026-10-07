// @ts-nocheck
'use client';
/**
 * Shared helpers that keep every Customer 360 / Lead 360 / ... related list
 * aligned with what the tenant admin configured:
 *
 *   - Page Layout Designer: a related-list column whose field is hidden in the
 *     layout for that object is hidden here too, and a relabelled field shows
 *     its custom label (field_layout_config, tenant-scoped through useFieldLayout).
 *   - Custom fields (app_custom_fields): published custom fields of the child
 *     object appear as extra columns automatically (values live in custom_data).
 *   - Permissions / data security: a tab whose object the user cannot view is
 *     dropped, and rows are filtered through applyDataSecurity.
 *   - Custom objects: lookups to the parent show up as related lists
 *     (CustomRelatedLists), including from the retail Customer 360.
 *
 * Nothing here is hard-wired to a tenant: every read goes through hooks that
 * already scope by tenant (useFieldLayout / useCustomFields / useTenant).
 */
import { useFieldLayout, resolveFieldRow } from '@/lib/useFieldLayout';
import { useCustomFields } from '@/lib/useCustomFields';
import { formatCurrency, formatDate } from '@/lib/utils';

export function formatCustomValue(v: any, f: any) {
  if (v === undefined || v === null || v === '') return '-';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '-';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const t = f?.field_type;
  if (t === 'currency') return formatCurrency(Number(v) || 0);
  if (t === 'date') { try { return formatDate(v); } catch { return String(v); } }
  return String(v);
}

/** Returns the effective columns for a related list of `page`. `cols` are the built-in defaults:
 *  [{ k?: fieldKey, h: header, v: renderer }]. */
export function useRelatedCols(page: string, cols: any[], max = 3) {
  const layout = useFieldLayout(page);
  const { fields: customFields } = useCustomFields(page);
  const rows = layout?.fields || [];
  const out: any[] = [];
  for (const c of cols || []) {
    if (!c.k) { out.push(c); continue; }
    const row = resolveFieldRow(c.k, rows, 'detail');
    if (row && row.visibility_mode === 'hidden') continue;
    out.push(row?.custom_label ? { ...c, h: row.custom_label } : c);
  }
  const have = new Set(out.map(c => c.h));
  const extra = (customFields || [])
    .filter(f => f.show_on !== 'create' && f.field_type !== 'long_text' && f.field_type !== 'textarea')
    .filter(f => { const row = resolveFieldRow('custom:' + f.api_name, rows, 'detail'); return !(row && row.visibility_mode === 'hidden'); })
    .slice(0, max)
    .map(f => {
      const row = resolveFieldRow('custom:' + f.api_name, rows, 'detail');
      return { h: row?.custom_label || f.label, v: r => formatCustomValue((r.custom_data || r.customData || {})[f.api_name], f) };
    })
    .filter(c => !have.has(c.h));
  // keep the Status pill last
  const statusIdx = out.findIndex(c => c.k === 'status' || c.h === 'Status');
  if (statusIdx >= 0 && extra.length) { const st = out.splice(statusIdx, 1)[0]; return [...out, ...extra, st]; }
  return [...out, ...extra];
}

/** Render-prop wrapper so class-less table renderers can use the hook per active tab. */
export function DynCols({ page, cols, children }) {
  const eff = useRelatedCols(page, cols);
  return children(eff);
}

/** Add an inferred field key (k) to simple `{h, v}` column defs, from the first `r.<prop>` the renderer touches. */
export function withKeys(cols: any[]) {
  return (cols || []).map(c => {
    if (c.k) return c;
    const src = String(c.v);
    const pm = /^\(?\s*([A-Za-z_$][\w$]*)/.exec(src);
    if (!pm) return c;
    const esc = pm[1].replace(/\$/g, '\\$');
    const m = new RegExp('(?:^|[^\\w$.])' + esc + '\\.([A-Za-z_][A-Za-z0-9_]*)').exec(src.slice(pm[0].length));
    return m && m[1] !== 'custom_data' ? { ...c, k: m[1] } : c;
  });
}

/** Permission code for viewing an object's related list. */
export function viewPermFor(page: string) {
  if (page.startsWith('retail')) {
    const m = { retailCustomers: 'retail_customers_view', retailProducts: 'retail_products_view', retailActivities: 'retail_activities_view', retailOrders: 'retail_orders_view', retailInvoices: 'retail_invoices_view' };
    return m[page] || `${page}_view`;
  }
  return `${page}_view`;
}
