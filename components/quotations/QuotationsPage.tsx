// @ts-nocheck
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';

// ─── Status options ────────────────────────────────────────────────────────────
const QUOTE_STATUSES = ['Draft','Submitted','Approved','Sent to Customer','Accepted','Rejected','Expired','Cancelled'];

// ─── Default template sections ─────────────────────────────────────────────────
const DEFAULT_SECTIONS = [
  { id:'header',    type:'header',    name:'Header',            enabled:true, order:1, settings:{ bgColor:'#0F172A', textColor:'#FFFFFF', showLogo:false, logoUrl:'', companyName:'Business Pro', tagline:'Enterprise Solutions' } },
  { id:'quote_info',type:'quote_info',name:'Quote Information', enabled:true, order:2, settings:{ bgColor:'#F8FAFC', textColor:'#0F172A' } },
  { id:'customer',  type:'customer',  name:'Customer Details',  enabled:true, order:3, settings:{ bgColor:'#FFFFFF', textColor:'#0F172A', showBillTo:true, showShipTo:true } },
  { id:'items',     type:'items',     name:'Line Items',        enabled:true, order:4, settings:{ headerBgColor:'#0F172A', headerTextColor:'#FFFFFF', stripedRows:true, showProductCode:false, showDiscount:true, showTax:true } },
  { id:'totals',    type:'totals',    name:'Pricing Summary',   enabled:true, order:5, settings:{ bgColor:'#F8FAFC', accentColor:'#0F172A', showShipping:true, showTax:true } },
  { id:'terms',     type:'terms',     name:'Terms & Conditions',enabled:true, order:6, settings:{ content:'Payment is due within the terms specified. All prices are subject to applicable taxes. This quotation is valid until the validity date mentioned.' } },
  { id:'footer',    type:'footer',    name:'Footer',            enabled:true, order:7, settings:{ bgColor:'#0F172A', textColor:'#FFFFFF', showSignature:true, signatureLabel:'Authorized Signature', footerText:'' } },
];

// ─── PDF HTML Builder ──────────────────────────────────────────────────────────
const buildQuoteHTML = (quote, items, template) => {
  const sections = template?.sections || DEFAULT_SECTIONS;
  const pageSettings = template?.page_settings || {};
  const font = pageSettings.fontFamily || 'Arial, sans-serif';
  const enabled = sections.filter(s => s.enabled).sort((a,b) => a.order - b.order);

  const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n||0);
  const subtotal = items.reduce((s,i) => s + i.quantity * i.unit_price, 0);
  const totalDisc = items.reduce((s,i) => s + (i.quantity * i.unit_price * i.discount_pct/100), 0);
  const totalTax = items.reduce((s,i) => s + ((i.quantity * i.unit_price - i.quantity*i.unit_price*i.discount_pct/100) * i.tax_pct/100), 0);
  const overallDisc = subtotal * (quote.overall_discount||0)/100;
  const shipping = Number(quote.shipping_cost||0);
  const grandTotal = subtotal - totalDisc + totalTax - overallDisc + shipping;

  // Add owner to quote data for PDF
  const ownerUser = enterpriseUsers?.find(u => u.id === quote.owner_id || u.email === quote.owner);
  if (ownerUser) quote = { ...quote, owner_display: `${ownerUser.first_name} ${ownerUser.last_name}` };

  const renderSection = (sec) => {
    const s = sec.settings || {};
    switch(sec.type) {
      case 'header': return `
        <div style="background:${s.bgColor};color:${s.textColor};padding:40px 50px;display:flex;align-items:center;justify-content:space-between;">
          <div>
            ${s.showLogo && s.logoUrl ? `<img src="${s.logoUrl}" style="height:60px;margin-bottom:10px;display:block;">` : ''}
            <div style="font-size:28px;font-weight:bold;">${s.companyName||'Company Name'}</div>
            <div style="font-size:13px;opacity:0.8;margin-top:4px;">${s.tagline||''}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:32px;font-weight:bold;letter-spacing:2px;">QUOTATION</div>
            <div style="font-size:14px;opacity:0.8;margin-top:6px;">${quote.quote_number||''}</div>
          </div>
        </div>`;

      case 'quote_info': return `
        <div style="background:${s.bgColor};color:${s.textColor};padding:25px 50px;border-bottom:2px solid #E2E8F0;">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;">
            <div><div style="font-size:11px;text-transform:uppercase;opacity:0.6;margin-bottom:4px;">Quote Number</div><div style="font-weight:600;">${quote.quote_number||'-'}</div></div>
            <div><div style="font-size:11px;text-transform:uppercase;opacity:0.6;margin-bottom:4px;">Date</div><div style="font-weight:600;">${formatDate(quote.created_at)||'-'}</div></div>
            <div><div style="font-size:11px;text-transform:uppercase;opacity:0.6;margin-bottom:4px;">Valid Until</div><div style="font-weight:600;">${quote.validity_date||'-'}</div></div>
            <div><div style="font-size:11px;text-transform:uppercase;opacity:0.6;margin-bottom:4px;">Version</div><div style="font-weight:600;">v${quote.version||1}</div></div>
            ${quote.payment_terms?`<div><div style="font-size:11px;text-transform:uppercase;opacity:0.6;margin-bottom:4px;">Payment Terms</div><div style="font-weight:600;">${quote.payment_terms}</div></div>`:''}
            ${quote.shipping_terms?`<div><div style="font-size:11px;text-transform:uppercase;opacity:0.6;margin-bottom:4px;">Shipping Terms</div><div style="font-weight:600;">${quote.shipping_terms}</div></div>`:''}
          </div>
        </div>`;

      case 'customer': return `
        <div style="background:${s.bgColor};color:${s.textColor};padding:25px 50px;display:grid;grid-template-columns:1fr 1fr;gap:40px;border-bottom:1px solid #E2E8F0;">
          ${s.showBillTo?`<div><div style="font-size:11px;text-transform:uppercase;font-weight:700;margin-bottom:10px;color:#64748B;">Bill To</div><div style="font-weight:700;font-size:16px;">${quote.customer||'-'}</div>${quote.billing_address?`<div style="font-size:13px;margin-top:6px;line-height:1.6;color:#475569;">${quote.billing_address}</div>`:''}${quote.contact?`<div style="font-size:13px;margin-top:4px;color:#475569;">Attn: ${quote.contact}</div>`:''}</div>`:''}
          ${s.showShipTo&&quote.shipping_address?`<div><div style="font-size:11px;text-transform:uppercase;font-weight:700;margin-bottom:10px;color:#64748B;">Ship To</div><div style="font-size:13px;line-height:1.6;color:#475569;">${quote.shipping_address}</div></div>`:''}
        </div>`;

      case 'items': return `
        <div style="padding:30px 50px;">
          <div style="font-size:13px;font-weight:700;text-transform:uppercase;margin-bottom:15px;color:#64748B;">Products & Services</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:${s.headerBgColor};color:${s.headerTextColor};">
                <th style="padding:12px 14px;text-align:left;font-weight:600;">#</th>
                ${s.showProductCode?'<th style="padding:12px 14px;text-align:left;font-weight:600;">Code</th>':''}
                <th style="padding:12px 14px;text-align:left;font-weight:600;">Product / Service</th>
                <th style="padding:12px 14px;text-align:right;font-weight:600;">Qty</th>
                <th style="padding:12px 14px;text-align:right;font-weight:600;">Unit Price</th>
                ${s.showDiscount?'<th style="padding:12px 14px;text-align:right;font-weight:600;">Disc %</th>':''}
                ${s.showTax?'<th style="padding:12px 14px;text-align:right;font-weight:600;">Tax %</th>':''}
                <th style="padding:12px 14px;text-align:right;font-weight:600;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item,idx) => {
                const lineNet = item.quantity * item.unit_price * (1 - item.discount_pct/100);
                const lineTotal = lineNet * (1 + item.tax_pct/100);
                return `<tr style="background:${s.stripedRows&&idx%2===1?'#F8FAFC':'#FFFFFF'};">
                  <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;color:#64748B;">${idx+1}</td>
                  ${s.showProductCode?`<td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-family:monospace;font-size:12px;">${item.product_code||'-'}</td>`:''}
                  <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;">
                    <div style="font-weight:600;">${item.product_name||'-'}</div>
                    ${item.description?`<div style="font-size:12px;color:#64748B;margin-top:2px;">${item.description}</div>`:''}
                  </td>
                  <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;text-align:right;">${item.quantity}</td>
                  <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;text-align:right;">${fmt(item.unit_price)}</td>
                  ${s.showDiscount?`<td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;text-align:right;color:${item.discount_pct>0?'#16A34A':'#94A3B8'};">${item.discount_pct>0?`${item.discount_pct}%`:'-'}</td>`:''}
                  ${s.showTax?`<td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;text-align:right;color:#64748B;">${item.tax_pct>0?`${item.tax_pct}%`:'-'}</td>`:''}
                  <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-weight:600;">${fmt(lineTotal)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;

      case 'totals': return `
        <div style="background:${s.bgColor};padding:20px 50px;display:flex;justify-content:flex-end;">
          <div style="width:320px;">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E2E8F0;font-size:14px;"><span style="color:#64748B;">Subtotal</span><span style="font-weight:600;">${fmt(subtotal)}</span></div>
            ${totalDisc>0?`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E2E8F0;font-size:14px;"><span style="color:#16A34A;">Line Discounts</span><span style="font-weight:600;color:#16A34A;">- ${fmt(totalDisc)}</span></div>`:''}
            ${overallDisc>0?`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E2E8F0;font-size:14px;"><span style="color:#16A34A;">Overall Discount (${quote.overall_discount}%)</span><span style="font-weight:600;color:#16A34A;">- ${fmt(overallDisc)}</span></div>`:''}
            ${s.showTax&&totalTax>0?`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E2E8F0;font-size:14px;"><span style="color:#64748B;">Tax</span><span style="font-weight:600;">${fmt(totalTax)}</span></div>`:''}
            ${s.showShipping&&shipping>0?`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E2E8F0;font-size:14px;"><span style="color:#64748B;">Shipping</span><span style="font-weight:600;">${fmt(shipping)}</span></div>`:''}
            <div style="display:flex;justify-content:space-between;padding:14px;margin-top:8px;background:${s.accentColor};color:#FFFFFF;border-radius:8px;font-size:16px;"><span style="font-weight:700;">GRAND TOTAL</span><span style="font-weight:700;">${fmt(grandTotal)}</span></div>
          </div>
        </div>`;

      case 'terms': return s.content ? `
        <div style="padding:25px 50px;border-top:1px solid #E2E8F0;">
          <div style="font-size:11px;text-transform:uppercase;font-weight:700;color:#64748B;margin-bottom:10px;">Terms & Conditions</div>
          <div style="font-size:12px;color:#475569;line-height:1.8;">${s.content}</div>
        </div>` : '';

      case 'footer': return `
        <div style="background:${s.bgColor};color:${s.textColor};padding:30px 50px;margin-top:20px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;">
            <div style="font-size:12px;opacity:0.7;">${s.footerText||''}</div>
            ${s.showSignature?`<div style="text-align:center;"><div style="border-top:1px solid ${s.textColor};padding-top:8px;width:200px;font-size:12px;opacity:0.8;">${s.signatureLabel||'Authorized Signature'}</div></div>`:''}
          </div>
        </div>`;

      default: return '';
    }
  };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:${font}; color:#1E293B; background:#FFFFFF; }
    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      @page { margin:0; size:A4; }
    }
  </style>
</head>
<body>
  ${enabled.map(renderSection).join('')}
  ${quote.notes?`<div style="padding:20px 50px;background:#FFFBEB;border-top:1px solid #FDE68A;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#92400E;margin-bottom:6px;">Notes</div><div style="font-size:13px;color:#78350F;">${quote.notes}</div></div>`:''}
  <div style="text-align:center;padding:15px;font-size:11px;color:#94A3B8;border-top:1px solid #F1F5F9;">Generated by Business Pro · ${new Date().toLocaleDateString()}</div>
</body>
</html>`;
};

// ─── Line Items Editor ─────────────────────────────────────────────────────────
function QuoteLineItems({ items, setItems, products }) {
  const add = () => setItems(p => [...p, { _id:Date.now(), product_name:'', product_code:'', description:'', quantity:1, unit_price:0, list_price:0, discount_pct:0, tax_pct:18, extended_price:0 }]);
  const remove = idx => setItems(p => p.filter((_,i) => i !== idx));
  const upd = (idx, field, val) => setItems(p => p.map((r,i) => {
    if (i !== idx) return r;
    const updated = { ...r, [field]: ['quantity','unit_price','list_price','discount_pct','tax_pct'].includes(field) ? Number(val) : val };
    if (field === 'product_name') {
      const prod = products.find(x => x.name === val);
      if (prod) { updated.unit_price = prod.price; updated.list_price = prod.price; }
    }
    const net = updated.quantity * updated.unit_price * (1 - updated.discount_pct/100);
    updated.extended_price = net * (1 + updated.tax_pct/100);
    return updated;
  }));

  const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n||0);
  const iCls = 'w-full border border-blue-200 rounded-lg px-2 py-2 text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs';
  const sCls = 'w-full border border-blue-200 rounded-lg px-2 py-2 text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs';

  const subtotal = items.reduce((s,i) => s + i.quantity * i.unit_price, 0);
  const totalDisc = items.reduce((s,i) => s + i.quantity * i.unit_price * i.discount_pct/100, 0);
  const totalTax = items.reduce((s,i) => s + (i.quantity*i.unit_price*(1-i.discount_pct/100)) * i.tax_pct/100, 0);

  return (
    <div className="bg-white rounded-[20px] border border-blue-100 shadow overflow-hidden">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3.5 flex items-center justify-between">
        <div><h3 className="text-white font-bold">Line Items</h3><p className="text-blue-300 text-xs mt-0.5">Products · Pricing · Discounts · Tax</p></div>
        <button type="button" onClick={add} className="bg-white text-[#0F172A] px-4 py-1.5 rounded-xl text-sm font-bold hover:bg-blue-50">+ Add Line</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="bg-blue-50 border-b border-blue-100">
            <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase" style={{minWidth:180}}>Product</th>
            <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase" style={{minWidth:120}}>Description</th>
            <th className="px-3 py-2.5 text-center font-bold text-gray-500 uppercase w-16">Qty</th>
            <th className="px-3 py-2.5 text-right font-bold text-gray-500 uppercase w-28">List Price</th>
            <th className="px-3 py-2.5 text-right font-bold text-gray-500 uppercase w-28">Unit Price</th>
            <th className="px-3 py-2.5 text-center font-bold text-gray-500 uppercase w-20">Disc %</th>
            <th className="px-3 py-2.5 text-center font-bold text-gray-500 uppercase w-20">Tax %</th>
            <th className="px-3 py-2.5 text-right font-bold text-gray-500 uppercase w-28">Extended</th>
            <th className="w-8"/>
          </tr></thead>
          <tbody>
            {items.length === 0
              ? <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400">No line items. Click + Add Line.</td></tr>
              : items.map((row, idx) => (
                <tr key={row._id??idx} className="border-t border-blue-50 hover:bg-blue-50/30">
                  <td className="px-3 py-2">
                    <select value={row.product_name||''} onChange={e=>upd(idx,'product_name',e.target.value)} className={sCls}>
                      <option value="">Select product</option>
                      {products.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2"><input value={row.description||''} onChange={e=>upd(idx,'description',e.target.value)} placeholder="Description" className={iCls}/></td>
                  <td className="px-3 py-2"><input type="number" min={1} value={row.quantity} onChange={e=>upd(idx,'quantity',e.target.value)} className={`${iCls} text-center`}/></td>
                  <td className="px-3 py-2 text-right text-gray-400 font-medium">{fmt(row.list_price)}</td>
                  <td className="px-3 py-2"><input type="number" min={0} value={row.unit_price} onChange={e=>upd(idx,'unit_price',e.target.value)} className={`${iCls} text-right`}/></td>
                  <td className="px-3 py-2"><input type="number" min={0} max={100} value={row.discount_pct} onChange={e=>upd(idx,'discount_pct',e.target.value)} className={`${iCls} text-center ${row.discount_pct>0?'border-green-300 bg-green-50':''}`}/></td>
                  <td className="px-3 py-2"><input type="number" min={0} max={100} value={row.tax_pct} onChange={e=>upd(idx,'tax_pct',e.target.value)} className={`${iCls} text-center`}/></td>
                  <td className="px-3 py-2 text-right font-bold text-[#0F172A]">{fmt(row.extended_price)}</td>
                  <td className="px-2 py-2"><button onClick={()=>remove(idx)} className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-xs font-bold flex items-center justify-center">✕</button></td>
                </tr>
              ))
            }
          </tbody>
          {items.length > 0 && (
            <tfoot className="border-t-2 border-blue-100">
              <tr className="bg-gray-50"><td colSpan={7} className="px-5 py-2 text-right text-xs text-gray-500 font-medium">Subtotal</td><td className="px-3 py-2 text-right text-xs font-semibold">{fmt(subtotal)}</td><td/></tr>
              {totalDisc>0&&<tr className="bg-green-50"><td colSpan={7} className="px-5 py-2 text-right text-xs text-green-600">Total Discount</td><td className="px-3 py-2 text-right text-xs font-semibold text-green-600">- {fmt(totalDisc)}</td><td/></tr>}
              {totalTax>0&&<tr className="bg-blue-50"><td colSpan={7} className="px-5 py-2 text-right text-xs text-blue-600">Total Tax</td><td className="px-3 py-2 text-right text-xs font-semibold text-blue-600">+ {fmt(totalTax)}</td><td/></tr>}
              <tr className="bg-[#0F172A]"><td colSpan={7} className="px-5 py-3 text-right font-bold text-white text-sm">Grand Total (before charges)</td><td className="px-3 py-3 text-right font-bold text-white text-base">{fmt(subtotal-totalDisc+totalTax)}</td><td/></tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Quotation Detail Panel ────────────────────────────────────────────────────
function QuotationDetail({ quote, onClose, onSaved }) {
  const { customers, contacts, products, enterpriseUsers, quoteTemplates, organizations, businessUnits, currentUser, updateQuotation, generateNewVersion, checkMatchingApprovalProcess, submitForApproval, approvalRequests, processApproval, createOrderFromQuotation } = useApp();
  const [form,     setForm]     = useState({ ...quote });
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [printing,        setPrinting]       = useState(false);
  const [creatingOrder,   setCreatingOrder]  = useState(false);
  const [matchingProcess, setMatchingProcess] = useState(null);
  const [submitting,      setSubmitting]      = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!supabase) return;
      const { data } = await supabase.from('quotation_line_items').select('*').eq('quote_number', quote.quote_number).order('sort_order');
      setItems((data||[]).map(r => ({ _id:r.id, product_name:r.product_name||'', product_code:r.product_code||'', description:r.description||'', quantity:Number(r.quantity||1), unit_price:Number(r.unit_price||0), list_price:Number(r.list_price||0), discount_pct:Number(r.discount_pct||0), tax_pct:Number(r.tax_pct||0), extended_price:Number(r.extended_price||0) })));
      setLoading(false);
      // Check if approval process exists for quotations
      const proc = await checkMatchingApprovalProcess('quotations', { ...form });
      setMatchingProcess(proc);
    };
    load();
    setForm({ ...quote });
  }, [quote.id]);

  const s = (k,v) => setForm(p => ({ ...p, [k]: v }));

  const calcTotals = () => {
    const subtotal   = items.reduce((s,i) => s + i.quantity * i.unit_price, 0);
    const totalDisc  = items.reduce((s,i) => s + i.quantity * i.unit_price * i.discount_pct/100, 0);
    const totalTax   = items.reduce((s,i) => s + (i.quantity*i.unit_price*(1-i.discount_pct/100)) * i.tax_pct/100, 0);
    const overallDisc = subtotal * (Number(form.overall_discount)||0)/100;
    const shipping   = Number(form.shipping_cost||0);
    return { subtotal, totalDisc, totalTax, overallDisc, shipping, grandTotal: subtotal-totalDisc+totalTax-overallDisc+shipping };
  };

  const { subtotal, totalDisc, totalTax, overallDisc, shipping, grandTotal } = calcTotals();
  const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n||0);
  const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';
  const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';

  const handleSave = async () => {
    setSaving(true);
    await updateQuotation({ ...form, subtotal, total_discount:totalDisc, total_tax:totalTax, grand_total:grandTotal }, items);
    setSaving(false);
    if (onSaved) onSaved();
  };

  const handlePrint = async () => {
    setPrinting(true);
    const template = quoteTemplates.find(t => t.id === form.template_id || t.isDefault) || quoteTemplates[0];
    const html = buildQuoteHTML({ ...form, subtotal, grand_total:grandTotal }, items, template);
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => { win.print(); setPrinting(false); }, 600); }
    else { setPrinting(false); alert('Please allow popups for PDF generation.'); }
  };

  const handleNewVersion = async () => {
    if (!window.confirm(`Create a new version of ${quote.quote_number}? This will create a copy as v${(quote.version||1)+1}.`)) return;
    await generateNewVersion(quote);
    if (onSaved) onSaved();
    onClose();
  };

  const STATUS_COLORS = { Draft:'bg-gray-100 text-gray-600', Submitted:'bg-blue-100 text-blue-700', Approved:'bg-green-100 text-green-700', 'Sent to Customer':'bg-purple-100 text-purple-700', Accepted:'bg-green-200 text-green-800', Rejected:'bg-red-100 text-red-700', Expired:'bg-orange-100 text-orange-700', Cancelled:'bg-gray-200 text-gray-600' };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] overflow-y-auto">
      <div className="bg-white rounded-[28px] shadow-2xl w-[98vw] my-4 mx-auto overflow-hidden flex flex-col" style={{minHeight:'95vh'}}>

        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-8 py-5 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold">{form.name||form.quote_number}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[form.status]||'bg-gray-100 text-gray-600'}`}>{form.status}</span>
              <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">v{form.version||1}</span>
            </div>
            <p className="text-blue-300 text-sm mt-1">{form.quote_number} · {form.customer}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handlePrint} disabled={printing} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
              {printing ? '⏳' : '🖨️'} {printing ? 'Generating...' : 'Generate PDF'}
            </button>
            {['Approved','Sent to Customer','Accepted'].includes(form.status) && (
              <button
                onClick={async () => {
                  const ordId = await createOrderFromQuotation({ ...form, grand_total: grandTotal });
                  if (ordId) { s('status','Accepted'); }
                }}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
              >
                🛒 Create Order
              </button>
            )}
            <button onClick={handleNewVersion} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold">📋 New Version</button>
            {['Accepted','Approved','Sent to Customer'].includes(form.status) && (
              <button
                onClick={async () => {
                  if (!window.confirm(`Create an Order from ${quote.quote_number}? The quotation will be marked as Accepted.`)) return;
                  setCreatingOrder(true);
                  const ordId = await createOrderFromQuotation({ ...form, grand_total: grandTotal });
                  setCreatingOrder(false);
                  if (ordId) { alert(`Order ${ordId} created successfully! View it in the Orders module.`); onClose(); if (onSaved) onSaved(); }
                }}
                disabled={creatingOrder}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2"
              >
                {creatingOrder ? '⏳ Creating...' : '🛒 Create Order'}
              </button>
            )}
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg">✕</button>
          </div>
        </div>

        {/* Status bar */}
        <div className="bg-gray-50 border-b border-blue-100 px-8 py-3 flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400 uppercase">Status:</span>
          {QUOTE_STATUSES.map(st => (
            <button key={st} onClick={() => s('status', st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${form.status===st?'bg-[#0F172A] text-white shadow-lg':'bg-white border border-blue-100 text-gray-500 hover:border-blue-300'}`}>
              {st}
            </button>
          ))}
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400"><div className="text-4xl animate-pulse mb-3">📄</div></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-8 bg-gradient-to-br from-white to-blue-50 space-y-6">

            {/* Fields grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[
                { label:'Quote Name', field:'name', type:'text' },
                { label:'Customer', field:'customer_select' },
                { label:'Contact', field:'contact_select' },
                { label:'Validity Date', field:'validity_date', type:'date' },
                { label:'Payment Terms', field:'payment_terms', type:'select', opts:['Due on Receipt','Net 15','Net 30','Net 45','Net 60'] },
                { label:'Shipping Terms', field:'shipping_terms', type:'select', opts:['FOB Origin','FOB Destination','CIF','Ex Works','DDP'] },
                { label:'Currency', field:'currency', type:'select', opts:['INR','USD','EUR','GBP','AED'] },
                { label:'Template', field:'template_id', type:'template_select' },
              ].map(({ label, field, type, opts }) => (
                <div key={field} className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">{label}</label>
                  {field === 'customer_select' ? (
                    <select value={form.customer_id||''} onChange={e => { const c=customers.find(x=>x.id===e.target.value); s('customer_id',c?.id||''); s('customer',c?.name||''); }} className={sCls}>
                      <option value="">Select customer</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : field === 'contact_select' ? (
                    <select value={form.contact_id||''} onChange={e => { const c=contacts.find(x=>x.id===e.target.value); s('contact_id',c?.id||''); s('contact',c?.name||''); }} className={sCls}>
                      <option value="">Select contact</option>
                      {contacts.filter(c => !form.customer_id || c.customerId===form.customer_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : field === 'template_id' ? (
                    <select value={form.template_id||''} onChange={e => s('template_id', e.target.value)} className={sCls}>
                      <option value="">Default Template</option>
                      {quoteTemplates.map(t => <option key={t.id} value={t.id}>{t.name}{t.isDefault?' (Default)':''}</option>)}
                    </select>
                  ) : type === 'select' ? (
                    <select value={form[field]||''} onChange={e => s(field, e.target.value)} className={sCls}>
                      <option value="">Select</option>
                      {(opts||[]).map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={type||'text'} value={form[field]||''} onChange={e => s(field, e.target.value)} className={iCls}/>
                  )}
                </div>
              ))}
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[['Billing Address','billing_address'],['Shipping Address','shipping_address']].map(([label, field]) => (
                <div key={field} className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">{label}</label>
                  <textarea rows={3} value={form[field]||''} onChange={e => s(field, e.target.value)} className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"/>
                </div>
              ))}
            </div>

            {/* Line Items */}
            <QuoteLineItems items={items} setItems={setItems} products={products}/>

            {/* Charges & Totals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-[#0F172A]">Additional Charges</h3>
                <div><label className="text-xs font-bold uppercase text-gray-400 block mb-2">Overall Discount (%)</label><input type="number" min={0} max={100} value={form.overall_discount||0} onChange={e=>s('overall_discount',e.target.value)} className={iCls}/></div>
                <div><label className="text-xs font-bold uppercase text-gray-400 block mb-2">Shipping Cost</label><input type="number" min={0} value={form.shipping_cost||0} onChange={e=>s('shipping_cost',e.target.value)} className={iCls}/></div>
              </div>
              <div className="bg-gradient-to-br from-[#0F172A] to-blue-900 rounded-2xl p-5 text-white shadow-xl">
                <h3 className="font-bold mb-4">Price Summary</h3>
                <div className="space-y-2 text-sm">
                  {[['Subtotal',fmt(subtotal)],totalDisc>0&&['Line Discounts',`- ${fmt(totalDisc)}`],totalTax>0&&['Tax',`+ ${fmt(totalTax)}`],overallDisc>0&&[`Overall Disc (${form.overall_discount}%)`,`- ${fmt(overallDisc)}`],shipping>0&&['Shipping',`+ ${fmt(shipping)}`]].filter(Boolean).map(([label,val]) => (
                    <div key={label} className="flex justify-between py-1 border-b border-white/10"><span className="text-blue-200">{label}</span><span className="font-semibold">{val}</span></div>
                  ))}
                  <div className="flex justify-between py-3 mt-2 bg-white/10 rounded-xl px-3"><span className="font-bold text-lg">Grand Total</span><span className="font-bold text-xl">{fmt(grandTotal)}</span></div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[['Customer Notes (shown on quote)','notes'],['Internal Notes (not on quote)','internal_notes']].map(([label, field]) => (
                <div key={field} className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">{label}</label>
                  <textarea rows={3} value={form[field]||''} onChange={e => s(field, e.target.value)} className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" placeholder={label}/>
                </div>
              ))}
            </div>

            {/* Owner Field */}
            <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">Owner / Assigned To</label>
              <select value={form.owner_id||''} onChange={e=>{const u=enterpriseUsers.find(x=>x.id===e.target.value);s('owner_id',u?.id||'');s('owner',u?.email||'');}} className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm">
                <option value="">Unassigned</option>
                {enterpriseUsers.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </div>

            {/* System Information */}
            <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#0F172A]">System Information</h3>
                <span className="text-2xl">🛡️</span>
              </div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  ['Created By',    quote.created_by || '-'],
                  ['Created At',    quote.created_at ? new Date(quote.created_at).toLocaleString('en-IN') : '-'],
                  ['Updated By',    quote.updated_by || '-'],
                  ['Updated At',    quote.updated_at ? new Date(quote.updated_at).toLocaleString('en-IN') : '-'],
                  ['Organization',  organizations?.find(o=>o.id===quote.organization_id)?.name || '-'],
                  ['Business Unit', businessUnits?.find(b=>b.id===quote.business_unit_id)?.name || '-'],
                  ['Opportunity',   quote.opportunity_id || '-'],
                  ['Version',       `v${quote.version||1}`],
                  ['Quote Number',  quote.quote_number || '-'],
                  ['Currency',      quote.currency || 'INR'],
                ].map(([lbl,val])=>(
                  <div key={lbl}>
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{lbl}</div>
                    <div className="text-sm text-[#0F172A] font-medium bg-gray-50 rounded-xl px-3 py-2 truncate">{val}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-4 border-t border-blue-100 bg-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-400">{items.length} line item{items.length!==1?'s':''} · GT: <span className="font-bold text-[#0F172A]">{fmt(grandTotal)}</span></div>
            {matchingProcess && !['Approved','Rejected','Pending Approval'].includes(form.status) && (
              <button onClick={async()=>{setSubmitting(true);await submitForApproval('quotations',quote.quote_number,quote.name,{...form});setSubmitting(false);s('status','Pending Approval');setMatchingProcess(null);}} disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-2xl font-semibold bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200 disabled:opacity-50">
                📋 {submitting?'Submitting…':'Submit for Approval'}
                <span className="bg-purple-200 text-purple-800 text-xs px-2 py-0.5 rounded-full">{matchingProcess?.name}</span>
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-3 text-sm rounded-2xl font-semibold bg-white border border-blue-200 text-[#0F172A] hover:bg-blue-50">Close</button>
            <button onClick={handleSave} disabled={saving} className="px-6 py-3 text-sm rounded-2xl font-semibold bg-gradient-to-r from-[#0F172A] to-blue-800 text-white hover:opacity-90 disabled:opacity-50 shadow-lg">
              {saving ? 'Saving...' : 'Save Quotation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quotations List Page ──────────────────────────────────────────────────────
export default function QuotationsPage() {
  const { quotations, fetchQuotations, customers, createQuotation, deleteQuotation, createOrderFromQuotation } = useApp();
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [createOpen,   setCreateOpen]    = useState(false);
  const [form,         setForm]          = useState({ status:'Draft', currency:'INR', version:1, overall_discount:0, shipping_cost:0, tax_rate:18 });
  const [search,       setSearch]        = useState('');
  const [statusFilter, setStatusFilter]  = useState('All');
  const [saving,       setSaving]        = useState(false);
  const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';
  const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';
  const sf = (k,v) => setForm(p => ({...p,[k]:v}));

  const filtered = useMemo(() => {
    let data = quotations;
    if (search.trim()) { const q=search.toLowerCase(); data=data.filter(r=>[r.name,r.quote_number,r.customer].some(v=>String(v||'').toLowerCase().includes(q))); }
    if (statusFilter !== 'All') data = data.filter(r => r.status === statusFilter);
    return data;
  }, [quotations, search, statusFilter]);

  const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n||0);
  const STATUS_COLORS = { Draft:'bg-gray-100 text-gray-600', Submitted:'bg-blue-100 text-blue-700', Approved:'bg-green-100 text-green-700', 'Sent to Customer':'bg-purple-100 text-purple-700', Accepted:'bg-green-200 text-green-800', Rejected:'bg-red-100 text-red-700', Expired:'bg-orange-100 text-orange-700', Cancelled:'bg-gray-200 text-gray-600' };

  const stats = useMemo(() => ({
    total:    quotations.length,
    draft:    quotations.filter(q=>q.status==='Draft').length,
    sent:     quotations.filter(q=>q.status==='Sent to Customer').length,
    accepted: quotations.filter(q=>q.status==='Accepted').length,
    value:    quotations.filter(q=>q.status==='Accepted').reduce((s,q)=>s+(q.grand_total||0),0),
  }), [quotations]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[28px] p-6 text-white flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Quotations</h1><p className="text-blue-200 mt-1">CPQ — Configure, Price, Quote</p></div>
        <button onClick={()=>{setForm({status:'Draft',currency:'INR',version:1,overall_discount:0,shipping_cost:0,tax_rate:18});setCreateOpen(true);}} className="bg-white text-[#0F172A] px-5 py-2.5 rounded-2xl font-bold text-sm shadow-lg hover:bg-blue-50">+ Create Quotation</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label:'Total Quotes',   value:stats.total,             color:'from-[#0F172A] to-blue-900', icon:'📄' },
          { label:'Drafts',         value:stats.draft,             color:'from-gray-500 to-gray-700',   icon:'📝' },
          { label:'Sent',           value:stats.sent,              color:'from-purple-500 to-purple-700',icon:'📤' },
          { label:'Accepted',       value:stats.accepted,          color:'from-green-500 to-emerald-600',icon:'✅' },
          { label:'Accepted Value', value:fmt(stats.value),        color:'from-amber-500 to-orange-500', icon:'💰' },
        ].map(stat => (
          <div key={stat.label} className={`bg-gradient-to-r ${stat.color} text-white rounded-2xl p-4 shadow-lg`}>
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs opacity-80 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search quotations..." className="flex-1 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-400"/>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option>All</option>
          {QUOTE_STATUSES.map(s=><option key={s}>{s}</option>)}
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
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-16 text-center"><div className="text-5xl mb-3">📄</div><div className="font-bold text-[#0F172A] text-lg mb-2">No quotations yet</div><p className="text-gray-400">Create your first quotation or generate one from an Opportunity.</p></td></tr>
              ) : filtered.map(q => (
                <tr key={q.id} className="border-t border-blue-50 hover:bg-blue-50/40">
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-400">{q.quote_number}</td>
                  <td className="px-5 py-3.5"><button onClick={()=>setSelectedQuote(q)} className="font-semibold text-[#0F172A] hover:text-blue-700 hover:underline text-left">{q.name||q.quote_number}</button></td>
                  <td className="px-5 py-3.5 text-gray-600">{q.customer||'-'}</td>
                  <td className="px-5 py-3.5 text-center"><span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">v{q.version||1}</span></td>
                  <td className="px-5 py-3.5"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[q.status]||'bg-gray-100 text-gray-600'}`}>{q.status}</span></td>
                  <td className="px-5 py-3.5 font-bold text-[#0F172A]">{fmt(q.grand_total)}</td>
                  <td className="px-5 py-3.5 text-gray-500">{q.validity_date||'-'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={()=>setSelectedQuote(q)} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-semibold">Open</button>
                      {['Approved','Sent to Customer','Accepted'].includes(q.status) && (
                        <button onClick={async()=>{ await createOrderFromQuotation(q); }} className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-xl text-xs font-semibold">🛒 Create Order</button>
                      )}
                      <button onClick={()=>{ if(window.confirm('Delete this quotation?')) deleteQuotation(q.id); }} className="bg-red-100 hover:bg-red-200 text-red-500 px-3 py-1.5 rounded-xl text-xs font-semibold">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selectedQuote && <QuotationDetail quote={selectedQuote} onClose={()=>setSelectedQuote(null)} onSaved={()=>{ fetchQuotations(); setSelectedQuote(null); }}/>}

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
              <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Customer</label><select value={form.customer_id||''} onChange={e=>{ const c=customers.find(x=>x.id===e.target.value); sf('customer_id',c?.id||''); sf('customer',c?.name||''); }} className={sCls}><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Validity Date</label><input type="date" value={form.validity_date||''} onChange={e=>sf('validity_date',e.target.value)} className={iCls}/></div>
            </div>
            <div className="px-8 py-5 border-t border-blue-100 flex justify-end gap-3">
              <button onClick={()=>setCreateOpen(false)} className="px-6 py-3 text-sm rounded-2xl font-semibold bg-white border border-blue-200 text-[#0F172A] hover:bg-blue-50">Cancel</button>
              <button onClick={async()=>{ if(!form.name?.trim()){alert('Name required.');return;} setSaving(true); const q=await createQuotation(form,[]); setSaving(false); if(q){setCreateOpen(false);setSelectedQuote(q);} }} disabled={saving} className="px-6 py-3 text-sm rounded-2xl font-semibold bg-gradient-to-r from-[#0F172A] to-blue-800 text-white hover:opacity-90 disabled:opacity-50 shadow-lg">
                {saving?'Creating...':'Create Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
