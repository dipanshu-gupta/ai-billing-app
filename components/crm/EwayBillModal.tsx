// @ts-nocheck
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';
import { useAlert } from '@/components/shared/AlertProvider';
import {
  GST_STATE_OPTIONS, SUB_SUPPLY_TYPES, DOCUMENT_TYPES, TRANSACTION_TYPES,
  TRANSPORT_MODES, VEHICLE_TYPES, EWAY_BILL_THRESHOLD_INR,
  buildPartA, buildPartB, buildEwaybillJSON, downloadEwaybillJSON, generateViaDirectAPI,
} from '@/lib/ewayBill';

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';
const lbl  = 'block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5';

const LI_TABLE = { orders: 'order_line_items', invoices: 'invoice_line_items' };
const LI_FIELD = { orders: 'order_number', invoices: 'invoice_number' };

const STATUS_PILL = {
  draft:     'bg-gray-100 text-gray-600 border-gray-200',
  generated: 'bg-green-100 text-green-700 border-green-300',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
  failed:    'bg-amber-100 text-amber-700 border-amber-300',
};

// E-Way Bill generation, gated entirely by App Preferences → Region ===
// 'India' (checked by the caller before rendering this at all — see the
// "Generate E-Way Bill" button in CPQRecordDetail.tsx). B2B-only: this
// component is only ever mounted from the Orders/Invoices detail view,
// never anything under components/retail.
export default function EwayBillModal({ page, record, onClose }) {
  const {
    customers, products, appPreferences, currentUser,
    ewayBills, fetchEwayBills, saveEwayBillRecord, updateEwayBillRecord, cancelEwayBillRecord,
  } = useApp();
  const { supabase } = useTenant();
  const { showAlert } = useAlert();

  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [markFilingId, setMarkFilingId] = useState(null);
  const [manualEwb, setManualEwb] = useState({ ewb_no: '', ewb_date: '', valid_upto: '' });

  const [partB, setPartB] = useState({
    subSupplyType: '1', docType: 'INV', transactionType: 1,
    transporterId: '', transporterName: '', transMode: '1',
    vehicleNo: '', vehicleType: 'R', transDistance: '',
  });

  const customer = useMemo(() => customers.find(c => c.id === record.customerId || c.id === record.customer_id), [customers, record]);
  const company = useMemo(() => ({
    gstin: appPreferences?.company_gstin, legal_name: appPreferences?.company_legal_name,
    address: appPreferences?.company_address, city: appPreferences?.company_city,
    pincode: appPreferences?.company_pincode, state_code: appPreferences?.company_state_code,
  }), [appPreferences]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const table = LI_TABLE[page], field = LI_FIELD[page];
      if (supabase && table) {
        const { data } = await supabase.from(table).select('*').eq(field, record.id).order('sort_order');
        setLineItems(data || []);
      }
      await fetchEwayBills(page === 'orders' ? 'order' : 'invoice', record.id);
      setLoading(false);
    };
    load();
  }, [record.id, page]);

  const partA = useMemo(() => buildPartA(record, lineItems, company, customer, products), [record, lineItems, company, customer, products]);
  const missingHsn = partA.itemList.filter(i => !i.hsnCode);
  const belowThreshold = partA.totInvValue > 0 && partA.totInvValue < EWAY_BILL_THRESHOLD_INR;
  const companyIncomplete = !company.gstin;

  const buildPayload = () => buildEwaybillJSON(
    { ...partA, subSupplyType: partB.subSupplyType, docType: partB.docType, transactionType: Number(partB.transactionType) },
    buildPartB({
      transporterId: partB.transporterId, transporterName: partB.transporterName,
      transMode: partB.transMode, vehicleNo: partB.vehicleNo, vehicleType: partB.vehicleType,
      transDistance: partB.transDistance,
    })
  );

  const commonRecordFields = () => ({
    source_type: page === 'orders' ? 'order' : 'invoice',
    source_number: record.id,
    supply_type: partA.supplyType, sub_type: partB.subSupplyType, document_type: partB.docType,
    transaction_type: Number(partB.transactionType),
    transporter_id: partB.transporterId, transporter_name: partB.transporterName,
    transport_mode: partB.transMode, vehicle_no: partB.vehicleNo, vehicle_type: partB.vehicleType,
    distance_km: Number(partB.transDistance) || 0,
    from_gstin: partA.fromGstin, from_state_code: partA.fromStateCode,
    to_gstin: partA.toGstin, to_state_code: partA.toStateCode,
    part_a: partA, part_b: partB,
  });

  const handleDownloadJSON = async () => {
    const payload = buildPayload();
    downloadEwaybillJSON(payload, `eway-bill-${record.displayNumber || record.id}.json`);
    await saveEwayBillRecord({ ...commonRecordFields(), status: 'draft', generation_mode: 'json_export', request_json: payload });
  };

  const handleDirectApi = async () => {
    setGenerating(true);
    const payload = buildPayload();
    const gsp = appPreferences?.eway_bill_gsp;
    // Same merged Part A (with the manual subSupplyType/docType/transactionType
    // overrides from the form) and Part B shape buildPayload() uses above —
    // kept separate (rather than just passing `payload`) so ClearTax-specific
    // dispatch inside generateViaDirectAPI can build its own PascalCase body.
    const mergedPartA = { ...partA, subSupplyType: partB.subSupplyType, docType: partB.docType, transactionType: Number(partB.transactionType) };
    const builtPartB = buildPartB({
      transporterId: partB.transporterId, transporterName: partB.transporterName,
      transMode: partB.transMode, vehicleNo: partB.vehicleNo, vehicleType: partB.vehicleType,
      transDistance: partB.transDistance,
    });
    const result = await generateViaDirectAPI(payload, gsp, mergedPartA, builtPartB);
    setGenerating(false);
    if (!result.success) {
      showAlert(result.error || 'E-way bill generation failed.', { variant: 'danger', title: 'Generation Failed' });
      await saveEwayBillRecord({ ...commonRecordFields(), status: 'failed', generation_mode: 'direct_api', request_json: payload, error_message: result.error });
      return;
    }
    await saveEwayBillRecord({
      ...commonRecordFields(), status: 'generated', generation_mode: 'direct_api',
      request_json: payload, api_response: result.raw,
      ewb_no: result.ewbNo, ewb_date: result.ewbDate, valid_upto: result.validUpto,
    });
    showAlert(`E-way bill ${result.ewbNo} generated successfully.`, { variant: 'success', title: 'Generated' });
  };

  const submitManualFiling = async (id) => {
    if (!manualEwb.ewb_no) { showAlert('Enter the e-way bill number shown on the government portal.'); return; }
    await updateEwayBillRecord(id, {
      status: 'generated', ewb_no: manualEwb.ewb_no, ewb_date: manualEwb.ewb_date || null, valid_upto: manualEwb.valid_upto || null,
      source_type: page === 'orders' ? 'order' : 'invoice', source_number: record.id,
    });
    setMarkFilingId(null);
    setManualEwb({ ewb_no: '', ewb_date: '', valid_upto: '' });
  };

  const gspConfigured = !!(appPreferences?.eway_bill_gsp?.base_url && appPreferences?.eway_bill_gsp?.client_id && appPreferences?.eway_bill_gsp?.username);

  return (
    <div className="fixed inset-0 bg-black/50 z-[120] overflow-y-auto flex items-start justify-center p-4">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-3xl my-6 overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">🚚 E-Way Bill</h2>
            <p className="text-white/60 text-xs mt-0.5">{page === 'orders' ? 'Order' : 'Invoice'} {record.displayNumber ? `#${record.displayNumber}` : record.id} · {record.name}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="text-center text-sm text-gray-400 py-10">Loading line items…</div>
          ) : (
            <>
              {companyIncomplete && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  Your company's GSTIN isn't set. Add it under Admin → App Preferences → Region &amp; E-Way Bill before generating.
                </div>
              )}
              {missingHsn.length > 0 && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  {missingHsn.length} line item{missingHsn.length>1?'s':''} missing an HSN code ({missingHsn.map(i=>i.productName).join(', ')}). HSN is mandatory for e-way bill filing — set it on the Product record, or the govt portal/API will reject this.
                </div>
              )}
              {belowThreshold && (
                <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                  Total value (₹{partA.totInvValue.toLocaleString('en-IN')}) is under the usual ₹{EWAY_BILL_THRESHOLD_INR.toLocaleString('en-IN')} e-way bill threshold for intra-state movement — check your state's specific rule before filing if this is an intra-state delivery.
                </div>
              )}

              {/* Part A — auto-filled */}
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] mb-2">Part A — Document &amp; Party Details (auto-filled)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <div><div className="text-gray-400">From GSTIN</div><div className="font-semibold text-[#0F172A]">{partA.fromGstin || '—'}</div></div>
                  <div><div className="text-gray-400">From State</div><div className="font-semibold text-[#0F172A]">{partA.fromStateCode || '—'}</div></div>
                  <div><div className="text-gray-400">Doc No / Date</div><div className="font-semibold text-[#0F172A]">{partA.docNo} · {partA.docDate}</div></div>
                  <div><div className="text-gray-400">To GSTIN</div><div className="font-semibold text-[#0F172A]">{partA.toGstin || '—'}</div></div>
                  <div><div className="text-gray-400">To State</div><div className="font-semibold text-[#0F172A]">{partA.toStateCode || '—'}</div></div>
                  <div><div className="text-gray-400">Movement</div><div className="font-semibold text-[#0F172A]">{partA.interState ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}</div></div>
                  <div><div className="text-gray-400">Taxable Value</div><div className="font-semibold text-[#0F172A]">₹{partA.totalValue.toLocaleString('en-IN')}</div></div>
                  <div><div className="text-gray-400">Total Tax</div><div className="font-semibold text-[#0F172A]">₹{(partA.cgstValue+partA.sgstValue+partA.igstValue).toLocaleString('en-IN')}</div></div>
                  <div><div className="text-gray-400">Invoice Value</div><div className="font-semibold text-[#0F172A]">₹{partA.totInvValue.toLocaleString('en-IN')}</div></div>
                </div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-gray-400 border-b border-gray-100">
                      <th className="py-1.5 pr-2">Item</th><th className="py-1.5 pr-2">HSN</th><th className="py-1.5 pr-2 text-right">Qty</th>
                      <th className="py-1.5 pr-2 text-right">Taxable Amt</th><th className="py-1.5 pr-2 text-right">CGST%</th><th className="py-1.5 pr-2 text-right">SGST%</th><th className="py-1.5 text-right">IGST%</th>
                    </tr></thead>
                    <tbody>
                      {partA.itemList.map((i,idx)=>(
                        <tr key={idx} className="border-b border-gray-50">
                          <td className="py-1.5 pr-2">{i.productName}</td>
                          <td className={`py-1.5 pr-2 ${!i.hsnCode?'text-amber-600 font-semibold':''}`}>{i.hsnCode||'missing'}</td>
                          <td className="py-1.5 pr-2 text-right">{i.quantity} {i.qtyUnit}</td>
                          <td className="py-1.5 pr-2 text-right">₹{i.taxableAmount.toLocaleString('en-IN')}</td>
                          <td className="py-1.5 pr-2 text-right">{i.cgstRate}%</td>
                          <td className="py-1.5 pr-2 text-right">{i.sgstRate}%</td>
                          <td className="py-1.5 text-right">{i.igstRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Part B — manual entry, like Tally */}
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] mb-2">Part B — Transport Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><label className={lbl}>Sub Type</label>
                    <select value={partB.subSupplyType} onChange={e=>setPartB(p=>({...p,subSupplyType:e.target.value}))} className={iCls}>
                      {SUB_SUPPLY_TYPES.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                  <div><label className={lbl}>Document Type</label>
                    <select value={partB.docType} onChange={e=>setPartB(p=>({...p,docType:e.target.value}))} className={iCls}>
                      {DOCUMENT_TYPES.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                  <div><label className={lbl}>Transaction Type</label>
                    <select value={partB.transactionType} onChange={e=>setPartB(p=>({...p,transactionType:e.target.value}))} className={iCls}>
                      {TRANSACTION_TYPES.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                  <div><label className={lbl}>Transporter ID (GSTIN, optional)</label>
                    <input value={partB.transporterId} onChange={e=>setPartB(p=>({...p,transporterId:e.target.value.toUpperCase()}))} className={iCls}/>
                  </div>
                  <div><label className={lbl}>Transporter Name</label>
                    <input value={partB.transporterName} onChange={e=>setPartB(p=>({...p,transporterName:e.target.value}))} className={iCls}/>
                  </div>
                  <div><label className={lbl}>Transport Mode</label>
                    <select value={partB.transMode} onChange={e=>setPartB(p=>({...p,transMode:e.target.value}))} className={iCls}>
                      {TRANSPORT_MODES.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                  <div><label className={lbl}>Vehicle Number</label>
                    <input value={partB.vehicleNo} onChange={e=>setPartB(p=>({...p,vehicleNo:e.target.value.toUpperCase()}))} placeholder="e.g. MH12AB1234" className={iCls}/>
                  </div>
                  <div><label className={lbl}>Vehicle Type</label>
                    <select value={partB.vehicleType} onChange={e=>setPartB(p=>({...p,vehicleType:e.target.value}))} className={iCls}>
                      {VEHICLE_TYPES.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                  <div><label className={lbl}>Distance (km)</label>
                    <input type="number" value={partB.transDistance} onChange={e=>setPartB(p=>({...p,transDistance:e.target.value}))} className={iCls}/>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
                <button onClick={handleDownloadJSON} disabled={companyIncomplete}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-100 hover:bg-blue-200 text-blue-700 disabled:opacity-40">
                  ⬇️ Download JSON (upload at ewaybillgst.gov.in)
                </button>
                <button onClick={handleDirectApi} disabled={companyIncomplete || generating}
                  title={!gspConfigured ? 'Configure GSP API credentials under App Preferences to enable this' : ''}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-[#0F172A] to-blue-800 text-white disabled:opacity-40">
                  {generating ? 'Generating…' : '⚡ Generate via Direct API'}
                </button>
                {!gspConfigured && <span className="text-xs text-gray-400 self-center">Direct API needs GSP credentials in App Preferences — the JSON download works without them.</span>}
              </div>

              {/* History */}
              {ewayBills.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-[#0F172A] mb-2">History</h3>
                  <div className="space-y-2">
                    {ewayBills.map(b => (
                      <div key={b.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2.5 text-xs">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_PILL[b.status]||STATUS_PILL.draft}`}>{b.status}</span>
                          <span className="text-gray-600">{b.generation_mode === 'direct_api' ? 'Direct API' : 'JSON Export'}</span>
                          {b.ewb_no && <span className="font-semibold text-[#0F172A]">EWB #{b.ewb_no}</span>}
                          <span className="text-gray-400">{new Date(b.created_at).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {b.status === 'draft' && markFilingId !== b.id && (
                            <button onClick={()=>setMarkFilingId(b.id)} className="text-blue-600 font-semibold hover:underline">Mark as Filed…</button>
                          )}
                          {b.status !== 'cancelled' && (
                            <button onClick={()=>cancelEwayBillRecord(b.id, b.source_type, b.source_number)} className="text-red-500 font-semibold hover:underline">Cancel</button>
                          )}
                        </div>
                      </div>
                    ))}
                    {markFilingId && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input placeholder="EWB Number" value={manualEwb.ewb_no} onChange={e=>setManualEwb(m=>({...m,ewb_no:e.target.value}))} className={iCls}/>
                        <input type="date" placeholder="EWB Date" value={manualEwb.ewb_date} onChange={e=>setManualEwb(m=>({...m,ewb_date:e.target.value}))} className={iCls}/>
                        <input type="date" placeholder="Valid Upto" value={manualEwb.valid_upto} onChange={e=>setManualEwb(m=>({...m,valid_upto:e.target.value}))} className={iCls}/>
                        <div className="sm:col-span-3 flex gap-2">
                          <button onClick={()=>submitManualFiling(markFilingId)} className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white">Save</button>
                          <button onClick={()=>setMarkFilingId(null)} className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-gray-200">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
