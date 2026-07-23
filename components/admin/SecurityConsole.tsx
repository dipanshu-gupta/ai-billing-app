// @ts-nocheck
'use client';
/**
 * SecurityConsole
 * Full RBAC management — Roles, Permissions, Data Security Policies
 * Works for both B2B and B2C contexts.
 */
import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';

// ─── Permission definitions ───────────────────────────────────────────────────
const MODULE_GROUPS = [
  {
    group: 'CRM — B2B',
    icon: '🏢',
    modules: ['leads', 'opportunities', 'customers', 'contacts', 'activities'],
  },
  {
    group: 'CPQ — Sales',
    icon: '💼',
    modules: ['quotations', 'orders', 'invoices', 'products'],
  },
  {
    group: 'Retail — B2C',
    icon: '🛍️',
    modules: ['retail_customers', 'retail_orders', 'retail_invoices', 'retail_products', 'retail_activities'],
  },
  {
    group: 'Admin Tools',
    icon: '⚙️',
    modules: ['admin', 'users', 'security', 'reports', 'workflow', 'appearance'],
  },
];

const ACTIONS = ['view', 'create', 'edit', 'delete', 'export'];

// Generate all permission codes
const ALL_PERMISSIONS = MODULE_GROUPS.flatMap(g =>
  g.modules.flatMap(m =>
    ACTIONS.map(a => ({
      code: `${m}_${a}`,
      name: `${a.charAt(0).toUpperCase() + a.slice(1)} ${m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
      module: m,
      action: a,
      group: g.group,
      groupIcon: g.icon,
    }))
  )
);

// Special permissions
const SPECIAL_PERMS = [
  { code: '__admin__',          name: 'Super Admin (All Access)',   module: 'system', action: 'admin', group: 'System', groupIcon: '🔑' },
  { code: 'view_team_records',  name: 'View Team Records',          module: 'system', action: 'view',  group: 'System', groupIcon: '🔑' },
  { code: 'view_all_records',   name: 'View All Records (Any Org)', module: 'system', action: 'view',  group: 'System', groupIcon: '🔑' },
  { code: 'approve_records',    name: 'Approve Records',            module: 'system', action: 'edit',  group: 'System', groupIcon: '🔑' },
  { code: 'manage_ai',          name: 'Use AI Advisor',             module: 'system', action: 'view',  group: 'System', groupIcon: '🔑' },
];

const FULL_PERMISSIONS = [...ALL_PERMISSIONS, ...SPECIAL_PERMS];

// ─── Seeded roles ─────────────────────────────────────────────────────────────
const SEEDED_ROLES = [
  {
    role_name: 'System Administrator',
    role_code: 'SYSADMIN',
    description: 'Full access to all modules, admin tools, and system settings.',
    status: 'Active',
    data_scope: 'all',
    permissions: FULL_PERMISSIONS.map(p => p.code),
  },
  {
    role_name: 'Sales Administrator',
    role_code: 'SALES_ADMIN',
    description: 'Full access to all CRM and sales modules including admin tools.',
    status: 'Active',
    data_scope: 'all',
    permissions: FULL_PERMISSIONS.map(p => p.code),
  },
  {
    role_name: 'Sales Manager',
    role_code: 'SALES_MGR',
    description: 'Full access to CRM and sales. No admin tools access.',
    status: 'Active',
    data_scope: 'org',
    permissions: FULL_PERMISSIONS
      .filter(p => p.group !== 'Admin Tools' && p.code !== '__admin__')
      .map(p => p.code),
  },
  {
    role_name: 'Sales Representative',
    role_code: 'SALES_REP',
    description: 'View, create and edit records. No delete or admin access.',
    status: 'Active',
    data_scope: 'own',
    permissions: FULL_PERMISSIONS
      .filter(p => p.group !== 'Admin Tools' && p.code !== '__admin__' && p.action !== 'delete')
      .map(p => p.code),
  },
];

const DATA_SCOPES = [
  { v: 'all',  l: 'All Organizations & Business Units', desc: 'VP level — sees everything across the company' },
  { v: 'org',  l: 'Own Organization',                   desc: 'Manager level — sees all data within their org' },
  { v: 'bu',   l: 'Own Business Unit',                  desc: 'Team level — sees data within their BU only' },
  { v: 'own',  l: 'Own Records Only',                   desc: 'Rep level — sees only records they own' },
];

const iCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400';

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SecurityConsole() {
  const { roles, permissions: dbPermissions, saveRole, deleteAdminRecord,
          fetchRolePermissions, fetchRoles, fetchPermissions, enterpriseUsers } = useApp();
  const { supabase } = useTenant();

  const [tab,          setTab]          = useState('roles'); // 'roles' | 'seed'
  const [editingRole,  setEditingRole]  = useState(null);
  const [form,         setForm]         = useState({ role_name:'', role_code:'', description:'', status:'Active', data_scope:'own' });
  const [selectedPerms,setSelectedPerms]= useState([]);
  const [saving,       setSaving]       = useState(false);
  const [seeding,      setSeeding]      = useState(false);
  const [toast,        setToast]        = useState('');
  const [search,       setSearch]       = useState('');
  const [groupFilter,  setGroupFilter]  = useState('all');
  const [rolePermsMap, setRolePermsMap] = useState({}); // roleId -> permission codes[]

  const showToast = (m, err=false) => { setToast({m,err}); setTimeout(()=>setToast(''),3000); };

  useEffect(() => { fetchRoles(); fetchPermissions(); }, []);

  // Load permissions for all roles for display
  // Use role IDs as stable dependency instead of full roles array
  const roleIds = roles.map(r => r.id).join(',');
  useEffect(() => {
    if (!roles.length || !supabase) return;
    const loadAllPerms = async () => {
      // Batch load ALL role_permissions in 2 queries (not N+1)
      const allIds = roles.map(r => r.id);
      const { data: rpAll } = await supabase
        .from('role_permissions')
        .select('role_id, permission_id')
        .in('role_id', allIds);
      if (!rpAll?.length) {
        const empty: Record<string,string[]> = {};
        allIds.forEach(id => { empty[id] = []; });
        setRolePermsMap(empty);
        return;
      }
      const permIds = [...new Set(rpAll.map(x => x.permission_id))];
      const { data: permData } = await supabase
        .from('permissions').select('id, permission_code').in('id', permIds);
      const permCodeMap: Record<string,string> = {};
      (permData || []).forEach((p: any) => { permCodeMap[p.id] = p.permission_code; });

      // Build roleId → permission codes map
      const map: Record<string, string[]> = {};
      allIds.forEach(id => { map[id] = []; });
      rpAll.forEach((rp: any) => {
        const code = permCodeMap[rp.permission_id];
        if (code && map[rp.role_id]) map[rp.role_id].push(code);
      });
      setRolePermsMap(map);
    };
    loadAllPerms();
  }, [roleIds]);

  const SYSTEM_ROLE_CODES = ['SYSADMIN', 'SALES_ADMIN', 'SALES_MGR', 'SALES_REP'];
  const isSystemRole = (role) => SYSTEM_ROLE_CODES.includes(role?.role_code);

  const cloneRole = async (role) => {
    if (!supabase) return;
    // Load permissions for this role
    const { data: rpData } = await supabase.from('role_permissions').select('permission_id').eq('role_id', role.id);
    const permIds = rpData?.map(x => x.permission_id) || [];
    const { data: permData } = await supabase.from('permissions').select('permission_code').in('id', permIds);
    const codes = (permData || []).map(p => p.permission_code).filter(Boolean);
    // Open edit form with cloned data
    setEditingRole(null);
    setForm({
      role_name: 'Copy of ' + role.role_name,
      role_code: 'COPY_' + role.role_code,
      description: role.description || '',
      status: 'Active',
      data_scope: role.data_scope || 'own',
    });
    setSelectedPerms(codes);
    setTab('edit');
  };

  const openEdit = async (role) => {
    setEditingRole(role || null);
    setForm(role ? {
      role_name: role.role_name || '',
      role_code: role.role_code || '',
      description: role.description || '',
      status: role.status || 'Active',
      data_scope: role.data_scope || 'own',
    } : { role_name:'', role_code:'', description:'', status:'Active', data_scope:'own' });

    if (role && supabase) {
      // Fetch role permissions directly using our supabase client
      const { data: rpData } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', role.id);

      if (rpData && rpData.length > 0) {
        const permIds = rpData.map(x => x.permission_id);
        const { data: permData } = await supabase
          .from('permissions')
          .select('permission_code')
          .in('id', permIds);
        const codes = (permData || []).map(p => p.permission_code).filter(Boolean);
        setSelectedPerms(codes);
      } else {
        setSelectedPerms([]);
      }
    } else {
      setSelectedPerms([]);
    }
    setTab('edit');
  };

  const handleSave = async () => {
    if (!form.role_name || !form.role_code) { showToast('Role name and code are required', true); return; }
    if (!supabase) { showToast('No database connection', true); return; }
    setSaving(true);
    try {
      // Save role with data_scope
      const roleData = { ...form, role_code: form.role_code.toUpperCase().replace(/\s+/g,'_') };
      let roleId = editingRole?.id || null;

      if (roleId) {
        await supabase.from('roles').update(roleData).eq('id', roleId);
      } else {
        const { data: nr } = await supabase.from('roles').insert(roleData).select().single();
        roleId = nr?.id;
      }
      if (!roleId) { showToast('Failed to save role', true); setSaving(false); return; }

      // Map permission codes to IDs, insert any missing ones
      await supabase.from('role_permissions').delete().eq('role_id', roleId);

      if (selectedPerms.length > 0) {
        // Ensure all permission codes exist in DB
        const { data: existingPerms } = await supabase.from('permissions').select('id, permission_code');
        const existingMap = Object.fromEntries((existingPerms||[]).map(p => [p.permission_code, p.id]));

        const toInsert = [];
        for (const code of selectedPerms) {
          if (existingMap[code]) {
            toInsert.push({ role_id: roleId, permission_id: existingMap[code] });
          } else {
            // Create permission on the fly
            const pdef = FULL_PERMISSIONS.find(p => p.code === code);
            if (pdef) {
              const { data: np } = await supabase.from('permissions')
                .insert({ permission_name: pdef.name, permission_code: pdef.code, module_name: pdef.module })
                .select().single();
              if (np) toInsert.push({ role_id: roleId, permission_id: np.id });
            }
          }
        }
        if (toInsert.length) await supabase.from('role_permissions').insert(toInsert);
      }

      await fetchRoles();
      showToast(editingRole ? '✓ Role updated' : '✓ Role created');
      setTab('roles');
    } catch(e) {
      showToast('Save failed: ' + e.message, true);
    }
    setSaving(false);
  };

  const handleDelete = async (roleId) => {
    if (!supabase || !confirm('Delete this role? Users with this role will lose access.')) return;
    await supabase.from('role_permissions').delete().eq('role_id', roleId);
    await supabase.from('roles').delete().eq('id', roleId);
    await fetchRoles();
    showToast('Role deleted');
  };

  const handleSeedRoles = async () => {
    if (!supabase) { showToast('No database connection', true); return; }
    if (!confirm('This will create/update 4 standard roles with full permissions. Existing roles with matching codes will be updated. Continue?')) return;
    setSeeding(true);
    try {
      // Step 1: Batch upsert all permission definitions
      const permRows = FULL_PERMISSIONS.map(p => ({
        permission_name: p.name, permission_code: p.code, module_name: p.module,
      }));
      // Upsert in batches of 50
      for (let i = 0; i < permRows.length; i += 50) {
        await supabase.from('permissions')
          .upsert(permRows.slice(i, i+50), { onConflict: 'permission_code', ignoreDuplicates: false });
      }

      // Step 2: Load all permissions to build code→id map
      const { data: allPerms } = await supabase.from('permissions').select('id, permission_code');
      const permMap: Record<string, string> = {};
      (allPerms || []).forEach((p: any) => { permMap[p.permission_code] = p.id; });

      // Step 3: Upsert each role and batch-insert its permissions
      for (const seed of SEEDED_ROLES) {
        // Upsert role
        const { data: roleRow } = await supabase.from('roles')
          .upsert({
            role_name: seed.role_name, role_code: seed.role_code,
            description: seed.description, status: seed.status, data_scope: seed.data_scope,
          }, { onConflict: 'role_code' })
          .select('id').single();
        const roleId = roleRow?.id;
        if (!roleId) continue;

        // Delete and batch re-insert permissions
        await supabase.from('role_permissions').delete().eq('role_id', roleId);

        const rpRows = seed.permissions
          .filter(code => !!permMap[code])
          .map(code => ({ role_id: roleId, permission_id: permMap[code] }));

        // Batch insert in groups of 100
        for (let i = 0; i < rpRows.length; i += 100) {
          await supabase.from('role_permissions').insert(rpRows.slice(i, i+100));
        }
      }

      await fetchRoles();
      showToast('✓ 4 standard roles seeded with all permissions');
      setTab('roles');
    } catch(e: any) {
      console.error('[Seed] Failed:', e);
      showToast('Seeding failed: ' + (e.message || String(e)), true);
    }
    setSeeding(false);
  };

  // Permission selection helpers
  const togglePerm = (code) => setSelectedPerms(p => p.includes(code) ? p.filter(x=>x!==code) : [...p, code]);

  const selectAllInGroup = (groupName) => {
    const groupCodes = FULL_PERMISSIONS.filter(p => p.group === groupName).map(p => p.code);
    const allSelected = groupCodes.every(c => selectedPerms.includes(c));
    if (allSelected) {
      setSelectedPerms(p => p.filter(c => !groupCodes.includes(c)));
    } else {
      setSelectedPerms(p => [...new Set([...p, ...groupCodes])]);
    }
  };

  const selectAllInModule = (module) => {
    const modCodes = FULL_PERMISSIONS.filter(p => p.module === module).map(p => p.code);
    const allSelected = modCodes.every(c => selectedPerms.includes(c));
    if (allSelected) {
      setSelectedPerms(p => p.filter(c => !modCodes.includes(c)));
    } else {
      setSelectedPerms(p => [...new Set([...p, ...modCodes])]);
    }
  };

  const selectAll = () => {
    if (selectedPerms.length === FULL_PERMISSIONS.length) {
      setSelectedPerms([]);
    } else {
      setSelectedPerms(FULL_PERMISSIONS.map(p => p.code));
    }
  };

  const filteredGroups = useMemo(() => {
    const groups = [...MODULE_GROUPS.map(g => ({ ...g })), { group: 'System', icon: '🔑', modules: ['system'] }];
    return groups.filter(g => groupFilter === 'all' || g.group === groupFilter);
  }, [groupFilter]);

  const allGroups = [...MODULE_GROUPS.map(g => g.group), 'System'];

  // Users per role count
  const usersByRole = useMemo(() => {
    const map = {};
    (enterpriseUsers || []).forEach(u => {
      if (u.role_id) map[u.role_id] = (map[u.role_id] || 0) + 1;
    });
    return map;
  }, [enterpriseUsers]);

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-5 right-5 z-[9999] px-5 py-3 rounded-2xl shadow-2xl font-semibold text-sm text-white ${toast.err?'bg-red-500':'bg-[#0F172A]'}`}>
          {toast.m}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F172A] to-slate-700 rounded-[24px] p-6 text-white">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">🔐 Security Console</h2>
            <p className="text-white/60 text-sm mt-1">Manage roles, permissions and data access policies. Changes take effect immediately on next login.</p>
          </div>
          <div className="flex gap-2 flex-wrap">

            <button onClick={handleSeedRoles} disabled={seeding}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
              {seeding ? '⏳ Seeding…' : '🌱 Seed Standard Roles'}
            </button>
            <button onClick={() => openEdit(null)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold">
              + New Role
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { l: 'Total Roles',       v: roles.length,                              icon: '🎭' },
            { l: 'Active Roles',      v: roles.filter(r=>r.status==='Active').length, icon: '✅' },
            { l: 'Total Users',       v: (enterpriseUsers||[]).length,              icon: '👥' },
          ].map(s => (
            <div key={s.l} className="bg-white/10 rounded-[16px] p-3 text-center">
              <div className="text-xl">{s.icon}</div>
              <div className="text-xl font-bold mt-1">{s.v}</div>
              <div className="text-white/50 text-[10px] uppercase tracking-wider">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-[16px] p-1 shadow-sm w-fit">
        {[{k:'roles',l:'Roles List',icon:'🎭'},{k:'edit',l:editingRole?'Edit Role':'New Role',icon:'✏️',hide:tab!=='edit'}]
          .filter(t=>!t.hide)
          .map(t => (
          <button key={t.k} onClick={()=>setTab(t.k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-[12px] text-sm font-semibold transition-all ${tab===t.k?'bg-[#0F172A] text-white shadow':'text-gray-600 hover:text-gray-900'}`}>
            <span>{t.icon}</span>{t.l}
          </button>
        ))}
      </div>

      {/* ── Roles List Tab ── */}
      {tab === 'roles' && (
        <div className="space-y-4">
          {roles.length === 0 ? (
            <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm py-16 text-center">
              <div className="text-5xl mb-4">🔐</div>
              <div className="font-bold text-[#0F172A] text-lg mb-1">No roles yet</div>
              <p className="text-gray-400 text-sm mb-4">Click "Seed Standard Roles" to get started with pre-configured roles.</p>

            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
              {roles.map(role => {
                const perms = rolePermsMap[role.id] || [];
                const scope = DATA_SCOPES.find(s => s.v === (role.data_scope || 'own'));
                const userCount = usersByRole[role.id] || 0;
                const isAdmin = perms.includes('__admin__');

                return (
                  <div key={role.id} className="bg-white rounded-[20px] border border-gray-200 shadow-sm overflow-hidden">
                    {/* Role header */}
                    <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-gray-100 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-[#0F172A]">{role.role_name}</h3>
                          {isAdmin && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-200">SUPER ADMIN</span>}
                        {isSystemRole(role) && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold border border-gray-200">🔒 SYSTEM</span>}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${role.status==='Active'?'bg-green-100 text-green-700 border-green-200':'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {role.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 font-mono">{role.role_code}</div>
                        <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="px-5 py-3 grid grid-cols-3 gap-3 border-b border-gray-50">
                      <div className="text-center">
                        <div className="text-lg font-bold text-[#0F172A]">{perms.length}</div>
                        <div className="text-[10px] text-gray-400 uppercase">Permissions</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{userCount}</div>
                        <div className="text-[10px] text-gray-400 uppercase">Users</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-1 rounded-lg leading-tight">
                          {scope?.l || 'Own Only'}
                        </div>
                        <div className="text-[10px] text-gray-400 uppercase mt-0.5">Data Scope</div>
                      </div>
                    </div>

                    {/* Permission pills */}
                    <div className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {MODULE_GROUPS.map(g => {
                          const groupCodes = FULL_PERMISSIONS.filter(p => p.group === g.group).map(p => p.code);
                          const hasAny = groupCodes.some(c => perms.includes(c));
                          const hasAll = groupCodes.every(c => perms.includes(c));
                          if (!hasAny) return null;
                          return (
                            <span key={g.group} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${hasAll?'bg-blue-100 text-blue-700 border-blue-200':'bg-gray-100 text-gray-600 border-gray-200'}`}>
                              {g.icon} {g.group} {hasAll?'(All)':'(Partial)'}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="px-5 py-3 border-t border-gray-50 flex gap-2">
                      {isSystemRole(role) ? (
                        <>
                          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                            <span className="text-gray-400 text-xs">🔒</span>
                            <span className="text-xs text-gray-400 font-medium">System role — read only</span>
                          </div>
                          <button onClick={() => cloneRole(role)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap">
                            📋 Clone
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openEdit(role)}
                            className="flex-1 bg-[#0F172A] hover:bg-slate-700 text-white py-2 rounded-xl text-sm font-semibold transition-all">
                            ✏️ Edit Role & Permissions
                          </button>
                          <button onClick={() => cloneRole(role)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-3 py-2 rounded-xl text-sm font-semibold">
                            📋
                          </button>
                          <button onClick={() => handleDelete(role.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-2 rounded-xl text-sm font-semibold">
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Edit / New Role Tab ── */}
      {tab === 'edit' && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={()=>setTab('roles')} className="text-sm text-gray-500 hover:text-[#0F172A] font-semibold">← Back to Roles</button>
            <h3 className="font-bold text-[#0F172A] text-lg">{editingRole ? `Edit — ${editingRole.role_name}` : 'Create New Role'}</h3>
            {editingRole && isSystemRole(editingRole) && (
              <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-bold">🔒 System Role — Clone to customize</span>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
            {/* Left: Role details + Data Scope */}
            <div className="space-y-4">
              {/* Role details */}
              <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5 space-y-4">
                <h4 className="font-bold text-[#0F172A] text-sm">🎭 Role Details</h4>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Role Name *</label>
                  <input value={form.role_name} onChange={e=>setForm(f=>({...f,role_name:e.target.value}))}
                    placeholder="e.g. Sales Manager" className={iCls}/>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Role Code *</label>
                  <input value={form.role_code} onChange={e=>setForm(f=>({...f,role_code:e.target.value.toUpperCase().replace(/\s+/g,'_')}))}
                    placeholder="e.g. SALES_MGR" className={`${iCls} font-mono`}/>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Description</label>
                  <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                    placeholder="Describe what this role can do..." rows={2}
                    className={`${iCls} resize-none`}/>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Status</label>
                  <div className="flex gap-2">
                    {['Active','Inactive'].map(s => (
                      <button key={s} onClick={()=>setForm(f=>({...f,status:s}))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${form.status===s?'bg-[#0F172A] text-white border-transparent':'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Data Security Policy */}
              <div className="bg-white rounded-[20px] border border-purple-200 shadow-sm p-5 space-y-3">
                <div>
                  <h4 className="font-bold text-[#0F172A] text-sm">🛡️ Data Security Policy</h4>
                  <p className="text-xs text-gray-400 mt-0.5">Controls which records users with this role can see.</p>
                </div>
                <div className="space-y-2">
                  {DATA_SCOPES.map(scope => (
                    <button key={scope.v} onClick={()=>setForm(f=>({...f,data_scope:scope.v}))}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${form.data_scope===scope.v?'bg-purple-50 border-purple-400':'bg-gray-50 border-gray-200 hover:border-purple-300'}`}>
                      <div className={`text-sm font-semibold ${form.data_scope===scope.v?'text-purple-700':'text-[#0F172A]'}`}>{scope.l}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{scope.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Perm summary */}
              <div className="bg-[#0F172A] rounded-[20px] p-4 text-white">
                <div className="text-sm font-bold mb-2">{selectedPerms.length} permissions selected</div>
                <div className="flex flex-wrap gap-1">
                  {MODULE_GROUPS.map(g => {
                    const groupCodes = FULL_PERMISSIONS.filter(p => p.group === g.group).map(p => p.code);
                    const selected = groupCodes.filter(c => selectedPerms.includes(c));
                    if (!selected.length) return null;
                    return (
                      <span key={g.group} className="text-[10px] bg-white/15 text-white px-2 py-0.5 rounded-full">
                        {g.icon} {g.group} ({selected.length}/{groupCodes.length})
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Permissions */}
            <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm overflow-hidden">
              {/* Permissions header */}
              <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-gray-100">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h4 className="font-bold text-[#0F172A]">🔑 Permissions</h4>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={selectAll}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${selectedPerms.length===FULL_PERMISSIONS.length?'bg-[#0F172A] text-white border-transparent':'bg-white text-gray-700 border-gray-200 hover:border-blue-400'}`}>
                      {selectedPerms.length === FULL_PERMISSIONS.length ? '☑ Deselect All' : '☐ Select All'}
                    </button>
                    <button onClick={()=>setSelectedPerms(FULL_PERMISSIONS.filter(p=>p.code!=='__admin__'&&p.action!=='delete').map(p=>p.code))}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:border-blue-400">
                      No Delete
                    </button>
                    <button onClick={()=>setSelectedPerms(FULL_PERMISSIONS.filter(p=>p.group!=='Admin Tools'&&p.code!=='__admin__').map(p=>p.code))}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:border-blue-400">
                      No Admin
                    </button>
                    <button onClick={()=>setSelectedPerms([])}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100">
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Group filter */}
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  <button onClick={()=>setGroupFilter('all')}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${groupFilter==='all'?'bg-[#0F172A] text-white':'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                    All Groups
                  </button>
                  {allGroups.map(g => (
                    <button key={g} onClick={()=>setGroupFilter(g)}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${groupFilter===g?'bg-[#0F172A] text-white':'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permission grid */}
              <div className="p-5 space-y-6 max-h-[600px] overflow-y-auto">
                {/* Special permissions */}
                {(groupFilter === 'all' || groupFilter === 'System') && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        🔑 System Permissions
                      </div>
                      <button onClick={()=>selectAllInGroup('System')}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold px-2 py-0.5 bg-blue-50 rounded-lg">
                        {SPECIAL_PERMS.every(p=>selectedPerms.includes(p.code))?'Deselect All':'Select All'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {SPECIAL_PERMS.map(p => (
                        <label key={p.code} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${selectedPerms.includes(p.code)?'bg-amber-50 border-amber-300':'bg-gray-50 border-gray-200 hover:border-blue-300'}`}>
                          <input type="checkbox" checked={selectedPerms.includes(p.code)}
                            onChange={()=>togglePerm(p.code)}
                            className="w-4 h-4 accent-blue-600 rounded flex-shrink-0"/>
                          <span className={`text-sm font-medium ${selectedPerms.includes(p.code)?'text-amber-800':'text-[#0F172A]'}`}>{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Module groups */}
                {MODULE_GROUPS.filter(g => groupFilter==='all' || g.group===groupFilter).map(g => (
                  <div key={g.group}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <span>{g.icon}</span> {g.group}
                      </div>
                      <button onClick={()=>selectAllInGroup(g.group)}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold px-2 py-0.5 bg-blue-50 rounded-lg">
                        {FULL_PERMISSIONS.filter(p=>p.group===g.group).every(p=>selectedPerms.includes(p.code))?'Deselect All':'Select All'}
                      </button>
                    </div>

                    {g.modules.map(module => {
                      const modPerms = FULL_PERMISSIONS.filter(p => p.module === module);
                      const allModSelected = modPerms.every(p => selectedPerms.includes(p.code));
                      return (
                        <div key={module} className="mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox"
                                checked={allModSelected}
                                onChange={()=>selectAllInModule(module)}
                                className="w-3.5 h-3.5 accent-blue-600 rounded"/>
                              <span className="text-xs font-semibold text-gray-600 capitalize">
                                {module.replace(/_/g,' ')}
                              </span>
                            </label>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 pl-4">
                            {ACTIONS.map(action => {
                              const p = modPerms.find(p => p.action === action);
                              if (!p) return null;
                              const selected = selectedPerms.includes(p.code);
                              return (
                                <label key={p.code}
                                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all text-xs ${
                                    selected
                                      ? action==='delete' ? 'bg-red-50 border-red-300 text-red-700'
                                      : 'bg-blue-50 border-blue-300 text-blue-700'
                                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-300'
                                  }`}>
                                  <input type="checkbox" checked={selected} onChange={()=>togglePerm(p.code)}
                                    className="w-3 h-3 accent-blue-600 rounded flex-shrink-0"/>
                                  <span className="font-medium capitalize">{action}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Save bar */}
          <div className="flex items-center justify-between bg-white rounded-[20px] border border-gray-200 shadow-sm px-5 py-4">
            <button onClick={()=>setTab('roles')} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow hover:opacity-90 disabled:opacity-50">
              {saving ? '⏳ Saving…' : editingRole ? '💾 Update Role' : '🚀 Create Role'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
