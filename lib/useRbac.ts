// @ts-nocheck
'use client';
import { useApp } from '@/context/AppContext';

// page key → permission module. Everything else is its own module (customers → customers_view, custom_x → custom_x_view).
const PAGE_MODULE = {
  retailCustomers: 'retail_customers', retailProducts: 'retail_products', retailActivities: 'retail_activities',
  retailOrders: 'retail_orders', retailInvoices: 'retail_invoices', quotations: 'quotations', manageBookings: 'manage_bookings',
};
export const moduleOfPage = (page: string) => PAGE_MODULE[page] || page;
// Modules introduced to the Security Console later: "governed if configured" so existing roles keep working until
// an admin has actually configured the module (see lib/rbacCatalog.makeGoverned).
const GOVERNED = new Set(['quotations', 'retail_customers', 'retail_products', 'retail_activities', 'retail_orders', 'retail_invoices', 'manage_bookings']);

export function useRbac() {
  const { currentUserPermissions, permissionsLoaded, currentUser } = useApp();
  const perms: string[] = currentUserPermissions || [];
  const isAdmin = perms.includes('__admin__') || (currentUser as any)?.is_admin === true;
  /** can('retailOrders','delete') / can('quotations','create') */
  const can = (page: string, action: string) => {
    if (!permissionsLoaded || isAdmin) return true;
    const m = moduleOfPage(page);
    if (perms.includes(`${m}_${action}`)) return true;
    if (GOVERNED.has(m) && !perms.includes('__rbac_v2__') && !perms.some(c => c.startsWith(`${m}_`))) return true;
    return false;
  };
  return { can, isAdmin, perms };
}
