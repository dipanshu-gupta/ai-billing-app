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

type LabelMap = Record<string, { singular: string | null; plural: string | null }>;
let _cache: LabelMap | null = null;
let _cacheTenantId: string | null | undefined = undefined;
const _subs = new Set<() => void>();
const _notify = () => _subs.forEach(fn => { try { fn(); } catch (e) {} });

/**
 * Clears the cache AND tells every mounted component (sidebar, springboard,
 * page headers, buttons...) to re-fetch, so a rename published in the Page
 * Layout Designer shows everywhere immediately - no reload, no remount.
 */
export function invalidateObjectLabelCache() {
  _cache = null;
  _cacheTenantId = undefined;
  _notify();
}

// Non-hook accessors (for config getters and the global alert dialog, which
// can't call hooks). They read the same live store the hook subscribes to.
export function labelNow(objectType: string, fallback: string, form: 'singular' | 'plural' = 'plural') {
  const o = _cache && _cache[objectType];
  if (!o) return fallback;
  return (form === 'singular' ? o.singular : o.plural) || fallback;
}
export function labelsSnapshot(): LabelMap { return _cache || {}; }

function getClient() {
  try {
    if (typeof window !== 'undefined' && (window as any).__bp_supabase) return (window as any).__bp_supabase;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) return createClient(url, key, { auth: { lock: inMemoryLock } });
  } catch (e) {}
  return null;
}

let _inflight: Promise<void> | null = null;
async function loadLabels(tenantId: string | null) {
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const client = getClient();
      if (!client) return;
      let q = client.from('object_label_overrides').select('*').eq('is_published', true);
      q = tenantId ? q.eq('tenant_id', tenantId) : q.is('tenant_id', null);
      const { data } = await q;
      const map: LabelMap = {};
      (data || []).forEach(r => { map[r.object_type] = { singular: r.custom_label_singular, plural: r.custom_label_plural }; });
      _cache = map; _cacheTenantId = tenantId;
    } catch (e) {
      _cache = {}; _cacheTenantId = tenantId;
    } finally { _inflight = null; }
  })();
  return _inflight;
}

export function useObjectLabels() {
  const tenantId = typeof window !== 'undefined' ? (window as any).__bp_tenant?.id || null : null;
  const [labels, setLabels] = useState<LabelMap>(_cache || {});
  const [loading, setLoading] = useState(_cache === null);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      // A different tenant than the cached one (tenant switch) must never reuse its labels.
      if (_cache === null || _cacheTenantId !== tenantId) {
        setLoading(true);
        await loadLabels(tenantId);
      }
      if (!cancelled) { setLabels({ ...(_cache || {}) }); setLoading(false); }
    };
    sync();
    _subs.add(sync);
    return () => { cancelled = true; _subs.delete(sync); };
  }, [tenantId]);

  // Stable reference across renders that don't change `labels` (callers use
  // this in useEffect/useMemo deps - an unstable reference would loop).
  const getObjectLabel = useCallback((objectType: string, fallback: string, form: 'singular' | 'plural' = 'plural') => {
    const override = labels[objectType];
    if (!override) return fallback;
    return (form === 'singular' ? override.singular : override.plural) || fallback;
  }, [labels]);

  return { labels, loading, getObjectLabel };
}
