// @ts-nocheck
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAPER_SIZES = [
  { v:'thermal_80', l:'Thermal 80mm',  w:303, thermal:true,  desc:'Standard POS receipt' },
  { v:'thermal_58', l:'Thermal 58mm',  w:219, thermal:true,  desc:'Compact receipt printer' },
  { v:'thermal_57', l:'Thermal 57mm',  w:215, thermal:true,  desc:'Mini / petrol pump' },
  { v:'A5',         l:'A5 Half-Page',  w:480, thermal:false, desc:'Half-page invoice' },
  { v:'A4',         l:'A4 Full Page',  w:680, thermal:false, desc:'Standard full invoice' },
];
const FONTS = [
  { v:'monospace',                 l:'Monospace',   d:'Classic POS receipt look' },
  { v:"'Courier New', monospace",  l:'Courier New', d:'Old-school thermal' },
  { v:'Arial, sans-serif',         l:'Arial',       d:'Clean and modern' },
  { v:"'Roboto', sans-serif",      l:'Roboto',      d:'Contemporary sans-serif' },
  { v:'Georgia, serif',            l:'Georgia',     d:'Elegant serif' },
];
const WATERMARKS   = ['','PAID','DRAFT','VOID','COPY','CANCELLED'];
const LOGO_POS     = ['left','center','right'];
const GST_RATES    = ['0','0.25','3','5','12','18','28'];
const INDIA_STATES = ['Andhra Pradesh','Delhi','Gujarat','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Rajasthan','Tamil Nadu','Telangana','Uttar Pradesh','West Bengal','Other'];

// ─── Contrast-safe text colours ───────────────────────────────────────────────
const T  = '#111827';  // primary text
const TM = '#374151';  // medium
const TL = '#6B7280';  // muted / labels

// ─── Default template ─────────────────────────────────────────────────────────
const defaultTpl = () => ({
  // Identity
  name: 'New Retail Receipt', headline: 'RECEIPT', sub_headline: '',
  // Paper + font
  paper_size: 'thermal_80', font_family: 'monospace', font_size: 11,
  // Colors
  brand_color: '#0F172A', accent_color: '#2563EB', bg_color: '#FFFFFF',
  text_color: '#111827', muted_color: '#6B7280', alt_row_color: '#F9FAFB',
  // Watermark
  watermark: '',
  // Logo
  show_logo: false, logo_url: '', logo_position: 'center', logo_size: 48,
  // Store info
  store_name: 'Your Store', store_tagline: '', store_address: '',
  store_phone: '', store_email: '', store_website: '', store_gstin: '',
  // Header
  header_align: 'center', show_store_info: true, show_gst_header: true,
  // Invoice meta
  show_invoice_number: true, show_date: true, show_cashier: true,
  show_barcode: false, show_qr_code: false,
  // Customer
  show_customer: true, show_customer_phone: true, show_customer_gstin: false,
  // Line items
  col_sno: false, col_item: true, col_qty: true, col_unit: false,
  col_price: true, col_discount: false, col_tax_rate: true, col_hsn: false, col_total: true,
  alt_row: false,
  // Tax & totals
  show_subtotal: true, show_discount_total: true, show_tax_total: true,
  show_cgst_sgst: true, show_round_off: false,
  tax_regime: 'gst',   // 'gst' | 'inclusive' | 'exempt'
  default_gst_rate: '18',
  place_of_supply: 'Maharashtra',
  // Payment
  show_payment: true, show_payment_mode: true, show_amount_paid: true, show_change: true,
  show_upi_id: false, upi_id: '',
  // Loyalty
  show_loyalty: false,
  // Return policy
  show_return_policy: false, return_policy: 'Returns accepted within 7 days with original receipt.',
  // Signature
  show_signature: false, signature_label: 'Authorised Signatory',
  // Footer
  show_footer: true, footer_msg: 'Thank you for shopping with us! 🛍️',
  show_powered_by: false,
  // Dividers
  show_dividers: true, border_style: 'dashed',
});

// ─── Sample data ──────────────────────────────────────────────────────────────
const SAMPLE = {
  inv: 'RINV-00042', date: '25 Jun 2026', time: '14:32', cashier: 'Priya S.',
  customer: 'Rahul Sharma', cphone: '+91 91234 56789', cgstin: '27AABCR1234M1ZA',
  loyalty: 1250, earned: 45,
  items: [
    { sno:1, name:'Running Shoes X200', hsn:'6404', unit:'Pair', qty:1, price:1999, disc:10, taxRate:12, taxAmt:216, total:2015 },
    { sno:2, name:'Sports Socks Pack',   hsn:'6115', unit:'Pack', qty:2, price:249,  disc:0,  taxRate:5,  taxAmt:25,  total:523  },
    { sno:3, name:'Water Bottle Pro',    hsn:'3924', unit:'Pc',   qty:1, price:599,  disc:0,  taxRate:18, taxAmt:108, total:707  },
  ],
  subtotal: 3245, discount: 200, cgst: 174.5, sgst: 174.5, totalTax: 349,
  total: 3394, paid: 3400, change: 6, payment: 'UPI / Google Pay',
};

// ─── Live Preview ─────────────────────────────────────────────────────────────
function LivePreview({ t }) {
  const ps     = PAPER_SIZES.find(p => p.v === t.paper_size) || PAPER_SIZES[0];
  const th     = ps.thermal;
  const font   = t.font_family || 'monospace';
  const brand  = t.brand_color || '#0F172A';
  const accent = t.accent_color || '#2563EB';
  const bg     = t.bg_color     || '#FFFFFF';
  const fs     = n => th ? Math.max(8, n - 2) : n;

  const div = t.show_dividers
    ? <div style={{borderTop: t.border_style==='solid'?`1px solid ${brand}40`:t.border_style==='none'?'none':'1px dashed #D1D5DB', margin:`${th?5:8}px 0`}}/>
    : <div style={{margin:`${th?4:6}px 0`}}/>;

  const Row = ({ l, v, bold, mono }) => (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:th?1.5:3}}>
      <span style={{fontSize:fs(10),color:TL,flexShrink:0,marginRight:8}}>{l}</span>
      <span style={{fontSize:fs(11),fontWeight:bold?700:500,color:T,fontFamily:mono?'monospace':undefined,textAlign:'right'}}>{v}</span>
    </div>
  );

  const taxCols = t.show_cgst_sgst
    ? [{label:'CGST',val:SAMPLE.cgst},{label:'SGST',val:SAMPLE.sgst}]
    : [{label:'GST',val:SAMPLE.totalTax}];

  return (
    <div style={{width:ps.w,background:bg,fontFamily:font,boxShadow:'0 8px 32px rgba(0,0,0,0.18)',borderRadius:th?4:12,margin:'0 auto',overflow:'hidden',border:'1px solid #E2E8F0',position:'relative'}}>

      {/* Watermark */}
      {t.watermark && (
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%) rotate(-35deg)',fontSize:th?40:56,fontWeight:900,color:'rgba(0,0,0,0.05)',pointerEvents:'none',zIndex:10,whiteSpace:'nowrap',letterSpacing:8}}>{t.watermark}</div>
      )}

      {/* HEADER */}
      <div style={{background:brand,color:'#fff',padding:th?'10px 12px':'18px 24px',textAlign:t.header_align}}>
        {t.show_logo && (
          <div style={{marginBottom:6,display:'flex',justifyContent:t.logo_position==='center'?'center':t.logo_position==='right'?'flex-end':'flex-start'}}>
            {t.logo_url
              ? <img src={t.logo_url} alt="logo" style={{height:t.logo_size||48,objectFit:'contain'}}/>
              : <div style={{width:t.logo_size||48,height:t.logo_size||48,background:'rgba(255,255,255,0.2)',borderRadius:8,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:Math.min(t.logo_size||48,28)}}>🛍️</div>
            }
          </div>
        )}
        <div style={{fontWeight:900,fontSize:fs(16),letterSpacing:2,color:'#fff'}}>{t.store_name||'Your Store'}</div>
        {t.store_tagline && <div style={{fontSize:fs(9),color:'rgba(255,255,255,0.7)',marginTop:2,fontStyle:'italic'}}>{t.store_tagline}</div>}
        {t.show_store_info && (
          <div style={{fontSize:fs(9),color:'rgba(255,255,255,0.8)',marginTop:4,lineHeight:1.7}}>
            {t.store_address && <div>{t.store_address}</div>}
            {t.store_phone   && <div>{t.store_phone}</div>}
            {t.store_email   && <div>{t.store_email}</div>}
            {t.store_website && <div>{t.store_website}</div>}
            {t.show_gst_header && t.store_gstin && <div>GSTIN: {t.store_gstin}</div>}
          </div>
        )}
      </div>

      <div style={{padding:th?'8px 12px':'16px 24px'}}>

        {/* Invoice meta */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:th?5:8}}>
          <div>
            <div style={{fontWeight:800,fontSize:fs(14),color:T}}>{t.headline||'RECEIPT'}</div>
            {t.sub_headline && <div style={{fontSize:fs(9),color:TL}}>{t.sub_headline}</div>}
            {t.show_invoice_number && <div style={{fontSize:fs(10),color:TM,marginTop:1}}>#{SAMPLE.inv}</div>}
            {t.show_date && <div style={{fontSize:fs(9),color:TL}}>{SAMPLE.date} {SAMPLE.time}</div>}
            {t.show_cashier && <div style={{fontSize:fs(9),color:TL}}>Cashier: {SAMPLE.cashier}</div>}
          </div>
          {t.show_barcode && <div style={{color:'#9CA3AF',fontSize:th?18:24,letterSpacing:-2,lineHeight:1}}>▌▌▌▌▌▌</div>}
          {t.show_qr_code && <div style={{width:th?32:48,height:th?32:48,background:'#F3F4F6',border:'1px solid #E5E7EB',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:th?18:28}}>◼</div>}
        </div>

        {div}

        {/* Customer */}
        {t.show_customer && (
          <div style={{marginBottom:th?3:6}}>
            <Row l="Customer" v={SAMPLE.customer} bold/>
            {t.show_customer_phone && <Row l="Phone" v={SAMPLE.cphone}/>}
            {t.show_customer_gstin && <Row l="GSTIN" v={SAMPLE.cgstin} mono/>}
          </div>
        )}
        {t.show_customer && div}

        {/* Line items table */}
        <div style={{marginBottom:th?4:8}}>
          {/* Header row */}
          <div style={{display:'flex',borderBottom:`1px solid ${brand}30`,paddingBottom:3,marginBottom:4}}>
            {t.col_sno    && <span style={{width:20,fontSize:fs(8),color:TL,fontWeight:700}}>#</span>}
            <span style={{flex:1,fontSize:fs(8),color:TL,fontWeight:700,textTransform:'uppercase'}}>Item</span>
            {t.col_unit   && <span style={{width:th?28:36,fontSize:fs(8),color:TL,fontWeight:700,textAlign:'center'}}>Unit</span>}
            {t.col_qty    && <span style={{width:th?24:32,fontSize:fs(8),color:TL,fontWeight:700,textAlign:'right'}}>Qty</span>}
            {t.col_price  && <span style={{width:th?44:56,fontSize:fs(8),color:TL,fontWeight:700,textAlign:'right'}}>Price</span>}
            {t.col_discount && <span style={{width:th?28:36,fontSize:fs(8),color:TL,fontWeight:700,textAlign:'right'}}>Disc</span>}
            {t.col_tax_rate && <span style={{width:th?32:40,fontSize:fs(8),color:TL,fontWeight:700,textAlign:'right'}}>GST%</span>}
            {t.col_hsn    && <span style={{width:th?36:44,fontSize:fs(8),color:TL,fontWeight:700,textAlign:'right'}}>HSN</span>}
            {t.col_total  && <span style={{width:th?48:60,fontSize:fs(8),color:TL,fontWeight:700,textAlign:'right'}}>Total</span>}
          </div>
          {/* Item rows */}
          {SAMPLE.items.map((item,i) => (
            <div key={i} style={{display:'flex',alignItems:'center',marginBottom:th?2:4,padding:th?'1px 0':'2px 0',background:t.alt_row&&i%2===1?t.alt_row_color:'transparent',borderRadius:3}}>
              {t.col_sno    && <span style={{width:20,fontSize:fs(10),color:TL}}>{item.sno}</span>}
              <span style={{flex:1,fontSize:fs(11),color:T,paddingRight:4}}>{item.name}</span>
              {t.col_unit   && <span style={{width:th?28:36,fontSize:fs(9),color:TM,textAlign:'center'}}>{item.unit}</span>}
              {t.col_qty    && <span style={{width:th?24:32,fontSize:fs(11),color:TM,textAlign:'right'}}>{item.qty}</span>}
              {t.col_price  && <span style={{width:th?44:56,fontSize:fs(11),color:TM,textAlign:'right'}}>₹{item.price}</span>}
              {t.col_discount && <span style={{width:th?28:36,fontSize:fs(9),color:'#16A34A',textAlign:'right'}}>{item.disc}%</span>}
              {t.col_tax_rate && <span style={{width:th?32:40,fontSize:fs(9),color:TL,textAlign:'right'}}>{item.taxRate}%</span>}
              {t.col_hsn    && <span style={{width:th?36:44,fontSize:fs(8),color:TL,textAlign:'right'}}>{item.hsn}</span>}
              {t.col_total  && <span style={{width:th?48:60,fontSize:fs(11),color:T,fontWeight:600,textAlign:'right'}}>₹{item.total}</span>}
            </div>
          ))}
        </div>

        {div}

        {/* Totals */}
        <div style={{marginBottom:th?4:8}}>
          {t.show_subtotal         && <Row l="Subtotal"   v={`₹${SAMPLE.subtotal}`}/>}
          {t.show_discount_total   && <Row l="Discount"   v={`-₹${SAMPLE.discount}`}/>}
          {t.show_tax_total && !t.show_cgst_sgst && <Row l="GST"  v={`₹${SAMPLE.totalTax}`}/>}
          {t.show_tax_total && t.show_cgst_sgst && (
            <>
              <Row l="CGST" v={`₹${SAMPLE.cgst}`}/>
              <Row l="SGST" v={`₹${SAMPLE.sgst}`}/>
            </>
          )}
          <div style={{display:'flex',justifyContent:'space-between',fontWeight:800,fontSize:fs(15),marginTop:th?5:8,paddingTop:th?5:8,borderTop:`2px solid ${brand}`}}>
            <span style={{color:T}}>TOTAL</span>
            <span style={{color:T}}>₹{SAMPLE.total}</span>
          </div>
        </div>

        {/* Payment */}
        {t.show_payment && (
          <>
            {div}
            <div style={{marginBottom:th?4:8}}>
              {t.show_payment_mode  && <Row l="Payment"   v={SAMPLE.payment} bold/>}
              {t.show_amount_paid   && <Row l="Paid"      v={`₹${SAMPLE.paid}`}/>}
              {t.show_change        && <Row l="Change"    v={`₹${SAMPLE.change}`}/>}
              {t.show_upi_id && t.upi_id && <div style={{textAlign:'center',fontSize:fs(9),color:TL,marginTop:4}}>{t.upi_id}</div>}
            </div>
          </>
        )}

        {/* Loyalty */}
        {t.show_loyalty && (
          <>
            {div}
            <div style={{background:`${accent}12`,border:`1px solid ${accent}25`,borderRadius:6,padding:th?'6px 10px':'10px 16px',textAlign:'center',marginBottom:th?4:8}}>
              <div style={{fontSize:fs(9),color:TL}}>Loyalty Points Balance</div>
              <div style={{fontWeight:800,fontSize:fs(16),color:T}}>{SAMPLE.loyalty + SAMPLE.earned} pts</div>
              <div style={{fontSize:fs(9),color:TL}}>+{SAMPLE.earned} earned this visit</div>
            </div>
          </>
        )}

        {/* Return policy */}
        {t.show_return_policy && t.return_policy && (
          <>
            {div}
            <div style={{fontSize:fs(9),color:TL,textAlign:'center',fontStyle:'italic',marginBottom:th?4:6}}>
              {t.return_policy}
            </div>
          </>
        )}

        {/* Signature */}
        {t.show_signature && (
          <>
            {div}
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:th?4:8}}>
              <div style={{textAlign:'center',minWidth:100}}>
                <div style={{borderBottom:`1px solid ${T}`,marginBottom:3,height:th?20:28}}/>
                <div style={{fontSize:fs(9),color:TL}}>{t.signature_label||'Authorised Signatory'}</div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        {t.show_footer && t.footer_msg && (
          <>
            {div}
            <div style={{textAlign:'center',fontSize:fs(10),color:TM,lineHeight:1.7,paddingBottom:th?4:8}}>{t.footer_msg}</div>
          </>
        )}

        {t.show_powered_by && (
          <div style={{textAlign:'center',fontSize:fs(7),color:'#D1D5DB',marginTop:4}}>Powered by Business Pro</div>
        )}
      </div>
    </div>
  );
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────
function Card({ title, icon, badge, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-[18px] border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={()=>setOpen(p=>!p)} className="w-full px-5 py-3 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200 flex items-center gap-2 hover:bg-gray-100 transition-colors">
        <span className="text-base">{icon}</span>
        <span className="font-bold text-[#0F172A] text-sm flex-1 text-left">{title}</span>
        {badge && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{badge}</span>}
        <span className="text-gray-400 text-xs">{open?'▲':'▼'}</span>
      </button>
      {open && <div className="p-5 space-y-4">{children}</div>}
    </div>
  );
}
const L = ({children}) => <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">{children}</label>;
const TI = ({value,onChange,placeholder,mono}) => (
  <input value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder||''}
    className={`w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400 ${mono?'font-mono':''}`}/>
);
const TA = ({value,onChange,placeholder,rows=3}) => (
  <textarea value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder||''} rows={rows}
    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-400 resize-none"/>
);
const Toggle = ({label,sub,checked,onChange}) => (
  <label className="flex items-start justify-between py-2 cursor-pointer select-none gap-3">
    <div>
      <div className="text-sm text-[#0F172A] font-medium leading-tight">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
    <div onClick={e=>{e.preventDefault();onChange();}} className={`relative w-10 h-5 rounded-full flex-shrink-0 cursor-pointer transition-colors mt-0.5 ${checked?'bg-blue-600':'bg-gray-300'}`}>
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked?'translate-x-5':'translate-x-0'}`}/>
    </div>
  </label>
);
const ColorRow = ({label,value,onChange}) => (
  <div>
    <L>{label}</L>
    <div className="flex items-center gap-2">
      <input type="color" value={value||'#000000'} onChange={e=>onChange(e.target.value)}
        className="w-10 h-9 rounded-lg border border-gray-300 cursor-pointer p-0.5 flex-shrink-0"/>
      <input value={value||''} onChange={e=>onChange(e.target.value)}
        className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"/>
    </div>
  </div>
);
const Pill = ({active,onClick,children}) => (
  <button onClick={onClick}
    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${active?'bg-[#0F172A] text-white border-transparent':'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}>
    {children}
  </button>
);

// ─── Main Designer ────────────────────────────────────────────────────────────
export default function RetailInvoiceDesigner() {
  const { supabase } = useTenant();
  const [templates,  setTemplates]  = useState([]);
  const [activeId,   setActiveId]   = useState(null);
  const [t,          setT]          = useState(defaultTpl());
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState('');
  const [zoom,       setZoom]       = useState(100);
  const [delConfirm, setDelConfirm] = useState(null);
  const [tab,        setTab]        = useState('store');
  const logoRef = useRef(null);

  useEffect(()=>{ load(); },[]);
  const showToast = (m,type='ok') => { setToast({m,type}); setTimeout(()=>setToast(''),2500); };
  const upd = (k,v) => setT(p=>({...p,[k]:v}));

  async function load() {
    if(!supabase) return;
    const {data} = await supabase.from('retail_invoice_templates').select('*').order('created_at');
    if(data) setTemplates(data);
  }

  async function save() {
    if(!supabase) return;
    setSaving(true);
    const COLS = ['name','headline','sub_headline','paper_size','font_family','font_size',
      'brand_color','accent_color','bg_color','watermark',
      'show_logo','logo_url','logo_position','logo_size',
      'store_name','store_tagline','store_address','store_phone','store_email','store_website','store_gstin',
      'header_align','show_store_info','show_gst_header',
      'show_invoice_number','show_date','show_cashier','show_barcode','show_qr_code',
      'show_customer','show_customer_phone','show_customer_gstin',
      'col_sno','col_item','col_qty','col_unit','col_price','col_discount','col_hsn','col_total',
      'alt_row','alt_row_color','show_subtotal','show_discount_total','show_tax_total','show_cgst_sgst','show_round_off',
      'tax_regime','default_gst_rate','place_of_supply',
      'show_payment','show_payment_mode','show_amount_paid','show_change','show_upi_id','upi_id',
      'show_loyalty','show_return_policy','return_policy','show_signature','signature_label',
      'show_footer','footer_msg','show_powered_by','show_dividers','border_style'];
    const payload = {updated_at: new Date().toISOString()};
    COLS.forEach(k => { if((t)[k]!==undefined) payload[k]=(t)[k]; });
    let err = null;
    if(activeId) {
      const {error} = await supabase.from('retail_invoice_templates').update(payload).eq('id',activeId);
      err=error;
    } else {
      const {data:d,error} = await supabase.from('retail_invoice_templates').insert({...payload,created_at:new Date().toISOString()}).select().single();
      err=error; if(d&&!error) setActiveId(d.id);
    }
    if(err) { showToast('Save failed: '+err.message,'err'); setSaving(false); return; }
    setSaving(false); showToast('✓ Template saved'); await load();
  }

  async function del(id) {
    if(!supabase) return;
    await supabase.from('retail_invoice_templates').delete().eq('id',id);
    if(activeId===id){setActiveId(null);setT(defaultTpl());}
    setDelConfirm(null); await load();
  }

  async function setDefault(id) {
    if(!supabase) return;
    await supabase.from('retail_invoice_templates').update({is_default:false}).neq('id',id);
    await supabase.from('retail_invoice_templates').update({is_default:true}).eq('id',id);
    showToast('★ Set as default'); await load();
  }

  async function uploadLogo(file) {
    if(!file) return;
    // Use FileReader to convert to base64 for immediate preview
    // AND upload to storage for persistence
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      // Show preview immediately using data URL
      upd('logo_url', dataUrl);
      upd('show_logo', true);
      showToast('✓ Logo loaded — save template to persist');
    };
    reader.readAsDataURL(file);

    // Also upload to Supabase storage if available
    if(supabase) {
      try {
        const ext = file.name.split('.').pop();
        const path = `logos/retail_${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true });
        if(!error) {
          const { data: pub } = supabase.storage.from('assets').getPublicUrl(path);
          if(pub?.publicUrl) {
            upd('logo_url', pub.publicUrl);
            showToast('✓ Logo uploaded & saved to storage');
          }
        }
      } catch(e) {
        // Storage upload failed, data URL preview still works
        console.warn('[Logo] Storage upload failed, using data URL:', e);
      }
    }
  }

  const sCls = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400';

  const TABS = [
    {k:'store',  l:'Store',   icon:'🏪'},
    {k:'layout', l:'Layout',  icon:'📐'},
    {k:'items',  l:'Items',   icon:'📋'},
    {k:'tax',    l:'Tax',     icon:'🧾'},
    {k:'extras', l:'Extras',  icon:'✨'},
  ];

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[9999] px-5 py-3 rounded-2xl shadow-2xl font-semibold text-sm text-white ${toast.type==='err'?'bg-red-500':'bg-[#0F172A]'}`}>
          {toast.m}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-purple-700 rounded-[24px] p-6 text-white">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">🧾 Retail Invoice Designer</h2>
            <p className="text-purple-200 text-sm mt-1">Design receipts and invoices for your retail store — thermal, A5 & A4 formats with live preview.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={()=>{setActiveId(null);setT(defaultTpl());setTab('store');}}
              className="bg-white/15 hover:bg-white/25 text-white border border-white/20 px-4 py-2.5 rounded-xl text-sm font-semibold">
              + New
            </button>
            <button onClick={save} disabled={saving}
              className="bg-white text-purple-900 px-5 py-2.5 rounded-xl text-sm font-bold shadow hover:bg-purple-50 disabled:opacity-50">
              {saving?'Saving…':'💾 Save Template'}
            </button>
          </div>
        </div>

        {/* Saved templates */}
        {templates.length>0 && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {templates.map(tmpl=>(
              <div key={tmpl.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm border cursor-pointer transition-all font-semibold ${activeId===tmpl.id?'bg-white text-purple-900 border-white shadow':'bg-white/12 text-white border-white/20 hover:bg-white/20'}`}>
                <span onClick={()=>{setActiveId(tmpl.id);setT({...defaultTpl(),...tmpl});setTab('store');}}>
                  {tmpl.is_default?'★ ':''}{tmpl.name}
                </span>
                {activeId===tmpl.id && (
                  <button onClick={()=>setDefault(tmpl.id)} title="Set as default" className="opacity-60 hover:opacity-100 text-xs">★</button>
                )}
                <button onClick={()=>setDelConfirm(tmpl.id)} className="opacity-40 hover:opacity-100 text-xs">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {delConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-[16px] p-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-red-700">Delete this template permanently?</span>
          <div className="flex gap-2">
            <button onClick={()=>setDelConfirm(null)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl font-semibold text-gray-600">Cancel</button>
            <button onClick={()=>del(delConfirm)} className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-xl font-bold">Delete</button>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5 items-start">

        {/* ── Controls ── */}
        <div className="space-y-4">

          {/* Tab nav */}
          <div className="flex bg-white border border-gray-200 rounded-[18px] p-1 gap-1 shadow-sm">
            {TABS.map(tb=>(
              <button key={tb.k} onClick={()=>setTab(tb.k)}
                className={`flex-1 flex flex-col items-center py-2 px-1 rounded-[14px] text-xs font-bold transition-all ${tab===tb.k?'bg-[#0F172A] text-white shadow':'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>
                <span className="text-sm mb-0.5">{tb.icon}</span>{tb.l}
              </button>
            ))}
          </div>

          {/* ─ Store Tab ─ */}
          {tab==='store' && <>
            <Card title="Template Identity" icon="📝">
              <div><L>Template Name</L><TI value={t.name} onChange={v=>upd('name',v)} placeholder="e.g. POS Thermal Receipt"/></div>
              <div><L>Headline</L><TI value={t.headline} onChange={v=>upd('headline',v)} placeholder="RECEIPT"/></div>
              <div><L>Sub-headline</L><TI value={t.sub_headline} onChange={v=>upd('sub_headline',v)} placeholder="e.g. TAX INVOICE · GST Invoice"/></div>
            </Card>

            <Card title="Store Information" icon="🏪">
              <div><L>Store Name</L><TI value={t.store_name} onChange={v=>upd('store_name',v)} placeholder="Your Store Name"/></div>
              <div><L>Tagline</L><TI value={t.store_tagline} onChange={v=>upd('store_tagline',v)} placeholder="Quality you can trust"/></div>
              <div><L>Address</L><TI value={t.store_address} onChange={v=>upd('store_address',v)} placeholder="123 Market St, Mumbai 400001"/></div>
              <div><L>Phone</L><TI value={t.store_phone} onChange={v=>upd('store_phone',v)} placeholder="+91 98765 43210"/></div>
              <div><L>Email</L><TI value={t.store_email} onChange={v=>upd('store_email',v)} placeholder="store@example.com"/></div>
              <div><L>Website</L><TI value={t.store_website} onChange={v=>upd('store_website',v)} placeholder="www.example.com"/></div>
              <div><L>GSTIN</L><TI value={t.store_gstin} onChange={v=>upd('store_gstin',v)} placeholder="27AABCR1234M1ZA" mono/></div>
              <Toggle label="Show GSTIN in header" checked={!!t.show_gst_header} onChange={()=>upd('show_gst_header',!t.show_gst_header)}/>
            </Card>

            <Card title="Logo" icon="🖼️">
              <Toggle label="Show Logo" checked={!!t.show_logo} onChange={()=>upd('show_logo',!t.show_logo)}/>
              {t.show_logo && <>
                <div>
                  <L>Upload Logo</L>
                  <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e=>uploadLogo(e.target.files?.[0])}/>
                  <button onClick={()=>logoRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-xl py-3 text-sm text-gray-500 hover:text-purple-600 font-semibold transition-all">
                    {t.logo_url?'🔄 Change Logo':'+ Upload Logo Image'}
                  </button>
                  {t.logo_url && <div className="mt-2 flex items-center gap-2">
                    <img src={t.logo_url} className="h-10 rounded border border-gray-200 object-contain" alt="logo"/>
                    <button onClick={()=>{upd('logo_url','');upd('show_logo',false);}} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </div>}
                </div>
                <div><L>Position</L>
                  <div className="flex gap-2">{LOGO_POS.map(p=><Pill key={p} active={t.logo_position===p} onClick={()=>upd('logo_position',p)}>{p.charAt(0).toUpperCase()+p.slice(1)}</Pill>)}</div>
                </div>
                <div><L>Size — {t.logo_size||48}px</L>
                  <input type="range" min={24} max={120} value={t.logo_size||48} onChange={e=>upd('logo_size',Number(e.target.value))} className="w-full accent-purple-600"/>
                </div>
              </>}
            </Card>

            <Card title="Branding & Colors" icon="🎨">
              <ColorRow label="Brand / Header Color" value={t.brand_color} onChange={v=>upd('brand_color',v)}/>
              <ColorRow label="Accent Color" value={t.accent_color} onChange={v=>upd('accent_color',v)}/>
              <ColorRow label="Background" value={t.bg_color} onChange={v=>upd('bg_color',v)}/>
              <div><L>Watermark</L>
                <div className="flex flex-wrap gap-1.5">
                  {WATERMARKS.map(w=><Pill key={w} active={t.watermark===w} onClick={()=>upd('watermark',w)}>{w||'None'}</Pill>)}
                </div>
              </div>
            </Card>
          </>}

          {/* ─ Layout Tab ─ */}
          {tab==='layout' && <>
            <Card title="Paper & Font" icon="📄">
              <div><L>Paper Size</L>
                <div className="space-y-1.5">
                  {PAPER_SIZES.map(s=>(
                    <button key={s.v} onClick={()=>upd('paper_size',s.v)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${t.paper_size===s.v?'bg-[#0F172A] text-white border-transparent shadow':'bg-gray-50 text-gray-700 border-gray-200 hover:border-purple-300'}`}>
                      <span className="flex items-center gap-2">
                        {s.l}
                        {s.thermal && <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${t.paper_size===s.v?'bg-white/20 text-white':'bg-orange-100 text-orange-600'}`}>THERMAL</span>}
                      </span>
                      <span className={`text-xs ${t.paper_size===s.v?'text-white/60':'text-gray-400'}`}>{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div><L>Font Family</L>
                <div className="space-y-1.5">
                  {FONTS.map(f=>(
                    <button key={f.v} onClick={()=>upd('font_family',f.v)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm transition-all ${t.font_family===f.v?'bg-[#0F172A] text-white border-transparent':'bg-gray-50 text-gray-700 border-gray-200 hover:border-purple-300'}`}>
                      <span className="font-semibold">{f.l}</span>
                      <span className={`text-xs ${t.font_family===f.v?'text-white/60':'text-gray-400'}`} style={{fontFamily:f.v}}>{f.d}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div><L>Font Size — {t.font_size||11}px</L>
                <input type="range" min={8} max={14} value={t.font_size||11} onChange={e=>upd('font_size',Number(e.target.value))} className="w-full accent-purple-600"/>
              </div>
            </Card>

            <Card title="Header Layout" icon="⬆️">
              <div><L>Header Alignment</L>
                <div className="flex gap-2">
                  {['left','center','right'].map(h=><Pill key={h} active={t.header_align===h} onClick={()=>upd('header_align',h)}>{h==='left'?'⬅ Left':h==='center'?'⊙ Center':'➡ Right'}</Pill>)}
                </div>
              </div>
              <Toggle label="Show Store Info" sub="Address, phone, email" checked={!!t.show_store_info} onChange={()=>upd('show_store_info',!t.show_store_info)}/>
            </Card>

            <Card title="Invoice Meta" icon="🔢">
              <Toggle label="Invoice Number"  checked={!!t.show_invoice_number} onChange={()=>upd('show_invoice_number',!t.show_invoice_number)}/>
              <Toggle label="Date & Time"     checked={!!t.show_date}           onChange={()=>upd('show_date',!t.show_date)}/>
              <Toggle label="Cashier Name"    checked={!!t.show_cashier}        onChange={()=>upd('show_cashier',!t.show_cashier)}/>
              <Toggle label="Barcode"         sub="Visual barcode placeholder"  checked={!!t.show_barcode}  onChange={()=>upd('show_barcode',!t.show_barcode)}/>
              <Toggle label="QR Code Box"     sub="UPI / scan box placeholder"  checked={!!t.show_qr_code}  onChange={()=>upd('show_qr_code',!t.show_qr_code)}/>
            </Card>

            <Card title="Customer Info" icon="👤">
              <Toggle label="Show Customer Block" checked={!!t.show_customer}        onChange={()=>upd('show_customer',!t.show_customer)}/>
              {t.show_customer && <>
                <Toggle label="Customer Phone"    checked={!!t.show_customer_phone}  onChange={()=>upd('show_customer_phone',!t.show_customer_phone)}/>
                <Toggle label="Customer GSTIN"    checked={!!t.show_customer_gstin}  onChange={()=>upd('show_customer_gstin',!t.show_customer_gstin)}/>
              </>}
            </Card>

            <Card title="Dividers" icon="➖">
              <Toggle label="Show Dividers" checked={!!t.show_dividers} onChange={()=>upd('show_dividers',!t.show_dividers)}/>
              {t.show_dividers && (
                <div><L>Divider Style</L>
                  <div className="flex gap-2">
                    {['dashed','solid','none'].map(s=><Pill key={s} active={t.border_style===s} onClick={()=>upd('border_style',s)}>{s.charAt(0).toUpperCase()+s.slice(1)}</Pill>)}
                  </div>
                </div>
              )}
            </Card>
          </>}

          {/* ─ Items Tab ─ */}
          {tab==='items' && <>
            <Card title="Line Item Columns" icon="📊">
              <p className="text-xs text-gray-400 -mt-1">Choose which columns appear in the items table.</p>
              <Toggle label="Sr. No."       checked={!!t.col_sno}      onChange={()=>upd('col_sno',!t.col_sno)}/>
              <Toggle label="Item Name"     checked={t.col_item!==false} onChange={()=>upd('col_item',!(t.col_item!==false))}/>
              <Toggle label="Unit"          checked={!!t.col_unit}     onChange={()=>upd('col_unit',!t.col_unit)}/>
              <Toggle label="Quantity"      checked={t.col_qty!==false} onChange={()=>upd('col_qty',!(t.col_qty!==false))}/>
              <Toggle label="Unit Price"    checked={t.col_price!==false} onChange={()=>upd('col_price',!(t.col_price!==false))}/>
              <Toggle label="Discount %"    checked={!!t.col_discount}  onChange={()=>upd('col_discount',!t.col_discount)}/>
              <Toggle label="GST Rate %"    checked={!!t.col_tax_rate}  onChange={()=>upd('col_tax_rate',!t.col_tax_rate)}/>
              <Toggle label="HSN / SAC"     checked={!!t.col_hsn}       onChange={()=>upd('col_hsn',!t.col_hsn)}/>
              <Toggle label="Line Total"    checked={t.col_total!==false} onChange={()=>upd('col_total',!(t.col_total!==false))}/>
            </Card>

            <Card title="Row Styling" icon="🎨">
              <Toggle label="Alternate Row Shading" checked={!!t.alt_row} onChange={()=>upd('alt_row',!t.alt_row)}/>
              {t.alt_row && <ColorRow label="Alt Row Color" value={t.alt_row_color} onChange={v=>upd('alt_row_color',v)}/>}
            </Card>
          </>}

          {/* ─ Tax Tab ─ */}
          {tab==='tax' && <>
            <Card title="Tax Settings" icon="🧾">
              <div><L>Tax Regime</L>
                <div className="space-y-2">
                  {[{v:'gst',l:'GST (CGST + SGST / IGST)',d:'India standard — splits tax by supply state'},
                    {v:'inclusive',l:'Tax Inclusive',d:'Price already includes tax'},
                    {v:'exempt',l:'Tax Exempt',d:'No tax on items'}].map(r=>(
                    <button key={r.v} onClick={()=>upd('tax_regime',r.v)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${t.tax_regime===r.v?'bg-[#0F172A] text-white border-transparent':'bg-gray-50 border-gray-200 hover:border-purple-300'}`}>
                      <div className="font-semibold">{r.l}</div>
                      <div className={`text-xs mt-0.5 ${t.tax_regime===r.v?'text-white/60':'text-gray-400'}`}>{r.d}</div>
                    </button>
                  ))}
                </div>
              </div>
              {t.tax_regime==='gst' && <>
                <div><L>Default GST Rate</L>
                  <div className="flex flex-wrap gap-1.5">
                    {GST_RATES.map(r=><Pill key={r} active={t.default_gst_rate===r} onClick={()=>upd('default_gst_rate',r)}>{r}%</Pill>)}
                  </div>
                </div>
                <div><L>Place of Supply (State)</L>
                  <select value={t.place_of_supply} onChange={e=>upd('place_of_supply',e.target.value)} className={sCls}>
                    {INDIA_STATES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </>}
            </Card>

            <Card title="Totals Display" icon="💰">
              <Toggle label="Show Subtotal"        checked={!!t.show_subtotal}       onChange={()=>upd('show_subtotal',!t.show_subtotal)}/>
              <Toggle label="Show Discount Total"  checked={!!t.show_discount_total} onChange={()=>upd('show_discount_total',!t.show_discount_total)}/>
              <Toggle label="Show Tax Total"       checked={!!t.show_tax_total}      onChange={()=>upd('show_tax_total',!t.show_tax_total)}/>
              {t.show_tax_total && (
                <Toggle label="Split CGST / SGST"  sub="Shows separate CGST and SGST lines instead of combined GST" checked={!!t.show_cgst_sgst} onChange={()=>upd('show_cgst_sgst',!t.show_cgst_sgst)}/>
              )}
              <Toggle label="Show Round-off"       checked={!!t.show_round_off}      onChange={()=>upd('show_round_off',!t.show_round_off)}/>
            </Card>

            <Card title="Payment Section" icon="💳">
              <Toggle label="Show Payment Block"   checked={!!t.show_payment}      onChange={()=>upd('show_payment',!t.show_payment)}/>
              {t.show_payment && <>
                <Toggle label="Payment Mode"       checked={!!t.show_payment_mode}  onChange={()=>upd('show_payment_mode',!t.show_payment_mode)}/>
                <Toggle label="Amount Paid"        checked={!!t.show_amount_paid}   onChange={()=>upd('show_amount_paid',!t.show_amount_paid)}/>
                <Toggle label="Change / Balance"   checked={!!t.show_change}        onChange={()=>upd('show_change',!t.show_change)}/>
                <Toggle label="UPI ID on receipt"  checked={!!t.show_upi_id}        onChange={()=>upd('show_upi_id',!t.show_upi_id)}/>
                {t.show_upi_id && <div><L>UPI ID</L><TI value={t.upi_id} onChange={v=>upd('upi_id',v)} placeholder="yourstore@upi" mono/></div>}
              </>}
            </Card>
          </>}

          {/* ─ Extras Tab ─ */}
          {tab==='extras' && <>
            <Card title="Loyalty Points" icon="🎁">
              <Toggle label="Show Loyalty Section" sub="Displays points balance and earned points" checked={!!t.show_loyalty} onChange={()=>upd('show_loyalty',!t.show_loyalty)}/>
            </Card>

            <Card title="Return Policy" icon="🔄">
              <Toggle label="Show Return Policy" checked={!!t.show_return_policy} onChange={()=>upd('show_return_policy',!t.show_return_policy)}/>
              {t.show_return_policy && (
                <div><L>Policy Text</L>
                  <TA value={t.return_policy} onChange={v=>upd('return_policy',v)} placeholder="Returns accepted within 7 days..." rows={3}/>
                </div>
              )}
            </Card>

            <Card title="Signature" icon="✍️">
              <Toggle label="Show Signature Line" sub="Adds a signature space at the bottom" checked={!!t.show_signature} onChange={()=>upd('show_signature',!t.show_signature)}/>
              {t.show_signature && <div><L>Signature Label</L><TI value={t.signature_label} onChange={v=>upd('signature_label',v)} placeholder="Authorised Signatory"/></div>}
            </Card>

            <Card title="Footer" icon="📝">
              <Toggle label="Show Footer Message" checked={!!t.show_footer} onChange={()=>upd('show_footer',!t.show_footer)}/>
              {t.show_footer && <div><L>Footer Message</L><TA value={t.footer_msg} onChange={v=>upd('footer_msg',v)} placeholder="Thank you for shopping!"/></div>}
              <Toggle label="Show 'Powered by Business Pro'" checked={!!t.show_powered_by} onChange={()=>upd('show_powered_by',!t.show_powered_by)}/>
            </Card>
          </>}
        </div>

        {/* ── Live Preview ── */}
        <div className="sticky top-4">
          <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#0F172A] to-slate-700 px-5 py-3 flex items-center justify-between">
              <div>
                <span className="text-white font-bold text-sm">Live Preview</span>
                <span className="text-white/50 text-xs ml-2">{PAPER_SIZES.find(s=>s.v===t.paper_size)?.l}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={()=>setZoom(z=>Math.max(40,z-10))} className="text-white/60 hover:text-white w-7 h-7 flex items-center justify-center text-lg font-bold rounded-lg hover:bg-white/10">−</button>
                <span className="text-white text-xs w-10 text-center font-mono">{zoom}%</span>
                <button onClick={()=>setZoom(z=>Math.min(150,z+10))} className="text-white/60 hover:text-white w-7 h-7 flex items-center justify-center text-lg font-bold rounded-lg hover:bg-white/10">+</button>
                <button onClick={()=>setZoom(100)} className="text-white/40 hover:text-white text-xs ml-1 px-2 py-1 rounded-lg hover:bg-white/10">Reset</button>
              </div>
            </div>
            <div className="p-6 overflow-auto bg-gray-100" style={{minHeight:500,maxHeight:'80vh'}}>
              <div style={{transform:`scale(${zoom/100})`,transformOrigin:'top center',transition:'transform 0.15s',paddingBottom: zoom<80 ? `${(1-zoom/100)*500}px` : 0}}>
                <LivePreview t={t}/>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          {activeId && (
            <div className="mt-3 flex gap-2">
              <button onClick={()=>setDefault(activeId)} className="flex-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 py-2 rounded-xl hover:bg-amber-100">
                ★ Set as Default
              </button>
              <button onClick={()=>setDelConfirm(activeId)} className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 py-2 px-4 rounded-xl hover:bg-red-100">
                🗑 Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
