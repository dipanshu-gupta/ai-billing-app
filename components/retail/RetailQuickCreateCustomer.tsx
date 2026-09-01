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

  const iCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Full Name *</label>
        <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className={iCls} placeholder="Customer name" autoFocus/>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Phone</label>
        <input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} className={iCls} placeholder="+91 98765 43210"/>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Email</label>
        <input value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} className={iCls} placeholder="customer@example.com"/>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">{t(lang,'cancel')}</button>
        <button onClick={save} disabled={saving} className="flex-2 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 shadow hover:opacity-90">
          {saving ? t(lang,'loading') : `+ ${t(lang,'create')} ${t(lang,'customer')}`}
        </button>
      </div>
    </div>
  );
}
