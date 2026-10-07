// @ts-nocheck
'use client';

import RedwoodSkin from '@/components/shared/RedwoodSkin';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRelabel } from '@/lib/useRelabel';
import { useTenant } from '@/context/TenantContext';
import ApprovalBanner from '@/components/crm/ApprovalBanner';
import QuickCreateModal from '@/components/shared/QuickCreateModal';
import { useFieldMappingRules, applyFieldMapping } from '@/lib/useFieldMappingRules';
import { getStatusOptions, getStatusColor, getPageLabel, formatDateTime, formatDisplayNumber, PAGE_DISPLAY_PREFIX } from '@/lib/utils';
import AISummary from '@/components/ai/AISummary';
import AddressSelector from '@/components/shared/AddressSelector';
import SearchableSelect from '@/components/shared/SearchableSelect';
import BalanceConversionModal from '@/components/shared/BalanceConversionModal';
import { buildInvoiceHTML } from '@/lib/buildInvoiceHTML';
import { useAlert } from '@/components/shared/AlertProvider';
import { useCustomFields } from '@/lib/useCustomFields';
import LineItemCustomFieldInput from '@/components/shared/LineItemCustomFieldInput';
import EwayBillModal from '@/components/crm/EwayBillModal';
import { t } from '@/lib/i18n';
import { useFieldLayout, resolveFieldDisplay, resolveFieldRow, cfKey, effectiveRows, resolveLayoutDefault } from '@/lib/useFieldLayout';
import { useCustomFields as useHeaderCustomFields } from '@/lib/useCustomFields';
import OrderedRow from '@/components/shared/OrderedRow';
import { useLineLayout } from '@/lib/lineLayout';
import RecordHighlights from '@/components/shared/RecordHighlights';

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';
const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';
const tCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none';

const STATUS_COLORS = {
  Draft:'bg-gray-100 text-gray-700 border-gray-200',
  Processing:'bg-blue-100 text-blue-700 border-blue-200',
  Confirmed:'bg-purple-100 text-purple-700 border-purple-200',
  Shipped:'bg-indigo-100 text-indigo-700 border-indigo-200',
  Delivered:'bg-green-100 text-green-700 border-green-200',
  Invoiced:'bg-teal-100 text-teal-700 border-teal-200',
  'Partially Invoiced':'bg-teal-50 text-teal-600 border-teal-200',
  Cancelled:'bg-red-100 text-red-700 border-red-200',
  Pending:'bg-yellow-100 text-yellow-700 border-yellow-200',
  Paid:'bg-emerald-100 text-emerald-700 border-emerald-200',
  Overdue:'bg-red-100 text-red-700 border-red-200',
};

const CURRENCIES = ['INR','USD','EUR','GBP','AED','SGD','AUD','CAD','JPY','CNY'];

// ─── CPQ Line Items Table (shared by Order + Invoice) ──────────────────────────
const NUMERIC_LINE_KEYS = ['quantity','price','list_price','discount','tax_pct'];
export function CPQLineItems({ items, setItems, products, readOnly, currency, page, scope = 'detail' }) {
  const { fields: customFieldsAll } = useCustomFields(page === 'invoices' ? 'invoiceLineItems' : 'orderLineItems');
  // Page Layout Designer (this grid's page scope): column label / hidden / read-only / order, incl. custom fields.
  const LL = useLineLayout(page === 'invoices' ? 'invoiceLineItems' : 'orderLineItems', scope);
  const customFields = LL.customCols(customFieldsAll);
  const cProd = LL.col('product_name','Product'), cQty = LL.col('quantity','Qty'), cPrice = LL.col('price','Unit Price'),
        cDisc = LL.col('discount','Disc %'), cTax = LL.col('tax_pct','Tax %'), cExt = LL.col('extended_price','Extended');
  const lineOrder = {};
  effectiveRows(LL.rows, scope).forEach(r => { lineOrder[r.field_key] = r.display_order; });
  const colCount = 1 + [cProd,cQty,cPrice,cDisc,cTax,cExt].filter(c=>c.visible).length + customFields.length; // + description
  // Copy Maps: product -> line item
  const { rules: p2lRules } = useFieldMappingRules('product_to_line_item', 'products', page === 'invoices' ? 'invoiceLineItems' : 'orderLineItems');
  const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:currency||'INR',maximumFractionDigits:0}).format(n||0);

  // Page Layout Designer defaults for a brand-new line (standard + custom columns), for this grid's page scope.
  const withLayoutDefaults = (row) => {
    const out = { ...row, custom_data: { ...(row.custom_data || {}) } };
    effectiveRows(LL.rows, scope).forEach(r => {
      if (!r.default_value || r.field_key.startsWith('__')) return;
      if (r.field_key.startsWith('cf_')) {
        const f = (customFieldsAll || []).find(x => cfKey(x.api_name) === r.field_key);
        if (!f) return;
        const v = resolveLayoutDefault(f.field_type, r.default_value, out);
        if (v !== undefined) out.custom_data[f.api_name] = v;
      } else {
        const v = resolveLayoutDefault(NUMERIC_LINE_KEYS.includes(r.field_key) ? 'number' : 'text', r.default_value, out);
        if (v !== undefined) out[r.field_key] = v;
      }
    });
    const net = Number(out.quantity) * Number(out.price) * (1 - Number(out.discount) / 100);
    out.extended_price = net * (1 + Number(out.tax_pct || 0) / 100);
    return out;
  };
  const add = () => !readOnly && setItems(p=>[...p,withLayoutDefaults({_id:Date.now(),product_name:'',product_code:'',description:'',quantity:1,price:0,list_price:0,discount:0,tax_pct:18,extended_price:0,custom_data:{}})]);
  const remove = idx => !readOnly && setItems(p=>p.filter((_,i)=>i!==idx));
  const upd = (idx,field,val) => {
    if (readOnly) return;
    setItems(p=>p.map((r,i)=>{
      if(i!==idx) return r;
      const u={...r,[field]:['quantity','price','list_price','discount','tax_pct'].includes(field)?Number(val):val};
      if(field==='product_name'){const pr=products.find(x=>x.name===val);if(pr){u.price=pr.price;u.list_price=pr.price;if(p2lRules.length)applyFieldMapping(p2lRules,pr,u);}}
      const net=u.quantity*u.price*(1-u.discount/100);
      u.extended_price=net*(1+u.tax_pct/100);
      return u;
    }));
  };
  const updCustom = (idx, apiName, val) => !readOnly && setItems(p => p.map((r,i) => i!==idx ? r : { ...r, custom_data: { ...(r.custom_data||{}), [apiName]: val } }));

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
          <thead><OrderedRow order={lineOrder} className="bg-blue-50 border-b border-blue-100">
            {(() => { const H = "px-4 py-3 text-left font-bold text-gray-600 uppercase text-xs tracking-wide bg-blue-50"; return (<>
              {cProd.visible && <th data-col="product_name" style={{minWidth:'200px'}} className={H}>{cProd.label}</th>}
              <th data-col="description" style={{minWidth:'150px'}} className={H}>Description</th>
              {cQty.visible && <th data-col="quantity" style={{minWidth:'80px'}} className={H}>{cQty.label}</th>}
              {cPrice.visible && <th data-col="price" style={{minWidth:'120px'}} className={H}>{cPrice.label}</th>}
              {cDisc.visible && <th data-col="discount" style={{minWidth:'80px'}} className={H}>{cDisc.label}</th>}
              {cTax.visible && <th data-col="tax_pct" style={{minWidth:'80px'}} className={H}>{cTax.label}</th>}
              {cExt.visible && <th data-col="extended_price" style={{minWidth:'120px'}} className={H}>{cExt.label}</th>}
              {customFields.map(f=><th key={f.id} data-col={'cf_'+f.api_name} style={{minWidth:'110px'}} className={H}>{f.label}</th>)}
              {!readOnly && <th data-col="__actions" style={{minWidth:'40px'}} className="px-4 py-3 bg-blue-50"></th>}
            </>); })()}
          </OrderedRow></thead>
          <tbody>
            {items.length===0
              ? <tr><td colSpan={colCount+1} className="px-5 py-8 text-center text-gray-400">No line items.{!readOnly&&' Click + Add Line.'}</td></tr>
              : items.map((row,idx)=>(
                <OrderedRow key={row._id??idx} order={lineOrder} className="border-t border-blue-50 hover:bg-blue-50/30">
                  {cProd.visible && <td data-col="product_name" className="px-4 py-3" style={{minWidth:'200px'}}>
                    {readOnly ? <div><span className="font-semibold text-[#0F172A]">{row.product_name||'-'}</span>{row.description&&<div className="text-xs text-gray-400 mt-0.5">{row.description}</div>}</div>
                    : <SearchableSelect
                      value={row.product_name||''}
                      onChange={v=>upd(idx,'product_name',v)}
                      options={products.map(p=>({value:p.name,label:p.name,sub:p.category||p.productFamily||''}))}
                      placeholder="Select product" emptyLabel="No product"
                    />}
                  </td>}
                  <td data-col="description" className="px-4 py-3" style={{minWidth:'150px'}}>
                    {readOnly ? null
                    : <input value={row.description||''} onChange={e=>upd(idx,'description',e.target.value)} placeholder="Description" className={iCls}/>}
                  </td>
                  {cQty.visible && <td data-col="quantity" className="px-4 py-3" style={{minWidth:'80px'}}>
                    {readOnly ? <span className="font-bold text-lg text-[#0F172A]">{row.quantity}</span>
                    : <input disabled={cQty.readOnly} type="number" min={1} value={row.quantity} onChange={e=>upd(idx,'quantity',e.target.value)} className="w-full border-2 border-blue-300 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm text-center font-bold"/>}
                  </td>}
                  {cPrice.visible && <td data-col="price" className="px-4 py-3" style={{minWidth:'120px'}}>
                    {readOnly ? <span className="font-medium">{fmt(row.price)}</span>
                    : <input disabled={cPrice.readOnly} type="number" min={0} value={row.price} onChange={e=>upd(idx,'price',e.target.value)} className={`${iCls} text-right`}/>}
                  </td>}
                  {cDisc.visible && <td data-col="discount" className="px-4 py-3" style={{minWidth:'80px'}}>
                    {readOnly
                      ? <span className={`font-semibold ${row.discount>0?'text-green-600':'text-gray-300'}`}>{row.discount>0?`${row.discount}%`:'-'}</span>
                      : <input disabled={cDisc.readOnly} type="number" min={0} max={100} value={row.discount} onChange={e=>upd(idx,'discount',e.target.value)} className={`w-full border-2 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400 ${row.discount>0?'border-green-300 bg-green-50 text-green-700 font-bold':'border-blue-200 text-[#0F172A] bg-white'}`}/>}
                  </td>}
                  {cTax.visible && <td data-col="tax_pct" className="px-4 py-3" style={{minWidth:'80px'}}>
                    {readOnly
                      ? <span className="text-gray-500">{row.tax_pct>0?`${row.tax_pct}%`:'-'}</span>
                      : <input disabled={cTax.readOnly} type="number" min={0} max={100} value={row.tax_pct||0} onChange={e=>upd(idx,'tax_pct',e.target.value)} className={`${iCls} text-center`}/>}
                  </td>}
                  {cExt.visible && <td data-col="extended_price" className="px-4 py-3 text-right" style={{minWidth:'120px'}}>
                    <span className="font-bold text-[#0F172A]">{fmt(row.extended_price||row.quantity*row.price)}</span>
                  </td>}
                  {customFields.map(f=><td key={f.id} data-col={'cf_'+f.api_name} className="px-4 py-3" style={{minWidth:'110px'}}>
                    {readOnly
                      ? <span className="text-gray-600">{(row.custom_data||{})[f.api_name] ?? '-'}</span>
                      : <fieldset disabled={f._readOnly} className="contents"><LineItemCustomFieldInput field={f} value={(row.custom_data||{})[f.api_name]} onChange={v=>updCustom(idx,f.api_name,v)}/></fieldset>}
                  </td>)}
                  {!readOnly && <td data-col="__actions" className="px-3 py-3"><button onClick={()=>remove(idx)} className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-sm font-bold flex items-center justify-center shadow-sm">✕</button></td>}
                </OrderedRow>
              ))
            }
          </tbody>
          {items.length>0&&(
            <tfoot className="border-t-2 border-blue-100">
              <tr className="bg-gray-50"><td colSpan={Math.max(1,colCount-1)} className="px-5 py-2 text-right text-xs text-gray-500 font-medium">Subtotal</td><td className="px-3 py-2 text-right text-xs font-semibold">{fmt(subtotal)}</td>{!readOnly&&<td/>}</tr>
              {totalDisc>0&&<tr className="bg-green-50"><td colSpan={Math.max(1,colCount-1)} className="px-5 py-2 text-right text-xs text-green-600">Discount</td><td className="px-3 py-2 text-right text-xs font-semibold text-green-600">- {fmt(totalDisc)}</td>{!readOnly&&<td/>}</tr>}
              {totalTax>0&&<tr className="bg-blue-50"><td colSpan={Math.max(1,colCount-1)} className="px-5 py-2 text-right text-xs text-blue-600">Tax</td><td className="px-3 py-2 text-right text-xs font-semibold text-blue-600">+ {fmt(totalTax)}</td>{!readOnly&&<td/>}</tr>}
              <tr className="bg-[#0F172A]"><td colSpan={Math.max(1,colCount-1)} className="px-5 py-3 text-right font-bold text-white text-sm">Net Total</td><td className="px-3 py-3 text-right font-bold text-white text-base">{fmt(subtotal-totalDisc+totalTax)}</td>{!readOnly&&<td/>}</tr>
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
    updateRecord, createInvoiceFromOrder, appPreferences, appearance,
    checkMatchingApprovalProcess, submitForApproval, approvalRequests,
    invoiceTemplates,
  } = useApp();
  const L = useRelabel();
  const [showEwayBill, setShowEwayBill] = useState(false);
  // E-Way Bill is India/B2B-specific — gated on the tenant's own Region
  // setting (App Preferences → Region & E-Way Bill), defaulting to shown
  // since this app defaults new tenants to region:'India'. Retail has no
  // equivalent button or gate; this only ever renders from this B2B view.
  const showEwayBillButton = appPreferences?.region !== 'Other' && appPreferences?.eway_bill_enabled !== false;
  const { supabase } = useTenant();
  const { showAlert, showConfirm } = useAlert();
  const lang = appearance?.language || 'en';
  // Page Layout Designer + App Composer custom fields for this object's header
  const fieldLayout = useFieldLayout(page);
  const { fields: headerCF } = useHeaderCustomFields(page);

  const [edited,          setEdited]          = useState({ ...record });
  const [items,           setItems]           = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [matchingProcess, setMatchingProcess] = useState(null);
  const [checkingApproval,setCheckingApproval]= useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [quickCreate,     setQuickCreate]     = useState(null);
  const [pendingCustomers,setPendingCustomers]= useState([]);
  const [pendingContacts, setPendingContacts] = useState([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [creatingInvoice,  setCreatingInvoice]  = useState(false);
  const [printingInvoice,  setPrintingInvoice]  = useState(false);

  // Map table names
  const LI_TABLE  = page === 'orders' ? 'order_line_items'   : 'invoice_line_items';
  const LI_FIELD  = page === 'orders' ? 'order_number'       : 'invoice_number';

  useEffect(() => {
    const load = async () => {
      if (!supabase) return;
      const { data } = await supabase.from(LI_TABLE).select('*').eq(LI_FIELD, record.id).order('sort_order');
      setItems((data||[]).map(r=>({
        id: r.id,
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
        invoiced_qty:  Number(r.invoiced_qty || 0),
        custom_data:   r.custom_data || {},
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

  // Resolve one header field through the Page Layout Designer (Detail page, falling back to Both Pages).
  const FL = (key, defLabel, idx) => {
    const r = resolveFieldDisplay(key, defLabel, fieldLayout.fields || [], { ...edited, ...(edited.custom_data || {}) }, 'detail');
    const row = resolveFieldRow(key, fieldLayout.fields || [], 'detail');
    return { label: r.label, hidden: !r.visible, ro: !r.editable, order: row ? row.display_order : 10000 + idx };
  };
  const cardCls = 'bg-white rounded-2xl border border-blue-100 p-4 shadow-sm min-w-0 m-0';
  const lblCls  = 'text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2';

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
          custom_data:      i.custom_data || {},
          // Partial-fulfillment counter fix — order_line_items ONLY
          // (invoice_line_items has no invoiced_qty column, confirmed
          // against the live DB schema, so this must not be sent there).
          // This delete-then-reinsert assigns brand-new row ids, so
          // without carrying invoiced_qty forward (loaded into state
          // above but previously dropped here), saving an order's line
          // items after it's been partially invoiced silently reset how
          // much of each line was already invoiced — risking
          // double-invoicing on the next pass.
          ...(page === 'orders' ? { invoiced_qty: Number(i.invoiced_qty || 0) } : {}),
        })));
      }
    }
    await updateRecord(page, { ...edited, amount: grandTotal }, null);
    setSaving(false);
    if (andClose) { onClose(); } else { setSaveSuccess(true); setTimeout(()=>setSaveSuccess(false),2500); }
  };

  const statusMeta  = STATUS_COLORS[edited.status] || 'bg-gray-100 text-gray-700 border-gray-200';
  const statusOpts  = getStatusOptions(page);
  const ownerUser   = enterpriseUsers.find(u=>u.id===edited.owner_id||u.email===edited.owner);
  const pageIcon    = page==='orders' ? '🛒' : '🧾';

  return (
    <div className="fixed inset-0 bg-black/50 z-[110] overflow-y-auto">
      <div className="rw-panel bg-white rounded-[28px] shadow-2xl w-[98vw] my-4 mx-auto overflow-hidden flex flex-col" style={{minHeight:'95vh'}}>
        <RedwoodSkin />

        {/* Header */}
        <div className="rw-header bg-gradient-to-r from-[#0F172A] to-blue-900 px-8 py-5 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-3xl">{pageIcon}</span>
              <h2 className="text-2xl font-bold">{edited.name || formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', record.displayNumber) || 'Untitled Record'}</h2>
              <span className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold border-2 ${statusMeta}`}>{edited.status}</span>
              {page==='orders' && ['Partially Invoiced','Invoiced'].includes(edited.status) && items.length>0 && (() => {
                const totalQty = items.reduce((s,i)=>s+Number(i.quantity||0),0);
                const invoicedQty = items.reduce((s,i)=>s+Math.min(Number(i.invoiced_qty||0),Number(i.quantity||0)),0);
                return (
                  <span className="bg-teal-500/30 text-teal-100 text-xs font-bold px-3 py-1 rounded-full border border-teal-400/40">
                    🧾 {invoicedQty} of {totalQty} units invoiced
                  </span>
                );
              })()}
              {ownerUser && <span className="bg-white/10 text-white text-xs px-3 py-1 rounded-full">👤 {ownerUser.first_name} {ownerUser.last_name}</span>}
            </div>
            <p className="text-blue-300 text-sm mt-1 flex items-center gap-2 flex-wrap">
                {record.displayNumber && (
                  <span className="bg-blue-600 text-white font-mono font-bold px-3 py-0.5 rounded-full text-xs tracking-wider shadow-sm">
                    {formatDisplayNumber(PAGE_DISPLAY_PREFIX[page]||'REC', record.displayNumber)}
                  </span>
                )}
                <span>{getPageLabel(page)}</span>
                {edited.quote_number && <span className="text-blue-400 text-xs">· From a Quotation</span>}
              </p>
          </div>
          <div className="flex items-center gap-2">
            {showEwayBillButton && (
              <button onClick={()=>setShowEwayBill(true)} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold">🚚 E-Way Bill</button>
            )}
            {page==='orders' && <button onClick={()=>setShowInvoiceModal(true)} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold">🧾 {L('Create Invoice')}</button>}
            {page==='invoices' && <button onClick={async()=>{
              setPrintingInvoice(true);
              try {
                const template = (invoiceTemplates||[]).find(t=>t.isDefault) || (invoiceTemplates||[])[0];
                if (!template) { showAlert('No invoice template found. Create one in Admin Tools → B2B Enterprise → Invoice Templates.', { variant:'warning' }); return; }
                if (!supabase) return;
                const { data: liData } = await supabase.from('invoice_line_items').select('*').eq('invoice_number', record.id).order('sort_order');
                const oUser = enterpriseUsers.find(u=>u.id===edited.owner_id||u.email===edited.owner);
                const rec = { ...edited, owner_display: oUser?`${oUser.first_name} ${oUser.last_name}`:(edited.owner||'') };
                const html = buildInvoiceHTML(rec, liData||[], template, products);
                let iframe = document.getElementById('pdf-preview-frame');
                if (!iframe) { iframe=document.createElement('iframe'); iframe.id='pdf-preview-frame'; iframe.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:9999;background:white;'; document.body.appendChild(iframe); }
                iframe.srcdoc=html; iframe.style.display='block';
                ['pdf-close-btn','pdf-print-btn'].forEach(id=>{ let el=document.getElementById(id); if(el){el.style.display='block';}});
                if (!document.getElementById('pdf-close-btn')) {
                  const cb=document.createElement('button'); cb.id='pdf-close-btn'; cb.textContent='✕ Close Preview'; cb.style.cssText='position:fixed;top:16px;right:16px;z-index:10000;background:#0F172A;color:white;border:none;padding:10px 20px;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer;'; cb.onclick=()=>{iframe.style.display='none';cb.style.display='none';pb.style.display='none';}; document.body.appendChild(cb);
                  const pb=document.createElement('button'); pb.id='pdf-print-btn'; pb.textContent='🖨️ Print / Save PDF'; pb.style.cssText='position:fixed;top:16px;right:180px;z-index:10000;background:#16A34A;color:white;border:none;padding:10px 20px;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer;'; pb.onclick=()=>{iframe.contentWindow?.focus();iframe.contentWindow?.print();}; document.body.appendChild(pb);
                }
              } catch(e){showAlert('PDF error: '+e.message, { variant:'danger', title:'PDF Generation Failed' });} finally{setPrintingInvoice(false);}
            }} disabled={printingInvoice} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
              {printingInvoice?'⏳':'🖨️'} {printingInvoice?'Generating...':'PDF Preview'}
            </button>}
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg">✕</button>
          </div>
        </div>

        {/* Create Invoice (supports partial invoicing) */}
        {page==='orders' && (
          <BalanceConversionModal
            open={showInvoiceModal}
            onClose={()=>setShowInvoiceModal(false)}
            onConfirm={async (selections) => {
              setCreatingInvoice(true);
              const result = await createInvoiceFromOrder(record, selections);
              setCreatingInvoice(false);
              setShowInvoiceModal(false);
              if (result) onClose();
            }}
            title={L("Create Invoice")}
            confirmLabel={L("Create Invoice")} confirmClass="bg-green-600 hover:bg-green-700"
            items={items} doneField="invoiced_qty" priceField="price" currency={edited.currency||'INR'}
            submitting={creatingInvoice}
          />
        )}

        {showEwayBill && (
          <EwayBillModal page={page} record={{ ...record, ...edited }} onClose={()=>setShowEwayBill(false)} />
        )}

        {/* Top action bar */}
        <div className="bg-white border-b border-blue-100 px-8 py-3 flex items-center justify-between flex-shrink-0">
          <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0F172A] font-semibold">← Back to list</button>
          <div className="flex items-center gap-3">
            {saveSuccess && <span className="text-green-600 text-sm font-semibold">✓ Saved</span>}
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">{t(lang,'cancel')}</button>
            {matchingProcess && !['Pending Approval','Approved'].includes(edited.status) && (
              <button onClick={async()=>{setSubmitting(true);await submitForApproval(page,record.id,record.name||record.order_number||record.invoice_number,matchingProcess);setSubmitting(false);setEdited(p=>({...p,status:'Pending Approval'}));setMatchingProcess(null);}} disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 shadow">
                {submitting?'Submitting…':'📋 Submit for Approval'}
                <span className="bg-purple-300 text-purple-900 text-xs px-2 py-0.5 rounded-full">{matchingProcess?.name}</span>
              </button>
            )}
            <button onClick={()=>handleSave(false)} disabled={saving} className="px-4 py-2 text-sm rounded-xl font-semibold bg-blue-100 hover:bg-blue-200 text-blue-700 disabled:opacity-50">{saving?t(lang,'loading'):t(lang,'saveChanges')}</button>
            <button onClick={()=>handleSave(true)} disabled={saving} className="px-5 py-2 text-sm rounded-xl font-semibold bg-gradient-to-r from-[#0F172A] to-blue-800 text-white hover:opacity-90 disabled:opacity-50 shadow-md">{saving?t(lang,'loading'):t(lang,'saveClose')}</button>
          </div>
        </div>

        {!loading && (
          <RecordHighlights items={[
            ['customer','Customer',edited.customer||edited.customer_name],
            [page==='orders'?'deliveryDate':'dueDate',page==='orders'?'Delivery Date':'Due Date',edited.deliveryDate||edited.delivery_date||edited.dueDate||edited.due_date],
            ['currency','Currency',edited.currency||appPreferences?.default_currency||'INR'],
          ].map(([k,l,v])=>{const r=FL(k,l,0);return r.hidden?null:{label:r.label,value:v};}).filter(Boolean).concat([
            {label:'Line Items',value:String(items.length)},
            {label:'Grand Total',value:fmt(grandTotal)},
          ])}/>
        )}
        {/* Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400"><div className="text-4xl animate-pulse">{pageIcon}</div></div>
        ) : (
          <div className="flex-1 overflow-y-auto bg-gradient-to-br from-white to-blue-50">
            {/* ── Approval Banner ── */}
            {edited.status === 'Pending Approval' && (
              <div className="px-6 pt-5">
                <ApprovalBanner recordId={record.id} recordType={page} onDecision={async()=>{
                  const tbl=page==='orders'?'orders':'invoices';
                  const idField=page==='orders'?'order_number':'invoice_number';
                  const{data:fresh}=await supabase.from(tbl).select('status').eq(idField,record.id).maybeSingle();
                  if(fresh?.status) setEdited(p=>({...p,status:fresh.status}));
                  const proc=await checkMatchingApprovalProcess(page,{...edited});
                  setMatchingProcess(proc);
                }}/>
              </div>
            )}
            <div className="p-8 space-y-6">

            {/* AI Summary */}
            <AISummary page={page} record={record}/>

            {/* Status + Core Fields — driven by the Page Layout Designer (label / hidden / read-only / order) */}
            {(() => {
              const dateKey = page==='orders' ? 'deliveryDate' : 'dueDate';
              const cards = [
                { k:'status', def:'Status', node:(lb)=>(<>
                    <label className={lblCls}>{lb}</label>
                    <select value={edited.status||''} onChange={async e=>{
                      const newStatus = e.target.value;
                      if (newStatus === edited.status) return;
                      const ok = await showConfirm(`Change status from "${edited.status||'—'}" to "${newStatus}"?`, { title:'Confirm Status Change', variant:'warning', confirmLabel:'Change Status' });
                      if (ok) s('status', newStatus);
                    }} className={sCls}>
                      {statusOpts.map(st=><option key={st}>{st}</option>)}
                    </select></>) },
                { k:'customer', def:'Customer', node:(lb)=>(<>
                    <label className={lblCls}>{lb}</label>
                    <SearchableSelect
                      value={edited.customerId||edited.customer_id||''}
                      onChange={v=>{const c=customers.find(x=>x.id===v);setEdited(p=>({...p,customerId:c?.id||'',customer_id:c?.id||'',customer:c?.name||''}));}}
                      options={customers.map(c=>({value:c.id,label:c.name,sub:[c.email,c.phone,c.industry,c.city].filter(Boolean).join(' · ')}))}
                      placeholder="Select customer" emptyLabel="No customer"
                      onCreateNew={q=>setQuickCreate({type:'customer',prefillName:q,onCreated:(id,name)=>{setEdited(p=>({...p,customerId:id,customer_id:id,customer:name}))}})}
                      createLabel="Create Customer"
                    /></>) },
                { k:'contact', def:'Contact', node:(lb)=>(<>
                    <label className={lblCls}>{lb}</label>
                    <SearchableSelect
                      value={edited.contactId||edited.contact_id||''}
                      onChange={v=>{const c=contacts.find(x=>x.id===v);setEdited(p=>({...p,contactId:c?.id||'',contact_id:c?.id||'',contact:c?.name||''}));}}
                      options={contacts.map(c=>({value:c.id,label:c.name,sub:[c.email,c.phone,c.designation,c.customer].filter(Boolean).join(' · ')}))}
                      placeholder="Select contact" emptyLabel="No contact"
                      onCreateNew={q=>setQuickCreate({type:'contact',prefillName:q,onCreated:(id,name)=>{setEdited(p=>({...p,contactId:id,contact_id:id,contact:name}))}})}
                      createLabel="Create Contact"
                    /></>) },
                { k:'currency', def:'Currency', node:(lb)=>(<>
                    <label className={lblCls}>{lb}</label>
                    <select value={edited.currency||'INR'} onChange={e=>s('currency',e.target.value)} className={sCls}>
                      {CURRENCIES.map(c=><option key={c}>{c}</option>)}
                    </select></>) },
                { k:'paymentTerms', def:'Payment Terms', node:(lb)=>(<>
                    <label className={lblCls}>{lb}</label>
                    <select value={edited.payment_terms||edited.paymentTerms||''} onChange={e=>s('payment_terms',e.target.value)} className={sCls}>
                      <option value="">Select</option>{['Due on Receipt','Net 15','Net 30','Net 45','Net 60'].map(o=><option key={o}>{o}</option>)}
                    </select></>) },
                { k:dateKey, def:page==='orders'?'Delivery Date':'Due Date', node:(lb)=>(<>
                    <label className={lblCls}>{lb}</label>
                    <input type="date" value={edited.deliveryDate||edited.delivery_date||edited.dueDate||edited.due_date||''} onChange={e=>s(page==='orders'?'deliveryDate':'dueDate',e.target.value)} className={iCls}/></>) },
                { k:'owner', def:'Owner', node:(lb)=>(<>
                    <label className={lblCls}>{lb}</label>
                    <SearchableSelect
                      value={edited.owner_id||''}
                      onChange={v=>{const u=enterpriseUsers.find(x=>x.id===v);setEdited(p=>({...p,owner_id:u?.id||'',owner:u?.email||''}));}}
                      options={enterpriseUsers.map(u=>({value:u.id,label:`${u.first_name||''} ${u.last_name||''}`.trim(),sub:u.designation||u.email||''}))}
                      placeholder="Select owner" emptyLabel="Unassigned"
                    /></>) },
              ].map((c, i) => ({ ...c, ...FL(c.k, c.def, i) }));
              // App Composer custom fields (header) — previously not shown on CPQ order/invoice at all
              const cfCards = (headerCF || []).filter(cf => cf.show_on !== 'create').map((cf, i) => {
                const f = FL(cfKey(cf.api_name), cf.label, 100 + (cf.sort_order || i));
                const val = (edited.custom_data || {})[cf.api_name];
                const setVal = (v) => setEdited(p => ({ ...p, custom_data: { ...(p.custom_data || {}), [cf.api_name]: v } }));
                return { ...f, k: cfKey(cf.api_name), cf, node: (lb) => (<>
                  {cf.field_type !== 'checkbox' && <label className={lblCls}>{lb}{cf.required && <span className="text-red-400 ml-1">*</span>}</label>}
                  {cf.field_type==='single_select'
                    ? <select value={val||''} onChange={e=>setVal(e.target.value)} className={sCls}><option value="">Select {lb}...</option>{(cf.options||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>
                    : cf.field_type==='multi_select'
                    ? <div className="space-y-1.5">{(cf.options||[]).map(o=>(<label key={o} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" checked={(val||'').split('||').includes(o)} onChange={e=>{const cur=(val||'').split('||').filter(Boolean);const nxt=e.target.checked?[...cur,o]:cur.filter(x=>x!==o);setVal(nxt.join('||'));}}/><span className="text-sm text-[#0F172A]">{o}</span></label>))}</div>
                    : cf.field_type==='checkbox'
                    ? <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" checked={!!val} onChange={e=>setVal(e.target.checked)}/><span className="text-sm font-semibold text-[#0F172A]">{lb}</span></label>
                    : <input type={cf.field_type==='number'||cf.field_type==='currency'?'number':cf.field_type==='date'?'date':cf.field_type==='datetime'?'datetime-local':cf.field_type==='email'?'email':cf.field_type==='url'?'url':'text'} value={val||''} onChange={e=>setVal(e.target.value)} placeholder={lb} className={iCls}/>}
                </>) };
              });
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[...cards, ...cfCards].filter(c => !c.hidden).map(c => (
                    <fieldset key={c.k} disabled={c.ro} title={c.ro ? 'Read-only (Page Layout Designer)' : undefined} style={{ order: c.order }} className={`${cardCls} ${c.ro?'opacity-70':''} ${c.cf?.field_type==='multi_select'?'md:col-span-2':''}`}>
                      {c.node(c.label)}
                    </fieldset>
                  ))}
                </div>
              );
            })()}

            {/* Addresses — also layout-driven */}
            {(() => {
              const b = FL('billingAddress', 'Billing Address', 0), sh = FL('shippingAddress', 'Shipping Address', 1);
              if (b.hidden && sh.hidden) return null;
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {!b.hidden && (
                    <fieldset disabled={b.ro} style={{ order: b.order }} className={`${cardCls} ${b.ro?'opacity-70':''}`}>
                      <AddressSelector
                        customerId={edited.customerId||edited.customer_id}
                        value={edited.billing_address||edited.billingAddress||''}
                        onChange={v=>s('billing_address',v)}
                        label={b.label}
                        placeholder="Select saved billing address or type"
                      />
                    </fieldset>
                  )}
                  {!sh.hidden && (
                    <fieldset disabled={sh.ro} style={{ order: sh.order }} className={`${cardCls} ${sh.ro?'opacity-70':''}`}>
                      <AddressSelector
                        customerId={edited.customerId||edited.customer_id}
                        value={edited.shipping_address||edited.shippingAddress||''}
                        onChange={v=>s('shipping_address',v)}
                        label={sh.label}
                        placeholder="Select saved shipping address or type"
                      />
                    </fieldset>
                  )}
                </div>
              );
            })()}

            {/* Line Items */}
            <CPQLineItems items={items} setItems={setItems} products={products} currency={edited.currency||appPreferences?.default_currency||'INR'} page={page}/>

            {/* Charges + Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(()=>{
                const od=FL('overall_discount','Overall Discount (%)',0), sc=FL('shipping_cost','Shipping Cost',1);
                if(od.hidden&&sc.hidden) return <div/>;
                return (
              <div className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-[#0F172A]">Additional Charges</h3>
                {!od.hidden && <fieldset disabled={od.ro} className="contents"><div><label className="text-xs font-bold uppercase text-gray-400 block mb-2">{od.label}</label><input type="number" min={0} max={100} value={edited.overall_discount||0} onChange={e=>s('overall_discount',e.target.value)} className={iCls}/></div></fieldset>}
                {!sc.hidden && <fieldset disabled={sc.ro} className="contents"><div><label className="text-xs font-bold uppercase text-gray-400 block mb-2">{sc.label}</label><input type="number" min={0} value={edited.shipping_cost||0} onChange={e=>s('shipping_cost',e.target.value)} className={iCls}/></div></fieldset>}
              </div>
                );
              })()}
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
            {(()=>{ const nf=FL('notes','Notes',2); if(nf.hidden) return null; return (
            <fieldset disabled={nf.ro} className="contents"><div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">{nf.label}</label>
              <textarea rows={3} value={edited.notes||''} onChange={e=>s('notes',e.target.value)} className={tCls} placeholder="Order notes..."/>
            </div></fieldset>); })()}

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
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-4 border-t border-blue-100 bg-white flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-gray-400">{items.length} line item{items.length!==1?'s':''} · GT: <span className="font-bold text-[#0F172A]">{fmt(grandTotal)}</span></div>
          <div className="text-sm text-gray-400">{items.length} line item{items.length!==1?'s':''} · GT: <span className="font-bold text-[#0F172A]">{fmt(grandTotal)}</span></div>
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
    </div>
  );
}
