// @ts-nocheck
/**
 * RBAC catalog — the ONE place that defines which permission codes exist.
 * Built dynamically: standard objects + every published custom object (custom_<api>_*) + every Admin Tools section
 * (admintool_<section>_access). The Security Console renders this, Admin Tools enforces it, and new custom objects
 * show up in roles with no code change.
 */

export const STD_ACTIONS = ['view', 'create', 'edit', 'delete', 'export'];

// Admin Tools sections (logical key → label). Retail "r_" keys and B2B keys map to the same permission.
export const ADMIN_SECTIONS = [
  ['organizations', 'Organizations'], ['businessUnits', 'Business Units'], ['users', 'Users'], ['groups', 'User Groups'],
  ['security', 'Security Console'], ['workflow', 'Workflow Rules'], ['assignment', 'Assignment Rules'], ['sla', 'SLA Policies'],
  ['approvals', 'Approval Processes'], ['templates', 'Quote Templates'], ['invoiceTemplates', 'Invoice Templates / Designer'],
  ['warehouses', 'Warehouses'], ['appPrefs', 'App Preferences'], ['appearance', 'Appearance'], ['composer', 'App Composer (custom fields)'],
  ['layoutDesigner', 'Page Layout Designer'], ['fieldMapping', 'Field Mapping (Copy Maps)'], ['customObjects', 'Custom Objects'],
  ['whatsapp', 'WhatsApp Integration'], ['rentalSettings', 'Rental Settings'], ['bookingReceipts', 'Booking Receipt Designer'],
  ['importExport', 'Import & Export'], ['quickActions', 'Springboard Quick Actions'], ['aiSettings', 'AI Settings (Provider & Key)'],
];

/** Admin tile key (b2b_composer, r_security, …) → logical section key. */
export const adminSectionKey = (k: string) => {
  const s = String(k || '').replace(/^r_/, '');
  return s === 'b2b_composer' ? 'composer' : s;
};
export const adminSectionCode = (k: string) => `admintool_${adminSectionKey(k)}_access`;

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export function buildRbacCatalog(customObjects: any[] = []) {
  const labels: Record<string, string> = {};
  const actionsOf: Record<string, string[]> = {};
  const groups: { group: string; icon: string; modules: string[]; note?: string }[] = [
    { group: 'CRM — B2B', icon: '🏢', modules: ['leads', 'opportunities', 'customers', 'contacts', 'activities'] },
    { group: 'CPQ — Sales', icon: '💼', modules: ['quotations', 'orders', 'invoices', 'products'] },
    { group: 'Retail — B2C', icon: '🛍️', modules: ['retail_customers', 'retail_orders', 'retail_invoices', 'retail_products', 'retail_activities', 'manage_bookings'] },
    { group: 'Insights', icon: '📊', modules: ['reports'] },
  ];
  const published = (customObjects || []).filter(o => o && o.api_name && o.status !== 'draft' && o.is_active !== false);
  if (published.length) {
    groups.push({ group: 'Custom Objects', icon: '🗂️', modules: published.map(o => `custom_${o.api_name}`) });
    published.forEach(o => { labels[`custom_${o.api_name}`] = `${o.plural_label || o.label || o.api_name}${o.module && o.module !== 'both' ? ` (${String(o.module).toUpperCase()})` : ''}`; });
  }
  groups.push({
    group: 'Admin Tools', icon: '⚙️',
    modules: ['admin', ...ADMIN_SECTIONS.map(([k]) => `admintool_${k}`)],
  });
  actionsOf.admin = ['view'];
  labels.admin = 'Open Admin Tools — all sections';
  actionsOf.reports = ['view', 'export'];
  // Manage Bookings (rental calendar) is a simple visibility switch: navigator + springboard only.
  actionsOf.manage_bookings = ['view'];
  labels.manage_bookings = 'Manage Bookings (Rental)';
  ADMIN_SECTIONS.forEach(([k, l]) => { actionsOf[`admintool_${k}`] = ['access']; labels[`admintool_${k}`] = l; });

  const perms: any[] = [];
  groups.forEach(g => g.modules.forEach(m => {
    (actionsOf[m] || STD_ACTIONS).forEach(a => perms.push({
      code: `${m}_${a}`,
      name: `${titleCase(a)} ${labels[m] || titleCase(m)}`,
      module: m, action: a, group: g.group, groupIcon: g.icon,
    }));
  }));
  const SPECIAL = [
    { code: '__admin__',          name: 'Super Admin (All Access)',   module: 'system', action: 'admin', group: 'System', groupIcon: '🔑' },
    { code: 'view_team_records',  name: 'View Team Records',          module: 'system', action: 'view',  group: 'System', groupIcon: '🔑' },
    { code: 'view_all_records',   name: 'View All Records (Any Org)', module: 'system', action: 'view',  group: 'System', groupIcon: '🔑' },
    { code: 'approve_records',    name: 'Approve Records',            module: 'system', action: 'edit',  group: 'System', groupIcon: '🔑' },
    { code: 'manage_ai',          name: 'Use AI Advisor',             module: 'system', action: 'view',  group: 'System', groupIcon: '🔑' },
  ];
  return { groups, labels, actionsOf, perms, special: SPECIAL, all: [...perms, ...SPECIAL] };
}

/**
 * "Governed if configured": legacy roles created before a module had permissions would otherwise lose access the moment
 * enforcement ships. A module is enforced for a user only once their role set carries at least one code for that module
 * (i.e. an admin has actually configured it); admins always pass.
 */
/** Written by the Security Console on every role save: the role has been explicitly configured, so governed modules are
 *  strict (no code = no access). Roles without it are legacy and keep the "if configured" fallback. */
export const RBAC_STRICT_MARKER = '__rbac_v2__';

export function makeGoverned(hasPermission: (c: string) => boolean, codes: string[], isAdmin: boolean) {
  return (module: string, action: string) => {
    if (isAdmin) return true;
    if (hasPermission(`${module}_${action}`)) return true;
    if ((codes || []).includes(RBAC_STRICT_MARKER)) return false;
    const configured = (codes || []).some(c => c.startsWith(`${module}_`));
    return !configured;
  };
}
