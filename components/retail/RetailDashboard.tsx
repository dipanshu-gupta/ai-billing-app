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
        sales: 0, invoices: 0,
      }));
      const todayStr = toDateStr(new Date());
      fInvoices
        .filter(i => i.invoice_date === todayStr && i.status === 'Paid')
        .forEach(inv => {
          const h = inv.created_at ? new Date(inv.created_at).getHours() : 0;
          hours[h].sales    += safeNum(inv.amount);
          hours[h].invoices += 1;
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
      const dayInvoices = fInvoices.filter(inv =>
        String(inv.invoice_date).slice(0, 10) === key && inv.status === 'Paid'
      );
      result.push({
        label,
        sales:    Math.round(dayInvoices.reduce((s, inv) => s + safeNum(inv.amount), 0)),
        invoices: dayInvoices.length,
      });
    }
    // For longer ranges, aggregate to weekly to avoid too many points
    if (days > 30) {
      const weekly = [];
      for (let i = 0; i < result.length; i += 7) {
        const chunk = result.slice(i, i + 7);
        weekly.push({
          label: chunk[0].label,
          sales:    chunk.reduce((s, d) => s + d.sales, 0),
          invoices: chunk.reduce((s, d) => s + (d.invoices||0), 0),
        });
      }
      return weekly;
    }
    return result;
  }, [retailOrders, dateRange, locale]);

  // ── Orders by status ───────────────────────────────────────────────────────
  const invoicesByStatus = useMemo(() => {
    const counts: Record<string,number> = {};
    fInvoices.forEach(inv => {
      const s = inv.status || 'Unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [fOrders]);

  // ── Orders by channel ──────────────────────────────────────────────────────
  const invoicesByChannel = useMemo(() => {
    const ch: Record<string,{count:number,revenue:number}> = {};
    fInvoices.forEach(inv => {
      const k = inv.channel || inv.payment_method || 'Direct';
      if (!ch[k]) ch[k] = { count: 0, revenue: 0 };
      ch[k].count += 1;
      if (inv.status === 'Paid') ch[k].revenue += safeNum(inv.amount);
    });
    return Object.entries(ch)
      .map(([name, v]) => ({ name, invoices: v.count, sales: Math.round(v.sales) }))
      .sort((a, b) => b.sales - a.sales);
  }, [fOrders]);

  // ── Payment method breakdown ───────────────────────────────────────────────
  const paymentMethods = useMemo(() => {
    const pm: Record<string,number> = {};
    fInvoices.filter(i => i.status === 'Paid').forEach(inv => {
      const k = inv.payment_method || 'Unknown';
      pm[k] = (pm[k] || 0) + safeNum(inv.amount);
    });
    return Object.entries(pm).map(([name, value]) => ({ name, value }));
  }, [fInvoices]);

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
  const recentInvoices = useMemo(() =>
    [...retailInvoices]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8),
    [retailInvoices]);

  // ── Low stock alert list ───────────────────────────────────────────────────
  const lowStockList = useMemo(() =>
    retailProducts
      .filter(p => safeNum(p.stock_quantity) <= safeNum(p.reorder_level || 10))
      .sort((a, b) => safeNum(a.stock_quantity) - safeNum(b.stock_quantity))
      .slice(0, 5),
    [retailProducts]);

  // ── Palette ────────────────────────────────────────────────────────────────
  const buildPalette = (tc: any, prefs: any) => {
    const brand  = prefs?.brand_color  || tc?.sidebar || '#0F172A';
    const accent = prefs?.accent_color || tc?.accent  || '#2563EB';
    const darken = (hex: string, pct: number) => {
      const n = parseInt(hex.replace('#',''), 16);
      const r = Math.max(0, Math.min(255, ((n>>16)&0xFF) * (1-pct)));
      const g = Math.max(0, Math.min(255, ((n>>8)&0xFF)  * (1-pct)));
      const b = Math.max(0, Math.min(255, (n&0xFF)        * (1-pct)));
      return '#' + [r,g,b].map((x: number) => Math.round(x).toString(16).padStart(2,'0')).join('');
    };
    return [
      { from: brand,              to: darken(brand, 0.2) },
      { from: accent,             to: darken(accent, 0.2) },
      { from: darken(brand, 0.1), to: darken(brand, 0.3) },
      { from: darken(accent, 0.1), to: darken(accent, 0.3) },
      { from: darken(brand, 0.2), to: darken(brand, 0.4) },
      { from: accent,             to: brand },
      { from: brand,              to: accent },
      { from: darken(accent, 0.15), to: darken(brand, 0.15) },
    ];
  };
  const palette = buildPalette(appearance?.themeColors, appPreferences);

  // ── Sub-components ─────────────────────────────────────────────────────────
  const StatCard = ({ label, value, sub, icon, paletteIdx = 0, trend = null }) => {
    const brand = appPreferences?.brand_color || appearance?.themeColors?.sidebar || '#0F172A';
    const accent = appPreferences?.accent_color || appearance?.themeColors?.accent || '#2563EB';
    const p = palette?.[paletteIdx] || { from: brand, to: accent };
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

      {/* ── KPI Row 1: Invoice & Revenue focused ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Paid Invoice Revenue" icon="💰" paletteIdx={0}
          value={fmt(kpis.totalRevenue)}
          sub={`${fInvoices.filter(i=>i.status==='Paid').length} paid this period`}
          trend={kpis.totalRevenue > 0 ? 'up' : null}/>
        <StatCard label="Pending Collections" icon="⏳" paletteIdx={1}
          value={fmt(kpis.pendingAmount)}
          sub={`${kpis.pendingCount} invoices · ${kpis.overdueCount} overdue`}/>
        <StatCard label="Invoices Issued" icon="🧾" paletteIdx={2}
          value={fInvoices.length.toString()}
          sub={`${fInvoices.filter(i=>i.status==='Draft').length} draft · ${fInvoices.filter(i=>i.status==='Sent').length} sent`}/>
        <StatCard label="Refunds Processed" icon="↩️" paletteIdx={4}
          value={fmt(kpis.refundAmount)}
          sub={`${kpis.refundCount} invoice${kpis.refundCount!==1?'s':''} refunded`}/>
      </div>

      {/* ── KPI Row 2: Customers & Products focused ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Customers" icon="🧑‍🤝‍🧑" paletteIdx={2}
          value={kpis.totalCustomers.toString()}
          sub={`${kpis.newCustomers} new · ${kpis.vipCount} VIP`}
          trend={kpis.newCustomers > 0 ? 'up' : null}/>
        <StatCard label="Active Products" icon="🏷️" paletteIdx={6}
          value={kpis.activeProducts.toString()}
          sub={`${kpis.totalProducts} total in catalogue`}/>
        <StatCard label="⚠️ Low Stock" icon="📦" paletteIdx={3}
          value={kpis.lowStockCount.toString()}
          sub={kpis.lowStockCount > 0 ? 'Reorder required' : 'All products stocked'}
          trend={kpis.lowStockCount > 0 ? 'down' : null}/>
        <StatCard label="Open Activities" icon="📅" paletteIdx={5}
          value={kpis.openActivities.toString()}
          sub="follow-ups & tasks pending"/>
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
                  formatter={(v: any, name: string) => [
                    name === 'sales' ? fmt(Number(v)) : String(v) + ' invoices',
                    name === 'sales' ? 'Revenue' : 'Invoices'
                  ]}
                  labelStyle={{ fontWeight: 'bold' }}/>
                <Legend/>
                <Area type="monotone" dataKey="sales" stroke="#3B82F6" strokeWidth={2.5}
                  fill="url(#salesGrad)" name="Sales" dot={false}/>
                <Line type="monotone" dataKey="invoices" stroke="#10B981" strokeWidth={2}
                  name="Invoices" dot={false} yAxisId={0}/>
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

        {/* Invoice revenue by payment method */}
        <ChartCard title="Revenue by Payment Method">
          {invoicesByChannel.length === 0 ? <Empty/> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={invoicesByChannel}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="name" tick={{ fontSize: 11 }}/>
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtShort(v)} width={65}/>
                <Tooltip formatter={(v: any, name: string) => [name === 'revenue' ? fmt(v) : v, name === 'revenue' ? 'Revenue' : 'Invoices']}/>
                <Legend/>
                <Bar dataKey="revenue"  fill="#3B82F6" radius={[6,6,0,0]} name="Revenue"/>
                <Bar dataKey="invoices" fill="#10B981" radius={[6,6,0,0]} name="Count"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Invoice status breakdown */}
        <ChartCard title="Invoices by Status">
          {invoicesByStatus.length === 0 ? <Empty/> : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={invoicesByStatus} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                    {invoicesByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v: any, name: string) => [`${v} invoices`, name]}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {invoicesByStatus.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }}/>
                      <span className="text-gray-600">{s.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-[#0F172A]">{s.value}</span>
                      <span className="text-gray-400">
                        ({fInvoices.length > 0 ? Math.round(s.value / fInvoices.length * 100) : 0}%)
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
                  <Tooltip formatter={(v: any) => [fmt(v), 'Revenue']}/>
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
          <h3 className="font-bold text-[#0F172A]">Recent Invoices</h3>
          <span className="text-xs text-gray-400">{recentInvoices.length} most recent</span>
        </div>
        {recentInvoices.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No invoices yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Invoice #','Customer','Payment','Due Date','Amount','Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map(inv => (
                  <tr key={inv.id} className="border-t border-gray-50 hover:bg-blue-50/40 transition-all">
                    <td className="px-5 py-3 font-mono text-xs font-bold text-purple-600">
                      {inv.display_number ? 'RINV-'+String(inv.display_number).padStart(5,'0') : inv.invoice_number || inv.id?.slice(0,8)}
                    </td>
                    <td className="px-5 py-3 font-semibold text-[#0F172A]">{inv.customer || '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{inv.payment_method || '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{inv.due_date ? String(inv.due_date).slice(0,10) : '—'}</td>
                    <td className="px-5 py-3 font-bold text-[#0F172A]">{fmt(safeNum(inv.amount))}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(inv.status)}`}>
                        {inv.status}
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
