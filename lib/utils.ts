// @ts-nocheck

export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(value || 0);

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const timeAgo = (dateString) => {
  if (!dateString) return '';
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateString);
};

export const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export const generateId = (prefix) => `${prefix}-${Date.now()}`;

export const getPageLabel = (page) => {
  const map = {
    customers: 'Customer', products: 'Product', leads: 'Lead',
    opportunities: 'Opportunity', activities: 'Activity',
    contacts: 'Contact', orders: 'Order', invoices: 'Invoice',
  };
  return map[page] ?? 'Record';
};

export const getStatusOptions = (page) => {
  switch (page) {
    case 'customers':     return ['Active', 'Inactive', 'Prospect'];
    case 'products':      return ['Active', 'Inactive', 'Discontinued'];
    case 'leads':         return ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];
    case 'opportunities': return ['Open', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'];
    case 'orders':        return ['Draft', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    case 'invoices':      return ['Draft', 'Pending', 'Paid', 'Overdue', 'Cancelled'];
    case 'contacts':      return ['Active', 'Inactive'];
    case 'activities':    return ['Open', 'In Progress', 'Completed', 'Cancelled'];
    default:              return ['Active', 'Inactive'];
  }
};

export const getStatusColor = (status) => {
  const map = {
    Active: 'bg-green-100 text-green-700',
    Inactive: 'bg-gray-100 text-gray-600',
    New: 'bg-blue-100 text-blue-700',
    Qualified: 'bg-purple-100 text-purple-700',
    Converted: 'bg-green-100 text-green-700',
    Lost: 'bg-red-100 text-red-700',
    Open: 'bg-blue-100 text-blue-700',
    'Closed Won': 'bg-green-100 text-green-700',
    'Closed Lost': 'bg-red-100 text-red-700',
    Processing: 'bg-yellow-100 text-yellow-700',
    Delivered: 'bg-green-100 text-green-700',
    Pending: 'bg-yellow-100 text-yellow-700',
    Paid: 'bg-green-100 text-green-700',
    Overdue: 'bg-red-100 text-red-700',
    Cancelled: 'bg-red-100 text-red-700',
    Draft: 'bg-gray-100 text-gray-600',
    Shipped: 'bg-blue-100 text-blue-700',
    Prospect: 'bg-purple-100 text-purple-700',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
};

export const getObjectFields = (page) => {
  switch (page) {
    case 'customers':     return ['name','email','phone','company','industry','billingAddress','shippingAddress','city','state','postalCode','country','website','gstNumber','primaryContact','status'];
    case 'products':      return ['name','category','price','status'];
    case 'leads':         return ['customer','contact','name','email','phone','source','status','amount'];
    case 'opportunities': return ['customer','contact','name','stage','closeDate','status','amount'];
    case 'orders':        return ['customer','contact','name','shippingAddress','deliveryDate','status','amount'];
    case 'invoices':      return ['customer','contact','name','dueDate','paymentTerms','billingAddress','status','amount'];
    case 'contacts':      return ['customer','name','email','phone','designation','department','isPrimary','status'];
    case 'activities':    return ['name','customer','contact','subject','activityType','activityDate','notes','status'];
    default:              return ['name','status'];
  }
};

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
  { key: 'adminTools',    label: 'Admin Tools',   icon: '⚙️', permission: 'admin_tools_view' },
];