// @ts-nocheck
'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useAlert } from '@/components/shared/AlertProvider';
import { t } from '@/lib/i18n';

// Extracted into its own file (rather than living inline in RetailListPage.tsx)
// so it can be shared with RentalBookingCalendar.tsx too, without creating a
// circular import — RetailListPage.tsx already imports RentalBookingCalendar,
// so the reverse import would have created a cycle.
//
// Matches the visual language of the full "Create Customer" modal
// (RetailCreateModal) exactly — same gradient header, same 2-column field
// grid, same label/input classes — rather than the plain-text-header, single-
// column layout this previously had. Each of the 3 call sites previously
// duplicated their own slightly-different header text and wrapper styling
// around this component; the header now lives here instead, so it's
// consistent everywhere this is used and callers only need to provide the
// backdrop/positioning.
export function RetailQuickCreateCustomer({ prefillName, onCreated, onClose }) {
  const { createRetailRecord, retailCustomers, appearance } = useApp();
  const { showAlert, showConfirm } = useAlert();
  const lang = appearance?.language || 'en';
  const [form, setForm] = useState({ name: prefillName||'', phone:'', email:'' });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) { showAlert('Name is required', { variant:'warning' }); return; }
    setSaving(true);
    try {
      // Duplicate check now happens centrally in createRetailRecord — covers
      // this quick-create flow and every other retail customer creation path
      // consistently, without prompting twice.
      const rec = await createRetailRecord('retailCustomers', {
        ...form, status:'Active', loyalty_points:0, loyalty_tier:'Standard',
      }, []);
      if (rec) onCreated(rec._uuid || rec.id, rec.name, rec.phone || form.phone || '');
    } catch (e) {
      console.error('[RetailQuickCreateCustomer] save', e);
      showAlert('Could not create customer: ' + (e?.message || 'An unexpected error occurred.'), { variant:'danger' });
    } finally {
      setSaving(false);
    }
  }

  // Identical to the iCls/labelCls used by the full Create Customer modal
  // (RetailListPage.tsx's RetailCreateModal), so a field looks the same
  // whether it's filled in here or in the full form.
  const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';
  const labelCls = 'block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5';

  return (
    <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-5 flex items-center justify-between flex-shrink-0">
        <h2 className="text-white text-xl font-bold">🧑‍🤝‍🧑 {t(lang,'create')} {t(lang,'customer')}</h2>
        <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className={labelCls}>Full Name <span className="text-red-400 ml-1">*</span></label>
          <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className={iCls} placeholder="Customer name" autoFocus/>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Phone</label>
            <input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} className={iCls} placeholder="+91 98765 43210"/>
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} className={iCls} placeholder="customer@example.com"/>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">{t(lang,'cancel')}</button>
          <button onClick={save} disabled={saving} className="flex-[2] bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 shadow hover:opacity-90">
            {saving ? t(lang,'loading') : `+ ${t(lang,'create')} ${t(lang,'customer')}`}
          </button>
        </div>
      </div>
    </div>
  );
}
