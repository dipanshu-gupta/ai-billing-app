// @ts-nocheck
/**
 * useCustomFields
 * Fetches published custom fields for a retail object type.
 * Used by RetailDetailPanel to render custom field inputs dynamically.
 *
 * IMPORTANT: Zero B2B impact — only call this for retail object types.
 * Uses a module-level cache to avoid refetching on every component mount.
 */
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface CustomField {
  id: string;
  label: string;
  api_name: string;
  field_type: string;
  options: string[];
  required: boolean;
  sort_order: number;
}

// Module-level cache — survives component remounts, cleared on publish
// Only cache non-empty results — empty means "not published yet", always re-check
const _cache: Record<string, CustomField[]> = {};

export function useCustomFields(objectType: string) {
  const [fields,  setFields]  = useState<CustomField[]>(_cache[objectType] || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!objectType || !supabase) { setLoading(false); return; }

    // Use cache only if it has data
    if (_cache[objectType]?.length > 0) {
      setFields(_cache[objectType]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('app_custom_fields')
          .select('id, label, api_name, field_type, options, required, sort_order')
          .eq('object_type', objectType)
          .eq('is_active', true)
          .eq('is_published', true)
          .order('sort_order');
        if (!cancelled) {
          const result: CustomField[] = (data || []).map(f => ({ ...f, options: f.options || [] }));
          if (result.length > 0) _cache[objectType] = result; // only cache non-empty
          setFields(result);
        }
      } catch {
        // Table may not exist yet — silently return empty, don't cache
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [objectType]);

  return { fields, loading };
}

/** Call after publishing to force fresh fetch on next open */
export function invalidateCustomFieldCache(objectType?: string) {
  if (objectType) {
    delete _cache[objectType];
  } else {
    Object.keys(_cache).forEach(k => delete _cache[k]);
  }
}
