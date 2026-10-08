// @ts-nocheck
/** Client-safe: does this tenant have Marketing Cloud? (The server re-checks.) */
export function hasMarketing(tenant: any): boolean {
  const m = tenant?.modules;
  const list = Array.isArray(m) ? m : (typeof m === 'string' ? m.split(',') : []);
  return list.map((x: any) => String(x).trim().toLowerCase()).includes('marketing');
}
