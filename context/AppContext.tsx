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
  const [notifications, setNotifications] = useState([]);

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
    return records.filter(r => {
      const orgOk = !r.organization_id  || r.organization_id  === currentUser.organization_id;
      const buOk  = !r.business_unit_id || r.business_unit_id === currentUser.business_unit_id;
      return orgOk && buOk;
    });
  }, [currentUser]);

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
    if (!ud?.role_id) { setCurrentUserPermissions([]); setPermissionsLoaded(true); return; }
    const { data: rpData } = await supabase.from('role_permissions').select('permission_id').eq('role_id', ud.role_id);
    const ids = (rpData || []).map(x => x.permission_id);
    if (!ids.length) { setCurrentUserPermissions([]); setPermissionsLoaded(true); return; }
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
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (data) setCustomers(applyDataSecurity(data.map(c => ({
      id: c.customer_number, primaryContactId: c.primary_contact_id, primaryContact: '',
      name: c.name, email: c.email, phone: c.phone, company: c.company, industry: c.industry,
      billingAddress: c.billing_address, shippingAddress: c.shipping_address,
      city: c.city, state: c.state, postalCode: c.postal_code, country: c.country,
      website: c.website, gstNumber: c.gst_number, status: c.status,
      created_by: c.created_by, created_at: c.created_at, updated_by: c.updated_by, updated_at: c.updated_at,
      organization_id: c.organization_id, business_unit_id: c.business_unit_id,
    }))));
  };

  const fetchContacts = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
    if (data) setContacts(data.map(c => ({
      id: c.contact_number, customerId: c.customer_id, customer: c.customer,
      name: c.name, email: c.email, phone: c.phone, designation: c.designation,
      department: c.department, isPrimary: c.is_primary || false, status: c.status,
      created_by: c.created_by, created_at: c.created_at, updated_by: c.updated_by, updated_at: c.updated_at,
      organization_id: c.organization_id, business_unit_id: c.business_unit_id,
    })));
  };

  const fetchProducts = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (data) setProducts(data.map(p => ({
      id: p.product_number, name: p.name, category: p.category,
      price: Number(p.price || 0), status: p.status,
      created_by: p.created_by, created_at: p.created_at, updated_by: p.updated_by, updated_at: p.updated_at,
      organization_id: p.organization_id, business_unit_id: p.business_unit_id,
    })));
  };

  const fetchLeads = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (data) setLeads(data.map(l => ({
      id: l.lead_number, name: l.name, customer: l.customer, customerId: l.customer_id,
      contact: l.contact, contactId: l.contact_id, email: l.email, phone: l.phone,
      source: l.source, amount: Number(l.amount || 0), status: l.status,
      created_by: l.created_by, created_at: l.created_at, updated_by: l.updated_by, updated_at: l.updated_at,
      organization_id: l.organization_id, business_unit_id: l.business_unit_id,
    })));
  };

  const fetchOpportunities = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('opportunities').select('*').order('created_at', { ascending: false });
    if (data) setOpportunities(data.map(o => ({
      id: o.opportunity_number, name: o.name, customer: o.customer, customerId: o.customer_id,
      contact: o.contact, contactId: o.contact_id, stage: o.stage,
      amount: Number(o.amount || 0), closeDate: o.close_date, status: o.status,
      created_by: o.created_by, created_at: o.created_at, updated_by: o.updated_by, updated_at: o.updated_at,
      organization_id: o.organization_id, business_unit_id: o.business_unit_id,
    })));
  };

  const fetchOrders = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data.map(o => ({
      id: o.order_number, name: o.name, customer: o.customer, customerId: o.customer_id,
      contact: o.contact, contactId: o.contact_id, amount: Number(o.amount || 0),
      shippingAddress: o.shipping_address, deliveryDate: o.delivery_date, status: o.status,
      created_by: o.created_by, created_at: o.created_at, updated_by: o.updated_by, updated_at: o.updated_at,
      organization_id: o.organization_id, business_unit_id: o.business_unit_id,
    })));
  };

  const fetchInvoices = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
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
    const { data } = await supabase.from('activities').select('*').order('created_at', { ascending: false });
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
        checkAndAutoApprove(objectType, recordId, recordName, recordData),
      ]);
    } catch (e) { console.error('Automation error:', e); }
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
            price: Number(data.price || 0), status: data.status || 'Active',
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
          country: record.country, website: record.website, gst_number: record.gstNumber, status: record.status,
        }).eq('customer_number', record.id);
        await logAudit({ recordType: 'customers', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchCustomers(); break;
      case 'contacts':
        await supabase.from('contacts').update({
          ...sys, customer: record.customer, name: record.name, email: record.email,
          phone: record.phone, designation: record.designation,
          department: record.department, is_primary: record.isPrimary, status: record.status,
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
          source: record.source, amount: calcAmount || Number(record.amount || 0), status: record.status,
        }).eq('lead_number', record.id);
        await upsertLineItems('lead_line_items', 'lead_number', record.id);
        await logAudit({ recordType: 'leads', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchLeads(); break;
      case 'opportunities':
        await supabase.from('opportunities').update({
          ...sys, name: record.name, customer: record.customer, stage: record.stage,
          amount: calcAmount || Number(record.amount || 0), close_date: record.closeDate, status: record.status,
        }).eq('opportunity_number', record.id);
        await upsertLineItems('opportunity_line_items', 'opportunity_number', record.id);
        await logAudit({ recordType: 'opportunities', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchOpportunities(); break;
      case 'orders':
        await supabase.from('orders').update({
          ...sys, customer: record.customer, name: record.name, amount: calcAmount,
          shipping_address: record.shippingAddress, delivery_date: record.deliveryDate, status: record.status,
        }).eq('order_number', record.id);
        await upsertLineItems('order_line_items', 'order_number', record.id);
        await logAudit({ recordType: 'orders', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchOrders(); break;
      case 'invoices':
        await supabase.from('invoices').update({
          ...sys, customer: record.customer, name: record.name, amount: calcAmount,
          due_date: record.dueDate, payment_terms: record.paymentTerms,
          billing_address: record.billingAddress, status: record.status,
        }).eq('invoice_number', record.id);
        await upsertLineItems('invoice_line_items', 'invoice_number', record.id);
        await logAudit({ recordType: 'invoices', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchInvoices(); break;
      case 'activities':
        await supabase.from('activities').update({
          ...sys, name: record.name, customer: record.customer, contact: record.contact,
          subject: record.subject, activity_type: record.activityType,
          activity_date: record.activityDate, notes: record.notes, status: record.status,
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

  const createInvoiceFromOrder = async (order) => {
    if (!supabase) return;
    await supabase.from('orders').update({ status: 'Delivered', ...buildSystemFields(true) }).eq('order_number', order.id);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Delivered' } : o));
    const items = await fetchLineItems('order_line_items', 'order_number', order.id);
    const amount = items.reduce((s, i) => s + i.quantity * i.price, 0);
    const id = generateId('INV');
    await supabase.from('invoices').insert([{
      ...buildSystemFields(), invoice_number: id, name: order.name,
      customer: order.customer, customer_id: order.customerId,
      contact: order.contact, contact_id: order.contactId,
      amount, due_date: null, payment_terms: '', billing_address: '', status: 'Pending',
    }]);
    if (items.length) await supabase.from('invoice_line_items').insert(
      items.map(i => ({ invoice_number: id, product_name: i.product, quantity: i.quantity, price: i.price, discount: i.discount || 0 }))
    );
    await logAudit({ recordType: 'orders', recordId: order.id, recordName: order.name, action: 'converted_to_invoice' });
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
  const submitForApproval = async (recordType, recordId, recordName) => {
    if (!supabase || !currentUser) return;
    const process = approvalProcesses.find(p => p.object_type === recordType && p.is_active);
    if (!process) { alert('No active approval process found for this record type.'); return; }
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
    if (!supabase || !currentUser) return;
    const request = approvalRequests.find(r => r.id === requestId);
    if (!request) return;

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
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.email) return;
    const email = session.user.email;
    fetchCurrentUser(email);
    loadCurrentUserPermissions(email);
    Promise.all([
      fetchCustomers(), fetchProducts(), fetchLeads(), fetchOpportunities(),
      fetchOrders(), fetchInvoices(), fetchContacts(), fetchActivities(),
      fetchQuoteTemplates(), fetchOrganizations(), fetchBusinessUnits(),
      fetchEnterpriseUsers(), fetchUserGroups(), fetchRoles(), fetchPermissions(),
      fetchWorkflowRules(), fetchAssignmentRules(), fetchSLAPolicies(),
      fetchApprovalProcesses(), fetchApprovalRequests(),
    ]);
  }, [session?.user?.email]);

  useEffect(() => {
    if (!currentUser?.email) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.email]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ═══════════════════════════════════════════════════════════════════════════

  const value = {
    session, authLoading, currentUser, currentUserPermissions, permissionsLoaded,
    handleLogin, handleLogout, resetMyPassword, saveMyProfile, loadCurrentUserPermissions,
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
    convertLeadToOpportunity, createOrderFromOpportunity, createInvoiceFromOrder,
    saveQuoteTemplate, deleteQuoteTemplate, setDefaultTemplate,
    saveWorkflowRule, deleteWorkflowRule, saveAssignmentRule, deleteAssignmentRule,
    saveSLAPolicy, deleteSLAPolicy, saveApprovalProcess, deleteApprovalProcess,
    submitForApproval, processApproval,
    logAudit, createNotification,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
