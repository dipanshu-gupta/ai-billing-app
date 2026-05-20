// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { formatCurrency } from '@/lib/utils';

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ title, value, sub, icon, color }) {
  return (
    <div className={`rounded-[24px] p-5 text-white ${color} shadow-lg`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-3xl">{icon}</div>
        <div className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full">Live</div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-semibold mt-1 opacity-90">{title}</div>
      <div className="text-xs mt-2 opacity-70">{sub}</div>
    </div>
  );
}

// ─── Simple Bar Chart (no recharts dependency) ────────────────────────────────

function SimpleBarChart({ data, valueKey, labelKey, color = '#0F172A' }) {
  if (!data || data.length === 0) return (
    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
  );
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div className="flex items-end gap-2 h-48 pt-4">
      {data.map((d, i) => {
        const pct = max > 0 ? (d[valueKey] / max) * 100 : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="text-xs text-gray-500 font-medium">{formatCurrency(d[valueKey]).replace('₹', '').trim()}</div>
            <div className="w-full rounded-t-lg transition-all" style={{ height: `${Math.max(pct, 4)}%`, backgroundColor: color }} />
            <div className="text-xs text-gray-400 truncate w-full text-center">{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── AI Agent ─────────────────────────────────────────────────────────────────

function AIAgent() {
  const { invoices, leads, opportunities, orders, customers } = useApp();
  const [messages, setMessages] = useState([
    { type: 'assistant', text: 'Hello! I am your AI Billing Agent. Ask me about revenue, leads, pipeline, or any CRM metric.' },
  ]);
  const [input, setInput] = useState('');

  const handleQuery = (query) => {
    const q = query.toLowerCase();
    let response = "I couldn't find relevant data for that query. Try asking about revenue, leads, opportunities, or orders.";

    if (q.includes('revenue')) {
      const total = invoices.reduce((s, i) => s + (i.amount || 0), 0);
      const paid = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + (i.amount || 0), 0);
      response = `Total revenue across all invoices is ${formatCurrency(total)}. Collected: ${formatCurrency(paid)} from ${invoices.filter(i => i.status === 'Paid').length} paid invoice(s).`;
    } else if (q.includes('lead')) {
      const qualified = leads.filter(l => l.status === 'Qualified').length;
      const converted = leads.filter(l => l.status === 'Converted').length;
      response = `${leads.length} total leads. ${qualified} qualified, ${converted} converted. Conversion rate: ${leads.length ? Math.round(converted / leads.length * 100) : 0}%.`;
    } else if (q.includes('pipeline') || q.includes('opportunit')) {
      const value = opportunities.reduce((s, o) => s + (o.amount || 0), 0);
      const won = opportunities.filter(o => o.status === 'Closed Won').length;
      response = `Pipeline value: ${formatCurrency(value)} across ${opportunities.length} opportunities. ${won} closed won.`;
    } else if (q.includes('invoice')) {
      const overdue = invoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.amount, 0);
      const pending = invoices.filter(i => i.status === 'Pending').length;
      response = `${pending} pending invoice(s). ${formatCurrency(overdue)} overdue. Total invoices: ${invoices.length}.`;
    } else if (q.includes('order')) {
      const processing = orders.filter(o => o.status === 'Processing').length;
      response = `${orders.length} total orders. ${processing} currently processing.`;
    } else if (q.includes('customer')) {
      const active = customers.filter(c => c.status === 'Active').length;
      response = `${customers.length} total customers, ${active} active.`;
    }

    setMessages(prev => [...prev, { type: 'user', text: query }, { type: 'assistant', text: response }]);
  };

  return (
    <div className="bg-gradient-to-br from-[#0F172A] via-blue-900 to-blue-950 rounded-[28px] p-6 text-white flex flex-col border border-blue-800/30 shadow-2xl">
      <div className="mb-4">
        <h2 className="text-xl font-bold">AI Billing Agent</h2>
        <p className="text-blue-300 text-xs mt-1">Ask anything about your CRM data</p>
      </div>
      <div className="overflow-y-auto space-y-3 pr-1 min-h-[200px] max-h-[280px]">
        {messages.map((m, i) => (
          <div key={i} className={`rounded-2xl p-4 text-sm ${m.type === 'assistant' ? 'bg-white text-[#0F172A]' : 'bg-blue-700 text-white ml-6'}`}>
            <div className="font-semibold mb-1 text-xs opacity-70">{m.type === 'assistant' ? '🤖 AI Agent' : '👤 You'}</div>
            {m.text}
          </div>
        ))}
        {messages.length === 1 && (
          <div className="space-y-2">
            {['Show revenue summary', 'How many qualified leads?', 'What is the pipeline value?'].map(q => (
              <button key={q} onClick={() => handleQuery(q)} className="w-full bg-white/10 hover:bg-white/20 text-left text-sm px-4 py-3 rounded-xl transition-all">{q}</button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && input.trim()) { handleQuery(input); setInput(''); } }}
          placeholder="Ask AI about your data..."
          className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/40 focus:outline-none"
        />
        <button
          onClick={() => { if (input.trim()) { handleQuery(input); setInput(''); } }}
          className="bg-white text-[#0F172A] px-4 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all"
        >↑</button>
      </div>
    </div>
  );
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

function SalesFunnel({ data }) {
  const max = data[0]?.value || 1;
  return (
    <div className="space-y-3">
      {data.map((stage, i) => {
        const pct = max > 0 ? (stage.value / max) * 100 : 0;
        const dropOff = i > 0 && data[i - 1].value > 0 ? Math.round((1 - stage.value / data[i - 1].value) * 100) : 0;
        return (
          <div key={stage.name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-[#0F172A]">{stage.name}</span>
              <div className="flex items-center gap-3">
                {i > 0 && dropOff > 0 && <span className="text-xs text-red-500">-{dropOff}%</span>}
                <span className="text-sm font-bold text-[#0F172A]">{stage.value}</span>
              </div>
            </div>
            <div className="bg-gray-100 rounded-full h-8 overflow-hidden">
              <div
                className="h-full rounded-full flex items-center justify-end pr-3 transition-all duration-700"
                style={{ width: `${Math.max(pct, 5)}%`, backgroundColor: stage.fill }}
              >
                <span className="text-white text-xs font-bold">{Math.round(pct)}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { customers, products, leads, opportunities, orders, invoices, activities, businessUnits } = useApp();

  const kpis = useMemo(() => {
    const totalRevenue = invoices.reduce((s, i) => s + (i.amount || 0), 0);
    const pipelineValue = opportunities.filter(o => !['Closed Won', 'Closed Lost'].includes(o.status)).reduce((s, o) => s + (o.amount || 0), 0);
    const closedWon = opportunities.filter(o => o.status === 'Closed Won');
    const winRate = opportunities.length ? Math.round(closedWon.length / opportunities.length * 100) : 0;
    const avgDeal = closedWon.length ? Math.round(closedWon.reduce((s, o) => s + o.amount, 0) / closedWon.length) : 0;
    const overdueInvoices = invoices.filter(i => i.status === 'Overdue').length;
    const openLeads = leads.filter(l => ['New', 'Contacted', 'Qualified'].includes(l.status)).length;
    return { totalRevenue, pipelineValue, winRate, avgDeal, overdueInvoices, openLeads };
  }, [invoices, opportunities, leads]);

  const revenueData = useMemo(() => {
    const months = {};
    invoices.forEach(inv => {
      if (!inv.created_at) return;
      const month = new Date(inv.created_at).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      months[month] = (months[month] || 0) + (inv.amount || 0);
    });
    return Object.entries(months).slice(-8).map(([month, amount]) => ({ month, amount }));
  }, [invoices]);

  const funnelData = useMemo(() => [
    { name: 'Leads',         value: leads.length,         fill: '#3B82F6' },
    { name: 'Qualified',     value: leads.filter(l => l.status === 'Qualified').length, fill: '#8B5CF6' },
    { name: 'Opportunities', value: opportunities.length, fill: '#F59E0B' },
    { name: 'Orders',        value: orders.length,        fill: '#10B981' },
    { name: 'Invoices',      value: invoices.length,      fill: '#0F172A' },
  ], [leads, opportunities, orders, invoices]);

  const stageData = useMemo(() => {
    return ['Qualification', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'].map(stage => ({
      stage,
      count: opportunities.filter(o => o.stage === stage).length,
    }));
  }, [opportunities]);

  const crmOverview = [
    { month: 'Customers',     amount: customers.length },
    { month: 'Products',      amount: products.length },
    { month: 'Leads',         amount: leads.length },
    { month: 'Opportunities', amount: opportunities.length },
    { month: 'Orders',        amount: orders.length },
    { month: 'Invoices',      amount: invoices.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[28px] p-6 text-white">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-blue-200 mt-1">Real-time CRM intelligence and business insights</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard title="Total Revenue"     value={formatCurrency(kpis.totalRevenue)}  sub={`${invoices.length} invoices`}       icon="💰" color="bg-gradient-to-br from-green-500 to-emerald-600" />
        <KPICard title="Pipeline Value"    value={formatCurrency(kpis.pipelineValue)} sub="Active opportunities"                icon="📈" color="bg-gradient-to-br from-blue-500 to-blue-700" />
        <KPICard title="Win Rate"          value={`${kpis.winRate}%`}                 sub="Opportunities won"                   icon="🏆" color="bg-gradient-to-br from-purple-500 to-purple-700" />
        <KPICard title="Avg Deal Size"     value={formatCurrency(kpis.avgDeal)}       sub="Per closed deal"                     icon="💎" color="bg-gradient-to-br from-[#0F172A] to-blue-900" />
        <KPICard title="Overdue Invoices"  value={String(kpis.overdueInvoices)}       sub="Requires attention"                  icon="⚠️" color="bg-gradient-to-br from-red-500 to-red-600" />
        <KPICard title="Open Leads"        value={String(kpis.openLeads)}             sub="In pipeline"                         icon="🎯" color="bg-gradient-to-br from-amber-500 to-orange-500" />
      </div>

      {/* Row 1: Revenue + AI */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-[28px] p-6 shadow-lg border border-blue-100">
          <h2 className="text-lg font-bold text-[#0F172A] mb-5">Revenue Over Time</h2>
          <SimpleBarChart data={revenueData} valueKey="amount" labelKey="month" color="#0F172A" />
        </div>
        <AIAgent />
      </div>

      {/* Row 2: Funnel + Pipeline by Stage */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-[28px] p-6 shadow-lg border border-blue-100">
          <h2 className="text-lg font-bold text-[#0F172A] mb-5">Sales Funnel</h2>
          <SalesFunnel data={funnelData} />
        </div>
        <div className="bg-white rounded-[28px] p-6 shadow-lg border border-blue-100">
          <h2 className="text-lg font-bold text-[#0F172A] mb-5">Pipeline by Stage</h2>
          <SimpleBarChart data={stageData} valueKey="count" labelKey="stage" color="#3B82F6" />
        </div>
      </div>

      {/* Row 3: CRM Overview + Business Units */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-[28px] p-6 shadow-lg border border-blue-100">
          <h2 className="text-lg font-bold text-[#0F172A] mb-5">CRM Records Overview</h2>
          <SimpleBarChart data={crmOverview} valueKey="amount" labelKey="month" color="#0F172A" />
        </div>
        <div className="bg-white rounded-[28px] p-6 shadow-lg border border-blue-100">
          <h2 className="text-lg font-bold text-[#0F172A] mb-5">Business Unit Performance</h2>
          {businessUnits.length === 0
            ? <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No business units configured</div>
            : (
              <div className="space-y-4">
                {businessUnits.map(bu => {
                  const rev = invoices.filter(i => i.business_unit_id === bu.id).reduce((s, i) => s + i.amount, 0);
                  const leadsCount = leads.filter(l => l.business_unit_id === bu.id).length;
                  return (
                    <div key={bu.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                      <div>
                        <div className="font-semibold text-[#0F172A]">{bu.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{leadsCount} leads</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[#0F172A]">{formatCurrency(rev)}</div>
                        <div className="text-xs text-gray-400">Revenue</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      </div>

      {/* Executive Summary */}
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[28px] p-6 text-white">
        <h2 className="text-lg font-bold mb-5">Executive Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Customers',  value: customers.length },
            { label: 'Active Products',  value: products.filter(p => p.status === 'Active').length },
            { label: 'Converted Leads',  value: leads.filter(l => l.status === 'Converted').length },
            { label: 'Delivered Orders', value: orders.filter(o => o.status === 'Delivered').length },
          ].map(item => (
            <div key={item.label} className="bg-white/10 rounded-2xl p-4 text-center">
              <div className="text-3xl font-bold">{item.value}</div>
              <div className="text-blue-200 text-sm mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
