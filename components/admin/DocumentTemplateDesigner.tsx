// @ts-nocheck
'use client';
// Quotation / B2B Invoice template designer — rebuilt on the shared Document
// Canvas designer. docType: 'quote' (quotations) | 'invoice' (B2B invoices).
import DocumentCanvasDesigner from '@/components/admin/DocumentCanvasDesigner';
export default function DocumentTemplateDesigner({ docType = 'quote' }) {
  return <DocumentCanvasDesigner docType={docType === 'invoice' ? 'b2b_invoice' : 'quotation'} />;
}
