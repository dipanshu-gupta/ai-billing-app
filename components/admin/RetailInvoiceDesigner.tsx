// @ts-nocheck
'use client';
// Retail Invoice Designer — rebuilt on the shared Document Canvas designer
// (same free-form canvas as the Booking Receipt designer; paper sizes A4, A5,
// Letter and thermal 80/58/57 are all still available under Page Setup).
import DocumentCanvasDesigner from '@/components/admin/DocumentCanvasDesigner';
export default function RetailInvoiceDesigner() { return <DocumentCanvasDesigner docType="retail_invoice" />; }
