// @ts-nocheck
'use client';

import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = { role: 'user' | 'assistant'; content: string; action?: any; timestamp: Date; };

// ─── System Prompt Builder ────────────────────────────────────────────────────
const buildSystemPrompt = (user, data, prefs) => {
  const { customers=[], leads=[], opportunities=[], orders=[], invoices=[], contacts=[], activities=[], quotations=[] } = data;
  const fmtCur = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:prefs?.default_currency||'INR',maximumFractionDigits:0}).format(n||0);
  const pipelineValue = opportunities.reduce((s,o)=>s+Number(o.amount||0),0);
  const wonValue = opportunities.filter(o=>o.stage==='Closed Won').reduce((s,o)=>s+Number(o.amount||0),0);
  const openLeads = leads.filter(l=>!['Converted','Closed','Disqualified'].includes(l.status)).length;
  const overdueInv = invoices.filter(i=>i.status==='Overdue').length;
  const hotOpps = opportunities.filter(o=>['Proposal Sent','Negotiation'].includes(o.stage)).slice(0,5).map(o=>`${o.name} (${fmtCur(o.amount)}, ${o.stage})`).join(', ');

  return `You are the Business Advisor Agent for Business Pro ERP — an intelligent sales assistant and CRM advisor.

USER CONTEXT
Name: ${user?.first_name || ''} ${user?.last_name || ''}
Email: ${user?.email || ''}
Role: ${user?.role || 'Sales User'}

CRM DATA SNAPSHOT (user's accessible records)
- Customers: ${customers.length} total
- Leads: ${leads.length} total (${openLeads} open/active)
- Opportunities: ${opportunities.length} total | Pipeline: ${fmtCur(pipelineValue)} | Won: ${fmtCur(wonValue)}
- Quotations: ${quotations.length} total | ${quotations.filter(q=>q.status==='Draft').length} drafts, ${quotations.filter(q=>q.status==='Sent to Customer').length} sent
- Orders: ${orders.length} total | ${orders.filter(o=>o.status==='Draft').length} drafts, ${orders.filter(o=>o.status==='Processing').length} processing
- Invoices: ${invoices.length} total | ${overdueInv} overdue
- Contacts: ${contacts.length} | Activities: ${activities.length}
- Hot Opportunities: ${hotOpps || 'None in pipeline stages'}

YOUR CAPABILITIES
1. **Data insights**: Summarize records, pipeline analysis, performance metrics
2. **Guided selling**: Next best actions for specific opportunities/leads/customers
3. **Sales advice**: Objection handling, deal strategies, follow-up timing
4. **Record creation**: Create CRM records from natural language descriptions
5. **Status updates**: Recommend status changes and workflow transitions
6. **Forecasting**: Pipeline health and revenue projections

WHEN CREATING RECORDS, respond with a JSON action block at the END of your message:
<action>{"type":"create_record","object":"leads|opportunities|customers|contacts|activities","data":{...fields}}</action>

For activities/tasks suggest:
<action>{"type":"create_record","object":"activities","data":{"name":"Follow up with X","activityType":"Call","status":"Open"}}</action>

TONE & STYLE
- Be concise, professional, and actionable
- Use bullet points for lists and recommendations
- Include specific data from the user's records when relevant
- For guided selling, always suggest a concrete NEXT ACTION
- Format currency as ${prefs?.default_currency || 'INR'}

IMPORTANT: Always be data-driven. Reference actual records when available. Keep responses under 300 words unless a detailed analysis is requested.`;
};

// ─── Action Parser ─────────────────────────────────────────────────────────────
const parseAction = (text) => {
  const match = text.match(/<action>([\s\S]*?)<\/action>/);
  if (!match) return { cleanText: text, action: null };
  try {
    const action = JSON.parse(match[1].trim());
    const cleanText = text.replace(/<action>[\s\S]*?<\/action>/g, '').trim();
    return { cleanText, action };
  } catch { return { cleanText: text, action: null }; }
};

// ─── Singularize helper ──────────────────────────────────────────────────────
const toSingular = (object: string): string => {
  const map: Record<string,string> = {
    customers:     'Customer',
    leads:         'Lead',
    opportunities: 'Opportunity',
    contacts:      'Contact',
    activities:    'Activity',
    orders:        'Order',
    invoices:      'Invoice',
    quotations:    'Quotation',
    products:      'Product',
  };
  return map[object] || object.charAt(0).toUpperCase() + object.slice(1,-1);
};

// ─── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, onActionExecuted }) {
  const [executing, setExecuting] = useState(false);
  const [executed,  setExecuted]  = useState(false);
  const { createRecord } = useApp();

  const { cleanText, action } = parseAction(msg.content);

  const lines = cleanText.split('\n');
  const formatText = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code style="background:#F1F5F9;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:12px;">$1</code>');
  };

  const executeAction = async () => {
    if (!action || executed) return;
    setExecuting(true);
    try {
      if (action.type === 'create_record') {
        await createRecord(action.object, action.data, []);
        setExecuted(true);
        if (onActionExecuted) onActionExecuted(action);
      }
    } catch(e) { alert('Action failed: ' + e.message); }
    setExecuting(false);
  };

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
        {msg.role === 'assistant' && (
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 bg-gradient-to-r from-[#0F172A] to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold">AI</div>
            <span className="text-xs text-gray-400 font-medium">Business Advisor Agent</span>
          </div>
        )}
        <div className={`rounded-[20px] px-5 py-4 text-[15px] leading-relaxed ${
          msg.role === 'user'
            ? 'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-tr-sm shadow-md'
            : 'bg-white border border-blue-100 text-[#0F172A] rounded-tl-sm shadow-md'
        }`}>
          {lines.map((line, i) => {
            if (line.startsWith('- ') || line.startsWith('• ')) {
              return <div key={i} className="flex gap-2 my-0.5"><span className="text-blue-400 mt-0.5">•</span><span dangerouslySetInnerHTML={{__html: formatText(line.slice(2))}}/></div>;
            }
            if (line.startsWith('# ')) return <div key={i} className="font-bold text-base mt-2 mb-1">{line.slice(2)}</div>;
            if (line.startsWith('## ')) return <div key={i} className="font-semibold text-sm mt-2 mb-1 text-blue-700">{line.slice(3)}</div>;
            if (line.trim() === '') return <div key={i} className="h-1.5"/>;
            return <div key={i} dangerouslySetInnerHTML={{__html: formatText(line)}}/>;
          })}

          {action && action.type === 'create_record' && !executed && (
            <div className="mt-3 pt-3 border-t border-blue-100">
              <div className="text-xs text-blue-600 font-semibold mb-2">
                🎯 Suggested Action: Create {toSingular(action.object)} "{action.data?.name}"
              </div>
              <button onClick={executeAction} disabled={executing}
                className="flex items-center gap-2 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50 shadow-md">
                {executing ? '⏳ Creating...' : `✅ Create ${toSingular(action.object)} now`}
              </button>
            </div>
          )}
          {executed && (
            <div className="mt-2 text-xs text-green-600 font-semibold flex items-center gap-1">
              ✅ Record created successfully!
            </div>
          )}
        </div>
        <div className="text-xs text-gray-300 mt-1 px-1">{msg.timestamp.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
      </div>
    </div>
  );
}

// ─── Quick Prompts ─────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: '📊 Pipeline Summary',    prompt: 'Give me a summary of my current sales pipeline with key insights.' },
  { label: '🎯 Next Best Actions',   prompt: 'What are my top 3 next best actions to close deals this week?' },
  { label: '⚠️ Attention Needed',   prompt: 'Which records need my immediate attention? Check overdue items, stalled deals, and pending tasks.' },
  { label: '💡 Guided Selling Tips', prompt: 'Give me guided selling strategies for my current opportunities in negotiation stage.' },
  { label: '📈 Win Rate Analysis',   prompt: 'Analyze my win rate and suggest how I can improve it based on current data.' },
  { label: '🔮 Revenue Forecast',    prompt: 'What is my revenue forecast for the next 30 days based on current pipeline?' },
];

// ─── Main AI Advisor Chat ──────────────────────────────────────────────────────
export default function AIAdvisorChat() {
  const {
    currentUser, customers, leads, opportunities, orders, invoices,
    contacts, activities, quotations, appPreferences,
  } = useApp();

  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `👋 Hello! I'm your **Business Advisor Agent**.\n\nI have access to your CRM data and can help you with:\n- 📊 Pipeline analysis & insights\n- 🎯 Guided selling & next actions\n- 📝 Creating CRM records\n- 💡 Sales strategies & advice\n- 📈 Revenue forecasting\n\nWhat would you like to explore today?`,
      timestamp: new Date(),
    }
  ]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [minimized,setMinimized]= useState(false);
  const messagesEnd = useRef(null);
  const inputRef    = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (open && !minimized) inputRef.current?.focus();
  }, [open, minimized]);

  const crmData = { customers, leads, opportunities, orders, invoices, contacts, activities, quotations };

  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText) return;
    setInput('');

    const userMsg = { role: 'user', content: userText, timestamp: new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(currentUser, crmData, appPreferences);
      const apiMessages  = newMessages
        .filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0) // skip greeting
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system:     systemPrompt,
          messages:   apiMessages,
          max_tokens: 1024,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const reply = data.content?.[0]?.text || 'Sorry, I could not generate a response. Please try again.';

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      }]);
    } catch(e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Connection error: ${e.message}. Please check your connection and try again.`,
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
    role: 'assistant',
    content: `Chat cleared. How can I help you with your sales today?`,
    timestamp: new Date(),
  }]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => { setOpen(true); setMinimized(false); }}
        className={`fixed bottom-8 right-8 z-[200] flex items-center gap-3 bg-gradient-to-r from-[#0F172A] to-blue-700 text-white px-7 py-4 rounded-full shadow-2xl hover:shadow-blue-500/40 hover:scale-105 transition-all font-bold text-base ${open && !minimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        <div className="relative">
          <span className="text-2xl">🤖</span>
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white animate-pulse"/>
        </div>
        Business Advisor Agent
      </button>

      {/* Chat panel */}
      {open && (
        <div className={`fixed bottom-6 right-6 z-[200] flex flex-col bg-white rounded-[28px] shadow-2xl border border-blue-100 transition-all`}
          style={{width: minimized ? '340px' : '620px', height: minimized ? '64px' : '85vh', maxHeight: '85vh'}}>

          {/* Header */}
          <div className="bg-gradient-to-r from-[#0F172A] to-blue-800 rounded-t-[28px] px-6 py-5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">🤖</div>
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-[#0F172A]"/>
              </div>
              <div>
                <div className="text-white font-bold text-lg">Business Advisor Agent</div>
                <div className="text-blue-300 text-xs flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block"/>
                  Online · AI-Powered Sales Assistant
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={clearChat} className="text-white/60 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/10" title="Clear chat">🗑️</button>
              <button onClick={() => setMinimized(!minimized)} className="text-white/60 hover:text-white text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">{minimized ? '▲' : '▼'}</button>
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">✕</button>
            </div>
          </div>

          {!minimized && (<>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 bg-gradient-to-b from-blue-50/30 to-white space-y-2" style={{scrollBehavior:'smooth'}}>
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} onActionExecuted={(action) => {
                  setMessages(prev => [...prev, { role:'assistant', content:`✅ Done! I've created the ${toSingular(action.object)} in your CRM. You can view it in the ${action.object} module. What's next?`, timestamp: new Date() }]);
                }}/>
              ))}
              {loading && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-gradient-to-r from-[#0F172A] to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold">AI</div>
                  <div className="bg-white border border-blue-100 rounded-[20px] rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1 items-center">
                      {[0,1,2].map(i=><div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}
                      <span className="text-xs text-gray-400 ml-1">Analyzing your data...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEnd}/>
            </div>

            {/* Quick prompts */}
            <div className="px-4 py-3 border-t border-blue-50 bg-gradient-to-b from-blue-50/50 to-white flex-shrink-0">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Quick Actions</div>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map(qp => (
                  <button key={qp.label} onClick={() => sendMessage(qp.prompt)} disabled={loading}
                    className="bg-white hover:bg-blue-50 text-blue-700 text-sm font-semibold px-4 py-2.5 rounded-xl border border-blue-200 hover:border-blue-400 transition-all whitespace-nowrap disabled:opacity-50 shadow-sm">
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="px-5 pb-5 pt-3 bg-white flex-shrink-0">
              <div className="flex items-end gap-3 bg-gray-50 rounded-2xl border-2 border-blue-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 overflow-hidden px-5 py-4">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask me anything — pipeline, deals, strategies, next actions..."
                  rows={1}
                  style={{resize:'none',overflow:'hidden',minHeight:'28px',maxHeight:'120px'}}
                  onInput={e => { e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }}
                  className="flex-1 bg-transparent text-base text-[#0F172A] focus:outline-none placeholder:text-gray-400 leading-relaxed"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-[#0F172A] to-blue-700 text-white rounded-xl flex items-center justify-center disabled:opacity-40 hover:opacity-90 shadow-lg transition-all"
                >
                  {loading ? <span className="text-sm animate-spin">⟳</span> : <span className="text-lg font-bold">↑</span>}
                </button>
              </div>
              <div className="text-center mt-2 text-xs text-gray-400">⏎ Send · ⇧⏎ New line · Powered by AI</div>
            </div>
          </>)}
        </div>
      )}
    </>
  );
}
