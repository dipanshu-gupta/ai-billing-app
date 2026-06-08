// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import {
  getObjectFields, getStatusOptions, getPageLabel,
  formatCurrency, formatDateTime, getStatusColor,
} from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import CreateRecordModal from '@/components/crm/CreateRecordModal';
import AISummary from '@/components/ai/AISummary';

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

// ─── Approval Banner ──────────────────────────────────────────────────────────
function ApprovalBanner({ recordId, recordType, onDecision }) {
  const { currentUser, approvalRequests, processApproval } = useApp();
  const [request,    setRequest]    = useState(null);
  const [step,       setStep]       = useState(null);
  const [isApprover, setIsApprover] = useState(false);
  const [comment,    setComment]    = useState('');
  const [deciding,   setDeciding]   = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!supabase || !currentUser || !recordId) return;
      const { data: reqs } = await supabase.from('approval_requests').select('*')
        .eq('record_id', recordId).eq('record_type', recordType).eq('status','Pending');
      if (!reqs?.length) { setRequest(null); setIsApprover(false); return; }
      const req = reqs[0]; setRequest(req);
      const { data: stepData } = await supabase.from('approval_steps').select('*').eq('id', req.current_step_id).single();
      if (!stepData) return;
      setStep(stepData);
      setIsApprover(stepData.approver_user_id === currentUser.id);
    };
    load();
  }, [recordId, recordType, currentUser?.id, approvalRequests.length]);

  if (!request) return null;

  const handleDecision = async (decision) => {
    setDeciding(true);
    await processApproval(request.id, decision, comment);
    setComment(''); setDeciding(false);
    if (onDecision) onDecision();
  };

  return (
    <div className={`rounded-[24px] border-2 p-5 ${isApprover ? 'border-yellow-300 bg-yellow-50' : 'border-blue-200 bg-blue-50'}`}>
      <div className="flex items-start gap-4">
        <div className="text-3xl">⏳</div>
        <div className="flex-1">
          <div className="font-bold text-[#0F172A] text-lg mb-1">Pending Approval</div>
          <div className="text-sm text-gray-600 mb-1">Submitted by <span className="font-semibold">{request.submitted_by}</span>
            {step && <span> · Step: <span className="font-semibold">{step.step_name}</span></span>}
          </div>
          <div className="text-xs text-gray-400">Request #{request.request_number}</div>
          {isApprover ? (
            <div className="mt-4 space-y-3">
              <div className="bg-white rounded-2xl border border-yellow-200 p-3">
                <p className="text-sm font-semibold text-yellow-800 mb-2">✋ Your approval is required</p>
                <input value={comment} onChange={e=>setComment(e.target.value)} placeholder="Add a comment (optional)..." className={iCls}/>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>handleDecision('Approved')} disabled={deciding} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-50 shadow-lg">
                  {deciding ? 'Processing...' : '✅ Approve'}
                </button>
                <button onClick={()=>handleDecision('Rejected')} disabled={deciding} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-50 shadow-lg">
                  {deciding ? 'Processing...' : '❌ Reject'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 bg-white rounded-2xl border border-blue-200 px-4 py-3">
              <p className="text-sm text-blue-700">Waiting for approver to review this record.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Line Items Table ─────────────────────────────────────────────────────────
function LineItemsTable({ items, setItems, products }) {
  const add    = () => setItems(p => [...p, { _id:Date.now(), product:'', quantity:1, price:0, discount:0 }]);
  const remove = idx => setItems(p => p.filter((_,i)=>i!==idx));
  const upd    = (idx, field, raw) => setItems(p => p.map((r,i) => {
    if (i !== idx) return r;
    if (field==='product') { const pr=products.find(x=>x.name===raw); return {...r,product:raw,price:pr?pr.price:r.price}; }
    return { ...r, [field]: ['quantity','price','discount'].includes(field) ? Number(raw) : raw };
  }));
  const sub   = items.reduce((s,r)=>s+r.quantity*r.price,0);
  const disc  = items.reduce((s,r)=>s+r.quantity*r.price*(r.discount/100),0);
  const grand = sub - disc;
  const fmt   = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);

  return (
    <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 flex items-center justify-between">
        <div><h3 className="text-white font-bold text-lg">Line Items</h3><p className="text-blue-300 text-xs mt-0.5">Products · Discounts · Totals</p></div>
        <button onClick={add} className="bg-white text-[#0F172A] px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50">+ Add Item</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-blue-50 border-b border-blue-100">
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500" style={{minWidth:200}}>Product</th>
            <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-500 w-20">Qty</th>
            <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500 w-32">Price (₹)</th>
            <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-500 w-28">Disc (%)</th>
            <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500 w-32">Total</th>
            <th className="w-10"/>
          </tr></thead>
          <tbody>
            {items.length===0
              ? <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">No items. Click + Add Item.</td></tr>
              : items.map((row,idx)=>{
                  const lt=row.quantity*row.price*(1-row.discount/100);
                  return (
                    <tr key={row._id??idx} className="border-t border-blue-50 hover:bg-slate-50">
                      <td className="px-4 py-2"><select value={row.product} onChange={e=>upd(idx,'product',e.target.value)} className={sCls}><option value="">— Select —</option>{products.map(p=><option key={p.id} value={p.name}>{p.name} — {fmt(p.price)}</option>)}</select></td>
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
          {items.length>0&&(
            <tfoot className="border-t-2 border-blue-100">
              <tr className="bg-gray-50"><td colSpan={4} className="px-5 py-2.5 text-right text-sm text-gray-500">Subtotal</td><td className="px-4 py-2.5 text-right text-sm font-semibold">{fmt(sub)}</td><td/></tr>
              {disc>0&&<tr className="bg-green-50"><td colSpan={4} className="px-5 py-2.5 text-right text-sm text-green-600">Discount</td><td className="px-4 py-2.5 text-right text-sm font-semibold text-green-600">- {fmt(disc)}</td><td/></tr>}
              <tr className="bg-[#0F172A]"><td colSpan={4} className="px-5 py-3 text-right font-bold text-white">Grand Total</td><td className="px-4 py-3 text-right font-bold text-white text-lg">{fmt(grand)}</td><td/></tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
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
      cols:[{h:'Name',v:r=>r.name},{h:'Email',v:r=>r.email||'-'},{h:'Phone',v:r=>r.phone||'-'},{h:'Designation',v:r=>r.designation||'-'},{h:'Status',v:r=><Pill status={r.status}/>}] },
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


// ─── SubRecordViewer — simple read/edit panel for Customer360 sub-records ─────
// Avoids recursive import of RecordDetailPanel
function SubRecordViewer({ page, record, onClose }) {
  const { updateRecord, customers, contacts, products, enterpriseUsers, organizations, businessUnits } = useApp();
  const [edited, setEdited] = useState({ ...record });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setEdited(p => ({...p,[k]:v}));
  const statusOpts = getStatusOptions(page);
  const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n||0);
  const ownerUser = enterpriseUsers.find(u => u.id === record.owner_id || u.email === record.owner);

  const handleSave = async () => {
    setSaving(true);
    await updateRecord(page, edited, []);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[130] overflow-y-auto flex items-center justify-center p-4">
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">{edited.name || edited.subject || getPageLabel(page)}</h3>
            <p className="text-blue-300 text-sm">{record.id} · {getPageLabel(page)}{ownerUser?` · 👤 ${ownerUser.first_name} ${ownerUser.last_name}`:''}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg">✕</button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            {getObjectFields(page).map(field => {
              const v = edited[field];
              return (
                <div key={field} className="bg-gray-50 rounded-2xl p-3 border border-blue-100">
                  <label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">{field.replace(/([A-Z])/g,' $1').trim()}</label>
                  {field==='status'
                    ? <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}>{statusOpts.map(s=><option key={s}>{s}</option>)}</select>
                    : field==='customer'
                    ? <select value={edited.customerId||''} onChange={e=>{const c=customers.find(x=>x.id===e.target.value);setEdited(p=>({...p,customerId:c?.id||'',customer:c?.name||''}));}} className={sCls}><option value="">Select</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    : field==='owner'
                    ? <select value={edited.owner_id||''} onChange={e=>{const u=enterpriseUsers.find(x=>x.id===e.target.value);setEdited(p=>({...p,owner_id:u?.id||'',owner:u?.email||''}));}} className={sCls}><option value="">Unassigned</option>{enterpriseUsers.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select>
                    : ['closeDate','activityDate','deliveryDate','dueDate'].includes(field)
                    ? <input type="date" value={v||''} onChange={e=>set(field,e.target.value)} className={iCls}/>
                    : ['amount','price'].includes(field)
                    ? <input type="number" value={v||''} onChange={e=>set(field,e.target.value)} className={iCls}/>
                    : field==='notes'
                    ? <textarea rows={3} value={v||''} onChange={e=>set(field,e.target.value)} className={tCls}/>
                    : <input type="text" value={v||''} onChange={e=>set(field,e.target.value)} className={iCls}/>
                  }
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-blue-100">
            {[['Created By',record.created_by],['Updated By',record.updated_by],['Organization',organizations.find(o=>o.id===record.organization_id)?.name],['Business Unit',businessUnits.find(b=>b.id===record.business_unit_id)?.name]].map(([l,v])=>(
              <div key={l}><div className="text-xs text-gray-400 font-bold uppercase mb-1">{l}</div><div className="text-sm text-[#0F172A] bg-gray-50 rounded-xl px-3 py-2">{v||'-'}</div></div>
            ))}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-blue-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-2xl border border-blue-200 text-sm font-semibold text-[#0F172A] hover:bg-blue-50">Close</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#0F172A] to-blue-800 text-white text-sm font-semibold disabled:opacity-50">
            {saving?'Saving…':'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main RecordDetailPanel ───────────────────────────────────────────────────
export default function RecordDetailPanel({ page, record, onClose }) {
  const {
    customers, contacts, products, organizations, businessUnits, enterpriseUsers,
    updateRecord, submitForApproval, checkMatchingApprovalProcess,
    convertLeadToOpportunity, createInvoiceFromOrder,
    currentUserPermissions, permissionsLoaded,
  } = useApp();

  // Local permission helper (mirrors CRMListPage canDo)
  const canEdit = () => {
    if (!permissionsLoaded || currentUserPermissions.length === 0) return true;
    return currentUserPermissions.includes(`${page}_edit`);
  };

  const [edited,          setEdited]          = useState({ ...record });
  const [lineItems,       setLineItems]       = useState([]);
  const [loadingLI,       setLoadingLI]       = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [tab,             setTab]             = useState('details');
  const [matchingProcess, setMatchingProcess] = useState(null);
  const [checkingApproval,setCheckingApproval]= useState(false);
  // Sub-record state for Customer360
  const [subRecord,   setSubRecord]   = useState(null); // { page, record }
  const [createForPage, setCreateForPage] = useState(null); // page string

  useEffect(() => {
    setEdited({ ...record });
    setTab('details');
    setSubRecord(null);

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

  const set = (k,v) => setEdited(p=>({...p,[k]:v}));
  const fields     = getObjectFields(page);
  const statusOpts = getStatusOptions(page);

  const handleSave = async () => {
    setSaving(true);
    await updateRecord(page, edited, lineItems);
    setSaving(false);
    onClose();
  };

  const handleSubmitForApproval = async () => {
    setSubmitting(true);
    await submitForApproval(page, record.id, record.name, { ...record });
    setSubmitting(false);
    setEdited(p=>({...p, status:'Pending Approval'}));
    setMatchingProcess(null);
  };

  const renderField = (field) => {
    const v = edited[field];
    if (field==='status')       return <select value={v||''} onChange={e=>set('status',e.target.value)} className={sCls}>{statusOpts.map(s=><option key={s}>{s}</option>)}</select>;
    if (field==='customer')     return <select value={edited.customerId||''} onChange={e=>{const c=customers.find(x=>x.id===e.target.value);setEdited(p=>({...p,customerId:c?.id||'',customer:c?.name||''}));}} className={sCls}><option value="">Select</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>;
    if (field==='contact')      return <select value={edited.contactId||''} onChange={e=>{const c=contacts.find(x=>x.id===e.target.value);setEdited(p=>({...p,contactId:c?.id||'',contact:c?.name||''}));}} className={sCls}><option value="">Select</option>{contacts.filter(c=>!edited.customerId||c.customerId===edited.customerId).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>;
    if (field==='owner')        return <select value={edited.owner_id||''} onChange={e=>{const u=enterpriseUsers.find(x=>x.id===e.target.value);setEdited(p=>({...p,owner_id:u?.id||'',owner:u?.email||''}));}} className={sCls}><option value="">Unassigned</option>{enterpriseUsers.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select>;
    if (field==='stage')        return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}>{['Qualification','Proposal Sent','Negotiation','Closed Won','Closed Lost'].map(s=><option key={s}>{s}</option>)}</select>;
    if (field==='source')       return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}>{['Website','Campaign','Referral','Cold Call','Trade Show','Partner'].map(s=><option key={s}>{s}</option>)}</select>;
    if (field==='activityType') return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}>{['Call','Meeting','Email','Task','Demo'].map(s=><option key={s}>{s}</option>)}</select>;
    if (field==='paymentTerms') return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}>{['Due on Receipt','Net 15','Net 30','Net 45'].map(s=><option key={s}>{s}</option>)}</select>;
    if (field==='isPrimary')    return <select value={v?'Yes':'No'} onChange={e=>set(field,e.target.value==='Yes')} className={sCls}><option>No</option><option>Yes</option></select>;
    if (field==='category')     return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}><option value="">Select</option>{['Software','Hardware','Service','Subscription','Consulting','Other'].map(s=><option key={s}>{s}</option>)}</select>;
    if (field==='productFamily') return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}><option value="">Select Family</option>{['Software Products','Hardware Products','Professional Services','Managed Services','Subscriptions','Other'].map(s=><option key={s}>{s}</option>)}</select>;
    if (['closeDate','activityDate','deliveryDate','dueDate','validity_date'].includes(field)) return <input type="date" value={v||''} onChange={e=>set(field,e.target.value)} className={iCls}/>;
    if (field==='notes'||field==='internal_notes') return <textarea rows={4} value={v||''} onChange={e=>set(field,e.target.value)} className={tCls} placeholder="Notes..."/>;
    return <input type={['amount','price','overall_discount','shipping_cost'].includes(field)?'number':'text'} value={v||''} onChange={e=>set(field,e.target.value)} placeholder={field.replace(/([A-Z])/g,' $1').trim()} className={iCls}/>;
  };

  const isPendingApproval = edited.status === 'Pending Approval';
  const decisionStatuses  = ['Approved','Rejected','Pending Approval'];
  const canSubmitForApproval = matchingProcess != null && !decisionStatuses.includes(edited.status) && !checkingApproval;

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
              <p className="text-blue-300 text-sm mt-1">ID: {record.id} · {getPageLabel(page)}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {page==='leads'&&record.status==='Qualified'&&<button onClick={()=>{convertLeadToOpportunity(record);onClose();}} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold">🔀 Convert</button>}

              {page==='orders'&&<button onClick={()=>{createInvoiceFromOrder(record);onClose();}} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold">🧾 Create Invoice</button>}
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg">✕</button>
            </div>
          </div>

          {/* Customer tabs */}
          {page==='customers'&&(
            <div className="flex gap-1 px-8 pt-4 bg-gray-50 border-b border-blue-100">
              {[{key:'details',label:'📋 Details'},{key:'360',label:'🔄 Customer 360'}].map(t=>(
                <button key={t.key} onClick={()=>setTab(t.key)} className={`px-5 py-2.5 rounded-t-xl text-sm font-semibold whitespace-nowrap transition-all ${tab===t.key?'bg-white text-[#0F172A] border border-b-white border-blue-200 -mb-px shadow-sm':'text-gray-500 hover:text-[#0F172A]'}`}>{t.label}</button>
              ))}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-8 bg-gradient-to-br from-white to-blue-50 space-y-6">

            {/* Approval banner */}
            {(page!=='customers'||tab==='details')&&(
              <ApprovalBanner recordId={record.id} recordType={page} onDecision={()=>setEdited(p=>({...p,status:'—'}))}/>
            )}

            {/* Customer 360 */}
            {page==='customers'&&tab==='360'&&(
              <Customer360
                customer={edited}
                onSubRecordOpen={(subPage, subRec) => setSubRecord({ page: subPage, record: subRec })}
                onCreateFor={(subPage) => setCreateForPage(subPage)}
              />
            )}

            {/* Details */}
            {(page!=='customers'||tab==='details')&&(<>
              {/* AI Summary */}
              <AISummary page={page} record={record}/>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {fields.map(field=>(
                  <div key={field} className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">{field.replace(/([A-Z])/g,' $1').trim()}</label>
                    {renderField(field)}
                  </div>
                ))}
              </div>

              {HAS_LI.includes(page)&&(loadingLI
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
                  {[
                    ['Created By',    record.created_by || '-'],
                    ['Created At',    record.created_at ? formatDateTime(record.created_at) : '-'],
                    ['Updated By',    record.updated_by || '-'],
                    ['Updated At',    record.updated_at ? formatDateTime(record.updated_at) : '-'],
                    ['Organization',  organizations.find(o=>o.id===record.organization_id)?.name || '-'],
                    ['Business Unit', businessUnits.find(b=>b.id===record.business_unit_id)?.name || '-'],
                    ['Record ID',     record.id || '-'],
                    ['Owner',         ownerUser ? `${ownerUser.first_name} ${ownerUser.last_name}` : (record.owner || '-')],
                  ].map(([lbl,val])=>(
                    <div key={lbl}>
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{lbl}</div>
                      <div className="text-sm text-[#0F172A] font-medium bg-gray-50 rounded-xl px-3 py-2 truncate">{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>)}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 border-t border-blue-100 bg-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              {checkingApproval&&<span className="text-xs text-gray-400">Checking approval rules…</span>}
              {canSubmitForApproval&&(
                <button onClick={handleSubmitForApproval} disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-2xl font-semibold bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200 disabled:opacity-50"
                  title={`Process: ${matchingProcess?.name}`}>
                  📋 {submitting ? 'Submitting…' : 'Submit for Approval'}
                  <span className="bg-purple-200 text-purple-800 text-xs px-2 py-0.5 rounded-full">{matchingProcess?.name}</span>
                </button>
              )}
              <span className="text-sm text-gray-400">{HAS_LI.includes(page)&&`${lineItems.length} line item${lineItems.length!==1?'s':''}`}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-6 py-3 text-sm rounded-2xl font-semibold bg-white border border-blue-200 text-[#0F172A] hover:bg-blue-50">Close</button>
              {(page!=='customers'||tab==='details') && canEdit() && (
                <button onClick={handleSave} disabled={saving} className="px-6 py-3 text-sm rounded-2xl font-semibold bg-gradient-to-r from-[#0F172A] to-blue-800 text-white hover:opacity-90 disabled:opacity-50 shadow-lg">
                  {saving?'Saving…':'Save Changes'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sub-record quick view (from Customer360 row click) */}
      {subRecord && (
        <SubRecordViewer
          page={subRecord.page}
          record={subRecord.record}
          onClose={() => setSubRecord(null)}
        />
      )}

      {/* Create record for Customer360 */}
      {createForPage && (
        <CreateRecordModal
          page={createForPage}
          open={true}
          prefillCustomer={{ id: edited.id, name: edited.name }}
          onClose={() => setCreateForPage(null)}
        />
      )}
    </>
  );
}
