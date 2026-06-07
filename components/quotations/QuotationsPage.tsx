// @ts-nocheck
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency, getStatusColor } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────
const QUOTE_STATUSES = ['Draft','Submitted','Pending Approval','Approved','Sent to Customer','Accepted','Ordered','Rejected','Expired','Cancelled'];

const STATUS_META = {
  'Draft':              { color:'bg-gray-100 text-gray-700 border-gray-200',    icon:'📝', label:'Draft' },
  'Submitted':          { color:'bg-blue-100 text-blue-700 border-blue-200',    icon:'📤', label:'Submitted' },
  'Pending Approval':   { color:'bg-yellow-100 text-yellow-700 border-yellow-200', icon:'⏳', label:'Pending Approval' },
  'Approved':           { color:'bg-green-100 text-green-700 border-green-200', icon:'✅', label:'Approved' },
  'Sent to Customer':   { color:'bg-purple-100 text-purple-700 border-purple-200',icon:'📨', label:'Sent to Customer' },
  'Accepted':           { color:'bg-emerald-100 text-emerald-700 border-emerald-200',icon:'🤝', label:'Accepted' },
  'Rejected':           { color:'bg-red-100 text-red-700 border-red-200',       icon:'❌', label:'Rejected' },
  'Expired':            { color:'bg-orange-100 text-orange-700 border-orange-200',icon:'⌛', label:'Expired' },
  'Cancelled':          { color:'bg-gray-200 text-gray-500 border-gray-300',    icon:'🚫', label:'Cancelled' },
  'Ordered':            { color:'bg-teal-100 text-teal-700 border-teal-200',      icon:'🛒', label:'Ordered' },
};

const CURRENCIES = ['INR','USD','EUR','GBP','AED','SGD','AUD','CAD','JPY','CNY'];

// ─── Confirmation Dialog ───────────────────────────────────────────────────────
function ConfirmDialog({ open, title, message, confirmLabel, confirmClass, onConfirm, onCancel, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-[#0F172A]">{title}</h3>
          <p className="text-gray-500 text-sm mt-2 leading-relaxed">{message}</p>
        </div>
        {children && <div className="px-8 py-4 bg-gray-50">{children}</div>}
        <div className="px-8 py-5 flex justify-end gap-3">
          <button onClick={onCancel} className="px-5 py-2.5 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className={`px-6 py-2.5 rounded-2xl text-sm font-bold text-white shadow-lg ${confirmClass || 'bg-gradient-to-r from-[#0F172A] to-blue-800'}`}>{confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Default PDF template sections ────────────────────────────────────────────
const DEFAULT_SECTIONS = [
  { id:'header',    type:'header',    name:'Header',            enabled:true, order:1, settings:{ bgColor:'#0F172A', textColor:'#FFFFFF', showLogo:false, logoUrl:'', companyName:'Business Pro', tagline:'Enterprise Solutions' } },
  { id:'quote_info',type:'quote_info',name:'Quote Information', enabled:true, order:2, settings:{ bgColor:'#F8FAFC', textColor:'#0F172A' } },
  { id:'customer',  type:'customer',  name:'Customer Details',  enabled:true, order:3, settings:{ bgColor:'#FFFFFF', textColor:'#0F172A', showBillTo:true, showShipTo:true } },
  { id:'items',     type:'items',     name:'Line Items',        enabled:true, order:4, settings:{ headerBgColor:'#0F172A', headerTextColor:'#FFFFFF', stripedRows:true, showProductCode:false, showDiscount:true, showTax:true } },
  { id:'totals',    type:'totals',    name:'Pricing Summary',   enabled:true, order:5, settings:{ bgColor:'#F8FAFC', accentColor:'#0F172A', showShipping:true, showTax:true } },
  { id:'terms',     type:'terms',     name:'Terms & Conditions',enabled:true, order:6, settings:{ content:'Payment is due within the terms specified. All prices are subject to applicable taxes.' } },
  { id:'footer',    type:'footer',    name:'Footer',            enabled:true, order:7, settings:{ bgColor:'#0F172A', textColor:'#FFFFFF', showSignature:true, signatureLabel:'Authorized Signature', footerText:'' } },
];

const buildQuoteHTML = (quote, items, template) => {
  const sections    = template?.sections?.length ? template.sections : DEFAULT_SECTIONS;
  const pageSettings= template?.page_settings || {};
  const font        = pageSettings.fontFamily || 'Arial, sans-serif';
  const enabled     = sections.filter(s => s.enabled).sort((a,b) => a.order - b.order);
  const fmt = (n, cur) => new Intl.NumberFormat('en-IN', { style:'currency', currency: cur || quote.currency || 'INR', maximumFractionDigits:0 }).format(n||0);

  const subtotal   = items.reduce((s,i) => s + i.quantity * i.unit_price, 0);
  const totalDisc  = items.reduce((s,i) => s + i.quantity * i.unit_price * i.discount_pct/100, 0);
  const totalTax   = items.reduce((s,i) => s + (i.quantity*i.unit_price*(1-i.discount_pct/100)) * i.tax_pct/100, 0);
  const overallDisc = subtotal * (quote.overall_discount||0)/100;
  const shipping   = Number(quote.shipping_cost||0);
  const grandTotal = subtotal - totalDisc + totalTax - overallDisc + shipping;

  const renderSection = (sec) => {
    const s = sec.settings || {};
    switch(sec.type) {
      case 'header': return `<div style="background:${s.bgColor};color:${s.textColor};padding:40px 50px;display:flex;align-items:center;justify-content:space-between;"><div>${s.showLogo&&s.logoUrl?`<img src="${s.logoUrl}" style="height:60px;margin-bottom:10px;display:block;">`:''}  <div style="font-size:28px;font-weight:bold;">${s.companyName||'Company'}</div><div style="font-size:13px;opacity:0.8;margin-top:4px;">${s.tagline||''}</div></div><div style="text-align:right;"><div style="font-size:32px;font-weight:bold;letter-spacing:2px;">QUOTATION</div><div style="font-size:14px;opacity:0.8;margin-top:6px;">${quote.quote_number||''}</div></div></div>`;
      case 'quote_info': return `<div style="background:${s.bgColor};color:${s.textColor};padding:25px 50px;border-bottom:2px solid #E2E8F0;"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;">${[['Quote Number',quote.quote_number||'-'],['Date',quote.created_at?new Date(quote.created_at).toLocaleDateString():''],['Valid Until',quote.validity_date||'-'],['Version',`v${quote.version||1}`],['Payment Terms',quote.payment_terms||''],['Currency',quote.currency||'INR']].filter(([,v])=>v).map(([l,v])=>`<div><div style="font-size:11px;text-transform:uppercase;opacity:0.6;margin-bottom:4px;">${l}</div><div style="font-weight:600;">${v}</div></div>`).join('')}</div></div>`;
      case 'customer': return `<div style="background:${s.bgColor};padding:25px 50px;display:grid;grid-template-columns:1fr 1fr;gap:40px;font-size:13px;border-bottom:1px solid #E2E8F0;">${s.showBillTo?`<div><div style="font-weight:700;text-transform:uppercase;font-size:9px;color:#64748B;margin-bottom:8px;">Bill To</div><div style="font-weight:700;font-size:16px;">${quote.customer||'-'}</div>${quote.billing_address?`<div style="color:#475569;margin-top:6px;line-height:1.6;">${quote.billing_address}</div>`:''}</div>`:''} ${s.showShipTo&&quote.shipping_address?`<div><div style="font-weight:700;text-transform:uppercase;font-size:9px;color:#64748B;margin-bottom:8px;">Ship To</div><div style="color:#475569;line-height:1.6;">${quote.shipping_address}</div></div>`:''}</div>`;
      case 'items': return `<div style="padding:30px 50px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:15px;color:#64748B;">Products & Services</div><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:${s.headerBgColor};color:${s.headerTextColor};">${['#',s.showProductCode?'Code':'','Product','Qty','Unit Price',s.showDiscount?'Disc %':'',s.showTax?'Tax %':'','Amount'].filter(Boolean).map(h=>`<th style="padding:12px 14px;text-align:left;font-weight:600;">${h}</th>`).join('')}</tr></thead><tbody>${items.map((item,idx)=>{const net=item.quantity*item.unit_price*(1-item.discount_pct/100);const total=net*(1+item.tax_pct/100);return `<tr style="background:${s.stripedRows&&idx%2===1?'#F8FAFC':'#FFF'};"><td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;color:#64748B;">${idx+1}</td>${s.showProductCode?`<td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-family:monospace;">${item.product_code||'-'}</td>`:''}<td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;"><div style="font-weight:600;">${item.product_name||'-'}</div>${item.description?`<div style="font-size:11px;color:#64748B;">${item.description}</div>`:''}</td><td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;">${item.quantity}</td><td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;">${fmt(item.unit_price)}</td>${s.showDiscount?`<td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;color:${item.discount_pct>0?'#16A34A':'#94A3B8'};">${item.discount_pct>0?`${item.discount_pct}%`:'-'}</td>`:''} ${s.showTax?`<td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;color:#64748B;">${item.tax_pct>0?`${item.tax_pct}%`:'-'}</td>`:''}<td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-weight:600;">${fmt(total)}</td></tr>`;}).join('')}</tbody></table></div>`;
      case 'totals': return `<div style="background:${s.bgColor};padding:20px 50px;display:flex;justify-content:flex-end;"><div style="width:320px;font-size:14px;">${[[`Subtotal`,fmt(subtotal)],totalDisc>0?['Line Discounts',`- ${fmt(totalDisc)}`]:null,overallDisc>0?[`Overall Disc (${quote.overall_discount}%)`,`- ${fmt(overallDisc)}`]:null,s.showTax&&totalTax>0?['Tax',`+ ${fmt(totalTax)}`]:null,s.showShipping&&shipping>0?['Shipping',`+ ${fmt(shipping)}`]:null].filter(Boolean).map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E2E8F0;"><span style="color:#64748B;">${l}</span><span style="font-weight:600;">${v}</span></div>`).join('')}<div style="display:flex;justify-content:space-between;padding:14px;margin-top:8px;background:${s.accentColor};color:#FFF;border-radius:8px;font-size:16px;"><span style="font-weight:700;">GRAND TOTAL</span><span style="font-weight:700;">${fmt(grandTotal)}</span></div></div></div>`;
      case 'terms': return s.content?`<div style="padding:25px 50px;border-top:1px solid #E2E8F0;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748B;margin-bottom:10px;">Terms & Conditions</div><div style="font-size:12px;color:#475569;line-height:1.8;">${s.content}</div></div>`:'';
      case 'footer': return `<div style="background:${s.bgColor};color:${s.textColor};padding:30px 50px;margin-top:20px;"><div style="display:flex;justify-content:space-between;align-items:flex-end;"><div style="font-size:12px;opacity:0.7;">${s.footerText||''}${quote.owner_display?`<br>Prepared by: ${quote.owner_display}`:''}</div>${s.showSignature?`<div style="text-align:center;"><div style="border-top:1px solid ${s.textColor};padding-top:8px;width:200px;font-size:12px;opacity:0.8;">${s.signatureLabel||'Authorized Signature'}</div></div>`:''}</div></div>`;
      default: return '';
    }
  };

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:${font};color:#1E293B;background:#FFF;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{margin:0;size:A4;}}</style></head><body>${enabled.map(renderSection).join('')}${quote.notes?`<div style="padding:20px 50px;background:#FFFBEB;border-top:1px solid #FDE68A;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#92400E;margin-bottom:6px;">Notes</div><div style="font-size:13px;color:#78350F;">${quote.notes}</div></div>`:''}<div style="text-align:center;padding:15px;font-size:11px;color:#94A3B8;border-top:1px solid #F1F5F9;">Generated by Business Pro · ${new Date().toLocaleDateString()}</div></body></html>`;
};

// ─── Line Items Editor ─────────────────────────────────────────────────────────
function QuoteLineItems({ items, setItems, products, currency }) {
  const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:currency||'INR',maximumFractionDigits:0}).format(n||0);
  const iCls = 'w-full border border-blue-200 rounded-lg px-2 py-2 text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs';
  const sCls = 'w-full border border-blue-200 rounded-lg px-2 py-2 text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs';

  const add    = () => setItems(p => [...p, { _id:Date.now(), product_name:'', product_code:'', description:'', quantity:1, unit_price:0, list_price:0, discount_pct:0, tax_pct:18, extended_price:0 }]);
  const remove = idx => setItems(p => p.filter((_,i) => i !== idx));
  const upd    = (idx, field, val) => setItems(p => p.map((r,i) => {
    if (i !== idx) return r;
    const u = { ...r, [field]: ['quantity','unit_price','list_price','discount_pct','tax_pct'].includes(field) ? Number(val) : val };
    if (field === 'product_name') { const pr=products.find(x=>x.name===val); if (pr) { u.unit_price=pr.price; u.list_price=pr.price; } }
    const net = u.quantity * u.unit_price * (1 - u.discount_pct/100);
    u.extended_price = net * (1 + u.tax_pct/100);
    return u;
  }));

  const subtotal  = items.reduce((s,i) => s + i.quantity*i.unit_price, 0);
  const totalDisc = items.reduce((s,i) => s + i.quantity*i.unit_price*i.discount_pct/100, 0);
  const totalTax  = items.reduce((s,i) => s + (i.quantity*i.unit_price*(1-i.discount_pct/100))*i.tax_pct/100, 0);

  return (
    <div className="bg-white rounded-[20px] border border-blue-100 shadow overflow-hidden">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3.5 flex items-center justify-between">
        <div><h3 className="text-white font-bold">Line Items</h3><p className="text-blue-300 text-xs mt-0.5">Products · Pricing · Discounts · Tax</p></div>
        <button type="button" onClick={add} className="bg-white text-[#0F172A] px-4 py-1.5 rounded-xl text-sm font-bold hover:bg-blue-50">+ Add Line</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="bg-blue-50 border-b border-blue-100">
            {['Product','Description','Qty','List Price','Unit Price','Disc %','Tax %','Extended',''].map(h=><th key={h} className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {items.length===0
              ? <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400">No line items. Click + Add Line.</td></tr>
              : items.map((row,idx)=>(
                <tr key={row._id??idx} className="border-t border-blue-50 hover:bg-blue-50/30">
                  <td className="px-3 py-2" style={{minWidth:180}}><select value={row.product_name||''} onChange={e=>upd(idx,'product_name',e.target.value)} className={sCls}><option value="">Select</option>{products.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}</select></td>
                  <td className="px-3 py-2" style={{minWidth:140}}><input value={row.description||''} onChange={e=>upd(idx,'description',e.target.value)} placeholder="Description" className={iCls}/></td>
                  <td className="px-3 py-2 w-16"><input type="number" min={1} value={row.quantity} onChange={e=>upd(idx,'quantity',e.target.value)} className={`${iCls} text-center`}/></td>
                  <td className="px-3 py-2 text-right text-gray-400 whitespace-nowrap">{fmt(row.list_price)}</td>
                  <td className="px-3 py-2 w-24"><input type="number" min={0} value={row.unit_price} onChange={e=>upd(idx,'unit_price',e.target.value)} className={`${iCls} text-right`}/></td>
                  <td className="px-3 py-2 w-16"><input type="number" min={0} max={100} value={row.discount_pct} onChange={e=>upd(idx,'discount_pct',e.target.value)} className={`${iCls} text-center ${row.discount_pct>0?'border-green-300 bg-green-50':''}`}/></td>
                  <td className="px-3 py-2 w-16"><input type="number" min={0} max={100} value={row.tax_pct} onChange={e=>upd(idx,'tax_pct',e.target.value)} className={`${iCls} text-center`}/></td>
                  <td className="px-3 py-2 text-right font-bold text-[#0F172A] whitespace-nowrap">{fmt(row.extended_price)}</td>
                  <td className="px-2 py-2"><button onClick={()=>remove(idx)} className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-xs font-bold flex items-center justify-center">✕</button></td>
                </tr>
              ))
            }
          </tbody>
          {items.length>0&&(
            <tfoot className="border-t-2 border-blue-100">
              <tr className="bg-gray-50"><td colSpan={7} className="px-5 py-2 text-right text-xs text-gray-500 font-medium">Subtotal</td><td className="px-3 py-2 text-right text-xs font-semibold">{fmt(subtotal)}</td><td/></tr>
              {totalDisc>0&&<tr className="bg-green-50"><td colSpan={7} className="px-5 py-2 text-right text-xs text-green-600">Total Discount</td><td className="px-3 py-2 text-right text-xs font-semibold text-green-600">- {fmt(totalDisc)}</td><td/></tr>}
              {totalTax>0&&<tr className="bg-blue-50"><td colSpan={7} className="px-5 py-2 text-right text-xs text-blue-600">Total Tax</td><td className="px-3 py-2 text-right text-xs font-semibold text-blue-600">+ {fmt(totalTax)}</td><td/></tr>}
              <tr className="bg-[#0F172A]"><td colSpan={7} className="px-5 py-3 text-right font-bold text-white text-sm">Net Total</td><td className="px-3 py-3 text-right font-bold text-white text-base">{fmt(subtotal-totalDisc+totalTax)}</td><td/></tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Quotation Detail Panel ────────────────────────────────────────────────────
function QuotationDetail({ quote, onClose, onSaved }) {
  const {
    customers, contacts, products, enterpriseUsers, quoteTemplates,
    organizations, businessUnits, currentUser,
    updateQuotation, generateNewVersion, createOrderFromQuotation,
    checkMatchingApprovalProcess, submitForApproval, processApproval,
    approvalRequests, appPreferences, exchangeRates,
  } = useApp();

  const [form,           setForm]           = useState({ ...quote });
  const [items,          setItems]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [printing,       setPrinting]       = useState(false);
  const [creatingOrder,  setCreatingOrder]  = useState(false);
  const [matchingProcess,setMatchingProcess]= useState(null);
  const [dialog,         setDialog]         = useState(null); // { type, data }
  const [displayCurrency,setDisplayCurrency]= useState(quote.currency || appPreferences.default_currency || 'INR');

  useEffect(() => {
    const load = async () => {
      if (!supabase) return;
      const { data } = await supabase.from('quotation_line_items').select('*').eq('quote_number', quote.quote_number).order('sort_order');
      setItems((data||[]).map(r => ({ _id:r.id, product_name:r.product_name||'', product_code:r.product_code||'', description:r.description||'', quantity:Number(r.quantity||1), unit_price:Number(r.unit_price||0), list_price:Number(r.list_price||0), discount_pct:Number(r.discount_pct||0), tax_pct:Number(r.tax_pct||0), extended_price:Number(r.extended_price||0) })));
      setLoading(false);
      const proc = await checkMatchingApprovalProcess('quotations', { ...quote });
      setMatchingProcess(proc);
    };
    load();
    setForm({ ...quote });
  }, [quote.id]);

  const s = (k,v) => setForm(p => ({ ...p, [k]:v }));

  const subtotal    = items.reduce((s,i) => s + i.quantity*i.unit_price, 0);
  const totalDisc   = items.reduce((s,i) => s + i.quantity*i.unit_price*i.discount_pct/100, 0);
  const totalTax    = items.reduce((s,i) => s + (i.quantity*i.unit_price*(1-i.discount_pct/100))*i.tax_pct/100, 0);
  const overallDisc = subtotal * (Number(form.overall_discount)||0)/100;
  const shipping    = Number(form.shipping_cost||0);
  const grandTotal  = subtotal - totalDisc + totalTax - overallDisc + shipping;

  const fmtCur = (n, cur) => new Intl.NumberFormat('en-IN',{style:'currency',currency:cur||form.currency||'INR',maximumFractionDigits:0}).format(n||0);

  const convertedTotal = displayCurrency !== (form.currency||'INR') && exchangeRates[displayCurrency]
    ? grandTotal * (exchangeRates[displayCurrency] / (exchangeRates[form.currency||'INR'] || 1))
    : grandTotal;

  const handleSave = async () => {
    setSaving(true);
    await updateQuotation({ ...form, subtotal, total_discount:totalDisc, total_tax:totalTax, grand_total:grandTotal }, items);
    setSaving(false);
    if (onSaved) onSaved();
  };

  // ── Action handlers ──────────────────────────────────────────────────────────
  const doSubmit = async () => {
    setDialog(null);
    if (matchingProcess) {
      // Trigger approval flow
      await submitForApproval('quotations', quote.quote_number, form.name, { ...form });
      s('status', 'Pending Approval');
    } else {
      // No approval process — auto-approve
      await updateQuotation({ ...form, status:'Submitted', subtotal, total_discount:totalDisc, total_tax:totalTax, grand_total:grandTotal }, items);
      s('status', 'Submitted');
    }
    if (onSaved) onSaved();
  };

  const doSendToCustomer = async () => {
    setDialog(null);
    await updateQuotation({ ...form, status:'Sent to Customer', subtotal, total_discount:totalDisc, total_tax:totalTax, grand_total:grandTotal }, items);
    s('status', 'Sent to Customer');
    if (onSaved) onSaved();
  };

  const doAccept = async () => {
    setDialog(null);
    await updateQuotation({ ...form, status:'Accepted', subtotal, total_discount:totalDisc, total_tax:totalTax, grand_total:grandTotal }, items);
    s('status', 'Accepted');
    if (onSaved) onSaved();
  };

  const doReject = async (reason) => {
    setDialog(null);
    await updateQuotation({ ...form, status:'Rejected', internal_notes:(form.internal_notes||'') + `\nRejection reason: ${reason||'Not specified'}`, subtotal, total_discount:totalDisc, total_tax:totalTax, grand_total:grandTotal }, items);
    s('status', 'Rejected');
    if (onSaved) onSaved();
  };

  const doCreateOrder = async () => {
    setDialog(null);
    setCreatingOrder(true);
    const ordId = await createOrderFromQuotation({ ...form, grand_total:grandTotal });
    setCreatingOrder(false);
    if (ordId) { s('status','Ordered'); if (onSaved) onSaved(); onClose(); }
  };

  const doNewVersion = async () => {
    setDialog(null);
    await generateNewVersion(quote);
    if (onSaved) onSaved();
    onClose();
  };

  // ── Action buttons based on current status ────────────────────────────────
  const statusMeta = STATUS_META[form.status] || STATUS_META['Draft'];
  const isPendingApproval = form.status === 'Pending Approval';

  const renderActionButtons = () => {
    const btn = (label, icon, onClick, cls='bg-[#0F172A] hover:bg-blue-900') => (
      <button key={label} onClick={onClick}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white shadow-lg transition-all ${cls}`}>
        <span>{icon}</span>{label}
      </button>
    );

    const decisionStatuses = ['Approved','Rejected','Pending Approval'];

    switch (form.status) {
      case 'Draft':
        return [
          btn('Submit Quote', '📤',
            () => setDialog({ type:'submit', process: matchingProcess }),
            'bg-blue-600 hover:bg-blue-700'),
        ];
      case 'Submitted':
        return [
          btn('Send to Customer', '📨',
            () => setDialog({ type:'send' }),
            'bg-purple-600 hover:bg-purple-700'),
          btn('Revise (New Version)', '📋',
            () => setDialog({ type:'revise' }),
            'bg-gray-600 hover:bg-gray-700'),
        ];
      case 'Approved':
        return [
          btn('Send to Customer', '📨',
            () => setDialog({ type:'send' }),
            'bg-purple-600 hover:bg-purple-700'),
        ];
      case 'Sent to Customer':
        return [
          btn('Mark Accepted', '🤝',
            () => setDialog({ type:'accept' }),
            'bg-emerald-600 hover:bg-emerald-700'),
          btn('Mark Rejected', '❌',
            () => setDialog({ type:'reject' }),
            'bg-red-600 hover:bg-red-700'),
        ];
      case 'Accepted':
        return [
          btn('Create Order', '🛒',
            () => setDialog({ type:'order' }),
            'bg-green-600 hover:bg-green-700'),
        ];
      case 'Ordered':
      case 'Rejected':
      case 'Expired':
      case 'Cancelled':
        return [
          btn('New Version', '📋',
            () => setDialog({ type:'revise' }),
            'bg-gray-600 hover:bg-gray-700'),
        ];
      default: return [];
    }
  };

  // ── Approval banner (for Pending Approval) ────────────────────────────────
  const pendingRequest = approvalRequests.find(r =>
    (r.record_id === quote.id || r.record_id === quote.quote_number) &&
    r.record_type === 'quotations' && r.status === 'Pending'
  );

  const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';
  const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';

  // Dialog state for reject reason
  const [rejectReason, setRejectReason] = useState('');

  const ownerUser = enterpriseUsers.find(u => u.id === form.owner_id || u.email === form.owner);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] overflow-y-auto">
        <div className="bg-white rounded-[28px] shadow-2xl w-[98vw] my-4 mx-auto overflow-hidden flex flex-col" style={{minHeight:'95vh'}}>

          {/* Header */}
          <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-8 py-5 text-white flex items-center justify-between flex-shrink-0">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold">{form.name || form.quote_number}</h2>
                {/* Coloured status badge — NOT a button */}
                <span className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold border-2 ${statusMeta.color}`}>
                  <span>{statusMeta.icon}</span>{statusMeta.label}
                </span>
                <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">v{form.version||1}</span>
                {ownerUser && <span className="bg-white/10 text-white text-xs px-3 py-1 rounded-full">👤 {ownerUser.first_name} {ownerUser.last_name}</span>}
              </div>
              <p className="text-blue-300 text-sm mt-1">{form.quote_number} · {form.customer}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => {
                setPrinting(true);
                try {
                  const template = quoteTemplates.find(t=>t.id===form.template_id) || quoteTemplates.find(t=>t.isDefault) || quoteTemplates[0];
                  const oUser = enterpriseUsers.find(u=>u.id===form.owner_id||u.email===form.owner);
                  const qd = { ...form, subtotal, grand_total:grandTotal, owner_display: oUser?`${oUser.first_name} ${oUser.last_name}`:(form.owner||'') };
                  const html = buildQuoteHTML(qd, items, template);
                  let iframe = document.getElementById('pdf-preview-frame');
                  if (!iframe) { iframe=document.createElement('iframe'); iframe.id='pdf-preview-frame'; iframe.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:9999;background:white;'; document.body.appendChild(iframe); }
                  iframe.srcdoc=html; iframe.style.display='block';
                  ['pdf-close-btn','pdf-print-btn'].forEach(id=>{ let el=document.getElementById(id); if(el){el.style.display='block';}});
                  if (!document.getElementById('pdf-close-btn')) {
                    const cb=document.createElement('button'); cb.id='pdf-close-btn'; cb.textContent='✕ Close Preview'; cb.style.cssText='position:fixed;top:16px;right:16px;z-index:10000;background:#0F172A;color:white;border:none;padding:10px 20px;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer;'; cb.onclick=()=>{iframe.style.display='none';cb.style.display='none';pb.style.display='none';}; document.body.appendChild(cb);
                    const pb=document.createElement('button'); pb.id='pdf-print-btn'; pb.textContent='🖨️ Print / Save PDF'; pb.style.cssText='position:fixed;top:16px;right:180px;z-index:10000;background:#16A34A;color:white;border:none;padding:10px 20px;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer;'; pb.onclick=()=>{iframe.contentWindow?.focus();iframe.contentWindow?.print();}; document.body.appendChild(pb);
                  }
                } catch(e){alert('PDF error: '+e.message);} finally{setPrinting(false);}
              }} disabled={printing} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
                {printing?'⏳':'🖨️'} {printing?'Generating...':'PDF Preview'}
              </button>
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg">✕</button>
            </div>
          </div>

          {/* Action bar */}
          <div className="bg-gray-50 border-b border-blue-100 px-8 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-gray-400 uppercase mr-2">Actions:</span>
            {loading ? <span className="text-xs text-gray-400">Loading...</span> : renderActionButtons()}
            {creatingOrder && <span className="text-sm text-gray-500 animate-pulse">⏳ Creating Order...</span>}
          </div>

          {/* Approval banner */}
          {isPendingApproval && pendingRequest && (
            <div className="mx-8 mt-4 bg-yellow-50 border-2 border-yellow-200 rounded-[24px] p-5">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⏳</span>
                <div>
                  <div className="font-bold text-[#0F172A]">Pending Approval</div>
                  <div className="text-sm text-gray-600">Submitted by {pendingRequest.submitted_by} · Request #{pendingRequest.request_number}</div>
                  {matchingProcess && <div className="text-xs text-yellow-700 mt-1">Process: {matchingProcess.name}</div>}
                </div>
              </div>
            </div>
          )}

          {/* Body */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center"><div className="text-4xl animate-pulse">📄</div></div>
          ) : (
            <div className="flex-1 overflow-y-auto p-8 bg-gradient-to-br from-white to-blue-50 space-y-6">

              {/* Currency display converter */}
              {Object.keys(exchangeRates).length > 0 && (
                <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 flex items-center gap-4">
                  <span className="text-sm font-semibold text-[#0F172A]">💱 View amounts in:</span>
                  <select value={displayCurrency} onChange={e=>setDisplayCurrency(e.target.value)} className="border border-blue-200 rounded-xl px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none">
                    {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                  {displayCurrency !== (form.currency||'INR') && (
                    <span className="text-sm text-blue-700 font-medium">
                      Grand Total: {fmtCur(convertedTotal, displayCurrency)} ({displayCurrency})
                    </span>
                  )}
                </div>
              )}

              {/* Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[
                  { l:'Quote Name',     field:'name',           type:'text' },
                  { l:'Customer',       field:'customer_select' },
                  { l:'Contact',        field:'contact_select' },
                  { l:'Validity Date',  field:'validity_date',  type:'date' },
                  { l:'Payment Terms',  field:'payment_terms',  type:'select', opts:['Due on Receipt','Net 15','Net 30','Net 45','Net 60'] },
                  { l:'Shipping Terms', field:'shipping_terms', type:'select', opts:['FOB Origin','FOB Destination','CIF','Ex Works','DDP'] },
                  { l:'Currency',       field:'currency',       type:'select', opts:CURRENCIES },
                  { l:'Template',       field:'template_id',    type:'template_select' },
                  { l:'Owner',          field:'owner_select' },
                ].map(({ l, field, type, opts }) => (
                  <div key={field} className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">{l}</label>
                    {field==='customer_select' ? <select value={form.customer_id||''} onChange={e=>{const c=customers.find(x=>x.id===e.target.value);s('customer_id',c?.id||'');s('customer',c?.name||'');}} className={sCls}><option value="">Select</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    :field==='contact_select'  ? <select value={form.contact_id||''} onChange={e=>{const c=contacts.find(x=>x.id===e.target.value);s('contact_id',c?.id||'');s('contact',c?.name||'');}} className={sCls}><option value="">Select</option>{contacts.filter(c=>!form.customer_id||c.customerId===form.customer_id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    :field==='owner_select'    ? <select value={form.owner_id||''} onChange={e=>{const u=enterpriseUsers.find(x=>x.id===e.target.value);s('owner_id',u?.id||'');s('owner',u?.email||'');}} className={sCls}><option value="">Unassigned</option>{enterpriseUsers.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select>
                    :field==='template_id'     ? <select value={form.template_id||''} onChange={e=>s('template_id',e.target.value)} className={sCls}><option value="">Default Template</option>{quoteTemplates.map(t=><option key={t.id} value={t.id}>{t.name}{t.isDefault?' (Default)':''}</option>)}</select>
                    :type==='select'           ? <select value={form[field]||''} onChange={e=>s(field,e.target.value)} className={sCls}><option value="">Select</option>{(opts||[]).map(o=><option key={o}>{o}</option>)}</select>
                    :type==='date'             ? <input type="date" value={form[field]||''} onChange={e=>s(field,e.target.value)} className={iCls}/>
                    :                           <input type="text" value={form[field]||''} onChange={e=>s(field,e.target.value)} className={iCls}/>
                    }
                  </div>
                ))}
              </div>

              {/* Addresses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[['Billing Address','billing_address'],['Shipping Address','shipping_address']].map(([l,f])=>(
                  <div key={f} className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">{l}</label>
                    <textarea rows={3} value={form[f]||''} onChange={e=>s(f,e.target.value)} className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"/>
                  </div>
                ))}
              </div>

              {/* Line Items */}
              <QuoteLineItems items={items} setItems={setItems} products={products} currency={form.currency||'INR'}/>

              {/* Charges + Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm space-y-4">
                  <h3 className="font-bold text-[#0F172A]">Additional Charges</h3>
                  <div><label className="text-xs font-bold uppercase text-gray-400 block mb-2">Overall Discount (%)</label><input type="number" min={0} max={100} value={form.overall_discount||0} onChange={e=>s('overall_discount',e.target.value)} className={iCls}/></div>
                  <div><label className="text-xs font-bold uppercase text-gray-400 block mb-2">Shipping Cost ({form.currency||'INR'})</label><input type="number" min={0} value={form.shipping_cost||0} onChange={e=>s('shipping_cost',e.target.value)} className={iCls}/></div>
                </div>
                <div className="bg-gradient-to-br from-[#0F172A] to-blue-900 rounded-2xl p-5 text-white shadow-xl">
                  <h3 className="font-bold mb-4">Price Summary ({form.currency||'INR'})</h3>
                  <div className="space-y-2 text-sm">
                    {[[`Subtotal`,fmtCur(subtotal)],totalDisc>0&&[`Line Discounts`,`- ${fmtCur(totalDisc)}`],totalTax>0&&[`Tax`,`+ ${fmtCur(totalTax)}`],overallDisc>0&&[`Overall Disc (${form.overall_discount}%)`,`- ${fmtCur(overallDisc)}`],shipping>0&&[`Shipping`,`+ ${fmtCur(shipping)}`]].filter(Boolean).map(([l,v])=>(
                      <div key={l} className="flex justify-between py-1 border-b border-white/10"><span className="text-blue-200">{l}</span><span className="font-semibold">{v}</span></div>
                    ))}
                    <div className="flex justify-between py-3 mt-2 bg-white/10 rounded-xl px-3"><span className="font-bold text-lg">Grand Total</span><span className="font-bold text-xl">{fmtCur(grandTotal)}</span></div>
                    {displayCurrency !== (form.currency||'INR') && (
                      <div className="text-center text-blue-300 text-xs mt-2">≈ {fmtCur(convertedTotal, displayCurrency)} {displayCurrency}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[['Customer Notes (shown on quote)','notes'],['Internal Notes','internal_notes']].map(([l,f])=>(
                  <div key={f} className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">{l}</label>
                    <textarea rows={3} value={form[f]||''} onChange={e=>s(f,e.target.value)} className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"/>
                  </div>
                ))}
              </div>

              {/* System Info */}
              <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-[#0F172A]">System Information</h3><span className="text-2xl">🛡️</span>
                </div>
                <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[['Created By',quote.created_by||'-'],['Created At',quote.created_at?new Date(quote.created_at).toLocaleString('en-IN'):'-'],['Updated By',quote.updated_by||'-'],['Updated At',quote.updated_at?new Date(quote.updated_at).toLocaleString('en-IN'):'-'],['Organization',organizations?.find(o=>o.id===quote.organization_id)?.name||'-'],['Business Unit',businessUnits?.find(b=>b.id===quote.business_unit_id)?.name||'-'],['Quote Number',quote.quote_number||'-'],['Version',`v${quote.version||1}`]].map(([l,v])=>(
                    <div key={l}><div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{l}</div><div className="text-sm text-[#0F172A] font-medium bg-gray-50 rounded-xl px-3 py-2 truncate">{v}</div></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-8 py-4 border-t border-blue-100 bg-white flex items-center justify-between flex-shrink-0">
            <div className="text-sm text-gray-400">{items.length} line item{items.length!==1?'s':''} · <span className="font-bold text-[#0F172A]">{fmtCur(grandTotal)}</span></div>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-6 py-3 text-sm rounded-2xl font-semibold bg-white border border-blue-200 text-[#0F172A] hover:bg-blue-50">Close</button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-3 text-sm rounded-2xl font-semibold bg-gradient-to-r from-[#0F172A] to-blue-800 text-white hover:opacity-90 disabled:opacity-50 shadow-lg">
                {saving?'Saving...':'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirmation Dialogs ── */}
      {/* Submit */}
      <ConfirmDialog open={dialog?.type==='submit'}
        title="Submit Quotation"
        message={dialog?.process ? `This will submit "${form.name}" for approval via the "${dialog.process.name}" process. The approver will be notified.` : `This will submit "${form.name}". No approval process is configured, so it will be marked as Submitted immediately.`}
        confirmLabel={dialog?.process ? 'Submit for Approval' : 'Submit Quote'}
        confirmClass="bg-blue-600 hover:bg-blue-700"
        onConfirm={doSubmit} onCancel={()=>setDialog(null)}/>

      {/* Send to Customer */}
      <ConfirmDialog open={dialog?.type==='send'}
        title="Send to Customer"
        message={`Mark "${form.name}" as Sent to Customer? This signals the quote has been shared with ${form.customer||'the customer'}.`}
        confirmLabel="Mark as Sent" confirmClass="bg-purple-600 hover:bg-purple-700"
        onConfirm={doSendToCustomer} onCancel={()=>setDialog(null)}/>

      {/* Accept */}
      <ConfirmDialog open={dialog?.type==='accept'}
        title="Mark as Accepted"
        message={`Confirm that ${form.customer||'the customer'} has accepted "${form.name}"?`}
        confirmLabel="Mark Accepted" confirmClass="bg-emerald-600 hover:bg-emerald-700"
        onConfirm={doAccept} onCancel={()=>setDialog(null)}/>

      {/* Reject */}
      <ConfirmDialog open={dialog?.type==='reject'}
        title="Mark as Rejected"
        message={`Mark "${form.name}" as rejected by the customer?`}
        confirmLabel="Mark Rejected" confirmClass="bg-red-600 hover:bg-red-700"
        onConfirm={()=>doReject(rejectReason)} onCancel={()=>{setDialog(null);setRejectReason('');}}>
        <div><label className="text-xs font-bold uppercase text-gray-500 block mb-2">Rejection Reason (optional)</label>
          <textarea rows={3} value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Enter rejection reason..." className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"/></div>
      </ConfirmDialog>

      {/* Create Order */}
      <ConfirmDialog open={dialog?.type==='order'}
        title="Create Order"
        message={`Create an Order from "${form.name}" (${form.quote_number})? All ${items.length} line items and pricing will be copied. The quotation will be marked as Accepted.`}
        confirmLabel="Create Order" confirmClass="bg-green-600 hover:bg-green-700"
        onConfirm={doCreateOrder} onCancel={()=>setDialog(null)}/>

      {/* New Version */}
      <ConfirmDialog open={dialog?.type==='revise'}
        title="Create New Version"
        message={`Create a new version (v${(form.version||1)+1}) of "${form.name}"? A copy will be created as a Draft for revision.`}
        confirmLabel="Create New Version" confirmClass="bg-gray-600 hover:bg-gray-700"
        onConfirm={doNewVersion} onCancel={()=>setDialog(null)}/>
    </>
  );
}

// ─── Quotations List Page ──────────────────────────────────────────────────────
export default function QuotationsPage() {
  const { quotations, fetchQuotations, customers, createQuotation, deleteQuotation, appPreferences } = useApp();
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [createOpen,    setCreateOpen]    = useState(false);
  const [form,          setForm]          = useState({ status:'Draft', currency: appPreferences.default_currency||'INR', version:1, overall_discount:0, shipping_cost:0 });
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('All');
  const [saving,        setSaving]        = useState(false);

  const sf = (k,v) => setForm(p => ({...p,[k]:v}));
  const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';
  const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';

  const filtered = useMemo(() => {
    let data = quotations;
    if (search.trim()) { const q=search.toLowerCase(); data=data.filter(r=>[r.name,r.quote_number,r.customer].some(v=>String(v||'').toLowerCase().includes(q))); }
    if (statusFilter !== 'All') data = data.filter(r => r.status === statusFilter);
    return data;
  }, [quotations, search, statusFilter]);

  const fmtCur = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:appPreferences.default_currency||'INR',maximumFractionDigits:0}).format(n||0);

  const stats = useMemo(() => ({
    total:    quotations.length,
    draft:    quotations.filter(q=>q.status==='Draft').length,
    sent:     quotations.filter(q=>q.status==='Sent to Customer').length,
    accepted: quotations.filter(q=>q.status==='Accepted').length,
    value:    quotations.filter(q=>q.status==='Accepted').reduce((s,q)=>s+(q.grand_total||0),0),
  }), [quotations]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[28px] p-6 text-white flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Quotations</h1><p className="text-blue-200 mt-1">CPQ — Configure, Price, Quote</p></div>
        <button onClick={()=>{setForm({status:'Draft',currency:appPreferences.default_currency||'INR',version:1,overall_discount:0,shipping_cost:0});setCreateOpen(true);}} className="bg-white text-[#0F172A] px-5 py-2.5 rounded-2xl font-bold text-sm shadow-lg hover:bg-blue-50">+ Create Quotation</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[{l:'Total Quotes',v:stats.total,c:'from-[#0F172A] to-blue-900',i:'📄'},{l:'Drafts',v:stats.draft,c:'from-gray-500 to-gray-700',i:'📝'},{l:'Sent',v:stats.sent,c:'from-purple-500 to-purple-700',i:'📤'},{l:'Accepted',v:stats.accepted,c:'from-green-500 to-emerald-600',i:'✅'},{l:'Accepted Value',v:fmtCur(stats.value),c:'from-amber-500 to-orange-500',i:'💰'}].map(stat=>(
          <div key={stat.l} className={`bg-gradient-to-r ${stat.c} text-white rounded-2xl p-4 shadow-lg`}><div className="text-2xl mb-1">{stat.i}</div><div className="text-2xl font-bold">{stat.v}</div><div className="text-xs opacity-80 mt-1">{stat.l}</div></div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search quotations..." className="flex-1 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-400"/>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option>All</option>{QUOTE_STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-[#0F172A] to-blue-900 text-white">
              <tr>{['Quote #','Name','Customer','Version','Status','Grand Total','Validity','Actions'].map(h=><th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.length===0
                ? <tr><td colSpan={8} className="px-5 py-16 text-center"><div className="text-5xl mb-3">📄</div><div className="font-bold text-[#0F172A] text-lg mb-2">No quotations yet</div><p className="text-gray-400">Create a quotation or generate one from an Opportunity.</p></td></tr>
                : filtered.map(q => {
                    const sm = STATUS_META[q.status] || STATUS_META['Draft'];
                    return (
                      <tr key={q.id} className="border-t border-blue-50 hover:bg-blue-50/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-gray-400">{q.quote_number}</td>
                        <td className="px-5 py-3.5"><button onClick={()=>setSelectedQuote(q)} className="font-semibold text-[#0F172A] hover:text-blue-700 hover:underline text-left">{q.name||q.quote_number}</button></td>
                        <td className="px-5 py-3.5 text-gray-600">{q.customer||'-'}</td>
                        <td className="px-5 py-3.5 text-center"><span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">v{q.version||1}</span></td>
                        <td className="px-5 py-3.5"><span className={`flex items-center gap-1.5 w-fit px-3 py-1 rounded-full text-xs font-bold border ${sm.color}`}><span>{sm.icon}</span>{sm.label}</span></td>
                        <td className="px-5 py-3.5 font-bold text-[#0F172A]">{fmtCur(q.grand_total)}</td>
                        <td className="px-5 py-3.5 text-gray-500">{q.validity_date||'-'}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex gap-2">
                            <button onClick={()=>setSelectedQuote(q)} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-semibold">Open</button>
                            <button onClick={()=>{ if(window.confirm('Delete this quotation?')) deleteQuotation(q.id); }} className="bg-red-100 hover:bg-red-200 text-red-500 px-3 py-1.5 rounded-xl text-xs font-semibold">Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selectedQuote && <QuotationDetail quote={selectedQuote} onClose={()=>setSelectedQuote(null)} onSaved={()=>{fetchQuotations();setSelectedQuote(null);}}/>}

      {/* Create modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg">
            <div className="px-8 py-6 border-b border-blue-100 flex items-center justify-between">
              <div><h2 className="text-2xl font-bold text-[#0F172A]">Create Quotation</h2><p className="text-gray-400 text-sm mt-1">Start a new quotation from scratch.</p></div>
              <button onClick={()=>setCreateOpen(false)} className="w-10 h-10 rounded-2xl bg-gray-100 text-[#0F172A] font-bold flex items-center justify-center text-lg hover:bg-gray-200">✕</button>
            </div>
            <div className="p-8 space-y-4">
              <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Quotation Name *</label><input value={form.name||''} onChange={e=>sf('name',e.target.value)} placeholder="e.g. Enterprise Software Proposal" className={iCls}/></div>
              <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Customer</label><select value={form.customer_id||''} onChange={e=>{const c=customers.find(x=>x.id===e.target.value);sf('customer_id',c?.id||'');sf('customer',c?.name||'');}} className={sCls}><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Validity Date</label><input type="date" value={form.validity_date||''} onChange={e=>sf('validity_date',e.target.value)} className={iCls}/></div>
              <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Currency</label><select value={form.currency||'INR'} onChange={e=>sf('currency',e.target.value)} className={sCls}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></div>
            </div>
            <div className="px-8 py-5 border-t border-blue-100 flex justify-end gap-3">
              <button onClick={()=>setCreateOpen(false)} className="px-6 py-3 text-sm rounded-2xl font-semibold bg-white border border-blue-200 text-[#0F172A] hover:bg-blue-50">Cancel</button>
              <button onClick={async()=>{if(!form.name?.trim()){alert('Name required.');return;}setSaving(true);const q=await createQuotation(form,[]);setSaving(false);if(q){setCreateOpen(false);setSelectedQuote(q);}}} disabled={saving} className="px-6 py-3 text-sm rounded-2xl font-semibold bg-gradient-to-r from-[#0F172A] to-blue-800 text-white hover:opacity-90 disabled:opacity-50 shadow-lg">
                {saving?'Creating...':'Create Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
