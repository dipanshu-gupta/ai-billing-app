// @ts-nocheck
'use client';
/**
 * useFieldMappingRules ("Copy Maps")
 * Fetches active field mapping rules for a given rule_type + source_object,
 * and provides applyFieldMapping() to actually copy values according to
 * those rules. Two distinct scenarios:
 *   - product_to_line_item: copies a product's field onto a line item when
 *     that product is selected (synchronous - the caller already has both
 *     records in memory, e.g. inside a line-item grid's onChange handler).
 *   - record_conversion: copies a field from a source record onto a newly
 *     created target record during a conversion like Order → Invoice.
 * Mirrors useFieldLayout.ts's caching/client pattern for consistency.
 */
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { inMemoryLock } from './tenant';

export interface FieldMappingRule {
  id: string;
  rule_type: 'product_to_line_item' | 'record_conversion';
  name: string | null;
  source_object: string;
  source_field: string;
  source_field_type: 'custom' | 'standard';
  target_object: string;
  target_field: string;
  target_field_type: 'custom' | 'standard';
  conversion_context: string | null;
  is_active: boolean;
}

const _cache: Record<string, FieldMappingRule[]> = {};

function getCacheKey(ruleType: string, sourceObject: string): string {
  const tenantId = typeof window !== 'undefined' ? (window as any).__bp_tenant?.id || 'default' : 'default';
  return `${tenantId}:${ruleType}:${sourceObject}`;
}

export function invalidateFieldMappingCache() {
  Object.keys(_cache).forEach(k => delete _cache[k]);
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

// Reads a field's value off a record, whether it's a standard field (a
// direct property) or a custom field (nested under custom_data by its
// api_name) - the two field types live in different places on a record.
function readField(record: any, field: string, fieldType: string) {
  if (!record) return undefined;
  return fieldType === 'custom' ? (record.custom_data || {})[field] : record[field];
}

// Writes a field's value onto a record object IN PLACE, the same way -
// standard fields as a direct property, custom fields nested under
// custom_data. Returns the (possibly new) custom_data object so callers
// building an insert/update payload can pick it up correctly.
function writeField(record: any, field: string, fieldType: string, value: any) {
  if (fieldType === 'custom') {
    record.custom_data = { ...(record.custom_data || {}), [field]: value };
  } else {
    record[field] = value;
  }
}

// System-managed fields that a mapping rule should never be able to
// overwrite, even if misconfigured - mirrors the same protection already
// applied to workflow update_field actions (which block owner/owner_id).
// These are either primary keys/numbers the app manages itself, or fields
// with deliberate defaults set by the conversion logic that a mapping rule
// copying from the source record would silently clobber.
const PROTECTED_STANDARD_FIELDS = new Set(['id', 'owner', 'owner_id', 'created_at', 'updated_at', 'created_by', 'updated_by']);

// Applies every matching, active rule from `rules` to copy values from
// `sourceRecord` onto `targetRecord` (mutated in place). For
// product_to_line_item this is called synchronously right after a product
// is selected in a line-item grid; for record_conversion it's called
// after building the new record but before it's saved.
export function applyFieldMapping(rules: FieldMappingRule[], sourceRecord: any, targetRecord: any, conversionContext?: string) {
  for (const rule of rules) {
    if (!rule.is_active) continue;
    if (rule.conversion_context && conversionContext && rule.conversion_context !== conversionContext) continue;
    if (rule.target_field_type === 'standard' && PROTECTED_STANDARD_FIELDS.has(rule.target_field)) continue;
    const value = readField(sourceRecord, rule.source_field, rule.source_field_type);
    if (value === undefined) continue; // nothing to copy — don't overwrite an existing target value with undefined
    writeField(targetRecord, rule.target_field, rule.target_field_type, value);
  }
  return targetRecord;
}

export function useFieldMappingRules(ruleType: string, sourceObject: string) {
  const cacheKey = getCacheKey(ruleType, sourceObject);
  const [rules, setRules] = useState<FieldMappingRule[]>(_cache[cacheKey] || []);
  const [loading, setLoading] = useState(!_cache[cacheKey]);

  useEffect(() => {
    if (!ruleType || !sourceObject) { setLoading(false); return; }
    if (_cache[cacheKey] !== undefined) { setRules(_cache[cacheKey]); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const client = getClient();
        if (!client) { setLoading(false); return; }
        const tenantId = typeof window !== 'undefined' ? (window as any).__bp_tenant?.id || null : null;
        const { data } = await client.from('field_mapping_rules').select('*')
          .eq('rule_type', ruleType).eq('source_object', sourceObject).eq('tenant_id', tenantId).eq('is_active', true);
        if (!cancelled) { _cache[cacheKey] = data || []; setRules(data || []); }
      } catch (e) {
        if (!cancelled) { _cache[cacheKey] = []; setRules([]); }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [ruleType, sourceObject, cacheKey]);

  return { rules, loading };
}

// For contexts that can't use the hook (e.g. inside an async function in
// AppContext.tsx, not a component) - a direct, uncached fetch. Used for
// record_conversion rules, which fire relatively rarely (only during an
// actual conversion) compared to product_to_line_item (checked on every
// product selection), so skipping the cache here is an acceptable tradeoff
// for simplicity.
export async function fetchFieldMappingRules(supabase: any, ruleType: string, sourceObject: string, tenantId: string | null): Promise<FieldMappingRule[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase.from('field_mapping_rules').select('*')
      .eq('rule_type', ruleType).eq('source_object', sourceObject).eq('tenant_id', tenantId).eq('is_active', true);
    return data || [];
  } catch (e) {
    console.error('[fetchFieldMappingRules]', e);
    return [];
  }
}
