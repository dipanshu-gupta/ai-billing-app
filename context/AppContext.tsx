// @ts-nocheck

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
// supabase client injected via AppProvider props (from TenantContext)
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

export function AppProvider({ children, supabase = null }: { children: React.ReactNode }) {
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
  const [invoiceTemplates, setInvoiceTemplates] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

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
    const isAdmin    = currentUserPermissions.includes('__admin__') || (currentUser as any)?.is_admin === true;
    const dataScope  = (currentUser as any)?.data_scope || (isAdmin ? 'all' : 'own');
    const viewAll    = currentUserPermissions.includes('view_all_records');
    const viewTeam   = currentUserPermissions.includes('view_team_records');

    // data_scope: 'all' → no filtering, 'org' → org filter, 'bu' → org+BU filter, 'own' → owner filter
    if (isAdmin || dataScope === 'all' || viewAll) return records;

    if (dataScope === 'org') {
      return records.filter((r: any) =>
        !r.organization_id || r.organization_id === (currentUser as any).organization_id
      );
    }

    if (dataScope === 'bu') {
      return records.filter((r: any) => {
        const orgMatch = !r.organization_id || r.organization_id === (currentUser as any).organization_id;
        const buMatch  = !r.business_unit_id || r.business_unit_id === (currentUser as any).business_unit_id;
        return orgMatch && buMatch;
      });
    }

    // 'own' scope or view_team_records
    if (viewTeam) {
      // Managers see their org's data
      return records.filter((r: any) =>
        !r.organization_id || r.organization_id === (currentUser as any).organization_id
      );
    }

    // Default: own records only
    return records.filter((r: any) =>
      !r.owner_id || r.owner_id === currentUser.id || r.owner === currentUser.email
    );
  }, [currentUser, currentUserPermissions]);

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
    if (!supabase || !session?.user) return;
    // Try auth_user_id first (most reliable)
    let { data } = await supabase
      .from('enterprise_users').select('*')
      .eq('auth_user_id', session.user.id).maybeSingle();
    // Fallback: email match
    if (!data && session.user.email) {
      const { data: d2 } = await supabase
        .from('enterprise_users').select('*')
        .ilike('email', session.user.email).maybeSingle();
      data = d2;
    }
    if (data) {
      setCurrentUser(data);
      // If auth_user_id not set in DB, update it now
      if (!data.auth_user_id && session.user.id) {
        await supabase.from('enterprise_users')
          .update({ auth_user_id: session.user.id })
          .eq('id', data.id);
      }
    }
  };

  const loadCurrentUserPermissions = async () => {
    if (!supabase || !session?.user) return;
    setPermissionsLoaded(false);
    // Try by auth_user_id first (most reliable), then email
    let { data: userData } = await supabase
      .from('enterprise_users').select('*, roles(id, role_name, role_code, data_scope)')
      .eq('auth_user_id', session.user.id).maybeSingle();
    if (!userData) {
      const { data: d2 } = await supabase
        .from('enterprise_users').select('*, roles(id, role_name, role_code, data_scope)')
        .ilike('email', session.user.email || '').maybeSingle();
      userData = d2;
    }
    if (!userData?.role_id) {
      setCurrentUserPermissions([]);
      setPermissionsLoaded(true);
      return;
    }
    // Store data_scope on currentUser for applyDataSecurity
    if (userData.roles?.data_scope) {
      setCurrentUser((u: any) => u ? { ...u, data_scope: userData.roles.data_scope } : u);
    }
    const { data: rpData } = await supabase
      .from('role_permissions').select('permission_id').eq('role_id', userData.role_id);
    const ids = (rpData || []).map((x: any) => x.permission_id);
    if (!ids.length) {
      // If user is_admin, grant __admin__ even with no role permissions
      if (userData.is_admin) {
        setCurrentUserPermissions(['__admin__']);
      } else {
        setCurrentUserPermissions([]);
      }
      setPermissionsLoaded(true);
      return;
    }
    const { data: permsData } = await supabase
      .from('permissions').select('permission_code').in('id', ids);
    const codes = (permsData || []).map((x: any) => x.permission_code);
    // Always inject __admin__ if user has is_admin flag, regardless of DB permissions
    if (userData.is_admin && !codes.includes('__admin__')) {
      codes.push('__admin__');
    }
    setCurrentUserPermissions(codes);
    setPermissionsLoaded(true);
  };

  // ─── RBAC helpers ─────────────────────────────────────────────────────────
  // Returns true if user has the given permission code OR is an admin (__admin__)
  const hasPermission = (code: string): boolean => {
    if (!permissionsLoaded) return true; // optimistic while loading
    if (currentUserPermissions.includes('__admin__')) return true;
    return currentUserPermissions.includes(code);
  };

  // Returns true if the current user is an admin (system admin role)
  const isAdmin = (): boolean => {
    return currentUserPermissions.includes('__admin__') ||
           (currentUser as any)?.role_code === 'ADMIN' ||
           (currentUser as any)?.is_admin === true;
  };

  // Applies owner-scope filtering on top of org/BU security:
  // Admins/Managers see all; regular users see only their own records
  const applyOwnerScope = (records: any[]): any[] => {
    if (isAdmin()) return records;
    if (hasPermission('view_team_records')) return records; // manager-level
    // Regular user: own records only
    if (!currentUser) return records;
    return records.filter((r: any) =>
      !r.owner_id || r.owner_id === currentUser.id ||
      r.owner === currentUser.email
    );
  };

  // \u2500\u2500\u2500 Fetch: CRM \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const fetchCustomers = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (error) console.error(error);
    if (data) {
      const secured = applyDataSecurity(data);
      setCustomers(secured.map((c: any) => ({
        ...c,
        id: c.customer_number, displayNumber: c.display_number, primaryContactId: c.primary_contact_id, primaryContact: c.primary_contact||'',
        name: c.name, email: c.email, phone: c.phone, company: c.company, industry: c.industry,
        billingAddress: c.billing_address, shippingAddress: c.shipping_address,
        city: c.city, state: c.state, postalCode: c.postal_code, country: c.country,
        website: c.website, gstNumber: c.gst_number, status: c.status,
        owner: c.owner||'', owner_id: c.owner_id||null,
        description: c.description||'',
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
        ...c,
        id: c.contact_number, displayNumber: c.display_number, customerId: c.customer_id, customer: c.customer,
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
        ...p,
        id: p.product_number || p.id, displayNumber: p.display_number, _uuid: p.id, name: p.name, category: p.category,
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
        ...l,
        id: l.lead_number, displayNumber: l.display_number, name: l.name, customer: l.customer, customerId: l.customer_id,
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
        ...o,
        id: o.opportunity_number, displayNumber: o.display_number, name: o.name, customer: o.customer, customerId: o.customer_id,
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
        ...o,
        id: o.order_number, displayNumber: o.display_number, name: o.name, customer: o.customer, customerId: o.customer_id,
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
        ...inv,
        id: inv.invoice_number, displayNumber: inv.display_number, name: inv.name, customer: inv.customer, customerId: inv.customer_id,
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
        ...a,
        id: a.activity_number, displayNumber: a.display_number, name: a.name, customer: a.customer, customerId: a.customer_id,
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
  }

  // Provider-level line item upsert — used by quotation CRUD (richer payload than updateRecord's local one)
  const upsertLineItemsGeneric = async (table: string, fkField: string, id: string, items: any[]) => {
    if (!supabase || !items) return;
    await supabase.from(table).delete().eq(fkField, id);
    if (items.length) {
      await supabase.from(table).insert(items.map((i: any, idx: number) => ({
        [fkField]:      id,
        product_name:   i.product_name || i.product || '',
        quantity:       Number(i.quantity   || 1),
        unit_price:     Number(i.unit_price ?? i.price ?? 0),
        list_price:     Number(i.list_price ?? i.unit_price ?? i.price ?? 0),
        discount_pct:   Number(i.discount_pct ?? i.discount ?? 0),
        tax_pct:        Number(i.tax_pct    || 0),
        extended_price: Number(i.quantity||1) * Number(i.unit_price ?? i.price ?? 0) * (1 - Number(i.discount_pct ?? i.discount ?? 0)/100),
        sort_order:     idx,
      })));
    }
  }
  // ─── Customer status automation: Prospect on lead/opp/quote, Active on order/invoice ──
  const autoSetCustomerStatus = async (customerId: string, target: 'Prospect'|'Active') => {
    if (!supabase || !customerId) return;
    try {
      const { data: cust } = await supabase.from('customers').select('status').eq('customer_number', customerId).maybeSingle();
      const current = cust?.status || 'New';
      // Active always wins; Prospect only upgrades from New/empty
      const shouldUpdate = target === 'Active'
        ? current !== 'Active'
        : ['New','','Prospect'].includes(current) && current !== 'Prospect';
      if (shouldUpdate) {
        await supabase.from('customers').update({ status: target, updated_at: new Date().toISOString() }).eq('customer_number', customerId);
        await fetchCustomers();
      }
    } catch(e) { console.warn('autoSetCustomerStatus:', e); }
  };

  // ════════════════════════════════════════════════════════════════════════
  // ─── B2C RETAIL MODULE: state + CRUD for 5 retail objects ────────────────
  // ════════════════════════════════════════════════════════════════════════
  const [retailCustomers,  setRetailCustomers]  = useState<any[]>([]);
  const [retailProducts,   setRetailProducts]   = useState<any[]>([]);
  const [retailActivities, setRetailActivities] = useState<any[]>([]);
  const [retailOrders,     setRetailOrders]     = useState<any[]>([]);
  const [retailInvoices,   setRetailInvoices]   = useState<any[]>([]);

  const fetchRetailCustomers = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('retail_customers').select('*').order('created_at', { ascending: false });
    if (error) { if (!String(error.message).includes('does not exist')) console.error('fetchRetailCustomers:', error.message); return; }
    if (data) setRetailCustomers(applyDataSecurity(data).map((c: any) => ({ ...c, id: c.customer_number, _uuid: c.id, displayNumber: c.display_number })));
  };

  const fetchRetailProducts = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('retail_products').select('*').order('created_at', { ascending: false });
    if (error) { if (!String(error.message).includes('does not exist')) console.error('fetchRetailProducts:', error.message); return; }
    if (data) setRetailProducts(applyDataSecurity(data).map((p: any) => ({ ...p, id: p.product_number, _uuid: p.id, displayNumber: p.display_number })));
  };

  const fetchRetailActivities = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('retail_activities').select('*').order('created_at', { ascending: false });
    if (error) { if (!String(error.message).includes('does not exist')) console.error('fetchRetailActivities:', error.message); return; }
    if (data) setRetailActivities(applyDataSecurity(data).map((a: any) => ({ ...a, id: a.activity_number, _uuid: a.id, displayNumber: a.display_number })));
  };

  const fetchRetailOrders = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('retail_orders').select('*').order('created_at', { ascending: false });
    if (error) { if (!String(error.message).includes('does not exist')) console.error('fetchRetailOrders:', error.message); return; }
    if (data) setRetailOrders(applyDataSecurity(data).map((o: any) => ({ ...o, id: o.order_number, _uuid: o.id, displayNumber: o.display_number })));
  };

  const fetchRetailInvoices = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('retail_invoices').select('*').order('created_at', { ascending: false });
    if (error) { if (!String(error.message).includes('does not exist')) console.error('fetchRetailInvoices:', error.message); return; }
    if (data) setRetailInvoices(applyDataSecurity(data).map((i: any) => ({ ...i, id: i.invoice_number, _uuid: i.id, displayNumber: i.display_number })));
  };

  // ─── Retail line items (orders / invoices) ────────────────────────────────
  const fetchRetailLineItems = async (table: 'retail_order_line_items'|'retail_invoice_line_items', fkField: string, id: string) => {
    if (!supabase || !id) return [];
    const { data, error } = await supabase.from(table).select('*').eq(fkField, id).order('sort_order');
    if (error) { console.error(`fetchRetailLineItems(${table}):`, error.message); return []; }
    return data || [];
  };

  const upsertRetailLineItems = async (table: 'retail_order_line_items'|'retail_invoice_line_items', fkField: string, id: string, items: any[]) => {
    if (!supabase || !id) return;
    await supabase.from(table).delete().eq(fkField, id);
    if (items && items.length) {
      await supabase.from(table).insert(items.map((i: any, idx: number) => ({
        [fkField]:      id,
        product_name:   i.product_name || i.product || '',
        product_code:   i.product_code || '',
        description:    i.description  || '',
        quantity:       Number(i.quantity   || 1),
        unit_price:     Number(i.unit_price ?? i.price ?? 0),
        list_price:     Number(i.list_price ?? i.unit_price ?? i.price ?? 0),
        discount_pct:   Number(i.discount_pct ?? i.discount ?? 0),
        // Tax fields — store whichever regime fields are present on the line
        hsn_code:        i.hsn_code ?? null,
        gst_rate:        i.gst_rate != null ? Number(i.gst_rate) : null,
        taxable:         i.taxable ?? null,
        sales_tax_rate:  i.sales_tax_rate != null ? Number(i.sales_tax_rate) : null,
        vat_rate:        i.vat_rate != null ? Number(i.vat_rate) : null,
        tax_pct:         i.tax_pct != null ? Number(i.tax_pct) : null,
        extended_price: Number(i.extended_price ?? (
          Number(i.quantity||1) * Number(i.unit_price ?? i.price ?? 0) * (1 - Number(i.discount_pct ?? i.discount ?? 0)/100)
        )),
        sort_order:     idx,
      })));
    }
  };

  // ─── Retail Customer: status automation (Active on first order, VIP on loyalty milestone) ──
  const autoSetRetailCustomerStatus = async (customerId: string, target: 'Active'|'VIP') => {
    if (!supabase || !customerId) return;
    try {
      const { data: cust } = await supabase.from('retail_customers').select('status,loyalty_points').eq('customer_number', customerId).maybeSingle();
      if (!cust) return;
      const current = cust.status || 'Active';
      if (target === 'VIP' && current !== 'VIP' && Number(cust.loyalty_points || 0) >= 1000) {
        await supabase.from('retail_customers').update({ status: 'VIP', loyalty_tier: 'Gold', updated_at: new Date().toISOString() }).eq('customer_number', customerId);
        await fetchRetailCustomers();
      } else if (target === 'Active' && current !== 'Active' && current !== 'VIP') {
        await supabase.from('retail_customers').update({ status: 'Active', updated_at: new Date().toISOString() }).eq('customer_number', customerId);
        await fetchRetailCustomers();
      }
    } catch (e) { console.warn('autoSetRetailCustomerStatus:', e); }
  };

  // ─── Generic createRetailRecord / updateRetailRecord / deleteRetailRecord ──
  const RETAIL_TABLE_MAP: Record<string, { table: string; idField: string; prefix: string; fetch: () => void; lineItemTable?: string; lineFK?: string }> = {
    retailCustomers:  { table: 'retail_customers',  idField: 'customer_number', prefix: 'RCUST', fetch: () => fetchRetailCustomers() },
    retailProducts:   { table: 'retail_products',   idField: 'product_number',  prefix: 'RPROD', fetch: () => fetchRetailProducts() },
    retailActivities: { table: 'retail_activities', idField: 'activity_number', prefix: 'RACT',  fetch: () => fetchRetailActivities() },
    retailOrders:     { table: 'retail_orders',     idField: 'order_number',    prefix: 'RORD',  fetch: () => fetchRetailOrders(),   lineItemTable: 'retail_order_line_items',   lineFK: 'order_number' },
    retailInvoices:   { table: 'retail_invoices',   idField: 'invoice_number',  prefix: 'RINV',  fetch: () => fetchRetailInvoices(), lineItemTable: 'retail_invoice_line_items', lineFK: 'invoice_number' },
  };

  // Allowed columns per retail table — prevents cross-object default fields leaking into wrong table
  const RETAIL_ALLOWED_COLS: Record<string, string[]> = {
    retail_customers:  ['name','phone','email','date_of_birth','gender','address_line1','address_line2','city','state','postal_code','country','loyalty_points','loyalty_tier','preferred_contact','marketing_opt_in','notes','comments','status','owner','owner_id','owner_name','organization_id','business_unit_id','custom_data'],
    retail_products:   ['name','category','brand','sku','barcode','unit','price','mrp','cost','stock_quantity','reorder_level','description','hsn_code','gst_rate','taxable','tax_category','vat_rate','tax_rate','status','owner','owner_id','owner_name','comments','organization_id','business_unit_id','custom_data'],
    retail_activities: ['subject','activity_type','customer','customer_id','activity_date','due_date','priority','status','description','notes','comments','owner','owner_id','owner_name','organization_id','business_unit_id','custom_data'],
    retail_orders:     ['customer','customer_id','customer_phone','order_date','channel','currency','payment_method','payment_status','delivery_method','delivery_address','delivery_date','subtotal','total_discount','total_tax','shipping_cost','amount','place_of_supply','gstin','tax_state','resale_certificate','vat_registration_number','tax_registration_number','status','notes','comments','owner','owner_id','owner_name','organization_id','business_unit_id','custom_data'],
    retail_invoices:   ['order_number','customer','customer_id','customer_phone','invoice_date','due_date','currency','subtotal','total_discount','total_tax','shipping_cost','amount','payment_method','payment_status','place_of_supply','gstin','tax_state','resale_certificate','vat_registration_number','tax_registration_number','status','notes','comments','owner','owner_id','owner_name','organization_id','business_unit_id','custom_data','invoice_template_id'],
  };

  const createRetailRecord = async (page: keyof typeof RETAIL_TABLE_MAP, data: any, items: any[] = []) => {
    if (!supabase || !currentUser) return null;
    const cfg = RETAIL_TABLE_MAP[page];
    if (!cfg) return null;
    const newId = generateId(cfg.prefix);
    const allowed = RETAIL_ALLOWED_COLS[cfg.table] || [];
    const filtered: any = {};
    allowed.forEach(k => { if (data[k] !== undefined) filtered[k] = data[k]; });
    const payload: any = {
      ...buildSystemFields(),
      [cfg.idField]: newId,
      ...filtered,
      owner: data.owner || currentUser.email,
      owner_id: data.owner_id || currentUser.id,
    };
    delete payload.id; delete payload._uuid;
    const { data: inserted, error } = await supabase.from(cfg.table).insert([payload]).select().single();
    if (error) { alert('Save failed: ' + error.message); return null; }
    if (cfg.lineItemTable && items.length) {
      await upsertRetailLineItems(cfg.lineItemTable as any, cfg.lineFK!, newId, items);
    }
    // Status automations
    if (page === 'retailOrders' || page === 'retailInvoices') {
      await autoSetRetailCustomerStatus(data.customer_id, 'Active');
    }
    await runAutomations(page, newId, { ...data, id: newId }, 'on_create');
    await cfg.fetch();
    return { ...inserted, id: inserted[cfg.idField], _uuid: inserted.id };
  };

  const updateRetailRecord = async (page: keyof typeof RETAIL_TABLE_MAP, record: any, items: any[] = []) => {
    if (!supabase) return;
    const cfg = RETAIL_TABLE_MAP[page];
    if (!cfg) return;
    const payload: any = { ...record, ...buildSystemFields(true) };
    // Strip all client-side computed fields that have no DB column
    delete payload.id;
    delete payload._uuid;
    delete payload[cfg.idField];
    delete payload.displayNumber;
    delete payload.display_number;
    delete payload.customerId;
    delete payload.primaryContactId;
    payload.customer    = record.customer;    // keep customer name
    payload.custom_data = record.custom_data || {}; // keep JSONB custom fields
    const { error } = await supabase.from(cfg.table).update(payload).eq(cfg.idField, record.id);
    if (error) { console.error(`update ${cfg.table}:`, error.message); alert('Save failed: ' + error.message); return; }
    if (cfg.lineItemTable) {
      await upsertRetailLineItems(cfg.lineItemTable as any, cfg.lineFK!, record.id, items);
    }
    if (page === 'retailOrders' || page === 'retailInvoices') {
      await autoSetRetailCustomerStatus(record.customer_id, 'Active');
    }
    await runAutomations(page, record.id, record, 'on_update');
    await cfg.fetch();
  };

  const deleteRetailRecord = async (page: keyof typeof RETAIL_TABLE_MAP, recordId: string) => {
    if (!supabase || !window.confirm('Delete this record?')) return;
    const cfg = RETAIL_TABLE_MAP[page];
    if (!cfg) return;
    if (cfg.lineItemTable) await supabase.from(cfg.lineItemTable).delete().eq(cfg.lineFK!, recordId);
    await supabase.from(cfg.table).delete().eq(cfg.idField, recordId);
    await cfg.fetch();
  };

  // ─── Retail Order → Retail Invoice conversion ──────────────────────────────
  const createRetailInvoiceFromOrder = async (order: any) => {
    if (!supabase || !currentUser) return null;
    const items = await fetchRetailLineItems('retail_order_line_items', 'order_number', order.id);
    const invId = generateId('RINV');
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
    const payload: any = {
      ...buildSystemFields(),
      invoice_number: invId,
      order_number: order.id,
      customer: order.customer || '',
      customer_id: order.customer_id || null,
      customer_phone: order.customer_phone || '',
      currency: order.currency || 'INR',
      subtotal: Number(order.subtotal || 0),
      total_discount: Number(order.total_discount || 0),
      total_tax: Number(order.total_tax || 0),
      shipping_cost: Number(order.shipping_cost || 0),
      amount: Number(order.amount || 0),
      payment_method: order.payment_method || 'Cash',
      payment_status: order.payment_status || 'Paid',
      place_of_supply: order.place_of_supply || '',
      gstin: order.gstin || '',
      tax_state: order.tax_state || '',
      resale_certificate: order.resale_certificate || '',
      vat_registration_number: order.vat_registration_number || '',
      tax_registration_number: order.tax_registration_number || '',
      due_date: dueDate.toISOString().split('T')[0],
      status: 'Paid',
      owner: order.owner || currentUser.email,
      owner_id: order.owner_id || currentUser.id,
    };
    const { data: inserted, error } = await supabase.from('retail_invoices').insert([payload]).select().single();
    if (error) { alert('Failed to create invoice: ' + error.message); return null; }
    if (items.length) await upsertRetailLineItems('retail_invoice_line_items', 'invoice_number', invId, items);
    await autoSetRetailCustomerStatus(order.customer_id, 'Active');
    await fetchRetailInvoices();
    return { ...inserted, id: inserted.invoice_number, _uuid: inserted.id };
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
        ...t,
        id: t.id, dbId: t.id, name: t.name, isDefault: t.is_default,
        sections: t.sections || [], page_settings: t.page_settings || {}, global_settings: t.global_settings || {},
        primaryColor: t.primary_color, secondaryColor: t.secondary_color,
        companyName: t.company_name,
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

  const saveEnterpriseUser = async (data: any, editingId?: string, password?: string) => {
    if (!supabase) return;
    if (editingId) {
      await supabase.from('enterprise_users').update(data).eq('id', editingId);
      await fetchEnterpriseUsers();
      return;
    }
    // New user — create auth account via API
    if (password && data.email) {
      const tenant = (window as any).__bp_tenant || {};
      let res: Response | null = null;
      try {
        res = await fetch('/api/users/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email:            data.email,
            password,
            first_name:       data.first_name       || '',
            last_name:        data.last_name         || '',
            role_id:          data.role_id           || null,
            designation:      data.designation       || '',
            organization_id:  data.organization_id   || null,
            business_unit_id: data.business_unit_id  || null,
            status:           data.status            || 'Active',
            is_admin:         data.is_admin          || false,
            employee_code:    data.employee_code     || null,
            username:         data.username          || null,
            phone:            data.phone             || null,
            db_url:           tenant.db_url          || null,
          }),
        });
      } catch(e) {
        console.warn('[saveEnterpriseUser] fetch error:', e);
      }

      if (res) {
        const text = await res.text();
        console.log('[saveEnterpriseUser] status:', res.status, 'body:', text.slice(0,500));
        let json: any = {};
        try { json = JSON.parse(text); } catch(e) {
          alert('API error (status ' + res.status + '): ' + text.slice(0,200));
          await supabase.from('enterprise_users').insert([data]);
          await fetchEnterpriseUsers();
          return;
        }
        if (res.ok && json.success) {
          await fetchEnterpriseUsers();
          return;
        }
        alert('Could not create auth account: ' + (json?.error || json?.hint || text.slice(0,200)));
      }
    }
    // Fallback: insert enterprise_user only (no auth)
    await supabase.from('enterprise_users').insert([data]);
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

  const createRecord = async (page: string, data: any, lineItems: LineItem[] = []): Promise<{id:string,name:string}|null> => {
    if (!supabase || !currentUser) return false;
    const sys = buildSystemFields();
    const calcAmount = (lineItems||[]).reduce((s, i) => s + (i.quantity||1) * (i.price||0), 0);

    try {
      switch (page) {
        case 'customers': {
          const id = generateId('CUST');
          const { error } = await supabase.from('customers').insert([{ ...sys, custom_data: data.custom_data||{}, owner: data.owner||currentUser?.email||'', owner_id: data.owner_id||currentUser?.id||null, comments: data.comments||'', customer_number: id, name: data.name, company: data.company, industry: data.industry, email: data.email, phone: data.phone, website: data.website, billing_address: data.billingAddress, shipping_address: data.shippingAddress, city: data.city, state: data.state, postal_code: data.postalCode, country: data.country, gst_number: data.gstNumber, status: data.status || 'Active' }]);
          if (error) throw error;
          await logAudit({ recordType: 'customer', recordId: id, recordName: data.name, action: 'created' });
          await runAutomations('customers', id, data, 'on_create');
          await fetchCustomers(); return { id, name: data.name };
        }
        case 'products': {
          const id = generateId('PROD');
          const { data: insertedProd, error } = await supabase.from('products').insert([{ ...sys, custom_data: data.custom_data||{}, product_number: id, owner: data.owner||currentUser?.email||'', owner_id: data.owner_id||currentUser?.id||null, comments: data.comments||'', name: data.name, category: data.category, price: Number(data.price || 0), status: data.status || 'Active' }]).select().single();
          if (error) throw error;
          await runAutomations('products', insertedProd?.id ?? id, { ...data, id: insertedProd?.id, product_number: id }, 'on_create');
          await fetchProducts(); return { id, name: data.name };
        }
        case 'leads': {
          const id = generateId('LEAD');
          const { error } = await supabase.from('leads').insert([{ ...sys, custom_data: data.custom_data||{}, owner: data.owner||currentUser?.email||'', owner_id: data.owner_id||currentUser?.id||null, comments: data.comments||'', lead_number: id, name: data.name, customer: data.customer, customer_id: data.customerId, contact: data.contact, contact_id: data.contactId, email: data.email, phone: data.phone, source: data.source, amount: Number(data.amount || 0), status: data.status || 'New' }]);
          if (error) throw error;
          if (lineItems.length) await supabase.from('lead_line_items').insert(lineItems.map(i => ({ lead_number: id, product_name: i.product, quantity: i.quantity, price: i.price })));
          await logAudit({ recordType: 'lead', recordId: id, recordName: data.name, action: 'created' });
          await runAutomations('leads', id, data, 'on_create');
          await fetchLeads(); await autoSetCustomerStatus(data.customerId, 'Prospect'); return { id, name: data.name };
        }
        case 'opportunities': {
          const id = generateId('OPP');
          const { error } = await supabase.from('opportunities').insert([{ ...sys, custom_data: data.custom_data||{}, owner: data.owner||currentUser?.email||'', owner_id: data.owner_id||currentUser?.id||null, comments: data.comments||'', opportunity_number: id, name: data.name, customer: data.customer, customer_id: data.customerId, contact: data.contact, contact_id: data.contactId, stage: data.stage || 'Qualification', amount: Number(data.amount || 0), close_date: data.closeDate || null, status: data.status || 'Open' }]);
          if (error) throw error;
          if (lineItems.length) await supabase.from('opportunity_line_items').insert(lineItems.map(i => ({ opportunity_number: id, product_name: i.product, quantity: i.quantity, price: i.price })));
          await logAudit({ recordType: 'opportunity', recordId: id, recordName: data.name, action: 'created' });
          await runAutomations('opportunities', id, data, 'on_create');
          await fetchOpportunities(); await autoSetCustomerStatus(data.customerId, 'Prospect'); return { id, name: data.name };
        }
        case 'orders': {
          const id = generateId('ORD');
          const { error } = await supabase.from('orders').insert([{ ...sys, custom_data: data.custom_data||{}, owner: data.owner||currentUser?.email||'', owner_id: data.owner_id||currentUser?.id||null, comments: data.comments||'', order_number: id, name: data.name, customer: data.customer, customer_id: data.customerId, contact: data.contact, contact_id: data.contactId, amount: calcAmount, shipping_address: data.shippingAddressOrder || '', delivery_date: data.deliveryDate || null, status: data.status || 'Processing' }]);
          if (error) throw error;
          if (lineItems.length) await supabase.from('order_line_items').insert(lineItems.map(i => ({ order_number: id, product_name: i.product, quantity: i.quantity, price: i.price })));
          await logAudit({ recordType: 'order', recordId: id, recordName: data.name, action: 'created' });
          await runAutomations('orders', id, data, 'on_create');
          await fetchOrders(); await autoSetCustomerStatus(data.customerId, 'Active'); return { id, name: data.name };
        }
        case 'invoices': {
          const id = generateId('INV');
          const { error } = await supabase.from('invoices').insert([{ ...sys, custom_data: data.custom_data||{}, owner: data.owner||currentUser?.email||'', owner_id: data.owner_id||currentUser?.id||null, comments: data.comments||'', invoice_number: id, name: data.name, customer: data.customer, customer_id: data.customerId, contact: data.contact, contact_id: data.contactId, amount: calcAmount, due_date: data.dueDate || null, payment_terms: data.paymentTerms || '', billing_address: data.billingAddressInvoice || data.billingAddress || '', status: data.status || 'Pending' }]);
          if (error) throw error;
          if (lineItems.length) await supabase.from('invoice_line_items').insert(lineItems.map(i => ({ invoice_number: id, product_name: i.product, quantity: i.quantity, price: i.price })));
          await logAudit({ recordType: 'invoice', recordId: id, recordName: data.name, action: 'created' });
          await runAutomations('invoices', id, data, 'on_create');
          await fetchInvoices(); await autoSetCustomerStatus(data.customerId, 'Active'); return { id, name: data.name };
        }
        case 'contacts': {
          const id = generateId('CONT');
          const { error } = await supabase.from('contacts').insert([{ ...sys, custom_data: data.custom_data||{}, owner: data.owner||currentUser?.email||'', owner_id: data.owner_id||currentUser?.id||null, comments: data.comments||'', is_primary: data.isPrimary||false, contact_number: id, customer: data.customer, customer_id: data.customerId, name: data.name, email: data.email, phone: data.phone, designation: data.designation, department: data.department, status: data.status || 'Active' }]);
          if (data.isPrimary && data.customerId) {
            await supabase.from('contacts').update({ is_primary: false }).eq('customer_id', data.customerId).neq('contact_number', id);
            await supabase.from('customers').update({ primary_contact_id: id }).eq('customer_number', data.customerId);
          }
          if (error) throw error;
          await runAutomations('contacts', id, data, 'on_create');
          await fetchContacts(); return { id, name: data.name };
        }
        case 'activities': {
          const id = generateId('ACT');
          const { error } = await supabase.from('activities').insert([{ ...sys, custom_data: data.custom_data||{}, owner: data.owner||currentUser?.email||'', owner_id: data.owner_id||currentUser?.id||null, comments: data.comments||'', activity_number: id, name: data.name, customer: data.customer, customer_id: data.customerId, contact: data.contact, contact_id: data.contactId, subject: data.subject, activity_type: data.activityType, activity_date: data.activityDate, notes: data.notes, status: data.status || 'Open' }]);
          if (error) throw error;
          await runAutomations('activities', id, data, 'on_create');
          await fetchActivities(); return { id, name: data.name };
        }
      }
      return null;
    } catch (err: any) {
      console.error(err);
      alert(`Failed to create record: ${err.message}`);
      return null;
    }
  };

  const updateRecord = async (page: string, record: any, lineItems: LineItem[]) => {
    if (!supabase) return;
    const sys = buildSystemFields(true);
    const calcAmount = (lineItems||[]).reduce((s, i) => s + (i.quantity||1) * (i.price||0), 0);

    const upsertLineItems = async (table: string, field: string, id: string) => {
      await supabase.from(table).delete().eq(field, id);
      if (lineItems.length) {
        await supabase.from(table).insert(lineItems.map(i => ({ [field]: id, product_name: i.product, quantity: i.quantity, price: i.price })));
      }
    };

    switch (page) {
      case 'customers': {
        const { error: e_customers } = await supabase.from('customers').update({ ...sys, custom_data: record.custom_data||{}, name: record.name, email: record.email, phone: record.phone, company: record.company, industry: record.industry, primary_contact_id: record.primaryContactId, billing_address: record.billingAddress, shipping_address: record.shippingAddress, city: record.city, state: record.state, postal_code: record.postalCode||record.postal_code||'', country: record.country||'', website: record.website||'', gst_number: record.gstNumber||record.gst_number||'', description: record.description||'', owner: record.owner||'', owner_id: record.owner_id||null, status: record.status, comments: record.comments||'' }).eq('customer_number', record.id);
        if (e_customers) { console.error('update customers:', e_customers.message); alert('Save failed: ' + e_customers.message); return; }
        await logAudit({ recordType: 'customer', recordId: record.id, recordName: record.name, action: 'updated' });
        await runAutomations('customers', record.id, record, 'on_update');
        await fetchCustomers(); break; }
      case 'contacts': {
        const { error: e_contacts } = await supabase.from('contacts').update({ ...sys, custom_data: record.custom_data||{}, customer: record.customer, customer_id: record.customerId||null, name: record.name, email: record.email||'', phone: record.phone||'', mobile: record.mobile||'', designation: record.designation||'', department: record.department||'', is_primary: record.isPrimary||false, linked_in: record.linkedIn||'', description: record.description||'', owner: record.owner||'', owner_id: record.owner_id||null, status: record.status, comments: record.comments||'' }).eq('contact_number', record.id);
        if (e_contacts) { console.error('update contacts:', e_contacts.message); alert('Save failed: ' + e_contacts.message); return; }
        if (record.isPrimary && record.customerId) {
          await supabase.from('contacts').update({ is_primary: false }).eq('customer_id', record.customerId).neq('contact_number', record.id);
          await supabase.from('customers').update({ primary_contact_id: record.id }).eq('customer_number', record.customerId);
        }
        await runAutomations('contacts', record.id, record, 'on_update');
        await fetchContacts(); await fetchCustomers(); break; }
      case 'products': {
        const { error: e_products } = await supabase.from('products').update({ ...sys, custom_data: record.custom_data||{}, name: record.name, product_family: record.productFamily||'', category: record.category||'', sku: record.sku||'', price: Number(record.price||0), cost: Number(record.cost||0), unit: record.unit||'', tax_rate: Number(record.taxRate||record.tax_rate||0), hsn_code: record.hsn_code||'', gst_rate: record.gst_rate!=null?Number(record.gst_rate):null, taxable: record.taxable||'', tax_category: record.tax_category||'', vat_rate: record.vat_rate!=null?Number(record.vat_rate):null, description: record.description||'', owner: record.owner||'', status: record.status, comments: record.comments||'' }).eq('id', record._uuid || record.id);
        if (e_products) { console.error('update products:', e_products.message); alert('Save failed: ' + e_products.message); return; }
        await runAutomations('products', record._uuid || record.id, record, 'on_update');
        await fetchProducts(); return { id, name: data.name }; }
      case 'leads': {
        const { error: e_leads } = await supabase.from('leads').update({ ...sys, custom_data: record.custom_data||{}, name: record.name, customer: record.customer, customer_id: record.customerId||null, contact: record.contact, contact_id: record.contactId||null, email: record.email||'', phone: record.phone||'', source: record.source||'', amount: calcAmount||Number(record.amount||0), expected_close_date: record.expectedCloseDate||null, billing_address: record.billingAddress||record.billing_address||'', shipping_address: record.shippingAddress||record.shipping_address||'', description: record.description||'', owner: record.owner||'', owner_id: record.owner_id||null, status: record.status, comments: record.comments||'' }).eq('lead_number', record.id);
        if (e_leads) { console.error('update leads:', e_leads.message); alert('Save failed: ' + e_leads.message); return; }
        await upsertLineItems('lead_line_items', 'lead_number', record.id);
        await logAudit({ recordType: 'lead', recordId: record.id, recordName: record.name, action: 'updated' });
        await runAutomations('leads', record.id, record, 'on_update');
        await fetchLeads(); break; }
      case 'opportunities': {
        const { error: e_opportunities } = await supabase.from('opportunities').update({ ...sys, custom_data: record.custom_data||{}, name: record.name, customer: record.customer, customer_id: record.customerId||null, contact: record.contact, contact_id: record.contactId||null, stage: record.stage||'', amount: calcAmount||Number(record.amount||0), close_date: record.closeDate||null, probability: Number(record.probability||0), campaign: record.campaign||'', billing_address: record.billingAddress||record.billing_address||'', shipping_address: record.shippingAddress||record.shipping_address||'', description: record.description||'', owner: record.owner||'', owner_id: record.owner_id||null, status: record.status, comments: record.comments||'' }).eq('opportunity_number', record.id);
        if (e_opportunities) { console.error('update opportunities:', e_opportunities.message); alert('Save failed: ' + e_opportunities.message); return; }
        await upsertLineItems('opportunity_line_items', 'opportunity_number', record.id);
        await logAudit({ recordType: 'opportunity', recordId: record.id, recordName: record.name, action: 'updated' });
        await runAutomations('opportunities', record.id, record, 'on_update');
        await fetchOpportunities(); break; }
      case 'orders': {
        const { error: e_orders } = await supabase.from('orders').update({
          ...sys, customer: record.customer, customer_id: record.customerId||record.customer_id||null,
          contact: record.contact||'', contact_id: record.contactId||record.contact_id||null,
          name: record.name, amount: calcAmount||Number(record.amount||0), currency: record.currency||'INR',
          billing_address: record.billing_address||record.billingAddress||'',
          shipping_address: record.shipping_address||record.shippingAddress||'',
          payment_terms: record.payment_terms||record.paymentTerms||'',
          shipping_terms: record.shipping_terms||'',
          overall_discount: Number(record.overall_discount||0), shipping_cost: Number(record.shipping_cost||0),
          subtotal: Number(record.subtotal||0), total_discount: Number(record.total_discount||0), total_tax: Number(record.total_tax||0),
          notes: record.notes||'', delivery_date: record.deliveryDate||record.delivery_date||null,
          owner: record.owner||'', owner_id: record.owner_id||null,
          status: record.status, comments: record.comments||''
        }).eq('order_number', record.id);
        if (e_orders) { console.error('update orders:', e_orders.message); alert('Save failed: ' + e_orders.message); return; }
        // NOTE: line items for orders are saved by CPQRecordDetail directly — do NOT upsert here (avoids overwrite race)
        await logAudit({ recordType: 'order', recordId: record.id, recordName: record.name, action: 'updated' });
        await runAutomations('orders', record.id, record, 'on_update');
        await fetchOrders(); break; }
      case 'invoices': {
        const { error: e_invoices } = await supabase.from('invoices').update({
          ...sys, customer: record.customer, customer_id: record.customerId||record.customer_id||null,
          contact: record.contact||'', contact_id: record.contactId||record.contact_id||null,
          name: record.name, amount: calcAmount||Number(record.amount||0), currency: record.currency||'INR',
          billing_address: record.billing_address||record.billingAddress||'',
          shipping_address: record.shipping_address||record.shippingAddress||'',
          payment_terms: record.payment_terms||record.paymentTerms||'',
          overall_discount: Number(record.overall_discount||0), shipping_cost: Number(record.shipping_cost||0),
          subtotal: Number(record.subtotal||0), total_discount: Number(record.total_discount||0), total_tax: Number(record.total_tax||0),
          notes: record.notes||'', due_date: record.dueDate||record.due_date||null,
          owner: record.owner||'', owner_id: record.owner_id||null,
          status: record.status, comments: record.comments||''
        }).eq('invoice_number', record.id);
        if (e_invoices) { console.error('update invoices:', e_invoices.message); alert('Save failed: ' + e_invoices.message); return; }
        // NOTE: line items for invoices are saved by CPQRecordDetail directly — do NOT upsert here (avoids overwrite race)
        await logAudit({ recordType: 'invoice', recordId: record.id, recordName: record.name, action: 'updated' });
        await runAutomations('invoices', record.id, record, 'on_update');
        await fetchInvoices(); break; }
      case 'activities': {
        const { error: e_activities } = await supabase.from('activities').update({ ...sys, custom_data: record.custom_data||{}, name: record.name, customer: record.customer, customer_id: record.customerId||null, contact: record.contact, contact_id: record.contactId||null, activity_type: record.activityType||'', activity_date: record.activityDate||null, due_date: record.dueDate||null, priority: record.priority||'Medium', description: record.description||'', notes: record.notes||'', owner: record.owner||'', owner_id: record.owner_id||null, status: record.status, comments: record.comments||'' }).eq('activity_number', record.id);
        if (e_activities) { console.error('update activities:', e_activities.message); alert('Save failed: ' + e_activities.message); return; }
        await runAutomations('activities', record.id, record, 'on_update');
        await fetchActivities(); break; }
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
    await supabase.from('opportunities').insert([{ ...buildSystemFields(), owner: lead.owner||currentUser?.email||'', owner_id: lead.owner_id||currentUser?.id||null, opportunity_number: id, name: lead.name, customer: lead.customer, customer_id: lead.customerId, contact: lead.contact, contact_id: lead.contactId, stage: 'Qualification', amount: totalAmount, close_date: null, status: 'Open' }]);
    if (leadItems.length) await supabase.from('opportunity_line_items').insert(leadItems.map(i => ({ opportunity_number: id, product_name: i.product||i.product_name, product_id: i.product_id||null, quantity: i.quantity, price: i.price, unit_price: i.unit_price||i.price, discount_pct: i.discount_pct||i.discount||0, tax_pct: i.tax_pct||0, configuration: i.configuration||{} })));
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
    await autoSetCustomerStatus(opportunity.customerId, 'Active'); await fetchOrders();
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
    await autoSetCustomerStatus(order.customerId || (order as any).customer_id, 'Active'); await fetchInvoices();
  };

  // \u2500\u2500\u2500 Quote Templates \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const saveQuoteTemplate = async (data: any, editingId?: string | null) => {
    if (!supabase) return;
    const payload = {
      name: data.name,
      sections: data.sections || [],
      page_settings: data.page_settings || {},
      global_settings: data.global_settings || {},
      primary_color: data.primaryColor || data.primary_color || '#0F172A',
      secondary_color: data.secondaryColor || data.secondary_color || '#3B82F6',
      // Legacy fields for backwards compat
      company_name: data.companyName || '',
      primary_color: data.primaryColor || '#0F172A',
      updated_at: new Date().toISOString(),
    };
    if (editingId) {
      const { error } = await supabase.from('quote_templates').update(payload).eq('id', editingId);
      if (error) { alert('Save failed: ' + error.message); return; }
    } else {
      const tNum = generateId('TEMP');
      const { error } = await supabase.from('quote_templates').insert([{ ...payload, template_number: tNum, is_default: false, created_by: currentUser?.email }]);
      if (error) { alert('Save failed: ' + error.message); return; }
    }
    await fetchQuoteTemplates();
  };

  // ─── Invoice Templates ────────────────────────────────────────────────────
  const fetchInvoiceTemplates = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('invoice_templates').select('*').order('created_at', { ascending: false });
    if (data) setInvoiceTemplates(data.map((t: any) => ({
      ...t, id: t.template_number || t.id, dbId: t.id, isDefault: t.is_default,
    })));
  };

  const saveInvoiceTemplate = async (data: any, editingId?: string | null) => {
    if (!supabase) return;
    const payload = {
      name: data.name, sections: data.sections, page_settings: data.page_settings,
      primary_color: data.primaryColor, secondary_color: data.secondaryColor,
      is_default: data.isDefault || false,
      updated_at: new Date().toISOString(),
    };
    if (editingId) {
      const { error } = await supabase.from('invoice_templates').update(payload).eq('id', editingId);
      if (error) { alert('Save failed: ' + error.message); return; }
    } else {
      const tNum = 'INVTPL-' + Date.now();
      const { error } = await supabase.from('invoice_templates').insert([{ ...payload, template_number: tNum, created_by: currentUser?.email }]);
      if (error) { alert('Save failed: ' + error.message); return; }
    }
    await fetchInvoiceTemplates();
  };

  const deleteInvoiceTemplate = async (templateId: string) => {
    if (!supabase || !window.confirm('Delete this invoice template?')) return;
    await supabase.from('invoice_templates').delete().eq('id', templateId);
    await fetchInvoiceTemplates();
  };

  const setDefaultInvoiceTemplate = async (templateId: string) => {
    if (!supabase) return;
    await supabase.from('invoice_templates').update({ is_default: false }).neq('id', '');
    await supabase.from('invoice_templates').update({ is_default: true }).eq('id', templateId);
    await fetchInvoiceTemplates();
  };

  // ─── Warehouses / Subinventories ──────────────────────────────────────────
  const fetchWarehouses = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('warehouses').select('*').order('name');
    if (data) setWarehouses(data);
  };

  const saveWarehouse = async (data: any, editingId?: string) => {
    if (!supabase) return;
    const payload = { ...data, updated_at: new Date().toISOString() };
    if (editingId) {
      const { error } = await supabase.from('warehouses').update(payload).eq('id', editingId);
      if (error) { alert('Save failed: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('warehouses').insert([{ ...payload, created_at: new Date().toISOString() }]);
      if (error) { alert('Save failed: ' + error.message); return; }
    }
    await fetchWarehouses();
  };

  const deleteWarehouse = async (id: string) => {
    if (!supabase || !window.confirm('Delete this warehouse/location?')) return;
    await supabase.from('warehouses').delete().eq('id', id);
    await fetchWarehouses();
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
    // Strip virtual/client-only fields before sending to DB
    const { id: _id, _uuid, customerId, ...cleanData } = data as any;
    let ruleId = editingId || '';
    if (editingId) {
      const { error } = await supabase.from('workflow_rules').update({ ...cleanData, ...buildSystemFields(true) }).eq('id', editingId);
      if (error) { alert('Save failed: ' + error.message); return; }
    } else {
      const { data: rule, error } = await supabase.from('workflow_rules').insert([{ ...cleanData, ...buildSystemFields(), rule_number: generateId('WF') }]).select().single();
      if (error || !rule) { alert(error?.message || 'Error saving workflow rule'); return; }
      ruleId = rule.id;
    }
    // Replace all actions atomically
    await supabase.from('workflow_actions').delete().eq('workflow_rule_id', ruleId);
    if (actions.length) {
      const { error: actErr } = await supabase.from('workflow_actions').insert(
        actions.map((a, i) => ({ workflow_rule_id: ruleId, action_type: a.action_type, action_config: a.action_config || {}, execution_order: i + 1 }))
      );
      if (actErr) console.error('workflow_actions insert:', actErr.message);
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
    const { id: _id, _uuid, customerId, ...cleanData } = data as any;
    // Convert empty UUID strings to null
    cleanData.assign_to_user_id  = cleanData.assign_to_user_id  || null;
    cleanData.assign_to_group_id = cleanData.assign_to_group_id || null;
    if (editingId) {
      const { error } = await supabase.from('assignment_rules').update({ ...cleanData, ...buildSystemFields(true) }).eq('id', editingId);
      if (error) { alert('Save failed: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('assignment_rules').insert([{ ...cleanData, ...buildSystemFields(), rule_number: generateId('AR') }]);
      if (error) { alert('Save failed: ' + error.message); return; }
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
    const { id: _id, _uuid, customerId, ...cleanData } = data as any;
    // Convert empty UUID strings to null
    cleanData.escalate_to_user_id  = cleanData.escalate_to_user_id  || null;
    cleanData.escalate_to_group_id = cleanData.escalate_to_group_id || null;
    if (editingId) {
      const { error } = await supabase.from('sla_policies').update({ ...cleanData, ...buildSystemFields(true) }).eq('id', editingId);
      if (error) { alert('Save failed: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('sla_policies').insert([{ ...cleanData, ...buildSystemFields(), policy_number: generateId('SLA') }]);
      if (error) { alert('Save failed: ' + error.message); return; }
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
    // Strip client-only fields; ensure conditions saved as JSONB 'conditions' column
    const { id: _id, _uuid, customerId, entry_conditions, ...cleanData } = data as any;
    // conditions comes from the UI ConditionBuilder as { logic, conditions[] }
    const payload = { ...cleanData, ...buildSystemFields(!!editingId) };
    let processId = editingId || '';
    if (editingId) {
      const { error } = await supabase.from('approval_processes').update(payload).eq('id', editingId);
      if (error) { alert('Save failed: ' + error.message); return; }
    } else {
      const { data: proc, error } = await supabase.from('approval_processes')
        .insert([{ ...payload, process_number: generateId('AP') }]).select().single();
      if (error || !proc) { alert(error?.message || 'Error saving approval process'); return; }
      processId = proc.id;
    }
    // Replace steps atomically — strip client fields from each step too
    await supabase.from('approval_steps').delete().eq('approval_process_id', processId);
    if (steps.length) {
      const stepRows = steps.map((s, i) => {
        const { id: _sid, _uuid: _su, ...cleanStep } = s;
        return {
          ...cleanStep,
          approval_process_id: processId,
          step_number: i + 1,
          // Convert empty strings to null for UUID columns
          approver_user_id:  cleanStep.approver_user_id  || null,
          approver_group_id: cleanStep.approver_group_id || null,
        };
      });
      const { error: stepErr } = await supabase.from('approval_steps').insert(stepRows);
      if (stepErr) { alert('Error saving steps: ' + stepErr.message); return; }
    }
    await fetchApprovalProcesses();
  };

  const deleteApprovalProcess = async (id: string) => {
    if (!supabase || !window.confirm('Delete this approval process?')) return;
    await supabase.from('approval_processes').delete().eq('id', id);
    await fetchApprovalProcesses();
  };

  

  const submitForApproval = async (recordType: string, recordId: string, recordName: string, matchedProcess?: any) => {
    if (!supabase || !currentUser) return;
    // Use the pre-matched process if provided, otherwise find first active one for this type
    const process = matchedProcess || approvalProcesses.find(p => p.object_type === recordType && p.is_active);
    if (!process) { alert('No active approval process found for this record type.'); return; }
    // Load steps fresh from DB to get current step IDs
    const { data: steps, error: stepsErr } = await supabase
      .from('approval_steps').select('*').eq('approval_process_id', process.id).order('step_number');
    if (stepsErr || !steps?.length) { alert('No approval steps configured for this process.'); return; }
    const firstStep = steps[0];
    // Check if already pending
    const { data: existing } = await supabase.from('approval_requests')
      .select('id').eq('record_id', recordId).eq('record_type', recordType).eq('status', 'Pending').maybeSingle();
    if (existing) { alert('An approval request is already pending for this record.'); return; }
    const { error } = await supabase.from('approval_requests').insert([{
      request_number: generateId('REQ'),
      approval_process_id: process.id,
      current_step_id: firstStep.id,
      current_step_number: 1,
      total_steps: steps.length,
      record_type: recordType,
      record_id: recordId,
      record_name: recordName,
      submitted_by: currentUser.email,
      submitted_at: new Date().toISOString(),
      status: 'Pending',
      organization_id: currentUser.organization_id,
      business_unit_id: currentUser.business_unit_id,
    }]);
    if (error) { alert('Submission failed: ' + error.message); return; }

    // Persist 'Pending Approval' status onto the underlying record so it survives refresh
    const STATUS_TABLE_MAP: Record<string, { table: string; idField: string }> = {
      customers: { table:'customers', idField:'customer_number' },
      leads: { table:'leads', idField:'lead_number' },
      opportunities: { table:'opportunities', idField:'opportunity_number' },
      orders: { table:'orders', idField:'order_number' },
      invoices: { table:'invoices', idField:'invoice_number' },
      quotations: { table:'quotations', idField:'quote_number' },
      contacts: { table:'contacts', idField:'contact_number' },
      activities: { table:'activities', idField:'activity_number' },
      products: { table:'products', idField:'product_number' },
      retailCustomers: { table:'retail_customers', idField:'customer_number' },
      retailProducts: { table:'retail_products', idField:'product_number' },
      retailActivities: { table:'retail_activities', idField:'activity_number' },
      retailOrders: { table:'retail_orders', idField:'order_number' },
      retailInvoices: { table:'retail_invoices', idField:'invoice_number' },
    };
    const statusCfg = STATUS_TABLE_MAP[recordType];
    if (statusCfg) {
      await supabase.from(statusCfg.table)
        .update({ status: 'Pending Approval', updated_at: new Date().toISOString() })
        .eq(statusCfg.idField, recordId);
    }

    // Notify the first step approver
    const approverUser = enterpriseUsers.find(u => u.id === firstStep.approver_user_id);
    if (approverUser) {
      await createNotification({
        recipientEmail: approverUser.email, type: 'approval',
        title: 'Approval Required',
        body: `"${recordName}" requires your approval (Step 1 of ${steps.length}: ${firstStep.step_name}).`,
        recordType, recordId,
      });
    }
    await logAudit({ recordType, recordId, recordName, action: 'submitted_for_approval' });

    // Refresh the underlying object list so the status change is visible everywhere
    const SUBMIT_REFETCH_MAP: Record<string, () => Promise<void>> = {
      customers: fetchCustomers, leads: fetchLeads, opportunities: fetchOpportunities,
      orders: fetchOrders, invoices: fetchInvoices, quotations: fetchQuotations,
      contacts: fetchContacts, activities: fetchActivities, products: fetchProducts,
      retailCustomers: fetchRetailCustomers, retailProducts: fetchRetailProducts,
      retailActivities: fetchRetailActivities, retailOrders: fetchRetailOrders,
      retailInvoices: fetchRetailInvoices,
    };
    const submitRefetchFn = SUBMIT_REFETCH_MAP[recordType];
    if (submitRefetchFn) await submitRefetchFn();

    await fetchApprovalRequests();
    alert('Submitted for approval successfully.');
  };

  const processApproval = async (requestId: string, decision: 'Approved' | 'Rejected', comments: string) => {
    if (!supabase || !currentUser) return;
    const request = approvalRequests.find(r => r.id === requestId);
    if (!request) return;

    // ── Helper: update the underlying business record's status field ──────────
    const RECORD_TABLE_MAP: Record<string, { table: string; idField: string; approvedStatus: string; rejectedStatus: string; pendingStatus: string }> = {
      customers:     { table:'customers',     idField:'customer_number',     approvedStatus:'Active',         rejectedStatus:'Draft',           pendingStatus:'Pending Approval' },
      leads:         { table:'leads',         idField:'lead_number',         approvedStatus:'Approved',       rejectedStatus:'Rejected',        pendingStatus:'Pending Approval' },
      opportunities: { table:'opportunities', idField:'opportunity_number',  approvedStatus:'Approved',       rejectedStatus:'Rejected',        pendingStatus:'Pending Approval' },
      orders:        { table:'orders',        idField:'order_number',        approvedStatus:'Approved',       rejectedStatus:'Rejected',        pendingStatus:'Pending Approval' },
      invoices:      { table:'invoices',      idField:'invoice_number',      approvedStatus:'Approved',       rejectedStatus:'Rejected',        pendingStatus:'Pending Approval' },
      quotations:    { table:'quotations',    idField:'quote_number',        approvedStatus:'Approved',       rejectedStatus:'Draft',           pendingStatus:'Pending Approval' },
      contacts:      { table:'contacts',      idField:'contact_number',      approvedStatus:'Active',         rejectedStatus:'Draft',           pendingStatus:'Pending Approval' },
      activities:    { table:'activities',    idField:'activity_number',     approvedStatus:'Approved',       rejectedStatus:'Rejected',        pendingStatus:'Pending Approval' },
      products:      { table:'products',      idField:'product_number',      approvedStatus:'Active',         rejectedStatus:'Draft',           pendingStatus:'Pending Approval' },
      retailCustomers: { table:'retail_customers', idField:'customer_number', approvedStatus:'Active',   rejectedStatus:'Inactive', pendingStatus:'Pending Approval' },
      retailProducts:  { table:'retail_products',  idField:'product_number',  approvedStatus:'Active',   rejectedStatus:'Inactive', pendingStatus:'Pending Approval' },
      retailActivities:{ table:'retail_activities',idField:'activity_number', approvedStatus:'Completed',rejectedStatus:'Cancelled',pendingStatus:'Pending Approval' },
      retailOrders:    { table:'retail_orders',    idField:'order_number',    approvedStatus:'Completed',rejectedStatus:'Cancelled',pendingStatus:'Pending Approval' },
      retailInvoices:  { table:'retail_invoices',  idField:'invoice_number',  approvedStatus:'Paid',     rejectedStatus:'Cancelled',pendingStatus:'Pending Approval' },
    };

    const updateRecordStatus = async (status: string) => {
      const cfg = RECORD_TABLE_MAP[request.record_type];
      if (!cfg || !request.record_id) return;
      await supabase.from(cfg.table).update({ status, updated_at: new Date().toISOString() }).eq(cfg.idField, request.record_id);
    };

    // Record this step's decision
    await supabase.from('approval_decisions').insert([{
      approval_request_id: requestId,
      step_id: request.current_step_id,
      step_number: request.current_step_number || 1,
      decided_by: currentUser.email,
      decision,
      comments,
      decided_at: new Date().toISOString(),
    }]);

    const totalSteps    = request.total_steps || 1;
    const currentStepNum = request.current_step_number || 1;

    if (decision === 'Rejected') {
      // Rejection terminates the process — update request AND underlying record
      await supabase.from('approval_requests').update({ status: 'Rejected', comments }).eq('id', requestId);
      await updateRecordStatus(RECORD_TABLE_MAP[request.record_type]?.rejectedStatus || 'Rejected');
      await logAudit({ recordType: request.record_type, recordId: request.record_id, recordName: request.record_name, action: 'approval_rejected' });
      const submitter = enterpriseUsers.find(u => u.email === request.submitted_by);
      if (submitter) {
        await createNotification({
          recipientEmail: submitter.email, type: 'approval', title: '❌ Approval Rejected',
          body: `"${request.record_name}" was rejected at step ${currentStepNum} of ${totalSteps} by ${currentUser.email}.${comments ? ' Reason: ' + comments : ''}`,
          recordType: request.record_type, recordId: request.record_id,
        });
      }
    } else if (currentStepNum >= totalSteps) {
      // Final step approved — mark request AND underlying record as approved
      await supabase.from('approval_requests').update({ status: 'Approved', comments }).eq('id', requestId);
      await updateRecordStatus(RECORD_TABLE_MAP[request.record_type]?.approvedStatus || 'Approved');
      await logAudit({ recordType: request.record_type, recordId: request.record_id, recordName: request.record_name, action: 'approval_approved' });
      const submitter = enterpriseUsers.find(u => u.email === request.submitted_by);
      if (submitter) {
        await createNotification({
          recipientEmail: submitter.email, type: 'approval', title: '✅ Approval Granted',
          body: `"${request.record_name}" has been fully approved (all ${totalSteps} step${totalSteps > 1 ? 's' : ''} completed).`,
          recordType: request.record_type, recordId: request.record_id,
        });
      }
    } else {
      // Intermediate step approved — advance to next step, keep record in Pending Approval
      const nextStepNum = currentStepNum + 1;
      const { data: nextStep } = await supabase.from('approval_steps')
        .select('*').eq('approval_process_id', request.approval_process_id)
        .eq('step_number', nextStepNum).maybeSingle();
      if (nextStep) {
        await supabase.from('approval_requests').update({
          current_step_id: nextStep.id,
          current_step_number: nextStepNum,
          status: 'Pending',
        }).eq('id', requestId);
        // Record remains in Pending Approval status
        await updateRecordStatus('Pending Approval');
        const nextApprover = enterpriseUsers.find(u => u.id === nextStep.approver_user_id);
        if (nextApprover) {
          await createNotification({
            recipientEmail: nextApprover.email, type: 'approval', title: '⏳ Approval Required',
            body: `"${request.record_name}" requires your approval (Step ${nextStepNum} of ${totalSteps}: ${nextStep.step_name}).`,
            recordType: request.record_type, recordId: request.record_id,
          });
        }
        await logAudit({ recordType: request.record_type, recordId: request.record_id, recordName: request.record_name, action: `approval_step_${currentStepNum}_approved` });
      }
    }
    await fetchApprovalRequests();
  };

  // \u2500\u2500\u2500 Assignment Rules Engine \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  // ─── Automation Engine ────────────────────────────────────────────────────

  const evaluateCondition = (value: any, operator: string, condValue: string): boolean => {
    const v = String(value || '').toLowerCase();
    const c = String(condValue || '').toLowerCase();
    switch(operator) {
      case 'equals':         return v === c;
      case 'not_equals':     return v !== c;
      case 'contains':       return v.includes(c);
      case 'not_contains':   return !v.includes(c);
      case 'starts_with':    return v.startsWith(c);
      case 'ends_with':      return v.endsWith(c);
      case 'greater_than':   return parseFloat(v) > parseFloat(c);
      case 'less_than':      return parseFloat(v) < parseFloat(c);
      case 'is_empty':       return !value || v === '';
      case 'is_not_empty':   return !!value && v !== '';
      default:               return false;
    }
  };

  const getObjectTable = (objectType: string): string => {
    const map: Record<string,string> = {
      leads:'leads', opportunities:'opportunities', customers:'customers',
      contacts:'contacts', activities:'activities', orders:'orders',
      invoices:'invoices', quotations:'quotations', products:'products',
      retailCustomers:'retail_customers', retailProducts:'retail_products',
      retailActivities:'retail_activities', retailOrders:'retail_orders',
      retailInvoices:'retail_invoices',
    };
    return map[objectType] || objectType;
  };

  const getObjectIdField = (objectType: string): string => {
    const map: Record<string,string> = {
      leads:'lead_number', opportunities:'opportunity_number',
      customers:'customer_number', contacts:'contact_number',
      activities:'activity_number', orders:'order_number',
      invoices:'invoice_number', quotations:'quote_number',
      products:'product_number',
      retailCustomers:'customer_number', retailProducts:'product_number',
      retailActivities:'activity_number', retailOrders:'order_number',
      retailInvoices:'invoice_number',
    };
    return map[objectType] || 'id';
  };

  // ── Assignment Rules ──────────────────────────────────────────────
  const runAssignmentRules = async (objectType: string, recordId: string, recordData: any) => {
    if (!supabase) return;
    const rules = assignmentRules
      .filter(r => r.object_type === objectType && r.is_active)
      .sort((a,b) => a.priority - b.priority);

    for (const rule of rules) {
      const value = recordData[rule.condition_field];
      if (!evaluateCondition(value, rule.condition_operator, rule.condition_value)) continue;

      const assignee = rule.assign_to_user_id
        ? enterpriseUsers.find(u => u.id === rule.assign_to_user_id)
        : null;
      const group = rule.assign_to_group_id
        ? userGroups?.find(g => g.id === rule.assign_to_group_id)
        : null;

      if (assignee) {
        // Actually update owner on the record
        const table   = getObjectTable(objectType);
        const idField = getObjectIdField(objectType);
        await supabase.from(table)
          .update({ owner: assignee.email, owner_id: assignee.id })
          .eq(idField, recordId);

        await createNotification({
          recipientEmail: assignee.email,
          type: 'assignment',
          title: `New ${objectType} Assigned to You`,
          body: `Record "${recordData.name || recordId}" has been auto-assigned to you.`,
          recordType: objectType, recordId,
        });
      }
      if (group) {
        // Notify all group members
        await createNotification({
          recipientEmail: currentUser?.email || '',
          type: 'assignment',
          title: `New ${objectType} Assigned to Group: ${group.group_name}`,
          body: `Record "${recordData.name || recordId}" has been assigned to ${group.group_name}.`,
          recordType: objectType, recordId,
        });
      }
      break; // Only first matching rule fires
    }
  };

  // ── Workflow Rules ────────────────────────────────────────────────
  const runWorkflowRules = async (objectType: string, recordId: string, recordData: any, triggerEvent: string) => {
    if (!supabase) return;
    let fieldsWereMutated = false;
    const rules = workflowRules.filter(r =>
      r.object_type === objectType &&
      r.trigger_event === triggerEvent &&
      r.is_active
    );

    for (const rule of rules) {
      // Evaluate conditions if any
      let conditionMet = true;
      if (rule.trigger_field && rule.trigger_value) {
        const value = recordData[rule.trigger_field];
        conditionMet = evaluateCondition(value, 'equals', rule.trigger_value);
      }
      if (!conditionMet) continue;

      // Execute actions
      const { data: actionsData } = await supabase
        .from('workflow_actions')
        .select('*')
        .eq('workflow_rule_id', rule.id)
        .order('execution_order');

      for (const action of (actionsData || [])) {
        const cfg = action.action_config || {};
        switch(action.action_type) {
          case 'send_notification': {
            // Merge field placeholders like {{name}}, {{status}}, {{amount}} into subject/message
            const interpolate = (text: string) => (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => {
              const val = recordData[key];
              return val !== undefined && val !== null ? String(val) : '';
            });
            const subject = interpolate(cfg.subject) || `Workflow: ${rule.name}`;
            const message = interpolate(cfg.message) || `Rule "${rule.name}" triggered on ${objectType} record "${recordData.name || recordId}".`;

            const emailSet = new Set<string>();

            // Specific email addresses
            (cfg.recipients || []).forEach((e: string) => emailSet.add(e));

            // Specific selected users
            (cfg.user_ids || []).forEach((uid: string) => {
              const u = enterpriseUsers.find(x => x.id === uid);
              if (u?.email) emailSet.add(u.email);
            });

            // Record owner (default true unless explicitly disabled)
            if (cfg.notify_owner !== false && recordData.owner) emailSet.add(recordData.owner);

            // Record creator/submitter
            if (cfg.notify_submitter && recordData.created_by) emailSet.add(recordData.created_by);

            for (const email of emailSet) {
              await createNotification({
                recipientEmail: email,
                type: 'workflow',
                title: subject,
                body: message,
                recordType: objectType, recordId,
              });
            }
            break;
          }
          case 'update_field': {
            // Safety: never allow this action to touch owner/owner_id — use assign_owner instead
            if (cfg.field && cfg.field !== 'owner' && cfg.field !== 'owner_id' && cfg.value !== undefined && cfg.value !== '') {
              const NUMERIC_FIELDS = ['amount','probability','price','grand_total','cost','quantity'];
              const coercedValue = NUMERIC_FIELDS.includes(cfg.field) ? Number(cfg.value) : cfg.value;
              const table   = getObjectTable(objectType);
              const idField = getObjectIdField(objectType);
              const { error: ufErr } = await supabase.from(table)
                .update({ [cfg.field]: coercedValue })
                .eq(idField, recordId);
              if (ufErr) console.warn('[Workflow update_field] failed:', ufErr.message);
              else fieldsWereMutated = true;
            }
            break;
          }
          case 'assign_owner': {
            const newOwner = cfg.user_id
              ? enterpriseUsers.find(u => u.id === cfg.user_id)
              : null;
            if (newOwner) {
              const table   = getObjectTable(objectType);
              const idField = getObjectIdField(objectType);
              const { error: aoErr } = await supabase.from(table)
                .update({ owner: newOwner.email, owner_id: newOwner.id })
                .eq(idField, recordId);
              if (!aoErr) {
                fieldsWereMutated = true;
                await createNotification({
                  recipientEmail: newOwner.email,
                  type: 'workflow',
                  title: `Record Assigned: ${rule.name}`,
                  body: `${objectType} "${recordData.name}" assigned to you by workflow.`,
                  recordType: objectType, recordId,
                });
              } else {
                console.warn('[Workflow assign_owner] failed:', aoErr.message);
              }
            }
            break;
          }
          case 'create_task': {
            // Resolve due date: either fixed date or N days from now
            let dueDate = cfg.due_date || null;
            if (cfg.due_in_days) {
              const d = new Date();
              d.setDate(d.getDate() + parseInt(cfg.due_in_days, 10));
              dueDate = d.toISOString().slice(0, 10);
            }
            // Resolve assignee: specific user or falls back to record owner
            const assignee = cfg.assignee_user_id
              ? enterpriseUsers.find(u => u.id === cfg.assignee_user_id)
              : null;
            const taskOwner   = assignee?.email || recordData.owner || currentUser?.email || '';
            const taskOwnerId = assignee?.id    || recordData.owner_id || currentUser?.id || null;

            const { error: taskErr } = await supabase.from('activities').insert([{
              activity_number: generateId('ACT'),
              name: cfg.task_name || 'Follow up',
              subject: cfg.task_name || 'Follow up',
              activity_type: 'Task',
              status: 'Open',
              priority: cfg.priority || 'Medium',
              due_date: dueDate,
              customer: recordData.customer || '',
              customer_id: recordData.customer_id || null,
              owner: taskOwner,
              owner_id: taskOwnerId,
              notes: cfg.notes ? `${cfg.notes}\n\n(Auto-created by workflow: ${rule.name})` : `Auto-created by workflow: ${rule.name}`,
              created_by: currentUser?.email || '',
              updated_by: currentUser?.email || '',
            }]);
            if (taskErr) {
              console.warn('[Workflow create_task] failed:', taskErr.message);
            } else {
              fieldsWereMutated = true; // ensures fetchActivities() runs at the end
            }

            // Notify the assignee if different from current user
            if (assignee && assignee.email !== currentUser?.email) {
              await createNotification({
                recipientEmail: assignee.email,
                type: 'workflow',
                title: `New Task: ${cfg.task_name || 'Follow up'}`,
                body: `Workflow "${rule.name}" created a task for you on ${objectType} record "${recordData.name || recordId}".`,
                recordType: objectType, recordId,
              });
              fieldsWereMutated = true;
            }
            break;
          }
        }
      }
    }

    // Refresh the underlying list + activities (for create_task) if any action mutated data,
    // so the UI reflects field updates / owner reassignment / new tasks immediately
    if (fieldsWereMutated) {
      const REFETCH_MAP: Record<string, () => Promise<void>> = {
        customers: fetchCustomers, leads: fetchLeads, opportunities: fetchOpportunities,
        orders: fetchOrders, invoices: fetchInvoices, quotations: fetchQuotations,
        contacts: fetchContacts, activities: fetchActivities, products: fetchProducts,
        retailCustomers: fetchRetailCustomers, retailProducts: fetchRetailProducts,
        retailActivities: fetchRetailActivities, retailOrders: fetchRetailOrders,
        retailInvoices: fetchRetailInvoices,
      };
      const refetchFn = REFETCH_MAP[objectType];
      if (refetchFn) await refetchFn();
      await fetchActivities(); // create_task always inserts into activities
    }
  };

  // ── SLA Policies ──────────────────────────────────────────────────
  const runSLAPolicies = async (objectType: string, recordId: string, recordData: any) => {
    if (!supabase) return;
    const policies = slaPolicies?.filter(p => p.object_type === objectType && p.is_active) || [];

    for (const policy of policies) {
      const value = recordData[policy.condition_field];
      if (policy.condition_value && !evaluateCondition(value, 'equals', policy.condition_value)) continue;

      const now = new Date();
      const responseDate  = new Date(now.getTime() + (policy.response_time_hours   || 24) * 3600000);
      const resolutionDate = new Date(now.getTime() + (policy.resolution_time_hours || 72) * 3600000);

      await supabase.from('sla_records').insert([{
        sla_policy_id:      policy.id,
        record_type:        objectType,
        record_id:          recordId,
        started_at:         now.toISOString(),
        response_due_at:    responseDate.toISOString(),
        resolution_due_at:  resolutionDate.toISOString(),
        status:             'Active',
      }]);

      // Notify escalation contact if configured
      if (policy.escalate_to_user_id) {
        const escalateTo = enterpriseUsers.find(u => u.id === policy.escalate_to_user_id);
        if (escalateTo) {
          await createNotification({
            recipientEmail: escalateTo.email,
            type: 'sla',
            title: `SLA Started: ${policy.name}`,
            body: `SLA policy "${policy.name}" has started for ${objectType} record. Response due by ${responseDate.toLocaleString()}.`,
            recordType: objectType, recordId,
          });
        }
      }
    }
  };

  // ── Check Approval Processes ──────────────────────────────────────
  const checkMatchingApprovalProcess = async (objectType: string, recordData: any) => {
    if (!supabase) return null;
    const processes = approvalProcesses?.filter(p => p.object_type === objectType && p.is_active) || [];

    for (const process of processes) {
      // Support both single condition and multi-condition (conditions JSONB)
      let matches = false;
      if (process.conditions?.conditions?.length > 0) {
        const logic = process.conditions.logic || 'AND';
        const results = process.conditions.conditions.map((c: any) =>
          evaluateCondition(recordData[c.field], c.operator, c.value)
        );
        matches = logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
      } else if (process.condition_field) {
        matches = evaluateCondition(
          recordData[process.condition_field],
          process.condition_operator || 'equals',
          process.condition_value || ''
        );
      } else {
        matches = true; // No condition = always matches
      }

      if (matches) return process;
    }
    return null;
  };

  // ── Central automation runner (called after create/update) ────────
  const runAutomations = async (
    objectType: string,
    recordId: string,
    recordData: any,
    event: 'on_create' | 'on_update' | 'on_delete'
  ) => {
    try {
      await Promise.all([
        runWorkflowRules(objectType, recordId, recordData, event),
        event === 'on_create' ? runAssignmentRules(objectType, recordId, recordData) : Promise.resolve(),
        event === 'on_create' ? runSLAPolicies(objectType, recordId, recordData) : Promise.resolve(),
      ]);
    } catch(e: any) {
      console.warn('[Automation] Error:', e.message);
    }
  };

  // \u2500\u2500\u2500 Effects \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!session?.user?.id) return;
    Promise.all([
      fetchCurrentUser(), fetchCustomers(), fetchProducts(), fetchLeads(),
      fetchOpportunities(), fetchOrders(), fetchInvoices(), fetchContacts(),
      fetchActivities(), fetchQuoteTemplates(), fetchOrganizations(), fetchBusinessUnits(),
      fetchEnterpriseUsers(), fetchUserGroups(), fetchRoles(), fetchPermissions(),
      fetchWorkflowRules(), fetchAssignmentRules(), fetchSLAPolicies(),
      fetchApprovalProcesses(), fetchApprovalRequests(),
      fetchQuotations(), fetchReports(), fetchSavedSearches(), fetchInvoiceTemplates(),
      fetchNotifications(), fetchAppPreferences(),
    ]);
    // Retail tables may not exist yet (SQL migration pending) — isolate so they never crash B2B init
    Promise.allSettled([
      fetchRetailCustomers(), fetchRetailProducts(), fetchRetailActivities(),
      fetchWarehouses(),
      fetchRetailOrders(), fetchRetailInvoices(),
    ]).catch(() => {});
    fetchExchangeRates(appPreferences?.default_currency || 'INR');
  }, [session?.user?.id, supabase]);

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
  const _DEF_PREFS = { crm_enabled:true, cpq_enabled:true, b2c_mode:false, default_currency:'INR', date_format:'DD/MM/YYYY', fiscal_year_start:'April', global_search_enabled:false, business_mode:'B2B' };
  const _cp = (p) => ({ crm_enabled:p?.crm_enabled??true, cpq_enabled:p?.cpq_enabled??true, b2c_mode:p?.b2c_mode??false, default_currency:p?.default_currency||'INR', date_format:p?.date_format||'DD/MM/YYYY', fiscal_year_start:p?.fiscal_year_start||'April', global_search_enabled:p?.global_search_enabled??false, business_mode:(p?.b2c_mode??false)?'B2C':'B2B' });
  // ─── Appearance ───────────────────────────────────────────────────────────
  const _APP_KEY = 'bp_appearance';
  const _DEF_APP = { company_logo_url:'', company_name:'Business Pro', theme:'navy', language:'en', font:'geist' };

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

  const [appearance, setAppearance] = useState(() => {
    try {
      const s = typeof window!=='undefined' && window.localStorage.getItem(_APP_KEY);
      if (s) {
        const parsed = { ..._DEF_APP, ...JSON.parse(s) };
        parsed.themeColors = THEME_COLORS[parsed.theme] || THEME_COLORS['navy'];
        return parsed;
      }
    } catch(e) {}
    const def = { ..._DEF_APP };
    def.themeColors = THEME_COLORS['navy'];
    return def;
  });

  const fetchAppearance = async () => {
    try {
      const s = window.localStorage.getItem(_APP_KEY);
      if (s) {
        const parsed = {..._DEF_APP,...JSON.parse(s)};
        const tc = THEME_COLORS[parsed.theme] || THEME_COLORS['navy'];
        parsed.themeColors = tc;
        setAppearance(parsed);
        applyAppearance(parsed);  // Apply immediately on load
      }
    } catch(e) {}
    if (!supabase) return;
    try {
      const { data } = await supabase.from('appearance').select('*').limit(1).maybeSingle();
      if (data) {
        const a = { ..._DEF_APP, ...data };
        const tc = THEME_COLORS[a.theme] || THEME_COLORS['navy'];
        a.themeColors = tc;
        setAppearance(a);
        window.localStorage.setItem(_APP_KEY, JSON.stringify(a));
        applyAppearance(a);
      }
    } catch(e) {}
  };

  const saveAppearance = async (data) => {
    const clean = { ..._DEF_APP, ...data };
    const tc = THEME_COLORS[clean.theme] || THEME_COLORS['navy'];
    clean.themeColors = tc;
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

  const RTL_LANGS = ['ar'];

  const applyAppearance = (app: any) => {
    if (typeof document === 'undefined') return;
    const tc = THEME_COLORS[app.theme] || THEME_COLORS['navy'];
    // Attach resolved colors to the app object so components can read directly
    app.themeColors = tc;

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
    if (data) setQuotations(applyDataSecurity(data).map(q => ({ ...q, customerId: q.customer_id, displayNumber: q.display_number })));
  };
  const createQuotation = async (data,items=[]) => { if(!supabase||!currentUser)return null; const qNum=generateId('QUO'); const{_uuid,id,customerId,displayNumber,contactId,activityType,activityDate,dueDate,closeDate,isPrimary,linkedIn,ownerName,...cleanData}=data; const{data:inserted,error}=await supabase.from('quotations').insert([{...buildSystemFields(),quote_number:qNum,...cleanData,status:cleanData.status||'Draft',version:1,owner:cleanData.owner||currentUser.email,owner_id:cleanData.owner_id||currentUser.id}]).select().single(); if(error){alert('Failed: '+error.message);return null;} if(items.length)await upsertLineItemsGeneric('quotation_line_items','quote_number',qNum,items); await autoSetCustomerStatus(data.customer_id, 'Prospect'); await runAutomations('quotations', qNum, inserted, 'on_create'); await fetchQuotations(); return {...inserted, customerId: inserted.customer_id}; };
  const updateQuotation = async (data,items=[]) => {
    if(!supabase)return;
    const {
      quote_number, _uuid, id, customerId, displayNumber,
      contactId, activityType, activityDate, dueDate, closeDate,
      isPrimary, linkedIn, ownerName, display_number,
      ...rest
    } = data;
    const { error } = await supabase
      .from('quotations')
      .update({ ...rest, ...buildSystemFields(true) })
      .eq('quote_number', quote_number);
    if(error){ console.error('updateQuotation:',error.message); alert('Save failed: '+error.message); return; }
    if(items) await upsertLineItemsGeneric('quotation_line_items','quote_number',quote_number,items);
    await runAutomations('quotations', quote_number, data, 'on_update');
    await fetchQuotations();
  };
  const deleteQuotation = async (qNum) => { if(!supabase||!window.confirm('Delete?'))return; await supabase.from('quotation_line_items').delete().eq('quote_number',qNum); await supabase.from('quotations').delete().eq('quote_number',qNum); await fetchQuotations(); };
  const generateNewVersion = async (q) => { if(!supabase||!currentUser)return null; const qNum=generateId('QUO'); const v=(q.version||1)+1; const items=await fetchLineItems('quotation_line_items','quote_number',q.quote_number); await supabase.from('quotations').insert([{...buildSystemFields(),...q,quote_number:qNum,version:v,status:'Draft',id:undefined,created_at:new Date().toISOString()}]); if(items.length)await upsertLineItemsGeneric('quotation_line_items','quote_number',qNum,items.map(i=>({...i,id:undefined}))); await fetchQuotations(); return{quote_number:qNum}; };
  const createQuotationFromOpportunity = async (opp) => {
    if(!supabase||!currentUser)return null;
    const items=await fetchLineItems('opportunity_line_items','opportunity_number',opp.id);
    const qNum=generateId('QUO');
    // Compute totals from the opportunity's line items (falls back to opp.amount if no items)
    const subtotal  = items.reduce((s,i)=>s+Number(i.quantity||1)*Number(i.price||i.unit_price||0),0);
    const totalDisc = items.reduce((s,i)=>s+Number(i.quantity||1)*Number(i.price||i.unit_price||0)*Number(i.discount||i.discount_pct||0)/100,0);
    const totalTax  = items.reduce((s,i)=>{const net=Number(i.quantity||1)*Number(i.price||i.unit_price||0)*(1-Number(i.discount||i.discount_pct||0)/100);return s+net*Number(i.tax_pct||0)/100;},0);
    const grandTotal = items.length ? (subtotal - totalDisc + totalTax) : Number(opp.amount||0);
    const{data:inserted,error}=await supabase.from('quotations').insert([{...buildSystemFields(),quote_number:qNum,name:`Quote - ${opp.name}`,status:'Draft',version:1,customer:opp.customer||'',customer_id:opp.customerId||null,contact:opp.contact||'',contact_id:opp.contactId||null,opportunity_id:opp.id,currency:opp.currency||'INR',subtotal:Number(subtotal.toFixed(2)),total_discount:Number(totalDisc.toFixed(2)),total_tax:Number(totalTax.toFixed(2)),grand_total:Number(grandTotal.toFixed(2)),billing_address:opp.billingAddress||opp.billing_address||'',shipping_address:opp.shippingAddress||opp.shipping_address||'',payment_terms:opp.paymentTerms||opp.payment_terms||'',owner:opp.owner||currentUser.email,owner_id:opp.owner_id||currentUser.id}]).select().single(); if(error){alert('Failed: '+error.message);return null;} if(items.length)await supabase.from('quotation_line_items').insert(items.map((i,idx)=>({quote_number:qNum,product_name:i.product||i.product_name||'',product_id:i.product_id||null,quantity:Number(i.quantity||1),unit_price:Number(i.price||0),list_price:Number(i.list_price||i.price||0),discount_pct:Number(i.discount||i.discount_pct||0),tax_pct:Number(i.tax_pct||0),extended_price:Number(i.quantity||1)*Number(i.price||0)*(1-Number(i.discount||i.discount_pct||0)/100),sort_order:idx,configuration:i.configuration||{}}))); await autoSetCustomerStatus(opp.customerId, 'Prospect'); await supabase.from('opportunities').update({ status:'Negotiation', stage:'Negotiation', updated_at:new Date().toISOString() }).eq('opportunity_number', opp.id);
    await fetchOpportunities();
    await fetchQuotations(); return{...inserted, customerId: inserted.customer_id}; };

  // ─── CPQ Flow: Quote→Order→Invoice, Opp→Order ─────────────────────────────
  const createOrderFromQuotation = async (quotation) => { if(!supabase||!currentUser)return null; const{data:qItems}=await supabase.from('quotation_line_items').select('*').eq('quote_number',quotation.quote_number).order('sort_order'); const li=qItems||[]; const sub=li.reduce((s,i)=>s+Number(i.quantity||1)*Number(i.unit_price||i.price||0),0); const disc=li.reduce((s,i)=>s+Number(i.quantity||1)*Number(i.unit_price||i.price||0)*(Number(i.discount_pct||i.discount||0)/100),0); const tax=li.reduce((s,i)=>{const n=Number(i.quantity||1)*Number(i.unit_price||i.price||0)*(1-Number(i.discount_pct||0)/100);return s+n*(Number(i.tax_pct||0)/100);},0); const od=sub*Number(quotation.overall_discount||0)/100; const gt=sub-disc+tax-od+Number(quotation.shipping_cost||0); const ordId=generateId('ORD'); const{error}=await supabase.from('orders').insert([{...buildSystemFields(),order_number:ordId,name:quotation.name||`Order - ${quotation.quote_number}`,quote_number:quotation.quote_number,customer:quotation.customer||'',customer_id:quotation.customer_id||null,contact:quotation.contact||'',contact_id:quotation.contact_id||null,billing_address:quotation.billing_address||'',shipping_address:quotation.shipping_address||'',payment_terms:quotation.payment_terms||'',currency:quotation.currency||'INR',overall_discount:Number(quotation.overall_discount||0),shipping_cost:Number(quotation.shipping_cost||0),subtotal:Number(sub.toFixed(2)),total_discount:Number((disc+od).toFixed(2)),total_tax:Number(tax.toFixed(2)),amount:Number(gt.toFixed(2)),status:'Draft',owner:quotation.owner||currentUser.email,owner_id:quotation.owner_id||currentUser.id}]); if(error){alert('Failed to create order: '+error.message);return null;} if(li.length)await supabase.from('order_line_items').insert(li.map((i,idx)=>({order_number:ordId,product_name:i.product_name||'',product_code:i.product_code||'',description:i.description||'',quantity:Number(i.quantity||1),price:Number(i.unit_price||i.price||0),list_price:Number(i.unit_price||i.price||0),discount:Number(i.discount_pct||i.discount||0),tax_pct:Number(i.tax_pct||0),extended_price:Number(i.quantity||1)*Number(i.unit_price||i.price||0)*(1-Number(i.discount_pct||0)/100),sort_order:idx}))); await supabase.from('quotations').update({status:'Ordered',...buildSystemFields(true)}).eq('quote_number',quotation.quote_number); setQuotations(prev=>prev.map(q=>q.quote_number===quotation.quote_number?{...q,status:'Ordered'}:q)); await autoSetCustomerStatus(quotation.customer_id, 'Active'); if (quotation.opportunity_id) {
      await supabase.from('opportunities').update({ status:'Closed Won', stage:'Closed Won', updated_at:new Date().toISOString() }).eq('opportunity_number', quotation.opportunity_id);
      await fetchOpportunities();
    }
    await fetchOrders(); return ordId; };

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
  const [pendingReturnTo,     setPendingReturnTo]     = useState(null);
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
    // For products, recordId may be PROD-xxx (product_number); resolve to UUID
    if (page === 'products' && String(recordId).startsWith('PROD')) {
      const prod = (await supabase.from('products').select('id').eq('product_number', recordId).maybeSingle()).data;
      if (prod?.id) recordId = prod.id;
    }
    const table=tableMap[page]; const idField=idFieldMap[page]; if(!table)return;
    const f = (page==='products' && String(recordId).startsWith('PROD')) ? 'product_number' : idField;
    await supabase.from(table).delete().eq(f, recordId);
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
    hasPermission, isAdmin, applyOwnerScope,
    customers, contacts, products, leads, opportunities, orders, invoices, activities,
    organizations, businessUnits, enterpriseUsers, userGroups, userGroupMembers,
    roles, permissions, rolePermissions, quoteTemplates,
    workflowRules, assignmentRules, slaPolicies, approvalProcesses, approvalRequests,
    notifications, unreadCount, markNotificationRead, markAllNotificationsRead,
    retailCustomers, retailProducts, retailActivities, retailOrders, retailInvoices,
    fetchRetailCustomers, fetchRetailProducts, fetchRetailActivities, fetchRetailOrders, fetchRetailInvoices,
    fetchRetailLineItems, upsertRetailLineItems,
    createRetailRecord, updateRetailRecord, deleteRetailRecord, createRetailInvoiceFromOrder,
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
    pendingReturnTo, setPendingReturnTo,
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
