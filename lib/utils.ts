// @ts-nocheck

// ─── Currency ──────────────────────────────────────────────────────────────────

// Reads the tenant's regional settings, published to window by AppContext
const _prefs = () => (typeof window !== 'undefined' ? (window as any).__bp_prefs : null) || {};

// Rounds a set of category values to whole-number percentages that are
// GUARANTEED to sum to exactly 100 (when total > 0) — using the largest
// remainder method. Naively rounding each category independently
// (Math.round(value/total*100) per row) does NOT guarantee this and is a
// classic source of dashboard breakdowns that visibly don't add up to 100%.
// Returns percentages in the same order as the input values.
export const roundPercentagesTo100 = (values: number[]): number[] => {
  const total = values.reduce((s, v) => s + (v || 0), 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map(v => (v || 0) / total * 100);
  const floors = exact.map(Math.floor);
  const remainder = 100 - floors.reduce((s, v) => s + v, 0);
  // Distribute the leftover percentage points to the categories with the
  // largest fractional remainders first — this is what keeps the total
  // exact while staying as close as possible to the true proportions.
  const order = exact
    .map((v, i) => ({ i, frac: v - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < remainder; k++) result[order[k % order.length].i] += 1;
  return result;
};

export const formatCurrency = (value: number): string => {
  const currency = _prefs().default_currency || 'INR';
  const locale = currency === 'INR' ? 'en-IN' : currency === 'GBP' ? 'en-GB' : currency === 'EUR' ? 'de-DE' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value || 0);
  } catch {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
  }
};

// ─── Dates ─────────────────────────────────────────────────────────────────────

export const formatDate = (d: string): string => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  const df = _prefs().date_format || 'DD/MM/YYYY';
  const dd = String(dt.getDate()).padStart(2,'0'), mm = String(dt.getMonth()+1).padStart(2,'0'), yyyy = dt.getFullYear();
  if (df === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
  if (df === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
  if (df === 'DD/MM/YYYY') return `${dd}/${mm}/${yyyy}`;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (d: string): string => {
  if (!d) return '-';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const timeAgo = (d: string): string => {
  if (!d) return '';
  const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60); if (min < 60) return `${min}m ago`;
  const hr  = Math.floor(min / 60); if (hr  < 24) return `${hr}h ago`;
  const day = Math.floor(hr  / 24); if (day < 30) return `${day}d ago`;
  return formatDate(d);
};

// ─── File size ─────────────────────────────────────────────────────────────────

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024)    return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

// ─── ID generation ─────────────────────────────────────────────────────────────

export const generateId = (prefix: string): string => `${prefix}-${Date.now()}`;

// ─── Sequential Display Number ───────────────────────────────────────────────
// Formats the clean sequential number for display (e.g. CUST-00001)
export const formatDisplayNumber = (prefix: string, num: number | null | undefined): string => {
  if (!num) return '';
  return `${prefix}-${String(num).padStart(5, '0')}`;
};

// Page → display prefix mapping
export const PAGE_DISPLAY_PREFIX: Record<string, string> = {
  customers:        'CUST',
  leads:            'LEAD',
  opportunities:    'OPP',
  orders:           'ORD',
  invoices:         'INV',
  contacts:         'CONT',
  activities:       'ACT',
  products:         'PROD',
  quotations:       'QUO',
  retailCustomers:  'RCUST',
  retailProducts:   'RPROD',
  retailActivities: 'RACT',
  retailOrders:     'RORD',
  retailInvoices:   'RINV',
};

// ─── Page label ────────────────────────────────────────────────────────────────

export const getPageLabel = (page: string): string => {
  const map: Record<string, string> = {
    customers: 'Customer', products: 'Product', leads: 'Lead',
    opportunities: 'Opportunity', activities: 'Activity',
    contacts: 'Contact', orders: 'Order', invoices: 'Invoice',
  };
  return map[page] ?? 'Record';
};

// ─── Status options ────────────────────────────────────────────────────────────

export const getStatusOptions = (page: string, hasApproval = false): string[] => {
  switch (page) {
    case 'customers':
      return ['New','Prospect','Active','On Hold','Inactive','Churned','Blacklisted'];
    case 'leads':
      return hasApproval
        ? ['New','Contacted','Qualified','Pending Approval','Approved','Unqualified','Converted','Disqualified']
        : ['New','Contacted','Qualified','Unqualified','Converted','Disqualified'];
    case 'opportunities':
      return hasApproval
        ? ['Prospecting','Qualification','Needs Analysis','Value Proposition','Proposal Sent','Pending Approval','Negotiation','Closed Won','Closed Lost','On Hold']
        : ['Prospecting','Qualification','Needs Analysis','Value Proposition','Proposal Sent','Negotiation','Closed Won','Closed Lost','On Hold'];
    case 'orders':
      return ['Draft','Confirmed','Processing','Partially Shipped','Shipped','Delivered','Partially Invoiced','Invoiced','On Hold','Cancelled'];
    case 'invoices':
      return ['Draft','Pending','Sent','Partially Paid','Paid','Overdue','Disputed','Write Off','Cancelled'];
    case 'contacts':
      return ['Active','Prospect','Key Contact','Inactive','Do Not Contact'];
    case 'activities':
      return ['Not Started','In Progress','Completed','Deferred','Waiting on Customer','Cancelled'];
    case 'products':
      return ['Active','Draft','Under Review','Discontinued','Out of Stock'];
    case 'quotations':
      return hasApproval
        ? ['Draft','Submitted','Pending Approval','Approved','Sent to Customer','Accepted','Partially Ordered','Ordered','Rejected','Expired','Cancelled']
        : ['Draft','Submitted','Approved','Sent to Customer','Accepted','Partially Ordered','Ordered','Rejected','Expired','Cancelled'];
    case 'retailCustomers':
      return ['Active','Inactive','VIP','Blocked'];
    case 'retailProducts':
      return ['Active','Inactive','Discontinued'];
    case 'retailActivities':
      return ['Open','In Progress','Completed','Cancelled'];
    case 'retailOrders':
      return ['Draft','Pending','Completed','Cancelled','Refunded'];
    case 'retailInvoices':
      return ['Draft','Sent','Paid','Overdue','Refunded','Cancelled'];
    default:
      return ['Active','Inactive'];
  }
}

// ─── Status colour ─────────────────────────────────────────────────────────────

export const getStatusColor = (status: string): string => {
  const map: Record<string, string> = {
    Active:             'bg-green-100 text-green-700',
    Inactive:           'bg-gray-100 text-gray-600',
    New:                'bg-blue-100 text-blue-700',
    Contacted:          'bg-blue-100 text-blue-700',
    Qualified:          'bg-purple-100 text-purple-700',
    Converted:          'bg-green-100 text-green-700',
    Lost:               'bg-red-100 text-red-700',
    Open:               'bg-blue-100 text-blue-700',
    'In Progress':      'bg-yellow-100 text-yellow-700',
    Completed:          'bg-green-100 text-green-700',
    'Closed Won':       'bg-green-100 text-green-700',
    'Closed Lost':      'bg-red-100 text-red-700',
    'Proposal Sent':    'bg-blue-100 text-blue-700',
    Negotiation:        'bg-yellow-100 text-yellow-700',
    Processing:         'bg-yellow-100 text-yellow-700',
    Delivered:          'bg-green-100 text-green-700',
    Invoiced:           'bg-teal-100 text-teal-700',
    'Partially Invoiced':'bg-teal-50 text-teal-600',
    'Partially Ordered':'bg-teal-50 text-teal-600',
    Ordered:            'bg-teal-100 text-teal-700',
    Shipped:            'bg-blue-100 text-blue-700',
    Pending:            'bg-yellow-100 text-yellow-700',
    Paid:               'bg-green-100 text-green-700',
    Overdue:            'bg-red-100 text-red-700',
    Cancelled:          'bg-red-100 text-red-700',
    Draft:              'bg-gray-100 text-gray-600',
    Prospect:           'bg-purple-100 text-purple-700',
    Discontinued:       'bg-gray-100 text-gray-500',
    'Pending Approval': 'bg-purple-100 text-purple-700',
    Approved:           'bg-green-100 text-green-700',
    Rejected:           'bg-red-100 text-red-700',
    VIP:                'bg-amber-100 text-amber-700',
    Blocked:            'bg-red-100 text-red-700',
    Refunded:           'bg-orange-100 text-orange-700',
    Sent:               'bg-blue-100 text-blue-700',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
};

// ─── Object fields ─────────────────────────────────────────────────────────────

export const getObjectFields = (page: string): string[] => {
  switch (page) {
    case 'customers':
      return ['name','industry','phone','email','website','gstNumber',
              'billingAddress','shippingAddress','city','state','postalCode','country',
              'owner','status','description'];
    case 'contacts':
      return ['name','designation','department','email','phone','mobile',
              'customer','isPrimary','linkedIn','owner','status','description'];
    case 'products':
      return ['name','productFamily','category','sku','price','cost',
              'unit','taxRate','status','description','stock_quantity','reorder_level','track_inventory'];
    case 'leads':
      return ['name','customer','contact','email','phone',
              'source','amount','expectedCloseDate','billingAddress','shippingAddress','owner','status','description'];
    case 'opportunities':
      return ['name','customer','contact','stage','amount',
              'closeDate','probability','campaign','billingAddress','shippingAddress','owner','status','description'];
    case 'orders':
      return ['name','customer','contact','currency','paymentTerms',
              'deliveryDate','amount','owner','status','notes'];
    case 'invoices':
      return ['name','customer','contact','dueDate','paymentTerms',
              'amount','owner','status','notes'];
    case 'activities':
      return ['name','activityType','customer','contact','activityDate',
              'priority','dueDate','owner','status','description'];
    default:
      return ['name','status','owner'];
  }
};

// ─── Navigation items ──────────────────────────────────────────────────────────

export const navigationItems = [
  { key: 'dashboard',     label: 'Dashboard',     icon: '📊', permission: null },
  { key: 'customers',     label: 'Customers',     icon: '👥', permission: 'customers_view' },
  { key: 'products',      label: 'Products',      icon: '📦', permission: 'products_view' },
  { key: 'leads',         label: 'Leads',         icon: '🎯', permission: 'leads_view' },
  { key: 'opportunities', label: 'Opportunities', icon: '💼', permission: 'opportunities_view' },
  { key: 'activities',    label: 'Activities',    icon: '📅', permission: 'activities_view' },
  { key: 'contacts',      label: 'Contacts',      icon: '📇', permission: 'contacts_view' },
  { key: 'orders',        label: 'Orders',        icon: '🛒', permission: 'orders_view' },
  { key: 'invoices',      label: 'Invoices',      icon: '🧾', permission: 'invoices_view' },
  { key: 'reports',       label: 'Fast Reports',  icon: '⚡', permission: null },
  { key: 'quotations',     label: 'Quotations',    icon: '📄', permission: null, requiresCPQ: true },
  { key: 'approvals',     label: 'My Approvals',  icon: '✅', permission: null },
  { key: 'adminTools',    label: 'Admin Tools',   icon: '⚙️', permission: 'admin_tools_view' },
];

// ─── Tenant scoping (shared-plan isolation for component-level queries) ─────
// Display numbers (CUST-00001, QUO-..., record_id values, etc.) COLLIDE across
// tenants on the shared DB, so every direct component query must be scoped.
export const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export function tenantScope(q: any) {
  const t = (typeof window !== 'undefined' ? (window as any).__bp_tenant : null) || {};
  const tid = t.id || null;
  if (!tid || t.db_url) return q; // dedicated DB or unresolved — no filter needed
  if (tid === DEMO_TENANT_ID) return q.or(`tenant_id.eq.${tid},tenant_id.is.null`);
  return q.eq('tenant_id', tid);
}

// ─── Timeout protection ──────────────────────────────────────────────────────
// Wraps any promise (a database call, a fetch, anything) with a hard timeout.
// No single async call anywhere in the app should be able to hang an
// operation indefinitely — always surfaces a clear, specific error instead
// of a permanent loading state with no way out except reloading the page.
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms/1000}s — please try again.`)), ms)),
  ]);
}

// Timezone-safe "today" as YYYY-MM-DD in LOCAL time. Plain new Date().toISOString().slice(0,10)
// converts to UTC first, which silently shows yesterday's date for any timezone ahead of UTC
// (e.g. IST) during the hours between local midnight and the UTC offset — a recurring, easy-to-
// reintroduce bug wherever a date field is defaulted to "today." Always use this instead.
export function todayLocalISO(): string {
  return new Date().toLocaleDateString('en-CA');
}
