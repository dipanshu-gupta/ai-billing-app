// @ts-nocheck

// ─── Currency ──────────────────────────────────────────────────────────────────

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(value || 0);

// ─── Dates ─────────────────────────────────────────────────────────────────────

export const formatDate = (d: string): string => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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
      return ['Draft','Confirmed','Processing','Partially Shipped','Shipped','Delivered','Invoiced','On Hold','Cancelled'];
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
        ? ['Draft','Submitted','Pending Approval','Approved','Sent to Customer','Accepted','Ordered','Rejected','Expired','Cancelled']
        : ['Draft','Submitted','Approved','Sent to Customer','Accepted','Ordered','Rejected','Expired','Cancelled'];
    case 'retailCustomers':
      return ['Active','Inactive','VIP','Blocked'];
    case 'retailProducts':
      return ['Active','Inactive','Discontinued'];
    case 'retailActivities':
      return ['Open','In Progress','Completed','Cancelled'];
    case 'retailOrders':
      return ['Draft','Completed','Cancelled','Refunded'];
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
              'unit','taxRate','status','description'];
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
