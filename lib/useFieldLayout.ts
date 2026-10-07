// @ts-nocheck
'use client';
/**
 * useFieldLayout
 * Fetches published standard-field customizations (custom labels,
 * visibility, editability, conditional rules, section order) for any
 * object type, and provides a resolve() function to compute the effective
 * display for a given field against the record currently on screen.
 * Mirrors useCustomFields.ts's caching/client pattern for consistency —
 * these are a separate concept (overriding EXISTING fields) from custom
 * fields (defining brand-new ones), so they get their own hook and cache.
 */
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { inMemoryLock } from './tenant';
import { tenantScope } from './utils';

export interface ConditionalRule {
  condition_field: string;
  operator: 'equals' | 'not_equals' | 'is_empty' | 'is_not_empty';
  condition_value?: string;
  then_visibility?: 'visible' | 'hidden' | null;
  then_editability?: 'editable' | 'readonly' | null;
}

export interface FieldLayoutRow {
  id: string;
  field_key: string;
  custom_label: string | null;
  visibility_mode: 'visible' | 'hidden';
  editability_mode: 'editable' | 'readonly';
  section_key: string | null;
  display_order: number;
  conditional_rules: ConditionalRule[];
  is_published: boolean;
  page_scope: 'both' | 'detail' | 'create';
  default_value?: string | null;
  // true when the row was saved on purpose as a page-specific override (new designer).
  is_override?: boolean | null;
}

export interface SectionLayoutRow {
  id: string;
  section_key: string;
  custom_label: string | null;
  display_order: number;
  is_published: boolean;
}

const _cache: Record<string, { fields: FieldLayoutRow[]; sections: SectionLayoutRow[] }> = {};

function getCacheKey(objectType: string): string {
  const tenantId = typeof window !== 'undefined' ? (window as any).__bp_tenant?.id || 'default' : 'default';
  return `${tenantId}:${objectType}`;
}

export function invalidateFieldLayoutCache(objectType?: string) {
  if (objectType) {
    Object.keys(_cache).forEach(k => { if (k.endsWith(':' + objectType)) delete _cache[k]; });
  } else {
    Object.keys(_cache).forEach(k => delete _cache[k]);
  }
}

function getClient() {
  try {
    if (typeof window !== 'undefined' && (window as any).__bp_supabase) return (window as any).__bp_supabase;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) return createClient(url, key, { auth: { lock: inMemoryLock } });
  } catch (e) {}
  return null;
}

// Evaluates a single conditional rule against the record currently on
// screen — the record being viewed/edited, not some separate config record.
export function evaluateFieldCondition(rule: ConditionalRule, record: any): boolean {
  const val = record?.[rule.condition_field];
  switch (rule.operator) {
    case 'equals':        return String(val ?? '') === String(rule.condition_value ?? '');
    case 'not_equals':    return String(val ?? '') !== String(rule.condition_value ?? '');
    case 'is_empty':      return val === undefined || val === null || val === '';
    case 'is_not_empty':  return !(val === undefined || val === null || val === '');
    default:              return false;
  }
}

// A page-specific row that only repeats the defaults (no label, visible, editable,
// no rules, no default value) and was NOT saved on purpose as an override. Older
// versions of the designer wrote one of these for EVERY field whenever a single
// page tab was saved, which silently masked the "Both Pages" customizations.
const isDefaultProps = (r: FieldLayoutRow) =>
  !r.custom_label && r.visibility_mode !== 'hidden' && r.editability_mode !== 'readonly'
  && !(r.conditional_rules || []).length && !r.default_value;

// Picks the one row that applies to a field on a page:
//   page-specific row  >  "Both Pages" row  >  nothing.
// A page-specific row defers to the "Both Pages" row only when it is a redundant
// default row (see above), so "Both" customizations are never masked.
export function resolveFieldRow(fieldKey: string, layout: FieldLayoutRow[], pageScope: 'detail' | 'create' = 'detail'): FieldLayoutRow | undefined {
  let scoped: FieldLayoutRow | undefined, both: FieldLayoutRow | undefined;
  for (const r of layout || []) {
    if (r.field_key !== fieldKey || !r.is_published) continue;
    if (r.page_scope === pageScope) scoped = r;
    else if (r.page_scope === 'both' || !r.page_scope) both = r;
  }
  if (scoped && both && !scoped.is_override && isDefaultProps(scoped)) return both;
  return scoped || both;
}

// One effective row per field for a page (used for defaults, ordering, ...).
export function effectiveRows(layout: FieldLayoutRow[], pageScope: 'detail' | 'create' = 'detail'): FieldLayoutRow[] {
  const keys = Array.from(new Set((layout || []).map(r => r.field_key)));
  return keys.map(k => resolveFieldRow(k, layout, pageScope)).filter(Boolean) as FieldLayoutRow[];
}

// Resolves the effective label/visible/editable for one field, for a
// specific page (detail or create).
export function resolveFieldDisplay(fieldKey: string, defaultLabel: string, layout: FieldLayoutRow[], record: any, pageScope: 'detail' | 'create' = 'detail') {
  const row = resolveFieldRow(fieldKey, layout, pageScope);
  if (!row) return { label: defaultLabel, visible: true, editable: true };

  let visible = row.visibility_mode !== 'hidden';
  let editable = row.editability_mode !== 'readonly';
  const label = row.custom_label || defaultLabel;

  for (const rule of row.conditional_rules || []) {
    if (evaluateFieldCondition(rule, record)) {
      if (rule.then_visibility) visible = rule.then_visibility === 'visible';
      if (rule.then_editability) editable = rule.then_editability === 'editable';
    }
  }

  return { label, visible, editable };
}

// Custom (App Composer) fields are keyed 'cf_<api_name>' in the designer.
export const cfKey = (apiName: string) => 'cf_' + apiName;

export function useFieldLayout(objectType: string) {
  const cacheKey = getCacheKey(objectType);
  const cached = _cache[cacheKey];
  const [fields, setFields] = useState<FieldLayoutRow[]>(cached?.fields || []);
  const [sections, setSections] = useState<SectionLayoutRow[]>(cached?.sections || []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (!objectType) { setLoading(false); return; }
    if (_cache[cacheKey] !== undefined) {
      setFields(_cache[cacheKey].fields);
      setSections(_cache[cacheKey].sections);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const client = getClient();
        if (!client) { setLoading(false); return; }

        // Tenant-scoped like every other table (dedicated-DB tenants need no filter).
        const [{ data: fieldRows }, { data: sectionRows }] = await Promise.all([
          tenantScope(client.from('field_layout_config').select('*')).eq('object_type', objectType).eq('is_published', true).order('display_order'),
          tenantScope(client.from('field_layout_sections').select('*')).eq('object_type', objectType).eq('is_published', true).order('display_order'),
        ]);

        if (!cancelled) {
          const result = { fields: fieldRows || [], sections: sectionRows || [] };
          _cache[cacheKey] = result;
          setFields(result.fields);
          setSections(result.sections);
        }
      } catch (e) {
        if (!cancelled) { _cache[cacheKey] = { fields: [], sections: [] }; setFields([]); setSections([]); }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [objectType, cacheKey]);

  const resolve = useCallback((fieldKey: string, defaultLabel: string, record: any, pageScope: 'detail' | 'create' = 'detail') => {
    return resolveFieldDisplay(fieldKey, defaultLabel, fields, record, pageScope);
  }, [fields]);

  return { fields, sections, loading, resolve };
}

// Turns a stored default (always text) into a real value: 'today' / "other_field+3" for dates,
// booleans for checkboxes, numbers for numeric fields. Same rules the retail create form used.
const REL_DEFAULT_RE = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*([+-]\d+)?$/;
export function resolveLayoutDefault(fieldType: string, rawValue: any, sourceRow: any = null) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return undefined;
  const raw = String(rawValue);
  const t = String(fieldType || 'text');
  if (t === 'date') {
    if (raw.toLowerCase() === 'today') return new Date().toLocaleDateString('en-CA');
    const m = raw.match(REL_DEFAULT_RE);
    if (m) {
      const refVal = sourceRow?.[m[1]];
      if (!refVal) return undefined;
      const d = new Date(refVal + 'T00:00:00');
      if (isNaN(d.getTime())) return undefined;
      if (m[2]) d.setDate(d.getDate() + parseInt(m[2], 10));
      return d.toLocaleDateString('en-CA');
    }
    return raw;
  }
  if (t === 'checkbox' || t === 'boolean') return raw.toLowerCase() === 'true';
  if (t === 'number' || t === 'currency') { const n = Number(raw); return Number.isNaN(n) ? undefined : n; }
  return raw;
}
