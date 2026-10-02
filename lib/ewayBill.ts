// @ts-nocheck
// ─── E-Way Bill (India, B2B only) ──────────────────────────────────────────
// Builds the e-Way Bill "Part A" / "Part B" payload in the exact shape the
// government's e-Way Bill system (NIC) expects — the same JSON schema every
// ERP (Tally, SAP, Zoho, ClearTax…) uses, whether it's uploaded by hand at
// ewaybillgst.gov.in → "e-Way Bill" → "Bulk Generation" → "Prepare JSON", or
// pushed live through a GSP's API (NIC's "GenerateEWB" call). Nothing here
// is specific to any one GSP — buildEwaybillJSON() produces the standard
// EWB request body; generateViaDirectAPI() is a thin, swappable transport
// on top of it.
//
// This module is only ever imported from B2B order/invoice code paths
// (CPQRecordDetail.tsx, EwayBillModal.tsx) — retail has no GST/e-way bill
// concept in this app and never touches this file.

// Official GST state/UT codes (CBIC list). Used to (a) offer a state
// dropdown, (b) derive the 2-digit code from a party's GSTIN (its first two
// digits ARE the state code), and (c) decide CGST+SGST vs IGST — an e-way
// bill (like a GST invoice) splits tax as intra-state (from-state ==
// to-state → CGST+SGST) or inter-state (from-state != to-state → IGST).
export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman & Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh',
  '38': 'Ladakh', '97': 'Other Territory', '99': 'Centre Jurisdiction',
};
export const GST_STATE_OPTIONS = Object.entries(GST_STATE_CODES).map(([code, name]) => ({ code, name }));

export const stateCodeFromGstin = (gstin: string): string => {
  const digits = String(gstin || '').trim().slice(0, 2);
  return GST_STATE_CODES[digits] ? digits : '';
};

export const SUPPLY_TYPES = ['Outward', 'Inward'];
export const SUB_SUPPLY_TYPES = [
  { v: '1', l: 'Supply' }, { v: '2', l: 'Import' }, { v: '3', l: 'Export' },
  { v: '4', l: 'Job Work' }, { v: '5', l: 'For Own Use' }, { v: '6', l: 'Job Work Returns' },
  { v: '7', l: 'Sales Return' }, { v: '8', l: 'Others' }, { v: '9', l: 'SKD/CKD' },
  { v: '11', l: 'Recipient Not Known' }, { v: '12', l: 'Exhibition or Fairs' },
  { v: '13', l: 'Line Sales' }, { v: '14', l: 'Other Supply Type' },
];
export const DOCUMENT_TYPES = [
  { v: 'INV', l: 'Tax Invoice' }, { v: 'BIL', l: 'Bill of Supply' },
  { v: 'BOE', l: 'Bill of Entry' }, { v: 'CHL', l: 'Delivery Challan' }, { v: 'OTH', l: 'Others' },
];
export const TRANSACTION_TYPES = [
  { v: 1, l: 'Regular' }, { v: 2, l: 'Bill To - Ship To' },
  { v: 3, l: 'Bill From - Dispatch From' }, { v: 4, l: 'Combination of 2 & 3' },
];
export const TRANSPORT_MODES = [
  { v: '1', l: 'Road' }, { v: '2', l: 'Rail' }, { v: '3', l: 'Air' }, { v: '4', l: 'Ship' },
];
export const VEHICLE_TYPES = [{ v: 'R', l: 'Regular' }, { v: 'O', l: 'Over Dimensional Cargo' }];

// GST registration threshold for e-way bills on intra-state movement of
// goods is ₹50,000 total invoice value (the actual mandatory trigger for
// most states) — used only as a soft warning in the UI, never a hard block,
// since some states/goods have different rules the app can't fully encode.
export const EWAY_BILL_THRESHOLD_INR = 50000;

// Builds Part A — the document + party + item details half of the e-way
// bill, straight from an Order/Invoice record plus its line items, the
// tenant's own company/GST profile, and the matched customer. `products`
// is passed in so a line item missing its own hsn_code (this app doesn't
// currently plumb HSN onto order_line_items/invoice_line_items when a line
// is added) can fall back to the HSN code recorded on the matching Product;
// anything still missing is left blank for the user to fill in the modal
// before generating, since HSN is mandatory for the actual govt submission.
export function buildPartA(record: any, lineItems: any[], company: any, customer: any, products: any[] = []) {
  const fromStateCode = stateCodeFromGstin(company?.gstin) || company?.state_code || '';
  const toStateCode = stateCodeFromGstin(customer?.gstNumber || customer?.gst_number || record?.gstin) || stateCodeFromGstin(record?.gstin) || '';
  const interState = !!(fromStateCode && toStateCode && fromStateCode !== toStateCode);

  const items = (lineItems || []).map((li: any) => {
    const prod = products.find((p: any) => p.id === li.product_id || p._uuid === li.product_id || p.name === (li.product_name || li.product));
    const hsn = li.hsn_code || prod?.hsn_code || '';
    const qty = Number(li.quantity || 0);
    const price = Number(li.price || li.unit_price || 0);
    const discountPct = Number(li.discount || li.discount_pct || 0);
    const taxableAmount = Math.round(qty * price * (1 - discountPct / 100) * 100) / 100;
    const gstRate = Number(li.gst_rate ?? li.tax_pct ?? prod?.tax_rate ?? 0);
    return {
      productName: li.product_name || li.product || prod?.name || 'Item',
      hsnCode: hsn,
      quantity: qty,
      qtyUnit: li.unit || prod?.unit || 'OTH',
      taxableAmount,
      cgstRate: interState ? 0 : Number((gstRate / 2).toFixed(2)),
      sgstRate: interState ? 0 : Number((gstRate / 2).toFixed(2)),
      igstRate: interState ? gstRate : 0,
      cessRate: 0,
    };
  });

  const totalTaxable = items.reduce((s, i) => s + i.taxableAmount, 0);
  const cgstValue = interState ? 0 : items.reduce((s, i) => s + i.taxableAmount * (i.cgstRate / 100), 0);
  const sgstValue = interState ? 0 : items.reduce((s, i) => s + i.taxableAmount * (i.sgstRate / 100), 0);
  const igstValue = interState ? items.reduce((s, i) => s + i.taxableAmount * (i.igstRate / 100), 0) : 0;
  const totalValue = totalTaxable + cgstValue + sgstValue + igstValue;

  return {
    supplyType: 'Outward',
    subSupplyType: '1',
    docType: 'INV',
    docNo: record?.displayNumber ? String(record.displayNumber) : (record?.id || ''),
    docDate: (record?.created_at || new Date().toISOString()).slice(0, 10).split('-').reverse().join('/'),
    fromGstin: company?.gstin || '',
    fromTrdName: company?.legal_name || company?.company_name || '',
    fromAddr1: company?.address || '',
    fromPlace: company?.city || '',
    fromPincode: company?.pincode || '',
    fromStateCode,
    toGstin: customer?.gstNumber || customer?.gst_number || record?.gstin || '',
    toTrdName: customer?.name || record?.customer || '',
    toAddr1: customer?.billingAddress || customer?.billing_address || record?.billing_address || '',
    toPlace: customer?.city || '',
    toPincode: customer?.postalCode || customer?.postal_code || '',
    toStateCode,
    transactionType: 1,
    totalValue: Number(totalTaxable.toFixed(2)),
    cgstValue: Number(cgstValue.toFixed(2)),
    sgstValue: Number(sgstValue.toFixed(2)),
    igstValue: Number(igstValue.toFixed(2)),
    cessValue: 0,
    totInvValue: Number(totalValue.toFixed(2)),
    itemList: items,
    interState,
  };
}

export function buildPartB(input: {
  transporterId?: string; transporterName?: string; transDocNo?: string; transDocDate?: string;
  transMode?: string; vehicleNo?: string; vehicleType?: string; transDistance?: number;
}) {
  return {
    transporterId: input.transporterId || '',
    transporterName: input.transporterName || '',
    transDocNo: input.transDocNo || '',
    transDocDate: input.transDocDate || '',
    transMode: input.transMode || '1',
    vehicleNo: (input.vehicleNo || '').toUpperCase().replace(/\s+/g, ''),
    vehicleType: input.vehicleType || 'R',
    transDistance: Number(input.transDistance || 0),
  };
}

// The exact request body NIC's GenerateEWB API / the portal's bulk-JSON
// upload expects — Part A and Part B fields merged into one flat object.
// This is what downloadEwaybillJSON() writes to disk and what
// generateViaDirectAPI() posts, so both filing paths share one builder and
// can never drift apart.
export function buildEwaybillJSON(partA: any, partB: any) {
  const { interState, ...docFields } = partA;
  return { ...docFields, ...partB };
}

export function downloadEwaybillJSON(payload: any, filename: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify({ version: '1.0.1221', billLists: [payload] }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename || 'eway-bill.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── ClearTax GSP (real, documented integration) ──────────────────────────
// Per ClearTax's published e-Invoicing/e-Way Bill API docs
// (docs.cleartax.in/cleartax-docs/e-invoicing-api), ClearTax's auth model is
// NOT a login-and-get-a-token flow like generic NIC-compatible GSPs — it's a
// single static token the tenant generates once on ClearTax's own dashboard
// (Settings → Integration Settings → enter an "AuthToken Label" → Generate →
// copy the token) and pastes into `gsp.auth_token` here. There is no API call
// that produces it, so this module never tries to "log in" for ClearTax.
//
// Base URLs: sandbox https://api-sandbox.clear.in, production https://api.clear.in
// (selected by `gsp.is_sandbox`, overridable via `gsp.base_url`).
//
// One-time setup (not part of per-document filing): the tenant's actual
// government e-Way-Bill-portal (NIC) username/password must be stored with
// ClearTax once per GSTIN so ClearTax can act as the authorized GSP —
// storeClearTaxNicCredentials() below wraps that call.
const CLEARTAX_SANDBOX_HOST = 'https://api-sandbox.clear.in';
const CLEARTAX_PROD_HOST = 'https://api.clear.in';

const clearTaxHost = (gsp: any) => (gsp?.base_url || (gsp?.is_sandbox === false ? CLEARTAX_PROD_HOST : CLEARTAX_SANDBOX_HOST)).replace(/\/$/, '');

// ClearTax's non-IRN e-way-bill-generation endpoint uses different enum
// spellings than the generic NIC bulk-JSON schema this module otherwise
// builds (buildEwaybillJSON above) — map between them here rather than
// changing the shared DOCUMENT_TYPES/VEHICLE_TYPES/TRANSACTION_TYPES
// constants, since the JSON-export path still needs the generic NIC values.
const CLEARTAX_DOC_TYPE: Record<string, string> = { INV: 'INV', BIL: 'BOS', BOE: 'BOE', CHL: 'CHL', OTH: 'OTH' };
const CLEARTAX_VEHICLE_TYPE: Record<string, string> = { R: 'REGULAR', O: 'ODC' };
const CLEARTAX_TRANSACTION_TYPE: Record<number, string> = {
  1: 'Regular', 2: 'Bill to-ship to', 3: 'Bill from-dispatch from', 4: 'Combination',
};

function clearTaxParty(gstin: string, legalName: string, addr1: string, place: string, pincode: string, stateCode: string) {
  return {
    Gstin: gstin || '', LglNm: (legalName || '').slice(0, 100), TrdNm: '',
    Addr1: (addr1 || '').slice(0, 120), Addr2: '', Loc: (place || '').slice(0, 50),
    Pin: Number(pincode) || 0, Stcd: stateCode || '',
  };
}

// Maps this app's internal Part A / Part B shape onto ClearTax's real
// PUT /einv/v3/ewaybill/generate request body (PascalCase fields, its own
// DocumentType/VehType/TransactionType enum spellings — see mapping tables
// above). Built from ClearTax's published API reference; it has not been
// exercised against a live ClearTax sandbox/production account because that
// needs the tenant's own ClearTax auth token and GSTIN onboarding.
export function buildClearTaxPayload(partA: any, partB: any) {
  return {
    DocumentNumber: String(partA.docNo || '').slice(0, 16),
    DocumentType: CLEARTAX_DOC_TYPE[partA.docType] || 'INV',
    DocumentDate: partA.docDate,
    SupplyType: partA.supplyType === 'Inward' ? 'Inward' : 'Outward',
    SubSupplyType: partA.subSupplyType || '1',
    TransactionType: CLEARTAX_TRANSACTION_TYPE[Number(partA.transactionType) || 1] || 'Regular',
    TotalInvoiceAmount: String(partA.totInvValue ?? 0),
    TotalCgstAmount: Number(partA.cgstValue || 0).toFixed(2),
    TotalSgstAmount: Number(partA.sgstValue || 0).toFixed(2),
    TotalIgstAmount: Number(partA.igstValue || 0).toFixed(2),
    TotalCessAmount: Number(partA.cessValue || 0).toFixed(2),
    TransId: partB.transporterId || '',
    TransName: (partB.transporterName || '').slice(0, 100),
    TransMode: partB.transMode || '1',
    Distance: Math.min(Math.max(Number(partB.transDistance || 0), 0), 4000),
    TransDocNo: partB.transDocNo || '',
    TransDocDt: partB.transDocDate || '',
    VehNo: partB.vehicleNo || '',
    VehType: CLEARTAX_VEHICLE_TYPE[partB.vehicleType] || 'REGULAR',
    SellerDtls: clearTaxParty(partA.fromGstin, partA.fromTrdName, partA.fromAddr1, partA.fromPlace, partA.fromPincode, partA.fromStateCode),
    BuyerDtls: clearTaxParty(partA.toGstin, partA.toTrdName, partA.toAddr1, partA.toPlace, partA.toPincode, partA.toStateCode),
    ItemList: (partA.itemList || []).map((i: any) => ({
      ProdName: i.productName || 'Item',
      ProdDesc: '',
      HsnCd: Number(i.hsnCode) || 0,
      Qty: Number(i.quantity || 0).toFixed(2),
      Unit: (i.qtyUnit || 'OTH').slice(0, 3),
      AssAmt: Number(i.taxableAmount || 0).toFixed(2),
      CgstRt: Number(i.cgstRate || 0).toFixed(3), CgstAmt: Number((i.taxableAmount || 0) * (i.cgstRate || 0) / 100).toFixed(2),
      SgstRt: Number(i.sgstRate || 0).toFixed(3), SgstAmt: Number((i.taxableAmount || 0) * (i.sgstRate || 0) / 100).toFixed(2),
      IgstRt: Number(i.igstRate || 0).toFixed(3), IgstAmt: Number((i.taxableAmount || 0) * (i.igstRate || 0) / 100).toFixed(2),
      CesRt: '0.000', CesAmt: '0.00',
    })),
  };
}

// One-time setup per GSTIN: tells ClearTax the tenant's real NIC
// (e-way-bill-portal) username/password so ClearTax is authorized to act as
// their GSP. Call this once from Admin → App Preferences after entering a
// ClearTax auth token, not on every e-way bill.
export async function storeClearTaxNicCredentials(gsp: any, nicUsername: string, nicPassword: string): Promise<{ success: boolean; raw?: any; error?: string }> {
  if (!gsp?.auth_token) return { success: false, error: 'Add your ClearTax Auth Token first (Admin → App Preferences → E-Way Bill).' };
  try {
    const res = await fetch(`${clearTaxHost(gsp)}/einv/v2/nic_credentials/store_nic_credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Cleartax-Auth-Token': gsp.auth_token, 'gstin': gsp.gstin || '' },
      body: JSON.stringify({ gstin: gsp.gstin || '', username: nicUsername, password: nicPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data?.message || data?.error || `ClearTax returned HTTP ${res.status}`, raw: data };
    return { success: true, raw: data };
  } catch (e: any) {
    return { success: false, error: 'Could not reach ClearTax: ' + e.message };
  }
}

// Calls ClearTax's real, current (non-deprecated) e-way-bill endpoint:
// PUT {host}/einv/v3/ewaybill/generate. Needs the tenant's real ClearTax
// auth token (gsp.auth_token) and their NIC credentials already stored via
// storeClearTaxNicCredentials(). This is built strictly from ClearTax's
// published API reference and has NOT been exercised against a live
// ClearTax account — that requires the tenant's own sandbox/production
// token to actually test against.
export async function generateViaClearTax(partA: any, partB: any, gsp: any): Promise<{ success: boolean; ewbNo?: string; ewbDate?: string; validUpto?: string; raw?: any; error?: string }> {
  if (!gsp?.auth_token || !gsp?.gstin) {
    return { success: false, error: 'ClearTax is not fully configured yet. Add your ClearTax Auth Token and GSTIN under Admin → App Preferences → E-Way Bill (generate the token on ClearTax’s dashboard: Settings → Integration Settings → Generate).' };
  }
  try {
    const payload = buildClearTaxPayload(partA, partB);
    const res = await fetch(`${clearTaxHost(gsp)}/einv/v3/ewaybill/generate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Cleartax-Auth-Token': gsp.auth_token, 'gstin': gsp.gstin },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    const govt = data?.govt_response || {};
    if (!res.ok || govt?.Success === 'N' || data?.ewb_status !== 'GENERATED') {
      const errDetail = Array.isArray(govt?.ErrorDetails) && govt.ErrorDetails.length
        ? govt.ErrorDetails.map((e: any) => e?.ErrorMessage || e?.error_message || JSON.stringify(e)).join('; ')
        : (data?.message || `ClearTax returned HTTP ${res.status}`);
      return { success: false, error: errDetail, raw: data };
    }
    return {
      success: true,
      ewbNo: String(govt.EwbNo || ''),
      ewbDate: govt.EwbDt || '',
      validUpto: govt.EwbValidTill || '',
      raw: data,
    };
  } catch (e: any) {
    return { success: false, error: 'Could not reach ClearTax: ' + e.message };
  }
}

// ─── Direct API filing (optional — "Connected", like Tally's live mode) ───
// Dispatches to the right GSP integration based on `gsp.provider`. ClearTax
// has a real, documented implementation (generateViaClearTax, above) — any
// other provider name falls through to the generic NIC-compatible flow
// below (auth-token login + GenerateEWB), which matches the common
// convention most GSPs (MasterGST, Cygnet, Vayana, IRIS…) use but MUST be
// checked against that specific GSP's own integration guide before going
// live, since exact endpoint paths/headers vary GSP to GSP.
//
// `partA`/`partB` are passed in (in addition to the already-merged `payload`)
// so ClearTax-specific dispatch can build its own PascalCase request body
// rather than reusing the generic NIC-shaped `payload`.
export async function generateViaDirectAPI(payload: any, gsp: any, partA?: any, partB?: any): Promise<{ success: boolean; ewbNo?: string; ewbDate?: string; validUpto?: string; raw?: any; error?: string }> {
  const provider = String(gsp?.provider || '').trim().toLowerCase();
  if (provider.includes('cleartax') || provider.includes('clear tax') || provider.includes('clear.in')) {
    return generateViaClearTax(partA, partB, gsp);
  }

  if (!gsp?.base_url || !gsp?.client_id || !gsp?.username) {
    return { success: false, error: 'Direct API filing is not configured yet. Add your GSP base URL, client ID/secret and e-Way Bill portal username/password under Admin → App Preferences → E-Way Bill, or use "Download JSON" to file it yourself at ewaybillgst.gov.in.' };
  }
  try {
    // NIC/GSP integration is always two calls: authenticate, then generate.
    // Both endpoint paths and header names vary slightly per GSP — these
    // match the common NIC-compatible convention (auth-token header,
    // gstin/client params) but MUST be checked against the specific GSP's
    // integration guide before going live with real data.
    const authRes = await fetch(`${gsp.base_url.replace(/\/$/, '')}/ewayapi/getauthtoken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client_id': gsp.client_id,
        'client_secret': gsp.client_secret || '',
        'gstin': gsp.gstin || '',
        'username': gsp.username,
        'password': gsp.password || '',
      },
      body: JSON.stringify({ action: 'ACCESSTOKEN', username: gsp.username, password: gsp.password || '' }),
    });
    if (!authRes.ok) return { success: false, error: `GSP authentication failed (HTTP ${authRes.status}). Check your GSP credentials under App Preferences.` };
    const authData = await authRes.json().catch(() => ({}));
    const authToken = authData?.auth_token || authData?.authtoken || authData?.token;
    if (!authToken) return { success: false, error: 'GSP authentication did not return a token. Verify the base URL and credentials match your GSP’s integration guide.' };

    const genRes = await fetch(`${gsp.base_url.replace(/\/$/, '')}/ewayapi/v1.03/ewaybillapi/GenerateEWB`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client_id': gsp.client_id,
        'client_secret': gsp.client_secret || '',
        'gstin': gsp.gstin || '',
        'auth-token': authToken,
      },
      body: JSON.stringify(payload),
    });
    const genData = await genRes.json().catch(() => ({}));
    if (!genRes.ok || genData?.error || genData?.errorCodes) {
      return { success: false, error: genData?.error || genData?.message || `E-Way Bill API returned HTTP ${genRes.status}`, raw: genData };
    }
    return {
      success: true,
      ewbNo: String(genData.ewayBillNo || genData.ewbNo || ''),
      ewbDate: genData.ewayBillDate || genData.ewbDate || '',
      validUpto: genData.validUpto || '',
      raw: genData,
    };
  } catch (e: any) {
    return { success: false, error: 'Could not reach the GSP API: ' + e.message };
  }
}
