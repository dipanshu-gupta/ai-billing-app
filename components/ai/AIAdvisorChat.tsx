// @ts-nocheck
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { formatCurrency } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = {
  role: 'user' | 'assistant';
  content: string;
  action?: any;
  chart?: any;
  timestamp: Date;
};

// ─── System Prompt Builder ────────────────────────────────────────────────────
const buildSystemPrompt = (user, data, prefs, isB2C) => {
  const cur = prefs?.default_currency || 'INR';
  const fmt = n => new Intl.NumberFormat('en-IN', { style:'currency', currency:cur, maximumFractionDigits:0 }).format(n||0);

  if (isB2C) {
    const { retailCustomers=[], retailProducts=[], retailOrders=[], retailInvoices=[], retailActivities=[] } = data;
    const todaySales = retailInvoices.filter(i => i.invoice_date?.slice(0,10) === new Date().toISOString().slice(0,10)).reduce((s,i) => s+Number(i.amount||0), 0);
    const topProducts = [...retailProducts].sort((a,b) => Number(b.price||0)-Number(a.price||0)).slice(0,5).map(p=>`${p.name} (${fmt(p.price)})`).join(', ');
    const lowStock = retailProducts.filter(p => Number(p.stock_quantity||0) <= Number(p.reorder_level||5)).length;
    const vipCustomers = retailCustomers.filter(c => c.status==='VIP').length;

    return `You are the AI Business Advisor for Umbrella Suite — a smart retail assistant helping ${user?.first_name||'the user'} manage their B2C retail operations.

USER: ${user?.first_name||''} ${user?.last_name||''} | ${user?.email||''} | ${user?.designation||'Retail Manager'}

RETAIL DATA SNAPSHOT
- Customers: ${retailCustomers.length} total | ${vipCustomers} VIP
- Products: ${retailProducts.length} total | ${lowStock} low/out of stock
- Orders: ${retailOrders.length} total | ${retailOrders.filter(o=>o.status==='Completed').length} completed | ${retailOrders.filter(o=>o.status==='Draft').length} pending
- Invoices: ${retailInvoices.length} total | Today's sales: ${fmt(todaySales)}
- Activities: ${retailActivities.length} total
- Top Products: ${topProducts || 'None'}
- Currency: ${cur}

YOUR CAPABILITIES
1. Answer questions about retail data — customers, products, orders, invoices
2. Create new records — "Create a new customer named John", "Add a product called..."
3. Update records — "Mark order RORD-001 as completed", "Update stock of Product X"
4. Convert records — "Create an invoice from order RORD-001"
5. Generate reports — sales by channel, top customers, product performance
6. Revenue forecasts — daily/weekly/monthly projections based on trends
7. Business insights — customer segmentation, loyalty analysis, stock alerts
8. Recommend actions — follow up on pending orders, restock alerts

RESPONSE RULES — CRITICAL:
- NEVER output JSON, HTML, code blocks, or technical syntax in your replies
- ALWAYS respond in plain conversational English
- When you need to create/update a record, describe what you're doing naturally, then include ONE action tag
- Format numbers as currency (${cur}), use bullet points for lists
- Be concise — max 250 words unless detailed analysis requested
- If asked for a chart/report, describe the data clearly in text first
- Reference actual data from the snapshot above when answering

WHEN CREATING RECORDS — include this at the very end of your response, never in the middle:
<action>{"type":"create_record","object":"retailCustomers|retailProducts|retailOrders|retailInvoices|retailActivities","data":{...}}</action>

WHEN UPDATING — include:
<action>{"type":"update_record","object":"...","id":"...","data":{...}}</action>

WHEN GENERATING A CHART — include:
<chart>{"type":"bar|line|pie","title":"...","labels":[...],"data":[...]}</chart>`;
  }

  // B2B Mode
  const { customers=[], leads=[], opportunities=[], orders=[], invoices=[], contacts=[], activities=[], quotations=[], products=[] } = data;
  const pipeline = opportunities.reduce((s,o) => s+Number(o.amount||0), 0);
  const won = opportunities.filter(o=>o.stage==='Closed Won').reduce((s,o) => s+Number(o.amount||0), 0);
  const openLeads = leads.filter(l=>!['Converted','Lost','Disqualified'].includes(l.status)).length;
  const overdueInv = invoices.filter(i=>i.status==='Overdue').length;
  const hotOpps = opportunities.filter(o=>['Proposal Sent','Negotiation'].includes(o.stage)).slice(0,5).map(o=>`${o.name} (${fmt(o.amount)}, ${o.stage})`).join('; ');

  return `You are the AI Business Advisor for Umbrella Suite ERP — an intelligent CRM and sales assistant helping ${user?.first_name||'the user'} grow their business.

USER: ${user?.first_name||''} ${user?.last_name||''} | ${user?.email||''} | ${user?.designation||'Sales User'}

CRM DATA SNAPSHOT
- Customers: ${customers.length} | Contacts: ${contacts.length}
- Leads: ${leads.length} total | ${openLeads} active/open
- Opportunities: ${opportunities.length} | Pipeline: ${fmt(pipeline)} | Won: ${fmt(won)}
- Quotations: ${quotations.length} | ${quotations.filter(q=>q.status==='Draft').length} drafts | ${quotations.filter(q=>q.status==='Sent to Customer').length} sent
- Orders: ${orders.length} | ${orders.filter(o=>['Draft','Pending'].includes(o.status)).length} pending
- Invoices: ${invoices.length} | ${overdueInv} overdue
- Activities: ${activities.length} | Products: ${products.length}
- Hot Deals: ${hotOpps || 'None in hot stages'}
- Currency: ${cur}

YOUR CAPABILITIES
1. Answer questions about any CRM data — leads, customers, deals, invoices
2. Create records — "Create a lead for ABC Corp", "Add a contact at XYZ"
3. Update records — "Move opportunity X to Negotiation stage"
4. Convert records — "Create a quotation from opportunity X"
5. Generate reports — pipeline analysis, win rate, revenue by customer
6. Revenue forecasts — 30/60/90 day projections based on pipeline
7. Sales coaching — objection handling, deal strategies, follow-up timing
8. Next best actions — prioritized action list for this week

RESPONSE RULES — CRITICAL:
- NEVER output JSON, HTML, code blocks, or raw data structures
- ALWAYS respond in plain conversational English that any business user can understand
- Format numbers as currency, use bullet points and headings for clarity
- Reference actual data from the snapshot above
- Be concise — max 300 words unless detailed analysis requested
- When creating/updating records, describe it naturally then add the action tag at the end

WHEN CREATING RECORDS — at the very end only:
<action>{"type":"create_record","object":"leads|opportunities|customers|contacts|activities|orders|invoices|quotations","data":{...}}</action>

WHEN UPDATING:
<action>{"type":"update_record","object":"...","id":"...","data":{...}}</action>

WHEN GENERATING A CHART:
<chart>{"type":"bar|line|pie","title":"...","labels":[...],"data":[...]}</chart>`;
};

// ─── Action Parser ────────────────────────────────────────────────────────────
const parseResponse = (text) => {
  let action = null;
  let chart  = null;

  const actionMatch = text.match(/<action>([\s\S]*?)<\/action>/);
  if (actionMatch) {
    try { action = JSON.parse(actionMatch[1].trim()); } catch {}
  }

  const chartMatch = text.match(/<chart>([\s\S]*?)<\/chart>/);
  if (chartMatch) {
    try { chart = JSON.parse(chartMatch[1].trim()); } catch {}
  }

  const cleanText = text
    .replace(/<action>[\s\S]*?<\/action>/g, '')
    .replace(/<chart>[\s\S]*?<\/chart>/g, '')
    .replace(/```[\s\S]*?```/g, '') // remove code blocks
    .replace(/`[^`]+`/g, match => match.slice(1,-1)) // inline code → plain text
    .trim();

  return { cleanText, action, chart };
};

// ─── Mini Chart Component ─────────────────────────────────────────────────────
function MiniChart({ chart }) {
  if (!chart) return null;
  const max = Math.max(...chart.data, 1);
  const colors = ['#0F172A','#1e40af','#0369a1','#0e7490','#065f46','#1d4ed8'];

  if (chart.type === 'pie') {
    const total = chart.data.reduce((s,v)=>s+v,0);
    let offset = 0;
    return (
      <div className="mt-3 p-4 bg-blue-50 rounded-2xl">
        <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">{chart.title}</div>
        <div className="flex flex-wrap gap-2">
          {chart.labels.map((label, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{background: colors[i%colors.length]}}/>
              <span className="text-xs text-gray-600">{label}: <strong>{total > 0 ? Math.round(chart.data[i]/total*100) : 0}%</strong></span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 p-4 bg-blue-50 rounded-2xl">
      <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">{chart.title}</div>
      <div className="flex items-end gap-1.5 h-24">
        {chart.labels.map((label, i) => (
          <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <div className="text-[9px] text-gray-500 font-semibold">{chart.data[i]}</div>
            <div className="w-full rounded-t-md transition-all"
              style={{height: `${Math.round((chart.data[i]/max)*80)}px`, background: colors[i%colors.length], minHeight: chart.data[i]>0?'4px':'0'}}/>
            <div className="text-[8px] text-gray-400 text-center leading-tight truncate w-full">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, onActionExecuted }) {
  const [executing, setExecuting] = useState(false);
  const [executed,  setExecuted]  = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const { createRecord, updateRecord, createRetailRecord } = useApp();

  const { cleanText, action, chart } = parseResponse(msg.content);

  const OBJECT_LABELS = {
    customers:'Customer', leads:'Lead', opportunities:'Opportunity', contacts:'Contact',
    activities:'Activity', orders:'Order', invoices:'Invoice', quotations:'Quotation',
    products:'Product', retailCustomers:'Retail Customer', retailProducts:'Product',
    retailOrders:'Order', retailInvoices:'Invoice', retailActivities:'Activity',
  };

  const formatText = (text) => text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  const executeAction = async () => {
    if (!action || executed) return;
    setExecuting(true);
    try {
      const isRetail = action.object?.startsWith('retail');
      if (action.type === 'create_record') {
        if (isRetail) await createRetailRecord(action.object, action.data, []);
        else await createRecord(action.object, action.data, []);
        setExecuted(true);
        setActionMsg(`✅ ${OBJECT_LABELS[action.object]||'Record'} created successfully!`);
        if (onActionExecuted) onActionExecuted(action);
      } else if (action.type === 'update_record') {
        // Find existing record and update
        if (isRetail) await createRetailRecord(action.object, action.data, []); // update path
        setExecuted(true);
        setActionMsg(`✅ Record updated successfully!`);
        if (onActionExecuted) onActionExecuted(action);
      }
    } catch(e) {
      setActionMsg(`⚠️ Action failed: ${e.message}`);
    }
    setExecuting(false);
  };

  const lines = cleanText.split('\n');

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[88%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
        {msg.role === 'assistant' && (
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 bg-gradient-to-r from-[#0F172A] to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold">AI</div>
            <span className="text-xs text-gray-400 font-medium">Business Advisor</span>
          </div>
        )}
        <div className={`rounded-[20px] px-5 py-4 text-[14px] leading-relaxed ${
          msg.role === 'user'
            ? 'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-tr-sm shadow-md'
            : 'bg-white border border-blue-100 text-[#0F172A] rounded-tl-sm shadow-sm'
        }`}>
          {lines.map((line, i) => {
            if (line.startsWith('# ')) return <div key={i} className="font-bold text-base mt-2 mb-1">{line.slice(2)}</div>;
            if (line.startsWith('## ')) return <div key={i} className="font-semibold text-sm mt-2 mb-1 text-blue-700">{line.slice(3)}</div>;
            if (line.startsWith('### ')) return <div key={i} className="font-semibold text-xs mt-1.5 mb-0.5 text-blue-600 uppercase tracking-wide">{line.slice(4)}</div>;
            if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
              return <div key={i} className="flex gap-2 my-0.5 ml-1">
                <span className={`mt-0.5 flex-shrink-0 ${msg.role==='user'?'text-blue-300':'text-blue-500'}`}>•</span>
                <span dangerouslySetInnerHTML={{__html: formatText(line.slice(2))}}/>
              </div>;
            }
            if (/^\d+\./.test(line.trim())) {
              return <div key={i} className="flex gap-2 my-0.5 ml-1">
                <span className={`flex-shrink-0 font-semibold ${msg.role==='user'?'text-blue-300':'text-blue-500'}`}>{line.match(/^\d+/)[0]}.</span>
                <span dangerouslySetInnerHTML={{__html: formatText(line.replace(/^\d+\.\s*/,''))}}/>
              </div>;
            }
            if (line.trim() === '') return <div key={i} className="h-2"/>;
            return <div key={i} className="mb-0.5" dangerouslySetInnerHTML={{__html: formatText(line)}}/>;
          })}

          {chart && <MiniChart chart={chart}/>}

          {action && !executed && (
            <div className="mt-3 pt-3 border-t border-blue-100">
              <div className="text-xs text-blue-600 font-semibold mb-2">
                🎯 Ready to {action.type === 'create_record' ? 'create' : 'update'}: {OBJECT_LABELS[action.object]||'Record'}
                {action.data?.name ? ` — "${action.data.name}"` : ''}
              </div>
              <button onClick={executeAction} disabled={executing}
                className="flex items-center gap-2 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50 shadow-md">
                {executing ? '⏳ Processing...' : `✅ ${action.type === 'create_record' ? 'Create' : 'Update'} Now`}
              </button>
            </div>
          )}
          {actionMsg && <div className="mt-2 text-xs font-semibold text-green-600">{actionMsg}</div>}
        </div>
        <div className="text-xs text-gray-300 mt-1 px-1">{msg.timestamp.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
      </div>
    </div>
  );
}

// ─── Quick Prompts ────────────────────────────────────────────────────────────
const B2B_PROMPTS = [
  { label:'📊 Pipeline Summary',    prompt:'Give me a clear summary of my current sales pipeline with key numbers and insights.' },
  { label:'🎯 Top Priorities',      prompt:'What are my top 3 priorities this week to close more deals? Give me specific actions.' },
  { label:'⚠️ Needs Attention',     prompt:'Which deals or records need my immediate attention right now? Check overdue items, stalled deals, and pending tasks.' },
  { label:'📈 Revenue Forecast',    prompt:'What is my expected revenue for the next 30 days based on current pipeline? Show me a realistic projection.' },
  { label:'💡 Win More Deals',      prompt:'Give me proven strategies to improve my win rate based on my current opportunities.' },
  { label:'📋 Weekly Digest',       prompt:'Give me a complete weekly business digest — pipeline, overdue items, top customers, and recommended actions.' },
];

const B2C_PROMPTS = [
  { label:'📊 Sales Overview',      prompt:'Give me a summary of my retail sales performance — orders, revenue, top products.' },
  { label:'🛍️ Top Customers',       prompt:'Who are my top customers by purchase value? What can I do to retain them?' },
  { label:'📦 Stock Alerts',        prompt:'Which products are low on stock or out of stock? What should I reorder?' },
  { label:'📈 Revenue Forecast',    prompt:'What is my expected revenue for the next 30 days based on recent sales trends?' },
  { label:'🎁 Loyalty Insights',    prompt:'Give me insights on my loyalty program — VIP customers, points earned, and recommendations.' },
  { label:'⚠️ Pending Orders',      prompt:'Which orders are still pending or incomplete? What actions should I take?' },
];

// ─── Voice Input Hook ─────────────────────────────────────────────────────────
function useVoiceInput(onTranscript) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Voice input is not supported in your browser. Please use Chrome.'); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart  = () => setListening(true);
    recognition.onend    = () => setListening(false);
    recognition.onerror  = () => setListening(false);
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      onTranscript(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, startListening, stopListening };
}

// ─── Text to Speech ───────────────────────────────────────────────────────────
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.slice(0, 500));
  utterance.lang = 'en-IN';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AIAdvisorChat() {
  const {
    currentUser, customers, leads, opportunities, orders, invoices,
    contacts, activities, quotations, products, appPreferences,
    retailCustomers, retailProducts, retailOrders, retailInvoices, retailActivities,
  } = useApp();

  const isB2C = appPreferences?.b2c_mode === true;

  const QUICK_PROMPTS = isB2C ? B2C_PROMPTS : B2B_PROMPTS;

  const [open,       setOpen]       = useState(false);
  const [minimized,  setMinimized]  = useState(false);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `👋 Hello! I'm your **Business Advisor** — your AI-powered assistant for Umbrella Suite.\n\nI can help you:\n- 📊 Analyse your business data and generate reports\n- 📝 Create, update, and convert records\n- 📈 Forecast revenue and sales trends\n- 🎯 Prioritise your tasks and next actions\n- 💡 Provide business insights and recommendations\n\nJust ask me anything in plain English — no technical knowledge needed!`,
      timestamp: new Date(),
    }
  ]);

  const messagesEnd = useRef(null);
  const inputRef    = useRef(null);

  const crmData = isB2C
    ? { retailCustomers, retailProducts, retailOrders, retailInvoices, retailActivities }
    : { customers, leads, opportunities, orders, invoices, contacts, activities, quotations, products };

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, open]);

  useEffect(() => {
    const h = () => { setOpen(o => !o); setMinimized(false); };
    window.addEventListener('toggle-ai-chat', h);
    return () => window.removeEventListener('toggle-ai-chat', h);
  }, []);

  useEffect(() => { if (open && !minimized) inputRef.current?.focus(); }, [open, minimized]);

  const { listening, startListening, stopListening } = useVoiceInput((transcript) => {
    setInput(transcript);
  });

  const sendMessage = async (text?: string) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput('');

    const userMsg: Message = { role:'user', content:userText, timestamp:new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(currentUser, crmData, appPreferences, isB2C);
      const apiMessages = newMessages
        .filter((m,i) => !(m.role==='assistant' && i===0))
        .map(m => ({ role:m.role, content:m.content }));

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system:systemPrompt, messages:apiMessages, max_tokens:1200 }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const reply = data.content?.[0]?.text || 'Sorry, I could not generate a response. Please try again.';

      const assistantMsg: Message = { role:'assistant', content:reply, timestamp:new Date() };
      setMessages(prev => [...prev, assistantMsg]);

      if (voiceEnabled) {
        const { cleanText } = parseResponse(reply);
        speak(cleanText);
      }
    } catch(e: any) {
      setMessages(prev => [...prev, {
        role:'assistant',
        content:`⚠️ I ran into a connection issue: ${e.message}. Please try again.`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => setMessages([{
    role:'assistant',
    content:`Chat cleared! How can I help you today?`,
    timestamp: new Date(),
  }]);

  return (
    <>
      {open && (
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col bg-white rounded-[28px] shadow-2xl border border-blue-100 transition-all"
          style={{width: minimized?'360px':'640px', height: minimized?'72px':'88vh', maxHeight:'88vh'}}>

          {/* Header */}
          <div className="bg-gradient-to-r from-[#0F172A] to-blue-800 rounded-t-[28px] px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">🤖</div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0F172A]"/>
              </div>
              <div>
                <div className="text-white font-bold text-base">AI Business Advisor</div>
                <div className="text-blue-300 text-xs flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block"/>
                  Online · {isB2C ? 'B2C Retail' : 'B2B CRM'} Mode
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setVoiceEnabled(v => !v)}
                title={voiceEnabled ? 'Disable voice responses' : 'Enable voice responses'}
                className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-all ${voiceEnabled ? 'bg-green-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
                🔊
              </button>
              <button onClick={clearChat} className="text-white/60 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-sm" title="Clear chat">🗑</button>
              <button onClick={() => setMinimized(m => !m)} className="text-white/60 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-lg">
                {minimized ? '▲' : '▼'}
              </button>
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-base">✕</button>
            </div>
          </div>

          {!minimized && (<>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 bg-gradient-to-b from-blue-50/20 to-white" style={{scrollBehavior:'smooth'}}>
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} onActionExecuted={(action) => {
                  const label = action.object?.startsWith('retail') ? 'retail' : action.object;
                  setMessages(prev => [...prev, {
                    role:'assistant',
                    content:`✅ Done! The ${label} record has been created in your system. You can view it in the ${label} module. Is there anything else you'd like to do?`,
                    timestamp: new Date(),
                  }]);
                }}/>
              ))}
              {loading && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-gradient-to-r from-[#0F172A] to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold">AI</div>
                  <div className="bg-white border border-blue-100 rounded-[20px] rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1 items-center">
                      {[0,1,2].map(i=><div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}
                      <span className="text-xs text-gray-400 ml-2">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEnd}/>
            </div>

            {/* Quick Prompts */}
            <div className="px-4 py-3 border-t border-blue-50 bg-white flex-shrink-0">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Quick Actions</div>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map(qp => (
                  <button key={qp.label} onClick={() => sendMessage(qp.prompt)} disabled={loading}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-2 rounded-xl border border-blue-200 hover:border-blue-400 transition-all whitespace-nowrap disabled:opacity-50">
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="px-5 pb-5 pt-2 bg-white rounded-b-[28px] flex-shrink-0">
              <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border-2 border-blue-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 overflow-hidden px-4 py-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={listening ? '🎤 Listening...' : 'Ask anything — create records, get insights, forecast revenue...'}
                  rows={1}
                  style={{resize:'none', overflow:'hidden', minHeight:'24px', maxHeight:'120px'}}
                  onInput={e => { (e.target as any).style.height='auto'; (e.target as any).style.height=Math.min((e.target as any).scrollHeight,120)+'px'; }}
                  className="flex-1 bg-transparent text-sm text-[#0F172A] focus:outline-none placeholder:text-gray-400 leading-relaxed"
                />
                {/* Voice button */}
                <button
                  onClick={listening ? stopListening : startListening}
                  title={listening ? 'Stop listening' : 'Speak your question'}
                  className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all text-base ${
                    listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-500 hover:bg-blue-100 hover:text-blue-700'
                  }`}>
                  🎤
                </button>
                {/* Send button */}
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-[#0F172A] to-blue-700 text-white rounded-xl flex items-center justify-center disabled:opacity-40 hover:opacity-90 shadow-md transition-all text-lg">
                  {loading ? '⟳' : '↑'}
                </button>
              </div>
              <div className="text-center mt-1.5 text-[10px] text-gray-300">
                ⏎ Send · ⇧⏎ New line · 🎤 Voice input · {voiceEnabled ? '🔊 Voice replies ON' : '🔇 Voice replies OFF'}
              </div>
            </div>
          </>)}
        </div>
      )}
    </>
  );
}
