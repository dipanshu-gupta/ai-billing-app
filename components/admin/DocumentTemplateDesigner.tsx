// @ts-nocheck
'use client';
import React from 'react';

import { useState, useRef, useCallback } from 'react';
import { useApp } from '@/context/AppContext';

// ─── Shared constants ─────────────────────────────────────────────────────────
const FONTS = [
  { v:'Arial, sans-serif',              l:'Arial' },
  { v:"'Helvetica Neue', sans-serif",   l:'Helvetica Neue' },
  { v:"'Times New Roman', serif",       l:'Times New Roman' },
  { v:'Georgia, serif',                 l:'Georgia' },
  { v:"'Gill Sans', sans-serif",        l:'Gill Sans' },
  { v:"'Trebuchet MS', sans-serif",     l:'Trebuchet MS' },
  { v:"'Courier New', monospace",       l:'Courier New' },
];
const PAPER_SIZES = ['A4','A5','Letter','Legal','Thermal 80mm','Thermal 58mm','Thermal 57mm'];
const PAPER_WIDTHS_MM = { 'A4':210,'A5':148,'Letter':216,'Legal':216,'Thermal 80mm':80,'Thermal 58mm':58,'Thermal 57mm':57 };
const PAPER_HEIGHTS_MM = { 'A4':297,'A5':210,'Letter':279,'Legal':356,'Thermal 80mm':null,'Thermal 58mm':null,'Thermal 57mm':null }; // null = continuous roll
const LOGO_POSITIONS = ['left','center','right'];
const WATERMARKS = ['','DRAFT','CONFIDENTIAL','SAMPLE','VOID','FOR APPROVAL'];

// ─── Default sections per document type ──────────────────────────────────────
const QUOTE_SECTIONS = [
  { id:'cover',      type:'cover',      name:'Cover Page',         enabled:false, order:0,
    settings:{ bgColor:'#0F172A', textColor:'#FFFFFF', headline:'QUOTATION', subheadline:'Thank you for your interest', showLogo:true, logoUrl:'', bgImage:'' } },
  { id:'header',     type:'header',     name:'Header',             enabled:true,  order:1,
    settings:{ bgColor:'#0F172A', textColor:'#FFFFFF', logoUrl:'', logoPosition:'left', logoHeight:48,
               showCompanyName:true, companyName:'Umbrella Suite', tagline:'Enterprise Solutions',
               showAddress:false, address:'', phone:'', email:'', gstIn:'',
               accentLine:true, accentColor:'#3B82F6' } },
  { id:'doc_info',   type:'doc_info',   name:'Document Info Bar',  enabled:true,  order:2,
    settings:{ bgColor:'#F8FAFC', textColor:'#0F172A', borderColor:'#E2E8F0',
               fields:['quote_number','date','valid_until','version','currency','payment_terms'] } },
  { id:'parties',    type:'parties',    name:'Bill To / Ship To',  enabled:true,  order:3,
    settings:{ bgColor:'#FFFFFF', textColor:'#0F172A', showBillTo:true, showShipTo:true,
               showContact:true, showGSTIN:true, labelColor:'#64748B', borderColor:'#E2E8F0' } },
  { id:'intro',      type:'text_block', name:'Introduction Text',  enabled:false, order:4,
    settings:{ bgColor:'#FFFFFF', textColor:'#374151', content:'Dear valued customer,\n\nThank you for the opportunity to present this quotation. Please review the details below and do not hesitate to contact us for any clarifications.', fontSize:11, padding:16 } },
  { id:'items',      type:'items',      name:'Line Items Table',   enabled:true,  order:5,
    settings:{ headerBgColor:'#0F172A', headerTextColor:'#FFFFFF', altRowColor:'#F8FAFC',
               borderColor:'#E2E8F0', fontSize:11,
               columns:['sno','name','description','hsn','sku','qty','unit','unit_price','discount','tax','amount'],
               columnLabels:{ sno:'#', name:'Product / Service', description:'Description', hsn:'HSN/SAC', sku:'SKU', qty:'Qty', unit:'Unit', unit_price:'Unit Price', discount:'Disc %', tax:'Tax %', amount:'Amount' },
               showColumnBorders:true } },
  { id:'totals',     type:'totals',     name:'Pricing Summary',    enabled:true,  order:6,
    settings:{ bgColor:'#F8FAFC', accentBgColor:'#0F172A', accentTextColor:'#FFFFFF',
               borderColor:'#E2E8F0', showSubtotal:true, showDiscount:true,
               showTaxBreakdown:true, showShipping:false, shippingLabel:'Shipping & Handling',
               showRoundOff:false, showAmountWords:true, amountWordsLabel:'Amount in Words' } },
  { id:'notes',      type:'text_block', name:'Notes & Remarks',    enabled:true,  order:7,
    settings:{ bgColor:'#FFFBEB', textColor:'#92400E', content:'Note: Prices are valid for the duration specified. GST will be charged as applicable.', fontSize:10, padding:12, borderLeft:'4px solid #F59E0B' } },
  { id:'terms',      type:'terms',      name:'Terms & Conditions', enabled:true,  order:8,
    settings:{ bgColor:'#FFFFFF', textColor:'#475569', titleColor:'#0F172A',
               content:'1. Payment is due within the terms specified above.\n2. All prices are exclusive of taxes unless stated otherwise.\n3. This quotation is valid until the validity date mentioned.\n4. Delivery timelines are indicative and subject to confirmation.\n5. Disputes are subject to jurisdiction of the company\'s registered office.',
               fontSize:10, columns:1 } },
  { id:'signature',  type:'signature',  name:'Signature Block',    enabled:true,  order:9,
    settings:{ bgColor:'#FFFFFF', showPrepared:true, preparedLabel:'Prepared by', preparedName:'',
               showApproved:true, approvedLabel:'Authorized Signatory', approvedName:'',
               showStamp:true, showDate:true, lineColor:'#0F172A' } },
  { id:'footer',     type:'footer',     name:'Footer',             enabled:true,  order:10,
    settings:{ bgColor:'#0F172A', textColor:'#FFFFFF', leftText:'Umbrella Suite ERP',
               centerText:'Confidential — For recipient use only', rightText:'Page {page} of {total}',
               showDivider:true, dividerColor:'#3B82F6', fontSize:9 } },
];

const INVOICE_SECTIONS = [
  { id:'header',     type:'header',     name:'Header',             enabled:true,  order:1,
    settings:{ bgColor:'#0F172A', textColor:'#FFFFFF', logoUrl:'', logoPosition:'left', logoHeight:48,
               showCompanyName:true, companyName:'Umbrella Suite', tagline:'Enterprise Solutions',
               showAddress:true, address:'', phone:'', email:'', gstIn:'',
               accentLine:true, accentColor:'#3B82F6' } },
  { id:'doc_info',   type:'doc_info',   name:'Invoice Info Bar',   enabled:true,  order:2,
    settings:{ bgColor:'#F8FAFC', textColor:'#0F172A', borderColor:'#E2E8F0',
               fields:['invoice_number','invoice_date','due_date','po_number','payment_terms','currency'] } },
  { id:'parties',    type:'parties',    name:'Bill To / Ship To',  enabled:true,  order:3,
    settings:{ bgColor:'#FFFFFF', textColor:'#0F172A', showBillTo:true, showShipTo:true,
               showContact:true, showGSTIN:true, labelColor:'#64748B', borderColor:'#E2E8F0' } },
  { id:'items',      type:'items',      name:'Line Items Table',   enabled:true,  order:4,
    settings:{ headerBgColor:'#0F172A', headerTextColor:'#FFFFFF', altRowColor:'#F8FAFC',
               borderColor:'#E2E8F0', fontSize:11,
               columns:['sno','name','hsn','qty','unit','unit_price','discount','tax','cgst','sgst','igst','amount'],
               columnLabels:{ sno:'#', name:'Item', hsn:'HSN/SAC', qty:'Qty', unit:'Unit', unit_price:'Rate', discount:'Disc%', tax:'Tax%', cgst:'CGST', sgst:'SGST', igst:'IGST', amount:'Amount' },
               showColumnBorders:true } },
  { id:'totals',     type:'totals',     name:'Tax Summary & Total', enabled:true,  order:5,
    settings:{ bgColor:'#F8FAFC', accentBgColor:'#0F172A', accentTextColor:'#FFFFFF',
               borderColor:'#E2E8F0', showSubtotal:true, showDiscount:true,
               showTaxBreakdown:true, showCGST:true, showSGST:true, showIGST:false,
               showShipping:false, showRoundOff:true, showAmountWords:true,
               amountWordsLabel:'Amount in Words (INR)' } },
  { id:'bank',       type:'bank',       name:'Bank Details',       enabled:true,  order:6,
    settings:{ bgColor:'#EFF6FF', borderColor:'#BFDBFE', titleColor:'#1E40AF',
               bankName:'', accountName:'', accountNumber:'', ifscCode:'',
               branchName:'', swiftCode:'', upiId:'', showQR:false } },
  { id:'terms',      type:'terms',      name:'Terms & Conditions', enabled:true,  order:7,
    settings:{ bgColor:'#FFFFFF', textColor:'#475569', titleColor:'#0F172A',
               content:'1. Payment is due by the due date specified.\n2. Late payment attracts interest @18% p.a.\n3. Goods once sold will not be taken back without prior approval.\n4. Subject to jurisdiction of courts in the city of the company\'s registered office.',
               fontSize:10, columns:1 } },
  { id:'signature',  type:'signature',  name:'Signature Block',    enabled:true,  order:8,
    settings:{ bgColor:'#FFFFFF', showPrepared:false, preparedLabel:'Prepared by', preparedName:'',
               showApproved:true, approvedLabel:'Authorized Signatory', approvedName:'',
               showStamp:true, showDate:true, lineColor:'#0F172A' } },
  { id:'footer',     type:'footer',     name:'Footer',             enabled:true,  order:9,
    settings:{ bgColor:'#0F172A', textColor:'#FFFFFF', leftText:'Umbrella Suite ERP',
               centerText:'This is a computer generated invoice', rightText:'Page {page} of {total}',
               showDivider:true, dividerColor:'#3B82F6', fontSize:9 } },
];

const ALL_COLUMNS = {
  sno:'#', name:'Product/Service', description:'Description', hsn:'HSN/SAC', sku:'SKU',
  qty:'Qty', unit:'Unit', unit_price:'Unit Price', discount:'Disc %', tax:'Tax %',
  cgst:'CGST', sgst:'SGST', igst:'IGST', amount:'Amount',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';
const tCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none';
const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2 text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs';
const L = ({ t }) => <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">{t}</label>;

function ColorPicker({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 flex-shrink-0" style={{width:96}}>{label}</label>
      <div className="flex items-center gap-1.5 flex-1">
        <input type="color" value={value||'#000000'} onChange={e=>onChange(e.target.value)}
          className="w-7 h-7 rounded-lg border border-blue-200 cursor-pointer flex-shrink-0"/>
        <input value={value||''} onChange={e=>onChange(e.target.value)}
          className="flex-1 border border-blue-200 rounded-lg px-2 py-1 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"/>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer group">
      <div className={`relative mt-0.5 w-9 h-5 flex-shrink-0 rounded-full transition-colors ${checked?'bg-blue-600':'bg-gray-200'}`}
        onClick={()=>onChange(!checked)}>
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked?'translate-x-4':''}`}/>
      </div>
      <div>
        <span className="text-xs text-[#0F172A] font-medium">{label}</span>
        {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
      </div>
    </label>
  );
}

function LogoUploader({ logoUrl, onUrlChange, logoHeight, onHeightChange, logoPosition, onPositionChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Immediate local preview
    const reader = new FileReader();
    reader.onload = ev => onUrlChange(ev.target.result);
    reader.readAsDataURL(file);
    // Try Supabase Storage upload
    setUploading(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      if (supabase) {
        const ext  = file.name.split('.').pop();
        const path = `logos/doc-logo-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('company-assets').upload(path, file, { upsert:true, contentType:file.type });
        if (!error) {
          const { data } = supabase.storage.from('company-assets').getPublicUrl(path);
          onUrlChange(data.publicUrl + '?t=' + Date.now());
        }
      }
    } catch(e) { console.warn('Logo upload:', e); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
      <div className="font-semibold text-[#0F172A] text-xs uppercase tracking-wider">Logo</div>
      {logoUrl && (
        <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-blue-100">
          <img src={logoUrl} alt="logo" className="h-10 object-contain max-w-[120px]" onError={e=>{e.target.style.display='none'}}/>
          <button onClick={()=>onUrlChange('')} className="text-xs text-red-400 hover:text-red-600 ml-auto">✕ Remove</button>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={()=>fileRef.current?.click()} disabled={uploading}
          className="flex-1 bg-[#0F172A] text-white py-2 rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-50">
          {uploading ? '⏳ Uploading...' : '📤 Upload Logo'}
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleFile}/>
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Or paste URL</label>
        <input value={logoUrl||''} onChange={e=>onUrlChange(e.target.value)} placeholder="https://..." className={iCls}/>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Position</label>
          <select value={logoPosition||'left'} onChange={e=>onPositionChange(e.target.value)} className={sCls}>
            {LOGO_POSITIONS.map(p=><option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Height (px)</label>
          <input type="number" min={20} max={120} value={logoHeight||48} onChange={e=>onHeightChange(Number(e.target.value))} className={iCls}/>
        </div>
      </div>
    </div>
  );
}

// ─── Section Settings Panels ──────────────────────────────────────────────────
function SectionSettings({ section, onUpdate, docType }) {
  const st = section.settings || {};
  const upd = (k, v) => onUpdate({ ...section, settings: { ...st, [k]: v } });

  switch (section.type) {

    case 'cover': return (
      <div className="space-y-3 pt-1">
        <ColorPicker label="Background" value={st.bgColor} onChange={v=>upd('bgColor',v)}/>
        <ColorPicker label="Text Color"  value={st.textColor} onChange={v=>upd('textColor',v)}/>
        <div><L t="Headline"/><input value={st.headline||''} onChange={e=>upd('headline',e.target.value)} placeholder="QUOTATION" className={iCls}/></div>
        <div><L t="Sub-headline"/><input value={st.subheadline||''} onChange={e=>upd('subheadline',e.target.value)} placeholder="Thank you for your interest" className={iCls}/></div>
        <Toggle label="Show Logo on Cover" checked={!!st.showLogo} onChange={v=>upd('showLogo',v)}/>
        {st.showLogo && <LogoUploader logoUrl={st.logoUrl||''} onUrlChange={v=>upd('logoUrl',v)} logoHeight={st.logoHeight||60} onHeightChange={v=>upd('logoHeight',v)} logoPosition={st.logoPosition||'center'} onPositionChange={v=>upd('logoPosition',v)}/>}
        <div><L t="Background Image URL (optional)"/><input value={st.bgImage||''} onChange={e=>upd('bgImage',e.target.value)} placeholder="https://... (full-bleed background)" className={iCls}/></div>
      </div>
    );

    case 'header': return (
      <div className="space-y-3 pt-1">
        <ColorPicker label="Background" value={st.bgColor} onChange={v=>upd('bgColor',v)}/>
        <ColorPicker label="Text Color"  value={st.textColor} onChange={v=>upd('textColor',v)}/>
        <Toggle label="Accent Line" checked={!!st.accentLine} onChange={v=>upd('accentLine',v)} hint="Coloured line below header"/>
        {st.accentLine && <ColorPicker label="Accent Color" value={st.accentColor} onChange={v=>upd('accentColor',v)}/>}
        <LogoUploader logoUrl={st.logoUrl||''} onUrlChange={v=>upd('logoUrl',v)} logoHeight={st.logoHeight||48} onHeightChange={v=>upd('logoHeight',v)} logoPosition={st.logoPosition||'left'} onPositionChange={v=>upd('logoPosition',v)}/>
        <Toggle label="Show Company Name" checked={!!st.showCompanyName} onChange={v=>upd('showCompanyName',v)}/>
        {st.showCompanyName && <>
          <div><L t="Company Name"/><input value={st.companyName||''} onChange={e=>upd('companyName',e.target.value)} className={iCls}/></div>
          <div><L t="Tagline"/><input value={st.tagline||''} onChange={e=>upd('tagline',e.target.value)} className={iCls}/></div>
        </>}
        <Toggle label="Show Company Details" checked={!!st.showAddress} onChange={v=>upd('showAddress',v)} hint="Address, phone, email, GSTIN"/>
        {st.showAddress && <div className="space-y-2">
          <textarea rows={2} value={st.address||''} onChange={e=>upd('address',e.target.value)} placeholder="Company address" className={tCls}/>
          <div className="grid grid-cols-2 gap-2">
            <input value={st.phone||''} onChange={e=>upd('phone',e.target.value)} placeholder="Phone" className={iCls}/>
            <input value={st.email||''} onChange={e=>upd('email',e.target.value)} placeholder="Email" className={iCls}/>
          </div>
          <input value={st.gstIn||''} onChange={e=>upd('gstIn',e.target.value)} placeholder="GSTIN / VAT / Tax Reg No." className={iCls}/>
        </div>}
      </div>
    );

    case 'doc_info': return (
      <div className="space-y-3 pt-1">
        <ColorPicker label="Background"  value={st.bgColor}    onChange={v=>upd('bgColor',v)}/>
        <ColorPicker label="Text Color"  value={st.textColor}  onChange={v=>upd('textColor',v)}/>
        <ColorPicker label="Border"      value={st.borderColor} onChange={v=>upd('borderColor',v)}/>
        <div>
          <L t="Fields to show (drag to reorder)"/>
          <div className="space-y-1 mt-1">
            {(st.fields||[]).map((f,i)=>(
              <div key={f} className="flex items-center gap-2 bg-white border border-blue-100 rounded-lg px-3 py-1.5">
                <span className="text-xs text-gray-400 cursor-move">⠿</span>
                <span className="flex-1 text-xs text-[#0F172A] capitalize">{f.replace(/_/g,' ')}</span>
                <button onClick={()=>upd('fields',(st.fields||[]).filter((_,xi)=>xi!==i))} className="text-red-400 text-xs hover:text-red-600">✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <select className={sCls} onChange={e=>{if(e.target.value&&!(st.fields||[]).includes(e.target.value)){upd('fields',[...(st.fields||[]),e.target.value]);e.target.value='';}}} defaultValue="">
              <option value="">+ Add field...</option>
              {['quote_number','invoice_number','date','invoice_date','valid_until','due_date','po_number','version','currency','payment_terms','reference'].filter(f=>!(st.fields||[]).includes(f)).map(f=><option key={f} value={f}>{f.replace(/_/g,' ')}</option>)}
            </select>
          </div>
        </div>
      </div>
    );

    case 'parties': return (
      <div className="space-y-3 pt-1">
        <ColorPicker label="Background"  value={st.bgColor}     onChange={v=>upd('bgColor',v)}/>
        <ColorPicker label="Label Color" value={st.labelColor}  onChange={v=>upd('labelColor',v)}/>
        <ColorPicker label="Border"      value={st.borderColor} onChange={v=>upd('borderColor',v)}/>
        <Toggle label="Show Bill To"   checked={!!st.showBillTo}  onChange={v=>upd('showBillTo',v)}/>
        <Toggle label="Show Ship To"   checked={!!st.showShipTo}  onChange={v=>upd('showShipTo',v)}/>
        <Toggle label="Show Contact Person" checked={!!st.showContact} onChange={v=>upd('showContact',v)}/>
        <Toggle label="Show GSTIN / Tax No." checked={!!st.showGSTIN} onChange={v=>upd('showGSTIN',v)}/>
      </div>
    );

    case 'items': return (
      <div className="space-y-3 pt-1">
        <ColorPicker label="Header BG"    value={st.headerBgColor}   onChange={v=>upd('headerBgColor',v)}/>
        <ColorPicker label="Header Text"  value={st.headerTextColor} onChange={v=>upd('headerTextColor',v)}/>
        <ColorPicker label="Alt Row"      value={st.altRowColor}     onChange={v=>upd('altRowColor',v)}/>
        <ColorPicker label="Border"       value={st.borderColor}     onChange={v=>upd('borderColor',v)}/>
        <div>
          <L t="Font Size"/>
          <input type="range" min={8} max={14} value={st.fontSize||11} onChange={e=>upd('fontSize',Number(e.target.value))} className="w-full"/>
          <span className="text-xs text-gray-400">{st.fontSize||11}px</span>
        </div>
        <Toggle label="Column Borders" checked={!!st.showColumnBorders} onChange={v=>upd('showColumnBorders',v)}/>
        <div>
          <L t="Columns (check to show)"/>
          <div className="grid grid-cols-2 gap-1 mt-1">
            {Object.entries(ALL_COLUMNS).map(([k,l])=>(
              <label key={k} className="flex items-center gap-1.5 cursor-pointer py-1 px-2 hover:bg-blue-50 rounded-lg">
                <input type="checkbox" checked={(st.columns||[]).includes(k)}
                  onChange={()=>upd('columns',(st.columns||[]).includes(k)?(st.columns||[]).filter(c=>c!==k):[...(st.columns||[]),k])}
                  className="w-3.5 h-3.5 accent-blue-600"/>
                <span className="text-xs text-[#0F172A]">{l}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <L t="Column Header Labels"/>
          <div className="space-y-1 mt-1">
            {(st.columns||[]).map(k=>(
              <div key={k} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16 flex-shrink-0">{k}</span>
                <input value={(st.columnLabels||{})[k]||ALL_COLUMNS[k]||k}
                  onChange={e=>upd('columnLabels',{...(st.columnLabels||{}), [k]:e.target.value})}
                  className="flex-1 border border-blue-100 rounded-lg px-2 py-1 text-xs"/>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    case 'totals': return (
      <div className="space-y-3 pt-1">
        <ColorPicker label="Background"   value={st.bgColor}        onChange={v=>upd('bgColor',v)}/>
        <ColorPicker label="Grand Total BG" value={st.accentBgColor} onChange={v=>upd('accentBgColor',v)}/>
        <ColorPicker label="Grand Total Text" value={st.accentTextColor} onChange={v=>upd('accentTextColor',v)}/>
        <ColorPicker label="Border"       value={st.borderColor}    onChange={v=>upd('borderColor',v)}/>
        <Toggle label="Show Subtotal"      checked={!!st.showSubtotal}    onChange={v=>upd('showSubtotal',v)}/>
        <Toggle label="Show Discount"      checked={!!st.showDiscount}    onChange={v=>upd('showDiscount',v)}/>
        <Toggle label="Show Tax Breakdown" checked={!!st.showTaxBreakdown} onChange={v=>upd('showTaxBreakdown',v)}/>
        {st.showTaxBreakdown && docType==='invoice' && <>
          <Toggle label="Show CGST line"   checked={!!st.showCGST} onChange={v=>upd('showCGST',v)}/>
          <Toggle label="Show SGST line"   checked={!!st.showSGST} onChange={v=>upd('showSGST',v)}/>
          <Toggle label="Show IGST line"   checked={!!st.showIGST} onChange={v=>upd('showIGST',v)}/>
        </>}
        <Toggle label="Show Shipping"      checked={!!st.showShipping}    onChange={v=>upd('showShipping',v)}/>
        {st.showShipping && <div><L t="Shipping Label"/><input value={st.shippingLabel||'Shipping'} onChange={e=>upd('shippingLabel',e.target.value)} className={iCls}/></div>}
        <Toggle label="Show Round-Off"     checked={!!st.showRoundOff}    onChange={v=>upd('showRoundOff',v)}/>
        <Toggle label="Amount in Words"    checked={!!st.showAmountWords} onChange={v=>upd('showAmountWords',v)}/>
        {st.showAmountWords && <div><L t="Label"/><input value={st.amountWordsLabel||'Amount in Words'} onChange={e=>upd('amountWordsLabel',e.target.value)} className={iCls}/></div>}
      </div>
    );

    case 'bank': return (
      <div className="space-y-3 pt-1">
        <ColorPicker label="Background"  value={st.bgColor}     onChange={v=>upd('bgColor',v)}/>
        <ColorPicker label="Border"      value={st.borderColor} onChange={v=>upd('borderColor',v)}/>
        <ColorPicker label="Title Color" value={st.titleColor}  onChange={v=>upd('titleColor',v)}/>
        <div className="grid grid-cols-2 gap-2">
          <div><L t="Bank Name"/><input value={st.bankName||''} onChange={e=>upd('bankName',e.target.value)} className={iCls}/></div>
          <div><L t="Account Name"/><input value={st.accountName||''} onChange={e=>upd('accountName',e.target.value)} className={iCls}/></div>
          <div><L t="Account Number"/><input value={st.accountNumber||''} onChange={e=>upd('accountNumber',e.target.value)} className={iCls}/></div>
          <div><L t="IFSC / SWIFT"/><input value={st.ifscCode||''} onChange={e=>upd('ifscCode',e.target.value)} className={iCls}/></div>
          <div><L t="Branch"/><input value={st.branchName||''} onChange={e=>upd('branchName',e.target.value)} className={iCls}/></div>
          <div><L t="UPI ID"/><input value={st.upiId||''} onChange={e=>upd('upiId',e.target.value)} className={iCls}/></div>
        </div>
        <Toggle label="Show QR Code placeholder" checked={!!st.showQR} onChange={v=>upd('showQR',v)}/>
      </div>
    );

    case 'text_block': return (
      <div className="space-y-3 pt-1">
        <ColorPicker label="Background" value={st.bgColor}   onChange={v=>upd('bgColor',v)}/>
        <ColorPicker label="Text Color" value={st.textColor} onChange={v=>upd('textColor',v)}/>
        <div><L t="Content"/><textarea rows={5} value={st.content||''} onChange={e=>upd('content',e.target.value)} className={tCls}/></div>
        <div className="grid grid-cols-2 gap-2">
          <div><L t="Font Size (px)"/><input type="number" min={8} max={18} value={st.fontSize||11} onChange={e=>upd('fontSize',Number(e.target.value))} className={iCls}/></div>
          <div><L t="Padding (px)"/><input type="number" min={0} max={40} value={st.padding||12} onChange={e=>upd('padding',Number(e.target.value))} className={iCls}/></div>
        </div>
        <div><L t="Left Border (e.g. 4px solid #F59E0B)"/><input value={st.borderLeft||''} onChange={e=>upd('borderLeft',e.target.value)} placeholder="4px solid #F59E0B" className={iCls}/></div>
      </div>
    );

    case 'terms': return (
      <div className="space-y-3 pt-1">
        <ColorPicker label="Background"  value={st.bgColor}    onChange={v=>upd('bgColor',v)}/>
        <ColorPicker label="Text Color"  value={st.textColor}  onChange={v=>upd('textColor',v)}/>
        <ColorPicker label="Title Color" value={st.titleColor} onChange={v=>upd('titleColor',v)}/>
        <div><L t="Terms Content"/><textarea rows={8} value={st.content||''} onChange={e=>upd('content',e.target.value)} className={tCls}/></div>
        <div className="grid grid-cols-2 gap-2">
          <div><L t="Font Size"/><input type="number" min={8} max={14} value={st.fontSize||10} onChange={e=>upd('fontSize',Number(e.target.value))} className={iCls}/></div>
          <div><L t="Columns"/><select value={st.columns||1} onChange={e=>upd('columns',Number(e.target.value))} className={sCls}><option value={1}>1 Column</option><option value={2}>2 Columns</option></select></div>
        </div>
      </div>
    );

    case 'signature': return (
      <div className="space-y-3 pt-1">
        <ColorPicker label="Background"  value={st.bgColor}   onChange={v=>upd('bgColor',v)}/>
        <ColorPicker label="Line Color"  value={st.lineColor} onChange={v=>upd('lineColor',v)}/>
        <Toggle label="Show Prepared By" checked={!!st.showPrepared} onChange={v=>upd('showPrepared',v)}/>
        {st.showPrepared && <div className="grid grid-cols-2 gap-2">
          <div><L t="Label"/><input value={st.preparedLabel||'Prepared by'} onChange={e=>upd('preparedLabel',e.target.value)} className={iCls}/></div>
          <div><L t="Name (pre-fill)"/><input value={st.preparedName||''} onChange={e=>upd('preparedName',e.target.value)} placeholder="Auto from user" className={iCls}/></div>
        </div>}
        <Toggle label="Show Authorized Signatory" checked={!!st.showApproved} onChange={v=>upd('showApproved',v)}/>
        {st.showApproved && <div className="grid grid-cols-2 gap-2">
          <div><L t="Label"/><input value={st.approvedLabel||'Authorized Signatory'} onChange={e=>upd('approvedLabel',e.target.value)} className={iCls}/></div>
          <div><L t="Name (pre-fill)"/><input value={st.approvedName||''} onChange={e=>upd('approvedName',e.target.value)} placeholder="Leave blank" className={iCls}/></div>
        </div>}
        <Toggle label="Show Stamp Area"  checked={!!st.showStamp} onChange={v=>upd('showStamp',v)}/>
        <Toggle label="Show Date Line"   checked={!!st.showDate}  onChange={v=>upd('showDate',v)}/>
      </div>
    );

    case 'footer': return (
      <div className="space-y-3 pt-1">
        <ColorPicker label="Background" value={st.bgColor}     onChange={v=>upd('bgColor',v)}/>
        <ColorPicker label="Text Color" value={st.textColor}   onChange={v=>upd('textColor',v)}/>
        <Toggle label="Show Divider Line" checked={!!st.showDivider} onChange={v=>upd('showDivider',v)}/>
        {st.showDivider && <ColorPicker label="Divider Color" value={st.dividerColor} onChange={v=>upd('dividerColor',v)}/>}
        <div><L t="Left Text"/><input value={st.leftText||''} onChange={e=>upd('leftText',e.target.value)} placeholder="Company name" className={iCls}/></div>
        <div><L t="Center Text"/><input value={st.centerText||''} onChange={e=>upd('centerText',e.target.value)} placeholder="Confidential" className={iCls}/></div>
        <div><L t="Right Text"/><input value={st.rightText||''} onChange={e=>upd('rightText',e.target.value)} placeholder="Page {page} of {total}" className={iCls}/></div>
        <div><L t="Font Size (px)"/><input type="number" min={7} max={12} value={st.fontSize||9} onChange={e=>upd('fontSize',Number(e.target.value))} className={iCls}/></div>
      </div>
    );

    default: return null;
  }
}

// ─── Live Preview ─────────────────────────────────────────────────────────────
function LivePreview({ sections, pageSettings, globalSettings, docType }) {
  const enabled = [...sections].filter(s=>s.enabled).sort((a,b)=>a.order-b.order);
  const font = pageSettings?.fontFamily || 'Arial, sans-serif';
  const isThermal = (pageSettings?.paperSize||'A4').startsWith('Thermal');
  const thermalWidth = pageSettings?.paperSize==='Thermal 58mm'||pageSettings?.paperSize==='Thermal 57mm' ? 164 : 227; // px at 96dpi
  const fmt = v => '₹' + Number(v||0).toLocaleString('en-IN');
  const SAMPLE_ITEMS = [
    {n:'Software License — Enterprise', hsn:'9983', sku:'SWL-001', q:5, u:'License', p:12000, d:10, tax:18},
    {n:'Implementation Services',       hsn:'9983', sku:'IMP-002', q:8, u:'Hours',   p:4500,  d:0,  tax:18},
    {n:'Annual Maintenance Contract',   hsn:'9985', sku:'AMC-003', q:1, u:'Year',    p:24000, d:5,  tax:18},
  ];

  const renderSection = (sec) => {
    const s = sec.settings || {};
    const borderStyle = `1px solid ${s.borderColor||'#E2E8F0'}`;

    switch (sec.type) {
      case 'cover': return (
        <div key={sec.id} style={{background:s.bgColor,color:s.textColor,minHeight:200,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 32px',position:'relative',backgroundImage:s.bgImage?`url(${s.bgImage})`:'none',backgroundSize:'cover',backgroundPosition:'center'}}>
          {s.bgImage && <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)'}}/>}
          <div style={{position:'relative',textAlign:'center'}}>
            {s.showLogo && s.logoUrl && <img src={s.logoUrl} alt="logo" style={{height:s.logoHeight||60,objectFit:'contain',marginBottom:16}}/>}
            <div style={{fontSize:32,fontWeight:800,letterSpacing:4,marginBottom:8}}>{s.headline||'QUOTATION'}</div>
            <div style={{fontSize:14,opacity:0.8}}>{s.subheadline}</div>
          </div>
        </div>
      );

      case 'header': {
        const logoJustify = s.logoPosition==='center'?'center':s.logoPosition==='right'?'flex-end':'flex-start';
        return (
          <div key={sec.id}>
            <div style={{background:s.bgColor,color:s.textColor,padding:'16px 24px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  {s.logoUrl && <img src={s.logoUrl} alt="logo" style={{height:s.logoHeight||48,objectFit:'contain',maxWidth:160}} onError={e=>e.target.style.display='none'}/>}
                  {s.showCompanyName && <div>
                    <div style={{fontWeight:800,fontSize:16,letterSpacing:'-0.3px'}}>{s.companyName||'Company Name'}</div>
                    {s.tagline && <div style={{fontSize:10,opacity:0.7,marginTop:2}}>{s.tagline}</div>}
                    {s.showAddress && s.address && <div style={{fontSize:9,opacity:0.6,marginTop:2,maxWidth:200}}>{s.address}</div>}
                    {s.showAddress && s.gstIn && <div style={{fontSize:9,opacity:0.6}}>GSTIN: {s.gstIn}</div>}
                  </div>}
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontWeight:800,fontSize:22,letterSpacing:3,opacity:0.95}}>{docType==='invoice'?'INVOICE':'QUOTATION'}</div>
                  <div style={{fontSize:11,opacity:0.7,marginTop:2}}>#{docType==='invoice'?'INV-000001':'QUO-000001'}</div>
                </div>
              </div>
            </div>
            {s.accentLine && <div style={{height:3,background:s.accentColor||'#3B82F6'}}/>}
          </div>
        );
      }

      case 'doc_info': {
        const DOC_LABELS = { quote_number:'Quote #', invoice_number:'Invoice #', date:'Date', invoice_date:'Invoice Date', valid_until:'Valid Until', due_date:'Due Date', po_number:'PO Number', version:'Version', currency:'Currency', payment_terms:'Payment Terms', reference:'Reference' };
        const RETAIL_DOC_LABELS = { invoice_number:'Invoice #', date:'Date', due_date:'Due Date', customer:'Customer', customer_phone:'Phone', payment_method:'Payment Method', payment_status:'Payment Status', subtotal:'Subtotal', total_discount:'Discount', total_tax:'Tax', amount:'Total Amount' };
        const isRetailInvoice = docType === 'retail_invoice';
        const DOC_VALUES = { quote_number:'QUO-000001', invoice_number:'INV-000001', date:'15 Jan 2025', invoice_date:'15 Jan 2025', valid_until:'14 Feb 2025', due_date:'14 Feb 2025', po_number:'PO-2025-001', version:'v1', currency:'INR', payment_terms:'Net 30', reference:'REF-001' };
        const activeDOCLabels = isRetailInvoice ? RETAIL_DOC_LABELS : DOC_LABELS;
        const fields = s.fields || [];
        return (
          <div key={sec.id} style={{background:s.bgColor,color:s.textColor,padding:'10px 24px',borderBottom:borderStyle,display:'grid',gridTemplateColumns:`repeat(${Math.min(fields.length,4)},1fr)`,gap:8,fontSize:11}}>
            {fields.map(f=>(
              <div key={f}><div style={{opacity:0.5,textTransform:'uppercase',fontSize:8,marginBottom:2,letterSpacing:0.5}}>{DOC_LABELS[f]||f}</div><div style={{fontWeight:600}}>{DOC_VALUES[f]||'—'}</div></div>
            ))}
          </div>
        );
      }

      case 'parties': return (
        <div key={sec.id} style={{background:s.bgColor,padding:'12px 24px',display:'grid',gridTemplateColumns:s.showShipTo?'1fr 1fr':'1fr',gap:20,fontSize:11,borderBottom:borderStyle}}>
          {s.showBillTo && <div>
            <div style={{fontWeight:700,textTransform:'uppercase',fontSize:8,color:s.labelColor||'#64748B',marginBottom:4,letterSpacing:0.5}}>Bill To</div>
            <div style={{fontWeight:600,fontSize:12}}>Acme Corporation Pvt Ltd</div>
            <div style={{color:'#475569',marginTop:2}}>Plot 42, Industrial Area, Phase II</div>
            <div style={{color:'#475569'}}>Mumbai, Maharashtra 400001</div>
            {s.showContact && <div style={{color:'#64748B',marginTop:3}}>Attn: Mr. Rajesh Sharma</div>}
            {s.showGSTIN && <div style={{color:'#64748B',fontSize:10,marginTop:2}}>GSTIN: 27AACCA1234R1Z5</div>}
          </div>}
          {s.showShipTo && <div style={{borderLeft:borderStyle,paddingLeft:16}}>
            <div style={{fontWeight:700,textTransform:'uppercase',fontSize:8,color:s.labelColor||'#64748B',marginBottom:4,letterSpacing:0.5}}>Ship To</div>
            <div style={{color:'#475569'}}>Same as billing address</div>
          </div>}
        </div>
      );

      case 'items': {
        const cols = s.columns || ['sno','name','qty','unit_price','amount'];
        const labels = s.columnLabels || ALL_COLUMNS;
        const cellStyle = {padding:`6px ${s.fontSize?s.fontSize-3:8}px`, borderBottom:`1px solid ${s.borderColor||'#E2E8F0'}`, fontSize:s.fontSize||11};
        const VALS = {sno:1,name:'',description:'Annual software license for enterprise users',hsn:'9983',sku:'SWL-001',qty:5,unit:'License',unit_price:12000,discount:10,tax:18,cgst:9,sgst:9,igst:0,amount:0};
        return (
          <div key={sec.id} style={{padding:'0 0 8px 0'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontFamily:font,fontSize:s.fontSize||11}}>
              <thead>
                <tr style={{background:s.headerBgColor||'#0F172A',color:s.headerTextColor||'#FFFFFF'}}>
                  {cols.map(c=><th key={c} style={{padding:`8px ${s.fontSize?s.fontSize-3:8}px`,textAlign:c==='sno'?'center':'left',fontWeight:600,fontSize:(s.fontSize||11)-1,borderRight:s.showColumnBorders?`1px solid rgba(255,255,255,0.1)`:'none'}}>{labels[c]||c}</th>)}
                </tr>
              </thead>
              <tbody>
                {SAMPLE_ITEMS.map((item,idx)=>{
                  const net = item.q*item.p*(1-item.d/100);
                  const ROWVALS = {...VALS,sno:idx+1,name:item.n,hsn:item.hsn,sku:item.sku,qty:item.q,unit:item.u,unit_price:item.p,discount:item.d,tax:item.tax,cgst:item.tax/2,sgst:item.tax/2,igst:0,amount:net*(1+item.tax/100)};
                  return (
                    <React.Fragment key={idx}>
                    <tr style={{background:s.altRowColor&&idx%2===1?s.altRowColor:'#FFF'}}>
                      {cols.map(c=>(
                        <td key={c} style={{...cellStyle,textAlign:c==='sno'?'center':['unit_price','discount','tax','cgst','sgst','igst','qty','amount'].includes(c)?'right':'left',color:c==='sno'?'#94A3B8':c==='amount'?'#0F172A':'inherit',fontWeight:c==='amount'?600:400,borderRight:s.showColumnBorders?`1px solid ${s.borderColor||'#E2E8F0'}`:'none'}}>
                          {c==='amount'?fmt(ROWVALS[c]):c==='unit_price'?fmt(ROWVALS[c]):c==='description'?<span style={{fontSize:(s.fontSize||11)-1,color:'#64748B'}}>{item.n+' — '+ROWVALS[c]}</span>:String(ROWVALS[c]||'')}
                        </td>
                      ))}
                    </tr>
                    {/* Configuration attributes — shown inline under line item like Oracle CPQ */}
                    {idx===0&&(
                      <tr style={{background:'#F0F7FF'}}>
                        <td/>
                        <td colSpan={cols.length-1} style={{padding:'4px 8px 6px',fontSize:9.5,color:'#334155'}}>
                          <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                            {[['Colour','Blue'],['Size','Large'],['Material','Steel']].map(([k,v])=>(
                              <span key={k}><strong style={{color:'#64748B'}}>{k}:</strong> {v}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      case 'totals': {
        const subtotal = 159900; const disc = 10350; const tax = 26901; const total = 176451;
        const rows = [
          s.showSubtotal    && ['Subtotal', fmt(subtotal)],
          s.showDiscount    && ['Discount', `-${fmt(disc)}`],
          s.showTaxBreakdown && docType!=='invoice' && ['Tax', fmt(tax)],
          s.showTaxBreakdown && docType==='invoice' && s.showCGST && ['CGST (9%)', fmt(tax/2)],
          s.showTaxBreakdown && docType==='invoice' && s.showSGST && ['SGST (9%)', fmt(tax/2)],
          s.showShipping    && [s.shippingLabel||'Shipping', fmt(500)],
          s.showRoundOff    && ['Round-Off', '+₹0.49'],
        ].filter(Boolean);
        return (
          <div key={sec.id} style={{background:s.bgColor||'#F8FAFC',padding:'8px 24px 12px'}}>
            <div style={{display:'flex',justifyContent:'flex-end'}}>
              <div style={{width:260,fontSize:11}}>
                {rows.map(([l,v])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:`1px solid ${s.borderColor||'#E2E8F0'}`}}>
                    <span style={{color:'#475569'}}>{l}</span><span style={{fontWeight:600}}>{v}</span>
                  </div>
                ))}
                <div style={{display:'flex',justifyContent:'space-between',background:s.accentBgColor||'#0F172A',color:s.accentTextColor||'#FFF',borderRadius:6,padding:'8px 10px',marginTop:4,fontWeight:700,fontSize:12}}>
                  <span>TOTAL</span><span>{fmt(total)}</span>
                </div>
                {s.showAmountWords && <div style={{fontSize:9,color:'#64748B',marginTop:6,fontStyle:'italic'}}>{s.amountWordsLabel||'Amount in Words'}: One Lakh Seventy Six Thousand Four Hundred Fifty One Only</div>}
              </div>
            </div>
          </div>
        );
      }

      case 'bank': return (
        <div key={sec.id} style={{background:s.bgColor||'#EFF6FF',padding:'10px 24px',borderTop:`1px solid ${s.borderColor||'#BFDBFE'}`,fontSize:11}}>
          <div style={{fontWeight:700,textTransform:'uppercase',fontSize:8,color:s.titleColor||'#1E40AF',marginBottom:6,letterSpacing:0.5}}>Bank Details</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'3px 16px'}}>
            {[['Bank',s.bankName||'HDFC Bank Ltd'],['Account Name',s.accountName||'Umbrella Suite Solutions'],['Account No.',s.accountNumber||'XXXX XXXX 1234'],['IFSC',s.ifscCode||'HDFC0001234'],['Branch',s.branchName||'Andheri East'],s.upiId&&['UPI',s.upiId]].filter(Boolean).map(([l,v])=>(
              <div key={l} style={{display:'flex',gap:6,fontSize:10}}><span style={{color:'#94A3B8',minWidth:80}}>{l}:</span><span style={{fontWeight:500}}>{v}</span></div>
            ))}
          </div>
          {s.showQR && <div style={{marginTop:8,width:48,height:48,background:'#E2E8F0',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,color:'#94A3B8'}}>QR CODE</div>}
        </div>
      );

      case 'text_block': return (
        <div key={sec.id} style={{background:s.bgColor||'#FFFBEB',color:s.textColor||'#92400E',padding:s.padding||12,fontSize:s.fontSize||10,lineHeight:1.6,borderLeft:s.borderLeft||'none',whiteSpace:'pre-line'}}>
          {s.content}
        </div>
      );

      case 'terms': return (
        <div key={sec.id} style={{background:s.bgColor||'#FFFFFF',padding:'10px 24px',borderTop:`1px solid ${s.borderColor||'#E2E8F0'}`}}>
          <div style={{fontWeight:700,textTransform:'uppercase',fontSize:8,color:s.titleColor||'#0F172A',marginBottom:6,letterSpacing:0.5}}>Terms & Conditions</div>
          <div style={{fontSize:s.fontSize||10,color:s.textColor||'#475569',lineHeight:1.6,whiteSpace:'pre-line',columns:s.columns===2?'2':'1',columnGap:20}}>
            {s.content}
          </div>
        </div>
      );

      case 'signature': return (
        <div key={sec.id} style={{background:s.bgColor||'#FFFFFF',padding:'16px 24px',borderTop:`1px solid #E2E8F0`,display:'flex',justifyContent:'space-around',alignItems:'flex-end'}}>
          {s.showPrepared && <div style={{textAlign:'center',minWidth:120}}>
            {s.showDate && <div style={{fontSize:9,color:'#94A3B8',marginBottom:20}}>Date: ___________</div>}
            <div style={{borderTop:`1px solid ${s.lineColor||'#0F172A'}`,paddingTop:4,fontSize:9,color:'#475569'}}>{s.preparedLabel||'Prepared by'}{s.preparedName&&<div style={{fontWeight:600}}>{s.preparedName}</div>}</div>
          </div>}
          {s.showStamp && <div style={{width:60,height:60,borderRadius:'50%',border:`2px dashed #CBD5E1`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,color:'#94A3B8',marginBottom:4}}>STAMP</div>}
          {s.showApproved && <div style={{textAlign:'center',minWidth:120}}>
            {s.showDate && <div style={{fontSize:9,color:'#94A3B8',marginBottom:20}}>Date: ___________</div>}
            <div style={{borderTop:`1px solid ${s.lineColor||'#0F172A'}`,paddingTop:4,fontSize:9,color:'#475569'}}>{s.approvedLabel||'Authorized Signatory'}{s.approvedName&&<div style={{fontWeight:600}}>{s.approvedName}</div>}</div>
          </div>}
        </div>
      );

      case 'footer': return (
        <div key={sec.id}>
          {s.showDivider && <div style={{height:2,background:s.dividerColor||'#3B82F6'}}/>}
          <div style={{background:s.bgColor||'#0F172A',color:s.textColor||'#FFFFFF',padding:'8px 24px',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',fontSize:s.fontSize||9}}>
            <div>{s.leftText}</div>
            <div style={{textAlign:'center',opacity:0.7}}>{s.centerText}</div>
            <div style={{textAlign:'right',opacity:0.7}}>{(s.rightText||'').replace('{page}','1').replace('{total}','1')}</div>
          </div>
        </div>
      );

      default: return null;
    }
  };

  const watermark = globalSettings?.watermark;
  return (
    <div style={{fontFamily:font,border:'1px solid #E2E8F0',borderRadius:8,overflow:'hidden',background:'#FFF',position:'relative',minHeight:isThermal?'auto':600,width:isThermal?thermalWidth:'100%',maxWidth:'100%',boxShadow:'0 4px 24px rgba(0,0,0,0.08)'}}>
      {watermark && <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%) rotate(-35deg)',fontSize:48,fontWeight:900,color:'rgba(0,0,0,0.07)',pointerEvents:'none',zIndex:10,whiteSpace:'nowrap',letterSpacing:8}}>{watermark}</div>}
      {enabled.map(renderSection)}
      <div style={{textAlign:'center',padding:6,fontSize:8,color:'#CBD5E1',borderTop:'1px solid #F1F5F9'}}>Generated by Umbrella Suite</div>
    </div>
  );
}

// ─── SECTION_TYPES — what can be added ───────────────────────────────────────
const ADDABLE_SECTIONS = [
  { type:'text_block', name:'Custom Text Block', icon:'📝', hint:'Free text — intro, notes, disclaimers' },
  { type:'bank',       name:'Bank Details',      icon:'🏦', hint:'Bank account and UPI for payment' },
  { type:'cover',      name:'Cover Page',        icon:'📰', hint:'Full-page cover with headline and bg image' },
];

const SECTION_ICONS = { cover:'📰', header:'🎨', doc_info:'📋', parties:'👤', intro:'✍️', items:'📦', totals:'💰', notes:'📌', terms:'📝', bank:'🏦', signature:'✒️', footer:'🔚', text_block:'📝' };

// ─── Main exported component ──────────────────────────────────────────────────
export default function DocumentTemplateDesigner({ docType = 'quote' }) {
  const {
    quoteTemplates, saveQuoteTemplate, deleteQuoteTemplate, setDefaultTemplate,
    invoiceTemplates, saveInvoiceTemplate, deleteInvoiceTemplate, setDefaultInvoiceTemplate,
    appearance,
  } = useApp();

  const isInvoice  = docType === 'invoice';
  const templates  = isInvoice ? (invoiceTemplates||[]) : (quoteTemplates||[]);
  const saveFn     = isInvoice ? saveInvoiceTemplate    : saveQuoteTemplate;
  const deleteFn   = isInvoice ? deleteInvoiceTemplate  : deleteQuoteTemplate;
  const defaultFn  = isInvoice ? setDefaultInvoiceTemplate : setDefaultTemplate;
  const DEFAULT_SECS = isInvoice ? INVOICE_SECTIONS : QUOTE_SECTIONS;

  const [selectedId,    setSelectedId]    = useState(null);
  const [sections,      setSections]      = useState(DEFAULT_SECS);
  const [pageSettings,  setPageSettings]  = useState({ fontFamily:'Arial, sans-serif', paperSize:'A4', marginMM:12 });
  const [globalSettings,setGlobalSettings]= useState({ watermark:'', brandColor:'#0F172A', accentColor:'#3B82F6' });
  const [form,          setForm]          = useState({ name:'' });
  const [expandedSec,   setExpandedSec]   = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [creating,      setCreating]      = useState(false);
  const [zoom,          setZoom]          = useState(85);
  const [tab,           setTab]           = useState('sections'); // sections | page | global

  const selected = templates.find(t => t.id === selectedId);

  const loadTemplate = (t) => {
    setSelectedId(t.id);
    setForm({ name: t.name });
    setSections(t.sections?.length ? t.sections : DEFAULT_SECS);
    setPageSettings(t.page_settings || { fontFamily:'Arial, sans-serif', paperSize:'A4', marginMM:12 });
    setGlobalSettings(t.global_settings || { watermark:'', brandColor:'#0F172A', accentColor:'#3B82F6' });
    setExpandedSec(null);
    setCreating(false);
  };

  const startNew = () => {
    setSelectedId(null);
    setForm({ name:'' });
    setSections(DEFAULT_SECS.map(s=>({...s,settings:{...s.settings}})));
    setPageSettings({ fontFamily:'Arial, sans-serif', paperSize:'A4', marginMM:12 });
    setGlobalSettings({ watermark:'', brandColor:'#0F172A', accentColor:'#3B82F6' });
    setCreating(true);
    setExpandedSec(null);
  };

  const duplicateTemplate = () => {
    setSelectedId(null);
    setForm(f => ({ ...f, name: f.name + ' (Copy)' }));
    setCreating(true);
  };

  const moveSection = (idx, dir) => {
    setSections(p => {
      const arr = [...p];
      const si  = idx + dir;
      if (si < 0 || si >= arr.length) return p;
      [arr[idx], arr[si]] = [arr[si], arr[idx]];
      return arr.map((s,i) => ({ ...s, order: i+1 }));
    });
  };

  const addSection = (type) => {
    const base = ADDABLE_SECTIONS.find(a=>a.type===type);
    const id   = type + '_' + Date.now();
    const newSec = { id, type, name: base?.name||type, enabled:true, order: sections.length+1, settings:
      type==='text_block' ? { bgColor:'#FFFFFF', textColor:'#374151', content:'Enter text here...', fontSize:11, padding:12 }
      : type==='bank'     ? { bgColor:'#EFF6FF', borderColor:'#BFDBFE', titleColor:'#1E40AF', bankName:'', accountName:'', accountNumber:'', ifscCode:'', branchName:'', upiId:'', showQR:false }
      : type==='cover'    ? { bgColor:'#0F172A', textColor:'#FFFFFF', headline:isInvoice?'INVOICE':'QUOTATION', subheadline:'', showLogo:true, logoUrl:'', bgImage:'' }
      : {},
    };
    setSections(p => [...p, newSec]);
    setExpandedSec(id);
  };

  const removeSection = (idx) => {
    if (!confirm('Remove this section?')) return;
    setSections(p => p.filter((_,i)=>i!==idx).map((s,i)=>({...s,order:i+1})));
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { alert('Template name is required.'); return; }
    setSaving(true);
    await saveFn({ name:form.name, sections, page_settings:pageSettings, global_settings:globalSettings }, selected?.dbId||selected?.id||null);
    setSaving(false);
    setCreating(false);
    alert('Template saved!');
  };

  const applyBrandColor = () => {
    const bc = globalSettings.brandColor;
    setSections(p => p.map(sec => {
      const s = sec.settings || {};
      if (sec.type==='header')    return {...sec,settings:{...s,bgColor:bc}};
      if (sec.type==='cover')     return {...sec,settings:{...s,bgColor:bc}};
      if (sec.type==='items')     return {...sec,settings:{...s,headerBgColor:bc}};
      if (sec.type==='totals')    return {...sec,settings:{...s,accentBgColor:bc}};
      if (sec.type==='footer')    return {...sec,settings:{...s,bgColor:bc}};
      if (sec.type==='signature') return {...sec,settings:{...s,lineColor:bc}};
      return sec;
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#0F172A]">{isInvoice?'Invoice':'Quote'} Template Designer</h2>
          <p className="text-gray-500 text-sm mt-0.5">Enterprise document designer with live preview · {templates.length} template{templates.length!==1?'s':''}</p>
        </div>
        <button onClick={startNew} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">
          + New Template
        </button>
      </div>

      {/* Template selector */}
      {templates.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {templates.map(t => (
            <button key={t.id} onClick={()=>loadTemplate(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold border transition-all ${selectedId===t.id?'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white border-transparent shadow-lg':'bg-white border-blue-100 text-[#0F172A] hover:border-blue-300'}`}>
              {isInvoice?'🧾':'📄'} {t.name}
              {(t.isDefault||t.is_default) && <span className={`text-xs px-1.5 py-0.5 rounded-full ${selectedId===t.id?'bg-white/20':'bg-green-100 text-green-700'}`}>Default</span>}
            </button>
          ))}
        </div>
      )}

      {(creating || selectedId) && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          {/* ── Left panel ── */}
          <div className="xl:col-span-2 space-y-4">
            {/* Template name + quick actions */}
            <div className="bg-white rounded-[20px] border border-blue-100 shadow p-4 space-y-3">
              <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1">Template Name *</label>
                <input value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder={`e.g. ${isInvoice?'Standard GST Invoice':'Professional Quote'}`} className={iCls}/></div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={handleSave} disabled={saving} className="flex-1 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 shadow hover:opacity-90">
                  {saving?'Saving...':'💾 Save'}
                </button>
                {selectedId && <button onClick={duplicateTemplate} className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2.5 rounded-xl text-sm font-semibold">⧉ Duplicate</button>}
                {selectedId && !(selected?.isDefault||selected?.is_default) && (
                  <button onClick={()=>defaultFn(selectedId)} className="bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2.5 rounded-xl text-sm font-semibold">★ Default</button>
                )}
                {selectedId && (
                  <button onClick={()=>{deleteFn(selected?.dbId||selectedId);setSelectedId(null);setSections(DEFAULT_SECS);}} className="bg-red-50 hover:bg-red-100 text-red-500 px-3 py-2.5 rounded-xl text-sm font-semibold">🗑</button>
                )}
              </div>
            </div>

            {/* Settings tabs */}
            <div className="bg-white rounded-[20px] border border-blue-100 shadow overflow-hidden">
              <div className="flex border-b border-blue-100">
                {[['sections','Sections','📑'],['page','Page','📐'],['global','Brand','🎨']].map(([k,l,ic])=>(
                  <button key={k} onClick={()=>setTab(k)} className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1 transition-all ${tab===k?'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white':'text-gray-500 hover:bg-blue-50'}`}>
                    <span>{ic}</span>{l}
                  </button>
                ))}
              </div>

              {/* ── Sections tab ── */}
              {tab==='sections' && (
                <div>
                  <div className="divide-y divide-blue-50 max-h-[52vh] overflow-y-auto">
                    {[...sections].sort((a,b)=>a.order-b.order).map((sec,idx)=>(
                      <div key={sec.id} className={!sec.enabled?'opacity-40':''}>
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <div className="flex flex-col gap-0.5 flex-shrink-0">
                            <button onClick={()=>moveSection(idx,-1)} disabled={idx===0} className="w-4 h-4 text-gray-300 hover:text-gray-600 disabled:opacity-0 text-xs flex items-center justify-center">▲</button>
                            <button onClick={()=>moveSection(idx,1)} disabled={idx===sections.length-1} className="w-4 h-4 text-gray-300 hover:text-gray-600 disabled:opacity-0 text-xs flex items-center justify-center">▼</button>
                          </div>
                          <button onClick={()=>setSections(p=>p.map((s,i)=>i===idx?{...s,enabled:!s.enabled}:s))}
                            className={`w-9 h-5 rounded-full flex-shrink-0 transition-colors ${sec.enabled?'bg-blue-600':'bg-gray-200'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow ml-0.5 transition-transform ${sec.enabled?'translate-x-4':''}`}/>
                          </button>
                          <span className="text-base flex-shrink-0">{SECTION_ICONS[sec.type]||'📄'}</span>
                          <span className="text-xs font-semibold text-[#0F172A] flex-1 truncate">{sec.name}</span>
                          <div className="flex gap-1">
                            <button onClick={()=>setExpandedSec(expandedSec===sec.id?null:sec.id)} disabled={!sec.enabled}
                              className="text-blue-600 text-xs font-semibold hover:bg-blue-50 px-2 py-1 rounded-lg disabled:opacity-30">
                              {expandedSec===sec.id?'▲':'▼'}
                            </button>
                            {!['header','doc_info','items','totals','footer'].includes(sec.id) && (
                              <button onClick={()=>removeSection(idx)} className="text-red-400 hover:text-red-600 text-xs px-1.5 py-1 rounded-lg hover:bg-red-50">✕</button>
                            )}
                          </div>
                        </div>
                        {expandedSec===sec.id && sec.enabled && (
                          <div className="px-4 pb-4 bg-slate-50 border-t border-blue-100">
                            <SectionSettings section={sec} onUpdate={updated=>setSections(p=>p.map((s,i)=>i===idx?updated:s))} docType={docType}/>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Add section */}
                  <div className="p-3 border-t border-blue-50">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-2">Add Section</div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {ADDABLE_SECTIONS.map(a=>(
                        <button key={a.type} onClick={()=>addSection(a.type)}
                          className="flex items-center gap-2 text-left px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition-all">
                          <span>{a.icon}</span>
                          <div><div>{a.name}</div><div className="text-blue-400 font-normal">{a.hint}</div></div>
                          <span className="ml-auto">+</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Page tab ── */}
              {tab==='page' && (
                <div className="p-4 space-y-4">
                  <div><L t="Font Family"/>
                    <select value={pageSettings.fontFamily} onChange={e=>setPageSettings(p=>({...p,fontFamily:e.target.value}))} className={sCls}>
                      {FONTS.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
                    </select>
                  </div>
                  <div><L t="Paper Size"/>
                    <div className="grid grid-cols-4 gap-1 mt-1">
                      {PAPER_SIZES.map(sz=>(
                        <button key={sz} onClick={()=>setPageSettings(p=>({...p,paperSize:sz}))}
                          className={`py-2 rounded-xl text-xs font-semibold transition-all ${pageSettings.paperSize===sz?'bg-[#0F172A] text-white':'bg-gray-50 text-gray-600 hover:bg-blue-50 border border-gray-100'}`}>
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div><L t={`Margins (${pageSettings.marginMM||12}mm)`}/>
                    <input type="range" min={5} max={30} value={pageSettings.marginMM||12} onChange={e=>setPageSettings(p=>({...p,marginMM:Number(e.target.value)}))} className="w-full"/>
                  </div>
                </div>
              )}

              {/* ── Global/Brand tab ── */}
              {tab==='global' && (
                <div className="p-4 space-y-4">
                  <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                    Set brand colors once and apply to all sections instantly.
                  </div>
                  <ColorPicker label="Brand Color" value={globalSettings.brandColor} onChange={v=>setGlobalSettings(g=>({...g,brandColor:v}))}/>
                  <ColorPicker label="Accent Color" value={globalSettings.accentColor} onChange={v=>setGlobalSettings(g=>({...g,accentColor:v}))}/>
                  <button onClick={applyBrandColor} className="w-full bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-2.5 rounded-xl text-sm font-bold hover:opacity-90">
                    ✨ Apply Brand Color to All Sections
                  </button>
                  <div><L t="Watermark"/>
                    <select value={globalSettings.watermark||''} onChange={e=>setGlobalSettings(g=>({...g,watermark:e.target.value}))} className={sCls}>
                      {WATERMARKS.map(w=><option key={w} value={w}>{w||'None'}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Live Preview ── */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-[20px] border border-blue-100 shadow overflow-hidden sticky top-4">
              <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3.5 flex items-center gap-3 flex-wrap">
                <h3 className="text-white font-bold flex-1">Live Preview</h3>
                <div className="flex items-center gap-2">
                  <span className="text-blue-300 text-xs">{pageSettings.paperSize}</span>
                  <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
                    <button onClick={()=>setZoom(z=>Math.max(50,z-10))} className="text-white text-xs w-5 h-5 flex items-center justify-center hover:bg-white/10 rounded">−</button>
                    <span className="text-white text-xs w-10 text-center">{zoom}%</span>
                    <button onClick={()=>setZoom(z=>Math.min(120,z+10))} className="text-white text-xs w-5 h-5 flex items-center justify-center hover:bg-white/10 rounded">+</button>
                  </div>
                </div>
              </div>
              <div className="p-4 overflow-y-auto bg-gray-100" style={{maxHeight:'78vh'}}>
                <div style={{transform:`scale(${zoom/100})`,transformOrigin:'top center',transition:'transform 0.15s'}}>
                  <LivePreview sections={sections} pageSettings={pageSettings} globalSettings={globalSettings} docType={docType}/>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!creating && !selectedId && templates.length === 0 && (
        <div className="py-20 text-center bg-white rounded-[24px] border border-blue-100 shadow">
          <div className="text-6xl mb-4">{isInvoice?'🧾':'📄'}</div>
          <h2 className="text-xl font-bold text-[#0F172A] mb-2">No {isInvoice?'invoice':'quote'} templates yet</h2>
          <p className="text-gray-400 mb-5">Design your first professional {isInvoice?'invoice':'quotation'} template.</p>
          <button onClick={startNew} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-3 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">
            + Create First Template
          </button>
        </div>
      )}
    </div>
  );
}
