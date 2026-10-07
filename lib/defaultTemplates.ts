// @ts-nocheck
/**
 * Dynamic default-value templates for the Page Layout Designer.
 *
 *   Text target     "Salary of {{CoachName}} for {{Month}}"
 *   Number target   "= {{BaseSalary}} * {{DaysWorked}} / 30"      (safe arithmetic, no eval)
 *   Date target     "{{today+7}}"  or  "{{StartDate+30}}"
 *
 * Tokens match a field by api name, key or label (case/space/underscore-insensitive), so
 * {{CoachName}}, {{coach_name}} and {{Coach Name}} are the same field. Tenant labels from the
 * designer ("custom_label") match too, so renamed fields keep working.
 *
 * Token extras:   {{Month|upper}}  {{Start|date:MMMM YYYY}}  {{Amount|number:0}}  {{Notes|default:N/A}}
 * Filters:        upper lower title trim initials date:FMT number[:n] default:TEXT
 * Specials:       today  today+7  now  year  user.name  user.email  user.first_name  user.last_name
 *
 * Runtime: `useTemplateDefaults` recomputes templated targets live as their source fields change,
 * and stops for a target the moment the user edits it by hand (their value always wins).
 */

import { useEffect, useRef, useState } from 'react';

export const TOKEN_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

export const hasTemplate = (raw: any) => typeof raw === 'string' && /\{\{[^{}]+\}\}/.test(raw);
const isNumType = (t: string) => ['number', 'currency', 'percent', 'decimal', 'integer'].includes(String(t || ''));
export const isFormula = (raw: any, type: string) => typeof raw === 'string' && isNumType(type) && (/^\s*=/.test(raw) || hasTemplate(raw));
/** True when a stored default must go through the template engine instead of being used literally. */
export const isTemplateDefault = (raw: any, type: string = 'text') => hasTemplate(raw) || isFormula(raw, type);

const norm = (s: any) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export interface TemplateField { key: string; label: string; type?: string; alt?: string[] }
export interface TemplateCtx {
  values: Record<string, any>;
  fields: TemplateField[];
  display?: (key: string, value: any, field?: TemplateField) => string | undefined;
  user?: any;
}

function buildIndex(fields: TemplateField[]) {
  const m = new Map<string, TemplateField>();
  fields.forEach(f => {
    [f.key, f.label, ...(f.alt || [])].forEach(n => { const k = norm(n); if (k && !m.has(k)) m.set(k, f); });
  });
  return m;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function formatDateTpl(v: any, fmt = 'DD MMM YYYY') {
  const s = String(v ?? '');
  const mm = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = mm ? new Date(+mm[1], +mm[2] - 1, +mm[3]) : new Date(s);
  if (isNaN(d.getTime())) return s;
  const pad = (n: number) => String(n).padStart(2, '0');
  return fmt.replace(/YYYY|YY|MMMM|MMM|MM|DD|D/g, t => ({
    YYYY: String(d.getFullYear()), YY: String(d.getFullYear()).slice(2), MMMM: MONTHS[d.getMonth()],
    MMM: MONTHS[d.getMonth()].slice(0, 3), MM: pad(d.getMonth() + 1), DD: pad(d.getDate()), D: String(d.getDate()),
  }[t]));
}
const iso = (d: Date) => d.toLocaleDateString('en-CA');
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function applyFilter(val: string, f: string) {
  const [name, ...rest] = f.split(':');
  const arg = rest.join(':');
  switch (name.trim().toLowerCase()) {
    case 'upper': return val.toUpperCase();
    case 'lower': return val.toLowerCase();
    case 'title': return val.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    case 'trim': return val.trim();
    case 'initials': return val.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase();
    case 'date': return val ? formatDateTpl(val, arg || 'DD MMM YYYY') : val;
    case 'number': { const n = Number(String(val).replace(/,/g, '')); return Number.isNaN(n) || val === '' ? val : n.toLocaleString(undefined, { maximumFractionDigits: arg !== '' && arg !== undefined ? Number(arg) : 2, minimumFractionDigits: arg !== '' && arg !== undefined ? Number(arg) : 0 }); }
    case 'default': return val === '' ? arg : val;
    default: return val;
  }
}

/** Resolve one token body ("CoachName", "Month|upper", "today+7", "StartDate+30") -> {text, raw, filled}. */
function resolveToken(body: string, ctx: TemplateCtx, idx: Map<string, TemplateField>) {
  const parts = body.split('|').map(s => s.trim());
  const expr = parts[0];
  const filters = parts.slice(1);
  let text = '';
  let rawVal: any = '';
  let filled = false;
  const fieldVal = (f: TemplateField) => {
    const v = ctx.values?.[f.key];
    if (v === undefined || v === null || v === '') return { text: '', raw: '' };
    let t: string;
    if (Array.isArray(v)) t = v.join(', ');
    else if (f.type === 'checkbox' || f.type === 'boolean' || typeof v === 'boolean') t = (v === true || v === 'true') ? 'Yes' : 'No';
    else if (f.type === 'lookup' || f.type === 'reference') t = ctx.display?.(f.key, v, f) ?? String(v);
    else if (f.type === 'date') t = formatDateTpl(v);
    else if (isNumType(f.type || '')) { const n = Number(v); t = Number.isNaN(n) ? String(v) : n.toLocaleString(undefined, { maximumFractionDigits: 2 }); }
    else t = ctx.display?.(f.key, v, f) ?? String(v);
    return { text: t, raw: v };
  };

  const direct = idx.get(norm(expr));
  const arith = expr.match(/^(.+?)\s*([+-]\s*\d+)$/);
  if (direct) {
    const r = fieldVal(direct); text = r.text; rawVal = r.raw; filled = r.text !== '';
  } else if (arith && idx.get(norm(arith[1])) && idx.get(norm(arith[1])).type === 'date') {
    const f = idx.get(norm(arith[1]));
    const v = ctx.values?.[f.key];
    if (v) { const base = new Date(String(v).slice(0, 10) + 'T00:00:00'); if (!isNaN(base.getTime())) { rawVal = iso(addDays(base, parseInt(arith[2].replace(/\s/g, ''), 10))); text = formatDateTpl(rawVal); filled = true; } }
  } else {
    const e = expr.toLowerCase();
    const u = ctx.user || {};
    const tm = e.match(/^today\s*([+-]\s*\d+)?$/);
    if (tm) { rawVal = iso(tm[1] ? addDays(new Date(), parseInt(tm[1].replace(/\s/g, ''), 10)) : new Date()); text = formatDateTpl(rawVal); filled = true; }
    else if (e === 'now') { rawVal = new Date().toISOString(); text = formatDateTpl(iso(new Date())); filled = true; }
    else if (e === 'year') { text = rawVal = String(new Date().getFullYear()); filled = true; }
    else if (e === 'user.name' || e === 'user') { text = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.name || u.email || ''; rawVal = text; filled = !!text; }
    else if (e === 'user.email') { text = rawVal = u.email || ''; filled = !!text; }
    else if (e === 'user.first_name') { text = rawVal = u.first_name || ''; filled = !!text; }
    else if (e === 'user.last_name') { text = rawVal = u.last_name || ''; filled = !!text; }
    else {
      // Unknown to the vocabulary: still honour a raw form value with that exact key.
      const key = Object.keys(ctx.values || {}).find(k => norm(k) === norm(expr));
      if (key && ctx.values[key] !== undefined && ctx.values[key] !== '' && ctx.values[key] !== null) { text = String(ctx.values[key]); rawVal = ctx.values[key]; filled = true; }
    }
  }
  filters.forEach(f => { text = applyFilter(text, f); });
  return { text, raw: rawVal, filled };
}

// ── safe arithmetic (no eval): numbers, + - * / ( ) and unary minus ──────────────────────────────
function evalArith(src: string): number | undefined {
  if (!/^[\d.\s+\-*/()]+$/.test(src)) return undefined;
  let i = 0;
  const peek = () => { while (src[i] === ' ') i++; return src[i]; };
  const num = (): number => {
    const c = peek();
    if (c === '(') { i++; const v = add(); if (peek() === ')') i++; return v; }
    if (c === '-') { i++; return -num(); }
    if (c === '+') { i++; return num(); }
    const m = src.slice(i).match(/^\d*\.?\d+/);
    if (!m) throw new Error('x');
    i += m[0].length; return parseFloat(m[0]);
  };
  const mul = (): number => { let v = num(); for (;;) { const c = peek(); if (c === '*') { i++; v *= num(); } else if (c === '/') { i++; const d = num(); v = d === 0 ? NaN : v / d; } else return v; } };
  const add = (): number => { let v = mul(); for (;;) { const c = peek(); if (c === '+') { i++; v += mul(); } else if (c === '-') { i++; v -= mul(); } else return v; } };
  try { const r = add(); peek(); return i >= src.length && Number.isFinite(r) ? r : undefined; } catch { return undefined; }
}

/**
 * Render a template for a target of `type`. Returns undefined when there is nothing to show yet
 * (no referenced value filled) so the target stays empty instead of reading "Salary of  for ".
 */
export function renderTemplate(raw: string, type: string, ctx: TemplateCtx): string | number | undefined {
  const idx = buildIndex(ctx.fields || []);
  const t = String(type || 'text');

  if (isNumType(t)) {
    let anyFilled = false;
    const expr = String(raw).replace(/^\s*=/, '').replace(TOKEN_RE, (_m, body) => {
      const r = resolveToken(body, ctx, idx);
      const n = Number(String(r.raw ?? '').toString().replace(/,/g, ''));
      if (r.filled && !Number.isNaN(n)) { anyFilled = true; return `(${n})`; }
      return '(0)';
    });
    // bare field names without {{ }} after "=": =Base*Days
    let bare = expr;
    if (!/\{\{/.test(String(raw))) {
      bare = expr.replace(/[A-Za-z_][A-Za-z0-9_ ]*/g, (w) => {
        const f = idx.get(norm(w));
        if (!f) return w;
        const n = Number(ctx.values?.[f.key]);
        if (!Number.isNaN(n) && ctx.values?.[f.key] !== '' && ctx.values?.[f.key] != null) { anyFilled = true; return `(${n})`; }
        return '(0)';
      });
    }
    if (!anyFilled) return undefined;
    const v = evalArith(bare);
    return v === undefined ? undefined : Math.round(v * 100) / 100;
  }

  if (t === 'date') {
    // A date target takes the token's real ISO value ({{today+7}}, {{StartDate+30}}), not its display text.
    const one = String(raw).trim().match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
    if (one) { const r = resolveToken(one[1], ctx, idx); const rv = String(r.raw ?? '').slice(0, 10); return r.filled && /^\d{4}-\d{2}-\d{2}$/.test(rv) ? rv : undefined; }
  }
  if (t === 'datetime') {
    // A date & time target takes the token's real value: {{now}} -> local date+time, {{today}} / {{today+7}} -> that day at the current time, a date field -> 00:00.
    const one = String(raw).trim().match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
    if (one) {
      const r = resolveToken(one[1], ctx, idx);
      const rv = String(r.raw ?? '');
      if (!r.filled) return undefined;
      const p2 = (n: number) => String(n).padStart(2, '0');
      const hhmm = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(rv)) return `${rv}T${/^today/i.test(one[1].trim()) ? hhmm(new Date()) : '00:00'}`;
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(rv)) {
        if (/(Z|[+-]\d{2}:?\d{2})$/.test(rv)) { const d = new Date(rv); return isNaN(d.getTime()) ? undefined : `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${hhmm(d)}`; }
        return rv.slice(0, 16);
      }
      return undefined;
    }
  }
  let filledCount = 0;
  let tokenCount = 0;
  const out = String(raw).replace(TOKEN_RE, (_m, body) => {
    tokenCount++;
    const r = resolveToken(body, ctx, idx);
    if (r.filled) filledCount++;
    return r.text;
  });
  if (tokenCount > 0 && filledCount === 0) return undefined;
  const cleaned = out.replace(/[ \t]{2,}/g, ' ').trim();
  if (t === 'date') return /^\d{4}-\d{2}-\d{2}/.test(cleaned) ? cleaned.slice(0, 10) : undefined;
  if (t === 'datetime') return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(cleaned) ? cleaned.slice(0, 16) : undefined;
  return cleaned;
}

/** Keys of fields a template reads (used to decide when to recompute). */
export function templateRefs(raw: string, fields: TemplateField[]): string[] {
  const idx = buildIndex(fields || []);
  const keys = new Set<string>();
  const add = (name: string) => { const f = idx.get(norm(name)); if (f) keys.add(f.key); };
  String(raw).replace(TOKEN_RE, (_m, body) => { const e = body.split('|')[0].trim(); add(e); const a = e.match(/^(.+?)\s*[+-]\s*\d+$/); if (a) add(a[1]); return ''; });
  if (!/\{\{/.test(String(raw))) String(raw).replace(/[A-Za-z_][A-Za-z0-9_ ]*/g, (w) => { add(w); return ''; });
  return [...keys];
}

/** Designer preview: tokens shown as ‹Label›; unknown ones flagged so typos are visible. */
export function previewTemplate(raw: string, fields: TemplateField[]) {
  const idx = buildIndex(fields || []);
  const specials = /^(today(\s*[+-]\s*\d+)?|now|year|user(\.(name|email|first_name|last_name))?)$/i;
  const unknown: string[] = [];
  const text = String(raw || '').replace(TOKEN_RE, (_m, body) => {
    const e = body.split('|')[0].trim();
    const a = e.match(/^(.+?)\s*[+-]\s*\d+$/);
    const f = idx.get(norm(e)) || (a && idx.get(norm(a[1])));
    if (f) return `‹${f.label}›`;
    if (specials.test(e)) return `‹${e}›`;
    unknown.push(e); return `⚠${e}`;
  });
  return { text, unknown };
}

/**
 * Keeps templated targets in sync with the form.
 *   templates: { [targetKey]: { raw, type } }
 *   values:    flat view of every value (standard + custom fields)
 *   onPatch:   (patch) => void   — modal routes keys into its own state
 */
export function useTemplateDefaults({ open, templates, fields, values, onPatch, display = undefined, user = undefined }:
  { open: boolean; templates: Record<string, { raw: string; type: string }>; fields: TemplateField[]; values: Record<string, any>; onPatch: (p: Record<string, any>) => void; display?: any; user?: any; }) {
  const manual = useRef<Set<string>>(new Set());
  const last = useRef<Record<string, any>>({});
  const wasOpen = useRef(false);

  // Armed one tick after opening so the modal's own "reset form on open" effect has already replaced
  // any stale values from the previous session — otherwise those would look like manual edits.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (open && !wasOpen.current) { manual.current = new Set(); last.current = {}; }
    wasOpen.current = open;
    if (!open) { setArmed(false); return; }
    const id = setTimeout(() => setArmed(true), 0);
    return () => clearTimeout(id);
  }, [open]);

  const targets = Object.keys(templates || {});
  const watch = new Set<string>(targets);
  targets.forEach(k => templateRefs(templates[k].raw, fields).forEach(r => watch.add(r)));
  const sig = JSON.stringify([...watch].map(k => values?.[k] ?? null)) + '|' + targets.map(k => templates[k].raw).join('¦');

  useEffect(() => {
    if (!open || !armed || !targets.length) return;
    const patch: Record<string, any> = {};
    targets.forEach(key => {
      if (manual.current.has(key)) return;
      const cur = values?.[key];
      const prev = last.current[key];
      const curEmpty = cur === undefined || cur === null || cur === '';
      if (!curEmpty && prev === undefined && !(typeof cur === 'string' && hasTemplate(cur))) {
        // prefilled / typed before we ever wrote anything -> theirs
        manual.current.add(key); return;
      }
      if (prev !== undefined && cur !== prev && !(curEmpty && prev === '')) { manual.current.add(key); return; }
      const next = renderTemplate(templates[key].raw, templates[key].type, { values, fields, display, user });
      const nextVal = next === undefined ? '' : next;
      if (nextVal !== (curEmpty ? '' : cur)) patch[key] = nextVal;
      last.current[key] = nextVal;
    });
    if (Object.keys(patch).length) onPatch(patch);
  }, [open, armed, sig]);
}

const TEMPLATE_TARGET_OK = (t: string) => !['checkbox', 'boolean', 'single_select', 'multi_select', 'select', 'lookup'].includes(String(t || 'text'));

/**
 * Collects every templated default that applies on the create page.
 *   rows         effectiveRows(layout,'create')  (standard + cf_ rows)
 *   customFields app_custom_fields for the object  ({api_name, field_type, default_value})
 *   typeOf(key)  field type of a standard field key
 *   cfRow(api)   layout row for a custom field (resolveFieldRow(cfKey(api), ...)) or undefined
 */
export function gatherTemplates(rows: any[], customFields: any[], typeOf: (k: string) => string, cfRow: (api: string) => any) {
  const templates: Record<string, { raw: string; type: string }> = {};
  const customKeys = new Set<string>();
  (rows || []).forEach(r => {
    if (!r?.field_key || String(r.field_key).startsWith('cf_') || String(r.field_key).startsWith('__')) return;
    const type = typeOf(r.field_key) || 'text';
    if (TEMPLATE_TARGET_OK(type) && isTemplateDefault(r.default_value, type)) templates[r.field_key] = { raw: r.default_value, type };
  });
  (customFields || []).forEach(cf => {
    const row = cfRow ? cfRow(cf.api_name) : undefined;
    const raw = row?.default_value ?? cf.default_value;
    customKeys.add(cf.api_name);
    if (TEMPLATE_TARGET_OK(cf.field_type) && isTemplateDefault(raw, cf.field_type)) templates[cf.api_name] = { raw, type: cf.field_type };
  });
  return { templates, customKeys };
}
