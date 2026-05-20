// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { getObjectFields, getStatusOptions, getPageLabel, formatCurrency, formatDateTime, getStatusColor } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';
const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';
const tCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none placeholder:text-gray-400';
const HAS_LI = ['leads', 'opportunities', 'orders', 'invoices'];
const LI_MAP = { leads: ['lead_line_items','lead_number'], opportunities: ['opportunity_line_items','opportunity_number'], orders: ['order_line_items','order_number'], invoices: ['invoice_line_items','invoice_number'] };

function Pill({ status }) {
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>{status}</span>;
}

function LineItemsTable({ items, setItems, products }) {
  const add = () => setItems(p => [...p, { _id: Date.now(), product: '', quantity: 1, price: 0, discount: 0 }]);
  const remove = idx => setItems(p => p.filter((_,i) => i !== idx));
  const upd = (idx, field, raw) => setItems(p => p.map((r,i) => {
    if (i !== idx) return r;
    if (field === 'product') { const pr = products.find(x => x.name === raw); return { ...r, product: raw, price: pr ? pr.price : r.price }; }
    return { ...r, [field]: ['quantity','price','discount'].includes(field) ? Number(raw) : raw };
  }));
  const sub = items.reduce((s,r) => s + r.quantity * r.price, 0);
  const disc = items.reduce((s,r) => s + r.quantity * r.price * (r.discount/100), 0);
  const grand = sub - disc;
  return (
    <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 flex items-center justify-between">
        <div><h3 className="text-white font-bold text-lg">Line Items</h3><p className="text-blue-300 text-xs mt-0.5">Products · Services · Discounts</p></div>
        <button onClick={add} className="bg-white text-[#0F172A] px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50 transition-all">+ Add Item</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-50 border-b border-blue-100">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500 tracking-wide" style={{minWidth:200}}>Product / Service</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-500 tracking-wide w-24">Qty</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500 tracking-wide w-36">Unit Price (₹)</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-500 tracking-wide w-32">Discount (%)</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500 tracking-wide w-36">Line Total</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center"><div className="text-5xl mb-3">📦</div><p className="text-gray-400 text-sm">No items yet.</p><button onClick={add} className="mt-3 text-blue-600 text-sm font-semibold hover:underline">+ Add first item</button></td></tr>
            ) : items.map((row, idx) => {
              const lt = row.quantity * row.price * (1 - row.discount/100);
              const hasDis = row.discount > 0;
              return (
                <tr key={row._id ?? idx} className="border-t border-blue-50 hover:bg-slate-50 transition-all">
                  <td className="px-4 py-2.5"><select value={row.product} onChange={e => upd(idx,'product',e.target.value)} className={sCls}><option value="">— Select product —</option>{products.map(p => <option key={p.id} value={p.name}>{p.name} — {formatCurrency(p.price)}</option>)}</select></td>
                  <td className="px-4 py-2.5"><input type="number" min={1} value={row.quantity} onChange={e => upd(idx,'quantity',e.target.value)} className={`${iCls} text-center`} /></td>
                  <td className="px-4 py-2.5"><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span><input type="number" min={0} value={row.price} onChange={e => upd(idx,'price',e.target.value)} className={`${iCls} text-right pl-7`} /></div></td>
                  <td className="px-4 py-2.5"><div className="relative"><input type="number" min={0} max={100} value={row.discount} onChange={e => upd(idx,'discount',e.target.value)} className={`${iCls} text-center pr-7 ${hasDis ? 'border-green-300 bg-green-50 text-green-700' : ''}`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span></div></td>
                  <td className="px-4 py-2.5 text-right"><div className="font-bold text-[#0F172A]">{formatCurrency(lt)}</div>{hasDis && <div className="text-xs text-green-600">-{formatCurrency(row.quantity*row.price*row.discount/100)} off</div>}</td>
                  <td className="px-2 py-2.5 text-center"><button onClick={() => remove(idx)} className="w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 text-red-500 flex items-center justify-center text-xs font-bold">✕</button></td>
                </tr>
              );
            })}
          </tbody>
          {items.length > 0 && (
            <tfoot className="border-t-2 border-blue-100">
              <tr className="bg-gray-50"><td colSpan={4} className="px-5 py-2.5 text-right text-sm text-gray-500">Subtotal</td><td className="px-4 py-2.5 text-right text-sm font-semibold text-[#0F172A]">{formatCurrency(sub)}</td><td /></tr>
              {disc > 0 && <tr className="bg-green-50"><td colSpan={4} className="px-5 py-2.5 text-right text-sm text-green-600">Total Discount</td><td className="px-4 py-2.5 text-right text-sm font-semibold text-green-600">− {formatCurrency(disc)}</td><td /></tr>}
              <tr className="bg-[#0F172A]"><td colSpan={4} className="px-5 py-4 text-right font-bold text-white text-base">Grand Total</td><td className="px-4 py-4 text-right font-bold text-white text-xl">{formatCurrency(grand)}</td><td /></tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function Customer360({ customer }) {
  const { contacts, leads, opportunities, orders, invoices, activities } = useApp();
  const [tab, setTab] = useState('contacts');
  const m = r => r.customerId === customer.id || r.customer === customer.name;
  const secs = {
    contacts:      { icon:'📇', label:'Contacts',      data: contacts.filter(m),      cols:[{h:'Name',v:r=>r.name},{h:'Email',v:r=>r.email||'-'},{h:'Phone',v:r=>r.phone||'-'},{h:'Designation',v:r=>r.designation||'-'},{h:'Status',v:r=><Pill status={r.status}/>}] },
    leads:         { icon:'🎯', label:'Leads',          data: leads.filter(m),         cols:[{h:'Name',v:r=>r.name},{h:'Source',v:r=>r.source||'-'},{h:'Amount',v:r=>formatCurrency(r.amount)},{h:'Status',v:r=><Pill status={r.status}/>}] },
    opportunities: { icon:'💼', label:'Opportunities',  data: opportunities.filter(m), cols:[{h:'Name',v:r=>r.name},{h:'Stage',v:r=>r.stage},{h:'Amount',v:r=>formatCurrency(r.amount)},{h:'Close Date',v:r=>r.closeDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}] },
    orders:        { icon:'🛒', label:'Orders',         data: orders.filter(m),        cols:[{h:'Name',v:r=>r.name},{h:'Amount',v:r=>formatCurrency(r.amount)},{h:'Delivery',v:r=>r.deliveryDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}] },
    invoices:      { icon:'🧾', label:'Invoices',       data: invoices.filter(m),      cols:[{h:'Name',v:r=>r.name},{h:'Amount',v:r=>formatCurrency(r.amount)},{h:'Due Date',v:r=>r.dueDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}] },
    activities:    { icon:'📅', label:'Activities',     data: activities.filter(m),    cols:[{h:'Name',v:r=>r.name},{h:'Subject',v:r=>r.subject||'-'},{h:'Type',v:r=>r.activityType||'-'},{h:'Date',v:r=>r.activityDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}] },
  };
  const active = secs[tab];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {Object.entries(secs).map(([k,s]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${tab===k?'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white shadow-lg':'bg-white border border-blue-100 text-[#0F172A] hover:border-blue-300'}`}>
            <span>{s.icon}</span><span>{s.label}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tab===k?'bg-white/20 text-white':'bg-blue-100 text-blue-700'}`}>{s.data.length}</span>
          </button>
        ))}
      </div>
      <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 flex items-center justify-between">
          <h3 className="text-white font-bold">{active.icon} {active.label}</h3>
          <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">{active.data.length} records</span>
        </div>
        {active.data.length === 0
          ? <div className="py-14 text-center"><div className="text-5xl mb-3">{active.icon}</div><p className="text-gray-400">No {active.label.toLowerCase()} linked to this customer.</p></div>
          : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-blue-50 border-b border-blue-100"><tr>{active.cols.map(c=><th key={c.h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">{c.h}</th>)}</tr></thead><tbody>{active.data.map((row,i)=><tr key={row.id||i} className="border-t border-blue-50 hover:bg-blue-50/40 transition-all">{active.cols.map(c=><td key={c.h} className="px-5 py-3 text-[#0F172A]">{c.v(row)}</td>)}</tr>)}</tbody></table></div>
        }
      </div>
    </div>
  );
}

export default function RecordDetailPanel({ page, record, onClose }) {
  const { customers, contacts, products, organizations, businessUnits, updateRecord, convertLeadToOpportunity, createOrderFromOpportunity, createInvoiceFromOrder } = useApp();
  const [edited,    setEdited]    = useState({ ...record });
  const [lineItems, setLineItems] = useState([]);
  const [loadingLI, setLoadingLI] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [tab,       setTab]       = useState('details');

  useEffect(() => {
    setEdited({ ...record });
    setTab('details');
    if (!HAS_LI.includes(page)) { setLineItems([]); return; }
    const [table, field] = LI_MAP[page] || [];
    if (!table || !supabase) return;
    setLoadingLI(true);
    supabase.from(table).select('*').eq(field, record.id).then(({ data }) => {
      setLineItems((data || []).map(r => ({ _id: r.id, product: r.product_name||'', quantity: Number(r.quantity??1), price: Number(r.price??0), discount: Number(r.discount??0) })));
      setLoadingLI(false);
    });
  }, [record.id, page]);

  const handleSave = async () => { setSaving(true); await updateRecord(page, edited, lineItems); setSaving(false); onClose(); };

  const set = (k, v) => setEdited(p => ({ ...p, [k]: v }));
  const fields = getObjectFields(page);
  const statusOpts = getStatusOptions(page);

  const renderField = (field) => {
    const v = edited[field];
    if (field === 'status') return <select value={v||''} onChange={e=>set('status',e.target.value)} className={sCls}>{statusOpts.map(s=><option key={s}>{s}</option>)}</select>;
    if (field === 'customer') return <select value={edited.customerId||''} onChange={e=>{const c=customers.find(x=>x.id===e.target.value);setEdited(p=>({...p,customerId:c?.id||'',customer:c?.name||''}));}} className={sCls}><option value="">Select</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>;
    if (field === 'contact') return <select value={edited.contactId||''} onChange={e=>{const c=contacts.find(x=>x.id===e.target.value);setEdited(p=>({...p,contactId:c?.id||'',contact:c?.name||''}));}} className={sCls}><option value="">Select</option>{contacts.filter(c=>!edited.customerId||c.customerId===edited.customerId).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>;
    if (field === 'stage') return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}>{['Qualification','Proposal Sent','Negotiation','Closed Won','Closed Lost'].map(s=><option key={s}>{s}</option>)}</select>;
    if (field === 'source') return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}>{['Website','Campaign','Referral','Cold Call','Trade Show','Partner'].map(s=><option key={s}>{s}</option>)}</select>;
    if (field === 'activityType') return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}>{['Call','Meeting','Email','Task','Demo'].map(s=><option key={s}>{s}</option>)}</select>;
    if (field === 'paymentTerms') return <select value={v||''} onChange={e=>set(field,e.target.value)} className={sCls}>{['Due on Receipt','Net 15','Net 30','Net 45'].map(s=><option key={s}>{s}</option>)}</select>;
    if (field === 'isPrimary') return <select value={v?'Yes':'No'} onChange={e=>set(field,e.target.value==='Yes')} className={sCls}><option>No</option><option>Yes</option></select>;
    if (['closeDate','activityDate','deliveryDate','dueDate'].includes(field)) return <input type="date" value={v||''} onChange={e=>set(field,e.target.value)} className={iCls} />;
    if (field === 'notes') return <textarea rows={4} value={v||''} onChange={e=>set(field,e.target.value)} className={tCls} placeholder="Notes..." />;
    return <input type={['amount','price'].includes(field)?'number':'text'} value={v||''} onChange={e=>set(field,e.target.value)} placeholder={field.replace(/([A-Z])/g,' $1').trim()} className={iCls} />;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] overflow-y-auto">
      <div className="bg-white rounded-[28px] shadow-2xl w-[98vw] my-4 mx-auto overflow-hidden flex flex-col" style={{minHeight:'95vh'}}>
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-8 py-5 text-white flex items-center justify-between flex-shrink-0">
          <div><div className="flex items-center gap-3 flex-wrap"><h2 className="text-2xl font-bold">{edited.name||edited.subject||getPageLabel(page)}</h2><Pill status={edited.status} /></div><p className="text-blue-300 text-sm mt-1">ID: {record.id} · {getPageLabel(page)}</p></div>
          <div className="flex items-center gap-2 flex-wrap">
            {page==='leads'&&record.status==='Qualified'&&<button onClick={()=>{convertLeadToOpportunity(record);onClose();}} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold">🔀 Convert</button>}
            {page==='opportunities'&&<button onClick={()=>{createOrderFromOpportunity(record);onClose();}} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold">🛒 Create Order</button>}
            {page==='orders'&&<button onClick={()=>{createInvoiceFromOrder(record);onClose();}} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold">🧾 Create Invoice</button>}
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg">✕</button>
          </div>
        </div>

        {page==='customers'&&(
          <div className="flex gap-1 px-8 pt-4 bg-gray-50 border-b border-blue-100">
            {[{key:'details',label:'📋 Details'},{key:'360',label:'🔄 Customer 360'}].map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)} className={`px-5 py-2.5 rounded-t-xl text-sm font-semibold whitespace-nowrap transition-all ${tab===t.key?'bg-white text-[#0F172A] border border-b-white border-blue-200 -mb-px shadow-sm':'text-gray-500 hover:text-[#0F172A]'}`}>{t.label}</button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 bg-gradient-to-br from-white to-blue-50 space-y-6">
          {page==='customers'&&tab==='360'&&<Customer360 customer={edited} />}
          {(page!=='customers'||tab==='details')&&(<>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {fields.map(field=>(
                <div key={field} className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">{field.replace(/([A-Z])/g,' $1').trim()}</label>
                  {renderField(field)}
                </div>
              ))}
            </div>
            {HAS_LI.includes(page)&&(loadingLI?<div className="bg-white rounded-[24px] border border-blue-100 p-8 text-center text-gray-400">Loading line items…</div>:<LineItemsTable items={lineItems} setItems={setLineItems} products={products} />)}
            <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 flex items-center justify-between"><h3 className="text-lg font-bold text-[#0F172A]">System Information</h3><span className="text-2xl">🛡️</span></div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                {[['Created By',record.created_by],['Created At',record.created_at?formatDateTime(record.created_at):'-'],['Updated By',record.updated_by],['Updated At',record.updated_at?formatDateTime(record.updated_at):'-'],['Organization',organizations.find(o=>o.id===record.organization_id)?.name||'-'],['Business Unit',businessUnits.find(b=>b.id===record.business_unit_id)?.name||'-']].map(([lbl,val])=>(
                  <div key={lbl}><div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{lbl}</div><div className="text-sm text-[#0F172A] font-medium bg-gray-50 rounded-xl px-3 py-2">{val||'-'}</div></div>
                ))}
              </div>
            </div>
          </>)}
        </div>

        <div className="px-8 py-4 border-t border-blue-100 bg-white flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-gray-400">{HAS_LI.includes(page)&&`${lineItems.length} line item${lineItems.length!==1?'s':''}`}</div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-3 text-sm rounded-2xl font-semibold bg-white border border-blue-200 text-[#0F172A] hover:bg-blue-50">Close</button>
            {(page!=='customers'||tab==='details')&&<button onClick={handleSave} disabled={saving} className="px-6 py-3 text-sm rounded-2xl font-semibold bg-gradient-to-r from-[#0F172A] to-blue-800 text-white hover:opacity-90 disabled:opacity-50 shadow-lg">{saving?'Saving…':'Save Changes'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
