// @ts-nocheck
'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';

// ─── Field definitions per object ─────────────────────────────────────────────
const IMPORT_OBJECTS = {
  // B2B
  customers: {
    label: 'Customers', icon: '👥', group: 'B2B Enterprise',
    table: 'customers', idField: 'customer_number', idPrefix: 'CUST',
    requiredCols: ['name'],
    columns: [
      { key:'name',             label:'Name *',              example:'Acme Corp' },
      { key:'company',          label:'Company',             example:'Acme Inc' },
      { key:'email',            label:'Email',               example:'acme@corp.com' },
      { key:'phone',            label:'Phone',               example:'+91 9876543210' },
      { key:'industry',         label:'Industry',            example:'Technology' },
      { key:'website',          label:'Website',             example:'https://acme.com' },
      { key:'billing_address',  label:'Billing Address',     example:'123 Main St' },
      { key:'shipping_address', label:'Shipping Address',    example:'123 Main St' },
      { key:'city',             label:'City',                example:'Mumbai' },
      { key:'state',            label:'State',               example:'Maharashtra' },
      { key:'postal_code',      label:'Postal Code',         example:'400001' },
      { key:'country',          label:'Country',             example:'India' },
      { key:'gst_number',       label:'GST Number',          example:'27AAPFU0939F1ZV' },
      { key:'status',           label:'Status',              example:'Active' },
      { key:'owner',            label:'Owner Email',         example:'rep@company.com' },
      { key:'description',      label:'Description',         example:'Enterprise client' },
    ],
  },
  leads: {
    label: 'Leads', icon: '🎯', group: 'B2B Enterprise',
    table: 'leads', idField: 'lead_number', idPrefix: 'LEAD',
    requiredCols: ['name'],
    columns: [
      { key:'name',               label:'Name *',            example:'John Smith' },
      { key:'customer',           label:'Company',           example:'ABC Corp' },
      { key:'email',              label:'Email',             example:'john@abc.com' },
      { key:'phone',              label:'Phone',             example:'+91 9876543210' },
      { key:'source',             label:'Source',            example:'Website' },
      { key:'amount',             label:'Amount',            example:'50000' },
      { key:'status',             label:'Status',            example:'New' },
      { key:'expected_close_date',label:'Expected Close',    example:'2025-12-31' },
      { key:'owner',              label:'Owner Email',       example:'rep@company.com' },
      { key:'description',        label:'Description',       example:'Interested in CRM' },
    ],
  },
  contacts: {
    label: 'Contacts', icon: '📇', group: 'B2B Enterprise',
    table: 'contacts', idField: 'contact_number', idPrefix: 'CON',
    requiredCols: ['name'],
    columns: [
      { key:'name',        label:'Name *',         example:'Jane Doe' },
      { key:'customer',    label:'Company',         example:'Acme Corp' },
      { key:'email',       label:'Email',           example:'jane@acme.com' },
      { key:'phone',       label:'Phone',           example:'+91 9876543210' },
      { key:'mobile',      label:'Mobile',          example:'+91 9876543210' },
      { key:'designation', label:'Designation',     example:'CEO' },
      { key:'department',  label:'Department',      example:'Operations' },
      { key:'status',      label:'Status',          example:'Active' },
      { key:'linked_in',   label:'LinkedIn',        example:'linkedin.com/in/janedoe' },
      { key:'description', label:'Description',     example:'Primary contact' },
    ],
  },
  opportunities: {
    label: 'Opportunities', icon: '💼', group: 'B2B Enterprise',
    table: 'opportunities', idField: 'opportunity_number', idPrefix: 'OPP',
    requiredCols: ['name'],
    columns: [
      { key:'name',       label:'Name *',          example:'Q1 Deal - Acme' },
      { key:'customer',   label:'Customer',         example:'Acme Corp' },
      { key:'stage',      label:'Stage',            example:'Proposal Sent' },
      { key:'amount',     label:'Amount',           example:'250000' },
      { key:'probability',label:'Probability %',    example:'60' },
      { key:'close_date', label:'Close Date',       example:'2025-12-31' },
      { key:'status',     label:'Status',           example:'Open' },
      { key:'campaign',   label:'Campaign',         example:'Summer 2025' },
      { key:'owner',      label:'Owner Email',      example:'rep@company.com' },
      { key:'description',label:'Description',      example:'Key strategic deal' },
    ],
  },
  products: {
    label: 'Products', icon: '📦', group: 'B2B Enterprise',
    table: 'products', idField: 'product_number', idPrefix: 'PROD',
    requiredCols: ['name'],
    columns: [
      { key:'name',           label:'Name *',         example:'CRM Pro License' },
      { key:'category',       label:'Category',        example:'Software' },
      { key:'product_family', label:'Product Family',  example:'SaaS' },
      { key:'sku',            label:'SKU',             example:'CRM-PRO-001' },
      { key:'price',          label:'Price',           example:'9999' },
      { key:'cost',           label:'Cost',            example:'4999' },
      { key:'unit',           label:'Unit',            example:'Per License' },
      { key:'tax_rate',       label:'Tax Rate %',      example:'18' },
      { key:'gst_rate',       label:'GST Rate %',      example:'18' },
      { key:'hsn_code',       label:'HSN Code',        example:'998313' },
      { key:'status',         label:'Status',          example:'Active' },
      { key:'description',    label:'Description',     example:'Enterprise CRM license' },
    ],
  },
  activities: {
    label: 'Activities', icon: '📅', group: 'B2B Enterprise',
    table: 'activities', idField: 'activity_number', idPrefix: 'ACT',
    requiredCols: ['name','activity_type'],
    columns: [
      { key:'name',          label:'Name *',         example:'Follow up call' },
      { key:'activity_type', label:'Type *',          example:'Call' },
      { key:'customer',      label:'Customer',        example:'Acme Corp' },
      { key:'contact',       label:'Contact',         example:'Jane Doe' },
      { key:'subject',       label:'Subject',         example:'Product demo follow up' },
      { key:'status',        label:'Status',          example:'Open' },
      { key:'priority',      label:'Priority',        example:'High' },
      { key:'activity_date', label:'Activity Date',   example:'2025-01-15' },
      { key:'due_date',      label:'Due Date',        example:'2025-01-20' },
      { key:'owner',         label:'Owner Email',     example:'rep@company.com' },
      { key:'notes',         label:'Notes',           example:'Call went well' },
    ],
  },
  quotations: {
    label: 'Quotations', icon: '📋', group: 'B2B Enterprise',
    table: 'quotations', idField: 'quote_number', idPrefix: 'QUO',
    requiredCols: ['name', 'customer'],
    columns: [
      { key:'name',             label:'Name *',            example:'Q1 Proposal - Acme' },
      { key:'customer',         label:'Customer *',         example:'Acme Corp' },
      { key:'contact',          label:'Contact',            example:'Jane Doe' },
      { key:'status',           label:'Status',             example:'Draft' },
      { key:'validity_date',    label:'Validity Date',      example:'2025-12-31' },
      { key:'payment_terms',    label:'Payment Terms',      example:'Net 30' },
      { key:'shipping_terms',   label:'Shipping Terms',     example:'FOB' },
      { key:'billing_address',  label:'Billing Address',    example:'123 Main St' },
      { key:'shipping_address', label:'Shipping Address',   example:'123 Main St' },
      { key:'currency',         label:'Currency',           example:'INR' },
      { key:'overall_discount', label:'Overall Discount %', example:'5' },
      { key:'shipping_cost',    label:'Shipping Cost',      example:'500' },
      { key:'grand_total',      label:'Grand Total',        example:'50000' },
      { key:'place_of_supply',  label:'Place of Supply',    example:'Maharashtra' },
      { key:'gstin',            label:'GSTIN',              example:'27AAPFU0939F1ZV' },
      { key:'owner',            label:'Owner Email',        example:'rep@company.com' },
      { key:'notes',            label:'Notes',              example:'Includes support for 1 year' },
    ],
  },
  orders: {
    label: 'Orders', icon: '🛒', group: 'B2B Enterprise',
    table: 'orders', idField: 'order_number', idPrefix: 'ORD',
    requiredCols: ['name', 'customer'],
    columns: [
      { key:'name',             label:'Name *',            example:'Order - Acme Corp' },
      { key:'customer',         label:'Customer *',         example:'Acme Corp' },
      { key:'contact',          label:'Contact',            example:'Jane Doe' },
      { key:'status',           label:'Status',             example:'Draft' },
      { key:'delivery_date',    label:'Delivery Date',      example:'2025-12-31' },
      { key:'payment_terms',    label:'Payment Terms',      example:'Net 30' },
      { key:'shipping_terms',   label:'Shipping Terms',     example:'FOB' },
      { key:'billing_address',  label:'Billing Address',    example:'123 Main St' },
      { key:'shipping_address', label:'Shipping Address',   example:'123 Main St' },
      { key:'currency',         label:'Currency',           example:'INR' },
      { key:'overall_discount', label:'Overall Discount %', example:'5' },
      { key:'shipping_cost',    label:'Shipping Cost',      example:'500' },
      { key:'subtotal',         label:'Subtotal',           example:'45000' },
      { key:'total_tax',        label:'Total Tax',          example:'8100' },
      { key:'amount',           label:'Grand Total',        example:'53600' },
      { key:'place_of_supply',  label:'Place of Supply',    example:'Maharashtra' },
      { key:'gstin',            label:'GSTIN',              example:'27AAPFU0939F1ZV' },
      { key:'owner',            label:'Owner Email',        example:'rep@company.com' },
      { key:'notes',            label:'Notes',              example:'Rush delivery' },
    ],
  },
  invoices: {
    label: 'Invoices', icon: '🧾', group: 'B2B Enterprise',
    table: 'invoices', idField: 'invoice_number', idPrefix: 'INV',
    requiredCols: ['name', 'customer'],
    columns: [
      { key:'name',             label:'Name *',            example:'Invoice - Acme Corp' },
      { key:'customer',         label:'Customer *',         example:'Acme Corp' },
      { key:'contact',          label:'Contact',            example:'Jane Doe' },
      { key:'status',           label:'Status',             example:'Draft' },
      { key:'due_date',         label:'Due Date',           example:'2025-12-31' },
      { key:'payment_terms',    label:'Payment Terms',      example:'Net 30' },
      { key:'billing_address',  label:'Billing Address',    example:'123 Main St' },
      { key:'shipping_address', label:'Shipping Address',   example:'123 Main St' },
      { key:'currency',         label:'Currency',           example:'INR' },
      { key:'overall_discount', label:'Overall Discount %', example:'5' },
      { key:'shipping_cost',    label:'Shipping Cost',      example:'500' },
      { key:'subtotal',         label:'Subtotal',           example:'45000' },
      { key:'total_tax',        label:'Total Tax',          example:'8100' },
      { key:'amount',           label:'Grand Total',        example:'53600' },
      { key:'order_number',     label:'Order Number',       example:'ORD-00001' },
      { key:'place_of_supply',  label:'Place of Supply',    example:'Maharashtra' },
      { key:'gstin',            label:'GSTIN',              example:'27AAPFU0939F1ZV' },
      { key:'owner',            label:'Owner Email',        example:'rep@company.com' },
      { key:'notes',            label:'Notes',              example:'Thank you for your business' },
    ],
  },

  // Retail
  retailCustomers: {
    label: 'Retail Customers', icon: '🛍️', group: 'B2C Retail',
    table: 'retail_customers', idField: 'customer_number', idPrefix: 'RCUST',
    requiredCols: ['name'],
    columns: [
      { key:'name',          label:'Name *',         example:'Alice Johnson' },
      { key:'email',         label:'Email',           example:'alice@email.com' },
      { key:'phone',         label:'Phone',           example:'+91 9876543210' },
      { key:'address',       label:'Address',         example:'456 Park Ave' },
      { key:'city',          label:'City',            example:'Delhi' },
      { key:'state',         label:'State',           example:'Delhi' },
      { key:'postal_code',   label:'Postal Code',     example:'110001' },
      { key:'status',        label:'Status',          example:'Active' },
      { key:'loyalty_tier',  label:'Loyalty Tier',    example:'Gold' },
      { key:'notes',         label:'Notes',           example:'VIP customer' },
    ],
  },
  retailProducts: {
    label: 'Retail Products', icon: '🏷️', group: 'B2C Retail',
    table: 'retail_products', idField: 'product_number', idPrefix: 'RPROD',
    requiredCols: ['name'],
    columns: [
      { key:'name',            label:'Name *',        example:'Blue T-Shirt' },
      { key:'category',        label:'Category',       example:'Apparel' },
      { key:'brand',           label:'Brand',          example:'Nike' },
      { key:'sku',             label:'SKU',            example:'TS-BLU-M' },
      { key:'barcode',         label:'Barcode',        example:'8901234567890' },
      { key:'price',           label:'Price',          example:'999' },
      { key:'mrp',             label:'MRP',            example:'1199' },
      { key:'cost',            label:'Cost',           example:'450' },
      { key:'stock_quantity',  label:'Stock Qty',      example:'100' },
      { key:'reorder_level',   label:'Reorder Level',  example:'10' },
      { key:'unit',            label:'Unit',           example:'pc' },
      { key:'hsn_code',        label:'HSN Code',       example:'61091000' },
      { key:'gst_rate',        label:'GST Rate %',     example:'12' },
      { key:'status',          label:'Status',         example:'Active' },
      { key:'description',     label:'Description',    example:'Blue t-shirt, size M' },
    ],
  },
  retailActivities: {
    label: 'Retail Activities', icon: '📅', group: 'B2C Retail',
    table: 'retail_activities', idField: 'activity_number', idPrefix: 'RACT',
    requiredCols: ['subject', 'activity_type'],
    columns: [
      { key:'subject',       label:'Subject *',      example:'Walk-in visit' },
      { key:'activity_type', label:'Type *',          example:'Visit' },
      { key:'customer',      label:'Customer Name',   example:'Alice Johnson' },
      { key:'status',        label:'Status',          example:'Open' },
      { key:'priority',      label:'Priority',        example:'Medium' },
      { key:'activity_date', label:'Activity Date',   example:'2025-01-15' },
      { key:'due_date',      label:'Due Date',        example:'2025-01-20' },
      { key:'owner',         label:'Owner Email',     example:'staff@store.com' },
      { key:'description',   label:'Description',     example:'Customer inquired about new stock' },
      { key:'notes',         label:'Notes',           example:'Follow up next week' },
    ],
  },
  retailOrders: {
    label: 'Retail Orders', icon: '🧾', group: 'B2C Retail',
    table: 'retail_orders', idField: 'order_number', idPrefix: 'RORD',
    requiredCols: ['customer'],
    columns: [
      { key:'customer',        label:'Customer Name *', example:'Alice Johnson' },
      { key:'customer_phone',  label:'Customer Phone',  example:'+91 9876543210' },
      { key:'order_date',      label:'Order Date',      example:'2025-01-15' },
      { key:'channel',         label:'Channel',         example:'In-Store' },
      { key:'payment_method',  label:'Payment Method',  example:'Cash' },
      { key:'payment_status',  label:'Payment Status',  example:'Paid' },
      { key:'delivery_method', label:'Delivery Method', example:'Pickup' },
      { key:'delivery_address',label:'Delivery Address',example:'456 Park Ave, Delhi' },
      { key:'delivery_date',   label:'Delivery Date',   example:'2025-01-16' },
      { key:'subtotal',        label:'Subtotal',        example:'1500' },
      { key:'total_discount',  label:'Total Discount',  example:'100' },
      { key:'total_tax',       label:'Total Tax',       example:'216' },
      { key:'amount',          label:'Grand Total',     example:'1616' },
      { key:'status',          label:'Status',          example:'Completed' },
      { key:'notes',           label:'Notes',           example:'Gift wrap requested' },
    ],
  },
  retailInvoices: {
    label: 'Retail Invoices', icon: '🧾', group: 'B2C Retail',
    table: 'retail_invoices', idField: 'invoice_number', idPrefix: 'RINV',
    requiredCols: ['customer'],
    columns: [
      { key:'customer',         label:'Customer Name *', example:'Alice Johnson' },
      { key:'customer_phone',   label:'Customer Phone',  example:'+91 9876543210' },
      { key:'order_number',     label:'Order Number',    example:'RORD-00001' },
      { key:'invoice_date',     label:'Invoice Date',    example:'2025-01-15' },
      { key:'due_date',         label:'Due Date',        example:'2025-01-30' },
      { key:'payment_method',   label:'Payment Method',  example:'Cash' },
      { key:'payment_status',   label:'Payment Status',  example:'Paid' },
      { key:'subtotal',         label:'Subtotal',        example:'1500' },
      { key:'total_discount',   label:'Total Discount',  example:'100' },
      { key:'total_tax',        label:'Total Tax',       example:'216' },
      { key:'shipping_cost',    label:'Shipping Cost',   example:'0' },
      { key:'amount',           label:'Grand Total',     example:'1616' },
      { key:'place_of_supply',  label:'Place of Supply', example:'Delhi' },
      { key:'gstin',            label:'GSTIN',           example:'07AAPFU0939F1ZV' },
      { key:'status',           label:'Status',          example:'Paid' },
      { key:'notes',            label:'Notes',           example:'Payment received in cash' },
    ],
  },
};

// ─── ID generator (reuses AppContext's pattern) ────────────────────────────
const generateDisplayId = (prefix: string, seq: number) =>
  `${prefix}-${String(seq).padStart(5,'0')}`;

// ─── CSV helpers ──────────────────────────────────────────────────────────────
const objToCsvRow = (obj: Record<string,any>, cols: string[]): string =>
  cols.map(c => {
    const v = obj[c] ?? '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g,'""')}"`
      : s;
  }).join(',');

const csvToRows = (csv: string): { headers: string[], rows: Record<string,string>[] } => {
  const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const parseRow = (line: string): string[] => {
    const vals: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (line[i] === ',' && !inQ) {
        vals.push(cur); cur = '';
      } else cur += line[i];
    }
    vals.push(cur);
    return vals.map(v => v.trim());
  };
  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(l => {
    const vals = parseRow(l);
    const obj: Record<string,string> = {};
    headers.forEach((h,i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
};

const downloadCsv = (filename: string, content: string) => {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ImportExportPanel() {
  const { currentUser, appPreferences } = useApp() as any;
  const { supabase }  = useTenant();
  const isB2C         = appPreferences?.b2c_mode === true;
  const isCRMEnabled  = appPreferences?.crm_enabled !== false;
  const availableObjects = Object.entries(IMPORT_OBJECTS).filter(([, cfg]) => {
    if (cfg.group === 'B2B Enterprise') return !isB2C;
    if (cfg.group === 'B2C Retail')     return isB2C;
    return true;
  });

  // ── State ─────────────────────────────────────────────────────────────────
  const [tab,          setTab]          = useState<'import'|'export'|'history'>('export');
  const [selObj,       setSelObj]       = useState(availableObjects[0]?.[0] || 'customers');
  const [exportFmt,     setExportFmt]    = useState<'csv'|'json'>('csv');
  const [exportFields,  setExportFields] = useState<string[]>([]);
  const [exportRows,    setExportRows]   = useState<any[]>([]);
  const [exporting,     setExporting]    = useState(false);
  const [exportDone,    setExportDone]   = useState('');
  const [customFields,  setCustomFields] = useState<{key:string,label:string}[]>([]);

  // Import
  const [importStep,   setImportStep]   = useState<'upload'|'map'|'validate'|'preview'|'done'>('upload');
  const [importFile,   setImportFile]   = useState<File|null>(null);
  const [importParsed, setImportParsed] = useState<{ headers: string[], rows: Record<string,string>[] }|null>(null);
  const [colMap,       setColMap]       = useState<Record<string,string>>({});  // systemField -> csvHeader
  const [validation,   setValidation]   = useState<{ valid: any[], errors: { row:number, col:string, msg:string }[] }>({ valid:[], errors:[] });
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState<{ created:number, updated:number, skipped:number, errors:string[] }|null>(null);
  const [importMode,   setImportMode]   = useState<'create'|'upsert'>('upsert');
  const [importDupeKey,setImportDupeKey]= useState<string>('name');

  // History (local session only)
  const [history,      setHistory]      = useState<{ ts:string, obj:string, action:string, count:number, status:'ok'|'error' }[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const cfg = IMPORT_OBJECTS[selObj];

  // ── Init export fields ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!cfg || !supabase) return;
    setExportRows([]);
    setExportDone('');
    setCustomFields([]);

    // Fetch custom fields for this object from app_custom_fields
    const fetchCustomFields = async () => {
      try {
        const { data, error } = await supabase
          .from('app_custom_fields')
          .select('api_name, label, is_published, is_active')
          .eq('object_type', selObj)
          .eq('is_published', true)
          .eq('is_active', true)
          .order('sort_order');
        if (error) throw error;
        const cf = (data || []).map((f: any) => ({
          key:   `custom_data.${f.api_name}`,
          label: `[Custom] ${f.label}`,
        }));
        setCustomFields(cf);
        setExportFields([cfg.idField, ...cfg.columns.map(c => c.key), ...cf.map(f => f.key)]);
      } catch(e) {
        console.warn('[ImportExport] custom fields fetch failed:', e);
        setExportFields([cfg.idField, ...cfg.columns.map(c => c.key)]);
      }
    };
    fetchCustomFields();
  }, [selObj, supabase]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!supabase || !cfg) return;
    setExporting(true);
    setExportDone('');
    try {
      const cfKeys   = exportFields.filter(f => f.startsWith('custom_data.')).map(f => f.replace('custom_data.',''));
      const hasCustom = cfKeys.length > 0;

      // Select * to avoid column-not-found errors, filter client-side
      const { data, error } = await supabase
        .from(cfg.table)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setExportDone('✗ Export failed: ' + (error.message || error.details || JSON.stringify(error)));
        setExporting(false);
        return;
      }

      // Flatten custom_data fields into each row for export
      const flatData = (data || []).map((row: any) => {
        const flat: any = { ...row };
        if (hasCustom && row.custom_data) {
          cfKeys.forEach(k => { flat[`custom_data.${k}`] = row.custom_data?.[k] ?? ''; });
        }
        return flat;
      });

      setExportRows(flatData);

      // Build ordered columns for output: record_number first, then selected fields
      const outputCols = [cfg.idField, ...exportFields.filter(f => f !== cfg.idField)];

      if (exportFmt === 'csv') {
        // Human-readable headers
        const headerLabels = outputCols.map(f => {
          if (f === cfg.idField) return 'Record Number';
          const stdCol = cfg.columns.find(c => c.key === f);
          if (stdCol) return stdCol.label.replace(' *','');
          const cf = customFields.find(c => c.key === f);
          if (cf) return cf.label;
          return f;
        });
        const csvHeader = headerLabels.join(',');
        const csvBody   = flatData.map((r: any) => objToCsvRow(r, outputCols)).join('\n');
        downloadCsv(`${selObj}_export_${new Date().toISOString().slice(0,10)}.csv`, csvHeader + '\n' + csvBody);
      } else {
        const json = JSON.stringify(flatData, null, 2);
        const blob = new Blob([json], { type:'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `${selObj}_export_${new Date().toISOString().slice(0,10)}.json`; a.click();
        URL.revokeObjectURL(url);
      }

      addHistory('export', selObj, flatData.length, 'ok');
      setExportDone(`✓ Exported ${flatData.length} records`);
    } catch(e: any) {
      const msg = e?.message || e?.details || JSON.stringify(e) || 'Unknown error';
      console.error('[Export]', msg);
      addHistory('export', selObj, 0, 'error');
      setExportDone('✗ Export failed: ' + msg);
    }
    setExporting(false);
  };

  // Download template
  const downloadTemplate = () => {
    const allCols = [
      { key: cfg.idField, label: 'Record Number', example: '(auto-generated, leave blank)' },
      ...cfg.columns,
      ...customFields.map(f => ({ key: f.key.replace('custom_data.',''), label: f.label.replace('[Custom] ',''), example: '' })),
    ];
    const header  = allCols.map(c => c.key).join(',');
    const example = allCols.map(c => c.example || '').join(',');
    // Add a comment row explaining the template
    const comment = allCols.map(c => c.label).join(',');
    downloadCsv(`${selObj}_import_template.csv`, comment + '\n' + header + '\n' + example);
  };

  // ── Import: file upload ────────────────────────────────────────────────────
  const handleFileSelect = (file: File) => {
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = csvToRows(text);
      setImportParsed(parsed);
      // Auto-map columns: exact match first, then case-insensitive
      const autoMap: Record<string,string> = {};
      cfg.columns.forEach(col => {
        const exact  = parsed.headers.find(h => h === col.key);
        const icase  = parsed.headers.find(h => h.toLowerCase() === col.key.toLowerCase());
        const label  = parsed.headers.find(h => h.toLowerCase() === col.label.toLowerCase().replace(' *',''));
        autoMap[col.key] = exact || icase || label || '';
      });
      setColMap(autoMap);
      setImportStep('map');
    };
    reader.readAsText(file);
  };

  // ── Import: validate ───────────────────────────────────────────────────────
  const handleValidate = () => {
    if (!importParsed) return;
    const errors: { row:number, col:string, msg:string }[] = [];
    const valid: any[] = [];

    importParsed.rows.forEach((row, i) => {
      const rec: any = {};
      let rowHasError = false;

      cfg.columns.forEach(col => {
        const csvHeader = colMap[col.key];
        const rawVal    = csvHeader ? (row[csvHeader] ?? '').trim() : '';
        rec[col.key]    = rawVal;

        // Required check
        if (cfg.requiredCols.includes(col.key) && !rawVal) {
          errors.push({ row: i+2, col: col.key, msg: `"${col.label.replace(' *','')}" is required` });
          rowHasError = true;
        }
        // Numeric check
        if (['amount','price','cost','probability','tax_rate','gst_rate','vat_rate','stock'].includes(col.key) && rawVal && isNaN(Number(rawVal))) {
          errors.push({ row: i+2, col: col.key, msg: `"${col.key}" must be a number, got "${rawVal}"` });
          rowHasError = true;
        }
        // Date check
        if (['close_date','due_date','activity_date','expected_close_date'].includes(col.key) && rawVal && isNaN(Date.parse(rawVal))) {
          errors.push({ row: i+2, col: col.key, msg: `"${col.key}" must be a valid date (YYYY-MM-DD), got "${rawVal}"` });
          rowHasError = true;
        }
      });

      if (!rowHasError) valid.push(rec);
    });

    setValidation({ valid, errors });
    setImportStep('validate');
  };

  // ── Import: execute ────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!supabase || !currentUser) return;
    setImporting(true);
    const result = { created:0, updated:0, skipped:0, errors:[] as string[] };
    const now = new Date().toISOString();
    const sys = { created_by: currentUser.email, updated_by: currentUser.email, updated_at: now };

    // Get next sequence number for ID generation
    const { data: seqData } = await supabase
      .from(cfg.table)
      .select(cfg.idField)
      .order('created_at', { ascending: false })
      .limit(1);
    let seq = 1;
    if (seqData?.[0]?.[cfg.idField]) {
      const lastNum = parseInt(seqData[0][cfg.idField].split('-').pop() || '0', 10);
      seq = lastNum + 1;
    }

    // Process in batches of 50
    const BATCH = 50;
    for (let i = 0; i < validation.valid.length; i += BATCH) {
      const batch = validation.valid.slice(i, i + BATCH);

      if (importMode === 'create') {
        const rows = batch.map(rec => {
          const cfData: any = {};
          const stdData: any = {};
          Object.entries(rec).filter(([,v]) => v !== '').forEach(([k,v]) => {
            const numFields = ['amount','price','cost','mrp','probability','tax_rate','gst_rate','vat_rate','stock','stock_quantity','reorder_level','subtotal','total_discount','total_tax','shipping_cost'];
            if (k.startsWith('custom_data.')) {
              cfData[k.replace('custom_data.','')] = v;
            } else {
              stdData[k] = numFields.includes(k) ? Number(v) : v;
            }
          });
          return {
            ...sys, ...stdData,
            [cfg.idField]: generateDisplayId(cfg.idPrefix, seq++),
            ...(Object.keys(cfData).length ? { custom_data: cfData } : {}),
          };
        });
        const { error } = await supabase.from(cfg.table).insert(rows);
        if (error) { result.errors.push(`Batch ${Math.floor(i/BATCH)+1}: ${error.message}`); }
        else result.created += rows.length;

      } else {
        // Upsert: check if record exists by dupe key
        for (const rec of batch) {
          const dupeVal = rec[importDupeKey];
          if (!dupeVal) { result.skipped++; continue; }

          const { data: existing } = await supabase
            .from(cfg.table).select('id').eq(importDupeKey, dupeVal).maybeSingle();

          const cfData: any = {};
          const cleaned: any = {};
          const numFields = ['amount','price','cost','mrp','probability','tax_rate','gst_rate','vat_rate','stock','stock_quantity','reorder_level','subtotal','total_discount','total_tax','shipping_cost'];
          Object.entries(rec).filter(([,v]) => v !== '').forEach(([k,v]: [string,any]) => {
            if (k.startsWith('custom_data.')) { cfData[k.replace('custom_data.','')] = v; }
            else { cleaned[k] = numFields.includes(k) ? Number(v) : v; }
          });
          if (Object.keys(cfData).length) cleaned.custom_data = cfData;

          if (existing) {
            const { error } = await supabase.from(cfg.table).update({ ...cleaned, ...sys }).eq('id', existing.id);
            if (error) result.errors.push(`Update "${dupeVal}": ${error.message}`);
            else result.updated++;
          } else {
            const { error } = await supabase.from(cfg.table).insert({ ...sys, ...cleaned, [cfg.idField]: generateDisplayId(cfg.idPrefix, seq++) });
            if (error) result.errors.push(`Insert "${dupeVal}": ${error.message}`);
            else result.created++;
          }
        }
      }
    }

    setImportResult(result);
    addHistory('import', selObj, result.created + result.updated, result.errors.length ? 'error' : 'ok');
    setImporting(false);
    setImportStep('done');
  };

  const addHistory = (action: string, obj: string, count: number, status: 'ok'|'error') => {
    setHistory(p => [{
      ts: new Date().toLocaleString(), obj, action, count, status
    }, ...p].slice(0, 50));
  };

  const resetImport = () => {
    setImportStep('upload'); setImportFile(null); setImportParsed(null);
    setColMap({}); setValidation({ valid:[], errors:[] }); setImportResult(null);
  };

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const TabBtn = ({ id, label, icon }) => (
    <button onClick={()=>setTab(id)}
      className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${tab===id ? 'bg-[#0F172A] text-white shadow' : 'text-gray-500 hover:text-[#0F172A] hover:bg-gray-100'}`}>
      {icon} {label}
    </button>
  );

  const objGroups: Record<string, typeof availableObjects> = {};
  const b2bObjs = availableObjects.filter(([, c]) => c.group === 'B2B Enterprise');
  const b2cObjs = availableObjects.filter(([, c]) => c.group === 'B2C Retail');
  if (b2bObjs.length) objGroups['B2B Enterprise'] = b2bObjs;
  if (b2cObjs.length) objGroups['B2C Retail']     = b2cObjs;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F172A] to-emerald-900 rounded-[24px] p-6 text-white">
        <h2 className="text-2xl font-bold">📂 Data Import & Export</h2>
        <p className="text-white/60 text-sm mt-1">
          Enterprise-grade CSV/JSON import and export for all data objects — with field mapping, validation, and audit history.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-2 w-fit">
        <TabBtn id="export"  label="Export Data"  icon="⬇️" />
        <TabBtn id="import"  label="Import Data"  icon="⬆️" />
        <TabBtn id="history" label="History"      icon="🕐" />
      </div>

      {/* Object selector — shared */}
      {tab !== 'history' && (
        <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Select Object</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(objGroups).map(([group, items]) => (
              <div key={group} className="contents">
                {items.length > 0 && <span className="w-full text-xs font-bold text-gray-400 uppercase tracking-wider pt-2 first:pt-0">{group}</span>}
                {items.map(([key, ocfg]) => (
                  <button key={key} onClick={()=>{ setSelObj(key); resetImport(); setExportDone(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold border transition-all ${selObj===key ? 'bg-[#0F172A] text-white border-transparent shadow' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
                    <span>{ocfg.icon}</span> {ocfg.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── EXPORT TAB ── */}
      {tab === 'export' && (
        <div className="space-y-4">
          {/* Field selector */}
          <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#0F172A]">Fields to Export</h3>
              <div className="flex gap-2">
                <button onClick={()=>setExportFields([cfg.idField, ...cfg.columns.map(c=>c.key), ...customFields.map(f=>f.key)])}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold">Select All</button>
                <span className="text-gray-300">|</span>
                <button onClick={()=>setExportFields([])}
                  className="text-xs text-gray-400 hover:text-gray-600 font-semibold">Clear</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {/* Record Number — always first, always shown */}
              <label className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border text-sm transition-all ${exportFields.includes(cfg.idField) ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'border-gray-100 text-gray-500 hover:border-gray-300'}`}>
                <input type="checkbox" checked={exportFields.includes(cfg.idField)}
                  onChange={e => setExportFields(p => e.target.checked ? [cfg.idField, ...p] : p.filter(k => k !== cfg.idField))}
                  className="w-3.5 h-3.5 accent-emerald-600"/>
                <span className="truncate font-semibold">Record Number</span>
              </label>
              {/* Standard fields */}
              {cfg.columns.map(col => (
                <label key={col.key} className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border text-sm transition-all ${exportFields.includes(col.key) ? 'bg-blue-50 border-blue-200 text-blue-800' : 'border-gray-100 text-gray-500 hover:border-gray-300'}`}>
                  <input type="checkbox" checked={exportFields.includes(col.key)}
                    onChange={e => setExportFields(p => e.target.checked ? [...p, col.key] : p.filter(k => k !== col.key))}
                    className="w-3.5 h-3.5 accent-blue-600"/>
                  <span className="truncate">{col.label.replace(' *','')}</span>
                </label>
              ))}
              {/* Custom fields */}
              {customFields.map(cf => (
                <label key={cf.key} className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border text-sm transition-all ${exportFields.includes(cf.key) ? 'bg-purple-50 border-purple-200 text-purple-800' : 'border-gray-100 text-gray-500 hover:border-gray-300'}`}>
                  <input type="checkbox" checked={exportFields.includes(cf.key)}
                    onChange={e => setExportFields(p => e.target.checked ? [...p, cf.key] : p.filter(k => k !== cf.key))}
                    className="w-3.5 h-3.5 accent-purple-600"/>
                  <span className="truncate">{cf.label}</span>
                </label>
              ))}
            </div>
            {customFields.length > 0 && (
              <p className="text-xs text-purple-500 mt-2">🟣 Purple fields are custom fields from App Composer</p>
            )}
          </div>

          {/* Format + action */}
          <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Format</label>
                <div className="flex gap-2">
                  {(['csv','json'] as const).map(fmt => (
                    <button key={fmt} onClick={()=>setExportFmt(fmt)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${exportFmt===fmt ? 'bg-[#0F172A] text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 ml-auto">
                <button onClick={downloadTemplate}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-dashed border-gray-300 text-gray-600 text-sm font-semibold hover:border-blue-400 hover:text-blue-600">
                  📋 Download Template
                </button>
                <button onClick={handleExport} disabled={exporting || !exportFields.length}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#0F172A] to-emerald-800 text-white rounded-2xl text-sm font-bold shadow disabled:opacity-50">
                  {exporting ? '⏳ Exporting…' : `⬇️ Export ${cfg.label}`}
                </button>
              </div>
            </div>
            {exportDone && (
              <div className={`mt-3 px-4 py-2.5 rounded-xl text-sm font-semibold ${exportDone.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {exportDone}
              </div>
            )}
          </div>

          {/* Preview */}
          {exportRows.length > 0 && (
            <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-[#0F172A] mb-3">Preview (first 5 rows)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      {exportFields.map(f => <th key={f} className="px-3 py-2 text-left font-bold text-gray-500 whitespace-nowrap">{f}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {exportRows.slice(0,5).map((row,i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {exportFields.map(f => <td key={f} className="px-3 py-2 text-gray-700 truncate max-w-[150px]">{String(row[f]??'')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {exportRows.length > 5 && <p className="text-xs text-gray-400 mt-2 text-right">…and {exportRows.length - 5} more rows in the downloaded file</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── IMPORT TAB ── */}
      {tab === 'import' && (
        <div className="space-y-4">

          {/* Step indicator */}
          <div className="flex items-center gap-0">
            {[
              {id:'upload',   label:'1. Upload',   icon:'📁'},
              {id:'map',      label:'2. Map Fields',icon:'🔗'},
              {id:'validate', label:'3. Validate',  icon:'✅'},
              {id:'done',     label:'4. Import',    icon:'🚀'},
            ].map((step, i, arr) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${importStep===step.id ? 'bg-[#0F172A] text-white' : ['upload','map','validate','done'].indexOf(importStep) > i ? 'text-green-700 bg-green-50' : 'text-gray-400 bg-gray-50'}`}>
                  {step.icon} {step.label}
                </div>
                {i < arr.length-1 && <span className="mx-1 text-gray-300">→</span>}
              </div>
            ))}
          </div>

          {/* Step 1: Upload */}
          {importStep === 'upload' && (
            <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-8">
              <div className="text-center space-y-4">
                <div className="text-5xl">📁</div>
                <h3 className="font-bold text-[#0F172A] text-lg">Upload CSV File</h3>
                <p className="text-sm text-gray-400">Upload a .csv file to import {cfg.label}. The first row must be headers.</p>
                <div className="flex items-center justify-center gap-3">
                  <button onClick={downloadTemplate}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-dashed border-emerald-300 text-emerald-700 text-sm font-semibold hover:bg-emerald-50">
                    📋 Download Template
                  </button>
                </div>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-2xl p-10 hover:border-blue-400 cursor-pointer transition-all"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e=>{e.preventDefault();}}
                  onDrop={e=>{e.preventDefault(); const f=e.dataTransfer.files[0]; if(f?.name.endsWith('.csv'))handleFileSelect(f);}}>
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(f)handleFileSelect(f); }}/>
                  <div className="text-gray-400 text-sm">Click to browse or drag & drop a .csv file here</div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Map Fields */}
          {importStep === 'map' && importParsed && (
            <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[#0F172A]">Map CSV Columns to System Fields</h3>
                  <p className="text-sm text-gray-400 mt-0.5">{importParsed.rows.length} rows detected · Auto-mapped where column names match</p>
                </div>
                <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-semibold border border-blue-200">{importFile?.name}</span>
              </div>

              {/* Import mode */}
              <div className="bg-gray-50 rounded-[16px] p-4 space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Import Mode</h4>
                <div className="flex gap-3">
                  {([['create','➕ Create Only','Always insert new records — skip if duplicate'],
                     ['upsert','🔄 Create or Update','Update existing records, create new ones']] as const).map(([val, lbl, desc]) => (
                    <label key={val} className={`flex-1 cursor-pointer border rounded-2xl p-4 transition-all ${importMode===val?'border-blue-400 bg-blue-50':'border-gray-200 hover:border-blue-300'}`}>
                      <input type="radio" name="importMode" value={val} checked={importMode===val} onChange={()=>setImportMode(val)} className="hidden"/>
                      <div className="font-bold text-sm text-[#0F172A]">{lbl}</div>
                      <div className="text-xs text-gray-400 mt-1">{desc}</div>
                    </label>
                  ))}
                </div>
                {importMode === 'upsert' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Match existing records by</label>
                    <select value={importDupeKey} onChange={e=>setImportDupeKey(e.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                      {cfg.columns.map(c => <option key={c.key} value={c.key}>{c.label.replace(' *','')}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Field mapping table */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
                  <div>System Field</div>
                  <div>CSV Column</div>
                </div>
                {cfg.columns.map(col => (
                  <div key={col.key} className="grid grid-cols-2 gap-3 items-center">
                    <div className={`flex items-center gap-2 text-sm ${cfg.requiredCols.includes(col.key)?'font-bold text-[#0F172A]':'text-gray-600'}`}>
                      {cfg.requiredCols.includes(col.key) && <span className="text-red-500 text-xs">*</span>}
                      {col.label.replace(' *','')}
                    </div>
                    <select value={colMap[col.key]||''} onChange={e=>setColMap(p=>({...p,[col.key]:e.target.value}))}
                      className={`border rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 ${colMap[col.key] ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                      <option value="">— skip this field —</option>
                      {importParsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <button onClick={handleValidate}
                disabled={cfg.requiredCols.some(k => !colMap[k])}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#0F172A] to-blue-800 text-white font-bold text-sm disabled:opacity-50">
                Validate Data →
              </button>
            </div>
          )}

          {/* Step 3: Validate */}
          {importStep === 'validate' && (
            <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-2xl p-4 text-center border border-green-200">
                  <div className="text-3xl font-bold text-green-700">{validation.valid.length}</div>
                  <div className="text-xs text-green-600 font-semibold mt-1">Valid rows</div>
                </div>
                <div className={`rounded-2xl p-4 text-center border ${validation.errors.length ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className={`text-3xl font-bold ${validation.errors.length ? 'text-red-700' : 'text-gray-400'}`}>{validation.errors.length}</div>
                  <div className={`text-xs font-semibold mt-1 ${validation.errors.length ? 'text-red-600' : 'text-gray-400'}`}>Validation errors</div>
                </div>
                <div className="bg-blue-50 rounded-2xl p-4 text-center border border-blue-200">
                  <div className="text-3xl font-bold text-blue-700">{importParsed?.rows.length || 0}</div>
                  <div className="text-xs text-blue-600 font-semibold mt-1">Total rows</div>
                </div>
              </div>

              {validation.errors.length > 0 && (
                <div className="bg-red-50 rounded-2xl border border-red-200 p-4">
                  <h4 className="font-bold text-red-700 text-sm mb-2">⚠️ Validation Issues (rows with errors will be skipped)</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {validation.errors.map((e,i) => (
                      <div key={i} className="text-xs text-red-600 flex items-start gap-2">
                        <span className="font-bold shrink-0">Row {e.row}:</span>
                        <span>{e.msg}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview valid rows */}
              {validation.valid.length > 0 && (
                <div>
                  <h4 className="font-bold text-[#0F172A] text-sm mb-2">Preview (first 3 valid rows)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-gray-200 rounded-xl">
                      <thead className="bg-gray-50">
                        <tr>{cfg.columns.filter(c=>colMap[c.key]).map(c=><th key={c.key} className="px-3 py-2 text-left font-bold text-gray-500 whitespace-nowrap">{c.label.replace(' *','')}</th>)}</tr>
                      </thead>
                      <tbody>
                        {validation.valid.slice(0,3).map((row,i)=>(
                          <tr key={i} className="border-t border-gray-100">
                            {cfg.columns.filter(c=>colMap[c.key]).map(c=><td key={c.key} className="px-3 py-2 text-gray-700 max-w-[120px] truncate">{row[c.key]||''}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={()=>setImportStep('map')} className="px-5 py-2.5 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">
                  ← Back to Mapping
                </button>
                <button onClick={handleImport} disabled={importing || !validation.valid.length}
                  className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-[#0F172A] to-emerald-800 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {importing ? '⏳ Importing…' : `🚀 Import ${validation.valid.length} records`}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {importStep === 'done' && importResult && (
            <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-8 text-center space-y-5">
              <div className="text-6xl">{importResult.errors.length ? '⚠️' : '🎉'}</div>
              <h3 className="font-bold text-[#0F172A] text-xl">Import {importResult.errors.length ? 'Completed with Issues' : 'Successful'}</h3>
              <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
                  <div className="text-2xl font-bold text-green-700">{importResult.created}</div>
                  <div className="text-xs text-green-600 font-semibold mt-1">Created</div>
                </div>
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
                  <div className="text-2xl font-bold text-blue-700">{importResult.updated}</div>
                  <div className="text-xs text-blue-600 font-semibold mt-1">Updated</div>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                  <div className="text-2xl font-bold text-gray-600">{importResult.skipped}</div>
                  <div className="text-xs text-gray-500 font-semibold mt-1">Skipped</div>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="bg-red-50 rounded-2xl border border-red-200 p-4 text-left max-h-40 overflow-y-auto">
                  <p className="text-xs font-bold text-red-700 mb-2">Errors:</p>
                  {importResult.errors.map((e,i)=><p key={i} className="text-xs text-red-600">{e}</p>)}
                </div>
              )}
              <div className="flex gap-3 justify-center">
                <button onClick={resetImport}
                  className="px-6 py-2.5 rounded-2xl bg-[#0F172A] text-white text-sm font-bold">
                  Import More
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-[#0F172A]">Import / Export History</h3>
            <span className="text-xs text-gray-400">This session only · Clears on page refresh</span>
          </div>
          {history.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">No activity this session yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Time','Object','Action','Records','Status'].map(h=>(
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((h,i)=>(
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-500 text-xs font-mono">{h.ts}</td>
                    <td className="px-5 py-3 font-semibold text-[#0F172A]">{IMPORT_OBJECTS[h.obj]?.label || h.obj}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${h.action==='import'?'bg-blue-50 text-blue-700 border-blue-200':'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {h.action === 'import' ? '⬆️ Import' : '⬇️ Export'}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-bold text-[#0F172A]">{h.count}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${h.status==='ok'?'bg-green-50 text-green-700 border-green-200':'bg-red-50 text-red-700 border-red-200'}`}>
                        {h.status === 'ok' ? '✓ Success' : '✗ Issues'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
