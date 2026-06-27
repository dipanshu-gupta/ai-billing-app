// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import AppearancePanel from '@/components/admin/AppearancePanel';
import AppComposer from '@/components/admin/AppComposer';
import SecurityConsole from '@/components/admin/SecurityConsole';
import B2BAppComposer from '@/components/admin/B2BAppComposer';
import TenantAdminPanel from '@/components/admin/TenantAdminPanel';
import RetailInvoiceDesigner from '@/components/admin/RetailInvoiceDesigner';
import DocumentTemplateDesigner from '@/components/admin/DocumentTemplateDesigner';
import WarehousesPanel from '@/components/admin/WarehousesPanel';
import { useApp } from '@/context/AppContext';
import { formatDate, getStatusOptions } from '@/lib/utils';
import Modal from '@/components/shared/Modal';

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
const RETAIL_CONDITION_FIELDS: Record<string,{v:string,l:string}[]> = {
  retailCustomers:  [{v:'status',l:'Status'},{v:'loyalty_tier',l:'Loyalty Tier'},{v:'gender',l:'Gender'},{v:'city',l:'City'},{v:'owner',l:'Owner'}],
  retailProducts:   [{v:'status',l:'Status'},{v:'category',l:'Category'},{v:'brand',l:'Brand'},{v:'price',l:'Price'},{v:'stock_quantity',l:'Stock Qty'}],
  retailActivities: [{v:'status',l:'Status'},{v:'activity_type',l:'Activity Type'},{v:'priority',l:'Priority'},{v:'owner',l:'Owner'}],
  retailOrders:     [{v:'status',l:'Status'},{v:'payment_status',l:'Payment Status'},{v:'payment_method',l:'Payment Method'},{v:'amount',l:'Amount'},{v:'owner',l:'Owner'}],
  retailInvoices:   [{v:'status',l:'Status'},{v:'payment_status',l:'Payment Status'},{v:'amount',l:'Amount'},{v:'due_date',l:'Due Date'},{v:'owner',l:'Owner'}],
};
// Fields available per object for conditions / update-field actions
const CONDITION_FIELDS = {
  customers:     [{v:'status',l:'Status'},{v:'industry',l:'Industry'},{v:'country',l:'Country'},{v:'city',l:'City'},{v:'owner',l:'Owner'}],
  leads:         [{v:'status',l:'Status'},{v:'source',l:'Source'},{v:'amount',l:'Amount'},{v:'campaign',l:'Campaign'},{v:'owner',l:'Owner'}],
  opportunities: [{v:'status',l:'Status'},{v:'stage',l:'Stage'},{v:'amount',l:'Amount'},{v:'probability',l:'Probability %'},{v:'currency',l:'Currency'},{v:'owner',l:'Owner'}],
  orders:        [{v:'status',l:'Status'},{v:'amount',l:'Amount'},{v:'currency',l:'Currency'},{v:'payment_status',l:'Payment Status'},{v:'owner',l:'Owner'}],
  invoices:      [{v:'status',l:'Status'},{v:'payment_terms',l:'Payment Terms'},{v:'amount',l:'Amount'},{v:'currency',l:'Currency'},{v:'payment_status',l:'Payment Status'},{v:'owner',l:'Owner'}],
  contacts:      [{v:'status',l:'Status'},{v:'designation',l:'Designation'},{v:'department',l:'Department'},{v:'owner',l:'Owner'}],
  activities:    [{v:'status',l:'Status'},{v:'activity_type',l:'Activity Type'},{v:'priority',l:'Priority'},{v:'owner',l:'Owner'}],
  quotations:    [{v:'status',l:'Status'},{v:'payment_terms',l:'Payment Terms'},{v:'currency',l:'Currency'},{v:'grand_total',l:'Grand Total'},{v:'owner',l:'Owner'}],
  products:      [{v:'status',l:'Status'},{v:'category',l:'Category'},{v:'productFamily',l:'Product Family'},{v:'price',l:'Price'}],
};

// For a given object + field, return dropdown options (null = free text)
const getFieldOptions = (objType, field) => {
  if (field === 'status')        return getStatusOptions(objType);
  if (field === 'source')        return ['Website','Campaign','Referral','Cold Call','Trade Show','Partner'];
  if (field === 'stage')         return ['Qualification','Proposal Sent','Negotiation','Closed Won','Closed Lost'];
  if (field === 'activity_type') return ['Call','Meeting','Email','Task','Demo'];
  if (field === 'industry')      return ['Technology','Healthcare','Finance','Retail','Manufacturing','Education','Other'];
  if (field === 'payment_terms') return ['Due on Receipt','Net 15','Net 30','Net 45'];
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
  {v:'send_notification',l:'Send Notification'},
  {v:'change_status',l:'Change Status'},
  {v:'update_field',l:'Update Field'},
  {v:'assign_record',l:'Assign Record'},
  {v:'send_email',l:'Send Email'},
];

// ─── Label helper ─────────────────────────────────────────────────────────────
const L = ({t}) => <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1.5">{t}</label>;

// ─── Condition value field: dropdown or text ──────────────────────────────────
function ConditionValue({ objType, field, value, onChange }) {
  const opts = getFieldOptions(objType, field);
  if (!field) return <input value={value||''} onChange={e=>onChange(e.target.value)} placeholder="Value" className={iCls}/>;
  if (opts) return (
    <select value={value||''} onChange={e=>onChange(e.target.value)} className={sCls}>
      <option value="">Select value</option>
      {opts.map(o => <option key={o}>{o}</option>)}
    </select>
  );
  return <input value={value||''} onChange={e=>onChange(e.target.value)} placeholder="Enter value" className={iCls}/>;
}

// ─── Workflow Action Config row ───────────────────────────────────────────────
function ActionConfig({ action, idx, objType, onUpdate, onRemove, users, conditionFields = CONDITION_FIELDS }) {
  const cfg = action.action_config || {};
  const setCfg = (k,v) => onUpdate(idx, {...action, action_config:{...cfg, [k]:v}});
  const setType = (v) => onUpdate(idx, {...action, action_type:v, action_config:{}});

  const condFields = conditionFields[objType] || [];
  const statusOpts = getStatusOptions(objType);
  const selectedField = cfg.field_name;
  const fieldValueOpts = getFieldOptions(objType, selectedField);

  return (
    <div className="bg-blue-50 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[#0F172A] text-sm">Action {idx+1}</span>
        {idx > 0 && <button onClick={()=>onRemove(idx)} className="text-red-500 text-xs font-semibold hover:underline">Remove</button>}
      </div>
      <div>
        <L t="Action Type"/>
        <select value={action.action_type||''} onChange={e=>setType(e.target.value)} className={sCls}>
          <option value="">Select action</option>
          {ACTION_TYPES.map(a=><option key={a.v} value={a.v}>{a.l}</option>)}
        </select>
      </div>

      {/* Send Notification */}
      {action.action_type==='send_notification' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><L t="Notify User"/><select value={cfg.recipient||''} onChange={e=>setCfg('recipient',e.target.value)} className={sCls}><option value="">Select user</option>{users.map(u=><option key={u.email} value={u.email}>{u.first_name} {u.last_name}</option>)}</select></div>
          <div className="md:col-span-2"><L t="Message"/><textarea rows={2} value={cfg.message||''} onChange={e=>setCfg('message',e.target.value)} placeholder="Notification message..." className={tCls}/></div>
        </div>
      )}

      {/* Change Status */}
      {action.action_type==='change_status' && (
        <div><L t="New Status"/><select value={cfg.new_status||''} onChange={e=>setCfg('new_status',e.target.value)} className={sCls}><option value="">Select status</option>{statusOpts.map(s=><option key={s}>{s}</option>)}</select></div>
      )}

      {/* Update Field */}
      {action.action_type==='update_field' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <L t="Field to Update"/>
            <select value={cfg.field_name||''} onChange={e=>setCfg('field_name',e.target.value)} className={sCls}>
              <option value="">Select field</option>
              {condFields.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
            </select>
          </div>
          <div>
            <L t="New Value"/>
            {fieldValueOpts
              ? <select value={cfg.field_value||''} onChange={e=>setCfg('field_value',e.target.value)} className={sCls}><option value="">Select</option>{fieldValueOpts.map(o=><option key={o}>{o}</option>)}</select>
              : <input value={cfg.field_value||''} onChange={e=>setCfg('field_value',e.target.value)} placeholder="New value" className={iCls}/>
            }
          </div>
        </div>
      )}

      {/* Assign Record */}
      {action.action_type==='assign_record' && (
        <div><L t="Assign To User"/><select value={cfg.assign_to||''} onChange={e=>setCfg('assign_to',e.target.value)} className={sCls}><option value="">Select user</option>{users.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.email})</option>)}</select></div>
      )}

      {/* Send Email */}
      {action.action_type==='send_email' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><L t="To Email"/><input value={cfg.to_email||''} onChange={e=>setCfg('to_email',e.target.value)} placeholder="recipient@email.com" className={iCls}/></div>
          <div><L t="Subject"/><input value={cfg.subject||''} onChange={e=>setCfg('subject',e.target.value)} placeholder="Email subject" className={iCls}/></div>
          <div className="md:col-span-2"><L t="Body"/><textarea rows={3} value={cfg.body||''} onChange={e=>setCfg('body',e.target.value)} placeholder="Email body..." className={tCls}/></div>
        </div>
      )}
    </div>
  );
}

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
          {[['Organization Name','name'],['Org Code','organization_code'],['Industry','industry'],['Website','website'],['Country','country'],['Currency','currency']].map(([label,field])=>(
            <div key={field}><L t={label}/><input value={form[field]||''} onChange={e=>s(field,e.target.value)} className={iCls}/></div>
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
          <div className="col-span-2"><L t="Organization"/><select value={form.organization_id||''} onChange={e=>s('organization_id',e.target.value)} className={sCls}><option value="">Select Org</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
          {[['BU Name','name'],['BU Code','business_unit_code'],['Description','description']].map(([label,field])=>(
            <div key={field}><L t={label}/><input value={form[field]||''} onChange={e=>s(field,e.target.value)} className={iCls}/></div>
          ))}
          <div><L t="Status"/><select value={form.status||'Active'} onChange={e=>s('status',e.target.value)} className={sCls}><option>Active</option><option>Inactive</option></select></div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ USERS ════════════════════════════════════════════
function UsersPanel() {
  const { enterpriseUsers, organizations, businessUnits, roles, saveEnterpriseUser, adminResetPassword, updateAdminStatus } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({status:'Active'});
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPwUserId, setResetPwUserId] = useState(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const filtered = enterpriseUsers.filter(u=>[u.first_name,u.last_name,u.email,u.employee_code].some(v=>v?.toLowerCase().includes(search.toLowerCase())));

  const handleSave = async () => {
    if (!editing) {
      if (!form.email?.trim()) { alert('Email is required.'); return; }
      if (!password) { alert('Password is required for new users.'); return; }
      if (password !== confirmPassword) { alert('Passwords do not match.'); return; }
      if (password.length < 6) { alert('Password must be at least 6 characters.'); return; }
    }
    setSaving(true);
    await saveEnterpriseUser(form, editing?.id, password);
    setSaving(false);
    setOpen(false);
    setPassword('');
    setConfirmPassword('');
  };

  const handleResetPassword = async () => {
    if (!resetPwValue || resetPwValue.length < 6) { alert('Password must be at least 6 characters.'); return; }
    const user = enterpriseUsers.find(u => u.id === resetPwUserId);
    await adminResetPassword(user?.auth_user_id, resetPwValue);
    setResetPwUserId(null);
    setResetPwValue('');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0F172A]">Enterprise Users</h2><p className="text-gray-500 text-sm">{enterpriseUsers.length} user(s)</p></div>
        <button onClick={()=>{setEditing(null);setForm({status:'Active'});setPassword('');setConfirmPassword('');setOpen(true);}} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">+ Add User</button>
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
                      <button onClick={()=>{setEditing(u);setForm({...u});setPassword('');setConfirmPassword('');setOpen(true);}} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-semibold">Edit</button>
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
            {[['First Name','first_name'],['Last Name','last_name'],['Email','email'],['Phone','phone'],['Employee Code','employee_code'],['Username','username'],['Designation','designation']].map(([label,field])=>(
              <div key={field}>
                <L t={label}/>
                <input
                  value={form[field]||''}
                  onChange={e=>s(field,e.target.value)}
                  type={field==='email'?'email':'text'}
                  disabled={field==='email'&&!!editing}
                  className={`${iCls} ${field==='email'&&editing?'bg-gray-50 text-gray-400':''}`}
                  placeholder={field==='email'&&editing?'Cannot change email':''}
                />
              </div>
            ))}
            <div><L t="Organization"/><select value={form.organization_id||''} onChange={e=>s('organization_id',e.target.value)} className={sCls}><option value="">Select</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
            <div><L t="Business Unit"/><select value={form.business_unit_id||''} onChange={e=>s('business_unit_id',e.target.value)} className={sCls}><option value="">Select</option>{businessUnits.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div><L t="Role"/>
                <select value={form.role_id||''} onChange={e=>s('role_id',e.target.value)} className={sCls}>
                  <option value="">No Role Assigned</option>
                  {roles.map(r=><option key={r.id} value={r.id}>{r.role_name}</option>)}
                </select>
                {form.role_id && <div className="text-xs text-blue-600 mt-1">Role permissions will apply on next login or page refresh.</div>}
              </div>
            <div><L t="Status"/><select value={form.status||'Active'} onChange={e=>s('status',e.target.value)} className={sCls}><option>Active</option><option>Inactive</option></select></div>
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
                ? <p className="text-sm text-green-700">✅ This user has a linked Supabase Auth account (<span className="font-mono text-xs">{editing.auth_user_id}</span>). Use the <strong>Reset PW</strong> button in the table to change their password.</p>
                : <p className="text-sm text-yellow-700">⚠️ This user has no linked auth account — they cannot log in. Delete and re-create this user to set up login credentials.</p>
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
function WorkflowBuilderPanel({ objectList = ALL_OBJECTS, conditionFields = CONDITION_FIELDS, objectLabels = null }) {
  const { workflowRules, enterpriseUsers, saveWorkflowRule, deleteWorkflowRule } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ object_type:'leads', trigger_event:'on_create', is_active:true });
  const [actions, setActions] = useState([{ action_type:'send_notification', action_config:{} }]);
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const openNew = ()=>{
    setEditing(null);
    setForm({object_type:'leads',trigger_event:'on_create',is_active:true});
    setActions([{action_type:'send_notification',action_config:{}}]);
    setOpen(true);
  };

  const updateAction = (idx,updated)=>setActions(prev=>prev.map((a,i)=>i===idx?updated:a));
  const removeAction = idx=>setActions(prev=>prev.filter((_,i)=>i!==idx));
  const addAction = ()=>setActions(prev=>[...prev,{action_type:'send_notification',action_config:{}}]);

  const handleSave = async()=>{
    if(!form.name?.trim()){alert('Rule name is required.');return;}
    if(!actions.some(a=>a.action_type)){alert('At least one action is required.');return;}
    try{
      await saveWorkflowRule(form,actions,editing?.id);
      setOpen(false);
    }catch(e){alert('Save failed: '+(e?.message||'Unknown error'));}
  };

  const condFields = conditionFields[form.object_type]||[];
  const triggerFieldOpts = getFieldOptions(form.object_type, form.trigger_field);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0F172A]">Workflow Rules</h2><p className="text-gray-500 text-sm">{workflowRules.length} rule(s) — auto-trigger actions on record events</p></div>
        <button onClick={openNew} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">+ New Rule</button>
      </div>

      {workflowRules.length===0
        ? <div className="py-16 text-center bg-white rounded-[24px] border border-blue-100 shadow"><div className="text-5xl mb-3">⚙️</div><div className="font-bold text-[#0F172A] text-lg mb-2">No workflow rules yet</div><p className="text-gray-400 mb-5">Create rules to automate notifications, field updates, and status changes.</p><button onClick={openNew} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-3 rounded-2xl font-semibold text-sm">+ Create First Rule</button></div>
        : <div className="space-y-3">
            {workflowRules.map(rule=>(
              <div key={rule.id} className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-[#0F172A] text-lg">{rule.name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${rule.is_active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{rule.is_active?'Active':'Inactive'}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Object: <span className="font-medium text-[#0F172A]">{rule.object_type}</span> · Trigger: <span className="font-medium text-[#0F172A]">{rule.trigger_event}</span>
                      {rule.trigger_field&&<span> · When <span className="font-medium text-[#0F172A]">{rule.trigger_field}</span> = <span className="font-medium text-[#0F172A]">{rule.trigger_value}</span></span>}
                    </div>
                    {rule.description&&<div className="text-xs text-gray-400 mt-1">{rule.description}</div>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={async()=>{
                      setEditing(rule);setForm({...rule});
                      // Load saved actions from DB
                      const {supabase:sb}=await import('@/lib/supabase');
                      if(sb){
                        const{data:acts}=await sb.from('workflow_actions').select('*').eq('workflow_rule_id',rule.id).order('execution_order');
                        setActions(acts?.length?acts.map(a=>({action_type:a.action_type,action_config:a.action_config||{}})):[{action_type:'send_notification',action_config:{}}]);
                      }
                      setOpen(true);
                    }} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold">Edit</button>
                    <button onClick={()=>deleteWorkflowRule(rule.id)} className="bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-xl text-sm font-semibold">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
      }

      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit Workflow Rule':'New Workflow Rule'} size="xl"
        footer={<><button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-blue-200 text-sm font-semibold">Cancel</button><button onClick={handleSave} className="px-5 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-2xl text-sm font-semibold">Save Rule</button></>}>
        <div className="space-y-6">
          {/* Rule basics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2"><L t="Rule Name *"/><input value={form.name||''} onChange={e=>s('name',e.target.value)} placeholder="e.g. Notify manager on new lead" className={iCls}/></div>
            <div className="col-span-2"><L t="Description"/><input value={form.description||''} onChange={e=>s('description',e.target.value)} placeholder="Optional description" className={iCls}/></div>

            <div>
              <L t="Object Type"/>
              <select value={form.object_type||'leads'} onChange={e=>s('object_type',e.target.value)} className={sCls}>
                {objectList.map(o=><option key={o} value={o}>{objectLabels?.[o]||o}</option>)}
              </select>
            </div>
            <div>
              <L t="Trigger Event"/>
              <select value={form.trigger_event||'on_create'} onChange={e=>s('trigger_event',e.target.value)} className={sCls}>
                <option value="on_create">On Create</option>
                <option value="on_update">On Update</option>
                <option value="on_status_change">On Status Change</option>
                <option value="on_delete">On Delete</option>
              </select>
            </div>

            {/* Trigger condition (optional) */}
            {(form.trigger_event==='on_update'||form.trigger_event==='on_status_change')&&(
              <>
                <div>
                  <L t="Trigger Field (optional)"/>
                  <select value={form.trigger_field||''} onChange={e=>s('trigger_field',e.target.value)} className={sCls}>
                    <option value="">Any field</option>
                    {condFields.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
                  </select>
                </div>
                <div>
                  <L t="Trigger Value (optional)"/>
                  {triggerFieldOpts
                    ? <select value={form.trigger_value||''} onChange={e=>s('trigger_value',e.target.value)} className={sCls}><option value="">Any value</option>{triggerFieldOpts.map(o=><option key={o}>{o}</option>)}</select>
                    : <input value={form.trigger_value||''} onChange={e=>s('trigger_value',e.target.value)} placeholder="Value that triggers rule" className={iCls}/>
                  }
                </div>
              </>
            )}

            <div>
              <L t="Active"/>
              <select value={form.is_active?'Yes':'No'} onChange={e=>s('is_active',e.target.value==='Yes')} className={sCls}>
                <option>Yes</option><option>No</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#0F172A] text-lg">Actions <span className="text-gray-400 font-normal text-sm ml-1">({actions.length})</span></h3>
              <button onClick={addAction} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold">+ Add Action</button>
            </div>
            <div className="space-y-4">
              {actions.map((action,idx)=>(
                <ActionConfig key={idx} action={action} idx={idx} objType={form.object_type||'leads'} onUpdate={updateAction} onRemove={removeAction} users={enterpriseUsers} conditionFields={conditionFields}/>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ ASSIGNMENT RULES ══════════════════════════════════
function AssignmentRulesPanel({ objectList = ALL_OBJECTS, conditionFields = CONDITION_FIELDS, objectLabels = null }) {
  const { assignmentRules, enterpriseUsers, userGroups, saveAssignmentRule, deleteAssignmentRule } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ object_type:'leads', condition_operator:'equals', priority:1, is_active:true });
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const condFields = conditionFields[form.object_type]||[];
  const valueOpts = getFieldOptions(form.object_type, form.condition_field);

  const handleSave = async()=>{
    if(!form.name?.trim()){alert('Rule name is required.');return;}
    if(!form.condition_field){alert('Condition field is required.');return;}
    if(!form.assign_to_user_id&&!form.assign_to_group_id){alert('Select a user or group to assign to.');return;}
    try{
      await saveAssignmentRule(form,editing?.id);
      setOpen(false);
    }catch(e){alert('Save failed: '+(e?.message||'Unknown error'));}
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0F172A]">Assignment Rules</h2><p className="text-gray-500 text-sm">{assignmentRules.length} rule(s) — auto-assign records to users or groups</p></div>
        <button onClick={()=>{setEditing(null);setForm({object_type:'leads',condition_operator:'equals',priority:1,is_active:true});setOpen(true);}} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">+ New Rule</button>
      </div>

      {assignmentRules.length===0
        ? <div className="py-16 text-center bg-white rounded-[24px] border border-blue-100 shadow"><div className="text-5xl mb-3">📋</div><div className="font-bold text-[#0F172A] text-lg mb-2">No assignment rules yet</div><p className="text-gray-400 mb-5">Auto-assign records to users or groups based on field conditions.</p><button onClick={()=>{setEditing(null);setForm({object_type:'leads',condition_operator:'equals',priority:1,is_active:true});setOpen(true);}} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-3 rounded-2xl font-semibold text-sm">+ Create First Rule</button></div>
        : <div className="space-y-3">
            {[...assignmentRules].sort((a,b)=>a.priority-b.priority).map(rule=>{
              const assignee=enterpriseUsers.find(u=>u.id===rule.assign_to_user_id);
              const grp=userGroups.find(g=>g.id===rule.assign_to_group_id);
              return (
                <div key={rule.id} className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">P{rule.priority}</div>
                      <h3 className="font-bold text-[#0F172A] text-lg">{rule.name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${rule.is_active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{rule.is_active?'Active':'Inactive'}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      <span className="font-medium text-[#0F172A]">{rule.object_type}</span>: If <span className="font-medium text-[#0F172A]">{rule.condition_field}</span> {rule.condition_operator} <span className="font-medium text-[#0F172A]">"{rule.condition_value}"</span>
                      {' → '}Assign to <span className="font-medium text-[#0F172A]">{assignee?`${assignee.first_name} ${assignee.last_name}`:grp?.group_name||'—'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async()=>{
                      setEditing(rule);setForm({...rule});
                      // Load saved actions from DB
                      const {supabase:sb}=await import('@/lib/supabase');
                      if(sb){
                        const{data:acts}=await sb.from('workflow_actions').select('*').eq('workflow_rule_id',rule.id).order('execution_order');
                        setActions(acts?.length?acts.map(a=>({action_type:a.action_type,action_config:a.action_config||{}})):[{action_type:'send_notification',action_config:{}}]);
                      }
                      setOpen(true);
                    }} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold">Edit</button>
                    <button onClick={()=>deleteAssignmentRule(rule.id)} className="bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-xl text-sm font-semibold">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
      }

      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit Assignment Rule':'New Assignment Rule'} size="lg"
        footer={<><button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-blue-200 text-sm font-semibold">Cancel</button><button onClick={handleSave} className="px-5 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-2xl text-sm font-semibold">Save Rule</button></>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-2"><L t="Rule Name *"/><input value={form.name||''} onChange={e=>s('name',e.target.value)} placeholder="e.g. Assign website leads to sales team" className={iCls}/></div>

          <div>
            <L t="Object Type"/>
            <select value={form.object_type||'leads'} onChange={e=>{s('object_type',e.target.value);s('condition_field','');s('condition_value','');}} className={sCls}>
              {objectList.map(o=><option key={o} value={o}>{objectLabels?.[o]||o}</option>)}
            </select>
          </div>
          <div><L t="Priority (1 = highest)"/><input type="number" min={1} value={form.priority||1} onChange={e=>s('priority',Number(e.target.value))} className={iCls}/></div>

          <div className="col-span-2 bg-blue-50 rounded-2xl p-4 space-y-3">
            <h4 className="font-bold text-[#0F172A] text-sm">Condition — When this is true, apply the rule</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <L t="Field"/>
                <select value={form.condition_field||''} onChange={e=>{s('condition_field',e.target.value);s('condition_value','');}} className={sCls}>
                  <option value="">Select field</option>
                  {condFields.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
                </select>
              </div>
              <div>
                <L t="Operator"/>
                <select value={form.condition_operator||'equals'} onChange={e=>s('condition_operator',e.target.value)} className={sCls}>
                  {OPERATORS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
              <div>
                <L t="Value"/>
                <ConditionValue objType={form.object_type} field={form.condition_field} value={form.condition_value||''} onChange={v=>s('condition_value',v)}/>
              </div>
            </div>
          </div>

          <div className="col-span-2 bg-green-50 rounded-2xl p-4 space-y-3">
            <h4 className="font-bold text-[#0F172A] text-sm">Assignment — Assign the record to</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <L t="User (Owner)"/>
                <select value={form.assign_to_user_id||''} onChange={e=>s('assign_to_user_id',e.target.value)} className={sCls}>
                  <option value="">Select user</option>
                  {enterpriseUsers.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name} — {u.email}</option>)}
                </select>
              </div>
              <div>
                <L t="Group"/>
                <select value={form.assign_to_group_id||''} onChange={e=>s('assign_to_group_id',e.target.value)} className={sCls}>
                  <option value="">Select group</option>
                  {userGroups.map(g=><option key={g.id} value={g.id}>{g.group_name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div><L t="Active"/><select value={form.is_active?'Yes':'No'} onChange={e=>s('is_active',e.target.value==='Yes')} className={sCls}><option>Yes</option><option>No</option></select></div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ SLA POLICIES ════════════════════════════════════
function SLAPoliciesPanel({ objectList = ALL_OBJECTS, conditionFields = CONDITION_FIELDS, objectLabels = null }) {
  const { slaPolicies, enterpriseUsers, userGroups, saveSLAPolicy, deleteSLAPolicy } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ object_type:'leads', response_time_hours:2, resolution_time_hours:24, warning_threshold_pct:80, is_active:true });
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const condFields = conditionFields[form.object_type]||[];
  const valueOpts = getFieldOptions(form.object_type, form.condition_field);

  const handleSave = async()=>{
    if(!form.name?.trim()){alert('Policy name is required.');return;}
    try{
      await saveSLAPolicy(form,editing?.id);
      setOpen(false);
    }catch(e){alert('Save failed: '+(e?.message||'Unknown error'));}
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0F172A]">SLA Policies</h2><p className="text-gray-500 text-sm">{slaPolicies.length} polic(ies) — define response & resolution time targets</p></div>
        <button onClick={()=>{setEditing(null);setForm({object_type:'leads',response_time_hours:2,resolution_time_hours:24,warning_threshold_pct:80,is_active:true});setOpen(true);}} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">+ New Policy</button>
      </div>

      {slaPolicies.length===0
        ? <div className="py-16 text-center bg-white rounded-[24px] border border-blue-100 shadow"><div className="text-5xl mb-3">⏱️</div><div className="font-bold text-[#0F172A] text-lg mb-2">No SLA policies yet</div><p className="text-gray-400 mb-5">Set response and resolution time targets per object and condition.</p><button onClick={()=>setOpen(true)} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-3 rounded-2xl font-semibold text-sm">+ Create First Policy</button></div>
        : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {slaPolicies.map(p=>(
              <div key={p.id} className="bg-white border border-blue-100 rounded-[24px] shadow-lg p-5">
                <div className="flex items-start justify-between mb-4">
                  <div><h3 className="font-bold text-[#0F172A] text-lg">{p.name}</h3><div className="text-xs text-gray-400 mt-0.5">{p.policy_number} · {p.object_type}</div></div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${p.is_active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{p.is_active?'Active':'Inactive'}</span>
                </div>
                {p.condition_field&&<div className="text-xs text-gray-500 mb-3">When {p.condition_field} = <span className="font-semibold text-[#0F172A]">{p.condition_value}</span></div>}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between bg-blue-50 rounded-xl px-3 py-2"><span className="text-gray-500">Response Time</span><span className="font-bold text-[#0F172A]">{p.response_time_hours}h</span></div>
                  <div className="flex justify-between bg-orange-50 rounded-xl px-3 py-2"><span className="text-gray-500">Resolution Time</span><span className="font-bold text-[#0F172A]">{p.resolution_time_hours}h</span></div>
                  <div className="flex justify-between bg-yellow-50 rounded-xl px-3 py-2"><span className="text-gray-500">Warning At</span><span className="font-bold text-[#0F172A]">{p.warning_threshold_pct}% elapsed</span></div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={()=>{setEditing(p);setForm({...p});setOpen(true);}} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-xl text-sm font-semibold">Edit</button>
                  <button onClick={()=>deleteSLAPolicy(p.id)} className="bg-red-100 hover:bg-red-200 text-red-600 px-3 py-2 rounded-xl text-sm font-semibold">Delete</button>
                </div>
              </div>
            ))}
          </div>
      }

      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit SLA Policy':'New SLA Policy'} size="lg"
        footer={<><button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-blue-200 text-sm font-semibold">Cancel</button><button onClick={handleSave} className="px-5 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-2xl text-sm font-semibold">Save Policy</button></>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-2"><L t="Policy Name *"/><input value={form.name||''} onChange={e=>s('name',e.target.value)} placeholder="e.g. High Priority Lead SLA" className={iCls}/></div>

          <div>
            <L t="Object Type"/>
            <select value={form.object_type||'leads'} onChange={e=>{s('object_type',e.target.value);s('condition_field','');s('condition_value','');}} className={sCls}>
              {objectList.map(o=><option key={o} value={o}>{objectLabels?.[o]||o}</option>)}
            </select>
          </div>
          <div><L t="Active"/><select value={form.is_active?'Yes':'No'} onChange={e=>s('is_active',e.target.value==='Yes')} className={sCls}><option>Yes</option><option>No</option></select></div>

          <div className="col-span-2 bg-blue-50 rounded-2xl p-4 space-y-3">
            <h4 className="font-bold text-[#0F172A] text-sm">Apply When (optional condition)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <L t="Condition Field"/>
                <select value={form.condition_field||''} onChange={e=>{s('condition_field',e.target.value);s('condition_value','');}} className={sCls}>
                  <option value="">All records (no condition)</option>
                  {condFields.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
                </select>
              </div>
              <div>
                <L t="Condition Value"/>
                <ConditionValue objType={form.object_type} field={form.condition_field} value={form.condition_value||''} onChange={v=>s('condition_value',v)}/>
              </div>
            </div>
          </div>

          <div className="col-span-2 bg-orange-50 rounded-2xl p-4 space-y-3">
            <h4 className="font-bold text-[#0F172A] text-sm">Time Targets</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><L t="Response Time (hours)"/><input type="number" min={1} value={form.response_time_hours||2} onChange={e=>s('response_time_hours',Number(e.target.value))} className={iCls}/></div>
              <div><L t="Resolution Time (hours)"/><input type="number" min={1} value={form.resolution_time_hours||24} onChange={e=>s('resolution_time_hours',Number(e.target.value))} className={iCls}/></div>
              <div><L t="Warning At (%)"/><input type="number" min={1} max={99} value={form.warning_threshold_pct||80} onChange={e=>s('warning_threshold_pct',Number(e.target.value))} className={iCls}/></div>
            </div>
          </div>

          <div>
            <L t="Escalate To User"/>
            <select value={form.escalate_to_user_id||''} onChange={e=>s('escalate_to_user_id',e.target.value)} className={sCls}>
              <option value="">Select user</option>
              {enterpriseUsers.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
            </select>
          </div>
          <div>
            <L t="Escalate To Group"/>
            <select value={form.escalate_to_group_id||''} onChange={e=>s('escalate_to_group_id',e.target.value)} className={sCls}>
              <option value="">Select group</option>
              {userGroups.map(g=><option key={g.id} value={g.id}>{g.group_name}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ APPROVAL PROCESSES ═══════════════════════════════
function ConditionBuilder({ conditions, setConditions, objectType, conditionFields = CONDITION_FIELDS }) {
  const conds = conditions?.conditions || [];
  const logic  = conditions?.logic || 'AND';

  const add    = () => setConditions(c => ({ ...c, conditions: [...(c.conditions||[]), { field:'', operator:'equals', value:'' }] }));
  const remove = idx => setConditions(c => ({ ...c, conditions: (c.conditions||[]).filter((_,i) => i !== idx) }));
  const upd    = (idx, k, v) => setConditions(c => ({ ...c, conditions: (c.conditions||[]).map((x,i) => i===idx ? {...x,[k]:v} : x) }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-bold text-[#0F172A]">Match</span>
        <select value={logic} onChange={e=>setConditions(c=>({...c,logic:e.target.value}))} className={`${sCls} w-auto`}>
          <option value="AND">ALL conditions (AND)</option>
          <option value="OR">ANY condition (OR)</option>
        </select>
        <button onClick={add} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold">+ Add Condition</button>
      </div>
      {conds.length === 0
        ? <div className="text-gray-400 text-sm bg-white rounded-xl px-4 py-3 border border-blue-100">No conditions — applies to ALL records. Add conditions to restrict.</div>
        : conds.map((cond, idx) => {
            const opts = getFieldOptions(objectType, cond.field);
            return (
              <div key={idx} className="grid grid-cols-3 gap-2 items-start">
                <div>
                  {idx === 0 && <L t="Field"/>}
                  <select value={cond.field||''} onChange={e=>upd(idx,'field',e.target.value)} className={sCls}>
                    <option value="">Select field</option>
                    {(conditionFields[objectType]||[]).map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
                  </select>
                </div>
                <div>
                  {idx === 0 && <L t="Operator"/>}
                  <select value={cond.operator||'equals'} onChange={e=>upd(idx,'operator',e.target.value)} className={sCls}>
                    {OPERATORS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    {idx === 0 && <L t="Value"/>}
                    {opts
                      ? <select value={cond.value||''} onChange={e=>upd(idx,'value',e.target.value)} className={sCls}><option value="">Select</option>{opts.map(o=><option key={o}>{o}</option>)}</select>
                      : <input value={cond.value||''} onChange={e=>upd(idx,'value',e.target.value)} placeholder="Value" className={iCls}/>
                    }
                  </div>
                  <button onClick={()=>remove(idx)} className={`text-red-500 hover:text-red-700 font-bold text-lg ${idx===0?'mt-7':''}`}>✕</button>
                </div>
              </div>
            );
          })
      }
    </div>
  );
}

function ApprovalProcessesPanel({ objectList = ALL_OBJECTS, conditionFields = CONDITION_FIELDS, objectLabels = null }) {
  const { approvalProcesses, enterpriseUsers, userGroups, saveApprovalProcess, deleteApprovalProcess } = useApp();
  const [open,     setOpen]     = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState({ object_type:'opportunities', is_active:true });
  const [conditions, setConditions] = useState({ logic:'AND', conditions:[] });
  const [steps,    setSteps]    = useState([{ step_name:'Manager Approval', approver_user_id:'', approval_type:'any', on_approve_action:'Approved', on_reject_action:'Rejected' }]);
  const [loading,  setLoading]  = useState(false);
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const addStep    = () => setSteps(p=>[...p,{step_name:'',approver_user_id:'',approval_type:'any',on_approve_action:'Approved',on_reject_action:'Rejected'}]);
  const removeStep = idx => setSteps(p=>p.filter((_,i)=>i!==idx));
  const setStep    = (idx,k,v) => setSteps(p=>p.map((st,i)=>i===idx?{...st,[k]:v}:st));

  const openNew = () => {
    setEditing(null);
    setForm({object_type:'opportunities',is_active:true});
    setConditions({logic:'AND',conditions:[]});
    setSteps([{step_name:'Manager Approval',approver_user_id:'',approval_type:'any',on_approve_action:'Approved',on_reject_action:'Rejected'}]);
    setOpen(true);
  };

  const openEdit = async (proc) => {
    setLoading(true);
    setEditing(proc);
    setForm({...proc});
    // Restore conditions from DB
    const savedConds = proc.conditions || { logic:'AND', conditions:[] };
    setConditions(typeof savedConds === 'string' ? JSON.parse(savedConds) : savedConds);
    // Load steps from Supabase
    const { createClient } = await import('@supabase/supabase-js').catch(()=>({}));
    // Use supabase from lib
    const { supabase: sb } = await import('@/lib/supabase');
    if (sb) {
      const { data: stepRows } = await sb.from('approval_steps').select('*').eq('approval_process_id', proc.id).order('step_number');
      if (stepRows?.length) {
        setSteps(stepRows.map(r=>({
          step_name:         r.step_name         || '',
          approver_user_id:  r.approver_user_id  || '',
          approver_group_id: r.approver_group_id || '',
          approval_type:     r.approval_type     || 'any',
          on_approve_action: r.on_approve_action || 'Approved',
          on_reject_action:  r.on_reject_action  || 'Rejected',
        })));
      } else {
        setSteps([{step_name:'Manager Approval',approver_user_id:'',approval_type:'any',on_approve_action:'Approved',on_reject_action:'Rejected'}]);
      }
    }
    setLoading(false);
    setOpen(true);
  };

  const handleSave = async () => {
    if(!form.name?.trim()){alert('Process name is required.');return;}
    if(!steps.length){alert('Add at least one approval step.');return;}
    if(steps.some(st=>!st.approver_user_id)){alert('All steps must have an approver selected.');return;}
    try {
      await saveApprovalProcess({...form, conditions}, steps, editing?.id);
      setOpen(false);
    } catch(e){alert('Save failed: '+(e?.message||'Unknown error'));}
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0F172A]">Approval Processes</h2><p className="text-gray-500 text-sm">{approvalProcesses.length} process(es) — configure multi-step approval workflows</p></div>
        <button onClick={openNew} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">+ New Process</button>
      </div>

      {approvalProcesses.length===0
        ? <div className="py-16 text-center bg-white rounded-[24px] border border-blue-100 shadow"><div className="text-5xl mb-3">✅</div><div className="font-bold text-[#0F172A] text-lg mb-2">No approval processes yet</div><p className="text-gray-400 mb-5">Create multi-step approval workflows. Records meeting conditions will show a Submit for Approval button.</p><button onClick={openNew} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-3 rounded-2xl font-semibold text-sm">+ Create First Process</button></div>
        : <div className="space-y-3">
            {approvalProcesses.map(proc=>(
              <div key={proc.id} className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-[#0F172A] text-lg">{proc.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${proc.is_active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{proc.is_active?'Active':'Inactive'}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Object: <span className="font-medium text-[#0F172A]">{proc.object_type}</span>
                    {(() => {
                      const conds = proc.conditions?.conditions || [];
                      if (!conds.length) return <span> · Applies to all records</span>;
                      return <span> · {conds.length} condition{conds.length>1?'s':''} ({proc.conditions?.logic||'AND'})</span>;
                    })()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>openEdit(proc)} disabled={loading} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">Edit</button>
                  <button onClick={()=>deleteApprovalProcess(proc.id)} className="bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-xl text-sm font-semibold">Delete</button>
                </div>
              </div>
            ))}
          </div>
      }

      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit Approval Process':'New Approval Process'} size="xl"
        footer={<><button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-blue-200 text-sm font-semibold">Cancel</button><button onClick={handleSave} className="px-5 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-2xl text-sm font-semibold">Save Process</button></>}>
        <div className="space-y-6">
          {/* Basics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2"><L t="Process Name *"/><input value={form.name||''} onChange={e=>s('name',e.target.value)} placeholder="e.g. High Value Deal Approval" className={iCls}/></div>
            <div>
              <L t="Object Type"/>
              <select value={form.object_type||'opportunities'} onChange={e=>{s('object_type',e.target.value);setConditions({logic:'AND',conditions:[]});}} className={sCls}>
                {objectList.map(o=><option key={o} value={o}>{objectLabels?.[o]||o}</option>)}
              </select>
            </div>
            <div><L t="Active"/><select value={form.is_active?'Yes':'No'} onChange={e=>s('is_active',e.target.value==='Yes')} className={sCls}><option>Yes</option><option>No</option></select></div>
          </div>

          {/* Conditions */}
          <div className="bg-blue-50 rounded-2xl p-5 space-y-4">
            <div><h4 className="font-bold text-[#0F172A]">Approval Conditions</h4><p className="text-xs text-gray-500 mt-1">The "Submit for Approval" button appears on records that meet these conditions.</p></div>
            <ConditionBuilder conditions={conditions} setConditions={setConditions} objectType={form.object_type||'opportunities'} conditionFields={conditionFields}/>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="font-bold text-[#0F172A] text-lg">Approval Steps</h3><p className="text-xs text-gray-500 mt-0.5">Steps are executed in order.</p></div>
              <button onClick={addStep} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold">+ Add Step</button>
            </div>
            <div className="space-y-4">
              {steps.map((step,idx)=>(
                <div key={idx} className="bg-blue-50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
                      <span className="w-7 h-7 bg-[#0F172A] text-white rounded-full flex items-center justify-center text-xs">{idx+1}</span>
                      Step {idx+1}
                    </span>
                    {steps.length>1&&<button onClick={()=>removeStep(idx)} className="text-red-500 text-xs font-semibold hover:underline">Remove Step</button>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><L t="Step Name"/><input value={step.step_name||''} onChange={e=>setStep(idx,'step_name',e.target.value)} placeholder="e.g. Manager Approval" className={iCls}/></div>
                    <div>
                      <L t="Approver *"/>
                      <select value={step.approver_user_id||''} onChange={e=>setStep(idx,'approver_user_id',e.target.value)} className={`${sCls} ${!step.approver_user_id?'border-red-200':''}`}>
                        <option value="">Select approver user</option>
                        {enterpriseUsers.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.email})</option>)}
                      </select>
                      {!step.approver_user_id&&<p className="text-red-500 text-xs mt-1">Required</p>}
                    </div>
                    <div><L t="Approval Type"/><select value={step.approval_type||'any'} onChange={e=>setStep(idx,'approval_type',e.target.value)} className={sCls}><option value="any">Any Approver</option><option value="all">All Approvers</option></select></div>
                    <div>
                      <L t="Group Approver (optional)"/>
                      <select value={step.approver_group_id||''} onChange={e=>setStep(idx,'approver_group_id',e.target.value)} className={sCls}>
                        <option value="">No group</option>
                        {userGroups.map(g=><option key={g.id} value={g.id}>{g.group_name}</option>)}
                      </select>
                    </div>
                    <div><L t="On Approve → Status"/><input value={step.on_approve_action||'Approved'} onChange={e=>setStep(idx,'on_approve_action',e.target.value)} placeholder="e.g. Approved" className={iCls}/></div>
                    <div><L t="On Reject → Status"/><input value={step.on_reject_action||'Rejected'} onChange={e=>setStep(idx,'on_reject_action',e.target.value)} placeholder="e.g. Rejected" className={iCls}/></div>
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

// ═══════════════════════════ QUOTE TEMPLATES ═══════════════════════════════════
function TemplateDesignerPanel() {
  return <DocumentTemplateDesigner docType="quote" />;
}


// ═══════════════════════════ APP PREFERENCES ══════════════════════════════════
const CURRENCIES = ['INR','USD','EUR','GBP','AED','SGD','AUD','CAD','JPY','CNY'];
const DATE_FORMATS = ['DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD'];
const FISCAL_YEARS = ['January','April','July','October'];

const PREFERENCES_PASSKEY = '193728bB@';

function AppPreferencesPanel() {
  const { appPreferences, saveAppPreferences, fetchExchangeRates } = useApp();
  const [form,    setForm]    = useState({ ...appPreferences });
  const [saving,  setSaving]  = useState(false);
  const [testRate,setTestRate]= useState(null);
  const [passkeyOpen, setPasskeyOpen] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState('');
  const [passkeyError, setPasskeyError] = useState('');
  const sf = (k,v) => setForm(p => ({...p,[k]:v}));

  useEffect(() => { setForm(p => ({ ...p, ...appPreferences })); }, [JSON.stringify(appPreferences)]);

  const handleSave = async () => {
    setPasskeyInput('');
    setPasskeyError('');
    setPasskeyOpen(true);
  };

  const confirmSaveWithPasskey = async () => {
    if (passkeyInput !== PREFERENCES_PASSKEY) {
      setPasskeyError('Incorrect passkey. Please contact your Business Pro admin to get the passkey.');
      return;
    }
    setPasskeyOpen(false);
    setSaving(true);
    await saveAppPreferences(form);
    setSaving(false);
    alert('App preferences saved successfully!');
  };

  const testExchangeRate = async () => {
    try {
      const res  = await fetch(`https://open.er-api.com/v6/latest/${form.default_currency||'INR'}`);
      const data = await res.json();
      if (data?.rates) {
        const preview = Object.entries(data.rates).filter(([k])=>CURRENCIES.includes(k)).slice(0,6);
        setTestRate({ base: form.default_currency, rates: preview });
        await fetchExchangeRates(form.default_currency);
      } else { alert('Could not fetch exchange rates. Check your internet connection.'); }
    } catch(e) { alert('Exchange rate API error: '+e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0F172A]">App Preferences</h2><p className="text-gray-500 text-sm">Configure application-wide settings. Changes take effect immediately.</p></div>
        <button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90 disabled:opacity-50">{saving?'Saving...':'💾 Save Preferences'}</button>
      </div>

      {/* ── B2C / Retail Mode Toggle ───────────────────────────────────────── */}
      <div className={`rounded-[24px] border-2 shadow-lg overflow-hidden transition-all mb-6 ${form.b2c_mode ? 'border-purple-400' : 'border-blue-100'}`}>
        <div className={`px-6 py-4 ${form.b2c_mode ? 'bg-gradient-to-r from-purple-900 to-purple-600' : 'bg-gradient-to-r from-[#0F172A] to-blue-900'}`}>
          <h3 className="text-white font-bold">🛍️ B2C / Retail Mode</h3>
          <p className="text-purple-200 text-xs mt-0.5">Switch the entire application to Retail (B2C) mode with dedicated retail objects and dashboard</p>
        </div>
        <div className={`p-6 ${form.b2c_mode ? 'bg-gradient-to-br from-purple-50 to-white' : 'bg-white'}`}>
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{form.b2c_mode ? '🛍️' : '🏢'}</span>
                <div>
                  <div className="font-bold text-[#0F172A] flex items-center gap-2">
                    {form.b2c_mode ? 'Retail (B2C) Mode' : 'Enterprise (B2B) Mode'}
                    {form.b2c_mode && <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">ACTIVE</span>}
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {form.b2c_mode
                      ? 'Navigator shows Retail objects only. B2B objects are hidden.'
                      : 'Navigator shows all B2B objects. Retail objects are hidden.'}
                  </p>
                </div>
              </div>
              {form.b2c_mode && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {['🧑‍🤝‍🧑 Retail Customers','📅 Activities','🏷️ Products','🛍️ Orders','🧾 Invoices','📊 Retail Dashboard'].map(tag=>(
                    <span key={tag} className="bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-full font-medium">{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => sf('b2c_mode', !form.b2c_mode)}
              className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${form.b2c_mode ? 'bg-purple-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out ${form.b2c_mode ? 'translate-x-6' : 'translate-x-0'}`}/>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Module Toggles */}
        <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4"><h3 className="text-white font-bold">Module Configuration</h3><p className="text-blue-300 text-xs mt-0.5">Enable or disable application modules</p></div>
          <div className="p-6 space-y-5">
            {[
              { key:'crm_enabled',  label:'CRM Module', desc:'Enable customer, lead, opportunity, contact and activity management', icon:'👥' },
              { key:'cpq_enabled',  label:'CPQ Module (Quotations)', desc:'Enable quotation management. When ON: Opportunity → Quote → Order → Invoice. When OFF: Opportunity → Order → Invoice', icon:'📄' },
              { key:'global_search_enabled', label:'Global Search', desc:'Show a search bar in the header to search across all records and objects in real time. Default: Off', icon:'🔍' },
            ].map(item=>(
              <div key={item.key} className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all ${form[item.key]?'border-blue-200 bg-blue-50':'border-gray-100 bg-gray-50'}`}>
                <div className="text-3xl">{item.icon}</div>
                <div className="flex-1">
                  <div className="font-bold text-[#0F172A] flex items-center gap-3">
                    {item.label}
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${form[item.key]?'bg-green-100 text-green-700':'bg-gray-200 text-gray-500'}`}>{form[item.key]?'Enabled':'Disabled'}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">{item.desc}</div>
                </div>
                <button onClick={()=>sf(item.key, !form[item.key])}
                  className={`w-14 h-7 rounded-full transition-all flex-shrink-0 mt-1 relative ${form[item.key]?'bg-blue-600':'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${form[item.key]?'left-7':'left-0.5'}`}/>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Regional Settings */}
        <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4"><h3 className="text-white font-bold">Regional & Currency Settings</h3><p className="text-blue-300 text-xs mt-0.5">Default currency and localization</p></div>
          <div className="p-6 space-y-4">
            <div>
              <L t="Default Currency"/>
              <select value={form.default_currency||'INR'} onChange={e=>sf('default_currency',e.target.value)} className={sCls}>
                {CURRENCIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <L t="Date Format"/>
              <select value={form.date_format||'DD/MM/YYYY'} onChange={e=>sf('date_format',e.target.value)} className={sCls}>
                {DATE_FORMATS.map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <L t="Fiscal Year Start"/>
              <select value={form.fiscal_year_start||'April'} onChange={e=>sf('fiscal_year_start',e.target.value)} className={sCls}>
                {FISCAL_YEARS.map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="pt-2 border-t border-blue-50">
              <button onClick={testExchangeRate} className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2">
                💱 Test Exchange Rates for {form.default_currency||'INR'}
              </button>
              {testRate && (
                <div className="mt-3 bg-green-50 border border-green-100 rounded-2xl p-4">
                  <div className="text-xs font-bold text-green-700 mb-2">Live Rates (base: {testRate.base})</div>
                  <div className="grid grid-cols-3 gap-2">
                    {testRate.rates.map(([cur,rate])=>(
                      <div key={cur} className="text-center bg-white rounded-xl py-2 px-3">
                        <div className="font-bold text-[#0F172A] text-sm">{cur}</div>
                        <div className="text-xs text-gray-500">{Number(rate).toFixed(4)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Flow preview */}
      <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg p-6">
        <h3 className="font-bold text-[#0F172A] mb-4">Current Business Flow</h3>
        <div className="flex items-center gap-3 flex-wrap">
          {(form.crm_enabled ? ['Lead','Opportunity'] : []).concat(form.cpq_enabled ? ['Quotation','Order','Invoice'] : ['Order','Invoice']).map((step,i,arr)=>(
            <div key={step} className="flex items-center gap-3">
              <div className={`px-5 py-2.5 rounded-2xl font-bold text-sm shadow ${step==='Quotation'?'bg-gradient-to-r from-purple-500 to-purple-700 text-white':step==='Order'||step==='Invoice'?'bg-gradient-to-r from-green-500 to-emerald-600 text-white':'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white'}`}>{step}</div>
              {i < arr.length-1 && <span className="text-gray-300 text-xl font-light">→</span>}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">{form.cpq_enabled ? 'CPQ mode: Full quotation workflow enabled. Order and invoice layouts use CPQ-style fields with line items, discounts and tax.' : 'Non-CPQ mode: Orders created directly from opportunities with simple layout.'}</p>
      </div>

      {/* Passkey confirmation dialog */}
      {passkeyOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setPasskeyOpen(false)}/>
          <div className="relative bg-white rounded-[24px] shadow-2xl max-w-sm w-full p-6">
            <div className="text-4xl mb-3 text-center">🔒</div>
            <h3 className="text-lg font-bold text-[#0F172A] mb-1 text-center">Confirm Passkey</h3>
            <p className="text-sm text-gray-500 text-center mb-4">Enter the admin passkey to save App Preferences.</p>
            <input
              type="password"
              autoFocus
              autoComplete="new-password"
              name="bp-admin-passkey"
              value={passkeyInput}
              onChange={e=>{setPasskeyInput(e.target.value); setPasskeyError('');}}
              onKeyDown={e=>{ if(e.key==='Enter') confirmSaveWithPasskey(); }}
              placeholder="Enter passkey"
              className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-center"
            />
            {passkeyError && (
              <p className="text-xs text-red-500 mt-2 text-center">{passkeyError}</p>
            )}
            <p className="text-xs text-gray-400 mt-3 text-center">Please contact Business Pro admin to get the passkey.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setPasskeyOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-100">
                Cancel
              </button>
              <button onClick={confirmSaveWithPasskey}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0F172A] to-blue-800 text-white text-sm font-bold hover:opacity-90 shadow-md">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════ ADMIN HOME ════════════════════════════════════════
// B2B Enterprise Admin sections
const B2B_SECTIONS = [
  {key:'organizations', label:'Organizations',     icon:'🏢', desc:'Companies & tenants'},
  {key:'businessUnits', label:'Business Units',    icon:'🏗️', desc:'Divisions & departments'},
  {key:'users',         label:'Users',             icon:'👤', desc:'Enterprise accounts'},
  {key:'groups',        label:'User Groups',       icon:'👥', desc:'Group access & assignment'},
  {key:'security',      label:'Security Console',  icon:'🔐', desc:'Roles & permissions'},
  {key:'workflow',      label:'Workflow Builder',  icon:'⚙️', desc:'Auto-trigger on events'},
  {key:'assignment',    label:'Assignment Rules',  icon:'📋', desc:'Auto-assign records'},
  {key:'sla',           label:'SLA Policies',      icon:'⏱️', desc:'Response time targets'},
  {key:'approvals',     label:'Approval Processes',icon:'✅', desc:'Multi-step approvals'},
  {key:'templates',     label:'Quote Templates',   icon:'📄', desc:'Branded quote layouts'},
  {key:'invoiceTemplates',label:'Invoice Templates',icon:'🧾',desc:'Branded invoice layouts'},
  {key:'warehouses',    label:'Warehouses & SCM',  icon:'🏭', desc:'Warehouses, subinventories & storage'},
  {key:'appPrefs',      label:'App Preferences',   icon:'⚙️', desc:'CPQ, CRM & currency settings'},
  {key:'appearance',    label:'Appearance',        icon:'🎨', desc:'Logo, themes & language'},
  {key:'tenants', label:'Tenant Admin', icon:'🌐', desc:'Manage client workspaces & subscriptions'},
  {key:'b2b_composer', label:'App Composer', icon:'🧩', desc:'Add custom fields to CRM objects'},
];

// B2C Retail Admin sections — enabled only in B2C mode
const B2C_SECTIONS = [
  {key:'r_organizations', label:'Organizations',     icon:'🏢', desc:'Retail org structure'},
  {key:'r_businessUnits', label:'Business Units',    icon:'🏗️', desc:'Retail divisions'},
  {key:'r_users',         label:'Users',             icon:'👤', desc:'Retail user accounts'},
  {key:'r_groups',        label:'User Groups',       icon:'👥', desc:'Group access & roles'},
  {key:'r_security',      label:'Security Console',  icon:'🔐', desc:'Retail roles & permissions'},
  {key:'r_invoiceTemplates',label:'Invoice Template',icon:'🧾', desc:'Retail invoice layouts'},
  {key:'r_approvals',     label:'Approval Processes',icon:'✅', desc:'Retail approval chains'},
  {key:'r_workflow',      label:'Workflow Builder',  icon:'⚙️', desc:'Retail event automation'},
  {key:'r_assignment',    label:'Assignment Rules',  icon:'📋', desc:'Retail record assignment'},
  {key:'r_sla',           label:'SLA Policies',      icon:'⏱️', desc:'Retail response targets'},
  {key:'r_composer',      label:'App Composer',      icon:'🎛️', desc:'Custom fields & layouts'},
  {key:'appPrefs',        label:'App Preferences',   icon:'⚙️', desc:'Global settings'},
  {key:'appearance',      label:'Appearance',        icon:'🎨', desc:'Themes & branding'},
];

// Legacy alias for renderSection compatibility
const ADMIN_SECTIONS = B2B_SECTIONS;

// ─── Retail Admin Context Wrapper ─────────────────────────────────────────────
// Shown above any B2B panel when accessed from B2C Admin — provides retail context
function RetailAdminWrapper({ title, icon, desc, objects, children }) {
    const scope = objects || Object.values(RETAIL_OBJECT_LABELS);
  return (
    <div className="space-y-5">
      {/* Retail context banner */}
      <div className="bg-gradient-to-r from-purple-900 to-purple-700 rounded-[20px] p-5 text-white">
        <div className="flex items-start gap-4">
          <div className="text-3xl">{icon}</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{title} <span className="text-purple-300 text-sm font-normal">— Retail (B2C)</span></h2>
            <p className="text-purple-200 text-sm mt-1">{desc}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {scope.map(obj=>(
                <span key={obj} className="bg-white/15 text-white text-xs px-2.5 py-1 rounded-full font-semibold">{obj}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* The actual panel */}
      {children}
    </div>
  );
}

export default function AdminToolsPage() {
  const [active, setActive] = useState(null);
  const [adminMode, setAdminMode] = useState('b2b'); // 'b2b' | 'b2c'
  const { hasPermission, currentUserPermissions, permissionsLoaded, currentUser, appPreferences } = useApp();
  const isB2CMode = appPreferences?.b2c_mode === true;
  // Admin tools page — data loaded via individual panel components
  // Gate: only admins (or users with admin_tools_view) can access this page
  const canAccessAdmin = !permissionsLoaded || // optimistic while loading
    (currentUserPermissions || []).includes('__admin__') ||
    (currentUserPermissions || []).includes('admin_tools_view') ||
    (currentUser as any)?.is_admin === true;

  const renderSection = ()=>{
    switch(active){
      case 'organizations': return <OrganizationsPanel/>;
      case 'businessUnits': return <BusinessUnitsPanel/>;
      case 'users':         return <UsersPanel/>;
      case 'groups':        return <UserGroupsPanel/>;
      case 'security':      return <SecurityConsole/>;
      case 'workflow':      return <WorkflowBuilderPanel/>;
      case 'assignment':    return <AssignmentRulesPanel/>;
      case 'sla':           return <SLAPoliciesPanel/>;
      case 'approvals':     return <ApprovalProcessesPanel/>;
      case 'templates':        return <TemplateDesignerPanel/>;
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
      case 'r_security':         return <RetailAdminWrapper title="Security Console" icon="🔐" desc="Retail roles, permissions and data access"><SecurityConsolePanel/></RetailAdminWrapper>;
      case 'r_invoiceTemplates': return <RetailInvoiceDesigner/>;
      case 'r_approvals':        return <RetailAdminWrapper title="Approval Processes" icon="✅" desc="Multi-step approvals for Retail Orders and Invoices" objects={Object.values(RETAIL_OBJECT_LABELS)}><ApprovalProcessesPanel objectList={RETAIL_OBJECTS_LIST} conditionFields={RETAIL_CONDITION_FIELDS} objectLabels={RETAIL_OBJECT_LABELS}/></RetailAdminWrapper>;
      case 'r_workflow':         return <RetailAdminWrapper title="Workflow Builder" icon="⚙️" desc="Auto-trigger actions on Retail data object events" objects={Object.values(RETAIL_OBJECT_LABELS)}><WorkflowBuilderPanel objectList={RETAIL_OBJECTS_LIST} conditionFields={RETAIL_CONDITION_FIELDS} objectLabels={RETAIL_OBJECT_LABELS}/></RetailAdminWrapper>;
      case 'r_assignment':       return <RetailAdminWrapper title="Assignment Rules" icon="📋" desc="Auto-assign Retail records to users" objects={Object.values(RETAIL_OBJECT_LABELS)}><AssignmentRulesPanel objectList={RETAIL_OBJECTS_LIST} conditionFields={RETAIL_CONDITION_FIELDS} objectLabels={RETAIL_OBJECT_LABELS}/></RetailAdminWrapper>;
      case 'r_sla':              return <RetailAdminWrapper title="SLA Policies" icon="⏱️" desc="Response and resolution SLA for Retail objects" objects={Object.values(RETAIL_OBJECT_LABELS)}><SLAPoliciesPanel objectList={RETAIL_OBJECTS_LIST} conditionFields={RETAIL_CONDITION_FIELDS} objectLabels={RETAIL_OBJECT_LABELS}/></RetailAdminWrapper>;
      case 'r_composer':         return <AppComposer/>;
      case 'tenants':            return <TenantAdminPanel/>;
      case 'b2b_composer':       return <B2BAppComposer/>;
      default:                   return null;
    }
  };

  if (!canAccessAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white rounded-[28px] border border-red-100 shadow p-12 text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Access Restricted</h2>
        <p className="text-gray-500 max-w-md">You don't have permission to access Admin Tools. Contact your Business Pro administrator to request access.</p>
      </div>
    );
  }

  const currentSections = adminMode==='b2c' ? B2C_SECTIONS : B2B_SECTIONS;
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
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${adminMode==='b2b'?'bg-white text-[#0F172A] shadow':'text-white/70 hover:text-white'}`}>
                🏢 B2B Enterprise
              </button>
              <button onClick={()=>{setAdminMode('b2c');setActive(null);}}
                disabled={!isB2CMode}
                title={!isB2CMode?'Enable B2C mode in App Preferences first':''}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${adminMode==='b2c'?'bg-purple-500 text-white shadow':'text-white/70 hover:text-white'}`}>
                🛍️ B2C Retail {!isB2CMode&&<span className="text-xs opacity-60">(disabled)</span>}
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