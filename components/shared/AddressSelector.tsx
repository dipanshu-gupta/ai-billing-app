// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface AddressSelectorProps {
  customerId?: string;
  value?: string;            // full address string currently selected
  onChange: (formatted: string) => void;
  placeholder?: string;
  label?: string;
}

export default function AddressSelector({ customerId, value, onChange, placeholder = 'Select or type address', label }: AddressSelectorProps) {
  const [addresses, setAddresses] = useState([]);
  const [open, setOpen]           = useState(false);
  const [manual, setManual]       = useState(value || '');

  useEffect(() => {
    if (!supabase || !customerId) return;
    supabase.from('addresses').select('*')
      .eq('owner_type', 'customer').eq('owner_id', customerId)
      .order('is_default', { ascending: false }).order('created_at')
      .then(({ data }) => setAddresses(data || []));
  }, [customerId]);

  useEffect(() => { setManual(value || ''); }, [value]);

  const formatAddr = (a) =>
    [a.label && `[${a.label}]`, a.line1, a.line2, a.city, a.state && `${a.state} ${a.postal_code}`, a.country]
      .filter(Boolean).join(', ');

  const pick = (addr) => {
    const formatted = formatAddr(addr);
    setManual(formatted);
    onChange(formatted);
    setOpen(false);
  };

  return (
    <div className="relative">
      {label && <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">{label}</label>}
      <div className="relative">
        <textarea
          value={manual}
          onChange={e => { setManual(e.target.value); onChange(e.target.value); }}
          onFocus={() => addresses.length > 0 && setOpen(true)}
          placeholder={placeholder}
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none pr-10"
        />
        {addresses.length > 0 && (
          <button type="button" onClick={() => setOpen(!open)}
            className="absolute right-2 top-2.5 text-gray-400 hover:text-blue-600 transition-colors"
            title="Select from saved addresses">
            📍
          </button>
        )}
      </div>

      {open && addresses.length > 0 && (
        <div className="absolute z-[200] left-0 right-0 mt-1 bg-white rounded-2xl border border-blue-100 shadow-2xl overflow-hidden"
          style={{maxHeight:'240px', overflowY:'auto'}}>
          <div className="px-4 py-2 bg-gradient-to-r from-[#0F172A] to-blue-900 text-white text-xs font-semibold">
            Saved Addresses · Click to select
          </div>
          {addresses.map(addr => (
            <button key={addr.id} type="button" onClick={() => pick(addr)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${addr.address_type==='Billing'?'bg-blue-100 text-blue-700':addr.address_type==='Shipping'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>
                  {addr.address_type}
                </span>
                {addr.label && <span className="text-xs text-gray-500 font-medium">{addr.label}</span>}
                {addr.is_default && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Default</span>}
              </div>
              <div className="text-sm text-[#0F172A]">{formatAddr(addr)}</div>
            </button>
          ))}
          <button onClick={() => setOpen(false)} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600">
            Close ✕
          </button>
        </div>
      )}
    </div>
  );
}
