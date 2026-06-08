// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, FunnelChart, Funnel, LabelList,
} from 'recharts';

const COLORS = ['#0F172A','#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6'];

const DATE_RANGES = [
  { v:'week',  l:'This Week' },
  { v:'month', l:'This Month' },
  { v:'quarter',l:'This Quarter' },
  { v:'year',  l:'This Year' },
  { v:'all',   l:'All Time' },
];

const filterByRange = (items, range) => {
  if (range === 'all') return items;
  const now = new Date(); const sod = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const starts = {
    week:    new Date(sod - sod.getDay()*86400000),
    month:   new Date(now.getFullYear(),now.getMonth(),1),
    quarter: new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1),
    year:    new Date(now.getFullYear(),0,1),
  };
  const start = starts[range];
  return items.filter(r => r.created_at && new Date(r.created_at) >= start);
};

const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n||0);
const fmtShort = n => n >= 10000000 ? `₹${(n/10000000).toFixed(1)}Cr` : n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : fmt(n);

export default function DashboardPage() {
  const { leads, opportunities, customers, orders, invoices, activities, quotations, contacts, currentUser, appPreferences } = useApp();
  const [dateRange,   setDateRange]   = useState('month');
  const [activeChart, setActiveChart] = useState('pipeline');

  const fLeads  = useMemo(()=>filterByRange(leads,  dateRange),[leads,  dateRange]);
  const fOpps   = useMemo(()=>filterByRange(opportunities, dateRange),[opportunities,  dateRange]);
  const fOrders = useMemo(()=>filterByRange(orders, dateRange),[orders, dateRange]);
  const fInv    = useMemo(()=>filterByRange(invoices,dateRange),[invoices,dateRange]);
  const fQuotes = useMemo(()=>filterByRange(quotations,dateRange),[quotations,dateRange]);

  // KPI calculations
  const kpis = useMemo(()=>({
    pipelineValue:   fOpps.filter(o=>!['Closed Won','Closed Lost'].includes(o.stage)).reduce((s,o)=>s+Number(o.amount||0),0),
    wonValue:        fOpps.filter(o=>o.stage==='Closed Won').reduce((s,o)=>s+Number(o.amount||0),0),
    openLeads:       fLeads.filter(l=>!['Converted','Disqualified','Closed'].includes(l.status)).length,
    convRate:        fLeads.length ? Math.round(fLeads.filter(l=>l.status==='Converted').length/fLeads.length*100) : 0,
    overdueInv:      invoices.filter(i=>i.status==='Overdue').reduce((s,i)=>s+Number(i.amount||0),0),
    ordersValue:     fOrders.reduce((s,o)=>s+Number(o.amount||0),0),
    totalCustomers:  customers.length,
    quotesOut:       fQuotes.filter(q=>q.status==='Sent to Customer').length,
    wonCount:        fOpps.filter(o=>o.stage==='Closed Won').length,
    lostCount:       fOpps.filter(o=>o.stage==='Closed Lost').length,
  }),[fLeads,fOpps,fOrders,fInv,fQuotes,customers,invoices]);

  // Win rate
  const winRate = (kpis.wonCount + kpis.lostCount) > 0
    ? Math.round(kpis.wonCount / (kpis.wonCount + kpis.lostCount) * 100) : 0;

  // Pipeline by stage
  const pipelineData = useMemo(()=>{
    const stages = {};
    opportunities.filter(o=>!['Closed Won','Closed Lost'].includes(o.stage)).forEach(o=>{
      stages[o.stage] = (stages[o.stage]||0) + Number(o.amount||0);
    });
    return Object.entries(stages).map(([stage,value])=>({ stage, value, count: opportunities.filter(o=>o.stage===stage).length }));
  },[opportunities]);

  // Leads by source
  const leadsBySource = useMemo(()=>{
    const src = {};
    leads.forEach(l=>{ src[l.source||'Unknown'] = (src[l.source||'Unknown']||0)+1; });
    return Object.entries(src).map(([name,value])=>({ name, value })).sort((a,b)=>b.value-a.value).slice(0,6);
  },[leads]);

  // Monthly revenue (last 6 months)
  const monthlyRevenue = useMemo(()=>{
    const months = {};
    const now = new Date();
    for (let i=5;i>=0;i--) {
      const d = new Date(now.getFullYear(),now.getMonth()-i,1);
      const key = d.toLocaleString('en-IN',{month:'short',year:'2-digit'});
      months[key] = { month:key, orders:0, invoices:0 };
    }
    orders.forEach(o=>{ const d=new Date(o.created_at); const k=d.toLocaleString('en-IN',{month:'short',year:'2-digit'}); if(months[k]) months[k].orders+=Number(o.amount||0); });
    invoices.filter(i=>i.status==='Paid').forEach(i=>{ const d=new Date(i.created_at); const k=d.toLocaleString('en-IN',{month:'short',year:'2-digit'}); if(months[k]) months[k].invoices+=Number(i.amount||0); });
    return Object.values(months);
  },[orders,invoices]);

  // Activity breakdown
  const activityData = useMemo(()=>{
    const types = {};
    activities.forEach(a=>{ types[a.activityType||'Other']=(types[a.activityType||'Other']||0)+1; });
    return Object.entries(types).map(([name,value])=>({ name, value }));
  },[activities]);

  // Quote status funnel
  const quoteFunnel = useMemo(()=>{
    const stages = ['Draft','Submitted','Approved','Sent to Customer','Accepted','Ordered'];
    return stages.map(s=>({ name:s, value: quotations.filter(q=>q.status===s).length })).filter(s=>s.value>0);
  },[quotations]);

  // Recent records
  const recentLeads = [...leads].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
  const recentOpps  = [...opportunities].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);

  const StatCard = ({ label, value, sub, icon, color, trend }) => (
    <div className={`bg-gradient-to-br ${color} rounded-[20px] p-5 text-white shadow-lg`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">{label}</div>
          <div className="text-2xl font-bold leading-tight">{value}</div>
          {sub && <div className="text-white/70 text-xs mt-1">{sub}</div>}
        </div>
        <div className="text-3xl opacity-80">{icon}</div>
      </div>
      {trend !== undefined && (
        <div className={`mt-3 text-xs font-semibold flex items-center gap-1 ${trend>=0?'text-green-300':'text-red-300'}`}>
          {trend>=0?'▲':'▼'} {Math.abs(trend)}% vs last period
        </div>
      )}
    </div>
  );

  const chartTabs = [
    { k:'pipeline',  l:'Pipeline' },
    { k:'revenue',   l:'Revenue' },
    { k:'leads',     l:'Lead Sources' },
    { k:'activity',  l:'Activities' },
    ...(appPreferences?.cpq_enabled!==false ? [{ k:'quotes',l:'Quotations' }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A]">
            Good {new Date().getHours()<12?'Morning':new Date().getHours()<17?'Afternoon':'Evening'}, {currentUser?.first_name||'there'} 👋
          </h1>
          <p className="text-gray-500 mt-1">Here's your business snapshot for <span className="font-semibold text-[#0F172A]">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</span></p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-blue-100 rounded-2xl p-1.5 shadow-sm">
          {DATE_RANGES.map(r=>(
            <button key={r.v} onClick={()=>setDateRange(r.v)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${dateRange===r.v?'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white shadow':'text-gray-500 hover:text-[#0F172A]'}`}>
              {r.l}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
        <div className="col-span-2"><StatCard label="Pipeline Value" value={fmtShort(kpis.pipelineValue)} sub={`${fOpps.filter(o=>!['Closed Won','Closed Lost'].includes(o.stage)).length} active deals`} icon="💼" color="from-[#0F172A] to-blue-900"/></div>
        <div className="col-span-2"><StatCard label="Won Revenue" value={fmtShort(kpis.wonValue)} sub={`${kpis.wonCount} deals closed`} icon="🏆" color="from-emerald-600 to-green-700"/></div>
        <div className="col-span-2"><StatCard label="Orders Value" value={fmtShort(kpis.ordersValue)} sub={`${fOrders.length} orders`} icon="🛒" color="from-blue-600 to-indigo-700"/></div>
        <div className="col-span-2"><StatCard label="Overdue Invoices" value={fmtShort(kpis.overdueInv)} sub={`${invoices.filter(i=>i.status==='Overdue').length} invoices`} icon="⚠️" color="from-red-500 to-rose-600"/></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
        <div className="col-span-2"><StatCard label="Open Leads" value={kpis.openLeads} sub={`${fLeads.length} total this period`} icon="🎯" color="from-amber-500 to-orange-600"/></div>
        <div className="col-span-2"><StatCard label="Win Rate" value={`${winRate}%`} sub={`${kpis.wonCount}W / ${kpis.lostCount}L`} icon="📈" color="from-purple-600 to-violet-700"/></div>
        <div className="col-span-2"><StatCard label="Customers" value={kpis.totalCustomers} sub={`${customers.filter(c=>c.status==='Active').length} active`} icon="👥" color="from-teal-500 to-cyan-600"/></div>
        <div className="col-span-2"><StatCard label="Quotes Sent" value={kpis.quotesOut} sub={`${fQuotes.length} total quotes`} icon="📄" color="from-pink-500 to-rose-500"/></div>
      </div>

      {/* Main Charts */}
      <div className="bg-white rounded-[28px] border border-blue-100 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-50">
          <h2 className="text-lg font-bold text-[#0F172A]">Analytics</h2>
          <div className="flex gap-1 bg-gray-50 rounded-2xl p-1">
            {chartTabs.map(t=>(
              <button key={t.k} onClick={()=>setActiveChart(t.k)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeChart===t.k?'bg-white text-[#0F172A] shadow':'text-gray-500 hover:text-[#0F172A]'}`}>
                {t.l}
              </button>
            ))}
          </div>
        </div>
        <div className="p-6">
          {activeChart === 'pipeline' && (
            <div>
              <p className="text-sm text-gray-400 mb-4">Open opportunity value by stage</p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={pipelineData} margin={{top:5,right:30,left:20,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                  <XAxis dataKey="stage" tick={{fontSize:12}}/>
                  <YAxis tickFormatter={v=>fmtShort(v)} tick={{fontSize:11}}/>
                  <Tooltip formatter={v=>fmt(v)} labelFormatter={l=>`Stage: ${l}`}/>
                  <Bar dataKey="value" name="Pipeline Value" radius={[8,8,0,0]}>
                    {pipelineData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {activeChart === 'revenue' && (
            <div>
              <p className="text-sm text-gray-400 mb-4">Monthly orders and paid invoices (last 6 months)</p>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={monthlyRevenue} margin={{top:5,right:30,left:20,bottom:5}}>
                  <defs>
                    <linearGradient id="gOrders" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0F172A" stopOpacity={0.2}/><stop offset="95%" stopColor="#0F172A" stopOpacity={0}/></linearGradient>
                    <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                  <XAxis dataKey="month" tick={{fontSize:12}}/>
                  <YAxis tickFormatter={v=>fmtShort(v)} tick={{fontSize:11}}/>
                  <Tooltip formatter={v=>fmt(v)}/>
                  <Legend/>
                  <Area type="monotone" dataKey="orders" name="Orders" stroke="#0F172A" fill="url(#gOrders)" strokeWidth={2}/>
                  <Area type="monotone" dataKey="invoices" name="Paid Invoices" stroke="#3B82F6" fill="url(#gInv)" strokeWidth={2}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {activeChart === 'leads' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-400 mb-4">Lead distribution by source</p>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={leadsBySource} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={50} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {leadsBySource.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Pie>
                    <Tooltip/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-4">Lead status breakdown</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(leads.reduce((a,l)=>{a[l.status||'Unknown']=(a[l.status||'Unknown']||0)+1;return a},{})).map(([name,value])=>({name,value}))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                    <XAxis dataKey="name" tick={{fontSize:11}}/>
                    <YAxis tick={{fontSize:11}}/>
                    <Tooltip/>
                    <Bar dataKey="value" name="Count" radius={[6,6,0,0]}>
                      {leads.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {activeChart === 'activity' && (
            <div>
              <p className="text-sm text-gray-400 mb-4">Activity types distribution</p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={activityData} layout="vertical" margin={{left:20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                  <XAxis type="number" tick={{fontSize:12}}/>
                  <YAxis dataKey="name" type="category" tick={{fontSize:12}} width={80}/>
                  <Tooltip/>
                  <Bar dataKey="value" name="Count" radius={[0,6,6,0]}>
                    {activityData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {activeChart === 'quotes' && (
            <div>
              <p className="text-sm text-gray-400 mb-4">Quotation status flow</p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={quoteFunnel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                  <XAxis dataKey="name" tick={{fontSize:12}}/>
                  <YAxis tick={{fontSize:12}}/>
                  <Tooltip/>
                  <Bar dataKey="value" name="Quotations" radius={[8,8,0,0]}>
                    {quoteFunnel.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Recent + Business Advisor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Leads */}
        <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
          <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3.5"><h3 className="text-white font-bold">🎯 Recent Leads</h3></div>
          <div className="divide-y divide-blue-50">
            {recentLeads.length===0
              ? <div className="p-6 text-center text-gray-400 text-sm">No leads yet</div>
              : recentLeads.map(l=>(
                <div key={l.id} className="px-5 py-3 flex items-center justify-between hover:bg-blue-50/40">
                  <div>
                    <div className="font-semibold text-[#0F172A] text-sm">{l.name}</div>
                    <div className="text-xs text-gray-400">{l.customer||'-'} · {l.source||'-'}</div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${l.status==='New'?'bg-blue-100 text-blue-700':l.status==='Qualified'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{l.status}</span>
                </div>
              ))
            }
          </div>
        </div>

        {/* Recent Opportunities */}
        <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
          <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3.5"><h3 className="text-white font-bold">💼 Hot Opportunities</h3></div>
          <div className="divide-y divide-blue-50">
            {recentOpps.length===0
              ? <div className="p-6 text-center text-gray-400 text-sm">No opportunities yet</div>
              : recentOpps.map(o=>(
                <div key={o.id} className="px-5 py-3 hover:bg-blue-50/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#0F172A] text-sm truncate mr-2">{o.name}</span>
                    <span className="font-bold text-[#0F172A] text-sm whitespace-nowrap">{fmt(o.amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{o.customer}</span>
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{o.stage}</span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
          <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3.5"><h3 className="text-white font-bold">📊 Quick Metrics</h3></div>
          <div className="p-5 space-y-4">
            {[
              { l:'Avg Deal Size', v: fOpps.length ? fmt(fOpps.reduce((s,o)=>s+Number(o.amount||0),0)/fOpps.length) : '—', icon:'📐' },
              { l:'Invoice Collection', v: invoices.length ? `${Math.round(invoices.filter(i=>i.status==='Paid').length/invoices.length*100)}%` : '—', icon:'💳' },
              { l:'Lead Conversion', v: `${kpis.convRate}%`, icon:'🔄' },
              { l:'Open Activities', v: activities.filter(a=>a.status==='Open').length, icon:'📅' },
              { l:'Active Contacts', v: contacts.filter(c=>c.status==='Active').length, icon:'📇' },
            ].map(m=>(
              <div key={m.l} className="flex items-center justify-between p-3 bg-blue-50 rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{m.icon}</span>
                  <span className="text-sm text-gray-600">{m.l}</span>
                </div>
                <span className="font-bold text-[#0F172A]">{m.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
