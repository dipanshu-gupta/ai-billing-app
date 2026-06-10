// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const ADDR_TYPES = ['Billing','Shipping','Registered','Branch','Warehouse','Other'];
const COUNTRIES = ['India','United States','United Kingdom','UAE','Singapore','Australia','Canada','Germany','France','Japan','China','Brazil','South Africa','Other'];

const iCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400';
const sCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400';

const emptyAddr = () => ({
  id: null, address_type:'Billing', label:'', line1:'', line2:'',
  city:'', state:'', country:'India', postal_code:'', is_default:false,
});

function AddressCard({ addr, onEdit, onDelete, onSetDefault }) {
  return (
    <div className={`rounded-2xl border-2 p-4 transition-all ${addr.is_default ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${addr.address_type==='Billing'?'bg-blue-100 text-blue-700':addr.address_type==='Shipping'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>
            {addr.address_type}
          </span>
          {addr.label && <span className="text-xs font-semibold text-gray-500">{addr.label}</span>}
          {addr.is_default && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">★ Default</span>}
        </div>
        <div className="flex gap-1.5 ml-2">
          {!addr.is_default && <button onClick={() => onSetDefault(addr.id)} className="text-xs text-amber-600 hover:text-amber-800 px-2 py-1 rounded-lg hover:bg-amber-50">Set Default</button>}
          <button onClick={() => onEdit(addr)} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50">Edit</button>
          <button onClick={() => onDelete(addr.id)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50">Remove</button>
        </div>
      </div>
      <div className="text-sm text-[#0F172A] leading-relaxed">
        {addr.line1 && <div className="font-medium">{addr.line1}</div>}
        {addr.line2 && <div>{addr.line2}</div>}
        <div className="text-gray-500">
          {[addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')}
          {addr.country && ` · ${addr.country}`}
        </div>
      </div>
    </div>
  );
}

function AddressForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...emptyAddr(), ...initial });
  const s = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="bg-blue-50 rounded-2xl border-2 border-blue-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-[#0F172A]">{initial?.id ? 'Edit Address' : 'Add New Address'}</h4>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold uppercase text-gray-500 block mb-1.5">Address Type</label>
          <select value={form.address_type} onChange={e=>s('address_type',e.target.value)} className={sCls}>
            {ADDR_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-gray-500 block mb-1.5">Label (optional)</label>
          <input value={form.label} onChange={e=>s('label',e.target.value)} placeholder="e.g. Head Office, Mumbai" className={iCls}/>
        </div>
      </div>
      <div>
        <label className="text-xs font-bold uppercase text-gray-500 block mb-1.5">Address Line 1</label>
        <input value={form.line1} onChange={e=>s('line1',e.target.value)} placeholder="Street address, building" className={iCls}/>
      </div>
      <div>
        <label className="text-xs font-bold uppercase text-gray-500 block mb-1.5">Address Line 2</label>
        <input value={form.line2} onChange={e=>s('line2',e.target.value)} placeholder="Apartment, suite, floor (optional)" className={iCls}/>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-bold uppercase text-gray-500 block mb-1.5">City</label>
          <input value={form.city} onChange={e=>s('city',e.target.value)} placeholder="City" className={iCls}/>
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-gray-500 block mb-1.5">State / Province</label>
          <input value={form.state} onChange={e=>s('state',e.target.value)} placeholder="State" className={iCls}/>
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-gray-500 block mb-1.5">Postal Code</label>
          <input value={form.postal_code} onChange={e=>s('postal_code',e.target.value)} placeholder="PIN / ZIP" className={iCls}/>
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-gray-500 block mb-1.5">Country</label>
          <select value={form.country} onChange={e=>s('country',e.target.value)} className={sCls}>
            {COUNTRIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_default} onChange={e=>s('is_default',e.target.checked)} className="w-4 h-4 accent-blue-600"/>
        <span className="text-sm text-[#0F172A]">Set as default address</span>
      </label>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={()=>onSave(form)} className="px-5 py-2 text-sm rounded-xl bg-gradient-to-r from-[#0F172A] to-blue-800 text-white font-semibold hover:opacity-90 shadow-md">
          {initial?.id ? 'Update Address' : 'Add Address'}
        </button>
      </div>
    </div>
  );
}

export default function AddressManager({ ownerType, ownerId, disabled = false }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    if (!supabase || !ownerId) return;
    const { data } = await supabase.from('addresses')
      .select('*').eq('owner_type', ownerType).eq('owner_id', ownerId)
      .order('is_default', { ascending: false }).order('created_at');
    setAddresses(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ownerId]);

  const handleSave = async (form) => {
    if (!supabase) return;
    const payload = {
      owner_type: ownerType, owner_id: ownerId,
      address_type: form.address_type, label: form.label || null,
      line1: form.line1, line2: form.line2 || null,
      city: form.city, state: form.state || null,
      country: form.country, postal_code: form.postal_code || null,
      is_default: form.is_default,
    };
    if (form.is_default) {
      await supabase.from('addresses').update({ is_default: false }).eq('owner_type', ownerType).eq('owner_id', ownerId);
    }
    if (form.id) {
      await supabase.from('addresses').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', form.id);
    } else {
      await supabase.from('addresses').insert([{ ...payload, created_at: new Date().toISOString() }]);
    }
    setEditing(null); setAdding(false);
    await load();
  };

  const handleDelete = async (id) => {
    if (!supabase || !window.confirm('Remove this address?')) return;
    await supabase.from('addresses').delete().eq('id', id);
    await load();
  };

  const handleSetDefault = async (id) => {
    if (!supabase) return;
    await supabase.from('addresses').update({ is_default: false }).eq('owner_type', ownerType).eq('owner_id', ownerId);
    await supabase.from('addresses').update({ is_default: true }).eq('id', id);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-[#0F172A]">Addresses</h3>
          <p className="text-xs text-gray-400 mt-0.5">{addresses.length} saved address{addresses.length !== 1 ? 'es' : ''}</p>
        </div>
        {!disabled && !adding && !editing && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-4 py-2 rounded-xl hover:opacity-90 shadow-md">
            + Add Address
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-4 text-gray-400 text-sm">Loading addresses...</div>
      ) : (
        <div className="space-y-3">
          {addresses.length === 0 && !adding && (
            <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-2xl">
              <div className="text-2xl mb-1">📍</div>
              <p className="text-sm text-gray-400">No addresses saved yet</p>
              {!disabled && <button onClick={() => setAdding(true)} className="mt-2 text-xs text-blue-600 hover:underline">+ Add first address</button>}
            </div>
          )}
          {addresses.map(addr => (
            editing?.id === addr.id
              ? <AddressForm key={addr.id} initial={editing} onSave={handleSave} onCancel={() => setEditing(null)}/>
              : <AddressCard key={addr.id} addr={addr} onEdit={setEditing} onDelete={handleDelete} onSetDefault={handleSetDefault}/>
          ))}
          {adding && <AddressForm initial={null} onSave={handleSave} onCancel={() => setAdding(false)}/>}
        </div>
      )}
    </div>
  );
}
