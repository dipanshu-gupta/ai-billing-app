// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';

// ─── Field configs per object type ───────────────────────────────────────────
const CONFIGS = {
  customer: {
    icon: '👥', label: 'Customer',
    fields: [
      { key:'name',        label:'Company Name *',  type:'text',   required:true },
      { key:'industry',    label:'Industry',         type:'select', options:['Technology','Finance','Healthcare','Manufacturing','Retail','Education','Real Estate','Media','Logistics','Other'] },
      { key:'email',       label:'Email',            type:'email' },
      { key:'phone',       label:'Phone',            type:'tel' },
      { key:'website',     label:'Website',          type:'url' },
      { key:'city',        label:'City',             type:'text' },
      { key:'country',     label:'Country',          type:'text' },
      { key:'gstNumber',   label:'GSTIN / VAT No.',  type:'text' },
    ],
    defaults: { status:'Active' },
    idMap: (record) => ({ id: record.customer_number || record.id, name: record.name }),
  },
  contact: {
    icon: '👤', label: 'Contact',
    fields: [
      { key:'name',        label:'Full Name *',      type:'text',   required:true },
      { key:'email',       label:'Email',            type:'email' },
      { key:'phone',       label:'Phone',            type:'tel' },
      { key:'designation', label:'Designation',      type:'text' },
      { key:'department',  label:'Department',       type:'text' },
    ],
    defaults: { status:'Active' },
    idMap: (record) => ({ id: record.contact_number || record.id, name: record.name }),
  },
  lead: {
    icon: '🎯', label: 'Lead',
    fields: [
      { key:'name',        label:'Lead Name *',      type:'text',   required:true },
      { key:'customer',    label:'Company',          type:'text' },
      { key:'email',       label:'Email',            type:'email' },
      { key:'phone',       label:'Phone',            type:'tel' },
      { key:'source',      label:'Source',           type:'select', options:['Website','Referral','Cold Call','Email','Social Media','Trade Show','Partner','Other'] },
      { key:'amount',      label:'Estimated Value',  type:'number' },
    ],
    defaults: { status:'New' },
    idMap: (record) => ({ id: record.lead_number || record.id, name: record.name }),
  },
  opportunity: {
    icon: '💡', label: 'Opportunity',
    fields: [
      { key:'name',        label:'Opportunity Name *', type:'text', required:true },
      { key:'customer',    label:'Company',            type:'text' },
      { key:'stage',       label:'Stage',              type:'select', options:['Prospecting','Qualification','Proposal','Negotiation','Closed Won','Closed Lost'] },
      { key:'amount',      label:'Deal Value',         type:'number' },
      { key:'closeDate',   label:'Expected Close',     type:'date' },
    ],
    defaults: { status:'Open' },
    idMap: (record) => ({ id: record.opportunity_number || record.id, name: record.name }),
  },
  activity: {
    icon: '📅', label: 'Activity',
    fields: [
      { key:'name',         label:'Subject *',       type:'text',   required:true },
      { key:'activityType', label:'Type',            type:'select', options:['Call','Email','Meeting','Demo','Follow-up','Task','Other'] },
      { key:'activityDate', label:'Date',            type:'date' },
      { key:'notes',        label:'Notes',           type:'textarea' },
    ],
    defaults: { status:'Open' },
    idMap: (record) => ({ id: record.activity_number || record.id, name: record.name }),
  },
};

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';
const tCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none';
const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';

export default function QuickCreateModal({
  objectType,   // 'customer' | 'contact' | 'lead' | 'opportunity' | 'activity'
  open,
  onClose,
  onCreated,    // (id: string, name: string) => void — called with the new record's id and name
  prefill = {}, // pre-fill some fields (e.g. customer name from search query)
  prefillExtra = {}, // extra hidden fields (e.g. customerId when creating a contact)
}) {
  const { createRecord, customers } = useApp();
  const [form, setForm]   = useState({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const cfg = CONFIGS[objectType];

  useEffect(() => {
    if (open) {
      setForm({ ...cfg?.defaults, ...prefillExtra, ...prefill });
      setErrors({});
    }
  }, [open, objectType]);

  if (!open || !cfg) return null;

  const s = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const validate = () => {
    const errs = {};
    cfg.fields.filter(f => f.required).forEach(f => {
      if (!form[f.key]?.toString().trim()) errs[f.key] = `${f.label.replace(' *','')} is required`;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const PAGE_MAP: Record<string,string> = {
      customer:'customers', contact:'contacts', lead:'leads',
      opportunity:'opportunities', activity:'activities',
    };
    const result = await createRecord(PAGE_MAP[objectType] || objectType, form);
    setSaving(false);
    if (result) {
      // result.id is the generated record number (e.g. CUST-xxx, CONT-xxx)
      // result.name is the record's name
      // Call onCreated immediately with id + name — no timeout needed
      onCreated?.(result.id, result.name);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-5 flex items-center justify-between rounded-t-[28px]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{cfg.icon}</span>
            <div>
              <h3 className="text-white font-bold text-lg">Quick Create {cfg.label}</h3>
              <p className="text-blue-300 text-xs mt-0.5">Fill minimum details — edit more after creation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">✕</button>
        </div>

        {/* Fields */}
        <div className="p-6 space-y-4">
          {cfg.fields.map(field => (
            <div key={field.key}>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1.5">
                {field.label}
              </label>
              {field.type === 'select' ? (
                <select value={form[field.key]||''} onChange={e=>s(field.key,e.target.value)} className={sCls}>
                  <option value="">Select...</option>
                  {field.options.map(o=><option key={o}>{o}</option>)}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea rows={3} value={form[field.key]||''} onChange={e=>s(field.key,e.target.value)} className={tCls}/>
              ) : (
                <input
                  type={field.type||'text'}
                  value={form[field.key]||''}
                  onChange={e=>s(field.key,e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter' && field.type!=='textarea') handleSave(); }}
                  className={`${iCls} ${errors[field.key]?'border-red-400 ring-1 ring-red-300':''}`}
                  autoFocus={cfg.fields[0].key === field.key}
                />
              )}
              {errors[field.key] && <p className="text-xs text-red-500 mt-1">{errors[field.key]}</p>}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-2xl font-semibold text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-50 shadow-lg hover:opacity-90">
            {saving ? 'Creating...' : `+ Create ${cfg.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
