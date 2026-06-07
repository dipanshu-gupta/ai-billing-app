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

export const getStatusOptions = (page: string): string[] => {
  switch (page) {
    case 'customers':     return ['Active', 'Inactive', 'Prospect'];
    case 'products':      return ['Active', 'Inactive', 'Discontinued'];
    case 'leads':         return ['New', 'Contacted', 'Qualified', 'Converted', 'Lost', 'Pending Approval'];
    case 'opportunities': return ['Open', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost', 'Pending Approval'];
    case 'orders':        return ['Draft', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Pending Approval'];
    case 'invoices':      return ['Draft', 'Pending', 'Paid', 'Overdue', 'Cancelled', 'Pending Approval'];
    case 'contacts':      return ['Active', 'Inactive'];
    case 'activities':    return ['Open', 'In Progress', 'Completed', 'Cancelled'];
    case 'quotations':    return ['Draft','Submitted','Pending Approval','Approved','Sent to Customer','Accepted','Ordered','Rejected','Expired','Cancelled'];
    default:              return ['Active', 'Inactive'];
  }
};

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
  };
  return map[status] || 'bg-gray-100 text-gray-600';
};

// ─── Object fields ─────────────────────────────────────────────────────────────

export const getObjectFields = (page: string): string[] => {
  switch (page) {
    case 'customers':
      return ['name','email','phone','company','industry','billingAddress','shippingAddress','city','state','postalCode','country','website','gstNumber','primaryContact','owner','status'];
    case 'products':
      return ['name','productFamily','category','price','status'];
    case 'leads':
      return ['customer','contact','name','email','phone','source','owner','status','amount'];
    case 'opportunities':
      return ['customer','contact','name','stage','closeDate','owner','status','amount'];
    case 'orders':
      return ['customer','contact','name','billingAddress','shippingAddress','paymentTerms','deliveryDate','currency','notes','owner','status','amount'];
    case 'invoices':
      return ['customer','contact','name','dueDate','paymentTerms','billingAddress','owner','status','amount'];
    case 'contacts':
      return ['customer','name','email','phone','designation','department','isPrimary','owner','status'];
    case 'activities':
      return ['name','customer','contact','subject','activityType','activityDate','notes','owner','status'];
    case 'quotations':
      return ['name','customer','contact','validity_date','payment_terms','shipping_terms','currency','overall_discount','shipping_cost','owner','status'];
    default:
      return ['name','status'];
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
  { key: 'quotations',     label: 'Quotations',    icon: '📄', permission: null, requiresCPQ: true },
  { key: 'approvals',     label: 'My Approvals',  icon: '✅', permission: null },
  { key: 'adminTools',    label: 'Admin Tools',   icon: '⚙️', permission: 'admin_tools_view' },
];
