// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import AppearancePanel from '@/components/admin/AppearancePanel';
import AppComposer from '@/components/admin/AppComposer';
import FieldLayoutDesigner from '@/components/admin/FieldLayoutDesigner';
import SecurityConsole from '@/components/admin/SecurityConsole';
import B2BAppComposer from '@/components/admin/B2BAppComposer';
import TenantAdminPanel from '@/components/admin/TenantAdminPanel';
import RetailInvoiceDesigner from '@/components/admin/RetailInvoiceDesigner';
import DocumentTemplateDesigner from '@/components/admin/DocumentTemplateDesigner';
import WarehousesPanel from '@/components/admin/WarehousesPanel';
import AppPreferencesPanel from '@/components/admin/AppPreferencesPanel';
import ImportExportPanel from '@/components/admin/ImportExportPanel';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';
import { formatDate, getStatusOptions, getObjectFields } from '@/lib/utils';
import Modal from '@/components/shared/Modal';
import { useAlert } from '@/components/shared/AlertProvider';
import { getRetailFieldMeta, RETAIL_CONFIG } from '@/components/retail/RetailListPage';

// ─── Shared styles ────────────────────────────────────────────────────────────
const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';
const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';
const tCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none';

const ALL_OBJECTS = ['customers','leads','opportunities','orders','invoices','contacts','activities','quotations','products'];
const RETAIL_OBJECTS_LIST = ['retailCustomers','retailProducts','retailActivities','retailOrders','retailInvoices'];
const RETAIL_OBJECT_LABELS: Record<string,string> = {
  retailCustomers: 'Retail Customers', retailProducts: 'Retail Products',
  retailActivities: 'Retail Activities', retailOrders: 'Retail Orders', retailInvoices: 'Retail Invoices',
};

// ─── Retail Admin Wrapper — provides consistent header for B2C admin panels ──
function RetailAdminWrapper({ title, icon, desc, children }) {
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-purple-900 to-purple-700 rounded-[24px] p-6 text-white">
        <h2 className="text-2xl font-bold flex items-center gap-2">{icon} {title}</h2>
        <p className="text-purple-200 text-sm mt-1">{desc}</p>
      </div>
      {children}
    </div>
  );
}

// ─── Rental Settings — which order statuses count as a real booking ─────────
// Derived directly from RETAIL_CONFIG (the single source of truth for what
// statuses a retail order can actually have) rather than a separately
// maintained list — a hardcoded duplicate here previously drifted out of
// sync and was missing "Pending", which genuinely is a valid order status.
const RETAIL_ORDER_STATUSES = RETAIL_CONFIG.retailOrders.statusOptions;
function RentalSettingsPanel() {
  const { appPreferences, saveAppPreferences } = useApp();
  const { showAlert } = useAlert();
  const [selected, setSelected] = useState<string[]>(appPreferences?.rental_blocking_statuses || ['Draft','Pending','Completed']);
  const [saving, setSaving] = useState(false);
  const isDirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...(appPreferences?.rental_blocking_statuses || ['Draft','Pending','Completed'])].sort());

  const toggle = (status: string) => setSelected(p => p.includes(status) ? p.filter(s => s !== status) : [...p, status]);

  const save = async () => {
    setSaving(true);
    const result = await saveAppPreferences({ ...appPreferences, rental_blocking_statuses: selected });
    setSaving(false);
    if (result?.success !== false) showAlert('Rental settings saved.', { variant:'success' });
  };

  return (
    <RetailAdminWrapper title="Rental Settings" icon="👗" desc="Configure which order statuses hold a booking and block other orders from renting the same item over the same dates.">
      <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5 space-y-4">
        <div>
          <h3 className="font-bold text-[#0F172A] mb-1">Blocking Statuses</h3>
          <p className="text-sm text-gray-500 mb-4">
            An order in one of these statuses holds its rental dates — no other order can book the same item for an overlapping date range while it's active. Orders in any other status (e.g. Cancelled, Refunded) free up those dates immediately.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {RETAIL_ORDER_STATUSES.map(status => (
              <label key={status} className={`flex items-center gap-2.5 p-3 rounded-2xl border-2 cursor-pointer transition-all ${selected.includes(status) ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="checkbox" checked={selected.includes(status)} onChange={()=>toggle(status)} className="w-4 h-4 accent-purple-600"/>
                <span className="text-sm font-semibold text-[#0F172A]">{status}</span>
              </label>
            ))}
          </div>
        </div>
        {selected.length === 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            ⚠️ No statuses selected — with none chosen, no order will ever hold a booking, and double-booking prevention will not function at all.
          </p>
        )}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          {isDirty && <span className="text-xs font-semibold text-amber-600">● Unsaved changes</span>}
          <button onClick={save} disabled={saving || !isDirty}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-purple-900 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 shadow-md">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </RetailAdminWrapper>
  );
}
const WHATSAPP_TEMPLATE_KEYS = [
  { key: 'rental_return_reminder', label: 'Rental Return Reminder', desc: 'Sent 2 days before a rental booking ends.', placeholders: ['Customer name', 'Item name', 'Return date', 'Order number'] },
  { key: 'booking_confirmation',   label: 'Booking Confirmation',   desc: 'Sent when a new booking or order is created.', placeholders: ['Customer name', 'Order number', 'Amount'] },
  { key: 'invoice_notice',         label: 'Invoice Notice',         desc: 'Used by the manual "Send WhatsApp" button on invoices.', placeholders: ['Customer name', 'Invoice number', 'Amount'] },
];

function WhatsAppSettingsPanel() {
  const { tenant } = useTenant();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [config, setConfig] = useState<any>({ is_active: false, phone_number_id: '', business_account_id: '', access_token: '', display_phone_number: '' });
  const [templates, setTemplates] = useState<Record<string, any>>({});

  const dbUrl = tenant?.db_url || undefined;
  const tenantId = tenant?.id || undefined;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ ...(dbUrl ? { db_url: dbUrl } : {}), ...(tenantId ? { tenantId } : {}) });
        const res = await fetch(`/api/whatsapp/config?${qs}`);
        const data = await res.json();
        if (data.config) setConfig(data.config);
        const tplMap: Record<string, any> = {};
        (data.templates || []).forEach((t: any) => { tplMap[t.template_key] = t; });
        setTemplates(tplMap);
      } catch (e) {
        console.error('[WhatsAppSettingsPanel] load', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [dbUrl, tenantId]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          db_url: dbUrl, tenantId, config,
          templates: WHATSAPP_TEMPLATE_KEYS.map(t => ({
            template_key: t.key,
            meta_template_name: templates[t.key]?.meta_template_name || '',
            language_code: templates[t.key]?.language_code || 'en_US',
            is_active: templates[t.key]?.is_active !== false,
            param_count: templates[t.key]?.param_count ?? t.placeholders.length,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      showAlert('WhatsApp settings saved.', { variant: 'success' });
    } catch (e: any) {
      showAlert('Could not save WhatsApp settings: ' + (e?.message || 'Unknown error'), { variant: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (config.access_token?.startsWith('••••')) {
      showAlert('Enter your Access Token again to test — it needs to be the real value, not the saved placeholder.', { variant: 'warning' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/whatsapp/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number_id: config.phone_number_id, access_token: config.access_token }),
      });
      const data = await res.json();
      setTestResult(res.ok ? { success: true, ...data } : { success: false, error: data.error });
    } catch (e: any) {
      setTestResult({ success: false, error: e?.message });
    } finally {
      setTesting(false);
    }
  };

  const iCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white';

  if (loading) return (
    <RetailAdminWrapper title="WhatsApp Integration" icon="💬" desc="Loading…"><div className="text-center py-10 text-gray-400">Loading…</div></RetailAdminWrapper>
  );

  return (
    <RetailAdminWrapper
      title="WhatsApp Integration"
      icon="💬"
      desc="Send booking reminders and updates automatically, and give staff a one-tap way to message customers directly."
    >
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 space-y-1.5">
        <p className="font-bold">Before you start</p>
        <p>Automatic sending requires a WhatsApp Business Platform account with Meta (or a provider like Twilio/360dialog), a verified business phone number, and message templates approved by Meta — free-form messages can only be sent within 24 hours of a customer messaging you first. This is a setup step on Meta's side, not something toggled on here alone.</p>
        <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer" className="text-amber-900 font-semibold underline">Meta's setup guide →</a>
      </div>

      <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[#0F172A]">Connection</h3>
            <p className="text-sm text-gray-500">Credentials from your Meta Business account (WhatsApp → API Setup).</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!config.is_active} onChange={e => setConfig((p: any) => ({ ...p, is_active: e.target.checked }))} className="w-5 h-5 accent-purple-600" />
            <span className="text-sm font-semibold text-[#0F172A]">Enabled</span>
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Phone Number ID</label>
            <input value={config.phone_number_id || ''} onChange={e => setConfig((p: any) => ({ ...p, phone_number_id: e.target.value }))} className={iCls} placeholder="e.g. 109876543210987" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">WhatsApp Business Account ID</label>
            <input value={config.business_account_id || ''} onChange={e => setConfig((p: any) => ({ ...p, business_account_id: e.target.value }))} className={iCls} placeholder="e.g. 123456789012345" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Access Token</label>
            <input type="password" value={config.access_token || ''} onChange={e => setConfig((p: any) => ({ ...p, access_token: e.target.value }))} className={iCls} placeholder="Paste your permanent access token" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Business Number (for display)</label>
            <input value={config.display_phone_number || ''} onChange={e => setConfig((p: any) => ({ ...p, display_phone_number: e.target.value }))} className={iCls} placeholder="+91 98765 43210" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={testConnection} disabled={testing || !config.phone_number_id || !config.access_token}
            className="px-5 py-2.5 rounded-xl border-2 border-purple-600 text-purple-700 text-sm font-bold hover:bg-purple-50 disabled:opacity-40">
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          {testResult && (
            testResult.success
              ? <span className="text-sm text-green-700 font-semibold">✓ Connected — {testResult.verifiedName || testResult.displayPhoneNumber || 'credentials verified'}</span>
              : <span className="text-sm text-red-600 font-semibold">✗ {testResult.error}</span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5 space-y-4">
        <div>
          <h3 className="font-bold text-[#0F172A]">Message Templates</h3>
          <p className="text-sm text-gray-500">Match each reminder type to the exact template name you got approved in Meta Business Manager.</p>
        </div>
        <div className="space-y-3">
          {WHATSAPP_TEMPLATE_KEYS.map(t => (
            <div key={t.key} className="border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm text-[#0F172A]">{t.label}</p>
                  <p className="text-xs text-gray-400">{t.desc} Placeholders in order: {t.placeholders.join(', ')}.</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                  <input type="checkbox" checked={templates[t.key]?.is_active !== false} onChange={e => setTemplates(p => ({ ...p, [t.key]: { ...p[t.key], is_active: e.target.checked } }))} className="w-4 h-4 accent-purple-600" />
                  <span className="text-xs font-semibold text-gray-500">Active</span>
                </label>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={templates[t.key]?.meta_template_name || ''} onChange={e => setTemplates(p => ({ ...p, [t.key]: { ...p[t.key], meta_template_name: e.target.value } }))} className={iCls} placeholder="Meta template name" />
                <input value={templates[t.key]?.language_code || 'en_US'} onChange={e => setTemplates(p => ({ ...p, [t.key]: { ...p[t.key], language_code: e.target.value } }))} className={iCls} placeholder="Language code (e.g. en_US)" />
              </div>
              <div className="mt-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Placeholders in your approved template</label>
                <select
                  value={templates[t.key]?.param_count ?? t.placeholders.length}
                  onChange={e => setTemplates(p => ({ ...p, [t.key]: { ...p[t.key], param_count: Number(e.target.value) } }))}
                  className={iCls + ' max-w-xs'}
                >
                  <option value={0}>None — plain static message</option>
                  {t.placeholders.map((_, i) => (
                    <option key={i} value={i + 1}>{i + 1} — through "{t.placeholders[i]}"</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">Must match the number of {'{{n}}'} placeholders Meta actually approved for this template — a mismatch causes error #132000.</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
        <button onClick={save} disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-purple-900 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 shadow-md">
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </RetailAdminWrapper>
  );
}
const RETAIL_FIELD_KEYS = ['retailCustomers','retailProducts','retailActivities','retailOrders','retailInvoices'];
// Fields available per object for conditions / update-field actions — derived
// from the SAME comprehensive field registry the list-view filters use
// (getRetailFieldMeta), rather than a separately-maintained short list that
// only ever covered 4-6 fields and silently excluded everything else on the
// object.
const RETAIL_CONDITION_FIELDS: Record<string,{v:string,l:string}[]> = Object.fromEntries(
  RETAIL_FIELD_KEYS.map(obj => [obj, getRetailFieldMeta(obj).filter(f => f.key !== 'id').map(f => ({ v: f.key, l: f.label }))])
);

const B2B_FIELD_LABELS: Record<string,string> = {
  name:'Name', customer:'Customer', contact:'Contact', owner:'Owner', status:'Status',
  amount:'Amount', price:'Price', cost:'Cost', stage:'Stage', source:'Source',
  industry:'Industry', phone:'Phone', email:'Email', website:'Website', gstNumber:'GST Number',
  billingAddress:'Billing Address', shippingAddress:'Shipping Address', city:'City', state:'State',
  postalCode:'Postal Code', country:'Country', description:'Description', designation:'Designation',
  department:'Department', mobile:'Mobile', isPrimary:'Primary Contact', linkedIn:'LinkedIn',
  productFamily:'Product Family', category:'Category', sku:'SKU', unit:'Unit', taxRate:'Tax Rate (%)',
  stock_quantity:'Stock on Hand', reorder_level:'Reorder Level', track_inventory:'Inventory Tracking',
  expectedCloseDate:'Expected Close Date', closeDate:'Close Date', probability:'Probability (%)',
  campaign:'Campaign', currency:'Currency', paymentTerms:'Payment Terms', deliveryDate:'Delivery Date',
  dueDate:'Due Date', activityType:'Activity Type', activityDate:'Activity Date', priority:'Priority',
  notes:'Notes', grand_total:'Grand Total', quote_number:'Quote Number',
};
const b2bFieldLabel = (k: string) => B2B_FIELD_LABELS[k] || k.replace(/([A-Z])/g,' $1').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase()).trim();
const B2B_OBJECT_KEYS = ['customers','leads','opportunities','orders','invoices','contacts','activities','quotations','products'];
// Same fix, B2B side — derived from getObjectFields(), the same comprehensive
// registry the B2B list-view filters use.
const CONDITION_FIELDS: Record<string,{v:string,l:string}[]> = Object.fromEntries(
  B2B_OBJECT_KEYS.map(obj => [obj, getObjectFields(obj).map(k => ({ v: k, l: b2bFieldLabel(k) }))])
);

// For a given object + field, return dropdown options (null = free text)
const getFieldOptions = (objType, field) => {
  if (!field) return null;
  // Retail objects: use the field's own opts from the canonical field
  // registry when available (e.g. Country, Loyalty Tier) — this also covers
  // fields not explicitly special-cased below.
  if (objType && RETAIL_FIELD_KEYS.includes(objType)) {
    const meta = getRetailFieldMeta(objType).find(f => f.key === field);
    if (meta?.opts?.length) return meta.opts;
    if (meta?.type === 'status') return getStatusOptions(objType);
  }
  if (field === 'status')        return getStatusOptions(objType);
  if (field === 'source')        return ['Website','Campaign','Referral','Cold Call','Trade Show','Partner'];
  if (field === 'stage')         return ['Qualification','Proposal Sent','Negotiation','Closed Won','Closed Lost'];
  if (field === 'activity_type' || field === 'activityType') return ['Call','Meeting','Email','Task','Demo'];
  if (field === 'industry')      return ['Technology','Healthcare','Finance','Retail','Manufacturing','Education','Other'];
  if (field === 'payment_terms' || field === 'paymentTerms') return ['Due on Receipt','Net 15','Net 30','Net 45'];
  if (field === 'priority')      return ['Low','Medium','High','Urgent'];
  if (field === 'department')    return ['Sales','Marketing','Engineering','Finance','Operations','HR','Support','Other'];
  return null; // free text
};

const OPERATORS = [
  {v:'equals',       l:'Equals'},
  {v:'not_equals',   l:'Not Equals'},
  {v:'contains',     l:'Contains'},
  {v:'not_contains', l:'Does Not Contain'},
  {v:'greater_than', l:'Greater Than'},
  {v:'less_than',    l:'Less Than'},
  {v:'greater_equal',l:'Greater Than or Equal'},
  {v:'less_equal',   l:'Less Than or Equal'},
  {v:'is_empty',     l:'Is Empty'},
  {v:'is_not_empty', l:'Is Not Empty'},
];

const ACTION_TYPES = [
  {v:'send_notification',l:'📧 Send Notification'},
  {v:'update_field',l:'✏️ Update Field'},
  {v:'assign_owner',l:'👤 Assign Owner'},
  {v:'create_task',l:'📋 Create Task'},
];

const NUMERIC_FIELDS = ['amount','probability','price','grand_total','cost','quantity',
  'taxRate','stock_quantity','reorder_level','loyalty_points','mrp','discount','tax_rate','gst_rate'];

const TRIGGER_EVENTS = [
  {v:'on_create',       l:'When record is Created'},
  {v:'on_update',       l:'When record is Updated'},
  {v:'on_delete',       l:'When record is Deleted'},
  {v:'on_status_change',l:'When Status changes'},
  {v:'on_field_change', l:'When Field changes'},
];

// ─── Label helper ─────────────────────────────────────────────────────────────
const L = ({t}) => <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1.5">{t}</label>;

// ═══════════════════════════ ORGANIZATIONS ════════════════════════════════════
function OrganizationsPanel() {
  const { organizations, saveOrganization, deleteAdminRecord, updateAdminStatus } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0F172A]">Organizations</h2><p className="text-gray-500 text-sm">{organizations.length} organization(s)</p></div>
        <button onClick={()=>{setEditing(null);setForm({status:'Active'});setOpen(true);}} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">+ Add Organization</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {organizations.map(org=>(
          <div key={org.id} className="bg-white rounded-[24px] border border-blue-100 shadow-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <div><h3 className="font-bold text-[#0F172A] text-lg">{org.name}</h3><p className="text-gray-400 text-xs mt-0.5">{org.organization_code}</p></div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${org.status==='Active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{org.status}</span>
            </div>
            <div className="text-sm text-gray-500 space-y-1">
              <div>Industry: <span className="text-[#0F172A] font-medium">{org.industry||'-'}</span></div>
              <div>Country: <span className="text-[#0F172A] font-medium">{org.country||'-'}</span></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>{setEditing(org);setForm({...org});setOpen(true);}} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-xl text-sm font-semibold">Edit</button>
              <button onClick={()=>updateAdminStatus('organizations',org.id,org.status==='Active'?'Inactive':'Active')} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl text-sm font-semibold">{org.status==='Active'?'Deactivate':'Activate'}</button>
              <button onClick={()=>deleteAdminRecord('organizations',org.id)} className="bg-red-100 hover:bg-red-200 text-red-600 px-3 py-2 rounded-xl text-sm font-semibold">🗑</button>
            </div>
          </div>
        ))}
        {organizations.length===0&&<div className="col-span-full py-12 text-center text-gray-400"><div className="text-5xl mb-3">🏢</div>No organizations yet.</div>}
      </div>
      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit Organization':'New Organization'} size="md"
        footer={<><button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-blue-200 text-sm font-semibold">Cancel</button><button onClick={async()=>{await saveOrganization(form,editing?.id);setOpen(false);}} className="px-5 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-2xl text-sm font-semibold">Save</button></>}>
        <div className="grid grid-cols-2 gap-4">
          {[['Organization Name','name',true],['Org Code','organization_code'],['Industry','industry'],['Website','website'],['Country','country'],['Currency','currency']].map(([label,field,required])=>(
            <div key={field}><L t={required?`${label} *`:label}/><input value={form[field]||''} onChange={e=>s(field,e.target.value)} placeholder={field==='website'?'example.com':undefined} className={iCls}/></div>
          ))}
          <div><L t="Status"/><select value={form.status||'Active'} onChange={e=>s('status',e.target.value)} className={sCls}><option>Active</option><option>Inactive</option></select></div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ BUSINESS UNITS ═══════════════════════════════════
function BusinessUnitsPanel() {
  const { businessUnits, organizations, saveBusinessUnit, deleteAdminRecord, updateAdminStatus } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({status:'Active'});
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0F172A]">Business Units</h2><p className="text-gray-500 text-sm">{businessUnits.length} unit(s)</p></div>
        <button onClick={()=>{setEditing(null);setForm({status:'Active'});setOpen(true);}} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">+ Add Business Unit</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {businessUnits.map(bu=>{
          const org=organizations.find(o=>o.id===bu.organization_id);
          return (
            <div key={bu.id} className="bg-white rounded-[24px] border border-blue-100 shadow-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div><h3 className="font-bold text-[#0F172A] text-lg">{bu.name}</h3><p className="text-gray-400 text-xs mt-0.5">{bu.business_unit_code}</p></div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${bu.status==='Active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{bu.status}</span>
              </div>
              <div className="text-sm text-gray-500"><div>Org: <span className="text-[#0F172A] font-medium">{org?.name||'-'}</span></div><div className="mt-1 text-xs text-gray-400">{bu.description}</div></div>
              <div className="flex gap-2 mt-4">
                <button onClick={()=>{setEditing(bu);setForm({...bu});setOpen(true);}} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-xl text-sm font-semibold">Edit</button>
                <button onClick={()=>deleteAdminRecord('business_units',bu.id)} className="bg-red-100 hover:bg-red-200 text-red-600 px-3 py-2 rounded-xl text-sm font-semibold">🗑</button>
              </div>
            </div>
          );
        })}
        {businessUnits.length===0&&<div className="col-span-full py-12 text-center text-gray-400"><div className="text-5xl mb-3">🏗️</div>No business units yet.</div>}
      </div>
      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit Business Unit':'New Business Unit'} size="md"
        footer={<><button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-blue-200 text-sm font-semibold">Cancel</button><button onClick={async()=>{await saveBusinessUnit(form,editing?.id);setOpen(false);}} className="px-5 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-2xl text-sm font-semibold">Save</button></>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><L t="Organization"/><select value={form.organization_id||''} onChange={e=>s('organization_id',e.target.value)} className={sCls}><option value="">Select Org</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}{o.status!=='Active'?' (Inactive)':''}</option>)}</select></div>
          {[['BU Name','name',true],['BU Code','business_unit_code'],['Description','description']].map(([label,field,required])=>(
            <div key={field}><L t={required?`${label} *`:label}/><input value={form[field]||''} onChange={e=>s(field,e.target.value)} className={iCls}/></div>
          ))}
          <div><L t="Status"/><select value={form.status||'Active'} onChange={e=>s('status',e.target.value)} className={sCls}><option>Active</option><option>Inactive</option></select></div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ USERS ════════════════════════════════════════════
function UsersPanel() {
  const { enterpriseUsers, organizations, businessUnits, roles, saveEnterpriseUser, adminResetPassword, updateAdminStatus, fetchEnterpriseUsers } = useApp();
  const { supabase } = useTenant();
  const { showAlert } = useAlert();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ status:'Active', designation:'', username:'', first_name:'', last_name:'', email:'', phone:'', employee_code:'', organization_id:'', business_unit_id:'', role_id:'' });
  const [extraRoles, setExtraRoles] = useState([]); // multi-role
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPwUserId, setResetPwUserId] = useState(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const s = (k,v) => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === 'email') next.username = v; // auto-populate username
    if (k === 'organization_id') next.business_unit_id = ''; // reset BU on org change
    return next;
  });

  const filtered = enterpriseUsers.filter(u=>[u.first_name,u.last_name,u.email,u.employee_code].some(v=>v?.toLowerCase().includes(search.toLowerCase())));

  const handleSave = async () => {
    // Validate names — reject purely numeric or special-character-only values
    if (!form.first_name?.trim()) { showAlert('First Name is required.', { variant:'warning' }); return; }
    if (!form.last_name?.trim())  { showAlert('Last Name is required.', { variant:'warning' }); return; }
    if (!/[a-zA-Z]/.test(form.first_name)) { showAlert('First Name must contain letters — numbers or symbols alone are not a valid name.', { variant:'warning' }); return; }
    if (!/[a-zA-Z]/.test(form.last_name))  { showAlert('Last Name must contain letters — numbers or symbols alone are not a valid name.', { variant:'warning' }); return; }
    // Validate email
    if (!form.email?.trim()) { showAlert('Email is required.', { variant:'warning' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) { showAlert('Invalid email format.', { variant:'warning' }); return; }
    // Validate phone
    if (form.phone) {
      const digits = (form.phone as string).replace(/[\s\-\+\(\)]/g,'');
      if (!/^\d+$/.test(digits)) { showAlert('Phone must contain digits only.', { variant:'warning' }); return; }
      if (digits.length < 7 || digits.length > 15) { showAlert('Phone must be 7-15 digits.', { variant:'warning' }); return; }
    }
    if (!editing) {
      if (!password) { showAlert('Password is required for new users.', { variant:'warning' }); return; }
      if (password !== confirmPassword) { showAlert('Passwords do not match.', { variant:'warning' }); return; }
      if (password.length < 6) { showAlert('Password must be at least 6 characters.', { variant:'warning' }); return; }
    }
    setSaving(true);
    try {
    if (editing) {
      if (editing.auth_user_id && password && password.length >= 6) {
        // Has auth — reset password only
        await adminResetPassword(editing.auth_user_id, password);
      } else if (!editing.auth_user_id && password && password.length >= 6) {
        // No auth — call /api/users/create directly to create auth + link
        const tenant = (window as any).__bp_tenant || {};
        try {
          const res = await fetch('/api/users/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email:      form.email,
              password,
              first_name: form.first_name || '',
              last_name:  form.last_name  || '',
              role_id:    form.role_id    || null,
              is_admin:   form.is_admin   || false,
              status:     form.status     || 'Active',
              db_url:     tenant.db_url   || null,
            }),
          });
          const json = await res.json();
          if (json.success && json.auth_user_id) {
            // Update enterprise_user with auth_user_id
            await saveEnterpriseUser({ ...form, auth_user_id: json.auth_user_id }, editing.id, undefined);
            setOpen(false); setPassword(''); setConfirmPassword('');
            return;
          } else {
            showAlert('Failed to create auth: ' + (json.error || 'Unknown'), { variant:'danger', title:'Error' });
          }
        } catch(e: any) { showAlert('Error: ' + e.message, { variant:'danger', title:'Error' }); }
      }
      // Normal update
      await saveEnterpriseUser(form, editing.id, undefined);
    } else {
      await saveEnterpriseUser(form, undefined, password);
    }
    setOpen(false);
    setPassword('');
    setConfirmPassword('');
    // Save extra roles to user_roles table
    if (extraRoles.length > 0 || editing) {
      const bp = (window as any).__bp_supabase;
      if (bp) {
        try {
          // Find enterprise_user id
          const { data: eu } = await bp.from('enterprise_users').select('id').eq('email', form.email).maybeSingle();
          if (eu?.id) {
            // Delete old extra roles and re-insert
            await bp.from('user_roles').delete().eq('enterprise_user_id', eu.id);
            if (extraRoles.length > 0) {
              await bp.from('user_roles').insert(extraRoles.map((rid: string) => ({ enterprise_user_id: eu.id, role_id: rid })));
            }
          }
        } catch(e) { console.warn('user_roles save:', e); }
      }
    }
    } catch (e: any) {
      console.error('[AdminToolsPage] Create/Save User', e);
      showAlert('Save failed: ' + (e?.message || 'An unexpected error occurred.'), { variant:'danger', title:'Save Failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwValue || resetPwValue.length < 6) { showAlert('Password must be at least 6 characters.', { variant:'warning' }); return; }
    const user = enterpriseUsers.find(u => u.id === resetPwUserId);
    await adminResetPassword(user?.auth_user_id, resetPwValue);
    setResetPwUserId(null);
    setResetPwValue('');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0F172A]">Enterprise Users</h2><p className="text-gray-500 text-sm">{enterpriseUsers.length} user(s)</p></div>
        <button onClick={()=>{setEditing(null);setForm({status:'Active',designation:'',username:'',first_name:'',last_name:'',email:'',phone:'',employee_code:'',organization_id:'',business_unit_id:'',role_id:''});setExtraRoles([]);setPassword('');setConfirmPassword('');setOpen(true);}} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">+ Add User</button>
      </div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users by name, email, code..." className={iCls}/>

      <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-[#0F172A] to-blue-900 text-white">
            <tr>{['Code','Name','Email','Designation','Auth','Status','Actions'].map(h=><th key={h} className="px-5 py-3 text-left text-sm font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length===0
              ? <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No users found.</td></tr>
              : filtered.map(u=>(
                <tr key={u.id} className="border-t border-blue-50 hover:bg-blue-50/40">
                  <td className="px-5 py-3 text-xs font-mono text-gray-400">{u.employee_code||'-'}</td>
                  <td className="px-5 py-3 font-semibold text-[#0F172A]">{u.first_name} {u.last_name}</td>
                  <td className="px-5 py-3 text-gray-500">{u.email}</td>
                  <td className="px-5 py-3 text-gray-500">{u.designation||'-'}</td>
                  <td className="px-5 py-3">
                    {u.auth_user_id
                      ? <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">✓ Linked</span>
                      : <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2.5 py-0.5 rounded-full">No auth</span>
                    }
                  </td>
                  <td className="px-5 py-3"><span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.status==='Active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{u.status}</span></td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={async()=>{
                        setEditing(u);setForm({...u,designation:u.designation||''});setPassword('');setConfirmPassword('');
                        // Load extra roles
                        const bp = (window as any).__bp_supabase;
                        if (bp) {
                          const { data } = await bp.from('user_roles').select('role_id').eq('enterprise_user_id', u.id);
                          setExtraRoles((data||[]).map((r:any)=>r.role_id));
                        } else { setExtraRoles([]); }
                        setOpen(true);
                      }} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-semibold">Edit</button>
                      {u.auth_user_id && <button onClick={()=>{setResetPwUserId(u.id);setResetPwValue('');}} className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-xl text-xs font-semibold">Reset PW</button>}
                      <button onClick={()=>updateAdminStatus('enterprise_users',u.id,u.status==='Active'?'Inactive':'Active')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-semibold">{u.status==='Active'?'Deactivate':'Activate'}</button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* Create / Edit User Modal */}
      <Modal open={open} onClose={()=>setOpen(false)} title={editing?`Edit User: ${editing.first_name} ${editing.last_name}`:'New Enterprise User'} size="lg"
        footer={
          <><button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-blue-200 text-sm font-semibold">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-2xl text-sm font-semibold disabled:opacity-50">
            {saving ? (editing?'Saving...':'Creating user...') : (editing?'Save Changes':'Create User')}
          </button></>
        }>
        <div className="space-y-5">
          {/* Profile fields */}
          <div className="grid grid-cols-2 gap-4">
            {([
              ['First Name *','first_name','text'],
              ['Last Name *','last_name','text'],
              ['Email *','email','email'],
              ['Phone','phone','tel'],
              ['Employee Code','employee_code','text'],
              ['Username','username','text'],
              ['Designation','designation','text'],
            ] as [string,string,string][]).map(([label,field,type])=>(
              <div key={field}>
                <L t={label}/>
                <input
                  value={(form as any)[field]||''}
                  onChange={e=>s(field,e.target.value)}
                  type={type}
                  autoComplete="off"
                  disabled={field==='email'&&!!editing}
                  maxLength={field==='phone'?20:field==='designation'?100:undefined}
                  className={`${iCls} ${field==='email'&&editing?'bg-gray-50 text-gray-400':''}`}
                  placeholder={
                    field==='email'&&editing?'Cannot change email':
                    field==='phone'?'+91 9876543210':
                    field==='designation'?'e.g. Sales Executive':
                    field==='username'?'Auto-filled from email':
                    ''
                  }
                />
              </div>
            ))}
            <div><L t="Organization"/><select value={(form as any).organization_id||''} onChange={e=>s('organization_id',e.target.value)} className={sCls}><option value="">Select Organization</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}{o.status!=='Active'?' (Inactive)':''}</option>)}</select></div>
            <div><L t="Business Unit"/><select value={(form as any).business_unit_id||''} onChange={e=>s('business_unit_id',e.target.value)} className={sCls} disabled={!(form as any).organization_id}><option value="">{(form as any).organization_id?'Select Business Unit':'Select org first'}</option>{businessUnits.filter(b=>!(form as any).organization_id||b.organization_id===(form as any).organization_id).map(b=><option key={b.id} value={b.id}>{b.name}{b.status!=='Active'?' (Inactive)':''}</option>)}</select></div>
            <div className="col-span-2">
              <L t="Primary Role"/>
              <select value={(form as any).role_id||''} onChange={e=>s('role_id',e.target.value)} className={sCls}>
                <option value="">No Role Assigned</option>
                {roles.map(r=><option key={r.id} value={r.id}>{r.role_name} ({r.data_scope||'own'})</option>)}
              </select>
              {(form as any).role_id && <div className="text-xs text-blue-600 mt-1">Primary role permissions apply on next login.</div>}
            </div>
            <div className="col-span-2">
              <L t="Additional Roles (Multi-Role)"/>
              <p className="text-xs text-gray-400 mb-2">Select additional roles — permissions are combined across all assigned roles.</p>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3">
                {roles.filter(r=>r.id!==(form as any).role_id).map(r=>(
                  <label key={r.id} className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer border text-sm transition-all ${extraRoles.includes(r.id)?'bg-blue-50 border-blue-300 text-blue-800':'border-gray-100 hover:border-blue-200'}`}>
                    <input type="checkbox" checked={extraRoles.includes(r.id)}
                      onChange={e=>setExtraRoles(p=>e.target.checked?[...p,r.id]:p.filter(x=>x!==r.id))}
                      className="w-4 h-4 accent-blue-600 flex-shrink-0"/>
                    <div>
                      <div className="font-semibold text-xs">{r.role_name}</div>
                      <div className="text-[10px] text-gray-400">Scope: {r.data_scope||'own'}</div>
                    </div>
                  </label>
                ))}
              </div>
              {extraRoles.length > 0 && <div className="text-xs text-green-600 mt-1">✓ {extraRoles.length} additional role{extraRoles.length>1?'s':''} selected</div>}
            </div>
            <div><L t="Status"/><select value={(form as any).status||'Active'} onChange={e=>s('status',e.target.value)} className={sCls}><option>Active</option><option>Inactive</option></select></div>
          </div>

          {/* Password — only shown when creating new user */}
          {!editing && (
            <div className="bg-blue-50 rounded-2xl p-4 space-y-3">
              <h4 className="font-bold text-[#0F172A] text-sm">🔐 Set Login Password</h4>
              <p className="text-xs text-gray-500">This creates a Supabase Auth account so the user can log in immediately. Minimum 6 characters.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <L t="Password *"/>
                  <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min. 6 characters" className={iCls}/>
                </div>
                <div>
                  <L t="Confirm Password *"/>
                  <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter password" className={`${iCls} ${confirmPassword&&password!==confirmPassword?'border-red-300 bg-red-50':''}`}/>
                  {confirmPassword && password !== confirmPassword && <p className="text-red-500 text-xs mt-1">Passwords do not match</p>}
                </div>
              </div>
            </div>
          )}

          {/* Auth status when editing */}
          {editing && (
            <div className={`rounded-2xl p-4 ${editing.auth_user_id?'bg-green-50 border border-green-200':'bg-yellow-50 border border-yellow-200'}`}>
              {editing.auth_user_id
                ? <div className="space-y-2">
                    <p className="text-sm text-green-700">✅ Linked auth account: <span className="font-mono text-xs">{editing.auth_user_id?.slice(0,16)}...</span></p>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Reset Password (optional)</label>
                      <div className="flex gap-2">
                        <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                          placeholder="New password (leave blank to keep current)"
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                        <button onClick={async()=>{
                          if(!password){showAlert('Enter a new password', { variant:'warning' });return;}
                          if(password.length<6){showAlert('Min 6 characters', { variant:'warning' });return;}
                          await adminResetPassword(editing.auth_user_id, password);
                          setPassword('');
                          showAlert('Password reset successfully', { variant:'success', title:'Password Reset' });
                        }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold whitespace-nowrap">
                          Reset PW
                        </button>
                      </div>
                    </div>
                  </div>
                : <div className="space-y-2">
                    <p className="text-sm text-yellow-700">⚠️ No auth account — set a password to create login access.</p>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Set Password *</label>
                      <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                        placeholder="Set login password"
                        className="w-full border border-yellow-300 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400"/>
                    </div>
                  </div>
              }
            </div>
          )}
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetPwUserId} onClose={()=>{setResetPwUserId(null);setResetPwValue('');}} title="Reset User Password" size="sm"
        footer={
          <><button onClick={()=>{setResetPwUserId(null);setResetPwValue('');}} className="px-5 py-2.5 rounded-2xl border border-blue-200 text-sm font-semibold">Cancel</button>
          <button onClick={handleResetPassword} className="px-5 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-2xl text-sm font-semibold">Reset Password</button></>
        }>
        <div className="space-y-4">
          {(() => { const u = enterpriseUsers.find(x=>x.id===resetPwUserId); return u && <p className="text-sm text-gray-500">Setting new password for <span className="font-semibold text-[#0F172A]">{u.first_name} {u.last_name}</span> ({u.email})</p>; })()}
          <div>
            <L t="New Password"/>
            <input type="password" value={resetPwValue} onChange={e=>setResetPwValue(e.target.value)} placeholder="Min. 6 characters" className={iCls}/>
          </div>
          <div className="bg-yellow-50 rounded-xl p-3 text-xs text-yellow-700">The user will be able to log in with this new password immediately. They will not receive an email notification.</div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ USER GROUPS ══════════════════════════════════════
function UserGroupsPanel() {
  const { userGroups, userGroupMembers, enterpriseUsers, saveUserGroup, deleteAdminRecord, addUsersToGroup, removeUserFromGroup, fetchGroupMembers } = useApp();
  const [open, setOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  const [form, setForm] = useState({status:'Active'});
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const openMembers = async(group)=>{setActiveGroup(group);await fetchGroupMembers(group.id);setMembersOpen(true);};

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0F172A]">User Groups</h2><p className="text-gray-500 text-sm">{userGroups.length} group(s)</p></div>
        <button onClick={()=>{setEditing(null);setForm({status:'Active'});setOpen(true);}} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">+ Add Group</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {userGroups.map(g=>(
          <div key={g.id} className="bg-white rounded-[24px] border border-blue-100 shadow-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <div><h3 className="font-bold text-[#0F172A] text-lg">{g.group_name}</h3><p className="text-gray-400 text-xs mt-0.5">{g.group_code}</p></div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${g.status==='Active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{g.status}</span>
            </div>
            <p className="text-sm text-gray-400">{g.description||'No description'}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>openMembers(g)} className="flex-1 bg-purple-100 hover:bg-purple-200 text-purple-700 py-2 rounded-xl text-sm font-semibold">👥 Members</button>
              <button onClick={()=>{setEditing(g);setForm({...g});setOpen(true);}} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-xl text-sm font-semibold">Edit</button>
              <button onClick={()=>deleteAdminRecord('user_groups',g.id)} className="bg-red-100 hover:bg-red-200 text-red-600 px-3 py-2 rounded-xl text-sm font-semibold">🗑</button>
            </div>
          </div>
        ))}
        {userGroups.length===0&&<div className="col-span-full py-12 text-center text-gray-400"><div className="text-5xl mb-3">👥</div>No user groups yet.</div>}
      </div>
      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit Group':'New Group'} size="md"
        footer={<><button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-blue-200 text-sm font-semibold">Cancel</button><button onClick={async()=>{await saveUserGroup(form,editing?.id);setOpen(false);}} className="px-5 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-2xl text-sm font-semibold">Save</button></>}>
        <div className="grid grid-cols-2 gap-4">
          {[['Group Name','group_name'],['Group Code','group_code'],['Description','description']].map(([label,field])=>(
            <div key={field}><L t={label}/><input value={form[field]||''} onChange={e=>s(field,e.target.value)} className={iCls}/></div>
          ))}
          <div><L t="Status"/><select value={form.status||'Active'} onChange={e=>s('status',e.target.value)} className={sCls}><option>Active</option><option>Inactive</option></select></div>
        </div>
      </Modal>
      <Modal open={membersOpen} onClose={()=>{setMembersOpen(false);setSelectedUserIds([]);}} title={`Members: ${activeGroup?.group_name}`} size="lg"
        footer={<><button onClick={()=>setMembersOpen(false)} className="px-5 py-2.5 rounded-2xl border border-blue-200 text-sm font-semibold">Close</button><button onClick={async()=>{if(activeGroup){await addUsersToGroup(activeGroup.id,selectedUserIds,userGroupMembers);setSelectedUserIds([]);}}} className="px-5 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-2xl text-sm font-semibold">Add Selected</button></>}>
        <div className="space-y-5">
          <div>
            <h4 className="font-bold text-[#0F172A] mb-3">Current Members ({userGroupMembers.length})</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {userGroupMembers.map(m=>(
                <div key={m.id} className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-2.5">
                  <div><div className="font-semibold text-sm text-[#0F172A]">{m.enterprise_users?.first_name} {m.enterprise_users?.last_name}</div><div className="text-xs text-gray-400">{m.enterprise_users?.email}</div></div>
                  <button onClick={()=>removeUserFromGroup(m.id,activeGroup?.id)} className="text-red-500 text-xs font-semibold hover:underline">Remove</button>
                </div>
              ))}
              {userGroupMembers.length===0&&<div className="text-gray-400 text-sm">No members yet.</div>}
            </div>
          </div>
          <div>
            <h4 className="font-bold text-[#0F172A] mb-3">Add Users</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {enterpriseUsers.filter(u=>!userGroupMembers.some(m=>m.enterprise_user_id===u.id)).map(u=>(
                <label key={u.id} className="flex items-center gap-3 cursor-pointer p-2.5 hover:bg-blue-50 rounded-xl">
                  <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={()=>setSelectedUserIds(prev=>prev.includes(u.id)?prev.filter(id=>id!==u.id):[...prev,u.id])} className="w-4 h-4 accent-blue-600"/>
                  <div><div className="font-semibold text-sm text-[#0F172A]">{u.first_name} {u.last_name}</div><div className="text-xs text-gray-400">{u.email}</div></div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ SECURITY CONSOLE ═════════════════════════════════
function SecurityConsolePanel() {
  const { roles, permissions, saveRole, deleteAdminRecord, fetchRolePermissions } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({status:'Active'});
  const [selectedPerms, setSelectedPerms] = useState([]);
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));
  const modules = [...new Set(permissions.map(p=>p.module_name))];

  const openForm = async(role)=>{
    setEditing(role||null); setForm(role||{status:'Active'}); setSelectedPerms([]);
    if(role){const rp=await fetchRolePermissions(role.id);setSelectedPerms(rp.map(r=>r.permission_id));}
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0F172A]">Roles & Security</h2><p className="text-gray-500 text-sm">Manage roles and permissions</p></div>
        <button onClick={()=>openForm(null)} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">+ Add Role</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {roles.map(role=>(
          <div key={role.id} className="bg-white rounded-[24px] border border-blue-100 shadow-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <div><h3 className="font-bold text-[#0F172A] text-lg">{role.role_name}</h3><p className="text-gray-400 text-xs mt-0.5">{role.role_code}</p></div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${role.status==='Active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{role.status}</span>
            </div>
            <p className="text-sm text-gray-400">{role.description||'No description'}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>openForm(role)} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-xl text-sm font-semibold">Edit & Permissions</button>
              <button onClick={()=>deleteAdminRecord('roles',role.id)} className="bg-red-100 hover:bg-red-200 text-red-600 px-3 py-2 rounded-xl text-sm font-semibold">🗑</button>
            </div>
          </div>
        ))}
        {roles.length===0&&<div className="col-span-full py-12 text-center text-gray-400"><div className="text-5xl mb-3">🔐</div>No roles yet.</div>}
      </div>
      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit Role':'New Role'} size="xl"
        footer={<><button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-blue-200 text-sm font-semibold">Cancel</button><button onClick={async()=>{await saveRole(form,editing?.id||null,selectedPerms);setOpen(false);}} className="px-5 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-2xl text-sm font-semibold">Save Role</button></>}>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {[['Role Name','role_name'],['Role Code','role_code']].map(([label,field])=>(
              <div key={field}><L t={label}/><input value={form[field]||''} onChange={e=>s(field,e.target.value)} className={iCls}/></div>
            ))}
            <div className="col-span-2"><L t="Description"/><input value={form.description||''} onChange={e=>s('description',e.target.value)} className={iCls}/></div>
          </div>
          <div>
            <h3 className="font-bold text-[#0F172A] mb-4">Permissions</h3>
            <div className="space-y-4">
              {modules.map(module=>(
                <div key={module}>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{module}</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {permissions.filter(p=>p.module_name===module).map(p=>(
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-blue-50">
                        <input type="checkbox" checked={selectedPerms.includes(p.id)} onChange={()=>setSelectedPerms(prev=>prev.includes(p.id)?prev.filter(x=>x!==p.id):[...prev,p.id])} className="w-4 h-4 accent-blue-600"/>
                        <span className="text-sm text-[#0F172A]">{p.permission_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ WORKFLOW BUILDER ══════════════════════════════════
// ── Shared condition builder ─────────────────────────────────────────────────

function ConditionRow({ fields, condition, onChange, onRemove, users, objType }) {
  const opts = getFieldOptions(objType, condition.field);
  const noValue = ['is_empty','is_not_empty'].includes(condition.operator);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={condition.field||''} onChange={e=>onChange({...condition,field:e.target.value,value:''})}
        className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-[140px]">
        <option value="">Select field...</option>
        {fields.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
      </select>
      <select value={condition.operator||'equals'} onChange={e=>onChange({...condition,operator:e.target.value})}
        className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
        {OPERATORS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      {!noValue && (
        opts
          ? <select value={condition.value||''} onChange={e=>onChange({...condition,value:e.target.value})}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-[140px]">
              <option value="">Select value...</option>
              {opts.map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          : <input value={condition.value||''} onChange={e=>onChange({...condition,value:e.target.value})}
              placeholder="Value..." className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-[140px]"/>
      )}
      <button onClick={onRemove} className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-lg">×</button>
    </div>
  );
}

function ConditionBuilder({ fields, conditions, logic, onChange, objType }) {
  const addCond = () => onChange({ logic, conditions: [...conditions, {field:'',operator:'equals',value:''}] });
  const updCond = (i,c) => onChange({ logic, conditions: conditions.map((x,j)=>j===i?c:x) });
  const remCond = (i) => onChange({ logic, conditions: conditions.filter((_,j)=>j!==i) });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-600">Match</span>
        {['AND','OR'].map(l=>(
          <button key={l} onClick={()=>onChange({logic:l,conditions})}
            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${logic===l?'bg-[#0F172A] text-white border-transparent':'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
            {l}
          </button>
        ))}
        <span className="text-sm text-gray-400">of these conditions</span>
      </div>
      {conditions.map((c,i)=>(
        <ConditionRow key={i} fields={fields} condition={c} objType={objType}
          onChange={nc=>updCond(i,nc)} onRemove={()=>remCond(i)} />
      ))}
      <button onClick={addCond} className="text-sm text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
        + Add Condition
      </button>
    </div>
  );
}

function ActionBuilder({ action, idx, users, fields, objectType, onChange, onRemove }) {
  const cfg = action.action_config || {};
  const setcfg = (k,v) => onChange({ ...action, action_config: { ...cfg, [k]: v } });
  const updateFieldOpts = cfg.field ? getFieldOptions(objectType, cfg.field) : null;

  return (
    <div className="bg-gray-50 rounded-[16px] p-4 space-y-3 border border-gray-200">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-gray-400 w-6">#{idx+1}</span>
        <select value={action.action_type||'send_notification'} onChange={e=>onChange({...action,action_type:e.target.value,action_config:{}})}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
          {ACTION_TYPES.map(a=><option key={a.v} value={a.v}>{a.l}</option>)}
        </select>
        <button onClick={onRemove} className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-lg">×</button>
      </div>

      {action.action_type === 'send_notification' && (
        <div className="space-y-2 ml-9">
          <input value={cfg.subject||''} onChange={e=>setcfg('subject',e.target.value)}
            placeholder="Notification subject *" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
          <textarea value={cfg.message||''} onChange={e=>setcfg('message',e.target.value)}
            placeholder="Notification message... Use {{name}}, {{status}}, {{amount}} for record fields" rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"/>
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={cfg.notify_owner!==false} onChange={e=>setcfg('notify_owner',e.target.checked)} className="w-3.5 h-3.5 accent-blue-600 rounded"/>
              <span className="text-xs font-semibold text-gray-600">Notify record owner</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={!!cfg.notify_submitter} onChange={e=>setcfg('notify_submitter',e.target.checked)} className="w-3.5 h-3.5 accent-blue-600 rounded"/>
              <span className="text-xs font-semibold text-gray-600">Notify creator</span>
            </label>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Specific Users</label>
            <select multiple value={cfg.user_ids||[]} onChange={e=>setcfg('user_ids',Array.from(e.target.selectedOptions).map(o=>o.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 min-h-[72px]">
              {users.map(u=><option key={u.id} value={u.id}>{`${u.first_name||''} ${u.last_name||''}`.trim()||u.email}</option>)}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">Cmd/Ctrl+click to select multiple</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Other Email Addresses (comma-separated)</label>
            <input value={(cfg.recipients||[]).join(', ')} onChange={e=>setcfg('recipients',e.target.value.split(',').map(x=>x.trim()).filter(Boolean))}
              placeholder="external@company.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
          </div>
        </div>
      )}

      {action.action_type === 'update_field' && (
        <div className="space-y-2 ml-9">
          <select value={cfg.field||''} onChange={e=>onChange({...action, action_config:{...cfg, field:e.target.value, value:''}})}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="">Select field to update... *</option>
            {fields.filter(f=>f.v!=='owner').map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
          </select>
          <p className="text-[10px] text-gray-400">To change the owner, use the "Assign Owner" action instead.</p>
          {cfg.field && (
            updateFieldOpts
              ? <select value={cfg.value||''} onChange={e=>setcfg('value',e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                  <option value="">Select new value... *</option>
                  {updateFieldOpts.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              : NUMERIC_FIELDS.includes(cfg.field)
              ? <input type="number" step="any" value={cfg.value||''} onChange={e=>setcfg('value',e.target.value)}
                  placeholder="New numeric value *"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
              : <input value={cfg.value||''} onChange={e=>setcfg('value',e.target.value)}
                  placeholder="New value *"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
          )}
        </div>
      )}

      {action.action_type === 'assign_owner' && (
        <div className="ml-9">
          <select value={cfg.user_id||''} onChange={e=>setcfg('user_id',e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="">Select user to assign... *</option>
            {users.map(u=><option key={u.id} value={u.id}>{`${u.first_name||''} ${u.last_name||''}`.trim()||u.email}</option>)}
          </select>
        </div>
      )}

      {action.action_type === 'create_task' && (
        <div className="space-y-2 ml-9">
          <input value={cfg.task_name||''} onChange={e=>setcfg('task_name',e.target.value)}
            placeholder="Task name *" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
          <textarea value={cfg.notes||''} onChange={e=>setcfg('notes',e.target.value)}
            placeholder="Task notes / description (optional)" rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"/>
          <div className="grid grid-cols-3 gap-2">
            <select value={cfg.priority||'Medium'} onChange={e=>setcfg('priority',e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
              {['Low','Medium','High'].map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <select value={cfg.due_in_days||''} onChange={e=>setcfg('due_in_days',e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">Due date: Fixed</option>
              <option value="1">Due in 1 day</option>
              <option value="3">Due in 3 days</option>
              <option value="7">Due in 7 days</option>
              <option value="14">Due in 14 days</option>
              <option value="30">Due in 30 days</option>
            </select>
            {!cfg.due_in_days && (
              <input type="date" value={cfg.due_date||''} onChange={e=>setcfg('due_date',e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Assign task to</label>
            <select value={cfg.assignee_user_id||''} onChange={e=>setcfg('assignee_user_id',e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">Same as record owner</option>
              {users.map(u=><option key={u.id} value={u.id}>{`${u.first_name||''} ${u.last_name||''}`.trim()||u.email}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Workflow Builder Panel ────────────────────────────────────────────────────
function WorkflowBuilderPanel({ objectList = ALL_OBJECTS, conditionFields = CONDITION_FIELDS, objectLabels = null }) {
  const { workflowRules, enterpriseUsers, saveWorkflowRule, deleteWorkflowRule } = useApp();
  const { showAlert } = useAlert();
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState({ name:'', object_type:objectList[0], trigger_event:'on_create', trigger_field:'', trigger_value:'', is_active:true });
  const [conditions, setCond]   = useState({ logic:'AND', conditions:[] });
  const [actions, setActions]   = useState([{ action_type:'send_notification', action_config:{} }]);
  const [saving, setSaving]     = useState(false);
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const fields = conditionFields[form.object_type] || [];
  const triggerFieldOpts = getFieldOptions(form.object_type, form.trigger_field);

  const openNew = () => {
    setEditing(null);
    setForm({name:'',object_type:objectList[0],trigger_event:'on_create',trigger_field:'',trigger_value:'',is_active:true});
    setCond({logic:'AND',conditions:[]});
    setActions([{action_type:'send_notification',action_config:{}}]);
    setOpen(true);
  };

  const openEdit = async (rule) => {
    setEditing(rule);
    setForm({ name:rule.name, object_type:rule.object_type, trigger_event:rule.trigger_event,
      trigger_field:rule.trigger_field||'', trigger_value:rule.trigger_value||'', is_active:rule.is_active });
    setCond(rule.conditions || {logic:'AND',conditions:[]});
    const { data: acts } = await (window as any).__bp_supabase
      ?.from('workflow_actions').select('*').eq('workflow_rule_id', rule.id).order('execution_order') || {data:[]};
    setActions(acts?.length ? acts : [{action_type:'send_notification',action_config:{}}]);
    setOpen(true);
  };

  const validateActions = () => {
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      const cfg = a.action_config || {};
      if (a.action_type === 'send_notification' && !cfg.subject?.trim()) {
        return `Action #${i+1}: Notification subject is required.`;
      }
      if (a.action_type === 'update_field' && (!cfg.field || !cfg.value)) {
        return `Action #${i+1}: Select both a field and a value to update.`;
      }
      if (a.action_type === 'assign_owner' && !cfg.user_id) {
        return `Action #${i+1}: Select a user to assign the record to.`;
      }
      if (a.action_type === 'create_task' && !cfg.task_name?.trim()) {
        return `Action #${i+1}: Task name is required.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { showAlert('Rule name is required.', { variant:'warning' }); return; }
    if (!actions.length)    { showAlert('At least one action is required.', { variant:'warning' }); return; }
    const actionError = validateActions();
    if (actionError) { showAlert(actionError, { variant:'warning' }); return; }
    setSaving(true);
    try {
      await saveWorkflowRule({ ...form, conditions }, actions, editing?.id);
      setOpen(false);
    } catch(e: any) { showAlert('Save failed: ' + e.message, { variant:'danger', title:'Save Failed' }); }
    setSaving(false);
  };

  const OBJ_LABELS = objectLabels || {};

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[24px] p-6 text-white flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">⚙️ Workflow Rules</h2>
          <p className="text-white/60 text-sm mt-1">{workflowRules.length} rule(s) — auto-trigger actions on record events</p>
        </div>
        <button onClick={openNew} className="bg-white text-[#0F172A] px-5 py-2.5 rounded-2xl font-bold text-sm shadow hover:opacity-90">+ New Rule</button>
      </div>

      {workflowRules.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-[24px] border border-gray-200 shadow-sm">
          <div className="text-5xl mb-3">⚙️</div>
          <div className="font-bold text-[#0F172A] text-lg mb-2">No workflow rules yet</div>
          <p className="text-gray-400 mb-5 text-sm">Auto-trigger notifications, field updates, and tasks based on record events.</p>
          <button onClick={openNew} className="bg-[#0F172A] text-white px-6 py-3 rounded-2xl font-semibold text-sm">+ Create First Rule</button>
        </div>
      ) : (
        <div className="space-y-3">
          {workflowRules.map(rule => (
            <div key={rule.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h3 className="font-bold text-[#0F172A] text-lg">{rule.name}</h3>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${rule.is_active?'bg-green-100 text-green-700 border-green-200':'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {rule.is_active ? '● Active' : '○ Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-semibold capitalize">{rule.object_type}</span>
                    <span>→</span>
                    <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg font-semibold">{TRIGGER_EVENTS.find(t=>t.v===rule.trigger_event)?.l || rule.trigger_event}</span>
                    {rule.trigger_field && <><span>when</span><span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg font-semibold">{rule.trigger_field} = {rule.trigger_value}</span></>}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button onClick={()=>openEdit(rule)} className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold border border-blue-200">Edit</button>
                  <button onClick={()=>deleteWorkflowRule(rule.id)} className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-semibold border border-red-200">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit Workflow Rule':'New Workflow Rule'} size="lg"
        footer={<>
          <button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#0F172A] to-blue-800 text-white text-sm font-bold shadow disabled:opacity-50">
            {saving ? 'Saving…' : (editing ? 'Update Rule' : 'Create Rule')}
          </button>
        </>}>
        <div className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Rule Name *</label>
              <input value={form.name} onChange={e=>s('name',e.target.value)} placeholder="e.g. Notify on High Value Lead"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"/>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e=>s('is_active',e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded"/>
                <span className="text-sm font-semibold text-gray-700">Active</span>
              </label>
            </div>
          </div>

          {/* Trigger */}
          <div className="bg-blue-50 rounded-[16px] p-4 space-y-3">
            <h4 className="text-sm font-bold text-[#0F172A]">🔔 Trigger</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Object</label>
                <select value={form.object_type} onChange={e=>s('object_type',e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                  {objectList.map(o=><option key={o} value={o}>{OBJ_LABELS[o]||o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">When</label>
                <select value={form.trigger_event} onChange={e=>s('trigger_event',e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                  {TRIGGER_EVENTS.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
            </div>
            {(form.trigger_event==='on_field_change'||form.trigger_event==='on_status_change') && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Field</label>
                  <select value={form.trigger_field} onChange={e=>s('trigger_field',e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                    <option value="">Select field...</option>
                    {fields.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">New Value</label>
                  {triggerFieldOpts
                    ? <select value={form.trigger_value} onChange={e=>s('trigger_value',e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="">Any value</option>
                        {triggerFieldOpts.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    : <input value={form.trigger_value} onChange={e=>s('trigger_value',e.target.value)}
                        placeholder="Value to match"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                  }
                </div>
              </div>
            )}
          </div>

          {/* Conditions */}
          <div className="bg-gray-50 rounded-[16px] p-4">
            <h4 className="text-sm font-bold text-[#0F172A] mb-3">🔍 Additional Conditions (optional)</h4>
            <ConditionBuilder fields={fields} conditions={conditions.conditions||[]} logic={conditions.logic||'AND'} onChange={setCond} objType={form.object_type}/>
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-[#0F172A]">⚡ Actions</h4>
              <button onClick={()=>setActions(p=>[...p,{action_type:'send_notification',action_config:{},execution_order:p.length}])}
                className="text-sm text-blue-600 hover:text-blue-800 font-semibold">+ Add Action</button>
            </div>
            <div className="space-y-3">
              {actions.map((a,i)=>(
                <ActionBuilder key={i} action={a} idx={i} users={enterpriseUsers} fields={fields} objectType={form.object_type}
                  onChange={na=>setActions(p=>p.map((x,j)=>j===i?na:x))}
                  onRemove={()=>setActions(p=>p.filter((_,j)=>j!==i))}/>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Assignment Rules Panel ─────────────────────────────────────────────────
function AssignmentRulesPanel({ objectList = ALL_OBJECTS, conditionFields = CONDITION_FIELDS, objectLabels = null }) {
  const { assignmentRules, enterpriseUsers, userGroups, saveAssignmentRule, deleteAssignmentRule } = useApp();
  const { showAlert } = useAlert();
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState({ name:'', object_type:objectList[0], condition_field:'', condition_operator:'equals', condition_value:'', assign_to_user_id:'', assign_to_group_id:'', priority:1, is_active:true });
  const [saving, setSaving]   = useState(false);
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const fields    = conditionFields[form.object_type] || [];
  const valueOpts = getFieldOptions(form.object_type, form.condition_field);
  const OBJ_LABELS = objectLabels || {};

  const openNew = () => {
    setEditing(null);
    setForm({name:'',object_type:objectList[0],condition_field:'',condition_operator:'equals',condition_value:'',assign_to_user_id:'',assign_to_group_id:'',priority:1,is_active:true});
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim())        { showAlert('Rule name is required.', { variant:'warning' }); return; }
    if (!form.condition_field)     { showAlert('Condition field is required.', { variant:'warning' }); return; }
    if (!form.assign_to_user_id && !form.assign_to_group_id) { showAlert('Select a user or group to assign to.', { variant:'warning' }); return; }
    setSaving(true);
    try { await saveAssignmentRule(form, editing?.id); setOpen(false); }
    catch(e: any) { showAlert('Save failed: ' + e.message, { variant:'danger', title:'Save Failed' }); }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-[#0F172A] to-indigo-900 rounded-[24px] p-6 text-white flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">📋 Assignment Rules</h2>
          <p className="text-white/60 text-sm mt-1">{assignmentRules.length} rule(s) — auto-assign records to users or groups</p>
        </div>
        <button onClick={openNew} className="bg-white text-[#0F172A] px-5 py-2.5 rounded-2xl font-bold text-sm shadow hover:opacity-90">+ New Rule</button>
      </div>

      {assignmentRules.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-[24px] border border-gray-200 shadow-sm">
          <div className="text-5xl mb-3">📋</div>
          <div className="font-bold text-[#0F172A] text-lg mb-2">No assignment rules yet</div>
          <p className="text-gray-400 mb-5 text-sm">Auto-assign records to users or groups based on field conditions.</p>
          <button onClick={openNew} className="bg-[#0F172A] text-white px-6 py-3 rounded-2xl font-semibold text-sm">+ Create First Rule</button>
        </div>
      ) : (
        <div className="space-y-3">
          {[...assignmentRules].sort((a,b)=>a.priority-b.priority).map(rule => {
            const assignee = enterpriseUsers.find(u=>u.id===rule.assign_to_user_id);
            const grp      = userGroups?.find(g=>g.id===rule.assign_to_group_id);
            return (
              <div key={rule.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">{rule.priority}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-[#0F172A]">{rule.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${rule.is_active?'bg-green-100 text-green-700 border-green-200':'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg font-semibold capitalize">{rule.object_type}</span>
                      <span>·</span>
                      <span>{rule.condition_field} {rule.condition_operator} "{rule.condition_value}"</span>
                      <span>→</span>
                      <span className="font-semibold text-[#0F172A]">
                        {assignee ? `${assignee.first_name||''} ${assignee.last_name||''}`.trim()||assignee.email : grp?.group_name || '?'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={()=>{setEditing(rule);setForm({...rule});setOpen(true);}} className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold border border-blue-200">Edit</button>
                  <button onClick={()=>deleteAssignmentRule(rule.id)} className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-semibold border border-red-200">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit Assignment Rule':'New Assignment Rule'} size="lg"
        footer={<>
          <button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#0F172A] to-blue-800 text-white text-sm font-bold shadow disabled:opacity-50">
            {saving ? 'Saving…' : (editing ? 'Update Rule' : 'Create Rule')}
          </button>
        </>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Rule Name *</label>
              <input value={form.name} onChange={e=>s('name',e.target.value)} placeholder="e.g. Assign Enterprise Leads to Sales Team"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"/>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Object</label>
              <select value={form.object_type} onChange={e=>s('object_type',e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                {objectList.map(o=><option key={o} value={o}>{OBJ_LABELS[o]||o}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-blue-50 rounded-[16px] p-4 space-y-3">
            <h4 className="text-sm font-bold text-[#0F172A]">🔍 Condition</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Field *</label>
                <select value={form.condition_field} onChange={e=>s('condition_field',e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                  <option value="">Select field...</option>
                  {fields.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Operator</label>
                <select value={form.condition_operator} onChange={e=>s('condition_operator',e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                  {OPERATORS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Value</label>
                {valueOpts
                  ? <select value={form.condition_value} onChange={e=>s('condition_value',e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                      <option value="">Any</option>
                      {valueOpts.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  : <input value={form.condition_value} onChange={e=>s('condition_value',e.target.value)}
                      placeholder="Value..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                }
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-[16px] p-4 space-y-3">
            <h4 className="text-sm font-bold text-[#0F172A]">👤 Assign To</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">User</label>
                <select value={form.assign_to_user_id||''} onChange={e=>s('assign_to_user_id',e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                  <option value="">Select user...</option>
                  {enterpriseUsers.map(u=><option key={u.id} value={u.id}>{(`${u.first_name||''} ${u.last_name||''}`.trim()||u.email)}{u.status!=='Active'?' (Inactive)':''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Or Group</label>
                <select value={form.assign_to_group_id||''} onChange={e=>s('assign_to_group_id',e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                  <option value="">Select group...</option>
                  {(userGroups||[]).map(g=><option key={g.id} value={g.id}>{g.group_name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Priority (lower = higher priority)</label>
              <input type="number" min="1" max="999" value={form.priority} onChange={e=>{
                  const n = Math.max(1, Math.min(999, Number(e.target.value)||1));
                  s('priority', n);
                }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"/>
              <p className="text-[10px] text-gray-400 mt-1">1–999 · lower numbers are evaluated first</p>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e=>s('is_active',e.target.checked)} className="w-4 h-4 accent-blue-600 rounded"/>
                <span className="text-sm font-semibold text-gray-700">Active</span>
              </label>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── SLA Panel ──────────────────────────────────────────────────────────────
function SLAPanel({ objectList = ALL_OBJECTS, conditionFields = CONDITION_FIELDS, objectLabels = null }) {
  const { slaPolicies, enterpriseUsers, userGroups, saveSLAPolicy, deleteSLAPolicy } = useApp();
  const { showAlert } = useAlert();
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState({ name:'', object_type:objectList[0], condition_field:'status', condition_value:'', response_time_hours:24, resolution_time_hours:72, warning_threshold_pct:80, escalate_to_user_id:'', is_active:true });
  const [saving, setSaving]   = useState(false);
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const fields    = conditionFields[form.object_type] || [];
  const valueOpts = getFieldOptions(form.object_type, form.condition_field);
  const OBJ_LABELS = objectLabels || {};

  const openNew = () => {
    setEditing(null);
    setForm({name:'',object_type:objectList[0],condition_field:'status',condition_value:'',response_time_hours:24,resolution_time_hours:72,warning_threshold_pct:80,escalate_to_user_id:'',is_active:true});
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-[#0F172A] to-teal-900 rounded-[24px] p-6 text-white flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">⏱️ SLA Policies</h2>
          <p className="text-white/60 text-sm mt-1">{slaPolicies?.length||0} polic(ies) — track response and resolution times</p>
        </div>
        <button onClick={openNew} className="bg-white text-[#0F172A] px-5 py-2.5 rounded-2xl font-bold text-sm shadow hover:opacity-90">+ New Policy</button>
      </div>

      {(!slaPolicies||slaPolicies.length===0) ? (
        <div className="py-16 text-center bg-white rounded-[24px] border border-gray-200 shadow-sm">
          <div className="text-5xl mb-3">⏱️</div>
          <div className="font-bold text-[#0F172A] text-lg mb-2">No SLA policies yet</div>
          <p className="text-gray-400 mb-5 text-sm">Define response and resolution time targets for different record types.</p>
          <button onClick={openNew} className="bg-[#0F172A] text-white px-6 py-3 rounded-2xl font-semibold text-sm">+ Create First Policy</button>
        </div>
      ) : (
        <div className="space-y-3">
          {slaPolicies.map(policy => {
            const escalateTo = enterpriseUsers.find(u=>u.id===policy.escalate_to_user_id);
            return (
              <div key={policy.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-[#0F172A]">{policy.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${policy.is_active?'bg-green-100 text-green-700 border-green-200':'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {policy.is_active?'Active':'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
                    <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-lg font-semibold capitalize">{policy.object_type}</span>
                    {policy.condition_field && <span>· {policy.condition_field}: "{policy.condition_value}"</span>}
                    <span>· Response: <strong>{policy.response_time_hours}h</strong></span>
                    <span>· Resolution: <strong>{policy.resolution_time_hours}h</strong></span>
                    {escalateTo && <span>· Escalate to: <strong>{`${escalateTo.first_name||''} ${escalateTo.last_name||''}`.trim()||escalateTo.email}</strong></span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={()=>{setEditing(policy);setForm({...policy});setOpen(true);}} className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold border border-blue-200">Edit</button>
                  <button onClick={()=>deleteSLAPolicy(policy.id)} className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-semibold border border-red-200">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit SLA Policy':'New SLA Policy'} size="lg"
        footer={<>
          <button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold">Cancel</button>
          <button onClick={async()=>{
            if(!form.name?.trim()){showAlert('Name required', { variant:'warning' });return;}
            setSaving(true);
            try{await saveSLAPolicy(form,editing?.id);setOpen(false);}catch(e:any){showAlert(e.message, { variant:'danger', title:'Save Failed' });}
            setSaving(false);
          }} disabled={saving} className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#0F172A] to-blue-800 text-white text-sm font-bold shadow disabled:opacity-50">
            {saving?'Saving…':(editing?'Update Policy':'Create Policy')}
          </button>
        </>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Policy Name *</label>
              <input value={form.name} onChange={e=>s('name',e.target.value)} placeholder="e.g. Enterprise Lead SLA"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"/>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Object</label>
              <select value={form.object_type} onChange={e=>s('object_type',e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                {objectList.map(o=><option key={o} value={o}>{OBJ_LABELS[o]||o}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-teal-50 rounded-[16px] p-4 space-y-3">
            <h4 className="text-sm font-bold text-[#0F172A]">🔍 Apply When (optional condition)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Field</label>
                <select value={form.condition_field||''} onChange={e=>s('condition_field',e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400">
                  <option value="">All records</option>
                  {fields.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Value</label>
                {valueOpts
                  ? <select value={form.condition_value||''} onChange={e=>s('condition_value',e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400">
                      <option value="">Any</option>
                      {valueOpts.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  : <input value={form.condition_value||''} onChange={e=>s('condition_value',e.target.value)}
                      placeholder="Value..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"/>
                }
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Response Time (hours)</label>
              <input type="number" min="1" value={form.response_time_hours} onChange={e=>s('response_time_hours',Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"/>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Resolution Time (hours)</label>
              <input type="number" min="1" value={form.resolution_time_hours} onChange={e=>s('resolution_time_hours',Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"/>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Warning at (%)</label>
              <input type="number" min="1" max="100" value={form.warning_threshold_pct} onChange={e=>s('warning_threshold_pct',Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Escalate To (user)</label>
              <select value={form.escalate_to_user_id||''} onChange={e=>s('escalate_to_user_id',e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">No escalation</option>
                {enterpriseUsers.map(u=><option key={u.id} value={u.id}>{(`${u.first_name||''} ${u.last_name||''}`.trim()||u.email)}{u.status!=='Active'?' (Inactive)':''}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e=>s('is_active',e.target.checked)} className="w-4 h-4 accent-blue-600 rounded"/>
                <span className="text-sm font-semibold text-gray-700">Active</span>
              </label>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Approval Process Panel ─────────────────────────────────────────────────
function ApprovalProcessPanel({ objectList = ALL_OBJECTS, conditionFields = CONDITION_FIELDS, objectLabels = null }) {
  const { approvalProcesses, approvalRequests, enterpriseUsers, userGroups, saveApprovalProcess, deleteApprovalProcess, fetchApprovalProcesses } = useApp();
  const { showAlert } = useAlert();
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState({ name:'', object_type:objectList[0], is_active:true });
  const [conditions, setCond]   = useState({ logic:'AND', conditions:[] });
  const [steps, setSteps]       = useState([{ step_number:1, step_name:'Manager Approval', approver_user_id:'', approver_group_id:'', approval_type:'any', on_approve_action:'proceed', on_reject_action:'reject' }]);
  const [saving, setSaving]     = useState(false);
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));
  const fields    = conditionFields[form.object_type] || [];
  const OBJ_LABELS = objectLabels || {};

  const addStep = () => setSteps(p=>[...p,{step_number:p.length+1,step_name:'',approver_user_id:'',approver_group_id:'',approval_type:'any',on_approve_action:'proceed',on_reject_action:'reject'}]);

  const handleSave = async () => {
    if (!form.name?.trim()) { showAlert('Process name is required.', { variant:'warning' }); return; }
    if (!steps.every(s=>s.approver_user_id||s.approver_group_id)) { showAlert('Each step needs an approver.', { variant:'warning' }); return; }
    setSaving(true);
    try {
      await saveApprovalProcess({ ...form, conditions }, steps.map((s,i)=>({...s,step_number:i+1})), editing?.id);
      setOpen(false);
    } catch(e: any) { showAlert('Save failed: ' + e.message, { variant:'danger', title:'Save Failed' }); }
    setSaving(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm({name:'',object_type:objectList[0],is_active:true});
    setCond({logic:'AND',conditions:[]});
    setSteps([{step_number:1,step_name:'Manager Approval',approver_user_id:'',approver_group_id:'',approval_type:'any',on_approve_action:'proceed',on_reject_action:'reject'}]);
    setOpen(true);
  };

  const openEdit = async (proc) => {
    setEditing(proc);
    setForm({name:proc.name,object_type:proc.object_type,is_active:proc.is_active});
    setCond(proc.conditions||{logic:'AND',conditions:[]});
    setOpen(true);
    // Fetch the actual saved steps from DB
    const supabase = (window as any).__bp_supabase;
    if (supabase) {
      const { data: stepsData } = await supabase
        .from('approval_steps').select('*').eq('approval_process_id', proc.id).order('step_number');
      if (stepsData?.length) {
        setSteps(stepsData.map(s => ({
          step_number: s.step_number,
          step_name: s.step_name || '',
          approver_user_id: s.approver_user_id || '',
          approver_group_id: s.approver_group_id || '',
          approval_type: s.approval_type || 'any',
          on_approve_action: s.on_approve_action || 'proceed',
          on_reject_action: s.on_reject_action || 'reject',
        })));
        return;
      }
    }
    setSteps([{step_number:1,step_name:'',approver_user_id:'',approver_group_id:'',approval_type:'any',on_approve_action:'proceed',on_reject_action:'reject'}]);
  };

  // Pending requests grouped by process
  const pendingRequests = approvalRequests?.filter(r=>r.status==='Pending') || [];

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-[#0F172A] to-purple-900 rounded-[24px] p-6 text-white flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">✅ Approval Processes</h2>
          <p className="text-white/60 text-sm mt-1">{approvalProcesses?.length||0} process(es) · {pendingRequests.length} pending request(s)</p>
        </div>
        <button onClick={openNew} className="bg-white text-[#0F172A] px-5 py-2.5 rounded-2xl font-bold text-sm shadow hover:opacity-90">+ New Process</button>
      </div>

      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-4">
          <h3 className="font-bold text-amber-800 text-sm mb-3">⏳ Pending Approval Requests</h3>
          <div className="space-y-2">
            {pendingRequests.map(req=>(
              <div key={req.id} className="bg-white rounded-xl px-4 py-3 border border-amber-200 flex items-center justify-between text-sm">
                <div>
                  <span className="font-semibold text-[#0F172A]">{req.record_name}</span>
                  <span className="text-gray-400 ml-2">· {req.record_type} · Submitted by {req.submitted_by}</span>
                </div>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                  Step {req.current_step_number}/{req.total_steps}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!approvalProcesses||approvalProcesses.length===0) ? (
        <div className="py-16 text-center bg-white rounded-[24px] border border-gray-200 shadow-sm">
          <div className="text-5xl mb-3">✅</div>
          <div className="font-bold text-[#0F172A] text-lg mb-2">No approval processes yet</div>
          <p className="text-gray-400 mb-5 text-sm">Set up multi-step approvals for orders, quotes, and other records.</p>
          <button onClick={openNew} className="bg-[#0F172A] text-white px-6 py-3 rounded-2xl font-semibold text-sm">+ Create First Process</button>
        </div>
      ) : (
        <div className="space-y-3">
          {approvalProcesses.map(proc=>(
            <div key={proc.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-[#0F172A]">{proc.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${proc.is_active?'bg-green-100 text-green-700 border-green-200':'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {proc.is_active?'Active':'Inactive'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                    <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg font-semibold capitalize">{proc.object_type}</span>
                    {proc.condition_field && <span>· {proc.condition_field} {proc.condition_operator} "{proc.condition_value}"</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>openEdit(proc)} className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold border border-blue-200">Edit</button>
                  <button onClick={()=>deleteApprovalProcess(proc.id)} className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-semibold border border-red-200">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit Approval Process':'New Approval Process'} size="lg"
        footer={<>
          <button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#0F172A] to-blue-800 text-white text-sm font-bold shadow disabled:opacity-50">
            {saving?'Saving…':(editing?'Update Process':'Create Process')}
          </button>
        </>}>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Process Name *</label>
              <input value={form.name} onChange={e=>s('name',e.target.value)} placeholder="e.g. High Value Order Approval"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"/>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Object</label>
              <select value={form.object_type} onChange={e=>s('object_type',e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                {objectList.map(o=><option key={o} value={o}>{OBJ_LABELS[o]||o}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-purple-50 rounded-[16px] p-4">
            <h4 className="text-sm font-bold text-[#0F172A] mb-3">🔍 Entry Conditions (when to trigger)</h4>
            <ConditionBuilder fields={fields} conditions={conditions.conditions||[]} logic={conditions.logic||'AND'} onChange={setCond} objType={form.object_type}/>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-[#0F172A]">📋 Approval Steps</h4>
              <button onClick={addStep} className="text-sm text-blue-600 hover:text-blue-800 font-semibold">+ Add Step</button>
            </div>
            <div className="space-y-3">
              {steps.map((step,i)=>(
                <div key={i} className="bg-gray-50 rounded-[16px] p-4 border border-gray-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-[#0F172A] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{i+1}</span>
                    <input value={step.step_name} onChange={e=>setSteps(p=>p.map((x,j)=>j===i?{...x,step_name:e.target.value}:x))}
                      placeholder="Step name (e.g. Manager Approval)"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                    {steps.length > 1 && (
                      <button onClick={()=>setSteps(p=>p.filter((_,j)=>j!==i))} className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-lg">×</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Approver (User)</label>
                      <select value={step.approver_user_id||''} onChange={e=>setSteps(p=>p.map((x,j)=>j===i?{...x,approver_user_id:e.target.value}:x))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="">Select approver...</option>
                        {enterpriseUsers.map(u=><option key={u.id} value={u.id}>{(`${u.first_name||''} ${u.last_name||''}`.trim()||u.email)}{u.status!=='Active'?' (Inactive)':''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Or Group</label>
                      <select value={step.approver_group_id||''} onChange={e=>setSteps(p=>p.map((x,j)=>j===i?{...x,approver_group_id:e.target.value}:x))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="">Select group...</option>
                        {(userGroups||[]).map(g=><option key={g.id} value={g.id}>{g.group_name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Approval Type</label>
                      <select value={step.approval_type||'any'} onChange={e=>setSteps(p=>p.map((x,j)=>j===i?{...x,approval_type:e.target.value}:x))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="any">Any approver</option>
                        <option value="all">All approvers</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">On Approve</label>
                      <select value={step.on_approve_action||'proceed'} onChange={e=>setSteps(p=>p.map((x,j)=>j===i?{...x,on_approve_action:e.target.value}:x))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="proceed">Proceed to next step</option>
                        <option value="approve">Mark as Approved</option>
                        <option value="activate">Activate record</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">On Reject</label>
                      <select value={step.on_reject_action||'reject'} onChange={e=>setSteps(p=>p.map((x,j)=>j===i?{...x,on_reject_action:e.target.value}:x))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="reject">Reject record</option>
                        <option value="return">Return to submitter</option>
                        <option value="skip">Skip to next step</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e=>s('is_active',e.target.checked)} className="w-4 h-4 accent-blue-600 rounded"/>
              <span className="text-sm font-semibold text-gray-700">Active — trigger on matching records</span>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}



export default function AdminToolsPage() {
  const [active, setActive] = useState(null);
  const [adminMode, setAdminMode] = useState('b2b'); // 'b2b' | 'b2c' | 'tenant' | 'import'
  const { hasPermission, currentUserPermissions, permissionsLoaded, currentUser, appPreferences } = useApp();
  const { tenant } = useTenant();
  const isB2CMode = appPreferences?.b2c_mode === true;
  const isB2BMode = appPreferences?.crm_enabled !== false && !isB2CMode;
  // Tenant Admin tab only visible on the master/demo workspace — never on client tenants
  const isMasterWorkspace = !tenant || tenant.slug === 'demo';
  // Admin tools page — data loaded via individual panel components
  // Gate: only admins (or users with admin_tools_view) can access this page
  const canAccessAdmin = !permissionsLoaded || // optimistic while loading
    (currentUserPermissions || []).includes('__admin__') ||
    (currentUserPermissions || []).includes('admin_tools_view') ||
    (currentUser as any)?.is_admin === true;

  const B2B_SECTIONS = [
    { key:'organizations',  label:'Organizations',    icon:'🏢', desc:'Manage companies and org structure' },
    { key:'businessUnits',  label:'Business Units',   icon:'🏗️', desc:'Manage divisions and departments' },
    { key:'users',          label:'Enterprise Users', icon:'👤', desc:'Manage user accounts and roles' },
    { key:'groups',         label:'User Groups',      icon:'👥', desc:'Organize users into teams' },
    { key:'security',       label:'Security Console', icon:'🔐', desc:'Roles, permissions and data access' },
    { key:'workflow',       label:'Workflow Rules',   icon:'⚙️', desc:'Auto-trigger actions on record events' },
    { key:'assignment',     label:'Assignment Rules', icon:'📋', desc:'Auto-assign records to users' },
    { key:'sla',            label:'SLA Policies',     icon:'⏱️', desc:'Track response and resolution times' },
    { key:'approvals',      label:'Approval Processes',icon:'✅', desc:'Multi-step record approvals' },
    { key:'templates',      label:'Quote Templates',  icon:'📄', desc:'Design quote and proposal templates' },
    { key:'invoiceTemplates',label:'Invoice Templates',icon:'🧾', desc:'Design B2B invoice templates' },
    { key:'warehouses',     label:'Warehouses',       icon:'🏭', desc:'Manage warehouse locations' },
    { key:'appPrefs',       label:'App Preferences',  icon:'⚙️', desc:'Currency, date format, modules' },
    { key:'appearance',     label:'Appearance',       icon:'🎨', desc:'Theme, logo and branding' },
    { key:'b2b_composer',   label:'App Composer',     icon:'🧩', desc:'Add custom fields to CRM objects' },
    { key:'layoutDesigner', label:'Page Layout Designer', icon:'🧱', desc:'Relabel, hide, lock, and reorder standard fields' },
  ];

  const B2C_SECTIONS = [
    { key:'r_organizations', label:'Organizations',   icon:'🏢', desc:'Retail org structure' },
    { key:'r_businessUnits', label:'Business Units',  icon:'🏗️', desc:'Retail divisions' },
    { key:'r_users',         label:'Users',           icon:'👤', desc:'Retail user accounts' },
    { key:'r_groups',        label:'User Groups',     icon:'👥', desc:'Retail user teams' },
    { key:'r_security',      label:'Security',        icon:'🔐', desc:'Retail roles and permissions' },
    { key:'r_workflow',      label:'Workflow Rules',  icon:'⚙️', desc:'Retail automation rules' },
    { key:'r_assignment',    label:'Assignment Rules',icon:'📋', desc:'Retail record assignment' },
    { key:'r_sla',           label:'SLA Policies',    icon:'⏱️', desc:'Retail SLA tracking' },
    { key:'r_approvals',     label:'Approvals',       icon:'✅', desc:'Retail approval flows' },
    { key:'r_invoiceTemplates',label:'Invoice Designer',icon:'🖨️', desc:'Design retail invoice templates' },
    { key:'r_appPrefs',      label:'App Preferences', icon:'⚙️', desc:'Retail app settings' },
    { key:'r_appearance',    label:'Appearance',      icon:'🎨', desc:'Retail branding' },
    { key:'r_composer',      label:'App Composer',    icon:'🧩', desc:'Custom fields for retail objects' },
    { key:'layoutDesigner',  label:'Page Layout Designer', icon:'🧱', desc:'Relabel, hide, lock, and reorder standard fields' },
    { key:'r_whatsapp',      label:'WhatsApp Integration', icon:'💬', desc:'Automatic reminders and one-tap customer messaging' },
    ...(appPreferences?.business_type === 'rental' ? [
      { key:'r_rentalSettings', label:'Rental Settings', icon:'👗', desc:'Booking rules and blocking statuses' },
    ] : []),
  ];

  const renderSection = ()=>{
    switch(active){
      case 'organizations': return <OrganizationsPanel/>;
      case 'businessUnits': return <BusinessUnitsPanel/>;
      case 'users':         return <UsersPanel/>;
      case 'groups':        return <UserGroupsPanel/>;
      case 'security':      return <SecurityConsole/>;
      case 'workflow':      return <WorkflowBuilderPanel/>;
      case 'assignment':    return <AssignmentRulesPanel/>;
      case 'sla':           return <SLAPanel/>;
      case 'approvals':     return <ApprovalProcessPanel/>;
      case 'templates':        return <DocumentTemplateDesigner docType="quote"/>;
      case 'invoiceTemplates': return <DocumentTemplateDesigner docType="invoice"/>;
      case 'warehouses':       return <WarehousesPanel/>;
      case 'appPrefs':         return <AppPreferencesPanel/>;
      case 'appearance':       return <AppearancePanel/>;

      // ── B2C Retail Admin ──────────────────────────────────────────────────
      // Panels render inside a retail context wrapper that scopes to B2C objects
      case 'r_organizations':    return <RetailAdminWrapper title="Organizations" icon="🏢" desc="Manage retail organisation structure"><OrganizationsPanel/></RetailAdminWrapper>;
      case 'r_businessUnits':    return <RetailAdminWrapper title="Business Units" icon="🏗️" desc="Manage retail divisions and departments"><BusinessUnitsPanel/></RetailAdminWrapper>;
      case 'r_users':            return <RetailAdminWrapper title="Users" icon="👤" desc="Retail platform user accounts and roles"><UsersPanel/></RetailAdminWrapper>;
      case 'r_groups':           return <RetailAdminWrapper title="User Groups" icon="👥" desc="Retail user group access and assignment"><UserGroupsPanel/></RetailAdminWrapper>;
      case 'r_security':         return <RetailAdminWrapper title="Security Console" icon="🔐" desc="Retail roles, permissions and data access — shared with B2B Enterprise"><SecurityConsole/></RetailAdminWrapper>;
      case 'r_invoiceTemplates': return <RetailInvoiceDesigner/>;
      case 'r_approvals':        return <RetailAdminWrapper title="Approval Processes" icon="✅" desc="Multi-step approvals for Retail Orders and Invoices"><ApprovalProcessPanel objectList={RETAIL_OBJECTS_LIST} conditionFields={RETAIL_CONDITION_FIELDS} objectLabels={RETAIL_OBJECT_LABELS}/></RetailAdminWrapper>;
      case 'r_workflow':         return <RetailAdminWrapper title="Workflow Builder" icon="⚙️" desc="Auto-trigger actions on Retail data object events"><WorkflowBuilderPanel objectList={RETAIL_OBJECTS_LIST} conditionFields={RETAIL_CONDITION_FIELDS} objectLabels={RETAIL_OBJECT_LABELS}/></RetailAdminWrapper>;
      case 'r_assignment':       return <RetailAdminWrapper title="Assignment Rules" icon="📋" desc="Auto-assign Retail records to users"><AssignmentRulesPanel objectList={RETAIL_OBJECTS_LIST} conditionFields={RETAIL_CONDITION_FIELDS} objectLabels={RETAIL_OBJECT_LABELS}/></RetailAdminWrapper>;
      case 'r_sla':              return <RetailAdminWrapper title="SLA Policies" icon="⏱️" desc="Response and resolution SLA for Retail objects"><SLAPanel objectList={RETAIL_OBJECTS_LIST} conditionFields={RETAIL_CONDITION_FIELDS} objectLabels={RETAIL_OBJECT_LABELS}/></RetailAdminWrapper>;
      case 'r_appPrefs':         return <RetailAdminWrapper title="App Preferences" icon="⚙️" desc="Currency, date format and module settings"><AppPreferencesPanel/></RetailAdminWrapper>;
      case 'r_appearance':       return <RetailAdminWrapper title="Appearance" icon="🎨" desc="Theme, logo and branding — shared with B2B Enterprise"><AppearancePanel/></RetailAdminWrapper>;
      case 'r_composer':         return <AppComposer/>;
      case 'layoutDesigner':     return <FieldLayoutDesigner/>;
      case 'r_rentalSettings':   return <RentalSettingsPanel/>;
      case 'r_whatsapp':        return <WhatsAppSettingsPanel/>;
      case 'b2b_composer':       return <B2BAppComposer/>;
      default:                   return null;
    }
  };

  // Safety: force back to b2b if tenant mode selected but not on master workspace.
  // These MUST run before the `!canAccessAdmin` early return below — every
  // hook in a component has to run unconditionally on every render. Placing
  // them after a conditional return meant a user without admin access (or,
  // critically, anyone in the moment right after switching users before
  // permissions finish reloading) would skip these two hooks entirely on
  // that render, then call them normally once access was confirmed on a
  // later render — a hook-count mismatch between renders, which is exactly
  // what crashed the app with "Rendered more hooks than during the previous
  // render" on sign-out/sign-in.
  useEffect(() => {
    if (adminMode === 'tenant' && !isMasterWorkspace) setAdminMode('b2b');
  }, [adminMode, isMasterWorkspace]);

  useEffect(() => {
    if (adminMode === 'b2b' && !isB2BMode) {
      setAdminMode(isB2CMode ? 'b2c' : 'b2b');
      setActive(null);
    }
  }, [adminMode, isB2BMode, isB2CMode]);

  if (!canAccessAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white rounded-[28px] border border-red-100 shadow p-12 text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Access Restricted</h2>
        <p className="text-gray-500 max-w-md">You don't have permission to access Admin Tools. Contact your Business Pro administrator to request access.</p>
      </div>
    );
  }

  const currentSections = adminMode==='b2c' ? B2C_SECTIONS : adminMode==='tenant' ? [] : adminMode==='import' ? [] : B2B_SECTIONS;
  const isB2CAdminTool = adminMode==='b2c';

  return (
    <div className="space-y-6">
      {/* Header */}
      {!active && (
        <div className={`rounded-[28px] p-6 text-white ${isB2CAdminTool?'bg-gradient-to-r from-purple-900 to-purple-700':'bg-gradient-to-r from-[#0F172A] to-blue-900'}`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold">⚙️ Admin Tools</h1>
              <p className="text-blue-200 mt-1">{isB2CAdminTool?'Configure your Retail (B2C) platform — retail users, composer, templates, and more.':'Configure your enterprise platform — users, automation, SLA, approvals, and more.'}</p>
            </div>
            {/* B2B / B2C Mode Switcher */}
            <div className="flex bg-white/10 rounded-2xl p-1 gap-1">
              <button onClick={()=>{setAdminMode('b2b');setActive(null);}}
                disabled={!isB2BMode}
                title={!isB2BMode?'Enable CRM module in App Preferences first':''}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${adminMode==='b2b'?'bg-white text-[#0F172A] shadow':'text-white/70 hover:text-white'}`}>
                🏢 B2B Enterprise {!isB2BMode&&<span className="text-xs opacity-60">(disabled)</span>}
              </button>
              <button onClick={()=>{setAdminMode('b2c');setActive(null);}}
                disabled={!isB2CMode}
                title={!isB2CMode?'Enable B2C mode in App Preferences first':''}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${adminMode==='b2c'?'bg-purple-500 text-white shadow':'text-white/70 hover:text-white'}`}>
                🛍️ B2C Retail {!isB2CMode&&<span className="text-xs opacity-60">(disabled)</span>}
              </button>
              {isMasterWorkspace && (
                <button onClick={()=>{setAdminMode('tenant');setActive(null);}}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${adminMode==='tenant'?'bg-amber-500 text-white shadow':'text-white/70 hover:text-white'}`}>
                  🌐 Tenant Admin
                </button>
              )}
              <button onClick={()=>{setAdminMode('import');setActive(null);}}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${adminMode==='import'?'bg-emerald-600 text-white shadow':'text-white/70 hover:text-white'}`}>
                📂 Import & Export
              </button>
            </div>
          </div>
          {!isB2CMode && adminMode==='b2b' && (
            <p className="text-xs text-blue-300 mt-3">💡 Enable B2C mode in App Preferences to unlock Retail Admin Tools.</p>
          )}
        </div>
      )}

      {/* Back button */}
      {active && (
        <button onClick={()=>setActive(null)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0F172A] font-semibold transition-all px-1">
          ← Back to Admin Tools
        </button>
      )}

      {/* B2B sections grid */}
      {!active && adminMode==='b2b' && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {B2B_SECTIONS.map(section=>(
            <button key={section.key} onClick={()=>setActive(section.key)}
              className="rounded-[24px] p-5 text-left border border-blue-100 bg-white hover:border-blue-400 hover:shadow-xl transition-all shadow-lg hover:scale-[1.02] group">
              <div className="text-3xl mb-3">{section.icon}</div>
              <div className="font-bold text-sm text-[#0F172A] group-hover:text-blue-700">{section.label}</div>
              <div className="text-xs mt-1 text-gray-400">{section.desc}</div>
            </button>
          ))}
        </div>
      )}

      {/* Tenant Admin — renders directly, no sub-tiles (master workspace only) */}
      {!active && adminMode==='tenant' && isMasterWorkspace && (
        <TenantAdminPanel/>
      )}

      {/* Import & Export — renders directly, visible to all tenants */}
      {!active && adminMode==='import' && (
        <ImportExportPanel/>
      )}

      {/* B2C sections grid */}
      {!active && adminMode==='b2c' && (
        <div className="space-y-4">
          {!isB2CMode && (
            <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-5 flex items-start gap-4">
              <span className="text-3xl">⚠️</span>
              <div>
                <h3 className="font-bold text-amber-800">B2C Mode is Disabled</h3>
                <p className="text-amber-700 text-sm mt-1">Go to App Preferences → toggle B2C Mode ON to enable Retail Admin Tools.</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {B2C_SECTIONS.map(section=>{
              const isAlwaysOn = section.key==='appPrefs'||section.key==='appearance';
              const disabled = !isB2CMode && !isAlwaysOn;
              return (
                <button key={section.key}
                  onClick={()=>{ if(!disabled) setActive(section.key); }}
                  disabled={disabled}
                  className={`rounded-[24px] p-5 text-left border transition-all shadow-lg group relative ${
                    disabled
                      ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      : 'border-purple-100 bg-white hover:border-purple-400 hover:shadow-xl hover:scale-[1.02]'
                  }`}>
                  {disabled && (
                    <div className="absolute top-2 right-2 bg-gray-200 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full">OFF</div>
                  )}
                  <div className="text-3xl mb-3">{section.icon}</div>
                  <div className={`font-bold text-sm ${disabled?'text-gray-400':'text-[#0F172A] group-hover:text-purple-700'}`}>{section.label}</div>
                  <div className="text-xs mt-1 text-gray-400">{section.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active panel */}
      {active && (
        <div className="space-y-5">
          {renderSection()}
        </div>
      )}
    </div>
  );
}