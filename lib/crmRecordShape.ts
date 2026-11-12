// @ts-nocheck
/** B2B/B2C database row -> the shape the record screens use (record number as id, camelCase aliases on CRM objects). */
export const CRM_KEYS: Record<string, string> = {
  customers: 'customer_number', contacts: 'contact_number', leads: 'lead_number', opportunities: 'opportunity_number',
  orders: 'order_number', invoices: 'invoice_number', activities: 'activity_number', products: 'product_number', quotations: 'quote_number',
  retailCustomers: 'customer_number', retailProducts: 'product_number', retailOrders: 'order_number', retailInvoices: 'invoice_number', retailActivities: 'activity_number',
};
export function toCrmRecord(page: string, r: any) {
  if (!r) return r;
  if (page === 'quotations') return { ...r, customerId: r.customer_id, displayNumber: r.display_number };
  const key = CRM_KEYS[page];
  const base = { ...r, id: (key && r[key]) || r.id, _uuid: r.id, displayNumber: r.display_number };
  if (String(page).startsWith('retail')) return base;
  return { ...base, customerId: r.customer_id, contactId: r.contact_id, primaryContactId: r.primary_contact_id, primaryContact: r.primary_contact,
    isPrimary: r.is_primary, billingAddress: r.billing_address, shippingAddress: r.shipping_address, postalCode: r.postal_code, gstNumber: r.gst_number,
    linkedIn: r.linked_in, productFamily: r.product_family, taxRate: r.tax_rate, expectedCloseDate: r.expected_close_date, closeDate: r.close_date,
    paymentTerms: r.payment_terms, deliveryDate: r.delivery_date, dueDate: r.due_date, activityType: r.activity_type, activityDate: r.activity_date };
}
