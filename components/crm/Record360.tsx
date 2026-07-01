// @ts-nocheck
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';
import { getStatusColor } from '@/lib/utils';

// ─── Shared helpers ────────────────────────────────────────────────────────────
const fmt = (n: any) =>
  new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(n||0);

const Pill = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(status)}`}>
    {status}
  </span>
);

// ─── Generic 360 Table ────────────────────────────────────────────────────────
function Section360Table({ icon, label, data, cols, createLabel, onOpen, onCreate }) {
  return (
    <div className="bg-white rounded-[20px] border border-blue-100 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3.5 flex items-center justify-between">
        <h4 className="text-white font-bold text-sm flex items-center gap-2">
          {icon} {label}
          <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">{data.length}</span>
        </h4>
        {createLabel && onCreate && (
          <button onClick={onCreate}
            className="bg-white text-[#0F172A] px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-blue-50 transition-all">
            + {createLabel}
          </button>
        )}
      </div>
      {data.length === 0 ? (
        <div className="py-10 text-center">
          <div className="text-4xl mb-2">{icon}</div>
          <p className="text-gray-400 text-sm">No {label.toLowerCase()} linked.</p>
          {createLabel && onCreate && (
            <button onClick={onCreate} className="mt-2 text-blue-600 text-xs font-semibold hover:underline">
              + Create {createLabel}
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-blue-50 border-b border-blue-100">
              <tr>
                {cols.map(c => <th key={c.h} className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-gray-500">{c.h}</th>)}
                <th className="px-4 py-2.5 w-14"/>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={row.id||i}
                  className="border-t border-blue-50 hover:bg-blue-50/60 cursor-pointer transition-all"
                  onClick={() => onOpen && onOpen(row)}>
                  {cols.map(c => <td key={c.h} className="px-4 py-2.5 text-[#0F172A]">{c.v(row)}</td>)}
                  <td className="px-4 py-2.5">
                    <span className="text-blue-400 text-xs font-semibold">Open →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Record Team ──────────────────────────────────────────────────────────────
function RecordTeam({ recordType, recordId }) {
  const { enterpriseUsers, currentUser } = useApp();
  const { supabase } = useTenant();
  const [members, setMembers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [selUser, setSelUser]     = useState('');
  const [selRole, setSelRole]     = useState('Member');
  const [saving, setSaving]       = useState(false);

  const ROLES = ['Member','Owner','Reviewer','Support','Observer'];

  const load = useCallback(async () => {
    if (!supabase || !recordId) return;
    setLoading(true);
    const { data } = await supabase
      .from('record_teams')
      .select('*, enterprise_users(id, first_name, last_name, email, designation)')
      .eq('record_type', recordType)
      .eq('record_id', recordId)
      .order('created_at');
    setMembers(data || []);
    setLoading(false);
  }, [supabase, recordType, recordId]);

  useEffect(() => { load(); }, [load]);

  const addMember = async () => {
    if (!selUser || !supabase) return;
    setSaving(true);
    await supabase.from('record_teams').upsert({
      record_type: recordType,
      record_id: recordId,
      user_id: selUser,
      role: selRole,
      added_by: currentUser?.email || '',
    }, { onConflict: 'record_type,record_id,user_id' });
    setSelUser(''); setSelRole('Member'); setAdding(false);
    setSaving(false);
    await load();
  };

  const removeMember = async (id: string) => {
    if (!supabase) return;
    await supabase.from('record_teams').delete().eq('id', id);
    await load();
  };

  const updateRole = async (id: string, role: string) => {
    if (!supabase) return;
    await supabase.from('record_teams').update({ role }).eq('id', id);
    await load();
  };

  const memberUserIds = members.map(m => m.user_id);
  const availableUsers = enterpriseUsers.filter(u => !memberUserIds.includes(u.id) && u.id !== currentUser?.id);

  const ROLE_COLORS: Record<string,string> = {
    Owner:    'bg-amber-100 text-amber-800 border-amber-200',
    Member:   'bg-blue-100 text-blue-800 border-blue-200',
    Reviewer: 'bg-purple-100 text-purple-800 border-purple-200',
    Support:  'bg-green-100 text-green-800 border-green-200',
    Observer: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  return (
    <div className="bg-white rounded-[20px] border border-blue-100 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-5 py-3.5 flex items-center justify-between">
        <h4 className="text-white font-bold text-sm flex items-center gap-2">
          👥 Record Team
          <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">{members.length}</span>
        </h4>
        <button onClick={() => setAdding(p => !p)}
          className="bg-white text-[#0F172A] px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-blue-50 transition-all">
          {adding ? '✕ Cancel' : '+ Add Member'}
        </button>
      </div>

      {adding && (
        <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-gray-500 mb-1">User</label>
            <select value={selUser} onChange={e => setSelUser(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">Select user...</option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {`${u.first_name||''} ${u.last_name||''}`.trim() || u.email}
                  {u.designation ? ` — ${u.designation}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Role</label>
            <select value={selRole} onChange={e => setSelRole(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button onClick={addMember} disabled={!selUser || saving}
            className="px-4 py-2 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-xl text-sm font-bold disabled:opacity-50">
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-400 text-sm">Loading team…</div>
      ) : members.length === 0 ? (
        <div className="py-10 text-center">
          <div className="text-4xl mb-2">👥</div>
          <p className="text-gray-400 text-sm">No team members yet.</p>
          <button onClick={() => setAdding(true)} className="mt-2 text-blue-600 text-xs font-semibold hover:underline">
            + Add first member
          </button>
        </div>
      ) : (
        <div className="divide-y divide-blue-50">
          {members.map(m => {
            const u = m.enterprise_users;
            const name = u ? `${u.first_name||''} ${u.last_name||''}`.trim() || u.email : 'Unknown';
            return (
              <div key={m.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-blue-50/40 transition-all">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[#0F172A] truncate">{name}</div>
                  <div className="text-xs text-gray-400">{u?.email || ''}{u?.designation ? ` · ${u.designation}` : ''}</div>
                </div>
                <select value={m.role} onChange={e => updateRole(m.id, e.target.value)}
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none ${ROLE_COLORS[m.role] || ROLE_COLORS.Member}`}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <button onClick={() => removeMember(m.id)}
                  className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all text-lg flex-shrink-0">
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Generic 360 layout ────────────────────────────────────────────────────────
function Base360({ record, recordType, sections, onSubRecordOpen, onCreateFor }) {
  const [tab, setTab] = useState(Object.keys(sections)[0] || 'team');
  const active = sections[tab];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(sections).map(([k, s]: [string, any]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${tab===k ? 'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white shadow-lg' : 'bg-white border border-blue-100 text-[#0F172A] hover:border-blue-300'}`}>
            <span>{s.icon}</span>
            <span>{s.label}</span>
            {s.data !== undefined && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tab===k ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                {s.data.length}
              </span>
            )}
          </button>
        ))}
        {/* Team tab always last */}
        <button onClick={() => setTab('team')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${tab==='team' ? 'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white shadow-lg' : 'bg-white border border-blue-100 text-[#0F172A] hover:border-blue-300'}`}>
          <span>👥</span> <span>Team</span>
        </button>
      </div>

      {/* Content */}
      {tab === 'team' ? (
        <RecordTeam recordType={recordType} recordId={record.id} />
      ) : active ? (
        <Section360Table
          icon={active.icon}
          label={active.label}
          data={active.data}
          cols={active.cols}
          createLabel={active.createLabel}
          onOpen={row => onSubRecordOpen && onSubRecordOpen(active.page || tab, row)}
          onCreate={active.createLabel ? () => onCreateFor && onCreateFor(tab) : undefined}
        />
      ) : null}
    </div>
  );
}

// ─── Lead 360 ─────────────────────────────────────────────────────────────────
export function Lead360({ record, onSubRecordOpen, onCreateFor }) {
  const { customers, opportunities, quotations, orders, invoices, contacts } = useApp();

  const byLead = (r: any) =>
    r.lead_number === record.id || r.lead_id === record.id;
  const byCustomer = (r: any) =>
    record.customerId
      ? r.customerId === record.customerId || r.customer === record.customer
      : r.customer === record.customer;

  // Customer linked to this lead
  const linkedCustomers = customers.filter(c =>
    c.id === record.customerId || c.name === record.customer
  );

  // Converted opportunity (matched by customer or lead_id)
  const linkedOpps = opportunities.filter(r =>
    byLead(r) || (record.customer && r.customer === record.customer)
  );
  const linkedQuotes = quotations.filter(byCustomer);
  const linkedOrders = orders.filter(byCustomer);
  const linkedInvoices = invoices.filter(byCustomer);
  const linkedContacts = contacts.filter(c =>
    c.customerId === record.customerId || c.customer === record.customer
  );

  const sections = {
    customer: {
      icon:'🏢', label:'Customer', page:'customers', data: linkedCustomers, createLabel: null,
      cols:[{h:'Name',v:r=>r.name},{h:'Industry',v:r=>r.industry||'-'},{h:'Email',v:r=>r.email||'-'},{h:'Phone',v:r=>r.phone||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    opportunities: {
      icon:'💼', label:'Converted Opportunity', page:'opportunities', data: linkedOpps, createLabel:'Opportunity',
      cols:[{h:'Name',v:r=>r.name},{h:'Stage',v:r=>r.stage},{h:'Amount',v:r=>fmt(r.amount)},{h:'Close Date',v:r=>r.closeDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    contacts: {
      icon:'📇', label:'Contacts', page:'contacts', data: linkedContacts, createLabel:'Contact',
      cols:[{h:'Name',v:r=>r.name},{h:'Designation',v:r=>r.designation||'-'},{h:'Email',v:r=>r.email||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    quotations: {
      icon:'📄', label:'Quotations', page:'quotations', data: linkedQuotes, createLabel:null,
      cols:[{h:'Quote #',v:r=>r.id},{h:'Name',v:r=>r.name},{h:'Total',v:r=>fmt(r.grand_total)},{h:'Validity',v:r=>r.validity_date||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    orders: {
      icon:'🛒', label:'Orders', page:'orders', data: linkedOrders, createLabel:null,
      cols:[{h:'Order #',v:r=>r.id},{h:'Name',v:r=>r.name},{h:'Amount',v:r=>fmt(r.amount)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    invoices: {
      icon:'🧾', label:'Invoices', page:'invoices', data: linkedInvoices, createLabel:null,
      cols:[{h:'Invoice #',v:r=>r.id},{h:'Name',v:r=>r.name},{h:'Amount',v:r=>fmt(r.amount)},{h:'Due',v:r=>r.dueDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
  };

  return <Base360 record={record} recordType="leads" sections={sections} onSubRecordOpen={onSubRecordOpen} onCreateFor={onCreateFor}/>;
}

// ─── Contact 360 ──────────────────────────────────────────────────────────────
export function Contact360({ record, onSubRecordOpen, onCreateFor }) {
  const { customers, leads, opportunities, activities, quotations, orders, invoices } = useApp();

  const byContact = (r: any) =>
    r.contactId === record.id || r.contact === record.name;
  const byCustomer = (r: any) =>
    record.customerId
      ? r.customerId === record.customerId || r.customer === record.customer
      : r.customer === record.customer;

  const linkedCustomers = customers.filter(c => c.id === record.customerId || c.name === record.customer);

  const sections = {
    customer: {
      icon:'🏢', label:'Account', page:'customers', data: linkedCustomers, createLabel: null,
      cols:[{h:'Name',v:r=>r.name},{h:'Industry',v:r=>r.industry||'-'},{h:'Email',v:r=>r.email||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    leads: {
      icon:'🎯', label:'Leads', page:'leads', data: leads.filter(byContact), createLabel:'Lead',
      cols:[{h:'Name',v:r=>r.name},{h:'Source',v:r=>r.source||'-'},{h:'Amount',v:r=>fmt(r.amount)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    opportunities: {
      icon:'💼', label:'Opportunities', page:'opportunities', data: opportunities.filter(byContact), createLabel:'Opportunity',
      cols:[{h:'Name',v:r=>r.name},{h:'Stage',v:r=>r.stage},{h:'Amount',v:r=>fmt(r.amount)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    activities: {
      icon:'📅', label:'Activities', page:'activities', data: activities.filter(byContact), createLabel:'Activity',
      cols:[{h:'Name',v:r=>r.name},{h:'Type',v:r=>r.activityType||'-'},{h:'Date',v:r=>r.activityDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    quotations: {
      icon:'📄', label:'Quotations', page:'quotations', data: quotations.filter(byContact), createLabel: null,
      cols:[{h:'Quote #',v:r=>r.id},{h:'Name',v:r=>r.name},{h:'Total',v:r=>fmt(r.grand_total)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    orders: {
      icon:'🛒', label:'Orders', page:'orders', data: orders.filter(byContact), createLabel: null,
      cols:[{h:'Order #',v:r=>r.id},{h:'Name',v:r=>r.name},{h:'Amount',v:r=>fmt(r.amount)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    invoices: {
      icon:'🧾', label:'Invoices', page:'invoices', data: invoices.filter(byContact), createLabel: null,
      cols:[{h:'Invoice #',v:r=>r.id},{h:'Name',v:r=>r.name},{h:'Amount',v:r=>fmt(r.amount)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
  };

  return <Base360 record={record} recordType="contacts" sections={sections} onSubRecordOpen={onSubRecordOpen} onCreateFor={onCreateFor}/>;
}

// ─── Opportunity 360 ──────────────────────────────────────────────────────────
export function Opportunity360({ record, onSubRecordOpen, onCreateFor }) {
  const { customers, leads, contacts, activities, quotations, orders, invoices } = useApp();

  const byOpp = (r: any) => r.opportunityId === record.id || r.opportunity_number === record.id;
  const byCustomer = (r: any) => record.customerId
    ? r.customerId === record.customerId : r.customer === record.customer;

  const sections = {
    customer: {
      icon:'🏢', label:'Account', page:'customers', data: customers.filter(c => c.id === record.customerId || c.name === record.customer), createLabel: null,
      cols:[{h:'Name',v:r=>r.name},{h:'Industry',v:r=>r.industry||'-'},{h:'Email',v:r=>r.email||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    contacts: {
      icon:'📇', label:'Contacts', data: contacts.filter(c => byCustomer(c)), createLabel:'Contact',
      cols:[{h:'Name',v:r=>r.name},{h:'Designation',v:r=>r.designation||'-'},{h:'Email',v:r=>r.email||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    leads: {
      icon:'🎯', label:'Source Leads', page:'leads', data: leads.filter(l => l.customer === record.customer || l.customerId === record.customerId), createLabel: null,
      cols:[{h:'Name',v:r=>r.name},{h:'Source',v:r=>r.source||'-'},{h:'Amount',v:r=>fmt(r.amount)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    activities: {
      icon:'📅', label:'Activities', page:'activities', data: activities.filter(byCustomer), createLabel:'Activity',
      cols:[{h:'Name',v:r=>r.name},{h:'Type',v:r=>r.activityType||'-'},{h:'Date',v:r=>r.activityDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    quotations: {
      icon:'📄', label:'Quotations', page:'quotations', data: quotations.filter(byCustomer), createLabel:'Quotation',
      cols:[{h:'Quote #',v:r=>r.id},{h:'Name',v:r=>r.name},{h:'Total',v:r=>fmt(r.grand_total)},{h:'Validity',v:r=>r.validity_date||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    orders: {
      icon:'🛒', label:'Orders', page:'orders', data: orders.filter(byCustomer), createLabel:'Order',
      cols:[{h:'Order #',v:r=>r.id},{h:'Name',v:r=>r.name},{h:'Amount',v:r=>fmt(r.amount)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    invoices: {
      icon:'🧾', label:'Invoices', page:'invoices', data: invoices.filter(byCustomer), createLabel: null,
      cols:[{h:'Invoice #',v:r=>r.id},{h:'Name',v:r=>r.name},{h:'Amount',v:r=>fmt(r.amount)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
  };

  return <Base360 record={record} recordType="opportunities" sections={sections} onSubRecordOpen={onSubRecordOpen} onCreateFor={onCreateFor}/>;
}

// ─── Quotation 360 ────────────────────────────────────────────────────────────
export function Quotation360({ record, onSubRecordOpen, onCreateFor }) {
  const { customers, contacts, opportunities, orders, invoices, activities } = useApp();

  const byCustomer = (r: any) => record.customerId
    ? r.customerId === record.customerId : r.customer === record.customer;
  const byQuote = (r: any) =>
    r.quote_number === record.id || r.quoteId === record.id;

  const sections = {
    customer: {
      icon:'🏢', label:'Account', page:'customers', data: customers.filter(c => c.id === record.customerId || c.name === record.customer), createLabel: null,
      cols:[{h:'Name',v:r=>r.name},{h:'Industry',v:r=>r.industry||'-'},{h:'Email',v:r=>r.email||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    contacts: {
      icon:'📇', label:'Contacts', page:'contacts', data: contacts.filter(byCustomer), createLabel: null,
      cols:[{h:'Name',v:r=>r.name},{h:'Designation',v:r=>r.designation||'-'},{h:'Email',v:r=>r.email||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    opportunity: {
      icon:'💼', label:'Opportunity', page:'opportunities', data: opportunities.filter(byCustomer), createLabel: null,
      cols:[{h:'Name',v:r=>r.name},{h:'Stage',v:r=>r.stage},{h:'Amount',v:r=>fmt(r.amount)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    orders: {
      icon:'🛒', label:'Orders', page:'orders', data: orders.filter(r => byQuote(r) || byCustomer(r)), createLabel:'Order',
      cols:[{h:'Order #',v:r=>r.id},{h:'Name',v:r=>r.name},{h:'Amount',v:r=>fmt(r.amount)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    invoices: {
      icon:'🧾', label:'Invoices', page:'invoices', data: invoices.filter(byCustomer), createLabel: null,
      cols:[{h:'Invoice #',v:r=>r.id},{h:'Name',v:r=>r.name},{h:'Amount',v:r=>fmt(r.amount)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    activities: {
      icon:'📅', label:'Activities', page:'activities', data: activities.filter(byCustomer), createLabel:'Activity',
      cols:[{h:'Name',v:r=>r.name},{h:'Type',v:r=>r.activityType||'-'},{h:'Date',v:r=>r.activityDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
  };

  return <Base360 record={record} recordType="quotations" sections={sections} onSubRecordOpen={onSubRecordOpen} onCreateFor={onCreateFor}/>;
}

// ─── Order 360 ────────────────────────────────────────────────────────────────
export function Order360({ record, onSubRecordOpen, onCreateFor }) {
  const { customers, contacts, quotations, invoices, activities } = useApp();

  const byCustomer = (r: any) => record.customerId
    ? r.customerId === record.customerId : r.customer === record.customer;
  const linkedQuotes = quotations.filter(q =>
    q.id === record.quote_number || q.quote_number === record.quote_number || byCustomer(q)
  );
  const linkedInvoices = invoices.filter(i =>
    i.order_number === record.id || byCustomer(i)
  );

  const sections = {
    customer: {
      icon:'🏢', label:'Account', page:'customers', data: customers.filter(c => c.id === record.customerId || c.name === record.customer), createLabel: null,
      cols:[{h:'Name',v:r=>r.name},{h:'Industry',v:r=>r.industry||'-'},{h:'Email',v:r=>r.email||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    contacts: {
      icon:'📇', label:'Contacts', page:'contacts', data: contacts.filter(byCustomer), createLabel: null,
      cols:[{h:'Name',v:r=>r.name},{h:'Designation',v:r=>r.designation||'-'},{h:'Email',v:r=>r.email||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    quotations: {
      icon:'📄', label:'Source Quotation', page:'quotations', data: linkedQuotes, createLabel: null,
      cols:[{h:'Quote #',v:r=>r.id},{h:'Name',v:r=>r.name},{h:'Total',v:r=>fmt(r.grand_total)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    invoices: {
      icon:'🧾', label:'Invoices', page:'invoices', data: linkedInvoices, createLabel:'Invoice',
      cols:[{h:'Invoice #',v:r=>r.id},{h:'Name',v:r=>r.name},{h:'Amount',v:r=>fmt(r.amount)},{h:'Due',v:r=>r.dueDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    activities: {
      icon:'📅', label:'Activities', page:'activities', data: activities.filter(byCustomer), createLabel:'Activity',
      cols:[{h:'Name',v:r=>r.name},{h:'Type',v:r=>r.activityType||'-'},{h:'Date',v:r=>r.activityDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
  };

  return <Base360 record={record} recordType="orders" sections={sections} onSubRecordOpen={onSubRecordOpen} onCreateFor={onCreateFor}/>;
}

// ─── Invoice 360 ──────────────────────────────────────────────────────────────
export function Invoice360({ record, onSubRecordOpen, onCreateFor }) {
  const { customers, contacts, quotations, orders, activities } = useApp();

  const byCustomer = (r: any) => record.customerId
    ? r.customerId === record.customerId : r.customer === record.customer;
  const linkedOrders = orders.filter(o =>
    o.id === record.order_number || byCustomer(o)
  );
  const linkedQuotes = quotations.filter(byCustomer);

  const sections = {
    customer: {
      icon:'🏢', label:'Account', page:'customers', data: customers.filter(c => c.id === record.customerId || c.name === record.customer), createLabel: null,
      cols:[{h:'Name',v:r=>r.name},{h:'Industry',v:r=>r.industry||'-'},{h:'Email',v:r=>r.email||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    contacts: {
      icon:'📇', label:'Contacts', page:'contacts', data: contacts.filter(byCustomer), createLabel: null,
      cols:[{h:'Name',v:r=>r.name},{h:'Designation',v:r=>r.designation||'-'},{h:'Email',v:r=>r.email||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    orders: {
      icon:'🛒', label:'Source Order', page:'orders', data: linkedOrders, createLabel: null,
      cols:[{h:'Order #',v:r=>r.id},{h:'Name',v:r=>r.name},{h:'Amount',v:r=>fmt(r.amount)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    quotations: {
      icon:'📄', label:'Quotations', data: linkedQuotes, createLabel: null,
      cols:[{h:'Quote #',v:r=>r.id},{h:'Name',v:r=>r.name},{h:'Total',v:r=>fmt(r.grand_total)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    activities: {
      icon:'📅', label:'Activities', page:'activities', data: activities.filter(byCustomer), createLabel:'Activity',
      cols:[{h:'Name',v:r=>r.name},{h:'Type',v:r=>r.activityType||'-'},{h:'Date',v:r=>r.activityDate||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
  };

  return <Base360 record={record} recordType="invoices" sections={sections} onSubRecordOpen={onSubRecordOpen} onCreateFor={onCreateFor}/>;
}

// ─── Activity 360 ─────────────────────────────────────────────────────────────
export function Activity360({ record, onSubRecordOpen, onCreateFor }) {
  const { customers, contacts, leads, opportunities } = useApp();

  const byCustomer = (r: any) => record.customerId
    ? r.customerId === record.customerId : r.customer === record.customer;
  const byContact = (r: any) =>
    r.contactId === record.contactId || r.contact === record.contact;

  const sections = {
    customer: {
      icon:'🏢', label:'Account', page:'customers', data: customers.filter(c => c.id === record.customerId || c.name === record.customer), createLabel: null,
      cols:[{h:'Name',v:r=>r.name},{h:'Industry',v:r=>r.industry||'-'},{h:'Email',v:r=>r.email||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    contacts: {
      icon:'📇', label:'Contact', page:'contacts', data: contacts.filter(c => c.id === record.contactId || c.name === record.contact), createLabel: null,
      cols:[{h:'Name',v:r=>r.name},{h:'Designation',v:r=>r.designation||'-'},{h:'Email',v:r=>r.email||'-'},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    leads: {
      icon:'🎯', label:'Related Leads', page:'leads', data: leads.filter(byCustomer), createLabel: null,
      cols:[{h:'Name',v:r=>r.name},{h:'Source',v:r=>r.source||'-'},{h:'Amount',v:r=>fmt(r.amount)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
    opportunities: {
      icon:'💼', label:'Related Opportunities', page:'opportunities', data: opportunities.filter(byCustomer), createLabel: null,
      cols:[{h:'Name',v:r=>r.name},{h:'Stage',v:r=>r.stage},{h:'Amount',v:r=>fmt(r.amount)},{h:'Status',v:r=><Pill status={r.status}/>}],
    },
  };

  return <Base360 record={record} recordType="activities" sections={sections} onSubRecordOpen={onSubRecordOpen} onCreateFor={onCreateFor}/>;
}
