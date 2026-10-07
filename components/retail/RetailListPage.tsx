// @ts-nocheck
'use client';

import { isTemplateDefault, gatherTemplates, useTemplateDefaults } from '@/lib/defaultTemplates';
import RedwoodSavedSearchBar from '@/components/shared/RedwoodSavedSearchBar';
import RedwoodSkin from '@/components/shared/RedwoodSkin';
import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { waFetch } from '@/lib/waFetch';
import { useApp } from '@/context/AppContext';
import { createGridEnabled } from '@/lib/lineLayout';
import RecordHighlights from '@/components/shared/RecordHighlights';
import { getStatusColor, formatCurrency, formatDate, formatDisplayNumber, PAGE_DISPLAY_PREFIX, tenantScope, todayLocalISO } from '@/lib/utils';
// useCustomFields hook used inline below
import { useTenant } from '@/context/TenantContext';
import { resolveStatusOptions } from '@/lib/statusOptions';
import { getTaxRegime, computeLineNet, computeLineGross } from '@/lib/taxConfig';
import { useFieldMappingRules, applyFieldMapping } from '@/lib/useFieldMappingRules';
import SearchableSelect from '@/components/shared/SearchableSelect';
import ProductImages from '@/components/products/ProductImages';
import RentalBookingCalendar from '@/components/retail/RentalBookingCalendar';
import KanbanBoard from '@/components/shared/KanbanBoard';
import { RetailQuickCreateCustomer } from '@/components/retail/RetailQuickCreateCustomer';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useRbac } from '@/lib/useRbac';
import { useFieldLayout, resolveFieldRow, effectiveRows, resolveFieldDisplay, cfKey, resolveLayoutDefault } from '@/lib/useFieldLayout';
import { useObjectLabels, labelNow } from '@/lib/useObjectLabels';
import { useRelatedCols, withKeys, viewPermFor } from '@/components/shared/Related360';
import CustomRelatedLists from '@/components/shared/CustomRelatedLists';
import { NavIcon } from '@/lib/icons';
import { Search } from 'lucide-react';
import { fetchServerPage, timePeriodToRange, splitAdvFilters } from '@/lib/serverList';
import { useSearchCatalog, distinctValues } from '@/lib/searchCatalog';
import { useAlert } from '@/components/shared/AlertProvider';
import { useCustomFields } from '@/lib/useCustomFields';
import { canInvoiceOrder } from '@/lib/invoiceFlow';
import OrderedRow from '@/components/shared/OrderedRow';
import { generateInvoicePdf, blobToBase64 } from '@/lib/generateInvoicePdf';
import { buildDocumentHTML } from '@/lib/documentCanvas';
import { buildBookingReceiptHTML } from '@/lib/buildBookingReceiptHTML';
import { loadCanvasTemplates, mergeTemplates, pickDefault } from '@/lib/useDocumentTemplates';
import LineItemCustomFieldInput from '@/components/shared/LineItemCustomFieldInput';
import { t } from '@/lib/i18n';

import { relabelText } from '@/lib/useRelabel';
const RL = relabelText;

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

// Formats a retail customer's separate address fields into one readable
// multi-line string, for auto-filling an order's delivery address or an
// invoice's billing address when a customer is selected.
export const formatCustomerAddress = (c) => {
  if (!c) return '';
  const lines = [
    [c.address_line1, c.address_line2].filter(Boolean).join(', '),
    [c.city, c.state, c.postal_code].filter(Boolean).join(', '),
    c.country,
  ].filter(Boolean);
  return lines.join('\n');
};

export const RETAIL_CONFIG = {
  retailCustomers: {
    title: 'Retail Customers', icon: '🧑‍🤝‍🧑', get singular() { return labelNow('retailCustomers','Customer','singular'); },
    idField: 'customer_number',
    get statusOptions() { return resolveStatusOptions('retailCustomers', ['Active','Inactive','VIP','Blocked']); },
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
    title: 'Retail Products', icon: '🏷️', get singular() { return labelNow('retailProducts','Product','singular'); },
    idField: 'product_number',
    get statusOptions() { return resolveStatusOptions('retailProducts', ['Active','Inactive','Discontinued']); },
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
        { key:'unit', label:'Unit', type:'select', opts:['pc','each','kg','g','ltr','ml','box','pack','dozen'] },
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
        { key:'rental_pricing_basis', label:'Pricing Basis', type:'select', opts:['Per Day','Fixed Price'], showIf:(prefs)=>prefs?.business_type==='rental',
          desc:'Per Day = Rent Per Day x number of days. Fixed Price = the Selling Price is the all-in price for the whole booking or membership period (never multiplied by days) - use this for memberships and packages; Rent Per Day can then be left empty or hidden in the Page Layout Designer.' },
        { key:'rent_per_day', label:'Rent Per Day', type:'number', showIf:(prefs)=>prefs?.business_type==='rental',
          desc:'The daily rental rate for this item — used to price rental orders instead of the regular sale price above.' },
      ]},
      { icon:'🧾', title:'Tax & Description', fields:[
        { key:'hsn_code', label:'HSN/SAC Code', type:'text' },
        { key:'gst_rate', label:'GST Rate (%)', type:'number' },
        // Bug fix: DB column retail_products.taxable is TEXT ('Yes'/'No',
        // default 'Yes') — not boolean. It was previously typed as a
        // checkbox here, whose renderer does `checked={!!v}` (any non-empty
        // string, including "No", renders as checked) and writes back a
        // real boolean `true`/`false` on toggle. That boolean then got
        // stored into the text column as the literal string "true"/"false",
        // which the tax engine (lib/taxConfig.ts, `(line.taxable ?? 'Yes')
        // === 'Yes'`) never recognizes as taxable — so the selection looked
        // like it reverted on refresh. Matches the type already used for
        // this same field in FieldLayoutDesigner's standard field list.
        { key:'taxable', label:'Taxable', type:'select', opts:['Yes','No'], defaultValue:'Yes' },
        { key:'description', label:'Description', type:'textarea', full:true },
        { key:'comments', label:'Comments', type:'textarea', full:true },
      ]},
    ],
  },

  retailActivities: {
    title: 'Retail Activities', icon: '📅', get singular() { return labelNow('retailActivities','Activity','singular'); },
    idField: 'activity_number',
    get statusOptions() { return resolveStatusOptions('retailActivities', ['Open','In Progress','Completed','Cancelled']); },
    listColumns: [
      { h: 'Subject', v: r => r.subject },
      { h: 'Type', v: r => r.activity_type || '-' },
      { h: 'Customer', v: r => r.customer_name_resolved || r.customer || '-' },
      { h: 'Date', v: r => r.activity_date || '-' },
      { h: 'Priority', v: r => r.priority || 'Medium' },
    ],
    searchFields: ['subject','customer','activity_number'],
    sections: [
      { icon:'📅', title:'Activity Details', fields:[
        { key:'subject', label:'Subject', type:'text', required:true },
        { key:'activity_type', label:'Type', type:'select', opts:['Visit','Call','WhatsApp','Complaint','Feedback','Service'] },
        { key:'customer_id', label:'Customer', type:'retailCustomer', required:true },
        { key:'customer_phone', label:'Customer Phone', type:'tel' },
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
    title: 'Retail Orders', icon: '🛍️', get singular() { return labelNow('retailOrders','Order','singular'); },
    idField: 'order_number',
    get statusOptions() { return resolveStatusOptions('retailOrders', ['Draft','Pending','Completed','Cancelled','Refunded']); },
    hasLineItems: true,
    listColumns: [

      { h: 'Customer', v: r => r.customer_name_resolved || r.customer || '-' },
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
    title: 'Retail Invoices', icon: '🧾', get singular() { return labelNow('retailInvoices','Invoice','singular'); },
    idField: 'invoice_number',
    get statusOptions() { return resolveStatusOptions('retailInvoices', ['Draft','Sent','Paid','Overdue','Refunded','Cancelled']); },
    hasLineItems: true,
    listColumns: [

      { h: 'Customer', v: r => r.customer_name_resolved || r.customer || '-' },
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
        { key:'billing_address', label:'Billing Address', type:'textarea', full:true },
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
  // Only the customer's own state is a real prefill. When the customer has none, leave the field out so the
  // Page Layout Designer default (or the built-in fallback) applies instead of being overwritten here.
  if (customer?.state) prefill.place_of_supply = customer.state;
  return prefill;
}

// ─── Line items table (Orders / Invoices) ──────────────────────────────────
function RetailLineItems({ items, setItems, products, taxRegime, page, headerDiscountPct = 0, onHeaderDiscountChange, scope = 'detail' }) {
  const [stockWarning, setStockWarning] = useState(null);
  const [rentalWarnings, setRentalWarnings] = useState<Record<number,string>>({});
  const { appPreferences, checkRentalConflict } = useApp();
  // "Copy Maps" — active rules for automatically copying a product's field
  // (e.g. a "Security Deposit" custom field) onto a line item when that
  // product is selected below.
  const { rules: productToLineItemRules } = useFieldMappingRules('product_to_line_item', 'retailProducts', page === 'retailInvoices' ? 'retailInvoiceLineItems' : 'retailOrderLineItems');
  const showRentalColumns = appPreferences?.business_type === 'rental' && (page === 'retailOrders' || page === 'retailInvoices');
  const { fields: customFieldsAll } = useCustomFields(page === 'retailInvoices' ? 'retailInvoiceLineItems' : 'retailOrderLineItems');
  const lineItemFieldLayout = useFieldLayout(page === 'retailInvoices' ? 'retailInvoiceLineItems' : 'retailOrderLineItems');
  // Page Layout Designer, for the page this grid is on (scope = 'detail' | 'create'): custom columns' label / hidden.
  const customFields = (customFieldsAll || [])
    .filter(f => !f.show_on || f.show_on === 'both' || f.show_on === scope)
    .map(f => { const r = resolveFieldDisplay(cfKey(f.api_name), f.label, lineItemFieldLayout.fields || [], {}, scope); return { ...f, label: r.label, _hidden: !r.visible, _ro: !r.editable }; })
    .filter(f => !f._hidden);
  // Rental Start/End editability is Page-Layout-Designer-controlled now, the
  // same as every other standard line-item field — NOT hardcoded to the
  // page. Falls back to the original behavior (editable on Orders,
  // read-only on Invoices) only when the admin hasn't published an override
  // for that field, so nothing changes for a tenant who never opens the
  // designer. Resolved here (rather than inline where it's used, further
  // down) because rentalModeOn below also needs it — once an admin makes
  // these fields editable on Invoices, conflict-checking has to switch on
  // for invoices too, not just the input's disabled state.
  const rentalStartRow = resolveFieldRow('rental_start_date', lineItemFieldLayout.fields || [], scope);
  const rentalEndRow   = resolveFieldRow('rental_end_date',   lineItemFieldLayout.fields || [], scope);
  const rentalStartReadOnly = rentalStartRow ? rentalStartRow.editability_mode === 'readonly' : page === 'retailInvoices';
  const rentalEndReadOnly   = rentalEndRow   ? rentalEndRow.editability_mode   === 'readonly' : page === 'retailInvoices';
  // Booking-conflict checking (the live debounced warning below, and the
  // required/past-date validation) now also runs on Invoices once an admin
  // has made their rental dates editable there — editable-but-unchecked
  // would let an invoice silently record a date range that's double-booked
  // against a real order, with nothing catching it before save.
  const rentalModeOn = appPreferences?.business_type === 'rental'
    && (page === 'retailOrders' || (page === 'retailInvoices' && !rentalStartReadOnly && !rentalEndReadOnly));
  const applyLineCascadeAndPricing = (u: any, changedKey: string) => {
    // Live relative-default recalculation — if any OTHER standard field on
    // this line has a configured default that's a relative/duration
    // reference to the field that just changed (a plain day offset like
    // "rental_start_date+3", or "rental_start_date+duration:<custom field
    // api_name>" driven by a duration picker), recompute it now, BEFORE the
    // pricing math below — otherwise rentalDays/extended_price would be
    // computed against the stale, pre-cascade date. `changedKey` is either
    // a standard field key (from upd) or a custom field's api_name (from
    // updCustom) — parseDefaultValueRuntime's refField matches the former,
    // durationField matches the latter. Always recalculates on a
    // reference-field change, even if the dependent field already had a
    // value — simpler and more predictable than partial dirty-tracking; the
    // user can still edit the dependent field directly afterward.
    effectiveRows(lineItemFieldLayout.fields || [], scope).forEach(fr => {
      if (fr.field_key === changedKey) return; // don't recompute the field the user is directly editing
      const parsed = parseDefaultValueRuntime(fr.default_value);
      if (parsed?.refField === changedKey || parsed?.durationField === changedKey) {
        const recalculated = resolveLineDefault('date', fr.default_value, u);
        if (recalculated !== undefined) u[fr.field_key] = recalculated;
      }
    });
    const { totalTax } = taxRegime.computeLineTax(u);
    // Rental pricing: for a rentable product with both rental dates set,
    // the line total is rent_per_day × number of days × quantity — not
    // just quantity × unit_price the way a normal sale works. Falls back
    // to the standard calculation for any non-rental line or a rentable
    // item whose dates aren't both set yet.
    const rentalDays = (u.rental_start_date && u.rental_end_date)
      ? Math.max(1, Math.round((new Date(u.rental_end_date+'T00:00:00') - new Date(u.rental_start_date+'T00:00:00')) / 86400000) + 1)
      : 1;
    const isFixedPriceLine = !!(u.custom_data && u.custom_data.__fixed_price);
    const isRentalPricedLine = !isFixedPriceLine && !!(u.product_id && activeProducts.find(x => (x._uuid||x.id) === u.product_id)?.is_rentable && u.rental_start_date && u.rental_end_date);
    const net = isRentalPricedLine
      ? u.quantity * u.unit_price * rentalDays * (1 - u.discount_pct/100)
      : u.quantity * u.unit_price * (1 - u.discount_pct/100);
    u.extended_price = net + totalTax;
    u.rental_days = isRentalPricedLine ? rentalDays : undefined; // surfaced in the grid for transparency, not a DB column
    return u;
  };
  const updCustom = (idx, apiName, val) => setItems(p => p.map((r,i) => {
    if (i !== idx) return r;
    const u = { ...r, custom_data: { ...(r.custom_data||{}), [apiName]: val } };
    // Changing a custom field can itself drive a standard date field (the
    // duration-picker → rental_end_date case) — run the same cascade +
    // pricing recompute upd() runs below, keyed off the custom field's
    // api_name instead of a standard field key.
    return applyLineCascadeAndPricing(u, apiName);
  }));

  // Filter out discontinued products from the product picker
  const activeProducts = products.filter(p => p.status !== 'Discontinued');

  // Same default_value resolution as the header form's defaultForm() -
  // 'today' resolves to the real current date for date-type fields, a
  // checkbox field's text default is parsed as a boolean, a relative
  // reference like "rental_start_date+3" looks up that field's current
  // value on sourceRow and offsets it by that many days, everything else
  // is used as-is. Duplicated rather than imported since this is a
  // module-level function scoped to a different component - kept in sync
  // by definition (same lines), not by a shared reference.
  const RELATIVE_DEFAULT_RE = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*([+-]\d+)?$/;
  // "rental_start_date+duration:rental_duration" — set up in Page Layout
  // Designer on a date field's Default Value as "From Duration Field":
  // refField is the OTHER date field to measure from (the rental start),
  // and durationField is a custom select field's api_name on this same
  // line-item object whose current label (e.g. "1 Month", "Quarter", "Half
  // Year", "Full Year") decides how far out the end date lands. Distinct
  // syntax from the plain "+N" day offset above since a duration isn't a
  // fixed number of days (a month varies 28-31 days) and its length comes
  // from a value the user picks per-line, not a fixed admin-configured number.
  const DURATION_DEFAULT_RE = /^([a-zA-Z_][a-zA-Z0-9_]*)\+duration:([a-zA-Z_][a-zA-Z0-9_]*)$/;
  // Recognizes the handful of duration labels this feature was built for
  // (1 Month / 1 Quarter / Half Year / Full Year) plus common variants an
  // admin might type for the same custom field's option list, so the admin
  // doesn't have to match an exact reserved string. Case/spacing-insensitive.
  const parseDurationToMonths = (label: string): number | null => {
    const s = String(label || '').trim().toLowerCase().replace(/[\s-]+/g, ' ');
    if (!s) return null;
    if (/^(1 )?month(ly)?$/.test(s)) return 1;
    if (/^(1 )?quarter(ly)?$/.test(s) || /^3 months?$/.test(s)) return 3;
    if (/^half year(ly)?$/.test(s) || /^6 months?$/.test(s) || /^semi ?annual(ly)?$/.test(s)) return 6;
    if (/^(full )?year(ly)?$/.test(s) || /^12 months?$/.test(s) || /^annual(ly)?$/.test(s)) return 12;
    const mm = s.match(/^(\d+) months?$/); if (mm) return parseInt(mm[1], 10);
    const my = s.match(/^(\d+) years?$/);  if (my) return parseInt(my[1], 10) * 12;
    return null;
  };
  // Calendar-month-accurate add (Jan 31 + 1 month -> Feb 28/29, not Mar 3),
  // then back up one day so the result is the LAST day of the rental
  // period (inclusive), matching how rentalDays elsewhere already counts
  // both the start and end day as rented — e.g. 1-month rental from Jan 1
  // ends Jan 31, not Feb 1.
  const addMonthsInclusiveISO = (startISO: string, months: number): string => {
    const d = new Date(startISO + 'T00:00:00');
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() !== day) d.setDate(0); // overflowed into the next month -> clamp to last day of the intended month
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
  };
  const parseDefaultValueRuntime = (raw: string) => {
    if (!raw || raw.toLowerCase() === 'today') return null;
    const dm = raw.match(DURATION_DEFAULT_RE);
    if (dm) return { refField: dm[1], durationField: dm[2] };
    const m = raw.match(RELATIVE_DEFAULT_RE);
    return m ? { refField: m[1] } : null;
  };
  const resolveLineDefault = (fieldType, rawValue, sourceRow: any = null) => {
    if (rawValue === undefined || rawValue === null || rawValue === '') return undefined;
    if (fieldType === 'datetime') return resolveLayoutDefault('datetime', rawValue, sourceRow);
    if (isTemplateDefault(rawValue, fieldType)) return undefined; // {{token}} templates are rendered live by useTemplateDefaults
    if (fieldType === 'date') {
      if (rawValue.toLowerCase() === 'today') return todayLocalISO();
      const dm = rawValue.match(DURATION_DEFAULT_RE);
      if (dm) {
        const refVal = sourceRow?.[dm[1]];
        if (!refVal) return undefined; // start date not set yet - nothing to measure from
        const months = parseDurationToMonths(sourceRow?.custom_data?.[dm[2]]);
        if (!months) return undefined; // duration not picked yet, or not a recognized value
        return addMonthsInclusiveISO(refVal, months);
      }
      const m = rawValue.match(RELATIVE_DEFAULT_RE);
      if (m) {
        const refVal = sourceRow?.[m[1]];
        if (!refVal) return undefined; // referenced field not set yet - nothing to offset from
        const d = new Date(refVal + 'T00:00:00');
        if (isNaN(d.getTime())) return undefined;
        if (m[2]) d.setDate(d.getDate() + parseInt(m[2], 10));
        return d.toLocaleDateString('en-CA');
      }
      return rawValue;
    }
    if (fieldType === 'checkbox' || fieldType === 'boolean') return rawValue.toLowerCase() === 'true';
    if (fieldType === 'number') { const n = Number(rawValue); return Number.isNaN(n) ? undefined : n; }
    return rawValue;
  };

  const add = () => setItems(p => {
    const row: any = {
      _id: Date.now(), product_name:'', product_id:null, description:'', quantity:1, unit_price:0, list_price:0, discount_pct:0,
      extended_price:0, custom_data:{}, rental_start_date:'', rental_end_date:'',
      ...(taxRegime.regime==='india_gst' ? { hsn_code:'', gst_rate:18 } : {}),
      ...(taxRegime.regime==='us_sales_tax' ? { taxable:'Yes', sales_tax_rate:0 } : {}),
      ...(taxRegime.regime==='uk_vat' ? { vat_rate:20 } : {}),
      ...(taxRegime.regime==='generic' ? { tax_pct:0 } : {}),
    };
    // Admin-configured custom line-item field defaults, into custom_data —
    // applied FIRST, so a duration field's own default (if one is ever
    // configured) is already in custom_data by the time the standard-field
    // pass below tries to resolve "rental_start_date+duration:<this field>".
    (customFieldsAll || []).forEach(f => {
      const resolved = resolveLineDefault(f.field_type, f.default_value);
      if (resolved !== undefined) row.custom_data[f.api_name] = resolved;
    });
    // Admin-configured standard line-item field defaults - dynamic, works
    // for any standard line-item field on this object, not a fixed set.
    const lineFieldTypeByKey: Record<string,string> = { quantity:'number', unit_price:'number', discount_pct:'number', rental_start_date:'date', rental_end_date:'date' };
    effectiveRows(lineItemFieldLayout.fields || [], scope).forEach(fr => {
      const resolved = resolveLineDefault(lineFieldTypeByKey[fr.field_key] || 'text', fr.default_value, row);
      if (resolved !== undefined) row[fr.field_key] = resolved;
    });
    return [...p, row];
  });
  const remove = (idx) => {
    setStockWarning(null);
    setRentalWarnings(w => { const n = { ...w }; delete n[idx]; return n; });
    setItems(p => p.filter((_,i)=>i!==idx));
  };

  // Live conflict check — debounced (via the delay before each row's check
  // actually fires) so rapid date typing doesn't hammer the database on
  // every keystroke, and cancellation-safe via a standard React
  // effect-cleanup flag rather than manual timestamp/token bookkeeping.
  // Purely advisory in the UI (the real guarantee is the server-side check
  // at save time plus the database's own exclusion constraint) — this just
  // gives fast, honest feedback before the user even attempts to save.
  //
  // This runs as a useEffect keyed to every row's own (product_id, start,
  // end) rather than being triggered imperatively from upd() - an effect's
  // cleanup function is GUARANTEED by React to run before the next
  // execution of that same effect, which means a superseded check's
  // `cancelled` flag is set before the new check even starts. That makes
  // it structurally impossible for a slow, stale response (e.g. the
  // conflict check for dates the user has already changed away from) to
  // arrive after a newer one and overwrite its correct result - not just
  // unlikely, but ruled out by how React effects are specified to behave.
  const rentalCheckKey = items.map(r => `${r.product_id||''}|${r.rental_start_date||''}|${r.rental_end_date||''}|${r.order_number||''}`).join(';;');
  useEffect(() => {
    if (!rentalModeOn) return;
    console.log('[RentalAvailability] Effect firing with key:', rentalCheckKey);
    let cancelled = false;
    const timers: any[] = [];
    const todayISO = new Date().toLocaleDateString('en-CA');

    items.forEach((row, idx) => {
      if (!row.product_id || !row.rental_start_date || !row.rental_end_date) {
        setRentalWarnings(w => (w[idx] === undefined ? w : (() => { const n = { ...w }; delete n[idx]; return n; })()));
        return;
      }
      if (row.rental_end_date < row.rental_start_date) {
        setRentalWarnings(w => (w[idx] === 'End date must be on or after the start date.' ? w : { ...w, [idx]: 'End date must be on or after the start date.' }));
        return;
      }
      // Only a NEW booking (an Order) must start today or later — an
      // Invoice with editable rental dates is typically written up after
      // the rental already started, so a past start date there is normal,
      // not a mistake worth warning about.
      if (page === 'retailOrders' && row.rental_start_date < todayISO) {
        setRentalWarnings(w => (w[idx] === 'Start date is in the past.' ? w : { ...w, [idx]: 'Start date is in the past.' }));
        return;
      }
      console.log('[RentalAvailability] Scheduling check for row', idx, ':', { product_id: row.product_id, start: row.rental_start_date, end: row.rental_end_date, excludeOrderNumber: row.order_number });
      timers.push(setTimeout(async () => {
        const { conflict, withOrder, unresolved } = await checkRentalConflict(row.product_id, row.rental_start_date, row.rental_end_date, row.order_number || undefined);
        // A cleanup from a newer run of this same effect has already fired
        // by the time we get here if this check has been superseded -
        // discard the result rather than apply it.
        if (cancelled) { console.log('[RentalAvailability] Discarding stale result for row', idx, '- superseded by a newer check'); return; }
        console.log('[RentalAvailability] Applying result for row', idx, ':', { conflict, withOrder, unresolved });
        setRentalWarnings(w => {
          if (conflict) {
            return { ...w, [idx]: unresolved ? 'Could not verify availability — will be checked again on save.' : `Already booked by order ${withOrder} for an overlapping date range.` };
          }
          if (w[idx] === undefined) return w;
          const n = { ...w };
          delete n[idx];
          return n;
        });
      }, 400));
    });

    return () => { cancelled = true; timers.forEach(t => clearTimeout(t)); };
  }, [rentalCheckKey, rentalModeOn]);

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

    setItems(p => p.map((r, i) => {
      if (i !== idx) return r;
      const numFields = ['quantity','unit_price','list_price','discount_pct','gst_rate','sales_tax_rate','vat_rate','tax_pct'];
      const u = { ...r, [field]: numFields.includes(field) ? Number(val) : val };
      if (field === 'product_name') {
        const pr = activeProducts.find(x => x.name === val);
        if (pr) {
          // Rentable products price by the day, not the regular sale price —
          // rent_per_day is the per-day rate; falls back to the normal price
          // if rent_per_day isn't set (e.g. marked rentable before a rate
          // was configured), so this never silently prices at 0.
          const fixedBasis = !!pr.is_rentable && pr.rental_pricing_basis === 'Fixed Price';
          u.unit_price = (pr.is_rentable && !fixedBasis && pr.rent_per_day) ? Number(pr.rent_per_day) : pr.price;
          u.custom_data = { ...(u.custom_data || {}) };
          if (fixedBasis) u.custom_data.__fixed_price = true; else delete u.custom_data.__fixed_price;
          u.list_price = pr.price; u.product_code = pr.sku || '';
          u.product_id = pr._uuid || pr.id || null;
          // Switching away from a rentable product (or to a non-rentable
          // one) clears any stale booking dates rather than silently
          // carrying them onto an item they no longer apply to.
          if (!pr.is_rentable) { u.rental_start_date = ''; u.rental_end_date = ''; }
          if (taxRegime.regime==='india_gst') { u.hsn_code = pr.hsn_code || ''; u.gst_rate = pr.gst_rate ?? 18; }
          if (taxRegime.regime==='us_sales_tax') { u.taxable = pr.taxable || 'Yes'; }
          if (taxRegime.regime==='uk_vat') { u.vat_rate = pr.vat_rate ?? 20; }
          // Copy Maps — automatically copy any mapped product fields (e.g.
          // a "Security Deposit" custom field) onto this line item.
          if (productToLineItemRules.length > 0) applyFieldMapping(productToLineItemRules, pr, u);
          if (taxRegime.regime==='generic') { u.tax_pct = pr.tax_rate ?? 0; }
        } else {
          u.product_id = null;
        }
      }
      // Cascade any field whose default references this one (plain day
      // offset or duration-field driven), then recompute pricing — shared
      // with updCustom() above so a duration custom field change gets
      // identical treatment. See applyLineCascadeAndPricing's own comment.
      return applyLineCascadeAndPricing(u, field);
    }));
    // Availability re-checking for rental dates is handled by a dedicated
    // useEffect below, which watches every row's (product_id, start, end)
    // directly - not triggered imperatively from here. See that effect's
    // comment for why.
  };

  const subtotal  = items.reduce((s,i) => s + computeLineGross(i), 0);
  const totalDisc = items.reduce((s,i) => s + computeLineGross(i)*i.discount_pct/100, 0);
  const totalTax  = items.reduce((s,i) => s + taxRegime.computeLineTax(i).totalTax, 0);
  // Overall, order-level discount — applied after per-line discounts and
  // tax, on the final total. A simple "amount off the bill" (e.g. a
  // loyalty or manager-approved discount), not a tax-affecting discount
  // that would require recalculating tax on a reduced taxable base.
  const preHeaderDiscTotal = subtotal - totalDisc + totalTax;
  const headerDiscountAmount = preHeaderDiscTotal * Number(headerDiscountPct || 0) / 100;
  const grandTotal = preHeaderDiscTotal - headerDiscountAmount;

  // Column-level visibility/label overrides for the four targeted
  // standard line-item fields - resolved once for the whole column (not
  // per-row), since a column's visibility must stay consistent across
  // every row for the table structure to make sense. Falls back to the
  // field's own built-in label when no override is published.
  const lineCol = (fieldKey, defaultLabel) => {
    const row = resolveFieldRow(fieldKey, lineItemFieldLayout.fields || [], scope);
    return {
      visible: row ? row.visibility_mode !== 'hidden' : true,
      readOnly: row ? row.editability_mode === 'readonly' : false,
      label: row?.custom_label || defaultLabel,
    };
  };
  const colProduct    = lineCol('product_name', 'Product');
  // readOnly comes from the page-aware default computed earlier (editable
  // on Orders, read-only on Invoices, unless an admin published an
  // override) rather than lineCol's generic false-when-unconfigured
  // default — these two fields are the one case where "unconfigured"
  // still needs to mean something other than "editable everywhere".
  const colRentalStart = { ...lineCol('rental_start_date', 'Rental Start'), readOnly: rentalStartReadOnly };
  const colRentalEnd   = { ...lineCol('rental_end_date', 'Rental End'), readOnly: rentalEndReadOnly };
  const colQty        = lineCol('quantity', 'Qty');
  const colPrice      = lineCol('unit_price', 'Unit Price');
  const colDiscount   = lineCol('discount_pct', 'Disc %');
  // Net Amount + Line Total are computed, display-only values (never stored,
  // never user-editable) - they're registered in the Page Layout Designer as
  // `computed: true` so they can still be relabeled/hidden there, just with
  // no Editability/Default Value controls. `readOnly` is ignored for both
  // below since the cells are always plain text, never inputs.
  const colNetAmount  = lineCol('net_amount', 'Net Amount');
  const colLineTotal  = lineCol('extended_price', 'Line Total');
  // Tax-regime fields (HSN, GST rate, VAT rate, taxable, sales tax rate,
  // etc.) previously bypassed the Page Layout Designer entirely — always
  // rendered, regardless of what an admin configured for them (they ARE
  // registered as standard fields in FieldLayoutDesigner.tsx's
  // LINE_ITEM_STANDARD_FIELDS for retail objects, so hiding one there
  // silently had no effect on this grid). Resolved the same way as the
  // other standard columns now, per field key.
  const taxCols = taxRegime.lineItemFields
    .map(tc => ({ ...tc, ...lineCol(tc.key, tc.label) }))
    .filter(tc => tc.visible);
  // Column order from the Page Layout Designer (display_order per field key).
  const lineOrder = { __actions: 1e9 };
  effectiveRows(lineItemFieldLayout.fields || [], scope).forEach(r => {
    if (r.is_published === false) return;
    lineOrder[r.field_key] = r.display_order;
  });
  const visibleStandardColCount = [colProduct, colQty, colPrice, colDiscount, colNetAmount, colLineTotal].filter(c => c.visible).length;
  const visibleRentalColCount = showRentalColumns ? [colRentalStart, colRentalEnd].filter(c => c.visible).length : 0;

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
            <OrderedRow order={lineOrder} className="bg-blue-50 border-b border-blue-100">
              {colProduct.visible && <th data-col="product_name" className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider" style={{minWidth:200}}>{colProduct.label}</th>}
              {showRentalColumns && colRentalStart.visible && <th data-col="rental_start_date" className="px-4 py-3 text-center text-xs font-bold text-purple-600 uppercase tracking-wider" style={{minWidth:130}}>{colRentalStart.label}</th>}
              {showRentalColumns && colRentalEnd.visible && <th data-col="rental_end_date" className="px-4 py-3 text-center text-xs font-bold text-purple-600 uppercase tracking-wider" style={{minWidth:130}}>{colRentalEnd.label}</th>}
              {colQty.visible && <th data-col="quantity" className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider" style={{minWidth:70}}>{colQty.label}</th>}
              {colPrice.visible && <th data-col="unit_price" className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider" style={{minWidth:100}}>{colPrice.label}</th>}
              {colDiscount.visible && <th data-col="discount_pct" className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider" style={{minWidth:70}}>{colDiscount.label}</th>}
              {taxCols.map(tc=><th key={tc.key} data-col={tc.key} className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{minWidth:tc.type==='select'?110:90}}>{tc.label}</th>)}
              {colNetAmount.visible && <th data-col="net_amount" className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider" style={{minWidth:110}}>{colNetAmount.label}</th>}
              {colLineTotal.visible && <th data-col="extended_price" className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider" style={{minWidth:110}}>{colLineTotal.label} <span className="normal-case font-normal text-gray-400">(incl. tax)</span></th>}
              {customFields.map(f=><th key={f.id} data-col={'cf_'+f.api_name} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider" style={{minWidth:110}}>{f.label}</th>)}
              <th data-col="__actions"/>
            </OrderedRow>
          </thead>
          <tbody className="divide-y divide-blue-50">
            {items.length === 0
              ? <tr><td colSpan={visibleStandardColCount + 1 + visibleRentalColCount + taxCols.length + customFields.length} className="px-5 py-12 text-center text-gray-400 text-sm">
                  No items yet — click <span className="font-semibold text-[#0F172A]">+ Add Item</span> to begin.
                </td></tr>
              : items.map((row, idx) => (
                <Fragment key={row._id ?? idx}>
                <OrderedRow order={lineOrder} className="hover:bg-blue-50/40 transition-all">
                  {colProduct.visible && <td data-col="product_name" className="px-3 py-3">
                    <SearchableSelect
                      value={row.product_name || ''}
                      onChange={v => upd(idx, 'product_name', v)}
                      disabled={colProduct.readOnly}
                      options={activeProducts.map(p => ({
                        value: p.name,
                        label: p.name,
                        icon: showRentalColumns && p.is_rentable ? '🔑' : undefined,
                        sub: [
                          p.category,
                          p.sku ? `SKU: ${p.sku}` : null,
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
                  </td>}
                  {showRentalColumns && colRentalStart.visible && (() => {
                    const selectedProduct = activeProducts.find(p => p.name === row.product_name);
                    const isRentable = !!selectedProduct?.is_rentable;
                    const todayISO = new Date().toLocaleDateString('en-CA');
                    // Read-only by default on Invoices (the order already
                    // secured the booking — see rentalStartReadOnly's own
                    // comment above), but now follows whatever Page Layout
                    // Designer publishes for these two fields instead of
                    // being hardcoded to the page.
                    const isDisabled = colRentalStart.readOnly || !isRentable;
                    // An invoice allows a rental start date already in the
                    // past (it's typically written up after the booking was
                    // already made/started) — only Orders, where a NEW
                    // booking is being created, enforce "today or later".
                    const minStart = page === 'retailOrders' ? todayISO : undefined;
                    // Required once a rentable product is on the row — save is
                    // blocked (see handleSave's rental validation) until this
                    // is filled in, so flag it visually here too.
                    const startMissing = !isDisabled && isRentable && !row.rental_start_date;
                    return (
                      <td data-col="rental_start_date" className="px-3 py-3">
                        <input type="date" value={row.rental_start_date || ''} disabled={isDisabled} min={minStart}
                          onChange={e => upd(idx, 'rental_start_date', e.target.value)}
                          title={startMissing ? 'Required for a rentable item' : undefined}
                          className={`${iCls} text-center ${isDisabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : startMissing ? 'border-red-400 ring-1 ring-red-200' : ''}`}/>
                      </td>
                    );
                  })()}
                  {showRentalColumns && colRentalEnd.visible && (() => {
                    const selectedProduct = activeProducts.find(p => p.name === row.product_name);
                    const isRentable = !!selectedProduct?.is_rentable;
                    const todayISO = new Date().toLocaleDateString('en-CA');
                    const isDisabled = colRentalEnd.readOnly || !isRentable;
                    return (
                      <td data-col="rental_end_date" className="px-3 py-3">
                        <input type="date" value={row.rental_end_date || ''} disabled={isDisabled} min={row.rental_start_date || (page === 'retailOrders' ? todayISO : undefined)}
                          onChange={e => upd(idx, 'rental_end_date', e.target.value)}
                          className={`${iCls} text-center ${isDisabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}/>
                      </td>
                    );
                  })()}
                  {colQty.visible && <td data-col="quantity" className="px-3 py-3">
                    <input type="number" min={1} value={row.quantity} disabled={colQty.readOnly}
                      onChange={e => { const v = Number(e.target.value); if (v < 1) return; upd(idx, 'quantity', v); }}
                      className={`${iCls} text-center ${colQty.readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}/>
                  </td>}
                  {colPrice.visible && <td data-col="unit_price" className="px-3 py-3">
                    <input type="number" min={0} value={row.unit_price} disabled={colPrice.readOnly}
                      onChange={e => upd(idx, 'unit_price', Math.max(0, Number(e.target.value)))}
                      className={`${iCls} text-right ${colPrice.readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}/>
                  </td>}
                  {colDiscount.visible && <td data-col="discount_pct" className="px-3 py-3">
                    <input type="number" min={0} max={100} value={row.discount_pct} disabled={colDiscount.readOnly}
                      onChange={e => upd(idx, 'discount_pct', Math.min(100, Math.max(0, Number(e.target.value))))}
                      className={`${iCls} text-center ${colDiscount.readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : row.discount_pct > 0 ? 'border-green-300 bg-green-50 text-green-800' : ''}`}/>
                  </td>}
                  {taxCols.map(tc => (
                    <td key={tc.key} data-col={tc.key} className="px-3 py-3">
                      {tc.type === 'select'
                        ? <select value={row[tc.key] ?? tc.defaultValue ?? ''}
                            disabled={tc.readOnly}
                            onChange={e => upd(idx, tc.key, e.target.value)}
                            className={`${sCls} text-center ${tc.readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}>
                            {tc.opts.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        : <input type={tc.type === 'number' ? 'number' : 'text'}
                            value={row[tc.key] ?? tc.defaultValue ?? ''}
                            disabled={tc.readOnly}
                            onChange={e => upd(idx, tc.key, e.target.value)}
                            className={`${iCls} text-center ${tc.readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}/>
                      }
                    </td>
                  ))}
                  {colNetAmount.visible && <td data-col="net_amount" className="px-3 py-3 text-right font-semibold text-gray-600 text-sm">
                    {formatCurrency(computeLineNet(row))}
                  </td>}
                  {colLineTotal.visible && <td data-col="extended_price" className="px-3 py-3 text-right font-bold text-[#0F172A] text-sm">
                    {formatCurrency(row.extended_price || 0)}
                    {row.custom_data?.__fixed_price && <div className="text-[10px] font-normal text-teal-600">Fixed price</div>}
                    {row.rental_days > 0 && (
                      <div className="text-[10px] font-normal text-purple-500">× {row.rental_days} day{row.rental_days!==1?'s':''}</div>
                    )}
                    <div className="text-[10px] font-normal text-gray-400">+{formatCurrency((row.extended_price||0) - computeLineNet(row))} tax</div>
                  </td>}
                  {customFields.map(f=><td key={f.id} data-col={'cf_'+f.api_name} className="px-3 py-3"><fieldset disabled={f._ro} className="contents"><LineItemCustomFieldInput field={f} value={(row.custom_data||{})[f.api_name]} onChange={v=>updCustom(idx,f.api_name,v)}/></fieldset></td>)}
                  <td data-col="__actions" className="px-3 py-3 text-center">
                    <button type="button" onClick={() => remove(idx)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all font-bold text-lg mx-auto">
                      ×
                    </button>
                  </td>
                </OrderedRow>
                {rentalWarnings[idx] ? (
                  <tr>
                    <td colSpan={visibleStandardColCount + visibleRentalColCount + taxCols.length + customFields.length} className="px-4 pb-2 -mt-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                        <span>⚠️</span><span>{rentalWarnings[idx]}</span>
                      </div>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              ))
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
          <div className="px-5 py-4 border-t border-blue-100 text-sm space-y-3">
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Subtotal <span className="text-gray-400">(before any discount or tax)</span></span>
                <span className="font-semibold text-[#0F172A]">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Line Discount <span className="text-gray-400">(sum of each item's own Disc %)</span></span>
                <span className="font-semibold text-red-500">-{formatCurrency(totalDisc)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{taxRegime.shortLabel}</span>
                <span className="font-semibold text-[#0F172A]">+{formatCurrency(totalTax)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Overall Discount</span>
                  <input
                    type="number" min={0} max={100}
                    value={headerDiscountPct || 0}
                    onChange={e => onHeaderDiscountChange?.(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <span className="text-gray-400 text-xs">% off the whole {page==='retailInvoices'?'invoice':'order'}</span>
                </div>
                <span className="font-semibold text-red-500">-{formatCurrency(headerDiscountAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                <span className="font-bold text-[#0F172A] text-base">Grand Total</span>
                <span className="font-bold text-blue-700 text-lg">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
            {breakdown && Object.keys(breakdown).length > 0 && (
              <div className="flex flex-wrap gap-3 pt-1">
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
function buildRetailPrintHTML(t, record, items, products, customFieldsMeta = []) {
  // Canvas (free-form) templates render through the shared document engine
  if (t && t._canvas) return buildDocumentHTML(t, record, items, { docType: 'retail_invoice', products });
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
      ${t.col_item!==false ? `<td style="padding:3px 4px;font-size:${fs(11)}px">${item.product_name||item.product||''}${t.show_rental_dates!==false && item.rental_start_date && item.rental_end_date ? `<div style="font-size:${fs(8)}px;color:${accent};margin-top:2px">📅 ${item.rental_start_date} to ${item.rental_end_date}</div>` : ''}</td>` : ''}
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

  const subtotal   = Number(record.subtotal || (items||[]).reduce((s,i)=>s+computeLineGross(i),0));
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
    ${t.show_discount_total!==false && totalDisc>0 ? `<div class="tot-row"><span class="meta-l">Line Discount</span><span class="meta-v" style="color:#15803D">-${fmt(totalDisc)}</span></div>` : ''}
    ${t.show_tax_total!==false && totalTax>0 && t.tax_regime==='inclusive' ? `<div style="text-align:right;font-size:${fs(8)}px;color:#6B7280;font-style:italic;margin-bottom:2px">(Prices inclusive of GST)</div>` : ''}
    ${t.show_tax_total!==false && totalTax>0 && t.tax_regime!=='exempt' && t.tax_regime!=='inclusive' ? `<div class="tot-row"><span class="meta-l">Tax</span><span class="meta-v">${fmt(totalTax)}</span></div>` : ''}
    ${t.show_cgst_sgst && totalTax>0 && t.tax_regime!=='exempt' && t.tax_regime!=='inclusive' ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:2px;font-size:${fs(9)}px;color:#6B7280"><span>CGST</span><span>${fmt(totalTax/2)}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:2px;font-size:${fs(9)}px;color:#6B7280"><span>SGST</span><span>${fmt(totalTax/2)}</span></div>
    ` : ''}
    ${t.show_header_discount!==false && Number(record.header_discount_amount||0)>0 ? `<div class="tot-row"><span class="meta-l">Overall Discount${record.header_discount_pct?` (${record.header_discount_pct}%)`:''}</span><span class="meta-v" style="color:#15803D">-${fmt(Number(record.header_discount_amount))}</span></div>` : ''}
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
    ${(t.custom_field_keys||[]).length > 0 ? `${div}<div style="margin-bottom:${isTh?4:8}px">
      ${(t.custom_field_keys||[]).map(key => {
        const val = (record.custom_data||{})[key];
        if (val === undefined || val === null || val === '') return '';
        const meta = customFieldsMeta.find(f => f.api_name === key);
        return `<div class="tot-row"><span class="meta-l">${meta?.label || key}</span><span class="meta-v">${val}</span></div>`;
      }).join('')}
    </div>` : ''}
    ${t.show_terms && t.terms_and_conditions ? `${div}<div style="margin-bottom:${isTh?4:8}px"><div style="font-size:${fs(9)}px;font-weight:700;color:#374151;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Terms &amp; Conditions</div><div style="font-size:${fs(8)}px;color:#6B7280;line-height:1.5">${t.terms_and_conditions}</div></div>` : ''}
    ${t.show_return_policy && t.return_policy ? `${div}<div style="font-size:${fs(8)}px;color:#6B7280;line-height:1.5">Return Policy: ${t.return_policy}</div>` : ''}
    ${t.show_signature ? `<div class="signature">${t.signature_label||'Authorised Signatory'}</div>` : ''}
    ${t.show_footer!==false && t.footer_msg ? `${div}<div class="footer-msg">${t.footer_msg}</div>` : ''}
    ${t.show_powered_by!==false ? `<div class="powered-by">Powered by Umbrella Suite</div>` : ''}
    ${t.watermark ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:64px;font-weight:900;color:rgba(0,0,0,0.04);pointer-events:none;white-space:nowrap;letter-spacing:6px">${t.watermark}</div>` : ''}
  </div></div></body></html>`;
}


function RetailInvoicePrintModal({ template, record, items, products, onClose, onPrint }) {
  const { fields: customFieldsMeta } = useCustomFields('retailInvoices');
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

  const html = buildRetailPrintHTML(template, record, items, products, customFieldsMeta);
  const ps   = template.paper_size;
  const isTh = ps?.startsWith('thermal');
  const previewW = template._canvas ? (template.page_width || 794) : (ps==='thermal_58'||ps==='thermal_57' ? 219 : ps==='thermal_80' ? 303 : ps==='A5' ? 480 : 595);

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
              style={{width:'100%',height:template._canvas ? Math.max(500, (template.page_height||1123)+16) : (isTh?800:1000),border:'none',borderRadius:8,boxShadow:'0 4px 20px rgba(0,0,0,0.15)',background:'white'}}
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

// ─── Booking Receipt print/PDF preview ───────────────────────────────────────
// Mirrors RetailInvoicePrintModal above, but for the free-form-canvas Booking
// Receipt Designer (components/admin/BookingReceiptDesigner.tsx) — carries
// its own template dropdown inline since Orders have no per-record "Booking
// Receipt Template" field the way Invoices do, so the picker lives here
// instead of on the form.
function BookingReceiptPrintModal({ templates, templateId, onTemplateChange, record, items, onClose, onPrint, onDownloadPdf, downloading }) {
  const template = templates.find(t => t.id === templateId) || templates[0] || null;

  if (!templates.length) return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[20px] p-8 max-w-md text-center shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="text-4xl mb-4">🎫</div>
        <h3 className="font-bold text-[#0F172A] text-lg mb-2">No Booking Receipt Template</h3>
        <p className="text-gray-500 text-sm mb-5">Design one first in Admin Tools → B2C Retail → Booking Receipt Designer.</p>
        <button onClick={onClose} className="bg-[#0F172A] text-white px-6 py-2.5 rounded-xl font-bold text-sm">Close</button>
      </div>
    </div>
  );

  const html = buildBookingReceiptHTML(template, record, items);
  const previewW = template?.page_width || 794;

  return (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden" style={{maxWidth:900,width:'100%',maxHeight:'90vh'}} onClick={e=>e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#0F172A] to-purple-900 px-6 py-4 flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
          <div>
            <h3 className="text-white font-bold text-lg">🎫 Booking Receipt Preview</h3>
            {templates.length > 1 ? (
              <select value={template?.id||''} onChange={e=>onTemplateChange(e.target.value)}
                className="mt-1 bg-white/10 border border-white/20 text-white text-xs rounded-lg px-2 py-1 focus:outline-none">
                {templates.map(tp=><option key={tp.id} value={tp.id} className="text-black">{tp.is_default?'★ ':''}{tp.name}</option>)}
              </select>
            ) : <p className="text-purple-200 text-xs mt-0.5">Template: {template?.name}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onDownloadPdf} disabled={downloading}
              className="bg-white/15 hover:bg-white/25 text-white px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/20 disabled:opacity-50">
              {downloading ? '⏳ Preparing…' : '⬇️ Download PDF'}
            </button>
            <button onClick={onPrint}
              className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow transition-all">
              🖨️ Print Now
            </button>
            <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 p-6 flex justify-center">
          <div style={{width:previewW,flexShrink:0}}>
            <iframe srcDoc={html} style={{width:'100%',height:Math.max(500,(template?.page_height||1123)+16),border:'none',borderRadius:8,boxShadow:'0 4px 20px rgba(0,0,0,0.15)',background:'white'}} title="Booking Receipt Preview"/>
          </div>
        </div>

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
function RC360Table({ page, cols: baseCols, rows, emptyMsg, onRowClick }) {
  // Columns follow the Page Layout Designer and pick up published custom fields of the related object
  const cols = useRelatedCols(page, withKeys(baseCols));
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
  const { getObjectLabel } = useObjectLabels();
  const { currentUserPermissions, permissionsLoaded, applyDataSecurity } = useApp();
  const can360 = (pg) => !permissionsLoaded || (currentUserPermissions||[]).includes('__admin__') || (currentUserPermissions||[]).includes(viewPermFor(pg));
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
      const sec = (a) => (applyDataSecurity ? applyDataSecurity(a || []) : (a || []));
      setData({ orders: sec(orders), invoices: sec(invoices), activities: sec(activities) });
      setLoading(false);
    });
  }, [customer?.id]);

  const fmt          = n => formatCurrency(n || 0);
  const totalSpent   = data.invoices.reduce((s, i) => s + (i.amount || 0), 0);
  const paidInvoices = data.invoices.filter(i => i.payment_status === 'Paid' || i.status === 'Paid').length;
  const openActs     = data.activities.filter(a => a.status === 'Open' || a.status === 'In Progress').length;

  // Tab names follow tenant renames; tabs the role cannot view are dropped
  const TABS = [
    { k: 'orders',     pg: 'retailOrders',     icon: '🛍️', label: getObjectLabel('retailOrders', 'Orders', 'plural'),         count: data.orders.length },
    { k: 'invoices',   pg: 'retailInvoices',   icon: '🧾', label: getObjectLabel('retailInvoices', 'Invoices', 'plural'),     count: data.invoices.length },
    { k: 'activities', pg: 'retailActivities', icon: '📅', label: getObjectLabel('retailActivities', 'Activities', 'plural'), count: data.activities.length },
  ].filter(t => can360(t.pg));

  const SP = ({ status }) => (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>{status || '-'}</span>
  );

  const orderCols = [
    { h: 'Order #',   v: r => {
      const num = r.display_number ? formatDisplayNumber(PAGE_DISPLAY_PREFIX.retailOrders || 'RORD', r.display_number) : r.order_number || '-';
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
      const num = r.display_number ? formatDisplayNumber(PAGE_DISPLAY_PREFIX.retailInvoices || 'RINV', r.display_number) : r.invoice_number || '-';
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

  const effTab = TABS.find(t => t.k === tab) ? tab : (TABS[0]?.k || 'orders');
  const activeCols = effTab === 'orders' ? orderCols : effTab === 'invoices' ? invoiceCols : activityCols;
  const activeRows = effTab === 'orders' ? data.orders : effTab === 'invoices' ? data.invoices : data.activities;
  const activeTab  = TABS.find(t => t.k === effTab);

  // Open create modal for the given type, pre-filled with this customer
  const handleCreateFor = (type) => {
    const custName = customer.name || '';
    const pageMap  = { order: 'retailOrders', invoice: 'retailInvoices', activity: 'retailActivities' };
    const prefill  = {
      ...buildCustomerPrefill(customer),
      // Bug fix: this Customer 360 "Create Order" path defaulted new orders
      // to status 'Open', inconsistent with the plain customer-list 3-dot
      // menu's "Create Order" (which already correctly defaults to 'Draft').
      // A brand-new order shouldn't start life as Open before it's even
      // been reviewed/confirmed — default it to Draft here too.
      ...(type === 'order'    ? { order_date:    todayLocalISO(), status: 'Draft', channel: 'In-Store' } : {}),
      ...(type === 'invoice'  ? { invoice_date:  todayLocalISO(), status: 'Draft', payment_status: 'Pending' } : {}),
      ...(type === 'activity' ? { activity_date: todayLocalISO(), subject: 'Follow up with '+custName, activity_type: 'Call', status: 'Planned' } : {}),
    };
    if (onOpenCreate) onOpenCreate(pageMap[type], prefill);
  };

  return (
    <div className="space-y-5">
      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={()=>handleCreateFor('order')} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm">🛒 {RL('New Order')}</button>
        <button onClick={()=>handleCreateFor('invoice')} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm">🧾 {RL('New Invoice')}</button>
        <button onClick={()=>handleCreateFor('activity')} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm">📅 {RL('New Activity')}</button>
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
          <RC360Table page={activeTab?.pg || 'retailOrders'} cols={activeCols} rows={activeRows} emptyMsg={`No ${activeTab?.label?.toLowerCase()} found for this customer`} onRowClick={(r) => {
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
      {/* Custom objects with a lookup to this customer show up as related lists */}
      {customer?.id && <CustomRelatedLists parentKind="standard" parentKey="retailCustomers" parentId={customer.id} parentName={customer.name} parentPage="retailCustomers" parentRecord={customer} returnTab="360" />}
    </div>
  );
}

// ─── Retail Quick Create Customer ────────────────────────────────────────────
// RetailQuickCreateCustomer now lives in its own file (see import above) —
// shared with RentalBookingCalendar.tsx without a circular import.

// ─── Detail Panel ───────────────────────────────────────────────────────────
const _bookingPromptShown = new Set<string>();
function RetailDetailPanel({ page, record, onClose, onSaved, pendingReturnTo, onC360Navigate, onC360Create, initialTab = null }) {
  const rbac = useRbac();
  const { updateRetailRecord, deleteRetailRecord, retailCustomers, retailProducts, retailOrders, enterpriseUsers, currentUser,
          fetchRetailLineItems, fetchRetailCustomers, createRetailRecord, appPreferences, appearance, setPendingReturnTo, createRetailInvoiceFromOrder, createBookingFromInvoice,
          checkMatchingApprovalProcess, submitForApproval, currentUserPermissions, permissionsLoaded, setPendingRecord } = useApp();
  const { supabase, tenant } = useTenant();
  const { showAlert, showConfirm } = useAlert();
  const { fields: retailInvoiceCustomFieldsMeta } = useCustomFields('retailInvoices');
  const { getObjectLabel } = useObjectLabels();
  const lang = appearance?.language || 'en';
  const [showBookingCalendar, setShowBookingCalendar] = useState(false);
  const [relatedOrderDisplay, setRelatedOrderDisplay] = useState('');
  const [relatedActivities, setRelatedActivities] = useState<any[]>([]);
  const cfg = RETAIL_CONFIG[page];
  const taxRegime = getTaxRegime(appPreferences?.default_currency);
  // WhatsApp API availability — only checked on the invoice page, where the
  // Send WhatsApp button lives. Determines whether to offer the instant
  // API-based send alongside the always-available wa.me link.
  const [waConfig, setWaConfig] = useState<any>(null);
  const [waSending, setWaSending] = useState(false);
  const [waSendingPdf, setWaSendingPdf] = useState(false);
  useEffect(() => {
    if (page !== 'retailInvoices' && page !== 'retailActivities' && page !== 'retailOrders') return;
    const qs = new URLSearchParams({ ...(tenant?.db_url ? { db_url: tenant.db_url } : {}), ...(tenant?.id ? { tenantId: tenant.id } : {}) });
    waFetch(`/api/whatsapp/config?${qs}`).then(r => r.json()).then(d => setWaConfig(d.config)).catch(() => setWaConfig(null));
  }, [page, tenant?.db_url, tenant?.id]);

  const [edited, setEdited] = useState({ ...record });
  useEffect(() => {
    if (page !== 'retailActivities' || !edited.related_order_number || !supabase) { setRelatedOrderDisplay(''); return; }
    let cancelled = false;
    tenantScope(supabase.from('retail_orders').select('display_number')).eq('order_number', edited.related_order_number).maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setRelatedOrderDisplay(formatDisplayNumber('RORD', data.display_number)); });
    return () => { cancelled = true; };
  }, [page, edited.related_order_number, supabase]);
  useEffect(() => {
    if (page !== 'retailOrders' || !edited.id || !supabase) { setRelatedActivities([]); return; }
    let cancelled = false;
    tenantScope(supabase.from('retail_activities').select('*')).eq('related_order_number', edited.id).order('created_at', { ascending: false })
      .then(({ data }) => { if (!cancelled) setRelatedActivities(data || []); });
    return () => { cancelled = true; };
  }, [page, edited.id, supabase]);
  const [activeTab, setActiveTab] = useState(initialTab || 'details');
  const [quickCreateCustomer, setQuickCreateCustomer] = useState(null); // {prefillName, onCreated} // 'details' | '360'
  // Retail invoice templates (for retailInvoices page)
  const [invoiceTemplates,    setInvoiceTemplates]    = useState([]);
  const [selectedTemplateId,  setSelectedTemplateId]  = useState('');
  const [showPrintPreview,    setShowPrintPreview]    = useState(false);

  useEffect(() => {
    if (page !== 'retailInvoices' || !supabase) return;
    Promise.all([
      tenantScope(supabase.from('retail_invoice_templates').select('*')).order('created_at'),
      loadCanvasTemplates(supabase, 'retail_invoice'),
    ]).then(([{ data: legacy }, canvas]) => {
        const data = mergeTemplates(canvas || [], legacy || []);
        if (!data.length) return;
        setInvoiceTemplates(data);
        // Auto-select: use record's saved template, else the default (canvas first), else first
        const saved = data.find(t => t.id === (record?.invoice_template_id || edited.invoice_template_id));
        const pick = saved || pickDefault(data);
        if (pick) setSelectedTemplateId(pick.id);
      });
  }, [page, record?.id]);

  // Booking Receipt templates (for retailOrders page, rental mode only) —
  // same fetch shape as the invoice templates above, but there's no
  // per-record "template" column to remember a prior pick against (Orders
  // don't carry a booking_receipt_template_id the way Invoices carry
  // invoice_template_id), so it just falls back to the tenant default, then
  // the first template. The user can still switch templates from the
  // dropdown inside the preview modal itself.
  const [bookingReceiptTemplates, setBookingReceiptTemplates] = useState([]);
  const [selectedBookingTemplateId, setSelectedBookingTemplateId] = useState('');
  const [showBookingReceiptPreview, setShowBookingReceiptPreview] = useState(false);
  const [bookingReceiptPdfBusy, setBookingReceiptPdfBusy] = useState(false);

  useEffect(() => {
    if (page !== 'retailOrders' || appPreferences?.business_type !== 'rental' || !supabase) return;
    tenantScope(supabase.from('booking_receipt_templates').select('*')).order('created_at')
      .then(({ data }) => {
        if (!data) return;
        setBookingReceiptTemplates(data);
        const defTpl   = data.find(t => t.is_default);
        const fallback = data[0];
        const pick = defTpl || fallback;
        if (pick) setSelectedBookingTemplateId(pick.id);
      });
  }, [page, appPreferences?.business_type]);

  function handleBookingReceiptPrint(template, orderRecord, lineItems) {
    if (!template) { showAlert('Please design a Booking Receipt template first.', { variant:'warning' }); return; }
    const html = buildBookingReceiptHTML(template, orderRecord, lineItems);
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) { showAlert('Pop-up blocked. Please allow pop-ups for this site.', { variant:'warning' }); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 600);
  }

  async function handleBookingReceiptPdf(template, orderRecord, lineItems) {
    if (!template) { showAlert('Please design a Booking Receipt template first.', { variant:'warning' }); return; }
    setBookingReceiptPdfBusy(true);
    try {
      const html = buildBookingReceiptHTML(template, orderRecord, lineItems);
      const blob = await generateInvoicePdf(html, (template.paper_size||'a4').toLowerCase());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const num = (orderRecord?.displayNumber || orderRecord?.display_number) ? 'RORD-'+String(orderRecord.displayNumber||orderRecord.display_number).padStart(5,'0') : 'booking-receipt';
      a.href = url; a.download = `${num}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e:any) {
      showAlert('Could not generate PDF: ' + (e?.message || 'Unknown error'), { variant:'danger' });
    } finally {
      setBookingReceiptPdfBusy(false);
    }
  }

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
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
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
    await submitForApproval(page, record.id, record.name || record.customer || record.subject || (record.displayNumber ? formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', record.displayNumber) : record.id), matchingProcess || undefined);
    setSubmittingApproval(false);
    setEdited(p => ({ ...p, status: 'Pending Approval' }));
    setMatchingProcess(null);
  };

  // Live grand total for THIS component's own scope - reflects unsaved
  // line-item edits immediately (e.g. for the WhatsApp/email message
  // handlers below), using the exact same formula handleSave uses at
  // save time, so the two are always consistent with each other.
  const liveSubtotal = cfg.hasLineItems ? items.reduce((s,i) => s + computeLineGross(i), 0) : Number(edited.amount || 0);
  const liveTotalDisc = cfg.hasLineItems ? items.reduce((s,i) => s + computeLineGross(i)*Number(i.discount_pct||0)/100, 0) : 0;
  const liveTotalTax = cfg.hasLineItems ? items.reduce((s,i) => s + taxRegime.computeLineTax(i).totalTax, 0) : 0;
  const livePreHeaderDiscTotal = liveSubtotal - liveTotalDisc + liveTotalTax;
  const liveHeaderDiscountAmount = livePreHeaderDiscTotal * Number(edited.header_discount_pct || 0) / 100;
  const grandTotal = cfg.hasLineItems ? (livePreHeaderDiscTotal - liveHeaderDiscountAmount) : Number(edited.amount || 0);

  const handleSave = async (andClose=false) => {
    setSaving(true);
    try {
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
      // Rental validation: a line item for a rentable product must have a
      // Rental Start Date before the record can be saved — without it the
      // rental period (and the availability/booking calendar) has nothing
      // to anchor to. Only enforced for rows that actually reference a
      // rentable product; ordinary (non-rental) line items are unaffected.
      if (cfg.hasLineItems && Array.isArray(items)) {
        for (let ri = 0; ri < items.length; ri++) {
          const row = items[ri];
          if (!row || !row.product_id) continue;
          const prod = retailProducts.find(x => (x._uuid||x.id) === row.product_id);
          if (prod?.is_rentable && !row.rental_start_date) {
            showAlert(`Rental Start Date is required for rentable item "${row.product_name || prod.name || `Line ${ri+1}`}" before this record can be saved.`, { variant:'warning', title:'Rental Start Date Required' });
            return;
          }
        }
      }
      // Strip client-side computed fields that don't exist as DB columns
      // Strip client-side computed fields — keep custom_data as it's a real DB column
      const { displayNumber, _uuid, ...editedClean } = edited;
      let payload = { ...editedClean, custom_data: edited.custom_data || {} };
      // Clamp non-negative numeric fields at save time (belt-and-braces vs UI clamps)
      for (const nk of ['stock_quantity','reorder_level','loyalty_points','price','mrp','cost','shipping_cost','quantity']) {
        if (payload[nk] !== undefined && payload[nk] !== null && Number(payload[nk]) < 0) payload[nk] = 0;
      }
      if (cfg.hasLineItems) {
        const computed = { subtotal: liveSubtotal, total_discount: liveTotalDisc, total_tax: liveTotalTax, header_discount_pct: Number(edited.header_discount_pct || 0), header_discount_amount: liveHeaderDiscountAmount, amount: grandTotal };
        payload = { ...payload, ...computed };
        // Update edited state so Preview & Print immediately reflects correct totals
        setEdited(p => ({ ...p, ...computed }));
      }
      const savedOk = await updateRetailRecord(page, payload, items);
      // Rental: an invoice raised without an order has no booking behind it - offer to create one.
      if (savedOk === true) await offerBookingForInvoice(items);
      // Bug fix: onSaved() (wired to fetchMap[page]?.() by the parent) used to
      // only be called on the andClose=true path. That left the in-memory
      // retailOrders/etc. context array holding the PRE-edit row after a
      // plain "Save" (stay-open) — so closing the panel afterwards and
      // reopening the same record (row click sources `record` straight from
      // that array) showed the stale old values, even though the DB write
      // itself succeeded. Only a full page reload forced a fresh fetch and
      // showed the correct data. Refresh the list on every successful save,
      // regardless of whether the panel is closing.
      onSaved?.();
      if (andClose) {
        // Bug fix: this used to dispatch the pendingReturnTo navigation
        // directly here, bypassing the onClose prop entirely whenever
        // pendingReturnTo was set. The parent's onClose (RetailListPage)
        // is what clears selectedRecord — skipping it left the just-closed
        // record (e.g. a freshly created Order) sitting in selectedRecord
        // while the page navigated back to the source page (e.g. the
        // Customer list), so a second, mismatched/blank detail panel
        // rendered on top of the list. Always delegate to onClose, which
        // implements the identical pendingReturnTo-dispatch logic AFTER
        // clearing selectedRecord first.
        onClose();
      } else { setSaveSuccess(true); setTimeout(()=>setSaveSuccess(false),2500); }
    } catch (e: any) {
      console.error('[RetailDetailPanel] handleSave', e);
      showAlert('Save failed: ' + (e?.message || 'An unexpected error occurred.'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // See note in handleSave above — always delegate to the onClose prop
    // so selectedRecord is cleared before any pendingReturnTo navigation
    // fires. Do not dispatch 'open-crm-record' directly from here.
    onClose();
  };

  // Rental mode: invoice created directly (no order) -> offer a one-click booking so the dates are
  // actually reserved. Asked once per invoice per session; always available later under Actions.
  const invoiceNeedsBooking = (lineRows = items) =>
    page === 'retailInvoices' && appPreferences?.business_type === 'rental'
    && !edited.order_number && !record.order_number
    && (lineRows || []).some(i => i.product_id && i.rental_start_date && i.rental_end_date);
  const runCreateBooking = async (lineRows = items) => {
    const ord = await createBookingFromInvoice({ ...edited, id: record.id, displayNumber: record.displayNumber }, lineRows);
    if (ord) {
      showAlert(`Booking ${ord.label} created and linked to this invoice.`, { variant:'success', title:'Booking Created' });
      setEdited(p => ({ ...p, order_number: ord.label }));
      onSaved?.();
    }
  };
  const offerBookingForInvoice = async (lineRows) => {
    if (appPreferences?.rental_booking_prompt === false || !invoiceNeedsBooking(lineRows)) return;
    if (_bookingPromptShown.has(record.id)) return;
    _bookingPromptShown.add(record.id);
    const ok = await showConfirm('This invoice has rental items but is not linked to a booking, so those dates are not reserved. Create the booking now from this invoice?', { title: 'Create Booking?', confirmLabel: 'Create Booking', cancelLabel: 'Not now' });
    if (ok) await runCreateBooking(lineRows);
  };

  const handleCreateInvoice = async () => {
    setCreatingInvoice(true);
    const inv = await createRetailInvoiceFromOrder(edited);
    setCreatingInvoice(false);
    if (inv) {
      showAlert(`Invoice ${inv.display_number ? formatDisplayNumber('RINV', inv.display_number) : ''} created from this order.`, { variant:'success', title:'Invoice Created' });
      onSaved?.();
      setPendingReturnTo({ page: 'retailOrders', record: edited });
      setPendingRecord({ page: 'retailInvoices', record: inv });
      window.dispatchEvent(new CustomEvent('retail-navigate', { detail: { page: 'retailInvoices' } }));
      handleClose();
    }
  };

  // Resolve TAX_PRODUCT / TAX_DOCUMENT placeholder field sets dynamically
  const fieldLayout = useFieldLayout(page);
  // Custom fields on the Detail page through the Page Layout Designer: label, hidden, read-only, order.
  const detailCF = (customFields || [])
    .filter(cf => cf.show_on !== 'create')
    .map((cf, i) => {
      const r = resolveFieldDisplay(cfKey(cf.api_name), cf.label, fieldLayout.fields || [], { ...edited, ...(edited.custom_data || {}) }, 'detail');
      const row = resolveFieldRow(cfKey(cf.api_name), fieldLayout.fields || [], 'detail');
      return { ...cf, label: r.label, _hidden: !r.visible, _ro: !r.editable, _order: row ? row.display_order : 10000 + (cf.sort_order || i) };
    })
    .filter(cf => !cf._hidden)
    .sort((a, b) => a._order - b._order);
  const resolveFields = (fields) => {
    let out = fields;
    if (fields === 'TAX_PRODUCT') out = taxRegime.productFields.map(f => ({ ...f }));
    else if (fields === 'TAX_DOCUMENT') out = taxRegime.documentFields.map(f => ({ ...f }));
    return out
      .filter(f => typeof f.showIf !== 'function' || f.showIf(appPreferences))
      .map((f, originalIdx) => {
        const resolved = fieldLayout.resolve(f.key, f.label, edited, 'detail');
        const savedRow = resolveFieldRow(f.key, fieldLayout.fields, 'detail');
        // Fields with a saved override sort by their configured
        // display_order; fields without one keep their original relative
        // position, offset well above any realistic saved order value so
        // reordered fields (typically moved earlier) don't get pushed
        // behind untouched ones.
        const sortOrder = savedRow ? savedRow.display_order : 10000 + originalIdx;
        return { ...f, label: resolved.label, _layoutHidden: !resolved.visible, _layoutReadOnly: !resolved.editable, _sortOrder: sortOrder };
      })
      .filter(f => !f._layoutHidden)
      .sort((a, b) => a._sortOrder - b._sortOrder);
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
        onChange={cid=>{
          const c=retailCustomers.find(x=>(x._uuid||x.id)===cid);
          set('customer_id',c?._uuid||c?.id||''); set('customer',c?.name||''); set('customer_phone',c?.phone||'');
          // Auto-fill the address from the customer's own record, but only
          // if this field is currently empty - never overwrites an address
          // the user has already typed in or edited themselves.
          const addressField = page==='retailOrders' ? 'delivery_address' : page==='retailInvoices' ? 'billing_address' : null;
          if (addressField && !edited[addressField] && c) set(addressField, formatCustomerAddress(c));
        }}
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
    const html = buildRetailPrintHTML(template, record, lineItems, retailProducts, retailInvoiceCustomFieldsMeta);
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
      <div className="rw-panel bg-white rounded-[28px] shadow-2xl w-[98vw] my-4 mx-auto flex flex-col" style={{minHeight:'95vh'}}>
        <RedwoodSkin />
        {/* Header */}
        <div className="rw-header bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-5 rounded-t-[28px] flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <NavIcon iconKey={page} className="w-5 h-5 text-white"/>
              <h2 className="text-white text-xl font-bold">{edited.name || edited.subject || (record.displayNumber ? `${cfg.singular || ""} ${formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||"REC", record.displayNumber)}`.trim() : edited[cfg.idField])}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(edited.status)}`}>{edited.status}</span>
            </div>
            <p className="text-blue-300 text-xs mt-1 flex items-center gap-2">
              {record.displayNumber && (
                <span className="bg-blue-600 text-white font-mono font-bold px-2.5 py-0.5 rounded-full text-xs tracking-wider">
                  {formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', record.displayNumber)}
                </span>
              )}
              {!record.displayNumber && <span className="font-mono opacity-60">{edited[cfg.idField]}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saveSuccess && <span className="text-green-300 text-sm font-semibold mr-2">✓ Saved</span>}
            {page==='retailOrders' && (
              <div className="relative">
                <button onClick={() => setActionsMenuOpen(o => !o)}
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 border border-white/20">
                  ⚡ Actions <span className={`transition-transform ${actionsMenuOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {actionsMenuOpen && (() => {
                  const rawPhone = String(edited.customer_phone || '').replace(/\D/g, '');
                  const phone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
                  const orderNum = (record?.displayNumber || edited.display_number) ? 'RORD-'+String(record?.displayNumber || edited.display_number).padStart(5,'0') : 'this order';
                  return (
                    <>
                      <div className="fixed inset-0 z-[119]" onClick={() => setActionsMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-[120] text-left">
                        {canInvoiceOrder(appPreferences, edited.status) && (
                          <button onClick={() => { setActionsMenuOpen(false); handleCreateInvoice(); }} disabled={creatingInvoice}
                            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-blue-50 flex items-center gap-2.5 disabled:opacity-50">
                            {/* Bug fix: was `${t(lang,'create')} ${t(lang,'invoices')}` — 'invoices'
                                is the plural nav-label translation key, so this rendered as
                                "Create Invoices". This action creates exactly one invoice from
                                this order, so it reads "Create Invoice" (singular), matching the
                                wording used everywhere else this same action appears. */}
                            🧾 {creatingInvoice?t(lang,'loading'):RL('Create Invoice')}
                          </button>
                        )}
                        {appPreferences?.business_type === 'rental' && (
                          <button onClick={() => { setActionsMenuOpen(false); setShowBookingReceiptPreview(true); }}
                            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-blue-50 flex items-center gap-2.5">
                            🎫 Booking Receipt
                          </button>
                        )}
                        {appPreferences?.business_type === 'rental' && (
                          <button onClick={() => {
                            setActionsMenuOpen(false);
                            setPendingRecord({ page: 'retailActivities', openCreate: true, prefill: {
                              customer_id: edited.customer_id, customer: edited.customer, customer_phone: edited.customer_phone, related_order_number: edited.id,
                              subject: `Follow-up: Order ${orderNum}`,
                            } });
                            setPendingReturnTo({ page: 'retailOrders', record: record });
                            window.dispatchEvent(new CustomEvent('retail-navigate', { detail: { page: 'retailActivities' } }));
                          }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-blue-50 flex items-center gap-2.5">
                            📋 Create Activity
                          </button>
                        )}
                        {waConfig?.is_active && (
                          <button disabled={waSending || !rawPhone} onClick={async ()=>{
                            setActionsMenuOpen(false);
                            setWaSending(true);
                            try {
                              const res = await waFetch('/api/whatsapp/send', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  db_url: tenant?.db_url, tenantId: tenant?.id, to: phone,
                                  recordType: 'retailOrders', recordId: orderNum, recipientType: 'customer', sendMode: 'manual',
                                  templateKey: 'booking_confirmation', templateParams: [edited.customer || 'Customer', orderNum, String(grandTotal || 0)], record: edited,
                                }),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || 'Send failed');
                              showAlert('WhatsApp confirmation sent.', { variant:'success' });
                            } catch (e:any) {
                              showAlert('Could not send via WhatsApp API: ' + (e?.message || 'Unknown error') + ' — you can still use "Open in WhatsApp" below.', { variant:'danger' });
                            } finally { setWaSending(false); }
                          }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#128C7E] hover:bg-green-50 flex items-center gap-2.5 disabled:opacity-50">
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            {waSending ? 'Sending…' : 'Send Confirmation'}
                          </button>
                        )}
                        <button onClick={() => {
                          setActionsMenuOpen(false);
                          if (!rawPhone) { showAlert('No phone number on file for this customer.', { variant:'warning' }); return; }
                          const msg = encodeURIComponent(`Dear ${edited.customer||'Customer'}, your order ${orderNum} has been confirmed. Total: ₹${grandTotal||0}. Thank you!`);
                          window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                        }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#128C7E] hover:bg-green-50 flex items-center gap-2.5">
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          {waConfig?.is_active ? 'Open in WhatsApp' : 'WhatsApp'}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
            {page==='retailInvoices' && (
              <div className="relative">
                <button onClick={() => setActionsMenuOpen(o => !o)}
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 border border-white/20">
                  ⚡ Actions <span className={`transition-transform ${actionsMenuOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {actionsMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[119]" onClick={() => setActionsMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-[120] text-left">
                      {invoiceNeedsBooking() && (
                        <button onClick={() => { setActionsMenuOpen(false); runCreateBooking(); }}
                            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-50 flex items-center gap-2.5">
                            📅 Create Booking from Invoice
                          </button>
                        )}
                      <button
                        onClick={() => { setActionsMenuOpen(false); setShowPrintPreview(true); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-blue-50 flex items-center gap-2.5">
                        👁️ Preview & Print
                      </button>
                      <button
                        onClick={() => { setActionsMenuOpen(false); handleDirectPrint(invoiceTemplates.find(t=>t.id===selectedTemplateId), edited, items); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-blue-50 flex items-center gap-2.5">
                        🖨️ Print
                      </button>
                      {waConfig?.is_active && (
                        <button disabled={waSending} onClick={async ()=>{
                          setActionsMenuOpen(false);
                          const rawPhone = String(edited.customer_phone || '').replace(/\D/g, '');
                          if (!rawPhone) { showAlert('No phone number on file for this customer — add one to the Customer Phone field first.', { variant:'warning' }); return; }
                          const phone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
                          const invNum = (record?.displayNumber || edited.display_number) ? 'RINV-'+String(record?.displayNumber || edited.display_number).padStart(5,'0') : 'this invoice';
                          setWaSending(true);
                          try {
                            const res = await waFetch('/api/whatsapp/send', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                db_url: tenant?.db_url, tenantId: tenant?.id, to: phone,
                                recordType: 'retailInvoices', recordId: invNum, recipientType: 'customer', sendMode: 'manual',
                                templateKey: 'invoice_notice', templateParams: [edited.customer || 'Customer', invNum, String(grandTotal || 0)], record: edited,
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Send failed');
                            showAlert('WhatsApp message sent.', { variant:'success' });
                          } catch (e:any) {
                            showAlert('Could not send via WhatsApp API: ' + (e?.message || 'Unknown error') + ' — you can still use "Open in WhatsApp" below.', { variant:'danger' });
                          } finally { setWaSending(false); }
                        }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#128C7E] hover:bg-green-50 flex items-center gap-2.5 disabled:opacity-50">
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          {waSending ? 'Sending…' : 'Send WhatsApp (Instant)'}
                        </button>
                      )}
                      {waConfig?.is_active && (
                        <button disabled={waSendingPdf} onClick={async ()=>{
                          setActionsMenuOpen(false);
                          const rawPhone = String(edited.customer_phone || '').replace(/\D/g, '');
                          if (!rawPhone) { showAlert('No phone number on file for this customer — add one to the Customer Phone field first.', { variant:'warning' }); return; }
                          const phone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
                          const invNum = (record?.displayNumber || edited.display_number) ? 'RINV-'+String(record?.displayNumber || edited.display_number).padStart(5,'0') : 'this invoice';
                          const template = invoiceTemplates.find(t=>t.id===selectedTemplateId);
                          if (!template) { showAlert('Select an invoice template first.', { variant:'warning' }); return; }
                          setWaSendingPdf(true);
                          try {
                            const html = buildRetailPrintHTML(template, edited, items, retailProducts, retailInvoiceCustomFieldsMeta);
                            const pdfBlob = await generateInvoicePdf(html, template.paper_size);
                            const fileBase64 = await blobToBase64(pdfBlob);
                            const filename = `Invoice ${invNum}.pdf`;
                            const uploadRes = await waFetch('/api/whatsapp/upload-media', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ db_url: tenant?.db_url, tenantId: tenant?.id, fileBase64, filename, mimeType: 'application/pdf' }),
                            });
                            const uploadData = await uploadRes.json();
                            if (!uploadRes.ok) throw new Error(uploadData.error || 'PDF upload failed');
                            // Sent as a document message (not a template) -
                            // works within Meta's 24h customer-service
                            // window without needing the approved template
                            // to have a Document header specially configured.
                            const sendRes = await waFetch('/api/whatsapp/send', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                db_url: tenant?.db_url, tenantId: tenant?.id, to: phone,
                                recordType: 'retailInvoices', recordId: invNum, recipientType: 'customer', sendMode: 'manual',
                                documentMediaId: uploadData.mediaId, documentFilename: filename,
                                freeformText: `Dear ${edited.customer||'Customer'}, please find your invoice ${invNum} attached. Total: ₹${grandTotal||0}.`,
                              }),
                            });
                            const sendData = await sendRes.json();
                            if (!sendRes.ok) throw new Error(sendData.error || 'Send failed');
                            showAlert('Invoice PDF sent via WhatsApp.', { variant:'success' });
                          } catch (e:any) {
                            showAlert('Could not send PDF: ' + (e?.message || 'Unknown error') + ' — this only works within 24h of the customer\'s last WhatsApp message to you.', { variant:'danger' });
                          } finally { setWaSendingPdf(false); }
                        }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#128C7E] hover:bg-green-50 flex items-center gap-2.5 disabled:opacity-50">
                          📎 {waSendingPdf ? 'Preparing PDF…' : 'Send with PDF Attachment'}
                        </button>
                      )}
                      <button onClick={()=>{
                        setActionsMenuOpen(false);
                        const invNum = (record?.displayNumber || edited.display_number) ? 'RINV-'+String(record?.displayNumber || edited.display_number).padStart(5,'0') : 'this invoice';
                        const msg = encodeURIComponent(`Dear ${edited.customer||'Customer'}, please find your invoice ${invNum}. Total: ₹${grandTotal||0}. Thank you!`);
                        const rawPhone = String(edited.customer_phone || '').replace(/\D/g, '');
                        if (!rawPhone) { showAlert('No phone number on file for this customer — add one to the Customer Phone field first.', { variant:'warning' }); return; }
                        // wa.me expects a full international number with no leading 0/+.
                        // A 10-digit number with no country code is assumed domestic
                        // (India, 91) per this tenant's default currency/locale —
                        // adjust here if targeting a different primary market.
                        const phone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
                        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                      }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#128C7E] hover:bg-green-50 flex items-center gap-2.5">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        {waConfig?.is_active ? 'Open in WhatsApp' : 'WhatsApp'}
                      </button>
                      <button onClick={()=>{
                        setActionsMenuOpen(false);
                        const invNum = (record?.displayNumber || edited.display_number) ? 'RINV-'+String(record?.displayNumber || edited.display_number).padStart(5,'0') : 'this invoice';
                        const sub = encodeURIComponent('Invoice '+invNum);
                        const body = encodeURIComponent('Dear '+( edited.customer||'Customer')+',%0A%0APlease find your invoice '+invNum+'.%0ATotal: ₹'+(grandTotal||0)+'%0A%0AThank you!');
                        window.open('mailto:'+(edited.customer_email||edited.email||'')+'?subject='+sub+'&body='+body,'_blank');
                      }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 flex items-center gap-2.5">
                        ✉️ Email
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {page==='retailActivities' && (
              <div className="relative">
                <button onClick={() => setActionsMenuOpen(o => !o)}
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 border border-white/20">
                  ⚡ Actions <span className={`transition-transform ${actionsMenuOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {actionsMenuOpen && (() => {
                  const rawPhone = String(edited.customer_phone || '').replace(/\D/g, '');
                  const phone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
                  return (
                    <>
                      <div className="fixed inset-0 z-[119]" onClick={() => setActionsMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-[120] text-left">
                        {appPreferences?.business_type === 'rental' && edited.status==='Completed' && !edited.related_order_number && (
                          <button onClick={() => {
                            setActionsMenuOpen(false);
                            // Hands the customer off directly to the Create
                            // Order modal, using the same
                            // pendingRecord.openCreate mechanism this app
                            // already has for exactly this kind of
                            // cross-page prefilled handoff - rather than the
                            // Manage Bookings calendar, which requires
                            // picking a product before a customer or dates
                            // can even be entered. linkBack tells the
                            // generic onCreated handler to write the new
                            // order's reference back onto this activity -
                            // without this, the activity never learns a
                            // booking was already created from it, so this
                            // option would keep reappearing every time the
                            // activity is reopened.
                            setPendingRecord({ page: 'retailOrders', openCreate: true, prefill: { customer_id: edited.customer_id, customer: edited.customer },
                              linkBack: { table: 'retail_activities', id: edited.id, field: 'related_order_number' } });
                            setPendingReturnTo({ page: 'retailActivities', record: record });
                            window.dispatchEvent(new CustomEvent('retail-navigate', { detail: { page: 'retailOrders' } }));
                          }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-blue-50 flex items-center gap-2.5">
                            📅 Create Booking
                          </button>
                        )}
                        {waConfig?.is_active && (
                          <button disabled={waSending || !rawPhone} onClick={async ()=>{
                            setActionsMenuOpen(false);
                            setWaSending(true);
                            try {
                              const res = await waFetch('/api/whatsapp/send', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  db_url: tenant?.db_url, tenantId: tenant?.id, to: phone,
                                  recordType: 'retailActivities', recordId: edited.id, recipientType: 'customer', sendMode: 'manual',
                                  templateKey: 'activity_followup', templateParams: [edited.customer || 'Customer', edited.subject || 'your recent visit', edited.activity_date || ''], record: edited,
                                }),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || 'Send failed');
                              showAlert('WhatsApp message sent.', { variant:'success' });
                            } catch (e:any) {
                              showAlert('Could not send via WhatsApp API: ' + (e?.message || 'Unknown error') + ' — you can still use "Open in WhatsApp" below.', { variant:'danger' });
                            } finally { setWaSending(false); }
                          }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#128C7E] hover:bg-green-50 flex items-center gap-2.5 disabled:opacity-50">
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            {waSending ? 'Sending…' : 'Send WhatsApp (Instant)'}
                          </button>
                        )}
                        <button onClick={() => {
                          setActionsMenuOpen(false);
                          if (!rawPhone) { showAlert('No phone number on file for this customer.', { variant:'warning' }); return; }
                          const msg = encodeURIComponent(`Hi ${edited.customer || 'there'}, following up on "${edited.subject || 'our recent conversation'}". Let us know if you have any questions!`);
                          window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                        }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#128C7E] hover:bg-green-50 flex items-center gap-2.5">
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          {waConfig?.is_active ? 'Open in WhatsApp' : 'WhatsApp'}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
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
          <div className="rw-tabs flex bg-slate-800 border-b border-slate-700 px-6 flex-shrink-0">
            {[
              {k:'details', l:'📋 Details'},
              {k:'360',     l:`🔄 ${getObjectLabel('retailCustomers', 'Customer', 'singular')} 360`},
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

        {!(page === 'retailCustomers' && activeTab === '360') && (() => {
          const hl = [];
          for (const sec of (cfg.sections || [])) for (const f of (Array.isArray(sec.fields) ? sec.fields : [])) {
            if (hl.length >= 5) break;
            if (f.key === 'name' || f.type === 'textarea') continue;
            const r = resolveFieldDisplay(f.key, f.label, fieldLayout.fields || [], edited, 'detail');
            if (!r.visible) continue;
            let v = edited[f.key];
            if (typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v)) { const b = f.key.replace(/_id$/, ''); v = edited[b + '_name'] || (typeof edited[b] === 'string' && !/^[0-9a-f]{8}-/i.test(edited[b]) ? edited[b] : '') || ''; if (!v) continue; }
            hl.push({ label: r.label, value: v === undefined || v === null || v === '' ? '' : (f.type === 'number' && /amount|price|total|cost/i.test(f.key) ? formatCurrency(Number(v)||0) : String(v)) });
          }
          return hl.length ? <RecordHighlights items={hl} /> : null;
        })()}

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
              onNavigate={(targetPage, rec) => onC360Navigate?.(targetPage, rec, { page, record, tab: '360' })}
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
                <h4 className="font-bold text-[#0F172A] text-sm">🔑 This item is rentable</h4>
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
          {page==='retailActivities' && edited.related_order_number && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-2">
              <span className="text-amber-700 text-sm font-semibold">🔗 Related Order:</span>
              <button onClick={async () => {
                const { data: orderRow } = await supabase.from('retail_orders').select('*').eq('order_number', edited.related_order_number).maybeSingle();
                if (!orderRow) { showAlert('That order could not be found — it may have been deleted.', { variant:'warning' }); return; }
                const orderRecord = { ...orderRow, id: orderRow.order_number, _uuid: orderRow.id, displayNumber: orderRow.display_number };
                setPendingRecord({ page: 'retailOrders', record: orderRecord });
                setPendingReturnTo({ page: 'retailActivities', record: record });
                window.dispatchEvent(new CustomEvent('retail-navigate', { detail: { page: 'retailOrders' } }));
              }} className="text-blue-600 hover:text-blue-800 font-bold text-sm underline underline-offset-2">
                {relatedOrderDisplay || edited.related_order_number}
              </button>
            </div>
          )}
          {page==='retailOrders' && relatedActivities.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <span className="text-amber-700 text-sm font-semibold block mb-1.5">🔗 Related Activities:</span>
              <div className="flex flex-wrap gap-2">
                {relatedActivities.map(act => (
                  <button key={act.id} onClick={() => {
                    const actRecord = { ...act, id: act.activity_number, _uuid: act.id, displayNumber: act.display_number };
                    setPendingRecord({ page: 'retailActivities', record: actRecord });
                    setPendingReturnTo({ page: 'retailOrders', record: record });
                    window.dispatchEvent(new CustomEvent('retail-navigate', { detail: { page: 'retailActivities' } }));
                  }} className="text-blue-600 hover:text-blue-800 font-bold text-sm underline underline-offset-2 bg-white px-2.5 py-1 rounded-lg border border-amber-200">
                    {formatDisplayNumber('RACT', act.display_number)} — {act.subject}
                  </button>
                ))}
              </div>
            </div>
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
                        {field._layoutReadOnly ? (
                          <div className={`${sCls} bg-gray-50 text-gray-500 cursor-not-allowed flex items-center`} title="Made read-only by this tenant's Page Layout Designer settings">
                            {String(edited[field.key] ?? '') || <span className="text-gray-300">—</span>}
                          </div>
                        ) : renderField(field)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>



          {/* Additional Information — App Composer custom fields, only when published */}
          {detailCF.length > 0 && (
            <div className="bg-white rounded-[20px] border border-blue-100 shadow-sm">
              <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 rounded-t-[20px] flex items-center gap-2">
                <span>🎛️</span>
                <span className="font-bold text-[#0F172A] text-sm">Additional Information</span>
                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold ml-auto">App Composer</span>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {detailCF.map(cf => {
                  const cdVal = (edited.custom_data || {})[cf.api_name];
                  const setCdVal = (val) => setEdited(p => ({ ...p, custom_data: { ...(p.custom_data||{}), [cf.api_name]: val } }));
                  return (
                    <fieldset key={cf.api_name} disabled={cf._ro} title={cf._ro ? 'Read-only (Page Layout Designer)' : undefined} className={`min-w-0 border-0 p-0 m-0 ${cf._ro?'opacity-60':''} ${cf.field_type==='multi_select'?'sm:col-span-2':''}`}>
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
                    </fieldset>
                  );
                })}
              </div>
            </div>
          )}

          {/* Line items for Orders/Invoices */}
          {cfg.hasLineItems && (
            loadingLI
              ? <div className="bg-white rounded-[20px] border border-blue-100 shadow p-8 text-center text-gray-400">Loading line items...</div>
              : <RetailLineItems items={items} setItems={setItems} products={retailProducts} taxRegime={taxRegime} page={page} headerDiscountPct={edited.header_discount_pct} onHeaderDiscountChange={v=>set('header_discount_pct',v)}/>
          )}

          {/* System Information */}
          <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm">
            <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-100 rounded-t-[20px]">
              <h3 className="font-bold text-gray-500 text-sm flex items-center gap-2">⚙️ System Information</h3>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {[
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
        {rbac.can(page, 'delete') && <div className="flex justify-end px-6 py-3 border-t border-gray-100 flex-shrink-0">
          <button onClick={async()=>{ await deleteRetailRecord(page, edited.id); onSaved?.(); handleClose(); }}
            className="text-red-500 hover:text-red-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-red-50">
            🗑️ Delete {cfg.singular}
          </button>
        </div>}
      </div>
    </div>

    {/* Create Customer — the full Create Customer modal, same as clicking
        "+ Create Customer" from the Customers list itself, rather than a
        separate lightweight quick-create form. */}
    {quickCreateCustomer && (
      <RetailCreateModal
        page="retailCustomers"
        open={true}
        prefill={{ name: quickCreateCustomer.prefillName || '' }}
        onClose={()=>setQuickCreateCustomer(null)}
        onCreated={async(rec)=>{
          quickCreateCustomer.onCreated(rec._uuid || rec.id, rec.name, rec.phone || '');
          setQuickCreateCustomer(null);
          await fetchRetailCustomers();
          showAlert(`Customer "${rec.name}" created successfully.`, { variant: 'success' });
        }}
      />
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
    {showBookingReceiptPreview && page==='retailOrders' && (
      <BookingReceiptPrintModal
        templates={bookingReceiptTemplates}
        templateId={selectedBookingTemplateId}
        onTemplateChange={setSelectedBookingTemplateId}
        record={edited}
        items={items}
        onClose={()=>setShowBookingReceiptPreview(false)}
        onPrint={()=>handleBookingReceiptPrint(bookingReceiptTemplates.find(t=>t.id===selectedBookingTemplateId), edited, items)}
        onDownloadPdf={()=>handleBookingReceiptPdf(bookingReceiptTemplates.find(t=>t.id===selectedBookingTemplateId), edited, items)}
        downloading={bookingReceiptPdfBusy}
      />
    )}
    </>
  );
}

// ─── Create Modal ───────────────────────────────────────────────────────────
export function RetailCreateModal({ page, open, onClose, onCreated, prefill = null }) {
  const { createRetailRecord, retailCustomers, retailProducts, enterpriseUsers, currentUser, appPreferences, appearance } = useApp();
  const { supabase } = useTenant();
  const { showAlert } = useAlert();
  const lang = appearance?.language || 'en';
  const cfg = RETAIL_CONFIG[page];
  const taxRegime = getTaxRegime(appPreferences?.default_currency);
  const fieldLayout = useFieldLayout(page);
  const { fields: headerCustomFields } = useCustomFields(page);
  const { getObjectLabel } = useObjectLabels();
  const [quickCreateCustomer, setQuickCreateCustomer] = useState(null);

  // Resolves one field_layout_config/app_custom_fields default_value
  // (always stored as plain text) into the actual value to seed the form
  // with - 'today' is a dynamic keyword for date fields so the default
  // always reflects the real current date rather than whatever date
  // string was typed in as the default at config time; a checkbox field's
  // text default is parsed as a boolean; everything else is used as-is.
  const HEADER_RELATIVE_DEFAULT_RE = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*([+-]\d+)?$/;
  const resolveDefaultValue = (fieldType, rawValue, sourceRow: any = null) => {
    if (rawValue === undefined || rawValue === null || rawValue === '') return undefined;
    if (fieldType === 'datetime') return resolveLayoutDefault('datetime', rawValue, sourceRow);
    if (fieldType === 'date') {
      if (rawValue.toLowerCase() === 'today') return todayLocalISO();
      const m = rawValue.match(HEADER_RELATIVE_DEFAULT_RE);
      if (m) {
        const refVal = sourceRow?.[m[1]];
        if (!refVal) return undefined;
        const d = new Date(refVal + 'T00:00:00');
        if (isNaN(d.getTime())) return undefined;
        if (m[2]) d.setDate(d.getDate() + parseInt(m[2], 10));
        return d.toLocaleDateString('en-CA');
      }
      return rawValue;
    }
    if (fieldType === 'checkbox' || fieldType === 'boolean') return rawValue.toLowerCase() === 'true';
    if (fieldType === 'number') { const n = Number(rawValue); return Number.isNaN(n) ? undefined : n; }
    return rawValue;
  };

  const defaultForm = (withLayout = true) => {
    const base: any = {
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
    };
    // Admin-configured standard field defaults - applied after the
    // hardcoded ones above so an admin's own configuration always wins,
    // for ANY standard field on this object, not just the fixed set
    // hardcoded here. This is what makes the feature dynamic rather than
    // requiring a code change per field.
    const fieldTypeByKey: Record<string,string> = {};
    (cfg.sections||[]).forEach(s => (s.fields||[]).forEach(f => { fieldTypeByKey[f.key] = f.type; }));
    // Only rows that apply to the CREATE page (Create-only + Both Pages) - never Detail-only rows.
    if (withLayout) effectiveRows(fieldLayout.fields || [], 'create').forEach(row => {
      if (row.field_key.startsWith('cf_')) return;
      const resolved = resolveDefaultValue(fieldTypeByKey[row.field_key] || 'text', row.default_value, base);
      if (resolved !== undefined) base[row.field_key] = resolved;
    });
    // Admin-configured custom field defaults, into custom_data - same
    // mechanism, works for any custom field defined on this object.
    const custom_data: Record<string, any> = {};
    (headerCustomFields || []).forEach(f => {
      const cfRow = withLayout ? resolveFieldRow(cfKey(f.api_name), fieldLayout.fields || [], 'create') : undefined;
      const resolved = resolveDefaultValue(f.field_type, cfRow?.default_value ?? f.default_value);
      if (resolved !== undefined) custom_data[f.api_name] = resolved;
    });
    if (Object.keys(custom_data).length) base.custom_data = custom_data;
    return base;
  };

  const [form, setForm] = useState(defaultForm);
  const wasOpenRef = useRef(false);

  // Resets the form only on an actual closed->open transition (or when the
  // object type changes while open), never merely because prefill's object
  // identity changed - a fresh {..} literal from the caller on every
  // render would otherwise silently wipe out anything the user had typed,
  // since React compares effect dependencies by reference, not value.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setForm({ ...defaultForm(), ...(prefill || {}) });
    }
    wasOpenRef.current = open;
  }, [open, page]);

  // The Page Layout Designer config can finish loading AFTER the form was first seeded (first open of the
  // session, or published while open). Re-apply the configured defaults then — but only into fields the
  // user hasn't touched (still empty, or still holding the built-in fallback) and that the caller didn't prefill.
  const layoutDefaultsSig = JSON.stringify(effectiveRows(fieldLayout.fields || [], 'create').map(r => [r.field_key, r.default_value || '']))
    + '|' + JSON.stringify((headerCustomFields || []).map(f => [f.api_name, f.default_value || '']));
  useEffect(() => {
    if (!open || fieldLayout.loading) return;
    const withL = defaultForm(true), noL = defaultForm(false);
    setForm(f => {
      const n = { ...f };
      Object.keys(withL).forEach(k => {
        if (k === 'custom_data') return;
        if (prefill && Object.prototype.hasOwnProperty.call(prefill, k)) return;
        if (withL[k] === noL[k]) return;
        if (f[k] === undefined || f[k] === '' || f[k] === noL[k]) n[k] = withL[k];
      });
      if (withL.custom_data) {
        const cd = { ...(f.custom_data || {}) };
        Object.keys(withL.custom_data).forEach(k => { if (cd[k] === undefined || cd[k] === '') cd[k] = withL.custom_data[k]; });
        n.custom_data = cd;
      }
      return n;
    });
  }, [open, fieldLayout.loading, layoutDefaultsSig]);
  // ── {{token}} templates & = formulas from the Page Layout Designer / App Composer ──
  const _fieldTypeByKey = {};
  (cfg.sections||[]).forEach(sec => (sec.fields||[]).forEach(f => { _fieldTypeByKey[f.key] = f.type; }));
  const _tpl = gatherTemplates(effectiveRows(fieldLayout.fields || [], 'create'), headerCustomFields || [], k => _fieldTypeByKey[k] || 'text',
    api => resolveFieldRow(cfKey(api), fieldLayout.fields || [], 'create'));
  const _tplFields = [
    ...(cfg.sections||[]).flatMap(sec => (sec.fields||[]).map(f => ({ key: f.key, label: f.label, type: f.type, alt: [fieldLayout.fields?.find(r => r.field_key === f.key)?.custom_label].filter(Boolean) }))),
    ...(headerCustomFields || []).map(f => ({ key: f.api_name, label: f.label, type: f.field_type, alt: [fieldLayout.fields?.find(r => r.field_key === cfKey(f.api_name))?.custom_label].filter(Boolean) })),
  ];
  useTemplateDefaults({
    open, templates: _tpl.templates, fields: _tplFields, user: currentUser,
    values: { ...form, ...(form.custom_data || {}) },
    onPatch: (patch) => setForm(f => {
      const n = { ...f }; const cd = { ...(f.custom_data || {}) };
      Object.keys(patch).forEach(k => { if (_tpl.customKeys.has(k)) cd[k] = patch[k]; else n[k] = patch[k]; });
      n.custom_data = cd; return n;
    }),
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  // Line items on the Create page — opt-in from the Page Layout Designer (line-item object → "Show this Line Items grid on the Create page").
  const [items, setItems] = useState([]);
  const lineLayoutObj = page === 'retailInvoices' ? 'retailInvoiceLineItems' : 'retailOrderLineItems';
  const lineLayoutRows = useFieldLayout(cfg.hasLineItems ? lineLayoutObj : page);
  const showLines = !!cfg.hasLineItems && createGridEnabled(lineLayoutRows.fields);
  useEffect(() => { if (!open) setItems([]); }, [open]);
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
    // Apply the same field layout config used on the edit view: custom
    // labels, hidden fields, and ordering. Conditional rules evaluate
    // against the in-progress form state as the user fills it in.
    // Read-only doesn't apply here — there's no existing value to lock on a
    // brand-new record, so that part of the config only affects editing.
    return flat
      .map((f, originalIdx) => {
        const resolved = fieldLayout.resolve(f.key, f.label, form, 'create');
        const savedRow = resolveFieldRow(f.key, fieldLayout.fields, 'create');
        const sortOrder = savedRow ? savedRow.display_order : 10000 + originalIdx;
        return { ...f, label: resolved.label, _layoutHidden: !resolved.visible, _layoutReadOnly: !resolved.editable, _sortOrder: sortOrder };
      })
      .filter(f => !f._layoutHidden)
      .sort((a, b) => a._sortOrder - b._sortOrder);
  }, [page, appPreferences, fieldLayout.fields, form]);

  if (!open) return null;

  // Custom fields on the Create page through the Page Layout Designer: label, hidden, read-only, order.
  const createCF = createCustomFields
    .filter(cf => !cf.show_on || cf.show_on === 'both' || cf.show_on === 'create')
    .map((cf, i) => {
      const r = resolveFieldDisplay(cfKey(cf.api_name), cf.label, fieldLayout.fields || [], { ...form, ...(form.custom_data || {}) }, 'create');
      const row = resolveFieldRow(cfKey(cf.api_name), fieldLayout.fields || [], 'create');
      return { ...cf, label: r.label, _hidden: !r.visible, _ro: !r.editable, _order: row ? row.display_order : 10000 + (cf.sort_order || i) };
    })
    .filter(cf => !cf._hidden)
    .sort((a, b) => a._order - b._order);

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
      let payload = form;
      const lines = showLines ? items.filter(i => i && (i.product_id || i.product_name)) : [];
      if (showLines && lines.length) {
        const sub = lines.reduce((a, i) => a + computeLineGross(i), 0);
        const disc = lines.reduce((a, i) => a + computeLineGross(i) * Number(i.discount_pct || 0) / 100, 0);
        const tax = lines.reduce((a, i) => a + taxRegime.computeLineTax(i).totalTax, 0);
        const pre = sub - disc + tax;
        const hd = pre * Number(form.header_discount_pct || 0) / 100;
        payload = { ...form, subtotal: sub, total_discount: disc, total_tax: tax, header_discount_pct: Number(form.header_discount_pct || 0), header_discount_amount: hd, amount: pre - hd };
        for (const row of lines) {
          const prod = (retailProducts || []).find(x => (x._uuid || x.id) === row.product_id);
          if (prod?.is_rentable && !row.rental_start_date) { showAlert(`Rental Start Date is required for rentable item "${row.product_name || prod.name}".`, { variant: 'warning', title: 'Rental Start Date Required' }); setSaving(false); return; }
        }
      }
      const rec = await createRetailRecord(page, payload, lines);
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
      onChange={cid=>{
        const c=retailCustomers.find(x=>(x._uuid||x.id)===cid);
        s('customer_id',c?._uuid||c?.id||''); s('customer',c?.name||''); s('customer_phone',c?.phone||'');
        const addressField = page==='retailOrders' ? 'delivery_address' : page==='retailInvoices' ? 'billing_address' : null;
        if (addressField && !form[addressField] && c) s(addressField, formatCustomerAddress(c));
      }}
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
      <div className={`rw-panel rw-modal relative bg-white rounded-[28px] shadow-2xl w-full ${showLines ? 'max-w-6xl' : 'max-w-2xl'} max-h-[90vh] flex flex-col overflow-hidden`}>
        <RedwoodSkin />
        <div className="rw-header bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-5 flex items-center justify-between flex-shrink-0">
          <h2 className="text-white text-xl font-bold flex items-center gap-2"><NavIcon iconKey={page} className="w-5 h-5"/> Create {getObjectLabel(page, cfg.singular, 'singular')}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {createFields.map(f => (
              <fieldset key={f.key} disabled={f._layoutReadOnly} title={f._layoutReadOnly ? 'Read-only (Page Layout Designer)' : undefined} className={`min-w-0 border-0 p-0 m-0 ${f._layoutReadOnly?'opacity-60':''} ${f.type==='textarea'?'sm:col-span-2':''}`}>
                {f.type!=='checkbox' && (
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    {f.label}{f.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                )}
                {renderField(f)}
              </fieldset>
            ))}
          </div>

          {/* Additional Information — custom fields shown on create */}
          {createCF.length > 0 && (
            <div className="mt-4 bg-blue-50/40 rounded-[18px] border border-blue-100 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                <span>🎛️</span> Additional Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {createCF.map(cf=>{
                  const cdVal=(form.custom_data||{})[cf.api_name];
                  const setCdVal=(val)=>setForm(p=>({...p,custom_data:{...(p.custom_data||{}),[cf.api_name]:val}}));
                  const isWide=cf.field_type==='multi_select';
                  return (
                    <fieldset key={cf.api_name} disabled={cf._ro} className={`min-w-0 border-0 p-0 m-0 ${cf._ro?'opacity-60':''} ${isWide?'sm:col-span-2':''}`}>
                      {cf.field_type!=='checkbox'&&<label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">{cf.label}{cf.required&&<span className="text-red-400 ml-1">*</span>}</label>}
                      {cf.field_type==='single_select'
                        ?<select value={cdVal||''} onChange={e=>setCdVal(e.target.value)} className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"><option value="">Select {cf.label}...</option>{cf.options.map(o=><option key={o}>{o}</option>)}</select>
                        :cf.field_type==='multi_select'
                        ?<div className="flex flex-wrap gap-3">{cf.options.map(o=>(<label key={o} className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-blue-600" checked={(cdVal||'').split('||').includes(o)} onChange={e=>{const cur=(cdVal||'').split('||').filter(Boolean);const nxt=e.target.checked?[...cur,o]:cur.filter(x=>x!==o);setCdVal(nxt.join('||'));}}/>{o}</label>))}</div>
                        :cf.field_type==='checkbox'
                        ?<label className="flex items-center gap-2 cursor-pointer pt-1"><input type="checkbox" className="w-4 h-4 accent-blue-600" checked={!!cdVal} onChange={e=>setCdVal(e.target.checked)}/><span className="text-sm font-semibold">{cf.label}</span></label>
                        :<input type={cf.field_type==='number'||cf.field_type==='currency'?'number':cf.field_type==='date'?'date':cf.field_type==='datetime'?'datetime-local':cf.field_type==='email'?'email':cf.field_type==='url'?'url':'text'} value={cdVal||''} onChange={e=>setCdVal(e.target.value)} placeholder={cf.label} className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                      }
                    </fieldset>
                  );
                })}
              </div>
            </div>
          )}

          {showLines && (
            <div className="mt-5">
              <RetailLineItems items={items} setItems={setItems} products={retailProducts} taxRegime={taxRegime} page={page} scope="create"
                headerDiscountPct={form.header_discount_pct} onHeaderDiscountChange={v => s('header_discount_pct', v)} />
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
      <RetailCreateModal
        page="retailCustomers"
        open={true}
        prefill={{ name: quickCreateCustomer.prefillName || '' }}
        onClose={()=>setQuickCreateCustomer(null)}
        onCreated={(rec)=>{
          quickCreateCustomer.onCreated(rec._uuid || rec.id, rec.name, rec.phone || '');
          setQuickCreateCustomer(null);
          showAlert(`Customer "${rec.name}" created successfully.`, { variant: 'success' });
        }}
      />
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

  const pageFieldMetaLayout = useFieldLayout(page);
  const pageFieldMeta = useMemo(() => {
    const base = getRetailFieldMeta(page);
    if (!pageFieldMetaLayout.fields.length) return base;
    return base.map(m => {
      const savedRow = pageFieldMetaLayout.fields.find(r => r.field_key === m.key);
      return savedRow?.custom_label ? { ...m, label: savedRow.custom_label } : m;
    });
  }, [page, pageFieldMetaLayout.fields]);
  const retailFieldLabel = (key) => pageFieldMeta.find(f => f.key === key)?.label || key;

  const describe = (f) => {
    const parts = [];
    if (f.search)            parts.push(`Search: "${f.search}"`);
    if (f.status && f.status !== 'All') parts.push(`Status: ${f.status}`);
    if (f.timePeriod)        parts.push(f.timePeriod.replace(/_/g,' '));
    (f.advFilters||[]).forEach(c => { if (c.field && (c.value || c.op==='is_empty' || c.op==='is_not_empty' || c.op==='is_true' || c.op==='is_false')) parts.push(`${retailFieldLabel(c.field)} ${retailOperatorLabel(c.op)} ${c.value||''}`.trim()); });
    if (f.owner)             parts.push(`Owner: ${f.owner}`);
    if (f.sortField)         parts.push(`Sorted by ${retailFieldLabel(f.sortField)} (${f.sortDir==='desc'?'descending':'ascending'})`);
    if (f.columns?.length)   parts.push(`${f.columns.length} column${f.columns.length===1?'':'s'} shown`);
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
  const sameColumns = (a, b) => JSON.stringify(a||[]) === JSON.stringify(b||[]);
  const isCurrentlyApplied = (s) => {
    if (normalizeFilters(s.filters) !== normalizeFilters(currentFilters)) return false;
    if (s.filters?.columns?.length && !sameColumns(s.filters.columns, currentFilters.columns)) return false;
    return true;
  };

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
          <div className="font-bold text-sm text-[#0F172A] mb-1.5 truncate">{cfg.listColumns[0]?.v(r) ?? (r.display_number ? formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', r.display_number) : 'Untitled')}</div>
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

// RETAIL_CONFIG (above) doesn't carry the actual database table name — that
// lives in a separate map inside AppContext.tsx (RETAIL_TABLE_MAP) that
// isn't exported. This is the same table names, just accessible from here
// for the server-side query.
const RETAIL_TABLE_NAME = {
  retailCustomers: 'retail_customers', retailProducts: 'retail_products',
  retailActivities: 'retail_activities', retailOrders: 'retail_orders',
  retailInvoices: 'retail_invoices',
};

export default function RetailListPage({ page }) {
  const { supabase, tenant } = useTenant();
  const { getObjectLabel } = useObjectLabels();
  const { showAlert } = useAlert();
  const {
    retailCustomers, retailProducts, retailActivities, retailOrders, retailInvoices,
    fetchRetailCustomers, fetchRetailProducts, fetchRetailActivities, fetchRetailOrders, fetchRetailInvoices,
    pendingRecord, setPendingRecord, pendingReturnTo, setPendingReturnTo,
    enterpriseUsers, savedSearches, fetchSavedSearches, createSavedSearch,
    deleteSavedSearch, setDefaultSavedSearch, currentUser, appPreferences,
    createRetailInvoiceFromOrder, currentUserPermissions, permissionsLoaded,
    fetchListCount, listViewPrefs, fetchListViewPrefs, saveListViewPrefs, appearance,
    updateRetailRecord, applyDataSecurity, dataSecurityScope,
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
  const [sortField,      setSortField]      = useState('display_number');
  const [sortDir,        setSortDir]        = useState('desc');
  const [columnsOpen,    setColumnsOpen]    = useState(false);
  const listFieldLayout = useFieldLayout(page);
  const fieldMeta = useMemo(() => {
    const base = getRetailFieldMeta(page);
    if (!listFieldLayout.fields.length) return base;
    return base.map(m => {
      const savedRow = listFieldLayout.fields.find(r => r.field_key === m.key);
      return savedRow?.custom_label ? { ...m, label: savedRow.custom_label } : m;
    });
  }, [page, listFieldLayout.fields]);
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
  const [initialTab,     setInitialTab]     = useState(null); // tab to reopen on (Customer 360 return)
  const [c360Record,     setC360Record]     = useState(null); // {page, data} for cross-object creates
  const [searchPanel,    setSearchPanel]    = useState(false);
  const [menuOpenId,     setMenuOpenId]     = useState(null);
  const appliedDefaultForPage = useRef(null);

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
    // Remember where the user came from (Customer 360 of this customer) so closing the opened record returns there
    if (c360Record.returnTo) setPendingReturnTo(c360Record.returnTo);
    setPendingRecord({ page: c360Record.page, record: c360Record.record });
    setSelectedRecord(null);
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
    setCurrentPage(1);
    setVisibleColumns(RETAIL_DEFAULT_COLUMNS[page] || ['id','name']); setSortField(''); setSortDir('asc');
    if (fetchListViewPrefs) fetchListViewPrefs(page).then(saved => {
      if (!saved) return;
      if (saved.columns?.length) setVisibleColumns(saved.columns);
      if (saved.sort?.field) { setSortField(saved.sort.field); setSortDir(saved.sort.direction||'asc'); }
    });
  }, [page]);

  // Debounce search input (300ms) so filtering doesn't recompute on every
  // keystroke against a potentially large in-memory array.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Server-side search, filter, sort, and pagination ────────────────────
  // Replaces the old approach of filtering/sorting/paginating the fixed,
  // capped client-side snapshot (data, from the global fetchRetailXxx()
  // functions) in JavaScript. That approach silently hid any record beyond
  // the load cap from search and filters entirely. This queries the
  // database fresh, with the CURRENT search/filter/sort/page state, every
  // time any of them changes — correct regardless of how many total
  // records the tenant has.
  const [serverRows, setServerRows] = useState([]);
  const [serverLoading, setServerLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const dateFieldForPage = DATE_FIELD[page] || 'created_at';
  useEffect(() => {
    if (!supabase || !cfg) return;
    let cancelled = false;
    setServerLoading(true);
    const { from: dateFrom, to: dateTo } = timePeriodToRange(timePeriod);
    const { adv: mappedAdvFilters, lineFilters } = splitAdvFilters(advFilters, (f) => f);
    fetchServerPage(supabase, {
      table: RETAIL_TABLE_NAME[page],
      searchTerm: debouncedSearch,
      searchColumns: cfg.searchFields || [],
      statusColumn: 'status',
      statusFilter,
      ownerColumn: 'owner',
      ownerIdColumn: 'owner_id',
      ownerFilter,
      dateColumn: dateFieldForPage,
      dateFrom, dateTo,
      advFilters: mappedAdvFilters, lineFilters,
      sortColumn: sortField || 'created_at',
      sortAscending: sortDir === 'asc',
      page: currentPage,
      pageSize,
      security: dataSecurityScope,
    }).then(({ data, error, totalCount }) => {
      if (cancelled) return;
      if (error) { console.error('[RetailListPage server fetch]', error.message); setServerRows([]); setServerTotal(0); }
      else {
        const secured = applyDataSecurity ? applyDataSecurity(data) : data;
        setServerRows(secured.map((r) => {
          // Fallback: some records (mobile-created, quick-created, etc.)
          // only ever set customer_id, never the raw customer name field —
          // the same root cause already found and fixed for the booking
          // calendar's "Unknown Customer" issue. Resolves the name from the
          // still-loaded retailCustomers list when the raw field is empty,
          // rather than leaving the list view blank while detail views
          // (which already have similar fallback logic) show it correctly.
          let customerName = r.customer;
          if (!customerName && r.customer_id) {
            const match = retailCustomers.find(c => c._uuid === r.customer_id || c.id === r.customer_id);
            if (match) customerName = match.name;
          }
          // Second fallback: match by phone number, which is reliably
          // captured on these records even when customer_id never got
          // linked (e.g. a walk-in sale where phone was typed directly).
          if (!customerName && r.customer_phone) {
            const normalizedPhone = String(r.customer_phone).replace(/\D/g,'');
            const match = normalizedPhone && retailCustomers.find(c => c.phone && String(c.phone).replace(/\D/g,'') === normalizedPhone);
            if (match) customerName = match.name;
          }
          // Last resort: if no name can be resolved anywhere, show the
          // phone number itself rather than a bare dash — genuinely more
          // useful than nothing when a walk-in customer's phone was
          // captured but no customer record was ever created/linked.
          const displayCustomer = customerName || r.customer || (r.customer_phone ? `📞 ${r.customer_phone}` : '');
          return { ...r, id: r[cfg.idField], _uuid: r.id, displayNumber: r.display_number, customer: displayCustomer, customer_name_resolved: displayCustomer };
        }));
        setServerTotal(totalCount);
      }
      setServerLoading(false);
    });
    return () => { cancelled = true; };
  }, [supabase, page, cfg, debouncedSearch, statusFilter, timePeriod, advFilters, ownerFilter, sortField, sortDir, currentPage, pageSize, tenant?.id, currentUser, permissionsLoaded, refreshTick, dataSecurityScope]);

  // Reset to page 1 whenever a filter/search/sort actually changes the
  // result set — otherwise a user could land on a now-empty page 4 after
  // narrowing a filter that only has 2 pages of results.
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, statusFilter, timePeriod, advFilters, ownerFilter, sortField, sortDir]);

  useEffect(() => {
    if (!savedSearches?.length) return;
    if (appliedDefaultForPage.current === page) return; // already applied for this page visit
    const def = savedSearches.find(s => s.object_type===page && s.is_default)
             || savedSearches.find(s => s.object_type===page && s.is_global_default);
    if (def?.filters) { applyFilters(def.filters); appliedDefaultForPage.current = page; }
  }, [page, savedSearches]);

  useEffect(() => {
    if (!pendingRecord) return;
    if (pendingRecord.page === page) {
      if (pendingRecord.record) {
        setInitialTab(pendingRecord.tab || null);
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
    if (f.columns?.length) persistColumns(f.columns, f.sortField||sortField, f.sortDir||sortDir);
    setCurrentPage(1);
  };

  const currentFilters = { search, status: statusFilter, timePeriod, advFilters, owner: ownerFilter, sortField, sortDir, columns: visibleColumns };

  const toggleSort = (key) => {
    if (sortField !== key) { setSortField(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortField(''); setSortDir('asc'); }
  };

  const totalRecords = serverTotal ?? 0;
  const totalPages   = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage     = Math.min(currentPage, totalPages);
  const pagedRows    = serverRows;
  const activeCount  = (debouncedSearch?1:0) + (statusFilter!=='All'?1:0) + (timePeriod?1:0) + advFilters.filter(c=>c.field).length + (ownerFilter?1:0);

  // Board (Kanban) view needs a larger, unpaginated set grouped by status
  // rather than one table page — fetched separately, with the same search/
  // filter criteria, capped at a few thousand rows for practical drag-and-
  // drop UX. showBoardCap flags when there are more matching records than
  // fit, so the UI can be honest about it rather than silently truncating.
  const BOARD_FETCH_CAP = 2000;
  const [boardRows, setBoardRows] = useState([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardTotal, setBoardTotal] = useState(0);
  useEffect(() => {
    if (viewMode !== 'board' || !supabase || !cfg) return;
    let cancelled = false;
    setBoardLoading(true);
    const { from: dateFrom, to: dateTo } = timePeriodToRange(timePeriod);
    const { adv: mappedAdvFilters, lineFilters } = splitAdvFilters(advFilters, (f) => f);
    fetchServerPage(supabase, {
      table: RETAIL_TABLE_NAME[page],
      searchTerm: debouncedSearch,
      searchColumns: cfg.searchFields || [],
      statusFilter: 'All', // board itself splits by status into columns
      ownerFilter,
      dateColumn: dateFieldForPage,
      dateFrom, dateTo,
      advFilters: mappedAdvFilters, lineFilters,
      sortColumn: 'created_at',
      sortAscending: false,
      page: 1,
      pageSize: BOARD_FETCH_CAP,
      security: dataSecurityScope,
    }).then(({ data, error, totalCount }) => {
      if (cancelled) return;
      if (error) { console.error('[RetailListPage board fetch]', error.message); setBoardRows([]); setBoardTotal(0); }
      else {
        const securedBoard = applyDataSecurity ? applyDataSecurity(data) : data;
        setBoardRows(securedBoard.map((r) => {
          let customerName = r.customer;
          if (!customerName && r.customer_id) {
            const match = retailCustomers.find(c => c._uuid === r.customer_id || c.id === r.customer_id);
            if (match) customerName = match.name;
          }
          if (!customerName && r.customer_phone) {
            const normalizedPhone = String(r.customer_phone).replace(/\D/g,'');
            const match = normalizedPhone && retailCustomers.find(c => c.phone && String(c.phone).replace(/\D/g,'') === normalizedPhone);
            if (match) customerName = match.name;
          }
          const displayCustomer = customerName || r.customer || (r.customer_phone ? `📞 ${r.customer_phone}` : '');
          return { ...r, id: r[cfg.idField], _uuid: r.id, displayNumber: r.display_number, customer: displayCustomer, customer_name_resolved: displayCustomer };
        }));
        setBoardTotal(totalCount);
      }
      setBoardLoading(false);
    });
    return () => { cancelled = true; };
  }, [viewMode, supabase, page, cfg, debouncedSearch, timePeriod, advFilters, ownerFilter, tenant?.id, currentUser, permissionsLoaded, dataSecurityScope]);
  const clearFilters = () => { setSearch(''); setStatusFilter('All'); setTimePeriod(''); setAdvFilters([]); setOwnerFilter(''); setCurrentPage(1); };
  const searchCatalog = useSearchCatalog({ baseMeta: fieldMeta, headerObjType: page, page });
  const searchOwners  = useMemo(() => (enterpriseUsers||[]).map(u => ({ value: u.email, label: `${u.first_name||''} ${u.last_name||''}`.trim() || u.email })), [enterpriseUsers]);
  const addFilterRow = () => { const f = fieldMeta.find(f=>f.key!=='id')||fieldMeta[0]; setAdvFilters(p=>[...p,{field:f.key,type:f.type,op:RETAIL_OPERATORS[f.type][0].v,value:''}]); };
  const updateFilterRow = (idx, patch) => setAdvFilters(p => p.map((c,i) => i===idx ? {...c,...patch} : c));
  const removeFilterRow = (idx) => setAdvFilters(p => p.filter((_,i) => i!==idx));
  const persistColumns = (cols, sf=sortField, sd=sortDir) => { setVisibleColumns(cols); if (saveListViewPrefs) saveListViewPrefs(page, { columns: cols, sort: { field: sf, direction: sd } }); };
  const toggleColumn = (key) => persistColumns(visibleColumns.includes(key) ? visibleColumns.filter(c=>c!==key) : [...visibleColumns, key]);
  const moveColumn = (idx, dir) => { const cols=[...visibleColumns]; const j=idx+dir; if (j<0||j>=cols.length) return; [cols[idx],cols[j]]=[cols[j],cols[idx]]; persistColumns(cols); };
  const fmtRetailCell = (r, meta) => {
    const v = r[meta.key];
    if (meta.key === 'id') return r.displayNumber ? formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', r.displayNumber) : (r[cfg.idField] || '-');
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
    <div className="rw-list space-y-4">
      <RedwoodSkin />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2.5"><NavIcon iconKey={page} className="w-6 h-6"/> {getObjectLabel(page, cfg.title)}</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {serverLoading ? 'Loading…' : `${totalRecords.toLocaleString()} record${totalRecords!==1?'s':''}`}
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

      <RedwoodSavedSearchBar page={page} filters={currentFilters} onApply={applyFilters} onClear={clearFilters}
        fields={searchCatalog} statusOptions={cfg.statusOptions} owners={searchOwners}
        valuesOf={(f,q)=>distinctValues(supabase,{ table: f.scope==='line' ? f.line.table : RETAIL_TABLE_NAME[page], column: f.column || f.key, q })} />

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm space-y-3">
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
        <div>
          {boardTotal > BOARD_FETCH_CAP && (
            <p className="text-xs text-amber-600 font-semibold mb-2">
              Showing the {BOARD_FETCH_CAP.toLocaleString()} most recent of {boardTotal.toLocaleString()} matching records — narrow with search or filters to see others on the board.
            </p>
          )}
          {boardLoading && boardRows.length === 0 ? (
            <div className="py-20"><LoadingSpinner size={44} label="Loading board..." /></div>
          ) : (
          <RetailBoardView
            page={page}
            cfg={cfg}
            records={boardRows}
            onCardClick={setSelectedRecord}
            updateRetailRecord={updateRetailRecord}
          />
          )}
        </div>
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
              {serverLoading && pagedRows.length === 0 ? (
                <tr><td colSpan={visibleColumns.length+1} className="px-5 py-20 text-center">
                  <LoadingSpinner size={44} label="Loading records..." />
                </td></tr>
              ) : pagedRows.length === 0 ? (
                <tr><td colSpan={visibleColumns.length+1} className="px-5 py-16 text-center">
                  <div className="mb-3 flex justify-center text-gray-300">
                    {activeCount>0 ? <Search className="w-12 h-12"/> : <NavIcon iconKey={page} className="w-12 h-12"/>}
                  </div>
                  <div className="font-bold text-[#0F172A] text-lg mb-1">{activeCount>0?t(lang,'noRecordsFound'):`No ${getObjectLabel(page, cfg.title).toLowerCase()} yet`}</div>
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
                            <button onClick={()=>{setMenuOpenId(null);setCreatePrefill({page:'retailOrders',data:{...buildCustomerPrefill(r),order_date:todayLocalISO(),status:'Draft',channel:'In-Store'}});}} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">🛒 {RL('Create Order')}</button>
                            <button onClick={()=>{setMenuOpenId(null);setCreatePrefill({page:'retailInvoices',data:{...buildCustomerPrefill(r),invoice_date:todayLocalISO(),status:'Draft',payment_status:'Pending'}});}} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">🧾 {RL('Create Invoice')}</button>
                          </>)}
                          {page==='retailOrders' && canInvoiceOrder(appPreferences, r.status) && (
                            <button onClick={async()=>{
                              setMenuOpenId(null);
                              const inv = await createRetailInvoiceFromOrder(r);
                              if (inv) {
                                showAlert(`Invoice ${inv.display_number ? formatDisplayNumber('RINV', inv.display_number) : ''} created from this order.`, { variant:'success', title:'Invoice Created' });
                                setPendingReturnTo({ page: 'retailOrders', record: r });
                                setPendingRecord({ page: 'retailInvoices', record: inv });
                                window.dispatchEvent(new CustomEvent('retail-navigate', { detail: { page: 'retailInvoices' } }));
                              }
                            }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">🧾 {RL('Create Invoice')}</button>
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
            setSelectedRecord(null); setInitialTab(null);
            if (pendingReturnTo) { const rt=pendingReturnTo; setPendingReturnTo(null); window.dispatchEvent(new CustomEvent('open-crm-record',{detail:rt})); }
          }}
          onSaved={()=>{
            // Root cause of "edit saves, but reopening the record shows the
            // old value until a full browser refresh": the table's rows
            // (serverRows/pagedRows, below) come from a SEPARATE server-side
            // paginated/filtered query, not from the retailOrders/etc.
            // context array that fetchMap[page]() refreshes. refreshTick was
            // only ever bumped after a CREATE (see RetailCreateModal
            // onCreated below), never after an UPDATE — so the row object
            // handed to setSelectedRecord() on the next click was always the
            // pre-edit snapshot until something else (a filter change, or a
            // full page reload) re-ran that query. Bump it here too so an
            // edit is reflected the moment the record is reopened, with no
            // refresh needed.
            fetchMap[page]?.();
            setRefreshTick(t => t + 1);
          }}
          initialTab={initialTab}
          onC360Navigate={(targetPage, rec, ret) => setC360Record({ page: targetPage, record: rec, returnTo: ret || null })}
          onC360Create={(targetPage, prefill) => setCreatePrefill({ page: targetPage, data: prefill })}
        />
      )}
      <RetailCreateModal page={page} open={createOpen} onClose={()=>{
        setCreateOpen(false); setPendingRecord(null);
        if (pendingReturnTo) { const rt = pendingReturnTo; setPendingReturnTo(null); window.dispatchEvent(new CustomEvent('open-crm-record', { detail: rt })); }
      }} onCreated={(rec)=>{
        const linkBack = pendingRecord?.linkBack;
        setPendingRecord(null);
        if (rec) {
          const displayVal = rec.display_number ? formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', rec.display_number) : (rec.name || rec.subject || '');
          showAlert(`${cfg.singular} ${displayVal ? `"${displayVal}" ` : ''}created successfully.`, { variant:'success', title:`${cfg.singular} Created` });
        }
        // If this create was launched with a linkBack instruction (e.g.
        // "Create Booking" from an Activity), write the new record's own
        // reference back onto the source record's field - without this,
        // the source record has no way of knowing a linked record now
        // exists, and would keep offering to create another one every
        // time it's reopened.
        if (linkBack && rec && supabase) {
          const newRef = rec[cfg.idField] || rec.id;
          tenantScope(supabase.from(linkBack.table).update({ [linkBack.field]: newRef })).eq('id', linkBack.id)
            .then(({ error }) => { if (error) console.error('[RetailListPage] linkBack update failed:', error.message); });
        }
        if (pendingReturnTo) { const rt = pendingReturnTo; setPendingReturnTo(null); window.dispatchEvent(new CustomEvent('open-crm-record', { detail: rt })); }
        else if (rec) { setCurrentPage(1); setRefreshTick(t=>t+1); setSelectedRecord(rec); }
        else { setCurrentPage(1); setRefreshTick(t=>t+1); }
      }} prefill={pendingRecord?.openCreate ? pendingRecord.prefill : null}/>
      {/* Cross-object create modal — for Create Order/Invoice from customer list/360 */}
      {/* c360 navigation handled by effect below (was an in-render setTimeout) */}

      {createPrefill && (
        <RetailCreateModal
          page={createPrefill.page}
          open={true}
          onClose={()=>setCreatePrefill(null)}
          onCreated={(rec)=>{
            setCreatePrefill(null);
            const typeLabel = createPrefill.page === 'retailOrders' ? 'Order' : createPrefill.page === 'retailInvoices' ? 'Invoice' : 'Activity';
            showAlert(`${typeLabel} created successfully.`, { variant: 'success' });
            if (rec) {
              setPendingReturnTo({ page: 'retailCustomers', record: selectedRecord, tab: '360' });
              setPendingRecord({ page: createPrefill.page, record: rec });
              window.dispatchEvent(new CustomEvent('retail-navigate', { detail: { page: createPrefill.page } }));
            }
          }}
          prefill={createPrefill.data}
        />
      )}
    </div>
  );
}
