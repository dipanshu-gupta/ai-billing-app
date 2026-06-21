// @ts-nocheck
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { getStatusColor, formatCurrency } from '@/lib/utils';
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
      { icon:'🧑', title:'Basic Info', fields:[
        { key:'name', label:'Full Name', type:'text', required:true },
        { key:'phone', label:'Phone', type:'tel' },
        { key:'email', label:'Email', type:'email' },
        { key:'date_of_birth', label:'Date of Birth', type:'date' },
        { key:'gender', label:'Gender', type:'select', opts:['Male','Female','Other','Prefer not to say'] },
      ]},
      { icon:'📍', title:'Address', fields:[
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
        { key:'status', label:'Status', type:'status' },
        { key:'owner', label:'Owner', type:'owner' },
      ]},
      { icon:'💬', title:'Notes', fields:[
        { key:'notes', label:'Notes', type:'textarea', full:true },
        { key:'comments', label:'Comments', type:'textarea', full:true },
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
      { icon:'🏷️', title:'Basic Info', fields:[
        { key:'name', label:'Product Name', type:'text', required:true },
        { key:'category', label:'Category', type:'text' },
        { key:'brand', label:'Brand', type:'text' },
        { key:'sku', label:'SKU', type:'text' },
        { key:'barcode', label:'Barcode', type:'text' },
        { key:'unit', label:'Unit', type:'select', opts:['pc','kg','g','ltr','ml','box','pack','dozen'] },
      ]},
      { icon:'💰', title:'Pricing & Stock', fields:[
        { key:'price', label:'Selling Price', type:'number' },
        { key:'mrp', label:'MRP', type:'number' },
        { key:'cost', label:'Cost Price', type:'number' },
        { key:'stock_quantity', label:'Stock Quantity', type:'number' },
        { key:'reorder_level', label:'Reorder Level', type:'number' },
        { key:'status', label:'Status', type:'status' },
      ]},
      { icon:'🧾', title:'Tax Information', fields: 'TAX_PRODUCT' },
      { icon:'📝', title:'Description', fields:[
        { key:'description', label:'Description', type:'textarea', full:true },
        { key:'owner', label:'Owner', type:'owner' },
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
      { icon:'📅', title:'Activity Info', fields:[
        { key:'subject', label:'Subject', type:'text', required:true },
        { key:'activity_type', label:'Type', type:'select', opts:['Visit','Call','WhatsApp','Complaint','Feedback','Service'] },
        { key:'customer_id', label:'Customer', type:'retailCustomer' },
        { key:'activity_date', label:'Activity Date', type:'date' },
        { key:'due_date', label:'Due Date', type:'date' },
        { key:'priority', label:'Priority', type:'select', opts:['Low','Medium','High','Critical'] },
        { key:'status', label:'Status', type:'status' },
        { key:'owner', label:'Owner', type:'owner' },
      ]},
      { icon:'💬', title:'Notes', fields:[
        { key:'description', label:'Description', type:'textarea', full:true },
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
      { h: 'Order #', v: r => r.order_number, mono:true },
      { h: 'Customer', v: r => r.customer || '-' },
      { h: 'Channel', v: r => r.channel || '-' },
      { h: 'Date', v: r => r.order_date || '-' },
      { h: 'Total', v: r => formatCurrency(r.amount||0), align:'right' },
    ],
    searchFields: ['order_number','customer','customer_phone'],
    sections: [
      { icon:'🛍️', title:'Order Info', fields:[
        { key:'customer_id', label:'Customer', type:'retailCustomer' },
        { key:'customer_phone', label:'Customer Phone', type:'tel' },
        { key:'order_date', label:'Order Date', type:'date' },
        { key:'channel', label:'Channel', type:'select', opts:['In-Store','Online','Phone','WhatsApp'] },
        { key:'currency', label:'Currency', type:'select', opts:['INR','USD','GBP','EUR','AED','SGD'] },
        { key:'status', label:'Status', type:'status' },
      ]},
      { icon:'💳', title:'Payment & Delivery', fields:[
        { key:'payment_method', label:'Payment Method', type:'select', opts:['Cash','Card','UPI','Net Banking','Wallet','COD'] },
        { key:'payment_status', label:'Payment Status', type:'select', opts:['Paid','Pending','Partially Paid','Refunded'] },
        { key:'delivery_method', label:'Delivery Method', type:'select', opts:['Pickup','Home Delivery','Courier'] },
        { key:'delivery_date', label:'Delivery Date', type:'date' },
        { key:'delivery_address', label:'Delivery Address', type:'textarea', full:true },
        { key:'owner', label:'Owner', type:'owner' },
      ]},
      { icon:'🧾', title:'Tax Information', fields: 'TAX_DOCUMENT' },
      { icon:'💬', title:'Notes', fields:[
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
      { h: 'Invoice #', v: r => r.invoice_number, mono:true },
      { h: 'Customer', v: r => r.customer || '-' },
      { h: 'Order #', v: r => r.order_number || '-', mono:true },
      { h: 'Date', v: r => r.invoice_date || '-' },
      { h: 'Total', v: r => formatCurrency(r.amount||0), align:'right' },
    ],
    searchFields: ['invoice_number','customer','order_number'],
    sections: [
      { icon:'🧾', title:'Invoice Info', fields:[
        { key:'customer_id', label:'Customer', type:'retailCustomer' },
        { key:'customer_phone', label:'Customer Phone', type:'tel' },
        { key:'order_number', label:'Linked Order #', type:'text', readOnly:true },
        { key:'invoice_date', label:'Invoice Date', type:'date' },
        { key:'due_date', label:'Due Date', type:'date' },
        { key:'currency', label:'Currency', type:'select', opts:['INR','USD','GBP','EUR','AED','SGD'] },
        { key:'status', label:'Status', type:'status' },
      ]},
      { icon:'💳', title:'Payment', fields:[
        { key:'payment_method', label:'Payment Method', type:'select', opts:['Cash','Card','UPI','Net Banking','Wallet','COD'] },
        { key:'payment_status', label:'Payment Status', type:'select', opts:['Paid','Pending','Partially Paid','Refunded'] },
        { key:'owner', label:'Owner', type:'owner' },
      ]},
      { icon:'🧾', title:'Tax Information', fields: 'TAX_DOCUMENT' },
      { icon:'💬', title:'Notes', fields:[
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
        <table className="w-full text-xs" style={{overflowY:'visible'}}>
          <thead><tr className="bg-blue-50 border-b border-blue-100">
            {['Product','Qty','Unit Price','Disc %', ...taxCols.map(t=>t.label), 'Extended',''].map(h=>
              <th key={h} className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase whitespace-nowrap">{h}</th>
            )}
          </tr></thead>
          <tbody>
            {items.length===0
              ? <tr><td colSpan={6+taxCols.length} className="px-5 py-8 text-center text-gray-400">No items. Click + Add Item.</td></tr>
              : items.map((row,idx)=>(
                <tr key={row._id??idx} className="border-t border-blue-50 hover:bg-blue-50/30">
                  <td className="px-3 py-2" style={{minWidth:200, position:'relative', zIndex: items.length - idx + 10}}>
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
      {items.length>0 && (
        <div className="px-5 py-4 border-t border-blue-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><div className="text-gray-400 text-xs uppercase font-bold">Subtotal</div><div className="font-bold text-[#0F172A]">{formatCurrency(subtotal)}</div></div>
          <div><div className="text-gray-400 text-xs uppercase font-bold">Discount</div><div className="font-bold text-red-500">-{formatCurrency(totalDisc)}</div></div>
          <div><div className="text-gray-400 text-xs uppercase font-bold">{taxRegime.shortLabel}</div><div className="font-bold text-[#0F172A]">{formatCurrency(totalTax)}</div></div>
          <div><div className="text-gray-400 text-xs uppercase font-bold">Grand Total</div><div className="font-bold text-blue-700 text-base">{formatCurrency(grandTotal)}</div></div>
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
    let payload = { ...edited };
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

  return (
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
            <p className="text-blue-300 text-xs mt-1 font-mono">{edited[cfg.idField]}</p>
          </div>
          <div className="flex items-center gap-2">
            {saveSuccess && <span className="text-green-300 text-sm font-semibold mr-2">✓ Saved</span>}
            {page==='retailOrders' && edited.status==='Completed' && (
              <button onClick={handleCreateInvoice} disabled={creatingInvoice}
                className="bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-600 disabled:opacity-50">
                {creatingInvoice?'Creating...':'🧾 Create Invoice'}
              </button>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

          {/* Line items for Orders/Invoices */}
          {cfg.hasLineItems && (
            loadingLI
              ? <div className="bg-white rounded-[20px] border border-blue-100 shadow p-8 text-center text-gray-400">Loading line items...</div>
              : <RetailLineItems items={items} setItems={setItems} products={retailProducts} taxRegime={taxRegime}/>
          )}

          {/* Delete */}
          <div className="flex justify-end">
            <button onClick={async()=>{ await deleteRetailRecord(page, edited.id); onSaved?.(); handleClose(); }}
              className="text-red-500 hover:text-red-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-red-50">
              🗑️ Delete {cfg.singular}
            </button>
          </div>
        </div>
      </div>
    </div>
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
                          ? <button onClick={()=>setSelectedRecord(r)} className="font-semibold text-[#0F172A] hover:text-blue-700 hover:underline text-left">{c.v(r)}</button>
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
