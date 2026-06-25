// @ts-nocheck
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { formatDisplayNumber, PAGE_DISPLAY_PREFIX, formatCurrency } from '@/lib/utils';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = ['#0F172A','#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316','#64748B'];

const CHART_TYPES = [
  { v:'none', l:'Table Only', icon:'📋' },
  { v:'bar',  l:'Bar Chart',  icon:'📊' },
  { v:'line', l:'Line Chart', icon:'📈' },
  { v:'area', l:'Area Chart', icon:'🏔️' },
  { v:'pie',  l:'Pie / Donut', icon:'🥧' },
];

const DATE_RANGES = [
  { v:'',          l:'All Time' },
  { v:'today',     l:'Today' },
  { v:'week',      l:'This Week' },
  { v:'month',     l:'This Month' },
  { v:'quarter',   l:'This Quarter' },
  { v:'year',      l:'This Year' },
  { v:'last7',     l:'Last 7 Days' },
  { v:'last30',    l:'Last 30 Days' },
  { v:'last90',    l:'Last 90 Days' },
  { v:'last365',   l:'Last 12 Months' },
  { v:'custom',    l:'Custom Range' },
];

// ─── Field definitions per object ────────────────────────────────────────────
// t: 'currency' | 'date' | 'number' | 'status' | 'text'
// filterable: true = show in filter panel
const OBJECT_FIELDS = {
  customers: [
    { k:'id',           l:'Customer #',   t:'text' },
    { k:'name',         l:'Name',         t:'text' },
    { k:'industry',    l:'Industry',     t:'text',     filterable:true },
    { k:'status',      l:'Status',       t:'status',   filterable:true },
    { k:'city',        l:'City',         t:'text',     filterable:true },
    { k:'country',     l:'Country',      t:'text',     filterable:true },
    { k:'owner',       l:'Owner',        t:'text',     filterable:true },
    { k:'annual_revenue', l:'Annual Revenue', t:'currency' },
    { k:'employee_count', l:'Employees', t:'number' },
    { k:'created_at',  l:'Created Date', t:'date',     filterable:true },
    { k:'updated_at',  l:'Updated Date', t:'date' },
  ],
  leads: [
    { k:'id', l:'Lead #', t:'text' },
    { k:'name',        l:'Name',         t:'text' },
    { k:'customer',    l:'Company',      t:'text' },
    { k:'source',      l:'Source',       t:'text',     filterable:true },
    { k:'status',      l:'Status',       t:'status',   filterable:true },
    { k:'amount',      l:'Amount',       t:'currency' },
    { k:'campaign',    l:'Campaign',     t:'text',     filterable:true },
    { k:'owner',       l:'Owner',        t:'text',     filterable:true },
    { k:'created_at',  l:'Created Date', t:'date',     filterable:true },
  ],
  opportunities: [
    { k:'id', l:'Opportunity #', t:'text' },
    { k:'name',        l:'Name',         t:'text' },
    { k:'customer',    l:'Customer',     t:'text' },
    { k:'stage',       l:'Stage',        t:'text',     filterable:true },
    { k:'status',      l:'Status',       t:'status',   filterable:true },
    { k:'amount',      l:'Amount',       t:'currency' },
    { k:'probability', l:'Probability%', t:'number' },
    { k:'currency',    l:'Currency',     t:'text',     filterable:true },
    { k:'closeDate',   l:'Close Date',   t:'date',     filterable:true },
    { k:'campaign',    l:'Campaign',     t:'text',     filterable:true },
    { k:'owner',       l:'Owner',        t:'text',     filterable:true },
    { k:'created_at',  l:'Created Date', t:'date',     filterable:true },
  ],
  orders: [
    { k:'id', l:'Order #', t:'text' },
    { k:'name',           l:'Name',            t:'text' },
    { k:'customer',       l:'Customer',         t:'text' },
    { k:'amount',         l:'Amount',           t:'currency' },
    { k:'status',         l:'Status',           t:'status',   filterable:true },
    { k:'currency',       l:'Currency',         t:'text',     filterable:true },
    { k:'payment_terms',  l:'Payment Terms',    t:'text',     filterable:true },
    { k:'payment_status', l:'Payment Status',   t:'text',     filterable:true },
    { k:'deliveryDate',   l:'Delivery Date',    t:'date',     filterable:true },
    { k:'owner',          l:'Owner',            t:'text',     filterable:true },
    { k:'created_at',     l:'Created Date',     t:'date',     filterable:true },
  ],
  invoices: [
    { k:'id', l:'Invoice #', t:'text' },
    { k:'name',           l:'Name',            t:'text' },
    { k:'customer',       l:'Customer',         t:'text' },
    { k:'amount',         l:'Amount',           t:'currency' },
    { k:'status',         l:'Status',           t:'status',   filterable:true },
    { k:'currency',       l:'Currency',         t:'text',     filterable:true },
    { k:'payment_terms',  l:'Payment Terms',    t:'text',     filterable:true },
    { k:'payment_status', l:'Payment Status',   t:'text',     filterable:true },
    { k:'dueDate',        l:'Due Date',         t:'date',     filterable:true },
    { k:'owner',          l:'Owner',            t:'text',     filterable:true },
    { k:'created_at',     l:'Created Date',     t:'date',     filterable:true },
  ],
  contacts: [
    { k:'id', l:'Contact #', t:'text' },
    { k:'name',        l:'Name',          t:'text' },
    { k:'customer',    l:'Company',       t:'text' },
    { k:'designation', l:'Designation',   t:'text',     filterable:true },
    { k:'department',  l:'Department',    t:'text',     filterable:true },
    { k:'email',       l:'Email',         t:'text' },
    { k:'phone',       l:'Phone',         t:'text' },
    { k:'status',      l:'Status',        t:'status',   filterable:true },
    { k:'owner',       l:'Owner',         t:'text',     filterable:true },
    { k:'created_at',  l:'Created Date',  t:'date',     filterable:true },
  ],
  activities: [
    { k:'id', l:'Activity #', t:'text' },
    { k:'name',         l:'Subject',       t:'text' },
    { k:'customer',     l:'Customer',      t:'text' },
    { k:'activityType', l:'Type',          t:'text',     filterable:true },
    { k:'status',       l:'Status',        t:'status',   filterable:true },
    { k:'priority',     l:'Priority',      t:'text',     filterable:true },
    { k:'activityDate', l:'Activity Date', t:'date',     filterable:true },
    { k:'dueDate',      l:'Due Date',      t:'date',     filterable:true },
    { k:'owner',        l:'Owner',         t:'text',     filterable:true },
    { k:'created_at',   l:'Created Date',  t:'date',     filterable:true },
  ],
  quotations: [
    { k:'quote_number', l:'Quote #',       t:'text' },
    { k:'name',         l:'Name',          t:'text' },
    { k:'customer',     l:'Customer',      t:'text' },
    { k:'status',       l:'Status',        t:'status',   filterable:true },
    { k:'grand_total',  l:'Grand Total',   t:'currency' },
    { k:'subtotal',     l:'Subtotal',      t:'currency' },
    { k:'total_tax',    l:'Tax',           t:'currency' },
    { k:'total_discount',l:'Discount',     t:'currency' },
    { k:'currency',     l:'Currency',      t:'text',     filterable:true },
    { k:'validity_date',l:'Validity Date', t:'date',     filterable:true },
    { k:'owner',        l:'Owner',         t:'text',     filterable:true },
    { k:'created_at',   l:'Created Date',  t:'date',     filterable:true },
  ],
  products: [
    { k:'id', l:'Product #', t:'text' },
    { k:'name',          l:'Name',          t:'text' },
    { k:'category',      l:'Category',      t:'text',     filterable:true },
    { k:'productFamily', l:'Product Family',t:'text',     filterable:true },
    { k:'price',         l:'Price',         t:'currency' },
    { k:'mrp',           l:'MRP',           t:'currency' },
    { k:'cost',          l:'Cost',          t:'currency' },
    { k:'stock',         l:'Stock Qty',     t:'number' },
    { k:'status',        l:'Status',        t:'status',   filterable:true },
    { k:'created_at',    l:'Created Date',  t:'date',     filterable:true },
  ],
};

const B2C_OBJECT_FIELDS = {
  retailCustomers: [
    { k:'name',          l:'Name',           t:'text' },
    { k:'phone',         l:'Phone',          t:'text' },
    { k:'email',         l:'Email',          t:'text' },
    { k:'status',        l:'Status',         t:'status',   filterable:true },
    { k:'loyalty_tier',  l:'Loyalty Tier',   t:'text',     filterable:true },
    { k:'loyalty_points',l:'Loyalty Points', t:'number' },
    { k:'city',          l:'City',           t:'text',     filterable:true },
    { k:'gender',        l:'Gender',         t:'text',     filterable:true },
    { k:'owner',         l:'Owner',          t:'text',     filterable:true },
    { k:'created_at',    l:'Created Date',   t:'date',     filterable:true },
  ],
  retailProducts: [
    { k:'name',           l:'Name',          t:'text' },
    { k:'category',       l:'Category',      t:'text',     filterable:true },
    { k:'brand',          l:'Brand',         t:'text',     filterable:true },
    { k:'price',          l:'Price',         t:'currency' },
    { k:'mrp',            l:'MRP',           t:'currency' },
    { k:'stock_quantity', l:'Stock Qty',     t:'number' },
    { k:'status',         l:'Status',        t:'status',   filterable:true },
    { k:'created_at',     l:'Created Date',  t:'date',     filterable:true },
  ],
  retailActivities: [
    { k:'subject',        l:'Subject',       t:'text' },
    { k:'activity_type',  l:'Type',          t:'text',     filterable:true },
    { k:'status',         l:'Status',        t:'status',   filterable:true },
    { k:'priority',       l:'Priority',      t:'text',     filterable:true },
    { k:'activity_date',  l:'Activity Date', t:'date',     filterable:true },
    { k:'owner',          l:'Owner',         t:'text',     filterable:true },
    { k:'created_at',     l:'Created Date',  t:'date',     filterable:true },
  ],
  retailOrders: [
    { k:'id',             l:'Order #',       t:'text' },
    { k:'customer',       l:'Customer',      t:'text' },
    { k:'channel',        l:'Channel',       t:'text',     filterable:true },
    { k:'amount',         l:'Amount',        t:'currency' },
    { k:'status',         l:'Status',        t:'status',   filterable:true },
    { k:'payment_method', l:'Payment Method',t:'text',     filterable:true },
    { k:'payment_status', l:'Payment Status',t:'text',     filterable:true },
    { k:'owner',          l:'Owner',         t:'text',     filterable:true },
    { k:'created_at',     l:'Created Date',  t:'date',     filterable:true },
  ],
  retailInvoices: [
    { k:'id',             l:'Invoice #',     t:'text' },
    { k:'customer',       l:'Customer',      t:'text' },
    { k:'amount',         l:'Amount',        t:'currency' },
    { k:'status',         l:'Status',        t:'status',   filterable:true },
    { k:'payment_method', l:'Payment Method',t:'text',     filterable:true },
    { k:'payment_status', l:'Payment Status',t:'text',     filterable:true },
    { k:'due_date',       l:'Due Date',      t:'date',     filterable:true },
    { k:'owner',          l:'Owner',         t:'text',     filterable:true },
    { k:'created_at',     l:'Created Date',  t:'date',     filterable:true },
  ],
};

const B2B_OBJECTS = [
  { v:'customers',     l:'Customers',     icon:'👥' },
  { v:'leads',         l:'Leads',         icon:'🎯' },
  { v:'opportunities', l:'Opportunities', icon:'💡' },
  { v:'orders',        l:'Orders',        icon:'📦' },
  { v:'invoices',      l:'Invoices',      icon:'🧾' },
  { v:'contacts',      l:'Contacts',      icon:'👤' },
  { v:'activities',    l:'Activities',    icon:'📅' },
  { v:'quotations',    l:'Quotations',    icon:'📄' },
  { v:'products',      l:'Products',      icon:'🏷️' },
];

const B2C_OBJECTS = [
  { v:'retailCustomers',  l:'Retail Customers',  icon:'🧑‍🤝‍🧑' },
  { v:'retailProducts',   l:'Retail Products',   icon:'🏷️' },
  { v:'retailActivities', l:'Retail Activities', icon:'📅' },
  { v:'retailOrders',     l:'Retail Orders',     icon:'🛍️' },
  { v:'retailInvoices',   l:'Retail Invoices',   icon:'🧾' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const applyDateRange = (records, range, customStart, customEnd) => {
  if (!range) return records;
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start, end;
  if (range === 'custom') {
    start = customStart ? new Date(customStart) : null;
    end   = customEnd   ? new Date(customEnd + 'T23:59:59') : null;
  } else if (range === 'today')   { start = sod; }
  else if (range === 'week')      { start = new Date(sod - sod.getDay() * 86400000); }
  else if (range === 'month')     { start = new Date(now.getFullYear(), now.getMonth(), 1); }
  else if (range === 'quarter')   { start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); }
  else if (range === 'year')      { start = new Date(now.getFullYear(), 0, 1); }
  else if (range === 'last7')     { start = new Date(now - 7 * 86400000); }
  else if (range === 'last30')    { start = new Date(now - 30 * 86400000); }
  else if (range === 'last90')    { start = new Date(now - 90 * 86400000); }
  else if (range === 'last365')   { start = new Date(now - 365 * 86400000); }
  return records.filter(r => {
    const d = r.created_at ? new Date(r.created_at) : null;
    if (!d) return true;
    if (start && d < start) return false;
    if (end   && d > end)   return false;
    return true;
  });
};

const fmtCurrency = (v, currency = 'INR') => {
  if (!v && v !== 0) return '-';
  return new Intl.NumberFormat('en-IN', { style:'currency', currency, maximumFractionDigits:0 }).format(v);
};

const fmtVal = (val, fieldDef, currency = 'INR') => {
  if (val === null || val === undefined || val === '') return '-';
  if (fieldDef?.t === 'currency') return fmtCurrency(val, currency);
  if (fieldDef?.t === 'date')     return val ? new Date(val).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '-';
  if (fieldDef?.t === 'number')   return Number(val).toLocaleString('en-IN');
  return String(val);
};

const getValueForField = (record, field) => {
  return record[field.k] ?? record[field.k.replace(/([A-Z])/g, '_$1').toLowerCase()] ?? null;
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function FilterRow({ field, value, operator, onChange, onRemove, allData }) {
  const uniqueVals = useMemo(() => [...new Set(allData.map(r => r[field.k]).filter(Boolean))].sort(), [allData, field.k]);
  const operators = field.t === 'currency' || field.t === 'number'
    ? ['=','!=','>','<','>=','<=']
    : field.t === 'date'
    ? ['on','before','after','between']
    : ['=','!=','contains','starts_with','not_contains'];

  return (
    <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-xl border border-blue-100">
      <div className="text-xs font-semibold text-blue-700 min-w-[80px] truncate">{field.l}</div>
      <select value={operator} onChange={e=>onChange('operator', e.target.value)}
        className="border border-blue-200 rounded-lg px-2 py-1.5 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
        {operators.map(op=><option key={op} value={op}>{op}</option>)}
      </select>
      {(field.t === 'text' || field.t === 'status') && uniqueVals.length > 0 && uniqueVals.length <= 20
        ? <select value={value} onChange={e=>onChange('value', e.target.value)}
            className="flex-1 border border-blue-200 rounded-lg px-2 py-1.5 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="">Any</option>
            {uniqueVals.map(v=><option key={v} value={v}>{v}</option>)}
          </select>
        : <input value={value} onChange={e=>onChange('value', e.target.value)} placeholder="Value..."
            className="flex-1 border border-blue-200 rounded-lg px-2 py-1.5 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
      }
      <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-sm font-bold px-1">✕</button>
    </div>
  );
}

function SortRow({ field, direction, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-xl border border-amber-100">
      <div className="text-xs font-semibold text-amber-700 flex-1 truncate">{field.l}</div>
      <select value={direction} onChange={e=>onChange(e.target.value)}
        className="border border-amber-200 rounded-lg px-2 py-1.5 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-amber-400">
        <option value="asc">A → Z / Low → High</option>
        <option value="desc">Z → A / High → Low</option>
      </select>
      <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-sm font-bold px-1">✕</button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FastReportsPage() {
  const {
    customers, leads, opportunities, orders, invoices, contacts, activities, quotations, products,
    retailCustomers, retailProducts, retailActivities, retailOrders, retailInvoices,
    reports, saveReport, deleteReport, fetchReports,
    currentUser, appPreferences, enterpriseUsers,
  } = useApp();

  const currency = appPreferences?.default_currency || 'INR';
  const isB2C    = appPreferences?.b2c_mode === true;

  const ALL_FIELDS   = { ...OBJECT_FIELDS, ...B2C_OBJECT_FIELDS };
  const ACTIVE_OBJS  = isB2C ? B2C_OBJECTS : B2B_OBJECTS;
  const defaultObj   = isB2C ? 'retailOrders' : 'opportunities';

  // ── Config state ───────────────────────────────────────────────────────────
  const [objType,       setObjType]       = useState(defaultObj);
  const [columns,       setColumns]       = useState([]);
  const [filters,       setFilters]       = useState([]); // [{field, operator, value}]
  const [sorts,         setSorts]         = useState([]);  // [{field, direction}]
  const [dateRange,     setDateRange]     = useState('');
  const [customStart,   setCustomStart]   = useState('');
  const [customEnd,     setCustomEnd]     = useState('');
  const [ownerScope,    setOwnerScope]    = useState('all'); // 'all' | 'mine' | 'team'
  const [groupBy,       setGroupBy]       = useState('status');
  const [chartType,     setChartType]     = useState('bar');
  const [chartMetric,   setChartMetric]   = useState('count'); // 'count' | field key
  const [activeTab,     setActiveTab]     = useState('table');
  const [savedView,     setSavedView]     = useState('mine');
  const [reportName,    setReportName]    = useState('');
  const [isPublic,      setIsPublic]      = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [loadedId,      setLoadedId]      = useState(null);
  const [addFilterKey,  setAddFilterKey]  = useState('');
  const [addSortKey,    setAddSortKey]    = useState('');
  const [showSaved,     setShowSaved]     = useState(true);
  const [page,          setPage]          = useState(1);
  const PAGE_SIZE = 50;

  const fields = ALL_FIELDS[objType] || [];

  // ── Init columns when object changes ───────────────────────────────────────
  useEffect(() => {
    const defaultCols = (ALL_FIELDS[objType] || []).slice(0, 6).map(f => f.k);
    setColumns(defaultCols);
    setFilters([]);
    setSorts([]);
    setGroupBy('status');
    setChartMetric('count');
    setPage(1);
  }, [objType]);

  // ── Raw data from context (already security-filtered by applyDataSecurity) ─
  const rawData = useMemo(() => {
    const map = {
      customers, leads, opportunities, orders, invoices, contacts, activities, quotations, products,
      retailCustomers: retailCustomers || [],
      retailProducts:  retailProducts  || [],
      retailActivities:retailActivities|| [],
      retailOrders:    retailOrders    || [],
      retailInvoices:  retailInvoices  || [],
    };
    return map[objType] || [];
  }, [objType, customers, leads, opportunities, orders, invoices, contacts, activities, quotations, products,
      retailCustomers, retailProducts, retailActivities, retailOrders, retailInvoices]);

  // ── Apply owner scope ──────────────────────────────────────────────────────
  const scopedData = useMemo(() => {
    if (ownerScope === 'mine') return rawData.filter(r => r.owner === currentUser?.email || r.owner_id === currentUser?.id);
    if (ownerScope === 'team') {
      // Same business unit as current user
      const teamIds = (enterpriseUsers || []).filter(u => u.business_unit_id === currentUser?.business_unit_id).map(u => u.id);
      return rawData.filter(r => teamIds.includes(r.owner_id) || r.owner === currentUser?.email);
    }
    return rawData;
  }, [rawData, ownerScope, currentUser, enterpriseUsers]);

  // ── Apply date range ───────────────────────────────────────────────────────
  const dateFiltered = useMemo(() => applyDateRange(scopedData, dateRange, customStart, customEnd), [scopedData, dateRange, customStart, customEnd]);

  // ── Apply custom filters ───────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    let data = dateFiltered;
    for (const f of filters) {
      if (!f.value && f.value !== 0) continue;
      const fieldDef = fields.find(fd => fd.k === f.field);
      data = data.filter(r => {
        const rv = String(r[f.field] ?? '').toLowerCase();
        const fv = String(f.value).toLowerCase();
        const numRv = Number(r[f.field] || 0);
        const numFv = Number(f.value);
        switch (f.operator) {
          case '=':           return rv === fv;
          case '!=':          return rv !== fv;
          case '>':           return numRv > numFv;
          case '<':           return numRv < numFv;
          case '>=':          return numRv >= numFv;
          case '<=':          return numRv <= numFv;
          case 'contains':    return rv.includes(fv);
          case 'not_contains':return !rv.includes(fv);
          case 'starts_with': return rv.startsWith(fv);
          case 'on':          return r[f.field]?.startsWith(f.value);
          case 'before':      return r[f.field] && r[f.field] < f.value;
          case 'after':       return r[f.field] && r[f.field] > f.value;
          default:            return true;
        }
      });
    }
    return data;
  }, [dateFiltered, filters, fields]);

  // ── Apply sorts ────────────────────────────────────────────────────────────
  const sortedData = useMemo(() => {
    if (!sorts.length) return filteredData;
    return [...filteredData].sort((a, b) => {
      for (const s of sorts) {
        const av = a[s.field]; const bv = b[s.field];
        if (av === bv) continue;
        const cmp = (av ?? '') < (bv ?? '') ? -1 : 1;
        return s.direction === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }, [filteredData, sorts]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages   = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const pagedData    = sortedData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Summary KPIs ───────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const currencyFields = fields.filter(f => f.t === 'currency');
    const primaryAmt = currencyFields[0];
    const totalVal = primaryAmt ? filteredData.reduce((s, r) => s + Number(r[primaryAmt.k] || 0), 0) : 0;
    const uniqueOwners = new Set(filteredData.map(r => r.owner).filter(Boolean)).size;
    return {
      total: filteredData.length,
      totalVal,
      primaryAmt,
      uniqueOwners,
      avgVal: filteredData.length ? totalVal / filteredData.length : 0,
    };
  }, [filteredData, fields]);

  // ── Group data for charts ──────────────────────────────────────────────────
  const groupedData = useMemo(() => {
    if (!groupBy) return [];
    const groups = {};
    const isNumericMetric = chartMetric && chartMetric !== 'count';
    filteredData.forEach(r => {
      const key = String(r[groupBy] || 'Unknown');
      if (!groups[key]) groups[key] = { label: key, count: 0, value: 0 };
      groups[key].count++;
      if (isNumericMetric) groups[key].value += Number(r[chartMetric] || 0);
    });
    return Object.values(groups).sort((a, b) => b.count - a.count).slice(0, 20);
  }, [filteredData, groupBy, chartMetric]);

  // ── Unique values for status options ───────────────────────────────────────
  const uniqueValsFor = useCallback((key) => [...new Set(rawData.map(r => r[key]).filter(Boolean))].sort(), [rawData]);

  // ── Add filter ─────────────────────────────────────────────────────────────
  const addFilter = () => {
    if (!addFilterKey) return;
    const fieldDef = fields.find(f => f.k === addFilterKey);
    const defaultOp = fieldDef?.t === 'currency' || fieldDef?.t === 'number' ? '>' : '=';
    setFilters(prev => [...prev, { field: addFilterKey, operator: defaultOp, value: '' }]);
    setAddFilterKey('');
  };

  const addSort = () => {
    if (!addSortKey || sorts.find(s => s.field === addSortKey)) return;
    setSorts(prev => [...prev, { field: addSortKey, direction: 'desc' }]);
    setAddSortKey('');
  };

  const toggleCol = (k) => setColumns(prev => prev.includes(k) ? prev.filter(c => c !== k) : [...prev, k]);

  // ── Load saved report ──────────────────────────────────────────────────────
  const loadReport = (r) => {
    const cfg = r.config || {};
    setObjType(r.object_type);
    setColumns(r.columns || []);
    setFilters(cfg.filters || []);
    setSorts(cfg.sorts || []);
    setDateRange(cfg.dateRange || '');
    setCustomStart(cfg.customStart || '');
    setCustomEnd(cfg.customEnd || '');
    setOwnerScope(cfg.ownerScope || 'all');
    setGroupBy(r.grouping || 'status');
    setChartType(r.chart_type || 'bar');
    setChartMetric(r.chart_field || 'count');
    setReportName(r.name);
    setIsPublic(r.is_public || false);
    setLoadedId(r.id);
    setPage(1);
    setActiveTab('table');
  };

  // ── Save report ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!reportName.trim()) { alert('Enter a report name.'); return; }
    setSaving(true);
    await saveReport({
      id:          loadedId,
      name:        reportName,
      object_type: objType,
      columns,
      filters:     { status:'', owner:'', dateRange }, // legacy compat
      config:      { filters, sorts, dateRange, customStart, customEnd, ownerScope },
      grouping:    groupBy,
      chart_type:  chartType,
      chart_field: chartMetric,
      is_public:   isPublic,
    });
    await fetchReports();
    setSaving(false);
    alert('Report saved!');
  };

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = columns.map(k => fields.find(f => f.k === k)?.l || k);
    const rows = sortedData.map(r => columns.map(k => {
      const fd = fields.find(f => f.k === k);
      const v  = r[k];
      if (fd?.t === 'date') return v ? new Date(v).toLocaleDateString('en-IN') : '';
      if (fd?.t === 'currency') return v ?? '';
      return v ?? '';
    }));
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = `${reportName || objType}_report.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Saved report lists ─────────────────────────────────────────────────────
  const myReports     = (reports || []).filter(r => r.created_by === currentUser?.email);
  const publicReports = (reports || []).filter(r => r.is_public && r.created_by !== currentUser?.email);

  const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';
  const objDef = [...B2B_OBJECTS, ...B2C_OBJECTS].find(o => o.v === objType);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[28px] p-6 text-white flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">⚡ Fast Reports</h1>
          <p className="text-blue-200 mt-1">Build, filter, sort, visualize and export from any data object · {filteredData.length} records</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-blue-200 text-sm">Report Name</label>
            <input value={reportName} onChange={e=>setReportName(e.target.value)} placeholder="e.g. Monthly Pipeline"
              className="border border-blue-600 bg-white/10 text-white placeholder-blue-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white w-44"/>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer text-sm text-blue-200">
            <input type="checkbox" checked={isPublic} onChange={e=>setIsPublic(e.target.checked)} className="accent-blue-400"/>
            Share
          </label>
          <button onClick={handleSave} disabled={saving}
            className="bg-white text-[#0F172A] px-4 py-2 rounded-2xl font-bold text-sm shadow-lg hover:bg-blue-50 disabled:opacity-50">
            {saving ? '💾 Saving...' : '💾 Save'}
          </button>
          <button onClick={exportCSV}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-lg flex items-center gap-1.5">
            📥 Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* ── Left Panel ── */}
        <div className="xl:col-span-1 space-y-4">

          {/* Object selector */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow p-5">
            <h3 className="font-bold text-[#0F172A] mb-3">📁 Data Object</h3>
            <div className="grid grid-cols-2 gap-2">
              {ACTIVE_OBJS.map(o => (
                <button key={o.v} onClick={() => setObjType(o.v)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left flex items-center gap-1.5 ${objType===o.v ? 'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white shadow' : 'bg-gray-50 text-gray-600 hover:bg-blue-50 border border-gray-100'}`}>
                  <span>{o.icon}</span><span className="truncate">{o.l}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Owner scope */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow p-5">
            <h3 className="font-bold text-[#0F172A] mb-3">👤 Data Scope</h3>
            <div className="space-y-2">
              {[{v:'all',l:'All Records',icon:'🌐'},{v:'mine',l:'My Records',icon:'👤'},{v:'team',l:'My Team',icon:'👥'}].map(s=>(
                <button key={s.v} onClick={()=>setOwnerScope(s.v)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${ownerScope===s.v?'bg-blue-600 text-white':'bg-gray-50 text-gray-600 hover:bg-blue-50 border border-gray-100'}`}>
                  <span>{s.icon}</span>{s.l}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow p-5 space-y-3">
            <h3 className="font-bold text-[#0F172A]">📅 Date Range</h3>
            <select value={dateRange} onChange={e=>setDateRange(e.target.value)} className={sCls}>
              {DATE_RANGES.map(d=><option key={d.v} value={d.v}>{d.l}</option>)}
            </select>
            {dateRange === 'custom' && (
              <div className="space-y-2">
                <div><label className="text-xs text-gray-400 font-bold uppercase block mb-1">From</label>
                  <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} className={sCls}/></div>
                <div><label className="text-xs text-gray-400 font-bold uppercase block mb-1">To</label>
                  <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className={sCls}/></div>
              </div>
            )}
          </div>

          {/* Custom filters */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow p-5 space-y-3">
            <h3 className="font-bold text-[#0F172A]">🔍 Filters
              {filters.length > 0 && <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{filters.length}</span>}
            </h3>
            {filters.map((f, i) => {
              const fieldDef = fields.find(fd => fd.k === f.field);
              if (!fieldDef) return null;
              return (
                <FilterRow key={i} field={fieldDef} value={f.value} operator={f.operator}
                  onChange={(prop, val) => setFilters(prev => prev.map((x,xi) => xi===i ? {...x,[prop]:val} : x))}
                  onRemove={() => setFilters(prev => prev.filter((_,xi) => xi !== i))}
                  allData={rawData}
                />
              );
            })}
            <div className="flex gap-2">
              <select value={addFilterKey} onChange={e=>setAddFilterKey(e.target.value)}
                className="flex-1 border border-blue-200 rounded-xl px-2 py-2 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                <option value="">+ Add filter...</option>
                {fields.map(f=><option key={f.k} value={f.k}>{f.l}</option>)}
              </select>
              <button onClick={addFilter} disabled={!addFilterKey}
                className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-40">Add</button>
            </div>
            {filters.length > 0 && (
              <button onClick={()=>setFilters([])} className="text-xs text-red-400 hover:text-red-600 w-full text-center">Clear all filters</button>
            )}
          </div>

          {/* Columns */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow p-5">
            <h3 className="font-bold text-[#0F172A] mb-3">📋 Columns <span className="text-xs text-gray-400 font-normal">({columns.length} selected)</span></h3>
            <div className="space-y-1">
              {fields.map(f => (
                <label key={f.k} className="flex items-center gap-2 cursor-pointer py-1.5 px-2 hover:bg-blue-50 rounded-lg">
                  <input type="checkbox" checked={columns.includes(f.k)} onChange={()=>toggleCol(f.k)} className="w-4 h-4 accent-blue-600"/>
                  <span className="text-sm text-[#0F172A] flex-1">{f.l}</span>
                  {f.t === 'currency' && <span className="text-xs text-green-600">₹</span>}
                  {f.t === 'date'     && <span className="text-xs text-blue-400">📅</span>}
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={()=>setColumns(fields.map(f=>f.k))} className="flex-1 text-xs text-blue-600 hover:underline">Select all</button>
              <button onClick={()=>setColumns([])} className="flex-1 text-xs text-red-400 hover:underline">Clear</button>
            </div>
          </div>

          {/* Sort */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow p-5 space-y-3">
            <h3 className="font-bold text-[#0F172A]">↕️ Sort
              {sorts.length > 0 && <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">{sorts.length}</span>}
            </h3>
            {sorts.map((s, i) => {
              const fieldDef = fields.find(fd => fd.k === s.field);
              if (!fieldDef) return null;
              return (
                <SortRow key={i} field={fieldDef} direction={s.direction}
                  onChange={dir => setSorts(prev => prev.map((x,xi) => xi===i ? {...x, direction:dir} : x))}
                  onRemove={() => setSorts(prev => prev.filter((_,xi) => xi!==i))}
                />
              );
            })}
            <div className="flex gap-2">
              <select value={addSortKey} onChange={e=>setAddSortKey(e.target.value)}
                className="flex-1 border border-blue-200 rounded-xl px-2 py-2 text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                <option value="">+ Add sort...</option>
                {fields.filter(f=>!sorts.find(s=>s.field===f.k)).map(f=><option key={f.k} value={f.k}>{f.l}</option>)}
              </select>
              <button onClick={addSort} disabled={!addSortKey}
                className="bg-amber-500 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-amber-600 disabled:opacity-40">Add</button>
            </div>
          </div>

          {/* Chart / visualisation */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow p-5 space-y-3">
            <h3 className="font-bold text-[#0F172A]">📊 Visualisation</h3>
            <div>
              <label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Chart Type</label>
              <div className="grid grid-cols-2 gap-1.5">
                {CHART_TYPES.map(c=>(
                  <button key={c.v} onClick={()=>setChartType(c.v)}
                    className={`flex items-center gap-1 px-2 py-2 rounded-xl text-xs font-semibold transition-all ${chartType===c.v?'bg-[#0F172A] text-white':'bg-gray-50 text-gray-600 hover:bg-blue-50 border border-gray-100'}`}>
                    <span>{c.icon}</span><span className="truncate">{c.l}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Group By</label>
              <select value={groupBy} onChange={e=>setGroupBy(e.target.value)} className={sCls}>
                <option value="">No grouping</option>
                {fields.filter(f=>f.t!=='currency'&&f.t!=='number').map(f=><option key={f.k} value={f.k}>{f.l}</option>)}
              </select>
            </div>
            {groupBy && (
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Metric</label>
                <select value={chartMetric} onChange={e=>setChartMetric(e.target.value)} className={sCls}>
                  <option value="count">Record Count</option>
                  {fields.filter(f=>f.t==='currency'||f.t==='number').map(f=><option key={f.k} value={f.k}>{f.l}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="xl:col-span-3 space-y-4">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { l:'Total Records',   v: kpis.total.toLocaleString('en-IN'), icon:'📋', color:'blue' },
              { l: kpis.primaryAmt ? `Total ${kpis.primaryAmt.l}` : 'Total Value',
                v: kpis.primaryAmt ? fmtCurrency(kpis.totalVal, currency) : '-', icon:'💰', color:'green' },
              { l: kpis.primaryAmt ? `Avg ${kpis.primaryAmt.l}` : 'Avg Value',
                v: kpis.primaryAmt ? fmtCurrency(kpis.avgVal, currency) : '-', icon:'📈', color:'purple' },
              { l:'Unique Owners',   v: kpis.uniqueOwners, icon:'👤', color:'amber' },
            ].map(stat => (
              <div key={stat.l} className="bg-white rounded-2xl border border-blue-100 shadow p-4 flex items-center gap-3">
                <span className="text-2xl">{stat.icon}</span>
                <div><div className="text-lg font-bold text-[#0F172A]">{stat.v}</div><div className="text-xs text-gray-400">{stat.l}</div></div>
              </div>
            ))}
          </div>

          {/* Active filter tags */}
          {(filters.length > 0 || dateRange || ownerScope !== 'all') && (
            <div className="flex flex-wrap gap-2 px-1">
              {ownerScope !== 'all' && (
                <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1">
                  👤 {ownerScope === 'mine' ? 'My Records' : 'My Team'}
                  <button onClick={()=>setOwnerScope('all')} className="ml-1 text-blue-400 hover:text-blue-700">✕</button>
                </span>
              )}
              {dateRange && (
                <span className="bg-purple-100 text-purple-700 text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1">
                  📅 {DATE_RANGES.find(d=>d.v===dateRange)?.l}
                  <button onClick={()=>setDateRange('')} className="ml-1 text-purple-400 hover:text-purple-700">✕</button>
                </span>
              )}
              {filters.map((f, i) => {
                const fd = fields.find(x=>x.k===f.field);
                return (
                  <span key={i} className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1">
                    {fd?.l} {f.operator} {f.value}
                    <button onClick={()=>setFilters(prev=>prev.filter((_,xi)=>xi!==i))} className="ml-1 text-green-400 hover:text-green-700">✕</button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Table / Chart tabs */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-blue-50 flex-wrap gap-2">
              <div className="flex gap-2">
                {[{k:'table',l:'📋 Table'},{k:'chart',l:'📊 Chart'}].map(t=>(
                  <button key={t.k} onClick={()=>setActiveTab(t.k)}
                    className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab===t.k?'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white shadow':'text-gray-500 hover:bg-blue-50'}`}>
                    {t.l}
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-400">
                {objDef?.icon} {objDef?.l} · <strong className="text-[#0F172A]">{filteredData.length}</strong> records · {columns.length} columns
                {sorts.length > 0 && ` · sorted by ${sorts.map(s=>fields.find(f=>f.k===s.field)?.l).join(', ')}`}
              </div>
            </div>

            {activeTab === 'table' && (
              <>
                <div style={{overflowX:'auto', maxHeight:'55vh', overflowY:'auto'}}>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-gradient-to-r from-[#0F172A] to-blue-900 text-white">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold w-10 text-blue-300">#</th>
                        {columns.map(k => {
                          const f = fields.find(x=>x.k===k);
                          const sortDir = sorts.find(s=>s.field===k)?.direction;
                          return (
                            <th key={k} className="px-4 py-3 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-white/10 transition-colors select-none"
                              onClick={()=>{
                                const existing = sorts.find(s=>s.field===k);
                                if (existing) {
                                  setSorts(prev=>existing.direction==='asc'
                                    ? prev.map(s=>s.field===k?{...s,direction:'desc'}:s)
                                    : prev.filter(s=>s.field!==k));
                                } else {
                                  setSorts(prev=>[{field:k,direction:'asc'},...prev].slice(0,3));
                                }
                              }}>
                              {f?.l||k} {sortDir==='asc'?'↑':sortDir==='desc'?'↓':''}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedData.length === 0
                        ? <tr><td colSpan={columns.length+1} className="px-5 py-16 text-center text-gray-400">
                            <div className="text-4xl mb-2">🔍</div>
                            <div>No records match the current filters.</div>
                            <button onClick={()=>{setFilters([]);setDateRange('');setOwnerScope('all');}} className="text-blue-500 text-sm mt-2 hover:underline">Clear all filters</button>
                          </td></tr>
                        : pagedData.map((row, i) => (
                          <tr key={row._uuid||row.id||i} className="border-t border-blue-50 hover:bg-blue-50/40 transition-colors">
                            <td className="px-4 py-3 text-gray-400 text-xs">{(page-1)*PAGE_SIZE + i + 1}</td>
                            {columns.map(k => {
                              const fd = fields.find(f=>f.k===k);
                              const v  = row[k];
                              return (
                                <td key={k} className="px-4 py-3 text-[#0F172A] whitespace-nowrap">
                                  {fd?.t==='currency'
                                    ? <span className="font-semibold text-green-700">{v||v===0 ? fmtCurrency(v,currency) : '-'}</span>
                                    : fd?.t==='date'
                                    ? <span className="text-gray-500 text-xs">{v?new Date(v).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'-'}</span>
                                    : fd?.t==='number'
                                    ? <span className="font-medium">{v!=null ? Number(v).toLocaleString('en-IN') : '-'}</span>
                                    : k==='status'
                                    ? <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">{v||'-'}</span>
                                    : k==='id' && row.displayNumber
                                ? <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{formatDisplayNumber(PAGE_DISPLAY_PREFIX[objType]||'REC', row.displayNumber)}</span>
                                : <span className="text-gray-700">{v||'-'}</span>
                                  }
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-6 py-3 border-t border-blue-50 flex items-center justify-between">
                    <div className="text-xs text-gray-400">
                      Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, sortedData.length)} of {sortedData.length}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={()=>setPage(1)} disabled={page===1} className="px-2 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-40">«</button>
                      <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-3 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-40">‹ Prev</button>
                      {Array.from({length:Math.min(5,totalPages)}, (_,i) => {
                        const pg = Math.max(1, Math.min(totalPages-4, page-2)) + i;
                        return (
                          <button key={pg} onClick={()=>setPage(pg)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-[#0F172A] text-white':'text-gray-500 hover:bg-blue-50'}`}>
                            {pg}
                          </button>
                        );
                      })}
                      <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="px-3 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-40">Next ›</button>
                      <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-blue-50 disabled:opacity-40">»</button>
                    </div>
                    <div className="text-xs text-gray-400">Page {page} of {totalPages}</div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'chart' && (
              <div className="p-6">
                {!groupBy
                  ? <div className="text-center py-16 text-gray-400"><div className="text-4xl mb-2">📊</div><div>Set a Group By field in the left panel to generate a chart</div></div>
                  : groupedData.length === 0
                  ? <div className="text-center py-16 text-gray-400">No data to chart with current filters</div>
                  : chartType === 'none'
                  ? <div className="text-center py-8 text-gray-400 text-sm">Switch to a chart type in Visualisation settings</div>
                  : (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-sm font-semibold text-[#0F172A]">
                          {fields.find(f=>f.k===groupBy)?.l} · {chartMetric==='count' ? 'Count' : fields.find(f=>f.k===chartMetric)?.l}
                        </div>
                        <div className="text-xs text-gray-400">{groupedData.length} groups</div>
                      </div>
                      <ResponsiveContainer width="100%" height={400}>
                        {chartType === 'pie' ? (
                          <PieChart>
                            <Pie data={groupedData} dataKey={chartMetric==='count'?'count':'value'} nameKey="label"
                              cx="50%" cy="50%" outerRadius={150} innerRadius={70}
                              label={({label,percent})=>`${label} (${(percent*100).toFixed(0)}%)`}>
                              {groupedData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                            </Pie>
                            <Tooltip formatter={(v,n,p)=>[chartMetric==='count'?`${v} records`:fmtCurrency(v,currency), p.payload.label]}/>
                            <Legend/>
                          </PieChart>
                        ) : chartType === 'area' ? (
                          <AreaChart data={groupedData} margin={{top:5,right:30,left:20,bottom:60}}>
                            <defs>
                              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                            <XAxis dataKey="label" tick={{fontSize:11}} angle={-30} textAnchor="end" interval={0}/>
                            <YAxis tick={{fontSize:11}}/>
                            <Tooltip formatter={(v)=>[chartMetric==='count'?`${v} records`:fmtCurrency(v,currency)]}/>
                            <Area type="monotone" dataKey={chartMetric==='count'?'count':'value'} stroke="#3B82F6" fill="url(#colorCount)" strokeWidth={2}/>
                          </AreaChart>
                        ) : chartType === 'line' ? (
                          <LineChart data={groupedData} margin={{top:5,right:30,left:20,bottom:60}}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                            <XAxis dataKey="label" tick={{fontSize:11}} angle={-30} textAnchor="end" interval={0}/>
                            <YAxis tick={{fontSize:11}}/>
                            <Tooltip formatter={(v)=>[chartMetric==='count'?`${v} records`:fmtCurrency(v,currency)]}/>
                            <Legend/>
                            <Line type="monotone" dataKey={chartMetric==='count'?'count':'value'} name={chartMetric==='count'?'Count':fields.find(f=>f.k===chartMetric)?.l}
                              stroke="#0F172A" strokeWidth={2.5} dot={{fill:'#0F172A',r:4}} activeDot={{r:6}}/>
                          </LineChart>
                        ) : (
                          <BarChart data={groupedData} margin={{top:5,right:30,left:20,bottom:60}}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                            <XAxis dataKey="label" tick={{fontSize:11}} angle={-30} textAnchor="end" interval={0}/>
                            <YAxis tick={{fontSize:11}}/>
                            <Tooltip cursor={{fill:'#F1F5F9'}} formatter={(v)=>[chartMetric==='count'?`${v} records`:fmtCurrency(v,currency)]}/>
                            <Legend/>
                            <Bar dataKey={chartMetric==='count'?'count':'value'} name={chartMetric==='count'?'Count':fields.find(f=>f.k===chartMetric)?.l}
                              radius={[6,6,0,0]}>
                              {groupedData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>

                      {/* Group summary table under chart */}
                      <div className="mt-6 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="border-b border-blue-100">
                            <th className="text-left py-2 px-3 text-gray-400 font-semibold">{fields.find(f=>f.k===groupBy)?.l}</th>
                            <th className="text-right py-2 px-3 text-gray-400 font-semibold">Count</th>
                            {chartMetric !== 'count' && <th className="text-right py-2 px-3 text-gray-400 font-semibold">{fields.find(f=>f.k===chartMetric)?.l}</th>}
                            <th className="text-right py-2 px-3 text-gray-400 font-semibold">Share</th>
                          </tr></thead>
                          <tbody>
                            {groupedData.map((g,i)=>(
                              <tr key={g.label} className="border-b border-blue-50 hover:bg-blue-50/40">
                                <td className="py-2 px-3 flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{background:COLORS[i%COLORS.length]}}/>
                                  {g.label}
                                </td>
                                <td className="py-2 px-3 text-right font-semibold">{g.count}</td>
                                {chartMetric !== 'count' && <td className="py-2 px-3 text-right font-semibold text-green-700">{fmtCurrency(g.value,currency)}</td>}
                                <td className="py-2 px-3 text-right text-gray-500">
                                  {filteredData.length ? ((g.count/filteredData.length)*100).toFixed(1) : 0}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )
                }
              </div>
            )}
          </div>

          {/* Saved Reports */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-blue-50 flex items-center justify-between">
              <h3 className="font-bold text-[#0F172A]">💾 Saved Reports</h3>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[{k:'mine',l:'My Reports'},{k:'public',l:'Shared'}].map(t=>(
                    <button key={t.k} onClick={()=>setSavedView(t.k)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${savedView===t.k?'bg-[#0F172A] text-white':'text-gray-500 hover:bg-blue-50'}`}>
                      {t.l} ({t.k==='mine'?myReports.length:publicReports.length})
                    </button>
                  ))}
                </div>
                <button onClick={()=>setShowSaved(p=>!p)} className="text-gray-400 hover:text-gray-700 text-sm">{showSaved?'▲':'▼'}</button>
              </div>
            </div>
            {showSaved && (
              <div className="p-4">
                {(savedView==='mine' ? myReports : publicReports).length === 0
                  ? <div className="text-center py-8 text-gray-400 text-sm">No {savedView==='mine'?'saved':'shared'} reports yet.</div>
                  : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(savedView==='mine' ? myReports : publicReports).map(r => {
                        const objInfo = [...B2B_OBJECTS,...B2C_OBJECTS].find(o=>o.v===r.object_type);
                        return (
                          <div key={r.id} className="bg-gray-50 rounded-2xl p-4 border border-blue-100 hover:border-blue-300 transition-all">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="font-semibold text-[#0F172A] text-sm">{r.name}</div>
                                <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                  <span>{objInfo?.icon}</span><span className="capitalize">{objInfo?.l || r.object_type}</span>
                                  <span>·</span><span>{CHART_TYPES.find(c=>c.v===r.chart_type)?.l||'Table'}</span>
                                </div>
                                {r.columns?.length > 0 && <div className="text-xs text-gray-300 mt-0.5">{r.columns.length} columns</div>}
                              </div>
                              {r.is_public && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">Shared</span>}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button onClick={()=>loadReport(r)} className="flex-1 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-2 rounded-xl text-xs font-bold hover:opacity-90">▶ Load</button>
                              {r.created_by === currentUser?.email && (
                                <button onClick={()=>deleteReport(r.id)} className="bg-red-100 text-red-500 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-red-200">🗑</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
