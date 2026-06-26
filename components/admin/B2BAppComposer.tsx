// @ts-nocheck
'use client';
/**
 * B2B App Composer
 * Custom field builder for B2B CRM objects — mirrors B2C AppComposer
 * but scoped to: leads, opportunities, customers, contacts, orders,
 * invoices, quotations, activities, products
 * Values stored in custom_data JSONB on each B2B table.
 */
import { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { invalidateCustomFieldCache } from '@/lib/useCustomFields';

const MAX_FIELDS = 10;

const B2B_OBJECTS = [
  { v: 'leads',          l: 'Leads',           icon: '🎯' },
  { v: 'opportunities',  l: 'Opportunities',   icon: '💼' },
  { v: 'customers',      l: 'Customers',       icon: '🏢' },
  { v: 'contacts',       l: 'Contacts',        icon: '👤' },
  { v: 'orders',         l: 'Orders',          icon: '🛒' },
  { v: 'invoices',       l: 'Invoices',        icon: '🧾' },
  { v: 'quotations',     l: 'Quotations',      icon: '📋' },
  { v: 'activities',     l: 'Activities',      icon: '📅' },
  { v: 'products',       l: 'Products',        icon: '📦' },
];

const FIELD_TYPES = [
  { v: 'text',          l: 'Text',          icon: '✏️',  desc: 'Free-form text' },
  { v: 'number',        l: 'Number',        icon: '🔢',  desc: 'Numeric value' },
  { v: 'currency',      l: 'Currency',      icon: '💰',  desc: 'Monetary amount' },
  { v: 'date',          l: 'Date',          icon: '📅',  desc: 'Date picker' },
  { v: 'datetime',      l: 'Date & Time',   icon: '🕐',  desc: 'Date and time' },
  { v: 'checkbox',      l: 'Checkbox',      icon: '☑️',  desc: 'Yes / No toggle' },
  { v: 'single_select', l: 'Single Select', icon: '🔘',  desc: 'Pick one option' },
  { v: 'multi_select',  l: 'Multi Select',  icon: '☑️',  desc: 'Pick many options' },
  { v: 'url',           l: 'URL',           icon: '🔗',  desc: 'Web link' },
  { v: 'email',         l: 'Email',         icon: '📧',  desc: 'Email address' },
];

const SHOW_ON_OPTS = [
  { v: 'both',   l: 'Details & Create' },
  { v: 'detail', l: 'Details only' },
  { v: 'create', l: 'Create only' },
  { v: 'hidden', l: 'Hidden' },
];

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400';
const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400';

function slugify(s) {
  return (s||'').toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,30);
}
function emptyField() {
  return { _key:`new_${Date.now()}`, id:null, label:'', api_name:'', field_type:'text', options:[], required:false, is_active:true, is_published:false, sort_order:0, show_on:'both' };
}

export default function B2BAppComposer() {
  const { supabase } = useTenant();
  const [selectedObj, setSelectedObj]   = useState('leads');
  const [fields,      setFields]        = useState([]);
  const [loading,     setLoading]       = useState(false);
  const [saving,      setSaving]        = useState(false);
  const [toast,       setToast]         = useState('');
  const [optionInput, setOptionInput]   = useState({});

  const showToast = (m, err=false) => { setToast({m,err}); setTimeout(()=>setToast(''),3000); };
  const selObj = B2B_OBJECTS.find(o=>o.v===selectedObj);

  useEffect(()=>{ loadFields(); },[selectedObj]);

  async function loadFields() {
    if(!supabase) return;
    setLoading(true);
    const {data} = await supabase.from('app_custom_fields')
      .select('*').eq('object_type',selectedObj).order('sort_order');
    setFields((data||[]).map(f=>({...f,_key:f.id,options:f.options||[]})));
    setLoading(false);
  }

  function addField() {
    if(fields.length>=MAX_FIELDS){showToast(`Max ${MAX_FIELDS} fields per object`,'err');return;}
    setFields(p=>[...p,{...emptyField(),sort_order:p.length}]);
  }

  function updField(key,k,v) {
    setFields(p=>p.map(f=>f._key===key?{...f,[k]:v,...(k==='label'&&!f.id?{api_name:slugify(v)}:{})}:f));
  }

  function removeField(key) {
    setFields(p=>p.filter(f=>f._key!==key));
  }

  function addOption(key) {
    const val=(optionInput[key]||'').trim();
    if(!val)return;
    updField(key,'options',[...(fields.find(f=>f._key===key)?.options||[]),val]);
    setOptionInput(p=>({...p,[key]:''}));
  }

  function removeOption(key,opt) {
    updField(key,'options',(fields.find(f=>f._key===key)?.options||[]).filter(o=>o!==opt));
  }

  async function save(publish=false) {
    if(!supabase){showToast('No database connection','err');return;}
    setSaving(true);
    try {
      for(let i=0;i<fields.length;i++){
        const f=fields[i];
        if(!f.label.trim()){showToast('All fields need a label','err');setSaving(false);return;}
        const payload={
          object_type:selectedObj, label:f.label.trim(), api_name:f.api_name||slugify(f.label),
          field_type:f.field_type, options:f.options||[], required:!!f.required,
          is_active:true, is_published:publish?true:f.is_published,
          sort_order:i, show_on:f.show_on||'both',
        };
        if(f.id){
          await supabase.from('app_custom_fields').update(payload).eq('id',f.id);
        } else {
          const {data:nd} = await supabase.from('app_custom_fields').insert(payload).select().single();
          if(nd) setFields(p=>p.map(x=>x._key===f._key?{...x,id:nd.id,_key:nd.id,...nd}:x));
        }
      }
      invalidateCustomFieldCache(selectedObj);
      showToast(publish?'✓ Fields published — visible in records':'✓ Draft saved');
    } catch(e) { showToast('Save error: '+e.message,'err'); }
    setSaving(false);
  }

  async function deleteField(field) {
    if(!supabase||!field.id)return;
    await supabase.from('app_custom_fields').delete().eq('id',field.id);
    setFields(p=>p.filter(f=>f._key!==field._key));
    invalidateCustomFieldCache(selectedObj);
    showToast('Field deleted');
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-5 right-5 z-[9999] px-5 py-3 rounded-2xl shadow-2xl font-semibold text-sm text-white ${toast.err?'bg-red-500':'bg-[#0F172A]'}`}>
          {toast.m}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[24px] p-6 text-white">
        <h2 className="text-2xl font-bold">🧩 B2B App Composer</h2>
        <p className="text-blue-200 text-sm mt-1">Add custom fields to any B2B CRM object. Values saved in <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">custom_data</code> on each record.</p>
      </div>

      {/* Object selector */}
      <div className="grid grid-cols-3 sm:grid-cols-5 xl:grid-cols-9 gap-2">
        {B2B_OBJECTS.map(obj=>(
          <button key={obj.v} onClick={()=>setSelectedObj(obj.v)}
            className={`flex flex-col items-center py-3 px-2 rounded-[16px] border text-xs font-bold transition-all gap-1.5 ${selectedObj===obj.v?'bg-[#0F172A] text-white border-transparent shadow-lg':'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-700'}`}>
            <span className="text-xl">{obj.icon}</span>
            <span className="text-center leading-tight">{obj.l.replace(' ','')}</span>
          </button>
        ))}
      </div>

      {/* Fields panel */}
      <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{selObj?.icon}</span>
            <div>
              <h3 className="font-bold text-[#0F172A]">{selObj?.l} — Custom Fields</h3>
              <p className="text-xs text-gray-400">{fields.filter(f=>f.is_published).length} published · {fields.length}/{MAX_FIELDS} fields</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>save(false)} disabled={saving||fields.length===0}
              className="px-4 py-2 text-sm font-semibold border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              {saving?'Saving…':'Save Draft'}
            </button>
            <button onClick={()=>save(true)} disabled={saving||fields.length===0}
              className="px-4 py-2 text-sm font-bold bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-xl hover:opacity-90 disabled:opacity-40 shadow">
              {saving?'Publishing…':'🚀 Publish'}
            </button>
            <button onClick={addField} disabled={fields.length>=MAX_FIELDS}
              className="px-4 py-2 text-sm font-bold bg-blue-500 hover:bg-blue-600 text-white rounded-xl disabled:opacity-40 shadow">
              + Add Field
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/></div>
        ) : fields.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-5xl mb-4">🧩</div>
            <div className="font-bold text-[#0F172A] mb-1">No custom fields yet</div>
            <p className="text-sm text-gray-400">Click + Add Field to define custom fields for {selObj?.l}</p>
            <button onClick={addField} className="mt-4 px-5 py-2.5 bg-[#0F172A] text-white rounded-xl text-sm font-bold hover:bg-blue-900">
              + Add First Field
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {fields.map((f,idx)=>(
              <div key={f._key} className={`p-5 ${f.is_published?'bg-green-50/30':''}`}>
                <div className="flex items-start gap-3 flex-wrap">
                  {/* Drag handle / order */}
                  <div className="w-6 flex-shrink-0 text-center mt-2">
                    <div className="text-gray-300 font-mono text-xs">{idx+1}</div>
                  </div>

                  {/* Label + API name */}
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Label *</label>
                    <input value={f.label} onChange={e=>updField(f._key,'label',e.target.value)}
                      placeholder="e.g. LinkedIn URL" className={iCls}/>
                    <div className="text-[10px] text-gray-400 mt-1 font-mono">api: {f.api_name||slugify(f.label)||'...'}</div>
                  </div>

                  {/* Field type */}
                  <div className="w-36">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Type</label>
                    <select value={f.field_type} onChange={e=>updField(f._key,'field_type',e.target.value)} className={sCls}>
                      {FIELD_TYPES.map(ft=><option key={ft.v} value={ft.v}>{ft.icon} {ft.l}</option>)}
                    </select>
                  </div>

                  {/* Show on */}
                  <div className="w-36">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Show on</label>
                    <select value={f.show_on||'both'} onChange={e=>updField(f._key,'show_on',e.target.value)} className={sCls}>
                      {SHOW_ON_OPTS.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
                    </select>
                  </div>

                  {/* Required */}
                  <div className="flex-shrink-0 mt-6">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-600">
                      <input type="checkbox" checked={!!f.required} onChange={e=>updField(f._key,'required',e.target.checked)}
                        className="w-4 h-4 accent-blue-600 rounded"/>
                      Required
                    </label>
                  </div>

                  {/* Status badge */}
                  <div className="flex-shrink-0 mt-5">
                    {f.is_published
                      ? <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold border border-green-200">✓ LIVE</span>
                      : <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold border border-amber-200">DRAFT</span>
                    }
                  </div>

                  {/* Delete */}
                  <button onClick={()=>f.id?deleteField(f):removeField(f._key)}
                    className="flex-shrink-0 mt-5 w-8 h-8 flex items-center justify-center rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors text-lg">
                    ×
                  </button>
                </div>

                {/* Options for select fields */}
                {(f.field_type==='single_select'||f.field_type==='multi_select') && (
                  <div className="mt-3 ml-9">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Options</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(f.options||[]).map(opt=>(
                        <span key={opt} className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs px-2.5 py-1 rounded-full font-semibold">
                          {opt}
                          <button onClick={()=>removeOption(f._key,opt)} className="hover:text-red-500 ml-0.5">×</button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input value={optionInput[f._key]||''} onChange={e=>setOptionInput(p=>({...p,[f._key]:e.target.value}))}
                        onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addOption(f._key);}}}
                        placeholder="Type option and press Enter" className={`${iCls} flex-1 text-xs py-2`}/>
                      <button onClick={()=>addOption(f._key)} className="px-3 py-2 bg-blue-100 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-200">Add</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-[16px] p-4 text-sm text-blue-800">
        <strong>How it works:</strong> Custom fields are stored in a <code className="bg-blue-100 px-1 rounded font-mono text-xs">custom_data</code> JSONB column on each B2B table.
        Published fields appear in the <strong>Additional Information</strong> section at the bottom of every record detail page.
        Use <strong>Show on</strong> to control where each field appears.
      </div>
    </div>
  );
}
