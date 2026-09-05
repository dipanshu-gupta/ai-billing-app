// @ts-nocheck
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';
import { formatCurrency, formatDisplayNumber, withTimeout, tenantScope, todayLocalISO } from '@/lib/utils';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

/**
 * Booking Dashboard — fills what was previously a blank area on the Manage
 * Bookings page before a product is selected, giving an at-a-glance view
 * across ALL rentable products rather than nothing at all: upcoming
 * bookings, bookings currently in progress, and recently completed ones,
 * in a KPI + carousel + chart + table layout.
 */
export default function BookingsDashboard({ onSelectProduct, onOpenRecord }) {
  const { retailProducts, applyDataSecurity, currentUser, permissionsLoaded } = useApp();
  const { supabase, tenant } = useTenant();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming'); // 'upcoming' | 'inprogress' | 'completed'

  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    (async () => {
      try {
        let liQuery = tenantScope(supabase.from('retail_order_line_items').select('*').not('rental_start_date', 'is', null));
        const { data: lineItems, error } = await withTimeout(liQuery, 20000, 'Bookings dashboard fetch');
        if (error) { console.error('[BookingsDashboard] fetch', error.message); setRows([]); setLoading(false); return; }

        const orderNumbers = Array.from(new Set((lineItems || []).map(li => li.order_number).filter(Boolean)));
        const parentMap = {};
        const CHUNK = 300;
        for (let i = 0; i < orderNumbers.length; i += CHUNK) {
          const chunk = orderNumbers.slice(i, i + CHUNK);
          const { data: orders } = await tenantScope(supabase.from('retail_orders').select('*')).in('order_number', chunk);
          (orders || []).forEach(o => {
            // Shaped the same way the standard retailOrders list shapes each
            // record - needed so this is compatible with setSelectedRecord/
            // RetailDetailPanel when opening a record's details directly
            // from here, not just re-derivable fields for display.
            parentMap[o.order_number] = { ...o, id: o.order_number, _uuid: o.id, displayNumber: o.display_number };
          });
        }

        const merged = (lineItems || [])
          .map(li => {
            const parent = parentMap[li.order_number];
            if (!parent) return null; // orphaned line item — parent order missing/inaccessible, skip rather than show incomplete data
            return {
              ...li,
              order_display: parent.displayNumber ? formatDisplayNumber('RORD', parent.displayNumber) : li.order_number,
              customer: parent.customer || 'Unknown Customer',
              order_status: parent.status || 'Open',
              order_record: parent, // the full, properly-shaped parent record, for opening its detail page directly
            };
          })
          .filter(Boolean);

        const secured = applyDataSecurity ? applyDataSecurity(merged) : merged;
        setRows(secured || []);
      } catch (e) {
        console.error('[BookingsDashboard] fetch failed', e);
        setRows([]);
      }
      setLoading(false);
    })();
  }, [supabase, tenant?.id, currentUser, permissionsLoaded]);

  const today = todayLocalISO();
  const categorized = useMemo(() => {
    const upcoming = [], inprogress = [], completed = [];
    for (const r of rows) {
      if (!r.rental_start_date || !r.rental_end_date) continue;
      if (r.rental_start_date > today) upcoming.push(r);
      else if (r.rental_end_date < today) completed.push(r);
      else inprogress.push(r);
    }
    upcoming.sort((a, b) => a.rental_start_date.localeCompare(b.rental_start_date));
    inprogress.sort((a, b) => a.rental_end_date.localeCompare(b.rental_end_date));
    completed.sort((a, b) => b.rental_end_date.localeCompare(a.rental_end_date));
    return { upcoming, inprogress, completed: completed.slice(0, 50) }; // recent completed only, not the full history
  }, [rows, today]);

  const activeList = tab === 'upcoming' ? categorized.upcoming : tab === 'inprogress' ? categorized.inprogress : categorized.completed;

  const revenueThisMonth = useMemo(() => {
    const monthPrefix = today.slice(0, 7);
    return rows
      .filter(r => (r.rental_start_date || '').startsWith(monthPrefix))
      .reduce((s, r) => s + Number(r.extended_price || 0), 0);
  }, [rows, today]);

  if (loading) {
    return <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm py-24"><LoadingSpinner size={48} label="Loading bookings dashboard..." /></div>;
  }

  const totalActive = categorized.upcoming.length + categorized.inprogress.length;

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Upcoming', value: categorized.upcoming.length, icon: '📅', color: 'from-blue-500 to-blue-700' },
          { label: 'In Progress', value: categorized.inprogress.length, icon: '🔄', color: 'from-amber-500 to-orange-600' },
          { label: 'Completed (recent)', value: categorized.completed.length, icon: '✅', color: 'from-green-500 to-emerald-600' },
          { label: 'Revenue This Month', value: formatCurrency(revenueThisMonth), icon: '💰', color: 'from-purple-500 to-purple-700' },
        ].map(kpi => (
          <div key={kpi.label} className={`bg-gradient-to-br ${kpi.color} rounded-[20px] p-4 text-white shadow-lg`}>
            <div className="text-2xl mb-1">{kpi.icon}</div>
            <div className="text-2xl font-bold">{kpi.value}</div>
            <div className="text-xs text-white/80 font-semibold uppercase tracking-wide">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Status distribution — simple proportional bar, not a full chart library for a lightweight overview */}
      {totalActive + categorized.completed.length > 0 && (
        <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#0F172A] mb-3">📊 Booking Status Distribution</h3>
          <div className="flex h-8 rounded-xl overflow-hidden">
            {categorized.upcoming.length > 0 && <div className="bg-blue-500 flex items-center justify-center text-white text-xs font-bold" style={{ flex: categorized.upcoming.length }}>{categorized.upcoming.length}</div>}
            {categorized.inprogress.length > 0 && <div className="bg-amber-500 flex items-center justify-center text-white text-xs font-bold" style={{ flex: categorized.inprogress.length }}>{categorized.inprogress.length}</div>}
            {categorized.completed.length > 0 && <div className="bg-green-500 flex items-center justify-center text-white text-xs font-bold" style={{ flex: categorized.completed.length }}>{categorized.completed.length}</div>}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"/>Upcoming</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"/>In Progress</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"/>Completed</span>
          </div>
        </div>
      )}

      {/* Upcoming bookings — horizontally-scrollable 3D perspective carousel */}
      {categorized.upcoming.length > 0 && (
        <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#0F172A] mb-4">🔮 Upcoming Bookings</h3>
          <div className="booking-carousel" style={{ perspective: '1200px' }}>
            <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollSnapType: 'x mandatory' }}>
              {categorized.upcoming.slice(0, 20).map(r => {
                const daysUntil = Math.round((new Date(r.rental_start_date+'T00:00:00').getTime() - new Date(today+'T00:00:00').getTime()) / 86400000);
                return (
                  <div
                    key={r.id}
                    onClick={() => onOpenRecord?.(r.order_record)}
                    className="booking-card flex-shrink-0 w-56 bg-gradient-to-br from-slate-50 to-blue-50 border border-blue-100 rounded-[18px] p-4 cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition-all duration-300"
                    style={{ scrollSnapAlign: 'start', transformStyle: 'preserve-3d' }}
                  >
                    <div className="text-[10px] font-mono font-bold text-blue-400 mb-1">{r.order_display}</div>
                    <div className="font-bold text-[#0F172A] text-sm mb-2 truncate">{r.product_name}</div>
                    <div className="text-xs text-gray-500 mb-1">👤 {r.customer}</div>
                    <div className="text-xs text-gray-500 mb-2">📅 {r.rental_start_date} → {r.rental_end_date}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {daysUntil === 0 ? 'Starts today' : daysUntil === 1 ? 'Starts tomorrow' : `In ${daysUntil} days`}
                      </span>
                      <span className="text-xs font-bold text-[#0F172A]">{formatCurrency(r.extended_price || 0)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filterable table — all statuses */}
      <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[
            { v: 'upcoming', l: `Upcoming (${categorized.upcoming.length})` },
            { v: 'inprogress', l: `In Progress (${categorized.inprogress.length})` },
            { v: 'completed', l: `Recently Completed (${categorized.completed.length})` },
          ].map(t => (
            <button key={t.v} onClick={() => setTab(t.v)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${tab===t.v ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {t.l}
            </button>
          ))}
        </div>
        {activeList.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-2">📭</div>
            <div>No {tab === 'inprogress' ? 'bookings in progress' : tab} bookings right now.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase">Order #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase">Start</th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase">End</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase">Order Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeList.slice(0, 50).map(r => (
                  <tr key={r.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => onOpenRecord?.(r.order_record)}>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{r.order_display}</td>
                    <td className="px-4 py-3 font-semibold text-[#0F172A]">{r.product_name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.customer}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{r.rental_start_date}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{r.rental_end_date}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#0F172A]">{formatCurrency(r.extended_price || 0)}</td>
                    <td className="px-4 py-3 text-center"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{r.order_status}</span></td>
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
