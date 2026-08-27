// @ts-nocheck
// Shared nav-item definitions and permission-check logic.
//
// This is the single source of truth for "what can this user see and
// navigate to" — both Sidebar.tsx and SpringboardPage.tsx import from here
// rather than each keeping their own copy. Two independent copies of the
// same RBAC rules is exactly the kind of thing that quietly drifts apart
// over time (a permission added to one and forgotten in the other), so any
// object added or re-gated in the future only needs to change here once.

export const SALES_GROUP = [
  { key:'customers',     label:'customers',     icon:'👥', permission:'customers_view',     requiresCRM:true },
  { key:'contacts',      label:'contacts',      icon:'📇', permission:'contacts_view',      requiresCRM:true },
  { key:'leads',         label:'leads',         icon:'🎯', permission:'leads_view',          requiresCRM:true },
  { key:'opportunities', label:'opportunities', icon:'💼', permission:'opportunities_view',  requiresCRM:true },
  { key:'activities',    label:'activities',    icon:'📅', permission:'activities_view',     requiresCRM:true },
  { key:'products',      label:'products',      icon:'📦', permission:'products_view',       requiresCRM:true },
  { key:'quotations',    label:'quotations',    icon:'📄', permission:null, requiresCPQ:true, requiresCRM:true },
];

export const RETAIL_GROUP = [
  { key:'retailCustomers',  label:'retailCustomers',  icon:'🧑‍🤝‍🧑', permission:null, requiresB2C:true },
  { key:'retailActivities', label:'retailActivities', icon:'📅',       permission:null, requiresB2C:true },
  { key:'retailProducts',   label:'retailProducts',   icon:'🏷️',       permission:null, requiresB2C:true },
  { key:'manageBookings',   label:'manageBookings',   icon:'📆',       permission:null, requiresB2C:true, requiresRental:true },
  { key:'retailOrders',     label:'retailOrders',     icon:'🛍️',       permission:null, requiresB2C:true },
  { key:'retailInvoices',   label:'retailInvoices',   icon:'🧾',       permission:null, requiresB2C:true },
];

export const BOTTOM_ITEMS = [
  { key:'orders',     label:'orders',      icon:'🛒', permission:'orders_view',   requiresCRM:true },
  { key:'invoices',   label:'invoices',    icon:'🧾', permission:'invoices_view', requiresCRM:true },
  { key:'reports',    label:'reports',     icon:'⚡', permission:null },
  { key:'approvals',  label:'approvals',   icon:'✅', permission:null, requiresCRM:true },
  { key:'adminTools', label:'adminTools',  icon:'⚙️', permission:'__admin__' },
];

// The dashboard/analytics item, kept separate from TOP_ITEMS in Sidebar.tsx
// since its meaning changes slightly here (a springboard tile, not the
// sidebar's own Home button) — same key either way, so it routes correctly.
export const DASHBOARD_ITEM = { key:'dashboard', label:'salesDashboard', icon:'📊', permission:null };

// Builds the exact same canSee(item) function Sidebar.tsx has always used,
// parameterized by the current user's context — pass in what useApp() gives
// you and get back a function that answers "can this user see this item."
export function makeCanSee({ isAdmin, b2cMode, appPreferences, currentUserPermissions, permissionsLoaded }) {
  return (item) => {
    // Admins always see everything
    if (isAdmin) {
      // B2C mode: hide CRM items, show retail
      if (item.requiresCRM && b2cMode) return false;
      if (item.requiresB2C && !b2cMode) return false;
      if (item.requiresRental && appPreferences?.business_type !== 'rental') return false;
      return true;
    }
    // Non-admin: check mode
    if (item.requiresCRM && b2cMode) return false;
    if (item.requiresB2C && !b2cMode) return false;
    if (item.requiresRental && appPreferences?.business_type !== 'rental') return false;
    if (item.requiresCPQ && appPreferences?.cpq_enabled === false) return false;
    // No permission required
    if (!item.permission) return true;
    // Wait for permissions to load
    if (!permissionsLoaded) return false;
    return currentUserPermissions.includes(item.permission);
  };
}
