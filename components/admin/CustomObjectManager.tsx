// @ts-nocheck
'use client';
/**
 * Custom Object Manager — enterprise "create your own object" admin tool
 * (Oracle Fusion Application Composer-style), available to both B2B and B2C.
 *
 * Defines:
 *  - the object itself (name, icon, module placement, line-items toggle)
 *  - its fields, both header and (if enabled) line-item scope, including a
 *    Lookup type pointing at a standard object or another custom object
 *  - Publish, which auto-registers custom_<api_name>_view/create/edit/
 *    delete/export into the existing `permissions` table so the object
 *    immediately appears in Security Console/Roles like any other module,
 *    and makes it appear in Page Layout Designer, the Sidebar nav, and
 *    DynamicObjectPage routing.
 *
 * All actual storage-slot bookkeeping lives in lib/customObjects.ts — this
 * component only works with named fields and calls that engine.
 */
import { useState, useEffect, useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useApp } from '@/context/AppContext';
import { useAlert } from '@/components/shared/AlertProvider';
import { CUSTOM_SYSTEM_KEYS } from '@/lib/customObjects';
import { AVAILABLE_LINE_ICONS, ObjectIcon } from '@/lib/lineIcons';
import {
  fetchAllCustomObjects, fetchCustomObjectFields, allocateStorageSlot,
  publishCustomObject, unpublishCustomObject, invalidateCustomObjectCache,
  CUSTOM_FIELD_TYPES, LOOKUP_STANDARD_OBJECTS,
} from '@/lib/customObjects';

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400';
const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400';

function slugify(s) {
  return (s || '').toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 24);
}

function emptyObject() {
  return {
    id: null, api_name: '', singular_label: '', plural_label: '', icon: 'Package',
    module: 'both', supports_line_items: false,
    line_item_singular_label: 'Line Item', line_item_plural_label: 'Line Items',
    description: '', status: 'draft', is_active: true,
  };
}

function emptyField(scope) {
  return {
    _key: `new_${Date.now()}_${Math.random()}`, id: null, scope,
    label: '', api_name: '', field_type: 'text', options: [],
    lookup_target_type: '', lookup_target_object: '',
    required: false, is_active: true, is_standard: false, default_value: '', show_on: 'both',
  };
}

export default function CustomObjectManager() {
  const { supabase, tenant } = useTenant();
  const { currentUser, customObjects: publishedCustomObjects } = useApp();
  const { showAlert, showConfirm } = useAlert();

  const [objects, setObjects]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft]       = useState(emptyObject());
  const [headerFields, setHeaderFields] = useState([]);
  const [lineFields, setLineFields]     = useState([]);
  const [fieldScope, setFieldScope]     = useState('header'); // which tab of fields is showing
  const [optInput, setOptInput] = useState({});
  const [saving, setSaving]     = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState('');

  const ctx = useMemo(() => ({ supabase, tenantId: tenant?.id, currentUser, showAlert }), [supabase, tenant?.id, currentUser]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  useEffect(() => { loadObjects(); }, []);
  useEffect(() => { if (selectedId) loadObjectDetail(selectedId); else { setDraft(emptyObject()); setHeaderFields([]); setLineFields([]); } }, [selectedId]);

  async function loadObjects() {
    setLoading(true);
    const list = await fetchAllCustomObjects();
    setObjects(list);
    setLoading(false);
  }

  async function loadObjectDetail(id) {
    const obj = objects.find(o => o.id === id);
    if (!obj) return;
    setDraft({ ...obj });
    const [hf, lf] = await Promise.all([
      fetchCustomObjectFields(id, 'header', true),
      obj.supports_line_items ? fetchCustomObjectFields(id, 'line_item', true) : Promise.resolve([]),
    ]);
    setHeaderFields(hf.map(f => ({ ...f, _key: f.id, options: f.options || [] })));
    setLineFields(lf.map(f => ({ ...f, _key: f.id, options: f.options || [] })));
    setFieldScope('header');
  }

  function startNew() {
    setSelectedId(null);
    setDraft(emptyObject());
    setHeaderFields([]);
    setLineFields([]);
  }

  // ─── Object-level save ────────────────────────────────────────────────────
  async function saveObject() {
    if (!draft.singular_label.trim()) { showAlert('Object name is required.', { variant:'warning' }); return; }
    const apiName = draft.api_name || slugify(draft.singular_label);
    if (!apiName) { showAlert('Could not derive an API name from that label — try a simpler name.', { variant:'warning' }); return; }
    setSaving(true);
    try {
      const payload = {
        api_name: apiName,
        singular_label: draft.singular_label.trim(),
        plural_label: (draft.plural_label || draft.singular_label + 's').trim(),
        icon: draft.icon || 'Package',
        module: draft.module,
        supports_line_items: !!draft.supports_line_items,
        line_item_singular_label: draft.line_item_singular_label || 'Line Item',
        line_item_plural_label: draft.line_item_plural_label || 'Line Items',
        description: draft.description || '',
        is_active: draft.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (draft.id) {
        const { error } = await supabase.from('custom_objects').update(payload).eq('id', draft.id);
        if (error) { showAlert('Save failed: ' + error.message); return; }
      } else {
        const { data, error } = await supabase.from('custom_objects').insert([{ ...payload, status: 'draft', created_by: currentUser?.email }]).select().single();
        if (error) { showAlert('Save failed: ' + error.message); return; }
        setDraft(d => ({ ...d, id: data.id, api_name: data.api_name, status: data.status }));
        setSelectedId(data.id);
      }
      invalidateCustomObjectCache();
      await loadObjects();
      showToast('Object saved.');
    } finally { setSaving(false); }
  }

  // ─── Field mutations (local state, saved via Save Fields) ────────────────
  const activeFields = fieldScope === 'header' ? headerFields : lineFields;
  const setActiveFields = fieldScope === 'header' ? setHeaderFields : setLineFields;

  function addField() {
    const f = emptyField(fieldScope);
    setActiveFields(p => [...p, f]);
  }
  function updField(idx, k, v) {
    setActiveFields(p => p.map((f, i) => i === idx ? { ...f, [k]: v } : f));
  }
  function removeField(idx) {
    setActiveFields(p => p.filter((_, i) => i !== idx));
  }
  function addOpt(idx) {
    const v = (optInput[idx] || '').trim();
    if (!v) return;
    updField(idx, 'options', [...(activeFields[idx].options || []), v]);
    setOptInput(p => ({ ...p, [idx]: '' }));
  }
  function removeOpt(idx, oi) {
    updField(idx, 'options', activeFields[idx].options.filter((_, i) => i !== oi));
  }

  async function saveFields() {
    if (!draft.id) { showAlert('Save the object itself first.', { variant:'warning' }); return; }
    for (const f of activeFields) {
      if (!f.label.trim()) { showAlert('Every field needs a label.', { variant:'warning' }); return; }
      if (f.field_type === 'lookup' && (!f.lookup_target_type || !f.lookup_target_object)) {
        showAlert(`"${f.label}" is a Lookup field but has no target object selected.`, { variant:'warning' }); return;
      }
    }
    setSaving(true);
    try {
      // Allocate storage slots for any field that doesn't have one yet,
      // against the full existing field set for this object+scope (not just
      // the fields currently on screen) so re-saving never collides.
      const existingSaved = activeFields.filter(f => f.id);
      const withSlots = [];
      for (const f of activeFields) {
        let apiName = f.api_name || slugify(f.label);
        // These names belong to the standard system fields every custom
        // object already has (name, status, owner, created_at, ...). A new
        // field keeps its label but gets a distinct api_name so it can never
        // shadow or collide with a system field.
        if (!f.id && CUSTOM_SYSTEM_KEYS.has(apiName)) apiName = `${apiName}_custom`;
        let storageColumn = f.storage_column;
        if (!storageColumn) {
          storageColumn = allocateStorageSlot([...existingSaved, ...withSlots], f.field_type, fieldScope);
          if (!storageColumn) {
            showAlert(`No free storage slots left for "${f.field_type}" fields on this object — remove an unused field of that type first.`, { variant:'danger' });
            setSaving(false);
            return;
          }
        }
        withSlots.push({ ...f, api_name: apiName, storage_column: storageColumn });
      }
      // Upsert one at a time — small field counts per object make this fine,
      // and it keeps per-row errors (e.g. a duplicate api_name) attributable.
      for (const f of withSlots) {
        const row = {
          tenant_id: tenant?.id || null,
          custom_object_id: draft.id,
          scope: fieldScope,
          api_name: f.api_name,
          label: f.label.trim(),
          field_type: f.field_type,
          options: f.options || [],
          lookup_target_type: f.field_type === 'lookup' ? f.lookup_target_type : null,
          lookup_target_object: f.field_type === 'lookup' ? f.lookup_target_object : null,
          storage_column: f.storage_column,
          is_standard: !!f.is_standard,
          required: !!f.required,
          is_active: f.is_active !== false,
          default_value: f.default_value || null,
          show_on: f.show_on || 'both',
          sort_order: withSlots.indexOf(f),
        };
        if (f.id) {
          await supabase.from('custom_object_fields').update(row).eq('id', f.id);
        } else {
          await supabase.from('custom_object_fields').insert([row]);
        }
      }
      invalidateCustomObjectCache(draft.id);
      await loadObjectDetail(draft.id);
      showToast('Fields saved.');
    } finally { setSaving(false); }
  }

  // ─── Publish / unpublish ──────────────────────────────────────────────────
  async function handlePublish() {
    if (!draft.id) return;
    if (!headerFields.length) { showAlert('Add at least one field before publishing.', { variant:'warning' }); return; }
    const ok = await showConfirm(
      `Publishing "${draft.plural_label}" registers custom_${draft.api_name}_view/create/edit/delete/export permissions and adds it to the navigation for everyone with access. Continue?`,
      { title: 'Publish Object', confirmLabel: 'Publish' }
    );
    if (!ok) return;
    setPublishing(true);
    const success = await publishCustomObject(ctx, draft);
    setPublishing(false);
    if (success) { setDraft(d => ({ ...d, status: 'published' })); await loadObjects(); showToast('Published — now live in navigation.'); }
  }

  async function handleUnpublish() {
    const ok = await showConfirm('Unpublishing hides this object from navigation for non-admins. Existing records and permissions are kept. Continue?', { variant: 'warning', confirmLabel: 'Unpublish' });
    if (!ok) return;
    const success = await unpublishCustomObject(ctx, draft);
    if (success) { setDraft(d => ({ ...d, status: 'draft' })); await loadObjects(); showToast('Unpublished.'); }
  }

  const standardObjectOptions = Object.entries(LOOKUP_STANDARD_OBJECTS).map(([v, o]) => ({ v, l: o.label }));
  const customObjectOptions = objects.filter(o => o.status === 'published' && o.id !== draft.id).map(o => ({ v: o.api_name, l: o.plural_label }));

  return (
    <div className="flex gap-5">
      {/* ── Left: object list ── */}
      <div className="w-64 flex-shrink-0 space-y-2">
        <button onClick={startNew} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3 py-2.5 text-sm font-semibold">+ New Custom Object</button>
        {loading ? <div className="text-xs text-gray-400 px-2">Loading…</div> : objects.map(o => (
          <button key={o.id} onClick={() => setSelectedId(o.id)}
            className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors ${selectedId === o.id ? 'bg-blue-50 border-blue-400' : 'bg-white border-blue-100 hover:border-blue-300'}`}>
            <div className="flex items-center gap-2">
              <span className="text-blue-700"><ObjectIcon icon={o.icon} className="w-4 h-4"/></span>
              <span className="text-sm font-semibold text-[#0F172A] truncate flex-1">{o.plural_label}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${o.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{o.status}</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">{o.module === 'both' ? 'B2B + B2C' : o.module.toUpperCase()}{o.supports_line_items ? ' · line items' : ''}</div>
          </button>
        ))}
        {!loading && !objects.length && <div className="text-xs text-gray-400 px-2">No custom objects yet.</div>}
      </div>

      {/* ── Right: detail ── */}
      <div className="flex-1 space-y-5">
        {toast && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-3 py-2">{toast}</div>}

        <div className="bg-white border border-blue-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0F172A]">Object Definition</h3>
            {draft.id && (
              draft.status === 'published'
                ? <button onClick={handleUnpublish} className="text-xs font-semibold text-amber-600 hover:text-amber-700">Unpublish</button>
                : <button onClick={handlePublish} disabled={publishing} className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{publishing ? 'Publishing…' : 'Publish'}</button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500">Singular Label</label>
              <input className={iCls} value={draft.singular_label} placeholder="Equipment Item"
                onChange={e => setDraft(d => ({ ...d, singular_label: e.target.value, api_name: d.id ? d.api_name : slugify(e.target.value) }))}/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Plural Label</label>
              <input className={iCls} value={draft.plural_label} placeholder="Equipment Items" onChange={e => setDraft(d => ({ ...d, plural_label: e.target.value }))}/>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500">Icon</label>
              <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-xl border border-blue-100 bg-blue-50/40">
                <span className="w-9 h-9 rounded-lg bg-[#0F172A] text-white flex items-center justify-center"><ObjectIcon icon={draft.icon} className="w-5 h-5"/></span>
                <span className="text-xs text-gray-500">Shown in the navigator, springboard and page headers</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Module</label>
              <select className={sCls} value={draft.module} onChange={e => setDraft(d => ({ ...d, module: e.target.value }))}>
                <option value="both">B2B + B2C</option>
                <option value="b2b">B2B only</option>
                <option value="b2c">B2C only</option>
              </select>
            </div>
            <div className="flex items-end pb-2.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={!!draft.supports_line_items}
                  onChange={e => setDraft(d => ({ ...d, supports_line_items: e.target.checked }))}/>
                Supports line items
              </label>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500">Choose an icon ({AVAILABLE_LINE_ICONS.length} available)</label>
            <div className="mt-1 grid grid-cols-8 sm:grid-cols-10 gap-1.5 max-h-44 overflow-y-auto p-2 rounded-xl border border-blue-100 bg-white">
              {AVAILABLE_LINE_ICONS.map(name => (
                <button key={name} type="button" title={name} onClick={() => setDraft(d => ({ ...d, icon: name }))}
                  className={`h-10 rounded-lg flex items-center justify-center border transition-colors ${draft.icon === name ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'text-gray-600 border-transparent hover:bg-blue-50 hover:border-blue-200'}`}>
                  <ObjectIcon icon={name} className="w-5 h-5"/>
                </button>
              ))}
            </div>
          </div>

          {draft.supports_line_items && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500">Line Item Singular Label</label>
                <input className={iCls} value={draft.line_item_singular_label} onChange={e => setDraft(d => ({ ...d, line_item_singular_label: e.target.value }))}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Line Item Plural Label</label>
                <input className={iCls} value={draft.line_item_plural_label} onChange={e => setDraft(d => ({ ...d, line_item_plural_label: e.target.value }))}/>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500">Description</label>
            <textarea className={iCls} rows={2} value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}/>
          </div>

          {draft.api_name && (
            <div className="text-[11px] text-gray-400">API name: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{draft.api_name}</code> — permissions will register as <code className="bg-gray-100 px-1.5 py-0.5 rounded">custom_{draft.api_name}_*</code></div>
          )}

          <button onClick={saveObject} disabled={saving} className="bg-[#0F172A] hover:bg-black text-white rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? 'Saving…' : draft.id ? 'Save Object' : 'Create Object'}
          </button>
        </div>

        {draft.id && (
          <div className="bg-white border border-blue-100 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button onClick={() => setFieldScope('header')} className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${fieldScope === 'header' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>Fields</button>
                {draft.supports_line_items && (
                  <button onClick={() => setFieldScope('line_item')} className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${fieldScope === 'line_item' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>Line Item Fields</button>
                )}
              </div>
              <button onClick={addField} className="text-xs font-semibold text-blue-600 hover:text-blue-700">+ Add Field</button>
            </div>

            <div className="space-y-3">
              {activeFields.map((f, idx) => (
                <div key={f._key} className="border border-blue-100 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-start">
                    <input className={`${sCls} col-span-4`} placeholder="Label" value={f.label} onChange={e => updField(idx, 'label', e.target.value)}/>
                    <select className={`${sCls} col-span-3`} value={f.field_type} onChange={e => updField(idx, 'field_type', e.target.value)} disabled={!!f.id}>
                      {CUSTOM_FIELD_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                    <label className="col-span-2 flex items-center gap-1.5 text-xs text-gray-600 pt-2.5">
                      <input type="checkbox" className="w-3.5 h-3.5 accent-blue-600" checked={!!f.required} onChange={e => updField(idx, 'required', e.target.checked)}/>Required
                    </label>
                    <label className="col-span-2 flex items-center gap-1.5 text-xs text-gray-600 pt-2.5">
                      <input type="checkbox" className="w-3.5 h-3.5 accent-blue-600" checked={f.is_active !== false} onChange={e => updField(idx, 'is_active', e.target.checked)}/>Active
                    </label>
                    <button onClick={() => removeField(idx)} className="col-span-1 text-red-500 hover:text-red-700 text-xs pt-2.5">✕</button>
                  </div>

                  {f.field_type === 'lookup' && (
                    <div className="grid grid-cols-2 gap-2 pl-1">
                      <select className={sCls} value={f.lookup_target_type} onChange={e => updField(idx, 'lookup_target_type', e.target.value)}>
                        <option value="">Target type…</option>
                        <option value="standard">Standard Object</option>
                        <option value="custom">Custom Object</option>
                      </select>
                      <select className={sCls} value={f.lookup_target_object} onChange={e => updField(idx, 'lookup_target_object', e.target.value)}>
                        <option value="">Target object…</option>
                        {(f.lookup_target_type === 'custom' ? customObjectOptions : standardObjectOptions).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    </div>
                  )}

                  {(f.field_type === 'single_select' || f.field_type === 'multi_select') && (
                    <div className="pl-1 space-y-1.5">
                      <div className="flex gap-2">
                        <input className={sCls} placeholder="Add option…" value={optInput[idx] || ''} onChange={e => setOptInput(p => ({ ...p, [idx]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOpt(idx))}/>
                        <button onClick={() => addOpt(idx)} className="text-xs font-semibold text-blue-600 px-3 whitespace-nowrap">Add</button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(f.options || []).map((o, oi) => (
                          <span key={oi} className="bg-blue-50 text-blue-700 text-xs rounded-full px-2.5 py-1 flex items-center gap-1.5">{o}<button onClick={() => removeOpt(idx, oi)} className="text-blue-400 hover:text-blue-700">✕</button></span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {!activeFields.length && <div className="text-xs text-gray-400">No fields yet — click "+ Add Field".</div>}
            </div>

            <button onClick={saveFields} disabled={saving} className="bg-[#0F172A] hover:bg-black text-white rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Fields'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
