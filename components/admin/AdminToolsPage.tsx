// @ts-nocheck
'use client';


import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatDate } from '@/lib/utils';
import Modal from '@/components/shared/Modal';
import { inputClass, selectClass, textareaClass, Button, StatusBadge, AdminCard, EmptyState, SectionHeader } from '@/components/shared';

// ═══════════════════════════ ORGANIZATIONS ═══════════════════════════════════
function OrganizationsPanel() {
  const { organizations, saveOrganization, deleteAdminRecord, updateAdminStatus } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <SectionHeader title="Organizations" subtitle={`${organizations.length} organization(s)`} action={<Button onClick={() => { setEditing(null); setForm({}); setOpen(true); }}>+ Add Organization</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {organizations.map(org => (
          <AdminCard key={org.id} title={org.name} subtitle={org.organization_code}
            badge={org.status} badgeColor={org.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}
            details={[{ label: 'Industry', value: org.industry }, { label: 'Country', value: org.country }, { label: 'Created', value: formatDate(org.created_at) }]}
            actions={[{ label: 'Edit', onClick: () => { setEditing(org); setForm(org); setOpen(true); } }, { label: org.status === 'Active' ? 'Deactivate' : 'Activate', onClick: () => updateAdminStatus('organizations', org.id, org.status === 'Active' ? 'Inactive' : 'Active') }, { label: 'Delete', onClick: () => deleteAdminRecord('organizations', org.id), danger: true }]} />
        ))}
        {organizations.length === 0 && <div className="col-span-full"><EmptyState icon="🏢" title="No organizations yet" /></div>}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Organization' : 'New Organization'} size="md"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={async () => { await saveOrganization(form, editing?.id); setOpen(false); }}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          {[['Organization Name', 'name'], ['Org Code', 'organization_code'], ['Industry', 'industry'], ['Website', 'website'], ['Country', 'country'], ['Currency', 'currency']].map(([label, field]) => (
            <div key={field} className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</label><input value={form[field] || ''} onChange={e => set(field, e.target.value)} className={inputClass} /></div>
          ))}
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Status</label><select value={form.status || 'Active'} onChange={e => set('status', e.target.value)} className={selectClass}><option>Active</option><option>Inactive</option></select></div>
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
  const [form, setForm] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <SectionHeader title="Business Units" subtitle={`${businessUnits.length} unit(s)`} action={<Button onClick={() => { setEditing(null); setForm({}); setOpen(true); }}>+ Add Business Unit</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {businessUnits.map(bu => {
          const org = organizations.find(o => o.id === bu.organization_id);
          return (
            <AdminCard key={bu.id} title={bu.name} subtitle={bu.business_unit_code}
              badge={bu.status} badgeColor={bu.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}
              details={[{ label: 'Organization', value: org?.name || '-' }, { label: 'Description', value: bu.description }]}
              actions={[{ label: 'Edit', onClick: () => { setEditing(bu); setForm(bu); setOpen(true); } }, { label: bu.status === 'Active' ? 'Deactivate' : 'Activate', onClick: () => updateAdminStatus('business_units', bu.id, bu.status === 'Active' ? 'Inactive' : 'Active') }, { label: 'Delete', onClick: () => deleteAdminRecord('business_units', bu.id), danger: true }]} />
          );
        })}
        {businessUnits.length === 0 && <div className="col-span-full"><EmptyState icon="🏗️" title="No business units yet" /></div>}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Business Unit' : 'New Business Unit'} size="md"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={async () => { await saveBusinessUnit(form, editing?.id); setOpen(false); }}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Organization</label><select value={form.organization_id || ''} onChange={e => set('organization_id', e.target.value)} className={selectClass}><option value="">Select Org</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
          {[['BU Name', 'name'], ['BU Code', 'business_unit_code'], ['Description', 'description']].map(([label, field]) => (
            <div key={field} className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</label><input value={form[field] || ''} onChange={e => set(field, e.target.value)} className={inputClass} /></div>
          ))}
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Status</label><select value={form.status || 'Active'} onChange={e => set('status', e.target.value)} className={selectClass}><option>Active</option><option>Inactive</option></select></div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ USERS ═══════════════════════════════════════════
function UsersPanel() {
  const { enterpriseUsers, organizations, businessUnits, roles, saveEnterpriseUser, deleteAdminRecord, updateAdminStatus } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const filtered = enterpriseUsers.filter(u =>
    [u.first_name, u.last_name, u.email, u.employee_code].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      <SectionHeader title="Enterprise Users" subtitle={`${enterpriseUsers.length} user(s)`} action={<Button onClick={() => { setEditing(null); setForm({}); setOpen(true); }}>+ Add User</Button>} />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users by name, email, code..." className={inputClass} />
      <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-[#0F172A] to-blue-900 text-white">
            <tr>{['Code', 'Name', 'Email', 'Designation', 'Status', 'Actions'].map(h => <th key={h} className="px-5 py-3 text-left text-sm font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No users found.</td></tr> :
              filtered.map(u => (
                <tr key={u.id} className="border-t border-blue-50 hover:bg-blue-50/40">
                  <td className="px-5 py-3 text-xs font-mono text-gray-500">{u.employee_code}</td>
                  <td className="px-5 py-3 font-semibold text-sm text-[#0F172A]">{u.first_name} {u.last_name}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{u.email}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{u.designation || '-'}</td>
                  <td className="px-5 py-3"><StatusBadge status={u.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(u); setForm(u); setOpen(true); }} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-xl hover:bg-blue-200 font-semibold">Edit</button>
                      <button onClick={() => updateAdminStatus('enterprise_users', u.id, u.status === 'Active' ? 'Inactive' : 'Active')} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-xl hover:bg-gray-200 font-semibold">{u.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit User' : 'New User'} size="lg"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={async () => { await saveEnterpriseUser(form, editing?.id); setOpen(false); }}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          {[['First Name', 'first_name'], ['Last Name', 'last_name'], ['Email', 'email'], ['Phone', 'phone'], ['Employee Code', 'employee_code'], ['Username', 'username'], ['Designation', 'designation']].map(([label, field]) => (
            <div key={field} className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</label><input value={form[field] || ''} onChange={e => set(field, e.target.value)} className={inputClass} /></div>
          ))}
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Organization</label><select value={form.organization_id || ''} onChange={e => set('organization_id', e.target.value)} className={selectClass}><option value="">Select</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Business Unit</label><select value={form.business_unit_id || ''} onChange={e => set('business_unit_id', e.target.value)} className={selectClass}><option value="">Select</option>{businessUnits.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Role</label><select value={form.role_id || ''} onChange={e => set('role_id', e.target.value)} className={selectClass}><option value="">Select Role</option>{roles.map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}</select></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Status</label><select value={form.status || 'Active'} onChange={e => set('status', e.target.value)} className={selectClass}><option>Active</option><option>Inactive</option></select></div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ USER GROUPS ═════════════════════════════════════
function UserGroupsPanel() {
  const { userGroups, userGroupMembers, enterpriseUsers, saveUserGroup, deleteAdminRecord, addUsersToGroup, removeUserFromGroup, fetchGroupMembers } = useApp();
  const [open, setOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  const [form, setForm] = useState({});
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openMembers = async (group) => { setActiveGroup(group); await fetchGroupMembers(group.id); setMembersOpen(true); };
  const toggleUser = (uid) => setSelectedUserIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);

  return (
    <div className="space-y-5">
      <SectionHeader title="User Groups" subtitle={`${userGroups.length} group(s)`} action={<Button onClick={() => { setEditing(null); setForm({}); setOpen(true); }}>+ Add Group</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {userGroups.map(g => (
          <AdminCard key={g.id} title={g.group_name} subtitle={g.group_code}
            badge={g.status} badgeColor={g.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}
            details={[{ label: 'Description', value: g.description }]}
            actions={[{ label: 'Manage Members', onClick: () => openMembers(g) }, { label: 'Edit', onClick: () => { setEditing(g); setForm(g); setOpen(true); } }, { label: 'Delete', onClick: () => deleteAdminRecord('user_groups', g.id), danger: true }]} />
        ))}
        {userGroups.length === 0 && <div className="col-span-full"><EmptyState icon="👥" title="No user groups yet" /></div>}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Group' : 'New Group'} size="md"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={async () => { await saveUserGroup(form, editing?.id); setOpen(false); }}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          {[['Group Name', 'group_name'], ['Group Code', 'group_code'], ['Description', 'description']].map(([label, field]) => (
            <div key={field} className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</label><input value={form[field] || ''} onChange={e => set(field, e.target.value)} className={inputClass} /></div>
          ))}
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Status</label><select value={form.status || 'Active'} onChange={e => set('status', e.target.value)} className={selectClass}><option>Active</option><option>Inactive</option></select></div>
        </div>
      </Modal>
      <Modal open={membersOpen} onClose={() => setMembersOpen(false)} title={`Members: ${activeGroup?.group_name}`} size="lg"
        footer={<><Button variant="secondary" onClick={() => setMembersOpen(false)}>Close</Button><Button onClick={async () => { if (activeGroup) { await addUsersToGroup(activeGroup.id, selectedUserIds, userGroupMembers); setSelectedUserIds([]); } }}>Add Selected</Button></>}>
        <div className="space-y-5">
          <div>
            <h4 className="font-bold text-[#0F172A] mb-3">Current Members</h4>
            <div className="space-y-2">
              {userGroupMembers.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-3">
                  <div><div className="font-semibold text-sm">{m.enterprise_users?.first_name} {m.enterprise_users?.last_name}</div><div className="text-xs text-gray-400">{m.enterprise_users?.email}</div></div>
                  <button onClick={() => removeUserFromGroup(m.id, activeGroup?.id)} className="text-red-500 text-xs hover:underline font-semibold">Remove</button>
                </div>
              ))}
              {userGroupMembers.length === 0 && <div className="text-gray-400 text-sm">No members yet.</div>}
            </div>
          </div>
          <div>
            <h4 className="font-bold text-[#0F172A] mb-3">Add Users</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {enterpriseUsers.filter(u => !userGroupMembers.some(m => m.enterprise_user_id === u.id)).map(u => (
                <label key={u.id} className="flex items-center gap-3 cursor-pointer p-3 hover:bg-blue-50 rounded-xl">
                  <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={() => toggleUser(u.id)} className="w-4 h-4 accent-blue-600" />
                  <div><div className="font-semibold text-sm">{u.first_name} {u.last_name}</div><div className="text-xs text-gray-400">{u.email}</div></div>
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
  const [form, setForm] = useState({});
  const [selectedPerms, setSelectedPerms] = useState([]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const modules = [...new Set(permissions.map(p => p.module_name))];

  const openForm = async (role) => {
    setEditing(role || null); setForm(role || {}); setSelectedPerms([]);
    if (role) { const rp = await fetchRolePermissions(role.id); setSelectedPerms(rp.map(r => r.permission_id)); }
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Roles & Security" subtitle="Manage roles and granular permissions" action={<Button onClick={() => openForm(null)}>+ Add Role</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {roles.map(role => (
          <AdminCard key={role.id} title={role.role_name} subtitle={role.role_code}
            badge={role.status} badgeColor={role.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}
            details={[{ label: 'Description', value: role.description }, { label: 'Created', value: formatDate(role.created_at) }]}
            actions={[{ label: 'Edit & Permissions', onClick: () => openForm(role) }, { label: 'Delete', onClick: () => deleteAdminRecord('roles', role.id), danger: true }]} />
        ))}
        {roles.length === 0 && <div className="col-span-full"><EmptyState icon="🔐" title="No roles yet" /></div>}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Role' : 'New Role'} size="xl"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={async () => { await saveRole(form, editing?.id || null, selectedPerms); setOpen(false); }}>Save Role</Button></>}>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {[['Role Name', 'role_name'], ['Role Code', 'role_code']].map(([label, field]) => (
              <div key={field} className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</label><input value={form[field] || ''} onChange={e => set(field, e.target.value)} className={inputClass} /></div>
            ))}
            <div className="col-span-2 space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Description</label><input value={form.description || ''} onChange={e => set('description', e.target.value)} className={inputClass} /></div>
          </div>
          <div>
            <h3 className="font-bold text-[#0F172A] mb-4">Permissions</h3>
            <div className="space-y-4">
              {modules.map(module => (
                <div key={module}>
                  <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{module}</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {permissions.filter(p => p.module_name === module).map(p => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-blue-50">
                        <input type="checkbox" checked={selectedPerms.includes(p.id)} onChange={() => setSelectedPerms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])} className="w-4 h-4 accent-blue-600" />
                        <span className="text-sm">{p.permission_name}</span>
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

// ═══════════════════════════ WORKFLOW BUILDER ═════════════════════════════════
function WorkflowBuilderPanel() {
  const { workflowRules, enterpriseUsers, saveWorkflowRule, deleteWorkflowRule } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ trigger_event: 'on_create', object_type: 'leads', is_active: true });
  const [actions, setActions] = useState([{ action_type: 'send_notification', action_config: { message: '', recipient: '' } }]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setActionConfig = (i, k, v) => setActions(prev => prev.map((a, idx) => idx === i ? { ...a, action_config: { ...a.action_config, [k]: v } } : a));

  return (
    <div className="space-y-5">
      <SectionHeader title="Workflow Rules" subtitle="Automate actions on record events" action={<Button onClick={() => { setEditing(null); setForm({ trigger_event: 'on_create', object_type: 'leads', is_active: true }); setActions([{ action_type: 'send_notification', action_config: { message: '', recipient: '' } }]); setOpen(true); }}>+ New Rule</Button>} />
      {workflowRules.length === 0 ? <EmptyState icon="⚙️" title="No workflow rules" subtitle="Create rules to automate notifications and more." action={<Button onClick={() => setOpen(true)}>+ Create First Rule</Button>} /> :
        <div className="space-y-3">
          {workflowRules.map(rule => (
            <div key={rule.id} className="bg-white border border-blue-100 rounded-2xl p-5 flex items-center justify-between shadow-sm">
              <div>
                <div className="flex items-center gap-3"><h3 className="font-bold text-[#0F172A]">{rule.name}</h3><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{rule.is_active ? 'Active' : 'Inactive'}</span></div>
                <div className="text-sm text-gray-500 mt-1">{rule.object_type} · Trigger: {rule.trigger_event}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(rule); setForm(rule); setOpen(true); }} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold">Edit</button>
                <button onClick={() => deleteWorkflowRule(rule.id)} className="bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-xl text-sm font-semibold">Delete</button>
              </div>
            </div>
          ))}
        </div>
      }
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Workflow Rule' : 'New Workflow Rule'} size="xl"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={async () => { await saveWorkflowRule(form, actions, editing?.id); setOpen(false); }}>Save Rule</Button></>}>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Rule Name</label><input value={form.name || ''} onChange={e => set('name', e.target.value)} className={inputClass} /></div>
            <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Object Type</label><select value={form.object_type || 'leads'} onChange={e => set('object_type', e.target.value)} className={selectClass}>{['customers', 'leads', 'opportunities', 'orders', 'invoices', 'contacts', 'activities'].map(o => <option key={o}>{o}</option>)}</select></div>
            <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Trigger Event</label><select value={form.trigger_event || 'on_create'} onChange={e => set('trigger_event', e.target.value)} className={selectClass}><option value="on_create">On Create</option><option value="on_update">On Update</option><option value="on_status_change">On Status Change</option></select></div>
            <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Trigger Field</label><input value={form.trigger_field || ''} onChange={e => set('trigger_field', e.target.value)} placeholder="e.g. status" className={inputClass} /></div>
            <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Trigger Value</label><input value={form.trigger_value || ''} onChange={e => set('trigger_value', e.target.value)} placeholder="e.g. Qualified" className={inputClass} /></div>
            <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Active</label><select value={form.is_active ? 'Yes' : 'No'} onChange={e => set('is_active', e.target.value === 'Yes')} className={selectClass}><option>Yes</option><option>No</option></select></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-[#0F172A]">Actions</h3><button onClick={() => setActions(prev => [...prev, { action_type: 'send_notification', action_config: { message: '', recipient: '' } }])} className="text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-xl font-semibold">+ Add Action</button></div>
            {actions.map((action, i) => (
              <div key={i} className="bg-blue-50 rounded-2xl p-4 mb-3 grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Action Type</label><select value={action.action_type} onChange={e => setActions(prev => prev.map((a, idx) => idx === i ? { ...a, action_type: e.target.value } : a))} className={selectClass}><option value="send_notification">Send Notification</option><option value="update_field">Update Field</option><option value="send_email">Send Email</option></select></div>
                <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Recipient</label><select value={action.action_config?.recipient || ''} onChange={e => setActionConfig(i, 'recipient', e.target.value)} className={selectClass}><option value="">Select User</option>{enterpriseUsers.map(u => <option key={u.email} value={u.email}>{u.first_name} {u.last_name}</option>)}</select></div>
                <div className="col-span-2 space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Message</label><input value={action.action_config?.message || ''} onChange={e => setActionConfig(i, 'message', e.target.value)} placeholder="Notification message" className={inputClass} /></div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ ASSIGNMENT RULES ═════════════════════════════════
function AssignmentRulesPanel() {
  const { assignmentRules, enterpriseUsers, userGroups, saveAssignmentRule, deleteAssignmentRule } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ object_type: 'leads', condition_operator: 'equals', priority: 1, is_active: true });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <SectionHeader title="Assignment Rules" subtitle="Auto-assign records to users or groups" action={<Button onClick={() => { setEditing(null); setForm({ object_type: 'leads', condition_operator: 'equals', priority: 1, is_active: true }); setOpen(true); }}>+ New Rule</Button>} />
      {assignmentRules.length === 0 ? <EmptyState icon="📋" title="No assignment rules" action={<Button onClick={() => setOpen(true)}>+ Create First Rule</Button>} /> :
        <div className="space-y-3">
          {assignmentRules.map(rule => (
            <div key={rule.id} className="bg-white border border-blue-100 rounded-2xl p-5 flex items-center justify-between shadow-sm">
              <div>
                <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">P{rule.priority}</div><h3 className="font-bold text-[#0F172A]">{rule.name}</h3><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{rule.is_active ? 'Active' : 'Inactive'}</span></div>
                <div className="text-sm text-gray-500 mt-1">{rule.object_type} · If {rule.condition_field} {rule.condition_operator} {rule.condition_value}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(rule); setForm(rule); setOpen(true); }} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold">Edit</button>
                <button onClick={() => deleteAssignmentRule(rule.id)} className="bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-xl text-sm font-semibold">Delete</button>
              </div>
            </div>
          ))}
        </div>
      }
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Rule' : 'New Assignment Rule'} size="lg"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={async () => { await saveAssignmentRule(form, editing?.id); setOpen(false); }}>Save Rule</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Rule Name</label><input value={form.name || ''} onChange={e => set('name', e.target.value)} className={inputClass} /></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Object Type</label><select value={form.object_type || 'leads'} onChange={e => set('object_type', e.target.value)} className={selectClass}>{['leads', 'opportunities', 'orders', 'invoices', 'contacts'].map(o => <option key={o}>{o}</option>)}</select></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Priority</label><input type="number" min={1} value={form.priority || 1} onChange={e => set('priority', Number(e.target.value))} className={inputClass} /></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Condition Field</label><input value={form.condition_field || ''} onChange={e => set('condition_field', e.target.value)} placeholder="e.g. source" className={inputClass} /></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Operator</label><select value={form.condition_operator || 'equals'} onChange={e => set('condition_operator', e.target.value)} className={selectClass}><option value="equals">Equals</option><option value="contains">Contains</option><option value="not_equals">Not Equals</option></select></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Condition Value</label><input value={form.condition_value || ''} onChange={e => set('condition_value', e.target.value)} className={inputClass} /></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Assign To User</label><select value={form.assign_to_user_id || ''} onChange={e => set('assign_to_user_id', e.target.value)} className={selectClass}><option value="">Select User</option>{enterpriseUsers.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Active</label><select value={form.is_active ? 'Yes' : 'No'} onChange={e => set('is_active', e.target.value === 'Yes')} className={selectClass}><option>Yes</option><option>No</option></select></div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ SLA POLICIES ═════════════════════════════════════
function SLAPoliciesPanel() {
  const { slaPolicies, enterpriseUsers, saveSLAPolicy, deleteSLAPolicy } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ warning_threshold_pct: 80, response_time_hours: 2, resolution_time_hours: 24, is_active: true, object_type: 'leads' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <SectionHeader title="SLA Policies" subtitle="Define response and resolution SLAs" action={<Button onClick={() => { setEditing(null); setForm({ warning_threshold_pct: 80, response_time_hours: 2, resolution_time_hours: 24, is_active: true, object_type: 'leads' }); setOpen(true); }}>+ New Policy</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {slaPolicies.map(p => (
          <div key={p.id} className="bg-white border border-blue-100 rounded-[24px] p-5 shadow-lg">
            <div className="flex items-start justify-between mb-4"><div><h3 className="font-bold text-[#0F172A]">{p.name}</h3><div className="text-xs text-gray-400 mt-1">{p.object_type}</div></div><span className={`px-3 py-1 rounded-full text-xs font-semibold ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between bg-blue-50 rounded-xl px-3 py-2"><span className="text-gray-500">Response</span><span className="font-bold">{p.response_time_hours}h</span></div>
              <div className="flex justify-between bg-orange-50 rounded-xl px-3 py-2"><span className="text-gray-500">Resolution</span><span className="font-bold">{p.resolution_time_hours}h</span></div>
              <div className="flex justify-between bg-yellow-50 rounded-xl px-3 py-2"><span className="text-gray-500">Warning</span><span className="font-bold">{p.warning_threshold_pct}%</span></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setEditing(p); setForm(p); setOpen(true); }} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-xl text-sm font-semibold">Edit</button>
              <button onClick={() => deleteSLAPolicy(p.id)} className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 py-2 rounded-xl text-sm font-semibold">Delete</button>
            </div>
          </div>
        ))}
        {slaPolicies.length === 0 && <div className="col-span-full"><EmptyState icon="⏱️" title="No SLA policies" /></div>}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit SLA Policy' : 'New SLA Policy'} size="lg"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={async () => { await saveSLAPolicy(form, editing?.id); setOpen(false); }}>Save Policy</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Policy Name</label><input value={form.name || ''} onChange={e => set('name', e.target.value)} className={inputClass} /></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Object Type</label><select value={form.object_type || 'leads'} onChange={e => set('object_type', e.target.value)} className={selectClass}>{['leads', 'opportunities', 'orders', 'invoices', 'contacts'].map(o => <option key={o}>{o}</option>)}</select></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Response Time (hours)</label><input type="number" min={1} value={form.response_time_hours || 2} onChange={e => set('response_time_hours', Number(e.target.value))} className={inputClass} /></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Resolution Time (hours)</label><input type="number" min={1} value={form.resolution_time_hours || 24} onChange={e => set('resolution_time_hours', Number(e.target.value))} className={inputClass} /></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Warning Threshold (%)</label><input type="number" min={1} max={100} value={form.warning_threshold_pct || 80} onChange={e => set('warning_threshold_pct', Number(e.target.value))} className={inputClass} /></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Escalate To User</label><select value={form.escalate_to_user_id || ''} onChange={e => set('escalate_to_user_id', e.target.value)} className={selectClass}><option value="">Select User</option>{enterpriseUsers.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Active</label><select value={form.is_active ? 'Yes' : 'No'} onChange={e => set('is_active', e.target.value === 'Yes')} className={selectClass}><option>Yes</option><option>No</option></select></div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ APPROVAL PROCESSES ═══════════════════════════════
function ApprovalProcessesPanel() {
  const { approvalProcesses, enterpriseUsers, saveApprovalProcess, deleteApprovalProcess } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ object_type: 'opportunities', condition_operator: 'greater_than', is_active: true });
  const [steps, setSteps] = useState([{ step_name: 'Manager Approval', approver_user_id: '', approval_type: 'any', on_approve_action: 'approve', on_reject_action: 'reject' }]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setStep = (i, k, v) => setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [k]: v } : s));

  return (
    <div className="space-y-5">
      <SectionHeader title="Approval Processes" subtitle="Multi-step approval workflows" action={<Button onClick={() => { setEditing(null); setForm({ object_type: 'opportunities', condition_operator: 'greater_than', is_active: true }); setSteps([{ step_name: 'Manager Approval', approver_user_id: '', approval_type: 'any', on_approve_action: 'approve', on_reject_action: 'reject' }]); setOpen(true); }}>+ New Process</Button>} />
      {approvalProcesses.length === 0 ? <EmptyState icon="✅" title="No approval processes" action={<Button onClick={() => setOpen(true)}>+ Create First Process</Button>} /> :
        <div className="space-y-3">
          {approvalProcesses.map(proc => (
            <div key={proc.id} className="bg-white border border-blue-100 rounded-2xl p-5 flex items-center justify-between shadow-sm">
              <div>
                <div className="flex items-center gap-3"><h3 className="font-bold text-[#0F172A]">{proc.name}</h3><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${proc.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{proc.is_active ? 'Active' : 'Inactive'}</span></div>
                <div className="text-sm text-gray-500 mt-1">{proc.object_type} · If {proc.condition_field} {proc.condition_operator} {proc.condition_value}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(proc); setForm(proc); setOpen(true); }} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold">Edit</button>
                <button onClick={() => deleteApprovalProcess(proc.id)} className="bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-xl text-sm font-semibold">Delete</button>
              </div>
            </div>
          ))}
        </div>
      }
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Approval Process' : 'New Approval Process'} size="xl"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={async () => { await saveApprovalProcess(form, steps, editing?.id); setOpen(false); }}>Save Process</Button></>}>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Process Name</label><input value={form.name || ''} onChange={e => set('name', e.target.value)} className={inputClass} /></div>
            <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Object Type</label><select value={form.object_type || 'opportunities'} onChange={e => set('object_type', e.target.value)} className={selectClass}>{['leads', 'opportunities', 'orders', 'invoices'].map(o => <option key={o}>{o}</option>)}</select></div>
            <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Condition Field</label><input value={form.condition_field || ''} onChange={e => set('condition_field', e.target.value)} placeholder="e.g. amount" className={inputClass} /></div>
            <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Operator</label><select value={form.condition_operator || 'greater_than'} onChange={e => set('condition_operator', e.target.value)} className={selectClass}><option value="greater_than">Greater Than</option><option value="less_than">Less Than</option><option value="equals">Equals</option></select></div>
            <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Condition Value</label><input value={form.condition_value || ''} onChange={e => set('condition_value', e.target.value)} className={inputClass} /></div>
            <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Active</label><select value={form.is_active ? 'Yes' : 'No'} onChange={e => set('is_active', e.target.value === 'Yes')} className={selectClass}><option>Yes</option><option>No</option></select></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-[#0F172A]">Approval Steps</h3><button onClick={() => setSteps(prev => [...prev, { step_name: '', approver_user_id: '', approval_type: 'any', on_approve_action: 'approve', on_reject_action: 'reject' }])} className="text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-xl font-semibold">+ Add Step</button></div>
            {steps.map((step, i) => (
              <div key={i} className="bg-blue-50 rounded-2xl p-4 mb-3 grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Step Name</label><input value={step.step_name || ''} onChange={e => setStep(i, 'step_name', e.target.value)} className={inputClass} /></div>
                <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Approver</label><select value={step.approver_user_id || ''} onChange={e => setStep(i, 'approver_user_id', e.target.value)} className={selectClass}><option value="">Select User</option>{enterpriseUsers.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select></div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ TEMPLATE DESIGNER ════════════════════════════════
function TemplateDesignerPanel() {
  const { quoteTemplates, saveQuoteTemplate, deleteQuoteTemplate, setDefaultTemplate } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ primaryColor: '#0F172A', secondaryColor: '#3B82F6' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <SectionHeader title="Quote Templates" subtitle="Design branded quote templates" action={<Button onClick={() => { setEditing(null); setForm({ primaryColor: '#0F172A', secondaryColor: '#3B82F6' }); setOpen(true); }}>+ New Template</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {quoteTemplates.map(t => (
          <div key={t.id} className="bg-white border border-blue-100 rounded-[24px] overflow-hidden shadow-lg">
            <div className="h-20 flex items-center justify-center" style={{ backgroundColor: t.primaryColor || '#0F172A' }}><div className="text-white font-bold">{t.quoteTitle || t.name}</div></div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between"><h3 className="font-bold text-[#0F172A]">{t.name}</h3>{t.isDefault && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Default</span>}</div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setEditing(t); setForm(t); setOpen(true); }} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-xl text-sm font-semibold">Edit</button>
                {!t.isDefault && <button onClick={() => setDefaultTemplate(t.id)} className="flex-1 bg-gray-100 hover:bg-gray-200 py-2 rounded-xl text-sm font-semibold">Set Default</button>}
                <button onClick={() => deleteQuoteTemplate(t.id)} className="bg-red-100 hover:bg-red-200 text-red-600 px-3 py-2 rounded-xl text-sm font-semibold">🗑️</button>
              </div>
            </div>
          </div>
        ))}
        {quoteTemplates.length === 0 && <div className="col-span-full"><EmptyState icon="📄" title="No templates yet" /></div>}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Template' : 'New Template'} size="xl"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={async () => { await saveQuoteTemplate(form, editing?.id); setOpen(false); }}>Save Template</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          {[['Template Name', 'name'], ['Company Name', 'companyName'], ['Company Email', 'companyEmail'], ['Company Phone', 'companyPhone'], ['Company Address', 'companyAddress'], ['Quote Title', 'quoteTitle']].map(([label, field]) => (
            <div key={field} className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</label><input value={form[field] || ''} onChange={e => set(field, e.target.value)} className={inputClass} /></div>
          ))}
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Primary Color</label><input type="color" value={form.primaryColor || '#0F172A'} onChange={e => set('primaryColor', e.target.value)} className="w-full h-12 rounded-2xl border border-blue-200 cursor-pointer" /></div>
          <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Secondary Color</label><input type="color" value={form.secondaryColor || '#3B82F6'} onChange={e => set('secondaryColor', e.target.value)} className="w-full h-12 rounded-2xl border border-blue-200 cursor-pointer" /></div>
          <div className="col-span-2 space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Footer Text</label><input value={form.footerText || ''} onChange={e => set('footerText', e.target.value)} className={inputClass} /></div>
          <div className="col-span-2 space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-400">Terms & Conditions</label><textarea value={form.termsAndConditions || ''} onChange={e => set('termsAndConditions', e.target.value)} rows={3} className={textareaClass} /></div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ ADMIN HOME (Router) ══════════════════════════════
const ADMIN_SECTIONS = [
  { key: 'organizations', label: 'Organizations', icon: '🏢', desc: 'Companies and tenants' },
  { key: 'businessUnits', label: 'Business Units', icon: '🏗️', desc: 'Divisions and departments' },
  { key: 'users', label: 'Users', icon: '👤', desc: 'Enterprise user accounts' },
  { key: 'groups', label: 'User Groups', icon: '👥', desc: 'Group-based access' },
  { key: 'security', label: 'Security Console', icon: '🔐', desc: 'Roles and permissions' },
  { key: 'workflow', label: 'Workflow Builder', icon: '⚙️', desc: 'Automate on events' },
  { key: 'assignment', label: 'Assignment Rules', icon: '📋', desc: 'Auto-assign records' },
  { key: 'sla', label: 'SLA Policies', icon: '⏱️', desc: 'Response SLAs' },
  { key: 'approvals', label: 'Approval Processes', icon: '✅', desc: 'Multi-step approvals' },
  { key: 'templates', label: 'Quote Templates', icon: '📄', desc: 'Branded quotes' },
];

export default function AdminToolsPage() {
 const [activeSection, setActiveSection] = useState<string | null>(null);

  const renderSection = () => {
    switch (activeSection) {
      case 'organizations': return <OrganizationsPanel />;
      case 'businessUnits': return <BusinessUnitsPanel />;
      case 'users': return <UsersPanel />;
      case 'groups': return <UserGroupsPanel />;
      case 'security': return <SecurityConsolePanel />;
      case 'workflow': return <WorkflowBuilderPanel />;
      case 'assignment': return <AssignmentRulesPanel />;
      case 'sla': return <SLAPoliciesPanel />;
      case 'approvals': return <ApprovalProcessesPanel />;
      case 'templates': return <TemplateDesignerPanel />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[28px] p-6 text-white">
        <h1 className="text-3xl font-bold">Admin Tools</h1>
        <p className="text-blue-200 mt-1">Configure your enterprise platform</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {ADMIN_SECTIONS.map(section => (
          <button key={section.key} onClick={() => setActiveSection(activeSection === section.key ? null : section.key)}
            className={`rounded-[24px] p-5 text-left border transition-all shadow-lg hover:scale-[1.02] ${activeSection === section.key ? 'bg-gradient-to-br from-[#0F172A] to-blue-900 text-white border-transparent' : 'bg-white border-blue-100 text-[#0F172A] hover:border-blue-300'}`}>
            <div className="text-3xl mb-3">{section.icon}</div>
            <div className="font-bold text-sm">{section.label}</div>
            <div className={`text-xs mt-1 ${activeSection === section.key ? 'text-blue-200' : 'text-gray-400'}`}>{section.desc}</div>
          </button>
        ))}
      </div>
      {activeSection && (
        <div className="bg-white rounded-[28px] border border-blue-100 shadow-xl p-6 space-y-5">
          <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0F172A] font-semibold">← Back to Admin Tools</button>
          {renderSection()}
        </div>
      )}
    </div>
  );
}
