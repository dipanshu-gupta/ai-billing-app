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

const TRIGGER_EVENTS = [
  {v:'on_create',       l:'When record is Created'},
  {v:'on_update',       l:'When record is Updated'},
  {v:'on_delete',       l:'When record is Deleted'},
  {v:'on_status_change',l:'When Status changes'},
  {v:'on_field_change', l:'When Field changes'},
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
            setSaving(false); setOpen(false); setPassword(''); setConfirmPassword('');
            return;
          } else {
            alert('Failed to create auth: ' + (json.error || 'Unknown'));
          }
        } catch(e: any) { alert('Error: ' + e.message); }
      }
      // Normal update
      await saveEnterpriseUser(form, editing.id, undefined);
    } else {
      await saveEnterpriseUser(form, undefined, password);
    }
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
                ? <div className="space-y-2">
                    <p className="text-sm text-green-700">✅ Linked auth account: <span className="font-mono text-xs">{editing.auth_user_id?.slice(0,16)}...</span></p>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Reset Password (optional)</label>
                      <div className="flex gap-2">
                        <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                          placeholder="New password (leave blank to keep current)"
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                        <button onClick={async()=>{
                          if(!password){alert('Enter a new password');return;}
                          if(password.length<6){alert('Min 6 characters');return;}
                          await adminResetPassword(editing.auth_user_id, password);
                          setPassword('');
                          alert('✓ Password reset successfully');
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

function ConditionRow({ fields, condition, onChange, onRemove, users }) {
  const opts = getFieldOptions(null, condition.field);
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

function ConditionBuilder({ fields, conditions, logic, onChange }) {
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
        <ConditionRow key={i} fields={fields} condition={c}
          onChange={nc=>updCond(i,nc)} onRemove={()=>remCond(i)} />
      ))}
      <button onClick={addCond} className="text-sm text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
        + Add Condition
      </button>
    </div>
  );
}

function ActionBuilder({ action, idx, users, fields, onChange, onRemove }) {
  const cfg = action.action_config || {};
  const setcfg = (k,v) => onChange({ ...action, action_config: { ...cfg, [k]: v } });
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
            placeholder="Notification subject" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
          <textarea value={cfg.message||''} onChange={e=>setcfg('message',e.target.value)}
            placeholder="Notification message..." rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"/>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Additional Recipients (emails, comma-separated)</label>
            <input value={(cfg.recipients||[]).join(',')} onChange={e=>setcfg('recipients',e.target.value.split(',').map(x=>x.trim()).filter(Boolean))}
              placeholder="email1@co.com, email2@co.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
          </div>
        </div>
      )}

      {action.action_type === 'update_field' && (
        <div className="flex gap-2 ml-9 flex-wrap">
          <select value={cfg.field||''} onChange={e=>setcfg('field',e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="">Select field to update...</option>
            {fields.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
          </select>
          <input value={cfg.value||''} onChange={e=>setcfg('value',e.target.value)}
            placeholder="New value"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
        </div>
      )}

      {action.action_type === 'assign_owner' && (
        <div className="ml-9">
          <select value={cfg.user_id||''} onChange={e=>setcfg('user_id',e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="">Select user to assign...</option>
            {users.map(u=><option key={u.id} value={u.id}>{`${u.first_name||''} ${u.last_name||''}`.trim()||u.email}</option>)}
          </select>
        </div>
      )}

      {action.action_type === 'create_task' && (
        <div className="space-y-2 ml-9">
          <input value={cfg.task_name||''} onChange={e=>setcfg('task_name',e.target.value)}
            placeholder="Task name" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
          <div className="flex gap-2">
            <select value={cfg.priority||'Medium'} onChange={e=>setcfg('priority',e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
              {['Low','Medium','High'].map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <input type="date" value={cfg.due_date||''} onChange={e=>setcfg('due_date',e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Workflow Builder Panel ────────────────────────────────────────────────────
function WorkflowBuilderPanel({ objectList = ALL_OBJECTS, conditionFields = CONDITION_FIELDS, objectLabels = null }) {
  const { workflowRules, enterpriseUsers, saveWorkflowRule, deleteWorkflowRule } = useApp();
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState({ name:'', object_type:'leads', trigger_event:'on_create', trigger_field:'', trigger_value:'', is_active:true });
  const [conditions, setCond]   = useState({ logic:'AND', conditions:[] });
  const [actions, setActions]   = useState([{ action_type:'send_notification', action_config:{} }]);
  const [saving, setSaving]     = useState(false);
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const fields = conditionFields[form.object_type] || [];
  const triggerFieldOpts = getFieldOptions(form.object_type, form.trigger_field);

  const openNew = () => {
    setEditing(null);
    setForm({name:'',object_type:'leads',trigger_event:'on_create',trigger_field:'',trigger_value:'',is_active:true});
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

  const handleSave = async () => {
    if (!form.name?.trim()) { alert('Rule name is required.'); return; }
    if (!actions.length)    { alert('At least one action is required.'); return; }
    setSaving(true);
    try {
      await saveWorkflowRule({ ...form, conditions }, actions, editing?.id);
      setOpen(false);
    } catch(e: any) { alert('Save failed: ' + e.message); }
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
            <ConditionBuilder fields={fields} conditions={conditions.conditions||[]} logic={conditions.logic||'AND'} onChange={setCond}/>
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
                <ActionBuilder key={i} action={a} idx={i} users={enterpriseUsers} fields={fields}
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
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState({ name:'', object_type:'leads', condition_field:'', condition_operator:'equals', condition_value:'', assign_to_user_id:'', assign_to_group_id:'', priority:1, is_active:true });
  const [saving, setSaving]   = useState(false);
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const fields    = conditionFields[form.object_type] || [];
  const valueOpts = getFieldOptions(form.object_type, form.condition_field);
  const OBJ_LABELS = objectLabels || {};

  const openNew = () => {
    setEditing(null);
    setForm({name:'',object_type:'leads',condition_field:'',condition_operator:'equals',condition_value:'',assign_to_user_id:'',assign_to_group_id:'',priority:1,is_active:true});
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim())        { alert('Rule name is required.'); return; }
    if (!form.condition_field)     { alert('Condition field is required.'); return; }
    if (!form.assign_to_user_id && !form.assign_to_group_id) { alert('Select a user or group to assign to.'); return; }
    setSaving(true);
    try { await saveAssignmentRule(form, editing?.id); setOpen(false); }
    catch(e: any) { alert('Save failed: ' + e.message); }
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
                  {enterpriseUsers.map(u=><option key={u.id} value={u.id}>{`${u.first_name||''} ${u.last_name||''}`.trim()||u.email}</option>)}
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
              <input type="number" min="1" max="999" value={form.priority} onChange={e=>s('priority',Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"/>
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
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState({ name:'', object_type:'leads', condition_field:'status', condition_value:'', response_time_hours:24, resolution_time_hours:72, warning_threshold_pct:80, escalate_to_user_id:'', is_active:true });
  const [saving, setSaving]   = useState(false);
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const fields    = conditionFields[form.object_type] || [];
  const valueOpts = getFieldOptions(form.object_type, form.condition_field);
  const OBJ_LABELS = objectLabels || {};

  const openNew = () => {
    setEditing(null);
    setForm({name:'',object_type:'leads',condition_field:'status',condition_value:'',response_time_hours:24,resolution_time_hours:72,warning_threshold_pct:80,escalate_to_user_id:'',is_active:true});
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
            if(!form.name?.trim()){alert('Name required');return;}
            setSaving(true);
            try{await saveSLAPolicy(form,editing?.id);setOpen(false);}catch(e:any){alert(e.message);}
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
                {enterpriseUsers.map(u=><option key={u.id} value={u.id}>{`${u.first_name||''} ${u.last_name||''}`.trim()||u.email}</option>)}
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
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState({ name:'', object_type:'orders', is_active:true });
  const [conditions, setCond]   = useState({ logic:'AND', conditions:[] });
  const [steps, setSteps]       = useState([{ step_number:1, step_name:'Manager Approval', approver_user_id:'', approver_group_id:'', approval_type:'any', on_approve_action:'proceed', on_reject_action:'reject' }]);
  const [saving, setSaving]     = useState(false);
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));
  const fields    = conditionFields[form.object_type] || [];
  const OBJ_LABELS = objectLabels || {};

  const addStep = () => setSteps(p=>[...p,{step_number:p.length+1,step_name:'',approver_user_id:'',approver_group_id:'',approval_type:'any',on_approve_action:'proceed',on_reject_action:'reject'}]);

  const handleSave = async () => {
    if (!form.name?.trim()) { alert('Process name is required.'); return; }
    if (!steps.every(s=>s.approver_user_id||s.approver_group_id)) { alert('Each step needs an approver.'); return; }
    setSaving(true);
    try {
      await saveApprovalProcess({ ...form, conditions }, steps.map((s,i)=>({...s,step_number:i+1})), editing?.id);
      setOpen(false);
    } catch(e: any) { alert('Save failed: ' + e.message); }
    setSaving(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm({name:'',object_type:'orders',is_active:true});
    setCond({logic:'AND',conditions:[]});
    setSteps([{step_number:1,step_name:'Manager Approval',approver_user_id:'',approver_group_id:'',approval_type:'any',on_approve_action:'proceed',on_reject_action:'reject'}]);
    setOpen(true);
  };

  const openEdit = (proc) => {
    setEditing(proc);
    setForm({name:proc.name,object_type:proc.object_type,is_active:proc.is_active});
    setCond(proc.conditions||{logic:'AND',conditions:[]});
    setSteps(proc._steps||[{step_number:1,step_name:'',approver_user_id:'',approver_group_id:'',approval_type:'any',on_approve_action:'proceed',on_reject_action:'reject'}]);
    setOpen(true);
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
            <ConditionBuilder fields={fields} conditions={conditions.conditions||[]} logic={conditions.logic||'AND'} onChange={setCond}/>
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
                        {enterpriseUsers.map(u=><option key={u.id} value={u.id}>{`${u.first_name||''} ${u.last_name||''}`.trim()||u.email}</option>)}
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
  const [adminMode, setAdminMode] = useState('b2b'); // 'b2b' | 'b2c'
  const { hasPermission, currentUserPermissions, permissionsLoaded, currentUser, appPreferences } = useApp();
  const isB2CMode = appPreferences?.b2c_mode === true;
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
    { key:'tenants',        label:'Tenant Admin',     icon:'🌐', desc:'Manage client workspaces' },
    { key:'b2b_composer',   label:'App Composer',     icon:'🧩', desc:'Add custom fields to CRM objects' },
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
    { key:'r_invoiceDesigner',label:'Invoice Designer',icon:'🖨️', desc:'Design retail invoice templates' },
    { key:'r_appPrefs',      label:'App Preferences', icon:'⚙️', desc:'Retail app settings' },
    { key:'r_appearance',    label:'Appearance',      icon:'🎨', desc:'Retail branding' },
    { key:'r_composer',      label:'App Composer',    icon:'🧩', desc:'Custom fields for retail objects' },
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