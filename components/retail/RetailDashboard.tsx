// @ts-nocheck
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { getStatusColor, roundPercentagesTo100 } from '@/lib/utils';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = ['#0F172A','#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6'];
// Semantic colors for status-based charts — carries real meaning (green =
// good/complete, amber = needs attention, red = overdue/problem, grey =
// not-yet-actioned) rather than an arbitrary palette assignment that changes
// meaning depending on which statuses happen to be present.
const STATUS_HEX: Record<string,string> = {
  Paid:'#10B981', Completed:'#10B981', Active:'#10B981', Delivered:'#10B981',
  Pending:'#F59E0B', Sent:'#3B82F6', Processing:'#3B82F6', 'In Progress':'#3B82F6',
  Draft:'#94A3B8', Overdue:'#EF4444', Cancelled:'#EF4444', Failed:'#EF4444',
  Refunded:'#8B5CF6', Unknown:'#CBD5E1',
};
const statusHex = (name: string, fallbackIdx: number) => STATUS_HEX[name] || COLORS[fallbackIdx % COLORS.length];

const DATE_RANGES = [
  { v:'today',  l:'Today' },
  { v:'week',   l:'This Week' },
  { v:'month',  l:'This Month' },
  { v:'quarter',l:'This Quarter' },
  { v:'year',   l:'This Year' },
  { v:'all',    l:'All Time' },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; // LOCAL YYYY-MM-DD

const getRangeStart = (range: string): Date | null => {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (range) {
    case 'today':   return new Date(y, m, d);
    case 'week':    return new Date(y, m, d - ((now.getDay() + 6) % 7)); // Monday start
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

const DASHBOARD_WIDGETS = [
  { key:'ai_insights',      label:'✨ AI Insights' },
  { key:'kpi_revenue',      label:'Revenue & Invoice KPIs' },
  { key:'kpi_customers',    label:'Customer & Product KPIs' },
  { key:'sales_trend',      label:'Sales Trend chart' },
  { key:'loyalty_tiers',    label:'Customer Loyalty Tiers chart' },
  { key:'payment_revenue',  label:'Revenue by Payment Method chart' },
  { key:'invoice_status',   label:'Invoices by Status chart' },
  { key:'top_categories',   label:'Products by Category chart' },
  { key:'low_stock',        label:'Low Stock Alert' },
  { key:'recent_invoices',  label:'Recent Invoices table' },
];
const DEFAULT_WIDGETS = DASHBOARD_WIDGETS.map(w => w.key);

// ─── Component ────────────────────────────────────────────────────────────────
export default function RetailDashboard() {
  const {
    retailCustomers, retailProducts, retailActivities,
    retailOrders, retailInvoices,
    currentUser, appPreferences, appearance,
    fetchListViewPrefs, saveListViewPrefs,
  } = useApp();

  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(DEFAULT_WIDGETS);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  useEffect(() => {
    if (!fetchListViewPrefs) return;
    fetchListViewPrefs('retailDashboard').then((saved: any) => {
      if (saved?.columns?.length) setVisibleWidgets(saved.columns);
    });
  }, []);
  const toggleWidget = (key: string) => {
    const next = visibleWidgets.includes(key) ? visibleWidgets.filter(k => k !== key) : [...visibleWidgets, key];
    setVisibleWidgets(next);
    if (saveListViewPrefs) saveListViewPrefs('retailDashboard', { columns: next, sort: {} });
  };
  const show = (key: string) => visibleWidgets.includes(key);

  const [dateRange, setDateRange] = useState('month');
  // Bumped on tab focus/visibility so date-anchored memos recompute (stale-"Today" fix)
  const [dayTick, setDayTick] = useState(0);

  const currency = appPreferences?.default_currency || 'INR';
  const locale   = currency === 'INR' ? 'en-IN' : 'en-US';

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style:'currency', currency, maximumFractionDigits: 0 })
      .format(Math.round(n) || 0);

  const trim2 = (x: number) => x.toFixed(2).replace(/\.?0+$/, '');
  const curSym = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency + ' ';
  const fmtShort = (n: number) => {
    n = Math.round(n);
    if (currency === 'INR') {
      if (n >= 10000000) return `${curSym}${trim2(n / 10000000)}Cr`;
      if (n >= 100000)   return `${curSym}${trim2(n / 100000)}L`;
      if (n >= 1000)     return `${curSym}${trim2(n / 1000)}K`;
    } else {
      if (n >= 1000000) return `${curSym}${trim2(n / 1000000)}M`;
      if (n >= 1000)    return `${curSym}${trim2(n / 1000)}K`;
    }
    return `${curSym}${n.toLocaleString(locale)}`;
  };

  useEffect(() => {
    let last = Date.now();
    const bump = () => {
      if (document.visibilityState !== 'visible') return;
      // Throttle: recompute at most once per 30s of refocus
      if (Date.now() - last < 30000) return;
      last = Date.now();
      setDayTick(t => t + 1);
    };
    window.addEventListener('focus', bump);
    document.addEventListener('visibilitychange', bump);
    return () => { window.removeEventListener('focus', bump); document.removeEventListener('visibilitychange', bump); };
  }, []);

  // ── Filtered datasets (all use YYYY-MM-DD date fields from the DB) ─────────
  const fOrders = useMemo(() =>
    filterByRange(retailOrders, dateRange, 'order_date', 'created_at'),
    [retailOrders, dateRange, dayTick]);

  const fInvoices = useMemo(() =>
    filterByRange(retailInvoices, dateRange, 'invoice_date', 'created_at'),
    [retailInvoices, dateRange, dayTick]);

  const fCustomersNew = useMemo(() =>
    filterByRange(retailCustomers, dateRange, 'created_at'),
    [retailCustomers, dateRange, dayTick]);

  const fActivities = useMemo(() =>
    filterByRange(retailActivities, dateRange, 'created_at'),
    [retailActivities, dateRange, dayTick]);

  const fProducts = useMemo(() =>
    filterByRange(retailProducts, dateRange, 'created_at'),
    [retailProducts, dateRange, dayTick]);

  // ── Previous-period comparison — real period-over-period % change, not the
  // fake 'up'/'down' placeholder that was causing "NaN% vs prev period".
  // Computes the equivalent PRIOR calendar window for whatever range is
  // currently selected (e.g. "This Month" → last month, same span) and
  // re-filters the same data against it.
  const prevPeriodKpis = useMemo(() => {
    if (dateRange === 'all') return null; // no meaningful "previous" for all-time
    const now = new Date();
    const curStart = getRangeStart(dateRange) || new Date(now.getFullYear(), now.getMonth(), 1);
    const spanMs = now.getTime() - curStart.getTime();
    const prevEnd = new Date(curStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - spanMs);
    const prevStartStr = toDateStr(prevStart), prevEndStr = toDateStr(prevEnd);
    const inPrevWindow = (dateStr: string) => dateStr >= prevStartStr && dateStr <= prevEndStr;

    const prevInvoices = retailInvoices.filter(i => {
      const d = String(i.invoice_date || i.created_at || '').slice(0,10);
      return d && inPrevWindow(d) && i.status === 'Paid';
    });
    const prevOrders = retailOrders.filter(o => {
      const d = String(o.order_date || o.created_at || '').slice(0,10);
      return d && inPrevWindow(d) && o.status === 'Completed';
    });
    const prevCustomers = retailCustomers.filter(c => {
      const d = String(c.created_at || '').slice(0,10);
      return d && inPrevWindow(d);
    });
    return {
      totalRevenue: prevInvoices.reduce((s,i)=>s+safeNum(i.amount),0),
      ordersCount: prevOrders.length,
      newCustomers: prevCustomers.length,
    };
  }, [retailInvoices, retailOrders, retailCustomers, dateRange]);

  // Percentage change vs the previous period — null when there's no
  // meaningful baseline (e.g. "All Time", or the previous period was zero,
  // where a % change is undefined rather than a real number).
  const pctChange = (current: number, previous: number | undefined | null): number | null => {
    if (previous === null || previous === undefined) return null;
    if (previous === 0) return current > 0 ? 100 : null;
    return Math.round(((current - previous) / previous) * 100);
  };

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const completedOrders = fOrders.filter(o => o.status === 'Completed');
    const totalSales      = completedOrders.reduce((s, o) => s + safeNum(o.amount), 0);
    const ordersCount     = completedOrders.length;
    const avgOrderValue   = ordersCount > 0 ? Math.round(totalSales / ordersCount) : 0;

    const paidInvoices    = fInvoices.filter(i => i.status === 'Paid');
    const totalRevenue    = paidInvoices.reduce((s, i) => s + safeNum(i.amount), 0);

    const unpaidInvoices  = retailInvoices.filter(i => ['Sent','Overdue','Pending'].includes(i.status) || (i.payment_status === 'Pending' && !['Cancelled','Refunded'].includes(i.status)));
    const pendingAmount   = unpaidInvoices.reduce((s, i) => s + safeNum(i.amount), 0);

    const overdueCount    = retailInvoices.filter(i => i.status === 'Overdue').length;

    const refundedOrders  = fOrders.filter(o => o.status === 'Refunded');
    const refundAmount    = refundedOrders.reduce((s, o) => s + safeNum(o.amount), 0);

    const lowStock        = retailProducts.filter(p =>
      p.status === 'Active' &&
      safeNum(p.stock_quantity) <= safeNum(p.reorder_level || 10)
    );

    const vipCustomers    = retailCustomers.filter(c =>
      c.status === 'VIP' || c.loyalty_tier === 'Platinum' || safeNum(c.loyalty_points) >= 1000
    );

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
      totalProducts: dateRange === 'all' ? retailProducts.length : fProducts.length,
      newProducts: fProducts.length,
      cancelledOrders: fOrders.filter(o => o.status === 'Cancelled').length,
      conversionRate: fOrders.length > 0
        ? Math.round((ordersCount / fOrders.length) * 100)
        : 0,
    };
  }, [fOrders, fInvoices, fCustomersNew, fActivities, fProducts, retailCustomers, retailProducts, retailInvoices, dateRange]);

  // ── Sales trend — uses the exact same calendar-aligned boundaries as every
  // other metric on this dashboard (getRangeStart), not an independent
  // rolling day-count window. Previously the chart's window didn't line up
  // with the KPI cards for the same selected period (e.g. "This Month" on
  // the 5th showed the KPIs for Aug 1–5 but a rolling 30-day chart spanning
  // back into July) — this is what made switching the filter feel like the
  // whole dashboard was inconsistently changing.
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

    const today = new Date();
    let start = getRangeStart(dateRange);
    if (!start) {
      // 'all' — use the earliest paid invoice's date as the start, so "All
      // Time" genuinely shows the tenant's full history rather than
      // silently falling back to an arbitrary short window.
      const dates = fInvoices.filter(i => i.status === 'Paid' && i.invoice_date).map(i => String(i.invoice_date).slice(0,10));
      start = dates.length ? new Date(dates.sort()[0]) : new Date(today.getFullYear(), today.getMonth(), 1);
    }
    const days = Math.max(1, Math.round((today.getTime() - start.getTime()) / 86400000) + 1);

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
    // For longer ranges, aggregate to weekly to keep the chart readable.
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
  }, [fInvoices, dateRange, locale]);

  // ── Orders by status ───────────────────────────────────────────────────────
  const invoicesByStatus = useMemo(() => {
    const counts: Record<string,{count:number,amount:number}> = {};
    fInvoices.forEach(inv => {
      const s = inv.status || 'Unknown';
      if (!counts[s]) counts[s] = { count: 0, amount: 0 };
      counts[s].count += 1;
      counts[s].amount += safeNum(inv.amount);
    });
    return Object.entries(counts)
      .map(([name, v]) => ({ name, value: v.count, amount: Math.round(v.amount) }))
      .sort((a, b) => b.value - a.value);
  }, [fInvoices]);
  // ── Orders by channel ──────────────────────────────────────────────────────
  // ── Revenue by payment method — total invoices AND how many are actually
  // paid AND realized revenue, all together. Previously this was split across
  // two separate, contradictory charts: one plotted invoice COUNT (including
  // unpaid Draft invoices) on the same axis as REVENUE, making it look like
  // "8 invoices" was "₹8" of revenue; the other only showed paid revenue with
  // no context for how much was still outstanding. One clear number now.
  const invoicesByChannel = useMemo(() => {
    const ch: Record<string,{totalCount:number,paidCount:number,revenue:number}> = {};
    fInvoices.forEach(inv => {
      const k = inv.channel || inv.payment_method || 'Direct';
      if (!ch[k]) ch[k] = { totalCount: 0, paidCount: 0, revenue: 0 };
      ch[k].totalCount += 1;
      if (inv.status === 'Paid') { ch[k].paidCount += 1; ch[k].revenue += safeNum(inv.amount); }
    });
    return Object.entries(ch)
      .map(([name, v]) => ({ name, totalCount: v.totalCount, paidCount: v.paidCount, revenue: Math.round(v.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [fInvoices]);

  // ── Products by category (count + inventory value; NOT sales revenue — ─────
  // a true sales-by-category view would need to sum retail_invoice_line_items
  // for the period, which isn't fetched on this dashboard today) ─────────────
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

  // ── Recent invoices — respects the selected date range for consistency ──────
  const recentInvoices = useMemo(() =>
    [...fInvoices]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8),
    [fInvoices]);

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
      <div className="rounded-[20px] p-5 text-white shadow-lg transition-all duration-300 ease-out hover:shadow-2xl hover:-translate-y-1 dashboard-fade-in" style={style}>
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
    <div className={`group bg-white rounded-[24px] border border-gray-100 shadow-sm p-5 transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 hover:border-blue-100 dashboard-fade-in ${className}`}>
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
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-2xl p-1 shadow-sm flex-wrap">
            {DATE_RANGES.map(r => (
              <button key={r.v} onClick={() => setDateRange(r.v)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${dateRange === r.v ? 'bg-[#0F172A] text-white shadow' : 'text-gray-500 hover:text-[#0F172A]'}`}>
                {r.l}
              </button>
            ))}
          </div>
          <div className="relative">
            <button onClick={() => setCustomizeOpen(!customizeOpen)}
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-2xl border shadow-sm transition-all ${customizeOpen?'bg-[#0F172A] text-white border-transparent':'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
              ⚙️ Customize
            </button>
            {customizeOpen && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-[24px] shadow-2xl border border-blue-100 z-50 overflow-hidden" style={{maxHeight:'70vh',overflowY:'auto'}}>
                <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3 flex items-center justify-between">
                  <h3 className="text-white font-bold text-sm">Customize Dashboard</h3>
                  <button onClick={()=>setCustomizeOpen(false)} className="text-white/70 hover:text-white">✕</button>
                </div>
                <div className="p-3">
                  <p className="text-xs text-gray-400 px-2 pb-2">Show or hide widgets — your choice is saved automatically.</p>
                  {DASHBOARD_WIDGETS.map(w => (
                    <label key={w.key} className="flex items-center gap-2.5 px-2 py-2 hover:bg-blue-50 rounded-xl cursor-pointer">
                      <input type="checkbox" checked={show(w.key)} onChange={()=>toggleWidget(w.key)} className="w-4 h-4 accent-blue-600"/>
                      <span className="text-sm text-[#0F172A]">{w.label}</span>
                    </label>
                  ))}
                  <div className="border-t border-gray-100 mt-2 pt-2 px-2">
                    <button onClick={()=>{setVisibleWidgets(DEFAULT_WIDGETS); if(saveListViewPrefs) saveListViewPrefs('retailDashboard',{columns:DEFAULT_WIDGETS,sort:{}});}} className="text-xs text-gray-400 hover:text-[#0F172A]">Show all widgets</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── AI Insights ── */}
      {show('ai_insights') && <AIInsightsCard kpis={kpis} prevPeriodKpis={prevPeriodKpis} rangeLabel={rangeLabel} fmt={fmt} pctChange={pctChange}/>}

      {/* ── KPI Row 1: Invoice & Revenue focused ── */}
      {show('kpi_revenue') && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Paid Invoice Revenue" icon="💰" paletteIdx={0}
          value={fmt(kpis.totalRevenue)}
          sub={`${fInvoices.filter(i=>i.status==='Paid').length} paid this period`}
          trend={prevPeriodKpis ? pctChange(kpis.totalRevenue, prevPeriodKpis.totalRevenue) : null}/>
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
      )}

      {/* ── KPI Row 2: Customers & Products focused ── */}
      {show('kpi_customers') && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Customers" icon="🧑‍🤝‍🧑" paletteIdx={2}
          value={kpis.totalCustomers.toString()}
          sub={`${kpis.newCustomers} new · ${kpis.vipCount} VIP`}
          trend={prevPeriodKpis ? pctChange(kpis.newCustomers, prevPeriodKpis.newCustomers) : null}/>
        <StatCard label="Active Products" icon="🏷️" paletteIdx={6}
          value={kpis.activeProducts.toString()}
          sub={`${kpis.totalProducts} total in catalogue`}/>
        <StatCard label="⚠️ Low Stock" icon="📦" paletteIdx={3}
          value={kpis.lowStockCount.toString()}
          sub={kpis.lowStockCount > 0 ? 'Reorder required · live count' : 'All products stocked'}/>
        <StatCard label="Open Activities" icon="📅" paletteIdx={5}
          value={kpis.openActivities.toString()}
          sub="follow-ups & tasks pending"/>
      </div>
      )}

      {/* ── Charts row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Sales trend */}
        {show('sales_trend') && (
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
                    name === 'Sales' ? fmt(Number(v)) : `${v} invoice${v===1?'':'s'}`,
                    name === 'Sales' ? 'Revenue' : 'Invoices'
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
        )}

        {/* Loyalty tiers */}
        {show('loyalty_tiers') && (
        <ChartCard title="Customer Loyalty Tiers">
          {loyaltyBreakdown.length === 0 ? <Empty msg="No customer data"/> : (
            <div className="space-y-3">
              {(() => {
                const pcts = roundPercentagesTo100(loyaltyBreakdown.map(t => t.value));
                const maxVal = Math.max(...loyaltyBreakdown.map(t => t.value), 1);
                return loyaltyBreakdown.map((t, i) => {
                  const color = COLORS[i % COLORS.length];
                  const pct = Math.round(t.value / maxVal * 100);
                  return (
                    <div key={t.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }}/>
                          <span className="text-sm font-semibold text-[#0F172A]">{t.name}</span>
                        </div>
                        <span className="text-sm font-bold text-[#0F172A]">{t.value} <span className="text-gray-500 font-medium">({pcts[i]}%)</span></span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width:`${Math.max(pct,3)}%`, background: color }}/>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </ChartCard>
        )}
      </div>

      {/* ── Charts row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Revenue by payment method — one clear panel, replacing the two
            previous charts that contradicted each other (one plotted invoice
            count on a currency axis, the other only showed paid revenue with
            no context). */}
        {(show('payment_revenue') || show('payment_methods')) && (
        <ChartCard title="Revenue by Payment Method">
          {invoicesByChannel.length === 0 ? <Empty/> : (
            <div className="space-y-3">
              {(() => {
                const maxRevenue = Math.max(...invoicesByChannel.map(c => c.revenue), 1);
                return invoicesByChannel.map((c, i) => {
                  const color = COLORS[i % COLORS.length];
                  const pct = Math.round(c.revenue / maxRevenue * 100);
                  return (
                    <div key={c.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }}/>
                          <span className="text-sm font-semibold text-[#0F172A]">{c.name}</span>
                          <span className="text-xs text-gray-500">{c.paidCount} of {c.totalCount} paid</span>
                        </div>
                        <span className="text-sm font-bold text-[#0F172A]">{fmt(c.revenue)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width:`${Math.max(pct,3)}%`, background: color }}/>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </ChartCard>
        )}

        {/* Invoice status breakdown — count AND amount per status, as a clean
            readable list rather than a tiny pie chart nobody can read */}
        {show('invoice_status') && (
        <ChartCard title="Invoices by Status">
          {invoicesByStatus.length === 0 ? <Empty/> : (
            <div className="space-y-3">
              {(() => {
                const maxAmount = Math.max(...invoicesByStatus.map(s => s.amount), 1);
                return invoicesByStatus.map((s, i) => {
                  const color = statusHex(s.name, i);
                  const pct = Math.round(s.amount / maxAmount * 100);
                  return (
                    <div key={s.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }}/>
                          <span className="text-sm font-semibold text-[#0F172A]">{s.name}</span>
                          <span className="text-xs text-gray-500">{s.value} invoice{s.value!==1?'s':''}</span>
                        </div>
                        <span className="text-sm font-bold text-[#0F172A]">{fmt(s.amount)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width:`${Math.max(pct,3)}%`, background: color }}/>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </ChartCard>
        )}
      </div>

      {/* ── Charts row 3: Products + Low stock ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Products by category */}
        {show('top_categories') && (
        <ChartCard title="Products by Category" className="lg:col-span-2">
          {topCategories.length === 0 ? <Empty msg="No products yet"/> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topCategories} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false}/>
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110}/>
                <Tooltip/>
                <Bar dataKey="products" fill="#8B5CF6" radius={[0,6,6,0]} name="Products"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        )}

        {/* Low stock alert */}
        {show('low_stock') && (
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
                    <div className="text-[11px] text-gray-500 mt-0.5">Reorder at {reorder} · {p.category||'Uncategorized'}</div>
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
        )}
      </div>

      {/* ── Recent orders table ── */}
      {show('recent_invoices') && (
      <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden dashboard-fade-in transition-all duration-300 hover:shadow-md">
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
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">{h}</th>
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
      )}

    </div>
  );
}

// ─── AI Insights ──────────────────────────────────────────────────────────────
// Generates a short, data-driven narrative using the app's existing AI
// endpoint (same pattern as AISummary.tsx) — summarizing the current period's
// key figures into 2-3 sentences of plain-English business insight, with an
// actionable recommendation, rather than just repeating the numbers already
// shown on the KPI cards above.
function AIInsightsCard({ kpis, prevPeriodKpis, rangeLabel, fmt, pctChange }) {
  const [insight, setInsight]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    setLoading(true); setError('');
    try {
      const revTrend = prevPeriodKpis ? pctChange(kpis.totalRevenue, prevPeriodKpis.totalRevenue) : null;
      const context = [
        `Period: ${rangeLabel}`,
        `Paid invoice revenue: ${fmt(kpis.totalRevenue)}${revTrend!=null?` (${revTrend>=0?'+':''}${revTrend}% vs previous period)`:''}`,
        `Pending collections: ${fmt(kpis.pendingAmount)} across ${kpis.pendingCount} invoices, ${kpis.overdueCount} overdue`,
        `Orders completed: ${kpis.ordersCount}, average order value ${fmt(kpis.avgOrderValue)}`,
        `Refunds: ${fmt(kpis.refundAmount)} across ${kpis.refundCount} orders`,
        `Customers: ${kpis.totalCustomers} total, ${kpis.newCustomers} new this period, ${kpis.vipCount} VIP`,
        `Products: ${kpis.activeProducts} active, ${kpis.lowStockCount} low on stock`,
        `Open activities: ${kpis.openActivities}`,
      ].join('\n');
      const sb = (window as any).__bp_supabase;
      const session = sb ? (await sb.auth.getSession()).data.session : null;
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          system: `You are a retail business analyst. Given these dashboard figures, write a concise 2-3 sentence insight: call out what's going well, what needs attention (e.g. overdue collections, low stock, refunds), and end with one specific, actionable recommendation. Be direct and specific with numbers — no generic advice.`,
          messages: [{ role: 'user', content: context }],
          max_tokens: 220,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInsight(data.content?.[0]?.text || 'Unable to generate insight.');
      setGenerated(true);
    } catch (e: any) {
      // Show the server's actual error message when we have one — it's
      // already specific and actionable (e.g. "AI is not configured for
      // this deployment", "Session expired — please log in again"). Only
      // fall back to a generic message for genuine network-level failures
      // (fetch itself failing, JSON parse errors) where there's nothing
      // more specific to show.
      setError(e?.message || 'Insight unavailable right now — please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative rounded-[24px] p-6 overflow-hidden shadow-lg dashboard-fade-in transition-all duration-300 hover:shadow-xl" style={{background:'linear-gradient(135deg,#0F172A,#1e3a8a 60%,#312e81)'}}>
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-blue-500/20 blur-3xl"/>
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-purple-500/20 blur-3xl"/>
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">✨</span>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider">AI Insights</h3>
          </div>
          {!generated && !loading && !error && (
            <div>
              <p className="text-blue-200/80 text-sm mb-3">Get a plain-English read on this period's numbers, with a specific recommendation.</p>
              <button onClick={generate} className="bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-xl border border-white/20 transition-all">
                Generate Insight
              </button>
            </div>
          )}
          {loading && (
            <div className="flex items-center gap-2 text-blue-200 text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-300 animate-pulse"/>
              <span className="inline-block w-2 h-2 rounded-full bg-blue-300 animate-pulse" style={{animationDelay:'0.15s'}}/>
              <span className="inline-block w-2 h-2 rounded-full bg-blue-300 animate-pulse" style={{animationDelay:'0.3s'}}/>
              <span className="ml-1">Analyzing your data…</span>
            </div>
          )}
          {error && <p className="text-red-300 text-sm">{error}</p>}
          {generated && !loading && (
            <>
              <p className="text-white text-sm leading-relaxed">{insight}</p>
              <button onClick={generate} className="mt-3 text-blue-300 hover:text-white text-xs font-semibold">↻ Regenerate</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
