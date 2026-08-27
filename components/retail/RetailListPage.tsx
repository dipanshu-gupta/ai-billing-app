// @ts-nocheck
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { getStatusColor, formatCurrency, formatDate, formatDisplayNumber, PAGE_DISPLAY_PREFIX, tenantScope, todayLocalISO } from '@/lib/utils';
// useCustomFields hook used inline below
import { useTenant } from '@/context/TenantContext';
import { getTaxRegime } from '@/lib/taxConfig';
import SearchableSelect from '@/components/shared/SearchableSelect';
import ProductImages from '@/components/products/ProductImages';
import RentalBookingCalendar from '@/components/retail/RentalBookingCalendar';
import KanbanBoard from '@/components/shared/KanbanBoard';
import { useAlert } from '@/components/shared/AlertProvider';
import { useCustomFields } from '@/lib/useCustomFields';
import LineItemCustomFieldInput from '@/components/shared/LineItemCustomFieldInput';
import { t } from '@/lib/i18n';

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';
const sCls = iCls;
const tCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none';

const COUNTRIES = ['India','United States','United Kingdom','United Arab Emirates','Singapore','Australia','Canada','Germany','France','Other'];

// ─── Per-object configuration ──────────────────────────────────────────────

// ─── Field Validators ────────────────────────────────────────────────────────
const VALIDATORS = {
  tel: (v) => {
    if (!v) return null;
    const digits = v.replace(/[\s\-\+\(\)]/g,'');
    if (!/^\d+$/.test(digits)) return 'Phone must contain digits only';
    if (digits.length < 7) return 'Phone number too short (min 7 digits)';
    if (digits.length > 15) return 'Phone number too long (max 15 digits)';
    return null;
  },
  email: (v) => {
    if (!v) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Invalid email format';
    return null;
  },
  postal_code: (v) => {
    if (!v) return null;
    if (!/^[A-Z0-9\s\-]{3,10}$/i.test(v)) return 'Invalid postal code (3-10 alphanumeric chars)';
    return null;
  },
  hsn_code: (v) => {
    if (!v) return null;
    if (!/^\d{4,8}$/.test(v)) return 'HSN/SAC code must be 4-8 digits';
    return null;
  },
  barcode: (v) => {
    if (!v) return null;
    if (!/^[\d\-A-Z]{4,20}$/i.test(v)) return 'Barcode must be 4-20 alphanumeric characters';
    return null;
  },
  gstin: (v) => {
    if (!v) return null;
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v))
      return 'Invalid GSTIN format (e.g. 27AAPFU0939F1ZV)';
    return null;
  },
  date_past: (v) => {
    if (!v) return null;
    if (new Date(v) > new Date()) return 'Date cannot be in the future';
    return null;
  },
  date_of_birth: (v) => {
    if (!v) return null;
    const d = new Date(v);
    if (d > new Date()) return 'Date of birth cannot be in the future';
    if (d.getFullYear() < 1900) return 'Please enter a valid date of birth';
    return null;
  },
  date_reasonable: (v) => {
    if (!v) return null;
    const d = new Date(v);
    const max = new Date(); max.setFullYear(max.getFullYear() + 2);
    if (d > max) return 'Date is too far in the future (max 2 years ahead)';
    if (d.getFullYear() < 2000) return 'Please enter a valid date';
    return null;
  },
  name_text: (v) => {
    if (!v) return null;
    if (/^[\d\s.,-]+$/.test(String(v).trim())) return 'Cannot be only numbers';
    return null;
  },
  percent: (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    if (isNaN(n) || n < 0 || n > 100) return 'Value must be between 0 and 100';
    return null;
  },
};

// Map field keys to their validator
const FIELD_VALIDATORS: Record<string, (v:any)=>string|null> = {
  name:             VALIDATORS.name_text,
  customer:         VALIDATORS.name_text,
  brand:            VALIDATORS.name_text,
  category:         VALIDATORS.name_text,
  city:             VALIDATORS.name_text,
  state:            VALIDATORS.name_text,
  date_of_birth:    VALIDATORS.date_of_birth,
  order_date:       VALIDATORS.date_reasonable,
  invoice_date:     VALIDATORS.date_reasonable,
  activity_date:    VALIDATORS.date_reasonable,
  due_date:         VALIDATORS.date_reasonable,
  delivery_date:    VALIDATORS.date_reasonable,
  phone:            VALIDATORS.tel,
  customer_phone:   VALIDATORS.tel,
  mobile:           VALIDATORS.tel,
  whatsapp:         VALIDATORS.tel,
  email:            VALIDATORS.email,
  postal_code:      VALIDATORS.postal_code,
  zip_code:         VALIDATORS.postal_code,
  hsn_code:         VALIDATORS.hsn_code,
  barcode:          VALIDATORS.barcode,
  customer_gstin:   VALIDATORS.gstin,
  gstin:            VALIDATORS.gstin,
  gst_rate:         VALIDATORS.percent,
  vat_rate:         VALIDATORS.percent,
  tax_rate:         VALIDATORS.percent,
  discount_pct:     VALIDATORS.percent,
  date_of_birth:    VALIDATORS.date_past,
};

export const RETAIL_CONFIG = {
  retailCustomers: {
    title: 'Retail Customers', icon: '🧑‍🤝‍🧑', singular: 'Customer',
    idField: 'customer_number',
    statusOptions: ['Active','Inactive','VIP','Blocked'],
    listColumns: [
      { h: 'Name', v: r => r.name },
      { h: 'Phone', v: r => r.phone || '-' },
      { h: 'Email', v: r => r.email || '-' },
      { h: 'Loyalty Tier', v: r => r.loyalty_tier || 'Standard' },
      { h: 'Points', v: r => r.loyalty_points || 0, align:'right' },
    ],
    searchFields: ['name','phone','email','customer_number'],
    sections: [
      { icon:'🧑', title:'Customer Details', fields:[
        { key:'name', label:'Full Name', type:'text', required:true },
        { key:'phone', label:'Phone', type:'tel' },
        { key:'email', label:'Email', type:'email' },
        { key:'date_of_birth', label:'Date of Birth', type:'date' },
        { key:'gender', label:'Gender', type:'select', opts:['Male','Female','Other','Prefer not to say'] },
        { key:'status', label:'Status', type:'status' },
      ]},
      { icon:'📍', title:'Address & Contact', fields:[
        { key:'address_line1', label:'Address Line 1', type:'text' },
        { key:'address_line2', label:'Address Line 2', type:'text' },
        { key:'city', label:'City', type:'text' },
        { key:'state', label:'State', type:'text' },
        { key:'postal_code', label:'Postal Code', type:'text' },
        { key:'country', label:'Country', type:'select', opts:COUNTRIES },
      ]},
      { icon:'🎁', title:'Loyalty & Preferences', fields:[
        { key:'loyalty_points', label:'Loyalty Points', type:'number' },
        { key:'loyalty_tier', label:'Loyalty Tier', type:'select', opts:['Standard','Silver','Gold','Platinum'] },
        { key:'preferred_contact', label:'Preferred Contact', type:'select', opts:['Phone','Email','SMS','WhatsApp'] },
        { key:'marketing_opt_in', label:'Marketing Opt-in', type:'checkbox' },
        { key:'owner', label:'Owner', type:'owner' },
        { key:'notes', label:'Notes', type:'textarea', full:true },
      ]},
    ],
  },

  retailProducts: {
    title: 'Retail Products', icon: '🏷️', singular: 'Product',
    idField: 'product_number',
    statusOptions: ['Active','Inactive','Discontinued'],
    listColumns: [
      { h: 'Name', v: r => r.name },
      { h: 'Category', v: r => r.category || '-' },
      { h: 'SKU', v: r => r.sku || '-' },
      { h: 'Price', v: r => formatCurrency(r.price||0), align:'right' },
      { h: 'Stock', v: r => r.stock_quantity ?? 0, align:'right' },
    ],
    searchFields: ['name','sku','barcode','category','product_number'],
    sections: [
      { icon:'🏷️', title:'Product Details', fields:[
        { key:'name', label:'Product Name', type:'text', required:true },
        { key:'category', label:'Category', type:'text' },
        { key:'brand', label:'Brand', type:'text' },
        { key:'sku', label:'SKU', type:'text' },
        { key:'barcode', label:'Barcode', type:'text' },
        { key:'unit', label:'Unit', type:'select', opts:['pc','kg','g','ltr','ml','box','pack','dozen'] },
        { key:'status', label:'Status', type:'status' },
        { key:'owner', label:'Owner', type:'owner' },
      ]},
      { icon:'💰', title:'Pricing & Inventory', fields:[
        { key:'price', label:'Selling Price', type:'number' },
        { key:'mrp', label:'MRP', type:'number' },
        { key:'cost', label:'Cost Price', type:'number' },
        { key:'stock_quantity', label:'Stock Quantity', type:'number' },
        { key:'reorder_level', label:'Reorder Level', type:'number' },
        { key:'is_rentable', label:'Rentable Item', type:'checkbox', showIf:(prefs)=>prefs?.business_type==='rental',
          desc:'Bookable for a date range — enables the availability calendar and prevents double-booking for this product.' },
      ]},
      { icon:'🧾', title:'Tax & Description', fields:[
        { key:'hsn_code', label:'HSN/SAC Code', type:'text' },
        { key:'gst_rate', label:'GST Rate (%)', type:'number' },
        { key:'taxable', label:'Taxable', type:'checkbox' },
        { key:'description', label:'Description', type:'textarea', full:true },
        { key:'comments', label:'Comments', type:'textarea', full:true },
      ]},
    ],
  },

  retailActivities: {
    title: 'Retail Activities', icon: '📅', singular: 'Activity',
    idField: 'activity_number',
    statusOptions: ['Open','In Progress','Completed','Cancelled'],
    listColumns: [
      { h: 'Subject', v: r => r.subject },
      { h: 'Type', v: r => r.activity_type || '-' },
      { h: 'Customer', v: r => r.customer || '-' },
      { h: 'Date', v: r => r.activity_date || '-' },
      { h: 'Priority', v: r => r.priority || 'Medium' },
    ],
    searchFields: ['subject','customer','activity_number'],
    sections: [
      { icon:'📅', title:'Activity Details', fields:[
        { key:'subject', label:'Subject', type:'text', required:true },
        { key:'activity_type', label:'Type', type:'select', opts:['Visit','Call','WhatsApp','Complaint','Feedback','Service'] },
        { key:'customer_id', label:'Customer', type:'retailCustomer', required:true },
        { key:'activity_date', label:'Activity Date', type:'date' },
        { key:'due_date', label:'Due Date', type:'date' },
        { key:'priority', label:'Priority', type:'select', opts:['Low','Medium','High','Critical'] },
        { key:'status', label:'Status', type:'status' },
        { key:'owner', label:'Owner', type:'owner' },
      ]},
      { icon:'📋', title:'Description & Outcome', fields:[
        { key:'description', label:'Description', type:'textarea', full:true },
        { key:'outcome', label:'Outcome', type:'textarea', full:true },
        { key:'follow_up_date', label:'Follow-up Date', type:'date' },
      ]},
      { icon:'💬', title:'Notes & Comments', fields:[
        { key:'notes', label:'Notes', type:'textarea', full:true },
        { key:'comments', label:'Comments', type:'textarea', full:true },
      ]},
    ],
  },

  retailOrders: {
    title: 'Retail Orders', icon: '🛍️', singular: 'Order',
    idField: 'order_number',
    statusOptions: ['Draft','Pending','Completed','Cancelled','Refunded'],
    hasLineItems: true,
    listColumns: [

      { h: 'Customer', v: r => r.customer || '-' },
      { h: 'Channel', v: r => r.channel || '-' },
      { h: 'Date', v: r => r.order_date || '-' },
      { h: 'Total', v: r => formatCurrency(r.amount||0), align:'right' },
    ],
    searchFields: ['order_number','customer','customer_phone'],
    sections: [
      { icon:'🛍️', title:'Order Details', fields:[
        { key:'customer_id', label:'Customer', type:'retailCustomer', required:true },
        { key:'customer_phone', label:'Customer Phone', type:'tel' },
        { key:'order_date', label:'Order Date', type:'date' },
        { key:'channel', label:'Channel', type:'select', opts:['In-Store','Online','Phone','WhatsApp'] },
        { key:'currency', label:'Currency', type:'select', opts:['INR','USD','GBP','EUR','AED','SGD'] },
        { key:'status', label:'Status', type:'status' },
        { key:'owner', label:'Owner', type:'owner' },
      ]},
      { icon:'💳', title:'Payment & Tax', fields:[
        { key:'payment_method', label:'Payment Method', type:'select', opts:['Cash','Card','UPI','Net Banking','Wallet','COD'] },
        { key:'payment_status', label:'Payment Status', type:'select', opts:['Paid','Pending','Partially Paid','Refunded'] },
        { key:'place_of_supply', label:'Place of Supply (State)', type:'select', opts:['Maharashtra','Delhi','Karnataka','Tamil Nadu','Gujarat','Rajasthan','Uttar Pradesh','West Bengal','Telangana','Kerala','Punjab','Haryana','Bihar','Odisha','Madhya Pradesh','Other'] },
        { key:'customer_gstin', label:'Customer GSTIN', type:'text' },
      ]},
      { icon:'🚚', title:'Delivery & Notes', fields:[
        { key:'delivery_method', label:'Delivery Method', type:'select', opts:['Pickup','Home Delivery','Courier'] },
        { key:'delivery_date', label:'Delivery Date', type:'date' },
        { key:'delivery_address', label:'Delivery Address', type:'textarea', full:true },
        { key:'notes', label:'Notes', type:'textarea', full:true },
        { key:'comments', label:'Comments', type:'textarea', full:true },
      ]},
    ],
  },

  retailInvoices: {
    title: 'Retail Invoices', icon: '🧾', singular: 'Invoice',
    idField: 'invoice_number',
    statusOptions: ['Draft','Sent','Paid','Overdue','Refunded','Cancelled'],
    hasLineItems: true,
    listColumns: [

      { h: 'Customer', v: r => r.customer || '-' },
      { h: 'Order #', v: r => r.order_number || '-', mono:true },
      { h: 'Date', v: r => r.invoice_date || '-' },
      { h: 'Total', v: r => formatCurrency(r.amount||0), align:'right' },
    ],
    searchFields: ['invoice_number','customer','order_number'],
    sections: [
      { icon:'🧾', title:'Invoice Details', fields:[
        { key:'customer_id', label:'Customer', type:'retailCustomer', required:true },
        { key:'customer_phone', label:'Customer Phone', type:'tel' },
        { key:'invoice_date', label:'Invoice Date', type:'date' },
        { key:'due_date', label:'Due Date', type:'date' },
        { key:'order_number', label:'Linked Order #', type:'orderRef', readOnly:true },
        { key:'currency', label:'Currency', type:'select', opts:['INR','USD','GBP','EUR','AED','SGD'] },
        { key:'status', label:'Status', type:'status' },
        { key:'invoice_template_id', label:'Invoice Template', type:'retailInvoiceTemplate' },
      ]},
      { icon:'💳', title:'Payment & Owner', fields:[
        { key:'payment_method', label:'Payment Method', type:'select', opts:['Cash','Card','UPI','Net Banking','Wallet','COD'] },
        { key:'payment_status', label:'Payment Status', type:'select', opts:['Paid','Pending','Partially Paid','Refunded'] },
        { key:'place_of_supply', label:'Place of Supply (State)', type:'select', opts:['Maharashtra','Delhi','Karnataka','Tamil Nadu','Gujarat','Rajasthan','Uttar Pradesh','West Bengal','Telangana','Kerala','Punjab','Haryana','Bihar','Odisha','Madhya Pradesh','Other'] },
        { key:'customer_gstin', label:'Customer GSTIN', type:'text' },
        { key:'owner', label:'Owner', type:'owner' },
      ]},
      { icon:'💬', title:'Notes & Comments', fields:[
        { key:'notes', label:'Notes', type:'textarea', full:true },
        { key:'comments', label:'Comments', type:'textarea', full:true },
      ]},
    ],
  },
};

const DEFAULT_PLACE_OF_SUPPLY = 'Tamil Nadu';

// Every field defined in a page's form sections is filterable/sortable/
// addable as a list column — this reuses the same registry the detail-panel
// forms already use (RETAIL_CONFIG[page].sections), so it's always in sync
// with what's actually on the record, not a separately-maintained subset.
const mapRetailFieldType = (f) => {
  if (f.type === 'number')   return 'number';
  if (f.type === 'date')     return 'date';
  if (f.type === 'status')   return 'select';
  if (f.type === 'select' && f.opts?.length) return 'select';
  if (f.type === 'checkbox') return 'boolean';
  return 'text';
};
export const getRetailFieldMeta = (page) => {
  const cfg = RETAIL_CONFIG[page]; if (!cfg) return [];
  const seen = new Set();
  const fields = [{ key:'id', label:'Record #', type:'text' }];
  cfg.sections.forEach(sec => sec.fields.forEach(f => {
    if (seen.has(f.key)) return; seen.add(f.key);
    // customer_id is a foreign key (UUID) — not directly displayable, sortable,
    // or filterable in any meaningful way. Point "Customer" at the resolved
    // name field computed in the main component instead, so every downstream
    // use (column display, sort, filter) works with the actual customer name.
    if (f.type === 'retailCustomer') {
      fields.push({ key:'customer_name_resolved', label:f.label, type:'text' });
      return;
    }
    fields.push({ key:f.key, label:f.label, type: mapRetailFieldType(f), opts: f.opts });
  }));
  // Orders/Invoices totals are computed from line items on save, not a form
  // field, but they're a genuinely useful filter/sort/column — add synthetically.
  if (['retailOrders','retailInvoices'].includes(page) && !seen.has('amount')) {
    fields.push({ key:'amount', label:'Total', type:'number' });
  }
  fields.push({ key:'created_at', label:'Created Date', type:'date' });
  return fields;
};
// Default visible columns per page — matches each page's original listColumns
// (as field keys) so the out-of-the-box view looks the same as before.
const RETAIL_DEFAULT_COLUMNS = {
  retailCustomers:  ['id','name','phone','email','loyalty_tier','loyalty_points','status'],
  retailProducts:   ['id','name','category','sku','price','stock_quantity','status'],
  retailActivities: ['id','subject','activity_type','customer_name_resolved','activity_date','priority','status'],
  retailOrders:     ['id','customer_name_resolved','channel','order_date','amount','status'],
  retailInvoices:   ['id','customer_name_resolved','order_number','invoice_date','amount','status'],
};
const RETAIL_OPERATORS = {
  text:    [{v:'contains',l:'contains'},{v:'equals',l:'is exactly'},{v:'not_equals',l:'is not'},{v:'is_empty',l:'is empty'},{v:'is_not_empty',l:'is not empty'}],
  number:  [{v:'eq',l:'='},{v:'neq',l:'≠'},{v:'gt',l:'>'},{v:'gte',l:'≥'},{v:'lt',l:'<'},{v:'lte',l:'≤'},{v:'is_empty',l:'is empty'}],
  date:    [{v:'on',l:'on'},{v:'before',l:'before'},{v:'after',l:'after'},{v:'is_empty',l:'is empty'}],
  select:  [{v:'equals',l:'is'},{v:'not_equals',l:'is not'}],
  boolean: [{v:'is_true',l:'is true'},{v:'is_false',l:'is false'}],
};
// Human-readable operator text — used when describing a saved search in
// plain English instead of showing raw operator codes like 'gte'.
const retailOperatorLabel = (op) => {
  for (const list of Object.values(RETAIL_OPERATORS)) {
    const found = (list as any[]).find(o => o.v === op);
    if (found) return found.l;
  }
  return op;
};
const retailMatchesCondition = (record, cond) => {
  const raw = record[cond.field];
  switch (cond.type) {
    case 'number': {
      const n = Number(raw); const v = Number(cond.value);
      if (cond.op==='is_empty') return raw===''||raw==null;
      if (Number.isNaN(n)) return false;
      if (cond.op==='eq') return n===v; if (cond.op==='neq') return n!==v;
      if (cond.op==='gt') return n>v;   if (cond.op==='gte') return n>=v;
      if (cond.op==='lt') return n<v;   if (cond.op==='lte') return n<=v;
      return true;
    }
    case 'date': {
      if (cond.op==='is_empty') return !raw;
      if (!raw || !cond.value) return false;
      const d = new Date(String(raw).slice(0,10)).setHours(0,0,0,0); const v = new Date(cond.value).setHours(0,0,0,0);
      if (cond.op==='on') return d===v; if (cond.op==='before') return d<v; if (cond.op==='after') return d>v;
      return true;
    }
    case 'boolean': { const b = !!raw; return cond.op==='is_true' ? b : !b; }
    default: {
      const s = String(raw??'').toLowerCase(); const v = String(cond.value??'').toLowerCase();
      if (cond.op==='is_empty') return s==='';
      if (cond.op==='is_not_empty') return s!=='';
      if (cond.op==='equals') return s===v;
      if (cond.op==='not_equals') return s!==v;
      return s.includes(v);
    }
  }
};

// Build the customer-derived portion of an order/invoice prefill from a customer record.
// Only fills fields that actually have data on the customer — fields with nothing to
// prefill are left out entirely so they stay blank/editable rather than forced to ''.
function buildCustomerPrefill(customer) {
  const prefill = {
    customer: customer?.name || '',
    customer_id: customer?._uuid || customer?.id || '',
  };
  if (customer?.phone) prefill.customer_phone = customer.phone;
  const addressParts = [customer?.address_line1, customer?.address_line2, customer?.city, customer?.state, customer?.postal_code]
    .filter(Boolean);
  if (addressParts.length) prefill.delivery_address = addressParts.join(', ');
  prefill.place_of_supply = customer?.state || DEFAULT_PLACE_OF_SUPPLY;
  return prefill;
}

// ─── Line items table (Orders / Invoices) ──────────────────────────────────
function RetailLineItems({ items, setItems, products, taxRegime, page }) {
  const [stockWarning, setStockWarning] = useState(null);
  const [rentalWarnings, setRentalWarnings] = useState<Record<number,string>>({});
  const { appPreferences, checkRentalConflict } = useApp();
  const rentalModeOn = appPreferences?.business_type === 'rental' && page === 'retailOrders';
  // Rental dates should be VISIBLE on an invoice converted from a rental
  // order (read-only, for reference — the order already secured the
  // booking, so invoices don't get editing or conflict-checking), even
  // though rentalModeOn itself stays scoped to orders for those behaviors.
  const showRentalColumns = appPreferences?.business_type === 'rental' && (page === 'retailOrders' || page === 'retailInvoices');
  const { fields: customFields } = useCustomFields(page === 'retailInvoices' ? 'retailInvoiceLineItems' : 'retailOrderLineItems');
  const updCustom = (idx, apiName, val) => setItems(p => p.map((r,i) => i!==idx ? r : { ...r, custom_data: { ...(r.custom_data||{}), [apiName]: val } }));

  // Filter out discontinued products from the product picker
  const activeProducts = products.filter(p => p.status !== 'Discontinued');

  const add = () => setItems(p => [...p, {
    _id: Date.now(), product_name:'', product_id:null, description:'', quantity:1, unit_price:0, list_price:0, discount_pct:0,
    extended_price:0, custom_data:{}, rental_start_date:'', rental_end_date:'',
    ...(taxRegime.regime==='india_gst' ? { hsn_code:'', gst_rate:18 } : {}),
    ...(taxRegime.regime==='us_sales_tax' ? { taxable:'Yes', sales_tax_rate:0 } : {}),
    ...(taxRegime.regime==='uk_vat' ? { vat_rate:20 } : {}),
    ...(taxRegime.regime==='generic' ? { tax_pct:0 } : {}),
  }]);
  const remove = (idx) => {
    setStockWarning(null);
    setRentalWarnings(w => { const n = { ...w }; delete n[idx]; return n; });
    setItems(p => p.filter((_,i)=>i!==idx));
  };

  // Live conflict check — debounced per-row so rapid date typing doesn't
  // hammer the database with a query on every keystroke. Purely advisory in
  // the UI (the real guarantee is the server-side check at save time plus
  // the database's own exclusion constraint) — this just gives fast, honest
  // feedback before the user even attempts to save.
  const conflictCheckTimers = useRef<Record<number, any>>({});
  const runConflictCheck = (idx: number, row: any) => {
    if (!rentalModeOn) return;
    if (conflictCheckTimers.current[idx]) clearTimeout(conflictCheckTimers.current[idx]);
    if (!row.product_id || !row.rental_start_date || !row.rental_end_date) {
      setRentalWarnings(w => { const n = { ...w }; delete n[idx]; return n; });
      return;
    }
    if (row.rental_end_date < row.rental_start_date) {
      setRentalWarnings(w => ({ ...w, [idx]: 'End date must be on or after the start date.' }));
      return;
    }
    const todayISO = new Date().toLocaleDateString('en-CA');
    if (row.rental_start_date < todayISO) {
      setRentalWarnings(w => ({ ...w, [idx]: 'Start date is in the past.' }));
      return;
    }
    conflictCheckTimers.current[idx] = setTimeout(async () => {
      const { conflict, withOrder, unresolved } = await checkRentalConflict(row.product_id, row.rental_start_date, row.rental_end_date, row.order_number || undefined);
      setRentalWarnings(w => ({
        ...w,
        ...(conflict
          ? { [idx]: unresolved ? 'Could not verify availability — will be checked again on save.' : `Already booked by order ${withOrder} for an overlapping date range.` }
          : (() => { const n = { ...w }; delete n[idx]; return n; })()),
      }));
    }, 400);
  };

  const upd = (idx, field, val) => {
    // Compute stock warning OUTSIDE setItems to avoid setState-in-render error
    if (field === 'product_name') {
      const pr = activeProducts.find(x => x.name === val);
      if (pr) {
        const stock   = Number(pr.stock_quantity ?? 0);
        const reorder = Number(pr.reorder_level ?? 10);
        if (stock === 0) {
          setStockWarning({ product: pr.name, type: 'out', stock });
        } else if (stock <= reorder) {
          setStockWarning({ product: pr.name, type: 'low', stock, reorder });
        } else {
          setStockWarning(null);
        }
      } else {
        setStockWarning(null);
      }
    }

    let updatedRow: any = null;
    setItems(p => p.map((r, i) => {
      if (i !== idx) return r;
      const numFields = ['quantity','unit_price','list_price','discount_pct','gst_rate','sales_tax_rate','vat_rate','tax_pct'];
      const u = { ...r, [field]: numFields.includes(field) ? Number(val) : val };
      if (field === 'product_name') {
        const pr = activeProducts.find(x => x.name === val);
        if (pr) {
          u.unit_price = pr.price; u.list_price = pr.price; u.product_code = pr.sku || '';
          u.product_id = pr._uuid || pr.id || null;
          // Switching away from a rentable product (or to a non-rentable
          // one) clears any stale booking dates rather than silently
          // carrying them onto an item they no longer apply to.
          if (!pr.is_rentable) { u.rental_start_date = ''; u.rental_end_date = ''; }
          if (taxRegime.regime==='india_gst') { u.hsn_code = pr.hsn_code || ''; u.gst_rate = pr.gst_rate ?? 18; }
          if (taxRegime.regime==='us_sales_tax') { u.taxable = pr.taxable || 'Yes'; }
          if (taxRegime.regime==='uk_vat') { u.vat_rate = pr.vat_rate ?? 20; }
          if (taxRegime.regime==='generic') { u.tax_pct = pr.tax_rate ?? 0; }
        } else {
          u.product_id = null;
        }
      }
      const { totalTax } = taxRegime.computeLineTax(u);
      const net = u.quantity * u.unit_price * (1 - u.discount_pct/100);
      u.extended_price = net + totalTax;
      updatedRow = u;
      return u;
    }));
    // Runs AFTER setItems, not inside its updater — setState updater
    // functions must be pure (React may invoke them more than once
    // internally), so triggering a second setState (via runConflictCheck ->
    // setRentalWarnings) from inside this one violates that and is exactly
    // what caused "Cannot update a component while rendering a different
    // component."
    if (rentalModeOn && updatedRow && ['product_name','rental_start_date','rental_end_date'].includes(field)) {
      runConflictCheck(idx, updatedRow);
    }
  };

  const subtotal  = items.reduce((s,i) => s + i.quantity*i.unit_price, 0);
  const totalDisc = items.reduce((s,i) => s + i.quantity*i.unit_price*i.discount_pct/100, 0);
  const totalTax  = items.reduce((s,i) => s + taxRegime.computeLineTax(i).totalTax, 0);
  const grandTotal = subtotal - totalDisc + totalTax;

  const taxCols = taxRegime.lineItemFields;

  return (
    <div className="bg-white rounded-[20px] border border-blue-100 shadow">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3.5 flex items-center justify-between rounded-t-[20px]">
        <div>
          <h3 className="text-white font-bold text-sm">Line Items</h3>
          <p className="text-blue-300 text-xs mt-0.5">Products · Pricing · {taxRegime.shortLabel}</p>
        </div>
        <button type="button" onClick={add}
          className="bg-white text-[#0F172A] px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50 transition-all">
          + Add Item
        </button>
      </div>

      {/* Stock warning banner */}
      {stockWarning && (
        <div className={`px-5 py-3 flex items-center gap-3 text-sm border-b ${
          stockWarning.type === 'out'
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          <span className="text-lg">{stockWarning.type === 'out' ? '🚫' : '⚠️'}</span>
          <span className="font-semibold">
            {stockWarning.type === 'out'
              ? `"${stockWarning.product}" is out of stock (0 units available)`
              : `"${stockWarning.product}" is low on stock — only ${stockWarning.stock} units remaining (reorder level: ${stockWarning.reorder})`
            }
          </span>
          <button onClick={() => setStockWarning(null)} className="ml-auto text-lg leading-none opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth:'700px' }}>
          <thead>
            <tr className="bg-blue-50 border-b border-blue-100">
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider" style={{minWidth:200}}>Product</th>
              {showRentalColumns && <>
                <th className="px-4 py-3 text-center text-xs font-bold text-purple-600 uppercase tracking-wider" style={{minWidth:130}}>Rental Start</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-purple-600 uppercase tracking-wider" style={{minWidth:130}}>Rental End</th>
              </>}
              <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider" style={{minWidth:70}}>Qty</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider" style={{minWidth:100}}>Unit Price</th>
              <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider" style={{minWidth:70}}>Disc %</th>
              {taxCols.map(tc=><th key={tc.key} className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{minWidth:tc.type==='select'?110:90}}>{tc.label}</th>)}
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider" style={{minWidth:110}}>Extended</th>
              {customFields.map(f=><th key={f.id} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider" style={{minWidth:110}}>{f.label}</th>)}
              <th/>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-50">
            {items.length === 0
              ? <tr><td colSpan={6 + (showRentalColumns?2:0) + taxCols.length + customFields.length} className="px-5 py-12 text-center text-gray-400 text-sm">
                  No items yet — click <span className="font-semibold text-[#0F172A]">+ Add Item</span> to begin.
                </td></tr>
              : items.map((row, idx) => [
                <tr key={row._id ?? idx} className="hover:bg-blue-50/40 transition-all">
                  <td className="px-3 py-3">
                    <SearchableSelect
                      value={row.product_name || ''}
                      onChange={v => upd(idx, 'product_name', v)}
                      options={activeProducts.map(p => ({
                        value: p.name,
                        label: p.name,
                        sub: [
                          p.category,
                          p.sku ? `SKU: ${p.sku}` : null,
                          showRentalColumns && p.is_rentable ? '👗 Rentable' : null,
                          p.stock_quantity !== undefined
                            ? (Number(p.stock_quantity) === 0
                                ? '🚫 Out of stock'
                                : Number(p.stock_quantity) <= Number(p.reorder_level || 10)
                                  ? `⚠️ Low stock: ${p.stock_quantity}`
                                  : `Stock: ${p.stock_quantity}`)
                            : null,
                        ].filter(Boolean).join(' · '),
                      }))}
                      placeholder="Search products..."
                      emptyLabel="No active products found"
                    />
                  </td>
                  {showRentalColumns && (() => {
                    const selectedProduct = activeProducts.find(p => p.name === row.product_name);
                    const isRentable = !!selectedProduct?.is_rentable;
                    const todayISO = new Date().toLocaleDateString('en-CA');
                    // Invoices show rental dates read-only, for reference —
                    // the order already secured the booking, so there's
                    // nothing to edit or conflict-check here.
                    const readOnly = page === 'retailInvoices';
                    const isDisabled = readOnly || !isRentable;
                    return <>
                      <td className="px-3 py-3">
                        <input type="date" value={row.rental_start_date || ''} disabled={isDisabled} min={todayISO}
                          onChange={e => upd(idx, 'rental_start_date', e.target.value)}
                          className={`${iCls} text-center ${isDisabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}/>
                      </td>
                      <td className="px-3 py-3">
                        <input type="date" value={row.rental_end_date || ''} disabled={isDisabled} min={row.rental_start_date || todayISO}
                          onChange={e => upd(idx, 'rental_end_date', e.target.value)}
                          className={`${iCls} text-center ${isDisabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}/>
                      </td>
                    </>;
                  })()}
                  <td className="px-3 py-3">
                    <input type="number" min={1} value={row.quantity}
                      onChange={e => { const v = Number(e.target.value); if (v < 1) return; upd(idx, 'quantity', v); }}
                      className={`${iCls} text-center`}/>
                  </td>
                  <td className="px-3 py-3">
                    <input type="number" min={0} value={row.unit_price}
                      onChange={e => upd(idx, 'unit_price', Math.max(0, Number(e.target.value)))}
                      className={`${iCls} text-right`}/>
                  </td>
                  <td className="px-3 py-3">
                    <input type="number" min={0} max={100} value={row.discount_pct}
                      onChange={e => upd(idx, 'discount_pct', Math.min(100, Math.max(0, Number(e.target.value))))}
                      className={`${iCls} text-center ${row.discount_pct > 0 ? 'border-green-300 bg-green-50 text-green-800' : ''}`}/>
                  </td>
                  {taxCols.map(tc => (
                    <td key={tc.key} className="px-3 py-3">
                      {tc.type === 'select'
                        ? <select value={row[tc.key] ?? tc.defaultValue ?? ''}
                            onChange={e => upd(idx, tc.key, e.target.value)}
                            className={`${sCls} text-center`}>
                            {tc.opts.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        : <input type={tc.type === 'number' ? 'number' : 'text'}
                            value={row[tc.key] ?? tc.defaultValue ?? ''}
                            onChange={e => upd(idx, tc.key, e.target.value)}
                            className={`${iCls} text-center`}/>
                      }
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right font-bold text-[#0F172A] text-sm">
                    {formatCurrency(row.extended_price || 0)}
                  </td>
                  {customFields.map(f=><td key={f.id} className="px-3 py-3"><LineItemCustomFieldInput field={f} value={(row.custom_data||{})[f.api_name]} onChange={v=>updCustom(idx,f.api_name,v)}/></td>)}
                  <td className="px-3 py-3 text-center">
                    <button type="button" onClick={() => remove(idx)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all font-bold text-lg mx-auto">
                      ×
                    </button>
                  </td>
                </tr>,
                rentalWarnings[idx] ? (
                  <tr key={`warn-${row._id ?? idx}`}>
                    <td colSpan={6 + (showRentalColumns?2:0) + taxCols.length + customFields.length} className="px-4 pb-2 -mt-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                        <span>⚠️</span><span>{rentalWarnings[idx]}</span>
                      </div>
                    </td>
                  </tr>
                ) : null,
              ])
            }
          </tbody>
        </table>
      </div>
      {items.length>0 && (() => {
        // Compute CGST/SGST/IGST breakdown for INR
        const breakdown = taxRegime.regime === 'india_gst'
          ? items.reduce((acc, item) => {
              const lb = taxRegime.computeLineTax(item);
              Object.entries(lb.breakdown).forEach(([k,v]) => { acc[k] = (acc[k]||0) + (v as number); });
              return acc;
            }, {} as Record<string,number>)
          : null;
        return (
          <div className="px-5 py-4 border-t border-blue-100 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div><div className="text-gray-400 text-xs uppercase font-bold">Subtotal</div><div className="font-bold text-[#0F172A]">{formatCurrency(subtotal)}</div></div>
              <div><div className="text-gray-400 text-xs uppercase font-bold">Discount</div><div className="font-bold text-red-500">-{formatCurrency(totalDisc)}</div></div>
              <div><div className="text-gray-400 text-xs uppercase font-bold">{taxRegime.shortLabel}</div><div className="font-bold text-[#0F172A]">{formatCurrency(totalTax)}</div></div>
              <div><div className="text-gray-400 text-xs uppercase font-bold">Grand Total</div><div className="font-bold text-blue-700 text-base">{formatCurrency(grandTotal)}</div></div>
            </div>
            {breakdown && Object.keys(breakdown).length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2 border-t border-blue-50">
                {Object.entries(breakdown).map(([k,v]) => v > 0 && (
                  <div key={k} className="bg-blue-50 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-gray-500 uppercase font-bold mr-1.5">{k.toUpperCase()}</span>
                    <span className="font-bold text-[#0F172A]">{formatCurrency(v as number)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Print HTML Builder ──────────────────────────────────────────────────────
function buildRetailPrintHTML(t, record, items, products) {
  const isTh = t.paper_size?.startsWith('thermal');
  const widthMM = t.paper_size==='thermal_58'||t.paper_size==='thermal_57' ? 58 : t.paper_size==='thermal_80' ? 80 : t.paper_size==='A5' ? 148 : 210;
  const font   = t.font_family || 'Arial, sans-serif';
  const fsize  = Number(t.font_size || 11);
  const brand  = t.brand_color  || '#0F172A';
  const accent = t.accent_color || '#2563EB';
  const bg     = t.bg_color     || '#FFFFFF';
  const fs     = (n) => isTh ? Math.max(7, n-2) : Math.max(8, Math.round(n * fsize / 11));
  const _cur   = ((typeof window !== 'undefined' ? (window as any).__bp_prefs : null) || {}).default_currency || 'INR';
  const _sym   = _cur === 'INR' ? String.fromCharCode(8377) : _cur === 'USD' ? '$' : _cur === 'GBP' ? String.fromCharCode(163) : _cur === 'EUR' ? String.fromCharCode(8364) : _cur + ' ';
  const fmt    = (n) => _sym + Number(n||0).toLocaleString(_cur === 'INR' ? 'en-IN' : 'en-US', {minimumFractionDigits:2});
  const div    = t.show_dividers !== false ? `<hr style="border:none;border-top:1px ${t.border_style||'dashed'} #ccc;margin:6px 0;"/>` : '';

  // Product image lookup for the optional thumbnail column (skip for thermal printers — text-only)
  const showImages = !!t.show_product_images && !isTh;
  const productByCode = new Map((products||[]).map(p => [p.sku, p]).filter(([k]) => k));
  const productByName = new Map((products||[]).map(p => [p.name, p]).filter(([k]) => k));
  const findProductImage = (item) => {
    const p = (item.product_code && productByCode.get(item.product_code))
      || (item.product_name && productByName.get(item.product_name));
    return p?.image_url || '';
  };

  const colHeaders = [
    t.col_sno && `<th style="padding:3px 4px;text-align:left;font-size:${fs(8)}px;color:#6B7280;text-transform:uppercase">#</th>`,
    showImages && `<th style="padding:3px 4px;text-align:left;font-size:${fs(8)}px;color:#6B7280;text-transform:uppercase">Img</th>`,
    t.col_item!==false && `<th style="padding:3px 4px;text-align:left;font-size:${fs(8)}px;color:#6B7280;text-transform:uppercase">Item</th>`,
    t.col_unit && `<th style="padding:3px 4px;text-align:center;font-size:${fs(8)}px;color:#6B7280;text-transform:uppercase">Unit</th>`,
    t.col_qty!==false && `<th style="padding:3px 4px;text-align:right;font-size:${fs(8)}px;color:#6B7280;text-transform:uppercase">Qty</th>`,
    t.col_price!==false && `<th style="padding:3px 4px;text-align:right;font-size:${fs(8)}px;color:#6B7280;text-transform:uppercase">Unit Price</th>`,
    t.col_discount && `<th style="padding:3px 4px;text-align:right;font-size:${fs(8)}px;color:#6B7280;text-transform:uppercase">Disc%</th>`,
    t.col_tax_rate && t.tax_regime!=='exempt' && `<th style="padding:3px 4px;text-align:right;font-size:${fs(8)}px;color:#6B7280;text-transform:uppercase">Tax%</th>`,
    t.col_hsn && `<th style="padding:3px 4px;text-align:right;font-size:${fs(8)}px;color:#6B7280;text-transform:uppercase">HSN</th>`,
    t.col_subtotal_line && `<th style="padding:3px 4px;text-align:right;font-size:${fs(8)}px;color:#6B7280;text-transform:uppercase">Subtotal</th>`,
    t.col_total!==false && `<th style="padding:3px 4px;text-align:right;font-size:${fs(8)}px;color:#6B7280;text-transform:uppercase">Total</th>`,
  ].filter(Boolean).join('');

  const rows = (items||[]).map((item, i) => {
    const rowBg = t.alt_row && i%2===1 ? (t.alt_row_color||'#F9FAFB') : 'transparent';
    const qty   = Number(item.quantity||1);
    const price = Number(item.unit_price ?? item.price ?? 0);
    const disc  = Number(item.discount_pct ?? item.disc ?? 0);
    const tax   = Number(item.tax_pct ?? item.gst_rate ?? item.taxRate ?? 0);
    const net   = qty * price * (1 - disc/100);
    const total = Number(item.extended_price ?? item.total ?? (net * (1 + tax/100)));
    return `<tr style="background:${rowBg}">
      ${t.col_sno ? `<td style="padding:3px 4px;font-size:${fs(10)}px">${i+1}</td>` : ''}
      ${showImages ? `<td style="padding:3px 4px">${findProductImage(item) ? `<img src="${findProductImage(item)}" style="width:28px;height:28px;object-fit:cover;border-radius:4px;border:1px solid #E5E7EB"/>` : ''}</td>` : ''}
      ${t.col_item!==false ? `<td style="padding:3px 4px;font-size:${fs(11)}px">${item.product_name||item.product||''}</td>` : ''}
      ${t.col_unit ? `<td style="padding:3px 4px;text-align:center;font-size:${fs(10)}px">${item.unit||''}</td>` : ''}
      ${t.col_qty!==false ? `<td style="padding:3px 4px;text-align:right;font-size:${fs(11)}px">${qty}</td>` : ''}
      ${t.col_price!==false ? `<td style="padding:3px 4px;text-align:right;font-size:${fs(11)}px">${fmt(price)}</td>` : ''}
      ${t.col_discount ? `<td style="padding:3px 4px;text-align:right;font-size:${fs(10)}px;color:#6B7280">${disc}%</td>` : ''}
      ${t.col_tax_rate && t.tax_regime!=='exempt' ? `<td style="padding:3px 4px;text-align:right;font-size:${fs(9)}px;color:#6B7280">${tax}%</td>` : ''}
      ${t.col_hsn ? `<td style="padding:3px 4px;text-align:right;font-size:${fs(8)}px;color:#6B7280">${item.hsn_code||item.hsn||''}</td>` : ''}
      ${t.col_subtotal_line ? `<td style="padding:3px 4px;text-align:right;font-size:${fs(10)}px;color:#4B5563">${fmt(net)}</td>` : ''}
      ${t.col_total!==false ? `<td style="padding:3px 4px;text-align:right;font-size:${fs(11)}px;font-weight:600">${fmt(total)}</td>` : ''}
    </tr>`;
  }).join('');

  const subtotal   = Number(record.subtotal || (items||[]).reduce((s,i)=>s+Number(i.unit_price??i.price??0)*Number(i.quantity||1),0));
  const totalDisc  = Number(record.total_discount || 0);
  const totalTax   = Number(record.total_tax || 0);
  const grandTotal = Number(record.amount || record.grand_total || (subtotal - totalDisc + totalTax));
  const amtPaid    = Number(record.amount_paid || grandTotal);
  const change     = Math.max(0, amtPaid - grandTotal);
  const roundOff   = Math.round(grandTotal) - grandTotal;
  // record.id = invoice_number (set by fetchRetailInvoices mapping)
  // record.displayNumber = raw integer from display_number column
  // Prefer formatted displayNumber, fall back to record.id (which is already the invoice_number string)
  const invNum = record.displayNumber
    ? 'RINV-' + String(record.displayNumber).padStart(5, '0')
    : (record.id || record.invoice_number || '');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:${font};background:${bg};color:#111827;font-size:${fsize}px}
    .page{width:${widthMM}mm;margin:0 auto;padding:${isTh?'0':'8mm'};background:${bg}}
    .header{background:${brand};color:#fff;padding:${isTh?'8px 10px':'14px 18px'};text-align:${t.header_align||'center'}}
    .store-name{font-weight:800;font-size:${fs(16)}px;letter-spacing:1.5px;text-transform:uppercase}
    .store-sub{font-size:${fs(9)}px;opacity:.82;margin-top:4px;line-height:1.6}
    .gst-hdr{background:${brand}dd;padding:3px 10px;text-align:center;font-size:${fs(8)}px;color:#fff;font-weight:600;letter-spacing:1px}
    .body{padding:${isTh?'6px 10px':'12px 18px'}}
    .inv-meta{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
    .inv-num{font-weight:800;font-size:${fs(13)}px}
    .inv-date{font-size:${fs(9)}px;color:#6B7280;margin-top:2px}
    .meta-row{display:flex;justify-content:space-between;margin-bottom:3px}
    .meta-l{font-size:${fs(10)}px;color:#6B7280}
    .meta-v{font-size:${fs(11)}px;font-weight:500}
    .meta-vb{font-size:${fs(11)}px;font-weight:700}
    table{width:100%;border-collapse:collapse}
    thead tr{border-bottom:2px solid ${brand}}
    .tot-row{display:flex;justify-content:space-between;margin-bottom:3px}
    .tot-final{display:flex;justify-content:space-between;font-weight:800;font-size:${fs(14)}px;padding:6px 0;margin-top:4px;border-top:2px solid ${brand}}
    .loyalty-box{background:${accent}18;border:1px solid ${accent}40;border-radius:6px;padding:8px 12px;text-align:center;margin:6px 0}
    .savings{text-align:center;color:#15803D;font-weight:600;background:#F0FDF4;border-radius:5px;padding:3px 8px;margin:5px 0;font-size:${fs(9)}px}
    .footer-msg{text-align:center;color:#4B5563;line-height:1.6;padding:8px 0;font-size:${fs(9)}px}
    .powered-by{text-align:center;font-size:${fs(7)}px;color:#9CA3AF;margin-top:8px}
    .signature{margin-top:20px;border-top:1px solid #E5E7EB;padding-top:6px;text-align:right;font-size:${fs(9)}px;color:#6B7280}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:${widthMM}mm}@page{size:${isTh?widthMM+'mm 1000mm':t.paper_size==='A5'?'A5':'A4'};margin:${isTh?'0':'8mm'}}}
  </style></head><body><div class="page">

  <div class="header">
    ${t.show_logo && t.logo_url ? `<div style="margin-bottom:6px;text-align:${t.logo_position==='left'?'left':t.logo_position==='right'?'right':'center'}"><img src="${t.logo_url}" style="height:${t.logo_size||48}px;object-fit:contain"/></div>` : ''}
    <div class="store-name">${t.store_name||''}</div>
    ${t.store_tagline ? `<div style="font-size:${fs(9)}px;opacity:.82;font-style:italic;margin-top:2px">${t.store_tagline}</div>` : ''}
    ${t.show_store_info!==false ? `<div class="store-sub">${t.store_address||''}${t.store_phone?'<br/>'+t.store_phone:''}${t.store_email?'<br/>'+t.store_email:''}${t.store_website?'<br/>'+t.store_website:''}</div>` : ''}
  </div>
  ${t.show_gst_header && t.store_gstin ? `<div class="gst-hdr">GSTIN: ${t.store_gstin}</div>` : ''}

  <div class="body">
    <div class="inv-meta">
      <div>
        <div class="inv-num">${t.headline||'INVOICE'}</div>
        ${t.sub_headline ? `<div style="font-size:${fs(9)}px;color:#6B7280;font-style:italic;margin-top:1px">${t.sub_headline}</div>` : ''}
        ${t.show_invoice_number!==false ? `<div class="inv-date" style="font-weight:600;color:#374151">${invNum}</div>` : ''}
        ${t.show_date!==false ? `<div class="inv-date">${record.invoice_date ? formatDate(record.invoice_date) : formatDate(new Date().toISOString())}</div>` : ''}
        ${t.show_cashier && (record.owner_name||record.owner) ? `<div class="inv-date">Cashier: ${record.owner_name||record.owner}</div>` : ''}
        ${t.show_invoice_status && record.status ? `<div style="margin-top:4px"><span style="background:${record.status==='Paid'?'#DCFCE7':record.status==='Overdue'?'#FEE2E2':'#F3F4F6'};color:${record.status==='Paid'?'#166534':record.status==='Overdue'?'#991B1B':'#374151'};padding:2px 10px;border-radius:9px;font-size:${fs(8)}px;font-weight:700">${record.status}</span></div>` : ''}
        ${t.show_payment_status && record.payment_status ? `<div style="margin-top:3px"><span style="background:${record.payment_status==='Paid'?'#DCFCE7':record.payment_status==='Pending'?'#DBEAFE':'#FEF9C3'};color:${record.payment_status==='Paid'?'#166534':record.payment_status==='Pending'?'#1E40AF':'#854D0E'};padding:2px 10px;border-radius:9px;font-size:${fs(8)}px;font-weight:700">Payment: ${record.payment_status}</span></div>` : ''}
        ${t.place_of_supply ? `<div class="inv-date">Place of Supply: ${t.place_of_supply}</div>` : ''}
      </div>
      <div style="text-align:right">
        ${t.show_barcode ? '<div style="font-size:22px;color:#9CA3AF;letter-spacing:-2px">▌▌▌▌▌▌</div>' : ''}
        ${t.show_qr_code ? '<div style="width:48px;height:48px;background:#F3F4F6;border:1px solid #E5E7EB;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:24px">◼</div>' : ''}
      </div>
    </div>
    ${div}
    ${t.show_customer!==false && record.customer ? `
    <div class="meta-row"><span class="meta-l">Customer</span><span class="meta-vb">${record.customer}</span></div>
    ${t.show_customer_phone!==false && record.customer_phone ? `<div class="meta-row"><span class="meta-l">Phone</span><span class="meta-v">${record.customer_phone}</span></div>` : ''}
    ${t.show_customer_gstin && record.customer_gstin ? `<div class="meta-row"><span class="meta-l">GSTIN</span><span class="meta-v">${record.customer_gstin}</span></div>` : ''}
    ${div}` : ''}

    <table><thead><tr>${colHeaders}</tr></thead><tbody>${rows}</tbody></table>
    ${div}

    ${t.show_subtotal!==false ? `<div class="tot-row"><span class="meta-l">Subtotal</span><span class="meta-v">${fmt(subtotal)}</span></div>` : ''}
    ${t.show_discount_total!==false && totalDisc>0 ? `<div class="tot-row"><span class="meta-l">Discount</span><span class="meta-v" style="color:#15803D">-${fmt(totalDisc)}</span></div>` : ''}
    ${t.show_tax_total!==false && totalTax>0 && t.tax_regime==='inclusive' ? `<div style="text-align:right;font-size:${fs(8)}px;color:#6B7280;font-style:italic;margin-bottom:2px">(Prices inclusive of GST)</div>` : ''}
    ${t.show_tax_total!==false && totalTax>0 && t.tax_regime!=='exempt' && t.tax_regime!=='inclusive' ? `<div class="tot-row"><span class="meta-l">Tax</span><span class="meta-v">${fmt(totalTax)}</span></div>` : ''}
    ${t.show_cgst_sgst && totalTax>0 && t.tax_regime!=='exempt' && t.tax_regime!=='inclusive' ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:2px;font-size:${fs(9)}px;color:#6B7280"><span>CGST</span><span>${fmt(totalTax/2)}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:2px;font-size:${fs(9)}px;color:#6B7280"><span>SGST</span><span>${fmt(totalTax/2)}</span></div>
    ` : ''}
    ${t.show_round_off && Math.abs(roundOff)>0.001 ? `<div class="tot-row"><span class="meta-l">Round Off</span><span class="meta-v">${fmt(roundOff)}</span></div>` : ''}
    <div class="tot-final"><span>TOTAL</span><span>${fmt(grandTotal)}</span></div>

    ${t.show_payment!==false ? `${div}
    ${t.show_payment_mode!==false ? `<div class="meta-row"><span class="meta-l">Payment</span><span class="meta-vb">${record.payment_method||''}</span></div>` : ''}
    ${t.show_amount_paid ? `<div class="meta-row"><span class="meta-l">Amount Paid</span><span class="meta-v">${fmt(amtPaid)}</span></div>` : ''}
    ${t.show_change && change>0 ? `<div class="meta-row"><span class="meta-l">Change</span><span class="meta-v">${fmt(change)}</span></div>` : ''}
    ${t.show_upi_id && t.upi_id ? `<div class="meta-row"><span class="meta-l">UPI</span><span class="meta-v">${t.upi_id}</span></div>` : ''}
    ` : ''}

    ${t.show_loyalty && record.loyalty_points_earned ? `${div}<div class="loyalty-box"><div style="font-size:${fs(9)}px;color:#6B7280">Points Earned</div><div style="font-weight:800;font-size:${fs(15)}px">+${record.loyalty_points_earned}</div></div>` : ''}
    ${totalDisc>0 ? `<div class="savings">You saved ${fmt(totalDisc)}!</div>` : ''}
    ${t.show_return_policy && t.return_policy ? `${div}<div style="font-size:${fs(8)}px;color:#6B7280;line-height:1.5">Return Policy: ${t.return_policy}</div>` : ''}
    ${t.show_signature ? `<div class="signature">${t.signature_label||'Authorised Signatory'}</div>` : ''}
    ${t.show_footer!==false && t.footer_msg ? `${div}<div class="footer-msg">${t.footer_msg}</div>` : ''}
    ${t.show_powered_by!==false ? `<div class="powered-by">Powered by Umbrella Suite</div>` : ''}
    ${t.watermark ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:64px;font-weight:900;color:rgba(0,0,0,0.04);pointer-events:none;white-space:nowrap;letter-spacing:6px">${t.watermark}</div>` : ''}
  </div></div></body></html>`;
}


function RetailInvoicePrintModal({ template, record, items, products, onClose, onPrint }) {
  if (!template) return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[20px] p-8 max-w-md text-center shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="font-bold text-[#0F172A] text-lg mb-2">No Template Selected</h3>
        <p className="text-gray-500 text-sm mb-5">Please select an Invoice Template in the Invoice Info section first. You can create templates in Admin Tools → B2C Retail → Invoice Template.</p>
        <button onClick={onClose} className="bg-[#0F172A] text-white px-6 py-2.5 rounded-xl font-bold text-sm">Close</button>
      </div>
    </div>
  );

  const html = buildRetailPrintHTML(template, record, items, products);
  const ps   = template.paper_size;
  const isTh = ps?.startsWith('thermal');
  const previewW = ps==='thermal_58'||ps==='thermal_57' ? 219 : ps==='thermal_80' ? 303 : ps==='A5' ? 480 : 595;

  return (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden" style={{maxWidth:900,width:'100%',maxHeight:'90vh'}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F172A] to-indigo-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-white font-bold text-lg">🖨️ Print Preview</h3>
            <p className="text-blue-200 text-xs mt-0.5">Template: {template.name} · {template.paper_size}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onPrint}
              className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow transition-all">
              🖨️ Print Now
            </button>
            <button onClick={onClose}
              className="text-white/60 hover:text-white text-2xl leading-none">✕</button>
          </div>
        </div>

        {/* Preview iframe */}
        <div className="flex-1 overflow-auto bg-gray-100 p-6 flex justify-center">
          <div style={{width:previewW,flexShrink:0}}>
            <iframe
              srcDoc={html}
              style={{width:'100%',height:isTh?800:1000,border:'none',borderRadius:8,boxShadow:'0 4px 20px rgba(0,0,0,0.15)',background:'white'}}
              title="Invoice Preview"/>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
          <p className="text-xs text-gray-400">Preview may differ slightly from printed output depending on printer settings.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100">Close</button>
            <button onClick={onPrint} className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold">🖨️ Print</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Retail Customer 360 ─────────────────────────────────────────────────────
function RC360Table({ cols, rows, emptyMsg, onRowClick }) {
  if (!rows || rows.length === 0) return (
    <div className="px-5 py-10 text-center text-gray-400 text-sm">{emptyMsg}</div>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {cols.map(c => (
              <th key={c.h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{c.h}</th>
            ))}
            {onRowClick && <th className="px-2 py-3 w-8"/>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i}
              onClick={() => onRowClick?.(r)}
              className={`border-t border-gray-50 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-blue-50/60 group' : 'hover:bg-blue-50/20'}`}>
              {cols.map(c => (
                <td key={c.h} className="px-4 py-3 text-sm">{c.v(r)}</td>
              ))}
              {onRowClick && (
                <td className="px-2 py-3 text-gray-300 group-hover:text-blue-500 text-base">→</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RetailCustomer360({ customer, onNavigate, onOpenCreate }) {
  const { supabase } = useTenant();
  const [tab, setTab]         = useState('orders');
  const [data, setData]       = useState({ orders: [], invoices: [], activities: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !customer?.id) return;
    setLoading(true);
    // customer.id = customer_number (display ID), customer._uuid = actual DB UUID
    // Try matching by _uuid first, fall back to customer_number
    const custId = customer._uuid || customer.id;
    Promise.all([
      tenantScope(supabase.from('retail_orders')    .select('*')).or(`customer_id.eq.${custId},customer.eq.${customer.name||''}`).order('created_at', { ascending: false }),
      tenantScope(supabase.from('retail_invoices')  .select('*')).or(`customer_id.eq.${custId},customer.eq.${customer.name||''}`).order('created_at', { ascending: false }),
      tenantScope(supabase.from('retail_activities').select('*')).or(`customer_id.eq.${custId},customer.eq.${customer.name||''}`).order('created_at', { ascending: false }),
    ]).then(([{ data: orders }, { data: invoices }, { data: activities }]) => {
      setData({ orders: orders || [], invoices: invoices || [], activities: activities || [] });
      setLoading(false);
    });
  }, [customer?.id]);

  const fmt          = n => formatCurrency(n || 0);
  const totalSpent   = data.invoices.reduce((s, i) => s + (i.amount || 0), 0);
  const paidInvoices = data.invoices.filter(i => i.payment_status === 'Paid' || i.status === 'Paid').length;
  const openActs     = data.activities.filter(a => a.status === 'Open' || a.status === 'In Progress').length;

  const TABS = [
    { k: 'orders',     icon: '🛍️', label: 'Orders',     count: data.orders.length },
    { k: 'invoices',   icon: '🧾', label: 'Invoices',   count: data.invoices.length },
    { k: 'activities', icon: '📅', label: 'Activities', count: data.activities.length },
  ];

  const SP = ({ status }) => (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>{status || '-'}</span>
  );

  const orderCols = [
    { h: 'Order #',   v: r => {
      const num = r.display_number ? 'RORD-'+String(r.display_number).padStart(5,'0') : r.order_number || '-';
      return <span className="font-mono text-xs text-blue-600 font-bold">{num}</span>;
    }},
    { h: 'Date',      v: r => (<span className="text-gray-600">{r.order_date || r.created_at?.slice(0, 10) || '-'}</span>) },
    { h: 'Channel',   v: r => (<span className="text-gray-600">{r.channel || '-'}</span>) },
    { h: 'Payment',   v: r => (<span className="text-gray-600">{r.payment_method || '-'}</span>) },
    { h: 'Pay Status',v: r => (<SP status={r.payment_status}/>) },
    { h: 'Status',    v: r => (<SP status={r.status}/>) },
    { h: 'Amount',    v: r => (<span className="font-bold text-[#0F172A]">{fmt(r.amount)}</span>) },
  ];

  const invoiceCols = [
    { h: 'Invoice #',  v: r => {
      const num = r.display_number ? 'RINV-'+String(r.display_number).padStart(5,'0') : r.invoice_number || '-';
      return <span className="font-mono text-xs text-purple-600 font-bold">{num}</span>;
    }},
    { h: 'Date',       v: r => (<span className="text-gray-600">{r.invoice_date || r.created_at?.slice(0, 10) || '-'}</span>) },
    { h: 'Due Date',   v: r => (<span className="text-gray-600">{r.due_date || '-'}</span>) },
    { h: 'Payment',    v: r => (<span className="text-gray-600">{r.payment_method || '-'}</span>) },
    { h: 'Pay Status', v: r => (<SP status={r.payment_status}/>) },
    { h: 'Status',     v: r => (<SP status={r.status}/>) },
    { h: 'Tax',        v: r => (<span className="text-gray-600">{fmt(r.total_tax)}</span>) },
    { h: 'Amount',     v: r => (<span className="font-bold text-[#0F172A]">{fmt(r.amount)}</span>) },
  ];

  const typeIcon = t => t === 'Call' ? '📞' : t === 'Visit' ? '🏪' : t === 'WhatsApp' ? '💬' : t === 'Complaint' ? '⚠️' : '📋';

  const activityCols = [
    { h: 'Subject',  v: r => (<span className="font-semibold text-[#0F172A]">{r.subject}</span>) },
    { h: 'Type',     v: r => (<span className="text-gray-600">{typeIcon(r.activity_type)} {r.activity_type || '-'}</span>) },
    { h: 'Date',     v: r => (<span className="text-gray-600">{r.activity_date || r.created_at?.slice(0, 10) || '-'}</span>) },
    { h: 'Due Date', v: r => (<span className="text-gray-600">{r.due_date || '-'}</span>) },
    { h: 'Priority', v: r => (<span className={`text-xs font-semibold ${r.priority === 'High' || r.priority === 'Critical' ? 'text-red-600' : r.priority === 'Medium' ? 'text-amber-600' : 'text-gray-400'}`}>{r.priority || '-'}</span>) },
    { h: 'Owner',    v: r => (<span className="text-gray-600">{r.owner || '-'}</span>) },
    { h: 'Status',   v: r => (<SP status={r.status}/>) },
  ];

  const kpis = [
    { l: 'Total Orders',    v: data.orders.length,               icon: '🛍️', bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700' },
    { l: 'Total Spent',     v: fmt(totalSpent),                  icon: '💰', bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700' },
    { l: 'Paid Invoices',   v: paidInvoices + '/' + data.invoices.length, icon: '🧾', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
    { l: 'Open Activities', v: openActs,                         icon: '📅', bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700' },
  ];

  const activeCols = tab === 'orders' ? orderCols : tab === 'invoices' ? invoiceCols : activityCols;
  const activeRows = tab === 'orders' ? data.orders : tab === 'invoices' ? data.invoices : data.activities;
  const activeTab  = TABS.find(t => t.k === tab);

  // Open create modal for the given type, pre-filled with this customer
  const handleCreateFor = (type) => {
    const custName = customer.name || '';
    const pageMap  = { order: 'retailOrders', invoice: 'retailInvoices', activity: 'retailActivities' };
    const prefill  = {
      ...(type !== 'activity' ? buildCustomerPrefill(customer) : { customer: custName, customer_id: customer._uuid || customer.id || '' }),
      ...(type === 'order'    ? { order_date:    todayLocalISO(), status: 'Open',  channel: 'In-Store' } : {}),
      ...(type === 'invoice'  ? { invoice_date:  todayLocalISO(), status: 'Draft', payment_status: 'Pending' } : {}),
      ...(type === 'activity' ? { activity_date: todayLocalISO(), subject: 'Follow up with '+custName, activity_type: 'Call', status: 'Planned' } : {}),
    };
    if (onOpenCreate) onOpenCreate(pageMap[type], prefill);
  };

  return (
    <div className="space-y-5">
      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={()=>handleCreateFor('order')} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm">🛒 New Order</button>
        <button onClick={()=>handleCreateFor('invoice')} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm">🧾 New Invoice</button>
        <button onClick={()=>handleCreateFor('activity')} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm">📅 New Activity</button>
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.l} className={`rounded-[20px] border ${k.bg} ${k.border} p-4`}>
            <div className="text-2xl mb-2">{k.icon}</div>
            <div className={`text-xl font-bold ${k.text}`}>{k.v}</div>
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-0.5">{k.l}</div>
          </div>
        ))}
      </div>

      {/* Loyalty card */}
      {(customer.loyalty_points > 0 || customer.loyalty_tier) && (
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[20px] p-5 text-white flex items-center gap-5">
          <div className="text-4xl">🎁</div>
          <div className="flex-1">
            <div className="font-bold text-lg">{customer.loyalty_tier || 'Standard'} Member</div>
            <div className="text-blue-200 text-sm mt-0.5">{customer.name}</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black">{customer.loyalty_points || 0}</div>
            <div className="text-blue-300 text-xs uppercase tracking-wider">Loyalty Points</div>
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(tb => (
          <button key={tb.k} onClick={() => setTab(tb.k)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
              tab === tb.k
                ? 'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white shadow-lg'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-400 hover:text-blue-700'
            }`}>
            <span>{tb.icon}</span>
            <span>{tb.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${tab === tb.k ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {tb.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="bg-white rounded-[20px] border border-blue-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 flex items-center gap-2">
            <span>{activeTab?.icon}</span>
            <span className="font-bold text-[#0F172A] text-sm">{activeTab?.label}</span>
            <span className="ml-auto text-xs text-gray-400">{activeRows.length} records</span>
          </div>
          <RC360Table cols={activeCols} rows={activeRows} emptyMsg={`No ${activeTab?.label?.toLowerCase()} found for this customer`} onRowClick={(r) => {
              const pageMap = { orders: 'retailOrders', invoices: 'retailInvoices', activities: 'retailActivities' };
              const idMap   = { orders: 'order_number', invoices: 'invoice_number', activities: 'activity_number' };
              const pg = pageMap[activeTab?.k];
              if (!pg || !onNavigate) return;
              // Map raw DB row to expected format (same as AppContext fetch mapping)
              const idField = idMap[activeTab?.k] || 'id';
              const mapped = { ...r, id: r[idField] || r.id, _uuid: r.id, displayNumber: r.display_number };
              onNavigate(pg, mapped);
            }}/>
        </div>
      )}
    </div>
  );
}

// ─── Retail Quick Create Customer ────────────────────────────────────────────
function RetailQuickCreateCustomer({ prefillName, onCreated, onClose }) {
  const { createRetailRecord, retailCustomers, appearance } = useApp();
  const { showAlert, showConfirm } = useAlert();
  const lang = appearance?.language || 'en';
  const [form, setForm] = useState({ name: prefillName||'', phone:'', email:'' });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) { showAlert('Name is required', { variant:'warning' }); return; }
    // Duplicate check now happens centrally in createRetailRecord — covers
    // this quick-create flow and every other retail customer creation path
    // consistently, without prompting twice.
    setSaving(true);
    const rec = await createRetailRecord('retailCustomers', {
      ...form, status:'Active', loyalty_points:0, loyalty_tier:'Standard',
    }, []);
    setSaving(false);
    if (rec) onCreated(rec._uuid || rec.id, rec.name, rec.phone || form.phone || '');
  }

  const iCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Full Name *</label>
        <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className={iCls} placeholder="Customer name" autoFocus/>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Phone</label>
        <input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} className={iCls} placeholder="+91 98765 43210"/>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Email</label>
        <input value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} className={iCls} placeholder="customer@example.com"/>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">{t(lang,'cancel')}</button>
        <button onClick={save} disabled={saving} className="flex-2 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 shadow hover:opacity-90">
          {saving ? t(lang,'loading') : `+ ${t(lang,'create')} ${t(lang,'customer')}`}
        </button>
      </div>
    </div>
  );
}

// ─── Detail Panel ───────────────────────────────────────────────────────────
function RetailDetailPanel({ page, record, onClose, onSaved, pendingReturnTo, onC360Navigate, onC360Create }) {
  const { updateRetailRecord, deleteRetailRecord, retailCustomers, retailProducts, retailOrders, enterpriseUsers, currentUser,
          fetchRetailLineItems, fetchRetailCustomers, createRetailRecord, appPreferences, appearance, setPendingReturnTo, createRetailInvoiceFromOrder,
          checkMatchingApprovalProcess, submitForApproval, currentUserPermissions, permissionsLoaded } = useApp();
  const { supabase } = useTenant();
  const { showAlert, showConfirm } = useAlert();
  const lang = appearance?.language || 'en';
  const [showBookingCalendar, setShowBookingCalendar] = useState(false);
  const cfg = RETAIL_CONFIG[page];
  const taxRegime = getTaxRegime(appPreferences?.default_currency);

  const [edited, setEdited] = useState({ ...record });
  const [activeTab, setActiveTab] = useState('details');
  const [quickCreateCustomer, setQuickCreateCustomer] = useState(null); // {prefillName, onCreated} // 'details' | '360'
  // Retail invoice templates (for retailInvoices page)
  const [invoiceTemplates,    setInvoiceTemplates]    = useState([]);
  const [selectedTemplateId,  setSelectedTemplateId]  = useState('');
  const [showPrintPreview,    setShowPrintPreview]    = useState(false);

  useEffect(() => {
    if (page !== 'retailInvoices' || !supabase) return;
    tenantScope(supabase.from('retail_invoice_templates').select('*')).order('created_at')
      .then(({ data }) => {
        if (!data) return;
        setInvoiceTemplates(data);
        // Auto-select: use record's saved template, else the default, else first
        const saved    = data.find(t => t.id === (record?.invoice_template_id || edited.invoice_template_id));
        const defTpl   = data.find(t => t.is_default);
        const fallback = data[0];
        const pick = saved || defTpl || fallback;
        if (pick) setSelectedTemplateId(pick.id);
      });
  }, [page, record?.id]);

  // Custom fields — fetch directly, bypass cache issues
  const [customFields, setCustomFields] = useState([]);
  useEffect(() => {
    if (!supabase || !page) return;
    (async () => {
      try {
        // First try with is_published filter
        const { data, error } = await supabase
          .from('app_custom_fields')
          .select('id,label,api_name,field_type,options,required,sort_order,show_on,is_published,is_active')
          .eq('object_type', page)
          .order('sort_order');
        if (error) {
          console.error('[CustomFields] DB error:', error.message, error.code);
          setCustomFields([]);
          return;
        }
        console.log('[CustomFields] all active for', page, ':', data?.length, 'rows', data?.map(f=>({label:f.label,published:f.is_published,active:f.is_active})));
        // Only show active AND published fields
        const published = (data||[]).filter(f => f.is_active !== false && f.is_published === true);
        console.log('[CustomFields] published:', published.length);
        setCustomFields(published.map(f => ({ ...f, options: f.options || [], show_on: f.show_on || 'both' })));
      } catch(e) {
        console.error('[CustomFields] exception:', e);
        setCustomFields([]);
      }
    })();
  }, [page, record?.id]);
  const [items, setItems] = useState([]);
  const [loadingLI, setLoadingLI] = useState(cfg.hasLineItems);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [matchingProcess, setMatchingProcess] = useState(null);
  const [checkingApproval, setCheckingApproval] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});

  useEffect(() => {
    setEdited({ ...record });
    if (!cfg.hasLineItems) { setItems([]); return; }
    setLoadingLI(true);
    const table = page === 'retailOrders' ? 'retail_order_line_items' : 'retail_invoice_line_items';
    const fk = cfg.idField;
    fetchRetailLineItems(table, fk, record.id).then(data => {
      setItems((data||[]).map((d,i)=>({ ...d, _id: d.id || i })));
      setLoadingLI(false);
    });
  }, [record.id]);

  // Check if an active approval process matches this record's object type + conditions
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setCheckingApproval(true);
      const proc = await checkMatchingApprovalProcess(page, { ...record });
      if (!cancelled) { setMatchingProcess(proc); setCheckingApproval(false); }
    };
    check();
    return () => { cancelled = true; };
  }, [page, record.id, record.status]);

  // Statuses that lock the record from further editing
  // Statuses that permanently lock the record (based on saved record, not draft)
  const RETAIL_READONLY_STATUSES = [
    'Pending Approval','Cancelled','Refunded','Discontinued','Blocked','Completed','Paid'
  ];
  // Lock fields based on SAVED record status — allows user to select Completed and still click Save
  const isStatusLocked = RETAIL_READONLY_STATUSES.includes(record?.status);
  // Status dropdown also locks when edited status is terminal (prevents flipping back to Draft)
  const isStatusDropdownLocked = RETAIL_READONLY_STATUSES.includes(edited?.status);

  const set = (k,v) => {
    if (isStatusLocked) return;
    setEdited(p => ({ ...p, [k]: v }));
    // Run inline validator and update field error
    const validator = FIELD_VALIDATORS[k];
    if (validator) {
      const err = validator(v);
      setFieldErrors(p => err ? { ...p, [k]: err } : (({ [k]: _, ...rest }) => rest)(p));
    }
  };

  const canSubmitForApproval = matchingProcess != null
    && edited.status !== 'Pending Approval'
    && !checkingApproval;

  const handleSubmitForApproval = async () => {
    setSubmittingApproval(true);
    await submitForApproval(page, record.id, record.name || record.customer || record.subject || record.id, matchingProcess || undefined);
    setSubmittingApproval(false);
    setEdited(p => ({ ...p, status: 'Pending Approval' }));
    setMatchingProcess(null);
  };

  const handleSave = async (andClose=false) => {
    // Fix 11a: Retail invoice status 'Paid' requires payment_status = 'Paid'
    if (page==='retailInvoices' && edited.status==='Paid' && edited.payment_status!=='Paid') {
      showAlert('Cannot mark invoice as Paid until Payment Status is set to Paid.', { variant:'warning' });
      return;
    }
    // Validate required fields
    const allFields = cfg.sections.flatMap(s => Array.isArray(s.fields) ? s.fields : []);
    for (const f of allFields) {
      const v = edited[f.key];
      // Required check
      if (f.required) {
        const empty = v === undefined || v === null || v === '' || (typeof v === 'string' && !v.trim());
        if (f.type === 'retailCustomer') {
          if (!edited.customer_id && edited.customer) {
            // Record has a customer NAME but no linked customer_id (UUID) —
            // can happen with records created outside this exact save flow
            // (e.g. mobile, before proper customer linking existed there).
            // The display already falls back to matching by name; do the
            // same here and backfill the id, rather than rejecting a save
            // when the customer is visibly right there on the form.
            // Trimmed + case-insensitive, not an exact match — a mobile
            // record's stored name could differ in casing/whitespace from
            // what's in the customer list.
            const target = String(edited.customer).trim().toLowerCase();
            const matched = retailCustomers.find(x => String(x.name || '').trim().toLowerCase() === target);
            if (matched) {
              edited.customer_id = matched._uuid || matched.id;
            }
          }
          if (!edited.customer_id) {
            // If this still fails after the fallback above, the customer
            // name genuinely isn't in this tenant's visible customer list at
            // all — not just a formatting mismatch. That's most likely the
            // same root cause already identified for the mobile app: a
            // customer record created from mobile without tenant_id set,
            // which means it's invisible here regardless of how the name is
            // matched (RLS itself won't surface it). closeMatches below
            // distinguishes "no such name anywhere" from "name exists but
            // something else is wrong."
            const closeMatches = retailCustomers.filter(x => String(x.name || '').toLowerCase().includes(String(edited.customer || '').toLowerCase().slice(0, 5))).map(x => x.name);
            console.error('[RetailDetailPanel Save] Customer validation failed.', {
              'edited.customer_id': edited.customer_id,
              'edited.customer': edited.customer,
              'record.customer_id': record.customer_id,
              'record.customer': record.customer,
              'record.id': record.id,
              'retailCustomers.length': retailCustomers.length,
              'similarly-named customers visible to this tenant': closeMatches,
            });
            showAlert(`"Customer" is required.`, { variant:'warning' }); return;
          }
        } else if (empty) {
          showAlert(`"${f.label.replace(' *','')}" is required and cannot be blank.`, { variant:'warning' });
          return;
        }
      }
      // Format validation
      const validator = FIELD_VALIDATORS[f.key];
      if (validator && v) {
        const err = validator(v);
        if (err) { showAlert(`${f.label.replace(' *','')}: ${err}`, { variant:'warning' }); return; }
      }
    }
    // Check any inline field errors
    const activeErrors = Object.entries(fieldErrors);
    if (activeErrors.length > 0) {
      showAlert(`Please fix the following: ${activeErrors.map(([,e])=>e).join(', ')}`, { variant:'warning', title:'Fix Required' });
      return;
    }
    setSaving(true);
    try {
      // Strip client-side computed fields that don't exist as DB columns
      // Strip client-side computed fields — keep custom_data as it's a real DB column
      const { displayNumber, _uuid, ...editedClean } = edited;
      let payload = { ...editedClean, custom_data: edited.custom_data || {} };
      // Clamp non-negative numeric fields at save time (belt-and-braces vs UI clamps)
      for (const nk of ['stock_quantity','reorder_level','loyalty_points','price','mrp','cost','shipping_cost','quantity']) {
        if (payload[nk] !== undefined && payload[nk] !== null && Number(payload[nk]) < 0) payload[nk] = 0;
      }
      if (cfg.hasLineItems) {
        const subtotal  = items.reduce((s,i) => s + Number(i.quantity||0)*Number(i.unit_price||0), 0);
        const totalDisc = items.reduce((s,i) => s + Number(i.quantity||0)*Number(i.unit_price||0)*Number(i.discount_pct||0)/100, 0);
        const totalTax  = items.reduce((s,i) => s + taxRegime.computeLineTax(i).totalTax, 0);
        const computed  = { subtotal, total_discount: totalDisc, total_tax: totalTax, amount: subtotal-totalDisc+totalTax };
        payload = { ...payload, ...computed };
        // Update edited state so Preview & Print immediately reflects correct totals
        setEdited(p => ({ ...p, ...computed }));
      }
      await updateRetailRecord(page, payload, items);
      if (andClose) {
        onSaved?.();
        if (pendingReturnTo) {
          const rt = pendingReturnTo; setPendingReturnTo(null);
          window.dispatchEvent(new CustomEvent('open-crm-record', { detail: rt }));
        } else onClose();
      } else { setSaveSuccess(true); setTimeout(()=>setSaveSuccess(false),2500); }
    } catch (e: any) {
      console.error('[RetailDetailPanel] handleSave', e);
      showAlert('Save failed: ' + (e?.message || 'An unexpected error occurred.'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (pendingReturnTo) {
      const rt = pendingReturnTo; setPendingReturnTo(null);
      window.dispatchEvent(new CustomEvent('open-crm-record', { detail: rt }));
    } else onClose();
  };

  const handleCreateInvoice = async () => {
    setCreatingInvoice(true);
    const inv = await createRetailInvoiceFromOrder(edited);
    setCreatingInvoice(false);
    if (inv) { showAlert(`Invoice ${inv.invoice_number} created from this order.`, { variant:'success', title:'Invoice Created' }); onSaved?.(); handleClose(); }
  };

  // Resolve TAX_PRODUCT / TAX_DOCUMENT placeholder field sets dynamically
  const resolveFields = (fields) => {
    let out = fields;
    if (fields === 'TAX_PRODUCT') out = taxRegime.productFields.map(f => ({ ...f }));
    else if (fields === 'TAX_DOCUMENT') out = taxRegime.documentFields.map(f => ({ ...f }));
    return out.filter(f => typeof f.showIf !== 'function' || f.showIf(appPreferences));
  };

  const renderField = (field) => {
    const v = edited[field.key];
    if (field.type === 'status') return (
      isStatusDropdownLocked
        ? <div className={`${sCls} bg-gray-50 cursor-not-allowed flex items-center`}>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(v)}`}>{v}</span>
          </div>
        : <select value={v||cfg.statusOptions[0]} onChange={async e=>{
            const newStatus = e.target.value;
            if (newStatus === v) return;
            const ok = await showConfirm(`Change status from "${v||cfg.statusOptions[0]}" to "${newStatus}"?`, { title:'Confirm Status Change', variant:'warning', confirmLabel:'Change Status' });
            if (ok) set(field.key, newStatus);
          }} className={sCls}>
            {cfg.statusOptions.map(o=><option key={o}>{o}</option>)}
          </select>
    );
    if (field.type === 'owner') {
      const allUsers = enterpriseUsers.length>0 ? enterpriseUsers : (currentUser?[currentUser]:[]);
      const resolved = allUsers.find(u => (edited.owner_id && u.id===edited.owner_id) || (!edited.owner_id && edited.owner && u.email===edited.owner));
      return <SearchableSelect
        value={resolved?.id||''}
        onChange={uid=>{ const u=allUsers.find(x=>x.id===uid); set('owner_id',u?.id||''); set('owner',u?.email||''); set('owner_name',((`${u?.first_name||''} ${u?.last_name||''}`.trim())||u?.email||'')); }}
        options={allUsers.map(u=>({value:u.id, label:(`${u.first_name||''} ${u.last_name||''}`.trim())||u.email||'User', sub:u.designation||u.email||''}))}
        placeholder="Select owner" emptyLabel="Unassigned"
      />;
    }
    if (field.type === 'retailCustomer') {
      // Resolve the selected customer: exact _uuid/id match first, then fall back to
      // matching by name when customer_id is empty/stale but a customer name string is present
      // (handles legacy records where customer_id holds a format not in the current retailCustomers list).
      const resolvedCustomer = retailCustomers.find(x => (x._uuid||x.id) === edited.customer_id)
        || (!edited.customer_id && edited.customer ? retailCustomers.find(x => x.name === edited.customer) : null);
      return <SearchableSelect
        value={resolvedCustomer?._uuid || resolvedCustomer?.id || edited.customer_id || ''}
        onChange={cid=>{ const c=retailCustomers.find(x=>(x._uuid||x.id)===cid); set('customer_id',c?._uuid||c?.id||''); set('customer',c?.name||''); set('customer_phone',c?.phone||''); }}
        options={retailCustomers.map(c=>({value:c._uuid||c.id,label:c.name,sub:[c.phone,c.email].filter(Boolean).join(' · ')}))}
        onCreateNew={name=>setQuickCreateCustomer({prefillName:name, onCreated:(id,cname,cphone)=>{ set('customer_id',id); set('customer',cname); if(cphone) set('customer_phone',cphone); }})}
        placeholder="Search customers..." emptyLabel="No customer"
        fallbackLabel={edited.customer || undefined}
      />;
    }
    if (field.type === 'retailInvoiceTemplate') {
      // Only available in detail panel context where these vars are defined
      if (typeof selectedTemplateId === 'undefined' || typeof invoiceTemplates === 'undefined') return null;
      return (
        <select
          value={selectedTemplateId||''}
          onChange={e => {
            setSelectedTemplateId(e.target.value);
            set('invoice_template_id', e.target.value);
          }}
          className={sCls}>
          <option value="">Select template...</option>
          {(invoiceTemplates||[]).map(tpl => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}{tpl.is_default ? ' ★ Default' : ''}
            </option>
          ))}
        </select>
      );
    }
    if (field.type === 'select') return (
      <select value={v||field.defaultValue||''} onChange={e=>set(field.key,e.target.value)} className={sCls}>
        {!field.defaultValue && <option value="">Select {field.label}</option>}
        {field.opts.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    );
    if (field.type === 'checkbox') return (
      <label className="flex items-center gap-2 cursor-pointer pt-1">
        <input type="checkbox" checked={!!v} onChange={e=>set(field.key,e.target.checked)} className="w-4 h-4 accent-blue-600"/>
        <span className="text-sm text-[#0F172A]">{field.label}</span>
      </label>
    );
    if (field.type === 'textarea') return <textarea rows={3} value={v||''} onChange={e=>set(field.key,e.target.value)} className={tCls} placeholder={field.label}/>;
    if (field.type === 'date') return <input type="date" value={v||''} onChange={e=>set(field.key,e.target.value)} className={iCls}/>;
    if (field.type === 'number') {
      const isNonNeg = ['stock_quantity','reorder_level','loyalty_points','price','mrp','cost',
        'gst_rate','vat_rate','tax_rate','tax_pct','quantity','shipping_cost',
        'total_discount','total_tax','subtotal','amount'].includes(field.key);
      const isPercent = ['gst_rate','vat_rate','tax_rate','discount_pct'].includes(field.key);
      const clamp = (raw) => {
        let n = raw === '' ? 0 : Number(raw) || 0;
        if (isNonNeg && n < 0) n = 0;
        if (isPercent && n > 100) n = 100;
        return n;
      };
      return (
        <div>
          <input type="number"
            value={v ?? 0}
            min={isNonNeg ? 0 : undefined}
            max={isPercent ? 100 : undefined}
            step={isPercent ? 0.5 : 1}
            onKeyDown={e => { if (isNonNeg && e.key === '-') e.preventDefault(); }}
            onChange={e => set(field.key, clamp(e.target.value))}
            onBlur={e => { const c = clamp(e.target.value); if (c !== v) set(field.key, c); }}
            className={iCls}/>
          {isNonNeg && typeof v === 'number' && v < 0 && (
            <p className="text-xs text-red-500 mt-1">⚠ Value cannot be negative</p>
          )}
        </div>
      );
    }
    if (field.type === 'orderRef') {
      const order = retailOrders?.find(o => o._uuid === v || o.order_number === v);
      const displayVal = order?.displayNumber
        ? 'RORD-' + String(order.displayNumber).padStart(5, '0')
        : (v && v.length > 14 ? v.slice(0, 14) + '...' : v || '—');
      return <input type="text" value={displayVal} readOnly className={`${iCls} bg-gray-50 text-gray-500 font-mono`}/>;
    }
    if (field.readOnly) return <input type="text" value={v||''} readOnly className={`${iCls} bg-gray-50 text-gray-500`}/>;
    // text / email / tel — with inline validation error
    const ferr = fieldErrors[field.key];
    return (
      <div>
        <input
          type={field.type==='email'?'email':field.type==='tel'?'tel':'text'}
          value={v||''}
          onChange={e=>set(field.key,e.target.value)}
          onBlur={e=>{ const validator=FIELD_VALIDATORS[field.key]; if(validator){ const err=validator(e.target.value); setFieldErrors(p=>err?{...p,[field.key]:err}:(({[field.key]:_,...rest})=>rest)(p)); }}}
          className={`${iCls} ${ferr?'border-red-400 focus:ring-red-400':''}`}
          placeholder={field.label}
          maxLength={field.key==='phone'||field.key==='customer_phone'||field.key==='mobile'?20:field.key==='postal_code'?10:field.key==='gstin'||field.key==='customer_gstin'?15:field.key==='hsn_code'?8:undefined}
        />
        {ferr && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><span>⚠</span>{ferr}</p>}
      </div>
    );
  };

  // ── Print engine ──────────────────────────────────────────────────────────
  function handleDirectPrint(template, record, lineItems) {
    if (!template) { showAlert('Please select an invoice template first.', { variant:'warning' }); return; }
    const html = buildRetailPrintHTML(template, record, lineItems, retailProducts);
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) { showAlert('Pop-up blocked. Please allow pop-ups for this site.', { variant:'warning' }); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 600);
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/50 z-[110] overflow-y-auto">
      <div className="bg-white rounded-[28px] shadow-2xl w-[98vw] my-4 mx-auto flex flex-col" style={{minHeight:'95vh'}}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-5 rounded-t-[28px] flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{cfg.icon}</span>
              <h2 className="text-white text-xl font-bold">{edited.name || edited.subject || edited[cfg.idField]}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(edited.status)}`}>{edited.status}</span>
            </div>
            <p className="text-blue-300 text-xs mt-1 flex items-center gap-2">
              {record.displayNumber && (
                <span className="bg-blue-600 text-white font-mono font-bold px-2.5 py-0.5 rounded-full text-xs tracking-wider">
                  {formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', record.displayNumber)}
                </span>
              )}
              <span className="font-mono opacity-60">{edited[cfg.idField]}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saveSuccess && <span className="text-green-300 text-sm font-semibold mr-2">✓ Saved</span>}
            {page==='retailOrders' && edited.status==='Completed' && (
              <button onClick={handleCreateInvoice} disabled={creatingInvoice}
                className="bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-600 disabled:opacity-50">
                {creatingInvoice?t(lang,'loading'):`🧾 ${t(lang,'create')} ${t(lang,'invoices')}`}
              </button>
            )}
            {page==='retailInvoices' && (
              <>
                <button
                  onClick={() => { setShowPrintPreview(true); }}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
                  👁️ Preview & Print
                </button>
                <button
                  onClick={() => handleDirectPrint(invoiceTemplates.find(t=>t.id===selectedTemplateId), edited, items)}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
                  🖨️ Print
                </button>
                {/* Fix 12: Share via WhatsApp or Email */}
                <button onClick={()=>{
                  const invNum = record?.displayNumber ? 'RINV-'+String(record.displayNumber).padStart(5,'0') : (edited.id||'');
                  const msg = encodeURIComponent(`Dear ${edited.customer||'Customer'}, please find your invoice ${invNum}. Total: ₹${edited.amount||0}. Thank you!`);
                  window.open('https://wa.me/?text='+msg,'_blank');
                }} className="bg-[#25D366] hover:bg-[#128C7E] text-white px-3 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </button>
                <button onClick={()=>{
                  const invNum = record?.displayNumber ? 'RINV-'+String(record.displayNumber).padStart(5,'0') : (edited.id||'');
                  const sub = encodeURIComponent('Invoice '+invNum);
                  const body = encodeURIComponent('Dear '+( edited.customer||'Customer')+',%0A%0APlease find your invoice '+invNum+'.%0ATotal: ₹'+(edited.amount||0)+'%0A%0AThank you!');
                  window.open('mailto:'+(edited.customer_email||edited.email||'')+'?subject='+sub+'&body='+body,'_blank');
                }} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-bold transition-all">
                  ✉️ Email
                </button>
              </>
            )}
            {checkingApproval && <span className="text-xs text-white/50">Checking approval rules…</span>}
            {canSubmitForApproval && (
              <button onClick={handleSubmitForApproval} disabled={submittingApproval}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl font-semibold bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-400/30 disabled:opacity-50"
                title={`Process: ${matchingProcess?.name}`}>
                📋 {submittingApproval ? t(lang,'loading') : t(lang,'submit')+' for Approval'}
              </button>
            )}
            <button onClick={()=>handleSave(false)} disabled={saving || isStatusLocked}
              className="bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/20 disabled:opacity-50">
              {saving?t(lang,'loading'):t(lang,'saveChanges')}
            </button>
            <button onClick={()=>handleSave(true)} disabled={saving || isStatusLocked}
              className="bg-white text-[#0F172A] px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50 disabled:opacity-50">
              {t(lang,'saveClose')}
            </button>
            <button onClick={handleClose} className="text-white/70 hover:text-white text-2xl leading-none ml-1">✕</button>
          </div>
        </div>

        {/* Tab bar — only for retailCustomers */}
        {page === 'retailCustomers' && (
          <div className="flex bg-slate-800 border-b border-slate-700 px-6 flex-shrink-0">
            {[
              {k:'details', l:'📋 Details'},
              {k:'360',     l:'🔄 Customer 360'},
            ].map(tb => (
              <button key={tb.k} onClick={()=>setActiveTab(tb.k)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                  activeTab===tb.k
                    ? 'border-blue-400 text-white'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}>
                {tb.l}
              </button>
            ))}
          </div>
        )}

        {/* Body — single scrollable container switching between tabs */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {isStatusLocked && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3">
              <span className="text-xl">🔒</span>
              <div>
                <p className="text-sm font-bold text-amber-800">This record is read-only</p>
                <p className="text-xs text-amber-600">Status is "{edited.status}" — fields cannot be edited in this state.</p>
              </div>
            </div>
          )}

          {page === 'retailCustomers' && activeTab === '360' ? (
            <RetailCustomer360
              customer={record}
              onNavigate={(targetPage, rec) => onC360Navigate?.(targetPage, rec)}
              onOpenCreate={(targetPage, prefill) => onC360Create?.(targetPage, prefill)}
            />
          ) : (
            <div className="space-y-6">
          {page === 'retailProducts' && (
            <ProductImages
              recordType="retailProducts"
              recordId={record.id}
              productTable="retail_products"
              productUuid={record._uuid}
              imageUrl={edited.image_url}
              onImageUrlChange={(url) => set('image_url', url)}
            />
          )}
          {page === 'retailProducts' && appPreferences?.business_type === 'rental' && edited.is_rentable && (
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-[#0F172A] text-sm">👗 This item is rentable</h4>
                <p className="text-xs text-gray-500">View its full booking calendar to see existing reservations and availability.</p>
              </div>
              <button onClick={() => setShowBookingCalendar(true)}
                className="px-4 py-2 rounded-xl bg-purple-700 text-white text-sm font-bold hover:bg-purple-800 flex-shrink-0">
                📅 View Bookings
              </button>
            </div>
          )}
          {showBookingCalendar && (
            <RentalBookingCalendar productId={record._uuid} productName={record.name} productPrice={edited.price} onClose={() => setShowBookingCalendar(false)}/>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cfg.sections.map(section => {
              const fields = resolveFields(section.fields);
              return (
                <div key={section.title} className="bg-white rounded-[20px] border border-blue-100 shadow-sm">
                  <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 rounded-t-[20px]">
                    <h3 className="font-bold text-[#0F172A] text-sm flex items-center gap-2"><span>{section.icon}</span>{section.title}</h3>
                  </div>
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {fields.map(field => (
                      <div key={field.key} className={field.full || field.type==='textarea' ? 'sm:col-span-2' : ''}>
                        {field.type!=='checkbox' && (
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                            {field.label}{field.required && <span className="text-red-400 ml-1">*</span>}
                            {field.helpText && <span className="ml-1 text-gray-300 font-normal" title={field.helpText}>ⓘ</span>}
                          </label>
                        )}
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>



          {/* Additional Information — App Composer custom fields, only when published */}
          {customFields.filter(cf => cf.show_on !== 'create').length > 0 && (
            <div className="bg-white rounded-[20px] border border-blue-100 shadow-sm">
              <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 rounded-t-[20px] flex items-center gap-2">
                <span>🎛️</span>
                <span className="font-bold text-[#0F172A] text-sm">Additional Information</span>
                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold ml-auto">App Composer</span>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customFields.filter(cf => cf.show_on !== 'create').map(cf => {
                  const cdVal = (edited.custom_data || {})[cf.api_name];
                  const setCdVal = (val) => setEdited(p => ({ ...p, custom_data: { ...(p.custom_data||{}), [cf.api_name]: val } }));
                  return (
                    <div key={cf.api_name} className={cf.field_type==='multi_select'?'sm:col-span-2':''}>
                      {cf.field_type !== 'checkbox' && (
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                          {cf.label}{cf.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                      )}
                      {cf.field_type==='single_select'
                        ? <select value={cdVal||''} onChange={e=>setCdVal(e.target.value)} className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-[#0F172A]">
                            <option value="">Select {cf.label}...</option>
                            {cf.options.map(o=><option key={o} value={o}>{o}</option>)}
                          </select>
                        : cf.field_type==='multi_select'
                        ? <div className="space-y-2">{cf.options.map(o=>(
                            <label key={o} className="flex items-center gap-2.5 cursor-pointer">
                              <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded"
                                checked={(cdVal||'').split('||').includes(o)}
                                onChange={e=>{const cur=(cdVal||'').split('||').filter(Boolean);const nxt=e.target.checked?[...cur,o]:cur.filter(x=>x!==o);setCdVal(nxt.join('||'));}}/>
                              <span className="text-sm text-[#0F172A]">{o}</span>
                            </label>
                          ))}</div>
                        : cf.field_type==='checkbox'
                        ? <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                            <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" checked={!!cdVal} onChange={e=>setCdVal(e.target.checked)}/>
                            <span className="text-sm font-semibold text-[#0F172A]">{cf.label}</span>
                          </label>
                        : <input
                            type={cf.field_type==='number'||cf.field_type==='currency'?'number':cf.field_type==='date'?'date':cf.field_type==='datetime'?'datetime-local':cf.field_type==='email'?'email':cf.field_type==='url'?'url':'text'}
                            value={cdVal||''} onChange={e=>setCdVal(e.target.value)} placeholder={cf.label}
                            className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-[#0F172A]"/>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Line items for Orders/Invoices */}
          {cfg.hasLineItems && (
            loadingLI
              ? <div className="bg-white rounded-[20px] border border-blue-100 shadow p-8 text-center text-gray-400">Loading line items...</div>
              : <RetailLineItems items={items} setItems={setItems} products={retailProducts} taxRegime={taxRegime} page={page}/>
          )}

          {/* System Information */}
          <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm">
            <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-100 rounded-t-[20px]">
              <h3 className="font-bold text-gray-500 text-sm flex items-center gap-2">⚙️ System Information</h3>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {[
                { l:'Record ID',    v: edited.id?.slice(0,16)+'...' },
                { l:'Display #',    v: edited.display_number ? (PAGE_DISPLAY_PREFIX[page]||'REC')+'-'+String(edited.display_number).padStart(5,'0') : '-' },
                { l:'Created At',   v: edited.created_at ? new Date(edited.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-' },
                { l:'Updated At',   v: edited.updated_at ? new Date(edited.updated_at).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-' },
                { l:'Owner',        v: edited.owner || '-' },
                { l:'Status',       v: edited.status || '-' },
                { l:'Currency',     v: edited.currency || appPreferences?.default_currency || 'INR' },
                { l:'Created By',   v: edited.created_by || edited.owner || '-' },
              ].map(f => (
                <div key={f.l}>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{f.l}</div>
                  <div className="text-[#0F172A] font-medium text-xs break-all">{f.v}</div>
                </div>
              ))}
            </div>
          </div>
            </div>
          )}
        </div>{/* end body flex-1 */}

        {/* Delete — always visible, outside the scrollable body */}
        <div className="flex justify-end px-6 py-3 border-t border-gray-100 flex-shrink-0">
          <button onClick={async()=>{ await deleteRetailRecord(page, edited.id); onSaved?.(); handleClose(); }}
            className="text-red-500 hover:text-red-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-red-50">
            🗑️ Delete {cfg.singular}
          </button>
        </div>
      </div>
    </div>

    {/* Quick Create Retail Customer */}
    {quickCreateCustomer && (
      <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4" onClick={()=>setQuickCreateCustomer(null)}>
        <div className="bg-white rounded-[24px] shadow-2xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
          <h3 className="font-bold text-[#0F172A] text-lg mb-4">👤 New Retail Customer</h3>
          <RetailQuickCreateCustomer
            prefillName={quickCreateCustomer.prefillName}
            onCreated={async(id,name,phone)=>{ quickCreateCustomer.onCreated(id,name,phone); setQuickCreateCustomer(null); await fetchRetailCustomers(); }}
            onClose={()=>setQuickCreateCustomer(null)}
          />
        </div>
      </div>
    )}

    {/* Print Preview Modal */}
    {showPrintPreview && page==='retailInvoices' && (
      <RetailInvoicePrintModal
        template={invoiceTemplates.find(t=>t.id===selectedTemplateId)}
        record={(() => {
          const allUsers = enterpriseUsers?.length > 0 ? enterpriseUsers : (currentUser ? [currentUser] : []);
          const u = allUsers.find(x => x.id === edited.owner_id || x.email === edited.owner);
          const ownerName = u ? (`${u.first_name||''} ${u.last_name||''}`.trim() || u.email || '') : edited.owner_name || edited.owner || '';
          return { ...edited, owner_name: ownerName };
        })()}
        items={items}
        products={retailProducts}
        onClose={()=>setShowPrintPreview(false)}
        onPrint={()=>{
          const allUsers = enterpriseUsers?.length > 0 ? enterpriseUsers : (currentUser ? [currentUser] : []);
          const u = allUsers.find(x => x.id === edited.owner_id || x.email === edited.owner);
          const ownerName = u ? (`${u.first_name||''} ${u.last_name||''}`.trim() || u.email || '') : edited.owner_name || edited.owner || '';
          handleDirectPrint(invoiceTemplates.find(t=>t.id===selectedTemplateId), {...edited, owner_name: ownerName}, items);
        }}
      />
    )}
    </>
  );
}

// ─── Create Modal ───────────────────────────────────────────────────────────
function RetailCreateModal({ page, open, onClose, onCreated, prefill = null }) {
  const { createRetailRecord, retailCustomers, enterpriseUsers, currentUser, appPreferences, appearance } = useApp();
  const { supabase } = useTenant();
  const { showAlert } = useAlert();
  const lang = appearance?.language || 'en';
  const cfg = RETAIL_CONFIG[page];
  const taxRegime = getTaxRegime(appPreferences?.default_currency);
  const [quickCreateCustomer, setQuickCreateCustomer] = useState(null);

  const defaultForm = () => ({
    status: cfg.statusOptions[0],
    currency: appPreferences?.default_currency || 'INR',
    owner_id: currentUser?.id, owner: currentUser?.email,
    owner_name: (`${currentUser?.first_name||''} ${currentUser?.last_name||''}`.trim()) || currentUser?.email || '',
    created_by: currentUser?.email,
    created_at: new Date().toISOString(),
    invoice_date: todayLocalISO(),
    order_date: todayLocalISO(),
    activity_date: todayLocalISO(),
    loyalty_points: 0, loyalty_tier: 'Standard', preferred_contact: 'Phone',
    country: 'India', unit: 'pc', price: 0, mrp: 0, cost: 0, stock_quantity: 0, reorder_level: 10,
    quantity: 1, payment_method: 'Cash', payment_status: 'Pending', channel: 'In-Store', delivery_method: 'Pickup', place_of_supply: 'Tamil Nadu',
    ...(taxRegime.regime==='india_gst' ? { gst_rate: 18 } : {}),
    ...(taxRegime.regime==='us_sales_tax' ? { taxable: 'Yes' } : {}),
    ...(taxRegime.regime==='uk_vat' ? { vat_rate: 20 } : {}),
  });

  const [form, setForm] = useState(defaultForm);

  // Apply prefill whenever it changes (e.g. when opened from Customer 360)
  useEffect(() => {
    if (open) {
      setForm({ ...defaultForm(), ...(prefill || {}) });
    }
  }, [open, prefill]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [createCustomFields, setCreateCustomFields] = useState([]);

  useEffect(() => {
    if (!open || !supabase || !page) return;
    supabase
      .from('app_custom_fields')
      .select('id,label,api_name,field_type,options,required,sort_order,show_on')
      .eq('object_type', page)
      .eq('is_active', true)
      .eq('is_published', true)
      .in('show_on', ['create','both'])
      .order('sort_order')
      .then(({ data }) => setCreateCustomFields((data||[]).map(f=>({...f,options:f.options||[]}))))
      .catch(()=>setCreateCustomFields([]));
  }, [open, page]);

  // form-reset-on-open removed — was wiping prefill data

  const s = (k,v) => setForm(p => ({ ...p, [k]: v }));

  // Use the configured sections' fields for the create form (excluding long-text/full fields)
  const createFields = useMemo(() => {
    const flat = [];
    for (const section of cfg.sections) {
      const fields = section.fields === 'TAX_PRODUCT' ? taxRegime.productFields
                    : section.fields === 'TAX_DOCUMENT' ? []
                    : section.fields;
      for (const f of fields) {
        if (['notes','comments','description','delivery_address'].includes(f.key)) continue;
        if (typeof f.showIf === 'function' && !f.showIf(appPreferences)) continue;
        flat.push(f);
      }
    }
    return flat;
  }, [page, appPreferences]);

  if (!open) return null;

  const validate = () => {
    const errs: Record<string,string> = {};
    for (const f of createFields) {
      const v = form[f.key];
      // Required check
      if (f.required) {
        const empty = v === undefined || v === null || v === '' || v === 0;
        if (f.type === 'retailCustomer') {
          if (!form.customer_id) errs[f.key] = 'Customer is required';
        } else if (empty) {
          errs[f.key] = `${f.label.replace(' *','')} is required`;
        }
      }
      // Format validation
      const validator = FIELD_VALIDATORS[f.key];
      if (validator && v) {
        const err = validator(v);
        if (err && !errs[f.key]) errs[f.key] = err;
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const firstErrKey = Object.keys(errs)[0];
      const firstField = createFields.find(f => f.key === firstErrKey);
      if (firstField) showAlert(`${firstField.label.replace(' *','')}: ${errs[firstErrKey]}`, { variant:'warning' });
    }
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const rec = await createRetailRecord(page, form, []);
      if (rec) { onCreated?.(rec); onClose(); }
    } catch (e: any) {
      console.error('[RetailCreateModal] handleCreate', e);
      showAlert('Save failed: ' + (e?.message || 'An unexpected error occurred.'));
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field) => {
    const v = form[field.key];
    if (field.type === 'status') return (
      <select value={v||cfg.statusOptions[0]} onChange={e=>s(field.key,e.target.value)} className={sCls}>
        {cfg.statusOptions.map(o=><option key={o}>{o}</option>)}
      </select>
    );
    if (field.type === 'owner') {
      const allUsers = enterpriseUsers.length>0 ? enterpriseUsers : (currentUser?[currentUser]:[]);
      return <SearchableSelect
        value={form.owner_id||''}
        onChange={uid=>{ const u=allUsers.find(x=>x.id===uid); s('owner_id',u?.id||''); s('owner',u?.email||''); s('owner_name',((`${u?.first_name||''} ${u?.last_name||''}`.trim())||u?.email||'')); }}
        options={allUsers.map(u=>({value:u.id,label:(`${u.first_name||''} ${u.last_name||''}`.trim())||u.email||'User', sub:u.designation||u.email||''}))}
        placeholder="Select owner" emptyLabel="Unassigned"
      />;
    }
    if (field.type === 'retailCustomer') return <SearchableSelect
      value={form.customer_id||''}
      onChange={cid=>{ const c=retailCustomers.find(x=>(x._uuid||x.id)===cid); s('customer_id',c?._uuid||c?.id||''); s('customer',c?.name||''); s('customer_phone',c?.phone||''); }}
      options={retailCustomers.map(c=>({value:c._uuid||c.id,label:c.name,sub:[c.phone,c.email].filter(Boolean).join(' · ')}))}
      onCreateNew={name=>setQuickCreateCustomer({prefillName:name, onCreated:(id,cname,cphone)=>{ s('customer_id',id); s('customer',cname); s('customer_phone',cphone||''); setQuickCreateCustomer(null); }})}
      placeholder="Search customers..." emptyLabel="No customers — type to create new"
      fallbackLabel={form.customer || undefined}
    />;
    if (field.type === 'retailInvoiceTemplate') {
      // Only available in detail panel context where these vars are defined
      if (typeof selectedTemplateId === 'undefined' || typeof invoiceTemplates === 'undefined') return null;
      return (
        <select
          value={selectedTemplateId||''}
          onChange={e => {
            setSelectedTemplateId(e.target.value);
            set('invoice_template_id', e.target.value);
          }}
          className={sCls}>
          <option value="">Select template...</option>
          {(invoiceTemplates||[]).map(tpl => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}{tpl.is_default ? ' ★ Default' : ''}
            </option>
          ))}
        </select>
      );
    }
    if (field.type === 'select') return (
      <select value={v??field.defaultValue??''} onChange={e=>s(field.key,e.target.value)} className={sCls}>
        {!field.defaultValue && <option value="">Select {field.label}</option>}
        {field.opts.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    );
    if (field.type === 'checkbox') return (
      <label className="flex items-center gap-2 cursor-pointer pt-1">
        <input type="checkbox" checked={!!v} onChange={e=>s(field.key,e.target.checked)} className="w-4 h-4 accent-blue-600"/>
        <span className="text-sm text-[#0F172A]">{field.label}</span>
      </label>
    );
    if (field.type === 'date') return <input type="date" value={v||''} onChange={e=>s(field.key,e.target.value)} className={iCls}/>;
    if (field.type === 'number') {
      const isNonNegField = ['stock_quantity','reorder_level','loyalty_points','price','mrp','cost','gst_rate','vat_rate','quantity'].includes(field.key);
      return <input type="number" value={v??0}
        min={isNonNegField ? 0 : undefined}
        onChange={e=>{const n=Number(e.target.value)||0; s(field.key, isNonNegField ? Math.max(0,n) : n);}}
        className={iCls}/>;
    }
    return (
      <div>
        <input
          type={field.type==='email'?'email':field.type==='tel'?'tel':'text'}
          value={v||''}
          onChange={e=>{ s(field.key,e.target.value); const validator=FIELD_VALIDATORS[field.key]; if(validator){const err=validator(e.target.value); setErrors(p=>err?{...p,[field.key]:err}:(({[field.key]:_,...rest})=>rest)(p));} }}
          className={`${iCls} ${errors[field.key]?'border-red-400':''}`}
          placeholder={field.label}
          maxLength={field.key==='phone'||field.key==='customer_phone'||field.key==='mobile'?20:field.key==='postal_code'?10:field.key==='gstin'||field.key==='customer_gstin'?15:field.key==='hsn_code'?8:undefined}
        />
        {errors[field.key] && <p className="text-xs text-red-500 mt-1">{errors[field.key]}</p>}
      </div>
    );
  };

  return (
    <>
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-5 flex items-center justify-between flex-shrink-0">
          <h2 className="text-white text-xl font-bold">{cfg.icon} Create {cfg.singular}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {createFields.map(f => (
              <div key={f.key} className={f.type==='textarea'?'sm:col-span-2':''}>
                {f.type!=='checkbox' && (
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    {f.label}{f.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                )}
                {renderField(f)}
              </div>
            ))}
          </div>

          {/* Additional Information — custom fields shown on create */}
          {createCustomFields.filter(cf=>!cf.show_on||cf.show_on==='both'||cf.show_on==='create').length > 0 && (
            <div className="mt-4 bg-blue-50/40 rounded-[18px] border border-blue-100 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                <span>🎛️</span> Additional Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {createCustomFields.filter(cf=>!cf.show_on||cf.show_on==='both'||cf.show_on==='create').map(cf=>{
                  const cdVal=(form.custom_data||{})[cf.api_name];
                  const setCdVal=(val)=>setForm(p=>({...p,custom_data:{...(p.custom_data||{}),[cf.api_name]:val}}));
                  const isWide=cf.field_type==='multi_select';
                  return (
                    <div key={cf.api_name} className={isWide?'sm:col-span-2':''}>
                      {cf.field_type!=='checkbox'&&<label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">{cf.label}{cf.required&&<span className="text-red-400 ml-1">*</span>}</label>}
                      {cf.field_type==='single_select'
                        ?<select value={cdVal||''} onChange={e=>setCdVal(e.target.value)} className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"><option value="">Select {cf.label}...</option>{cf.options.map(o=><option key={o}>{o}</option>)}</select>
                        :cf.field_type==='multi_select'
                        ?<div className="flex flex-wrap gap-3">{cf.options.map(o=>(<label key={o} className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-blue-600" checked={(cdVal||'').split('||').includes(o)} onChange={e=>{const cur=(cdVal||'').split('||').filter(Boolean);const nxt=e.target.checked?[...cur,o]:cur.filter(x=>x!==o);setCdVal(nxt.join('||'));}}/>{o}</label>))}</div>
                        :cf.field_type==='checkbox'
                        ?<label className="flex items-center gap-2 cursor-pointer pt-1"><input type="checkbox" className="w-4 h-4 accent-blue-600" checked={!!cdVal} onChange={e=>setCdVal(e.target.checked)}/><span className="text-sm font-semibold">{cf.label}</span></label>
                        :<input type={cf.field_type==='number'||cf.field_type==='currency'?'number':cf.field_type==='date'?'date':cf.field_type==='datetime'?'datetime-local':cf.field_type==='email'?'email':cf.field_type==='url'?'url':'text'} value={cdVal||''} onChange={e=>setCdVal(e.target.value)} placeholder={cf.label} className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0 bg-gray-50">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-100">{t(lang,'cancel')}</button>
          <button onClick={handleCreate} disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0F172A] to-blue-800 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 shadow-md">
            {saving?`⏳ ${t(lang,'loading')}`:`✓ ${t(lang,'create')} ${cfg.singular}`}
          </button>
        </div>
      </div>
    </div>
    {quickCreateCustomer && (
      <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4" onClick={()=>setQuickCreateCustomer(null)}>
        <div className="bg-white rounded-[24px] shadow-2xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
          <h3 className="font-bold text-[#0F172A] text-lg mb-4">👤 New Retail Customer</h3>
          <RetailQuickCreateCustomer
            prefillName={quickCreateCustomer.prefillName}
            onCreated={quickCreateCustomer.onCreated}
            onClose={()=>setQuickCreateCustomer(null)}
          />
        </div>
      </div>
    )}
    </>
  );
}

// ─── Main List Page ─────────────────────────────────────────────────────────

// ─── Retail Saved Search Panel ────────────────────────────────────────────────
function RetailSavedSearchPanel({ page, currentFilters, onApply, onClose }) {
  const { currentUser, savedSearches, fetchSavedSearches, createSavedSearch, updateSavedSearch, deleteSavedSearch, setDefaultSavedSearch } = useApp();
  const { showAlert, showConfirm } = useAlert();
  const [saveName, setSaveName] = useState('');
  const [saveDef,  setSaveDef]  = useState(false);
  const [saveGlobal, setSaveGlobal] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [filterText, setFilterText] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal,  setRenameVal]  = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  useEffect(() => { if (fetchSavedSearches) fetchSavedSearches(page); }, [page]);

  const pageFieldMeta = useMemo(() => getRetailFieldMeta(page), [page]);
  const retailFieldLabel = (key) => pageFieldMeta.find(f => f.key === key)?.label || key;

  const describe = (f) => {
    const parts = [];
    if (f.search)            parts.push(`Search: "${f.search}"`);
    if (f.status && f.status !== 'All') parts.push(`Status: ${f.status}`);
    if (f.timePeriod)        parts.push(f.timePeriod.replace(/_/g,' '));
    (f.advFilters||[]).forEach(c => { if (c.field && (c.value || c.op==='is_empty' || c.op==='is_not_empty' || c.op==='is_true' || c.op==='is_false')) parts.push(`${retailFieldLabel(c.field)} ${retailOperatorLabel(c.op)} ${c.value||''}`.trim()); });
    if (f.owner)             parts.push(`Owner: ${f.owner}`);
    if (f.sortField)         parts.push(`Sorted by ${retailFieldLabel(f.sortField)} (${f.sortDir==='desc'?'descending':'ascending'})`);
    return parts.length ? parts.join(' · ') : 'All records, no filters';
  };

  // Normalizes a filters object to a stable, defaulted shape before
  // comparing — a raw JSON.stringify comparison breaks the moment the two
  // objects have keys in a different order, or when one is missing a key
  // entirely (e.g. a saved search created before sortField/sortDir existed)
  // even though they're functionally identical once defaults are applied.
  const normalizeFilters = (f) => JSON.stringify({
    search: f?.search || '', status: f?.status || 'All', timePeriod: f?.timePeriod || '',
    advFilters: f?.advFilters || [], owner: f?.owner || '',
    sortField: f?.sortField || '', sortDir: f?.sortDir || 'asc',
  });
  const isCurrentlyApplied = (s) => normalizeFilters(s.filters) === normalizeFilters(currentFilters);

  const allForPage = (savedSearches||[]).filter(s => s.object_type === page);
  const q = filterText.trim().toLowerCase();
  const matchesQuery = (s) => !q || s.name.toLowerCase().includes(q) || describe(s.filters||{}).toLowerCase().includes(q);
  const mySearches     = allForPage.filter(s => s.created_by === currentUser?.email && matchesQuery(s));
  const globalSearches = allForPage.filter(s => s.is_global_default && s.created_by !== currentUser?.email && matchesQuery(s));

  const startRename = (s) => { setRenamingId(s.id); setRenameVal(s.name); };
  const confirmRename = async (s) => {
    if (renameVal.trim() && renameVal.trim() !== s.name && updateSavedSearch) await updateSavedSearch(s.id, { name: renameVal.trim() });
    setRenamingId(null);
  };
  const updateToCurrentFilters = async (s) => {
    if (!updateSavedSearch) return;
    const ok = await showConfirm(`Update "${s.name}" to match your current filters? This replaces what it currently searches for.`, { title:'Update Saved Search', variant:'warning', confirmLabel:'Update' });
    if (ok) await updateSavedSearch(s.id, { filters: currentFilters });
  };

  const SearchCard = ({ s }) => {
    const applied = isCurrentlyApplied(s);
    const isRenaming = renamingId === s.id;
    return (
      <div className={`border rounded-2xl p-4 transition-all ${applied ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-blue-100 hover:border-blue-300'}`}>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {isRenaming ? (
            <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') confirmRename(s); if(e.key==='Escape') setRenamingId(null); }}
              onBlur={()=>confirmRename(s)}
              className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-400"/>
          ) : (
            <button onClick={()=>startRename(s)} title="Click to rename" className="font-semibold text-[#0F172A] hover:text-blue-700 text-left">
              {s.name}
            </button>
          )}
          {s.is_global_default && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full flex-shrink-0">🌐 Team Default</span>}
          {s.is_default && !s.is_global_default && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full flex-shrink-0">⭐ My Default</span>}
          {applied && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full flex-shrink-0">✓ Applied</span>}
        </div>
        <div className="text-xs text-gray-400 mb-3">{describe(s.filters || {})}</div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { onApply(s.filters || {}); onClose(); }} disabled={applied}
            className="flex-1 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-2 rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-default">
            {applied ? 'Currently Applied' : 'Apply'}
          </button>
          {!applied && updateSavedSearch && <button onClick={()=>updateToCurrentFilters(s)} title="Update this search to match your current filters" className="bg-amber-100 text-amber-700 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-amber-200">🔄</button>}
          {!s.is_default && setDefaultSavedSearch && (
            <button onClick={() => setDefaultSavedSearch(s.id, s.is_global_default)} title="Set as default"
              className="bg-blue-100 text-blue-700 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-blue-200">⭐</button>
          )}
          <button onClick={()=>startRename(s)} title="Rename" className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-200">✎</button>
          {deleteSavedSearch && (
            <button onClick={() => deleteSavedSearch(s.id, s.name)} title="Delete"
              className="bg-red-100 text-red-500 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-red-200">🗑</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="absolute right-0 top-12 w-96 bg-white rounded-[28px] shadow-2xl border border-blue-100 z-50 overflow-hidden" style={{maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-4 flex items-center justify-between flex-shrink-0">
        <h3 className="text-white font-bold">🔖 Saved Searches</h3>
        <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
      </div>

      {allForPage.length >= 5 && (
        <div className="px-4 pt-3 flex-shrink-0">
          <input value={filterText} onChange={e=>setFilterText(e.target.value)} placeholder="Filter your saved searches..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-400"/>
        </div>
      )}

      <div className="p-4 space-y-4 overflow-y-auto">
        {/* Save current */}
        <div className="bg-blue-50 rounded-2xl overflow-hidden">
          <button onClick={()=>setShowSaveForm(!showSaveForm)} className="w-full flex items-center justify-between px-4 py-3 text-left">
            <span className="font-bold text-[#0F172A] text-sm">+ Save Current Filters</span>
            <span className="text-blue-600 text-xs">{showSaveForm ? 'Hide ▲' : 'Show ▼'}</span>
          </button>
          {showSaveForm && (
            <div className="px-4 pb-4 space-y-3">
              <input value={saveName} onChange={e => setSaveName(e.target.value)}
                placeholder="Name this search…"
                className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-400"/>
              <div className="text-xs text-gray-500 bg-white rounded-xl px-3 py-2 border border-blue-100">{describe(currentFilters)}</div>
              <label className="flex items-center gap-2 text-sm text-[#0F172A] cursor-pointer">
                <input type="checkbox" checked={saveDef} onChange={e => setSaveDef(e.target.checked)} className="w-4 h-4 accent-blue-600"/>
                Set as my default
              </label>
              <label className="flex items-center gap-2 text-sm text-[#0F172A] cursor-pointer">
                <input type="checkbox" checked={saveGlobal} onChange={e => setSaveGlobal(e.target.checked)} className="w-4 h-4 accent-purple-600"/>
                Make this the team default for everyone
              </label>
              <button
                onClick={async () => {
                  if (!saveName.trim()) { showAlert('Enter a name.', { variant:'warning' }); return; }
                  setSaving(true);
                  const r = await createSavedSearch({ name:saveName, object_type:page, filters:currentFilters, is_default:saveDef, is_global_default:saveGlobal });
                  setSaving(false);
                  if (r) { setSaveName(''); setSaveDef(false); setSaveGlobal(false); setShowSaveForm(false); }
                }}
                disabled={saving}
                className="w-full bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Search'}
              </button>
            </div>
          )}
        </div>
        {/* Global defaults */}
        {globalSearches.length > 0 && (
          <div>
            <h4 className="font-bold text-gray-500 text-xs uppercase tracking-wider mb-2">Team Defaults</h4>
            <div className="space-y-2">{globalSearches.map(s => <SearchCard key={s.id} s={s}/>)}</div>
          </div>
        )}
        {/* My searches */}
        <div>
          <h4 className="font-bold text-gray-500 text-xs uppercase tracking-wider mb-2">My Searches ({mySearches.length})</h4>
          {mySearches.length === 0
            ? <div className="text-gray-400 text-sm text-center py-6">
                {q ? 'No saved searches match your filter.' : 'No saved searches yet — set some filters above and save them for one-click access next time.'}
              </div>
            : <div className="space-y-2">{mySearches.map(s => <SearchCard key={s.id} s={s}/>)}</div>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Board (Kanban) view for retail list pages ─────────────────────────────
// Wires RETAIL_CONFIG's existing statusOptions and listColumns into the
// generic KanbanBoard component, so cards show the same key fields the
// table already does — no separate, hand-maintained field mapping that
// could drift out of sync with the table's own column config.
function RetailBoardView({ page, cfg, records, onCardClick, updateRetailRecord }) {
  const { fetchRetailLineItems } = useApp();
  const { showAlert } = useAlert();

  const handleStatusChange = async (record, newStatus) => {
    let items = [];
    if (cfg.hasLineItems) {
      // Fetch the record's EXISTING line items first — updateRetailRecord's
      // line-item save does a full delete-then-reinsert based on whatever's
      // passed in. Passing an empty array here for what should be a
      // status-only change would silently delete every line item on this
      // order or invoice. This mirrors exactly how RetailDetailPanel loads
      // line items before any edit, so a board-driven status change is just
      // as safe as one made from the detail view.
      const table = page === 'retailOrders' ? 'retail_order_line_items' : 'retail_invoice_line_items';
      try {
        items = (await fetchRetailLineItems(table, cfg.idField, record.id)) || [];
      } catch (e) {
        showAlert('Could not load this record\'s line items — status not changed.', { variant: 'danger' });
        return;
      }
    }
    await updateRetailRecord(page, { ...record, status: newStatus }, items);
  };

  return (
    <KanbanBoard
      records={records}
      statusOptions={cfg.statusOptions || []}
      getStatus={r => r.status}
      getId={r => r.id}
      onStatusChange={handleStatusChange}
      onCardClick={onCardClick}
      renderCard={r => (
        <div>
          <div className="font-bold text-sm text-[#0F172A] mb-1.5 truncate">{cfg.listColumns[0]?.v(r) ?? r.id}</div>
          {cfg.listColumns.slice(1, 4).map((col, i) => (
            <div key={i} className="text-xs text-gray-500 flex items-center justify-between gap-2 py-0.5">
              <span className="text-gray-400 flex-shrink-0">{col.h}</span>
              <span className="truncate text-right text-gray-700">{col.v(r)}</span>
            </div>
          ))}
        </div>
      )}
    />
  );
}

export default function RetailListPage({ page }) {
  const {
    retailCustomers, retailProducts, retailActivities, retailOrders, retailInvoices,
    fetchRetailCustomers, fetchRetailProducts, fetchRetailActivities, fetchRetailOrders, fetchRetailInvoices,
    pendingRecord, setPendingRecord, pendingReturnTo, setPendingReturnTo,
    enterpriseUsers, savedSearches, fetchSavedSearches, createSavedSearch,
    deleteSavedSearch, setDefaultSavedSearch, currentUser, appPreferences,
    createRetailInvoiceFromOrder, currentUserPermissions, permissionsLoaded,
    fetchListCount, listViewPrefs, fetchListViewPrefs, saveListViewPrefs, appearance,
    updateRetailRecord,
  } = useApp();
  const lang = appearance?.language || 'en';

  const cfg = RETAIL_CONFIG[page];

  const dataMap = { retailCustomers, retailProducts, retailActivities, retailOrders, retailInvoices };
  const fetchMap = {
    retailCustomers: fetchRetailCustomers, retailProducts: fetchRetailProducts,
    retailActivities: fetchRetailActivities, retailOrders: fetchRetailOrders,
    retailInvoices: fetchRetailInvoices,
  };
  const rawData = dataMap[page] || [];
  // Resolve the customer_id foreign key to an actual, human-readable name
  // before it's used anywhere — display, sort, and filter all read this
  // resolved field instead of the raw UUID from here on, so there's no
  // special-casing needed downstream.
  const data = useMemo(() => {
    if (!['retailActivities','retailOrders','retailInvoices'].includes(page)) return rawData;
    return rawData.map(r => ({
      ...r,
      customer_name_resolved: r.customer || retailCustomers.find(c => c._uuid === r.customer_id || c.id === r.customer_id)?.name || '',
    }));
  }, [rawData, retailCustomers, page]);

  // ── Filter state ───────────────────────────────────────────────────────────
  const [search,         setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [serverTotal,    setServerTotal]    = useState(null);
  const [statusFilter,   setStatusFilter]   = useState('All');
  const [timePeriod,     setTimePeriod]     = useState('');
  const [advFilters,     setAdvFilters]     = useState([]); // [{field, op, value, type}]
  const [ownerFilter,    setOwnerFilter]    = useState('');
  const [sortField,      setSortField]      = useState('');
  const [sortDir,        setSortDir]        = useState('asc');
  const [columnsOpen,    setColumnsOpen]    = useState(false);
  const fieldMeta = useMemo(() => getRetailFieldMeta(page), [page]);
  const DEFAULT_COLUMNS = RETAIL_DEFAULT_COLUMNS[page] || ['id','name'];
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const [pageSize,       setPageSize]       = useState(25);
  const [currentPage,    setCurrentPage]    = useState(1);
  const [selectedRecord, setSelectedRecord] = useState(null);
  // Table vs. board (Kanban) view — persisted per-page via sessionStorage.
  // Deliberately not using the server-side list_view_prefs table for this
  // first version (that table currently only stores columns/sort, and
  // adding a new field there is a larger, separate change); a session-level
  // preference is a reasonable starting point that can be upgraded to
  // server-persisted later if wanted.
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem(`bp_view_mode_${page}`) || 'table';
    return 'table';
  });
  // Re-read on page change — if this component instance is reused across
  // different retail pages rather than remounted, the useState initializer
  // above only ran once for whichever page was visited first, and viewMode
  // would otherwise incorrectly carry over to every other page instead of
  // reading that page's own stored preference.
  useEffect(() => {
    if (typeof window !== 'undefined') setViewMode(sessionStorage.getItem(`bp_view_mode_${page}`) || 'table');
  }, [page]);
  useEffect(() => {
    if (typeof window !== 'undefined') sessionStorage.setItem(`bp_view_mode_${page}`, viewMode);
  }, [viewMode, page]);
  const [createOpen,     setCreateOpen]     = useState(false);
  const [createPrefill,  setCreatePrefill]  = useState(null);
  const [c360Record,     setC360Record]     = useState(null); // {page, data} for cross-object creates
  const [searchPanel,    setSearchPanel]    = useState(false);
  const [menuOpenId,     setMenuOpenId]     = useState(null);
  const [defaultLoaded,  setDefaultLoaded]  = useState(false);

  const TIME_PERIODS_R = [
    { v:'',           l:'All Time' },
    { v:'today',      l:'Today' },
    { v:'yesterday',  l:'Yesterday' },
    { v:'last_7',     l:'Last 7 Days' },
    { v:'last_30',    l:'Last 30 Days' },
    { v:'this_month', l:'This Month' },
    { v:'last_month', l:'Last Month' },
    { v:'this_year',  l:'This Year' },
  ];

  const DATE_FIELD = { retailOrders:'order_date', retailInvoices:'invoice_date', retailActivities:'activity_date', retailCustomers:'created_at', retailProducts:'created_at' };

  const applyTimePeriodFilter = (rows) => {
    if (!timePeriod) return rows;
    const df = DATE_FIELD[page] || 'created_at';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const starts = {
      today: today, yesterday: new Date(today.getTime()-86400000),
      last_7: new Date(today.getTime()-7*86400000), last_30: new Date(today.getTime()-30*86400000),
      this_month: new Date(now.getFullYear(),now.getMonth(),1),
      last_month: new Date(now.getFullYear(),now.getMonth()-1,1),
      this_year: new Date(now.getFullYear(),0,1),
    };
    const ends = { yesterday: today, last_month: new Date(now.getFullYear(),now.getMonth(),1) };
    const start = starts[timePeriod]; const end = ends[timePeriod];
    return rows.filter(r => {
      const raw = r[df] || r.created_at; if (!raw) return false;
      const d = new Date(String(raw).slice(0,10)); if (isNaN(d.getTime())) return false;
      if (start && d < start) return false;
      if (end   && d >= end)  return false;
      return true;
    });
  };

  const canDo = (action) => {
    if (!permissionsLoaded) return true;
    if ((currentUserPermissions||[]).includes('__admin__')) return true;
    const PCODE = {
      retailCustomers: `retail_customers_${action}`, retailProducts: `retail_products_${action}`,
      retailActivities:`retail_activities_${action}`, retailOrders: `retail_orders_${action}`,
      retailInvoices:  `retail_invoices_${action}`,
    };
    return (currentUserPermissions||[]).includes(PCODE[page] || `${page}_${action}`);
  };

  // Cross-object navigation from Customer 360 — runs as an effect, never during render
  useEffect(() => {
    if (!c360Record) return;
    setPendingRecord({ page: c360Record.page, record: c360Record.record });
    window.dispatchEvent(new CustomEvent('retail-navigate', { detail: { page: c360Record.page } }));
    setC360Record(null);
  }, [c360Record]);

  useEffect(() => {
    const h = (e) => { if (!e.target.closest('[data-menu-container]')) setMenuOpenId(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (fetchSavedSearches) fetchSavedSearches(page);
    setSearch(''); setStatusFilter('All'); setTimePeriod('');
    setAdvFilters([]); setOwnerFilter('');
    setCurrentPage(1); setDefaultLoaded(false);
    setVisibleColumns(RETAIL_DEFAULT_COLUMNS[page] || ['id','name']); setSortField(''); setSortDir('asc');
    if (fetchListViewPrefs) fetchListViewPrefs(page).then(saved => {
      if (!saved) return;
      if (saved.columns?.length) setVisibleColumns(saved.columns);
      if (saved.sort?.field) { setSortField(saved.sort.field); setSortDir(saved.sort.direction||'asc'); }
    });
    setTimeout(() => setDefaultLoaded(true), 300);
  }, [page]);

  // Debounce search input (300ms) so filtering doesn't recompute on every
  // keystroke against a potentially large in-memory array.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Server-side exact row count — accurate even though only LIST_FETCH_LIMIT
  // rows are loaded into retailCustomers/retailOrders/etc. client-side.
  useEffect(() => {
    let cancelled = false;
    fetchListCount(page).then(c => { if (!cancelled) setServerTotal(c); });
    return () => { cancelled = true; };
  }, [page]);

  useEffect(() => {
    if (!defaultLoaded || !savedSearches?.length) return;
    const def = savedSearches.find(s => s.object_type===page && s.is_default)
             || savedSearches.find(s => s.object_type===page && s.is_global_default);
    if (def?.filters) applyFilters(def.filters);
  }, [defaultLoaded]);

  useEffect(() => {
    if (!pendingRecord) return;
    if (pendingRecord.page === page) {
      if (pendingRecord.record) {
        setSelectedRecord(pendingRecord.record);
        setPendingRecord(null);
      } else if (pendingRecord.openCreate) {
        // Open create modal — prefill is passed via prop to RetailCreateModal
        setCreateOpen(true);
        // Don't clear pendingRecord yet — RetailCreateModal reads prefill from it
      }
    }
  }, [pendingRecord, page]);

  const applyFilters = (f) => {
    if (f.search      !== undefined) setSearch(f.search || '');
    if (f.status      !== undefined) setStatusFilter(f.status || 'All');
    if (f.timePeriod  !== undefined) setTimePeriod(f.timePeriod || '');
    if (f.advFilters  !== undefined) setAdvFilters(f.advFilters || []);
    if (f.owner       !== undefined) setOwnerFilter(f.owner || '');
    if (f.sortField   !== undefined) { setSortField(f.sortField||''); setSortDir(f.sortDir||'asc'); }
    setCurrentPage(1);
  };

  const currentFilters = { search, status: statusFilter, timePeriod, advFilters, owner: ownerFilter, sortField, sortDir };

  const filtered = useMemo(() => {
    let rows = data;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      const fmtDisplayNum = r => r.displayNumber
        ? formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', r.displayNumber)
        : (r.display_number ? formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', r.display_number) : '');
      rows = rows.filter(r => [
        r.display_number, r[cfg?.idField], fmtDisplayNum(r),
        r.name, r.email, r.phone,
        r.customer, r.customer_phone, r.subject, r.sku, r.barcode,
        r.brand, r.category, r.channel,
      ].some(v => String(v||'').toLowerCase().includes(q)));
    }
    if (statusFilter !== 'All') rows = rows.filter(r => r.status === statusFilter);
    rows = applyTimePeriodFilter(rows);
    // Advanced filters — every condition must match (AND), covering any field
    // on the object (not a small hardcoded subset like before).
    advFilters.forEach(cond => {
      if (!cond.field) return;
      const needsValue = !['is_empty','is_not_empty','is_true','is_false'].includes(cond.op);
      if (needsValue && (cond.value===undefined || cond.value==='')) return;
      rows = rows.filter(r => retailMatchesCondition(r, cond));
    });
    if (ownerFilter) rows = rows.filter(r => r.owner === ownerFilter || r.owner_id === ownerFilter);
    return rows;
  }, [data, debouncedSearch, statusFilter, timePeriod, advFilters, ownerFilter]);

  // Sorting — applied after filtering, before pagination.
  const sorted = useMemo(() => {
    if (!sortField) return filtered;
    const meta = fieldMeta.find(f => f.key === sortField);
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      if (meta?.type === 'number') return (Number(av) - Number(bv)) * dir;
      if (meta?.type === 'date')   return (new Date(av).getTime() - new Date(bv).getTime()) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sortField, sortDir, fieldMeta]);

  const toggleSort = (key) => {
    if (sortField !== key) { setSortField(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortField(''); setSortDir('asc'); }
  };

  const totalRecords = sorted.length;
  const totalPages   = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage     = Math.min(currentPage, totalPages);
  const pagedRows    = sorted.slice((safePage-1)*pageSize, safePage*pageSize);
  const activeCount  = (debouncedSearch?1:0) + (statusFilter!=='All'?1:0) + (timePeriod?1:0) + advFilters.filter(c=>c.field).length + (ownerFilter?1:0);
  const clearFilters = () => { setSearch(''); setStatusFilter('All'); setTimePeriod(''); setAdvFilters([]); setOwnerFilter(''); setCurrentPage(1); };
  const addFilterRow = () => { const f = fieldMeta.find(f=>f.key!=='id')||fieldMeta[0]; setAdvFilters(p=>[...p,{field:f.key,type:f.type,op:RETAIL_OPERATORS[f.type][0].v,value:''}]); };
  const updateFilterRow = (idx, patch) => setAdvFilters(p => p.map((c,i) => i===idx ? {...c,...patch} : c));
  const removeFilterRow = (idx) => setAdvFilters(p => p.filter((_,i) => i!==idx));
  const persistColumns = (cols, sf=sortField, sd=sortDir) => { setVisibleColumns(cols); if (saveListViewPrefs) saveListViewPrefs(page, { columns: cols, sort: { field: sf, direction: sd } }); };
  const toggleColumn = (key) => persistColumns(visibleColumns.includes(key) ? visibleColumns.filter(c=>c!==key) : [...visibleColumns, key]);
  const moveColumn = (idx, dir) => { const cols=[...visibleColumns]; const j=idx+dir; if (j<0||j>=cols.length) return; [cols[idx],cols[j]]=[cols[j],cols[idx]]; persistColumns(cols); };
  const fmtRetailCell = (r, meta) => {
    const v = r[meta.key];
    if (meta.key === 'id') return r.displayNumber ? formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', r.displayNumber) : (r[cfg.idField] || r.id);
    if (meta.key === 'order_number' && page === 'retailInvoices') {
      if (!v) return '-';
      const ord = retailOrders.find(o => o._uuid === v || o.order_number === v || o.id === v);
      if (ord?.displayNumber) return 'RORD-' + String(ord.displayNumber).padStart(5, '0');
      return String(v).length > 14 ? String(v).slice(0,14)+'...' : v;
    }
    if (meta.type === 'date')    return v ? formatDate(v) : '-';
    if (meta.type === 'boolean') return v ? 'Yes' : 'No';
    if (['amount','price','cost','mrp'].includes(meta.key)) return v!=null ? formatCurrency(Number(v)) : '-';
    return v!=null && v!=='' ? String(v) : '-';
  };

  if (!cfg) return <div className="p-6 text-gray-400">Unknown retail page: {page}</div>;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">{cfg.icon} {cfg.title}</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {totalRecords} of {(serverTotal !== null ? serverTotal : data.length).toLocaleString()} record{data.length!==1?'s':''}
            {serverTotal !== null && data.length >= 500 && serverTotal > data.length && (
              <span className="text-amber-600 font-semibold"> · showing {data.length.toLocaleString()} most recent (search covers loaded records only)</span>
            )}
            {activeCount > 0 && <span className="text-blue-600 font-semibold"> · {activeCount} filter{activeCount>1?'s':''} active</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-[#0F172A] flex items-center gap-1 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50">
              ✕ Clear filters
            </button>
          )}
          {canDo('create') && (
            <button onClick={() => setCreateOpen(true)} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow hover:opacity-90">
              + Create {cfg.singular}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input value={search} onChange={e=>{setSearch(e.target.value);setCurrentPage(1);}}
            placeholder={t(lang,'search')+'…'}
            className="border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-400"/>
          <select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setCurrentPage(1);}}
            className="border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="All">{t(lang,'allStatuses')}</option>
            {cfg.statusOptions.map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={timePeriod} onChange={e=>{setTimePeriod(e.target.value);setCurrentPage(1);}}
            className="border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
            {TIME_PERIODS_R.map(tp=><option key={tp.v} value={tp.v}>{tp.l}</option>)}
          </select>
          <select value={ownerFilter} onChange={e=>{setOwnerFilter(e.target.value);setCurrentPage(1);}}
            className="border border-blue-200 rounded-xl px-4 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">{t(lang,'allOwners')}</option>
            {enterpriseUsers.map(u=><option key={u.id} value={u.email}>{u.first_name} {u.last_name}</option>)}
          </select>
        </div>

        {/* Advanced filters — any field on the object, AND-combined */}
        {advFilters.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-blue-50">
            {advFilters.map((cond, idx) => {
              const meta = fieldMeta.find(f=>f.key===cond.field) || fieldMeta[0];
              const needsValue = !['is_empty','is_not_empty','is_true','is_false'].includes(cond.op);
              return (
                <div key={idx} className="flex flex-wrap gap-2 items-center bg-blue-50/50 rounded-xl p-2">
                  <select value={cond.field} onChange={e=>{const m=fieldMeta.find(f=>f.key===e.target.value);updateFilterRow(idx,{field:e.target.value,type:m.type,op:RETAIL_OPERATORS[m.type][0].v,value:''});}}
                    className="border border-blue-200 rounded-lg px-2 py-1.5 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                    {fieldMeta.filter(f=>f.key!=='id').map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                  <select value={cond.op} onChange={e=>{setCurrentPage(1);updateFilterRow(idx,{op:e.target.value});}}
                    className="border border-blue-200 rounded-lg px-2 py-1.5 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                    {RETAIL_OPERATORS[meta.type].map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                  {needsValue && (
                    meta.type==='select' && meta.opts?.length
                      ? <select value={cond.value} onChange={e=>{setCurrentPage(1);updateFilterRow(idx,{value:e.target.value});}} className="flex-1 min-w-[100px] border border-blue-200 rounded-lg px-2 py-1.5 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                          <option value="">Select…</option>
                          {meta.opts.map(o=><option key={o} value={o}>{o}</option>)}
                        </select>
                      : <input type={meta.type==='date'?'date':meta.type==='number'?'number':'text'} value={cond.value} onChange={e=>{setCurrentPage(1);updateFilterRow(idx,{value:e.target.value});}} placeholder="Value"
                          className="flex-1 min-w-[100px] border border-blue-200 rounded-lg px-2 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-400"/>
                  )}
                  <button onClick={()=>removeFilterRow(idx)} className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-xs font-bold flex items-center justify-center flex-shrink-0">✕</button>
                </div>
              );
            })}
          </div>
        )}
        <div className="pt-2 border-t border-blue-50">
          <button onClick={addFilterRow} className="text-xs font-semibold text-blue-600 hover:underline">{t(lang,'addFilter')}</button>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-blue-50 flex-wrap">
          <div className="text-xs text-blue-600 font-medium">{activeCount > 0 ? `${activeCount} filter${activeCount>1?'s':''} active` : ''}</div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={()=>setColumnsOpen(!columnsOpen)} className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all ${columnsOpen?'bg-[#0F172A] text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                ⚙️ {t(lang,'columns')} <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${columnsOpen?'bg-white/20 text-white':'bg-gray-200 text-gray-600'}`}>{visibleColumns.length}</span>
              </button>
              {columnsOpen && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-[24px] shadow-2xl border border-blue-100 z-50 overflow-hidden" style={{maxHeight:'70vh',overflowY:'auto'}}>
                  <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3 flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm">Customize Columns</h3>
                    <button onClick={()=>setColumnsOpen(false)} className="text-white/70 hover:text-white">✕</button>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-400 px-2 pb-2">Shown, in order — use ↑↓ to reorder.</p>
                    {visibleColumns.map((key, idx) => {
                      const meta = fieldMeta.find(f=>f.key===key);
                      if (!meta) return null;
                      return (
                        <div key={key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 rounded-xl">
                          <span className="flex-1 text-sm text-[#0F172A]">{meta.label}</span>
                          <button onClick={()=>moveColumn(idx,-1)} disabled={idx===0} className="w-6 h-6 rounded text-gray-400 hover:text-[#0F172A] disabled:opacity-20 text-xs">▲</button>
                          <button onClick={()=>moveColumn(idx,1)} disabled={idx===visibleColumns.length-1} className="w-6 h-6 rounded text-gray-400 hover:text-[#0F172A] disabled:opacity-20 text-xs">▼</button>
                          <button onClick={()=>toggleColumn(key)} className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-xs font-bold flex items-center justify-center">✕</button>
                        </div>
                      );
                    })}
                    <div className="border-t border-gray-100 mt-2 pt-2">
                      <p className="text-xs text-gray-400 px-2 pb-1">Add a column</p>
                      {fieldMeta.filter(f=>!visibleColumns.includes(f.key)).map(f => (
                        <button key={f.key} onClick={()=>toggleColumn(f.key)} className="w-full text-left px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-xl">+ {f.label}</button>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 mt-2 pt-2 px-2">
                      <button onClick={()=>persistColumns(DEFAULT_COLUMNS)} className="text-xs text-gray-400 hover:text-[#0F172A]">Reset to default</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={()=>setSearchPanel(!searchPanel)}
                className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all ${searchPanel?'bg-[#0F172A] text-white':'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                🔖 {t(lang,'savedSearches')}
                {(savedSearches||[]).filter(s=>s.object_type===page).length > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${searchPanel?'bg-white/20 text-white':'bg-blue-200 text-blue-700'}`}>
                    {(savedSearches||[]).filter(s=>s.object_type===page).length}
                  </span>
                )}
              </button>
              {searchPanel && (
                <RetailSavedSearchPanel page={page} currentFilters={currentFilters} onApply={applyFilters} onClose={()=>setSearchPanel(false)}/>
              )}
            </div>
            {/* Table / Board view toggle */}
            <div className="flex items-center bg-gray-100 rounded-xl p-1">
              <button onClick={()=>setViewMode('table')} title="Table view"
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode==='table' ? 'bg-white shadow-sm text-[#0F172A]' : 'text-gray-500 hover:text-gray-700'}`}>
                ☰ Table
              </button>
              <button onClick={()=>setViewMode('board')} title="Board view"
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode==='board' ? 'bg-white shadow-sm text-[#0F172A]' : 'text-gray-500 hover:text-gray-700'}`}>
                🗂️ Board
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'board' ? (
        <RetailBoardView
          page={page}
          cfg={cfg}
          records={sorted}
          onCardClick={setSelectedRecord}
          updateRetailRecord={updateRetailRecord}
        />
      ) : (
      <>
      {/* Table */}
      <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-[#0F172A] to-blue-900 text-white">
              <tr>
                {visibleColumns.map(key => {
                  const meta = fieldMeta.find(f=>f.key===key);
                  if (!meta) return null;
                  const align = ['amount','price','cost','mrp','stock_quantity','loyalty_points'].includes(key) ? 'text-right' : 'text-left';
                  return (
                    <th key={key} onClick={()=>toggleSort(key)} className={`px-5 py-3.5 ${align} text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-white/10 whitespace-nowrap`}>
                      {meta.label} {sortField===key && (sortDir==='asc' ? '▲' : '▼')}
                    </th>
                  );
                })}
                <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wider w-24">{t(lang,'actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr><td colSpan={visibleColumns.length+1} className="px-5 py-16 text-center">
                  <div className="text-5xl mb-3">{activeCount>0?'🔍':cfg.icon}</div>
                  <div className="font-bold text-[#0F172A] text-lg mb-1">{activeCount>0?t(lang,'noRecordsFound'):`No ${cfg.title.toLowerCase()} yet`}</div>
                  <p className="text-gray-400 text-sm">{activeCount>0?t(lang,'tryAdjustingFilters'):`Click "+ Create ${cfg.singular}" to add your first record.`}</p>
                  {activeCount>0 && <button onClick={clearFilters} className="mt-3 text-blue-600 text-sm font-semibold hover:underline">{t(lang,'clearFilters')}</button>}
                </td></tr>
              ) : pagedRows.map(r => (
                <tr key={r.id} className="border-t border-blue-50 hover:bg-blue-50/40 transition-all">
                  {visibleColumns.map((key, ci) => {
                    const meta = fieldMeta.find(f=>f.key===key);
                    if (!meta) return null;
                    if (key === 'id') return (
                      <td key={key} className="px-5 py-3.5">
                        <button onClick={()=>setSelectedRecord(r)}>
                          <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full border border-blue-100 cursor-pointer transition-all">
                            {fmtRetailCell(r, meta)}
                          </span>
                        </button>
                      </td>
                    );
                    if (key === 'status') return (
                      <td key={key} className="px-5 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(r.status)}`}>{r.status}</span>
                      </td>
                    );
                    const align = ['amount','price','cost','mrp','stock_quantity','loyalty_points'].includes(key) ? 'text-right font-semibold text-[#0F172A]' : 'text-gray-700';
                    const isFirstTextCol = ci === visibleColumns.findIndex(k=>k!=='id');
                    return (
                      <td key={key} className={`px-5 py-3.5 ${align}`}>
                        {isFirstTextCol
                          ? <button onClick={()=>setSelectedRecord(r)} className="font-semibold text-[#0F172A] hover:text-blue-700 hover:underline text-left">{fmtRetailCell(r, meta)}</button>
                          : fmtRetailCell(r, meta)}
                      </td>
                    );
                  })}
                  <td className="px-5 py-3.5">
                    <div className="relative flex justify-center" data-menu-container>
                      <button onClick={()=>setMenuOpenId(menuOpenId===r.id?null:r.id)}
                        className="w-8 h-8 rounded-full bg-[#0F172A] text-white hover:bg-blue-800 flex items-center justify-center text-lg font-bold shadow transition-all">⋮</button>
                      {menuOpenId===r.id && (
                        <div className="absolute right-0 top-9 bg-[#0F172A] border border-blue-800 shadow-2xl rounded-2xl p-2 z-[999] min-w-[220px]">
                          <button onClick={()=>{setSelectedRecord(r);setMenuOpenId(null);}} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">📄 Open Details</button>
                          {page==='retailCustomers' && (<>
                            <div className="border-t border-blue-800 my-1"/>
                            <button onClick={()=>{setMenuOpenId(null);setCreatePrefill({page:'retailOrders',data:{...buildCustomerPrefill(r),order_date:todayLocalISO(),status:'Draft',channel:'In-Store'}});}} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">🛒 Create Order</button>
                            <button onClick={()=>{setMenuOpenId(null);setCreatePrefill({page:'retailInvoices',data:{...buildCustomerPrefill(r),invoice_date:todayLocalISO(),status:'Draft',payment_status:'Pending'}});}} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">🧾 Create Invoice</button>
                          </>)}
                          {page==='retailOrders' && r.status==='Completed' && (
                            <button onClick={()=>{createRetailInvoiceFromOrder(r);setMenuOpenId(null);}} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">🧾 Create Invoice</button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalRecords > 0 && (
          <div className="px-6 py-3 border-t border-blue-50 bg-white flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                Showing <strong className="text-[#0F172A]">{(safePage-1)*pageSize+1}–{Math.min(safePage*pageSize,totalRecords)}</strong> of <strong className="text-[#0F172A]">{totalRecords}</strong> records
              </span>
              <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setCurrentPage(1);}}
                className="border border-blue-200 rounded-lg px-2 py-1 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                {[10,25,50,100].map(n=><option key={n} value={n}>{n} per page</option>)}
              </select>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={()=>setCurrentPage(1)} disabled={safePage===1} className="px-2 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-30">«</button>
                <button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={safePage===1} className="px-3 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-30">‹ Prev</button>
                {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
                  const pg = Math.max(1,Math.min(totalPages-4,safePage-2))+i;
                  return <button key={pg} onClick={()=>setCurrentPage(pg)} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${pg===safePage?'bg-[#0F172A] text-white':'text-gray-500 hover:bg-blue-50'}`}>{pg}</button>;
                })}
                <button onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={safePage===totalPages} className="px-3 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-30">Next ›</button>
                <button onClick={()=>setCurrentPage(totalPages)} disabled={safePage===totalPages} className="px-2 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-30">»</button>
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}

      {selectedRecord && (
        <RetailDetailPanel
          page={page} record={selectedRecord} pendingReturnTo={pendingReturnTo}
          onClose={()=>{
            setSelectedRecord(null);
            if (pendingReturnTo) { const rt=pendingReturnTo; setPendingReturnTo(null); window.dispatchEvent(new CustomEvent('open-crm-record',{detail:rt})); }
          }}
          onSaved={()=>fetchMap[page]?.()}
          onC360Navigate={(targetPage, rec) => setC360Record({ page: targetPage, record: rec })}
          onC360Create={(targetPage, prefill) => setCreatePrefill({ page: targetPage, data: prefill })}
        />
      )}
      <RetailCreateModal page={page} open={createOpen} onClose={()=>{setCreateOpen(false);setPendingRecord(null);}} onCreated={()=>{fetchMap[page]?.();setPendingRecord(null);}} prefill={pendingRecord?.openCreate ? pendingRecord.prefill : null}/>
      {/* Cross-object create modal — for Create Order/Invoice from customer list/360 */}
      {/* c360 navigation handled by effect below (was an in-render setTimeout) */}

      {createPrefill && (
        <RetailCreateModal
          page={createPrefill.page}
          open={true}
          onClose={()=>setCreatePrefill(null)}
          onCreated={async()=>{
            // Refresh whichever data type was created
            const f = { retailOrders: fetchRetailOrders, retailInvoices: fetchRetailInvoices, retailActivities: fetchRetailActivities };
            await f[createPrefill.page]?.();
            setCreatePrefill(null);
          }}
          prefill={createPrefill.data}
        />
      )}
    </div>
  );
}
