// @ts-nocheck
'use client';

/**
 * generateInvoicePdf
 * Converts an already-built invoice/receipt HTML string (the same HTML
 * buildRetailPrintHTML produces for browser printing) into an actual PDF
 * file, entirely client-side. Needed because buildRetailPrintHTML only
 * ever produced HTML for a browser's native print dialog - there was no
 * way to get real PDF bytes to attach to a WhatsApp message.
 *
 * Approach: render the HTML into a hidden, off-screen container so the
 * browser actually lays it out and paints it, capture that with
 * html2canvas (turns the rendered DOM into a bitmap), then place that
 * bitmap into a jsPDF document sized to match the template's paper size.
 * This is an image-based PDF (not selectable text) - acceptable for a
 * document meant to be viewed/printed, not searched or copy-pasted from.
 */
export async function generateInvoicePdf(html: string, paperSize: string = 'a4'): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');

  // Paper dimensions in mm, matching the same paper size concept used by
  // the invoice designer. Thermal receipts don't have a fixed height (they
  // print as a continuous roll) - use a generous fixed height and let the
  // content simply not fill the rest of the page.
  const PAPER_MM: Record<string, { w: number; h: number }> = {
    a4: { w: 210, h: 297 }, a5: { w: 148, h: 210 }, letter: { w: 216, h: 279 }, legal: { w: 216, h: 356 },
    thermal_80: { w: 80, h: 297 }, thermal_58: { w: 58, h: 297 },
  };
  const dims = PAPER_MM[paperSize] || PAPER_MM.a4;

  // Render into a hidden, off-screen container - not display:none, since
  // browsers don't lay out or paint anything with display:none, and
  // html2canvas needs a real, rendered element to capture. Positioned far
  // off-screen instead, so it's invisible without ever being "not there."
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${dims.w}mm`;
  container.style.background = '#ffffff';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    // Let the browser complete layout/paint before capturing - a capture
    // fired on the very next tick can sometimes grab an unlaid-out frame.
    await new Promise(resolve => setTimeout(resolve, 50));

    const canvas = await html2canvas(container, {
      scale: 2, // higher resolution output, since WhatsApp/PDF viewers will zoom
      useCORS: true, // allows a tenant's own logo image (if hosted elsewhere) to be captured
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [dims.w, dims.h],
    });

    // Scale the captured image to fit the page width, and paginate onto
    // additional pages if the content is taller than one page - a longer
    // invoice with many line items shouldn't just get cut off.
    const imgWidthMm = dims.w;
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;
    let heightLeft = imgHeightMm;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidthMm, imgHeightMm);
    heightLeft -= dims.h;

    while (heightLeft > 0) {
      position = heightLeft - imgHeightMm;
      pdf.addPage([dims.w, dims.h]);
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidthMm, imgHeightMm);
      heightLeft -= dims.h;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}

// Converts a Blob to a base64 string (without the data: URL prefix) -
// needed since the upload-media API route accepts JSON, not multipart
// form data directly from the browser.
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
