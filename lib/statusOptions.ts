// @ts-nocheck
/**
 * Tenant-configurable status lists.
 *
 * Every object ships with a built-in list of statuses (lib/utils.ts
 * getStatusOptions, RETAIL_CONFIG.statusOptions, CUSTOM_STATUS_OPTIONS). A
 * tenant can replace any of them from Page Layout Designer -> Status Values;
 * the replacement is stored per tenant in `status_options` and applied here,
 * so every list filter, board column, create form and detail form that asks
 * for an object's statuses picks it up with no further wiring.
 *
 * Module-level registry (like the other lib caches): AppContext loads it once
 * the tenant is known, and bumps a React state so consumers re-render.
 */
const COLOR_CLASS: Record<string, string> = {
  gray:   'bg-gray-100 text-gray-600',
  blue:   'bg-blue-100 text-blue-700',
  green:  'bg-green-100 text-green-700',
  amber:  'bg-amber-100 text-amber-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red:    'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
  teal:   'bg-teal-100 text-teal-700',
  orange: 'bg-orange-100 text-orange-700',
};
export const STATUS_COLORS = Object.keys(COLOR_CLASS);
export const statusColorClass = (c: string) => COLOR_CLASS[c] || COLOR_CLASS.gray;

let _byObject: Record<string, { value: string; color: string }[]> = {};
let _colorByValue: Record<string, string> = {}; // "<object>|<value>" and "*|<value>" -> color

export function setStatusOverrides(rows: any[]) {
  const by: Record<string, any[]> = {};
  const colors: Record<string, string> = {};
  (rows || []).filter(r => r.is_active !== false).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).forEach(r => {
    (by[r.object_type] = by[r.object_type] || []).push({ value: r.value, color: r.color || 'gray' });
    colors[`${r.object_type}|${r.value}`] = r.color || 'gray';
    if (!colors[`*|${r.value}`]) colors[`*|${r.value}`] = r.color || 'gray';
  });
  _byObject = by; _colorByValue = colors;
}

/** The tenant's list for this object if one is configured, else the built-in default. */
export function resolveStatusOptions(objectType: string, defaults: string[]): string[] {
  const ov = _byObject[objectType];
  return ov && ov.length ? ov.map(o => o.value) : defaults;
}

const COLOR_HEX: Record<string, string> = {
  gray: '#94A3B8', blue: '#3B82F6', green: '#10B981', amber: '#F59E0B', yellow: '#EAB308',
  red: '#EF4444', purple: '#8B5CF6', teal: '#14B8A6', orange: '#F97316',
};
/** Hex colour (for charts) for a status the tenant has coloured, else null. */
export function overrideStatusHex(status: string, objectType?: string): string | null {
  const c = (objectType && _colorByValue[`${objectType}|${status}`]) || _colorByValue[`*|${status}`];
  return c ? (COLOR_HEX[c] || COLOR_HEX.gray) : null;
}

/** Tailwind classes for a status the tenant has coloured, else null (caller falls back). */
export function overrideStatusColor(status: string, objectType?: string): string | null {
  const c = (objectType && _colorByValue[`${objectType}|${status}`]) || _colorByValue[`*|${status}`];
  return c ? statusColorClass(c) : null;
}
