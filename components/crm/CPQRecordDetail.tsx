// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { getStatusOptions, getStatusColor, getPageLabel, formatDateTime } from '@/lib/utils';
import AISummary from '@/components/ai/AISummary';

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';
const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';
const tCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none';

const STATUS_COLORS = {
  Draft:'bg-gray-100 text-gray-700 border-gray-200',
  Processing:'bg-blue-100 text-blue-700 border-blue-200',
  Confirmed:'bg-purple-100 text-purple-700 border-purple-200',
  Shipped:'bg-indigo-100 text-indigo-700 border-indigo-200',
  Delivered:'bg-green-100 text-green-700 border-green-200',
  Cancelled:'bg-red-100 text-red-700 border-red-200',
  Pending:'bg-yellow-100 text-yellow-700 border-yellow-200',
  Paid:'bg-emerald-100 text-emerald-700 border-emerald-200',
  Overdue:'bg-red-100 text-red-700 border-red-200',
};

const CURRENCIES = ['INR','USD','EUR','GBP','AED','SGD','AUD','CAD','JPY','CNY'];

// ─── CPQ Line Items Table (shared by Order + Invoice) ──────────────────────────
function CPQLineItems({ items, setItems, products, readOnly, currency }) {
  const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:currency||'INR',maximumFractionDigits:0}).format(n||0);
  const add = () => !readOnly && setItems(p=>[...p,{_id:Date.now(),product_name:'',product_code:'',description:'',quantity:1,price:0,list_price:0,discount:0,tax_pct:18,extended_price:0}]);
  const remove = idx => !readOnly && setItems(p=>p.filter((_,i)=>i!==idx));
  const upd = (idx,field,val) => {
    if (readOnly) return;
    setItems(p=>p.map((r,i)=>{
      if(i!==idx) return r;
      const u={...r,[field]:['quantity','price','list_price','discount','tax_pct'].includes(field)?Number(val):val};
      if(field==='product_name'){const pr=products.find(x=>x.name===val);if(pr){u.price=pr.price;u.list_price=pr.price;}}
      const net=u.quantity*u.price*(1-u.discount/100);
      u.extended_price=net*(1+u.tax_pct/100);
      return u;
    }));
  };

  const subtotal  = items.reduce((s,i)=>s+i.quantity*i.price,0);
  const totalDisc = items.reduce((s,i)=>s+i.quantity*i.price*(i.discount/100),0);
  const totalTax  = items.reduce((s,i)=>s+(i.quantity*i.price*(1-i.discount/100))*(i.tax_pct||0)/100,0);

  return (
    <div className="bg-white rounded-[20px] border border-blue-100 shadow overflow-hidden">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 flex items-center justify-between">
        <div><h3 className="text-white font-bold text-lg">Line Items</h3><p className="text-blue-200 text-xs mt-0.5">Products · Qty · Pricing · Discounts · Tax</p></div>
        {!readOnly && <button type="button" onClick={add} className="bg-white text-[#0F172A] px-5 py-2 rounded-xl text-sm font-bold hover:bg-blue-50 shadow-md">+ Add Line Item</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="bg-blue-50 border-b border-blue-100">
            {[
                {h:'Product',     w:'200px'},
                {h:'Description', w:'150px'},
                {h:'Qty',         w:'80px'},
                {h:'Unit Price',  w:'120px'},
                {h:'Disc %',      w:'80px'},
                {h:'Tax %',       w:'80px'},
                {h:'Extended',    w:'120px'},
                {h:'',            w:'40px'},
              ].map(({h,w})=><th key={h} style={{minWidth:w}} className="px-4 py-3 text-left font-bold text-gray-600 uppercase text-xs tracking-wide bg-blue-50">{h}</th>)}
          </tr></thead>
          <tbody>
            {items.length===0
              ? <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400">No line items.{!readOnly&&' Click + Add Line.'}</td></tr>
              : items.map((row,idx)=>(
                <tr key={row._id??idx} className="border-t border-blue-50 hover:bg-blue-50/30">
                  <td className="px-4 py-3" style={{minWidth:'200px'}}>
                    {readOnly ? <div><span className="font-semibold text-[#0F172A]">{row.product_name||'-'}</span>{row.description&&<div className="text-xs text-gray-400 mt-0.5">{row.description}</div>}</div>
                    : <select value={row.product_name||''} onChange={e=>upd(idx,'product_name',e.target.value)} className={sCls}><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}</select>}
                  </td>
                  <td className="px-4 py-3" style={{minWidth:'150px'}}>
                    {readOnly ? null
                    : <input value={row.description||''} onChange={e=>upd(idx,'description',e.target.value)} placeholder="Description" className={iCls}/>}
                  </td>
                  <td className="px-4 py-3" style={{minWidth:'80px'}}>
                    {readOnly ? <span className="font-bold text-lg text-[#0F172A]">{row.quantity}</span>
                    : <input type="number" min={1} value={row.quantity} onChange={e=>upd(idx,'quantity',e.target.value)} className="w-full border-2 border-blue-300 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm text-center font-bold"/>}
                  </td>
                  <td className="px-4 py-3" style={{minWidth:'120px'}}>
                    {readOnly ? <span className="font-medium">{fmt(row.price)}</span>
                    : <input type="number" min={0} value={row.price} onChange={e=>upd(idx,'price',e.target.value)} className={`${iCls} text-right`}/>}
                  </td>
                  <td className="px-4 py-3" style={{minWidth:'80px'}}>
                    {readOnly
                      ? <span className={`font-semibold ${row.discount>0?'text-green-600':'text-gray-300'}`}>{row.discount>0?`${row.discount}%`:'-'}</span>
                      : <input type="number" min={0} max={100} value={row.discount} onChange={e=>upd(idx,'discount',e.target.value)} className={`w-full border-2 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400 ${row.discount>0?'border-green-300 bg-green-50 text-green-700 font-bold':'border-blue-200 text-[#0F172A] bg-white'}`}/>}
                  </td>
                  <td className="px-4 py-3" style={{minWidth:'80px'}}>
                    {readOnly
                      ? <span className="text-gray-500">{row.tax_pct>0?`${row.tax_pct}%`:'-'}</span>
                      : <input type="number" min={0} max={100} value={row.tax_pct||0} onChange={e=>upd(idx,'tax_pct',e.target.value)} className={`${iCls} text-center`}/>}
                  </td>
                  <td className="px-4 py-3 text-right" style={{minWidth:'120px'}}>
                    <span className="font-bold text-[#0F172A]">{fmt(row.extended_price||row.quantity*row.price)}</span>
                  </td>
                  {!readOnly && <td className="px-3 py-3"><button onClick={()=>remove(idx)} className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-sm font-bold flex items-center justify-center shadow-sm">✕</button></td>}
                </tr>
              ))
            }
          </tbody>
          {items.length>0&&(
            <tfoot className="border-t-2 border-blue-100">
              <tr className="bg-gray-50"><td colSpan={readOnly?6:7} className="px-5 py-2 text-right text-xs text-gray-500 font-medium">Subtotal</td><td className="px-3 py-2 text-right text-xs font-semibold">{fmt(subtotal)}</td>{!readOnly&&<td/>}</tr>
              {totalDisc>0&&<tr className="bg-green-50"><td colSpan={readOnly?6:7} className="px-5 py-2 text-right text-xs text-green-600">Discount</td><td className="px-3 py-2 text-right text-xs font-semibold text-green-600">- {fmt(totalDisc)}</td>{!readOnly&&<td/>}</tr>}
              {totalTax>0&&<tr className="bg-blue-50"><td colSpan={readOnly?6:7} className="px-5 py-2 text-right text-xs text-blue-600">Tax</td><td className="px-3 py-2 text-right text-xs font-semibold text-blue-600">+ {fmt(totalTax)}</td>{!readOnly&&<td/>}</tr>}
              <tr className="bg-[#0F172A]"><td colSpan={readOnly?6:7} className="px-5 py-3 text-right font-bold text-white text-sm">Net Total</td><td className="px-3 py-3 text-right font-bold text-white text-base">{fmt(subtotal-totalDisc+totalTax)}</td>{!readOnly&&<td/>}</tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Main CPQ Record Detail (Order / Invoice) ─────────────────────────────────
export default function CPQRecordDetail({ page, record, onClose }) {
  const {
    customers, contacts, products, enterpriseUsers, organizations, businessUnits,
    updateRecord, createInvoiceFromOrder, appPreferences,
  } = useApp();

  const [edited,   setEdited]   = useState({ ...record });
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  // Map table names
  const LI_TABLE  = page === 'orders' ? 'order_line_items'   : 'invoice_line_items';
  const LI_FIELD  = page === 'orders' ? 'order_number'       : 'invoice_number';

  useEffect(() => {
    const load = async () => {
      if (!supabase) return;
      const { data } = await supabase.from(LI_TABLE).select('*').eq(LI_FIELD, record.id).order('sort_order');
      setItems((data||[]).map(r=>({
        _id: r.id,
        product_name:  r.product_name  || '',
        product_code:  r.product_code  || '',
        description:   r.description   || '',
        quantity:      Number(r.quantity   || 1),
        price:         Number(r.price      || 0),
        list_price:    Number(r.list_price || 0),
        discount:      Number(r.discount   || 0),
        tax_pct:       Number(r.tax_pct    || 0),
        extended_price:Number(r.extended_price || r.quantity*r.price || 0),
      })));
      setLoading(false);
    };
    load();
    setEdited({ ...record });
  }, [record.id, page]);

  const s = (k,v) => setEdited(p=>({...p,[k]:v}));

  const subtotal    = items.reduce((s,i)=>s+i.quantity*i.price,0);
  const totalDisc   = items.reduce((s,i)=>s+i.quantity*i.price*(i.discount/100),0);
  const totalTax    = items.reduce((s,i)=>s+(i.quantity*i.price*(1-i.discount/100))*(i.tax_pct||0)/100,0);
  const overallDisc = subtotal*(Number(edited.overall_discount)||0)/100;
  const shipping    = Number(edited.shipping_cost||0);
  const grandTotal  = subtotal - totalDisc + totalTax - overallDisc + shipping;
  const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:edited.currency||appPreferences?.default_currency||'INR',maximumFractionDigits:0}).format(n||0);

  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async (andClose = false) => {
    setSaving(true);
    // Save updated line items
    if (supabase) {
      await supabase.from(LI_TABLE).delete().eq(LI_FIELD, record.id);
      if (items.length) {
        await supabase.from(LI_TABLE).insert(items.map((i,idx)=>({
          [LI_FIELD]:       record.id,
          product_name:     i.product_name  || '',
          product_code:     i.product_code  || '',
          description:      i.description   || '',
          quantity:         Number(i.quantity   || 1),
          price:            Number(i.price      || 0),
          list_price:       Number(i.list_price || 0),
          discount:         Number(i.discount   || 0),
          tax_pct:          Number(i.tax_pct    || 0),
          extended_price:   Number(i.extended_price || 0),
          sort_order:       idx,
        })));
      }
    }
    await updateRecord(page, { ...edited, amount: grandTotal }, []);
    setSaving(false);
    if (andClose) { onClose(); } else { setSaveSuccess(true); setTimeout(()=>setSaveSuccess(false),2500); }
  };

  const statusMeta  = STATUS_COLORS[edited.status] || 'bg-gray-100 text-gray-700 border-gray-200';
  const statusOpts  = getStatusOptions(page);
  const ownerUser   = enterpriseUsers.find(u=>u.id===edited.owner_id||u.email===edited.owner);
  const pageIcon    = page==='orders' ? '🛒' : '🧾';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] overflow-y-auto">
      <div className="bg-white rounded-[28px] shadow-2xl w-[98vw] my-4 mx-auto overflow-hidden flex flex-col" style={{minHeight:'95vh'}}>

        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-8 py-5 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-3xl">{pageIcon}</span>
              <h2 className="text-2xl font-bold">{edited.name || record.id}</h2>
              <span className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold border-2 ${statusMeta}`}>{edited.status}</span>
              {ownerUser && <span className="bg-white/10 text-white text-xs px-3 py-1 rounded-full">👤 {ownerUser.first_name} {ownerUser.last_name}</span>}
            </div>
            <p className="text-blue-300 text-sm mt-1">{record.id} · {getPageLabel(page)}{edited.quote_number ? ` · From Quote: ${edited.quote_number}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {page==='orders' && <button onClick={()=>{createInvoiceFromOrder(record);onClose();}} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold">🧾 Create Invoice</button>}
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg">✕</button>
          </div>
        </div>

        {/* Top action bar */}
        <div className="bg-white border-b border-blue-100 px-8 py-3 flex items-center justify-between flex-shrink-0">
          <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0F172A] font-semibold">← Back to list</button>
          <div className="flex items-center gap-3">
            {saveSuccess && <span className="text-green-600 text-sm font-semibold">✓ Saved</span>}
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={()=>handleSave(false)} disabled={saving} className="px-4 py-2 text-sm rounded-xl font-semibold bg-blue-100 hover:bg-blue-200 text-blue-700 disabled:opacity-50">{saving?'Saving…':'Save Changes'}</button>
            <button onClick={()=>handleSave(true)} disabled={saving} className="px-5 py-2 text-sm rounded-xl font-semibold bg-gradient-to-r from-[#0F172A] to-blue-800 text-white hover:opacity-90 disabled:opacity-50 shadow-md">{saving?'Saving…':'Save & Close'}</button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400"><div className="text-4xl animate-pulse">{pageIcon}</div></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-8 bg-gradient-to-br from-white to-blue-50 space-y-6">

            {/* AI Summary */}
            <AISummary page={page} record={record}/>

            {/* Status + Core Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* Status */}
              <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">Status</label>
                <select value={edited.status||''} onChange={e=>s('status',e.target.value)} className={sCls}>
                  {statusOpts.map(st=><option key={st}>{st}</option>)}
                </select>
              </div>
              {/* Customer */}
              <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">Customer</label>
                <select value={edited.customerId||edited.customer_id||''} onChange={e=>{const c=customers.find(x=>x.id===e.target.value);setEdited(p=>({...p,customerId:c?.id||'',customer_id:c?.id||'',customer:c?.name||''}));}} className={sCls}>
                  <option value="">Select</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {/* Contact */}
              <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">Contact</label>
                <select value={edited.contactId||edited.contact_id||''} onChange={e=>{const c=contacts.find(x=>x.id===e.target.value);setEdited(p=>({...p,contactId:c?.id||'',contact_id:c?.id||'',contact:c?.name||''}));}} className={sCls}>
                  <option value="">Select</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {/* Currency */}
              <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">Currency</label>
                <select value={edited.currency||'INR'} onChange={e=>s('currency',e.target.value)} className={sCls}>
                  {CURRENCIES.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              {/* Payment Terms */}
              <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">Payment Terms</label>
                <select value={edited.payment_terms||edited.paymentTerms||''} onChange={e=>s('payment_terms',e.target.value)} className={sCls}>
                  <option value="">Select</option>{['Due on Receipt','Net 15','Net 30','Net 45','Net 60'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              {/* Delivery / Due Date */}
              <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">{page==='orders'?'Delivery Date':'Due Date'}</label>
                <input type="date" value={edited.deliveryDate||edited.delivery_date||edited.dueDate||edited.due_date||''} onChange={e=>s(page==='orders'?'deliveryDate':'dueDate',e.target.value)} className={iCls}/>
              </div>
              {/* Owner */}
              <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">Owner</label>
                <select value={edited.owner_id||''} onChange={e=>{const u=enterpriseUsers.find(x=>x.id===e.target.value);setEdited(p=>({...p,owner_id:u?.id||'',owner:u?.email||''}));}} className={sCls}>
                  <option value="">Unassigned</option>{enterpriseUsers.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                </select>
              </div>
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[['Billing Address',page==='orders'?'billing_address':'billingAddress'],['Shipping Address',page==='orders'?'shipping_address':'shippingAddress']].map(([l,f])=>(
                <div key={f} className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">{l}</label>
                  <textarea rows={3} value={edited[f]||''} onChange={e=>s(f,e.target.value)} className={tCls}/>
                </div>
              ))}
            </div>

            {/* Line Items */}
            <CPQLineItems items={items} setItems={setItems} products={products} currency={edited.currency||appPreferences?.default_currency||'INR'}/>

            {/* Charges + Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-[#0F172A]">Additional Charges</h3>
                <div><label className="text-xs font-bold uppercase text-gray-400 block mb-2">Overall Discount (%)</label><input type="number" min={0} max={100} value={edited.overall_discount||0} onChange={e=>s('overall_discount',e.target.value)} className={iCls}/></div>
                <div><label className="text-xs font-bold uppercase text-gray-400 block mb-2">Shipping Cost</label><input type="number" min={0} value={edited.shipping_cost||0} onChange={e=>s('shipping_cost',e.target.value)} className={iCls}/></div>
              </div>
              <div className="bg-gradient-to-br from-[#0F172A] to-blue-900 rounded-2xl p-5 text-white shadow-xl">
                <h3 className="font-bold mb-4">Price Summary</h3>
                <div className="space-y-2 text-sm">
                  {[[`Subtotal`,fmt(subtotal)],totalDisc>0&&[`Discounts`,`- ${fmt(totalDisc)}`],totalTax>0&&[`Tax`,`+ ${fmt(totalTax)}`],overallDisc>0&&[`Overall Disc`,`- ${fmt(overallDisc)}`],shipping>0&&[`Shipping`,`+ ${fmt(shipping)}`]].filter(Boolean).map(([l,v])=>(
                    <div key={l} className="flex justify-between py-1 border-b border-white/10"><span className="text-blue-200">{l}</span><span className="font-semibold">{v}</span></div>
                  ))}
                  <div className="flex justify-between py-3 mt-2 bg-white/10 rounded-xl px-3"><span className="font-bold text-lg">Grand Total</span><span className="font-bold text-xl">{fmt(grandTotal)}</span></div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">Notes</label>
              <textarea rows={3} value={edited.notes||''} onChange={e=>s('notes',e.target.value)} className={tCls} placeholder="Order notes..."/>
            </div>

            {/* System Info */}
            <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#0F172A]">System Information</h3><span className="text-2xl">🛡️</span>
              </div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[['Created By',record.created_by||'-'],['Created At',record.created_at?formatDateTime(record.created_at):'-'],['Updated By',record.updated_by||'-'],['Updated At',record.updated_at?formatDateTime(record.updated_at):'-'],['Organization',organizations?.find(o=>o.id===record.organization_id)?.name||'-'],['Business Unit',businessUnits?.find(b=>b.id===record.business_unit_id)?.name||'-'],['Record ID',record.id||'-'],['From Quotation',edited.quote_number||'-']].map(([l,v])=>(
                  <div key={l}><div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{l}</div><div className="text-sm text-[#0F172A] font-medium bg-gray-50 rounded-xl px-3 py-2 truncate">{v}</div></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-4 border-t border-blue-100 bg-white flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-gray-400">{items.length} line item{items.length!==1?'s':''} · GT: <span className="font-bold text-[#0F172A]">{fmt(grandTotal)}</span></div>
          <div className="text-sm text-gray-400">{items.length} line item{items.length!==1?'s':''} · GT: <span className="font-bold text-[#0F172A]">{fmt(grandTotal)}</span></div>
        </div>
      </div>
    </div>
  );
}
