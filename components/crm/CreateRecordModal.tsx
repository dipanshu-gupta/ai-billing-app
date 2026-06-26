// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useCustomFields, invalidateCustomFieldCache } from '@/lib/useCustomFields';
import SearchableSelect from '@/components/shared/SearchableSelect';
import QuickCreateModal from '@/components/shared/QuickCreateModal';

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

  const { fields: customFields } = useCustomFields(page);

  // Clear cache and force re-fetch each time modal opens to pick up newly published fields
  useEffect(() => {
    if (open) {
      invalidateCustomFieldCache(page);
    }
  }, [open, page]);
  const [customData, setCustomData] = useState({});
    const [form, setForm]     = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [quickCreate, setQuickCreate] = useState(null);
  // Locally track records created via QuickCreate so they appear in dropdowns
  // before the global state (contacts/customers) refreshes from DB
  const [pendingContacts,  setPendingContacts]  = useState([]);
  const [pendingCustomers, setPendingCustomers] = useState([]);

  // Reset form with correct per-object defaults whenever the modal opens or the page changes
  useEffect(() => {
    if (open) { setForm(defaultForm()); setErrors({}); }
  }, [open, page]);

  if (!open) return null;

  const s = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const allContacts = [
    ...contacts,
    ...pendingContacts.filter(pc => !contacts.find(c => c.id === pc.id)),
  ];
  const filteredContacts = allContacts.filter(c =>
    !form.customerId || c.customerId === form.customerId || c.customer_id === form.customerId
  );
  const allCustomers = [
    ...customers,
    ...pendingCustomers.filter(pc => !customers.find(c => c.id === pc.id)),
  ];

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validate = () => {
    const errs: Record<string,string> = {};
    fields.forEach(f => {
      const val = (form[f.key] || '').toString().trim();
      if (f.required && !val) {
        errs[f.key] = `${f.label.replace(' *','')} is required`;
      } else if (f.type === 'email' && val && !EMAIL_RE.test(val)) {
        errs[f.key] = 'Enter a valid email (e.g. name@company.com)';
      } else if (f.type === 'tel' && val) {
        const digits = val.replace(/\D/g,'');
        if (digits.length < 7 || digits.length > 15) errs[f.key] = 'Phone: 7–15 digits only';
      }
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
    await createRecord(page, { ...record, custom_data: customData });
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
          const c = [...customers,...pendingCustomers].find(x => x.id === val);
          if(c){s('customerId',c.id);s('customer',c.name);}
          s('contactId',''); s('contact','');
        }}
        options={allCustomers.map(c => ({ value:c.id, label:c.name, sub:[c.email,c.phone,c.industry].filter(Boolean).join(' · ') }))}
        placeholder="Search customers..." emptyLabel="No customer"
        onCreateNew={q=>setQuickCreate({type:'customer',prefillName:q,onCreated:(id,name)=>{setForm(f=>({...f,customerId:id,customer:name,contactId:'',contact:''}));setPendingCustomers(p=>[...p,{id,name,customer_number:id}]);}})}
        createLabel="Create Customer"
      />
    );

    if (type === 'contact') return wrap(
      <SearchableSelect
        value={v || ''}
        onChange={val => { const c = [...contacts,...pendingContacts].find(x => x.id === val); if(c){s('contactId',c.id);s('contact',c.name);}else if(val){s('contactId',val);}}}
        options={filteredContacts.map(c => ({ value:c.id, label:c.name, sub:[c.email,c.phone,c.designation].filter(Boolean).join(' · ') }))}
        placeholder="Search contacts..." emptyLabel="No contact"
        onCreateNew={q=>{const custId=form.customerId;const custName=form.customer;setQuickCreate({type:'contact',prefillName:q,prefillExtra:{customerId:custId,customer:custName},onCreated:(id,name)=>{setForm(f=>({...f,contactId:id,contact:name}));setPendingContacts(p=>[...p,{id,name,contact_number:id,customerId:custId,customer_id:custId}]);}});}}
        createLabel="Create Contact"
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
    if (type === 'email')  return wrap(<input type="email"  value={v||''} onChange={e=>{s(key,e.target.value);if(errors[key])setErrors(p=>({...p,[key]:''}));}} className={`${iCls} ${errors[key]?'border-red-400':''}`} placeholder="name@company.com"/>);
    if (type === 'tel')    return wrap(<input type="tel"    value={v||''} onChange={e=>{const d=e.target.value.replace(/[^0-9+\-() ]/g,'');s(key,d);if(errors[key])setErrors(p=>({...p,[key]:''}));}} className={`${iCls} ${errors[key]?'border-red-400':''}`} placeholder="Phone number" maxLength={16}/>);
    if (type === 'url')    return wrap(<input type="url"    value={v||''} onChange={e=>s(key,e.target.value)} className={iCls} placeholder="https://..."/>);
    return wrap(<input type="text" value={v||''} onChange={e=>s(key,e.target.value)} className={iCls} placeholder={label}/>);
  };

  const pageLabel = { customers:'Customer', contacts:'Contact', leads:'Lead', opportunities:'Opportunity',
    activities:'Activity', products:'Product', orders:'Order', invoices:'Invoice' }[page] || page;

  return (
    <>
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
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(f => renderField(f))}
          </div>

          {/* Additional Information — custom fields for create */}
          {customFields.filter(cf => cf.show_on === 'both' || cf.show_on === 'create').length > 0 && (
            <div className="mt-5 bg-blue-50 rounded-[20px] border border-blue-100 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-blue-100 flex items-center gap-2">
                <span>🎛️</span>
                <span className="font-bold text-[#0F172A] text-sm">Additional Information</span>
                <span className="ml-auto text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold">App Composer</span>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customFields.filter(cf => cf.show_on === 'both' || cf.show_on === 'create').map(cf => {
                  const cdVal = (customData || {})[cf.api_name];
                  const setCdVal = (val) => setCustomData(p => ({ ...p, [cf.api_name]: val }));
                  return (
                    <div key={cf.api_name} className={cf.field_type==='multi_select'?'sm:col-span-2':''}>
                      {cf.field_type !== 'checkbox' && (
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                          {cf.label}{cf.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                      )}
                      {cf.field_type==='single_select'
                        ? <select value={cdVal||''} onChange={e=>setCdVal(e.target.value)}
                            className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                            <option value="">Select {cf.label}...</option>
                            {cf.options.map(o=><option key={o} value={o}>{o}</option>)}
                          </select>
                        : cf.field_type==='multi_select'
                        ? <div className="space-y-1.5">{cf.options.map(o=>(
                            <label key={o} className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded"
                                checked={(cdVal||'').split('||').includes(o)}
                                onChange={e=>{const cur=(cdVal||'').split('||').filter(Boolean);const nxt=e.target.checked?[...cur,o]:cur.filter(x=>x!==o);setCdVal(nxt.join('||'));}}/>
                              <span className="text-sm text-[#0F172A]">{o}</span>
                            </label>
                          ))}</div>
                        : cf.field_type==='checkbox'
                        ? <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" checked={!!cdVal} onChange={e=>setCdVal(e.target.checked)}/>
                            <span className="text-sm font-semibold text-[#0F172A]">{cf.label}</span>
                          </label>
                        : <input
                            type={cf.field_type==='number'||cf.field_type==='currency'?'number':cf.field_type==='date'?'date':cf.field_type==='datetime'?'datetime-local':cf.field_type==='email'?'email':cf.field_type==='url'?'url':'text'}
                            value={cdVal||''} onChange={e=>setCdVal(e.target.value)} placeholder={cf.label}
                            className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>{/* end overflow-y-auto */}

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
      <QuickCreateModal
        objectType={quickCreate?.type}
        open={!!quickCreate}
        onClose={()=>setQuickCreate(null)}
        prefill={quickCreate?.prefillName?{name:quickCreate.prefillName}:{}}
        prefillExtra={quickCreate?.prefillExtra||{}}
        onCreated={(id,name)=>{quickCreate?.onCreated?.(id,name);setQuickCreate(null);}}
      />
    </>
  );
}