// @ts-nocheck
'use client';


import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/lib/utils';

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }) {

  // ── Auth state ──────────────────────────────────────────────────────────────
  const [session, setSession]           = useState(null);
  const [authLoading, setAuthLoading]   = useState(true);
  const [currentUser, setCurrentUser]   = useState(null);
  const [currentUserPermissions, setCurrentUserPermissions] = useState([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // ── CRM state ───────────────────────────────────────────────────────────────
  const [customers,     setCustomers]     = useState([]);
  const [contacts,      setContacts]      = useState([]);
  const [products,      setProducts]      = useState([]);
  const [leads,         setLeads]         = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [orders,        setOrders]        = useState([]);
  const [invoices,      setInvoices]      = useState([]);
  const [activities,    setActivities]    = useState([]);

  // ── Admin state ─────────────────────────────────────────────────────────────
  const [organizations,    setOrganizations]    = useState([]);
  const [businessUnits,    setBusinessUnits]    = useState([]);
  const [enterpriseUsers,  setEnterpriseUsers]  = useState([]);
  const [userGroups,       setUserGroups]       = useState([]);
  const [userGroupMembers, setUserGroupMembers] = useState([]);
  const [roles,            setRoles]            = useState([]);
  const [permissions,      setPermissions]      = useState([]);
  const [rolePermissions,  setRolePermissions]  = useState([]);
  const [quoteTemplates,   setQuoteTemplates]   = useState([]);

  // ── Workflow state ──────────────────────────────────────────────────────────
  const [workflowRules,     setWorkflowRules]     = useState([]);
  const [assignmentRules,   setAssignmentRules]   = useState([]);
  const [slaPolicies,       setSlaPolicies]       = useState([]);
  const [approvalProcesses, setApprovalProcesses] = useState([]);
  const [approvalRequests,  setApprovalRequests]  = useState([]);

  // ── Notifications state ─────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM HELPERS  (defined here because they need currentUser state)
  // ═══════════════════════════════════════════════════════════════════════════

  const buildSystemFields = useCallback((isUpdate = false) => {
    if (!currentUser) return {};
    const now = new Date().toISOString();
    if (isUpdate) {
      return { updated_by: currentUser.email, updated_at: now };
    }
    return {
      created_by:       currentUser.email,
      created_at:       now,
      updated_by:       currentUser.email,
      updated_at:       now,
      organization_id:  currentUser.organization_id,
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
    setCurrentUser(null);
    setCurrentUserPermissions([]);
    setPermissionsLoaded(false);
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
    const { data } = await supabase
      .from('enterprise_users').select('*')
      .eq('email', email).single();
    if (data) setCurrentUser(data);
  };

  const saveMyProfile = async (data) => {
    if (!supabase || !currentUser) return;
    const { error } = await supabase
      .from('enterprise_users')
      .update({ first_name: data.first_name, last_name: data.last_name, phone: data.phone })
      .eq('id', currentUser.id);
    if (!error) {
      await fetchCurrentUser(currentUser.email);
      await fetchEnterpriseUsers();
      alert('Profile updated.');
    } else {
      alert(error.message);
    }
  };

  const loadCurrentUserPermissions = async (email) => {
    if (!supabase || !email) return;
    setPermissionsLoaded(false);
    const { data: userData } = await supabase
      .from('enterprise_users').select('*, roles(id, role_name)')
      .eq('email', email).single();
    if (!userData?.role_id) { setCurrentUserPermissions([]); setPermissionsLoaded(true); return; }
    const { data: rpData } = await supabase
      .from('role_permissions').select('permission_id').eq('role_id', userData.role_id);
    const ids = (rpData || []).map(x => x.permission_id);
    if (!ids.length) { setCurrentUserPermissions([]); setPermissionsLoaded(true); return; }
    const { data: permsData } = await supabase
      .from('permissions').select('permission_code').in('id', ids);
    setCurrentUserPermissions((permsData || []).map(x => x.permission_code));
    setPermissionsLoaded(true);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchNotifications = async () => {
    if (!supabase || !currentUser?.email) return;
    const { data } = await supabase
      .from('notifications').select('*')
      .eq('recipient_email', currentUser.email)
      .order('created_at', { ascending: false }).limit(50);
    if (data) setNotifications(data);
  };

  const createNotification = async ({ recipientEmail, type, title, body, recordType, recordId }) => {
    if (!supabase) return;
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
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('recipient_email', currentUser.email).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT LOG
  // ═══════════════════════════════════════════════════════════════════════════

  const logAudit = async ({ recordType, recordId, recordName, action, fieldChanged, oldValue, newValue }) => {
    if (!supabase || !currentUser) return;
    await supabase.from('audit_log').insert([{
      record_type:      recordType,
      record_id:        recordId,
      record_name:      recordName,
      action,
      field_changed:    fieldChanged || null,
      old_value:        oldValue     || null,
      new_value:        newValue     || null,
      performed_by:     currentUser.email,
      performed_at:     new Date().toISOString(),
      organization_id:  currentUser.organization_id,
      business_unit_id: currentUser.business_unit_id,
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
      id: item.id, product: item.product_name,
      quantity: Number(item.quantity || 1), price: Number(item.price || 0),
    }));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN FETCH
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchOrganizations = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
    if (data) setOrganizations(data);
  };

  const fetchBusinessUnits = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('business_units').select('*').order('created_at', { ascending: false });
    if (data) setBusinessUnits(data);
  };

  const fetchEnterpriseUsers = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('enterprise_users').select('*').order('created_at', { ascending: false });
    if (data) setEnterpriseUsers(data);
  };

  const fetchUserGroups = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('user_groups').select('*').order('created_at', { ascending: false });
    if (data) setUserGroups(data);
  };

  const fetchGroupMembers = async (groupId) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('user_group_members')
      .select('id, enterprise_user_id, user_group_id, enterprise_users(id, first_name, last_name, email, employee_code)')
      .eq('user_group_id', groupId);
    if (data) setUserGroupMembers(data);
  };

  const fetchRoles = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('roles').select('*').order('created_at', { ascending: false });
    if (data) setRoles(data);
  };

  const fetchPermissions = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('permissions').select('*').order('module_name');
    if (data) setPermissions(data);
  };

  const fetchRolePermissions = async (roleId) => {
    if (!supabase) return [];
    const { data } = await supabase
      .from('role_permissions')
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
  // WORKFLOW FETCH
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchWorkflowRules = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('workflow_rules').select('*').order('created_at', { ascending: false });
    if (data) setWorkflowRules(data);
  };

  const fetchAssignmentRules = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('assignment_rules').select('*').order('priority');
    if (data) setAssignmentRules(data);
  };

  const fetchSLAPolicies = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('sla_policies').select('*').order('created_at', { ascending: false });
    if (data) setSlaPolicies(data);
  };

  const fetchApprovalProcesses = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('approval_processes').select('*').order('created_at', { ascending: false });
    if (data) setApprovalProcesses(data);
  };

  const fetchApprovalRequests = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('approval_requests').select('*').order('submitted_at', { ascending: false });
    if (data) setApprovalRequests(data);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  const saveOrganization = async (data, editingId) => {
    if (!supabase) return;
    editingId
      ? await supabase.from('organizations').update(data).eq('id', editingId)
      : await supabase.from('organizations').insert([data]);
    await fetchOrganizations();
  };

  const saveBusinessUnit = async (data, editingId) => {
    if (!supabase) return;
    const { error } = editingId
      ? await supabase.from('business_units').update(data).eq('id', editingId)
      : await supabase.from('business_units').insert([data]);
    if (error) { alert(error.message); return; }
    await fetchBusinessUnits();
  };

  const saveEnterpriseUser = async (data, editingId) => {
    if (!supabase) return;
    editingId
      ? await supabase.from('enterprise_users').update(data).eq('id', editingId)
      : await supabase.from('enterprise_users').insert([data]);
    await fetchEnterpriseUsers();
  };

  const saveUserGroup = async (data, editingId) => {
    if (!supabase) return;
    editingId
      ? await supabase.from('user_groups').update(data).eq('id', editingId)
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
      await supabase.from('role_permissions').insert(
        permissionIds.map(pid => ({ role_id: roleId, permission_id: pid }))
      );
    }
    await fetchRoles();
  };

  const addUsersToGroup = async (groupId, userIds, currentMembers) => {
    if (!supabase) return;
    const existingIds = currentMembers.map(m => m.enterprise_user_id);
    const newIds = userIds.filter(id => !existingIds.includes(id));
    if (!newIds.length) return;
    await supabase.from('user_group_members').insert(
      newIds.map(uid => ({ user_group_id: groupId, enterprise_user_id: uid }))
    );
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
  // CRM CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  const createRecord = async (page, data, lineItems) => {
    if (!supabase || !currentUser) return false;
    const sys = buildSystemFields();
    const calcAmount = (lineItems || []).reduce((s, i) => s + i.quantity * i.price, 0);

    try {
      switch (page) {
        case 'customers': {
          const id = generateId('CUST');
          const { error } = await supabase.from('customers').insert([{
            ...sys, customer_number: id, name: data.name, company: data.company,
            industry: data.industry, email: data.email, phone: data.phone,
            website: data.website, billing_address: data.billingAddress,
            shipping_address: data.shippingAddress, city: data.city, state: data.state,
            postal_code: data.postalCode, country: data.country,
            gst_number: data.gstNumber, status: data.status || 'Active',
          }]);
          if (error) throw error;
          await logAudit({ recordType: 'customer', recordId: id, recordName: data.name, action: 'created' });
          await fetchCustomers();
          break;
        }
        case 'products': {
          const id = generateId('PROD');
          const { error } = await supabase.from('products').insert([{
            ...sys, product_number: id, name: data.name,
            category: data.category, price: Number(data.price || 0), status: data.status || 'Active',
          }]);
          if (error) throw error;
          await fetchProducts();
          break;
        }
        case 'leads': {
          const id = generateId('LEAD');
          const { error } = await supabase.from('leads').insert([{
            ...sys, lead_number: id, name: data.name, customer: data.customer,
            customer_id: data.customerId, contact: data.contact, contact_id: data.contactId,
            email: data.email, phone: data.phone, source: data.source,
            amount: calcAmount || Number(data.amount || 0), status: data.status || 'New',
          }]);
          if (error) throw error;
          if (lineItems?.length) await supabase.from('lead_line_items').insert(
            lineItems.map(i => ({ lead_number: id, product_name: i.product, quantity: i.quantity, price: i.price, discount: i.discount || 0 }))
          );
          await logAudit({ recordType: 'lead', recordId: id, recordName: data.name, action: 'created' });
          await fetchLeads();
          break;
        }
        case 'opportunities': {
          const id = generateId('OPP');
          const { error } = await supabase.from('opportunities').insert([{
            ...sys, opportunity_number: id, name: data.name, customer: data.customer,
            customer_id: data.customerId, contact: data.contact, contact_id: data.contactId,
            stage: data.stage || 'Qualification', amount: calcAmount || Number(data.amount || 0),
            close_date: data.closeDate || null, status: data.status || 'Open',
          }]);
          if (error) throw error;
          if (lineItems?.length) await supabase.from('opportunity_line_items').insert(
            lineItems.map(i => ({ opportunity_number: id, product_name: i.product, quantity: i.quantity, price: i.price, discount: i.discount || 0 }))
          );
          await logAudit({ recordType: 'opportunity', recordId: id, recordName: data.name, action: 'created' });
          await fetchOpportunities();
          break;
        }
        case 'orders': {
          const id = generateId('ORD');
          const { error } = await supabase.from('orders').insert([{
            ...sys, order_number: id, name: data.name, customer: data.customer,
            customer_id: data.customerId, contact: data.contact, contact_id: data.contactId,
            amount: calcAmount, shipping_address: data.shippingAddress || '',
            delivery_date: data.deliveryDate || null, status: data.status || 'Processing',
          }]);
          if (error) throw error;
          if (lineItems?.length) await supabase.from('order_line_items').insert(
            lineItems.map(i => ({ order_number: id, product_name: i.product, quantity: i.quantity, price: i.price, discount: i.discount || 0 }))
          );
          await logAudit({ recordType: 'order', recordId: id, recordName: data.name, action: 'created' });
          await fetchOrders();
          break;
        }
        case 'invoices': {
          const id = generateId('INV');
          const { error } = await supabase.from('invoices').insert([{
            ...sys, invoice_number: id, name: data.name, customer: data.customer,
            customer_id: data.customerId, contact: data.contact, contact_id: data.contactId,
            amount: calcAmount, due_date: data.dueDate || null,
            payment_terms: data.paymentTerms || '', billing_address: data.billingAddress || '',
            status: data.status || 'Pending',
          }]);
          if (error) throw error;
          if (lineItems?.length) await supabase.from('invoice_line_items').insert(
            lineItems.map(i => ({ invoice_number: id, product_name: i.product, quantity: i.quantity, price: i.price, discount: i.discount || 0 }))
          );
          await logAudit({ recordType: 'invoice', recordId: id, recordName: data.name, action: 'created' });
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
          await fetchContacts();
          break;
        }
        case 'activities': {
          const id = generateId('ACT');
          const { error } = await supabase.from('activities').insert([{
            ...sys, activity_number: id, name: data.name, customer: data.customer,
            customer_id: data.customerId, contact: data.contact, contact_id: data.contactId,
            subject: data.subject, activity_type: data.activityType,
            activity_date: data.activityDate, notes: data.notes, status: data.status || 'Open',
          }]);
          if (error) throw error;
          await fetchActivities();
          break;
        }
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
    const calcAmount = (lineItems || []).reduce((s, i) => s + i.quantity * i.price, 0);

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
          ...sys, name: record.name, email: record.email, phone: record.phone,
          company: record.company, industry: record.industry,
          primary_contact_id: record.primaryContactId,
          billing_address: record.billingAddress, shipping_address: record.shippingAddress,
          city: record.city, state: record.state, postal_code: record.postalCode,
          country: record.country, website: record.website, gst_number: record.gstNumber, status: record.status,
        }).eq('customer_number', record.id);
        await logAudit({ recordType: 'customer', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchCustomers(); break;
      case 'contacts':
        await supabase.from('contacts').update({
          ...sys, customer: record.customer, name: record.name, email: record.email,
          phone: record.phone, designation: record.designation,
          department: record.department, is_primary: record.isPrimary, status: record.status,
        }).eq('contact_number', record.id);
        if (record.isPrimary) {
          await supabase.from('customers').update({ primary_contact_id: record.id }).eq('customer_number', record.customerId);
        }
        await fetchContacts(); await fetchCustomers(); break;
      case 'products':
        await supabase.from('products').update({
          ...sys, name: record.name, category: record.category,
          price: Number(record.price || 0), status: record.status,
        }).eq('product_number', record.id);
        await fetchProducts(); break;
      case 'leads':
        await supabase.from('leads').update({
          ...sys, name: record.name, customer: record.customer, email: record.email,
          phone: record.phone, source: record.source,
          amount: calcAmount || Number(record.amount || 0), status: record.status,
        }).eq('lead_number', record.id);
        await upsertLineItems('lead_line_items', 'lead_number', record.id);
        await logAudit({ recordType: 'lead', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchLeads(); break;
      case 'opportunities':
        await supabase.from('opportunities').update({
          ...sys, name: record.name, customer: record.customer, stage: record.stage,
          amount: calcAmount || Number(record.amount || 0), close_date: record.closeDate, status: record.status,
        }).eq('opportunity_number', record.id);
        await upsertLineItems('opportunity_line_items', 'opportunity_number', record.id);
        await logAudit({ recordType: 'opportunity', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchOpportunities(); break;
      case 'orders':
        await supabase.from('orders').update({
          ...sys, customer: record.customer, name: record.name, amount: calcAmount,
          shipping_address: record.shippingAddress, delivery_date: record.deliveryDate, status: record.status,
        }).eq('order_number', record.id);
        await upsertLineItems('order_line_items', 'order_number', record.id);
        await logAudit({ recordType: 'order', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchOrders(); break;
      case 'invoices':
        await supabase.from('invoices').update({
          ...sys, customer: record.customer, name: record.name, amount: calcAmount,
          due_date: record.dueDate, payment_terms: record.paymentTerms,
          billing_address: record.billingAddress, status: record.status,
        }).eq('invoice_number', record.id);
        await upsertLineItems('invoice_line_items', 'invoice_number', record.id);
        await logAudit({ recordType: 'invoice', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchInvoices(); break;
      case 'activities':
        await supabase.from('activities').update({
          ...sys, name: record.name, customer: record.customer, contact: record.contact,
          subject: record.subject, activity_type: record.activityType,
          activity_date: record.activityDate, notes: record.notes, status: record.status,
        }).eq('activity_number', record.id);
        await fetchActivities(); break;
    }
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
    await logAudit({ recordType: 'lead', recordId: lead.id, recordName: lead.name, action: 'converted_to_opportunity' });
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
    await logAudit({ recordType: 'opportunity', recordId: opportunity.id, recordName: opportunity.name, action: 'converted_to_order' });
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
    await logAudit({ recordType: 'order', recordId: order.id, recordName: order.name, action: 'converted_to_invoice' });
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
      const { error } = await supabase.from('quote_templates').insert([{
        ...payload, template_number: generateId('TEMP'), is_default: false,
      }]);
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
      await supabase.from('workflow_rules').update({ ...data, ...buildSystemFields(true) }).eq('id', editingId);
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
      await supabase.from('assignment_rules').update({ ...data, ...buildSystemFields(true) }).eq('id', editingId);
    } else {
      await supabase.from('assignment_rules').insert([{ ...data, ...buildSystemFields(), rule_number: generateId('AR') }]);
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
      await supabase.from('sla_policies').update({ ...data, ...buildSystemFields(true) }).eq('id', editingId);
    } else {
      await supabase.from('sla_policies').insert([{ ...data, ...buildSystemFields(), policy_number: generateId('SLA') }]);
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
      await supabase.from('approval_processes').update({ ...data, ...buildSystemFields(true) }).eq('id', editingId);
    } else {
      const { data: proc, error } = await supabase.from('approval_processes').insert([{
        ...data, ...buildSystemFields(), process_number: generateId('AP'),
      }]).select().single();
      if (error || !proc) { alert(error?.message || 'Error'); return; }
      processId = proc.id;
    }
    await supabase.from('approval_steps').delete().eq('approval_process_id', processId);
    if (steps?.length) {
      await supabase.from('approval_steps').insert(
        steps.map((s, i) => ({ ...s, approval_process_id: processId, step_number: i + 1 }))
      );
    }
    await fetchApprovalProcesses();
  };

  const deleteApprovalProcess = async (id) => {
    if (!supabase || !window.confirm('Delete this approval process?')) return;
    await supabase.from('approval_processes').delete().eq('id', id);
    await fetchApprovalProcesses();
  };

  const submitForApproval = async (recordType, recordId, recordName) => {
    if (!supabase || !currentUser) return;
    const process = approvalProcesses.find(p => p.object_type === recordType && p.is_active);
    if (!process) { alert('No active approval process found for this record type.'); return; }
    const { data: steps } = await supabase.from('approval_steps').select('*')
      .eq('approval_process_id', process.id).order('step_number');
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
    const approverUser = enterpriseUsers.find(u => u.id === firstStep.approver_user_id);
    if (approverUser) {
      await createNotification({
        recipientEmail: approverUser.email, type: 'approval',
        title: 'Approval Required',
        body: `${recordName} requires your approval.`,
        recordType, recordId,
      });
    }
    // Update the CRM record status to Pending Approval
    const tableMap2 = { customers:'customers', leads:'leads', opportunities:'opportunities', orders:'orders', invoices:'invoices', contacts:'contacts', activities:'activities' };
    const idFieldMap2 = { customers:'customer_number', leads:'lead_number', opportunities:'opportunity_number', orders:'order_number', invoices:'invoice_number', contacts:'contact_number', activities:'activity_number' };
    const tbl = tableMap2[recordType];
    const idf = idFieldMap2[recordType];
    if (tbl && idf) {
      await supabase.from(tbl).update({ status: 'Pending Approval', updated_by: currentUser.email, updated_at: new Date().toISOString() }).eq(idf, recordId);
      if (recordType === 'leads') await fetchLeads();
      if (recordType === 'opportunities') await fetchOpportunities();
      if (recordType === 'orders') await fetchOrders();
      if (recordType === 'invoices') await fetchInvoices();
    }

    await logAudit({ recordType, recordId, recordName, action: 'submitted_for_approval' });
    await fetchApprovalRequests();
    alert('Submitted for approval successfully.');
  };

  const processApproval = async (requestId, decision, comments) => {
    if (!supabase || !currentUser) return;
    const request = approvalRequests.find(r => r.id === requestId);
    if (!request) return;
    await supabase.from('approval_decisions').insert([{
      approval_request_id: requestId, step_id: request.current_step_id,
      decided_by: currentUser.email, decision, comments,
      decided_at: new Date().toISOString(),
    }]);
    await supabase.from('approval_requests').update({ status: decision, comments }).eq('id', requestId);
    await logAudit({
      recordType: request.record_type, recordId: request.record_id,
      recordName: request.record_name, action: `approval_${decision.toLowerCase()}`,
    });
    const submitter = enterpriseUsers.find(u => u.email === request.submitted_by);
    if (submitter) {
      await createNotification({
        recipientEmail: submitter.email, type: 'approval',
        title: `Record ${decision}`,
        body: `${request.record_name} has been ${decision.toLowerCase()} by ${currentUser.email}.`,
        recordType: request.record_type, recordId: request.record_id,
      });
    }
    await fetchApprovalRequests();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTOMATION ENGINES
  // ═══════════════════════════════════════════════════════════════════════════

  const runWorkflowRules = async (objectType, triggerEvent, recordData) => {
    if (!supabase || !currentUser) return;
    const rules = workflowRules.filter(r =>
      r.object_type === objectType && r.trigger_event === triggerEvent && r.is_active
    );
    for (const rule of rules) {
      const { data: actions } = await supabase
        .from('workflow_actions').select('*')
        .eq('workflow_rule_id', rule.id).order('execution_order');
      for (const action of (actions || [])) {
        const cfg = action.action_config || {};
        try {
          if (action.action_type === 'send_notification' && cfg.recipient) {
            await createNotification({
              recipientEmail: cfg.recipient, type: 'workflow',
              title: rule.name,
              body: cfg.message || `Workflow triggered: ${rule.name}`,
              recordType: objectType, recordId: recordData?.id || '',
            });
          }
          if (action.action_type === 'send_email' && cfg.to_email) {
            await createNotification({
              recipientEmail: cfg.to_email, type: 'email',
              title: cfg.subject || rule.name,
              body: cfg.body || '',
              recordType: objectType, recordId: recordData?.id || '',
            });
          }
        } catch (e) { console.error('Workflow action error:', e); }
      }
    }
  };

  const startSLA = async (objectType, recordId, recordData) => {
    if (!supabase || !currentUser) return;
    const matching = slaPolicies.filter(p => p.object_type === objectType && p.is_active);
    for (const policy of matching) {
      if (policy.condition_field && policy.condition_value) {
        const val = recordData[policy.condition_field];
        if (String(val).toLowerCase() !== String(policy.condition_value).toLowerCase()) continue;
      }
      const now = new Date();
      const responseDue   = new Date(now.getTime() + policy.response_time_hours   * 3600000);
      const resolutionDue = new Date(now.getTime() + policy.resolution_time_hours * 3600000);
      await supabase.from('sla_records').insert([{
        sla_policy_id:     policy.id,
        record_type:       objectType,
        record_id:         recordId,
        started_at:        now.toISOString(),
        response_due_at:   responseDue.toISOString(),
        resolution_due_at: resolutionDue.toISOString(),
        status:            'Active',
      }]);
    }
  };

  const runAssignmentRules = async (objectType, recordId, recordData) => {
    if (!supabase || !currentUser) return;
    const rules = assignmentRules
      .filter(r => r.object_type === objectType && r.is_active)
      .sort((a, b) => a.priority - b.priority);
    for (const rule of rules) {
      const val = recordData[rule.condition_field];
      let matches = false;
      if (rule.condition_operator === 'equals')       matches = String(val) === rule.condition_value;
      if (rule.condition_operator === 'not_equals')   matches = String(val) !== rule.condition_value;
      if (rule.condition_operator === 'contains')     matches = String(val).includes(rule.condition_value);
      if (rule.condition_operator === 'greater_than') matches = Number(val) > Number(rule.condition_value);
      if (rule.condition_operator === 'less_than')    matches = Number(val) < Number(rule.condition_value);
      if (matches) {
        const assignee = enterpriseUsers.find(u => u.id === rule.assign_to_user_id);
        if (assignee) {
          await createNotification({
            recipientEmail: assignee.email, type: 'assignment',
            title: 'New Record Assigned',
            body: `A new ${objectType} record has been assigned to you.`,
            recordType: objectType, recordId,
          });
        }
        break;
      }
    }
  };
  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
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
    // auth
    session, authLoading, currentUser, currentUserPermissions, permissionsLoaded,
    handleLogin, handleLogout, resetMyPassword, saveMyProfile,
    loadCurrentUserPermissions,

    // crm data
    customers, contacts, products, leads, opportunities, orders, invoices, activities,

    // admin data
    organizations, businessUnits, enterpriseUsers, userGroups, userGroupMembers,
    roles, permissions, rolePermissions, quoteTemplates,

    // workflow data
    workflowRules, assignmentRules, slaPolicies, approvalProcesses, approvalRequests,

    // notifications
    notifications,
    unreadCount: notifications.filter(n => !n.is_read).length,
    markNotificationRead, markAllNotificationsRead,

    // fetch functions
    fetchCustomers, fetchContacts, fetchProducts, fetchLeads, fetchOpportunities,
    fetchOrders, fetchInvoices, fetchActivities, fetchOrganizations, fetchBusinessUnits,
    fetchEnterpriseUsers, fetchUserGroups, fetchGroupMembers, fetchRoles, fetchPermissions,
    fetchRolePermissions, fetchQuoteTemplates, fetchWorkflowRules, fetchAssignmentRules,
    fetchSLAPolicies, fetchApprovalProcesses, fetchApprovalRequests, fetchNotifications,
    fetchLineItems,

    // helpers
    buildSystemFields, applyDataSecurity,

    // admin crud
    saveOrganization, saveBusinessUnit, saveEnterpriseUser, saveUserGroup, saveRole,
    addUsersToGroup, removeUserFromGroup, deleteAdminRecord, updateAdminStatus,

    // crm crud
    createRecord, updateRecord,

    // pipeline
    convertLeadToOpportunity, createOrderFromOpportunity, createInvoiceFromOrder,

    // templates
    saveQuoteTemplate, deleteQuoteTemplate, setDefaultTemplate,

    // workflow crud
    saveWorkflowRule, deleteWorkflowRule, saveAssignmentRule, deleteAssignmentRule,
    saveSLAPolicy, deleteSLAPolicy, saveApprovalProcess, deleteApprovalProcess,
    submitForApproval, processApproval,

    // audit
    logAudit, createNotification,

    
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
