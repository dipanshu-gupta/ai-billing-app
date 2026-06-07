// @ts-nocheck
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/lib/utils';

const AppContext = createContext(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};

// ─── Table / ID field maps (used by automation engines) ───────────────────────
const TABLE_MAP = {
  customers: 'customers', leads: 'leads', opportunities: 'opportunities',
  orders: 'orders', invoices: 'invoices', contacts: 'contacts', activities: 'activities',
};
const ID_FIELD_MAP = {
  customers: 'customer_number', leads: 'lead_number', opportunities: 'opportunity_number',
  orders: 'order_number', invoices: 'invoice_number', contacts: 'contact_number', activities: 'activity_number',
};

// ─── Condition evaluator ──────────────────────────────────────────────────────
const evalCondition = (data, field, operator, value) => {
  const v = data[field] ?? data[field?.replace(/_/g, '')] ?? '';
  const s = String(v).toLowerCase();
  const cmp = String(value).toLowerCase();
  switch (operator) {
    case 'equals':       return s === cmp;
    case 'not_equals':   return s !== cmp;
    case 'contains':     return s.includes(cmp);
    case 'greater_than': return Number(v) > Number(value);
    case 'less_than':    return Number(v) < Number(value);
    default:             return false;
  }
};

export function AppProvider({ children }) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const [session,                  setSession]                  = useState(null);
  const [authLoading,              setAuthLoading]              = useState(true);
  const [currentUser,              setCurrentUser]              = useState(null);
  const [currentUserPermissions,   setCurrentUserPermissions]   = useState([]);
  const [permissionsLoaded,        setPermissionsLoaded]        = useState(false);

  // ── CRM ─────────────────────────────────────────────────────────────────────
  const [customers,     setCustomers]     = useState([]);
  const [contacts,      setContacts]      = useState([]);
  const [products,      setProducts]      = useState([]);
  const [leads,         setLeads]         = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [orders,        setOrders]        = useState([]);
  const [invoices,      setInvoices]      = useState([]);
  const [activities,    setActivities]    = useState([]);

  // ── Admin ────────────────────────────────────────────────────────────────────
  const [organizations,    setOrganizations]    = useState([]);
  const [businessUnits,    setBusinessUnits]    = useState([]);
  const [enterpriseUsers,  setEnterpriseUsers]  = useState([]);
  const [userGroups,       setUserGroups]       = useState([]);
  const [userGroupMembers, setUserGroupMembers] = useState([]);
  const [roles,            setRoles]            = useState([]);
  const [permissions,      setPermissions]      = useState([]);
  const [rolePermissions,  setRolePermissions]  = useState([]);
  const [quoteTemplates,   setQuoteTemplates]   = useState([]);

  // ── Workflow ─────────────────────────────────────────────────────────────────
  const [workflowRules,     setWorkflowRules]     = useState([]);
  const [assignmentRules,   setAssignmentRules]   = useState([]);
  const [slaPolicies,       setSlaPolicies]       = useState([]);
  const [approvalProcesses, setApprovalProcesses] = useState([]);
  const [approvalRequests,  setApprovalRequests]  = useState([]);

  // ── Notifications ─────────────────────────────────────────────────────────────
  const [notifications,  setNotifications]  = useState([]);
  const [savedSearches,  setSavedSearches]  = useState([]);
  const [quotations,     setQuotations]     = useState([]);
  const [appPreferences, setAppPreferences] = useState({
    crm_enabled: true, cpq_enabled: true, default_currency: 'INR',
    date_format: 'DD/MM/YYYY', fiscal_year_start: 'April',
  });
  const [exchangeRates,  setExchangeRates]  = useState({});

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const buildSystemFields = useCallback((isUpdate = false) => {
    if (!currentUser) return {};
    const now = new Date().toISOString();
    if (isUpdate) return { updated_by: currentUser.email, updated_at: now };
    return {
      created_by: currentUser.email, created_at: now,
      updated_by: currentUser.email, updated_at: now,
      organization_id: currentUser.organization_id,
      business_unit_id: currentUser.business_unit_id,
    };
  }, [currentUser]);

  const applyDataSecurity = useCallback((records) => {
    if (!currentUser) return records;
    // Super admins (no org set) see everything
    if (!currentUser.organization_id) return records;
    return records.filter(r => {
      const orgOk = !r.organization_id  || r.organization_id  === currentUser.organization_id;
      return orgOk;
    });
  }, [currentUser]);

  // Apply Supabase-level org filter for efficiency (server-side filtering)
  const withOrgFilter = useCallback((query) => {
    if (!currentUser?.organization_id) return query;
    return query.or(`organization_id.eq.${currentUser.organization_id},organization_id.is.null`);
  }, [currentUser?.organization_id]);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════════════════════

  const handleLogin = async (email, password) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleLogout = async () => {
    if (!supabase) return;
    setCurrentUser(null); setCurrentUserPermissions([]); setPermissionsLoaded(false);
    await supabase.auth.signOut();
  };

  const resetMyPassword = async (newPassword) => {
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) alert('Password updated successfully.');
    else alert(error.message);
  };

  const fetchCurrentUser = async (email) => {
    if (!supabase || !email) return;
    const { data } = await supabase.from('enterprise_users').select('*').eq('email', email).single();
    if (data) setCurrentUser(data);
  };

  const saveMyProfile = async (data) => {
    if (!supabase || !currentUser) return;
    const { error } = await supabase.from('enterprise_users')
      .update({ first_name: data.first_name, last_name: data.last_name, phone: data.phone })
      .eq('id', currentUser.id);
    if (!error) { await fetchCurrentUser(currentUser.email); await fetchEnterpriseUsers(); alert('Profile updated.'); }
    else alert(error.message);
  };

  const loadCurrentUserPermissions = async (email) => {
    if (!supabase || !email) return;
    setPermissionsLoaded(false);
    const { data: ud } = await supabase.from('enterprise_users').select('*, roles(id, role_name)').eq('email', email).single();
    if (!ud?.role_id) {
      // No role = full admin access, use a special marker
      setCurrentUserPermissions(['__admin__']);
      setPermissionsLoaded(true);
      return;
    }
    const { data: rpData } = await supabase.from('role_permissions').select('permission_id').eq('role_id', ud.role_id);
    const ids = (rpData || []).map(x => x.permission_id);
    if (!ids.length) {
      // Role exists but no permissions assigned = no access (empty array)
      setCurrentUserPermissions([]);
      setPermissionsLoaded(true);
      return;
    }
    const { data: permsData } = await supabase.from('permissions').select('permission_code').in('id', ids);
    setCurrentUserPermissions((permsData || []).map(x => x.permission_code));
    setPermissionsLoaded(true);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchNotifications = async () => {
    if (!supabase || !currentUser?.email) return;
    const { data } = await supabase.from('notifications').select('*')
      .eq('recipient_email', currentUser.email).order('created_at', { ascending: false }).limit(50);
    if (data) setNotifications(data);
  };

  const createNotification = async ({ recipientEmail, type, title, body, recordType, recordId }) => {
    if (!supabase || !recipientEmail) return;
    await supabase.from('notifications').insert([{
      recipient_email: recipientEmail, type, title, body,
      record_type: recordType, record_id: recordId,
      is_read: false, created_at: new Date().toISOString(),
    }]);
    if (recipientEmail === currentUser?.email) await fetchNotifications();
  };

  const markNotificationRead = async (id) => {
    if (!supabase) return;
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllNotificationsRead = async () => {
    if (!supabase || !currentUser?.email) return;
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_email', currentUser.email).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT
  // ═══════════════════════════════════════════════════════════════════════════

  const logAudit = async ({ recordType, recordId, recordName, action, fieldChanged, oldValue, newValue }) => {
    if (!supabase || !currentUser) return;
    await supabase.from('audit_log').insert([{
      record_type: recordType, record_id: recordId, record_name: recordName, action,
      field_changed: fieldChanged || null, old_value: oldValue || null, new_value: newValue || null,
      performed_by: currentUser.email, performed_at: new Date().toISOString(),
      organization_id: currentUser.organization_id, business_unit_id: currentUser.business_unit_id,
    }]);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CRM FETCH
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchCustomers = async () => {
    if (!supabase) return;
    let q_customers = supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (currentUser?.organization_id)  q_customers = q_customers.eq('organization_id',  currentUser.organization_id);
    if (currentUser?.business_unit_id) q_customers = q_customers.eq('business_unit_id', currentUser.business_unit_id);
    const { data } = await q_customers;
    if (data) setCustomers(applyDataSecurity(data.map(c => ({
      id: c.customer_number, primaryContactId: c.primary_contact_id, primaryContact: '',
      name: c.name, email: c.email, phone: c.phone, company: c.company, industry: c.industry,
      billingAddress: c.billing_address, shippingAddress: c.shipping_address,
      city: c.city, state: c.state, postalCode: c.postal_code, country: c.country,
      website: c.website, gstNumber: c.gst_number, status: c.status,
      created_by: c.created_by, created_at: c.created_at, updated_by: c.updated_by, updated_at: c.updated_at,
      organization_id: c.organization_id, business_unit_id: c.business_unit_id,
      owner: c.owner || '', owner_id: c.owner_id || null,
    }))));
  };

  const fetchContacts = async () => {
    if (!supabase) return;
    let q_contacts = supabase.from('contacts').select('*').order('created_at', { ascending: false });
    if (currentUser?.organization_id)  q_contacts = q_contacts.eq('organization_id',  currentUser.organization_id);
    if (currentUser?.business_unit_id) q_contacts = q_contacts.eq('business_unit_id', currentUser.business_unit_id);
    const { data } = await q_contacts;
    if (data) setContacts(data.map(c => ({
      id: c.contact_number, customerId: c.customer_id, customer: c.customer,
      name: c.name, email: c.email, phone: c.phone, designation: c.designation,
      department: c.department, isPrimary: c.is_primary || false, status: c.status,
      created_by: c.created_by, created_at: c.created_at, updated_by: c.updated_by, updated_at: c.updated_at,
      organization_id: c.organization_id, business_unit_id: c.business_unit_id,
      owner: c.owner || '', owner_id: c.owner_id || null,
    })));
  };

  const fetchProducts = async () => {
    if (!supabase) return;
    let pq = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (currentUser?.organization_id) pq = pq.eq('organization_id', currentUser.organization_id);
    const { data } = await pq;
    if (data) setProducts(data.map(p => ({
      id: p.product_number, name: p.name, category: p.category,
      productFamily: p.product_family || '', price: Number(p.price || 0), status: p.status,
      created_by: p.created_by, created_at: p.created_at, updated_by: p.updated_by, updated_at: p.updated_at,
      organization_id: p.organization_id, business_unit_id: p.business_unit_id,
    })));
  };

  const fetchLeads = async () => {
    if (!supabase) return;
    let q_leads = supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (currentUser?.organization_id)  q_leads = q_leads.eq('organization_id',  currentUser.organization_id);
    if (currentUser?.business_unit_id) q_leads = q_leads.eq('business_unit_id', currentUser.business_unit_id);
    const { data } = await q_leads;
    if (data) setLeads(data.map(l => ({
      id: l.lead_number, name: l.name, customer: l.customer, customerId: l.customer_id,
      contact: l.contact, contactId: l.contact_id, email: l.email, phone: l.phone,
      source: l.source, amount: Number(l.amount || 0), status: l.status,
      created_by: l.created_by, created_at: l.created_at, updated_by: l.updated_by, updated_at: l.updated_at,
      organization_id: l.organization_id, business_unit_id: l.business_unit_id,
      owner: l.owner || '', owner_id: l.owner_id || null,
    })));
  };

  const fetchOpportunities = async () => {
    if (!supabase) return;
    let q_opportunities = supabase.from('opportunities').select('*').order('created_at', { ascending: false });
    if (currentUser?.organization_id)  q_opportunities = q_opportunities.eq('organization_id',  currentUser.organization_id);
    if (currentUser?.business_unit_id) q_opportunities = q_opportunities.eq('business_unit_id', currentUser.business_unit_id);
    const { data } = await q_opportunities;
    if (data) setOpportunities(data.map(o => ({
      id: o.opportunity_number, name: o.name, customer: o.customer, customerId: o.customer_id,
      contact: o.contact, contactId: o.contact_id, stage: o.stage,
      amount: Number(o.amount || 0), closeDate: o.close_date, status: o.status,
      created_by: o.created_by, created_at: o.created_at, updated_by: o.updated_by, updated_at: o.updated_at,
      organization_id: o.organization_id, business_unit_id: o.business_unit_id,
      owner: o.owner || '', owner_id: o.owner_id || null,
    })));
  };

  const fetchOrders = async () => {
    if (!supabase) return;
    let q_orders = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (currentUser?.organization_id)  q_orders = q_orders.eq('organization_id',  currentUser.organization_id);
    if (currentUser?.business_unit_id) q_orders = q_orders.eq('business_unit_id', currentUser.business_unit_id);
    const { data } = await q_orders;
    if (data) setOrders(data.map(o => ({
      id: o.order_number, name: o.name,
      customer: o.customer, customerId: o.customer_id, customer_id: o.customer_id,
      contact: o.contact,  contactId: o.contact_id,   contact_id: o.contact_id,
      amount:           Number(o.amount            || 0),
      shippingAddress:  o.shipping_address || '',
      shipping_address: o.shipping_address || '',
      billing_address:  o.billing_address  || '',
      payment_terms:    o.payment_terms    || '',
      shipping_terms:   o.shipping_terms   || '',
      currency:         o.currency         || 'INR',
      overall_discount: Number(o.overall_discount || 0),
      shipping_cost:    Number(o.shipping_cost    || 0),
      subtotal:         Number(o.subtotal         || 0),
      total_discount:   Number(o.total_discount   || 0),
      total_tax:        Number(o.total_tax        || 0),
      notes:            o.notes         || '',
      quote_number:     o.quote_number  || '',
      quote_id:         o.quote_id      || null,
      deliveryDate:  o.delivery_date, delivery_date: o.delivery_date,
      status: o.status,
      created_by: o.created_by, created_at: o.created_at, updated_by: o.updated_by, updated_at: o.updated_at,
      organization_id: o.organization_id, business_unit_id: o.business_unit_id,
    })));
  };

  const fetchInvoices = async () => {
    if (!supabase) return;
    let q_invoices = supabase.from('invoices').select('*').order('created_at', { ascending: false });
    if (currentUser?.organization_id)  q_invoices = q_invoices.eq('organization_id',  currentUser.organization_id);
    if (currentUser?.business_unit_id) q_invoices = q_invoices.eq('business_unit_id', currentUser.business_unit_id);
    const { data } = await q_invoices;
    if (data) setInvoices(data.map(inv => ({
      id: inv.invoice_number, name: inv.name, customer: inv.customer, customerId: inv.customer_id,
      contact: inv.contact, contactId: inv.contact_id, amount: Number(inv.amount || 0),
      dueDate: inv.due_date, paymentTerms: inv.payment_terms, billingAddress: inv.billing_address,
      status: inv.status,
      created_by: inv.created_by, created_at: inv.created_at, updated_by: inv.updated_by, updated_at: inv.updated_at,
      organization_id: inv.organization_id, business_unit_id: inv.business_unit_id,
    })));
  };

  const fetchActivities = async () => {
    if (!supabase) return;
    let q_activities = supabase.from('activities').select('*').order('created_at', { ascending: false });
    if (currentUser?.organization_id)  q_activities = q_activities.eq('organization_id',  currentUser.organization_id);
    if (currentUser?.business_unit_id) q_activities = q_activities.eq('business_unit_id', currentUser.business_unit_id);
    const { data } = await q_activities;
    if (data) setActivities(data.map(a => ({
      id: a.activity_number, name: a.name, customer: a.customer, customerId: a.customer_id,
      contact: a.contact, contactId: a.contact_id, subject: a.subject,
      activityType: a.activity_type, activityDate: a.activity_date, notes: a.notes, status: a.status,
      created_by: a.created_by, created_at: a.created_at, updated_by: a.updated_by, updated_at: a.updated_at,
      organization_id: a.organization_id, business_unit_id: a.business_unit_id,
    })));
  };

  const fetchLineItems = async (table, field, id) => {
    if (!supabase) return [];
    const { data } = await supabase.from(table).select('*').eq(field, id);
    return (data || []).map(item => ({
      _id: item.id, id: item.id, product: item.product_name,
      quantity: Number(item.quantity || 1), price: Number(item.price || 0),
      discount: Number(item.discount || 0),
    }));
  };

  const refreshObject = async (objectType) => {
    if (objectType === 'leads')         await fetchLeads();
    if (objectType === 'opportunities') await fetchOpportunities();
    if (objectType === 'orders')        await fetchOrders();
    if (objectType === 'invoices')      await fetchInvoices();
    if (objectType === 'customers')     await fetchCustomers();
    if (objectType === 'contacts')      await fetchContacts();
    if (objectType === 'activities')    await fetchActivities();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN FETCH
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchOrganizations    = async () => { if (!supabase) return; const { data } = await supabase.from('organizations').select('*').order('created_at', { ascending: false }); if (data) setOrganizations(data); };
  const fetchBusinessUnits    = async () => { if (!supabase) return; const { data } = await supabase.from('business_units').select('*').order('created_at', { ascending: false }); if (data) setBusinessUnits(data); };
  const fetchEnterpriseUsers  = async () => { if (!supabase) return; const { data } = await supabase.from('enterprise_users').select('*').order('created_at', { ascending: false }); if (data) setEnterpriseUsers(data); };
  const fetchUserGroups       = async () => { if (!supabase) return; const { data } = await supabase.from('user_groups').select('*').order('created_at', { ascending: false }); if (data) setUserGroups(data); };
  const fetchRoles            = async () => { if (!supabase) return; const { data } = await supabase.from('roles').select('*').order('created_at', { ascending: false }); if (data) setRoles(data); };
  const fetchPermissions      = async () => { if (!supabase) return; const { data } = await supabase.from('permissions').select('*').order('module_name'); if (data) setPermissions(data); };
  const fetchWorkflowRules    = async () => { if (!supabase) return; const { data } = await supabase.from('workflow_rules').select('*').order('created_at', { ascending: false }); if (data) setWorkflowRules(data); };
  const fetchAssignmentRules  = async () => { if (!supabase) return; const { data } = await supabase.from('assignment_rules').select('*').order('priority'); if (data) setAssignmentRules(data); };
  const fetchSLAPolicies      = async () => { if (!supabase) return; const { data } = await supabase.from('sla_policies').select('*').order('created_at', { ascending: false }); if (data) setSlaPolicies(data); };
  const fetchApprovalProcesses = async () => { if (!supabase) return; const { data } = await supabase.from('approval_processes').select('*').order('created_at', { ascending: false }); if (data) setApprovalProcesses(data); };
  const fetchApprovalRequests  = async () => { if (!supabase) return; const { data } = await supabase.from('approval_requests').select('*').order('submitted_at', { ascending: false }); if (data) setApprovalRequests(data); };

  const fetchGroupMembers = async (groupId) => {
    if (!supabase) return;
    const { data } = await supabase.from('user_group_members')
      .select('id, enterprise_user_id, user_group_id, enterprise_users(id, first_name, last_name, email, employee_code)')
      .eq('user_group_id', groupId);
    if (data) setUserGroupMembers(data);
  };

  const fetchRolePermissions = async (roleId) => {
    if (!supabase) return [];
    const { data } = await supabase.from('role_permissions')
      .select('id, permission_id, permissions(id, permission_name, permission_code, module_name)')
      .eq('role_id', roleId);
    if (data) setRolePermissions(data);
    return data || [];
  };

  const fetchQuoteTemplates = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('quote_templates').select('*').order('created_at', { ascending: false });
    if (data) setQuoteTemplates(data.map(t => ({
      id: t.template_number, dbId: t.id, name: t.name, isDefault: t.is_default,
      companyName: t.company_name, companyEmail: t.company_email,
      companyPhone: t.company_phone, companyAddress: t.company_address,
      quoteTitle: t.quote_title, footerText: t.footer_text,
      termsAndConditions: t.terms_and_conditions,
      primaryColor: t.primary_color, secondaryColor: t.secondary_color,
    })));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTOMATION ENGINES  ← The core of enterprise-grade real-time processing
  // ═══════════════════════════════════════════════════════════════════════════

  // Helper: update a CRM record's field directly in Supabase
  const updateCRMField = async (objectType, recordId, fieldsToUpdate) => {
    if (!supabase) return;
    const table   = TABLE_MAP[objectType];
    const idField = ID_FIELD_MAP[objectType];
    if (!table || !idField) return;
    await supabase.from(table).update({ ...fieldsToUpdate, updated_by: currentUser?.email, updated_at: new Date().toISOString() }).eq(idField, recordId);
    await refreshObject(objectType);
  };

  // 1. WORKFLOW ENGINE — fires on_create / on_update / on_status_change
  const runWorkflowRules = async (objectType, triggerEvent, recordData, recordId) => {
    if (!supabase) return;
    const rules = workflowRules.filter(r => r.object_type === objectType && r.trigger_event === triggerEvent && r.is_active);
    for (const rule of rules) {
      // Check optional trigger field/value condition
      if (rule.trigger_field && rule.trigger_value) {
        const fieldVal = recordData[rule.trigger_field] ?? recordData[rule.trigger_field?.replace(/_/g,'')] ?? '';
        if (String(fieldVal).toLowerCase() !== String(rule.trigger_value).toLowerCase()) continue;
      }

      const { data: actions } = await supabase.from('workflow_actions').select('*').eq('workflow_rule_id', rule.id).order('execution_order');
      for (const action of (actions || [])) {
        const cfg = action.action_config || {};
        try {
          // ── Send Notification ──────────────────────────────────────────────
          if (action.action_type === 'send_notification' && cfg.recipient) {
            await createNotification({
              recipientEmail: cfg.recipient, type: 'workflow',
              title: rule.name,
              body: cfg.message || `Workflow rule "${rule.name}" triggered on ${objectType}.`,
              recordType: objectType, recordId: recordId || recordData?.id || '',
            });
          }

          // ── Send Email (via notification) ──────────────────────────────────
          if (action.action_type === 'send_email' && cfg.to_email) {
            await createNotification({
              recipientEmail: cfg.to_email, type: 'email',
              title: cfg.subject || rule.name,
              body: cfg.body || `Automated email from workflow: ${rule.name}`,
              recordType: objectType, recordId: recordId || '',
            });
          }

          // ── Change Status ──────────────────────────────────────────────────
          if (action.action_type === 'change_status' && cfg.new_status && recordId) {
            await updateCRMField(objectType, recordId, { status: cfg.new_status });
            await logAudit({
              recordType: objectType, recordId, recordName: recordData?.name || '',
              action: 'workflow_status_changed', fieldChanged: 'status',
              oldValue: recordData?.status, newValue: cfg.new_status,
            });
          }

          // ── Update Field ───────────────────────────────────────────────────
          if (action.action_type === 'update_field' && cfg.field_name && cfg.field_value !== undefined && recordId) {
            await updateCRMField(objectType, recordId, { [cfg.field_name]: cfg.field_value });
            await logAudit({
              recordType: objectType, recordId, recordName: recordData?.name || '',
              action: 'workflow_field_updated', fieldChanged: cfg.field_name,
              oldValue: String(recordData?.[cfg.field_name] ?? ''), newValue: cfg.field_value,
            });
          }

          // ── Assign Record ──────────────────────────────────────────────────
          if (action.action_type === 'assign_record' && cfg.assign_to && recordId) {
            const assignee = enterpriseUsers.find(u => u.id === cfg.assign_to);
            if (assignee) {
              await updateCRMField(objectType, recordId, { owner: assignee.email, owner_id: assignee.id });
              await createNotification({
                recipientEmail: assignee.email, type: 'assignment',
                title: `Record Assigned by Workflow: ${rule.name}`,
                body: `A ${objectType} record "${recordData?.name || recordId}" has been assigned to you.`,
                recordType: objectType, recordId,
              });
            }
          }
        } catch (e) { console.error(`Workflow action error (${action.action_type}):`, e); }
      }
    }
  };

  // 2. ASSIGNMENT RULES ENGINE — auto-assign owner on create
  const runAssignmentRules = async (objectType, recordId, recordData) => {
    if (!supabase) return;
    const rules = assignmentRules
      .filter(r => r.object_type === objectType && r.is_active)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of rules) {
      const fieldValue = recordData[rule.condition_field] ?? recordData[rule.condition_field?.replace(/_/g,'')] ?? '';
      const matched = evalCondition(recordData, rule.condition_field, rule.condition_operator, rule.condition_value);

      if (matched) {
        // Update owner on the CRM record
        const assignee = enterpriseUsers.find(u => u.id === rule.assign_to_user_id);
        if (assignee) {
          await updateCRMField(objectType, recordId, { owner: assignee.email, owner_id: assignee.id });
          await createNotification({
            recipientEmail: assignee.email, type: 'assignment',
            title: `New ${objectType} Assigned to You`,
            body: `Assignment rule "${rule.name}" matched. A new ${objectType} record "${recordData?.name || recordId}" has been assigned to you.`,
            recordType: objectType, recordId,
          });
          await logAudit({
            recordType: objectType, recordId, recordName: recordData?.name || '',
            action: 'auto_assigned', fieldChanged: 'owner', newValue: assignee.email,
          });
        }
        // Also notify group members if group is set
        if (rule.assign_to_group_id) {
          const { data: members } = await supabase.from('user_group_members')
            .select('enterprise_user_id, enterprise_users(email)')
            .eq('user_group_id', rule.assign_to_group_id);
          for (const m of (members || [])) {
            if (m.enterprise_users?.email) {
              await createNotification({
                recipientEmail: m.enterprise_users.email, type: 'assignment',
                title: `New ${objectType} Assigned to Your Group`,
                body: `Assignment rule "${rule.name}" matched. A new ${objectType} record "${recordData?.name || recordId}" has been assigned to your group.`,
                recordType: objectType, recordId,
              });
            }
          }
        }
        break; // Stop at first matching rule (highest priority)
      }
    }
  };

  // 3. SLA ENGINE — start SLA tracking on create
  const startSLA = async (objectType, recordId, recordData) => {
    if (!supabase) return;
    const matching = slaPolicies.filter(p => p.object_type === objectType && p.is_active);
    for (const policy of matching) {
      // Evaluate condition if set
      if (policy.condition_field && policy.condition_value) {
        const matched = evalCondition(recordData, policy.condition_field, 'equals', policy.condition_value);
        if (!matched) continue;
      }
      const now = new Date();
      const { error } = await supabase.from('sla_records').insert([{
        sla_policy_id:     policy.id,
        record_type:       objectType,
        record_id:         recordId,
        started_at:        now.toISOString(),
        response_due_at:   new Date(now.getTime() + policy.response_time_hours   * 3600000).toISOString(),
        resolution_due_at: new Date(now.getTime() + policy.resolution_time_hours * 3600000).toISOString(),
        status: 'Active',
      }]);
      if (!error) {
        // Notify escalation user if configured
        const escalatee = enterpriseUsers.find(u => u.id === policy.escalate_to_user_id);
        if (escalatee) {
          await createNotification({
            recipientEmail: escalatee.email, type: 'sla',
            title: `SLA Started: ${policy.name}`,
            body: `SLA tracking started for ${objectType} record "${recordData?.name || recordId}". Response due in ${policy.response_time_hours}h, resolution in ${policy.resolution_time_hours}h.`,
            recordType: objectType, recordId,
          });
        }
      }
    }
  };

  // 4. APPROVAL AUTO-TRIGGER ENGINE — auto-submit for approval when conditions match
  const checkAndAutoApprove = async (objectType, recordId, recordName, recordData) => {
    if (!supabase || !currentUser) return;

    const matchingProcesses = approvalProcesses.filter(p => {
      if (p.object_type !== objectType || !p.is_active) return false;
      // If no condition set, always apply
      if (!p.condition_field || !p.condition_value) return true;
      return evalCondition(recordData, p.condition_field, p.condition_operator || 'equals', p.condition_value);
    });

    for (const process of matchingProcesses) {
      // Check if there's already a pending request for this record
      const { data: existing } = await supabase.from('approval_requests')
        .select('id').eq('record_id', recordId).eq('record_type', objectType).eq('status', 'Pending');
      if (existing?.length) continue; // Already pending, skip

      const { data: steps } = await supabase.from('approval_steps').select('*')
        .eq('approval_process_id', process.id).order('step_number');
      if (!steps?.length) continue;

      const firstStep = steps[0];
      const { error } = await supabase.from('approval_requests').insert([{
        request_number:      generateId('REQ'),
        approval_process_id: process.id,
        current_step_id:     firstStep.id,
        record_type:         objectType,
        record_id:           recordId,
        record_name:         recordName,
        submitted_by:        currentUser.email,
        submitted_at:        new Date().toISOString(),
        status:              'Pending',
        organization_id:     currentUser.organization_id,
        business_unit_id:    currentUser.business_unit_id,
      }]);

      if (!error) {
        // Update record status to Pending Approval
        await updateCRMField(objectType, recordId, { status: 'Pending Approval' });

        // Notify the approver
        const approver = enterpriseUsers.find(u => u.id === firstStep.approver_user_id);
        if (approver) {
          await createNotification({
            recipientEmail: approver.email, type: 'approval',
            title: `Approval Required: ${recordName}`,
            body: `${objectType} record "${recordName}" requires your approval (Process: ${process.name}). Condition matched: ${process.condition_field} ${process.condition_operator} ${process.condition_value}.`,
            recordType: objectType, recordId,
          });
        }

        // Also notify current user that record is pending approval
        await createNotification({
          recipientEmail: currentUser.email, type: 'approval',
          title: `Record Submitted for Approval`,
          body: `"${recordName}" has been automatically submitted for approval under process "${process.name}".`,
          recordType: objectType, recordId,
        });

        await logAudit({ recordType: objectType, recordId, recordName, action: 'auto_submitted_for_approval' });
        await fetchApprovalRequests();
      }
    }
  };

  // Master automation runner — call after every create/update
  const runAutomations = async (objectType, recordId, recordName, recordData, triggerEvent = 'on_create') => {
    try {
      await Promise.all([
        runWorkflowRules(objectType, triggerEvent, recordData, recordId),
        runAssignmentRules(objectType, recordId, recordData),
        triggerEvent === 'on_create' ? startSLA(objectType, recordId, recordData) : Promise.resolve(),
        // NOTE: Auto-approval removed. Users submit manually via "Submit for Approval" button.
        // The button appears only when an active process with matching conditions exists.
      ]);
    } catch (e) { console.error('Automation error:', e); }
  };

  // Check if any active approval process matches this record — used by RecordDetailPanel
  const checkMatchingApprovalProcess = async (objectType, recordData) => {
    if (!supabase) return null;
    const { data: processes } = await supabase.from('approval_processes')
      .select('*').eq('object_type', objectType).eq('is_active', true);
    for (const proc of (processes || [])) {
      const condBlock = proc.conditions || { logic: 'AND', conditions: [] };
      const conds = Array.isArray(condBlock) ? condBlock : (condBlock.conditions || []);
      const logic  = Array.isArray(condBlock) ? 'AND' : (condBlock.logic || 'AND');
      if (!conds.length) return proc;
      const results = conds.map(c => evalCondition(recordData, c.field, c.operator, c.value));
      const matched = logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
      if (matched) return proc;
    }
    return null;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  const saveOrganization = async (data, editingId) => {
    if (!supabase) return;
    editingId ? await supabase.from('organizations').update(data).eq('id', editingId)
              : await supabase.from('organizations').insert([data]);
    await fetchOrganizations();
  };

  const saveBusinessUnit = async (data, editingId) => {
    if (!supabase) return;
    const { error } = editingId ? await supabase.from('business_units').update(data).eq('id', editingId)
                                : await supabase.from('business_units').insert([data]);
    if (error) { alert(error.message); return; }
    await fetchBusinessUnits();
  };

  const saveEnterpriseUser = async (data, editingId, password) => {
    if (!supabase) return;
    if (editingId) {
      const { password: _pw, confirmPassword: _cpw, auth_user_id: _aid, ...safeData } = data;
      const { error } = await supabase.from('enterprise_users').update(safeData).eq('id', editingId);
      if (error) { alert('Failed to update user: ' + error.message); return; }
    } else {
      if (!data.email) { alert('Email is required.'); return; }
      if (!password || password.length < 6) { alert('Password must be at least 6 characters.'); return; }
      const res = await fetch('/api/admin/create-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { alert('Auth creation failed: ' + (json.error || 'Unknown error')); return; }
      const { password: _pw, confirmPassword: _cpw, ...safeData } = data;
      const { error } = await supabase.from('enterprise_users').insert([{
        ...safeData, auth_user_id: json.authUserId, status: data.status || 'Active',
      }]);
      if (error) { alert('Failed to create user record: ' + error.message); return; }
    }
    await fetchEnterpriseUsers();
    // If the saved user is the current logged-in user, refresh their permissions
    if (currentUser?.email === data.email) {
      await loadCurrentUserPermissions(currentUser.email);
    }
  };

  const adminResetPassword = async (authUserId, newPassword) => {
    if (!authUserId) { alert('This user has no linked auth account.'); return; }
    if (!newPassword || newPassword.length < 6) { alert('Password must be at least 6 characters.'); return; }
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authUserId, password: newPassword }),
    });
    const json = await res.json();
    if (!res.ok || json.error) { alert('Password reset failed: ' + (json.error || 'Unknown error')); return; }
    alert('Password reset successfully.');
  };

  const saveUserGroup = async (data, editingId) => {
    if (!supabase) return;
    editingId ? await supabase.from('user_groups').update(data).eq('id', editingId)
              : await supabase.from('user_groups').insert([data]);
    await fetchUserGroups();
  };

  const saveRole = async (data, editingId, permissionIds) => {
    if (!supabase) return;
    let roleId = editingId || '';
    if (editingId) {
      const { error } = await supabase.from('roles').update(data).eq('id', editingId);
      if (error) { alert('Failed to update role'); return; }
    } else {
      const { data: newRole, error } = await supabase.from('roles').insert([data]).select().single();
      if (error || !newRole) { alert(error?.message || 'Unable to create role'); return; }
      roleId = newRole.id;
    }
    await supabase.from('role_permissions').delete().eq('role_id', roleId);
    if (permissionIds?.length) {
      await supabase.from('role_permissions').insert(permissionIds.map(pid => ({ role_id: roleId, permission_id: pid })));
    }
    await fetchRoles();
  };

  const addUsersToGroup = async (groupId, userIds, currentMembers) => {
    if (!supabase) return;
    const existingIds = currentMembers.map(m => m.enterprise_user_id);
    const newIds = userIds.filter(id => !existingIds.includes(id));
    if (!newIds.length) return;
    await supabase.from('user_group_members').insert(newIds.map(uid => ({ user_group_id: groupId, enterprise_user_id: uid })));
    await fetchGroupMembers(groupId);
  };

  const removeUserFromGroup = async (membershipId, groupId) => {
    if (!supabase) return;
    await supabase.from('user_group_members').delete().eq('id', membershipId);
    await fetchGroupMembers(groupId);
  };

  const deleteAdminRecord = async (table, id) => {
    if (!supabase || !window.confirm('Delete this record? This cannot be undone.')) return false;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { alert(error.message); return false; }
    if (table === 'organizations')    await fetchOrganizations();
    if (table === 'business_units')   await fetchBusinessUnits();
    if (table === 'enterprise_users') await fetchEnterpriseUsers();
    if (table === 'user_groups')      await fetchUserGroups();
    if (table === 'roles')            await fetchRoles();
    return true;
  };

  const updateAdminStatus = async (table, id, status) => {
    if (!supabase) return;
    await supabase.from(table).update({ status }).eq('id', id);
    if (table === 'organizations')    await fetchOrganizations();
    if (table === 'business_units')   await fetchBusinessUnits();
    if (table === 'enterprise_users') await fetchEnterpriseUsers();
    if (table === 'user_groups')      await fetchUserGroups();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CRM CRUD — every create/update triggers all automation engines
  // ═══════════════════════════════════════════════════════════════════════════

  const createRecord = async (page, data, lineItems) => {
    if (!supabase || !currentUser) return false;
    const sys = buildSystemFields();
    const calcAmount = (lineItems || []).reduce((s, i) => s + i.quantity * i.price * (1 - (i.discount||0)/100), 0);

    try {
      let createdId = null;
      let recordName = data.name || '';

      switch (page) {
        case 'customers': {
          const id = generateId('CUST');
          const { error } = await supabase.from('customers').insert([{
            ...sys, customer_number: id, name: data.name, company: data.company, industry: data.industry,
            email: data.email, phone: data.phone, website: data.website,
            billing_address: data.billingAddress, shipping_address: data.shippingAddress,
            city: data.city, state: data.state, postal_code: data.postalCode, country: data.country,
            gst_number: data.gstNumber, status: data.status || 'Active',
            owner: data.owner || currentUser.email, owner_id: data.owner_id || currentUser.id,
          }]);
          if (error) throw error;
          createdId = id; recordName = data.name;
          await logAudit({ recordType: 'customers', recordId: id, recordName, action: 'created' });
          await fetchCustomers();
          break;
        }
        case 'products': {
          const id = generateId('PROD');
          const { error } = await supabase.from('products').insert([{
            ...sys, product_number: id, name: data.name, category: data.category,
            product_family: data.productFamily || '', price: Number(data.price || 0), status: data.status || 'Active',
          }]);
          if (error) throw error;
          createdId = id; recordName = data.name;
          await fetchProducts();
          break;
        }
        case 'leads': {
          const id = generateId('LEAD');
          const { error } = await supabase.from('leads').insert([{
            ...sys, lead_number: id, name: data.name, customer: data.customer, customer_id: data.customerId,
            contact: data.contact, contact_id: data.contactId, email: data.email, phone: data.phone,
            source: data.source, amount: calcAmount || Number(data.amount || 0), status: data.status || 'New',
            owner: data.owner || currentUser.email, owner_id: data.owner_id || currentUser.id,
          }]);
          if (error) throw error;
          if (lineItems?.length) await supabase.from('lead_line_items').insert(
            lineItems.map(i => ({ lead_number: id, product_name: i.product, quantity: i.quantity, price: i.price, discount: i.discount || 0 }))
          );
          createdId = id; recordName = data.name;
          await logAudit({ recordType: 'leads', recordId: id, recordName, action: 'created' });
          await fetchLeads();
          break;
        }
        case 'opportunities': {
          const id = generateId('OPP');
          const { error } = await supabase.from('opportunities').insert([{
            ...sys, opportunity_number: id, name: data.name, customer: data.customer, customer_id: data.customerId,
            contact: data.contact, contact_id: data.contactId, stage: data.stage || 'Qualification',
            amount: calcAmount || Number(data.amount || 0), close_date: data.closeDate || null, status: data.status || 'Open',
            owner: data.owner || currentUser.email, owner_id: data.owner_id || currentUser.id,
          }]);
          if (error) throw error;
          if (lineItems?.length) await supabase.from('opportunity_line_items').insert(
            lineItems.map(i => ({ opportunity_number: id, product_name: i.product, quantity: i.quantity, price: i.price, discount: i.discount || 0 }))
          );
          createdId = id; recordName = data.name;
          await logAudit({ recordType: 'opportunities', recordId: id, recordName, action: 'created' });
          await fetchOpportunities();
          break;
        }
        case 'orders': {
          const id = generateId('ORD');
          const { error } = await supabase.from('orders').insert([{
            ...sys, order_number: id, name: data.name, customer: data.customer, customer_id: data.customerId,
            contact: data.contact, contact_id: data.contactId, amount: calcAmount,
            shipping_address: data.shippingAddress || '', delivery_date: data.deliveryDate || null, status: data.status || 'Processing',
            owner: data.owner || currentUser.email, owner_id: data.owner_id || currentUser.id,
          }]);
          if (error) throw error;
          if (lineItems?.length) await supabase.from('order_line_items').insert(
            lineItems.map(i => ({ order_number: id, product_name: i.product, quantity: i.quantity, price: i.price, discount: i.discount || 0 }))
          );
          createdId = id; recordName = data.name;
          await logAudit({ recordType: 'orders', recordId: id, recordName, action: 'created' });
          await fetchOrders();
          break;
        }
        case 'invoices': {
          const id = generateId('INV');
          const { error } = await supabase.from('invoices').insert([{
            ...sys, invoice_number: id, name: data.name, customer: data.customer, customer_id: data.customerId,
            contact: data.contact, contact_id: data.contactId, amount: calcAmount,
            due_date: data.dueDate || null, payment_terms: data.paymentTerms || '',
            billing_address: data.billingAddress || '', status: data.status || 'Pending',
            owner: data.owner || currentUser.email, owner_id: data.owner_id || currentUser.id,
          }]);
          if (error) throw error;
          if (lineItems?.length) await supabase.from('invoice_line_items').insert(
            lineItems.map(i => ({ invoice_number: id, product_name: i.product, quantity: i.quantity, price: i.price, discount: i.discount || 0 }))
          );
          createdId = id; recordName = data.name;
          await logAudit({ recordType: 'invoices', recordId: id, recordName, action: 'created' });
          await fetchInvoices();
          break;
        }
        case 'contacts': {
          const id = generateId('CONT');
          const { error } = await supabase.from('contacts').insert([{
            ...sys, contact_number: id, customer: data.customer, customer_id: data.customerId,
            name: data.name, email: data.email, phone: data.phone,
            designation: data.designation, department: data.department, status: data.status || 'Active',
            owner: data.owner || currentUser.email, owner_id: data.owner_id || currentUser.id,
          }]);
          if (error) throw error;
          createdId = id; recordName = data.name;
          await fetchContacts();
          break;
        }
        case 'activities': {
          const id = generateId('ACT');
          const { error } = await supabase.from('activities').insert([{
            ...sys, activity_number: id, name: data.name, customer: data.customer, customer_id: data.customerId,
            contact: data.contact, contact_id: data.contactId, subject: data.subject,
            activity_type: data.activityType, activity_date: data.activityDate, notes: data.notes, status: data.status || 'Open',
            owner: data.owner || currentUser.email, owner_id: data.owner_id || currentUser.id,
          }]);
          if (error) throw error;
          createdId = id; recordName = data.name;
          await fetchActivities();
          break;
        }
      }

      // ── Fire all automation engines after successful create ─────────────────
      if (createdId) {
        const fullData = { ...data, id: createdId, amount: calcAmount || Number(data.amount || 0) };
        await runAutomations(page, createdId, recordName, fullData, 'on_create');
      }

      return true;
    } catch (err) {
      console.error(err);
      alert(`Failed to create record: ${err.message}`);
      return false;
    }
  };

  const updateRecord = async (page, record, lineItems) => {
    if (!supabase) return;
    const sys = buildSystemFields(true);
    const calcAmount = (lineItems || []).reduce((s, i) => s + i.quantity * i.price * (1 - (i.discount||0)/100), 0);

    const upsertLineItems = async (table, field, id) => {
      await supabase.from(table).delete().eq(field, id);
      if (lineItems?.length) {
        await supabase.from(table).insert(
          lineItems.map(i => ({ [field]: id, product_name: i.product, quantity: i.quantity, price: i.price, discount: i.discount || 0 }))
        );
      }
    };

    switch (page) {
      case 'customers':
        await supabase.from('customers').update({
          ...sys, name: record.name, email: record.email, phone: record.phone, company: record.company,
          industry: record.industry, primary_contact_id: record.primaryContactId,
          billing_address: record.billingAddress, shipping_address: record.shippingAddress,
          city: record.city, state: record.state, postal_code: record.postalCode,
          country: record.country, website: record.website, gst_number: record.gstNumber, status: record.status, owner: record.owner||'', owner_id: record.owner_id||null,
        }).eq('customer_number', record.id);
        await logAudit({ recordType: 'customers', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchCustomers(); break;
      case 'contacts':
        await supabase.from('contacts').update({
          ...sys, customer: record.customer, name: record.name, email: record.email,
          phone: record.phone, designation: record.designation,
          department: record.department, is_primary: record.isPrimary, status: record.status, owner: record.owner||'', owner_id: record.owner_id||null,
        }).eq('contact_number', record.id);
        if (record.isPrimary) await supabase.from('customers').update({ primary_contact_id: record.id }).eq('customer_number', record.customerId);
        await fetchContacts(); await fetchCustomers(); break;
      case 'products':
        await supabase.from('products').update({
          ...sys, name: record.name, category: record.category, price: Number(record.price || 0), status: record.status,
        }).eq('product_number', record.id);
        await fetchProducts(); break;
      case 'leads':
        await supabase.from('leads').update({
          ...sys, name: record.name, customer: record.customer, email: record.email, phone: record.phone,
          source: record.source, amount: calcAmount || Number(record.amount || 0), status: record.status, owner: record.owner||'', owner_id: record.owner_id||null,
        }).eq('lead_number', record.id);
        await upsertLineItems('lead_line_items', 'lead_number', record.id);
        await logAudit({ recordType: 'leads', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchLeads(); break;
      case 'opportunities':
        await supabase.from('opportunities').update({
          ...sys, name: record.name, customer: record.customer, stage: record.stage,
          amount: calcAmount || Number(record.amount || 0), close_date: record.closeDate, status: record.status, owner: record.owner||'', owner_id: record.owner_id||null,
        }).eq('opportunity_number', record.id);
        await upsertLineItems('opportunity_line_items', 'opportunity_number', record.id);
        await logAudit({ recordType: 'opportunities', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchOpportunities(); break;
      case 'orders':
        await supabase.from('orders').update({
          ...sys,
          name:             record.name,
          customer:         record.customer,
          customer_id:      record.customerId || record.customer_id || null,
          contact:          record.contact,
          contact_id:       record.contactId  || record.contact_id  || null,
          amount:           calcAmount,
          billing_address:  record.billing_address  || record.billingAddress  || '',
          shipping_address: record.shipping_address || record.shippingAddress || '',
          payment_terms:    record.payment_terms    || record.paymentTerms    || '',
          shipping_terms:   record.shipping_terms   || '',
          currency:         record.currency         || 'INR',
          overall_discount: Number(record.overall_discount || 0),
          shipping_cost:    Number(record.shipping_cost    || 0),
          subtotal:         Number(record.subtotal         || 0),
          total_discount:   Number(record.total_discount   || 0),
          total_tax:        Number(record.total_tax        || 0),
          notes:            record.notes             || '',
          delivery_date:    record.deliveryDate      || record.delivery_date || null,
          status:           record.status,
          owner:            record.owner    || '',
          owner_id:         record.owner_id || null,
        }).eq('order_number', record.id);
        await upsertLineItems('order_line_items', 'order_number', record.id);
        await logAudit({ recordType: 'orders', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchOrders(); break;
      case 'invoices':
        await supabase.from('invoices').update({
          ...sys, customer: record.customer, name: record.name, amount: calcAmount,
          due_date: record.dueDate, payment_terms: record.paymentTerms,
          billing_address: record.billingAddress, status: record.status, owner: record.owner||'', owner_id: record.owner_id||null,
        }).eq('invoice_number', record.id);
        await upsertLineItems('invoice_line_items', 'invoice_number', record.id);
        await logAudit({ recordType: 'invoices', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchInvoices(); break;
      case 'activities':
        await supabase.from('activities').update({
          ...sys, name: record.name, customer: record.customer, contact: record.contact,
          subject: record.subject, activity_type: record.activityType,
          activity_date: record.activityDate, notes: record.notes, status: record.status, owner: record.owner||'', owner_id: record.owner_id||null,
        }).eq('activity_number', record.id);
        await fetchActivities(); break;
    }

    // Fire automations after update too
    await runAutomations(page, record.id, record.name, record, 'on_update');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PIPELINE CONVERSIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const convertLeadToOpportunity = async (lead) => {
    if (!supabase) return;
    await supabase.from('leads').update({ status: 'Converted', ...buildSystemFields(true) }).eq('lead_number', lead.id);
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'Converted' } : l));
    const items = await fetchLineItems('lead_line_items', 'lead_number', lead.id);
    const amount = items.reduce((s, i) => s + i.quantity * i.price, 0);
    const id = generateId('OPP');
    await supabase.from('opportunities').insert([{
      ...buildSystemFields(), opportunity_number: id, name: lead.name,
      customer: lead.customer, customer_id: lead.customerId,
      contact: lead.contact, contact_id: lead.contactId,
      stage: 'Qualification', amount, close_date: null, status: 'Open',
    }]);
    if (items.length) await supabase.from('opportunity_line_items').insert(
      items.map(i => ({ opportunity_number: id, product_name: i.product, quantity: i.quantity, price: i.price, discount: i.discount || 0 }))
    );
    await logAudit({ recordType: 'leads', recordId: lead.id, recordName: lead.name, action: 'converted_to_opportunity' });
    await fetchOpportunities();
  };

  const createOrderFromOpportunity = async (opportunity) => {
    if (!supabase) return;
    await supabase.from('opportunities').update({ status: 'Closed Won', ...buildSystemFields(true) }).eq('opportunity_number', opportunity.id);
    setOpportunities(prev => prev.map(o => o.id === opportunity.id ? { ...o, status: 'Closed Won' } : o));
    const items = await fetchLineItems('opportunity_line_items', 'opportunity_number', opportunity.id);
    const amount = items.reduce((s, i) => s + i.quantity * i.price, 0);
    const id = generateId('ORD');
    await supabase.from('orders').insert([{
      ...buildSystemFields(), order_number: id, name: opportunity.name,
      customer: opportunity.customer, customer_id: opportunity.customerId,
      contact: opportunity.contact, contact_id: opportunity.contactId,
      amount, shipping_address: '', delivery_date: null, status: 'Processing',
    }]);
    if (items.length) await supabase.from('order_line_items').insert(
      items.map(i => ({ order_number: id, product_name: i.product, quantity: i.quantity, price: i.price, discount: i.discount || 0 }))
    );
    await logAudit({ recordType: 'opportunities', recordId: opportunity.id, recordName: opportunity.name, action: 'converted_to_order' });
    await fetchOrders();
  };

  const createOrderFromQuotation = async (quotation) => {
    if (!supabase || !currentUser) return null;

    // Load quotation line items from Supabase (fresh, not from state)
    const { data: qItems, error: qErr } = await supabase
      .from('quotation_line_items')
      .select('*')
      .eq('quote_number', quotation.quote_number)
      .order('sort_order');

    if (qErr) { alert('Failed to load quotation line items: ' + qErr.message); return null; }

    // Calculate totals from line items
    const lineItems   = qItems || [];
    const subtotal    = lineItems.reduce((s, i) => s + Number(i.quantity||1) * Number(i.unit_price||0), 0);
    const totalDisc   = lineItems.reduce((s, i) => s + Number(i.quantity||1) * Number(i.unit_price||0) * Number(i.discount_pct||0) / 100, 0);
    const totalTax    = lineItems.reduce((s, i) => {
      const net = Number(i.quantity||1) * Number(i.unit_price||0) * (1 - Number(i.discount_pct||0)/100);
      return s + net * Number(i.tax_pct||0) / 100;
    }, 0);
    const overallDisc = subtotal * Number(quotation.overall_discount||0) / 100;
    const shipping    = Number(quotation.shipping_cost||0);
    const grandTotal  = subtotal - totalDisc + totalTax - overallDisc + shipping;

    const orderId = generateId('ORD');

    const { error: ordErr } = await supabase.from('orders').insert([{
      order_number:        orderId,
      name:                `${quotation.name || quotation.quote_number}`,
      quote_number:        quotation.quote_number,
      quote_id:            quotation.id,
      customer:            quotation.customer            || '',
      customer_id:         quotation.customer_id         || null,
      contact:             quotation.contact             || '',
      contact_id:          quotation.contact_id          || null,
      billing_address:     quotation.billing_address     || '',
      shipping_address:    quotation.shipping_address    || '',
      payment_terms:       quotation.payment_terms       || '',
      shipping_terms:      quotation.shipping_terms      || '',
      currency:            quotation.currency            || 'INR',
      subtotal:            Number(subtotal.toFixed(2)),
      total_discount:      Number((totalDisc + overallDisc).toFixed(2)),
      total_tax:           Number(totalTax.toFixed(2)),
      shipping_cost:       shipping,
      overall_discount:    Number(quotation.overall_discount||0),
      amount:              Number(grandTotal.toFixed(2)),
      notes:               quotation.notes               || '',
      status:              'Draft',
      delivery_date:       null,
      owner:               quotation.owner               || currentUser.email,
      owner_id:            quotation.owner_id            || currentUser.id,
      organization_id:     quotation.organization_id     || currentUser.organization_id,
      business_unit_id:    quotation.business_unit_id    || currentUser.business_unit_id,
      created_by:          currentUser.email,
      updated_by:          currentUser.email,
      created_at:          new Date().toISOString(),
      updated_at:          new Date().toISOString(),
    }]);

    if (ordErr) { alert('Failed to create order: ' + ordErr.message); return null; }

    // Copy all line items from quotation → order
    if (lineItems.length) {
      const { error: liErr } = await supabase.from('order_line_items').insert(
        lineItems.map((i, idx) => ({
          order_number:  orderId,
          product_name:  i.product_name  || '',
          product_code:  i.product_code  || '',
          description:   i.description   || '',
          quantity:      Number(i.quantity     || 1),
          price:         Number(i.unit_price   || 0),
          list_price:    Number(i.list_price   || 0),
          discount:      Number(i.discount_pct || 0),
          tax_pct:       Number(i.tax_pct      || 0),
          extended_price: Number(i.extended_price || 0),
          sort_order:    idx,
        }))
      );
      if (liErr) console.error('Line items copy error:', liErr.message);
    }

    // Mark quotation as Ordered (order has been created from this quote)
    await supabase.from('quotations').update({
      status:     'Ordered',
      updated_by: currentUser.email,
      updated_at: new Date().toISOString(),
    }).eq('quote_number', quotation.quote_number);

    await logAudit({
      recordType: 'quotations',
      recordId:   quotation.quote_number,
      recordName: quotation.name,
      action:     'converted_to_order',
    });

    // Notify owner
    if (quotation.owner) {
      await createNotification({
        recipientEmail: quotation.owner,
        type:    'conversion',
        title:   'Order Created from Quotation',
        body:    `"${quotation.name}" (${quotation.quote_number}) converted to Order ${orderId}.`,
        recordType: 'orders',
        recordId:   orderId,
      });
    }

    await Promise.all([fetchOrders(), fetchQuotations()]);
    return orderId;
  };

  const createInvoiceFromOrder = async (order) => {
    if (!supabase || !currentUser) return;

    // Load order line items fresh from DB
    const { data: ordItems } = await supabase
      .from('order_line_items').select('*')
      .eq('order_number', order.id).order('sort_order');

    const lineItems    = ordItems || [];
    const subtotal     = lineItems.reduce((s,i) => s + Number(i.quantity||1)*Number(i.price||0), 0);
    const totalDisc    = lineItems.reduce((s,i) => s + Number(i.quantity||1)*Number(i.price||0)*(Number(i.discount||0)/100), 0);
    const totalTax     = lineItems.reduce((s,i) => {
      const net = Number(i.quantity||1)*Number(i.price||0)*(1-Number(i.discount||0)/100);
      return s + net*(Number(i.tax_pct||0)/100);
    }, 0);
    const overallDisc  = subtotal * Number(order.overall_discount||0) / 100;
    const shipping     = Number(order.shipping_cost||0);
    const grandTotal   = subtotal - totalDisc + totalTax - overallDisc + shipping;

    const id = generateId('INV');
    // Due date = 30 days from today by default
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);

    const { error } = await supabase.from('invoices').insert([{
      ...buildSystemFields(),
      invoice_number:   id,
      name:             order.name,
      order_number:     order.id,
      customer:         order.customer         || '',
      customer_id:      order.customer_id      || order.customerId || null,
      contact:          order.contact          || '',
      contact_id:       order.contact_id       || order.contactId  || null,
      billing_address:  order.billing_address  || '',
      shipping_address: order.shipping_address || '',
      payment_terms:    order.payment_terms    || '',
      currency:         order.currency         || 'INR',
      overall_discount: Number(order.overall_discount || 0),
      shipping_cost:    shipping,
      subtotal:         Number(subtotal.toFixed(2)),
      total_discount:   Number((totalDisc + overallDisc).toFixed(2)),
      total_tax:        Number(totalTax.toFixed(2)),
      amount:           Number(grandTotal.toFixed(2)),
      notes:            order.notes            || '',
      status:           'Pending',
      due_date:         dueDate.toISOString().split('T')[0],
      owner:            order.owner            || currentUser.email,
      owner_id:         order.owner_id         || currentUser.id,
      organization_id:  order.organization_id  || currentUser.organization_id,
      business_unit_id: order.business_unit_id || currentUser.business_unit_id,
    }]);
    if (error) { alert('Failed to create invoice: ' + error.message); return; }

    // Copy all line items from order → invoice
    if (lineItems.length) {
      await supabase.from('invoice_line_items').insert(
        lineItems.map((i, sortIdx) => ({
          invoice_number: id,
          product_name:   i.product_name  || '',
          product_code:   i.product_code  || '',
          description:    i.description   || '',
          quantity:       Number(i.quantity    || 1),
          price:          Number(i.price       || 0),
          list_price:     Number(i.list_price  || 0),
          discount:       Number(i.discount    || 0),
          tax_pct:        Number(i.tax_pct     || 0),
          extended_price: Number(i.extended_price || 0),
          sort_order:     sortIdx,
        }))
      );
    }

    // Mark order as Invoiced
    await supabase.from('orders')
      .update({ status:'Invoiced', ...buildSystemFields(true) })
      .eq('order_number', order.id);
    setOrders(prev => prev.map(o => o.id === order.id ? {...o, status:'Invoiced'} : o));

    await logAudit({ recordType:'orders', recordId:order.id, recordName:order.name, action:'invoiced' });
    await fetchInvoices();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // QUOTE TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════

  const saveQuoteTemplate = async (data, editingId) => {
    if (!supabase) return;
    const payload = {
      name: data.name, company_name: data.companyName, company_email: data.companyEmail,
      company_phone: data.companyPhone, company_address: data.companyAddress,
      quote_title: data.quoteTitle, footer_text: data.footerText,
      terms_and_conditions: data.termsAndConditions,
      primary_color: data.primaryColor, secondary_color: data.secondaryColor,
    };
    if (editingId) {
      await supabase.from('quote_templates').update(payload).eq('template_number', editingId);
    } else {
      const { error } = await supabase.from('quote_templates').insert([{ ...payload, template_number: generateId('TEMP'), is_default: false }]);
      if (error) { alert(error.message); return; }
    }
    await fetchQuoteTemplates();
  };

  const deleteQuoteTemplate = async (templateId) => {
    if (!supabase || !window.confirm('Delete this template?')) return;
    await supabase.from('quote_templates').delete().eq('template_number', templateId);
    await fetchQuoteTemplates();
  };

  const setDefaultTemplate = async (templateId) => {
    if (!supabase) return;
    await supabase.from('quote_templates').update({ is_default: false }).neq('id', '');
    await supabase.from('quote_templates').update({ is_default: true }).eq('template_number', templateId);
    await fetchQuoteTemplates();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKFLOW CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  const saveWorkflowRule = async (data, actions, editingId) => {
    if (!supabase || !currentUser) return;
    let ruleId = editingId || '';
    if (editingId) {
      const { error } = await supabase.from('workflow_rules').update({ ...data, updated_by: currentUser.email, updated_at: new Date().toISOString() }).eq('id', editingId);
      if (error) { alert('Failed to update: ' + error.message); return; }
    } else {
      const { data: rule, error } = await supabase.from('workflow_rules').insert([{
        ...data, ...buildSystemFields(), rule_number: generateId('WF'),
      }]).select().single();
      if (error || !rule) { alert('Workflow save failed: ' + (error?.message || 'Unknown error')); return; }
      ruleId = rule.id;
    }
    await supabase.from('workflow_actions').delete().eq('workflow_rule_id', ruleId);
    if (actions?.length) {
      await supabase.from('workflow_actions').insert(
        actions.map((a, i) => ({ workflow_rule_id: ruleId, action_type: a.action_type, action_config: a.action_config, execution_order: i + 1 }))
      );
    }
    await fetchWorkflowRules();
  };

  const deleteWorkflowRule = async (id) => {
    if (!supabase || !window.confirm('Delete this workflow rule?')) return;
    await supabase.from('workflow_rules').delete().eq('id', id);
    await fetchWorkflowRules();
  };

  const saveAssignmentRule = async (data, editingId) => {
    if (!supabase || !currentUser) return;
    if (editingId) {
      const { error } = await supabase.from('assignment_rules').update({ ...data, updated_by: currentUser.email, updated_at: new Date().toISOString() }).eq('id', editingId);
      if (error) { alert('Failed: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('assignment_rules').insert([{ ...data, ...buildSystemFields(), rule_number: generateId('AR') }]);
      if (error) { alert('Failed: ' + error.message); return; }
    }
    await fetchAssignmentRules();
  };

  const deleteAssignmentRule = async (id) => {
    if (!supabase || !window.confirm('Delete this rule?')) return;
    await supabase.from('assignment_rules').delete().eq('id', id);
    await fetchAssignmentRules();
  };

  const saveSLAPolicy = async (data, editingId) => {
    if (!supabase || !currentUser) return;
    if (editingId) {
      const { error } = await supabase.from('sla_policies').update({ ...data, updated_by: currentUser.email, updated_at: new Date().toISOString() }).eq('id', editingId);
      if (error) { alert('Failed: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('sla_policies').insert([{ ...data, ...buildSystemFields(), policy_number: generateId('SLA') }]);
      if (error) { alert('Failed: ' + error.message); return; }
    }
    await fetchSLAPolicies();
  };

  const deleteSLAPolicy = async (id) => {
    if (!supabase || !window.confirm('Delete this SLA policy?')) return;
    await supabase.from('sla_policies').delete().eq('id', id);
    await fetchSLAPolicies();
  };

  const saveApprovalProcess = async (data, steps, editingId) => {
    if (!supabase || !currentUser) return;
    let processId = editingId || '';
    if (editingId) {
      const { error } = await supabase.from('approval_processes').update({ ...data, updated_by: currentUser.email, updated_at: new Date().toISOString() }).eq('id', editingId);
      if (error) { alert('Failed: ' + error.message); return; }
    } else {
      const { data: proc, error } = await supabase.from('approval_processes').insert([{
        ...data, ...buildSystemFields(), process_number: generateId('AP'),
      }]).select().single();
      if (error || !proc) { alert('Failed: ' + (error?.message || 'Unknown error')); return; }
      processId = proc.id;
    }
    await supabase.from('approval_steps').delete().eq('approval_process_id', processId);
    if (steps?.length) {
      const { error } = await supabase.from('approval_steps').insert(
        steps.map((s, i) => ({ ...s, approval_process_id: processId, step_number: i + 1 }))
      );
      if (error) { alert('Failed to save steps: ' + error.message); return; }
    }
    await fetchApprovalProcesses();
  };

  const deleteApprovalProcess = async (id) => {
    if (!supabase || !window.confirm('Delete this approval process?')) return;
    await supabase.from('approval_processes').delete().eq('id', id);
    await fetchApprovalProcesses();
  };

  // Manual submit for approval (from record detail panel)
  const submitForApproval = async (recordType, recordId, recordName, recordData) => {
    if (!supabase || !currentUser) return;
    // Find first matching active process
    const process = await checkMatchingApprovalProcess(recordType, recordData || {});
    if (!process) { alert('No active approval process found that matches this record\'s conditions.'); return; }
    const { data: steps } = await supabase.from('approval_steps').select('*').eq('approval_process_id', process.id).order('step_number');
    if (!steps?.length) { alert('No approval steps configured.'); return; }
    const firstStep = steps[0];
    const { error } = await supabase.from('approval_requests').insert([{
      request_number: generateId('REQ'), approval_process_id: process.id,
      current_step_id: firstStep.id, record_type: recordType, record_id: recordId,
      record_name: recordName, submitted_by: currentUser.email,
      submitted_at: new Date().toISOString(), status: 'Pending',
      organization_id: currentUser.organization_id, business_unit_id: currentUser.business_unit_id,
    }]);
    if (error) { alert(error.message); return; }
    await updateCRMField(recordType, recordId, { status: 'Pending Approval' });
    const approver = enterpriseUsers.find(u => u.id === firstStep.approver_user_id);
    if (approver) {
      await createNotification({
        recipientEmail: approver.email, type: 'approval',
        title: `Approval Required: ${recordName}`,
        body: `${recordName} has been submitted for your approval.`,
        recordType, recordId,
      });
    }
    await logAudit({ recordType, recordId, recordName, action: 'submitted_for_approval' });
    await fetchApprovalRequests();
    alert('Submitted for approval successfully.');
  };

  // Approve or reject a pending request
  const processApproval = async (requestId, decision, comments) => {
    if (!supabase || !currentUser) { alert('Not authenticated.'); return; }

    // Fetch fresh from DB — never rely on state for critical operations
    const { data: request, error: reqErr } = await supabase.from('approval_requests').select('*').eq('id', requestId).single();
    if (reqErr || !request) { alert('Approval request not found: ' + (reqErr?.message || 'unknown')); return; }

    // Get the step to find what status to set
    const { data: stepData } = await supabase.from('approval_steps').select('*').eq('id', request.current_step_id).single();
    const newStatus = decision === 'Approved'
      ? (stepData?.on_approve_action || 'Approved')
      : (stepData?.on_reject_action  || 'Rejected');

    await supabase.from('approval_decisions').insert([{
      approval_request_id: requestId, step_id: request.current_step_id,
      decided_by: currentUser.email, decision, comments, decided_at: new Date().toISOString(),
    }]);
    await supabase.from('approval_requests').update({ status: decision, comments }).eq('id', requestId);

    // Update the actual CRM record status
    await updateCRMField(request.record_type, request.record_id, { status: newStatus });

    await logAudit({
      recordType: request.record_type, recordId: request.record_id,
      recordName: request.record_name, action: `approval_${decision.toLowerCase()}`,
      fieldChanged: 'status', newValue: newStatus,
    });

    // Notify submitter
    const submitter = enterpriseUsers.find(u => u.email === request.submitted_by);
    if (submitter) {
      await createNotification({
        recipientEmail: submitter.email, type: 'approval',
        title: `Record ${decision}: ${request.record_name}`,
        body: `${request.record_name} has been ${decision.toLowerCase()} by ${currentUser.email}. Status set to "${newStatus}".${comments ? ' Comment: ' + comments : ''}`,
        recordType: request.record_type, recordId: request.record_id,
      });
    }
    await fetchApprovalRequests();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // APP PREFERENCES
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchAppPreferences = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('app_preferences').select('*').limit(1).single();
    if (data) setAppPreferences(data);
  };

  const saveAppPreferences = async (prefs) => {
    if (!supabase || !currentUser) return;
    const { data: existing } = await supabase.from('app_preferences').select('id').limit(1).single();
    if (existing?.id) {
      await supabase.from('app_preferences').update({ ...prefs, updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('app_preferences').insert([{ ...prefs, organization_id: currentUser.organization_id }]);
    }
    await fetchAppPreferences();
    // Refresh exchange rates if currency changed
    if (prefs.default_currency) await fetchExchangeRates(prefs.default_currency);
  };

  const fetchExchangeRates = async (baseCurrency = 'INR') => {
    try {
      const res  = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
      const data = await res.json();
      if (data?.rates) setExchangeRates(data.rates);
    } catch (e) {
      console.warn('Exchange rate fetch failed:', e.message);
    }
  };

  const convertCurrency = (amount, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency || !exchangeRates[toCurrency]) return amount;
    // Convert via base currency
    const base  = appPreferences.default_currency || 'INR';
    const toBase = fromCurrency === base ? 1 : (1 / (exchangeRates[fromCurrency] || 1));
    const fromBase = exchangeRates[toCurrency] || 1;
    return amount * toBase * fromBase;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // QUOTATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchQuotations = async () => {
    if (!supabase) return;
    const { data } = await withOrgFilter(supabase.from('quotations').select('*')).order('created_at', { ascending: false });
    if (data) setQuotations(data.map(q => ({
      ...q,
      // Aliases for Customer360 customer matching
      customerId: q.customer_id || '',
    })));
  };

  const createQuotation = async (data, lineItems) => {
    if (!supabase || !currentUser) return null;
    const qNum = generateId('QUO');
    const { data: quote, error } = await supabase.from('quotations').insert([{
      quote_number:     qNum,
      name:             data.name,
      opportunity_id:   data.opportunity_id   || null,
      customer:         data.customer         || '',
      customer_id:      data.customer_id      || null,
      contact:          data.contact          || '',
      contact_id:       data.contact_id       || null,
      status:           data.status           || 'Draft',
      validity_date:    data.validity_date    || null,
      payment_terms:    data.payment_terms    || '',
      shipping_terms:   data.shipping_terms   || '',
      billing_address:  data.billing_address  || '',
      shipping_address: data.shipping_address || '',
      notes:            data.notes            || '',
      internal_notes:   data.internal_notes   || '',
      overall_discount: Number(data.overall_discount || 0),
      shipping_cost:    Number(data.shipping_cost    || 0),
      tax_rate:         Number(data.tax_rate         || 0),
      subtotal:         0, total_discount: 0, total_tax: 0, grand_total: 0,
      version:          data.version || 1,
      parent_quote_id:  data.parent_quote_id  || null,
      template_id:      data.template_id      || null,
      currency:         data.currency         || 'INR',
      ...buildSystemFields(),
    }]).select().single();
    if (error) { alert('Failed to create quotation: ' + error.message); return null; }
    if (lineItems?.length) {
      await supabase.from('quotation_line_items').insert(
        lineItems.map((i, idx) => ({
          quote_number:  qNum,
          product_name:  i.product_name  || '',
          product_code:  i.product_code  || '',
          description:   i.description   || '',
          quantity:      Number(i.quantity      || 1),
          unit_price:    Number(i.unit_price    || 0),
          list_price:    Number(i.list_price    || 0),
          discount_pct:  Number(i.discount_pct  || 0),
          tax_pct:       Number(i.tax_pct       || 0),
          extended_price:Number(i.extended_price || 0),
          sort_order:    idx,
        }))
      );
    }
    await fetchQuotations();
    return quote;
  };

  const updateQuotation = async (data, lineItems) => {
    if (!supabase || !currentUser) return;
    const { error } = await supabase.from('quotations').update({
      name:             data.name,
      customer:         data.customer         || '',
      customer_id:      data.customer_id      || null,
      contact:          data.contact          || '',
      contact_id:       data.contact_id       || null,
      status:           data.status,
      validity_date:    data.validity_date    || null,
      payment_terms:    data.payment_terms    || '',
      shipping_terms:   data.shipping_terms   || '',
      billing_address:  data.billing_address  || '',
      shipping_address: data.shipping_address || '',
      notes:            data.notes            || '',
      internal_notes:   data.internal_notes   || '',
      overall_discount: Number(data.overall_discount || 0),
      shipping_cost:    Number(data.shipping_cost    || 0),
      subtotal:         Number(data.subtotal         || 0),
      total_discount:   Number(data.total_discount   || 0),
      total_tax:        Number(data.total_tax        || 0),
      grand_total:      Number(data.grand_total      || 0),
      template_id:      data.template_id || null,
      currency:         data.currency    || 'INR',
      updated_by:       currentUser.email,
      updated_at:       new Date().toISOString(),
    }).eq('id', data.id);
    if (error) { alert('Update failed: ' + error.message); return; }
    // Upsert line items
    await supabase.from('quotation_line_items').delete().eq('quote_number', data.quote_number);
    if (lineItems?.length) {
      await supabase.from('quotation_line_items').insert(
        lineItems.map((i, idx) => ({
          quote_number:  data.quote_number,
          product_name:  i.product_name  || '',
          product_code:  i.product_code  || '',
          description:   i.description   || '',
          quantity:      Number(i.quantity      || 1),
          unit_price:    Number(i.unit_price    || 0),
          list_price:    Number(i.list_price    || 0),
          discount_pct:  Number(i.discount_pct  || 0),
          tax_pct:       Number(i.tax_pct       || 0),
          extended_price:Number(i.extended_price || 0),
          sort_order:    idx,
        }))
      );
    }
    await fetchQuotations();
  };

  const deleteQuotation = async (id) => {
    if (!supabase || !window.confirm('Delete this quotation?')) return;
    const q = quotations.find(x => x.id === id);
    if (q) await supabase.from('quotation_line_items').delete().eq('quote_number', q.quote_number);
    await supabase.from('quotations').delete().eq('id', id);
    await fetchQuotations();
  };

  const createQuotationFromOpportunity = async (opportunity) => {
    if (!supabase || !currentUser) return null;
    // Load opportunity line items
    const { data: oppItems } = await supabase.from('opportunity_line_items').select('*').eq('opportunity_number', opportunity.id);
    const lineItems = (oppItems || []).map(i => ({
      product_name:  i.product_name || '',
      product_code:  '',
      description:   '',
      quantity:      Number(i.quantity || 1),
      unit_price:    Number(i.price   || 0),
      list_price:    Number(i.price   || 0),
      discount_pct:  Number(i.discount || 0),
      tax_pct:       18,
      extended_price: Number(i.quantity||1) * Number(i.price||0) * (1 - Number(i.discount||0)/100),
    }));
    const quote = await createQuotation({
      name:           `Quote for ${opportunity.name}`,
      opportunity_id: opportunity.id,
      customer:       opportunity.customer,
      customer_id:    opportunity.customerId,
      contact:        opportunity.contact,
      contact_id:     opportunity.contactId,
      status:         'Draft',
      currency:       'INR',
      version:        1,
      overall_discount: 0,
      shipping_cost:  0,
    }, lineItems);
    return quote;
  };

  const generateNewVersion = async (quote) => {
    if (!supabase || !currentUser) return null;
    const { data: items } = await supabase.from('quotation_line_items').select('*').eq('quote_number', quote.quote_number);
    const newQ = await createQuotation({
      ...quote,
      id: undefined,
      quote_number: undefined,
      version: (quote.version || 1) + 1,
      parent_quote_id: quote.id,
      status: 'Draft',
    }, (items||[]).map(i => ({ product_name:i.product_name, product_code:i.product_code, description:i.description, quantity:i.quantity, unit_price:i.unit_price, list_price:i.list_price, discount_pct:i.discount_pct, tax_pct:i.tax_pct, extended_price:i.extended_price })));
    return newQ;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVED SEARCHES
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchSavedSearches = async (objectType) => {
    if (!supabase || !currentUser) return;
    const { data } = await supabase.from('saved_searches').select('*')
      .eq('object_type', objectType)
      .order('created_at', { ascending: false });
    if (data) setSavedSearches(data);
  };

  const createSavedSearch = async (name, objectType, filters, isDefault, isGlobalDefault) => {
    if (!supabase || !currentUser) return;
    if (!name?.trim()) { alert('Search name is required.'); return; }
    // Unset other personal defaults for this object/user
    if (isDefault) {
      await supabase.from('saved_searches').update({ is_default: false })
        .eq('object_type', objectType).eq('created_by', currentUser.email);
    }
    // Unset other global defaults (admin action)
    if (isGlobalDefault) {
      await supabase.from('saved_searches').update({ is_global_default: false })
        .eq('object_type', objectType);
    }
    const { error } = await supabase.from('saved_searches').insert([{
      search_number:    generateId('SS'),
      name,
      object_type:      objectType,
      filters:          filters,
      is_default:       isDefault      || false,
      is_global_default: isGlobalDefault || false,
      created_by:       currentUser.email,
      organization_id:  currentUser.organization_id,
      business_unit_id: currentUser.business_unit_id,
      created_at:       new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    }]);
    if (error) { alert('Failed to save search: ' + error.message); return; }
    await fetchSavedSearches(objectType);
  };

  const updateSavedSearch = async (id, name, objectType, filters) => {
    if (!supabase || !currentUser) return;
    const { error } = await supabase.from('saved_searches')
      .update({ name, filters, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { alert('Failed to update: ' + error.message); return; }
    await fetchSavedSearches(objectType);
  };

  const deleteSavedSearch = async (id, objectType) => {
    if (!supabase || !window.confirm('Delete this saved search?')) return;
    await supabase.from('saved_searches').delete().eq('id', id);
    await fetchSavedSearches(objectType);
  };

  const setDefaultSavedSearch = async (id, objectType, isGlobal) => {
    if (!supabase || !currentUser) return;
    if (isGlobal) {
      await supabase.from('saved_searches').update({ is_global_default: false }).eq('object_type', objectType);
      await supabase.from('saved_searches').update({ is_global_default: true }).eq('id', id);
    } else {
      await supabase.from('saved_searches').update({ is_default: false })
        .eq('object_type', objectType).eq('created_by', currentUser.email);
      await supabase.from('saved_searches').update({ is_default: true }).eq('id', id);
    }
    await fetchSavedSearches(objectType);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  // Effect 1: Auth — fetch current user and permissions when session changes
  useEffect(() => {
    if (!session?.user?.email) return;
    const email = session.user.email;
    fetchCurrentUser(email);
    loadCurrentUserPermissions(email);
    // Fetch admin/config data that doesn't need org/BU filtering
    fetchOrganizations(); fetchBusinessUnits();
    fetchEnterpriseUsers(); fetchUserGroups(); fetchRoles(); fetchPermissions();
    fetchWorkflowRules(); fetchAssignmentRules(); fetchSLAPolicies();
    fetchApprovalProcesses(); fetchApprovalRequests();
    fetchQuoteTemplates();
  }, [session?.user?.email]);

  // Effect 2: CRM data — runs AFTER currentUser is set so org/BU filters apply correctly
  useEffect(() => {
    if (!currentUser) return;
    fetchCustomers(); fetchProducts(); fetchLeads(); fetchOpportunities();
    fetchOrders(); fetchInvoices(); fetchContacts(); fetchActivities();
    fetchQuotations();
  }, [currentUser?.id]);

  // Re-fetch all CRM data when currentUser loads (ensures org/BU data isolation)
  useEffect(() => {
    if (!currentUser?.id) return;
    Promise.all([
      fetchCustomers(), fetchLeads(), fetchOpportunities(), fetchOrders(),
      fetchInvoices(), fetchContacts(), fetchActivities(), fetchQuotations(),
    ]);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.email) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.email]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Permission helper ──────────────────────────────────────────────────────
  // Returns true if user has the permission (or if no permissions are loaded/configured)
  const hasPermission = (permCode) => {
    if (!permissionsLoaded) return true; // Allow while loading
    if (!permCode) return true;          // No permission required
    if (currentUserPermissions.length === 0) return true; // No role restrictions configured
    return currentUserPermissions.includes(permCode);
  };

  const value = {
    session, authLoading, currentUser, currentUserPermissions, permissionsLoaded,
    handleLogin, handleLogout, resetMyPassword, saveMyProfile, loadCurrentUserPermissions, hasPermission,
    customers, contacts, products, leads, opportunities, orders, invoices, activities,
    organizations, businessUnits, enterpriseUsers, userGroups, userGroupMembers,
    roles, permissions, rolePermissions, quoteTemplates,
    workflowRules, assignmentRules, slaPolicies, approvalProcesses, approvalRequests,
    notifications,
    unreadCount: notifications.filter(n => !n.is_read).length,
    markNotificationRead, markAllNotificationsRead,
    fetchCustomers, fetchContacts, fetchProducts, fetchLeads, fetchOpportunities,
    fetchOrders, fetchInvoices, fetchActivities, fetchOrganizations, fetchBusinessUnits,
    fetchEnterpriseUsers, fetchUserGroups, fetchGroupMembers, fetchRoles, fetchPermissions,
    fetchRolePermissions, fetchQuoteTemplates, fetchWorkflowRules, fetchAssignmentRules,
    fetchSLAPolicies, fetchApprovalProcesses, fetchApprovalRequests, fetchNotifications,
    fetchLineItems,
    buildSystemFields, applyDataSecurity,
    saveOrganization, saveBusinessUnit, saveEnterpriseUser, saveUserGroup, saveRole,
    addUsersToGroup, removeUserFromGroup, deleteAdminRecord, updateAdminStatus,
    adminResetPassword,
    createRecord, updateRecord,
    convertLeadToOpportunity, createOrderFromOpportunity, createOrderFromQuotation, createInvoiceFromOrder,
    saveQuoteTemplate, deleteQuoteTemplate, setDefaultTemplate,
    saveWorkflowRule, deleteWorkflowRule, saveAssignmentRule, deleteAssignmentRule,
    saveSLAPolicy, deleteSLAPolicy, saveApprovalProcess, deleteApprovalProcess,
    submitForApproval, processApproval, checkMatchingApprovalProcess,
    logAudit, createNotification,

    // app preferences
    appPreferences, saveAppPreferences, fetchAppPreferences,
    exchangeRates, fetchExchangeRates, convertCurrency,

    // quotations
    quotations, fetchQuotations, createQuotation, updateQuotation, deleteQuotation,
    createQuotationFromOpportunity, generateNewVersion,

    // saved searches
    savedSearches, fetchSavedSearches, createSavedSearch, updateSavedSearch,
    deleteSavedSearch, setDefaultSavedSearch,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
