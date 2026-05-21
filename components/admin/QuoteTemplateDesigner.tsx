// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';

const DEFAULT_SECTIONS = [
  { id:'header',    type:'header',    name:'Header Banner',     enabled:true, order:1, settings:{ bgColor:'#0F172A', textColor:'#FFFFFF', showLogo:false, logoUrl:'', companyName:'Business Pro', tagline:'Enterprise Solutions' } },
  { id:'quote_info',type:'quote_info',name:'Quote Information', enabled:true, order:2, settings:{ bgColor:'#F8FAFC', textColor:'#0F172A' } },
  { id:'customer',  type:'customer',  name:'Customer Details',  enabled:true, order:3, settings:{ bgColor:'#FFFFFF', textColor:'#0F172A', showBillTo:true, showShipTo:true } },
  { id:'items',     type:'items',     name:'Line Items Table',  enabled:true, order:4, settings:{ headerBgColor:'#0F172A', headerTextColor:'#FFFFFF', stripedRows:true, showProductCode:false, showDiscount:true, showTax:true } },
  { id:'totals',    type:'totals',    name:'Pricing Summary',   enabled:true, order:5, settings:{ bgColor:'#F8FAFC', accentColor:'#0F172A', showShipping:true, showTax:true } },
  { id:'terms',     type:'terms',     name:'Terms & Conditions',enabled:true, order:6, settings:{ content:'Payment is due within the terms specified. All prices are subject to applicable taxes. This quotation is valid until the validity date mentioned.' } },
  { id:'footer',    type:'footer',    name:'Footer',            enabled:true, order:7, settings:{ bgColor:'#0F172A', textColor:'#FFFFFF', showSignature:true, signatureLabel:'Authorized Signature', footerText:'' } },
];

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';
const tCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none';

function ColorField({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-28 flex-shrink-0">{label}</label>
      <div className="flex items-center gap-2 flex-1">
        <input type="color" value={value||'#000000'} onChange={e=>onChange(e.target.value)} className="w-8 h-8 rounded-lg border border-blue-200 cursor-pointer"/>
        <input value={value||''} onChange={e=>onChange(e.target.value)} className="flex-1 border border-blue-200 rounded-lg px-2 py-1 text-xs text-[#0F172A] focus:outline-none"/>
      </div>
    </div>
  );
}

function SectionSettings({ section, onUpdate }) {
  const s = section.settings || {};
  const upd = (k,v) => onUpdate({ ...section, settings: { ...s, [k]: v } });

  const Toggle = ({ label, field }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={!!s[field]} onChange={e=>upd(field,e.target.checked)} className="w-4 h-4 accent-blue-600"/>
      <span className="text-xs text-[#0F172A]">{label}</span>
    </label>
  );

  switch(section.type) {
    case 'header': return (
      <div className="space-y-3 pt-2">
        <div><label className="text-xs text-gray-500 block mb-1">Company Name</label><input value={s.companyName||''} onChange={e=>upd('companyName',e.target.value)} className={iCls}/></div>
        <div><label className="text-xs text-gray-500 block mb-1">Tagline</label><input value={s.tagline||''} onChange={e=>upd('tagline',e.target.value)} className={iCls}/></div>
        <ColorField label="Background" value={s.bgColor} onChange={v=>upd('bgColor',v)}/>
        <ColorField label="Text Color" value={s.textColor} onChange={v=>upd('textColor',v)}/>
        <Toggle label="Show Logo" field="showLogo"/>
        {s.showLogo && <div><label className="text-xs text-gray-500 block mb-1">Logo URL</label><input value={s.logoUrl||''} onChange={e=>upd('logoUrl',e.target.value)} placeholder="https://..." className={iCls}/></div>}
      </div>
    );
    case 'quote_info': return (
      <div className="space-y-3 pt-2">
        <ColorField label="Background" value={s.bgColor} onChange={v=>upd('bgColor',v)}/>
        <ColorField label="Text Color"  value={s.textColor} onChange={v=>upd('textColor',v)}/>
      </div>
    );
    case 'customer': return (
      <div className="space-y-3 pt-2">
        <ColorField label="Background" value={s.bgColor} onChange={v=>upd('bgColor',v)}/>
        <Toggle label="Show Bill To"  field="showBillTo"/>
        <Toggle label="Show Ship To" field="showShipTo"/>
      </div>
    );
    case 'items': return (
      <div className="space-y-3 pt-2">
        <ColorField label="Header BG"   value={s.headerBgColor}   onChange={v=>upd('headerBgColor',v)}/>
        <ColorField label="Header Text" value={s.headerTextColor} onChange={v=>upd('headerTextColor',v)}/>
        <Toggle label="Striped Rows"    field="stripedRows"/>
        <Toggle label="Show Product Code" field="showProductCode"/>
        <Toggle label="Show Discount"   field="showDiscount"/>
        <Toggle label="Show Tax"        field="showTax"/>
      </div>
    );
    case 'totals': return (
      <div className="space-y-3 pt-2">
        <ColorField label="Background"   value={s.bgColor}     onChange={v=>upd('bgColor',v)}/>
        <ColorField label="Accent Color" value={s.accentColor} onChange={v=>upd('accentColor',v)}/>
        <Toggle label="Show Shipping" field="showShipping"/>
        <Toggle label="Show Tax"      field="showTax"/>
      </div>
    );
    case 'terms': return (
      <div className="space-y-3 pt-2">
        <div><label className="text-xs text-gray-500 block mb-1">Terms & Conditions Text</label><textarea rows={6} value={s.content||''} onChange={e=>upd('content',e.target.value)} className={tCls}/></div>
      </div>
    );
    case 'footer': return (
      <div className="space-y-3 pt-2">
        <ColorField label="Background" value={s.bgColor}    onChange={v=>upd('bgColor',v)}/>
        <ColorField label="Text Color" value={s.textColor}  onChange={v=>upd('textColor',v)}/>
        <Toggle label="Show Signature Block" field="showSignature"/>
        {s.showSignature && <div><label className="text-xs text-gray-500 block mb-1">Signature Label</label><input value={s.signatureLabel||''} onChange={e=>upd('signatureLabel',e.target.value)} className={iCls}/></div>}
        <div><label className="text-xs text-gray-500 block mb-1">Footer Text</label><input value={s.footerText||''} onChange={e=>upd('footerText',e.target.value)} placeholder="Company address, website..." className={iCls}/></div>
      </div>
    );
    default: return null;
  }
}

function LivePreview({ sections, form }) {
  const enabled = sections.filter(s=>s.enabled).sort((a,b)=>a.order-b.order);
  const renderSection = (sec) => {
    const s = sec.settings || {};
    switch(sec.type) {
      case 'header': return <div key={sec.id} style={{background:s.bgColor,color:s.textColor,padding:'20px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontWeight:700,fontSize:16}}>{s.companyName||'Company Name'}</div><div style={{fontSize:11,opacity:0.7,marginTop:2}}>{s.tagline||''}</div></div>
        <div style={{textAlign:'right'}}><div style={{fontWeight:700,fontSize:18,letterSpacing:1}}>QUOTATION</div><div style={{fontSize:11,opacity:0.7}}>#QUO-000001</div></div>
      </div>;
      case 'quote_info': return <div key={sec.id} style={{background:s.bgColor,color:s.textColor,padding:'10px 24px',borderBottom:'1px solid #E2E8F0',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,fontSize:11}}>
        {[['Quote #','QUO-000001'],['Date','01 Jan 2025'],['Valid Until','31 Jan 2025'],['Version','v1']].map(([l,v])=><div key={l}><div style={{opacity:0.5,textTransform:'uppercase',fontSize:9,marginBottom:2}}>{l}</div><div style={{fontWeight:600}}>{v}</div></div>)}
      </div>;
      case 'customer': return <div key={sec.id} style={{background:s.bgColor,padding:'12px 24px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,fontSize:11,borderBottom:'1px solid #E2E8F0'}}>
        {s.showBillTo&&<div><div style={{fontWeight:700,textTransform:'uppercase',fontSize:9,color:'#64748B',marginBottom:4}}>Bill To</div><div style={{fontWeight:600}}>Sample Customer</div><div style={{color:'#475569',marginTop:2}}>123 Business Street</div></div>}
        {s.showShipTo&&<div><div style={{fontWeight:700,textTransform:'uppercase',fontSize:9,color:'#64748B',marginBottom:4}}>Ship To</div><div style={{color:'#475569'}}>Same as billing</div></div>}
      </div>;
      case 'items': return <div key={sec.id} style={{padding:'12px 24px'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
          <thead><tr style={{background:s.headerBgColor,color:s.headerTextColor}}>
            {['#','Product',s.showProductCode&&'Code','Qty','Price',s.showDiscount&&'Disc%',s.showTax&&'Tax%','Amount'].filter(Boolean).map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:600}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {[{n:'Product A',q:2,p:5000,d:10},{n:'Service B',q:1,p:15000,d:0}].map((item,idx)=><tr key={idx} style={{background:s.stripedRows&&idx%2===1?'#F8FAFC':'#FFF'}}>
              <td style={{padding:'7px 10px',borderBottom:'1px solid #E2E8F0',color:'#94A3B8'}}>{idx+1}</td>
              <td style={{padding:'7px 10px',borderBottom:'1px solid #E2E8F0',fontWeight:500}}>{item.n}</td>
              {s.showProductCode&&<td style={{padding:'7px 10px',borderBottom:'1px solid #E2E8F0',fontFamily:'monospace',fontSize:10}}>PRD-00{idx+1}</td>}
              <td style={{padding:'7px 10px',borderBottom:'1px solid #E2E8F0'}}>{item.q}</td>
              <td style={{padding:'7px 10px',borderBottom:'1px solid #E2E8F0'}}>₹{item.p.toLocaleString()}</td>
              {s.showDiscount&&<td style={{padding:'7px 10px',borderBottom:'1px solid #E2E8F0',color:item.d>0?'#16A34A':'#94A3B8'}}>{item.d>0?`${item.d}%`:'-'}</td>}
              {s.showTax&&<td style={{padding:'7px 10px',borderBottom:'1px solid #E2E8F0',color:'#64748B'}}>18%</td>}
              <td style={{padding:'7px 10px',borderBottom:'1px solid #E2E8F0',fontWeight:600}}>₹{((item.q*item.p*(1-item.d/100))*1.18).toLocaleString()}</td>
            </tr>)}
          </tbody>
        </table>
      </div>;
      case 'totals': return <div key={sec.id} style={{background:s.bgColor,padding:'10px 24px',display:'flex',justifyContent:'flex-end'}}>
        <div style={{width:220,fontSize:11}}>
          {[['Subtotal','₹25,000'],['Discount','-₹2,500'],['Tax (18%)','₹4,050'],['GRAND TOTAL','₹26,550']].map(([l,v],i)=><div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:i<3?'1px solid #E2E8F0':'none',background:i===3?s.accentColor:'transparent',color:i===3?'#FFF':s.bgColor==='#F8FAFC'?'#0F172A':'inherit',borderRadius:i===3?6:0,padding:i===3?'8px 10px':'5px 0',marginTop:i===3?4:0}}>
          <span style={{fontWeight:i===3?700:400}}>{l}</span><span style={{fontWeight:i===3?700:600}}>{v}</span></div>)}
        </div>
      </div>;
      case 'terms': return s.content?<div key={sec.id} style={{padding:'10px 24px',borderTop:'1px solid #E2E8F0',fontSize:10,color:'#475569',lineHeight:1.6}}><div style={{fontWeight:700,textTransform:'uppercase',fontSize:9,marginBottom:4,color:'#64748B'}}>Terms & Conditions</div>{s.content.slice(0,120)}...</div>:null;
      case 'footer': return <div key={sec.id} style={{background:s.bgColor,color:s.textColor,padding:'12px 24px',display:'flex',justifyContent:'space-between',alignItems:'flex-end',fontSize:10}}>
        <div style={{opacity:0.7}}>{s.footerText||'Business Pro · enterprise solutions'}</div>
        {s.showSignature&&<div style={{textAlign:'center'}}><div style={{borderTop:`1px solid ${s.textColor}`,paddingTop:4,width:120,opacity:0.8}}>{s.signatureLabel||'Authorized Signature'}</div></div>}
      </div>;
      default: return null;
    }
  };
  return (
    <div style={{fontFamily:'Arial,sans-serif',border:'1px solid #E2E8F0',borderRadius:12,overflow:'hidden',background:'#FFF',minHeight:500}}>
      {enabled.map(renderSection)}
      <div style={{textAlign:'center',padding:8,fontSize:9,color:'#94A3B8',borderTop:'1px solid #F1F5F9'}}>Generated by Business Pro</div>
    </div>
  );
}

export default function QuoteTemplateDesigner() {
  const { quoteTemplates, saveQuoteTemplate, deleteQuoteTemplate, setDefaultTemplate } = useApp();
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [form,     setForm]     = useState({ name:'', primaryColor:'#0F172A', secondaryColor:'#3B82F6' });
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [pageSettings, setPageSettings] = useState({ fontFamily:'Arial, sans-serif', paperSize:'A4' });
  const [expandedSec, setExpandedSec] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [creating, setCreating] = useState(false);

  const loadTemplate = (t) => {
    setSelectedTemplateId(t.id);
    setForm({ name:t.name, primaryColor:t.primaryColor||'#0F172A', secondaryColor:t.secondaryColor||'#3B82F6', ...t });
    const secs = t.sections;
    setSections(secs?.length ? secs : DEFAULT_SECTIONS);
    setPageSettings(t.page_settings || { fontFamily:'Arial, sans-serif', paperSize:'A4' });
  };

  const selectedTemplate = quoteTemplates.find(t => t.id === selectedTemplateId);

  const moveSection = (idx, dir) => setSections(p => {
    const arr = [...p];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= arr.length) return p;
    [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
    return arr.map((s,i) => ({ ...s, order: i+1 }));
  });

  const updateSection = (idx, updated) => setSections(p => p.map((s,i) => i===idx ? updated : s));
  const toggleSection = (idx) => setSections(p => p.map((s,i) => i===idx ? {...s, enabled: !s.enabled} : s));

  const handleSave = async () => {
    if (!form.name?.trim()) { alert('Template name is required.'); return; }
    setSaving(true);
    await saveQuoteTemplate({ ...form, sections, page_settings: pageSettings }, selectedTemplate?.dbId || selectedTemplate?.id || null);
    setSaving(false);
    setCreating(false);
    alert('Template saved successfully!');
  };

  const SECTION_ICONS = { header:'🎨', quote_info:'📋', customer:'👤', items:'📦', totals:'💰', terms:'📝', footer:'🔚' };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0F172A]">Quote Template Designer</h2><p className="text-gray-500 text-sm">Design professional quotation templates section by section</p></div>
        <button onClick={()=>{ setSelectedTemplateId(null); setForm({name:'',primaryColor:'#0F172A',secondaryColor:'#3B82F6'}); setSections(DEFAULT_SECTIONS); setCreating(true); }} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">+ New Template</button>
      </div>

      {/* Template selector */}
      {!creating && quoteTemplates.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {quoteTemplates.map(t => (
            <button key={t.id} onClick={()=>loadTemplate(t)} className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold border transition-all ${selectedTemplateId===t.id?'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white border-transparent shadow-lg':'bg-white border-blue-100 text-[#0F172A] hover:border-blue-300'}`}>
              📄 {t.name}
              {t.isDefault&&<span className={`text-xs px-2 py-0.5 rounded-full ${selectedTemplateId===t.id?'bg-white/20 text-white':'bg-green-100 text-green-700'}`}>Default</span>}
            </button>
          ))}
        </div>
      )}

      {(creating || selectedTemplateId) && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Left: Designer panel */}
          <div className="xl:col-span-2 space-y-4">
            {/* Template basics */}
            <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg p-5 space-y-4">
              <h3 className="font-bold text-[#0F172A]">Template Settings</h3>
              <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Template Name *</label><input value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Professional Blue" className={iCls}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Font</label><select value={pageSettings.fontFamily} onChange={e=>setPageSettings(p=>({...p,fontFamily:e.target.value}))} className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"><option value="Arial, sans-serif">Arial</option><option value="'Times New Roman', serif">Times New Roman</option><option value="Georgia, serif">Georgia</option><option value="Helvetica, sans-serif">Helvetica</option></select></div>
                <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Paper Size</label><select value={pageSettings.paperSize} onChange={e=>setPageSettings(p=>({...p,paperSize:e.target.value}))} className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"><option>A4</option><option>Letter</option><option>Legal</option></select></div>
              </div>
            </div>

            {/* Sections */}
            <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3.5"><h3 className="text-white font-bold">Document Sections</h3><p className="text-blue-300 text-xs mt-0.5">Toggle, reorder, and customize each section</p></div>
              <div className="divide-y divide-blue-50">
                {sections.sort((a,b)=>a.order-b.order).map((sec, idx) => (
                  <div key={sec.id} className={`${!sec.enabled?'opacity-50':''}`}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Order buttons */}
                      <div className="flex flex-col gap-0.5">
                        <button onClick={()=>moveSection(idx,-1)} disabled={idx===0} className="w-5 h-5 rounded text-gray-400 hover:text-[#0F172A] hover:bg-blue-50 disabled:opacity-20 text-xs flex items-center justify-center">▲</button>
                        <button onClick={()=>moveSection(idx,1)} disabled={idx===sections.length-1} className="w-5 h-5 rounded text-gray-400 hover:text-[#0F172A] hover:bg-blue-50 disabled:opacity-20 text-xs flex items-center justify-center">▼</button>
                      </div>
                      {/* Toggle */}
                      <button onClick={()=>toggleSection(idx)} className={`w-10 h-5 rounded-full transition-all flex-shrink-0 ${sec.enabled?'bg-blue-600':'bg-gray-200'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ml-0.5 ${sec.enabled?'translate-x-5':''}`}/>
                      </button>
                      {/* Icon + name */}
                      <span className="text-lg">{SECTION_ICONS[sec.type]||'📄'}</span>
                      <span className="font-semibold text-[#0F172A] text-sm flex-1">{sec.name}</span>
                      {/* Expand */}
                      <button onClick={()=>setExpandedSec(expandedSec===sec.id?null:sec.id)} disabled={!sec.enabled} className="text-blue-600 text-xs font-semibold hover:underline disabled:opacity-30">
                        {expandedSec===sec.id?'▲ Less':'▼ Edit'}
                      </button>
                    </div>
                    {/* Settings panel */}
                    {expandedSec===sec.id && sec.enabled && (
                      <div className="px-4 pb-4 bg-blue-50/50 border-t border-blue-100">
                        <SectionSettings section={sec} onUpdate={updated=>updateSection(idx,updated)}/>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-50 shadow-lg hover:opacity-90">
                {saving?'Saving...':'💾 Save Template'}
              </button>
              {selectedTemplateId && !selectedTemplate?.isDefault && (
                <button onClick={()=>setDefaultTemplate(selectedTemplateId)} className="bg-green-100 hover:bg-green-200 text-green-700 px-4 py-3 rounded-2xl font-semibold text-sm">Set Default</button>
              )}
              {selectedTemplateId && (
                <button onClick={()=>{ deleteQuoteTemplate(selectedTemplate?.dbId||selectedTemplateId); setSelectedTemplateId(null); setSections(DEFAULT_SECTIONS); }} className="bg-red-100 hover:bg-red-200 text-red-500 px-4 py-3 rounded-2xl font-semibold text-sm">Delete</button>
              )}
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden sticky top-4">
              <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3.5 flex items-center gap-3">
                <h3 className="text-white font-bold flex-1">Live Preview</h3>
                <span className="text-blue-300 text-xs">Updates in real-time as you edit</span>
              </div>
              <div className="p-4 overflow-y-auto" style={{maxHeight:'75vh'}}>
                <LivePreview sections={sections} form={form}/>
              </div>
            </div>
          </div>
        </div>
      )}

      {!creating && !selectedTemplateId && quoteTemplates.length === 0 && (
        <div className="py-16 text-center bg-white rounded-[24px] border border-blue-100 shadow">
          <div className="text-6xl mb-4">📄</div>
          <h2 className="text-xl font-bold text-[#0F172A] mb-2">No templates yet</h2>
          <p className="text-gray-400 mb-5">Create your first quotation template with our visual designer.</p>
          <button onClick={()=>{ setCreating(true); setSections(DEFAULT_SECTIONS); setForm({name:'',primaryColor:'#0F172A'}); }} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-3 rounded-2xl font-semibold text-sm">+ Create First Template</button>
        </div>
      )}
    </div>
  );
}
