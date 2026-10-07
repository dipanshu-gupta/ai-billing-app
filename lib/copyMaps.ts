// @ts-nocheck
/**
 * Copy Maps registry — the single list of "things that can be copied" so the
 * admin panel (what the admin can pick) and the runtime (what actually gets
 * applied) can never drift apart.
 *
 *  - Conversions: a header record becomes another header record
 *    (Order → Invoice, Lead → Opportunity, ...). A conversion may also carry
 *    line items (`lineSource` → `lineTarget`); line copy maps use rule_type
 *    'record_conversion_line'.
 *  - Product → Line Item: selecting a product in a grid copies its fields
 *    onto the line item (rule_type 'product_to_line_item').
 *
 * All rules live in field_mapping_rules, which is tenant-isolated (SQL 46).
 */

export type CopyConversion = {
  v: string;            // conversion_context stored on the rule
  label: string;
  group: 'Retail' | 'CRM / B2B';
  source: string;       // header object keys (same keys as the Page Layout Designer)
  target: string;
  lineSource?: string;  // line-item object keys (same keys as the Page Layout Designer)
  lineTarget?: string;
};

export const COPY_CONVERSIONS: CopyConversion[] = [
  { v: 'retailOrder_to_retailInvoice', label: 'Retail Order → Retail Invoice', group: 'Retail', source: 'retailOrders',   target: 'retailInvoices', lineSource: 'retailOrderLineItems',   lineTarget: 'retailInvoiceLineItems' },
  { v: 'retailInvoice_to_retailOrder', label: 'Retail Invoice → Booking (Order)', group: 'Retail', source: 'retailInvoices', target: 'retailOrders',   lineSource: 'retailInvoiceLineItems', lineTarget: 'retailOrderLineItems' },
  { v: 'lead_to_opportunity',          label: 'Lead → Opportunity',           group: 'CRM / B2B', source: 'leads',         target: 'opportunities' },
  { v: 'opportunity_to_quotation',     label: 'Opportunity → Quotation',      group: 'CRM / B2B', source: 'opportunities', target: 'quotations' },
  { v: 'opportunity_to_order',         label: 'Opportunity → Order',          group: 'CRM / B2B', source: 'opportunities', target: 'orders' },
  { v: 'quotation_to_order',           label: 'Quotation → Order',            group: 'CRM / B2B', source: 'quotations',    target: 'orders',   lineSource: 'quotationLineItems', lineTarget: 'orderLineItems' },
  { v: 'order_to_invoice',             label: 'Order → Invoice',              group: 'CRM / B2B', source: 'orders',        target: 'invoices', lineSource: 'orderLineItems',     lineTarget: 'invoiceLineItems' },
];

export type ProductLineTarget = { v: string; label: string; group: 'Retail' | 'CRM / B2B'; productObject: string; lineObject: string };
export const PRODUCT_LINE_TARGETS: ProductLineTarget[] = [
  { v: 'retailOrderLineItems',   label: 'Retail Order Line Items',   group: 'Retail',    productObject: 'retailProducts', lineObject: 'retailOrderLineItems' },
  { v: 'retailInvoiceLineItems', label: 'Retail Invoice Line Items', group: 'Retail',    productObject: 'retailProducts', lineObject: 'retailInvoiceLineItems' },
  { v: 'quotationLineItems',     label: 'Quotation Line Items',      group: 'CRM / B2B', productObject: 'products',       lineObject: 'quotationLineItems' },
  { v: 'orderLineItems',         label: 'Order Line Items',          group: 'CRM / B2B', productObject: 'products',       lineObject: 'orderLineItems' },
  { v: 'invoiceLineItems',       label: 'Invoice Line Items',        group: 'CRM / B2B', productObject: 'products',       lineObject: 'invoiceLineItems' },
];

// Older rules stored a table name (or nothing meaningful) as the target.
// They keep working: a legacy retail rule applies to both retail grids.
const LEGACY_LINE_ALIASES: Record<string, string[]> = {
  retail_order_line_items:   ['retailOrderLineItems', 'retailInvoiceLineItems'],
  retail_invoice_line_items: ['retailInvoiceLineItems'],
  order_line_items:          ['orderLineItems'],
  invoice_line_items:        ['invoiceLineItems'],
  quotation_line_items:      ['quotationLineItems'],
};
export function ruleTargetsLine(rule: any, lineObject?: string) {
  if (!lineObject) return true;
  const t = rule?.target_object;
  if (!t) return true;
  if (t === lineObject) return true;
  const alias = LEGACY_LINE_ALIASES[t];
  if (alias) return alias.includes(lineObject);
  return false;
}

export const conversionByKey = (v: string) => COPY_CONVERSIONS.find(c => c.v === v);

// getObjectFields() only lists the few columns shown on CRM forms. These are the
// other real database columns of the B2B documents (confirmed against the insert
// payloads in AppContext), so a copy map can read or fill any of them.
const T = (k: string, label: string, type = 'text') => ({ key: k, label, type });
const DOC_COMMON = [
  T('currency', 'Currency'), T('billing_address', 'Billing Address'), T('shipping_address', 'Shipping Address'),
  T('payment_terms', 'Payment Terms'), T('subtotal', 'Subtotal', 'number'), T('total_discount', 'Total Discount', 'number'),
  T('total_tax', 'Total Tax', 'number'), T('overall_discount', 'Overall Discount %', 'number'), T('shipping_cost', 'Shipping Cost', 'number'),
];
export const EXTRA_STANDARD_FIELDS: Record<string, { key: string; label: string; type: string }[]> = {
  quotations: [T('name', 'Name'), T('customer', 'Customer'), T('contact', 'Contact'), T('status', 'Status'), T('version', 'Version', 'number'),
    T('validity_date', 'Validity Date', 'date'), T('grand_total', 'Grand Total', 'number'), ...DOC_COMMON],
  orders:     [T('notes', 'Notes'), T('delivery_date', 'Delivery Date', 'date'), ...DOC_COMMON],
  invoices:   [T('notes', 'Notes'), T('due_date', 'Due Date', 'date'), ...DOC_COMMON],
  opportunities: [T('billing_address', 'Billing Address'), T('shipping_address', 'Shipping Address'), T('currency', 'Currency'), T('payment_terms', 'Payment Terms')],
  leads:      [T('billing_address', 'Billing Address'), T('shipping_address', 'Shipping Address'), T('expected_close_date', 'Expected Close Date', 'date')],
};
export const LINE_EXTRA_FIELDS: Record<string, { key: string; label: string; type: string }[]> = {
  quotationLineItems: [T('product_code', 'Product Code'), T('description', 'Description'), T('list_price', 'List Price', 'number')],
  orderLineItems:     [T('product_code', 'Product Code'), T('description', 'Description'), T('list_price', 'List Price', 'number')],
  invoiceLineItems:   [T('product_code', 'Product Code'), T('description', 'Description'), T('list_price', 'List Price', 'number')],
};
