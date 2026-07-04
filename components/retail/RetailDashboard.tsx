// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { getStatusColor } from '@/lib/utils';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = ['#0F172A','#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6'];

const DATE_RANGES = [
  { v:'today',  l:'Today' },
  { v:'week',   l:'This Week' },
  { v:'month',  l:'This Month' },
  { v:'quarter',l:'This Quarter' },
  { v:'year',   l:'This Year' },
  { v:'all',    l:'All Time' },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────
const toDateStr = (d: Date) => d.toISOString().split('T')[0]; // YYYY-MM-DD

const getRangeStart = (range: string): Date | null => {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (range) {
    case 'today':   return new Date(y, m, d);
    case 'week':    return new Date(y, m, d - now.getDay());
    case 'month':   return new Date(y, m, 1);
    case 'quarter': return new Date(y, Math.floor(m / 3) * 3, 1);
    case 'year':    return new Date(y, 0, 1);
    default:        return null; // 'all'
  }
};

/**
 * Filter records by date range.
 * Handles both plain YYYY-MM-DD strings (order_date, invoice_date)
 * and full ISO timestamps (created_at).
 */
const filterByRange = (items: any[], range: string, dateField: string, fallbackField = 'created_at'): any[] => {
  if (range === 'all') return items;
  const start = getRangeStart(range);
  if (!start) return items;
  const startStr = toDateStr(start);

  return items.filter(r => {
    // Use primary field, fallback to created_at if null/empty
    const raw = r[dateField] || r[fallbackField];
    if (!raw) return false;
    // Normalise: take first 10 chars (YYYY-MM-DD) regardless of format
    const dateStr = String(raw).slice(0, 10);
    return dateStr >= startStr;
  });
};

// ─── Number helpers ───────────────────────────────────────────────────────────
const safeNum = (v: any) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const safeInt = (v: any) => Math.round(safeNum(v));

// ─── Component ────────────────────────────────────────────────────────────────
export default function RetailDashboard() {
  const {
    retailCustomers, retailProducts, retailActivities,
    retailOrders, retailInvoices,
    currentUser, appPreferences, appearance,
  } = useApp();

  const [dateRange, setDateRange] = useState('month');

  const currency = appPreferences?.default_currency || 'INR';
  const locale   = currency === 'INR' ? 'en-IN' : 'en-US';

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style:'currency', currency, maximumFractionDigits: 0 })
      .format(Math.round(n) || 0);

  const fmtShort = (n: number) => {
    n = Math.round(n);
    if (currency === 'INR') {
      if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
      if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
      if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`;
    } else {
      if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
      if (n >= 1000)    return `$${(n / 1000).toFixed(1)}K`;
    }
    return fmt(n);
  };

  // ── Filtered datasets (all use YYYY-MM-DD date fields from the DB) ─────────
  const fOrders = useMemo(() =>
    filterByRange(retailOrders, dateRange, 'order_date', 'created_at'),
    [retailOrders, dateRange]);

  const fInvoices = useMemo(() =>
    filterByRange(retailInvoices, dateRange, 'invoice_date', 'created_at'),
    [retailInvoices, dateRange]);

  const fCustomersNew = useMemo(() =>
    filterByRange(retailCustomers, dateRange, 'created_at'),
    [retailCustomers, dateRange]);

  const fActivities = useMemo(() =>
    filterByRange(retailActivities, dateRange, 'created_at'),
    [retailActivities, dateRange]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const completedOrders = fOrders.filter(o => o.status === 'Completed');
    const totalSales      = completedOrders.reduce((s, o) => s + safeNum(o.amount), 0);
    const ordersCount     = completedOrders.length;
    const avgOrderValue   = ordersCount > 0 ? Math.round(totalSales / ordersCount) : 0;

    const paidInvoices    = fInvoices.filter(i => i.status === 'Paid');
    const totalRevenue    = paidInvoices.reduce((s, i) => s + safeNum(i.amount), 0);

    const unpaidInvoices  = retailInvoices.filter(i => ['Sent','Overdue'].includes(i.status));
    const pendingAmount   = unpaidInvoices.reduce((s, i) => s + safeNum(i.amount), 0);

    const overdueCount    = retailInvoices.filter(i => i.status === 'Overdue').length;

    const refundedOrders  = fOrders.filter(o => o.status === 'Refunded');
    const refundAmount    = refundedOrders.reduce((s, o) => s + safeNum(o.amount), 0);

    const lowStock        = retailProducts.filter(p =>
      safeNum(p.stock_quantity) <= safeNum(p.reorder_level || 10)
    );

    const vipCustomers    = retailCustomers.filter(c => c.status === 'VIP');

    return {
      totalSales,
      ordersCount,
      avgOrderValue,
      totalRevenue,
      pendingAmount,
      pendingCount: unpaidInvoices.length,
      overdueCount,
      refundAmount,
      refundCount: refundedOrders.length,
      newCustomers: fCustomersNew.length,
      totalCustomers: retailCustomers.length,
      vipCount: vipCustomers.length,
      openActivities: fActivities.filter(a => ['Open','In Progress'].includes(a.status)).length,
      lowStockCount: lowStock.length,
      activeProducts: retailProducts.filter(p => p.status === 'Active').length,
      totalProducts: retailProducts.length,
      cancelledOrders: fOrders.filter(o => o.status === 'Cancelled').length,
      conversionRate: fOrders.length > 0
        ? Math.round((ordersCount / fOrders.length) * 100)
        : 0,
    };
  }, [fOrders, fInvoices, fCustomersNew, fActivities, retailCustomers, retailProducts, retailInvoices]);

  // ── Sales trend — last 14 days or by period ────────────────────────────────
  const salesTrend = useMemo(() => {
    if (dateRange === 'today') {
      // Hourly breakdown for today
      const hours = Array.from({ length: 24 }, (_, h) => ({
        label: `${h}:00`,
        sales: 0, orders: 0,
      }));
      const todayStr = toDateStr(new Date());
      retailOrders
        .filter(o => o.order_date === todayStr && o.status === 'Completed')
        .forEach(o => {
          const h = o.created_at ? new Date(o.created_at).getHours() : 0;
          hours[h].sales  += safeNum(o.amount);
          hours[h].orders += 1;
        });
      return hours.filter((_, i) => i <= new Date().getHours());
    }

    // Daily breakdown for other ranges
    const days = dateRange === 'year' ? 365
      : dateRange === 'quarter' ? 90
      : dateRange === 'month' ? 30
      : dateRange === 'week' ? 7
      : 14;

    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key   = toDateStr(d);
      const label = d.toLocaleDateString(locale, { day:'numeric', month:'short' });
      const dayOrders = retailOrders.filter(o =>
        String(o.order_date).slice(0, 10) === key && o.status === 'Completed'
      );
      result.push({
        label,
        sales:  Math.round(dayOrders.reduce((s, o) => s + safeNum(o.amount), 0)),
        orders: dayOrders.length,
      });
    }
    // For longer ranges, aggregate to weekly to avoid too many points
    if (days > 30) {
      const weekly = [];
      for (let i = 0; i < result.length; i += 7) {
        const chunk = result.slice(i, i + 7);
        weekly.push({
          label: chunk[0].label,
          sales: chunk.reduce((s, d) => s + d.sales, 0),
          orders: chunk.reduce((s, d) => s + d.orders, 0),
        });
      }
      return weekly;
    }
    return result;
  }, [retailOrders, dateRange, locale]);

  // ── Orders by status ───────────────────────────────────────────────────────
  const ordersByStatus = useMemo(() => {
    const counts: Record<string,number> = {};
    fOrders.forEach(o => {
      const s = o.status || 'Unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [fOrders]);

  // ── Orders by channel ──────────────────────────────────────────────────────
  const ordersByChannel = useMemo(() => {
    const ch: Record<string,{count:number,sales:number}> = {};
    fOrders.forEach(o => {
      const k = o.channel || 'In-Store';
      if (!ch[k]) ch[k] = { count: 0, sales: 0 };
      ch[k].count += 1;
      if (o.status === 'Completed') ch[k].sales += safeNum(o.amount);
    });
    return Object.entries(ch)
      .map(([name, v]) => ({ name, orders: v.count, sales: Math.round(v.sales) }))
      .sort((a, b) => b.sales - a.sales);
  }, [fOrders]);

  // ── Payment method breakdown ───────────────────────────────────────────────
  const paymentMethods = useMemo(() => {
    const pm: Record<string,number> = {};
    fOrders.filter(o => o.status === 'Completed').forEach(o => {
      const k = o.payment_method || 'Unknown';
      pm[k] = (pm[k] || 0) + 1;
    });
    return Object.entries(pm).map(([name, value]) => ({ name, value }));
  }, [fOrders]);

  // ── Top products by revenue (from line items if available, else by price×stock) ─
  const topCategories = useMemo(() => {
    const cats: Record<string,{count:number,value:number}> = {};
    retailProducts.forEach(p => {
      const k = p.category || 'Uncategorized';
      if (!cats[k]) cats[k] = { count: 0, value: 0 };
      cats[k].count += 1;
      cats[k].value += safeNum(p.price) * safeNum(p.stock_quantity || 1);
    });
    return Object.entries(cats)
      .map(([name, v]) => ({ name, products: v.count, value: Math.round(v.value) }))
      .sort((a, b) => b.products - a.products)
      .slice(0, 8);
  }, [retailProducts]);

  // ── Loyalty tier breakdown ─────────────────────────────────────────────────
  const loyaltyBreakdown = useMemo(() => {
    const tiers: Record<string,number> = { Standard: 0, Silver: 0, Gold: 0, Platinum: 0 };
    retailCustomers.forEach(c => {
      const t = c.loyalty_tier || 'Standard';
      tiers[t] = (tiers[t] || 0) + 1;
    });
    return Object.entries(tiers)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [retailCustomers]);

  // ── Recent orders ──────────────────────────────────────────────────────────
  const recentOrders = useMemo(() =>
    [...retailOrders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8),
    [retailOrders]);

  // ── Low stock alert list ───────────────────────────────────────────────────
  const lowStockList = useMemo(() =>
    retailProducts
      .filter(p => safeNum(p.stock_quantity) <= safeNum(p.reorder_level || 10))
      .sort((a, b) => safeNum(a.stock_quantity) - safeNum(b.stock_quantity))
      .slice(0, 5),
    [retailProducts]);

  // ── Palette ────────────────────────────────────────────────────────────────
  const buildPalette = (tc: any) => {
    if (!tc) return null;
    return [
      { from: tc.sidebar, to: tc.to },
      { from: '#059669', to: '#065f46' },
      { from: '#2563eb', to: '#1e40af' },
      { from: '#d97706', to: '#b45309' },
      { from: '#dc2626', to: '#991b1b' },
      { from: tc.accent,  to: tc.sidebar },
      { from: '#0d9488', to: '#0f766e' },
      { from: '#db2777', to: '#9d174d' },
    ];
  };
  const palette = buildPalette(appearance?.themeColors);

  // ── Sub-components ─────────────────────────────────────────────────────────
  const StatCard = ({ label, value, sub, icon, paletteIdx = 0, trend = null }) => {
    const p = palette?.[paletteIdx];
    const style = p
      ? { background: `linear-gradient(135deg, ${p.from}, ${p.to})` }
      : { background: 'linear-gradient(135deg, #0F172A, #1e3a8a)' };
    return (
      <div className="rounded-[20px] p-5 text-white shadow-lg" style={style}>
        <div className="flex items-start justify-between mb-2">
          <div className="text-white/70 text-xs font-semibold uppercase tracking-wider">{label}</div>
          <div className="text-2xl opacity-80">{icon}</div>
        </div>
        <div className="text-2xl font-bold leading-tight mb-1">{value}</div>
        {sub && <div className="text-white/60 text-xs">{sub}</div>}
        {trend !== null && (
          <div className={`text-xs font-semibold mt-2 ${trend >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs prev period
          </div>
        )}
      </div>
    );
  };

  const ChartCard = ({ title, children, className = '' }) => (
    <div className={`bg-white rounded-[24px] border border-gray-100 shadow-sm p-5 ${className}`}>
      <h3 className="text-base font-bold text-[#0F172A] mb-4">{title}</h3>
      {children}
    </div>
  );

  const Empty = ({ msg = 'No data for this period' }) => (
    <div className="flex items-center justify-center h-48 text-gray-400 text-sm">{msg}</div>
  );

  const rangeLabel = DATE_RANGES.find(r => r.v === dateRange)?.l || 'Period';

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">
            {new Date().getHours() < 12 ? '🌅 Good Morning' : new Date().getHours() < 17 ? '☀️ Good Afternoon' : '🌙 Good Evening'},{' '}
            {currentUser?.first_name || 'there'}
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Retail Analytics · {new Date().toLocaleDateString(locale, { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-2xl p-1 shadow-sm flex-wrap">
          {DATE_RANGES.map(r => (
            <button key={r.v} onClick={() => setDateRange(r.v)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${dateRange === r.v ? 'bg-[#0F172A] text-white shadow' : 'text-gray-500 hover:text-[#0F172A]'}`}>
              {r.l}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI row 1: Revenue ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={`Sales (${rangeLabel})`}       icon="💰" paletteIdx={0}
          value={fmt(kpis.totalSales)}
          sub={`${kpis.ordersCount} completed order${kpis.ordersCount!==1?'s':''}`}/>
        <StatCard label="Avg Order Value"                icon="📊" paletteIdx={1}
          value={fmt(kpis.avgOrderValue)}
          sub="per completed order"/>
        <StatCard label="Invoice Revenue"               icon="🧾" paletteIdx={2}
          value={fmt(kpis.totalRevenue)}
          sub={`${fInvoices.filter(i=>i.status==='Paid').length} paid invoice${fInvoices.filter(i=>i.status==='Paid').length!==1?'s':''}`}/>
        <StatCard label="Pending Collections"           icon="⏳" paletteIdx={4}
          value={fmt(kpis.pendingAmount)}
          sub={`${kpis.pendingCount} unpaid · ${kpis.overdueCount} overdue`}/>
      </div>

      {/* ── KPI row 2: Operations ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="New Customers"   icon="🧑‍🤝‍🧑" paletteIdx={2}
          value={kpis.newCustomers.toString()}
          sub={`${kpis.totalCustomers} total · ${kpis.vipCount} VIP`}/>
        <StatCard label="Orders"          icon="🛒" paletteIdx={6}
          value={fOrders.length.toString()}
          sub={`${kpis.conversionRate}% completion · ${kpis.cancelledOrders} cancelled`}/>
        <StatCard label="Refunds"         icon="↩️" paletteIdx={4}
          value={fmt(kpis.refundAmount)}
          sub={`${kpis.refundCount} order${kpis.refundCount!==1?'s':''} refunded`}/>
        <StatCard label="Low Stock Items" icon="📦" paletteIdx={3}
          value={kpis.lowStockCount.toString()}
          sub={`${kpis.activeProducts} of ${kpis.totalProducts} products active`}/>
      </div>

      {/* ── Charts row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Sales trend */}
        <ChartCard title={`Sales Trend — ${rangeLabel}`} className="lg:col-span-2">
          {salesTrend.every(d => d.sales === 0) ? <Empty/> : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={salesTrend}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="label" tick={{ fontSize: 11 }}
                  interval={salesTrend.length > 14 ? Math.floor(salesTrend.length/7) : 0}/>
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtShort(v)} width={70}/>
                <Tooltip
                  formatter={(v, name) => [name === 'sales' ? fmt(v as number) : v, name === 'sales' ? 'Sales' : 'Orders']}
                  labelStyle={{ fontWeight: 'bold' }}/>
                <Legend/>
                <Area type="monotone" dataKey="sales" stroke="#3B82F6" strokeWidth={2.5}
                  fill="url(#salesGrad)" name="Sales" dot={false}/>
                <Line type="monotone" dataKey="orders" stroke="#10B981" strokeWidth={2}
                  name="Orders" dot={false} yAxisId={0}/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Loyalty tiers */}
        <ChartCard title="Customer Loyalty Tiers">
          {loyaltyBreakdown.length === 0 ? <Empty msg="No customer data"/> : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={loyaltyBreakdown} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                    {loyaltyBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v} customers`, name]}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {loyaltyBreakdown.map((t, i) => (
                  <div key={t.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }}/>
                      <span className="text-gray-600 font-medium">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#0F172A]">{t.value}</span>
                      <span className="text-gray-400">
                        ({retailCustomers.length > 0 ? Math.round(t.value / retailCustomers.length * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* ── Charts row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Orders by channel */}
        <ChartCard title="Revenue by Channel">
          {ordersByChannel.length === 0 ? <Empty/> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ordersByChannel}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="name" tick={{ fontSize: 11 }}/>
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtShort(v)} width={65}/>
                <Tooltip formatter={(v, name) => [name === 'sales' ? fmt(v as number) : v, name === 'sales' ? 'Revenue' : 'Orders']}/>
                <Legend/>
                <Bar dataKey="sales"  fill="#3B82F6" radius={[6,6,0,0]} name="Revenue"/>
                <Bar dataKey="orders" fill="#10B981" radius={[6,6,0,0]} name="Orders"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Order status breakdown */}
        <ChartCard title="Orders by Status">
          {ordersByStatus.length === 0 ? <Empty/> : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={ordersByStatus} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                    {ordersByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v} orders`, name]}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {ordersByStatus.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }}/>
                      <span className="text-gray-600">{s.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-[#0F172A]">{s.value}</span>
                      <span className="text-gray-400">
                        ({fOrders.length > 0 ? Math.round(s.value / fOrders.length * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        {/* Payment methods */}
        <ChartCard title="Payment Methods">
          {paymentMethods.length === 0 ? <Empty/> : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={paymentMethods} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                    {paymentMethods.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v} orders`, name]}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {paymentMethods.map((pm, i) => {
                  const total = paymentMethods.reduce((s, x) => s + x.value, 0);
                  return (
                    <div key={pm.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[(i+3) % COLORS.length] }}/>
                        <span className="text-gray-600">{pm.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-bold text-[#0F172A]">{pm.value}</span>
                        <span className="text-gray-400">({total > 0 ? Math.round(pm.value/total*100) : 0}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* ── Charts row 3: Products + Low stock ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Products by category */}
        <ChartCard title="Products by Category" className="lg:col-span-2">
          {topCategories.length === 0 ? <Empty msg="No products yet"/> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topCategories} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis type="number" tick={{ fontSize: 11 }}/>
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110}/>
                <Tooltip/>
                <Bar dataKey="products" fill="#8B5CF6" radius={[0,6,6,0]} name="Products"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Low stock alert */}
        <ChartCard title="⚠️ Low Stock Alert">
          {lowStockList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-gray-400 text-sm">All products are well stocked</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lowStockList.map(p => {
                const stock   = safeNum(p.stock_quantity);
                const reorder = safeNum(p.reorder_level || 10);
                const pct     = reorder > 0 ? Math.min(100, Math.round(stock / reorder * 100)) : 0;
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-[#0F172A] truncate max-w-[140px]">{p.name}</span>
                      <span className={`font-bold ${stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {stock} left
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${
                        stock === 0 ? 'bg-red-500' : pct < 30 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} style={{ width: `${pct}%` }}/>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Reorder at {reorder} · {p.category||'Uncategorized'}</div>
                  </div>
                );
              })}
              {kpis.lowStockCount > 5 && (
                <p className="text-xs text-amber-600 font-semibold text-center pt-1">
                  +{kpis.lowStockCount - 5} more items need restocking
                </p>
              )}
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Recent orders table ── */}
      <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-[#0F172A]">Recent Orders</h3>
          <span className="text-xs text-gray-400">{recentOrders.length} most recent</span>
        </div>
        {recentOrders.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No orders yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Order #','Customer','Channel','Payment','Date','Total','Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(o => (
                  <tr key={o.id} className="border-t border-gray-50 hover:bg-blue-50/40 transition-all">
                    <td className="px-5 py-3 font-mono text-xs text-gray-400">{o.display_number || o.order_number || o.id}</td>
                    <td className="px-5 py-3 font-semibold text-[#0F172A]">{o.customer || '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{o.channel || '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{o.payment_method || '—'}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {o.order_date ? String(o.order_date).slice(0, 10) : '—'}
                    </td>
                    <td className="px-5 py-3 font-bold text-[#0F172A]">{fmt(safeNum(o.amount))}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
