// @ts-nocheck
'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';
const sCls = iCls;
const tCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none';
const L = ({t}) => <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1.5">{t}</label>;

const WAREHOUSE_TYPES = ['Main Warehouse','Distribution Center','Regional Hub','Subinventory','Raw Material Store','Finished Goods','In-Transit','Returns & Defects','Consignment','Third-Party Logistics'];
const STATUS_OPTS = ['Active','Inactive','Under Maintenance'];

export default function WarehousesPanel() {
  const { warehouses, saveWarehouse, deleteWarehouse, organizations, businessUnits } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ status:'Active', type:'Main Warehouse' });
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const s = (k,v) => setForm(f => ({...f,[k]:v}));

  const filtered = (warehouses||[]).filter(w =>
    [w.name, w.code, w.city, w.type, w.manager_name].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  const openNew = () => { setEditing(null); setForm({ status:'Active', type:'Main Warehouse' }); setOpen(true); };
  const openEdit = (w) => { setEditing(w); setForm({...w}); setOpen(true); };

  const handleSave = async () => {
    if (!form.name?.trim()) { alert('Warehouse name is required.'); return; }
    setSaving(true);
    await saveWarehouse(form, editing?.id);
    setSaving(false);
    setOpen(false);
  };

  const TYPE_ICONS = {
    'Main Warehouse':'🏭','Distribution Center':'🚚','Regional Hub':'🔀','Subinventory':'📦',
    'Raw Material Store':'🪨','Finished Goods':'✅','In-Transit':'🚛','Returns & Defects':'↩️',
    'Consignment':'🤝','Third-Party Logistics':'🏢',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#0F172A]">Warehouses & Subinventories</h2>
          <p className="text-gray-500 text-sm mt-0.5">{(warehouses||[]).length} location(s) · Inventory storage structure for SCM</p>
        </div>
        <button onClick={openNew} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">+ Add Location</button>
      </div>

      {/* Search */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, code, city, type..."
        className="w-full max-w-md border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-400"/>

      {/* Type summary */}
      {(warehouses||[]).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...new Set((warehouses||[]).map(w=>w.type).filter(Boolean))].map(type=>(
            <span key={type} className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full font-medium border border-blue-100">
              {TYPE_ICONS[type]||'📦'} {type} ({(warehouses||[]).filter(w=>w.type===type).length})
            </span>
          ))}
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[24px] border border-blue-100 shadow">
          <div className="text-5xl mb-3">🏭</div>
          <p className="text-gray-400">No warehouses yet. Add your first storage location.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(w => (
            <div key={w.id} className="bg-white rounded-[20px] border border-blue-100 shadow hover:shadow-md transition-all p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0F172A] to-blue-800 flex items-center justify-center text-xl text-white shadow-md">
                    {TYPE_ICONS[w.type]||'📦'}
                  </div>
                  <div>
                    <div className="font-bold text-[#0F172A] text-sm">{w.name}</div>
                    {w.code && <div className="text-xs text-gray-400 font-mono">{w.code}</div>}
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${w.status==='Active'?'bg-green-100 text-green-700':w.status==='Under Maintenance'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-500'}`}>
                  {w.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-gray-500 mb-3">
                {w.type && <div className="flex items-center gap-1.5"><span>🏷️</span>{w.type}</div>}
                {(w.city||w.state) && <div className="flex items-center gap-1.5"><span>📍</span>{[w.city,w.state,w.country].filter(Boolean).join(', ')}</div>}
                {w.capacity && <div className="flex items-center gap-1.5"><span>📐</span>Capacity: {w.capacity} {w.capacity_unit||'units'}</div>}
                {w.manager_name && <div className="flex items-center gap-1.5"><span>👤</span>Manager: {w.manager_name}</div>}
                {w.is_subinventory && <div className="flex items-center gap-1.5"><span>🔗</span>Subinventory of: {(warehouses||[]).find(x=>x.id===w.parent_warehouse_id)?.name||'Parent'}</div>}
              </div>

              <div className="flex gap-2 pt-2 border-t border-blue-50">
                <button onClick={()=>openEdit(w)} className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-xl text-xs font-semibold hover:bg-blue-100">✏️ Edit</button>
                <button onClick={()=>deleteWarehouse(w.id)} className="bg-red-50 text-red-500 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-red-100">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setOpen(false)}/>
          <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-lg">{editing?'Edit Location':'New Location'}</h3>
                <p className="text-blue-300 text-xs mt-0.5">Warehouse, subinventory or storage location</p>
              </div>
              <button onClick={()=>setOpen(false)} className="text-white/60 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><L t="Location Name *"/><input value={form.name||''} onChange={e=>s('name',e.target.value)} placeholder="e.g. Mumbai Main Warehouse" className={iCls}/></div>
                <div><L t="Location Code"/><input value={form.code||''} onChange={e=>s('code',e.target.value)} placeholder="e.g. MUM-WH-01" className={iCls}/></div>
                <div><L t="Type"/><select value={form.type||''} onChange={e=>s('type',e.target.value)} className={sCls}>{WAREHOUSE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><L t="Status"/><select value={form.status||''} onChange={e=>s('status',e.target.value)} className={sCls}>{STATUS_OPTS.map(o=><option key={o}>{o}</option>)}</select></div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl">
                <input type="checkbox" id="is_sub" checked={!!form.is_subinventory} onChange={e=>s('is_subinventory',e.target.checked)} className="w-4 h-4 accent-blue-600"/>
                <label htmlFor="is_sub" className="text-sm text-[#0F172A] font-medium cursor-pointer">This is a Subinventory (child of another warehouse)</label>
              </div>

              {form.is_subinventory && (
                <div><L t="Parent Warehouse"/>
                  <select value={form.parent_warehouse_id||''} onChange={e=>s('parent_warehouse_id',e.target.value)} className={sCls}>
                    <option value="">Select parent...</option>
                    {(warehouses||[]).filter(w=>w.id!==editing?.id&&!w.is_subinventory).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><L t="Organization"/>
                  <select value={form.organization_id||''} onChange={e=>s('organization_id',e.target.value)} className={sCls}>
                    <option value="">All Organizations</option>
                    {(organizations||[]).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div><L t="Business Unit"/>
                  <select value={form.business_unit_id||''} onChange={e=>s('business_unit_id',e.target.value)} className={sCls}>
                    <option value="">All Business Units</option>
                    {(businessUnits||[]).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                <div className="font-semibold text-[#0F172A] text-sm">📍 Address & Location</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><L t="Address Line 1"/><input value={form.address_line1||''} onChange={e=>s('address_line1',e.target.value)} className={iCls}/></div>
                  <div><L t="Address Line 2"/><input value={form.address_line2||''} onChange={e=>s('address_line2',e.target.value)} className={iCls}/></div>
                  <div><L t="City"/><input value={form.city||''} onChange={e=>s('city',e.target.value)} className={iCls}/></div>
                  <div><L t="State / Province"/><input value={form.state||''} onChange={e=>s('state',e.target.value)} className={iCls}/></div>
                  <div><L t="Postal Code"/><input value={form.postal_code||''} onChange={e=>s('postal_code',e.target.value)} className={iCls}/></div>
                  <div><L t="Country"/><input value={form.country||''} onChange={e=>s('country',e.target.value)} className={iCls}/></div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                <div className="font-semibold text-[#0F172A] text-sm">📐 Capacity & Operations</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><L t="Total Capacity"/><input type="number" value={form.capacity||''} onChange={e=>s('capacity',e.target.value)} className={iCls}/></div>
                  <div><L t="Unit"/><select value={form.capacity_unit||'units'} onChange={e=>s('capacity_unit',e.target.value)} className={sCls}>{['units','sq ft','sq m','pallets','bins','tons'].map(u=><option key={u}>{u}</option>)}</select></div>
                  <div><L t="Temperature"/><select value={form.temperature_zone||'Ambient'} onChange={e=>s('temperature_zone',e.target.value)} className={sCls}>{['Ambient','Cold Storage','Frozen','Climate Controlled'].map(z=><option key={z}>{z}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><L t="Manager Name"/><input value={form.manager_name||''} onChange={e=>s('manager_name',e.target.value)} className={iCls}/></div>
                  <div><L t="Manager Contact"/><input value={form.manager_contact||''} onChange={e=>s('manager_contact',e.target.value)} placeholder="Phone or email" className={iCls}/></div>
                </div>
              </div>

              <div><L t="Notes / Description"/><textarea rows={3} value={form.description||''} onChange={e=>s('description',e.target.value)} placeholder="Storage guidelines, special instructions..." className={tCls}/></div>

              <div className="flex gap-3 pt-2">
                <button onClick={()=>setOpen(false)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-2xl font-semibold text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-50 shadow-lg hover:opacity-90">
                  {saving?'Saving...':'💾 Save Location'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
