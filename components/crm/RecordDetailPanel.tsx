// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import {
  getObjectFields, getStatusOptions, getPageLabel,
  formatCurrency, formatDateTime, getStatusColor,
  formatDisplayNumber, PAGE_DISPLAY_PREFIX,
} from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import ApprovalBanner from '@/components/crm/ApprovalBanner';
import ProductConfigurator from '@/components/products/ProductConfigurator';
import ConfigureLineItemModal from '@/components/shared/ConfigureLineItemModal';
import QuickCreateModal from '@/components/shared/QuickCreateModal';
import CreateRecordModal from '@/components/crm/CreateRecordModal';
import AISummary from '@/components/ai/AISummary';
import SearchableSelect from '@/components/shared/SearchableSelect';
import AddressManager from '@/components/shared/AddressManager';
import AddressSelector from '@/components/shared/AddressSelector';

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';
const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';
const tCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none';

const HAS_LI = ['leads','opportunities','orders','invoices'];
const LI_MAP = {
  leads:         ['lead_line_items',        'lead_number'],
  opportunities: ['opportunity_line_items', 'opportunity_number'],
  orders:        ['order_line_items',       'order_number'],
  invoices:      ['invoice_line_items',     'invoice_number'],
};

function Pill({ status }) {
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>{status}</span>;
}

// ─── OwnerField: searchable select over all users.
//     Default = record's current owner; if none, the user who created the record;
//     if none, the currently logged-in user. ─────────────────────────────────────
function OwnerField({ record, edited, onPick }) {
  const { enterpriseUsers, currentUser } = useApp();
  const [backup, setBackup] = useState([]);

  useEffect(() => {
    if (enterpriseUsers.length > 0 || !supabase) return;
    supabase.from('enterprise_users').select('*').then(({ data, error }) => {
      if (error) console.error('OwnerField backup fetch:', error.message);
      setBackup(data || []);
    });
  }, [enterpriseUsers.length]);

  const users = enterpriseUsers.length > 0 ? enterpriseUsers : backup;

  // Resolution order: edited owner_id → edited owner email → created_by email → current user
  const resolved =
    users.find(u => edited.owner_id   && u.id    === edited.owner_id)  ||
    users.find(u => edited.owner      && u.email === edited.owner)      ||
    users.find(u => record.created_by && u.email === record.created_by) ||
    users.find(u => currentUser       && u.id    === currentUser.id);

  // Auto-persist the default into edited state so saving captures it
  useEffect(() => {
    if (resolved && !edited.owner_id) onPick(resolved);
  }, [resolved?.id]);

  return (
    <SearchableSelect
      value={resolved?.id || ''}
      onChange={uid => onPick(users.find(x => x.id === uid) || null)}
      options={users.map(u => ({
        value: u.id,
        label: (`${u.first_name || ''} ${u.last_name || ''}`.trim()) || u.email || 'User',
        sub:   [u.designation, u.email].filter(Boolean).join(' · '),
      }))}
      placeholder={users.length === 0 ? 'Loading users...' : 'Select owner'}
      emptyLabel="Unassigned"
    />
  );
}


// ─── Approval Banner ──────────────────────────────────────────────────────────
// ApprovalBanner imported from shared component

// ─── Line Items Table ─────────────────────────────────────────────────────────
function LineItemsTable({ items, setItems, products }) {
  const [configModal, setConfigModal] = useState(null);

  const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400';

  const add    = () => setItems(p => [...p, { _id:Date.now(), product:'', quantity:1, price:0, discount:0, configuration:{} }]);
  const remove = (idx) => setItems(p => p.filter((_,i) => i !== idx));
  const upd    = (idx, field, raw) => setItems(p => p.map((r,i) => {
    if (i !== idx) return r;
    if (field === 'product') {
      const pr = products.find(x => x.name === raw);
      return { ...r, product: raw, price: pr ? pr.price : r.price, product_id: pr?._uuid||pr?.id||null, configuration: {} };
    }
    return { ...r, [field]: ['quantity','price','discount'].includes(field) ? Number(raw) : raw };
  }));

  const openConfig = (idx) => {
    const row = items[idx];
    const pr  = products.find(x => x.name === (row.product || row.product_name));
    if (!pr) return;
    setConfigModal({ rowIdx: idx, productName: pr.name, productId: pr._uuid||pr.id, productNumber: pr.id, answers: row.configuration || {} });
  };

  const saveConfig = (answers) => {
    if (configModal === null) return;
    setItems(p => p.map((r,i) => i === configModal.rowIdx ? { ...r, configuration: answers } : r));
    setConfigModal(null);
  };

  const sub   = items.reduce((s,r) => s + r.quantity * r.price, 0);
  const disc  = items.reduce((s,r) => s + r.quantity * r.price * (r.discount/100), 0);
  const grand = sub - disc;
  const fmt   = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);

  return (
    <>
      <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 flex items-center justify-between">
          <div><h3 className="text-white font-bold text-lg">Line Items</h3><p className="text-blue-300 text-xs mt-0.5">Products · Discounts · Totals</p></div>
          <button onClick={add} className="bg-white text-[#0F172A] px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50">+ Add Item</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-blue-50 border-b border-blue-100">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500" style={{minWidth:220}}>Product</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-500 w-20">Qty</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500 w-32">Price (₹)</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-500 w-28">Disc (%)</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500 w-32">Total</th>
              <th className="w-10"/>
            </tr></thead>
            <tbody>
              {items.length === 0
                ? <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">No items. Click + Add Item.</td></tr>
                : items.map((row, idx) => {
                    const lt = row.quantity * row.price * (1 - row.discount/100);
                    const hasConfig = Object.keys(row.configuration||{}).length > 0;
                    return (
                      <tr key={row._id ?? idx} className="border-t border-blue-50 hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1">
                              <SearchableSelect
                                value={row.product||row.product_name||''}
                                onChange={v => upd(idx,'product',v)}
                                options={products.map(p=>({value:p.name,label:p.name,sub:p.category||''}))}
                                placeholder="Select product" emptyLabel="No product"
                              />
                            </div>
                            {(row.product||row.product_name) && (
                              <button onClick={()=>openConfig(idx)} title="Configure product"
                                className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all ${hasConfig?'bg-blue-600 text-white shadow-sm':'bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600'}`}>
                                ⚙️
                              </button>
                            )}
                          </div>
                          {hasConfig && (
                            <div className="text-xs text-blue-600 mt-1 pl-1">
                              ✓ {Object.keys(row.configuration).length} attribute{Object.keys(row.configuration).length!==1?'s':''} configured
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2"><input type="number" min={1} value={row.quantity} onChange={e=>upd(idx,'quantity',e.target.value)} className={`${iCls} text-center`}/></td>
                        <td className="px-4 py-2"><input type="number" min={0} value={row.price} onChange={e=>upd(idx,'price',e.target.value)} className={`${iCls} text-right`}/></td>
                        <td className="px-4 py-2"><input type="number" min={0} max={100} value={row.discount} onChange={e=>upd(idx,'discount',e.target.value)} className={`${iCls} text-center ${row.discount>0?'border-green-300 bg-green-50':''}`}/></td>
                        <td className="px-4 py-2 text-right font-bold text-[#0F172A]">{fmt(lt)}</td>
                        <td className="px-2 py-2 text-center"><button onClick={()=>remove(idx)} className="w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-xs font-bold flex items-center justify-center">✕</button></td>
                      </tr>
                    );
                  })
              }
            </tbody>
            {items.length > 0 && (
              <tfoot className="border-t-2 border-blue-100">
                <tr className="bg-gray-50"><td colSpan={4} className="px-5 py-2.5 text-right text-sm text-gray-500">Subtotal</td><td className="px-4 py-2.5 text-right text-sm font-semibold">{fmt(sub)}</td><td/></tr>
                {disc>0 && <tr className="bg-green-50"><td colSpan={4} className="px-5 py-2.5 text-right text-sm text-green-600">Discount</td><td className="px-4 py-2.5 text-right text-sm font-semibold text-green-600">- {fmt(disc)}</td><td/></tr>}
                <tr className="bg-[#0F172A]"><td colSpan={4} className="px-5 py-3 text-right font-bold text-white">Grand Total</td><td className="px-4 py-3 text-right font-bold text-white text-lg">{fmt(grand)}</td><td/></tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      {configModal && (
        <ConfigureLineItemModal
          open={!!configModal}
          onClose={()=>setConfigModal(null)}
          productName={configModal.productName}
          productId={configModal.productId}
          productNumber={configModal.productNumber}
          existingAnswers={configModal.answers}
          onSave={saveConfig}
        />
      )}
    </>
  );
}

// ─── Customer 360 ─────────────────────────────────────────────────────────────
function Customer360({ customer, onSubRecordOpen, onCreateFor }) {
  const { contacts, leads, opportunities, orders, invoices, activities, quotations } = useApp();
  const [tab, setTab] = useState('contacts');

  const m = r => r.customerId === customer.id || r.customer === customer.name;
  const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n||0);

  const secs = {
    contacts:      { icon:'📇', label:'Contacts',      createLabel:'Contact',     data:contacts.filter(m),
      cols:[{h:'Name',v:r=>r.name},{h:'Email',v:r=>r.email||'-'},{h:'Phone',v:r=>r.phone||'-'},{h:'Designation',v:r=>r.designation||'-'},{h:'Primary',v:r=>(r.isPrimary||r.is_primary)?<span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">★ Primary</span>:<span className="text-gray-300 text-xs">—</span>},{h:'Status',v:r=><Pill status={r.status}/>}] },
    leads:         { icon:'🎯', label:'Leads',          createLabel:'Lead',        data:leads.filter(m),
      cols:[{h:'Name',v:r=>r.name},{h:'Source',v:r=>r.source||'-'},{h:'Amount',v:r=>fmt(r.amount)},{h:'Owner',v:r=>r.owner||'-'},{h:'Status',v:r=><Pill status={r.status}/>}] },
    opportunities: { icon:'💼', label:'Opportunities',  createLabel:'Opportunity', data:opportunities.filter(m),
      cols:[{h:'Name',v:r=>r.name},{h:'Stage',v:r=>r.stage},{h:'Amount',v:r=>fmt(r.amount)},{h:'Close Date',v:r=>r.closeDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}] },
    orders:        { icon:'🛒', label:'Orders',         createLabel:'Order',       data:orders.filter(m),
      cols:[{h:'Name',v:r=>r.name},{h:'Amount',v:r=>fmt(r.amount)},{h:'Delivery',v:r=>r.deliveryDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}] },
    invoices:      { icon:'🧾', label:'Invoices',       createLabel:'Invoice',     data:invoices.filter(m),
      cols:[{h:'Name',v:r=>r.name},{h:'Amount',v:r=>fmt(r.amount)},{h:'Due Date',v:r=>r.dueDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}] },
    activities:    { icon:'📅', label:'Activities',     createLabel:'Activity',    data:activities.filter(m),
      cols:[{h:'Name',v:r=>r.name},{h:'Type',v:r=>r.activityType||'-'},{h:'Date',v:r=>r.activityDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}] },
    quotations:    { icon:'📄', label:'Quotations',     createLabel:null,          data:quotations.filter(m),
      cols:[{h:'Quote #',v:r=>r.quote_number},{h:'Name',v:r=>r.name},{h:'Grand Total',v:r=>fmt(r.grand_total)},{h:'Validity',v:r=>r.validity_date||'-'},{h:'Status',v:r=><Pill status={r.status}/>}] },
  };

  const active = secs[tab];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(secs).map(([k,s])=>(
          <button key={k} onClick={()=>setTab(k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${tab===k?'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white shadow-lg':'bg-white border border-blue-100 text-[#0F172A] hover:border-blue-300'}`}>
            <span>{s.icon}</span><span>{s.label}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tab===k?'bg-white/20 text-white':'bg-blue-100 text-blue-700'}`}>{s.data.length}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 flex items-center justify-between">
          <h3 className="text-white font-bold">{active.icon} {active.label}
            <span className="ml-2 bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">{active.data.length}</span>
          </h3>
          {active.createLabel && (
            <button onClick={()=>onCreateFor(tab)}
              className="bg-white text-[#0F172A] px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50 transition-all flex items-center gap-1.5">
              + New {active.createLabel}
            </button>
          )}
        </div>
        {active.data.length===0
          ? <div className="py-14 text-center"><div className="text-5xl mb-3">{active.icon}</div><p className="text-gray-400">No {active.label.toLowerCase()} linked to this customer.</p>
              {active.createLabel&&<button onClick={()=>onCreateFor(tab)} className="mt-3 text-blue-600 text-sm font-semibold hover:underline">+ Create {active.createLabel}</button>}
            </div>
          : <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-blue-50 border-b border-blue-100">
                  <tr>{active.cols.map(c=><th key={c.h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">{c.h}</th>)}<th className="px-5 py-3 w-16"/></tr>
                </thead>
                <tbody>
                  {active.data.map((row,i)=>(
                    <tr key={row.id||i}
                      className="border-t border-blue-50 hover:bg-blue-50/60 cursor-pointer transition-all"
                      onClick={()=>onSubRecordOpen(tab, row)}
                    >
                      {active.cols.map(c=><td key={c.h} className="px-5 py-3 text-[#0F172A]">{c.v(row)}</td>)}
                      <td className="px-5 py-3">
                        <span className="text-blue-400 text-xs font-semibold hover:text-blue-700">Open →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>
    </div>
  );
}



// ─── Main RecordDetailPanel ───────────────────────────────────────────────────
export default function RecordDetailPanel({ page, record, onClose, prefillCustomer, initialTab = null }) {
  const {
    customers, contacts, products, organizations, businessUnits, enterpriseUsers,
    updateRecord, submitForApproval, checkMatchingApprovalProcess,
    convertLeadToOpportunity, createInvoiceFromOrder, createOrderFromOpportunity,
    createQuotationFromOpportunity, fetchLineItems, fetchEnterpriseUsers,
    currentUserPermissions, permissionsLoaded, appPreferences, currentUser,
  } = useApp();

  // Local permission helper (mirrors CRMListPage canDo)
  const canEdit = () => {
    if (!permissionsLoaded || currentUserPermissions.length === 0) return true;
    if (currentUserPermissions.includes('__admin__')) return true;
    return currentUserPermissions.includes(`${page}_edit`);
  };

  const [edited,          setEdited]          = useState({ ...record });
  const [isDirty,         setIsDirty]         = useState(false);
  const [lineItems,       setLineItems]       = useState([]);
  const [loadingLI,       setLoadingLI]       = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [tab,             setTab]             = useState(initialTab || 'details');
  const [matchingProcess, setMatchingProcess] = useState(null);
  const [checkingApproval,setCheckingApproval]= useState(false);
  const [quickCreate,      setQuickCreate]      = useState(null);
  const [pendingCustomers, setPendingCustomers] = useState([]);
  const [pendingContacts,  setPendingContacts]  = useState([]);
  // Sub-record state for Customer360
  const [createForPage, setCreateForPage] = useState(null); // page string



  useEffect(() => {
    setEdited({ ...record });
    setTab(initialTab || 'details');
    setIsDirty(false);

    // Check matching approval process
    const checkApproval = async () => {
      setCheckingApproval(true);
      const proc = await checkMatchingApprovalProcess(page, { ...record });
      setMatchingProcess(proc);
      setCheckingApproval(false);
    };
    checkApproval();

    // Load line items
    if (!HAS_LI.includes(page)) { setLineItems([]); return; }
    const [table, field] = LI_MAP[page] || [];
    if (!table || !supabase) return;
    setLoadingLI(true);
    supabase.from(table).select('*').eq(field, record.id).then(({ data }) => {
      setLineItems((data||[]).map(r=>({ _id:r.id, product:r.product_name||'', quantity:Number(r.quantity??1), price:Number(r.price??0), discount:Number(r.discount??0) })));
      setLoadingLI(false);
    });
  }, [record.id, page]);

  const set = (k,v) => { setIsDirty(true); setEdited(p=>({...p,[k]:v})); };

  // Inline field validation
  const [fieldErrors, setFieldErrors] = useState({});
  const setFieldError = (k, msg) => setFieldErrors(p=>({...p,[k]:msg}));
  const clearFieldError = (k) => setFieldErrors(p=>({...p,[k]:''}));
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validateEmail = (v) => !v || EMAIL_RE.test(v) ? '' : 'Invalid email address';
  const validatePhone = (v) => {
    if (!v) return '';
    const digits = v.replace(/\D/g,'');
    return digits.length >= 7 && digits.length <= 15 ? '' : 'Phone: 7–15 digits';
  };
  const fields     = getObjectFields(page);
  const statusOpts = getStatusOptions(page);

  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async (andClose = false) => {
    setSaving(true);
    await updateRecord(page, edited, lineItems);
    setIsDirty(false);
    setSaving(false);
    if (andClose) { onClose(); } else { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2500); }
  };

  const handleSubmitForApproval = async () => {
    setSubmitting(true);
    await submitForApproval(page, record.id, record.name, { ...record });
    setSubmitting(false);
    setEdited(p=>({...p, status:'Pending Approval'}));
    setMatchingProcess(null);
  };

  // Section definitions per page
  const PAGE_SECTIONS = {
    customers:    [{icon:'🏢',title:'Basic Info',fields:['name','industry','website','gstNumber']},{icon:'📞',title:'Contact Info',fields:['phone','email']},{icon:'👤',title:'Ownership',fields:['owner','status']},{icon:'💬',title:'Comments',fields:['comments']}],
    contacts:     [{icon:'👤',title:'Personal Info',fields:['name','designation','department','isPrimary']},{icon:'📞',title:'Contact Info',fields:['email','phone','mobile','linkedIn']},{icon:'🏢',title:'Relationship',fields:['customer','owner','status']},{icon:'💬',title:'Comments',fields:['comments']}],
    leads:        [{icon:'🎯',title:'Lead Info',fields:['name','source','amount','expectedCloseDate']},{icon:'🏢',title:'Relationship',fields:['customer','contact','email','phone']},{icon:'📍',title:'Addresses',fields:['billingAddress','shippingAddress']},{icon:'👤',title:'Ownership',fields:['owner','status']},{icon:'💬',title:'Comments',fields:['comments']}],
    opportunities:[{icon:'💼',title:'Opportunity Info',fields:['name','stage','amount','closeDate','probability']},{icon:'🏢',title:'Relationship',fields:['customer','contact','campaign']},{icon:'📍',title:'Addresses',fields:['billingAddress','shippingAddress']},{icon:'👤',title:'Ownership',fields:['owner','status']},{icon:'💬',title:'Comments',fields:['comments']}],
    orders:       [{icon:'🛒',title:'Order Info',fields:['name','currency','paymentTerms','deliveryDate']},{icon:'🏢',title:'Relationship',fields:['customer','contact']},{icon:'👤',title:'Ownership',fields:['owner','status']},{icon:'💬',title:'Comments',fields:['comments']}],
    invoices:     [{icon:'🧾',title:'Invoice Info',fields:['name','dueDate','paymentTerms']},{icon:'🏢',title:'Relationship',fields:['customer','contact']},{icon:'👤',title:'Ownership',fields:['owner','status']},{icon:'💬',title:'Comments',fields:['comments']}],
    activities:   [{icon:'📅',title:'Activity Info',fields:['name','activityType','activityDate','dueDate','priority']},{icon:'🏢',title:'Relationship',fields:['customer','contact']},{icon:'👤',title:'Ownership',fields:['owner','status']},{icon:'💬',title:'Comments',fields:['comments']}],
    products:     [{icon:'📦',title:'Product Info',fields:['name','productFamily','category','sku','unit']},{icon:'💰',title:'Pricing',fields:['price','cost','taxRate']},{icon:'📊',title:'Status',fields:['status']},{icon:'💬',title:'Comments',fields:['comments']}],
  };

  const sections = PAGE_SECTIONS[page] || [{icon:'📋',title:'Details',fields:fields}];

  const LABEL_MAP = {
    name:'Name', status:'Status', owner:'Owner', customer:'Customer', contact:'Contact',
    email:'Email', phone:'Phone', mobile:'Mobile', website:'Website', industry:'Industry',
    gstNumber:'GST / Tax Number', primaryContact:'Primary Contact', description:'Description',
    stage:'Stage', amount:'Amount', closeDate:'Close Date', probability:'Probability (%)',
    expectedCloseDate:'Expected Close', campaign:'Campaign Source', designation:'Designation',
    department:'Department', isPrimary:'Primary Contact', linkedIn:'LinkedIn',
    activityType:'Activity Type', activityDate:'Activity Date', priority:'Priority',
    dueDate:'Due Date', billingAddress:'Billing Address', shippingAddress:'Shipping Address',
    paymentTerms:'Payment Terms', deliveryDate:'Delivery Date', currency:'Currency',
    notes:'Notes', source:'Lead Source', productFamily:'Product Family', category:'Category',
    sku:'SKU / Code', price:'Unit Price', cost:'Cost Price', taxRate:'Tax Rate (%)',
    unit:'Unit of Measure', comments:'Comments',
  };

  const PRIORITY_OPTS = ['Low','Medium','High','Critical'];
  const ACTIVITY_TYPES = ['Call','Meeting','Email','Demo','Follow Up','Task','Note','Site Visit','Proposal','Other'];
  const LEAD_SOURCES = ['Website','Cold Call','Email Campaign','Referral','Social Media','Trade Show','Partner','Advertisement','Inbound','Other'];
  const INDUSTRIES = ['Technology','Manufacturing','Retail','Healthcare','Finance','Real Estate','Education','Consulting','Media','Logistics','FMCG','Automotive','Energy','Government','Other'];
  const PAYMENT_TERMS_OPTS = ['Due on Receipt','Net 15','Net 30','Net 45','Net 60','Net 90'];
  const CURRENCIES = ['INR','USD','EUR','GBP','AED','SGD','AUD','CAD','JPY','CNY'];
  const STAGES = ['Prospecting','Qualification','Needs Analysis','Value Proposition','Proposal Sent','Negotiation','Closed Won','Closed Lost','On Hold'];

  const renderField = (field) => {
    const v = edited[field];
    if (field==='status') return (
      <select value={v||''} onChange={e=>set('status',e.target.value)} className={sCls}>
        {statusOpts.map(s=><option key={s}>{s}</option>)}
      </select>
    );
    if (field==='customer')     return <SearchableSelect
              value={edited.customerId||''}
              onChange={v=>{const c=[...customers,...pendingCustomers].find(x=>x.id===v);if(c)setEdited(p=>({...p,customerId:c.id,customer:c.name}));}}
              options={[...customers,...pendingCustomers.filter(pc=>!customers.find(c=>c.id===pc.id))].map(c=>({value:c.id,label:c.name,sub:[c.email,c.phone,c.industry,c.city].filter(Boolean).join(' · ')}))}
              placeholder="Select customer" emptyLabel="No customer"
              onCreateNew={q=>setQuickCreate({type:'customer',prefillName:q,onCreated:(id,name)=>{setEdited(p=>({...p,customerId:id,customer:name}));setPendingCustomers(prev=>[...prev,{id,name}]);}})}
              createLabel="Create Customer"
            />;
    if (field==='contact')      return <SearchableSelect
              value={edited.contactId||''}
              onChange={v=>{const c=[...contacts,...pendingContacts].find(x=>x.id===v);if(c)setEdited(p=>({...p,contactId:c.id,contact:c.name}));}}
              options={[...contacts,...pendingContacts.filter(pc=>!contacts.find(c=>c.id===pc.id))].map(c=>({value:c.id,label:c.name,sub:[c.email,c.phone,c.designation,c.customer].filter(Boolean).join(' · ')}))}
              placeholder="Select contact" emptyLabel="No contact"
              onCreateNew={q=>setQuickCreate({type:'contact',prefillName:q,prefillExtra:{customerId:edited.customerId,customer:edited.customer},onCreated:(id,name)=>{setEdited(p=>({...p,contactId:id,contact:name}));setPendingContacts(prev=>[...prev,{id,name}]);}})}
              createLabel="Create Contact"
            />;
    if (field==='owner')
      return <OwnerField
        record={record}
        edited={edited}
        onPick={u => { set('owner_id', u?.id || ''); set('owner', u?.email || ''); }}
      />;
    if (field==='stage')        return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}>{STAGES.map(s=><option key={s}>{s}</option>)}</select>;
    if (field==='source')       return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}><option value=''>Select source</option>{LEAD_SOURCES.map(s=><option key={s}>{s}</option>)}</select>;
    if (field==='activityType') return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}><option value=''>Select type</option>{ACTIVITY_TYPES.map(s=><option key={s}>{s}</option>)}</select>;
    if (field==='paymentTerms') return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}><option value=''>Select terms</option>{PAYMENT_TERMS_OPTS.map(s=><option key={s}>{s}</option>)}</select>;
    if (field==='isPrimary')    return <label className='flex items-center gap-2 cursor-pointer pt-1'><input type='checkbox' checked={!!v} onChange={e=>set(field,e.target.checked)} className='w-4 h-4 accent-blue-600'/><span className='text-sm text-[#0F172A]'>Yes, mark as primary contact</span></label>;
    if (field==='category')     return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}><option value="">Select</option>{['Software','Hardware','Service','Subscription','Consulting','Other'].map(s=><option key={s}>{s}</option>)}</select>;
    if (field==='productFamily') return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}><option value="">Select Family</option>{['Software Products','Hardware Products','Professional Services','Managed Services','Subscriptions','Other'].map(s=><option key={s}>{s}</option>)}</select>;
    if (field==='industry')
      return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}>
        <option value="">Select industry</option>
        {INDUSTRIES.map(i=><option key={i}>{i}</option>)}
      </select>;
    if (['billingAddress','shippingAddress'].includes(field))
      return <AddressSelector
        customerId={edited.customerId || edited.customer_id}
        value={v || ''}
        onChange={val => set(field, val)}
        placeholder="Select saved address or type"
      />;
    if (['closeDate','activityDate','deliveryDate','dueDate','validity_date','expectedCloseDate','activityDate'].includes(field))
      return <input type="date" value={v||''} onChange={e=>set(field,e.target.value)} className={iCls}/>;
    if (field==='comments')
      return <textarea rows={3} value={v||''} onChange={e=>set(field,e.target.value)} className={tCls} placeholder="Add comments or working notes..."/>;
    if (field==='notes'||field==='internal_notes') return <textarea rows={4} value={v||''} onChange={e=>set(field,e.target.value)} className={tCls} placeholder="Notes..."/>;
    { // Default field with type-aware validation
      const isEmail = ['email'].includes(field);
      const isPhone = ['phone','mobile','fax'].includes(field);
      const inputType = ['amount','price','overall_discount','shipping_cost'].includes(field)?'number':isEmail?'email':'text';
      const handleChange = (e) => {
        let val = e.target.value;
        if (isPhone) val = val.replace(/[^0-9+\-() ]/g,''); // strip non-phone chars
        set(field, val);
        if (isEmail) setFieldError(field, validateEmail(val));
        if (isPhone) setFieldError(field, validatePhone(val));
      };
      return (
        <div>
          <input type={inputType} value={v||''} onChange={handleChange}
            placeholder={isEmail?'name@company.com':isPhone?'Phone number':field.replace(/([A-Z])/g,' $1').trim()}
            maxLength={isPhone?16:undefined}
            className={`${iCls} ${fieldErrors[field]?'border-red-400 ring-1 ring-red-300':''}`}/>
          {fieldErrors[field] && <p className="text-xs text-red-500 mt-1">{fieldErrors[field]}</p>}
        </div>
      );
    }
  };

  const isPendingApproval = edited.status === 'Pending Approval';
  // Hide Submit button when record is in these statuses
  const noSubmitStatuses  = ['Pending Approval', 'Approved'];
  const canSubmitForApproval = matchingProcess != null
    && !noSubmitStatuses.includes(edited.status)
    && !checkingApproval;

  const ownerUser = enterpriseUsers.find(u => u.id === edited.owner_id || u.email === edited.owner);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] overflow-y-auto">
        <div className="bg-white rounded-[28px] shadow-2xl w-[98vw] my-4 mx-auto overflow-hidden flex flex-col" style={{minHeight:'95vh'}}>

          {/* Header */}
          <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-8 py-5 text-white flex items-center justify-between flex-shrink-0">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold">{edited.name||edited.subject||getPageLabel(page)}</h2>
                <Pill status={edited.status}/>
                {ownerUser && <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full">👤 {ownerUser.first_name} {ownerUser.last_name}</span>}
              </div>
              <p className="text-blue-300 text-sm mt-1 flex items-center gap-2 flex-wrap">
                <span className="bg-blue-600 text-white font-mono font-bold px-3 py-0.5 rounded-full text-xs tracking-wider shadow-sm">
                  {record.displayNumber
                    ? formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', record.displayNumber)
                    : `${PAGE_DISPLAY_PREFIX[page]||'REC'}-${String(record.id||'').slice(-5).padStart(5,'0')}`}
                </span>
                <span className="text-blue-300">{getPageLabel(page)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {page==='leads'&&record.status==='Qualified'&&<button onClick={()=>{convertLeadToOpportunity(record);onClose();}} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold">🔀 Convert</button>}

              {page==='orders'&&<button onClick={()=>{createInvoiceFromOrder(record);onClose();}} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold">🧾 Create Invoice</button>}
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg">✕</button>
            </div>
          </div>

          {/* Action bar — top */}
          <div className="bg-white border-b border-blue-100 px-8 py-3 flex items-center justify-between flex-shrink-0">
            <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0F172A] font-semibold transition-all">
              ← Back to list
            </button>
            {/* CPQ-off: Create Order directly from Opportunity */}
            {page === 'opportunities' && appPreferences?.cpq_enabled === false && (
              <button onClick={async () => { await createOrderFromOpportunity(record); alert('Order created! View in Orders.'); onClose(); }}
                className="flex items-center gap-2 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 shadow-md">
                🛒 Create Order
              </button>
            )}
            {(page!=='customers'||tab==='details') && (
              <div className="flex items-center gap-3">
                {saveSuccess && <span className="text-green-600 text-sm font-semibold flex items-center gap-1">✓ Saved</span>}
                <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={() => handleSave(false)} disabled={saving || !isDirty} className={`px-4 py-2 text-sm rounded-xl font-semibold transition-all ${isDirty&&!saving?'bg-blue-100 hover:bg-blue-200 text-blue-700':'bg-gray-100 text-gray-400 cursor-not-allowed'} disabled:opacity-50`}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => handleSave(true)} disabled={saving || !isDirty} className="px-5 py-2 text-sm rounded-xl font-semibold bg-gradient-to-r from-[#0F172A] to-blue-800 text-white hover:opacity-90 disabled:opacity-50 shadow-md">
                  {saving ? 'Saving…' : 'Save & Close'}
                </button>
              </div>
            )}
          </div>

          {/* Tabs — shown for customers (360 tab) and products (configuration tab) */}
          {(page==='customers'||page==='products')&&(
            <div className="flex gap-1 px-8 pt-4 bg-gray-50 border-b border-blue-100">
              {(page==='products'
              ? [{key:'details',label:'📋 Details'},{key:'configuration',label:'⚙️ Configuration'}]
              : page==='customers'
              ? [{key:'details',label:'📋 Details'},{key:'360',label:'🔄 Customer 360'}]
              : [{key:'details',label:'📋 Details'}]
            ).map(t=>(
                <button key={t.key} onClick={()=>setTab(t.key)} className={`px-5 py-2.5 rounded-t-xl text-sm font-semibold whitespace-nowrap transition-all ${tab===t.key?'bg-white text-[#0F172A] border border-b-white border-blue-200 -mb-px shadow-sm':'text-gray-500 hover:text-[#0F172A]'}`}>{t.label}</button>
              ))}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto bg-gradient-to-br from-white to-blue-50 p-8 space-y-6">

            {/* Approval banner — only on details tab */}
            {tab==='details' && (
              <ApprovalBanner recordId={record.id} recordType={page} onDecision={async()=>{
                if(supabase && record.id){
                  const tbl={'customers':'customers','leads':'leads','opportunities':'opportunities','orders':'orders','invoices':'invoices','contacts':'contacts','activities':'activities','products':'products'}[page];
                  if(tbl){const idField={'customers':'customer_number','leads':'lead_number','opportunities':'opportunity_number','orders':'order_number','invoices':'invoice_number','contacts':'contact_number','activities':'activity_number','products':'product_number'}[page]||'id';const{data:fresh}=await supabase.from(tbl).select('status').eq(idField,record.id).maybeSingle();if(fresh?.status)setEdited(p=>({...p,status:fresh.status}));}
                }
                const proc=await checkMatchingApprovalProcess(page,{...edited});setMatchingProcess(proc);
              }}/>
            )}

            {/* ── Product Configuration tab ─────────────────────────────── */}
            {page==='products' && tab==='configuration' && (
              <ProductConfigurator product={record}/>
            )}

            {/* ── Customer 360 tab ──────────────────────────────────────── */}
            {page==='customers' && tab==='360' && (
              <Customer360
                customer={edited}
                onSubRecordOpen={(subPage,subRec)=>{
                  window.dispatchEvent(new CustomEvent('open-crm-record',{detail:{page:subPage,record:subRec,returnTo:{page:'customers',record:edited,tab:'360'}}}));
                  onClose();
                }}
                onCreateFor={(subPage)=>setCreateForPage(subPage)}
              />
            )}

            {/* ── Details tab ───────────────────────────────────────────── */}
            {tab==='details' && (
              <>
                {/* Record Number badge */}
                <div className="flex items-center gap-3 px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{getPageLabel(page)} Number</span>
                  <span className="font-mono font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full text-sm border border-blue-200">
                    {record.displayNumber
                      ? formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', record.displayNumber)
                      : `${PAGE_DISPLAY_PREFIX[page]||'REC'}-${String(record.id||'').replace(/[^0-9]/g,'').slice(-5).padStart(5,'0')||'00001'}`}
                  </span>
                </div>

                {/* AI Summary */}
                <AISummary page={page} record={record}/>

                {/* Field sections */}
                <div className="space-y-5">
                  {sections.map(section=>(
                    <div key={section.title} className="bg-white rounded-[20px] border border-blue-100 shadow-sm">
                      <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 flex items-center gap-2">
                        <span className="text-lg">{section.icon}</span>
                        <span className="font-bold text-[#0F172A] text-sm">{section.title}</span>
                      </div>
                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {section.fields.filter(f=>fields.includes(f)||['notes','description','comments'].includes(f)).map(field=>(
                          <div key={field} className={`space-y-1.5 ${['notes','description','comments','billingAddress','shippingAddress'].includes(field)?'md:col-span-2 xl:col-span-3':''}`}>
                            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">
                              {LABEL_MAP[field]||field.replace(/([A-Z])/g,' $1').trim()}
                            </label>
                            {renderField(field)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {(page==='customers'||page==='contacts') && record.id && (
                    <div className="bg-white rounded-[20px] border border-blue-100 shadow-sm">
                      <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 flex items-center gap-2">
                        <span className="text-lg">📍</span><span className="font-bold text-[#0F172A] text-sm">Addresses</span>
                      </div>
                      <div className="p-5"><AddressManager ownerType={page==='customers'?'customer':'contact'} ownerId={record.id}/></div>
                    </div>
                  )}
                </div>

                {/* Line Items */}
                {HAS_LI.includes(page) && (loadingLI
                  ? <div className="bg-white rounded-[24px] border border-blue-100 p-8 text-center text-gray-400">Loading line items…</div>
                  : <LineItemsTable items={lineItems} setItems={setLineItems} products={products}/>
                )}

                {/* System Information */}
                <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-[#0F172A]">System Information</h3>
                    <span className="text-2xl">🛡️</span>
                  </div>
                  <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[['Created By',record.created_by||'-'],['Created At',record.created_at?formatDateTime(record.created_at):'-'],['Updated By',record.updated_by||'-'],['Updated At',record.updated_at?formatDateTime(record.updated_at):'-'],['Organization',organizations.find(o=>o.id===record.organization_id)?.name||'-'],['Business Unit',businessUnits.find(b=>b.id===record.business_unit_id)?.name||'-'],['Record ID',record.id||'-'],['Owner',ownerUser?`${ownerUser.first_name} ${ownerUser.last_name}`:(record.owner||'-')]].map(([lbl,val])=>(
                      <div key={lbl}>
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{lbl}</div>
                        <div className="text-sm text-[#0F172A] font-medium bg-gray-50 rounded-xl px-3 py-2 truncate">{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer — approval + line item count only */}
          <div className="px-8 py-3 border-t border-blue-100 bg-gray-50 flex items-center gap-3 flex-shrink-0">
            {checkingApproval&&<span className="text-xs text-gray-400">Checking approval rules…</span>}
            {canSubmitForApproval&&(
              <button onClick={handleSubmitForApproval} disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl font-semibold bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200 disabled:opacity-50"
                title={`Process: ${matchingProcess?.name}`}>
                📋 {submitting ? 'Submitting…' : 'Submit for Approval'}
                <span className="bg-purple-200 text-purple-800 text-xs px-2 py-0.5 rounded-full">{matchingProcess?.name}</span>
              </button>
            )}
            {HAS_LI.includes(page)&&<span className="text-xs text-gray-400 ml-auto">{lineItems.length} line item{lineItems.length!==1?'s':''}</span>}
          </div>
        </div>
      </div>

      {/* Sub-record quick view (from Customer360 row click) */}


      {/* Create record for Customer360 */}
      {createForPage && (
        <CreateRecordModal
          page={createForPage}
          open={true}
          prefillCustomer={{ id: edited.id, name: edited.name }}
          onClose={() => setCreateForPage(null)}
        />
      )}
      <QuickCreateModal
        objectType={quickCreate?.type}
        open={!!quickCreate}
        onClose={()=>setQuickCreate(null)}
        prefill={quickCreate?.prefillName ? { name: quickCreate.prefillName } : {}}
        prefillExtra={quickCreate?.prefillExtra||{}}
        onCreated={(id,name)=>{quickCreate?.onCreated?.(id,name);setQuickCreate(null);}}
      />
    </>
  );
}
