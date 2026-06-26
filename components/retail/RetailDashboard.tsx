// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { getTaxRegime } from '@/lib/taxConfig';
import { getStatusColor } from '@/lib/utils';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#0F172A','#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6'];

const DATE_RANGES = [
  { v:'today',  l:'Today' },
  { v:'week',   l:'This Week' },
  { v:'month',  l:'This Month' },
  { v:'all',    l:'All Time' },
];

const filterByRange = (items, range, dateField='created_at') => {
  if (range === 'all') return items;
  const now = new Date(); const sod = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const starts = {
    today: sod,
    week:  new Date(sod - sod.getDay()*86400000),
    month: new Date(now.getFullYear(),now.getMonth(),1),
  };
  const start = starts[range];
  return items.filter(r => r[dateField] && new Date(r[dateField]) >= start);
};

export default function RetailDashboard() {
  const { retailCustomers, retailProducts, retailActivities, retailOrders, retailInvoices, currentUser, appPreferences, appearance } = useApp();
  const [dateRange, setDateRange] = useState('month');

  const taxRegime = getTaxRegime(appPreferences?.default_currency);
  const currency = appPreferences?.default_currency || 'INR';
  const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency,maximumFractionDigits:0}).format(n||0);
  const fmtShort = n => n >= 10000000 ? `${currency} ${(n/10000000).toFixed(1)}Cr` : n >= 100000 ? `${currency} ${(n/100000).toFixed(1)}L` : fmt(n);

  const fOrders = useMemo(()=>filterByRange(retailOrders, dateRange, 'order_date'), [retailOrders, dateRange]);
  const fCustomersNew = useMemo(()=>filterByRange(retailCustomers, dateRange, 'created_at'), [retailCustomers, dateRange]);

  const kpis = useMemo(() => ({
    salesValue:      fOrders.filter(o=>o.status==='Completed').reduce((s,o)=>s+Number(o.amount||0),0),
    ordersCount:     fOrders.filter(o=>o.status==='Completed').length,
    walkInCustomers: fCustomersNew.length,
    totalCustomers:  retailCustomers.length,
    vipCustomers:    retailCustomers.filter(c=>c.status==='VIP').length,
    avgOrderValue:   fOrders.filter(o=>o.status==='Completed').length
      ? fOrders.filter(o=>o.status==='Completed').reduce((s,o)=>s+Number(o.amount||0),0) / fOrders.filter(o=>o.status==='Completed').length
      : 0,
    pendingInvoices: retailInvoices.filter(i=>['Sent','Overdue'].includes(i.status)).reduce((s,i)=>s+Number(i.amount||0),0),
    openActivities:  retailActivities.filter(a=>['Open','In Progress'].includes(a.status)).length,
    lowStockProducts: retailProducts.filter(p=>Number(p.stock_quantity||0) <= Number(p.reorder_level||10)).length,
  }), [fOrders, fCustomersNew, retailCustomers, retailInvoices, retailActivities, retailProducts]);

  // Sales by day (for line chart) — last 14 days
  const salesByDay = useMemo(() => {
    const days = [];
    for (let i=13; i>=0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
      const dayOrders = retailOrders.filter(o=>o.order_date===key && o.status==='Completed');
      days.push({ date: label, sales: dayOrders.reduce((s,o)=>s+Number(o.amount||0),0), orders: dayOrders.length });
    }
    return days;
  }, [retailOrders]);

  // Products by category (proxy for catalog composition until line-item aggregation is available)
  const topProducts = useMemo(() => {
    const counts = {};
    retailProducts.forEach(p => {
      counts[p.category || 'Uncategorized'] = (counts[p.category || 'Uncategorized'] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value).slice(0,6);
  }, [retailProducts]);

  // Loyalty tier breakdown
  const loyaltyBreakdown = useMemo(() => {
    const tiers = { Standard:0, Silver:0, Gold:0, Platinum:0 };
    retailCustomers.forEach(c => { tiers[c.loyalty_tier || 'Standard'] = (tiers[c.loyalty_tier || 'Standard']||0) + 1; });
    return Object.entries(tiers).map(([name,value])=>({ name, value })).filter(t=>t.value>0);
  }, [retailCustomers]);

  // Orders by channel
  const ordersByChannel = useMemo(() => {
    const ch = {};
    fOrders.forEach(o => { ch[o.channel || 'In-Store'] = (ch[o.channel || 'In-Store']||0) + 1; });
    return Object.entries(ch).map(([name,value])=>({ name, value }));
  }, [fOrders]);

  // Recent orders & activities
  const recentOrders = [...retailOrders].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
  const recentActivities = [...retailActivities].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);

  // Build 8-card palette from theme colors
  const buildPalette = (tc) => {
    if (!tc) return null;
    // Each theme contributes its sidebar+accent. We derive 8 variants:
    // 0: primary (sidebar→to), 1: accent shade, 2-7: fixed complementary colors
    // that still feel coordinated because they're slightly desaturated
    return [
      { from: tc.sidebar,   to: tc.to },          // 0 - primary dark
      { from: '#059669',    to: '#065f46' },       // 1 - emerald
      { from: '#2563eb',    to: '#1e40af' },       // 2 - blue
      { from: '#d97706',    to: '#b45309' },       // 3 - amber
      { from: '#dc2626',    to: '#991b1b' },       // 4 - red
      { from: tc.accent,    to: tc.sidebar },      // 5 - accent→primary
      { from: '#0d9488',    to: '#0f766e' },       // 6 - teal
      { from: '#db2777',    to: '#9d174d' },       // 7 - pink
    ];
  };
  const palette = buildPalette(appearance?.themeColors);

  const StatCard = ({ label, value, sub, icon, paletteIdx = 1 }) => {
    const p = palette?.[paletteIdx];
    const cardStyle = p
      ? { background: `linear-gradient(135deg, ${p.from}, ${p.to})` }
      : { background: 'linear-gradient(135deg, #0F172A, #1e3a8a)' };
    return (
    <div className="rounded-[20px] p-5 text-white shadow-lg" style={cardStyle}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">{label}</div>
          <div className="text-2xl font-bold leading-tight">{value}</div>
          {sub && <div className="text-white/70 text-xs mt-1">{sub}</div>}
        </div>
        <div className="text-3xl opacity-80">{icon}</div>
      </div>
    </div>
  );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A]">
            Good {new Date().getHours()<12?'Morning':new Date().getHours()<17?'Afternoon':'Evening'}, {currentUser?.first_name||'there'} 🛍️
          </h1>
          <p className="text-gray-500 mt-1">Retail snapshot for <span className="font-semibold text-[#0F172A]">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</span> · {taxRegime.regimeLabel}</p>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Sales" paletteIdx={0} value={fmtShort(kpis.salesValue)} sub={`${kpis.ordersCount} completed orders`} icon="💰"/>
        <StatCard label="Avg Order Value" paletteIdx={1} value={fmt(kpis.avgOrderValue)} sub="per completed order" icon="🧾"/>
        <StatCard label="New Customers" paletteIdx={2} value={kpis.walkInCustomers} sub={`${kpis.totalCustomers} total customers`} icon="🧑‍🤝‍🧑"/>
        <StatCard label="VIP Customers" paletteIdx={3} value={kpis.vipCustomers} sub="1000+ loyalty points" icon="👑"/>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pending Invoices" paletteIdx={4} value={fmtShort(kpis.pendingInvoices)} sub={`${retailInvoices.filter(i=>['Sent','Overdue'].includes(i.status)).length} unpaid`} icon="⚠️"/>
        <StatCard label="Open Activities" paletteIdx={5} value={kpis.openActivities} sub="follow-ups pending" icon="📅"/>
        <StatCard label="Low Stock Items" paletteIdx={6} value={kpis.lowStockProducts} sub="at/below reorder level" icon="📦"/>
        <StatCard label="Total Products" paletteIdx={7} value={retailProducts.length} sub={`${retailProducts.filter(p=>p.status==='Active').length} active`} icon="🏷️"/>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales trend */}
        <div className="lg:col-span-2 bg-white rounded-[28px] border border-blue-100 shadow-lg p-6">
          <h2 className="text-lg font-bold text-[#0F172A] mb-4">Sales — Last 14 Days</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={salesByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="date" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:11}} tickFormatter={v=>fmtShort(v)}/>
              <Tooltip formatter={(v,name)=>name==='sales'?fmt(v):v}/>
              <Legend/>
              <Line type="monotone" dataKey="sales" stroke="#3B82F6" strokeWidth={2} name="Sales" dot={{r:3}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Loyalty breakdown */}
        <div className="bg-white rounded-[28px] border border-blue-100 shadow-lg p-6">
          <h2 className="text-lg font-bold text-[#0F172A] mb-4">Loyalty Tiers</h2>
          {loyaltyBreakdown.length===0 ? (
            <div className="text-center text-gray-400 py-10">No customer data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={loyaltyBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,value})=>`${name}: ${value}`}>
                  {loyaltyBreakdown.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders by channel */}
        <div className="bg-white rounded-[28px] border border-blue-100 shadow-lg p-6">
          <h2 className="text-lg font-bold text-[#0F172A] mb-4">Orders by Channel</h2>
          {ordersByChannel.length===0 ? (
            <div className="text-center text-gray-400 py-10">No orders in this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ordersByChannel}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="name" tick={{fontSize:11}}/>
                <YAxis tick={{fontSize:11}}/>
                <Tooltip/>
                <Bar dataKey="value" fill="#10B981" radius={[8,8,0,0]} name="Orders"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Product categories */}
        <div className="bg-white rounded-[28px] border border-blue-100 shadow-lg p-6">
          <h2 className="text-lg font-bold text-[#0F172A] mb-4">Products by Category</h2>
          {topProducts.length===0 ? (
            <div className="text-center text-gray-400 py-10">No products yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis type="number" tick={{fontSize:11}}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={100}/>
                <Tooltip/>
                <Bar dataKey="value" fill="#8B5CF6" radius={[0,8,8,0]} name="Products"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent activities */}
        <div className="bg-white rounded-[28px] border border-blue-100 shadow-lg p-6">
          <h2 className="text-lg font-bold text-[#0F172A] mb-4">Recent Activities</h2>
          {recentActivities.length===0 ? (
            <div className="text-center text-gray-400 py-10">No activities yet</div>
          ) : (
            <div className="space-y-3">
              {recentActivities.map(a => (
                <div key={a.id} className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                  <div>
                    <div className="font-semibold text-sm text-[#0F172A]">{a.subject}</div>
                    <div className="text-xs text-gray-400">{a.activity_type} · {a.customer || 'No customer'}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(a.status)}`}>{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders table */}
      <div className="bg-white rounded-[28px] border border-blue-100 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-blue-50">
          <h2 className="text-lg font-bold text-[#0F172A]">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Order #','Customer','Channel','Date','Total','Status'].map(h=>
                  <th key={h} className="px-5 py-3 text-left font-semibold text-gray-500 text-xs uppercase">{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {recentOrders.length===0
                ? <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No orders yet</td></tr>
                : recentOrders.map(o => (
                  <tr key={o.id} className="border-t border-gray-50">
                    <td className="px-5 py-3 font-mono text-xs text-gray-400">{o.order_number}</td>
                    <td className="px-5 py-3 text-[#0F172A] font-medium">{o.customer || '-'}</td>
                    <td className="px-5 py-3 text-gray-600">{o.channel || '-'}</td>
                    <td className="px-5 py-3 text-gray-600">{o.order_date || '-'}</td>
                    <td className="px-5 py-3 font-bold text-[#0F172A]">{fmt(o.amount||0)}</td>
                    <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(o.status)}`}>{o.status}</span></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
