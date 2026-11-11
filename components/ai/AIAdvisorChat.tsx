// @ts-nocheck
'use client';
/**
 * AI Advisor - an agent, not just a chat.
 * The model asks for tools (lib/ai/agent.ts); they run here with the user's own session, tenant scope, data-security
 * scope and RBAC. Creating records is always confirmed by the user (draft card -> Create). Existing records get a card
 * with PDF, WhatsApp, email and call actions. Redwood visual language, scoped to .rw-ai.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { waFetch } from '@/lib/waFetch';
import { aiErrorText } from '@/lib/ai/client';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';
import { useAlert } from '@/components/shared/AlertProvider';
import { useRbac } from '@/lib/useRbac';
import { relabelText, withTerminology } from '@/lib/useRelabel';
import { formatCurrency, tenantScope } from '@/lib/utils';
import { buildCatalog, describeCatalog, parseTools, runTools, stripTools, TOOL_GUIDE, STD_OBJECTS, displayNo } from '@/lib/ai/agent';
import { fetchCustomObjectFields, createCustomObjectRecord } from '@/lib/customObjects';
import { generateInvoicePdf, blobToBase64 } from '@/lib/generateInvoicePdf';
import { buildInvoiceHTML } from '@/lib/buildInvoiceHTML';
import { buildBookingReceiptHTML } from '@/lib/buildBookingReceiptHTML';
import { loadCanvasTemplates, mergeTemplates, pickDefault } from '@/lib/useDocumentTemplates';
import { buildRetailPrintHTML } from '@/components/retail/RetailListPage';
import { buildQuoteHTML } from '@/components/quotations/QuotationsPage';

// ─── Redwood skin (scoped) ─────────────────────────────────────────────────────────────────────────────────────────
const RW_CSS = `
.rw-ai { --bg:#F6F4F1; --card:#fff; --line:#E3DFD9; --soft:#EEEBE6; --ink:#1B1A18; --muted:#6F6A62; --faint:#9A958C;
  --accent:#7A4E9B; --accent-soft:#F1EAF6; --teal:#2F8F83; --gold:#E1A93B; --serif: Georgia, "Times New Roman", serif;
  background:var(--bg); color:var(--ink); border:1px solid var(--line); border-radius:14px; box-shadow:0 18px 50px rgba(27,26,24,.18); overflow:hidden; }
.rw-ai .hdr { background:#fff; position:relative; border-bottom:1px solid var(--line); }
.rw-ai .hdr::after { content:""; position:absolute; left:0; right:0; bottom:-1px; height:5px;
  background:linear-gradient(90deg,var(--accent) 0 38%,var(--teal) 38% 62%,var(--gold) 62% 78%,#C9BFD6 78% 100%); }
.rw-ai .ttl { font-family:var(--serif); font-size:20px; font-weight:400; color:var(--ink); letter-spacing:-.01em; }
.rw-ai .ib { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--muted); }
.rw-ai .ib:hover { background:var(--soft); color:var(--ink); }
.rw-ai .ib.on { background:var(--accent-soft); color:var(--accent); }
.rw-ai .bub-a { background:var(--card); border:1px solid var(--line); border-radius:4px 14px 14px 14px; }
.rw-ai .bub-u { background:var(--accent); color:#fff; border-radius:14px 4px 14px 14px; }
.rw-ai .card { background:var(--card); border:1px solid var(--line); border-radius:12px; }
.rw-ai .lbl { font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--faint); }
.rw-ai .chip { border:1px solid var(--line); background:#fff; color:var(--ink); border-radius:999px; padding:6px 12px; font-size:12px; font-weight:600; }
.rw-ai .chip:hover { border-color:var(--accent); color:var(--accent); background:var(--accent-soft); }
.rw-ai .step { display:inline-flex; align-items:center; gap:6px; font-size:11px; color:var(--muted); background:var(--soft); border-radius:999px; padding:3px 10px; }
.rw-ai .btn { background:var(--accent); color:#fff; border-radius:8px; padding:8px 14px; font-size:13px; font-weight:700; }
.rw-ai .btn:hover { filter:brightness(.95); } .rw-ai .btn:disabled { opacity:.45; }
.rw-ai .btn2 { background:#fff; color:var(--ink); border:1px solid var(--line); border-radius:8px; padding:7px 12px; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:6px; }
.rw-ai .btn2:hover { border-color:var(--accent); color:var(--accent); } .rw-ai .btn2:disabled { opacity:.45; }
.rw-ai .warn { background:#FDF6E7; border:1px solid #F0DDAE; color:#7A5A12; border-radius:8px; font-size:12px; }
.rw-ai .err { background:#FBEDEC; border:1px solid #F1C9C5; color:#8A2A22; border-radius:8px; font-size:12px; }
.rw-ai .ok { background:#EAF5F3; border:1px solid #BFE2DC; color:#1F6C62; border-radius:8px; font-size:12px; }
.rw-ai .inp { background:#fff; border:1px solid var(--line); border-radius:12px; }
.rw-ai .inp:focus-within { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
.rw-ai table.t { width:100%; border-collapse:collapse; font-size:12px; } .rw-ai table.t td, .rw-ai table.t th { padding:5px 6px; border-bottom:1px solid var(--soft); text-align:left; }
.rw-ai table.t th { color:var(--faint); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:.05em; }
.rw-ai .num { text-align:right !important; font-variant-numeric: tabular-nums; }
`;

const PALETTE = ['#7A4E9B', '#2F8F83', '#E1A93B', '#C0564B', '#4A6FA5', '#8C8577'];

// ─── Small render helpers ────────────────────────────────────────────────────────────────────────────────────────
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const inline = (t) => esc(t).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

function RichText({ text }) {
  const lines = String(text || '').split('\n');
  const out = []; let table = null;
  const flush = () => { if (table) { out.push(<MdTable key={'t' + out.length} rows={table} />); table = null; } };
  lines.forEach((line, i) => {
    if (/^\s*\|.*\|\s*$/.test(line)) { if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) return; (table = table || []).push(line.trim().slice(1, -1).split('|').map(c => c.trim())); return; }
    flush();
    if (/^#{1,3} /.test(line)) out.push(<div key={i} className="mt-2 mb-1" style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>{line.replace(/^#{1,3} /, '')}</div>);
    else if (/^\s*[-•*] /.test(line)) out.push(<div key={i} className="flex gap-2 my-0.5 ml-1"><span style={{ color: 'var(--accent)' }}>•</span><span dangerouslySetInnerHTML={{ __html: inline(line.replace(/^\s*[-•*] /, '')) }} /></div>);
    else if (/^\s*\d+\.\s/.test(line)) out.push(<div key={i} className="flex gap-2 my-0.5 ml-1"><span className="font-semibold" style={{ color: 'var(--accent)' }}>{line.trim().match(/^\d+/)[0]}.</span><span dangerouslySetInnerHTML={{ __html: inline(line.replace(/^\s*\d+\.\s*/, '')) }} /></div>);
    else if (!line.trim()) out.push(<div key={i} className="h-2" />);
    else out.push(<div key={i} className="mb-0.5" dangerouslySetInnerHTML={{ __html: inline(line) }} />);
  });
  flush();
  return <>{out}</>;
}
function MdTable({ rows }) {
  const [head, ...body] = rows;
  const isNum = (v) => /^[-₹$€£\d,.\s%]+$/.test(String(v || '').trim()) && /\d/.test(String(v));
  return (
    <div className="my-2 overflow-x-auto"><table className="t"><thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
      <tbody>{body.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={isNum(c) ? 'num' : ''} dangerouslySetInnerHTML={{ __html: inline(c) }} />)}</tr>)}</tbody></table></div>
  );
}
function MiniChart({ chart }) {
  if (!chart || !Array.isArray(chart.data) || !Array.isArray(chart.labels)) return null;
  const data = chart.data.map(v => Number(v) || 0);
  const max = Math.max(...data, 1);
  return (
    <div className="card mt-3 p-3">
      <div className="lbl mb-2">{chart.title}</div>
      <div className="flex items-end gap-1.5 h-28">
        {chart.labels.map((label, i) => (
          <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0" title={`${label}: ${data[i]}`}>
            <div className="text-[9px]" style={{ color: 'var(--muted)' }}>{data[i] >= 1000 ? Math.round(data[i] / 100) / 10 + 'k' : data[i]}</div>
            <div className="w-full rounded-t" style={{ height: `${Math.round((data[i] / max) * 84)}px`, minHeight: data[i] > 0 ? 3 : 0, background: PALETTE[i % PALETTE.length] }} />
            <div className="text-[9px] text-center truncate w-full" style={{ color: 'var(--faint)' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
const parseChart = (t) => { const m = String(t || '').match(/<chart>([\s\S]*?)<\/chart>/); if (!m) return null; try { return JSON.parse(m[1]); } catch { return null; } };
const visibleText = (t) => stripTools(t).replace(/<chart>[\s\S]*?<\/chart>/g, '').replace(/<action>[\s\S]*?<\/action>/g, '').replace(/```[\s\S]*?```/g, '').trim();

const TOOL_LABEL = { search_records: 'Searched', get_record: 'Opened', aggregate: 'Calculated', find_duplicates: 'Checked duplicates', prepare_create: 'Prepared draft', record_actions: 'Opened actions' };

// ─── Documents & contact details for one record ─────────────────────────────────────────────────────────────────
async function lineItems(supabase, o, row) {
  if (!o?.lines) return [];
  const { data } = await tenantScope(supabase.from(o.lines.table).select('*')).eq(o.lines.fk, row[o.key]).order('sort_order', { ascending: true });
  return data || [];
}
async function customerContact(supabase, object, row) {
  const o = STD_OBJECTS[object];
  let phone = row.customer_phone || row.phone || row.mobile || '';
  let email = row.email || '';
  let name = row.customer || row.name || '';
  if (o?.customerLink && row.customer_id && (!phone || !email)) {
    try {
      let c = null;
      if (o.customerLink === 'b2c') {
        const isUuid = /^[0-9a-f-]{36}$/i.test(String(row.customer_id));
        ({ data: c } = await tenantScope(supabase.from('retail_customers').select('name, phone, email')).eq(isUuid ? 'id' : 'customer_number', row.customer_id).maybeSingle());
      } else {
        ({ data: c } = await tenantScope(supabase.from('customers').select('name, phone, email')).eq('customer_number', row.customer_id).maybeSingle());
      }
      if (c) { phone = phone || c.phone || ''; email = email || c.email || ''; name = name || c.name || ''; }
    } catch { /* keep what we have */ }
  }
  return { phone, email, name };
}
const e164 = (raw, prefs) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  const cc = String(prefs?.default_country_code || (String(prefs?.default_currency || 'INR') === 'INR' ? '91' : '')).replace(/\D/g, '');
  return d.length === 10 && cc ? cc + d : d;
};

// ─── Draft card: review, then Create ─────────────────────────────────────────────────────────────────────────────
function DraftCard({ draft, cat, onCreate, state }) {
  const o = cat?.objects?.[draft.object];
  if (!o) return null;
  const f = draft.fields || {};
  const rows = Object.entries(f).filter(([k]) => !['customer_id', 'customerId', 'customer_phone'].includes(k));
  return (
    <div className="card mt-3 p-4">
      <div className="flex items-center justify-between mb-2">
        <div><div className="lbl">New {o.single}</div><div style={{ fontFamily: 'var(--serif)', fontSize: 17 }}>{draft.customer?.name || f.name || f.subject || o.single}</div></div>
        {draft.totals && <div className="text-right"><div className="lbl">Total</div><div className="font-bold num">{formatCurrency(draft.totals.total)}</div></div>}
      </div>
      {draft.customer && <div className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Customer {draft.customer.number} {draft.customer.phone ? '· ' + draft.customer.phone : ''} {draft.customer.email ? '· ' + draft.customer.email : ''}</div>}
      {rows.length > 0 && <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">{rows.map(([k, v]) => <div key={k} className="truncate"><span style={{ color: 'var(--faint)' }}>{k.replace(/_/g, ' ')}:</span> {String(v)}</div>)}
        {Object.entries(draft.custom || {}).map(([k, v]) => <div key={'c' + k} className="truncate"><span style={{ color: 'var(--faint)' }}>{(o.customFields || []).find(x => x.api === k)?.label || k}:</span> {String(v)}</div>)}</div>}
      {draft.lines?.length > 0 && (
        <table className="t mb-2"><thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Disc</th><th className="num">Line</th></tr></thead>
          <tbody>{draft.lines.map((l, i) => <tr key={i}><td>{l.product_name}{l.rental_start_date ? <div className="text-[10px]" style={{ color: 'var(--faint)' }}>{l.rental_start_date} → {l.rental_end_date}</div> : null}</td><td className="num">{l.quantity}</td><td className="num">{formatCurrency(l.unit_price)}</td><td className="num">{l.discount_pct ? l.discount_pct + '%' : ''}</td><td className="num">{formatCurrency(l.extended_price || 0)}</td></tr>)}</tbody></table>
      )}
      {draft.totals && <div className="text-xs text-right mb-2" style={{ color: 'var(--muted)' }}>Subtotal {formatCurrency(draft.totals.subtotal)}{draft.totals.discount ? ` · Discount ${formatCurrency(draft.totals.discount)}` : ''} · Tax {formatCurrency(draft.totals.tax)}</div>}
      {draft.warnings?.length > 0 && <div className="warn px-3 py-2 mb-2">{draft.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>}
      {state?.error && <div className="err px-3 py-2 mb-2">{state.error}</div>}
      {state?.done ? <div className="ok px-3 py-2">Created {state.number}.</div> : (
        <div className="flex gap-2">
          <button className="btn" disabled={state?.busy} onClick={() => onCreate(draft)}>{state?.busy ? 'Creating…' : `Create ${o.single}`}</button>
          <span className="text-[11px] self-center" style={{ color: 'var(--faint)' }}>Nothing is saved until you click Create.</span>
        </div>
      )}
    </div>
  );
}

// ─── Record card: PDF / WhatsApp / Email / Call ─────────────────────────────────────────────────────────────────
function RecordCard({ object, row, cat }) {
  const app = useApp();
  const { appPreferences, invoiceTemplates, quoteTemplates, products, retailProducts } = app;
  const { supabase, tenant } = useTenant();
  const { showAlert } = useAlert();
  const o = cat?.objects?.[object] || STD_OBJECTS[object];
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [contact, setContact] = useState(null);
  const [wa, setWa] = useState(null);
  const number = displayNo(o, row);
  const amount = Number(row[o?.amount] ?? row.amount ?? row.grand_total ?? 0);
  const docLabel = object === 'quotations' ? 'Quotation' : object === 'retailOrders' ? 'Booking receipt' : 'Invoice';
  const rentalOrder = object === 'retailOrders' && appPreferences?.business_type === 'rental';
  const hasDoc = !!o?.doc && (object !== 'retailOrders' || rentalOrder);

  useEffect(() => { customerContact(supabase, object, row).then(setContact); }, [row?.id]);
  useEffect(() => {
    const qs = new URLSearchParams({ ...(tenant?.db_url ? { db_url: tenant.db_url } : {}), ...(tenant?.id ? { tenantId: tenant.id } : {}) });
    waFetch(`/api/whatsapp/config?${qs}`).then(r => r.ok ? r.json() : null).then(d => setWa(d?.config || null)).catch(() => setWa(null));
  }, []);

  const buildDoc = async () => {
    const items = await lineItems(supabase, o, row);
    if (object === 'invoices') {
      const t = pickDefault(invoiceTemplates || []);
      if (!t) throw new Error('No invoice template yet. Create one in Admin Tools.');
      const rec = { ...row, id: row.invoice_number, displayNumber: row.display_number, billingAddress: row.billing_address, shippingAddress: row.shipping_address, dueDate: row.due_date, paymentTerms: row.payment_terms };
      return { html: buildInvoiceHTML(rec, items, t, products || []), paper: t.paper_size || 'a4' };
    }
    if (object === 'quotations') {
      const t = (quoteTemplates || []).find(x => x.id === row.template_id) || pickDefault(quoteTemplates || []);
      return { html: buildQuoteHTML(row, items, t, products || []), paper: t?.paper_size || 'a4' };
    }
    if (object === 'retailInvoices') {
      const [{ data: legacy }, canvas] = await Promise.all([tenantScope(supabase.from('retail_invoice_templates').select('*')).order('created_at'), loadCanvasTemplates(supabase, 'retail_invoice')]);
      const list = mergeTemplates(canvas || [], legacy || []);
      const t = list.find(x => x.id === row.invoice_template_id) || pickDefault(list);
      if (!t) throw new Error('No invoice template yet. Create one in Admin Tools > B2C Retail > Invoice Template.');
      return { html: buildRetailPrintHTML(t, row, items, retailProducts || [], []), paper: String(t.paper_size || 'a4').toLowerCase() };
    }
    if (object === 'retailOrders') {
      const { data: list } = await tenantScope(supabase.from('booking_receipt_templates').select('*')).order('created_at');
      const t = (list || []).find(x => x.is_default) || (list || [])[0];
      if (!t) throw new Error('No booking receipt template yet. Design one in Admin Tools.');
      return { html: buildBookingReceiptHTML(t, row, items), paper: String(t.paper_size || 'a4').toLowerCase() };
    }
    throw new Error('This record has no document.');
  };
  const makePdf = async () => { const { html, paper } = await buildDoc(); return { blob: await generateInvoicePdf(html, paper), filename: `${docLabel} ${number}.pdf` }; };
  const run = async (key, fn) => { setBusy(key); setMsg(null); try { await fn(); } catch (e) { setMsg({ type: 'err', text: e?.message || 'Something went wrong.' }); } setBusy(''); };

  const download = () => run('pdf', async () => {
    const { blob, filename } = await makePdf();
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setMsg({ type: 'ok', text: `${filename} downloaded.` });
  });
  const preview = () => run('view', async () => {
    const { blob } = await makePdf();
    const url = URL.createObjectURL(blob); const w = window.open(url, '_blank');
    if (!w) throw new Error('Pop-up blocked. Allow pop-ups to preview, or use Download.');
  });
  const message = () => `Dear ${contact?.name || 'Customer'}, ${hasDoc ? `please find your ${docLabel.toLowerCase()} ${number}` : `regarding ${number}`}${amount ? ` (total ${formatCurrency(amount)})` : ''}. Thank you!`;
  const whatsapp = () => run('wa', async () => {
    const to = e164(contact?.phone, appPreferences);
    if (!to) throw new Error('No phone number on this record or its customer.');
    if (!(wa?.is_active && wa?.phone_number_id)) { window.open(`https://wa.me/${to}?text=${encodeURIComponent(message())}`, '_blank'); setMsg({ type: 'ok', text: 'Opened WhatsApp. Attach the PDF there if needed (WhatsApp is not connected for automatic sending).' }); return; }
    const scope = { db_url: tenant?.db_url, tenantId: tenant?.id };
    let media = {};
    if (hasDoc) {
      const { blob, filename } = await makePdf();
      const up = await waFetch('/api/whatsapp/upload-media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...scope, fileBase64: await blobToBase64(blob), filename, mimeType: 'application/pdf' }) });
      const ud = await up.json(); if (!up.ok) throw new Error(ud.error || 'PDF upload failed.');
      media = { documentMediaId: ud.mediaId, documentFilename: filename };
    }
    const r = await waFetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...scope, to, recordType: object, recordId: number, recipientType: 'customer', sendMode: 'manual', freeformText: message(), ...media }) });
    const d = await r.json();
    if (!r.ok) throw new Error((d.error || 'Send failed.') + ' A PDF can only be sent within 24 hours of the customer\'s last WhatsApp message; otherwise use the record\'s template message.');
    setMsg({ type: 'ok', text: `Sent on WhatsApp to +${to}.` });
  });
  const email = () => run('mail', async () => {
    if (!contact?.email) throw new Error('No email address on this record or its customer.');
    if (hasDoc) { const { blob, filename } = await makePdf(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); }
    window.location.href = `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(`${docLabel} ${number}`)}&body=${encodeURIComponent(message())}`;
    setMsg({ type: 'ok', text: hasDoc ? 'Your email app is opening. The PDF was downloaded - attach it to the email.' : 'Your email app is opening.' });
  });
  const call = () => { if (!contact?.phone) { setMsg({ type: 'err', text: 'No phone number on this record or its customer.' }); return; } window.location.href = `tel:${String(contact.phone).replace(/[^\d+]/g, '')}`; };

  return (
    <div className="card mt-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="lbl">{o?.single || 'Record'} {number}</div>
          <div className="truncate" style={{ fontFamily: 'var(--serif)', fontSize: 17 }}>{row.customer || row.name || row.subject || number}</div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>{[row[o?.status || 'status'], contact?.phone, contact?.email].filter(Boolean).join(' · ')}</div>
        </div>
        {amount ? <div className="text-right"><div className="lbl">Amount</div><div className="font-bold num">{formatCurrency(amount)}</div></div> : null}
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {hasDoc && <><button className="btn2" disabled={!!busy} onClick={preview}>{busy === 'view' ? 'Preparing…' : '📄 View PDF'}</button>
          <button className="btn2" disabled={!!busy} onClick={download}>{busy === 'pdf' ? 'Preparing…' : '⬇ Download PDF'}</button></>}
        <button className="btn2" disabled={!!busy} onClick={whatsapp}>{busy === 'wa' ? 'Sending…' : '💬 WhatsApp'}</button>
        <button className="btn2" disabled={!!busy} onClick={email}>✉ Email</button>
        <button className="btn2" disabled={!!busy} onClick={call}>📞 Call</button>
        <button className="btn2" onClick={() => {
          // Record screens expect the same shape as their own lists: use the loaded record when there is one.
          const key = row[o?.key] || row.id;
          const loaded = (app[object] || []).find(r => r.id === key || r._uuid === row.id);
          window.dispatchEvent(new CustomEvent('open-record', { detail: { page: object, record: loaded || { ...row, id: key, _uuid: row.id, displayNumber: row.display_number } } }));
        }}>Open</button>
      </div>
      {msg && <div className={`${msg.type === 'ok' ? 'ok' : 'err'} px-3 py-2 mt-2`}>{msg.text}</div>}
    </div>
  );
}

// ─── Voice ───────────────────────────────────────────────────────────────────────────────────────────────────────
function useVoiceInput(onTranscript) {
  const { showAlert } = useAlert();
  const [listening, setListening] = useState(false);
  const ref = useRef(null);
  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { showAlert('Voice input is not supported in this browser. Please use Chrome.', { variant: 'warning' }); return; }
    const r = new SR(); r.lang = 'en-IN'; r.continuous = false; r.interimResults = false;
    r.onstart = () => setListening(true); r.onend = () => setListening(false); r.onerror = () => setListening(false);
    r.onresult = (e) => onTranscript(e.results[0][0].transcript);
    ref.current = r; r.start();
  }, [onTranscript]);
  const stop = useCallback(() => { ref.current?.stop(); setListening(false); }, []);
  return { listening, start, stop };
}
function speak(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text).slice(0, 500)); u.lang = 'en-IN'; window.speechSynthesis.speak(u);
}

// ─── Main ────────────────────────────────────────────────────────────────────────────────────────────────────────
const MAX_STEPS = 6;

export default function AIAdvisorChat() {
  const app = useApp();
  const { currentUser, appPreferences, customObjects, hasPermission, permissionsLoaded, dataSecurityScope,
    createRecord, createRetailRecord, createQuotation, fetchQuotations } = app;
  const { supabase, tenant } = useTenant();
  const { showAlert } = useAlert();
  const { can } = useRbac();
  const b2cMode = appPreferences?.b2c_mode === true;
  const allowed = !permissionsLoaded || hasPermission('manage_ai');

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stepNote, setStepNote] = useState('');
  const [voiceOn, setVoiceOn] = useState(false);
  const [cat, setCat] = useState(null);
  const [draftState, setDraftState] = useState({});
  const greeting = { role: 'assistant', content: '', display: `Hello${currentUser?.first_name ? ' ' + currentUser.first_name : ''}. I'm your Business Advisor.\n\nI can look up anything you have access to, calculate sales and trends, create records (I check the customer, products and duplicates first), and prepare PDFs to download or share on WhatsApp, email or a call.`, ui: true, ts: new Date() };
  const [messages, setMessages] = useState([greeting]);
  const drafts = useRef({});
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Catalog = what this user may see/do, from this tenant's configuration. Rebuilt when mode / objects / permissions change.
  useEffect(() => {
    if (!open || !supabase || !permissionsLoaded) return;
    buildCatalog({ supabase, b2cMode, can, customObjects: customObjects || [] }).then(setCat).catch(() => setCat({ mode: b2cMode ? 'b2c' : 'b2b', objects: {} }));
  }, [open, supabase, b2cMode, permissionsLoaded, (customObjects || []).length, tenant?.id]);

  // Tenant switch / sign-out: never carry one workspace's conversation into another.
  useEffect(() => { setMessages([greeting]); drafts.current = {}; setDraftState({}); }, [tenant?.id, currentUser?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open, loading]);
  useEffect(() => {
    const h = () => setOpen(o => !o);
    window.addEventListener('toggle-ai-chat', h);
    return () => window.removeEventListener('toggle-ai-chat', h);
  }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
  const { listening, start, stop } = useVoiceInput(t => setInput(t));

  const systemPrompt = useCallback(() => {
    const cur = appPreferences?.default_currency || 'INR';
    const scope = dataSecurityScope?.isAdmin || dataSecurityScope?.viewAll || dataSecurityScope?.dataScope === 'all' ? 'all records in the workspace'
      : dataSecurityScope?.dataScope === 'org' || dataSecurityScope?.viewTeam ? 'records of their organisation' : dataSecurityScope?.dataScope === 'bu' ? 'records of their business unit' : 'their own records';
    return withTerminology(`You are the AI Business Advisor agent inside Umbrella Suite for ${tenant?.name || 'this business'}.
Today is ${new Date().toLocaleDateString('en-CA')} (${new Date().toLocaleDateString('en-IN', { weekday: 'long' })}). Currency: ${cur}. Mode: ${b2cMode ? 'B2C retail' : 'B2B CRM'}${appPreferences?.business_type === 'rental' ? ' (rental business: orders are bookings with rental dates)' : ''}.
User: ${currentUser?.first_name || ''} ${currentUser?.last_name || ''}, role ${currentUser?.role_name || currentUser?.roles?.role_name || 'user'}. They can see ${scope}. Tools already enforce this; you only ever see what they may see.

OBJECTS THIS USER CAN ACCESS (anything not listed is not available to them):
${describeCatalog(cat || { objects: {} })}

${TOOL_GUIDE}

HOW TO ANSWER:
- Short and clear: one line summary, then bullets or a small markdown table (| a | b |), then one next step.
- Money in ${cur}. Use record numbers (e.g. RINV-00042) so the user can find them.
- For a trend or breakdown you may add a chart after the text: <chart>{"type":"bar","title":"...","labels":[...],"data":[...]}</chart> using numbers from a tool.
- Never show JSON, tool names or internal ids to the user.`);
  }, [cat, appPreferences, currentUser, tenant?.name, b2cMode, dataSecurityScope]);

  const callModel = async (history) => {
    const controller = new AbortController(); abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await waFetch('/api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ system: systemPrompt(), messages: history, max_tokens: 1800, tenantId: tenant?.id || undefined, tenantDbUrl: tenant?.db_url || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(aiErrorText(data));
      return data.content?.[0]?.text || '';
    } finally { clearTimeout(timer); }
  };
  const apiHistory = (list) => list.filter(m => !m.ui && m.content).map(m => ({ role: m.role, content: m.content })).slice(-30);

  const ask = async (text) => {
    const userText = String(text ?? input).trim();
    if (!userText || loading) return;
    if (!cat) { showAlert('The advisor is still loading your workspace. Try again in a moment.', { variant: 'info' }); return; }
    setInput('');
    let list = [...messages, { role: 'user', content: userText, display: userText, ts: new Date() }];
    setMessages(list); setLoading(true); setStepNote('Thinking…');
    const ctx = { supabase, security: dataSecurityScope, appPreferences, drafts: drafts.current, cards: [] };
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const reply = await callModel(apiHistory(list));
        const calls = parseTools(reply);
        const assistant = { role: 'assistant', content: reply, display: visibleText(reply), chart: parseChart(reply), steps: calls.map(c => `${TOOL_LABEL[c.name] || 'Checked'} ${c.args?.object ? String(c.args.object).replace(/^retail/, '').replace(/^custom_/, '') : ''}`.trim()), cards: [], ts: new Date() };
        if (!calls.length) { list = [...list, assistant]; setMessages(list); if (voiceOn) speak(assistant.display); break; }
        setStepNote(assistant.steps.join(' · ') + '…');
        ctx.cards = [];
        const results = await runTools(ctx, cat, calls);
        assistant.cards = ctx.cards.slice();
        list = [...list, assistant, { role: 'user', content: `Tool results (not visible to the user):\n${results}`, ui: false, hidden: true, ts: new Date() }];
        setMessages(list);
        if (step === MAX_STEPS - 1) { list = [...list, { role: 'assistant', content: '', display: 'I stopped after several look-ups. Ask me to continue, or narrow the question.', ui: true, ts: new Date() }]; setMessages(list); }
      }
    } catch (e) {
      const m = e?.name === 'AbortError' ? 'The AI took too long to answer. Please try again.' : (e?.message || 'Something went wrong.');
      setMessages(prev => [...prev, { role: 'assistant', content: '', display: m, ui: true, error: true, ts: new Date() }]);
    } finally { setLoading(false); setStepNote(''); }
  };

  // ── Create from a confirmed draft (always the same create functions the record screens use) ──
  const createFromDraft = async (draft) => {
    const set = (p) => setDraftState(s => ({ ...s, [draft.id]: { ...(s[draft.id] || {}), ...p } }));
    set({ busy: true, error: null });
    const o = cat?.objects?.[draft.object];
    try {
      if (!o || !can(draft.object, 'create')) throw new Error('Your role does not allow creating this record.');
      const f = { ...draft.fields }; const custom = draft.custom || {};
      let created = null;
      if (o.kind === 'custom') {
        const fields = await fetchCustomObjectFields(o.obj.id, 'header');
        const values = { __name: f.name || '', __status: f.status || 'Active' };
        fields.forEach(fd => { if (f[fd.api_name] !== undefined) values[fd.api_name] = f[fd.api_name]; });
        const rec = await createCustomObjectRecord({ supabase, tenantId: tenant?.id, currentUser, showAlert }, o.obj, fields, values, [], []);
        if (!rec) throw new Error('The record could not be saved.');
        created = rec;
      } else if (o.mode === 'b2c') {
        const t = draft.totals;
        const data = { ...f, custom_data: custom, ...(t ? { subtotal: t.subtotal, total_discount: t.discount, total_tax: t.tax, amount: t.total, currency: appPreferences?.default_currency || 'INR' } : {}) };
        created = await createRetailRecord(draft.object, data, draft.lines || []);
        if (!created) throw new Error('Not created - see the message on screen.');
      } else if (draft.object === 'quotations') {
        const t = draft.totals || { subtotal: 0, discount: 0, tax: 0, total: 0 };
        const data = { name: f.name || `Quotation for ${draft.customer?.name || ''}`.trim(), customer: f.customer, customer_id: f.customerId, status: f.status, validity_date: f.validity_date || null,
          payment_terms: f.payment_terms, shipping_terms: f.shipping_terms, billing_address: f.billing_address, shipping_address: f.shipping_address, notes: f.notes,
          custom_data: custom, subtotal: t.subtotal, total_discount: t.discount, total_tax: t.tax, grand_total: t.total, currency: appPreferences?.default_currency || 'INR' };
        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
        created = await createQuotation(data, (draft.lines || []).map(l => ({ ...l })));
        if (!created) throw new Error('Not created - see the message on screen.');
        fetchQuotations && fetchQuotations();
      } else {
        // B2B create functions take camelCase for some fields; pass both spellings.
        const camel = { billing_address: 'billingAddress', shipping_address: 'shippingAddress', postal_code: 'postalCode', gst_number: 'gstNumber', close_date: 'closeDate', due_date: 'dueDate',
          delivery_date: 'deliveryDate', activity_type: 'activityType', activity_date: 'activityDate', payment_terms: 'paymentTerms', expected_close_date: 'expectedCloseDate', tax_rate: 'taxRate', product_family: 'productFamily' };
        const data: any = { ...f, custom_data: custom };
        Object.entries(camel).forEach(([s, c]) => { if (f[s] !== undefined) data[c] = f[s]; });
        if (draft.object === 'activities' && !data.name) data.name = data.subject;
        if (['orders', 'invoices'].includes(draft.object) && !data.name) data.name = `${o.single} for ${draft.customer?.name || ''}`.trim();
        const lines = (draft.lines || []).map(l => ({ product: l.product_name, quantity: l.quantity, price: l.unit_price, discount: l.discount_pct, tax_pct: l.tax_pct || 0, list_price: l.unit_price, product_code: l.product_code, product_id: l.product_id }));
        created = await createRecord(draft.object, data, lines);
        if (!created) throw new Error('Not created.');
        // createRecord stores amount as qty x price; store the real totals (discount + tax) the user confirmed.
        if (draft.totals && ['orders', 'invoices'].includes(draft.object)) {
          await tenantScope(supabase.from(o.table).update({ amount: draft.totals.total, subtotal: draft.totals.subtotal, total_discount: draft.totals.discount, total_tax: draft.totals.tax })).eq(o.key, created.id);
        }
      }
      // Re-read the saved row (scoped) so the card shows exactly what was stored.
      const keyVal = created[o.key] || created.id;
      let q = tenantScope(supabase.from(o.table).select('*'));
      q = o.kind === 'custom' ? q.eq('id', created.id) : q.eq(o.key, keyVal);
      const { data: row } = await q.maybeSingle();
      const saved = row || created;
      const number = displayNo(o, saved);
      set({ busy: false, done: true, number });
      const note = { role: 'user', hidden: true, content: `[The user clicked Create] Created ${draft.object} ${number}${draft.customer ? ` for ${draft.customer.name}` : ''}${draft.totals ? `, total ${draft.totals.total}` : ''}.`, ts: new Date() };
      const done = { role: 'assistant', content: `Created ${o.single} ${number}.`, display: `Done - ${o.single} **${number}** is saved.${o.doc ? ' You can view the PDF or send it below.' : ''}`, cards: [{ type: 'record', object: draft.object, row: saved }], ts: new Date() };
      setMessages(prev => [...prev, note, done]);
    } catch (e) {
      set({ busy: false, error: e?.message || 'Could not create.' });
    }
  };

  const clear = () => { setMessages([{ ...greeting, display: 'New conversation. How can I help?' }]); drafts.current = {}; setDraftState({}); };
  const stopIt = () => { abortRef.current?.abort(); };

  const prompts = useMemo(() => {
    const L = (k, f) => cat?.objects?.[k]?.plural || f;
    const has = (k) => !!cat?.objects?.[k];
    const list = b2cMode ? [
      has('retailInvoices') && { label: "Today's paid sales", prompt: "What are today's paid sales? Compare with yesterday." },
      has('retailInvoices') && { label: 'Sales trend', prompt: 'Show paid sales by day for this month as a chart.' },
      has('retailInvoices') && { label: `Create ${L('retailInvoices', 'invoice').toLowerCase()}`, prompt: 'I want to create an invoice.' },
      has('retailInvoices') && { label: 'Unpaid invoices', prompt: 'Which invoices are not paid yet (excluding cancelled)? Show the biggest first.' },
      has('retailProducts') && { label: 'Low stock', prompt: 'Which products are at or below their reorder level?' },
      has('retailCustomers') && { label: 'Top customers', prompt: 'Who are my top 5 customers by paid invoice value this year?' },
    ] : [
      has('opportunities') && { label: 'Pipeline', prompt: 'Summarise my open pipeline by stage with totals.' },
      has('invoices') && { label: 'Overdue invoices', prompt: 'Which invoices are overdue? Show the biggest first.' },
      has('invoices') && { label: `Create ${L('invoices', 'invoice').toLowerCase()}`, prompt: 'I want to create an invoice.' },
      has('leads') && { label: 'New leads', prompt: 'How many new leads came in this month, by source?' },
      has('invoices') && { label: 'Revenue trend', prompt: 'Show paid invoice revenue by month this year as a chart.' },
      has('activities') && { label: 'My open tasks', prompt: 'What activities are open and due soon?' },
    ];
    return list.filter(Boolean).map(p => ({ label: relabelText(p.label), prompt: relabelText(p.prompt) }));
  }, [cat, b2cMode]);

  if (!allowed || !open) return null;

  return (
    <>
      <style>{RW_CSS}</style>
      <div className="rw-ai fixed z-[200] flex flex-col" style={expanded ? { inset: 24 } : { right: 24, bottom: 24, width: 'min(680px, calc(100vw - 32px))', height: 'min(88vh, 860px)' }}>
        {/* Header */}
        <div className="hdr px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>✦</div>
            <div className="min-w-0">
              <div className="ttl truncate">Business Advisor</div>
              <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>{tenant?.name || ''} · {b2cMode ? 'Retail' : 'CRM'} · works within your access</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className={`ib ${voiceOn ? 'on' : ''}`} title={voiceOn ? 'Spoken replies on' : 'Spoken replies off'} onClick={() => setVoiceOn(v => !v)}>🔊</button>
            <button className="ib" title="New conversation" onClick={clear}>↺</button>
            <button className="ib" title={expanded ? 'Smaller' : 'Larger'} onClick={() => setExpanded(x => !x)}>{expanded ? '⤡' : '⤢'}</button>
            <button className="ib" title="Close" onClick={() => setOpen(false)}>✕</button>
          </div>
        </div>

        {/* Conversation */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {messages.filter(m => !m.hidden).map((m, i) => {
            if (m.role === 'user') return (
              <div key={i} className="flex justify-end mb-3"><div className="bub-u max-w-[85%] px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">{m.display}</div></div>
            );
            const hasBody = !!(m.display || m.chart || (m.cards && m.cards.length));
            return (
              <div key={i} className="mb-3 max-w-[92%]">
                {m.steps?.length > 0 && <div className="flex flex-wrap gap-1.5 mb-1.5">{m.steps.map((s, j) => <span key={j} className="step">✓ {s}</span>)}</div>}
                {hasBody && (
                  <div className={`bub-a px-4 py-3 text-[14px] leading-relaxed ${m.error ? 'err' : ''}`}>
                    {m.display && <RichText text={relabelText(m.display)} />}
                    {m.chart && <MiniChart chart={m.chart} />}
                    {(m.cards || []).map((c, j) => c.type === 'draft'
                      ? (drafts.current[c.draftId] ? <DraftCard key={j} draft={drafts.current[c.draftId]} cat={cat} state={draftState[c.draftId]} onCreate={createFromDraft} /> : null)
                      : <RecordCard key={j} object={c.object} row={c.row} cat={cat} />)}
                  </div>
                )}
              </div>
            );
          })}
          {loading && (
            <div className="flex items-center gap-2 mb-3">
              <span className="step"><span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} /> {stepNote || 'Thinking…'}</span>
              <button className="text-[11px] underline" style={{ color: 'var(--muted)' }} onClick={stopIt}>Stop</button>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Suggestions */}
        {prompts.length > 0 && (
          <div className="px-5 pt-3 pb-1 flex-shrink-0" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="flex gap-2 overflow-x-auto pb-1">{prompts.map(p => <button key={p.label} className="chip whitespace-nowrap" disabled={loading} onClick={() => ask(p.prompt)}>{p.label}</button>)}</div>
          </div>
        )}

        {/* Input */}
        <div className="px-5 pb-4 pt-2 flex-shrink-0">
          <div className="inp flex items-end gap-2 px-3 py-2">
            <textarea ref={inputRef} value={input} rows={1} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
              onInput={e => { const t = e.target as any; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }}
              placeholder={listening ? 'Listening…' : cat ? 'Ask, or say what to create - e.g. "Invoice Rakhi for 2 yoga memberships"' : 'Loading your workspace…'}
              className="flex-1 bg-transparent text-sm focus:outline-none resize-none leading-relaxed" style={{ minHeight: 24, maxHeight: 120, color: 'var(--ink)' }} />
            <button className={`ib ${listening ? 'on' : ''}`} title={listening ? 'Stop' : 'Speak'} onClick={listening ? stop : start}>🎤</button>
            <button className="btn" disabled={loading || !input.trim() || !cat} onClick={() => ask()}>{loading ? '…' : 'Send'}</button>
          </div>
          <div className="text-center mt-1.5 text-[10px]" style={{ color: 'var(--faint)' }}>Enter to send · Shift+Enter for a new line · AI can make mistakes; drafts are only saved when you click Create.</div>
        </div>
      </div>
    </>
  );
}
