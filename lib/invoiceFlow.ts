// @ts-nocheck
/**
 * Per-tenant "Order -> Invoice" flow (Admin > App Preferences > Orders & Invoices).
 *   status  - the Create Invoice action appears once the order reaches a trigger status (default: Completed)
 *   always  - the action is available on any order that is not cancelled / refunded
 *   auto    - the invoice is created automatically the moment the order reaches a trigger status
 *             (the action stays available as a fallback)
 *   off     - no conversion; invoices are created on their own
 */
export const INVOICE_FLOW_MODES = [
  { v: 'status', l: 'Button at a chosen status', d: 'Staff see "Create Invoice" once the order reaches the status you pick.' },
  { v: 'always', l: 'Button on any open order', d: 'Create an invoice at any point (not for cancelled / refunded orders).' },
  { v: 'auto',   l: 'Create automatically', d: 'The invoice is raised the moment the order reaches the status you pick.' },
  { v: 'off',    l: 'Not used', d: 'No order-to-invoice conversion. Invoices are created independently.' },
];

export function canInvoiceOrder(prefs: any, status: string): boolean {
  const mode = prefs?.invoice_flow_mode || 'status';
  const triggers = prefs?.invoice_trigger_statuses?.length ? prefs.invoice_trigger_statuses : ['Completed'];
  if (mode === 'off') return false;
  if (mode === 'always') return !['Cancelled', 'Refunded'].includes(status);
  return triggers.includes(status);
}
