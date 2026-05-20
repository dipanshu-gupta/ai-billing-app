// @ts-nocheck
'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { getPageLabel, getStatusOptions } from '@/lib/utils';

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';
const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';
const tCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none placeholder:text-gray-400';

const HAS_LINE_ITEMS = ['leads', 'opportunities', 'orders', 'invoices'];

// ─── Line Items ────────────────────────────────────────────────────────────────
// NOTE: defined OUTSIDE CreateRecordModal so React never remounts it on re-render

function LineItemsCreate({ items, setItems, products }) {
  const add    = () => setItems(p => [...p, { _id: Date.now(), product: '', quantity: 1, price: 0, discount: 0 }]);
  const remove = idx => setItems(p => p.filter((_,i) => i !== idx));
  const upd    = (idx, field, raw) => setItems(p => p.map((r,i) => {
    if (i !== idx) return r;
    if (field === 'product') {
      const pr = products.find(x => x.name === raw);
      return { ...r, product: raw, price: pr ? pr.price : r.price };
    }
    return { ...r, [field]: ['quantity','price','discount'].includes(field) ? Number(raw) : raw };
  }));

  const sub   = items.reduce((s,r) => s + r.quantity * r.price, 0);
  const disc  = items.reduce((s,r) => s + r.quantity * r.price * (r.discount/100), 0);
  const grand = sub - disc;
  const fmt   = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="bg-white rounded-[20px] border border-blue-100 shadow overflow-hidden">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3.5 flex items-center justify-between">
        <div><h3 className="text-white font-bold">Line Items</h3><p className="text-blue-300 text-xs mt-0.5">Products · Services · Discounts</p></div>
        <button type="button" onClick={add} className="bg-white text-[#0F172A] px-4 py-1.5 rounded-xl text-sm font-bold hover:bg-blue-50 transition-all">+ Add Item</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-blue-50 border-b border-blue-100">
            <th className="px-4 py-2.5 text-left text-xs font-bold uppercase text-gray-500" style={{minWidth:180}}>Product</th>
            <th className="px-4 py-2.5 text-center text-xs font-bold uppercase text-gray-500 w-20">Qty</th>
            <th className="px-4 py-2.5 text-right text-xs font-bold uppercase text-gray-500 w-32">Price (₹)</th>
            <th className="px-4 py-2.5 text-center text-xs font-bold uppercase text-gray-500 w-28">Disc (%)</th>
            <th className="px-4 py-2.5 text-right text-xs font-bold uppercase text-gray-500 w-32">Total</th>
            <th className="w-10"/>
          </tr></thead>
          <tbody>
            {items.length === 0
              ? <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">No items. Click + Add Item.</td></tr>
              : items.map((row, idx) => {
                  const lt = row.quantity * row.price * (1 - row.discount/100);
                  return (
                    <tr key={row._id} className="border-t border-blue-50">
                      <td className="px-4 py-2">
                        <select value={row.product} onChange={e => upd(idx,'product',e.target.value)} className={sCls}>
                          <option value="">— Select —</option>
                          {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2"><input type="number" min={1} value={row.quantity} onChange={e => upd(idx,'quantity',e.target.value)} className={`${iCls} text-center`} /></td>
                      <td className="px-4 py-2"><input type="number" min={0} value={row.price} onChange={e => upd(idx,'price',e.target.value)} className={`${iCls} text-right`} /></td>
                      <td className="px-4 py-2"><input type="number" min={0} max={100} value={row.discount} onChange={e => upd(idx,'discount',e.target.value)} className={`${iCls} text-center ${row.discount>0?'border-green-300 bg-green-50':''}`} /></td>
                      <td className="px-4 py-2 text-right font-bold text-[#0F172A]">{fmt(lt)}</td>
                      <td className="px-2 py-2 text-center"><button type="button" onClick={() => remove(idx)} className="w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-xs font-bold">✕</button></td>
                    </tr>
                  );
                })
            }
          </tbody>
          {items.length > 0 && (
            <tfoot className="border-t-2 border-blue-100">
              <tr className="bg-gray-50"><td colSpan={4} className="px-5 py-2 text-right text-sm text-gray-500">Subtotal</td><td className="px-4 py-2 text-right text-sm font-semibold">{fmt(sub)}</td><td/></tr>
              {disc > 0 && <tr className="bg-green-50"><td colSpan={4} className="px-5 py-2 text-right text-sm text-green-600">Discount</td><td className="px-4 py-2 text-right text-sm font-semibold text-green-600">- {fmt(disc)}</td><td/></tr>}
              <tr className="bg-[#0F172A]"><td colSpan={4} className="px-5 py-3 text-right font-bold text-white">Grand Total</td><td className="px-4 py-3 text-right font-bold text-white text-lg">{fmt(grand)}</td><td/></tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Label wrapper — plain function, NOT a React component ────────────────────
function lbl(text) {
  return <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1.5">{text}</label>;
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function CreateRecordModal({ page, open, onClose }) {
  const { customers, contacts, products, createRecord } = useApp();
  const [form,      setForm]      = useState({});
  const [lineItems, setLineItems] = useState([]);
  const [saving,    setSaving]    = useState(false);

  if (!open) return null;

  const s   = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const filtered = contacts.filter(c => !form.customerId || c.customerId === form.customerId);
  const label    = getPageLabel(page);
  const statuses = getStatusOptions(page);

  const handleClose = () => { setForm({}); setLineItems([]); onClose(); };

  const handleSubmit = async () => {
    if (!form.name && page !== 'activities') { alert('Name is required.'); return; }
    setSaving(true);
    const ok = await createRecord(page, form, lineItems);
    setSaving(false);
    if (ok) handleClose();
  };

  // ── Reusable inline field blocks (plain JSX, NOT sub-components) ────────────

  const customerBlock = (
    <>
      <div>
        {lbl('Customer')}
        <select value={form.customerId||''} onChange={e => {
          const c = customers.find(x => x.id === e.target.value);
          setForm(f => ({ ...f, customerId: c?.id||'', customer: c?.name||'', contactId: '', contact: '' }));
        }} className={sCls}>
          <option value="">Select customer</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        {lbl('Contact')}
        <select value={form.contactId||''} onChange={e => {
          const c = contacts.find(x => x.id === e.target.value);
          setForm(f => ({ ...f, contactId: c?.id||'', contact: c?.name||'' }));
        }} className={sCls}>
          <option value="">Select contact</option>
          {filtered.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
    </>
  );

  const statusBlock = (
    <div>
      {lbl('Status')}
      <select value={form.status||''} onChange={e => s('status', e.target.value)} className={sCls}>
        <option value="">Default</option>
        {statuses.map(st => <option key={st}>{st}</option>)}
      </select>
    </div>
  );

  const renderFields = () => {
    switch (page) {
      case 'customers': return (<>
        <div>{lbl('Customer Name *')}<input value={form.name||''} onChange={e=>s('name',e.target.value)} placeholder="Customer name" className={iCls}/></div>
        <div>{lbl('Company')}<input value={form.company||''} onChange={e=>s('company',e.target.value)} placeholder="Company" className={iCls}/></div>
        <div>{lbl('Email')}<input type="email" value={form.email||''} onChange={e=>s('email',e.target.value)} placeholder="email@company.com" className={iCls}/></div>
        <div>{lbl('Phone')}<input value={form.phone||''} onChange={e=>s('phone',e.target.value)} placeholder="+91 98765 43210" className={iCls}/></div>
        <div>{lbl('Industry')}<select value={form.industry||''} onChange={e=>s('industry',e.target.value)} className={sCls}><option value="">Select</option>{['Technology','Healthcare','Finance','Retail','Manufacturing','Education','Other'].map(x=><option key={x}>{x}</option>)}</select></div>
        <div>{lbl('Website')}<input value={form.website||''} onChange={e=>s('website',e.target.value)} placeholder="https://company.com" className={iCls}/></div>
        <div>{lbl('GST Number')}<input value={form.gstNumber||''} onChange={e=>s('gstNumber',e.target.value)} placeholder="GST number" className={iCls}/></div>
        <div>{lbl('Billing Address')}<input value={form.billingAddress||''} onChange={e=>s('billingAddress',e.target.value)} placeholder="Billing address" className={iCls}/></div>
        <div>{lbl('City')}<input value={form.city||''} onChange={e=>s('city',e.target.value)} placeholder="City" className={iCls}/></div>
        <div>{lbl('State')}<input value={form.state||''} onChange={e=>s('state',e.target.value)} placeholder="State" className={iCls}/></div>
        {statusBlock}
      </>);

      case 'products': return (<>
        <div>{lbl('Product Name *')}<input value={form.name||''} onChange={e=>s('name',e.target.value)} placeholder="Product name" className={iCls}/></div>
        <div>{lbl('Category')}<select value={form.category||''} onChange={e=>s('category',e.target.value)} className={sCls}><option value="">Select</option>{['Software','Hardware','Service','Subscription','Consulting','Other'].map(x=><option key={x}>{x}</option>)}</select></div>
        <div>{lbl('Unit Price (₹)')}<input type="number" min={0} value={form.price||''} onChange={e=>s('price',e.target.value)} placeholder="0" className={iCls}/></div>
        {statusBlock}
      </>);

      case 'contacts': return (<>
        <div>{lbl('Customer')}
          <select value={form.customerId||''} onChange={e=>{const c=customers.find(x=>x.id===e.target.value);setForm(f=>({...f,customerId:c?.id||'',customer:c?.name||''}))} } className={sCls}>
            <option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>{lbl('Contact Name *')}<input value={form.name||''} onChange={e=>s('name',e.target.value)} placeholder="Full name" className={iCls}/></div>
        <div>{lbl('Email')}<input type="email" value={form.email||''} onChange={e=>s('email',e.target.value)} placeholder="email@company.com" className={iCls}/></div>
        <div>{lbl('Phone')}<input value={form.phone||''} onChange={e=>s('phone',e.target.value)} placeholder="+91 98765 43210" className={iCls}/></div>
        <div>{lbl('Designation')}<input value={form.designation||''} onChange={e=>s('designation',e.target.value)} placeholder="e.g. Manager" className={iCls}/></div>
        <div>{lbl('Department')}<input value={form.department||''} onChange={e=>s('department',e.target.value)} placeholder="e.g. Sales" className={iCls}/></div>
        {statusBlock}
      </>);

      case 'leads': return (<>
        <div>{lbl('Lead Name *')}<input value={form.name||''} onChange={e=>s('name',e.target.value)} placeholder="Lead title" className={iCls}/></div>
        {customerBlock}
        <div>{lbl('Email')}<input type="email" value={form.email||''} onChange={e=>s('email',e.target.value)} placeholder="email@company.com" className={iCls}/></div>
        <div>{lbl('Phone')}<input value={form.phone||''} onChange={e=>s('phone',e.target.value)} placeholder="+91 98765 43210" className={iCls}/></div>
        <div>{lbl('Source')}<select value={form.source||''} onChange={e=>s('source',e.target.value)} className={sCls}><option value="">Select source</option>{['Website','Campaign','Referral','Cold Call','Trade Show','Partner'].map(x=><option key={x}>{x}</option>)}</select></div>
        {statusBlock}
      </>);

      case 'opportunities': return (<>
        <div>{lbl('Opportunity Name *')}<input value={form.name||''} onChange={e=>s('name',e.target.value)} placeholder="Opportunity name" className={iCls}/></div>
        {customerBlock}
        <div>{lbl('Stage')}<select value={form.stage||''} onChange={e=>s('stage',e.target.value)} className={sCls}><option value="">Select stage</option>{['Qualification','Proposal Sent','Negotiation','Closed Won','Closed Lost'].map(x=><option key={x}>{x}</option>)}</select></div>
        <div>{lbl('Close Date')}<input type="date" value={form.closeDate||''} onChange={e=>s('closeDate',e.target.value)} className={iCls}/></div>
        {statusBlock}
      </>);

      case 'orders': return (<>
        <div>{lbl('Order Name *')}<input value={form.name||''} onChange={e=>s('name',e.target.value)} placeholder="Order name" className={iCls}/></div>
        {customerBlock}
        <div>{lbl('Delivery Date')}<input type="date" value={form.deliveryDate||''} onChange={e=>s('deliveryDate',e.target.value)} className={iCls}/></div>
        <div>{lbl('Shipping Address')}<input value={form.shippingAddress||''} onChange={e=>s('shippingAddress',e.target.value)} placeholder="Delivery address" className={iCls}/></div>
        {statusBlock}
      </>);

      case 'invoices': return (<>
        <div>{lbl('Invoice Name *')}<input value={form.name||''} onChange={e=>s('name',e.target.value)} placeholder="Invoice name" className={iCls}/></div>
        {customerBlock}
        <div>{lbl('Due Date')}<input type="date" value={form.dueDate||''} onChange={e=>s('dueDate',e.target.value)} className={iCls}/></div>
        <div>{lbl('Payment Terms')}<select value={form.paymentTerms||''} onChange={e=>s('paymentTerms',e.target.value)} className={sCls}><option value="">Select terms</option>{['Due on Receipt','Net 15','Net 30','Net 45'].map(x=><option key={x}>{x}</option>)}</select></div>
        <div>{lbl('Billing Address')}<input value={form.billingAddress||''} onChange={e=>s('billingAddress',e.target.value)} placeholder="Billing address" className={iCls}/></div>
        {statusBlock}
      </>);

      case 'activities': return (<>
        <div>{lbl('Activity Name *')}<input value={form.name||''} onChange={e=>s('name',e.target.value)} placeholder="Activity name" className={iCls}/></div>
        {customerBlock}
        <div>{lbl('Subject')}<input value={form.subject||''} onChange={e=>s('subject',e.target.value)} placeholder="Subject" className={iCls}/></div>
        <div>{lbl('Activity Type')}<select value={form.activityType||''} onChange={e=>s('activityType',e.target.value)} className={sCls}><option value="">Select type</option>{['Call','Meeting','Email','Task','Demo'].map(x=><option key={x}>{x}</option>)}</select></div>
        <div>{lbl('Activity Date')}<input type="date" value={form.activityDate||''} onChange={e=>s('activityDate',e.target.value)} className={iCls}/></div>
        {statusBlock}
        <div className="md:col-span-2">{lbl('Notes')}<textarea rows={3} value={form.notes||''} onChange={e=>s('notes',e.target.value)} placeholder="Notes..." className={tCls}/></div>
      </>);

      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-auto">
      <div className="bg-white rounded-[32px] shadow-2xl border border-blue-100 w-full max-w-3xl max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="px-8 py-6 border-b border-blue-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-[#0F172A]">Create {label}</h2>
            <p className="text-gray-400 text-sm mt-1">Fill in the details below to create a new {label.toLowerCase()}.</p>
          </div>
          <button type="button" onClick={handleClose} className="w-10 h-10 rounded-2xl bg-gray-100 hover:bg-gray-200 text-[#0F172A] font-bold flex items-center justify-center text-lg">✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-8 py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderFields()}
          </div>
          {HAS_LINE_ITEMS.includes(page) && (
            <LineItemsCreate items={lineItems} setItems={setLineItems} products={products} />
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-blue-100 flex justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={handleClose} className="px-6 py-3 text-sm rounded-2xl font-semibold bg-white border border-blue-200 text-[#0F172A] hover:bg-blue-50 transition-all">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={saving} className="px-6 py-3 text-sm rounded-2xl font-semibold bg-gradient-to-r from-[#0F172A] to-blue-800 text-white hover:opacity-90 disabled:opacity-50 shadow-lg transition-all">
            {saving ? 'Creating…' : `Create ${label}`}
          </button>
        </div>

      </div>
    </div>
  );
}
