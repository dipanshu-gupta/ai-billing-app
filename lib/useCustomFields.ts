// @ts-nocheck
'use client';
/**
 * useCustomFields
 * Fetches published custom fields for any object type — B2B or B2C.
 * Uses module-level cache; call invalidateCustomFieldCache(objectType) after publish.
 */
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

export interface CustomField {
  id: string;
  label: string;
  api_name: string;
  field_type: string;
  options: string[];
  required: boolean;
  sort_order: number;
  show_on: string;
  is_published: boolean;
}

// Module-level cache
const _cache: Record<string, CustomField[]> = {};

/** Call after publishing to force fresh fetch */
export function invalidateCustomFieldCache(objectType?: string) {
  if (objectType) {
    delete _cache[objectType];
  } else {
    Object.keys(_cache).forEach(k => delete _cache[k]);
  }
}

// Get the best available supabase client
function getClient() {
  try {
    // Try to get from window (set by TenantContext)
    if (typeof window !== 'undefined' && (window as any).__bp_supabase) {
      return (window as any).__bp_supabase;
    }
    // Fall back to env vars
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) return createClient(url, key);
  } catch(e) {}
  return null;
}

export function useCustomFields(objectType: string) {
  const [fields,  setFields]  = useState<CustomField[]>(_cache[objectType] || []);
  const [loading, setLoading] = useState(!_cache[objectType]);

  useEffect(() => {
    if (!objectType) { setLoading(false); return; }

    // Use cache if available
    if (_cache[objectType] !== undefined) {
      setFields(_cache[objectType]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const client = getClient();
        if (!client) { setLoading(false); return; }

        const { data, error } = await client
          .from('app_custom_fields')
          .select('id, label, api_name, field_type, options, required, sort_order, show_on, is_published')
          .eq('object_type', objectType)
          .eq('is_active', true)
          .eq('is_published', true)
          .order('sort_order');

        if (!cancelled) {
          const result: CustomField[] = (data || []).map(f => ({
            ...f,
            options: f.options || [],
            show_on: f.show_on || 'both',
          }));
          _cache[objectType] = result; // cache even empty arrays
          setFields(result);
        }
      } catch(e) {
        if (!cancelled) {
          _cache[objectType] = [];
          setFields([]);
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [objectType]);

  return { fields, loading };
}
