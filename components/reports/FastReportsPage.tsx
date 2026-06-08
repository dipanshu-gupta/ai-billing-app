// @ts-nocheck
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ─── Field definitions per object ─────────────────────────────────────────────
const OBJECT_FIELDS = {
  customers:     [{ k:'name',l:'Name' },{ k:'industry',l:'Industry' },{ k:'status',l:'Status' },{ k:'city',l:'City' },{ k:'country',l:'Country' },{ k:'owner',l:'Owner' },{ k:'created_at',l:'Created Date',t:'date' }],
  leads:         [{ k:'name',l:'Name' },{ k:'customer',l:'Customer' },{ k:'source',l:'Source' },{ k:'amount',l:'Amount',t:'currency' },{ k:'status',l:'Status' },{ k:'owner',l:'Owner' },{ k:'created_at',l:'Created Date',t:'date' }],
  opportunities: [{ k:'name',l:'Name' },{ k:'customer',l:'Customer' },{ k:'stage',l:'Stage' },{ k:'amount',l:'Amount',t:'currency' },{ k:'status',l:'Status' },{ k:'closeDate',l:'Close Date',t:'date' },{ k:'owner',l:'Owner' },{ k:'created_at',l:'Created Date',t:'date' }],
  orders:        [{ k:'name',l:'Name' },{ k:'customer',l:'Customer' },{ k:'amount',l:'Amount',t:'currency' },{ k:'status',l:'Status' },{ k:'currency',l:'Currency' },{ k:'payment_terms',l:'Payment Terms' },{ k:'deliveryDate',l:'Delivery Date',t:'date' },{ k:'owner',l:'Owner' },{ k:'created_at',l:'Created Date',t:'date' }],
  invoices:      [{ k:'name',l:'Name' },{ k:'customer',l:'Customer' },{ k:'amount',l:'Amount',t:'currency' },{ k:'status',l:'Status' },{ k:'dueDate',l:'Due Date',t:'date' },{ k:'payment_terms',l:'Payment Terms' },{ k:'owner',l:'Owner' },{ k:'created_at',l:'Created Date',t:'date' }],
  contacts:      [{ k:'name',l:'Name' },{ k:'customer',l:'Company' },{ k:'designation',l:'Designation' },{ k:'department',l:'Department' },{ k:'email',l:'Email' },{ k:'status',l:'Status' },{ k:'owner',l:'Owner' },{ k:'created_at',l:'Created Date',t:'date' }],
  activities:    [{ k:'name',l:'Name' },{ k:'customer',l:'Customer' },{ k:'activityType',l:'Type' },{ k:'activityDate',l:'Date',t:'date' },{ k:'status',l:'Status' },{ k:'owner',l:'Owner' },{ k:'created_at',l:'Created Date',t:'date' }],
  quotations:    [{ k:'quote_number',l:'Quote #' },{ k:'name',l:'Name' },{ k:'customer',l:'Customer' },{ k:'status',l:'Status' },{ k:'grand_total',l:'Grand Total',t:'currency' },{ k:'currency',l:'Currency' },{ k:'validity_date',l:'Validity',t:'date' },{ k:'owner',l:'Owner' },{ k:'created_at',l:'Created Date',t:'date' }],
  products:      [{ k:'name',l:'Name' },{ k:'category',l:'Category' },{ k:'productFamily',l:'Product Family' },{ k:'price',l:'Price',t:'currency' },{ k:'status',l:'Status' },{ k:'created_at',l:'Created Date',t:'date' }],
};

const OBJECTS = ['customers','leads','opportunities','orders','invoices','contacts','activities','quotations','products'];
const CHART_TYPES = [{ v:'none',l:'Table Only' },{ v:'bar',l:'Bar Chart' },{ v:'line',l:'Line Chart' },{ v:'pie',l:'Pie / Donut' }];
const COLORS = ['#0F172A','#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316','#64748B'];
const DATE_RANGES = [{ v:'',l:'All Time' },{ v:'today',l:'Today' },{ v:'week',l:'This Week' },{ v:'month',l:'This Month' },{ v:'quarter',l:'This Quarter' },{ v:'year',l:'This Year' },{ v:'last30',l:'Last 30 Days' },{ v:'last90',l:'Last 90 Days' }];

const applyDateRange = (records, range) => {
  if (!range) return records;
  const now = new Date(); const sod = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  let start;
  if (range==='today')   start = sod;
  else if (range==='week')    start = new Date(sod - sod.getDay()*86400000);
  else if (range==='month')   start = new Date(now.getFullYear(),now.getMonth(),1);
  else if (range==='quarter') start = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1);
  else if (range==='year')    start = new Date(now.getFullYear(),0,1);
  else if (range==='last30')  start = new Date(now-30*86400000);
  else if (range==='last90')  start = new Date(now-90*86400000);
  return records.filter(r => !r.created_at || new Date(r.created_at) >= start);
};

const formatVal = (val, fieldDef) => {
  if (!val && val !== 0) return '-';
  if (fieldDef?.t === 'currency') return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(val);
  if (fieldDef?.t === 'date') return val ? new Date(val).toLocaleDateString('en-IN') : '-';
  return String(val);
};

export default function FastReportsPage() {
  const { customers, leads, opportunities, orders, invoices, contacts, activities, quotations, products, reports, saveReport, deleteReport, fetchReports, currentUser } = useApp();

  // Config state
  const [objType,    setObjType]    = useState('opportunities');
  const [columns,    setColumns]    = useState(['name','customer','stage','amount','status','owner']);
  const [statusFilter,setStatusFilter] = useState('');
  const [ownerFilter, setOwnerFilter]  = useState('');
  const [dateRange,   setDateRange]    = useState('');
  const [groupBy,     setGroupBy]      = useState('status');
  const [chartType,   setChartType]    = useState('bar');
  const [chartField,  setChartField]   = useState('status');
  const [reportName,  setReportName]   = useState('');
  const [isPublic,    setIsPublic]     = useState(false);
  const [saving,      setSaving]       = useState(false);
  const [activeTab,   setActiveTab]    = useState('table'); // table | chart
  const [savedView,   setSavedView]    = useState('mine'); // mine | public
  const [loadedId,    setLoadedId]     = useState(null);

  const fields = OBJECT_FIELDS[objType] || [];

  // Get raw data for selected object
  const getRawData = () => {
    const map = { customers,leads,opportunities,orders,invoices,contacts,activities,quotations,products };
    return map[objType] || [];
  };

  // Apply filters
  const filteredData = useMemo(() => {
    let data = getRawData();
    if (statusFilter) data = data.filter(r => r.status === statusFilter);
    if (ownerFilter)  data = data.filter(r => r.owner === ownerFilter || r.owner_id === ownerFilter);
    data = applyDateRange(data, dateRange);
    return data;
  }, [objType, statusFilter, ownerFilter, dateRange, customers, leads, opportunities, orders, invoices, contacts, activities, quotations, products]);

  // Group data for charts
  const groupedData = useMemo(() => {
    if (!groupBy || !chartField) return [];
    const groups = {};
    filteredData.forEach(r => {
      const key = r[groupBy] || 'Unknown';
      if (!groups[key]) groups[key] = { label: key, count: 0, total: 0 };
      groups[key].count++;
      const numField = fields.find(f=>f.k===chartField && f.t==='currency');
      if (numField) groups[key].total += Number(r[chartField]||0);
    });
    return Object.values(groups).sort((a,b) => b.count - a.count);
  }, [filteredData, groupBy, chartField]);

  // Status options for filter
  const statusOptions = useMemo(() => [...new Set(getRawData().map(r=>r.status).filter(Boolean))], [objType, customers, leads, opportunities, orders, invoices, contacts, activities, quotations, products]);

  // Toggle column
  const toggleCol = (k) => setColumns(prev => prev.includes(k) ? prev.filter(c=>c!==k) : [...prev,k]);

  // Load saved report
  const loadReport = (r) => {
    setObjType(r.object_type);
    setColumns(r.columns || []);
    const f = r.filters || {};
    setStatusFilter(f.status || '');
    setOwnerFilter(f.owner || '');
    setDateRange(f.dateRange || '');
    setGroupBy(r.grouping || 'status');
    setChartType(r.chart_type || 'bar');
    setChartField(r.chart_field || 'status');
    setReportName(r.name);
    setIsPublic(r.is_public || false);
    setLoadedId(r.id);
  };

  // Save
  const handleSave = async () => {
    if (!reportName.trim()) { alert('Enter a report name.'); return; }
    setSaving(true);
    await saveReport({ id: loadedId, name: reportName, object_type: objType, columns, filters:{ status: statusFilter, owner: ownerFilter, dateRange }, grouping: groupBy, chart_type: chartType, chart_field: chartField, is_public: isPublic });
    setSaving(false);
    alert('Report saved!');
  };

  // CSV Export
  const exportCSV = () => {
    const headers = columns.map(k => fields.find(f=>f.k===k)?.l || k);
    const rows = filteredData.map(r => columns.map(k => {
      const fd = fields.find(f=>f.k===k);
      const v = r[k];
      if (fd?.t === 'date') return v ? new Date(v).toLocaleDateString('en-IN') : '';
      return v ?? '';
    }));
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`${reportName||objType}_report.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const myReports     = reports.filter(r => r.created_by === currentUser?.email);
  const publicReports = reports.filter(r => r.is_public && r.created_by !== currentUser?.email);

  const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[28px] p-6 text-white flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">⚡ Fast Reports</h1><p className="text-blue-200 mt-1">Build, visualize, and export reports from any data object</p></div>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm shadow-lg flex items-center gap-2">📊 Export CSV</button>
          <button onClick={handleSave} disabled={saving} className="bg-white text-[#0F172A] px-5 py-2.5 rounded-2xl font-bold text-sm shadow-lg hover:bg-blue-50 disabled:opacity-50">
            {saving ? '💾 Saving...' : '💾 Save Report'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* ── Left: Config panel ── */}
        <div className="xl:col-span-1 space-y-4">

          {/* Report name + visibility */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow p-5 space-y-3">
            <h3 className="font-bold text-[#0F172A]">Report Settings</h3>
            <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Report Name</label><input value={reportName} onChange={e=>setReportName(e.target.value)} placeholder="e.g. Monthly Pipeline" className={sCls}/></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isPublic} onChange={e=>setIsPublic(e.target.checked)} className="w-4 h-4 accent-blue-600"/>
              <span className="text-sm text-[#0F172A]">Share with all users</span>
            </label>
          </div>

          {/* Object selector */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow p-5 space-y-3">
            <h3 className="font-bold text-[#0F172A]">Data Object</h3>
            <div className="grid grid-cols-2 gap-2">
              {OBJECTS.map(o=>(
                <button key={o} onClick={()=>{setObjType(o);setColumns(OBJECT_FIELDS[o]?.slice(0,5).map(f=>f.k)||[]);setStatusFilter('');setGroupBy('status');setChartField('status');}}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${objType===o?'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white shadow':'bg-gray-50 text-gray-600 hover:bg-blue-50 border border-gray-100'}`}>
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow p-5 space-y-3">
            <h3 className="font-bold text-[#0F172A]">Filters</h3>
            <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Status</label><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className={sCls}><option value="">All Statuses</option>{statusOptions.map(s=><option key={s}>{s}</option>)}</select></div>
            <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Date Range</label><select value={dateRange} onChange={e=>setDateRange(e.target.value)} className={sCls}>{DATE_RANGES.map(d=><option key={d.v} value={d.v}>{d.l}</option>)}</select></div>
          </div>

          {/* Columns */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow p-5 space-y-2">
            <h3 className="font-bold text-[#0F172A] mb-3">Columns</h3>
            {fields.map(f=>(
              <label key={f.k} className="flex items-center gap-2 cursor-pointer py-1 hover:bg-blue-50 rounded-lg px-1">
                <input type="checkbox" checked={columns.includes(f.k)} onChange={()=>toggleCol(f.k)} className="w-4 h-4 accent-blue-600"/>
                <span className="text-sm text-[#0F172A]">{f.l}</span>
              </label>
            ))}
          </div>

          {/* Chart config */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow p-5 space-y-3">
            <h3 className="font-bold text-[#0F172A]">Visualisation</h3>
            <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Chart Type</label><select value={chartType} onChange={e=>setChartType(e.target.value)} className={sCls}>{CHART_TYPES.map(c=><option key={c.v} value={c.v}>{c.l}</option>)}</select></div>
            <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Group By</label><select value={groupBy} onChange={e=>setGroupBy(e.target.value)} className={sCls}><option value="">No grouping</option>{fields.map(f=><option key={f.k} value={f.k}>{f.l}</option>)}</select></div>
            {groupBy && <div><label className="text-xs font-bold uppercase text-gray-400 block mb-1.5">Measure</label><select value={chartField} onChange={e=>setChartField(e.target.value)} className={sCls}><option value="">Count</option>{fields.filter(f=>f.t==='currency').map(f=><option key={f.k} value={f.k}>{f.l}</option>)}</select></div>}
          </div>
        </div>

        {/* ── Right: Preview + Chart ── */}
        <div className="xl:col-span-3 space-y-4">
          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { l:'Total Records',  v: filteredData.length,  icon:'📋' },
              { l:'With Amount',    v: filteredData.filter(r=>Number(r.amount||r.grand_total||r.price||0)>0).length, icon:'💰' },
              { l:'Total Value',    v: new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(filteredData.reduce((s,r)=>s+Number(r.amount||r.grand_total||r.price||0),0)), icon:'📈' },
              { l:'Groups',         v: groupedData.length,   icon:'🗂️' },
            ].map(stat=>(
              <div key={stat.l} className="bg-white rounded-2xl border border-blue-100 shadow p-4 flex items-center gap-3">
                <span className="text-2xl">{stat.icon}</span>
                <div><div className="text-lg font-bold text-[#0F172A]">{stat.v}</div><div className="text-xs text-gray-400">{stat.l}</div></div>
              </div>
            ))}
          </div>

          {/* Table/Chart tabs */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-blue-50">
              <div className="flex gap-2">
                {[{k:'table',l:'📋 Table'},{k:'chart',l:'📊 Chart'}].map(t=>(
                  <button key={t.k} onClick={()=>setActiveTab(t.k)}
                    className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab===t.k?'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white shadow':'text-gray-500 hover:bg-blue-50'}`}>
                    {t.l}
                  </button>
                ))}
              </div>
              <div className="text-sm text-gray-400">{filteredData.length} records · {columns.length} columns</div>
            </div>

            {activeTab === 'table' && (
              <div className="overflow-x-auto" style={{maxHeight:'50vh',overflowY:'auto'}}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gradient-to-r from-[#0F172A] to-blue-900 text-white">
                    <tr>{columns.map(k=>{const f=fields.find(x=>x.k===k);return <th key={k} className="px-5 py-3 text-left font-semibold whitespace-nowrap">{f?.l||k}</th>;})}</tr>
                  </thead>
                  <tbody>
                    {filteredData.length===0
                      ? <tr><td colSpan={columns.length} className="px-5 py-12 text-center text-gray-400">No records match the current filters.</td></tr>
                      : filteredData.map((row,i)=>(
                        <tr key={row.id||i} className="border-t border-blue-50 hover:bg-blue-50/40">
                          {columns.map(k=>{
                            const fd = fields.find(f=>f.k===k);
                            const v  = row[k];
                            return (
                              <td key={k} className="px-5 py-3 text-[#0F172A]">
                                {fd?.t==='currency'
                                  ? <span className="font-semibold">{v?new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(v):'-'}</span>
                                  : fd?.t==='date' ? <span className="text-gray-500">{v?new Date(v).toLocaleDateString('en-IN'):'-'}</span>
                                  : k==='status'   ? <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{v||'-'}</span>
                                  : <span>{v||'-'}</span>
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
            )}

            {activeTab === 'chart' && (
              <div className="p-6">
                {groupedData.length === 0
                  ? <div className="text-center py-12 text-gray-400">Set Group By to see chart</div>
                  : (
                    <ResponsiveContainer width="100%" height={380}>
                      {chartType === 'pie' ? (
                        <PieChart>
                          <Pie data={groupedData} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={140} innerRadius={60} label={({label,percent})=>`${label} (${(percent*100).toFixed(0)}%)`}>
                            {groupedData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                          </Pie>
                          <Tooltip formatter={(v,n,p)=>[`${v} records`,p.payload.label]}/>
                          <Legend/>
                        </PieChart>
                      ) : chartType === 'line' ? (
                        <LineChart data={groupedData} margin={{top:5,right:30,left:20,bottom:5}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                          <XAxis dataKey="label" tick={{fontSize:12}}/>
                          <YAxis tick={{fontSize:12}}/>
                          <Tooltip/>
                          <Legend/>
                          <Line type="monotone" dataKey="count" stroke="#0F172A" strokeWidth={2} dot={{fill:'#0F172A',r:4}}/>
                          {chartField && <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} dot={{fill:'#3B82F6',r:4}}/>}
                        </LineChart>
                      ) : (
                        <BarChart data={groupedData} margin={{top:5,right:30,left:20,bottom:5}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                          <XAxis dataKey="label" tick={{fontSize:12}}/>
                          <YAxis tick={{fontSize:12}}/>
                          <Tooltip cursor={{fill:'#F1F5F9'}}/>
                          <Legend/>
                          <Bar dataKey="count" name="Count" fill="#0F172A" radius={[6,6,0,0]}>
                            {groupedData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                          </Bar>
                          {chartField && <Bar dataKey="total" name="Total Value" fill="#3B82F6" radius={[6,6,0,0]}/>}
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  )
                }
              </div>
            )}
          </div>

          {/* Saved Reports */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-blue-50 flex items-center justify-between">
              <h3 className="font-bold text-[#0F172A]">Saved Reports</h3>
              <div className="flex gap-2">
                {[{k:'mine',l:'My Reports'},{k:'public',l:'Shared'}].map(t=>(
                  <button key={t.k} onClick={()=>setSavedView(t.k)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${savedView===t.k?'bg-[#0F172A] text-white':'text-gray-500 hover:bg-blue-50'}`}>
                    {t.l} ({t.k==='mine'?myReports.length:publicReports.length})
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              {(savedView==='mine' ? myReports : publicReports).length === 0
                ? <div className="text-center py-8 text-gray-400 text-sm">No {savedView==='mine'?'saved':'shared'} reports yet.</div>
                : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(savedView==='mine' ? myReports : publicReports).map(r=>(
                      <div key={r.id} className="bg-gray-50 rounded-2xl p-4 border border-blue-100 hover:border-blue-300 transition-all">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-semibold text-[#0F172A] text-sm">{r.name}</div>
                            <div className="text-xs text-gray-400 capitalize mt-0.5">{r.object_type} · {r.chart_type||'table'}</div>
                          </div>
                          {r.is_public && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">Shared</span>}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={()=>loadReport(r)} className="flex-1 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-2 rounded-xl text-xs font-bold hover:opacity-90">Load</button>
                          {r.created_by === currentUser?.email && <button onClick={()=>deleteReport(r.id)} className="bg-red-100 text-red-500 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-red-200">Delete</button>}
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
