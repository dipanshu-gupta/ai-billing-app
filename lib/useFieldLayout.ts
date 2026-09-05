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

// Resolves the effective label/visible/editable for one field, for a
// specific page (detail or create). If both a page-specific row and a
// 'both' row exist for the same field, the page-specific one wins - an
// admin overriding just the Create page for a field shouldn't need to
// also duplicate whatever the 'both' row already says.
export function resolveFieldDisplay(fieldKey: string, defaultLabel: string, layout: FieldLayoutRow[], record: any, pageScope: 'detail' | 'create' = 'detail') {
  const candidates = layout.filter(r => r.field_key === fieldKey && r.is_published && (r.page_scope === pageScope || r.page_scope === 'both' || !r.page_scope));
  const row = candidates.find(r => r.page_scope === pageScope) || candidates.find(r => r.page_scope === 'both' || !r.page_scope);
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

// Companion to resolveFieldDisplay — resolves just the saved row for a
// field at a given page scope (same precedence: page-specific row wins
// over a 'both' row), for callers that need display_order directly for
// reordering rather than the label/visible/editable resolved above.
// Returns undefined if no row matches, letting the caller fall back to a
// field's original position.
export function resolveFieldRow(fieldKey: string, layout: FieldLayoutRow[], pageScope: 'detail' | 'create' = 'detail'): FieldLayoutRow | undefined {
  const candidates = layout.filter(r => r.field_key === fieldKey && r.is_published && (r.page_scope === pageScope || r.page_scope === 'both' || !r.page_scope));
  return candidates.find(r => r.page_scope === pageScope) || candidates.find(r => r.page_scope === 'both' || !r.page_scope);
}

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

        const tenantId = typeof window !== 'undefined' ? (window as any).__bp_tenant?.id || null : null;
        const [{ data: fieldRows }, { data: sectionRows }] = await Promise.all([
          client.from('field_layout_config').select('*').eq('object_type', objectType).eq('tenant_id', tenantId).eq('is_published', true).order('display_order'),
          client.from('field_layout_sections').select('*').eq('object_type', objectType).eq('tenant_id', tenantId).eq('is_published', true).order('display_order'),
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
