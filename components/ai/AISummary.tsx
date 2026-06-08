// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';

// ─── Build rich context for each object type ──────────────────────────────────
const buildContext = (page, record, data) => {
  const { customers, leads, opportunities, orders, invoices,
          contacts, activities, quotations, enterpriseUsers } = data;

  const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n||0);
  const owner = enterpriseUsers.find(u => u.id === record.owner_id || u.email === record.owner);
  const ownerName = owner ? `${owner.first_name} ${owner.last_name}` : record.owner || 'Unassigned';

  switch (page) {
    case 'customers': {
      const cLeads   = leads.filter(l => l.customerId === record.id || l.customer === record.name);
      const cOpps    = opportunities.filter(o => o.customerId === record.id || o.customer === record.name);
      const cOrders  = orders.filter(o => o.customerId === record.id || o.customer === record.name);
      const cInv     = invoices.filter(i => i.customerId === record.id || i.customer === record.name);
      const cCon     = contacts.filter(c => c.customerId === record.id || c.customer === record.name);
      const cAct     = activities.filter(a => a.customerId === record.id || a.customer === record.name);
      const cQuotes  = quotations.filter(q => q.customer_id === record.id || q.customer === record.name);
      const pipeline = cOpps.reduce((s,o)=>s+Number(o.amount||0),0);
      const revenue  = cOrders.reduce((s,o)=>s+Number(o.amount||0),0);
      const outstanding = cInv.filter(i=>i.status==='Overdue' || i.status==='Pending').reduce((s,i)=>s+Number(i.amount||0),0);

      return `Summarise this customer record for a CRM user:
Customer: ${record.name}
Status: ${record.status} | Industry: ${record.industry||'N/A'} | City: ${record.city||'N/A'}
Owner: ${ownerName}
Associations: ${cCon.length} contacts, ${cLeads.length} leads, ${cOpps.length} opportunities, ${cOrders.length} orders, ${cInv.length} invoices, ${cAct.length} activities, ${cQuotes.length} quotations
Pipeline value: ${fmt(pipeline)} | Total revenue from orders: ${fmt(revenue)} | Outstanding invoices: ${fmt(outstanding)}
Open opportunities: ${cOpps.filter(o=>!['Closed Won','Closed Lost'].includes(o.stage)).map(o=>`${o.name} (${o.stage}, ${fmt(o.amount)})`).join('; ')||'None'}
Recent activities: ${cAct.slice(0,3).map(a=>`${a.activityType||'Activity'} - ${a.status}`).join(', ')||'None'}`;
    }

    case 'leads': {
      const customer = customers.find(c => c.id === record.customerId || c.name === record.customer);
      const cAct = activities.filter(a => a.customerId === record.customerId || a.customer === record.customer);
      return `Summarise this sales lead for a CRM user:
Lead: ${record.name}
Status: ${record.status} | Source: ${record.source||'N/A'} | Amount: ${fmt(record.amount)}
Customer: ${record.customer||'N/A'} | Contact: ${record.contact||'N/A'}
Owner: ${ownerName}
Customer status: ${customer?.status||'N/A'} | Industry: ${customer?.industry||'N/A'}
Related activities: ${cAct.length} total, ${cAct.filter(a=>a.status==='Open').length} open
Created: ${record.created_at ? new Date(record.created_at).toLocaleDateString() : 'N/A'}`;
    }

    case 'opportunities': {
      const cQuotes = quotations.filter(q => q.opportunity_id === record.id || q.customer === record.customer);
      const cOrders = orders.filter(o => o.customerId === record.customerId || o.customer === record.customer);
      const customer = customers.find(c => c.id === record.customerId || c.name === record.customer);
      return `Summarise this sales opportunity for a CRM user:
Opportunity: ${record.name}
Stage: ${record.stage} | Status: ${record.status} | Amount: ${fmt(record.amount)}
Customer: ${record.customer||'N/A'} | Contact: ${record.contact||'N/A'}
Close date: ${record.closeDate||'Not set'} | Owner: ${ownerName}
Customer industry: ${customer?.industry||'N/A'} | Customer status: ${customer?.status||'N/A'}
Related quotations: ${cQuotes.length} (${cQuotes.filter(q=>q.status==='Accepted').length} accepted)
Related orders: ${cOrders.length}`;
    }

    case 'quotations': {
      const lineCount = record.lineItemCount || 0;
      return `Summarise this quotation for a CRM sales user:
Quotation: ${record.name} (${record.quote_number})
Status: ${record.status} | Version: v${record.version||1} | Currency: ${record.currency||'INR'}
Customer: ${record.customer||'N/A'} | Contact: ${record.contact||'N/A'}
Grand Total: ${fmt(record.grand_total)} | Validity: ${record.validity_date||'Not set'}
Payment terms: ${record.payment_terms||'N/A'} | Owner: ${ownerName}
Opportunity: ${record.opportunity_id ? 'Linked' : 'Standalone'}
Notes: ${record.notes ? record.notes.slice(0,100) : 'None'}`;
    }

    case 'orders': {
      const relInvoices = invoices.filter(i => i.order_number === record.id || (i.customerId === record.customerId && i.customer === record.customer));
      return `Summarise this order for a CRM user:
Order: ${record.name} (${record.id})
Status: ${record.status} | Currency: ${record.currency||'INR'}
Customer: ${record.customer||'N/A'} | Contact: ${record.contact||'N/A'}
Amount: ${fmt(record.amount)} | Delivery date: ${record.deliveryDate||record.delivery_date||'Not set'}
Payment terms: ${record.payment_terms||'N/A'} | Owner: ${ownerName}
From quotation: ${record.quote_number || 'Direct order'}
Related invoices: ${relInvoices.length} (${relInvoices.filter(i=>i.status==='Paid').length} paid, ${relInvoices.filter(i=>i.status==='Overdue').length} overdue)`;
    }

    case 'invoices': {
      const relOrder = orders.find(o => o.id === record.order_number || o.customer === record.customer);
      const dueDate  = record.dueDate || record.due_date;
      const isOverdue = dueDate && new Date(dueDate) < new Date() && record.status !== 'Paid';
      return `Summarise this invoice for a CRM user:
Invoice: ${record.name} (${record.id})
Status: ${record.status} | Amount: ${fmt(record.amount)}
Customer: ${record.customer||'N/A'} | Due date: ${dueDate||'Not set'}
${isOverdue ? '⚠️ OVERDUE - payment required' : ''}
Payment terms: ${record.payment_terms||'N/A'} | Currency: ${record.currency||'INR'}
Owner: ${ownerName}
Related order: ${relOrder ? relOrder.name : (record.order_number || 'No linked order')}
Outstanding amount: ${record.status === 'Paid' ? 'Fully paid' : fmt(record.amount)}`;
    }

    case 'contacts': {
      const cOpps = opportunities.filter(o => o.contactId === record.id || o.contact === record.name);
      const cActs = activities.filter(a => a.contactId === record.id || a.contact === record.name);
      const customer = customers.find(c => c.id === record.customerId || c.name === record.customer);
      return `Summarise this contact for a CRM user:
Contact: ${record.name}
Status: ${record.status} | Email: ${record.email||'N/A'} | Phone: ${record.phone||'N/A'}
Designation: ${record.designation||'N/A'} | Department: ${record.department||'N/A'}
Company: ${record.customer||'N/A'} (${customer?.status||'N/A'} customer, ${customer?.industry||'N/A'})
Primary contact: ${record.isPrimary ? 'Yes' : 'No'} | Owner: ${ownerName}
Related opportunities: ${cOpps.length} | Activities: ${cActs.length}`;
    }

    case 'activities': {
      const customer = customers.find(c => c.id === record.customerId || c.name === record.customer);
      return `Summarise this CRM activity:
Activity: ${record.name||record.subject}
Type: ${record.activityType||'N/A'} | Status: ${record.status}
Customer: ${record.customer||'N/A'} | Contact: ${record.contact||'N/A'}
Date: ${record.activityDate||'Not set'} | Owner: ${ownerName}
Customer industry: ${customer?.industry||'N/A'}
Notes: ${record.notes ? record.notes.slice(0,120) : 'None'}`;
    }

    case 'products': {
      const usedInOpps = opportunities.filter(o => o.lineItems?.some?.(i=>i.product===record.name));
      return `Summarise this product for a CRM user:
Product: ${record.name}
Category: ${record.category||'N/A'} | Family: ${record.productFamily||'N/A'}
Price: ${fmt(record.price)} | Status: ${record.status}
Used in ${usedInOpps.length} opportunities.`;
    }

    default:
      return `Summarise this CRM record: ${JSON.stringify(record).slice(0,500)}`;
  }
};

// ─── AI Summary Component ─────────────────────────────────────────────────────
export default function AISummary({ page, record }) {
  const appData = useApp();
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [generated, setGenerated] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError('');
    setSummary('');
    try {
      const context = buildContext(page, record, appData);
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `You are a senior business analyst and CRM expert. Write a concise executive summary (2-3 sentences max) for the CRM record provided. Be specific and data-driven — mention key figures, current status, notable associations, and any urgent attention items. End with one actionable insight or recommended next step. Keep it professional and brief.`,
          messages: [{ role: 'user', content: context }],
          max_tokens: 250,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSummary(data.content?.[0]?.text || 'Unable to generate summary.');
      setGenerated(true);
    } catch (e) {
      setError(e.message?.includes('GROQ_API_KEY') || e.message?.includes('ANTHROPIC') || e.message?.includes('GEMINI')
        ? 'AI not configured — add API key to .env.local'
        : 'Summary unavailable');
    } finally {
      setLoading(false);
    }
  }, [page, record?.id]);

  // Auto-generate when record opens
  useEffect(() => {
    if (record?.id) generate();
  }, [record?.id]);

  if (!loading && !summary && !error) return null;

  return (
    <div className={`rounded-[20px] border p-4 transition-all ${
      loading
        ? 'bg-blue-50 border-blue-100'
        : error
        ? 'bg-gray-50 border-gray-100'
        : 'bg-gradient-to-r from-indigo-50 via-blue-50 to-slate-50 border-blue-200'
    }`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
          loading ? 'bg-blue-100' : error ? 'bg-gray-100' : 'bg-gradient-to-r from-[#0F172A] to-blue-700'
        }`}>
          {loading
            ? <div className="flex gap-0.5">{[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.12}s`}}/>)}</div>
            : error
            ? <span className="text-sm">⚠️</span>
            : <span className="text-white text-sm font-bold">AI</span>
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              {loading ? 'Generating AI Summary...' : error ? 'AI Summary' : '✨ AI Summary'}
            </span>
            {generated && !loading && (
              <button onClick={generate} className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors">
                <span>↻</span> Refresh
              </button>
            )}
          </div>

          {loading && (
            <div className="text-sm text-gray-400 italic">Analysing record data...</div>
          )}

          {error && !loading && (
            <div className="text-sm text-gray-400">{error}</div>
          )}

          {summary && !loading && (
            <p className="text-sm text-[#0F172A] leading-relaxed">{summary}</p>
          )}
        </div>
      </div>
    </div>
  );
}
