// @ts-nocheck
'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';
import { useAlert } from '@/components/shared/AlertProvider';
import { formatDate, formatDisplayNumber } from '@/lib/utils';
import SearchableSelect from '@/components/shared/SearchableSelect';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Timezone-safe date formatting — deliberately does NOT use
// d.toISOString(), which converts to UTC before formatting and silently
// shifts the date by a day for any timezone ahead of UTC (e.g. IST):
// local midnight on the 22nd becomes 18:30 UTC on the 21st, so
// toISOString().slice(0,10) would return '...-21' for a cell visually
// showing "22". Using local getters directly avoids any UTC conversion, so
// this always matches what's actually displayed on the calendar.
function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function daysBetween(startISO, endISO) {
  const [y1,m1,d1] = startISO.split('-').map(Number);
  const [y2,m2,d2] = endISO.split('-').map(Number);
  return Math.round((Date.UTC(y2,m2-1,d2) - Date.UTC(y1,m1-1,d1)) / 86400000) + 1;
}

export default function RentalBookingCalendar({ productId, productName, productPrice, onClose, variant = 'modal' }) {
  const { retailCustomers, createRetailRecord, currentUser } = useApp();
  const { supabase, tenant } = useTenant();
  const { showAlert } = useAlert();
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // ── New-booking flow state ──────────────────────────────────────────────
  // Two-click range selection, directly on the calendar — click a start
  // date, click an end date. No separate form fields to fill in for dates.
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [rangeConflict, setRangeConflict] = useState(null); // { message } | null
  const [checkingRange, setCheckingRange] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [creating, setCreating] = useState(false);
  const [successResult, setSuccessResult] = useState(null); // created order record, once created

  const monthStart = monthCursor;
  const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
  const hasRange = !!(rangeStart && rangeEnd);

  const resetSelection = () => {
    setRangeStart(null); setRangeEnd(null); setRangeConflict(null);
    setCustomerId(''); setCustomerName('');
  };

  const reload = () => setMonthCursor(d => new Date(d));

  useEffect(() => {
    if (!supabase || !productId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Only fetch bookings that could possibly overlap the visible month
      // (plus a one-month buffer on each side, so a booking that starts in
      // the prior month but extends into this one still shows correctly) —
      // not every booking this product has ever had. Keeps this fast
      // regardless of how much booking history a popular item accumulates.
      const bufferStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
      const bufferEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 2, 0);
      let q = supabase.from('retail_order_line_items')
        .select('order_number, rental_start_date, rental_end_date, product_name, is_blocking')
        .eq('product_id', productId)
        .eq('is_blocking', true)
        .lte('rental_start_date', toISO(bufferEnd))
        .gte('rental_end_date', toISO(bufferStart))
        .order('rental_start_date', { ascending: true })
        .limit(500);
      const tid = tenant?.id;
      if (tid) q = q.eq('tenant_id', tid);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) { console.error('[RentalBookingCalendar]', error.message); setBookings([]); setLoading(false); return; }

      const orderNumbers = [...new Set((data || []).map(b => b.order_number))];
      let ordersByNumber = {};
      if (orderNumbers.length) {
        let oq = supabase.from('retail_orders').select('order_number, status, customer_id, customer, display_number').in('order_number', orderNumbers);
        if (tid) oq = oq.eq('tenant_id', tid);
        const { data: orders } = await oq;
        (orders || []).forEach(o => { ordersByNumber[o.order_number] = o; });
      }
      const enriched = (data || []).map(b => {
        const order = ordersByNumber[b.order_number];
        const customer = order ? retailCustomers.find(c => c._uuid === order.customer_id || c.id === order.customer_id) : null;
        // Fall back to the order's own stored customer name if the ID-based
        // lookup fails — the name is genuinely there on the order record
        // regardless of whether the id link resolved, so "Unknown Customer"
        // was needlessly discarding information that was already available.
        return {
          ...b,
          order_status: order?.status,
          customer_name: customer?.name || order?.customer || 'Unknown Customer',
          display_order_number: order?.display_number ? formatDisplayNumber('RORD', order.display_number) : b.order_number,
        };
      });
      setBookings(enriched);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [supabase, productId, monthStart.getTime()]);

  // Build the calendar as WEEK ROWS (not a flat day grid) — this is what
  // makes spanning multi-day bars possible, the same technique Google
  // Calendar/Outlook's month view uses.
  const weeks = useMemo(() => {
    const firstWeekday = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();
    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [monthStart.getTime()]);

  // Confirmed-booking bars for a week — since this calendar is scoped to ONE
  // product, and the database's exclusion constraint makes overlapping
  // bookings for the same product structurally impossible, there's never
  // more than one confirmed bar per day — no stacking/lane logic needed.
  const barsForWeek = (weekCells) => {
    const validDays = weekCells.filter(Boolean);
    if (!validDays.length) return [];
    const weekStartISO = toISO(validDays[0]);
    const weekEndISO = toISO(validDays[validDays.length - 1]);
    return bookings
      .filter(b => b.rental_start_date <= weekEndISO && b.rental_end_date >= weekStartISO)
      .map(b => {
        const barStartISO = b.rental_start_date > weekStartISO ? b.rental_start_date : weekStartISO;
        const barEndISO = b.rental_end_date < weekEndISO ? b.rental_end_date : weekEndISO;
        const startCol = weekCells.findIndex(d => d && toISO(d) === barStartISO);
        const endCol = weekCells.findIndex(d => d && toISO(d) === barEndISO);
        if (startCol === -1 || endCol === -1) return null;
        return { booking: b, startCol, span: endCol - startCol + 1, isStart: b.rental_start_date === barStartISO, isEnd: b.rental_end_date === barEndISO };
      })
      .filter(Boolean);
  };

  const todayISO = toISO(new Date());
  const isInSelectedRange = (day) => {
    if (!day || !rangeStart) return false;
    const iso = toISO(day);
    const endISO = rangeEnd ? toISO(rangeEnd) : toISO(rangeStart);
    return iso >= toISO(rangeStart) && iso <= endISO;
  };

  const handleDayClick = (day) => {
    if (successResult) return; // no-op on the success screen
    const iso = toISO(day);
    if (!rangeStart || (rangeStart && rangeEnd)) {
      // Starting a fresh selection — either nothing picked yet, or a
      // complete range was already picked and this click starts over.
      setRangeStart(day); setRangeEnd(null); setRangeConflict(null);
      return;
    }
    // Second click — completes the range. Forgiving of clicking "backwards"
    // (before the first-picked date): the earlier date always becomes start.
    const startISO = toISO(rangeStart);
    const finalStart = iso < startISO ? day : rangeStart;
    const finalEnd = iso < startISO ? rangeStart : day;
    setRangeStart(finalStart); setRangeEnd(finalEnd);
    runAvailabilityCheck(toISO(finalStart), toISO(finalEnd));
  };

  // Runs the real availability check the moment a full range is selected —
  // before the customer is even chosen, so a conflict is caught immediately
  // rather than after filling out an entire form. This mirrors the same
  // query the line-item grid's live check and the server-side pre-check use.
  const runAvailabilityCheck = async (startISO, endISO) => {
    setCheckingRange(true);
    setRangeConflict(null);
    if (!supabase) { setCheckingRange(false); return; }
    const tid = tenant?.id;
    let q = supabase.from('retail_order_line_items')
      .select('order_number')
      .eq('product_id', productId)
      .eq('is_blocking', true)
      .lte('rental_start_date', endISO)
      .gte('rental_end_date', startISO)
      .limit(1);
    if (tid) q = q.eq('tenant_id', tid);
    const { data, error } = await q;
    setCheckingRange(false);
    if (error) { setRangeConflict({ message: 'Could not verify availability — please try again.' }); return; }
    if (data && data.length) {
      const rawOrderNumber = data[0].order_number;
      let displayOrder = rawOrderNumber;
      try {
        const { data: ord } = await supabase.from('retail_orders').select('display_number').eq('order_number', rawOrderNumber).eq('tenant_id', tid).maybeSingle();
        if (ord?.display_number) displayOrder = formatDisplayNumber('RORD', ord.display_number);
      } catch (e) { /* fall back to raw order_number */ }
      setRangeConflict({ message: `Already booked by order ${displayOrder} for an overlapping date range.` });
    }
  };

  const submitBooking = async () => {
    if (!customerId) { showAlert('Select a customer.', { variant:'warning' }); return; }
    if (!hasRange) { showAlert('Select a date range on the calendar.', { variant:'warning' }); return; }
    const customer = retailCustomers.find(c => (c._uuid || c.id) === customerId);
    setCreating(true);
    const startISO = toISO(rangeStart), endISO = toISO(rangeEnd);
    const result = await createRetailRecord('retailOrders', {
      customer_id: customerId,
      customer: customerName,
      customer_phone: customer?.phone || '',
      status: 'Draft',
      owner: currentUser?.email || '',
      order_date: toISO(new Date()),
    }, [{
      product_name: productName,
      product_id: productId,
      quantity: 1,
      unit_price: productPrice || 0,
      list_price: productPrice || 0,
      discount_pct: 0,
      rental_start_date: startISO,
      rental_end_date: endISO,
      custom_data: {},
    }]);
    setCreating(false);
    if (result) {
      setSuccessResult(result);
      reload();
    }
    // On failure (including a real conflict caught by the server-side check
    // as the final safety net), createRetailRecord already shows a specific
    // alert — nothing more to do here.
  };

  const viewOrder = () => {
    if (!successResult) return;
    window.dispatchEvent(new CustomEvent('open-record', { detail: { page: 'retailOrders', record: successResult } }));
    onClose?.();
  };

  const openSelectedBookingOrder = async () => {
    if (!selectedBooking || !supabase) return;
    const tid = tenant?.id;
    let q = supabase.from('retail_orders').select('*').eq('order_number', selectedBooking.order_number);
    if (tid) q = q.eq('tenant_id', tid);
    const { data: row, error } = await q.maybeSingle();
    if (error || !row) { showAlert('Could not open this order.', { variant:'danger' }); return; }
    const record = { ...row, id: row.order_number, _uuid: row.id };
    window.dispatchEvent(new CustomEvent('open-record', { detail: { page: 'retailOrders', record } }));
    onClose?.();
  };

  const bookAnother = () => {
    setSuccessResult(null);
    resetSelection();
  };

  const isModal = variant === 'modal';
  const Wrapper = isModal
    ? ({ children }) => (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {children}
          </div>
        </div>
      )
    : ({ children }) => (
        <div className="bg-white rounded-[28px] border border-gray-200 shadow-sm w-full overflow-hidden flex flex-col">
          {children}
        </div>
      );

  return (
    <Wrapper>
        <div className="bg-gradient-to-r from-purple-900 to-purple-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-white font-bold text-lg">📅 Booking Calendar</h3>
            <p className="text-purple-200 text-sm">{productName}</p>
          </div>
          {isModal && <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>}
        </div>

        {successResult ? (
          // ── Success state ──────────────────────────────────────────────
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl mb-4">✓</div>
            <h3 className="text-xl font-bold text-[#0F172A] mb-1">Booking Confirmed</h3>
            <p className="text-gray-500 text-sm mb-1">Order <span className="font-mono font-bold text-purple-700">{successResult.display_number ? formatDisplayNumber('RORD', successResult.display_number) : successResult.id}</span> created for {customerName}</p>
            <p className="text-gray-400 text-xs mb-6">{formatDate(toISO(rangeStart))} – {formatDate(toISO(rangeEnd))} · {productName}</p>
            <div className="flex items-center gap-3">
              <button onClick={bookAnother} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">
                + Book Another
              </button>
              <button onClick={viewOrder} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-purple-900 text-white text-sm font-bold hover:opacity-90">
                View Order {successResult.display_number ? formatDisplayNumber('RORD', successResult.display_number) : successResult.id} →
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 flex-shrink-0">
              <button onClick={() => setMonthCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600">‹</button>
              <span className="font-bold text-[#0F172A] text-lg">{MONTH_NAMES[monthStart.getMonth()]} {monthStart.getFullYear()}</span>
              <button onClick={() => setMonthCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600">›</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="py-16 text-center text-gray-400 text-sm">Loading bookings…</div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-3">
                    {!rangeStart ? '👆 Click a date to start a new booking.' :
                     !rangeEnd ? '👆 Now click the last day of the rental to complete the range.' :
                     'Range selected — confirm the booking below, or click any date to start over.'}
                  </p>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                      <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase py-1">{d}</div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    {weeks.map((weekCells, wi) => {
                      const bars = barsForWeek(weekCells);
                      return (
                        <div key={wi} className="relative border border-gray-100 rounded-xl overflow-hidden" style={{ minHeight: 68 }}>
                          <div className="grid grid-cols-7">
                            {weekCells.map((day, di) => {
                              const isToday = day && toISO(day) === todayISO;
                              const isPast = day && toISO(day) < todayISO;
                              const inRange = isInSelectedRange(day);
                              const isRangeEdge = day && rangeStart && (toISO(day) === toISO(rangeStart) || (rangeEnd && toISO(day) === toISO(rangeEnd)));
                              return (
                                <button key={di} disabled={!day || isPast}
                                  onClick={() => day && !isPast && handleDayClick(day)}
                                  title={!day ? '' : isPast ? 'Past dates cannot be booked' : 'Click to select this date'}
                                  className={`h-7 flex items-center justify-center text-xs font-semibold transition-all ${
                                    !day ? 'invisible' :
                                    isPast ? 'text-gray-300 cursor-not-allowed' :
                                    isRangeEdge ? 'bg-blue-600 text-white rounded-full mx-0.5' :
                                    inRange ? 'bg-blue-100 text-blue-800' :
                                    isToday ? 'text-blue-700' : 'text-gray-500 hover:bg-gray-50 hover:text-purple-700'
                                  }`}>
                                  {day?.getDate()}
                                </button>
                              );
                            })}
                          </div>
                          <div className="px-1 pb-1.5 space-y-1">
                            {bars.map(({ booking, startCol, span, isStart, isEnd }, bi) => (
                              <div key={bi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                                <button
                                  onClick={() => setSelectedBooking(booking)}
                                  className={`flex items-center h-6 text-[11px] font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-all px-2 truncate ${isStart ? 'rounded-l-md' : ''} ${isEnd ? 'rounded-r-md' : ''}`}
                                  style={{ gridColumn: `${startCol + 1} / span ${span}` }}>
                                  <span className="truncate">{isStart ? `👤 ${booking.customer_name}` : '···'}</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-600 inline-block"/> Confirmed booking</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block"/> Your selection</span>
                  </div>

                  {selectedBooking && (
                    <div className="mt-5 bg-purple-50 border border-purple-100 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#0F172A] text-sm">{selectedBooking.customer_name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Order {selectedBooking.display_order_number || selectedBooking.order_number} · {formatDate(selectedBooking.rental_start_date)} – {formatDate(selectedBooking.rental_end_date)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">{selectedBooking.order_status}</span>
                        <button onClick={openSelectedBookingOrder} className="text-xs font-bold px-3 py-1.5 rounded-full bg-purple-700 text-white hover:bg-purple-800">
                          Open Order →
                        </button>
                        <button onClick={() => setSelectedBooking(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Guided confirm bar — appears once a full range is picked ── */}
            {hasRange && (
              <div className="border-t border-gray-100 bg-gray-50 p-5 flex-shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[#0F172A] text-sm">
                    {formatDate(toISO(rangeStart))} – {formatDate(toISO(rangeEnd))}
                    <span className="text-gray-400 font-normal ml-2">({daysBetween(toISO(rangeStart), toISO(rangeEnd))} day{daysBetween(toISO(rangeStart), toISO(rangeEnd))>1?'s':''})</span>
                  </div>
                  <button onClick={resetSelection} className="text-xs text-gray-400 hover:text-gray-600 font-semibold">Clear selection</button>
                </div>

                {checkingRange && <p className="text-xs text-gray-500">Checking availability…</p>}
                {!checkingRange && rangeConflict && (
                  <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">⚠️ {rangeConflict.message}</p>
                )}
                {!checkingRange && !rangeConflict && (
                  <p className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">✓ Available for these dates</p>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <SearchableSelect
                      value={customerId}
                      onChange={(v) => {
                        const c = retailCustomers.find(x => (x._uuid || x.id) === v);
                        setCustomerName(c?.name || ''); setCustomerId(v);
                      }}
                      options={retailCustomers.map(c => ({ value: c._uuid || c.id, label: c.name, sub: c.phone || c.email || '' }))}
                      placeholder="Search customers to complete the booking..."
                    />
                  </div>
                  <button onClick={submitBooking} disabled={creating || checkingRange || !!rangeConflict || !customerId}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-purple-900 text-white text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                    {creating ? 'Creating…' : 'Create Booking'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
    </Wrapper>
  );
}
