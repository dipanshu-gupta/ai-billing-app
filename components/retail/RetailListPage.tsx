// @ts-nocheck
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { getStatusColor, formatCurrency, formatDisplayNumber, PAGE_DISPLAY_PREFIX } from '@/lib/utils';
// useCustomFields hook used inline below
import { supabase } from '@/lib/supabase';
import { getTaxRegime } from '@/lib/taxConfig';
import SearchableSelect from '@/components/shared/SearchableSelect';

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';
const sCls = iCls;
const tCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none';

const COUNTRIES = ['India','United States','United Kingdom','United Arab Emirates','Singapore','Australia','Canada','Germany','France','Other'];

// ─── Per-object configuration ──────────────────────────────────────────────
const RETAIL_CONFIG = {
  retailCustomers: {
    title: 'Retail Customers', icon: '🧑‍🤝‍🧑', singular: 'Customer',
    idField: 'customer_number',
    statusOptions: ['Active','Inactive','VIP','Blocked'],
    listColumns: [
      { h: 'Name', v: r => r.name },
      { h: 'Phone', v: r => r.phone || '-' },
      { h: 'Email', v: r => r.email || '-' },
      { h: 'Loyalty Tier', v: r => r.loyalty_tier || 'Standard' },
      { h: 'Points', v: r => r.loyalty_points || 0, align:'right' },
    ],
    searchFields: ['name','phone','email','customer_number'],
    sections: [
      { icon:'🧑', title:'Customer Details', fields:[
        { key:'name', label:'Full Name', type:'text', required:true },
        { key:'phone', label:'Phone', type:'tel' },
        { key:'email', label:'Email', type:'email' },
        { key:'date_of_birth', label:'Date of Birth', type:'date' },
        { key:'gender', label:'Gender', type:'select', opts:['Male','Female','Other','Prefer not to say'] },
        { key:'status', label:'Status', type:'status' },
      ]},
      { icon:'📍', title:'Address & Contact', fields:[
        { key:'address_line1', label:'Address Line 1', type:'text' },
        { key:'address_line2', label:'Address Line 2', type:'text' },
        { key:'city', label:'City', type:'text' },
        { key:'state', label:'State', type:'text' },
        { key:'postal_code', label:'Postal Code', type:'text' },
        { key:'country', label:'Country', type:'select', opts:COUNTRIES },
      ]},
      { icon:'🎁', title:'Loyalty & Preferences', fields:[
        { key:'loyalty_points', label:'Loyalty Points', type:'number' },
        { key:'loyalty_tier', label:'Loyalty Tier', type:'select', opts:['Standard','Silver','Gold','Platinum'] },
        { key:'preferred_contact', label:'Preferred Contact', type:'select', opts:['Phone','Email','SMS','WhatsApp'] },
        { key:'marketing_opt_in', label:'Marketing Opt-in', type:'checkbox' },
        { key:'owner', label:'Owner', type:'owner' },
        { key:'notes', label:'Notes', type:'textarea', full:true },
      ]},
    ],
  },

  retailProducts: {
    title: 'Retail Products', icon: '🏷️', singular: 'Product',
    idField: 'product_number',
    statusOptions: ['Active','Inactive','Discontinued'],
    listColumns: [
      { h: 'Name', v: r => r.name },
      { h: 'Category', v: r => r.category || '-' },
      { h: 'SKU', v: r => r.sku || '-' },
      { h: 'Price', v: r => formatCurrency(r.price||0), align:'right' },
      { h: 'Stock', v: r => r.stock_quantity ?? 0, align:'right' },
    ],
    searchFields: ['name','sku','barcode','category','product_number'],
    sections: [
      { icon:'🏷️', title:'Product Details', fields:[
        { key:'name', label:'Product Name', type:'text', required:true },
        { key:'category', label:'Category', type:'text' },
        { key:'brand', label:'Brand', type:'text' },
        { key:'sku', label:'SKU', type:'text' },
        { key:'barcode', label:'Barcode', type:'text' },
        { key:'unit', label:'Unit', type:'select', opts:['pc','kg','g','ltr','ml','box','pack','dozen'] },
        { key:'status', label:'Status', type:'status' },
        { key:'owner', label:'Owner', type:'owner' },
      ]},
      { icon:'💰', title:'Pricing & Inventory', fields:[
        { key:'price', label:'Selling Price', type:'number' },
        { key:'mrp', label:'MRP', type:'number' },
        { key:'cost', label:'Cost Price', type:'number' },
        { key:'stock_quantity', label:'Stock Quantity', type:'number' },
        { key:'reorder_level', label:'Reorder Level', type:'number' },
      ]},
      { icon:'🧾', title:'Tax & Description', fields:[
        { key:'hsn_code', label:'HSN/SAC Code', type:'text' },
        { key:'gst_rate', label:'GST Rate (%)', type:'number' },
        { key:'taxable', label:'Taxable', type:'checkbox' },
        { key:'description', label:'Description', type:'textarea', full:true },
        { key:'comments', label:'Comments', type:'textarea', full:true },
      ]},
    ],
  },

  retailActivities: {
    title: 'Retail Activities', icon: '📅', singular: 'Activity',
    idField: 'activity_number',
    statusOptions: ['Open','In Progress','Completed','Cancelled'],
    listColumns: [
      { h: 'Subject', v: r => r.subject },
      { h: 'Type', v: r => r.activity_type || '-' },
      { h: 'Customer', v: r => r.customer || '-' },
      { h: 'Date', v: r => r.activity_date || '-' },
      { h: 'Priority', v: r => r.priority || 'Medium' },
    ],
    searchFields: ['subject','customer','activity_number'],
    sections: [
      { icon:'📅', title:'Activity Details', fields:[
        { key:'subject', label:'Subject', type:'text', required:true },
        { key:'activity_type', label:'Type', type:'select', opts:['Visit','Call','WhatsApp','Complaint','Feedback','Service'] },
        { key:'customer_id', label:'Customer', type:'retailCustomer' },
        { key:'activity_date', label:'Activity Date', type:'date' },
        { key:'due_date', label:'Due Date', type:'date' },
        { key:'priority', label:'Priority', type:'select', opts:['Low','Medium','High','Critical'] },
        { key:'status', label:'Status', type:'status' },
        { key:'owner', label:'Owner', type:'owner' },
      ]},
      { icon:'📋', title:'Description & Outcome', fields:[
        { key:'description', label:'Description', type:'textarea', full:true },
        { key:'outcome', label:'Outcome', type:'textarea', full:true },
        { key:'follow_up_date', label:'Follow-up Date', type:'date' },
      ]},
      { icon:'💬', title:'Notes & Comments', fields:[
        { key:'notes', label:'Notes', type:'textarea', full:true },
        { key:'comments', label:'Comments', type:'textarea', full:true },
      ]},
    ],
  },

  retailOrders: {
    title: 'Retail Orders', icon: '🛍️', singular: 'Order',
    idField: 'order_number',
    statusOptions: ['Draft','Completed','Cancelled','Refunded'],
    hasLineItems: true,
    listColumns: [
      { h: 'Order #', v: r => r.displayNumber ? formatDisplayNumber('RORD', r.displayNumber) : r.order_number, mono:true },
      { h: 'Customer', v: r => r.customer || '-' },
      { h: 'Channel', v: r => r.channel || '-' },
      { h: 'Date', v: r => r.order_date || '-' },
      { h: 'Total', v: r => formatCurrency(r.amount||0), align:'right' },
    ],
    searchFields: ['order_number','customer','customer_phone'],
    sections: [
      { icon:'🛍️', title:'Order Details', fields:[
        { key:'customer_id', label:'Customer', type:'retailCustomer' },
        { key:'customer_phone', label:'Customer Phone', type:'tel' },
        { key:'order_date', label:'Order Date', type:'date' },
        { key:'channel', label:'Channel', type:'select', opts:['In-Store','Online','Phone','WhatsApp'] },
        { key:'currency', label:'Currency', type:'select', opts:['INR','USD','GBP','EUR','AED','SGD'] },
        { key:'status', label:'Status', type:'status' },
        { key:'owner', label:'Owner', type:'owner' },
      ]},
      { icon:'💳', title:'Payment & Tax', fields:[
        { key:'payment_method', label:'Payment Method', type:'select', opts:['Cash','Card','UPI','Net Banking','Wallet','COD'] },
        { key:'payment_status', label:'Payment Status', type:'select', opts:['Paid','Pending','Partially Paid','Refunded'] },
        { key:'place_of_supply', label:'Place of Supply (State)', type:'select', opts:['Maharashtra','Delhi','Karnataka','Tamil Nadu','Gujarat','Rajasthan','Uttar Pradesh','West Bengal','Telangana','Kerala','Punjab','Haryana','Bihar','Odisha','Madhya Pradesh','Other'] },
        { key:'customer_gstin', label:'Customer GSTIN', type:'text' },
      ]},
      { icon:'🚚', title:'Delivery & Notes', fields:[
        { key:'delivery_method', label:'Delivery Method', type:'select', opts:['Pickup','Home Delivery','Courier'] },
        { key:'delivery_date', label:'Delivery Date', type:'date' },
        { key:'delivery_address', label:'Delivery Address', type:'textarea', full:true },
        { key:'notes', label:'Notes', type:'textarea', full:true },
        { key:'comments', label:'Comments', type:'textarea', full:true },
      ]},
    ],
  },

  retailInvoices: {
    title: 'Retail Invoices', icon: '🧾', singular: 'Invoice',
    idField: 'invoice_number',
    statusOptions: ['Draft','Sent','Paid','Overdue','Refunded','Cancelled'],
    hasLineItems: true,
    listColumns: [
      { h: 'Invoice #', v: r => r.displayNumber ? formatDisplayNumber('RINV', r.displayNumber) : r.invoice_number, mono:true },
      { h: 'Customer', v: r => r.customer || '-' },
      { h: 'Order #', v: r => r.order_number || '-', mono:true },
      { h: 'Date', v: r => r.invoice_date || '-' },
      { h: 'Total', v: r => formatCurrency(r.amount||0), align:'right' },
    ],
    searchFields: ['invoice_number','customer','order_number'],
    sections: [
      { icon:'🧾', title:'Invoice Details', fields:[
        { key:'customer_id', label:'Customer', type:'retailCustomer' },
        { key:'customer_phone', label:'Customer Phone', type:'tel' },
        { key:'invoice_date', label:'Invoice Date', type:'date' },
        { key:'due_date', label:'Due Date', type:'date' },
        { key:'order_number', label:'Linked Order #', type:'text', readOnly:true },
        { key:'currency', label:'Currency', type:'select', opts:['INR','USD','GBP','EUR','AED','SGD'] },
        { key:'status', label:'Status', type:'status' },
        { key:'invoice_template_id', label:'Invoice Template', type:'retailInvoiceTemplate' },
      ]},
      { icon:'💳', title:'Payment & Owner', fields:[
        { key:'payment_method', label:'Payment Method', type:'select', opts:['Cash','Card','UPI','Net Banking','Wallet','COD'] },
        { key:'payment_status', label:'Payment Status', type:'select', opts:['Paid','Pending','Partially Paid','Refunded'] },
        { key:'place_of_supply', label:'Place of Supply (State)', type:'select', opts:['Maharashtra','Delhi','Karnataka','Tamil Nadu','Gujarat','Rajasthan','Uttar Pradesh','West Bengal','Telangana','Kerala','Punjab','Haryana','Bihar','Odisha','Madhya Pradesh','Other'] },
        { key:'customer_gstin', label:'Customer GSTIN', type:'text' },
        { key:'owner', label:'Owner', type:'owner' },
      ]},
      { icon:'💬', title:'Notes & Comments', fields:[
        { key:'notes', label:'Notes', type:'textarea', full:true },
        { key:'comments', label:'Comments', type:'textarea', full:true },
      ]},
    ],
  },
};

// ─── Line items table (Orders / Invoices) ──────────────────────────────────
function RetailLineItems({ items, setItems, products, taxRegime }) {
  const add = () => setItems(p => [...p, {
    _id: Date.now(), product_name:'', description:'', quantity:1, unit_price:0, list_price:0, discount_pct:0,
    extended_price:0,
    ...(taxRegime.regime==='india_gst' ? { hsn_code:'', gst_rate:18 } : {}),
    ...(taxRegime.regime==='us_sales_tax' ? { taxable:'Yes', sales_tax_rate:0 } : {}),
    ...(taxRegime.regime==='uk_vat' ? { vat_rate:20 } : {}),
    ...(taxRegime.regime==='generic' ? { tax_pct:0 } : {}),
  }]);
  const remove = (idx) => setItems(p => p.filter((_,i)=>i!==idx));

  const upd = (idx, field, val) => setItems(p => p.map((r,i) => {
    if (i !== idx) return r;
    const numFields = ['quantity','unit_price','list_price','discount_pct','gst_rate','sales_tax_rate','vat_rate','tax_pct'];
    const u = { ...r, [field]: numFields.includes(field) ? Number(val) : val };
    if (field === 'product_name') {
      const pr = products.find(x => x.name === val);
      if (pr) {
        u.unit_price = pr.price; u.list_price = pr.price; u.product_code = pr.sku || '';
        if (taxRegime.regime==='india_gst') { u.hsn_code = pr.hsn_code || ''; u.gst_rate = pr.gst_rate ?? 18; }
        if (taxRegime.regime==='us_sales_tax') { u.taxable = pr.taxable || 'Yes'; }
        if (taxRegime.regime==='uk_vat') { u.vat_rate = pr.vat_rate ?? 20; }
        if (taxRegime.regime==='generic') { u.tax_pct = pr.tax_rate ?? 0; }
      }
    }
    const { totalTax } = taxRegime.computeLineTax(u);
    const net = u.quantity * u.unit_price * (1 - u.discount_pct/100);
    u.extended_price = net + totalTax;
    return u;
  }));

  const subtotal  = items.reduce((s,i) => s + i.quantity*i.unit_price, 0);
  const totalDisc = items.reduce((s,i) => s + i.quantity*i.unit_price*i.discount_pct/100, 0);
  const totalTax  = items.reduce((s,i) => s + taxRegime.computeLineTax(i).totalTax, 0);
  const grandTotal = subtotal - totalDisc + totalTax;

  const taxCols = taxRegime.lineItemFields;

  return (
    <div className="bg-white rounded-[20px] border border-blue-100 shadow">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3.5 flex items-center justify-between">
        <div><h3 className="text-white font-bold">Line Items</h3><p className="text-blue-300 text-xs mt-0.5">Products · Pricing · {taxRegime.shortLabel}</p></div>
        <button type="button" onClick={add} className="bg-white text-[#0F172A] px-4 py-1.5 rounded-xl text-sm font-bold hover:bg-blue-50">+ Add Item</button>
      </div>
      <div style={{overflowX:'auto', overflowY:'visible'}}>
        <table className="w-full text-xs" style={{tableLayout:'fixed',overflowY:'visible'}}>
          <colgroup>
            <col style={{width:'28%'}}/>
            <col style={{width:'6%'}}/>
            <col style={{width:'10%'}}/>
            <col style={{width:'7%'}}/>
            {taxCols.map(tc=><col key={tc.key} style={{width:tc.type==='select'?'10%':'8%'}}/>)}
            <col style={{width:'11%'}}/>
            <col style={{width:'4%'}}/>
          </colgroup>
          <thead><tr className="bg-blue-50 border-b border-blue-100">
            <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase text-xs">Product</th>
            <th className="px-3 py-2.5 text-center font-bold text-gray-500 uppercase text-xs">Qty</th>
            <th className="px-3 py-2.5 text-right font-bold text-gray-500 uppercase text-xs">Unit Price</th>
            <th className="px-3 py-2.5 text-center font-bold text-gray-500 uppercase text-xs">Disc %</th>
            {taxCols.map(tc=><th key={tc.key} className="px-3 py-2.5 text-center font-bold text-gray-500 uppercase text-xs whitespace-nowrap">{tc.label}</th>)}
            <th className="px-3 py-2.5 text-right font-bold text-gray-500 uppercase text-xs">Extended</th>
            <th></th>
          </tr></thead>
          <tbody>
            {items.length===0
              ? <tr><td colSpan={6+taxCols.length} className="px-5 py-8 text-center text-gray-400">No items. Click + Add Item.</td></tr>
              : items.map((row,idx)=>(
                <tr key={row._id??idx} className="border-t border-blue-50 hover:bg-blue-50/30">
                  <td className="px-2 py-2" style={{position:'relative', zIndex: items.length - idx + 10, overflow:'visible'}}>
                    <SearchableSelect
                      value={row.product_name||''}
                      onChange={v=>upd(idx,'product_name',v)}
                      options={products.map(p=>({value:p.name,label:p.name,sub:[p.category,p.sku].filter(Boolean).join(' · ')}))}
                      placeholder="Search products..." emptyLabel="No products found"
                    />
                  </td>
                  <td className="px-3 py-2 w-16"><input type="number" min={1} value={row.quantity} onChange={e=>upd(idx,'quantity',e.target.value)} className={`${iCls} text-center`}/></td>
                  <td className="px-3 py-2 w-24"><input type="number" min={0} value={row.unit_price} onChange={e=>upd(idx,'unit_price',e.target.value)} className={`${iCls} text-right`}/></td>
                  <td className="px-3 py-2 w-16"><input type="number" min={0} max={100} value={row.discount_pct} onChange={e=>upd(idx,'discount_pct',e.target.value)} className={`${iCls} text-center ${row.discount_pct>0?'border-green-300 bg-green-50':''}`}/></td>
                  {taxCols.map(tc => (
                    <td key={tc.key} className="px-3 py-2 w-24">
                      {tc.type==='select'
                        ? <select value={row[tc.key] ?? tc.defaultValue ?? ''} onChange={e=>upd(idx,tc.key,e.target.value)} className={`${sCls} text-center`}>
                            {tc.opts.map(o=><option key={o} value={o}>{o}</option>)}
                          </select>
                        : <input type={tc.type==='number'?'number':'text'} value={row[tc.key] ?? tc.defaultValue ?? ''} onChange={e=>upd(idx,tc.key,e.target.value)} className={`${iCls} text-center`}/>
                      }
                    </td>
                  ))}
                  <td className="px-3 py-2 w-28 text-right font-bold text-[#0F172A]">{formatCurrency(row.extended_price||0)}</td>
                  <td className="px-3 py-2 w-10"><button type="button" onClick={()=>remove(idx)} className="text-red-400 hover:text-red-600 font-bold">✕</button></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      {items.length>0 && (() => {
        // Compute CGST/SGST/IGST breakdown for INR
        const breakdown = taxRegime.regime === 'india_gst'
          ? items.reduce((acc, item) => {
              const lb = taxRegime.computeLineTax(item);
              Object.entries(lb.breakdown).forEach(([k,v]) => { acc[k] = (acc[k]||0) + (v as number); });
              return acc;
            }, {} as Record<string,number>)
          : null;
        return (
          <div className="px-5 py-4 border-t border-blue-100 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div><div className="text-gray-400 text-xs uppercase font-bold">Subtotal</div><div className="font-bold text-[#0F172A]">{formatCurrency(subtotal)}</div></div>
              <div><div className="text-gray-400 text-xs uppercase font-bold">Discount</div><div className="font-bold text-red-500">-{formatCurrency(totalDisc)}</div></div>
              <div><div className="text-gray-400 text-xs uppercase font-bold">{taxRegime.shortLabel}</div><div className="font-bold text-[#0F172A]">{formatCurrency(totalTax)}</div></div>
              <div><div className="text-gray-400 text-xs uppercase font-bold">Grand Total</div><div className="font-bold text-blue-700 text-base">{formatCurrency(grandTotal)}</div></div>
            </div>
            {breakdown && Object.keys(breakdown).length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2 border-t border-blue-50">
                {Object.entries(breakdown).map(([k,v]) => v > 0 && (
                  <div key={k} className="bg-blue-50 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-gray-500 uppercase font-bold mr-1.5">{k.toUpperCase()}</span>
                    <span className="font-bold text-[#0F172A]">{formatCurrency(v as number)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Print HTML Builder ──────────────────────────────────────────────────────
function buildRetailPrintHTML(t, record, items) {
  const isTh = t.paper_size?.startsWith('thermal');
  const widthMM = t.paper_size==='thermal_58'||t.paper_size==='thermal_57' ? 58 : t.paper_size==='thermal_80' ? 80 : t.paper_size==='A5' ? 148 : 210;
  const font   = t.font_family || 'monospace';
  const brand  = t.brand_color || '#0F172A';
  const accent = t.accent_color || '#2563EB';
  const bg     = t.bg_color || '#FFFFFF';
  const fs     = (n) => isTh ? Math.max(8, n-2) : n;
  const fmt    = (n) => '₹' + Number(n||0).toLocaleString('en-IN', {minimumFractionDigits:2});
  const divider = t.show_dividers
    ? `<hr style="border:none;border-top:1px ${t.border_style||'dashed'} #ccc;margin:6px 0;"/>`
    : '';

  const rows = (items||[]).map((item, i) => {
    const bg2 = t.alt_row && i%2===1 ? t.alt_row_color||'#F9FAFB' : 'transparent';
    return `<tr style="background:${bg2}">
      ${t.col_item!==false ? `<td style="padding:3px 4px;font-size:${fs(11)}px">${item.product||item.product_name||''}</td>` : ''}
      ${t.col_qty!==false  ? `<td style="padding:3px 4px;text-align:right;font-size:${fs(11)}px">${item.quantity||0}</td>` : ''}
      ${t.col_price!==false? `<td style="padding:3px 4px;text-align:right;font-size:${fs(11)}px">${fmt(item.unit_price)}</td>` : ''}
      ${t.col_tax          ? `<td style="padding:3px 4px;text-align:right;font-size:${fs(9)}px;color:#6B7280">${item.tax_rate||0}%</td>` : ''}
      ${t.col_hsn          ? `<td style="padding:3px 4px;text-align:right;font-size:${fs(8)}px;color:#6B7280">${item.hsn_code||''}</td>` : ''}
      ${t.col_total!==false? `<td style="padding:3px 4px;text-align:right;font-size:${fs(11)}px;font-weight:600">${fmt(item.extended_price||item.unit_price*item.quantity)}</td>` : ''}
    </tr>`;
  }).join('');

  const colHeaders = [
    t.col_item!==false  && `<th style="padding:3px 4px;text-align:left;font-size:${fs(9)}px;color:#6B7280;text-transform:uppercase">Item</th>`,
    t.col_qty!==false   && `<th style="padding:3px 4px;text-align:right;font-size:${fs(9)}px;color:#6B7280;text-transform:uppercase">Qty</th>`,
    t.col_price!==false && `<th style="padding:3px 4px;text-align:right;font-size:${fs(9)}px;color:#6B7280;text-transform:uppercase">Price</th>`,
    t.col_tax           && `<th style="padding:3px 4px;text-align:right;font-size:${fs(9)}px;color:#6B7280;text-transform:uppercase">Tax</th>`,
    t.col_hsn           && `<th style="padding:3px 4px;text-align:right;font-size:${fs(9)}px;color:#6B7280;text-transform:uppercase">HSN</th>`,
    t.col_total!==false && `<th style="padding:3px 4px;text-align:right;font-size:${fs(9)}px;color:#6B7280;text-transform:uppercase">Total</th>`,
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Invoice ${record.invoice_number||''}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:${font}; background:${bg}; color:#111827; }
    .page { width:${widthMM}mm; margin:0 auto; padding:${isTh?'0':'8mm'}; background:${bg}; }
    .header { background:${brand}; color:#fff; padding:${isTh?'8px 10px':'14px 18px'}; text-align:${t.header_align||'center'}; }
    .header .store-name { font-weight:800; font-size:${fs(14)}px; letter-spacing:1.5px; }
    .header .store-sub  { font-size:${fs(9)}px; opacity:.82; margin-top:3px; line-height:1.5; }
    .header .tagline    { font-size:${fs(9)}px; opacity:.7; font-style:italic; margin-top:2px; }
    .body { padding:${isTh?'6px 10px':'12px 18px'}; }
    .inv-meta { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:${isTh?'5px':'8px'}; }
    .inv-num  { font-weight:800; font-size:${fs(13)}px; }
    .inv-date { font-size:${fs(9)}px; color:#6B7280; margin-top:2px; }
    .barcode  { font-size:${isTh?'18':'22'}px; color:#9CA3AF; letter-spacing:-2px; }
    .meta-row { display:flex; justify-content:space-between; margin-bottom:${isTh?'2px':'3px'}; }
    .meta-l   { font-size:${fs(10)}px; color:#6B7280; }
    .meta-v   { font-size:${fs(11)}px; font-weight:500; color:#111827; }
    .meta-vb  { font-size:${fs(11)}px; font-weight:700; color:#111827; }
    table     { width:100%; border-collapse:collapse; }
    thead tr  { border-bottom:1px solid ${brand}40; }
    .totals-row { display:flex; justify-content:space-between; margin-bottom:${isTh?'2px':'3px'}; }
    .total-final{ display:flex; justify-content:space-between; font-weight:800; font-size:${fs(14)}px; padding-top:${isTh?'5px':'7px'}; margin-top:${isTh?'4px':'6px'}; border-top:2px solid ${brand}; }
    .loyalty-box{ background:${accent}12; border:1px solid ${accent}30; border-radius:6px; padding:${isTh?'5px 8px':'8px 12px'}; text-align:center; margin:${isTh?'4px 0':'6px 0'}; }
    .savings    { text-align:center; color:#15803D; font-weight:600; background:#F0FDF4; border-radius:5px; padding:3px 8px; margin:${isTh?'3px 0':'5px 0'}; }
    .footer-msg { text-align:center; color:#4B5563; line-height:1.6; padding-bottom:${isTh?'6px':'10px'}; }
    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .page { width:${widthMM}mm; }
      @page { size:${isTh?widthMM+'mm 1000mm':'A4'}; margin:${isTh?'0':'10mm'}; }
    }
  </style>
</head>
<body>
<div class="page">
  <!-- HEADER -->
  <div class="header">
    ${t.show_logo && t.logo_url ? `<div style="margin-bottom:6px;text-align:${t.header_align||'center'}"><img src="${t.logo_url}" style="height:${t.logo_size||48}px;object-fit:contain"/></div>` : ''}
    <div class="store-name">${t.store_name||'Store'}</div>
    ${t.tagline ? `<div class="tagline">${t.tagline}</div>` : ''}
    ${t.show_store_info ? `<div class="store-sub">
      ${t.store_address||''}${t.store_phone?'<br>'+t.store_phone:''}
      ${t.store_email?'<br>'+t.store_email:''}
      ${t.store_website?'<br>'+t.store_website:''}
      ${t.show_gst&&t.store_gstin?'<br>GSTIN: '+t.store_gstin:''}
    </div>` : ''}
  </div>

  <div class="body">
    <!-- META -->
    <div class="inv-meta">
      <div>
        <div class="inv-num">${t.headline||'RECEIPT'} #${record.invoice_number||''}</div>
        <div class="inv-date">${record.invoice_date||new Date().toLocaleDateString('en-IN')}</div>
      </div>
      ${t.show_barcode ? '<div class="barcode">▌▌▌▌▌▌</div>' : ''}
    </div>

    ${divider}

    <!-- CUSTOMER -->
    ${t.show_customer ? `
    <div class="meta-row"><span class="meta-l">Customer</span><span class="meta-vb">${record.customer||''}</span></div>
    <div class="meta-row"><span class="meta-l">Phone</span><span class="meta-v">${record.customer_phone||''}</span></div>
    ` : ''}

    ${divider}

    <!-- LINE ITEMS -->
    <table>
      <thead><tr>${colHeaders}</tr></thead>
      <tbody>${rows}</tbody>
    </table>

    ${divider}

    <!-- TOTALS -->
    <div class="totals-row"><span class="meta-l">Subtotal</span><span class="meta-v">${fmt(record.subtotal)}</span></div>
    <div class="totals-row"><span class="meta-l">Discount</span><span class="meta-v">-${fmt(record.total_discount)}</span></div>
    <div class="totals-row"><span class="meta-l">Tax</span><span class="meta-v">${fmt(record.total_tax)}</span></div>
    <div class="total-final"><span>TOTAL</span><span>${fmt(record.amount)}</span></div>

    <!-- PAYMENT -->
    ${t.show_payment ? `${divider}
    <div class="meta-row"><span class="meta-l">Payment Method</span><span class="meta-vb">${record.payment_method||''}</span></div>
    <div class="meta-row"><span class="meta-l">Status</span><span class="meta-v">${record.payment_status||record.status||''}</span></div>
    ` : ''}

    <!-- LOYALTY -->
    ${t.show_loyalty && record.loyalty_points_earned ? `${divider}
    <div class="loyalty-box">
      <div style="font-size:${fs(9)}px;color:#6B7280">Loyalty Points Earned</div>
      <div style="font-weight:800;font-size:${fs(15)}px;color:#111827">+${record.loyalty_points_earned} pts</div>
    </div>` : ''}

    <!-- SAVINGS -->
    ${t.show_savings && record.total_discount > 0 ? `
    <div class="savings">🎉 You saved ${fmt(record.total_discount)} on this purchase!</div>` : ''}

    <!-- FOOTER -->
    ${t.show_footer && t.footer_msg ? `${divider}
    <div class="footer-msg">${t.footer_msg}</div>` : ''}

    <!-- WATERMARK -->
    ${t.watermark ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:48px;font-weight:900;color:rgba(0,0,0,0.05);pointer-events:none;white-space:nowrap;letter-spacing:6px">${t.watermark}</div>` : ''}
  </div>
</div>
</body>
</html>`;
}

// ─── Print Preview Modal ──────────────────────────────────────────────────────
function RetailInvoicePrintModal({ template, record, items, onClose, onPrint }) {
  if (!template) return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[20px] p-8 max-w-md text-center shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="font-bold text-[#0F172A] text-lg mb-2">No Template Selected</h3>
        <p className="text-gray-500 text-sm mb-5">Please select an Invoice Template in the Invoice Info section first. You can create templates in Admin Tools → B2C Retail → Invoice Template.</p>
        <button onClick={onClose} className="bg-[#0F172A] text-white px-6 py-2.5 rounded-xl font-bold text-sm">Close</button>
      </div>
    </div>
  );

  const html = buildRetailPrintHTML(template, record, items);
  const ps   = template.paper_size;
  const isTh = ps?.startsWith('thermal');
  const previewW = ps==='thermal_58'||ps==='thermal_57' ? 219 : ps==='thermal_80' ? 303 : ps==='A5' ? 480 : 595;

  return (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden" style={{maxWidth:900,width:'100%',maxHeight:'90vh'}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F172A] to-indigo-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-white font-bold text-lg">🖨️ Print Preview</h3>
            <p className="text-blue-200 text-xs mt-0.5">Template: {template.name} · {template.paper_size}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onPrint}
              className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow transition-all">
              🖨️ Print Now
            </button>
            <button onClick={onClose}
              className="text-white/60 hover:text-white text-2xl leading-none">✕</button>
          </div>
        </div>

        {/* Preview iframe */}
        <div className="flex-1 overflow-auto bg-gray-100 p-6 flex justify-center">
          <div style={{width:previewW,flexShrink:0}}>
            <iframe
              srcDoc={html}
              style={{width:'100%',height:isTh?800:1000,border:'none',borderRadius:8,boxShadow:'0 4px 20px rgba(0,0,0,0.15)',background:'white'}}
              title="Invoice Preview"/>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
          <p className="text-xs text-gray-400">Preview may differ slightly from printed output depending on printer settings.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100">Close</button>
            <button onClick={onPrint} className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold">🖨️ Print</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Retail Customer 360 ─────────────────────────────────────────────────────
function RC360Table({ cols, rows, emptyMsg }) {
  if (rows.length === 0) return (
    <div className="px-5 py-10 text-center text-gray-400 text-sm">{emptyMsg}</div>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {cols.map(c => (
              <th key={c.h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{c.h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i} className="border-t border-gray-50 hover:bg-blue-50/20 transition-colors">
              {cols.map(c => (
                <td key={c.h} className="px-4 py-3 text-sm">{c.v(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RetailCustomer360({ customer }) {
  const [tab, setTab]         = useState('orders');
  const [data, setData]       = useState({ orders: [], invoices: [], activities: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !customer?.id) return;
    setLoading(true);
    Promise.all([
      supabase.from('retail_orders')    .select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
      supabase.from('retail_invoices')  .select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
      supabase.from('retail_activities').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
    ]).then(([{ data: orders }, { data: invoices }, { data: activities }]) => {
      setData({ orders: orders || [], invoices: invoices || [], activities: activities || [] });
      setLoading(false);
    });
  }, [customer?.id]);

  const fmt          = n => formatCurrency(n || 0);
  const totalSpent   = data.invoices.reduce((s, i) => s + (i.amount || 0), 0);
  const paidInvoices = data.invoices.filter(i => i.payment_status === 'Paid' || i.status === 'Paid').length;
  const openActs     = data.activities.filter(a => a.status === 'Open' || a.status === 'In Progress').length;

  const TABS = [
    { k: 'orders',     icon: '🛍️', label: 'Orders',     count: data.orders.length },
    { k: 'invoices',   icon: '🧾', label: 'Invoices',   count: data.invoices.length },
    { k: 'activities', icon: '📅', label: 'Activities', count: data.activities.length },
  ];

  const SP = ({ status }) => (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>{status || '-'}</span>
  );

  const orderCols = [
    { h: 'Order #',   v: r => (<span className="font-mono text-xs text-blue-600 font-bold">{r.order_number || r.id?.slice(0, 8)}</span>) },
    { h: 'Date',      v: r => (<span className="text-gray-600">{r.order_date || r.created_at?.slice(0, 10) || '-'}</span>) },
    { h: 'Channel',   v: r => (<span className="text-gray-600">{r.channel || '-'}</span>) },
    { h: 'Payment',   v: r => (<span className="text-gray-600">{r.payment_method || '-'}</span>) },
    { h: 'Pay Status',v: r => (<SP status={r.payment_status}/>) },
    { h: 'Status',    v: r => (<SP status={r.status}/>) },
    { h: 'Amount',    v: r => (<span className="font-bold text-[#0F172A]">{fmt(r.amount)}</span>) },
  ];

  const invoiceCols = [
    { h: 'Invoice #',  v: r => (<span className="font-mono text-xs text-purple-600 font-bold">{r.invoice_number || r.id?.slice(0, 8)}</span>) },
    { h: 'Date',       v: r => (<span className="text-gray-600">{r.invoice_date || r.created_at?.slice(0, 10) || '-'}</span>) },
    { h: 'Due Date',   v: r => (<span className="text-gray-600">{r.due_date || '-'}</span>) },
    { h: 'Payment',    v: r => (<span className="text-gray-600">{r.payment_method || '-'}</span>) },
    { h: 'Pay Status', v: r => (<SP status={r.payment_status}/>) },
    { h: 'Status',     v: r => (<SP status={r.status}/>) },
    { h: 'Tax',        v: r => (<span className="text-gray-600">{fmt(r.total_tax)}</span>) },
    { h: 'Amount',     v: r => (<span className="font-bold text-[#0F172A]">{fmt(r.amount)}</span>) },
  ];

  const typeIcon = t => t === 'Call' ? '📞' : t === 'Visit' ? '🏪' : t === 'WhatsApp' ? '💬' : t === 'Complaint' ? '⚠️' : '📋';

  const activityCols = [
    { h: 'Subject',  v: r => (<span className="font-semibold text-[#0F172A]">{r.subject}</span>) },
    { h: 'Type',     v: r => (<span className="text-gray-600">{typeIcon(r.activity_type)} {r.activity_type || '-'}</span>) },
    { h: 'Date',     v: r => (<span className="text-gray-600">{r.activity_date || r.created_at?.slice(0, 10) || '-'}</span>) },
    { h: 'Due Date', v: r => (<span className="text-gray-600">{r.due_date || '-'}</span>) },
    { h: 'Priority', v: r => (<span className={`text-xs font-semibold ${r.priority === 'High' || r.priority === 'Critical' ? 'text-red-600' : r.priority === 'Medium' ? 'text-amber-600' : 'text-gray-400'}`}>{r.priority || '-'}</span>) },
    { h: 'Owner',    v: r => (<span className="text-gray-600">{r.owner || '-'}</span>) },
    { h: 'Status',   v: r => (<SP status={r.status}/>) },
  ];

  const kpis = [
    { l: 'Total Orders',    v: data.orders.length,               icon: '🛍️', bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700' },
    { l: 'Total Spent',     v: fmt(totalSpent),                  icon: '💰', bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700' },
    { l: 'Paid Invoices',   v: paidInvoices + '/' + data.invoices.length, icon: '🧾', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
    { l: 'Open Activities', v: openActs,                         icon: '📅', bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700' },
  ];

  const activeCols = tab === 'orders' ? orderCols : tab === 'invoices' ? invoiceCols : activityCols;
  const activeRows = tab === 'orders' ? data.orders : tab === 'invoices' ? data.invoices : data.activities;
  const activeTab  = TABS.find(t => t.k === tab);

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.l} className={`rounded-[20px] border ${k.bg} ${k.border} p-4`}>
            <div className="text-2xl mb-2">{k.icon}</div>
            <div className={`text-xl font-bold ${k.text}`}>{k.v}</div>
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-0.5">{k.l}</div>
          </div>
        ))}
      </div>

      {/* Loyalty card */}
      {(customer.loyalty_points > 0 || customer.loyalty_tier) && (
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[20px] p-5 text-white flex items-center gap-5">
          <div className="text-4xl">🎁</div>
          <div className="flex-1">
            <div className="font-bold text-lg">{customer.loyalty_tier || 'Standard'} Member</div>
            <div className="text-blue-200 text-sm mt-0.5">{customer.name}</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black">{customer.loyalty_points || 0}</div>
            <div className="text-blue-300 text-xs uppercase tracking-wider">Loyalty Points</div>
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(tb => (
          <button key={tb.k} onClick={() => setTab(tb.k)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
              tab === tb.k
                ? 'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white shadow-lg'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-400 hover:text-blue-700'
            }`}>
            <span>{tb.icon}</span>
            <span>{tb.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${tab === tb.k ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {tb.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="bg-white rounded-[20px] border border-blue-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 flex items-center gap-2">
            <span>{activeTab?.icon}</span>
            <span className="font-bold text-[#0F172A] text-sm">{activeTab?.label}</span>
            <span className="ml-auto text-xs text-gray-400">{activeRows.length} records</span>
          </div>
          <RC360Table cols={activeCols} rows={activeRows} emptyMsg={`No ${activeTab?.label?.toLowerCase()} found for this customer`}/>
        </div>
      )}
    </div>
  );
}

// ─── Detail Panel ───────────────────────────────────────────────────────────
function RetailDetailPanel({ page, record, onClose, onSaved, pendingReturnTo }) {
  const { updateRetailRecord, deleteRetailRecord, retailCustomers, retailProducts, enterpriseUsers, currentUser,
          fetchRetailLineItems, appPreferences, setPendingReturnTo, createRetailInvoiceFromOrder } = useApp();
  const cfg = RETAIL_CONFIG[page];
  const taxRegime = getTaxRegime(appPreferences?.default_currency);

  const [edited, setEdited] = useState({ ...record });
  const [activeTab, setActiveTab] = useState('details'); // 'details' | '360'
  // Retail invoice templates (for retailInvoices page)
  const [invoiceTemplates,    setInvoiceTemplates]    = useState([]);
  const [selectedTemplateId,  setSelectedTemplateId]  = useState('');
  const [showPrintPreview,    setShowPrintPreview]    = useState(false);

  useEffect(() => {
    if (page !== 'retailInvoices' || !supabase) return;
    supabase.from('retail_invoice_templates').select('*').order('created_at')
      .then(({ data }) => {
        if (!data) return;
        setInvoiceTemplates(data);
        // Auto-select: use record's saved template, else the default, else first
        const saved    = data.find(t => t.id === (record?.invoice_template_id || edited.invoice_template_id));
        const defTpl   = data.find(t => t.is_default);
        const fallback = data[0];
        const pick = saved || defTpl || fallback;
        if (pick) setSelectedTemplateId(pick.id);
      });
  }, [page, record?.id]);

  // Custom fields — fetch directly, bypass cache issues
  const [customFields, setCustomFields] = useState([]);
  useEffect(() => {
    if (!supabase || !page) return;
    (async () => {
      try {
        // First try with is_published filter
        const { data, error } = await supabase
          .from('app_custom_fields')
          .select('id,label,api_name,field_type,options,required,sort_order,show_on,is_published,is_active')
          .eq('object_type', page)
          .order('sort_order');
        if (error) {
          console.error('[CustomFields] DB error:', error.message, error.code);
          setCustomFields([]);
          return;
        }
        console.log('[CustomFields] all active for', page, ':', data?.length, 'rows', data?.map(f=>({label:f.label,published:f.is_published,active:f.is_active})));
        // Only show active AND published fields
        const published = (data||[]).filter(f => f.is_active !== false && f.is_published === true);
        console.log('[CustomFields] published:', published.length);
        setCustomFields(published.map(f => ({ ...f, options: f.options || [], show_on: f.show_on || 'both' })));
      } catch(e) {
        console.error('[CustomFields] exception:', e);
        setCustomFields([]);
      }
    })();
  }, [page, record?.id]);
  const [items, setItems] = useState([]);
  const [loadingLI, setLoadingLI] = useState(cfg.hasLineItems);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  useEffect(() => {
    setEdited({ ...record });
    if (!cfg.hasLineItems) { setItems([]); return; }
    setLoadingLI(true);
    const table = page === 'retailOrders' ? 'retail_order_line_items' : 'retail_invoice_line_items';
    const fk = cfg.idField;
    fetchRetailLineItems(table, fk, record.id).then(data => {
      setItems((data||[]).map((d,i)=>({ ...d, _id: d.id || i })));
      setLoadingLI(false);
    });
  }, [record.id]);

  const set = (k,v) => setEdited(p => ({ ...p, [k]: v }));

  const handleSave = async (andClose=false) => {
    setSaving(true);
    // Strip client-side computed fields that don't exist as DB columns
    // Strip client-side computed fields — keep custom_data as it's a real DB column
    const { displayNumber, _uuid, ...editedClean } = edited;
    let payload = { ...editedClean, custom_data: edited.custom_data || {} };
    if (cfg.hasLineItems) {
      const subtotal  = items.reduce((s,i) => s + i.quantity*i.unit_price, 0);
      const totalDisc = items.reduce((s,i) => s + i.quantity*i.unit_price*i.discount_pct/100, 0);
      const totalTax  = items.reduce((s,i) => s + taxRegime.computeLineTax(i).totalTax, 0);
      payload = { ...payload, subtotal, total_discount: totalDisc, total_tax: totalTax, amount: subtotal-totalDisc+totalTax };
    }
    await updateRetailRecord(page, payload, items);
    setSaving(false);
    if (andClose) {
      onSaved?.();
      if (pendingReturnTo) {
        const rt = pendingReturnTo; setPendingReturnTo(null);
        window.dispatchEvent(new CustomEvent('open-crm-record', { detail: rt }));
      } else onClose();
    } else { setSaveSuccess(true); setTimeout(()=>setSaveSuccess(false),2500); }
  };

  const handleClose = () => {
    if (pendingReturnTo) {
      const rt = pendingReturnTo; setPendingReturnTo(null);
      window.dispatchEvent(new CustomEvent('open-crm-record', { detail: rt }));
    } else onClose();
  };

  const handleCreateInvoice = async () => {
    setCreatingInvoice(true);
    const inv = await createRetailInvoiceFromOrder(edited);
    setCreatingInvoice(false);
    if (inv) { alert(`Invoice ${inv.invoice_number} created from this order.`); onSaved?.(); handleClose(); }
  };

  // Resolve TAX_PRODUCT / TAX_DOCUMENT placeholder field sets dynamically
  const resolveFields = (fields) => {
    if (fields === 'TAX_PRODUCT') return taxRegime.productFields.map(f => ({ ...f }));
    if (fields === 'TAX_DOCUMENT') return taxRegime.documentFields.map(f => ({ ...f }));
    return fields;
  };

  const renderField = (field) => {
    const v = edited[field.key];
    if (field.type === 'status') return (
      <select value={v||cfg.statusOptions[0]} onChange={e=>set(field.key,e.target.value)} className={sCls}>
        {cfg.statusOptions.map(o=><option key={o}>{o}</option>)}
      </select>
    );
    if (field.type === 'owner') {
      const allUsers = enterpriseUsers.length>0 ? enterpriseUsers : (currentUser?[currentUser]:[]);
      const resolved = allUsers.find(u => (edited.owner_id && u.id===edited.owner_id) || (!edited.owner_id && edited.owner && u.email===edited.owner));
      return <SearchableSelect
        value={resolved?.id||''}
        onChange={uid=>{ const u=allUsers.find(x=>x.id===uid); set('owner_id',u?.id||''); set('owner',u?.email||''); }}
        options={allUsers.map(u=>({value:u.id, label:(`${u.first_name||''} ${u.last_name||''}`.trim())||u.email||'User', sub:u.designation||u.email||''}))}
        placeholder="Select owner" emptyLabel="Unassigned"
      />;
    }
    if (field.type === 'retailCustomer') return <SearchableSelect
      value={edited.customer_id||''}
      onChange={cid=>{ const c=retailCustomers.find(x=>x.id===cid); set('customer_id',c?.id||''); set('customer',c?.name||''); set('customer_phone',c?.phone||''); }}
      options={retailCustomers.map(c=>({value:c.id,label:c.name,sub:[c.phone,c.email].filter(Boolean).join(' · ')}))}
      placeholder="Search customers..." emptyLabel="No customer"
    />;
    if (field.type === 'retailInvoiceTemplate') {
      // Only available in detail panel context (not create modal)
      if (typeof selectedTemplateId === 'undefined') return null;
      return (
        <select
          value={selectedTemplateId}
          onChange={e => {
            setSelectedTemplateId(e.target.value);
            set('invoice_template_id', e.target.value);
          }}
          className={sCls}>
          {invoiceTemplates.length === 0
            ? <option value="">No templates — create one in Admin Tools → B2C Retail → Invoice Template</option>
            : invoiceTemplates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_default ? ' ★ Default' : ''}
                </option>
              ))
          }
        </select>
      );
    }
    if (field.type === 'select') return (
      <select value={v||field.defaultValue||''} onChange={e=>set(field.key,e.target.value)} className={sCls}>
        {!field.defaultValue && <option value="">Select {field.label}</option>}
        {field.opts.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    );
    if (field.type === 'checkbox') return (
      <label className="flex items-center gap-2 cursor-pointer pt-1">
        <input type="checkbox" checked={!!v} onChange={e=>set(field.key,e.target.checked)} className="w-4 h-4 accent-blue-600"/>
        <span className="text-sm text-[#0F172A]">{field.label}</span>
      </label>
    );
    if (field.type === 'textarea') return <textarea rows={3} value={v||''} onChange={e=>set(field.key,e.target.value)} className={tCls} placeholder={field.label}/>;
    if (field.type === 'date') return <input type="date" value={v||''} onChange={e=>set(field.key,e.target.value)} className={iCls}/>;
    if (field.type === 'number') return <input type="number" value={v??0} onChange={e=>set(field.key,Number(e.target.value)||0)} className={iCls}/>;
    if (field.readOnly) return <input type="text" value={v||''} readOnly className={`${iCls} bg-gray-50 text-gray-500`}/>;
    return <input type={field.type==='email'?'email':field.type==='tel'?'tel':'text'} value={v||''} onChange={e=>set(field.key,e.target.value)} className={iCls} placeholder={field.label}/>;
  };

  // ── Print engine ──────────────────────────────────────────────────────────
  function handleDirectPrint(template, record, lineItems) {
    if (!template) { alert('Please select an invoice template first.'); return; }
    const html = buildRetailPrintHTML(template, record, lineItems);
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) { alert('Pop-up blocked. Please allow pop-ups for this site.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 600);
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] overflow-y-auto">
      <div className="bg-white rounded-[28px] shadow-2xl w-[98vw] my-4 mx-auto flex flex-col" style={{minHeight:'95vh'}}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-5 rounded-t-[28px] flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{cfg.icon}</span>
              <h2 className="text-white text-xl font-bold">{edited.name || edited.subject || edited[cfg.idField]}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(edited.status)}`}>{edited.status}</span>
            </div>
            <p className="text-blue-300 text-xs mt-1 flex items-center gap-2">
              {record.displayNumber && (
                <span className="bg-blue-600 text-white font-mono font-bold px-2.5 py-0.5 rounded-full text-xs tracking-wider">
                  {formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', record.displayNumber)}
                </span>
              )}
              <span className="font-mono opacity-60">{edited[cfg.idField]}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saveSuccess && <span className="text-green-300 text-sm font-semibold mr-2">✓ Saved</span>}
            {page==='retailOrders' && edited.status==='Completed' && (
              <button onClick={handleCreateInvoice} disabled={creatingInvoice}
                className="bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-600 disabled:opacity-50">
                {creatingInvoice?'Creating...':'🧾 Create Invoice'}
              </button>
            )}
            {page==='retailInvoices' && (
              <>
                <button
                  onClick={() => { setShowPrintPreview(true); }}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
                  👁️ Preview & Print
                </button>
                <button
                  onClick={() => handleDirectPrint(invoiceTemplates.find(t=>t.id===selectedTemplateId), edited, items)}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
                  🖨️ Print
                </button>
              </>
            )}
            <button onClick={()=>handleSave(false)} disabled={saving}
              className="bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/20 disabled:opacity-50">
              {saving?'Saving...':'Save Changes'}
            </button>
            <button onClick={()=>handleSave(true)} disabled={saving}
              className="bg-white text-[#0F172A] px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50 disabled:opacity-50">
              Save & Close
            </button>
            <button onClick={handleClose} className="text-white/70 hover:text-white text-2xl leading-none ml-1">✕</button>
          </div>
        </div>

        {/* Tab bar — only for retailCustomers */}
        {page === 'retailCustomers' && (
          <div className="flex bg-slate-800 border-b border-slate-700 px-6 flex-shrink-0">
            {[
              {k:'details', l:'📋 Details'},
              {k:'360',     l:'🔄 Customer 360'},
            ].map(tb => (
              <button key={tb.k} onClick={()=>setActiveTab(tb.k)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                  activeTab===tb.k
                    ? 'border-blue-400 text-white'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}>
                {tb.l}
              </button>
            ))}
          </div>
        )}

        {/* Body — single scrollable container switching between tabs */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {page === 'retailCustomers' && activeTab === '360' ? (
            <RetailCustomer360 customer={record}/>
          ) : (
            <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cfg.sections.map(section => {
              const fields = resolveFields(section.fields);
              return (
                <div key={section.title} className="bg-white rounded-[20px] border border-blue-100 shadow-sm">
                  <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 rounded-t-[20px]">
                    <h3 className="font-bold text-[#0F172A] text-sm flex items-center gap-2"><span>{section.icon}</span>{section.title}</h3>
                  </div>
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {fields.map(field => (
                      <div key={field.key} className={field.full || field.type==='textarea' ? 'sm:col-span-2' : ''}>
                        {field.type!=='checkbox' && (
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                            {field.label}{field.required && <span className="text-red-400 ml-1">*</span>}
                            {field.helpText && <span className="ml-1 text-gray-300 font-normal" title={field.helpText}>ⓘ</span>}
                          </label>
                        )}
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Additional Information — App Composer custom fields, only when published */}
          {customFields.filter(cf => cf.show_on !== 'create').length > 0 && (
            <div className="bg-white rounded-[20px] border border-blue-100 shadow-sm">
              <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 rounded-t-[20px] flex items-center gap-2">
                <span>🎛️</span>
                <span className="font-bold text-[#0F172A] text-sm">Additional Information</span>
                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold ml-auto">App Composer</span>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customFields.filter(cf => cf.show_on !== 'create').map(cf => {
                  const cdVal = (edited.custom_data || {})[cf.api_name];
                  const setCdVal = (val) => setEdited(p => ({ ...p, custom_data: { ...(p.custom_data||{}), [cf.api_name]: val } }));
                  return (
                    <div key={cf.api_name} className={cf.field_type==='multi_select'?'sm:col-span-2':''}>
                      {cf.field_type !== 'checkbox' && (
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                          {cf.label}{cf.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                      )}
                      {cf.field_type==='single_select'
                        ? <select value={cdVal||''} onChange={e=>setCdVal(e.target.value)} className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-[#0F172A]">
                            <option value="">Select {cf.label}...</option>
                            {cf.options.map(o=><option key={o} value={o}>{o}</option>)}
                          </select>
                        : cf.field_type==='multi_select'
                        ? <div className="space-y-2">{cf.options.map(o=>(
                            <label key={o} className="flex items-center gap-2.5 cursor-pointer">
                              <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded"
                                checked={(cdVal||'').split('||').includes(o)}
                                onChange={e=>{const cur=(cdVal||'').split('||').filter(Boolean);const nxt=e.target.checked?[...cur,o]:cur.filter(x=>x!==o);setCdVal(nxt.join('||'));}}/>
                              <span className="text-sm text-[#0F172A]">{o}</span>
                            </label>
                          ))}</div>
                        : cf.field_type==='checkbox'
                        ? <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                            <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" checked={!!cdVal} onChange={e=>setCdVal(e.target.checked)}/>
                            <span className="text-sm font-semibold text-[#0F172A]">{cf.label}</span>
                          </label>
                        : <input
                            type={cf.field_type==='number'||cf.field_type==='currency'?'number':cf.field_type==='date'?'date':cf.field_type==='datetime'?'datetime-local':cf.field_type==='email'?'email':cf.field_type==='url'?'url':'text'}
                            value={cdVal||''} onChange={e=>setCdVal(e.target.value)} placeholder={cf.label}
                            className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-[#0F172A]"/>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Line items for Orders/Invoices */}
          {cfg.hasLineItems && (
            loadingLI
              ? <div className="bg-white rounded-[20px] border border-blue-100 shadow p-8 text-center text-gray-400">Loading line items...</div>
              : <RetailLineItems items={items} setItems={setItems} products={retailProducts} taxRegime={taxRegime}/>
          )}
            </div>
          )}
        </div>{/* end body flex-1 */}

        {/* Delete — always visible, outside the scrollable body */}
        <div className="flex justify-end px-6 py-3 border-t border-gray-100 flex-shrink-0">
          <button onClick={async()=>{ await deleteRetailRecord(page, edited.id); onSaved?.(); handleClose(); }}
            className="text-red-500 hover:text-red-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-red-50">
            🗑️ Delete {cfg.singular}
          </button>
        </div>
      </div>
    </div>

    {/* Print Preview Modal */}
    {showPrintPreview && page==='retailInvoices' && (
      <RetailInvoicePrintModal
        template={invoiceTemplates.find(t=>t.id===selectedTemplateId)}
        record={edited}
        items={items}
        onClose={()=>setShowPrintPreview(false)}
        onPrint={()=>handleDirectPrint(invoiceTemplates.find(t=>t.id===selectedTemplateId), edited, items)}
      />
    )}
    </>
  );
}

// ─── Create Modal ───────────────────────────────────────────────────────────
function RetailCreateModal({ page, open, onClose, onCreated }) {
  const { createRetailRecord, retailCustomers, enterpriseUsers, currentUser, appPreferences } = useApp();
  const cfg = RETAIL_CONFIG[page];
  const taxRegime = getTaxRegime(appPreferences?.default_currency);

  const defaultForm = () => ({
    status: cfg.statusOptions[0],
    currency: appPreferences?.default_currency || 'INR',
    owner_id: currentUser?.id, owner: currentUser?.email,
    order_date: new Date().toISOString().split('T')[0],
    invoice_date: new Date().toISOString().split('T')[0],
    activity_date: new Date().toISOString().split('T')[0],
    loyalty_points: 0, loyalty_tier: 'Standard', preferred_contact: 'Phone',
    country: 'India', unit: 'pc', price: 0, mrp: 0, cost: 0, stock_quantity: 0, reorder_level: 10,
    quantity: 1, payment_method: 'Cash', payment_status: 'Paid', channel: 'In-Store', delivery_method: 'Pickup',
    ...(taxRegime.regime==='india_gst' ? { gst_rate: 18 } : {}),
    ...(taxRegime.regime==='us_sales_tax' ? { taxable: 'Yes' } : {}),
    ...(taxRegime.regime==='uk_vat' ? { vat_rate: 20 } : {}),
  });

  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [createCustomFields, setCreateCustomFields] = useState([]);

  useEffect(() => {
    if (!open || !supabase || !page) return;
    supabase
      .from('app_custom_fields')
      .select('id,label,api_name,field_type,options,required,sort_order,show_on')
      .eq('object_type', page)
      .eq('is_active', true)
      .eq('is_published', true)
      .in('show_on', ['create','both'])
      .order('sort_order')
      .then(({ data }) => setCreateCustomFields((data||[]).map(f=>({...f,options:f.options||[]}))))
      .catch(()=>setCreateCustomFields([]));
  }, [open, page]);

  useEffect(() => { if (open) { setForm(defaultForm()); setErrors({}); } }, [open, page]);

  const s = (k,v) => setForm(p => ({ ...p, [k]: v }));

  // Use the configured sections' fields for the create form (excluding long-text/full fields)
  const createFields = useMemo(() => {
    const flat = [];
    for (const section of cfg.sections) {
      const fields = section.fields === 'TAX_PRODUCT' ? taxRegime.productFields
                    : section.fields === 'TAX_DOCUMENT' ? []
                    : section.fields;
      for (const f of fields) {
        if (['notes','comments','description','delivery_address'].includes(f.key)) continue;
        flat.push(f);
      }
    }
    return flat;
  }, [page]);

  if (!open) return null;

  const validate = () => {
    const errs = {};
    createFields.filter(f=>f.required).forEach(f => { if (!form[f.key]) errs[f.key] = `${f.label} is required`; });
    setErrors(errs);
    return Object.keys(errs).length===0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSaving(true);
    const rec = await createRetailRecord(page, form, []);
    setSaving(false);
    if (rec) { onCreated?.(rec); onClose(); }
  };

  const renderField = (field) => {
    const v = form[field.key];
    if (field.type === 'status') return (
      <select value={v||cfg.statusOptions[0]} onChange={e=>s(field.key,e.target.value)} className={sCls}>
        {cfg.statusOptions.map(o=><option key={o}>{o}</option>)}
      </select>
    );
    if (field.type === 'owner') {
      const allUsers = enterpriseUsers.length>0 ? enterpriseUsers : (currentUser?[currentUser]:[]);
      return <SearchableSelect
        value={form.owner_id||''}
        onChange={uid=>{ const u=allUsers.find(x=>x.id===uid); s('owner_id',u?.id||''); s('owner',u?.email||''); }}
        options={allUsers.map(u=>({value:u.id,label:(`${u.first_name||''} ${u.last_name||''}`.trim())||u.email||'User', sub:u.designation||u.email||''}))}
        placeholder="Select owner" emptyLabel="Unassigned"
      />;
    }
    if (field.type === 'retailCustomer') return <SearchableSelect
      value={form.customer_id||''}
      onChange={cid=>{ const c=retailCustomers.find(x=>x.id===cid); s('customer_id',c?.id||''); s('customer',c?.name||''); s('customer_phone',c?.phone||''); }}
      options={retailCustomers.map(c=>({value:c.id,label:c.name,sub:[c.phone,c.email].filter(Boolean).join(' · ')}))}
      placeholder="Search customers..." emptyLabel="No customer"
    />;
    if (field.type === 'retailInvoiceTemplate') {
      // Only available in detail panel context (not create modal)
      if (typeof selectedTemplateId === 'undefined') return null;
      return (
        <select
          value={selectedTemplateId}
          onChange={e => {
            setSelectedTemplateId(e.target.value);
            set('invoice_template_id', e.target.value);
          }}
          className={sCls}>
          {invoiceTemplates.length === 0
            ? <option value="">No templates — create one in Admin Tools → B2C Retail → Invoice Template</option>
            : invoiceTemplates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_default ? ' ★ Default' : ''}
                </option>
              ))
          }
        </select>
      );
    }
    if (field.type === 'select') return (
      <select value={v??field.defaultValue??''} onChange={e=>s(field.key,e.target.value)} className={sCls}>
        {!field.defaultValue && <option value="">Select {field.label}</option>}
        {field.opts.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    );
    if (field.type === 'checkbox') return (
      <label className="flex items-center gap-2 cursor-pointer pt-1">
        <input type="checkbox" checked={!!v} onChange={e=>s(field.key,e.target.checked)} className="w-4 h-4 accent-blue-600"/>
        <span className="text-sm text-[#0F172A]">{field.label}</span>
      </label>
    );
    if (field.type === 'date') return <input type="date" value={v||''} onChange={e=>s(field.key,e.target.value)} className={iCls}/>;
    if (field.type === 'number') return <input type="number" value={v??0} onChange={e=>s(field.key,Number(e.target.value)||0)} className={iCls}/>;
    return <input type={field.type==='email'?'email':field.type==='tel'?'tel':'text'} value={v||''} onChange={e=>s(field.key,e.target.value)} className={iCls} placeholder={field.label}/>;
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-5 flex items-center justify-between flex-shrink-0">
          <h2 className="text-white text-xl font-bold">{cfg.icon} Create {cfg.singular}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {createFields.map(f => (
              <div key={f.key} className={f.type==='textarea'?'sm:col-span-2':''}>
                {f.type!=='checkbox' && (
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    {f.label}{f.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                )}
                {renderField(f)}
                {errors[f.key] && <p className="text-xs text-red-500 mt-1">{errors[f.key]}</p>}
              </div>
            ))}
          </div>

          {/* Additional Information — custom fields shown on create */}
          {createCustomFields.filter(cf=>!cf.show_on||cf.show_on==='both'||cf.show_on==='create').length > 0 && (
            <div className="mt-4 bg-blue-50/40 rounded-[18px] border border-blue-100 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                <span>🎛️</span> Additional Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {createCustomFields.filter(cf=>!cf.show_on||cf.show_on==='both'||cf.show_on==='create').map(cf=>{
                  const cdVal=(form.custom_data||{})[cf.api_name];
                  const setCdVal=(val)=>setForm(p=>({...p,custom_data:{...(p.custom_data||{}),[cf.api_name]:val}}));
                  const isWide=cf.field_type==='multi_select';
                  return (
                    <div key={cf.api_name} className={isWide?'sm:col-span-2':''}>
                      {cf.field_type!=='checkbox'&&<label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">{cf.label}{cf.required&&<span className="text-red-400 ml-1">*</span>}</label>}
                      {cf.field_type==='single_select'
                        ?<select value={cdVal||''} onChange={e=>setCdVal(e.target.value)} className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"><option value="">Select {cf.label}...</option>{cf.options.map(o=><option key={o}>{o}</option>)}</select>
                        :cf.field_type==='multi_select'
                        ?<div className="flex flex-wrap gap-3">{cf.options.map(o=>(<label key={o} className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-blue-600" checked={(cdVal||'').split('||').includes(o)} onChange={e=>{const cur=(cdVal||'').split('||').filter(Boolean);const nxt=e.target.checked?[...cur,o]:cur.filter(x=>x!==o);setCdVal(nxt.join('||'));}}/>{o}</label>))}</div>
                        :cf.field_type==='checkbox'
                        ?<label className="flex items-center gap-2 cursor-pointer pt-1"><input type="checkbox" className="w-4 h-4 accent-blue-600" checked={!!cdVal} onChange={e=>setCdVal(e.target.checked)}/><span className="text-sm font-semibold">{cf.label}</span></label>
                        :<input type={cf.field_type==='number'||cf.field_type==='currency'?'number':cf.field_type==='date'?'date':cf.field_type==='datetime'?'datetime-local':cf.field_type==='email'?'email':cf.field_type==='url'?'url':'text'} value={cdVal||''} onChange={e=>setCdVal(e.target.value)} placeholder={cf.label} className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0 bg-gray-50">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-100">Cancel</button>
          <button onClick={handleCreate} disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0F172A] to-blue-800 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 shadow-md">
            {saving?'⏳ Creating...':`✓ Create ${cfg.singular}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main List Page ─────────────────────────────────────────────────────────
export default function RetailListPage({ page }) {
  const { retailCustomers, retailProducts, retailActivities, retailOrders, retailInvoices,
          fetchRetailCustomers, fetchRetailProducts, fetchRetailActivities, fetchRetailOrders, fetchRetailInvoices,
          pendingRecord, setPendingRecord, pendingReturnTo, setPendingReturnTo } = useApp();

  const cfg = RETAIL_CONFIG[page];
  const dataMap = { retailCustomers, retailProducts, retailActivities, retailOrders, retailInvoices };
  const fetchMap = { retailCustomers: fetchRetailCustomers, retailProducts: fetchRetailProducts, retailActivities: fetchRetailActivities, retailOrders: fetchRetailOrders, retailInvoices: fetchRetailInvoices };
  const data = dataMap[page] || [];

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Pick up cross-page navigation (e.g. from customer activity history)
  useEffect(() => {
    if (pendingRecord && pendingRecord.page === page && pendingRecord.record) {
      setSelectedRecord(pendingRecord.record);
      setPendingRecord(null);
    }
  }, [pendingRecord, page]);

  const filtered = useMemo(() => {
    let rows = data;
    if (statusFilter !== 'All') rows = rows.filter(r => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => cfg.searchFields.some(f => String(r[f]||'').toLowerCase().includes(q)));
    }
    return rows;
  }, [data, search, statusFilter]);

  if (!cfg) return <div className="p-6 text-gray-400">Unknown retail page: {page}</div>;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[28px] p-6 text-white flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">{cfg.icon} {cfg.title}</h1><p className="text-blue-200 mt-1">Retail (B2C) module</p></div>
        <button onClick={()=>setCreateOpen(true)} className="bg-white text-[#0F172A] px-5 py-2.5 rounded-2xl font-bold text-sm shadow-lg hover:bg-blue-50">+ Create {cfg.singular}</button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${cfg.title.toLowerCase()}...`}
          className="flex-1 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-400"/>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          className="border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option>All</option>
          {cfg.statusOptions.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-[#0F172A] to-blue-900 text-white">
              <tr>
                {cfg.listColumns.map(c=><th key={c.h} className={`px-5 py-3.5 font-semibold ${c.align==='right'?'text-right':'text-left'}`}>{c.h}</th>)}
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
                <th className="px-5 py-3.5 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0
                ? <tr><td colSpan={cfg.listColumns.length+2} className="px-5 py-16 text-center">
                    <div className="text-5xl mb-3">{cfg.icon}</div>
                    <div className="font-bold text-[#0F172A] text-lg mb-2">No {cfg.title.toLowerCase()} yet</div>
                    <p className="text-gray-400">Click "+ Create {cfg.singular}" to add your first record.</p>
                  </td></tr>
                : filtered.map(r => (
                  <tr key={r.id} className="border-t border-blue-50 hover:bg-blue-50/40">
                    {cfg.listColumns.map((c,ci) => (
                      <td key={c.h} className={`px-5 py-3.5 ${c.align==='right'?'text-right font-semibold':''} ${c.mono?'font-mono text-xs text-gray-400':'text-gray-700'}`}>
                        {ci === 0
                          ? <button onClick={()=>setSelectedRecord(r)} className="text-left">
                              {c.h.includes('#')
                                ? <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full border border-blue-100 cursor-pointer transition-all">{c.v(r)}</span>
                                : <div>
                                    <div className="font-semibold text-[#0F172A] hover:text-blue-700">{c.v(r)}</div>
                                    {r.displayNumber && <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 mt-0.5 inline-block">{formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', r.displayNumber)}</span>}
                                  </div>
                              }
                            </button>
                          : c.v(r)}
                      </td>
                    ))}
                    <td className="px-5 py-3.5"><span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(r.status)}`}>{r.status}</span></td>
                    <td className="px-5 py-3.5">
                      <button onClick={()=>setSelectedRecord(r)} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-semibold">Open</button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {selectedRecord && (
        <RetailDetailPanel
          page={page}
          record={selectedRecord}
          pendingReturnTo={pendingReturnTo}
          onClose={()=>{
            setSelectedRecord(null);
            if (pendingReturnTo) {
              const rt = pendingReturnTo; setPendingReturnTo(null);
              window.dispatchEvent(new CustomEvent('open-crm-record', { detail: rt }));
            }
          }}
          onSaved={()=>{ fetchMap[page]?.(); }}
        />
      )}

      <RetailCreateModal page={page} open={createOpen} onClose={()=>setCreateOpen(false)} onCreated={()=>fetchMap[page]?.()}/>
    </div>
  );
}
