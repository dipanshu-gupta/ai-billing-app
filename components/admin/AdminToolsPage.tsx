// @ts-nocheck
'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatDate, getStatusOptions } from '@/lib/utils';
import Modal from '@/components/shared/Modal';

// ─── Shared styles ────────────────────────────────────────────────────────────
const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder:text-gray-400';
const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';
const tCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none';

const ALL_OBJECTS = ['customers','leads','opportunities','orders','invoices','contacts','activities'];

// Fields available per object for conditions / update-field actions
const CONDITION_FIELDS = {
  customers:     [{v:'status',l:'Status'},{v:'industry',l:'Industry'},{v:'country',l:'Country'}],
  leads:         [{v:'status',l:'Status'},{v:'source',l:'Source'},{v:'amount',l:'Amount'}],
  opportunities: [{v:'status',l:'Status'},{v:'stage',l:'Stage'},{v:'amount',l:'Amount'}],
  orders:        [{v:'status',l:'Status'},{v:'amount',l:'Amount'},{v:'delivery_date',l:'Delivery Date'}],
  invoices:      [{v:'status',l:'Status'},{v:'payment_terms',l:'Payment Terms'},{v:'amount',l:'Amount'}],
  contacts:      [{v:'status',l:'Status'},{v:'designation',l:'Designation'}],
  activities:    [{v:'status',l:'Status'},{v:'activity_type',l:'Activity Type'}],
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
  {v:'equals',l:'Equals'},
  {v:'not_equals',l:'Not Equals'},
  {v:'contains',l:'Contains'},
  {v:'greater_than',l:'Greater Than'},
  {v:'less_than',l:'Less Than'},
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
function ActionConfig({ action, idx, objType, onUpdate, onRemove, users }) {
  const cfg = action.action_config || {};
  const setCfg = (k,v) => onUpdate(idx, {...action, action_config:{...cfg, [k]:v}});
  const setType = (v) => onUpdate(idx, {...action, action_type:v, action_config:{}});

  const condFields = CONDITION_FIELDS[objType] || [];
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
  const { enterpriseUsers, organizations, businessUnits, roles, saveEnterpriseUser, updateAdminStatus } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({status:'Active'});
  const [search, setSearch] = useState('');
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const filtered = enterpriseUsers.filter(u=>[u.first_name,u.last_name,u.email,u.employee_code].some(v=>v?.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0F172A]">Enterprise Users</h2><p className="text-gray-500 text-sm">{enterpriseUsers.length} user(s)</p></div>
        <button onClick={()=>{setEditing(null);setForm({status:'Active'});setOpen(true);}} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">+ Add User</button>
      </div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users..." className={iCls}/>
      <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-[#0F172A] to-blue-900 text-white"><tr>{['Code','Name','Email','Designation','Status','Actions'].map(h=><th key={h} className="px-5 py-3 text-left text-sm font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length===0?<tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No users found.</td></tr>:
              filtered.map(u=>(
                <tr key={u.id} className="border-t border-blue-50 hover:bg-blue-50/40">
                  <td className="px-5 py-3 text-xs font-mono text-gray-400">{u.employee_code}</td>
                  <td className="px-5 py-3 font-semibold text-[#0F172A]">{u.first_name} {u.last_name}</td>
                  <td className="px-5 py-3 text-gray-500">{u.email}</td>
                  <td className="px-5 py-3 text-gray-500">{u.designation||'-'}</td>
                  <td className="px-5 py-3"><span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.status==='Active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{u.status}</span></td>
                  <td className="px-5 py-3"><div className="flex gap-2">
                    <button onClick={()=>{setEditing(u);setForm({...u});setOpen(true);}} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-semibold">Edit</button>
                    <button onClick={()=>updateAdminStatus('enterprise_users',u.id,u.status==='Active'?'Inactive':'Active')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-semibold">{u.status==='Active'?'Deactivate':'Activate'}</button>
                  </div></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit User':'New User'} size="lg"
        footer={<><button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-blue-200 text-sm font-semibold">Cancel</button><button onClick={async()=>{await saveEnterpriseUser(form,editing?.id);setOpen(false);}} className="px-5 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-2xl text-sm font-semibold">Save</button></>}>
        <div className="grid grid-cols-2 gap-4">
          {[['First Name','first_name'],['Last Name','last_name'],['Email','email'],['Phone','phone'],['Employee Code','employee_code'],['Username','username'],['Designation','designation']].map(([label,field])=>(
            <div key={field}><L t={label}/><input value={form[field]||''} onChange={e=>s(field,e.target.value)} className={iCls}/></div>
          ))}
          <div><L t="Organization"/><select value={form.organization_id||''} onChange={e=>s('organization_id',e.target.value)} className={sCls}><option value="">Select</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
          <div><L t="Business Unit"/><select value={form.business_unit_id||''} onChange={e=>s('business_unit_id',e.target.value)} className={sCls}><option value="">Select</option>{businessUnits.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div><L t="Role"/><select value={form.role_id||''} onChange={e=>s('role_id',e.target.value)} className={sCls}><option value="">Select Role</option></select></div>
          <div><L t="Status"/><select value={form.status||'Active'} onChange={e=>s('status',e.target.value)} className={sCls}><option>Active</option><option>Inactive</option></select></div>
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
function WorkflowBuilderPanel() {
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

  const condFields = CONDITION_FIELDS[form.object_type]||[];
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
                    <button onClick={()=>{setEditing(rule);setForm({...rule});setOpen(true);}} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold">Edit</button>
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
                {ALL_OBJECTS.map(o=><option key={o} value={o}>{o}</option>)}
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
                <ActionConfig key={idx} action={action} idx={idx} objType={form.object_type||'leads'} onUpdate={updateAction} onRemove={removeAction} users={enterpriseUsers}/>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ ASSIGNMENT RULES ══════════════════════════════════
function AssignmentRulesPanel() {
  const { assignmentRules, enterpriseUsers, userGroups, saveAssignmentRule, deleteAssignmentRule } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ object_type:'leads', condition_operator:'equals', priority:1, is_active:true });
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const condFields = CONDITION_FIELDS[form.object_type]||[];
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
                    <button onClick={()=>{setEditing(rule);setForm({...rule});setOpen(true);}} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold">Edit</button>
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
              {ALL_OBJECTS.map(o=><option key={o} value={o}>{o}</option>)}
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
function SLAPoliciesPanel() {
  const { slaPolicies, enterpriseUsers, userGroups, saveSLAPolicy, deleteSLAPolicy } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ object_type:'leads', response_time_hours:2, resolution_time_hours:24, warning_threshold_pct:80, is_active:true });
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const condFields = CONDITION_FIELDS[form.object_type]||[];
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
              {ALL_OBJECTS.map(o=><option key={o} value={o}>{o}</option>)}
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
function ApprovalProcessesPanel() {
  const { approvalProcesses, approvalRequests, enterpriseUsers, userGroups, saveApprovalProcess, deleteApprovalProcess, processApproval, currentUser } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ object_type:'opportunities', condition_operator:'greater_than', is_active:true });
  const [steps, setSteps] = useState([{ step_name:'Manager Approval', approver_user_id:'', approval_type:'any', on_approve_action:'Approved', on_reject_action:'Rejected' }]);
  const [decisionComment, setDecisionComment] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  const condFields = CONDITION_FIELDS[form.object_type]||[];
  const valueOpts = getFieldOptions(form.object_type, form.condition_field);

  const addStep = ()=>setSteps(prev=>[...prev,{step_name:'',approver_user_id:'',approval_type:'any',on_approve_action:'Approved',on_reject_action:'Rejected'}]);
  const removeStep = idx=>setSteps(prev=>prev.filter((_,i)=>i!==idx));
  const setStep = (idx,k,v)=>setSteps(prev=>prev.map((st,i)=>i===idx?{...st,[k]:v}:st));

  const handleSave = async()=>{
    if(!form.name?.trim()){alert('Process name is required.');return;}
    if(!steps.length){alert('Add at least one approval step.');return;}
    if(steps.some(st=>!st.approver_user_id)){alert('All steps must have an approver.');return;}
    try{
      await saveApprovalProcess(form,steps,editing?.id);
      setOpen(false);
    }catch(e){alert('Save failed: '+(e?.message||'Unknown error'));}
  };

  // Pending requests where current user is approver
  const pendingRequests = approvalRequests.filter(r=>r.status==='Pending');

  const handleDecision = async(requestId, decision)=>{
    setProcessingId(requestId);
    await processApproval(requestId,decision,decisionComment);
    setDecisionComment('');
    setProcessingId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0F172A]">Approval Processes</h2><p className="text-gray-500 text-sm">{approvalProcesses.length} process(es)</p></div>
        <button onClick={()=>{setEditing(null);setForm({object_type:'opportunities',condition_operator:'greater_than',is_active:true});setSteps([{step_name:'Manager Approval',approver_user_id:'',approval_type:'any',on_approve_action:'Approved',on_reject_action:'Rejected'}]);setOpen(true);}} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">+ New Process</button>
      </div>

      {/* Pending Approvals Inbox */}
      {pendingRequests.length>0&&(
        <div className="bg-yellow-50 border border-yellow-200 rounded-[24px] p-5 space-y-3">
          <h3 className="font-bold text-yellow-800 flex items-center gap-2">⏳ Pending Approvals Inbox <span className="bg-yellow-200 text-yellow-800 text-xs font-bold px-2.5 py-0.5 rounded-full">{pendingRequests.length}</span></h3>
          {pendingRequests.map(req=>(
            <div key={req.id} className="bg-white border border-yellow-200 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-[#0F172A]">{req.record_name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{req.record_type} · {req.request_number}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Submitted by {req.submitted_by}</div>
                </div>
                <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-3 py-1 rounded-full">Pending</span>
              </div>
              <div className="space-y-2">
                <input value={decisionComment} onChange={e=>setDecisionComment(e.target.value)} placeholder="Add a comment (optional)" className={iCls}/>
                <div className="flex gap-3">
                  <button onClick={()=>handleDecision(req.id,'Approved')} disabled={processingId===req.id} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50">✅ Approve</button>
                  <button onClick={()=>handleDecision(req.id,'Rejected')} disabled={processingId===req.id} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50">❌ Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Processes list */}
      {approvalProcesses.length===0
        ? <div className="py-16 text-center bg-white rounded-[24px] border border-blue-100 shadow"><div className="text-5xl mb-3">✅</div><div className="font-bold text-[#0F172A] text-lg mb-2">No approval processes yet</div><p className="text-gray-400 mb-5">Create multi-step approval workflows for high-value records.</p><button onClick={()=>setOpen(true)} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-3 rounded-2xl font-semibold text-sm">+ Create First Process</button></div>
        : <div className="space-y-3">
            {approvalProcesses.map(proc=>{
              const procRequests = approvalRequests.filter(r=>r.approval_process_id===proc.id);
              const pending = procRequests.filter(r=>r.status==='Pending').length;
              return (
                <div key={proc.id} className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-[#0F172A] text-lg">{proc.name}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${proc.is_active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{proc.is_active?'Active':'Inactive'}</span>
                        {pending>0&&<span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">{pending} pending</span>}
                      </div>
                      <div className="text-sm text-gray-500">
                        <span className="font-medium text-[#0F172A]">{proc.object_type}</span>
                        {proc.condition_field&&<span>: When {proc.condition_field} {proc.condition_operator} <span className="font-medium text-[#0F172A]">"{proc.condition_value}"</span></span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{procRequests.length} total requests · {procRequests.filter(r=>r.status==='Approved').length} approved · {procRequests.filter(r=>r.status==='Rejected').length} rejected</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>{setEditing(proc);setForm({...proc});setOpen(true);}} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold">Edit</button>
                      <button onClick={()=>deleteApprovalProcess(proc.id)} className="bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-xl text-sm font-semibold">Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      }

      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit Approval Process':'New Approval Process'} size="xl"
        footer={<><button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-blue-200 text-sm font-semibold">Cancel</button><button onClick={handleSave} className="px-5 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-2xl text-sm font-semibold">Save Process</button></>}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2"><L t="Process Name *"/><input value={form.name||''} onChange={e=>s('name',e.target.value)} placeholder="e.g. High Value Deal Approval" className={iCls}/></div>

            <div>
              <L t="Object Type"/>
              <select value={form.object_type||'opportunities'} onChange={e=>{s('object_type',e.target.value);s('condition_field','');s('condition_value','');}} className={sCls}>
                {ALL_OBJECTS.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><L t="Active"/><select value={form.is_active?'Yes':'No'} onChange={e=>s('is_active',e.target.value==='Yes')} className={sCls}><option>Yes</option><option>No</option></select></div>

            <div className="col-span-2 bg-blue-50 rounded-2xl p-4 space-y-3">
              <h4 className="font-bold text-[#0F172A] text-sm">Apply When (condition)</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <L t="Field"/>
                  <select value={form.condition_field||''} onChange={e=>{s('condition_field',e.target.value);s('condition_value','');}} className={sCls}>
                    <option value="">All records</option>
                    {(CONDITION_FIELDS[form.object_type]||[]).map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
                  </select>
                </div>
                <div>
                  <L t="Operator"/>
                  <select value={form.condition_operator||'greater_than'} onChange={e=>s('condition_operator',e.target.value)} className={sCls}>
                    {OPERATORS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
                <div>
                  <L t="Value"/>
                  <ConditionValue objType={form.object_type} field={form.condition_field} value={form.condition_value||''} onChange={v=>s('condition_value',v)}/>
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#0F172A] text-lg">Approval Steps</h3>
              <button onClick={addStep} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold">+ Add Step</button>
            </div>
            <div className="space-y-4">
              {steps.map((step,idx)=>(
                <div key={idx} className="bg-blue-50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0F172A] text-sm">Step {idx+1}</span>
                    {steps.length>1&&<button onClick={()=>removeStep(idx)} className="text-red-500 text-xs font-semibold hover:underline">Remove Step</button>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><L t="Step Name"/><input value={step.step_name||''} onChange={e=>setStep(idx,'step_name',e.target.value)} placeholder="e.g. Manager Approval" className={iCls}/></div>
                    <div>
                      <L t="Approver"/>
                      <select value={step.approver_user_id||''} onChange={e=>setStep(idx,'approver_user_id',e.target.value)} className={sCls}>
                        <option value="">Select approver</option>
                        {enterpriseUsers.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.email})</option>)}
                      </select>
                    </div>
                    <div>
                      <L t="Approval Type"/>
                      <select value={step.approval_type||'any'} onChange={e=>setStep(idx,'approval_type',e.target.value)} className={sCls}>
                        <option value="any">Any Approver</option>
                        <option value="all">All Approvers</option>
                      </select>
                    </div>
                    <div>
                      <L t="Group Approver (optional)"/>
                      <select value={step.approver_group_id||''} onChange={e=>setStep(idx,'approver_group_id',e.target.value)} className={sCls}>
                        <option value="">No group</option>
                        {userGroups.map(g=><option key={g.id} value={g.id}>{g.group_name}</option>)}
                      </select>
                    </div>
                    <div><L t="On Approve → Set Status"/><input value={step.on_approve_action||'Approved'} onChange={e=>setStep(idx,'on_approve_action',e.target.value)} className={iCls}/></div>
                    <div><L t="On Reject → Set Status"/><input value={step.on_reject_action||'Rejected'} onChange={e=>setStep(idx,'on_reject_action',e.target.value)} className={iCls}/></div>
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
  const { quoteTemplates, saveQuoteTemplate, deleteQuoteTemplate, setDefaultTemplate } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ primaryColor:'#0F172A', secondaryColor:'#3B82F6' });
  const s = (k,v)=>setForm(f=>({...f,[k]:v}));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0F172A]">Quote Templates</h2><p className="text-gray-500 text-sm">{quoteTemplates.length} template(s)</p></div>
        <button onClick={()=>{setEditing(null);setForm({primaryColor:'#0F172A',secondaryColor:'#3B82F6'});setOpen(true);}} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90">+ New Template</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {quoteTemplates.map(t=>(
          <div key={t.id} className="bg-white border border-blue-100 rounded-[24px] overflow-hidden shadow-lg">
            <div className="h-20 flex items-center justify-center" style={{backgroundColor:t.primaryColor||'#0F172A'}}><div className="text-white font-bold text-lg">{t.quoteTitle||t.name}</div></div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between"><h3 className="font-bold text-[#0F172A]">{t.name}</h3>{t.isDefault&&<span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Default</span>}</div>
              <div className="text-xs text-gray-500">{t.companyName}</div>
              <div className="flex gap-2 pt-2">
                <button onClick={()=>{setEditing(t);setForm({...t});setOpen(true);}} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-xl text-sm font-semibold">Edit</button>
                {!t.isDefault&&<button onClick={()=>setDefaultTemplate(t.id)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl text-sm font-semibold">Set Default</button>}
                <button onClick={()=>deleteQuoteTemplate(t.id)} className="bg-red-100 hover:bg-red-200 text-red-600 px-3 py-2 rounded-xl text-sm font-semibold">🗑</button>
              </div>
            </div>
          </div>
        ))}
        {quoteTemplates.length===0&&<div className="col-span-full py-12 text-center text-gray-400"><div className="text-5xl mb-3">📄</div>No templates yet.</div>}
      </div>
      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit Template':'New Template'} size="xl"
        footer={<><button onClick={()=>setOpen(false)} className="px-5 py-2.5 rounded-2xl border border-blue-200 text-sm font-semibold">Cancel</button><button onClick={async()=>{await saveQuoteTemplate(form,editing?.id);setOpen(false);}} className="px-5 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-2xl text-sm font-semibold">Save Template</button></>}>
        <div className="grid grid-cols-2 gap-4">
          {[['Template Name','name'],['Company Name','companyName'],['Company Email','companyEmail'],['Company Phone','companyPhone'],['Company Address','companyAddress'],['Quote Title','quoteTitle'],['Footer Text','footerText']].map(([label,field])=>(
            <div key={field}><L t={label}/><input value={form[field]||''} onChange={e=>s(field,e.target.value)} className={iCls}/></div>
          ))}
          <div><L t="Primary Color"/><input type="color" value={form.primaryColor||'#0F172A'} onChange={e=>s('primaryColor',e.target.value)} className="w-full h-12 rounded-2xl border border-blue-200 cursor-pointer"/></div>
          <div><L t="Secondary Color"/><input type="color" value={form.secondaryColor||'#3B82F6'} onChange={e=>s('secondaryColor',e.target.value)} className="w-full h-12 rounded-2xl border border-blue-200 cursor-pointer"/></div>
          <div className="col-span-2"><L t="Terms & Conditions"/><textarea rows={3} value={form.termsAndConditions||''} onChange={e=>s('termsAndConditions',e.target.value)} className={tCls}/></div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ ADMIN HOME ════════════════════════════════════════
const ADMIN_SECTIONS = [
  {key:'organizations', label:'Organizations',   icon:'🏢', desc:'Companies & tenants'},
  {key:'businessUnits', label:'Business Units',  icon:'🏗️', desc:'Divisions & departments'},
  {key:'users',         label:'Users',           icon:'👤', desc:'Enterprise accounts'},
  {key:'groups',        label:'User Groups',     icon:'👥', desc:'Group access & assignment'},
  {key:'security',      label:'Security Console',icon:'🔐', desc:'Roles & permissions'},
  {key:'workflow',      label:'Workflow Builder', icon:'⚙️', desc:'Auto-trigger on events'},
  {key:'assignment',    label:'Assignment Rules', icon:'📋', desc:'Auto-assign records'},
  {key:'sla',           label:'SLA Policies',    icon:'⏱️', desc:'Response time targets'},
  {key:'approvals',     label:'Approval Processes',icon:'✅',desc:'Multi-step approvals'},
  {key:'templates',     label:'Quote Templates', icon:'📄', desc:'Branded quote layouts'},
];

export default function AdminToolsPage() {
  const [active, setActive] = useState(null);
  const { approvalRequests } = useApp();
  const pendingCount = approvalRequests.filter(r=>r.status==='Pending').length;

  const renderSection = ()=>{
    switch(active){
      case 'organizations': return <OrganizationsPanel/>;
      case 'businessUnits': return <BusinessUnitsPanel/>;
      case 'users':         return <UsersPanel/>;
      case 'groups':        return <UserGroupsPanel/>;
      case 'security':      return <SecurityConsolePanel/>;
      case 'workflow':      return <WorkflowBuilderPanel/>;
      case 'assignment':    return <AssignmentRulesPanel/>;
      case 'sla':           return <SLAPoliciesPanel/>;
      case 'approvals':     return <ApprovalProcessesPanel/>;
      case 'templates':     return <TemplateDesignerPanel/>;
      default:              return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[28px] p-6 text-white">
        <h1 className="text-3xl font-bold">Admin Tools</h1>
        <p className="text-blue-200 mt-1">Configure your enterprise platform — users, automation, SLA, approvals, and more.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {ADMIN_SECTIONS.map(section=>(
          <button key={section.key} onClick={()=>setActive(active===section.key?null:section.key)}
            className={`rounded-[24px] p-5 text-left border transition-all shadow-lg hover:scale-[1.02] relative ${active===section.key?'bg-gradient-to-br from-[#0F172A] to-blue-900 text-white border-transparent':'bg-white border-blue-100 text-[#0F172A] hover:border-blue-300'}`}>
            <div className="text-3xl mb-3">{section.icon}</div>
            <div className="font-bold text-sm">{section.label}</div>
            <div className={`text-xs mt-1 ${active===section.key?'text-blue-200':'text-gray-400'}`}>{section.desc}</div>
            {section.key==='approvals'&&pendingCount>0&&(
              <div className="absolute top-3 right-3 w-5 h-5 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center">{pendingCount}</div>
            )}
          </button>
        ))}
      </div>

      {active&&(
        <div className="bg-white rounded-[28px] border border-blue-100 shadow-xl p-6 space-y-5">
          <button onClick={()=>setActive(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0F172A] font-semibold transition-all">← Back to Admin Tools</button>
          {renderSection()}
        </div>
      )}
    </div>
  );
}
