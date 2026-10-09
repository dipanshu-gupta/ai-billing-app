// @ts-nocheck
/**
 * Springboard "Quick Actions" - per-tenant, admin-configurable.
 *
 * Stored in app_preferences.settings.quick_actions = { b2b: string[], b2c: string[] } (ordered page keys).
 * A missing/empty list means "use the defaults below", so tenants that never touch the setting see exactly
 * what they saw before. The Springboard still filters every entry through the same visibility (canSee) and
 * create-permission (RBAC) checks, so a saved list can never show an action a user isn't allowed to use.
 */
export const MAX_QUICK_ACTIONS = 8;

const B2B_STD = [
  { page: 'customers',     icon: '🏢', fallback: 'Customer' },
  { page: 'contacts',      icon: '👤', fallback: 'Contact' },
  { page: 'leads',         icon: '🎯', fallback: 'Lead' },
  { page: 'opportunities', icon: '💼', fallback: 'Opportunity' },
  { page: 'activities',    icon: '📋', fallback: 'Activity' },
  { page: 'products',      icon: '📦', fallback: 'Product' },
  { page: 'orders',        icon: '🛒', fallback: 'Order' },
  { page: 'invoices',      icon: '🧾', fallback: 'Invoice' },
];
const B2C_STD = [
  { page: 'retailCustomers',  icon: '👤', fallback: 'Customer' },
  { page: 'retailOrders',     icon: '🛍️', fallback: 'Order' },
  { page: 'retailInvoices',   icon: '🧾', fallback: 'Invoice' },
  { page: 'retailActivities', icon: '📋', fallback: 'Activity' },
  { page: 'retailProducts',   icon: '🏷️', fallback: 'Product' },
];

export const DEFAULT_QUICK_ACTIONS = {
  b2b: ['contacts', 'leads', 'opportunities', 'activities'],
  b2c: ['retailCustomers', 'retailOrders', 'retailInvoices', 'retailActivities'],
};

/** Every object a quick action can create, for the tenant's current mode (standard objects + published custom objects). */
export function quickActionCatalog(b2cMode: boolean, customObjects: any[] = []) {
  const std = (b2cMode ? B2C_STD : B2B_STD).map(o => ({ ...o, key: o.page, custom: false }));
  const custom = (customObjects || [])
    .filter(o => o && o.api_name && o.status === 'published' && o.is_active !== false)
    .filter(o => (o.module || 'both') === 'both' || o.module === (b2cMode ? 'b2c' : 'b2b'))
    .map(o => ({ key: `custom_${o.api_name}`, page: `custom_${o.api_name}`, icon: '🧩', fallback: o.label || o.plural_label || o.api_name, custom: true }));
  return [...std, ...custom];
}

/** The ordered list of page keys to show: the tenant's saved choice if valid, else the defaults. */
export function resolveQuickActionKeys(appPreferences: any, b2cMode: boolean, customObjects: any[] = []) {
  const mode = b2cMode ? 'b2c' : 'b2b';
  const saved = appPreferences?.quick_actions?.[mode];
  const valid = new Set(quickActionCatalog(b2cMode, customObjects).map(o => o.key));
  if (Array.isArray(saved)) {
    // A saved (even empty) list is respected: an admin may deliberately keep none.
    return saved.filter(k => valid.has(k)).slice(0, MAX_QUICK_ACTIONS);
  }
  return DEFAULT_QUICK_ACTIONS[mode].filter(k => valid.has(k));
}

/** Sanitises what the admin panel saves. */
export function cleanQuickActions(qa: any) {
  const clean = (arr: any) => Array.isArray(arr)
    ? Array.from(new Set(arr.filter(k => typeof k === 'string' && /^[A-Za-z0-9_]{1,80}$/.test(k)))).slice(0, MAX_QUICK_ACTIONS)
    : undefined;
  const out: any = {};
  const b = clean(qa?.b2b); const c = clean(qa?.b2c);
  if (b) out.b2b = b;
  if (c) out.b2c = c;
  return Object.keys(out).length ? out : undefined;
}
