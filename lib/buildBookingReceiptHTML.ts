// @ts-nocheck
// Booking receipts now render through the shared Document Canvas engine
// (lib/documentCanvas.ts). This file is kept so existing imports keep working.
export { buildBookingReceiptHTML, SAMPLE_ORDER, SAMPLE_LINE_ITEMS } from '@/lib/documentCanvas';
