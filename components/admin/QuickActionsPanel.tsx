// @ts-nocheck
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useAlert } from '@/components/shared/AlertProvider';
import { useObjectLabels } from '@/lib/useObjectLabels';
import { quickActionCatalog, resolveQuickActionKeys, DEFAULT_QUICK_ACTIONS, MAX_QUICK_ACTIONS } from '@/lib/quickActions';

/**
 * Admin Tools > Springboard Quick Actions.
 * Each tenant picks (and orders) the "Create ..." shortcuts shown on the Springboard. Saved per tenant in
 * app preferences, separately for B2B and B2C. Users still only see the shortcuts they are allowed to use.
 */
export default function QuickActionsPanel() {
  const { appPreferences, saveAppPreferences, customObjects } = useApp();
  const { showAlert } = useAlert();
  const { getObjectLabel } = useObjectLabels();
  const b2cMode = appPreferences?.b2c_mode === true;
  const modeKey = b2cMode ? 'b2c' : 'b2b';
  const catalog = useMemo(() => quickActionCatalog(b2cMode, customObjects), [b2cMode, customObjects]);
  const labelOf = (o) => o.custom ? o.fallback : getObjectLabel(o.page, o.fallback, 'singular');

  const savedKeys = useMemo(() => resolveQuickActionKeys(appPreferences, b2cMode, customObjects), [appPreferences, b2cMode, customObjects]);
  const [sel, setSel] = useState(savedKeys);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(sel) !== JSON.stringify(savedKeys);
  useEffect(() => { if (!dirty) setSel(savedKeys); }, [savedKeys.join('|')]);

  const toggle = (k) => setSel(cur => cur.includes(k) ? cur.filter(x => x !== k) : (cur.length >= MAX_QUICK_ACTIONS ? cur : [...cur, k]));
  const move = (i, d) => setSel(cur => { const a = [...cur]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });

  const save = async (keys) => {
    setSaving(true);
    const qa = { ...(appPreferences?.quick_actions || {}), [modeKey]: keys };
    const r = await saveAppPreferences({ ...appPreferences, quick_actions: qa });
    setSaving(false);
    if (r?.success !== false) showAlert('Quick actions saved.', { variant: 'success' });
  };
  const resetDefaults = () => { const d = DEFAULT_QUICK_ACTIONS[modeKey].filter(k => catalog.some(o => o.key === k)); setSel(d); };

  const byKey = Object.fromEntries(catalog.map(o => [o.key, o]));
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[28px] px-6 py-5">
        <h2 className="text-white text-xl font-bold">⚡ Springboard Quick Actions</h2>
        <p className="text-white/60 text-sm mt-1">Choose the “Create …” shortcuts your team sees on the Springboard ({b2cMode ? 'B2C' : 'B2B'} workspace). Up to {MAX_QUICK_ACTIONS}. People only see the ones their role allows them to create.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
          <h4 className="font-bold text-[#0F172A] text-sm mb-3">Available objects</h4>
          <div className="space-y-1.5">
            {catalog.map(o => {
              const on = sel.includes(o.key);
              const full = !on && sel.length >= MAX_QUICK_ACTIONS;
              return (
                <label key={o.key} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm cursor-pointer ${on ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'} ${full ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(o.key)} />
                  <span className="text-base">{o.icon}</span>
                  <span className="font-semibold text-[#0F172A]">{labelOf(o)}</span>
                  {o.custom && <span className="ml-auto text-[10px] font-bold uppercase text-gray-400">Custom</span>}
                </label>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
          <h4 className="font-bold text-[#0F172A] text-sm mb-3">Shown on the Springboard ({sel.length}/{MAX_QUICK_ACTIONS})</h4>
          {sel.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No quick actions selected — the section will be hidden.</p>
          ) : (
            <div className="space-y-1.5">
              {sel.map((k, i) => byKey[k] && (
                <div key={k} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 text-sm">
                  <span className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center text-gray-500">+</span>
                  <span className="font-semibold text-[#0F172A]">Create {labelOf(byKey[k])}</span>
                  <span className="ml-auto flex gap-1">
                    <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30">↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === sel.length - 1} aria-label="Move down" className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30">↓</button>
                    <button onClick={() => toggle(k)} aria-label="Remove" className="w-7 h-7 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">×</button>
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-5">
            <button onClick={() => save(sel)} disabled={saving || !dirty} className="px-5 py-2.5 rounded-xl bg-[#0F172A] text-white text-sm font-bold disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={resetDefaults} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">Reset to defaults</button>
          </div>
        </div>
      </div>
    </div>
  );
}
