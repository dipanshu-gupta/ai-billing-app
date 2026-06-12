// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import SearchableSelect from '@/components/shared/SearchableSelect';

const iCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400';
const sCls = iCls;

const INDUSTRIES      = ['Technology','Manufacturing','Retail','Healthcare','Finance','Real Estate','Education','Consulting','Media','Logistics','FMCG','Automotive','Energy','Government','Other'];
const LEAD_SOURCES    = ['Website','Cold Call','Email Campaign','Referral','Social Media','Trade Show','Partner','Advertisement','Inbound','Other'];
const ACTIVITY_TYPES  = ['Call','Meeting','Email','Demo','Follow Up','Task','Note','Site Visit','Proposal','Other'];
const PRIORITY_OPTS   = ['Low','Medium','High','Critical'];
const STAGES          = ['Prospecting','Qualification','Needs Analysis','Value Proposition','Proposal Sent','Negotiation','Closed Won','Closed Lost'];
const CURRENCIES      = ['INR','USD','EUR','GBP','AED','SGD','AUD','CAD','JPY','CNY'];
const PAYMENT_TERMS   = ['Due on Receipt','Net 15','Net 30','Net 45','Net 60','Net 90'];
const PRODUCT_FAMILIES= ['Software','Hardware','Services','Subscription','License','Support','Training','Other'];

// Status options per object
const STATUS_OPTS = {
  customers:    ['New','Prospect','Active','On Hold','Inactive'],
  contacts:     ['Active','Prospect','Key Contact','Inactive'],
  leads:        ['New','Contacted','Qualified','Unqualified'],
  opportunities:['Prospecting','Qualification','Needs Analysis','Proposal Sent'],
  orders:       ['Draft','Confirmed','Processing'],
  invoices:     ['Draft','Pending','Sent'],
  activities:   ['Not Started','In Progress'],
  products:     ['Active','Draft'],
};

// Fields per object — label, key, type, required
const OBJECT_FIELDS = {
  customers: [
    { label:'Customer Name',  key:'name',        type:'text',    required:true  },
    { label:'Industry',       key:'industry',    type:'select',  opts:INDUSTRIES },
    { label:'Phone',          key:'phone',       type:'tel'  },
    { label:'Email',          key:'email',       type:'email' },
    { label:'Website',        key:'website',     type:'url'  },
    { label:'GST / Tax No.',  key:'gstNumber',   type:'text' },
    { label:'Status',         key:'status',      type:'status'  },
    { label:'Owner',          key:'owner_id',    type:'owner'   },
  ],
  contacts: [
    { label:'Full Name',      key:'name',        type:'text',    required:true  },
    { label:'Customer',       key:'customerId',  type:'customer'  },
    { label:'Designation',    key:'designation', type:'text'  },
    { label:'Department',     key:'department',  type:'text'  },
    { label:'Email',          key:'email',       type:'email' },
    { label:'Phone',          key:'phone',       type:'tel'   },
    { label:'Mobile',         key:'mobile',      type:'tel'   },
    { label:'Primary Contact',key:'isPrimary',   type:'checkbox' },
    { label:'Status',         key:'status',      type:'status'  },
    { label:'Owner',          key:'owner_id',    type:'owner'   },
  ],
  leads: [
    { label:'Lead Name',      key:'name',        type:'text',    required:true  },
    { label:'Customer',       key:'customerId',  type:'customer' },
    { label:'Contact',        key:'contactId',   type:'contact'  },
    { label:'Email',          key:'email',       type:'email' },
    { label:'Phone',          key:'phone',       type:'tel'   },
    { label:'Lead Source',    key:'source',      type:'select',  opts:LEAD_SOURCES },
    { label:'Amount',         key:'amount',      type:'number' },
    { label:'Expected Close', key:'expectedCloseDate', type:'date' },
    { label:'Status',         key:'status',      type:'status'  },
    { label:'Owner',          key:'owner_id',    type:'owner'   },
  ],
  opportunities: [
    { label:'Opportunity Name',key:'name',       type:'text',    required:true  },
    { label:'Customer',       key:'customerId',  type:'customer' },
    { label:'Contact',        key:'contactId',   type:'contact'  },
    { label:'Stage',          key:'stage',       type:'select',  opts:STAGES },
    { label:'Amount',         key:'amount',      type:'number' },
    { label:'Close Date',     key:'closeDate',   type:'date' },
    { label:'Probability (%)',key:'probability', type:'number' },
    { label:'Status',         key:'status',      type:'status'  },
    { label:'Owner',          key:'owner_id',    type:'owner'   },
  ],
  activities: [
    { label:'Activity Name',  key:'name',        type:'text',    required:true  },
    { label:'Activity Type',  key:'activityType',type:'select',  opts:ACTIVITY_TYPES },
    { label:'Customer',       key:'customerId',  type:'customer' },
    { label:'Contact',        key:'contactId',   type:'contact'  },
    { label:'Activity Date',  key:'activityDate',type:'date' },
    { label:'Priority',       key:'priority',    type:'select',  opts:PRIORITY_OPTS },
    { label:'Due Date',       key:'dueDate',     type:'date' },
    { label:'Status',         key:'status',      type:'status'  },
    { label:'Owner',          key:'owner_id',    type:'owner'   },
  ],
  products: [
    { label:'Product Name',   key:'name',        type:'text',    required:true  },
    { label:'Product Family', key:'productFamily',type:'select', opts:PRODUCT_FAMILIES },
    { label:'Category',       key:'category',    type:'text' },
    { label:'SKU / Code',     key:'sku',         type:'text' },
    { label:'Unit Price',     key:'price',       type:'number' },
    { label:'Cost Price',     key:'cost',        type:'number' },
    { label:'Unit',           key:'unit',        type:'text' },
    { label:'Tax Rate (%)',   key:'taxRate',     type:'number' },
    { label:'Status',         key:'status',      type:'status'  },
  ],
  orders: [
    { label:'Order Name',     key:'name',        type:'text',    required:true  },
    { label:'Customer',       key:'customerId',  type:'customer' },
    { label:'Contact',        key:'contactId',   type:'contact'  },
    { label:'Currency',       key:'currency',    type:'select',  opts:CURRENCIES },
    { label:'Payment Terms',  key:'paymentTerms',type:'select',  opts:PAYMENT_TERMS },
    { label:'Status',         key:'status',      type:'status'  },
    { label:'Owner',          key:'owner_id',    type:'owner'   },
  ],
  invoices: [
    { label:'Invoice Name',   key:'name',        type:'text',    required:true  },
    { label:'Customer',       key:'customerId',  type:'customer' },
    { label:'Contact',        key:'contactId',   type:'contact'  },
    { label:'Due Date',       key:'dueDate',     type:'date' },
    { label:'Payment Terms',  key:'paymentTerms',type:'select',  opts:PAYMENT_TERMS },
    { label:'Currency',       key:'currency',    type:'select',  opts:CURRENCIES },
    { label:'Status',         key:'status',      type:'status'  },
    { label:'Owner',          key:'owner_id',    type:'owner'   },
  ],
};

export default function CreateRecordModal({ page, open, prefillCustomer, onClose, onCreated }) {
  const {
    createRecord, customers, contacts, enterpriseUsers, currentUser,
  } = useApp();

  const fields     = OBJECT_FIELDS[page] || [];
  const statusOpts = STATUS_OPTS[page]   || ['Active','Inactive'];

  const defaultForm = () => {
    const base: any = { status: statusOpts[0], currency:'INR', priority:'Medium' };
    if (prefillCustomer) {
      base.customerId = prefillCustomer.id;
      base.customer   = prefillCustomer.name;
    }
    if (currentUser) {
      base.owner_id = currentUser.id;
      base.owner    = currentUser.email;
    }
    return base;
  };

  const [form, setForm]     = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});

  // Reset form with correct per-object defaults whenever the modal opens or the page changes
  useEffect(() => {
    if (open) { setForm(defaultForm()); setErrors({}); }
  }, [open, page]);

  if (!open) return null;

  const s = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const filteredContacts = contacts.filter(c =>
    !form.customerId || c.customerId === form.customerId || c.customer_id === form.customerId
  );

  const validate = () => {
    const errs: Record<string,string> = {};
    fields.filter(f => f.required).forEach(f => {
      if (!form[f.key]) errs[f.key] = `${f.label} is required`;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSaving(true);
    // Build record with resolved names
    const record: any = { ...form };
    if (form.customerId) {
      const c = customers.find(x => x.id === form.customerId);
      record.customer    = c?.name || '';
      record.customer_id = form.customerId;
    }
    if (form.contactId) {
      const c = contacts.find(x => x.id === form.contactId);
      record.contact    = c?.name || '';
      record.contact_id = form.contactId;
    }
    if (form.owner_id) {
      const u = enterpriseUsers.find(x => x.id === form.owner_id);
      record.owner = u?.email || currentUser?.email || '';
    }
    await createRecord(page, record);
    setSaving(false);
    setForm(defaultForm());
    onCreated?.();
    onClose();
  };

  const renderField = (field) => {
    const { key, type, opts, label } = field;
    const v = form[key];
    const err = errors[key];

    const wrap = (el) => (
      <div key={key}>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
          {label}{field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {el}
        {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
      </div>
    );

    if (type === 'customer') return wrap(
      <SearchableSelect
        value={v || ''}
        onChange={val => {
          const c = customers.find(x => x.id === val);
          s('customerId', c?.id || '');
          s('customer',   c?.name || '');
          s('contactId',  '');
          s('contact',    '');
        }}
        options={customers.map(c => ({ value:c.id, label:c.name, sub:[c.email,c.phone,c.industry].filter(Boolean).join(' · ') }))}
        placeholder="Search customers..." emptyLabel="No customer"
      />
    );

    if (type === 'contact') return wrap(
      <SearchableSelect
        value={v || ''}
        onChange={val => { const c = contacts.find(x => x.id === val); s('contactId', c?.id || ''); s('contact', c?.name || ''); }}
        options={filteredContacts.map(c => ({ value:c.id, label:c.name, sub:[c.email,c.phone,c.designation].filter(Boolean).join(' · ') }))}
        placeholder="Search contacts..." emptyLabel="No contact"
      />
    );

    if (type === 'owner') return wrap(
      <SearchableSelect
        value={v || ''}
        onChange={val => { const u = enterpriseUsers.find(x => x.id === val); s('owner_id', u?.id || ''); s('owner', u?.email || ''); }}
        options={enterpriseUsers.map(u => ({ value:u.id, label:`${u.first_name||''} ${u.last_name||''}`.trim(), sub:u.designation||u.email||'' }))}
        placeholder="Search users..." emptyLabel="Unassigned"
      />
    );

    if (type === 'status') return wrap(
      <select value={v || statusOpts[0]} onChange={e => s(key, e.target.value)} className={sCls}>
        {statusOpts.map(o => <option key={o}>{o}</option>)}
      </select>
    );

    if (type === 'select') return wrap(
      <select value={v || ''} onChange={e => s(key, e.target.value)} className={sCls}>
        <option value="">Select {label}</option>
        {(opts || []).map(o => <option key={o}>{o}</option>)}
      </select>
    );

    if (type === 'checkbox') return wrap(
      <label className="flex items-center gap-2 cursor-pointer pt-1">
        <input type="checkbox" checked={!!v} onChange={e => s(key, e.target.checked)} className="w-4 h-4 accent-blue-600"/>
        <span className="text-sm text-[#0F172A]">{label}</span>
      </label>
    );

    if (type === 'date')   return wrap(<input type="date"   value={v||''} onChange={e=>s(key,e.target.value)} className={iCls}/>);
    if (type === 'number') return wrap(<input type="number" min={0} value={v||''} onChange={e=>s(key,parseFloat(e.target.value)||0)} className={iCls}/>);
    if (type === 'email')  return wrap(<input type="email"  value={v||''} onChange={e=>s(key,e.target.value)} className={iCls} placeholder={label}/>);
    if (type === 'tel')    return wrap(<input type="tel"    value={v||''} onChange={e=>s(key,e.target.value)} className={iCls} placeholder={label}/>);
    if (type === 'url')    return wrap(<input type="url"    value={v||''} onChange={e=>s(key,e.target.value)} className={iCls} placeholder="https://..."/>);
    return wrap(<input type="text" value={v||''} onChange={e=>s(key,e.target.value)} className={iCls} placeholder={label}/>);
  };

  const pageLabel = { customers:'Customer', contacts:'Contact', leads:'Lead', opportunities:'Opportunity',
    activities:'Activity', products:'Product', orders:'Order', invoices:'Invoice' }[page] || page;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>

      {/* Modal */}
      <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white text-xl font-bold">Create {pageLabel}</h2>
            {prefillCustomer && (
              <p className="text-blue-200 text-sm mt-0.5">For: {prefillCustomer.name}</p>
            )}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
        </div>

        {/* Fields */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(f => renderField(f))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0 bg-gray-50">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-100">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0F172A] to-blue-800 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 shadow-md flex items-center gap-2">
            {saving ? '⏳ Creating...' : `✓ Create ${pageLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}
