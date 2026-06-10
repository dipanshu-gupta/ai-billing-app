// @ts-nocheck

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  EnterpriseUser, Organization, BusinessUnit, Role, Permission,
  RolePermission, UserGroup, UserGroupMember, Customer, Contact,
  Product, Lead, Opportunity, Order, Invoice, Activity, LineItem,
  QuoteTemplate, WorkflowRule, WorkflowAction, AssignmentRule,
  SLAPolicy, SLARecord, ApprovalProcess, ApprovalStep, ApprovalRequest,
  Notification, AuditLog,
} from '@/lib/types';
import { generateId } from '@/lib/utils';

// \u2500\u2500\u2500 Context Shape \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

interface AppContextValue {
  // Auth
  session: any;
  authLoading: boolean;
  currentUser: EnterpriseUser | null;
  currentUserPermissions: string[];
  permissionsLoaded: boolean;
  handleLogin: (email: string, password: string) => Promise<void>;
  handleLogout: () => Promise<void>;
  resetMyPassword: (newPassword: string) => Promise<void>;
  saveMyProfile: (data: Partial<EnterpriseUser>) => Promise<void>;
  loadCurrentUserPermissions: () => Promise<void>;

  // CRM Data
  customers: Customer[];
  contacts: Contact[];
  products: Product[];
  leads: Lead[];
  opportunities: Opportunity[];
  orders: Order[];
  invoices: Invoice[];
  activities: Activity[];

  // Admin Data
  organizations: Organization[];
  businessUnits: BusinessUnit[];
  enterpriseUsers: EnterpriseUser[];
  userGroups: UserGroup[];
  userGroupMembers: UserGroupMember[];
  roles: Role[];
  permissions: Permission[];
  rolePermissions: RolePermission[];
  quoteTemplates: QuoteTemplate[];

  // Workflow / Automation
  workflowRules: WorkflowRule[];
  assignmentRules: AssignmentRule[];
  slaPolicies: SLAPolicy[];
  approvalProcesses: ApprovalProcess[];
  approvalRequests: ApprovalRequest[];

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // Fetch functions
  fetchCustomers: () => Promise<void>;
  fetchContacts: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  fetchLeads: () => Promise<void>;
  fetchOpportunities: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  fetchInvoices: () => Promise<void>;
  fetchActivities: () => Promise<void>;
  fetchOrganizations: () => Promise<void>;
  fetchBusinessUnits: () => Promise<void>;
  fetchEnterpriseUsers: () => Promise<void>;
  fetchUserGroups: () => Promise<void>;
  fetchGroupMembers: (groupId: string) => Promise<void>;
  fetchRoles: () => Promise<void>;
  fetchPermissions: () => Promise<void>;
  fetchRolePermissions: (roleId: string) => Promise<RolePermission[]>;
  fetchQuoteTemplates: () => Promise<void>;
  fetchWorkflowRules: () => Promise<void>;
  fetchAssignmentRules: () => Promise<void>;
  fetchSLAPolicies: () => Promise<void>;
  fetchApprovalProcesses: () => Promise<void>;
  fetchApprovalRequests: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchLineItems: (table: string, field: string, id: string) => Promise<LineItem[]>;

  // System field helpers
  buildSystemFields: (isUpdate?: boolean) => Record<string, any>;
  applyDataSecurity: (records: any[]) => any[];

  // Admin CRUD
  saveOrganization: (data: any, editingId?: string) => Promise<void>;
  saveBusinessUnit: (data: any, editingId?: string) => Promise<void>;
  saveEnterpriseUser: (data: any, editingId?: string) => Promise<void>;
  saveUserGroup: (data: any, editingId?: string) => Promise<void>;
  saveRole: (data: any, editingId: string | null, permissionIds: string[]) => Promise<void>;
  addUsersToGroup: (groupId: string, userIds: string[], currentMembers: UserGroupMember[]) => Promise<void>;
  removeUserFromGroup: (membershipId: string, groupId: string) => Promise<void>;
  deleteAdminRecord: (table: string, id: string) => Promise<boolean>;
  updateAdminStatus: (table: string, id: string, status: string) => Promise<void>;

  // CRM CRUD
  createRecord: (page: string, data: any, lineItems: LineItem[]) => Promise<boolean>;
  updateRecord: (page: string, record: any, lineItems: LineItem[]) => Promise<void>;

  // Pipeline actions
  convertLeadToOpportunity: (lead: Lead) => Promise<void>;
  createOrderFromOpportunity: (opportunity: Opportunity) => Promise<void>;
  createInvoiceFromOrder: (order: Order) => Promise<void>;

  // Quote templates
  saveQuoteTemplate: (data: any, editingId?: string | null) => Promise<void>;
  deleteQuoteTemplate: (templateId: string) => Promise<void>;
  setDefaultTemplate: (templateId: string) => Promise<void>;

  // Workflow CRUD
  saveWorkflowRule: (data: any, actions: any[], editingId?: string) => Promise<void>;
  deleteWorkflowRule: (id: string) => Promise<void>;
  saveAssignmentRule: (data: any, editingId?: string) => Promise<void>;
  deleteAssignmentRule: (id: string) => Promise<void>;
  saveSLAPolicy: (data: any, editingId?: string) => Promise<void>;
  deleteSLAPolicy: (id: string) => Promise<void>;
  saveApprovalProcess: (data: any, steps: any[], editingId?: string) => Promise<void>;
  deleteApprovalProcess: (id: string) => Promise<void>;
  submitForApproval: (recordType: string, recordId: string, recordName: string) => Promise<void>;
  processApproval: (requestId: string, decision: 'Approved' | 'Rejected', comments: string) => Promise<void>;

  // Audit
  logAudit: (params: {
    recordType: string; recordId: string; recordName: string;
    action: string; fieldChanged?: string; oldValue?: string; newValue?: string;
  }) => Promise<void>;

  // Notifications (create)
  createNotification: (params: {
    recipientEmail: string; type: string; title: string;
    body: string; recordType: string; recordId: string;
  }) => Promise<void>;
}

// \u2500\u2500\u2500 Context \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const AppContext = createContext<AppContextValue | null>(null);

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

// \u2500\u2500\u2500 Provider \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Auth
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<EnterpriseUser | null>(null);
  const [currentUserPermissions, setCurrentUserPermissions] = useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // CRM
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  // Admin
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [enterpriseUsers, setEnterpriseUsers] = useState<EnterpriseUser[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [userGroupMembers, setUserGroupMembers] = useState<UserGroupMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [quoteTemplates, setQuoteTemplates] = useState<QuoteTemplate[]>([]);

  // Workflow
  const [workflowRules, setWorkflowRules] = useState<WorkflowRule[]>([]);
  const [assignmentRules, setAssignmentRules] = useState<AssignmentRule[]>([]);
  const [slaPolicies, setSlaPolicies] = useState<SLAPolicy[]>([]);
  const [approvalProcesses, setApprovalProcesses] = useState<ApprovalProcess[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // \u2500\u2500\u2500 System Helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

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

  const applyDataSecurity = useCallback((records: any[]) => {
    if (!currentUser) return records;
    return records.filter((r: any) => {
      const orgMatch = !r.organization_id || r.organization_id === currentUser.organization_id;
      const buMatch = !r.business_unit_id || r.business_unit_id === currentUser.business_unit_id;
      return orgMatch && buMatch;
    });
  }, [currentUser]);

  // \u2500\u2500\u2500 Auth \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const handleLogin = async (email: string, password: string) => {
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

  const resetMyPassword = async (newPassword: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) alert('Password Updated');
    else alert(error.message);
  };

  const saveMyProfile = async (data: Partial<EnterpriseUser>) => {
    if (!supabase || !currentUser) return;
    const { error } = await supabase
      .from('enterprise_users')
      .update({ first_name: data.first_name, last_name: data.last_name, phone: data.phone })
      .eq('id', currentUser.id);
    if (!error) { await fetchCurrentUser(); await fetchEnterpriseUsers(); alert('Profile Updated'); }
    else alert(error.message);
  };

  const fetchCurrentUser = async () => {
    if (!supabase || !session?.user?.email) return;
    const { data } = await supabase
      .from('enterprise_users').select('*')
      .eq('email', session.user.email).single();
    if (data) setCurrentUser(data);
  };

  const loadCurrentUserPermissions = async () => {
    if (!supabase || !session?.user?.email) return;
    setPermissionsLoaded(false);
    const { data: userData } = await supabase
      .from('enterprise_users').select('*, roles(id, role_name)')
      .eq('email', session.user.email).single();
    if (!userData?.role_id) { setCurrentUserPermissions([]); setPermissionsLoaded(true); return; }
    const { data: rpData } = await supabase
      .from('role_permissions').select('permission_id').eq('role_id', userData.role_id);
    const ids = (rpData || []).map((x: any) => x.permission_id);
    if (!ids.length) { setCurrentUserPermissions([]); setPermissionsLoaded(true); return; }
    const { data: permsData } = await supabase
      .from('permissions').select('permission_code').in('id', ids);
    setCurrentUserPermissions((permsData || []).map((x: any) => x.permission_code));
    setPermissionsLoaded(true);
  };

  // \u2500\u2500\u2500 Fetch: CRM \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const fetchCustomers = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (error) console.error(error);
    if (data) {
      const secured = applyDataSecurity(data);
      setCustomers(secured.map((c: any) => ({
        id: c.customer_number, primaryContactId: c.primary_contact_id, primaryContact: '',
        name: c.name, email: c.email, phone: c.phone, company: c.company, industry: c.industry,
        billingAddress: c.billing_address, shippingAddress: c.shipping_address,
        city: c.city, state: c.state, postalCode: c.postal_code, country: c.country,
        website: c.website, gstNumber: c.gst_number, status: c.status,
        created_by: c.created_by, created_at: c.created_at, updated_by: c.updated_by, updated_at: c.updated_at,
        organization_id: c.organization_id, business_unit_id: c.business_unit_id,
      })));
    }
  };

  const fetchContacts = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
    if (error) console.error(error);
    if (data) {
      setContacts(data.map((c: any) => ({
        id: c.contact_number, customerId: c.customer_id, customer: c.customer,
        name: c.name, email: c.email, phone: c.phone, designation: c.designation,
        department: c.department, isPrimary: c.is_primary || false, status: c.status,
        created_by: c.created_by, created_at: c.created_at, updated_by: c.updated_by, updated_at: c.updated_at,
        organization_id: c.organization_id, business_unit_id: c.business_unit_id,
      })));
    }
  };

  const fetchProducts = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) console.error(error);
    if (data) {
      setProducts(data.map((p: any) => ({
        id: p.product_number, name: p.name, category: p.category,
        price: Number(p.price || 0), status: p.status,
        created_by: p.created_by, created_at: p.created_at, updated_by: p.updated_by, updated_at: p.updated_at,
        organization_id: p.organization_id, business_unit_id: p.business_unit_id,
      })));
    }
  };

  const fetchLeads = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (error) console.error(error);
    if (data) {
      setLeads(data.map((l: any) => ({
        id: l.lead_number, name: l.name, customer: l.customer, customerId: l.customer_id,
        contact: l.contact, contactId: l.contact_id, email: l.email, phone: l.phone,
        source: l.source, amount: Number(l.amount || 0), status: l.status,
        created_by: l.created_by, created_at: l.created_at, updated_by: l.updated_by, updated_at: l.updated_at,
        organization_id: l.organization_id, business_unit_id: l.business_unit_id,
      })));
    }
  };

  const fetchOpportunities = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('opportunities').select('*').order('created_at', { ascending: false });
    if (error) console.error(error);
    if (data) {
      setOpportunities(data.map((o: any) => ({
        id: o.opportunity_number, name: o.name, customer: o.customer, customerId: o.customer_id,
        contact: o.contact, contactId: o.contact_id, stage: o.stage,
        amount: Number(o.amount || 0), closeDate: o.close_date, status: o.status,
        created_by: o.created_by, created_at: o.created_at, updated_by: o.updated_by, updated_at: o.updated_at,
        organization_id: o.organization_id, business_unit_id: o.business_unit_id,
      })));
    }
  };

  const fetchOrders = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) console.error(error);
    if (data) {
      setOrders(data.map((o: any) => ({
        id: o.order_number, name: o.name, customer: o.customer, customerId: o.customer_id,
        contact: o.contact, contactId: o.contact_id, amount: Number(o.amount || 0),
        shippingAddress: o.shipping_address, deliveryDate: o.delivery_date, status: o.status,
        created_by: o.created_by, created_at: o.created_at, updated_by: o.updated_by, updated_at: o.updated_at,
        organization_id: o.organization_id, business_unit_id: o.business_unit_id,
      })));
    }
  };

  const fetchInvoices = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
    if (error) console.error(error);
    if (data) {
      setInvoices(data.map((inv: any) => ({
        id: inv.invoice_number, name: inv.name, customer: inv.customer, customerId: inv.customer_id,
        contact: inv.contact, contactId: inv.contact_id, amount: Number(inv.amount || 0),
        dueDate: inv.due_date, paymentTerms: inv.payment_terms, billingAddress: inv.billing_address,
        status: inv.status,
        created_by: inv.created_by, created_at: inv.created_at, updated_by: inv.updated_by, updated_at: inv.updated_at,
        organization_id: inv.organization_id, business_unit_id: inv.business_unit_id,
      })));
    }
  };

  const fetchActivities = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('activities').select('*').order('created_at', { ascending: false });
    if (error) console.error(error);
    if (data) {
      setActivities(data.map((a: any) => ({
        id: a.activity_number, name: a.name, customer: a.customer, customerId: a.customer_id,
        contact: a.contact, contactId: a.contact_id, subject: a.subject,
        activityType: a.activity_type, activityDate: a.activity_date, notes: a.notes, status: a.status,
        created_by: a.created_by, created_at: a.created_at, updated_by: a.updated_by, updated_at: a.updated_at,
        organization_id: a.organization_id, business_unit_id: a.business_unit_id,
      })));
    }
  };

  const fetchLineItems = async (table: string, field: string, id: string): Promise<LineItem[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from(table).select('*').eq(field, id);
    return (data || []).map((item: any) => ({
      id: item.id, product: item.product_name,
      quantity: Number(item.quantity || 1), price: Number(item.price || 0),
    }));
  };

  // \u2500\u2500\u2500 Fetch: Admin \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

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

  const fetchGroupMembers = async (groupId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('user_group_members')
      .select('id, enterprise_user_id, enterprise_users(id, first_name, last_name, email, employee_code)')
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

  const fetchRolePermissions = async (roleId: string): Promise<RolePermission[]> => {
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
    if (data) {
      setQuoteTemplates(data.map((t: any) => ({
        id: t.template_number, dbId: t.id, name: t.name, isDefault: t.is_default,
        companyName: t.company_name, companyEmail: t.company_email, companyPhone: t.company_phone,
        companyAddress: t.company_address, quoteTitle: t.quote_title, footerText: t.footer_text,
        termsAndConditions: t.terms_and_conditions, primaryColor: t.primary_color, secondaryColor: t.secondary_color,
      })));
    }
  };

  // \u2500\u2500\u2500 Fetch: Workflow \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

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

  // \u2500\u2500\u2500 Fetch: Notifications \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const fetchNotifications = async () => {
    if (!supabase || !currentUser?.email) return;
    const { data } = await supabase
      .from('notifications').select('*')
      .eq('recipient_email', currentUser.email)
      .order('created_at', { ascending: false }).limit(50);
    if (data) setNotifications(data);
  };

  const markNotificationRead = async (id: string) => {
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

  // \u2500\u2500\u2500 Audit & Notifications \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const logAudit = async (params: {
    recordType: string; recordId: string; recordName: string;
    action: string; fieldChanged?: string; oldValue?: string; newValue?: string;
  }) => {
    if (!supabase || !currentUser) return;
    await supabase.from('audit_log').insert([{
      record_type: params.recordType, record_id: params.recordId,
      record_name: params.recordName, action: params.action,
      field_changed: params.fieldChanged || null, old_value: params.oldValue || null,
      new_value: params.newValue || null, performed_by: currentUser.email,
      performed_at: new Date().toISOString(),
      organization_id: currentUser.organization_id, business_unit_id: currentUser.business_unit_id,
    }]);
  };

  const createNotification = async (params: {
    recipientEmail: string; type: string; title: string;
    body: string; recordType: string; recordId: string;
  }) => {
    if (!supabase) return;
    await supabase.from('notifications').insert([{
      recipient_email: params.recipientEmail, type: params.type,
      title: params.title, body: params.body,
      record_type: params.recordType, record_id: params.recordId,
      is_read: false, created_at: new Date().toISOString(),
    }]);
    if (params.recipientEmail === currentUser?.email) await fetchNotifications();
  };

  // \u2500\u2500\u2500 Admin CRUD \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const saveOrganization = async (data: any, editingId?: string) => {
    if (!supabase) return;
    if (editingId) {
      await supabase.from('organizations').update(data).eq('id', editingId);
    } else {
      await supabase.from('organizations').insert([data]);
    }
    await fetchOrganizations();
  };

  const saveBusinessUnit = async (data: any, editingId?: string) => {
    if (!supabase) return;
    if (editingId) {
      const { error } = await supabase.from('business_units').update(data).eq('id', editingId);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase.from('business_units').insert([data]);
      if (error) { alert(error.message); return; }
    }
    await fetchBusinessUnits();
  };

  const saveEnterpriseUser = async (data: any, editingId?: string) => {
    if (!supabase) return;
    if (editingId) {
      await supabase.from('enterprise_users').update(data).eq('id', editingId);
    } else {
      await supabase.from('enterprise_users').insert([data]);
    }
    await fetchEnterpriseUsers();
  };

  const saveUserGroup = async (data: any, editingId?: string) => {
    if (!supabase) return;
    if (editingId) {
      await supabase.from('user_groups').update(data).eq('id', editingId);
    } else {
      await supabase.from('user_groups').insert([data]);
    }
    await fetchUserGroups();
  };

  const saveRole = async (data: any, editingId: string | null, permissionIds: string[]) => {
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
    if (permissionIds.length) {
      await supabase.from('role_permissions').insert(
        permissionIds.map(pid => ({ role_id: roleId, permission_id: pid }))
      );
    }
    await fetchRoles();
  };

  const addUsersToGroup = async (groupId: string, userIds: string[], currentMembers: UserGroupMember[]) => {
    if (!supabase) return;
    const existingIds = currentMembers.map(m => m.enterprise_user_id);
    const newIds = userIds.filter(id => !existingIds.includes(id));
    if (!newIds.length) return;
    await supabase.from('user_group_members').insert(
      newIds.map(uid => ({ user_group_id: groupId, enterprise_user_id: uid }))
    );
    await fetchGroupMembers(groupId);
  };

  const removeUserFromGroup = async (membershipId: string, groupId: string) => {
    if (!supabase) return;
    await supabase.from('user_group_members').delete().eq('id', membershipId);
    await fetchGroupMembers(groupId);
  };

  const deleteAdminRecord = async (table: string, id: string): Promise<boolean> => {
    if (!supabase) return false;
    if (!window.confirm('Are you sure you want to delete this record?')) return false;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { alert(error.message); return false; }
    if (table === 'organizations') await fetchOrganizations();
    if (table === 'business_units') await fetchBusinessUnits();
    if (table === 'enterprise_users') await fetchEnterpriseUsers();
    if (table === 'user_groups') await fetchUserGroups();
    return true;
  };

  const updateAdminStatus = async (table: string, id: string, status: string) => {
    if (!supabase) return;
    await supabase.from(table).update({ status }).eq('id', id);
    if (table === 'organizations') await fetchOrganizations();
    if (table === 'business_units') await fetchBusinessUnits();
    if (table === 'enterprise_users') await fetchEnterpriseUsers();
    if (table === 'user_groups') await fetchUserGroups();
  };

  // \u2500\u2500\u2500 CRM CRUD \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const createRecord = async (page: string, data: any, lineItems: LineItem[]): Promise<boolean> => {
    if (!supabase || !currentUser) return false;
    const sys = buildSystemFields();
    const calcAmount = lineItems.reduce((s, i) => s + i.quantity * i.price, 0);

    try {
      switch (page) {
        case 'customers': {
          const id = generateId('CUST');
          const { error } = await supabase.from('customers').insert([{ ...sys, customer_number: id, name: data.name, company: data.company, industry: data.industry, email: data.email, phone: data.phone, website: data.website, billing_address: data.billingAddress, shipping_address: data.shippingAddress, city: data.city, state: data.state, postal_code: data.postalCode, country: data.country, gst_number: data.gstNumber, status: data.status || 'Active' }]);
          if (error) throw error;
          await logAudit({ recordType: 'customer', recordId: id, recordName: data.name, action: 'created' });
          await fetchCustomers(); break;
        }
        case 'products': {
          const id = generateId('PROD');
          const { error } = await supabase.from('products').insert([{ ...sys, product_number: id, name: data.name, category: data.category, price: Number(data.price || 0), status: data.status || 'Active' }]);
          if (error) throw error;
          await fetchProducts(); break;
        }
        case 'leads': {
          const id = generateId('LEAD');
          const { error } = await supabase.from('leads').insert([{ ...sys, lead_number: id, name: data.name, customer: data.customer, customer_id: data.customerId, contact: data.contact, contact_id: data.contactId, email: data.email, phone: data.phone, source: data.source, amount: Number(data.amount || 0), status: data.status || 'New' }]);
          if (error) throw error;
          if (lineItems.length) await supabase.from('lead_line_items').insert(lineItems.map(i => ({ lead_number: id, product_name: i.product, quantity: i.quantity, price: i.price })));
          await logAudit({ recordType: 'lead', recordId: id, recordName: data.name, action: 'created' });
          await runAssignmentRules('lead', id, data);
          await fetchLeads(); break;
        }
        case 'opportunities': {
          const id = generateId('OPP');
          const { error } = await supabase.from('opportunities').insert([{ ...sys, opportunity_number: id, name: data.name, customer: data.customer, customer_id: data.customerId, contact: data.contact, contact_id: data.contactId, stage: data.stage || 'Qualification', amount: Number(data.amount || 0), close_date: data.closeDate || null, status: data.status || 'Open' }]);
          if (error) throw error;
          if (lineItems.length) await supabase.from('opportunity_line_items').insert(lineItems.map(i => ({ opportunity_number: id, product_name: i.product, quantity: i.quantity, price: i.price })));
          await logAudit({ recordType: 'opportunity', recordId: id, recordName: data.name, action: 'created' });
          await fetchOpportunities(); break;
        }
        case 'orders': {
          const id = generateId('ORD');
          const { error } = await supabase.from('orders').insert([{ ...sys, order_number: id, name: data.name, customer: data.customer, customer_id: data.customerId, contact: data.contact, contact_id: data.contactId, amount: calcAmount, shipping_address: data.shippingAddressOrder || '', delivery_date: data.deliveryDate || null, status: data.status || 'Processing' }]);
          if (error) throw error;
          if (lineItems.length) await supabase.from('order_line_items').insert(lineItems.map(i => ({ order_number: id, product_name: i.product, quantity: i.quantity, price: i.price })));
          await logAudit({ recordType: 'order', recordId: id, recordName: data.name, action: 'created' });
          await fetchOrders(); break;
        }
        case 'invoices': {
          const id = generateId('INV');
          const { error } = await supabase.from('invoices').insert([{ ...sys, invoice_number: id, name: data.name, customer: data.customer, customer_id: data.customerId, contact: data.contact, contact_id: data.contactId, amount: calcAmount, due_date: data.dueDate || null, payment_terms: data.paymentTerms || '', billing_address: data.billingAddressInvoice || data.billingAddress || '', status: data.status || 'Pending' }]);
          if (error) throw error;
          if (lineItems.length) await supabase.from('invoice_line_items').insert(lineItems.map(i => ({ invoice_number: id, product_name: i.product, quantity: i.quantity, price: i.price })));
          await logAudit({ recordType: 'invoice', recordId: id, recordName: data.name, action: 'created' });
          await fetchInvoices(); break;
        }
        case 'contacts': {
          const id = generateId('CONT');
          const { error } = await supabase.from('contacts').insert([{ ...sys, contact_number: id, customer: data.customer, customer_id: data.customerId, name: data.name, email: data.email, phone: data.phone, designation: data.designation, department: data.department, status: data.status || 'Active' }]);
          if (error) throw error;
          await fetchContacts(); break;
        }
        case 'activities': {
          const id = generateId('ACT');
          const { error } = await supabase.from('activities').insert([{ ...sys, activity_number: id, name: data.name, customer: data.customer, customer_id: data.customerId, contact: data.contact, contact_id: data.contactId, subject: data.subject, activity_type: data.activityType, activity_date: data.activityDate, notes: data.notes, status: data.status || 'Open' }]);
          if (error) throw error;
          await fetchActivities(); break;
        }
      }
      return true;
    } catch (err: any) {
      console.error(err);
      alert(`Failed to create record: ${err.message}`);
      return false;
    }
  };

  const updateRecord = async (page: string, record: any, lineItems: LineItem[]) => {
    if (!supabase) return;
    const sys = buildSystemFields(true);
    const calcAmount = lineItems.reduce((s, i) => s + i.quantity * i.price, 0);

    const upsertLineItems = async (table: string, field: string, id: string) => {
      await supabase.from(table).delete().eq(field, id);
      if (lineItems.length) {
        await supabase.from(table).insert(lineItems.map(i => ({ [field]: id, product_name: i.product, quantity: i.quantity, price: i.price })));
      }
    };

    switch (page) {
      case 'customers':
        await supabase.from('customers').update({ ...sys, name: record.name, email: record.email, phone: record.phone, company: record.company, industry: record.industry, primary_contact_id: record.primaryContactId, billing_address: record.billingAddress, shipping_address: record.shippingAddress, city: record.city, state: record.state, postal_code: record.postalCode||record.postal_code||'', country: record.country||'', website: record.website||'', gst_number: record.gstNumber||record.gst_number||'', description: record.description||'', owner: record.owner||'', owner_id: record.owner_id||null, status: record.status }).eq('customer_number', record.id);
        await logAudit({ recordType: 'customer', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchCustomers(); break;
      case 'contacts':
        await supabase.from('contacts').update({ ...sys, customer: record.customer, customer_id: record.customerId||null, name: record.name, email: record.email||'', phone: record.phone||'', mobile: record.mobile||'', designation: record.designation||'', department: record.department||'', is_primary: record.isPrimary||false, linked_in: record.linkedIn||'', description: record.description||'', owner: record.owner||'', owner_id: record.owner_id||null, status: record.status }).eq('contact_number', record.id);
        if (record.isPrimary) await supabase.from('customers').update({ primary_contact_id: record.id }).eq('customer_number', record.customerId);
        await fetchContacts(); await fetchCustomers(); break;
      case 'products':
        await supabase.from('products').update({ ...sys, name: record.name, product_family: record.productFamily||'', category: record.category||'', sku: record.sku||'', price: Number(record.price||0), cost: Number(record.cost||0), unit: record.unit||'', tax_rate: Number(record.taxRate||record.tax_rate||0), description: record.description||'', owner: record.owner||'', status: record.status }).eq('id', record.id);
        await fetchProducts(); break;
      case 'leads':
        await supabase.from('leads').update({ ...sys, name: record.name, customer: record.customer, customer_id: record.customerId||null, contact: record.contact, contact_id: record.contactId||null, email: record.email||'', phone: record.phone||'', source: record.source||'', amount: calcAmount||Number(record.amount||0), expected_close_date: record.expectedCloseDate||null, billing_address: record.billingAddress||record.billing_address||'', shipping_address: record.shippingAddress||record.shipping_address||'', description: record.description||'', owner: record.owner||'', owner_id: record.owner_id||null, status: record.status }).eq('lead_number', record.id);
        await upsertLineItems('lead_line_items', 'lead_number', record.id);
        await logAudit({ recordType: 'lead', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchLeads(); break;
      case 'opportunities':
        await supabase.from('opportunities').update({ ...sys, name: record.name, customer: record.customer, customer_id: record.customerId||null, contact: record.contact, contact_id: record.contactId||null, stage: record.stage||'', amount: calcAmount||Number(record.amount||0), close_date: record.closeDate||null, probability: Number(record.probability||0), campaign: record.campaign||'', billing_address: record.billingAddress||record.billing_address||'', shipping_address: record.shippingAddress||record.shipping_address||'', description: record.description||'', owner: record.owner||'', owner_id: record.owner_id||null, status: record.status }).eq('opportunity_number', record.id);
        await upsertLineItems('opportunity_line_items', 'opportunity_number', record.id);
        await logAudit({ recordType: 'opportunity', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchOpportunities(); break;
      case 'orders':
        await supabase.from('orders').update({ ...sys, customer: record.customer, name: record.name, amount: calcAmount, shipping_address: record.shippingAddress, delivery_date: record.deliveryDate, status: record.status }).eq('order_number', record.id);
        await upsertLineItems('order_line_items', 'order_number', record.id);
        await logAudit({ recordType: 'order', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchOrders(); break;
      case 'invoices':
        await supabase.from('invoices').update({ ...sys, customer: record.customer, name: record.name, amount: calcAmount, due_date: record.dueDate, payment_terms: record.paymentTerms, billing_address: record.billingAddress, status: record.status }).eq('invoice_number', record.id);
        await upsertLineItems('invoice_line_items', 'invoice_number', record.id);
        await logAudit({ recordType: 'invoice', recordId: record.id, recordName: record.name, action: 'updated' });
        await fetchInvoices(); break;
      case 'activities':
        await supabase.from('activities').update({ ...sys, name: record.name, customer: record.customer, customer_id: record.customerId||null, contact: record.contact, contact_id: record.contactId||null, activity_type: record.activityType||'', activity_date: record.activityDate||null, due_date: record.dueDate||null, priority: record.priority||'Medium', description: record.description||'', notes: record.notes||'', owner: record.owner||'', owner_id: record.owner_id||null, status: record.status }).eq('activity_number', record.id);
        await fetchActivities(); break;
    }
  };

  // \u2500\u2500\u2500 Pipeline Actions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const convertLeadToOpportunity = async (lead: Lead) => {
    if (!supabase) return;
    await supabase.from('leads').update({ status: 'Converted', ...buildSystemFields(true) }).eq('lead_number', lead.id);
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'Converted' } : l));
    const leadItems = await fetchLineItems('lead_line_items', 'lead_number', lead.id);
    const totalAmount = leadItems.reduce((s, i) => s + i.quantity * i.price, 0);
    const id = generateId('OPP');
    await supabase.from('opportunities').insert([{ ...buildSystemFields(), opportunity_number: id, name: lead.name, customer: lead.customer, customer_id: lead.customerId, contact: lead.contact, contact_id: lead.contactId, stage: 'Qualification', amount: totalAmount, close_date: null, status: 'Open' }]);
    if (leadItems.length) await supabase.from('opportunity_line_items').insert(leadItems.map(i => ({ opportunity_number: id, product_name: i.product, quantity: i.quantity, price: i.price })));
    await logAudit({ recordType: 'lead', recordId: lead.id, recordName: lead.name, action: 'converted_to_opportunity' });
    await fetchOpportunities();
  };

  const createOrderFromOpportunity = async (opportunity: Opportunity) => {
    if (!supabase) return;
    await supabase.from('opportunities').update({ status: 'Closed Won', ...buildSystemFields(true) }).eq('opportunity_number', opportunity.id);
    setOpportunities(prev => prev.map(o => o.id === opportunity.id ? { ...o, status: 'Closed Won' } : o));
    const items = await fetchLineItems('opportunity_line_items', 'opportunity_number', opportunity.id);
    const totalAmount = items.reduce((s, i) => s + i.quantity * i.price, 0);
    const id = generateId('ORD');
    await supabase.from('orders').insert([{
      ...buildSystemFields(),
      order_number: id,
      name: opportunity.name,
      customer: opportunity.customer,
      customer_id: opportunity.customerId,
      contact: opportunity.contact,
      contact_id: opportunity.contactId,
      amount: totalAmount,
      currency: (opportunity as any).currency || 'INR',
      billing_address: (opportunity as any).billingAddress || (opportunity as any).billing_address || '',
      shipping_address: (opportunity as any).shippingAddress || (opportunity as any).shipping_address || '',
      payment_terms: (opportunity as any).paymentTerms || (opportunity as any).payment_terms || '',
      delivery_date: null,
      owner: opportunity.owner || currentUser?.email || '',
      owner_id: opportunity.owner_id || currentUser?.id || null,
      status: 'Draft',
    }]);
    if (items.length) await supabase.from('order_line_items').insert(items.map((i: any, idx: number) => ({
      order_number: id,
      product_name: i.product_name || i.product || '',
      product_code: i.product_code || '',
      description:  i.description  || '',
      quantity:     Number(i.quantity   || 1),
      price:        Number(i.price      || 0),
      list_price:   Number(i.list_price || i.price || 0),
      discount:     Number(i.discount   || 0),
      tax_pct:      Number(i.tax_pct    || 0),
      extended_price: Number(i.quantity||1) * Number(i.price||0) * (1 - Number(i.discount||0)/100),
      sort_order:   idx,
    })));
    await logAudit({ recordType: 'opportunity', recordId: opportunity.id, recordName: opportunity.name, action: 'converted_to_order' });
    await fetchOrders();
  };

  const createInvoiceFromOrder = async (order: Order) => {
    if (!supabase) return;
    await supabase.from('orders').update({ status: 'Delivered', ...buildSystemFields(true) }).eq('order_number', order.id);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Delivered' } : o));
    const items = await fetchLineItems('order_line_items', 'order_number', order.id);
    const totalAmount = items.reduce((s, i) => s + i.quantity * i.price, 0);
    const id = generateId('INV');
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);
    await supabase.from('invoices').insert([{
      ...buildSystemFields(),
      invoice_number: id,
      name: order.name,
      order_number: order.id,
      customer: order.customer,
      customer_id: order.customerId || (order as any).customer_id,
      contact: order.contact,
      contact_id: order.contactId || (order as any).contact_id,
      amount: totalAmount,
      currency: (order as any).currency || 'INR',
      billing_address: (order as any).billing_address || (order as any).billingAddress || '',
      shipping_address: (order as any).shipping_address || (order as any).shippingAddress || '',
      payment_terms: (order as any).payment_terms || (order as any).paymentTerms || '',
      overall_discount: (order as any).overall_discount || 0,
      shipping_cost: (order as any).shipping_cost || 0,
      subtotal: (order as any).subtotal || totalAmount,
      total_discount: (order as any).total_discount || 0,
      total_tax: (order as any).total_tax || 0,
      notes: (order as any).notes || '',
      due_date: dueDate.toISOString().split('T')[0],
      owner: order.owner || currentUser?.email || '',
      owner_id: order.owner_id || currentUser?.id || null,
      status: 'Pending',
    }]);
    if (items.length) await supabase.from('invoice_line_items').insert(items.map((i: any, idx: number) => ({
      invoice_number: id,
      product_name:   i.product_name || i.product || '',
      product_code:   i.product_code || '',
      description:    i.description  || '',
      quantity:       Number(i.quantity   || 1),
      price:          Number(i.price      || 0),
      list_price:     Number(i.list_price || i.price || 0),
      discount:       Number(i.discount   || 0),
      tax_pct:        Number(i.tax_pct    || 0),
      extended_price: Number(i.quantity||1) * Number(i.price||0) * (1 - Number(i.discount||0)/100),
      sort_order:     idx,
    })));
    await logAudit({ recordType: 'order', recordId: order.id, recordName: order.name, action: 'converted_to_invoice' });
    await fetchInvoices();
  };

  // \u2500\u2500\u2500 Quote Templates \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const saveQuoteTemplate = async (data: any, editingId?: string | null) => {
    if (!supabase) return;
    const payload = { name: data.name, company_name: data.companyName, company_email: data.companyEmail, company_phone: data.companyPhone, company_address: data.companyAddress, quote_title: data.quoteTitle, footer_text: data.footerText, terms_and_conditions: data.termsAndConditions, primary_color: data.primaryColor, secondary_color: data.secondaryColor };
    if (editingId) {
      await supabase.from('quote_templates').update(payload).eq('template_number', editingId);
    } else {
      const { error } = await supabase.from('quote_templates').insert([{ ...payload, template_number: generateId('TEMP'), is_default: false }]);
      if (error) { alert(error.message); return; }
    }
    await fetchQuoteTemplates();
  };

  const deleteQuoteTemplate = async (templateId: string) => {
    if (!supabase || !window.confirm('Delete this template?')) return;
    await supabase.from('quote_templates').delete().eq('template_number', templateId);
    await fetchQuoteTemplates();
  };

  const setDefaultTemplate = async (templateId: string) => {
    if (!supabase) return;
    await supabase.from('quote_templates').update({ is_default: false }).neq('id', '');
    await supabase.from('quote_templates').update({ is_default: true }).eq('template_number', templateId);
    await fetchQuoteTemplates();
  };

  // \u2500\u2500\u2500 Workflow CRUD \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const saveWorkflowRule = async (data: any, actions: any[], editingId?: string) => {
    if (!supabase || !currentUser) return;
    const sys = buildSystemFields(!!editingId);
    let ruleId = editingId || '';
    if (editingId) {
      await supabase.from('workflow_rules').update({ ...data, ...sys }).eq('id', editingId);
    } else {
      const { data: rule, error } = await supabase.from('workflow_rules').insert([{ ...data, ...buildSystemFields(), rule_number: generateId('WF') }]).select().single();
      if (error || !rule) { alert(error?.message || 'Error'); return; }
      ruleId = rule.id;
    }
    await supabase.from('workflow_actions').delete().eq('workflow_rule_id', ruleId);
    if (actions.length) {
      await supabase.from('workflow_actions').insert(actions.map((a, i) => ({ workflow_rule_id: ruleId, action_type: a.action_type, action_config: a.action_config, execution_order: i + 1 })));
    }
    await fetchWorkflowRules();
  };

  const deleteWorkflowRule = async (id: string) => {
    if (!supabase || !window.confirm('Delete this workflow rule?')) return;
    await supabase.from('workflow_rules').delete().eq('id', id);
    await fetchWorkflowRules();
  };

  const saveAssignmentRule = async (data: any, editingId?: string) => {
    if (!supabase || !currentUser) return;
    const sys = buildSystemFields(!!editingId);
    if (editingId) {
      await supabase.from('assignment_rules').update({ ...data, ...sys }).eq('id', editingId);
    } else {
      await supabase.from('assignment_rules').insert([{ ...data, ...buildSystemFields(), rule_number: generateId('AR') }]);
    }
    await fetchAssignmentRules();
  };

  const deleteAssignmentRule = async (id: string) => {
    if (!supabase || !window.confirm('Delete this rule?')) return;
    await supabase.from('assignment_rules').delete().eq('id', id);
    await fetchAssignmentRules();
  };

  const saveSLAPolicy = async (data: any, editingId?: string) => {
    if (!supabase || !currentUser) return;
    const sys = buildSystemFields(!!editingId);
    if (editingId) {
      await supabase.from('sla_policies').update({ ...data, ...sys }).eq('id', editingId);
    } else {
      await supabase.from('sla_policies').insert([{ ...data, ...buildSystemFields(), policy_number: generateId('SLA') }]);
    }
    await fetchSLAPolicies();
  };

  const deleteSLAPolicy = async (id: string) => {
    if (!supabase || !window.confirm('Delete this SLA policy?')) return;
    await supabase.from('sla_policies').delete().eq('id', id);
    await fetchSLAPolicies();
  };

  const saveApprovalProcess = async (data: any, steps: any[], editingId?: string) => {
    if (!supabase || !currentUser) return;
    let processId = editingId || '';
    if (editingId) {
      await supabase.from('approval_processes').update({ ...data, ...buildSystemFields(true) }).eq('id', editingId);
    } else {
      const { data: proc, error } = await supabase.from('approval_processes').insert([{ ...data, ...buildSystemFields(), process_number: generateId('AP') }]).select().single();
      if (error || !proc) { alert(error?.message || 'Error'); return; }
      processId = proc.id;
    }
    await supabase.from('approval_steps').delete().eq('approval_process_id', processId);
    if (steps.length) {
      await supabase.from('approval_steps').insert(steps.map((s, i) => ({ ...s, approval_process_id: processId, step_number: i + 1 })));
    }
    await fetchApprovalProcesses();
  };

  const deleteApprovalProcess = async (id: string) => {
    if (!supabase || !window.confirm('Delete this approval process?')) return;
    await supabase.from('approval_processes').delete().eq('id', id);
    await fetchApprovalProcesses();
  };

  const checkMatchingApprovalProcess = async (recordType, record) => {
    const procs = approvalProcesses.filter(p => p.object_type === recordType && p.is_active);
    for (const proc of procs) {
      const conds = proc.entry_conditions || [];
      const matched = conds.length === 0 || conds.every(c => {
        const val = record[c.field];
        if (c.operator === 'equals') return String(val) === String(c.value);
        if (c.operator === 'greater_than') return Number(val) > Number(c.value);
        if (c.operator === 'less_than') return Number(val) < Number(c.value);
        if (c.operator === 'contains') return String(val||'').toLowerCase().includes(String(c.value).toLowerCase());
        return false;
      });
      if (matched) return proc;
    }
    return null;
  };

  const submitForApproval = async (recordType: string, recordId: string, recordName: string) => {
    if (!supabase || !currentUser) return;
    const process = approvalProcesses.find(p => p.object_type === recordType && p.is_active);
    if (!process) { alert('No active approval process found for this record type.'); return; }
    const { data: steps } = await supabase.from('approval_steps').select('*').eq('approval_process_id', process.id).order('step_number');
    if (!steps?.length) { alert('No approval steps configured.'); return; }
    const firstStep = steps[0];
    const { error } = await supabase.from('approval_requests').insert([{
      request_number: generateId('REQ'), approval_process_id: process.id,
      current_step_id: firstStep.id, record_type: recordType, record_id: recordId,
      record_name: recordName, submitted_by: currentUser.email, submitted_at: new Date().toISOString(),
      status: 'Pending', organization_id: currentUser.organization_id, business_unit_id: currentUser.business_unit_id,
    }]);
    if (error) { alert(error.message); return; }
    const approverUser = enterpriseUsers.find(u => u.id === firstStep.approver_user_id);
    if (approverUser) {
      await createNotification({ recipientEmail: approverUser.email, type: 'approval', title: 'Approval Required', body: `${recordName} requires your approval.`, recordType, recordId });
    }
    await logAudit({ recordType, recordId, recordName, action: 'submitted_for_approval' });
    await fetchApprovalRequests();
    alert('Submitted for approval successfully.');
  };

  const processApproval = async (requestId: string, decision: 'Approved' | 'Rejected', comments: string) => {
    if (!supabase || !currentUser) return;
    const request = approvalRequests.find(r => r.id === requestId);
    if (!request) return;
    await supabase.from('approval_decisions').insert([{ approval_request_id: requestId, step_id: request.current_step_id, decided_by: currentUser.email, decision, comments, decided_at: new Date().toISOString() }]);
    await supabase.from('approval_requests').update({ status: decision, comments }).eq('id', requestId);
    await logAudit({ recordType: request.record_type, recordId: request.record_id, recordName: request.record_name, action: `approval_${decision.toLowerCase()}` });
    const submitterUser = enterpriseUsers.find(u => u.email === request.submitted_by);
    if (submitterUser) {
      await createNotification({ recipientEmail: submitterUser.email, type: 'approval', title: `Record ${decision}`, body: `${request.record_name} has been ${decision.toLowerCase()} by ${currentUser.email}.`, recordType: request.record_type, recordId: request.record_id });
    }
    await fetchApprovalRequests();
  };

  // \u2500\u2500\u2500 Assignment Rules Engine \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const runAssignmentRules = async (objectType: string, recordId: string, recordData: any) => {
    const rules = assignmentRules.filter(r => r.object_type === objectType && r.is_active).sort((a, b) => a.priority - b.priority);
    for (const rule of rules) {
      const value = recordData[rule.condition_field];
      let matches = false;
      if (rule.condition_operator === 'equals') matches = String(value) === rule.condition_value;
      else if (rule.condition_operator === 'contains') matches = String(value).includes(rule.condition_value);
      else if (rule.condition_operator === 'not_equals') matches = String(value) !== rule.condition_value;
      if (matches) {
        const assignee = enterpriseUsers.find(u => u.id === rule.assign_to_user_id);
        if (assignee) {
          await createNotification({ recipientEmail: assignee.email, type: 'assignment', title: 'New Record Assigned', body: `A new ${objectType} has been assigned to you.`, recordType: objectType, recordId });
        }
        break;
      }
    }
  };

  // \u2500\u2500\u2500 Effects \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    Promise.all([
      fetchCurrentUser(), fetchCustomers(), fetchProducts(), fetchLeads(),
      fetchOpportunities(), fetchOrders(), fetchInvoices(), fetchContacts(),
      fetchActivities(), fetchQuoteTemplates(), fetchOrganizations(), fetchBusinessUnits(),
      fetchEnterpriseUsers(), fetchUserGroups(), fetchRoles(), fetchPermissions(),
      fetchWorkflowRules(), fetchAssignmentRules(), fetchSLAPolicies(),
      fetchApprovalProcesses(), fetchApprovalRequests(),
      fetchQuotations(), fetchReports(), fetchSavedSearches(),
      fetchNotifications(), fetchAppPreferences(),
    ]);
    fetchExchangeRates(appPreferences?.default_currency || 'INR');
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.email) return;
    loadCurrentUserPermissions();
  }, [session?.user?.email, currentUser?.role_id]);

  useEffect(() => {
    if (!currentUser?.email) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.email]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // \u2500\u2500\u2500 Context Value \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500


  // ─── App Preferences (localStorage + Supabase) ────────────────────────────
  const _LS_KEY = 'bp_app_preferences';
  const _DEF_PREFS = { crm_enabled:true, cpq_enabled:true, default_currency:'INR', date_format:'DD/MM/YYYY', fiscal_year_start:'April', global_search_enabled:false };
  const _cp = (p) => ({ crm_enabled:p?.crm_enabled??true, cpq_enabled:p?.cpq_enabled??true, default_currency:p?.default_currency||'INR', date_format:p?.date_format||'DD/MM/YYYY', fiscal_year_start:p?.fiscal_year_start||'April', global_search_enabled:p?.global_search_enabled??false });
  // ─── Appearance ───────────────────────────────────────────────────────────
  const _APP_KEY = 'bp_appearance';
  const _DEF_APP = { company_logo_url:'', company_name:'Business Pro', theme:'navy', language:'en', font:'geist' };

  const [appearance, setAppearance] = useState(() => {
    try {
      const s = typeof window!=='undefined' && window.localStorage.getItem(_APP_KEY);
      if (s) return { ..._DEF_APP, ...JSON.parse(s) };
    } catch(e) {}
    return _DEF_APP;
  });

  const fetchAppearance = async () => {
    try {
      const s = window.localStorage.getItem(_APP_KEY);
      if (s) {
        const parsed = {..._DEF_APP,...JSON.parse(s)};
        setAppearance(parsed);
        applyAppearance(parsed);  // Apply immediately on load
      }
    } catch(e) {}
    if (!supabase) return;
    try {
      const { data } = await supabase.from('appearance').select('*').limit(1).maybeSingle();
      if (data) {
        const a = { ..._DEF_APP, ...data };
        setAppearance(a);
        window.localStorage.setItem(_APP_KEY, JSON.stringify(a));
        applyAppearance(a);
      }
    } catch(e) {}
  };

  const saveAppearance = async (data) => {
    const clean = { ..._DEF_APP, ...data };
    window.localStorage.setItem(_APP_KEY, JSON.stringify(clean));
    setAppearance(clean);
    applyAppearance(clean);
    if (!supabase) return;
    try {
      const { data:row } = await supabase.from('appearance').select('id').limit(1).maybeSingle();
      if (row?.id) await supabase.from('appearance').update(clean).eq('id', row.id);
      else await supabase.from('appearance').insert([clean]);
    } catch(e) { console.warn('saveAppearance Supabase error:', e); }
  };

  const THEME_COLORS: Record<string,any> = {
    navy:    { sidebar:'#0F172A', accent:'#3B82F6', to:'#1e3a8a' },
    slate:   { sidebar:'#1E293B', accent:'#64748B', to:'#334155' },
    emerald: { sidebar:'#064E3B', accent:'#10B981', to:'#065F46' },
    purple:  { sidebar:'#3B0764', accent:'#8B5CF6', to:'#581C87' },
    crimson: { sidebar:'#7F1D1D', accent:'#EF4444', to:'#991B1B' },
    ocean:   { sidebar:'#134E4A', accent:'#14B8A6', to:'#115E59' },
    charcoal:{ sidebar:'#111827', accent:'#6B7280', to:'#1F2937' },
    indigo:  { sidebar:'#1E1B4B', accent:'#6366F1', to:'#3730A3' },
  };
  const RTL_LANGS = ['ar'];

  const applyAppearance = (app: any) => {
    if (typeof document === 'undefined') return;
    const tc = THEME_COLORS[app.theme] || THEME_COLORS['navy'];

    // Inject/update a <style> tag that overrides the hardcoded Tailwind color classes
    const styleId = 'bp-theme-override';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    // Use attribute substring selectors — no CSS escaping needed, match by class value substring
    styleEl.textContent = [
      // Set CSS variables on root (used by Header inline style)
      `:root { --bp-primary: ${tc.sidebar}; --bp-secondary: ${tc.to}; --bp-accent: ${tc.accent}; }`,

      // Match any element with from-[#0F172A] in its class list
      `[class*="from-[#0F172A]"] {`,
      `  --tw-gradient-from: ${tc.sidebar} var(--tw-gradient-from-position) !important;`,
      `  --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgb(15 23 42 / 0)) !important;`,
      `}`,

      // Match bg-[#0F172A] — solid dark background
      `[class*="bg-[#0F172A]"] { background-color: ${tc.sidebar} !important; }`,

      // Match gradient-to colors
      `[class*="to-blue-900"] { --tw-gradient-to: ${tc.to} var(--tw-gradient-to-position) !important; }`,
      `[class*="to-blue-800"] { --tw-gradient-to: ${tc.to} var(--tw-gradient-to-position) !important; }`,
      `[class*="to-blue-700"] { --tw-gradient-to: ${tc.to} var(--tw-gradient-to-position) !important; }`,

      // Buttons and UI elements with dark backgrounds
      `[class*="bg-gradient-to-r"][class*="from-[#0F172A]"] {`,
      `  background-image: linear-gradient(to right, ${tc.sidebar}, ${tc.to}) !important;`,
      `}`,
      `[class*="bg-gradient-to-br"][class*="from-[#0F172A]"] {`,
      `  background-image: linear-gradient(to bottom right, ${tc.sidebar}, ${tc.to}) !important;`,
      `}`,
      `[class*="bg-gradient-to-r"][class*="from-blue-900"] {`,
      `  background-image: linear-gradient(to right, ${tc.sidebar}, ${tc.to}) !important;`,
      `}`,
    ].join("\n");

    // RTL for Arabic
    document.body.dir = RTL_LANGS.includes(app.language) ? 'rtl' : 'ltr';

    // Font
    if (app.font && app.font !== 'geist') {
      document.body.style.fontFamily = app.font + ', system-ui, sans-serif';
    } else {
      document.body.style.fontFamily = '';
    }
  };

  // Apply appearance on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const [appPreferences, setAppPreferences] = useState(() => { try { const s=typeof window!=='undefined'&&window.localStorage.getItem(_LS_KEY); if(s) return _cp(JSON.parse(s)); } catch(e) {} return _DEF_PREFS; });
  const fetchAppPreferences = async () => { try { const s=window.localStorage.getItem(_LS_KEY); if(s){setAppPreferences(_cp(JSON.parse(s)));return;} } catch(e) {} if(!supabase)return; try{const{data}=await supabase.from('app_preferences').select('*').limit(1).maybeSingle(); if(data){const p=_cp(data.settings?{..._cp(data),...data.settings}:data);setAppPreferences(p);window.localStorage.setItem(_LS_KEY,JSON.stringify(p));}}catch(e){} };
  const saveAppPreferences = async (prefs) => { const clean=_cp(prefs); window.localStorage.setItem(_LS_KEY,JSON.stringify(clean)); setAppPreferences(clean); if(!supabase)return; try{const{data:row}=await supabase.from('app_preferences').select('id').limit(1).maybeSingle(); const payload={settings:clean,default_currency:clean.default_currency,crm_enabled:clean.crm_enabled,cpq_enabled:clean.cpq_enabled,date_format:clean.date_format,fiscal_year_start:clean.fiscal_year_start,global_search_enabled:clean.global_search_enabled,updated_at:new Date().toISOString()}; if(row?.id)await supabase.from('app_preferences').update(payload).eq('id',row.id); else await supabase.from('app_preferences').insert([{...payload,organization_id:currentUser?.organization_id}]);}catch(e){} if(prefs.default_currency)fetchExchangeRates(prefs.default_currency); };

  // ─── Exchange Rates ────────────────────────────────────────────────────────
  const [exchangeRates, setExchangeRates] = useState({});
  const fetchExchangeRates = async (base='INR') => { try{const r=await fetch(`https://open.er-api.com/v6/latest/${base}`);const d=await r.json();if(d?.rates)setExchangeRates(d.rates);}catch(e){} };
  const convertCurrency = (amt,from,to) => { if(!amt||from===to)return amt; if(!exchangeRates[from]||!exchangeRates[to])return amt; return(amt/exchangeRates[from])*exchangeRates[to]; };

  // ─── Quotations ────────────────────────────────────────────────────────────
  const [quotations, setQuotations] = useState([]);
  const fetchQuotations = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('quotations').select('*').order('created_at', { ascending: false });
    if (error) console.error('fetchQuotations:', error);
    if (data) setQuotations(applyDataSecurity(data).map(q => ({ ...q, customerId: q.customer_id })));
  };
  const createQuotation = async (data,items=[]) => { if(!supabase||!currentUser)return null; const qNum=generateId('QUO'); const{error}=await supabase.from('quotations').insert([{...buildSystemFields(),quote_number:qNum,...data,status:data.status||'Draft',version:1,owner:data.owner||currentUser.email,owner_id:data.owner_id||currentUser.id}]); if(error){alert('Failed: '+error.message);return null;} if(items.length)await upsertLineItems('quotation_line_items','quote_number',qNum,items); await fetchQuotations(); return{quote_number:qNum}; };
  const updateQuotation = async (data,items=[]) => { if(!supabase)return; const{quote_number,...rest}=data; await supabase.from('quotations').update({...rest,...buildSystemFields(true)}).eq('quote_number',quote_number); if(items)await upsertLineItems('quotation_line_items','quote_number',quote_number,items); await fetchQuotations(); };
  const deleteQuotation = async (qNum) => { if(!supabase||!window.confirm('Delete?'))return; await supabase.from('quotation_line_items').delete().eq('quote_number',qNum); await supabase.from('quotations').delete().eq('quote_number',qNum); await fetchQuotations(); };
  const generateNewVersion = async (q) => { if(!supabase||!currentUser)return null; const qNum=generateId('QUO'); const v=(q.version||1)+1; const items=await fetchLineItems('quotation_line_items','quote_number',q.quote_number); await supabase.from('quotations').insert([{...buildSystemFields(),...q,quote_number:qNum,version:v,status:'Draft',id:undefined,created_at:new Date().toISOString()}]); if(items.length)await upsertLineItems('quotation_line_items','quote_number',qNum,items.map(i=>({...i,id:undefined}))); await fetchQuotations(); return{quote_number:qNum}; };
  const createQuotationFromOpportunity = async (opp) => { if(!supabase||!currentUser)return null; const items=await fetchLineItems('opportunity_line_items','opportunity_number',opp.id); const qNum=generateId('QUO'); const{error}=await supabase.from('quotations').insert([{...buildSystemFields(),quote_number:qNum,name:`Quote - ${opp.name}`,status:'Draft',version:1,customer:opp.customer||'',customer_id:opp.customerId||null,contact:opp.contact||'',contact_id:opp.contactId||null,opportunity_id:opp.id,currency:opp.currency||'INR',grand_total:Number(opp.amount||0),billing_address:opp.billingAddress||opp.billing_address||'',shipping_address:opp.shippingAddress||opp.shipping_address||'',payment_terms:opp.paymentTerms||opp.payment_terms||'',owner:opp.owner||currentUser.email,owner_id:opp.owner_id||currentUser.id}]); if(error){alert('Failed: '+error.message);return null;} if(items.length)await supabase.from('quotation_line_items').insert(items.map((i,idx)=>({quote_number:qNum,product_name:i.product||i.product_name||'',quantity:Number(i.quantity||1),unit_price:Number(i.price||0),discount_pct:Number(i.discount||0),tax_pct:0,sort_order:idx}))); await fetchQuotations(); return{quote_number:qNum}; };

  // ─── CPQ Flow: Quote→Order→Invoice, Opp→Order ─────────────────────────────
  const createOrderFromQuotation = async (quotation) => { if(!supabase||!currentUser)return null; const{data:qItems}=await supabase.from('quotation_line_items').select('*').eq('quote_number',quotation.quote_number).order('sort_order'); const li=qItems||[]; const sub=li.reduce((s,i)=>s+Number(i.quantity||1)*Number(i.unit_price||i.price||0),0); const disc=li.reduce((s,i)=>s+Number(i.quantity||1)*Number(i.unit_price||i.price||0)*(Number(i.discount_pct||i.discount||0)/100),0); const tax=li.reduce((s,i)=>{const n=Number(i.quantity||1)*Number(i.unit_price||i.price||0)*(1-Number(i.discount_pct||0)/100);return s+n*(Number(i.tax_pct||0)/100);},0); const od=sub*Number(quotation.overall_discount||0)/100; const gt=sub-disc+tax-od+Number(quotation.shipping_cost||0); const ordId=generateId('ORD'); const{error}=await supabase.from('orders').insert([{...buildSystemFields(),order_number:ordId,name:quotation.name||`Order - ${quotation.quote_number}`,quote_number:quotation.quote_number,customer:quotation.customer||'',customer_id:quotation.customer_id||null,contact:quotation.contact||'',contact_id:quotation.contact_id||null,billing_address:quotation.billing_address||'',shipping_address:quotation.shipping_address||'',payment_terms:quotation.payment_terms||'',currency:quotation.currency||'INR',overall_discount:Number(quotation.overall_discount||0),shipping_cost:Number(quotation.shipping_cost||0),subtotal:Number(sub.toFixed(2)),total_discount:Number((disc+od).toFixed(2)),total_tax:Number(tax.toFixed(2)),amount:Number(gt.toFixed(2)),status:'Draft',owner:quotation.owner||currentUser.email,owner_id:quotation.owner_id||currentUser.id}]); if(error){alert('Failed to create order: '+error.message);return null;} if(li.length)await supabase.from('order_line_items').insert(li.map((i,idx)=>({order_number:ordId,product_name:i.product_name||'',product_code:i.product_code||'',description:i.description||'',quantity:Number(i.quantity||1),price:Number(i.unit_price||i.price||0),list_price:Number(i.unit_price||i.price||0),discount:Number(i.discount_pct||i.discount||0),tax_pct:Number(i.tax_pct||0),extended_price:Number(i.quantity||1)*Number(i.unit_price||i.price||0)*(1-Number(i.discount_pct||0)/100),sort_order:idx}))); await supabase.from('quotations').update({status:'Ordered',...buildSystemFields(true)}).eq('quote_number',quotation.quote_number); setQuotations(prev=>prev.map(q=>q.quote_number===quotation.quote_number?{...q,status:'Ordered'}:q)); await fetchOrders(); return ordId; };

  // ─── Reports ───────────────────────────────────────────────────────────────
  const [reports, setReports] = useState([]);
  const fetchReports = async () => {
    if (!supabase || !currentUser) return;
    const { data } = await supabase.from('reports').select('*')
      .or(`created_by.eq.${currentUser.email},is_public.eq.true`)
      .order('created_at', { ascending: false });
    if (data) setReports(data);
  };
  const saveReport = async (data) => { if(!supabase||!currentUser)return null; let r; if(data.id){const{data:d}=await supabase.from('reports').update({...data,updated_at:new Date().toISOString()}).eq('id',data.id).select().single();r=d;}else{const{data:d}=await supabase.from('reports').insert([{...data,created_by:currentUser.email,organization_id:currentUser.organization_id,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}]).select().single();r=d;} await fetchReports(); return r; };
  const deleteReport = async (id) => { if(!supabase||!window.confirm('Delete?'))return; await supabase.from('reports').delete().eq('id',id); await fetchReports(); };

  // ─── Saved Searches ────────────────────────────────────────────────────────
  const [savedSearches, setSavedSearches] = useState([]);
  const fetchSavedSearches = async () => { if(!supabase||!currentUser)return; const{data}=await supabase.from('saved_searches').select('*').or(`created_by.eq.${currentUser.email},is_global_default.eq.true`).order('created_at',{ascending:false}); if(data)setSavedSearches(data); };
  const createSavedSearch = async (data) => { if(!supabase||!currentUser)return null; const{data:r}=await supabase.from('saved_searches').insert([{...data,created_by:currentUser.email,organization_id:currentUser.organization_id,created_at:new Date().toISOString()}]).select().single(); await fetchSavedSearches(); return r; };
  const deleteSavedSearch = async (id) => { if(!supabase)return; await supabase.from('saved_searches').delete().eq('id',id); await fetchSavedSearches(); };
  const setDefaultSavedSearch = async (id,isGlobal=false) => { if(!supabase||!currentUser)return; await supabase.from('saved_searches').update({is_default:false,is_global_default:false}).eq('created_by',currentUser.email); await supabase.from('saved_searches').update({is_default:true,is_global_default:isGlobal}).eq('id',id); await fetchSavedSearches(); };

  // ─── Notes / Comments / Attachments ───────────────────────────────────────
  const fetchRecordNotes = async (rType,rId) => { if(!supabase)return[]; const{data}=await supabase.from('record_notes').select('*').eq('record_type',rType).eq('record_id',rId).order('created_at',{ascending:false}); return data||[]; };
  const saveNote = async (rType,rId,note) => { if(!supabase||!currentUser)return; if(note.id)await supabase.from('record_notes').update({...note,updated_at:new Date().toISOString()}).eq('id',note.id); else await supabase.from('record_notes').insert([{...note,record_type:rType,record_id:rId,created_by:currentUser.email,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}]); };
  const deleteNote = async (id) => { if(!supabase)return; await supabase.from('record_notes').delete().eq('id',id); };
  const toggleNotePin = async (id,pinned) => { if(!supabase)return; await supabase.from('record_notes').update({is_pinned:!pinned}).eq('id',id); };
  const fetchRecordComments = async (rType,rId) => { if(!supabase)return[]; const{data}=await supabase.from('record_comments').select('*').eq('record_type',rType).eq('record_id',rId).order('created_at',{ascending:false}); return data||[]; };
  const postComment = async (rType,rId,body) => { if(!supabase||!currentUser)return; await supabase.from('record_comments').insert([{record_type:rType,record_id:rId,body,created_by:currentUser.email,created_at:new Date().toISOString()}]); };
  const deleteComment = async (id) => { if(!supabase)return; await supabase.from('record_comments').delete().eq('id',id); };
  const fetchRecordAttachments = async (rType,rId) => { if(!supabase)return[]; const{data}=await supabase.from('record_attachments').select('*').eq('record_type',rType).eq('record_id',rId).order('created_at',{ascending:false}); return data||[]; };
  const uploadAttachment = async (rType,rId,file) => { if(!supabase||!currentUser)return null; try{const path=`${rType}/${rId}/${Date.now()}_${file.name}`; const{error}=await supabase.storage.from('attachments').upload(path,file); if(error)return null; await supabase.from('record_attachments').insert([{record_type:rType,record_id:rId,file_name:file.name,file_path:path,file_size:file.size,created_by:currentUser.email,created_at:new Date().toISOString()}]); return path;}catch(e){return null;} };
  const deleteAttachment = async (id,path) => { if(!supabase)return; if(path)await supabase.storage.from('attachments').remove([path]); await supabase.from('record_attachments').delete().eq('id',id); };
  const getAttachmentUrl = (path) => { if(!supabase||!path)return null; const{data}=supabase.storage.from('attachments').getPublicUrl(path); return data?.publicUrl||null; };
  const fetchApprovalRequestsForRecord = async (rType,rId) => { if(!supabase)return[]; const{data}=await supabase.from('approval_requests').select('*').eq('record_type',rType).eq('record_id',rId).order('created_at',{ascending:false}); return data||[]; };
  const fetchAuditLog = async (rType,rId) => { if(!supabase)return[]; const{data}=await supabase.from('audit_logs').select('*').eq('record_type',rType).eq('record_id',rId).order('performed_at',{ascending:false}).limit(50); return data||[]; };
  const approveRecord = async (id,comments='') => { if(!supabase)return; await supabase.from('approval_requests').update({status:'Approved',comments,updated_at:new Date().toISOString()}).eq('id',id); await fetchApprovalRequests(); };
  const rejectRecord  = async (id,comments='') => { if(!supabase)return; await supabase.from('approval_requests').update({status:'Rejected',comments,updated_at:new Date().toISOString()}).eq('id',id); await fetchApprovalRequests(); };
  const decideApproval= async (id,action,comments='') => action==='approve'?approveRecord(id,comments):rejectRecord(id,comments);
  const recallApproval= async (id) => { if(!supabase)return; await supabase.from('approval_requests').update({status:'Recalled',updated_at:new Date().toISOString()}).eq('id',id); await fetchApprovalRequests(); };

  // ─── Extra UI State ────────────────────────────────────────────────────────
  const [pendingRecord,       setPendingRecord]       = useState(null);
  const [pendingOpenRecord,   setPendingOpenRecord]   = useState(null);
  const [adminActionMenu,     setAdminActionMenu]     = useState(null);
  const [adminModalMode,      setAdminModalMode]      = useState(null);
  const [selectedAdminRecord, setSelectedAdminRecord] = useState(null);
  const [organizationFormOpen,setOrganizationFormOpen]= useState(false);
  const [organizationFormData,setOrganizationFormData]= useState({});
  const [businessUnitFormOpen,setBusinessUnitFormOpen]= useState(false);
  const [businessUnitFormData,setBusinessUnitFormData]= useState({});
  const [userFormOpen,        setUserFormOpen]        = useState(false);
  const [userFormData,        setUserFormData]        = useState({});
  const [roleFormOpen,        setRoleFormOpen]        = useState(false);
  const [roleFormData,        setRoleFormData]        = useState({});
  const [userGroupFormOpen,   setUserGroupFormOpen]   = useState(false);
  const [userGroupFormData,   setUserGroupFormData]   = useState({});
  const [groupWorkspaceOpen,  setGroupWorkspaceOpen]  = useState(false);
  const [selectedGroupUsers,  setSelectedGroupUsers]  = useState([]);
  const [workflowFormOpen,    setWorkflowFormOpen]    = useState(false);
  const [workflowFormData,    setWorkflowFormData]    = useState({});
  const [assignmentFormOpen,  setAssignmentFormOpen]  = useState(false);
  const [assignmentFormData,  setAssignmentFormData]  = useState({});
  const [slaFormOpen,         setSLAFormOpen]         = useState(false);
  const [slaFormData,         setSLAFormData]         = useState({});
  const [approvalFormOpen,    setApprovalFormOpen]    = useState(false);
  const [approvalFormData,    setApprovalFormData]    = useState({});
  const [notificationDrawerOpen,setNotificationDrawerOpen]=useState(false);
  const [selectedRolePermissions,setSelectedRolePermissions]=useState([]);
  const [activePage,          setActivePage]          = useState('dashboard');
  const [selectedRecord,      setSelectedRecord]      = useState(null);
  const [editedRecord,        setEditedRecord]        = useState(null);
  const [searchTerm,          setSearchTerm]          = useState('');
  const [statusFilter,        setStatusFilter]        = useState('');
  const [createModalOpen,     setCreateModalOpen]     = useState(false);
  const [openActionMenu,      setOpenActionMenu]      = useState(null);
  const [lineItems,           setLineItems]           = useState([]);
  const [createFormData,      setCreateFormData]      = useState({});
  const [quotePreviewOpen,    setQuotePreviewOpen]    = useState(false);
  const [quoteLineItems,      setQuoteLineItems]      = useState([]);
  const [selectedQuoteTemplate,setSelectedQuoteTemplate]=useState(null);
  const [selectedQuoteOpportunity,setSelectedQuoteOpportunity]=useState(null);
  const [templateFormData,    setTemplateFormData]    = useState({});
  const [editingTemplateId,   setEditingTemplateId]   = useState(null);
  const printableQuoteRef = React.useRef(null);

  // deleteRecord
  const deleteRecord = async (page, recordId) => {
    if (!supabase||!window.confirm('Delete this record?')) return;
    const tableMap = { customers:'customers', leads:'leads', opportunities:'opportunities', orders:'orders', invoices:'invoices', contacts:'contacts', activities:'activities', products:'products' };
    const idFieldMap = { customers:'id', leads:'lead_number', opportunities:'opportunity_number', orders:'order_number', invoices:'invoice_number', contacts:'contact_number', activities:'activity_number', products:'id' };
    const table=tableMap[page]; const idField=idFieldMap[page]; if(!table)return;
    await supabase.from(table).delete().eq(idField, recordId);
    await logAudit({ recordType:page, recordId, recordName:recordId, action:'deleted' });
    const refs = { customers:fetchCustomers, leads:fetchLeads, opportunities:fetchOpportunities, orders:fetchOrders, invoices:fetchInvoices, contacts:fetchContacts, activities:fetchActivities, products:fetchProducts };
    await refs[page]?.();
  };

  const adminResetPassword = async (userId, newPass) => { try{await fetch('/api/admin/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,newPass})})}catch(e){} };


  const fetchRolePermissionsForEdit = async (roleId) => {
    if(!supabase||!roleId)return[];
    const{data}=await supabase.from('roles').select('permissions').eq('id',roleId).maybeSingle();
    const perms=data?.permissions||[];
    setSelectedRolePermissions(perms);
    return perms;
  };
  const value: AppContextValue = {
    session, authLoading, currentUser, currentUserPermissions, permissionsLoaded,
    handleLogin, handleLogout, resetMyPassword, saveMyProfile, loadCurrentUserPermissions,
    customers, contacts, products, leads, opportunities, orders, invoices, activities,
    organizations, businessUnits, enterpriseUsers, userGroups, userGroupMembers,
    roles, permissions, rolePermissions, quoteTemplates,
    workflowRules, assignmentRules, slaPolicies, approvalProcesses, approvalRequests,
    notifications, unreadCount, markNotificationRead, markAllNotificationsRead,
    fetchCustomers, fetchContacts, fetchProducts, fetchLeads, fetchOpportunities,
    fetchOrders, fetchInvoices, fetchActivities, fetchOrganizations, fetchBusinessUnits,
    fetchEnterpriseUsers, fetchUserGroups, fetchGroupMembers, fetchRoles, fetchPermissions,
    fetchRolePermissions, fetchQuoteTemplates, fetchWorkflowRules, fetchAssignmentRules,
    fetchSLAPolicies, fetchApprovalProcesses, fetchApprovalRequests, fetchNotifications,
    fetchLineItems, buildSystemFields, applyDataSecurity,
    saveOrganization, saveBusinessUnit, saveEnterpriseUser, saveUserGroup, saveRole,
    addUsersToGroup, removeUserFromGroup, deleteAdminRecord, updateAdminStatus,
    createRecord, updateRecord,
    convertLeadToOpportunity, createOrderFromOpportunity, createInvoiceFromOrder,
    saveQuoteTemplate, deleteQuoteTemplate, setDefaultTemplate,
    saveWorkflowRule, deleteWorkflowRule, saveAssignmentRule, deleteAssignmentRule,
    saveSLAPolicy, deleteSLAPolicy, saveApprovalProcess, deleteApprovalProcess,
    checkMatchingApprovalProcess, submitForApproval, processApproval,
    logAudit, createNotification,
    appearance, saveAppearance, fetchAppearance,
    // NEW ADDITIONS
    appPreferences, saveAppPreferences, fetchAppPreferences,
    exchangeRates, fetchExchangeRates, convertCurrency,
    quotations, fetchQuotations, createQuotation, updateQuotation, deleteQuotation, generateNewVersion,
    createQuotationFromOpportunity, createOrderFromQuotation,
    reports, fetchReports, saveReport, deleteReport,
    savedSearches, fetchSavedSearches, createSavedSearch, deleteSavedSearch, setDefaultSavedSearch,
    fetchRecordNotes, saveNote, deleteNote, toggleNotePin,
    fetchRecordComments, postComment, deleteComment,
    fetchRecordAttachments, uploadAttachment, deleteAttachment, getAttachmentUrl,
    fetchApprovalRequestsForRecord, fetchAuditLog,
    approveRecord, rejectRecord, decideApproval, recallApproval,
    pendingRecord, setPendingRecord, pendingOpenRecord, setPendingOpenRecord,
    adminActionMenu, setAdminActionMenu, adminModalMode, setAdminModalMode,
    selectedAdminRecord, setSelectedAdminRecord, adminResetPassword,
    organizationFormOpen, setOrganizationFormOpen, organizationFormData, setOrganizationFormData,
    businessUnitFormOpen, setBusinessUnitFormOpen, businessUnitFormData, setBusinessUnitFormData,
    userFormOpen, setUserFormOpen, userFormData, setUserFormData,
    roleFormOpen, setRoleFormOpen, roleFormData, setRoleFormData,
    userGroupFormOpen, setUserGroupFormOpen, userGroupFormData, setUserGroupFormData,
    groupWorkspaceOpen, setGroupWorkspaceOpen, selectedGroupUsers, setSelectedGroupUsers,
    workflowFormOpen, setWorkflowFormOpen, workflowFormData, setWorkflowFormData,
    assignmentFormOpen, setAssignmentFormOpen, assignmentFormData, setAssignmentFormData,
    slaFormOpen, setSLAFormOpen, slaFormData, setSLAFormData,
    approvalFormOpen, setApprovalFormOpen, approvalFormData, setApprovalFormData,
    notificationDrawerOpen, setNotificationDrawerOpen,
    selectedRolePermissions, setSelectedRolePermissions, fetchRolePermissions: fetchRolePermissionsForEdit,
    activePage, setActivePage, selectedRecord, setSelectedRecord, editedRecord, setEditedRecord,
    searchTerm, setSearchTerm, statusFilter, setStatusFilter,
    createModalOpen, setCreateModalOpen, openActionMenu, setOpenActionMenu,
    lineItems, setLineItems, createFormData, setCreateFormData,
    quotePreviewOpen, setQuotePreviewOpen, quoteLineItems, setQuoteLineItems,
    selectedQuoteTemplate, setSelectedQuoteTemplate, selectedQuoteOpportunity, setSelectedQuoteOpportunity,
    templateFormData, setTemplateFormData, editingTemplateId, setEditingTemplateId,
    printableQuoteRef, deleteRecord,

  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
