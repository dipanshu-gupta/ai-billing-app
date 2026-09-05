// @ts-nocheck
'use client';
import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { THEMES } from '@/lib/i18n';
import RentalBookingCalendar from '@/components/retail/RentalBookingCalendar';
import BookingsDashboard from '@/components/retail/BookingsDashboard';
import SearchableSelect from '@/components/shared/SearchableSelect';

export default function ManageBookingsPage() {
  const { retailProducts, appearance, setPendingRecord } = useApp();
  const themeObj = THEMES.find(th => th.id === (appearance?.theme || 'navy')) || THEMES[0];
  const rentableProducts = useMemo(() => (retailProducts || []).filter(p => p.is_rentable && p.status !== 'Discontinued'), [retailProducts]);
  const [selectedProductId, setSelectedProductId] = useState('');

  const selectedProduct = rentableProducts.find(p => (p._uuid || p.id) === selectedProductId);

  const openOrderRecord = (orderRecord) => {
    console.log('[ManageBookingsPage] openOrderRecord called with:', orderRecord);
    if (!orderRecord) { console.warn('[ManageBookingsPage] orderRecord is missing — the dashboard could not resolve this booking\'s parent order.'); return; }
    // Same cross-page handoff mechanism already used for the Create Booking
    // button on activities - navigates to Retail Orders with this specific
    // record already set, so it opens directly in the detail panel there
    // instead of just jumping to the product's calendar.
    setPendingRecord({ page: 'retailOrders', record: orderRecord });
    window.dispatchEvent(new CustomEvent('retail-navigate', { detail: { page: 'retailOrders' } }));
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] p-6 text-white" style={{background:`linear-gradient(to right,${themeObj.colors[0]},${themeObj.colors[1]})`}}>
        <h2 className="text-2xl font-bold flex items-center gap-2">📆 Manage Bookings</h2>
        <p className="text-purple-200 text-sm mt-1">View and create rental bookings for any rentable product, without opening its record first.</p>
      </div>

      <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Select a product to view its booking calendar</label>
        {rentableProducts.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">
            No rentable products yet. Mark a product as rentable from its detail page (only shown when Rental mode is on) to see its calendar here.
          </p>
        ) : (
          <div className="max-w-md">
            <SearchableSelect
              value={selectedProductId}
              onChange={setSelectedProductId}
              options={rentableProducts.map(p => ({ value: p._uuid || p.id, label: p.name, sub: p.category || p.sku || '' }))}
              placeholder="Search rentable products..."
            />
          </div>
        )}
      </div>

      {selectedProduct ? (
        <RentalBookingCalendar
          key={selectedProductId /* remount cleanly when switching products, rather than reusing stale month/selection state */}
          productId={selectedProductId}
          productName={selectedProduct.name}
          productPrice={selectedProduct.price}
          variant="inline"
        />
      ) : (
        <BookingsDashboard onSelectProduct={setSelectedProductId} onOpenRecord={openOrderRecord} />
      )}
    </div>
  );
}
