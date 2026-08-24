// @ts-nocheck
'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';

const CURRENCIES = [
  {v:'INR',l:'₹ Indian Rupee (INR)'}, {v:'USD',l:'$ US Dollar (USD)'},
  {v:'EUR',l:'€ Euro (EUR)'}, {v:'GBP',l:'£ British Pound (GBP)'},
  {v:'AED',l:'د.إ UAE Dirham (AED)'}, {v:'SGD',l:'S$ Singapore Dollar (SGD)'},
];
const DATE_FORMATS = ['DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD'];
const FISCAL_STARTS = ['January','April','July','October'];

const iCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400';

const SETTINGS_PASSWORD = '193728bB@';

export default function AppPreferencesPanel() {
  const { appPreferences, saveAppPreferences } = useApp();
  const { tenant } = useTenant();
  // Only show module toggles that are enabled for this tenant's plan
  const tenantModules = tenant?.modules || ['crm','invoicing','retail','reports','ai','admin'];
  const moduleAllowed = (key) => tenantModules.includes(key);
  const [form, setForm]       = useState(appPreferences || {});
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const s = (k,v) => setForm(f=>({...f,[k]:v}));
  const isDirty = JSON.stringify(form) !== JSON.stringify(appPreferences || {});

  useEffect(() => {
    // Only sync from the context value when the form has no unsaved changes.
    // Previously this ran unconditionally, so any background update to
    // appPreferences (a re-fetch, a session-restore re-bootstrap, anything)
    // would silently overwrite whatever the user had just selected — e.g.
    // choosing Rental mode — before they even got a chance to click Save.
    if (appPreferences && !isDirty) setForm(appPreferences);
  }, [appPreferences]);

  const [showPwModal, setShowPwModal] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  const requestSave = () => {
    setPwInput('');
    setPwError('');
    setShowPwModal(true);
  };

  const confirmSave = async () => {
    if (pwInput !== SETTINGS_PASSWORD) {
      setPwError('Incorrect password');
      return;
    }
    setShowPwModal(false);
    setSaving(true);
    const result = await saveAppPreferences(form);
    setSaving(false);
    if (result?.success !== false) {
      setToast('✓ Preferences saved');
      setTimeout(()=>setToast(''), 2500);
    }
    // On failure, saveAppPreferences itself already shows a clear error alert.
  };



  const Toggle = ({ label, desc, value, onChange }) => (
    <label className="flex items-center justify-between gap-4 py-3 cursor-pointer">
      <div>
        <div className="text-sm font-semibold text-[#0F172A]">{label}</div>
        {desc && <div className="text-xs text-gray-400 mt-0.5">{desc}</div>}
      </div>
      <button type="button" onClick={()=>onChange(!value)}
        className={`w-12 h-6 rounded-full transition-all flex-shrink-0 relative ${value?'bg-blue-600':'bg-gray-300'}`}>
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${value?'left-6':'left-0.5'}`}/>
      </button>
    </label>
  );

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] px-5 py-3 rounded-2xl shadow-2xl font-semibold text-sm text-white bg-[#0F172A]">{toast}</div>
      )}

      <div className="bg-gradient-to-r from-[#0F172A] to-slate-700 rounded-[24px] p-6 text-white">
        <h2 className="text-2xl font-bold">⚙️ App Preferences</h2>
        <p className="text-white/60 text-sm mt-1">Configure modules, currency, and regional settings for your workspace.</p>
      </div>

      {/* Modules */}
      <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-[#0F172A] mb-2">🧩 Modules</h3>
        <div className="divide-y divide-gray-100">
          {moduleAllowed('crm') && (
            <Toggle label="CRM Module" desc="Leads, Opportunities, Customers, Contacts, Activities"
              value={form.crm_enabled} onChange={v=>s('crm_enabled',v)}/>
          )}
          {moduleAllowed('invoicing') && (
            <Toggle label="CPQ Module" desc="Quotations, Orders, Invoices, Products — toggling this hides/shows those items in the sidebar and switches the Orders/Invoices detail view. Click Save below to apply."
              value={form.cpq_enabled} onChange={v=>s('cpq_enabled',v)}/>
          )}
          {moduleAllowed('retail') && (
            <Toggle label="B2C Retail Mode" desc="Enable retail customers, POS-style orders and invoices"
              value={form.b2c_mode} onChange={v=>s('b2c_mode',v)}/>
          )}
          <Toggle label="Global Search" desc="Search across all objects from the top navigation bar"
            value={form.global_search_enabled} onChange={v=>s('global_search_enabled',v)}/>
        </div>
        {tenantModules.length < 6 && (
          <p className="text-xs text-amber-600 mt-2">ℹ️ Some modules are not available on your current plan. Contact your administrator to upgrade.</p>
        )}
      </div>

      {/* Regional */}
      <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5 space-y-4">
        <h3 className="font-bold text-[#0F172A]">🌍 Regional Settings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Default Currency</label>
            <select value={form.default_currency||'INR'} onChange={e=>s('default_currency',e.target.value)} className={iCls}>
              {CURRENCIES.map(c=><option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Date Format</label>
            <select value={form.date_format||'DD/MM/YYYY'} onChange={e=>s('date_format',e.target.value)} className={iCls}>
              {DATE_FORMATS.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Fiscal Year Starts</label>
            <select value={form.fiscal_year_start||'April'} onChange={e=>s('fiscal_year_start',e.target.value)} className={iCls}>
              {FISCAL_STARTS.map(f=><option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Business Type — Rental mode */}
      {moduleAllowed('retail') && form.b2c_mode && (
        <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5 space-y-3">
          <h3 className="font-bold text-[#0F172A]">🏪 Business Type</h3>
          <p className="text-xs text-gray-500">Choose how your retail business operates. This changes nothing else in the app unless you select Rental.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="button" onClick={()=>s('business_type','general')}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${(!form.business_type || form.business_type==='general') ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="font-bold text-[#0F172A] text-sm">🛍️ General Retail</div>
              <div className="text-xs text-gray-500 mt-1">Standard sell-and-ship retail. This is the default.</div>
            </button>
            <button type="button" onClick={()=>s('business_type','rental')}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${form.business_type==='rental' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="font-bold text-[#0F172A] text-sm">👗 Rental / Booking</div>
              <div className="text-xs text-gray-500 mt-1">For businesses that rent out items for date ranges (e.g. dress rental, equipment hire). Adds booking dates to order line items and prevents double-booking the same item.</div>
            </button>
          </div>
          {form.business_type === 'rental' && (
            <p className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
              ✓ Rental mode is on. Mark which products are rentable from the Products page, and configure which order statuses count as a confirmed booking under Admin Tools → Rental Settings.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {isDirty && <span className="text-xs font-semibold text-amber-600">● Unsaved changes — click Save to apply</span>}
        <button onClick={requestSave} disabled={saving}
          className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow disabled:opacity-50">
          {saving ? 'Saving…' : '💾 Save Preferences'}
        </button>
      </div>

      {/* Password confirmation modal */}
      {showPwModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-[24px] shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="text-4xl mb-3">🔒</div>
            <h3 className="font-bold text-[#0F172A] text-lg mb-1">Confirm Changes</h3>
            <p className="text-sm text-gray-400 mb-5">Enter the settings password to save these preferences.</p>
            <input
              type="password"
              value={pwInput}
              onChange={e=>{setPwInput(e.target.value);setPwError('');}}
              onKeyDown={e=>{if(e.key==='Enter')confirmSave();}}
              placeholder="Enter password"
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white text-center focus:outline-none focus:ring-2 focus:ring-blue-400 mb-2"
            />
            {pwError && <p className="text-red-500 text-xs mb-3">{pwError}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={()=>setShowPwModal(false)}
                className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={confirmSave}
                className="flex-1 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-2.5 rounded-xl text-sm font-bold">
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
