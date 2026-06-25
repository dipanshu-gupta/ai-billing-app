// @ts-nocheck
'use client';
/**
 * App Composer
 * Enterprise field customisation for Retail B2C objects.
 * - Define up to 10 custom fields per retail object
 * - 10 field types: text, number, currency, date, datetime, checkbox,
 *   single_select, multi_select, url, email
 * - Save Draft → persists to app_custom_fields table
 * - Publish → sets is_published=true, fields appear in record detail layout
 * - Values stored in custom_data JSONB column on each retail table
 * - Zero impact on B2B flow — scoped to retail objects only
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { invalidateCustomFieldCache } from '@/lib/useCustomFields';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FIELDS = 10;

const RETAIL_OBJECTS = [
  { v: 'retailCustomers',  l: 'Retail Customers',  icon: '👤' },
  { v: 'retailProducts',   l: 'Retail Products',   icon: '📦' },
  { v: 'retailActivities', l: 'Retail Activities', icon: '📅' },
  { v: 'retailOrders',     l: 'Retail Orders',     icon: '🛒' },
  { v: 'retailInvoices',   l: 'Retail Invoices',   icon: '🧾' },
];

const FIELD_TYPES = [
  { v: 'text',          l: 'Text',          icon: '✏️',  desc: 'Free-form text' },
  { v: 'number',        l: 'Number',        icon: '🔢',  desc: 'Numeric value' },
  { v: 'currency',      l: 'Currency',      icon: '💰',  desc: 'Monetary amount' },
  { v: 'date',          l: 'Date',          icon: '📅',  desc: 'Date picker' },
  { v: 'datetime',      l: 'Date & Time',   icon: '🕐',  desc: 'Date and time' },
  { v: 'checkbox',      l: 'Checkbox',      icon: '☑️',  desc: 'Yes / No' },
  { v: 'single_select', l: 'Single Select', icon: '🔘',  desc: 'Pick one' },
  { v: 'multi_select',  l: 'Multi Select',  icon: '☑️',  desc: 'Pick many' },
  { v: 'url',           l: 'URL',           icon: '🔗',  desc: 'Web link' },
  { v: 'email',         l: 'Email',         icon: '📧',  desc: 'Email address' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400';
const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400';

function slugify(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 30);
}

function emptyField() {
  return {
    _key: `new_${Date.now()}_${Math.random()}`,
    id: null,
    label: '', api_name: '', field_type: 'text',
    options: [], required: false, is_active: true, is_published: false, sort_order: 0, show_on: 'both',
  };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AppComposer() {
  const [selectedObj,   setSelectedObj]   = useState('retailCustomers');
  const [fields,        setFields]        = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [publishing,    setPublishing]    = useState(false);
  const [toast,         setToast]         = useState('');
  const [optInput,      setOptInput]      = useState({});
  const [tableExists,   setTableExists]   = useState(null); // null=checking

  useEffect(() => { load(); }, [selectedObj]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  // ── Load ──────────────────────────────────────────────────────────────────
  async function load() {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_custom_fields')
        .select('*')
        .eq('object_type', selectedObj)
        .order('sort_order');
      if (error?.code === '42P01') { setTableExists(false); setLoading(false); return; }
      setTableExists(true);
      setFields((data || []).map(f => ({ ...f, _key: f.id, options: f.options || [], is_active: f.is_active !== false, show_on: f.show_on || 'both' })));
    } catch (e) {
      setTableExists(false);
    }
    setLoading(false);
  }

  // ── Field mutations ───────────────────────────────────────────────────────
  function upd(idx, k, v) {
    setFields(p => p.map((f, i) => i === idx ? { ...f, [k]: v } : f));
  }

  function addOpt(idx) {
    const v = (optInput[idx] || '').trim();
    if (!v) return;
    upd(idx, 'options', [...(fields[idx].options || []), v]);
    setOptInput(p => ({ ...p, [idx]: '' }));
  }

  function removeOpt(idx, oi) {
    upd(idx, 'options', fields[idx].options.filter((_, i) => i !== oi));
  }

  function addField() {
    if (fields.length >= MAX_FIELDS) {
      alert(`Maximum ${MAX_FIELDS} custom fields per object.`);
      return;
    }
    setFields(p => [...p, emptyField()]);
  }

  function removeField(idx) {
    setFields(p => p.filter((_, i) => i !== idx));
  }

  function move(idx, dir) {
    setFields(p => {
      const arr = [...p];
      const to = idx + dir;
      if (to < 0 || to >= arr.length) return p;
      [arr[idx], arr[to]] = [arr[to], arr[idx]];
      return arr;
    });
  }

  // ── Save draft ────────────────────────────────────────────────────────────
  async function saveDraft() {
    if (!supabase || !tableExists) return;
    const invalid = fields.filter(f => !f.label?.trim());
    if (invalid.length) { alert('All fields must have a label.'); return; }
    // Check for duplicate api_names
    const apiNames = fields.map(f => f.api_name || slugify(f.label));
    const dupes = apiNames.filter((n, i) => apiNames.indexOf(n) !== i);
    if (dupes.length) { alert(`Duplicate field names: ${dupes.join(', ')}. Each field must have a unique name.`); return; }

    setSaving(true);

    // Delete rows that were removed (only rows with IDs not in current list)
    const existingIds = fields.filter(f => f.id).map(f => f.id);
    if (existingIds.length) {
      // Delete DB rows that are no longer in the editor
      const { data: allRows } = await supabase.from('app_custom_fields')
        .select('id').eq('object_type', selectedObj);
      const toDelete = (allRows||[]).map(r=>r.id).filter(id => !existingIds.includes(id));
      if (toDelete.length) {
        await supabase.from('app_custom_fields').delete().in('id', toDelete);
      }
    }
    // If no existing IDs at all, don't delete anything (user is creating first field)

    // Upsert each field — NEVER reset is_published (preserve published state)
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      const row = {
        object_type:  selectedObj,
        label:        f.label.trim(),
        api_name:     f.api_name || slugify(f.label),
        field_type:   f.field_type,
        options:      f.options || [],
        required:     f.required || false,
        show_on:      f.show_on || 'both',
        is_active:    f.is_active === false ? false : true,  // default true
        // CRITICAL: preserve is_published — do NOT reset it to false on save
        sort_order:   i,
        updated_at:   new Date().toISOString(),
      };
      if (f.id) {
        // Update but never touch is_published — that's only changed via publish/unpublish
        await supabase.from('app_custom_fields').update(row).eq('id', f.id);
      } else {
        // New field — starts unpublished
        const { data } = await supabase.from('app_custom_fields')
          .insert({ ...row, is_published: false, created_at: new Date().toISOString() })
          .select().single();
        if (data) setFields(p => p.map((ff, fi) => fi === i ? { ...ff, id: data.id, _key: data.id } : ff));
      }
    }

    setSaving(false);
    showToast('✓ Draft saved');
    await load();
  }

  // ── Publish ───────────────────────────────────────────────────────────────
  async function publishToMainline() {
    if (!supabase || !tableExists) return;
    setPublishing(true);
    await supabase.from('app_custom_fields')
      .update({ is_published: true, updated_at: new Date().toISOString() })
      .eq('object_type', selectedObj)
      .eq('is_active', true);
    setPublishing(false);
    // Bust the cache so RetailDetailPanel picks up new fields immediately
    invalidateCustomFieldCache(selectedObj);
    showToast('🚀 Published to mainline — fields now visible in record detail pages');
    await load();
  }

  async function unpublishField(fieldId) {
    await supabase.from('app_custom_fields')
      .update({ is_published: false, updated_at: new Date().toISOString() })
      .eq('id', fieldId);
    await load();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const objMeta   = RETAIL_OBJECTS.find(o => o.v === selectedObj);
  const pubCount  = fields.filter(f => f.is_published && f.is_active).length;
  const draftCount = fields.filter(f => !f.is_published && f.is_active).length;

  // Table not set up yet
  if (tableExists === false) return (
    <div className="space-y-5">
      <div className="bg-amber-50 border-2 border-amber-300 rounded-[24px] p-6">
        <div className="text-4xl mb-3">⚠️</div>
        <h3 className="font-bold text-amber-900 text-lg mb-2">Database Setup Required</h3>
        <p className="text-amber-800 text-sm mb-4">Run <strong>schema_app_composer.sql</strong> in your Supabase SQL Editor to enable App Composer.</p>
        <button onClick={load} className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm">
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[9999] bg-[#0F172A] text-white px-5 py-3 rounded-2xl shadow-2xl font-semibold text-sm animate-bounce">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F172A] to-indigo-900 rounded-[24px] p-6 text-white">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">🎛️ App Composer</h2>
            <p className="text-blue-200 text-sm mt-1">
              Define up to {MAX_FIELDS} custom fields per Retail object. Publish to make them appear in record detail pages.
              Values are stored in <code className="bg-white/10 px-1 rounded">custom_data</code> JSON on each record.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={saveDraft} disabled={saving || tableExists === null}
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all">
              {saving ? 'Saving…' : '💾 Save Draft'}
            </button>
            <button onClick={publishToMainline} disabled={publishing || tableExists === null || fields.length === 0}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 shadow-lg transition-all">
              {publishing ? 'Publishing…' : '🚀 Publish to Mainline'}
            </button>
          </div>
        </div>
      </div>

      {/* Object selector */}
      <div className="bg-white rounded-[20px] border border-blue-100 shadow-sm p-5">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3">
          Select Retail Object
        </label>
        <div className="flex flex-wrap gap-2">
          {RETAIL_OBJECTS.map(o => (
            <button key={o.v} onClick={() => setSelectedObj(o.v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                selectedObj === o.v
                  ? 'bg-[#0F172A] text-white border-transparent shadow'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
              }`}>
              <span>{o.icon}</span>{o.l}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs">
          <span className="text-gray-400">{fields.length}/{MAX_FIELDS} fields defined</span>
          {pubCount > 0 && <span className="text-green-600 font-semibold">✓ {pubCount} published to layout</span>}
          {draftCount > 0 && <span className="text-amber-600 font-semibold">⏳ {draftCount} unpublished</span>}
        </div>
      </div>

      {/* Field list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/>
        </div>
      ) : fields.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-blue-200 rounded-[24px] bg-blue-50/30">
          <div className="text-5xl mb-4">🎛️</div>
          <h4 className="font-bold text-[#0F172A] text-lg mb-2">No custom fields yet</h4>
          <p className="text-sm text-gray-400 mb-6">
            Add up to {MAX_FIELDS} fields for {objMeta?.l}. They appear in record detail pages after publishing.
          </p>
          <button onClick={addField}
            className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow hover:opacity-90">
            + Add First Field
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((f, idx) => (
            <div key={f._key || idx}
              className={`bg-white rounded-[20px] border shadow-sm transition-all ${
                f.is_active ? 'border-blue-100' : 'border-gray-100 opacity-55'
              }`}>
              <div className="p-5 space-y-4">

                {/* Row header */}
                <div className="flex items-center gap-3">
                  {/* Reorder */}
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                    <button onClick={() => move(idx, -1)} disabled={idx === 0}
                      className="w-5 h-5 text-gray-300 hover:text-gray-600 disabled:opacity-0 text-xs leading-none">▲</button>
                    <span className="text-[11px] font-mono text-gray-400">{idx + 1}</span>
                    <button onClick={() => move(idx, 1)} disabled={idx === fields.length - 1}
                      className="w-5 h-5 text-gray-300 hover:text-gray-600 disabled:opacity-0 text-xs leading-none">▼</button>
                  </div>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[#0F172A] text-sm truncate">
                      {f.label || <span className="text-gray-400 font-normal italic">Untitled field</span>}
                    </div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">
                      {f.api_name || (f.label ? slugify(f.label) : '—')} · {FIELD_TYPES.find(t => t.v === f.field_type)?.l || f.field_type}
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {f.is_published && f.is_active && (
                      <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">LIVE</span>
                    )}
                    {!f.is_published && f.is_active && f.id && (
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">DRAFT</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {f.is_published && f.id && (
                      <button onClick={() => unpublishField(f.id)}
                        className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-2.5 py-1 rounded-lg font-semibold transition-all">
                        Unpublish
                      </button>
                    )}
{/* Active state is managed automatically — new fields default to active */}
                    <button onClick={() => removeField(idx)}
                      title="Remove field"
                      className="w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-xs font-bold flex items-center justify-center transition-all">
                      ✕
                    </button>
                  </div>
                </div>

                {/* Field properties */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">
                      Field Label *
                    </label>
                    <input
                      value={f.label}
                      onChange={e => {
                        const val = e.target.value;
                        upd(idx, 'label', val);
                        // Auto-fill api_name only if not manually set
                        if (!f.id) upd(idx, 'api_name', slugify(val));
                      }}
                      placeholder="e.g. Loyalty Tier, Warranty Type"
                      className={iCls}/>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">
                      API Name <span className="text-gray-300 font-normal">(auto)</span>
                    </label>
                    <input
                      value={f.api_name || slugify(f.label)}
                      onChange={e => upd(idx, 'api_name', slugify(e.target.value))}
                      placeholder="auto_generated"
                      className={`${iCls} font-mono text-xs text-gray-500`}/>
                  </div>
                </div>

                {/* Field type */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">Answer Type</label>
                  <div className="grid grid-cols-5 gap-2">
                    {FIELD_TYPES.map(ft => (
                      <button key={ft.v} onClick={() => upd(idx, 'field_type', ft.v)} title={ft.desc}
                        className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${
                          f.field_type === ft.v
                            ? 'bg-[#0F172A] text-white border-transparent shadow'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}>
                        <span className="text-base">{ft.icon}</span>
                        <span className="leading-tight text-center">{ft.l}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Options for select types */}
                {(f.field_type === 'single_select' || f.field_type === 'multi_select') && (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
                      List of Values
                    </label>
                    {(f.options || []).length === 0 && (
                      <p className="text-xs text-amber-600 mb-2">⚠ Add at least one option.</p>
                    )}
                    <div className="space-y-1.5 mb-2">
                      {(f.options || []).map((o, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold flex-shrink-0">{oi + 1}</span>
                          <span className="flex-1 text-sm text-[#0F172A] bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">{o}</span>
                          <button onClick={() => removeOpt(idx, oi)} className="text-red-400 hover:text-red-600 w-5 text-xs font-bold">✕</button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={optInput[idx] || ''}
                        onChange={e => setOptInput(p => ({ ...p, [idx]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOpt(idx); } }}
                        placeholder="Type value, press Enter or +"
                        className={iCls}/>
                      <button onClick={() => addOpt(idx)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl font-bold text-sm flex-shrink-0">+</button>
                    </div>
                  </div>
                )}

                {/* Show on */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1.5">Show On</label>
                  <div className="flex gap-2 flex-wrap">
                    {[{v:'both',l:'Details & Create'},{v:'details',l:'Details only'},{v:'create',l:'Create only'},{v:'none',l:'Hidden'}].map(opt=>(
                      <button key={opt.v} onClick={()=>upd(idx,'show_on',opt.v)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${(f.show_on||'both')===opt.v?'bg-[#0F172A] text-white border-transparent':'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Required */}
                <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                  <input type="checkbox" checked={f.required || false}
                    onChange={e => upd(idx, 'required', e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded"/>
                  <span className="text-xs text-gray-500">Required field</span>
                </label>
              </div>
            </div>
          ))}

          {/* Add more */}
          {fields.length < MAX_FIELDS && (
            <button onClick={addField}
              className="w-full py-3.5 border-2 border-dashed border-blue-200 rounded-2xl text-sm font-semibold text-blue-500 hover:border-blue-400 hover:bg-blue-50 transition-all">
              + Add Field ({fields.length}/{MAX_FIELDS})
            </button>
          )}
        </div>
      )}

      {/* Published layout preview */}
      {pubCount > 0 && (
        <div className="bg-white rounded-[20px] border border-green-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-r from-green-50 to-white border-b border-green-100 flex items-center gap-2">
            <span className="text-lg">📐</span>
            <span className="font-bold text-[#0F172A] text-sm">Live Layout — {objMeta?.l}</span>
            <span className="ml-auto text-xs text-green-600 font-semibold">Visible in record detail pages</span>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {fields.filter(f => f.is_published && f.is_active).map((f, i) => (
              <div key={i} className="bg-green-50 border border-green-100 rounded-xl p-3">
                <div className="text-xs font-bold text-[#0F172A] mb-0.5">{f.label}</div>
                <div className="text-[10px] text-gray-400 font-mono">{f.api_name}</div>
                <div className="text-[10px] text-blue-600 mt-1 font-semibold">
                  {FIELD_TYPES.find(t => t.v === f.field_type)?.icon} {FIELD_TYPES.find(t => t.v === f.field_type)?.l}
                </div>
                {(f.options || []).length > 0 && (
                  <div className="text-[10px] text-gray-400 mt-1 truncate">{f.options.join(' · ')}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
