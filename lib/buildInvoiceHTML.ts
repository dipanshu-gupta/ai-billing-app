// @ts-nocheck
// Builds the printable HTML for a B2B invoice using the same `sections` JSON
// shape that DocumentTemplateDesigner.tsx (docType="invoice") edits and
// previews — so template customization actually renders in the real PDF,
// not just in the designer's live preview.

const ALL_COLUMNS = {
  sno:'#', image:'Image', name:'Product/Service', description:'Description', hsn:'HSN/SAC', sku:'SKU',
  qty:'Qty', unit:'Unit', unit_price:'Unit Price', discount:'Disc %', tax:'Tax %',
  cgst:'CGST', sgst:'SGST', igst:'IGST',
  net_amount:'Amount (excl. tax)', amount:'Amount (incl. tax)',
};

const DEFAULT_INVOICE_SECTIONS = [
  { id:'header',     type:'header',     name:'Header',             enabled:true,  order:1,
    settings:{ bgColor:'#0F172A', textColor:'#FFFFFF', logoUrl:'', logoPosition:'left', logoHeight:48,
               showCompanyName:true, companyName:'', tagline:'',
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
               amountWordsLabel:'Amount in Words' } },
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

// Best-effort general number-to-words (thousand/million/billion grouping).
// Used for the optional "Amount in Words" line — not currency-specific
// (Indian lakh/crore grouping isn't applied since invoices support multiple currencies).
function numberToWords(num) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const scales = ['','Thousand','Million','Billion'];
  num = Math.floor(Math.abs(Number(num)||0));
  if (num === 0) return 'Zero';
  const chunk = (n) => {
    let s = '';
    if (n >= 100) { s += ones[Math.floor(n/100)] + ' Hundred '; n %= 100; }
    if (n >= 20) { s += tens[Math.floor(n/10)] + ' '; n %= 10; }
    if (n > 0) s += ones[n] + ' ';
    return s.trim();
  };
  let groups = [];
  let n = num;
  let scaleIdx = 0;
  while (n > 0) {
    const g = n % 1000;
    if (g) groups.unshift(chunk(g) + (scales[scaleIdx] ? ' ' + scales[scaleIdx] : ''));
    n = Math.floor(n / 1000);
    scaleIdx++;
  }
  return groups.join(' ').trim();
}

export function buildInvoiceHTML(record, items, template, products) {
  const sections    = template?.sections?.length ? template.sections : DEFAULT_INVOICE_SECTIONS;
  const pageSettings= template?.page_settings || {};
  const globalSettings = template?.global_settings || {};
  const font        = pageSettings.fontFamily || 'Arial, sans-serif';
  const enabled     = sections.filter(s => s.enabled).sort((a,b) => a.order - b.order);
  const currency    = record.currency || 'INR';
  const fmt = (n) => new Intl.NumberFormat('en-IN', { style:'currency', currency, maximumFractionDigits:2 }).format(n||0);

  const subtotal    = (items||[]).reduce((s,i) => s + Number(i.quantity||0) * Number(i.price ?? i.unit_price ?? 0), 0);
  const totalDisc   = (items||[]).reduce((s,i) => s + Number(i.quantity||0) * Number(i.price ?? i.unit_price ?? 0) * Number(i.discount ?? i.discount_pct ?? 0)/100, 0);
  const totalTax    = (items||[]).reduce((s,i) => s + (Number(i.quantity||0)*Number(i.price ?? i.unit_price ?? 0)*(1-Number(i.discount ?? i.discount_pct ?? 0)/100)) * Number(i.tax_pct||0)/100, 0);
  const overallDisc = subtotal * (Number(record.overall_discount)||0)/100;
  const shipping    = Number(record.shipping_cost||0);
  const grandTotal  = Number(record.amount || (subtotal - totalDisc + totalTax - overallDisc + shipping));
  const roundOff    = Math.round(grandTotal) - grandTotal;

  // Product image lookup for the optional "image" column
  const productByCode = new Map((products||[]).map(p => [p.product_code||p.sku, p]).filter(([k]) => k));
  const productByName = new Map((products||[]).map(p => [p.name, p]).filter(([k]) => k));
  const findProductImage = (item) => {
    const code = item.product_code || item.sku;
    const p = (code && productByCode.get(code)) || (item.product_name && productByName.get(item.product_name));
    return p?.image_url || '';
  };

  const invNum = record.displayNumber
    ? 'INV-' + String(record.displayNumber).padStart(5, '0')
    : (record.invoice_number || record.id || '');
  const dueDate = record.due_date || record.dueDate || '';
  const invDate = record.invoice_date || record.created_at || '';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—';

  const DOC_LABELS = { invoice_number:'Invoice #', invoice_date:'Invoice Date', due_date:'Due Date', po_number:'PO Number', payment_terms:'Payment Terms', currency:'Currency', reference:'Reference' };
  const DOC_VALUES = { invoice_number: invNum, invoice_date: fmtDate(invDate), due_date: fmtDate(dueDate), po_number: record.po_number||'—', payment_terms: record.payment_terms||record.paymentTerms||'—', currency, reference: record.reference_number||'—' };

  const renderSection = (sec) => {
    const s = sec.settings || {};
    const border = `1px solid ${s.borderColor||'#E2E8F0'}`;

    switch (sec.type) {
      case 'cover': return `<div style="background:${s.bgColor};color:${s.textColor};min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 32px;text-align:center;">
        ${s.showLogo&&s.logoUrl?`<img src="${s.logoUrl}" style="height:${s.logoHeight||60}px;object-fit:contain;margin-bottom:16px;">`:''}
        <div style="font-size:32px;font-weight:800;letter-spacing:4px;margin-bottom:8px;">${s.headline||'INVOICE'}</div>
        <div style="font-size:14px;opacity:0.8;">${s.subheadline||''}</div>
      </div>`;

      case 'header': return `<div>
        <div style="background:${s.bgColor};color:${s.textColor};padding:16px 24px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div style="display:flex;align-items:center;gap:12px;">
              ${s.logoUrl?`<img src="${s.logoUrl}" style="height:${s.logoHeight||48}px;object-fit:contain;max-width:160px;">`:''}
              ${s.showCompanyName?`<div>
                <div style="font-weight:800;font-size:16px;letter-spacing:-0.3px;">${s.companyName||''}</div>
                ${s.tagline?`<div style="font-size:10px;opacity:0.7;margin-top:2px;">${s.tagline}</div>`:''}
                ${s.showAddress&&s.address?`<div style="font-size:9px;opacity:0.6;margin-top:2px;max-width:280px;">${s.address}</div>`:''}
                ${s.showAddress&&s.gstIn?`<div style="font-size:9px;opacity:0.6;">GSTIN: ${s.gstIn}</div>`:''}
              </div>`:''}
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-weight:800;font-size:22px;letter-spacing:3px;opacity:0.95;">INVOICE</div>
              <div style="font-size:11px;opacity:0.7;margin-top:2px;">#${invNum}</div>
            </div>
          </div>
        </div>
        ${s.accentLine?`<div style="height:3px;background:${s.accentColor||'#3B82F6'};"></div>`:''}
      </div>`;

      case 'doc_info': {
        const fields = s.fields || [];
        return `<div style="background:${s.bgColor};color:${s.textColor};padding:10px 24px;border-bottom:${border};display:grid;grid-template-columns:repeat(${Math.min(fields.length||1,4)},1fr);gap:8px;font-size:11px;">
          ${fields.map(f=>`<div><div style="opacity:0.5;text-transform:uppercase;font-size:8px;margin-bottom:2px;letter-spacing:0.5px;">${DOC_LABELS[f]||f}</div><div style="font-weight:600;">${DOC_VALUES[f]||'—'}</div></div>`).join('')}
        </div>`;
      }

      case 'parties': return `<div style="background:${s.bgColor};padding:12px 24px;display:grid;grid-template-columns:${s.showShipTo?'1fr 1fr':'1fr'};gap:20px;font-size:11px;border-bottom:${border};">
        ${s.showBillTo?`<div>
          <div style="font-weight:700;text-transform:uppercase;font-size:8px;color:${s.labelColor||'#64748B'};margin-bottom:4px;letter-spacing:0.5px;">Bill To</div>
          <div style="font-weight:600;font-size:12px;">${record.customer||'-'}</div>
          ${record.billing_address||record.billingAddress?`<div style="color:#475569;margin-top:2px;">${record.billing_address||record.billingAddress}</div>`:''}
          ${s.showContact&&record.contact?`<div style="color:#64748B;margin-top:3px;">Attn: ${record.contact}</div>`:''}
          ${s.showGSTIN&&(record.customer_gstin||record.gstin)?`<div style="color:#64748B;font-size:10px;margin-top:2px;">GSTIN: ${record.customer_gstin||record.gstin}</div>`:''}
        </div>`:''}
        ${s.showShipTo?`<div style="border-left:${border};padding-left:16px;">
          <div style="font-weight:700;text-transform:uppercase;font-size:8px;color:${s.labelColor||'#64748B'};margin-bottom:4px;letter-spacing:0.5px;">Ship To</div>
          <div style="color:#475569;">${record.shipping_address||record.shippingAddress||'Same as billing address'}</div>
        </div>`:''}
      </div>`;

      case 'items': {
        const cols = s.columns || ['sno','name','qty','unit_price','amount'];
        const labels = s.columnLabels || ALL_COLUMNS;
        const cellStyle = `padding:6px ${s.fontSize?s.fontSize-3:8}px;border-bottom:1px solid ${s.borderColor||'#E2E8F0'};font-size:${s.fontSize||11}px;`;
        const rowsHTML = (items||[]).map((item, idx) => {
          const qty  = Number(item.quantity||0);
          const price= Number(item.price ?? item.unit_price ?? 0);
          const disc = Number(item.discount ?? item.discount_pct ?? 0);
          const tax  = Number(item.tax_pct||0);
          const net  = qty*price*(1-disc/100);
          const amount = Number(item.extended_price ?? (net*(1+tax/100)));
          const VALS = { sno:idx+1, image:'', name:item.product_name||'-', description:item.description||'', hsn:item.hsn_code||item.hsn||'-', sku:item.product_code||item.sku||'-', qty, unit:item.unit||'-', unit_price:price, discount:disc, tax, cgst:tax/2, sgst:tax/2, igst:0, net_amount:net, amount };
          const cellsHTML = cols.map(c => {
            const align = c==='sno'?'center':['unit_price','discount','tax','cgst','sgst','igst','qty','amount','net_amount'].includes(c)?'right':'left';
            let content;
            if (c === 'image') {
              const img = findProductImage(item);
              content = img ? `<img src="${img}" style="width:28px;height:28px;object-fit:cover;border-radius:4px;border:1px solid #E2E8F0;">` : '';
            } else if (c === 'description') {
              content = `<span style="font-size:${(s.fontSize||11)-1}px;color:#64748B;">${VALS[c]}</span>`;
            } else if (['amount','net_amount','unit_price'].includes(c)) {
              content = fmt(VALS[c]);
            } else if (['discount','tax'].includes(c)) {
              content = VALS[c] ? `${VALS[c]}%` : '-';
            } else {
              content = String(VALS[c] ?? '');
            }
            return `<td style="${cellStyle}text-align:${align};${s.showColumnBorders?`border-right:1px solid ${s.borderColor||'#E2E8F0'};`:''}">${content}</td>`;
          }).join('');
          return `<tr style="background:${s.altRowColor&&idx%2===1?s.altRowColor:'#FFF'};">${cellsHTML}</tr>`;
        }).join('');
        return `<div style="padding:0 0 8px 0;">
          <table style="width:100%;border-collapse:collapse;font-family:${font};font-size:${s.fontSize||11}px;">
            <thead><tr style="background:${s.headerBgColor||'#0F172A'};color:${s.headerTextColor||'#FFFFFF'};">
              ${cols.map(c=>`<th style="padding:8px ${s.fontSize?s.fontSize-3:8}px;text-align:${c==='sno'?'center':'left'};font-weight:600;font-size:${(s.fontSize||11)-1}px;${s.showColumnBorders?'border-right:1px solid rgba(255,255,255,0.1);':''}">${labels[c]||c}</th>`).join('')}
            </tr></thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>`;
      }

      case 'totals': {
        const rows = [
          s.showSubtotal    && ['Subtotal', fmt(subtotal)],
          s.showDiscount && totalDisc>0    && ['Discount', `-${fmt(totalDisc)}`],
          s.showTaxBreakdown && !s.showCGST && !s.showSGST && totalTax>0 && ['Tax', fmt(totalTax)],
          s.showTaxBreakdown && s.showCGST && ['CGST', fmt(totalTax/2)],
          s.showTaxBreakdown && s.showSGST && ['SGST', fmt(totalTax/2)],
          s.showTaxBreakdown && s.showIGST && ['IGST', fmt(totalTax)],
          s.showShipping && shipping>0 && [s.shippingLabel||'Shipping', fmt(shipping)],
          s.showRoundOff && Math.abs(roundOff)>0.001 && ['Round-Off', fmt(roundOff)],
        ].filter(Boolean);
        return `<div style="background:${s.bgColor||'#F8FAFC'};padding:8px 24px 12px;">
          <div style="display:flex;justify-content:flex-end;">
            <div style="width:280px;font-size:11px;">
              ${rows.map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid ${s.borderColor||'#E2E8F0'};"><span style="color:#475569;">${l}</span><span style="font-weight:600;">${v}</span></div>`).join('')}
              <div style="display:flex;justify-content:space-between;background:${s.accentBgColor||'#0F172A'};color:${s.accentTextColor||'#FFF'};border-radius:6px;padding:8px 10px;margin-top:4px;font-weight:700;font-size:12px;">
                <span>TOTAL</span><span>${fmt(grandTotal)}</span>
              </div>
              ${s.showAmountWords?`<div style="font-size:9px;color:#64748B;margin-top:6px;font-style:italic;">${s.amountWordsLabel||'Amount in Words'}: ${numberToWords(grandTotal)} ${currency} Only</div>`:''}
            </div>
          </div>
        </div>`;
      }

      case 'bank': return `<div style="background:${s.bgColor||'#EFF6FF'};padding:10px 24px;border-top:1px solid ${s.borderColor||'#BFDBFE'};font-size:11px;">
        <div style="font-weight:700;text-transform:uppercase;font-size:8px;color:${s.titleColor||'#1E40AF'};margin-bottom:6px;letter-spacing:0.5px;">Bank Details</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 16px;">
          ${[['Bank',s.bankName],['Account Name',s.accountName],['Account No.',s.accountNumber],['IFSC',s.ifscCode],['Branch',s.branchName],s.swiftCode&&['SWIFT',s.swiftCode],s.upiId&&['UPI',s.upiId]].filter(([,v])=>v).map(([l,v])=>`<div style="display:flex;gap:6px;font-size:10px;"><span style="color:#94A3B8;min-width:80px;">${l}:</span><span style="font-weight:500;">${v}</span></div>`).join('')}
        </div>
        ${s.showQR?`<div style="margin-top:8px;width:48px;height:48px;background:#E2E8F0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:7px;color:#94A3B8;">QR CODE</div>`:''}
      </div>`;

      case 'text_block': return `<div style="background:${s.bgColor||'#FFFBEB'};color:${s.textColor||'#92400E'};padding:${s.padding||12}px;font-size:${s.fontSize||10}px;line-height:1.6;border-left:${s.borderLeft||'none'};white-space:pre-line;">${s.content||''}</div>`;

      case 'terms': return s.content ? `<div style="background:${s.bgColor||'#FFFFFF'};padding:10px 24px;border-top:1px solid ${s.borderColor||'#E2E8F0'};">
        <div style="font-weight:700;text-transform:uppercase;font-size:8px;color:${s.titleColor||'#0F172A'};margin-bottom:6px;letter-spacing:0.5px;">Terms & Conditions</div>
        <div style="font-size:${s.fontSize||10}px;color:${s.textColor||'#475569'};line-height:1.6;white-space:pre-line;columns:${s.columns===2?'2':'1'};column-gap:20px;">${s.content}</div>
      </div>` : '';

      case 'signature': return `<div style="background:${s.bgColor||'#FFFFFF'};padding:16px 24px;border-top:1px solid #E2E8F0;display:flex;justify-content:space-around;align-items:flex-end;">
        ${s.showPrepared?`<div style="text-align:center;min-width:120px;">
          ${s.showDate?`<div style="font-size:9px;color:#94A3B8;margin-bottom:20px;">Date: ___________</div>`:''}
          <div style="border-top:1px solid ${s.lineColor||'#0F172A'};padding-top:4px;font-size:9px;color:#475569;">${s.preparedLabel||'Prepared by'}${s.preparedName||record.owner_display?`<div style="font-weight:600;">${s.preparedName||record.owner_display}</div>`:''}</div>
        </div>`:''}
        ${s.showStamp?`<div style="width:60px;height:60px;border-radius:50%;border:2px dashed #CBD5E1;display:flex;align-items:center;justify-content:center;font-size:7px;color:#94A3B8;margin-bottom:4px;">STAMP</div>`:''}
        ${s.showApproved?`<div style="text-align:center;min-width:120px;">
          ${s.showDate?`<div style="font-size:9px;color:#94A3B8;margin-bottom:20px;">Date: ___________</div>`:''}
          <div style="border-top:1px solid ${s.lineColor||'#0F172A'};padding-top:4px;font-size:9px;color:#475569;">${s.approvedLabel||'Authorized Signatory'}${s.approvedName?`<div style="font-weight:600;">${s.approvedName}</div>`:''}</div>
        </div>`:''}
      </div>`;

      case 'footer': return `<div>
        ${s.showDivider?`<div style="height:2px;background:${s.dividerColor||'#3B82F6'};"></div>`:''}
        <div style="background:${s.bgColor||'#0F172A'};color:${s.textColor||'#FFFFFF'};padding:8px 24px;display:grid;grid-template-columns:1fr 1fr 1fr;font-size:${s.fontSize||9}px;">
          <div>${s.leftText||''}</div>
          <div style="text-align:center;opacity:0.7;">${s.centerText||''}</div>
          <div style="text-align:right;opacity:0.7;">${(s.rightText||'').replace('{page}','1').replace('{total}','1')}</div>
        </div>
      </div>`;

      default: return '';
    }
  };

  const watermark = globalSettings?.watermark || '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:${font};color:#1E293B;background:#FFF;}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{margin:0;size:A4;}}
  </style></head><body>
    <div style="position:relative;">
      ${watermark?`<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:64px;font-weight:900;color:rgba(0,0,0,0.05);pointer-events:none;white-space:nowrap;letter-spacing:8px;z-index:10;">${watermark}</div>`:''}
      ${enabled.map(renderSection).join('')}
    </div>
    <div style="text-align:center;padding:15px;font-size:11px;color:#94A3B8;border-top:1px solid #F1F5F9;">Generated by Umbrella Suite · ${new Date().toLocaleDateString()}</div>
  </body></html>`;
}
