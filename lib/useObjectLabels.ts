// @ts-nocheck
'use client';
/**
 * useObjectLabels
 * Fetches object-level display name overrides (e.g. renaming "Customers"
 * to "Patients" throughout the app) - a tenant-wide, single fetch cached
 * for the session, since this is needed in many places (nav sidebar, page
 * headers) but changes rarely. Distinct from useFieldLayout, which
 * renames individual FIELDS, not the object itself.
 */
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { inMemoryLock } from './tenant';

let _cache: Record<string, { singular: string | null; plural: string | null }> | null = null;
let _cacheTenantId: string | null | undefined = undefined;

export function invalidateObjectLabelCache() {
  _cache = null;
  _cacheTenantId = undefined;
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

export function useObjectLabels() {
  const tenantId = typeof window !== 'undefined' ? (window as any).__bp_tenant?.id || null : null;
  const [labels, setLabels] = useState(_cache || {});
  const [loading, setLoading] = useState(_cache === null);

  useEffect(() => {
    if (_cache !== null && _cacheTenantId === tenantId) { setLabels(_cache); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const client = getClient();
        if (!client) { setLoading(false); return; }
        const { data } = await client.from('object_label_overrides').select('*').eq('tenant_id', tenantId).eq('is_published', true);
        const map: Record<string, { singular: string | null; plural: string | null }> = {};
        (data || []).forEach(r => { map[r.object_type] = { singular: r.custom_label_singular, plural: r.custom_label_plural }; });
        if (!cancelled) { _cache = map; _cacheTenantId = tenantId; setLabels(map); }
      } catch (e) {
        if (!cancelled) { _cache = {}; _cacheTenantId = tenantId; setLabels({}); }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [tenantId]);

  // Returns the override for an object (plural form by default, since
  // that's what nav items and list-page headers use), or the given
  // fallback if no override is published. Wrapped in useCallback so this
  // function reference stays stable across renders that don't actually
  // change `labels` - critical since several callers put this in a
  // useEffect/useMemo dependency array, where an unstable reference causes
  // an infinite render loop, not just a wasted recompute.
  const getObjectLabel = useCallback((objectType: string, fallback: string, form: 'singular' | 'plural' = 'plural') => {
    const override = labels[objectType];
    if (!override) return fallback;
    return (form === 'singular' ? override.singular : override.plural) || fallback;
  }, [labels]);

  return { labels, loading, getObjectLabel };
}
