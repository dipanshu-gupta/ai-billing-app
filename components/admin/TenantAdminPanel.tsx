// @ts-nocheck
'use client';
/**
 * TenantAdminPanel
 *
 * Super-admin panel (accessible only at demo.erp.businesspro.com or localhost)
 * for managing all tenants — create, configure, suspend, view stats.
 *
 * Only visible when:  tenant.slug === 'demo' && user.is_super_admin === true
 */
import { useState, useEffect , useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const PLANS  = ['trial','shared','dedicated','enterprise'];
const STATUS = ['trial','active','suspended','expired'];
const ALL_MODULES = ['crm','invoicing','retail','reports','ai','admin'];
const DEFAULT_MODULES = ['crm','invoicing'];

const emptyTenant = () => ({
  slug:'', name:'', plan:'trial', status:'trial',
  admin_email:'', admin_name:'', company_size:'', industry:'', country:'India',
  brand_color:'#0F172A', accent_color:'#2563EB', app_name:'Business Pro',
  b2c_enabled:false, max_users:5,
  modules:[...DEFAULT_MODULES],
  db_url:'', db_anon_key:'',
  trial_ends_at: new Date(Date.now()+14*86400000).toISOString().slice(0,10),
  mrr_usd:0,
});

const PLAN_COLORS = {
  trial:'bg-amber-100 text-amber-700', shared:'bg-blue-100 text-blue-700',
  dedicated:'bg-purple-100 text-purple-700', enterprise:'bg-green-100 text-green-700',
};
const STATUS_COLORS = {
  active:'bg-green-100 text-green-700', trial:'bg-amber-100 text-amber-700',
  suspended:'bg-red-100 text-red-700', expired:'bg-gray-100 text-gray-500',
};

function Badge({ label, cls }) {
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label.toUpperCase()}</span>;
}

export default function TenantAdminPanel() {
  const supabase = useMemo(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  ), []);
  const [tenants,  setTenants]  = useState<Tenant[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<Tenant|null>(null);
  const [form,     setForm]     = useState(emptyTenant());
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState('');
  const [tab,      setTab]      = useState('list'); // 'list' | 'new' | 'edit'
  const [search,   setSearch]   = useState('');

  useEffect(() => { load(); }, []);

  const showToast = (m, err=false) => {
    setToast({m, err});
    setTimeout(() => setToast(''), 3000);
  };

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) showToast('Load failed: '+error.message, true);
    else setTenants(data || []);
    setLoading(false);
  }

  function openNew() {
    setForm(emptyTenant());
    setSelected(null);
    setTab('edit');
  }

  function openEdit(t: Tenant) {
    setSelected(t);
    setForm({
      ...emptyTenant(), ...t,
      modules: t.modules || DEFAULT_MODULES,
      trial_ends_at: t.trial_ends_at?.slice(0,10) || '',
    });
    setTab('edit');
  }

  async function save() {
    if (!form.slug || !form.name) { showToast('Slug and Name are required', true); return; }
    setSaving(true);

    const payload = {
      slug:           form.slug.toLowerCase().replace(/[^a-z0-9-]/g,''),
      name:           form.name,
      plan:           form.plan,
      status:         form.status,
      admin_email:    form.admin_email||'',
      admin_name:     form.admin_name||'',
      company_size:   form.company_size||'',
      industry:       form.industry||'',
      country:        form.country||'India',
      brand_color:    form.brand_color||'#0F172A',
      accent_color:   form.accent_color||'#2563EB',
      app_name:       form.app_name||'Business Pro',
      b2c_enabled:    !!form.b2c_enabled,
      max_users:      Number(form.max_users)||5,
      modules:        form.modules||['crm','invoicing'],
      db_url:         form.db_url||null,
      db_anon_key:    form.db_anon_key||null,
      trial_ends_at:  form.trial_ends_at ? new Date(form.trial_ends_at).toISOString() : null,
      mrr_usd:        Number(form.mrr_usd)||0,
    };

    try {
      let err = null;
      if (selected?.id) {
        const { error } = await supabase.from('tenants').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', selected.id);
        err = error;
      } else {
        const { error } = await supabase.from('tenants').insert({ ...payload, created_at: new Date().toISOString() });
        err = error;
      }
      if (err) { showToast('Save failed: ' + err.message, true); setSaving(false); return; }
      showToast(selected ? '✓ Tenant updated' : '✓ Tenant created');
      await load();
      setTab('list');
    } catch(e) {
      showToast('Save failed: ' + e.message, true);
    }
    setSaving(false);
  }

  async function suspend(id: string, current: string) {
    const next = current === 'suspended' ? 'active' : 'suspended';
    await supabase.from('tenants').update({ status: next }).eq('id', id);
    showToast(next === 'suspended' ? 'Tenant suspended' : 'Tenant reactivated');
    await load();
  }

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleModule = (m) => upd('modules', form.modules?.includes(m) ? form.modules.filter(x=>x!==m) : [...(form.modules||[]), m]);

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase()) ||
    t.admin_email?.toLowerCase().includes(search.toLowerCase())
  );

  const iCls = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400';
  const sCls = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400';
  const lCls = 'block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5';

  // Stats
  const stats = {
    total:       tenants.length,
    active:      tenants.filter(t=>t.status==='active').length,
    trial:       tenants.filter(t=>t.status==='trial').length,
    dedicated:   tenants.filter(t=>t.plan==='dedicated'||t.plan==='enterprise').length,
    mrr:         tenants.reduce((s,t)=>s+(t.mrr_usd||0),0),
  };

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[9999] px-5 py-3 rounded-2xl shadow-2xl font-semibold text-sm text-white ${toast.err?'bg-red-500':'bg-[#0F172A]'}`}>
          {toast.m}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F172A] to-slate-700 rounded-[24px] p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">🏢 Tenant Administration</h2>
            <p className="text-white/60 text-sm mt-1">Manage all Business Pro client workspaces from one place.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setTab('list')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab==='list'?'bg-white text-[#0F172A]':'bg-white/15 text-white hover:bg-white/25'}`}>
              All Tenants
            </button>
            <button onClick={openNew} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow">
              + New Tenant
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
          {[
            {l:'Total Tenants', v:stats.total,     icon:'🏢'},
            {l:'Active',        v:stats.active,     icon:'✅'},
            {l:'On Trial',      v:stats.trial,      icon:'⏳'},
            {l:'Dedicated DB',  v:stats.dedicated,  icon:'🗄️'},
            {l:'Monthly ARR',   v:`$${stats.mrr.toFixed(0)}`, icon:'💰'},
          ].map(s=>(
            <div key={s.l} className="bg-white/10 rounded-[16px] p-3 text-center">
              <div className="text-xl">{s.icon}</div>
              <div className="text-xl font-bold mt-1">{s.v}</div>
              <div className="text-white/50 text-[10px] uppercase tracking-wider mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tenant List */}
      {tab==='list' && (
        <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <input
              value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search tenants by name, slug, email…"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400"/>
            <span className="text-xs text-gray-400 whitespace-nowrap">{filtered.length} tenants</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">🏢</div>
              <div className="font-semibold">No tenants found</div>
              <p className="text-sm mt-1">Create your first tenant to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(t => (
                <div key={t.id} className="px-5 py-4 hover:bg-gray-50 flex items-center gap-4 transition-colors">
                  {/* Brand color chip + info */}
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-sm font-bold shadow"
                    style={{background: t.brand_color||'#0F172A'}}>
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#0F172A] text-sm">{t.name}</span>
                      <Badge label={t.plan}   cls={PLAN_COLORS[t.plan]   ||'bg-gray-100 text-gray-600'}/>
                      <Badge label={t.status} cls={STATUS_COLORS[t.status]||'bg-gray-100 text-gray-600'}/>
                      {t.b2c_enabled && <Badge label="B2C" cls="bg-purple-100 text-purple-700"/>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex gap-3 flex-wrap">
                      <span className="font-mono text-gray-600">{t.slug}.erp.businesspro.com</span>
                      {t.custom_domain && <span>🔗 {t.custom_domain}</span>}
                      {t.admin_email   && <span>✉️ {t.admin_email}</span>}
                      <span>👥 Max {t.max_users} users</span>
                      {t.mrr_usd > 0 && <span className="text-green-600 font-semibold">💰 ${t.mrr_usd}/mo</span>}
                      {t.plan==='dedicated' && <span className="text-purple-600 font-semibold">🗄️ Dedicated DB</span>}
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {(t.modules||[]).map(m=>(
                        <span key={m} className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold uppercase">{m}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={()=>openEdit(t)}
                      className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-xl text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-all">
                      Edit
                    </button>
                    <button onClick={()=>suspend(t.id, t.status)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${t.status==='suspended'?'bg-green-50 border border-green-200 text-green-700 hover:bg-green-100':'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100'}`}>
                      {t.status==='suspended'?'Reactivate':'Suspend'}
                    </button>
                    <a href={`https://${t.slug}.erp.businesspro.com`} target="_blank" rel="noreferrer"
                      className="px-3 py-1.5 text-xs font-semibold bg-[#0F172A] text-white rounded-xl hover:bg-slate-700 transition-all">
                      Open ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Form */}
      {tab==='edit' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={()=>setTab('list')} className="text-sm text-gray-500 hover:text-[#0F172A] font-semibold">← Back</button>
            <h3 className="font-bold text-[#0F172A] text-lg">{selected ? `Edit — ${selected.name}` : 'Create New Tenant'}</h3>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Left column */}
            <div className="space-y-4">

              {/* Identity */}
              <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5 space-y-4">
                <h4 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">🏢 Tenant Identity</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lCls}>Subdomain Slug *</label>
                    <input value={form.slug||""} onChange={e=>upd('slug',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}
                      placeholder="abc" className={`${iCls} font-mono`} disabled={!!selected}/>
                    {form.slug && <p className="text-xs text-gray-400 mt-1">{form.slug}.erp.businesspro.com</p>}
                  </div>
                  <div>
                    <label className={lCls}>Company Name *</label>
                    <input value={form.name||""} onChange={e=>upd('name',e.target.value)} placeholder="ABC Corporation" className={iCls}/>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lCls}>Application Name</label>
                    <input value={form.app_name||""} onChange={e=>upd('app_name',e.target.value)} placeholder="Business Pro" className={iCls}/>
                  </div>
                  <div>
                    <label className={lCls}>Custom Domain</label>
                    <input value={form.custom_domain||''} onChange={e=>upd('custom_domain',e.target.value)} placeholder="erp.abccorp.com" className={`${iCls} font-mono text-xs`}/>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lCls}>Admin Email</label>
                    <input type="email" value={form.admin_email||""} onChange={e=>upd('admin_email',e.target.value)} placeholder="admin@abccorp.com" className={iCls}/>
                  </div>
                  <div>
                    <label className={lCls}>Admin Name</label>
                    <input value={form.admin_name||""} onChange={e=>upd('admin_name',e.target.value)} placeholder="John Smith" className={iCls}/>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={lCls}>Industry</label>
                    <select value={form.industry||""} onChange={e=>upd('industry',e.target.value)} className={sCls}>
                      <option value="">Select</option>
                      {['Retail','Manufacturing','Technology','Healthcare','Finance','Education','Real Estate','Hospitality','Other'].map(i=><option key={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Company Size</label>
                    <select value={form.company_size||""} onChange={e=>upd('company_size',e.target.value)} className={sCls}>
                      <option value="">Select</option>
                      {['1-10','11-50','51-200','201-1000','1000+'].map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Country</label>
                    <select value={form.country||""} onChange={e=>upd('country',e.target.value)} className={sCls}>
                      {['India','USA','UK','UAE','Singapore','Australia','Other'].map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Plan & Status */}
              <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5 space-y-4">
                <h4 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">💼 Plan & Billing</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lCls}>Plan</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PLANS.map(p=>(
                        <button key={p} onClick={()=>upd('plan',p)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all ${form.plan===p?'bg-[#0F172A] text-white border-transparent':'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-300'}`}>
                          {p.charAt(0).toUpperCase()+p.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={lCls}>Status</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {STATUS.map(s=>(
                        <button key={s} onClick={()=>upd('status',s)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all ${form.status===s?'bg-[#0F172A] text-white border-transparent':'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-300'}`}>
                          {s.charAt(0).toUpperCase()+s.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={lCls}>Trial Ends</label>
                    <input type="date" value={form.trial_ends_at||""} onChange={e=>upd('trial_ends_at',e.target.value)} className={iCls}/>
                  </div>
                  <div>
                    <label className={lCls}>Max Users</label>
                    <input type="number" value={form.max_users||""} onChange={e=>upd('max_users',e.target.value)} className={iCls} min={1}/>
                  </div>
                  <div>
                    <label className={lCls}>MRR (USD)</label>
                    <input type="number" value={form.mrr_usd||""} onChange={e=>upd('mrr_usd',e.target.value)} className={iCls} min={0}/>
                  </div>
                </div>
              </div>

              {/* Modules */}
              <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5 space-y-3">
                <h4 className="font-bold text-[#0F172A] text-sm">🧩 Enabled Modules</h4>
                <div className="grid grid-cols-3 gap-2">
                  {ALL_MODULES.map(m=>(
                    <button key={m} onClick={()=>toggleModule(m)}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${form.modules?.includes(m)?'bg-[#0F172A] text-white border-transparent':'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                      {m.charAt(0).toUpperCase()+m.slice(1)}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input type="checkbox" checked={!!form.b2c_enabled} onChange={e=>upd('b2c_enabled',e.target.checked)} className="w-4 h-4 accent-purple-600 rounded"/>
                  <span className="text-sm font-medium text-[#0F172A]">Enable B2C / Retail Mode</span>
                </label>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">

              {/* Branding */}
              <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5 space-y-4">
                <h4 className="font-bold text-[#0F172A] text-sm">🎨 Branding</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lCls}>Brand Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.brand_color||""} onChange={e=>upd('brand_color',e.target.value)}
                        className="w-10 h-9 rounded-lg border border-gray-300 cursor-pointer p-0.5 flex-shrink-0"/>
                      <input value={form.brand_color||""} onChange={e=>upd('brand_color',e.target.value)} className={`${iCls} font-mono text-xs`}/>
                    </div>
                  </div>
                  <div>
                    <label className={lCls}>Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.accent_color||""} onChange={e=>upd('accent_color',e.target.value)}
                        className="w-10 h-9 rounded-lg border border-gray-300 cursor-pointer p-0.5 flex-shrink-0"/>
                      <input value={form.accent_color||""} onChange={e=>upd('accent_color',e.target.value)} className={`${iCls} font-mono text-xs`}/>
                    </div>
                  </div>
                </div>
                {/* Branding preview */}
                <div className="rounded-2xl overflow-hidden border border-gray-200">
                  <div className="p-4 text-white" style={{background:form.brand_color}}>
                    <div className="font-bold text-sm">{form.app_name||'Business Pro'}</div>
                    <div className="text-white/60 text-xs mt-0.5">{form.name||'Company Name'}</div>
                  </div>
                  <div className="p-3 bg-white flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{background:form.brand_color}}>Primary</button>
                    <button className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{background:form.accent_color}}>Accent</button>
                    <div className="flex-1"/>
                    <span className="text-xs text-gray-400 self-center">{form.slug||'slug'}.erp.businesspro.com</span>
                  </div>
                </div>
              </div>

              {/* Database — dedicated only */}
              {(form.plan==='dedicated'||form.plan==='enterprise') && (
                <div className="bg-white rounded-[20px] border border-purple-200 shadow-sm p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-[#0F172A] text-sm">🗄️ Dedicated Database</h4>
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">DEDICATED PLAN</span>
                  </div>
                  <p className="text-xs text-gray-400">Provide the client's Supabase project credentials. Leave blank to provision automatically.</p>
                  <div>
                    <label className={lCls}>Supabase Project URL</label>
                    <input value={form.db_url||''} onChange={e=>upd('db_url',e.target.value)}
                      placeholder="https://xxxxxxxxxxxx.supabase.co" className={`${iCls} font-mono text-xs`}/>
                  </div>
                  <div>
                    <label className={lCls}>Supabase Anon Key</label>
                    <input value={form.db_anon_key||''} onChange={e=>upd('db_anon_key',e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…" className={`${iCls} font-mono text-xs`} type="password"/>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                    ⚠️ After saving, run <code className="font-mono bg-amber-100 px-1 rounded">schema_migration.sql</code> against the client's Supabase project to create all tables.
                  </div>
                </div>
              )}

              {/* URL summary */}
              <div className="bg-[#0F172A] rounded-[20px] p-5 text-white space-y-3">
                <h4 className="font-bold text-sm">🌐 Access URLs</h4>
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2">
                    <span className="text-white/50">Primary</span>
                    <span>{form.slug||'slug'}.erp.businesspro.com</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2">
                    <span className="text-white/50">Production</span>
                    <span>{form.slug||'slug'}.prod.erp.businesspro.com</span>
                  </div>
                  {form.custom_domain && (
                    <div className="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2">
                      <span className="text-white/50">Custom</span>
                      <span>{form.custom_domain}</span>
                    </div>
                  )}
                </div>
                <p className="text-white/40 text-[10px]">DNS propagates automatically via wildcard *.erp.businesspro.com</p>
              </div>
            </div>
          </div>

          {/* Save bar */}
          <div className="flex items-center justify-between bg-white rounded-[20px] border border-gray-200 shadow-sm px-5 py-4">
            <button onClick={()=>setTab('list')} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving…' : selected ? '💾 Update Tenant' : '🚀 Create Tenant'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
