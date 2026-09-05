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
import { generateId, formatDisplayNumber, withTimeout, todayLocalISO } from '@/lib/utils';
import { fetchFieldMappingRules, applyFieldMapping } from '@/lib/useFieldMappingRules';
import { useAlert } from '@/components/shared/AlertProvider';

// ─── Enterprise-scale hardening ──────────────────────────────────────────────
// TODO(pagination): The main list-fetch functions below (fetchCustomers,
// fetchProducts, fetchLeads, fetchOpportunities, fetchOrders, fetchInvoices,
// fetchActivities, fetchContacts, fetchQuotations, fetchRetailCustomers,
// fetchRetailProducts, fetchRetailActivities, fetchRetailOrders,
// fetchRetailInvoices) previously did an unbounded `.select('*')` against the
// whole table on every load — for a large tenant this pulls the entire table
// into the browser. As an interim fix (full cursor/keyset pagination + a
// "load more" UI is a larger change, tracked separately) each of these now
// caps at LIST_FETCH_LIMIT rows ordered by created_at desc, so the most
// recent records always load. This is NOT a substitute for real pagination —
// tenants with more than LIST_FETCH_LIMIT rows in one of these tables will
// not see older records in list views until keyset pagination ships. List
// page header counts use a separate server-side `{ count: 'exact', head: true }`
// query (see CRMListPage.tsx / RetailListPage.tsx) so the displayed total is
// accurate even though only LIST_FETCH_LIMIT rows are loaded client-side.
const LIST_FETCH_LIMIT = 500;


// \u2500\u2500\u2500 Context Shape \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

interface AppContextValue {
  // Auth
  session: any;
  authLoading: boolean;
  currentUser: EnterpriseUser | null;
  currentUserPermissions: string[];
  permissionsLoaded: boolean;
  userDataScope: string | null;
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
  invoiceTemplates: any[];
  fetchInvoiceTemplates: () => Promise<void>;
  saveInvoiceTemplate: (data: any, editingId?: string | null) => Promise<void>;
  deleteInvoiceTemplate: (templateId: string) => Promise<void>;
  setDefaultInvoiceTemplate: (templateId: string) => Promise<void>;

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

export function AppProvider({ children, supabase = null, tenant = null }: { children: React.ReactNode }) {
  // Custom alert/confirm dialogs (replaces window.alert()/window.confirm()) —
  // used throughout the functions below via closure.
  const { showAlert, showConfirm } = useAlert();
  // Tenant isolation — tenantId injected into all DB inserts for shared-plan tenants
  // Use useState so it persists even if tenant prop arrives late
  const [tenantId, setTenantId] = useState<string | null>(
    tenant?.id ||
    (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null) ||
    null
  );
  // Update tenantId whenever tenant prop changes (TenantContext resolves async)
  useEffect(() => {
    const id = tenant?.id ||
      (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null) ||
      null;
    if (id && id !== tenantId) {
      setTenantId(id);
    }
  }, [tenant?.id]);
  // Must match getTenantSupabaseClient's OWN criterion for which tenants get
  // an isolated auth pool/storageKey (lib/tenant.ts: plan === 'dedicated' ||
  // 'enterprise') — NOT a proxy field like db_url presence, which can be set
  // for reasons unrelated to plan and disagree with the actual isolation
  // decision. A mismatch here meant a tenant using the shared, non-isolated
  // client (where the membership check is essential, since there's no
  // storage-level protection) could still skip the check entirely if it
  // happened to have a non-null db_url for any other reason.
  const isSharedPlan = tenant?.plan !== 'dedicated' && tenant?.plan !== 'enterprise'
    && (typeof window === 'undefined' || ((window as any).__bp_tenant?.plan !== 'dedicated' && (window as any).__bp_tenant?.plan !== 'enterprise'));
  // ─── Tenant scoping helpers (shared-plan isolation) ───────────────────────
  const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const getScopeTenantId = () => {
    if (!isSharedPlan) return null; // dedicated DB — inherently isolated
    // window.__bp_tenant FIRST, not tenantId — the React state can hold
    // TenantContext's DEMO_TENANT placeholder id during the initial
    // resolution window on a fresh page load (TenantContext's own `tenant`
    // state starts as that placeholder before real resolution completes),
    // and tenantId's own update-effect only catches up once the real
    // resolved tenant has propagated through a render cycle. window.__bp_tenant
    // is never pre-populated with a placeholder — it's only ever set once
    // TenantContext's resolution genuinely finishes — so it's the reliable
    // signal here, with tenantId only as a same-tick fallback.
    return (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null)
      || tenantId
      || null;
  };
  // Applies a tenant_id filter to any select/query builder (shared plan only).
  // Demo tenant also includes legacy rows whose tenant_id is still NULL.
  const tScope = (q: any) => {
    const tid = getScopeTenantId();
    if (!tid) return q;
    if (tid === DEMO_TENANT_ID) return q.or(`tenant_id.eq.${tid},tenant_id.is.null`);
    return q.eq('tenant_id', tid);
  };
  // Auth
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<EnterpriseUser | null>(null);
  const [userDataScope, setUserDataScope] = useState<string | null>(null); // dedicated scope state
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
    const now = new Date().toISOString();
    // Always read freshest tenantId
    const effectiveTenantId = tenantId
      || (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null)
      || null;
    // tenant_id must be stamped even if currentUser hasn't resolved yet,
    // otherwise inserts violate the shared-DB RLS WITH CHECK policy
    if (!currentUser) return effectiveTenantId ? { tenant_id: effectiveTenantId } : {};
    if (isUpdate) return { updated_by: currentUser.email, updated_at: now };
    return {
      created_by: currentUser.email, created_at: now,
      updated_by: currentUser.email, updated_at: now,
      organization_id: currentUser.organization_id,
      business_unit_id: currentUser.business_unit_id,
      ...(effectiveTenantId ? { tenant_id: effectiveTenantId } : {}),
    };
  }, [currentUser, tenantId]);

  const applyDataSecurity = useCallback((records: any[]) => {
    // If currentUser not loaded yet, return empty array to prevent flash of all data
    if (!currentUser || !permissionsLoaded) return [];
    const isAdmin    = currentUserPermissions.includes('__admin__') || (currentUser as any)?.is_admin === true;
    // Use dedicated userDataScope state (most reliable) then fall back to currentUser.data_scope
    const dataScope  = userDataScope || (currentUser as any)?.data_scope || (isAdmin ? 'all' : 'own');
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
    // Match on owner_id (UUID), owner email, or created_by email
    // owner_id may be null on older records so we check all three
    return records.filter((r: any) => {
      const userId    = (currentUser as any).id;
      const userEmail = (currentUser as any).email;
      const authId    = (currentUser as any).auth_user_id;
      return (
        // No owner set — include (unassigned records visible to all)
        (!r.owner_id && !r.owner && !r.created_by) ||
        // Match by owner_id UUID
        (r.owner_id && (r.owner_id === userId || r.owner_id === authId)) ||
        // Match by owner email
        (r.owner && r.owner.toLowerCase() === userEmail?.toLowerCase()) ||
        // Match by created_by email (for records without explicit owner)
        (r.created_by && r.created_by.toLowerCase() === userEmail?.toLowerCase())
      );
    });
  }, [currentUser, currentUserPermissions, userDataScope]);

  // \u2500\u2500\u2500 Auth \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  // Verifies that an authenticated Supabase user actually belongs to THIS tenant.
  // On shared-plan tenants every workspace shares one Supabase Auth pool, so a
  // valid password alone must NEVER grant access to a workspace.
  const verifyTenantMembership = async (user: any): Promise<boolean> => {
    if (!supabase || !user) return false;
    // Dedicated tenants have their own separate Supabase auth pool entirely —
    // a user literally cannot authenticate against a different tenant's
    // dedicated project using another tenant's credentials, so membership
    // doesn't need checking against the shared enterprise_users table here.
    if (!isSharedPlan) return true;

    // Tenant context resolves asynchronously (TenantContext sets
    // window.__bp_tenant once resolution completes — see its own comment).
    // This function can be called before that finishes (e.g. from
    // onAuthStateChange, which can fire very early in the page lifecycle).
    // The ONLY safe behavior when we don't yet know which tenant we're
    // scoped to is to wait and find out — never to assume "no check needed"
    // and grant access, which was the actual root cause of one tenant's
    // user being able to log into a different tenant: the previous version
    // treated "tenant context not resolved yet" as equivalent to "skip the
    // check", the wrong default for a security gate.
    //
    // CRITICAL: only window.__bp_tenant is trustworthy evidence that
    // resolution has genuinely completed. The tenantId REACT STATE is not —
    // TenantContext's own `tenant` state starts as a DEMO_TENANT placeholder
    // (useState(DEMO_TENANT)) before real resolution finishes, and on a
    // fresh page refresh, this component's tenantId state can initialize by
    // capturing THAT placeholder's id as its own starting value, before the
    // real tenant has resolved at all. Trusting tenantId here meant this
    // check could see a non-null (but wrong) value and skip waiting
    // entirely, verifying membership against the demo tenant instead of
    // whichever tenant the URL actually pointed to. window.__bp_tenant is
    // never pre-populated with a placeholder — TenantContext only ever sets
    // it once genuine resolution has completed.
    let tid = (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null) || null;
    for (let i = 0; i < 30 && !tid; i++) {
      await new Promise(r => setTimeout(r, 100));
      tid = (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null) || null;
    }
    if (!tid) {
      console.error('[verifyTenantMembership] Tenant context never resolved — rejecting for safety');
      return false;
    }
    console.log('[verifyTenantMembership] Checking user', user.email, '(auth_user_id:', user.id, ') against tenant_id:', tid, '| isSharedPlan:', isSharedPlan);
    try {
      let q: any = supabase.from('enterprise_users').select('id, status, tenant_id, email');
      q = (tid === DEMO_TENANT_ID)
        ? q.or(`tenant_id.eq.${tid},tenant_id.is.null`)
        : q.eq('tenant_id', tid);
      const emailSafe = String(user.email || '').replace(/[,()"']/g, '');
      const { data, error } = await q
        .or(`auth_user_id.eq.${user.id},email.ilike.${emailSafe}`)
        .limit(1);
      if (error) { console.error('[verifyTenantMembership] Query error:', error.message); return false; }
      const row = data && data[0];
      console.log('[verifyTenantMembership] Matched row:', row || 'none found');
      if (!row) return false;
      if (String(row.status || '').toLowerCase() === 'inactive') { console.log('[verifyTenantMembership] Row is inactive — rejecting'); return false; }
      console.log('[verifyTenantMembership] PASSED — row tenant_id', row.tenant_id, 'checked against', tid);
      return true;
    } catch (e) {
      console.error('[verifyTenantMembership] Exception:', e);
      return false;
    }
  };

  const handleLogin = async (email: string, password: string) => {
    if (!supabase) return;
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { showAlert(error.message); return; }
    // Cross-tenant guard: password is valid platform-wide, membership is not.
    const ok = await verifyTenantMembership(authData?.user);
    if (!ok) {
      await supabase.auth.signOut();
      setSession(null);
      showAlert('This account does not have access to this workspace. Please check your workspace URL or contact your administrator.');
    }
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
    if (!newPassword || newPassword.length < 6) {
      showAlert('Password must be at least 6 characters.');
      return;
    }
    // Use admin API via server route to bypass "current password required" Supabase restriction
    // This occurs when user was provisioned with a temp password via admin
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.user?.id) { showAlert('Session expired. Please log in again.'); return; }

      const tenant = (window as any).__bp_tenant || {};
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authUserId: session.user.id,
          password:   newPassword,
          db_url:     tenant.db_url || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        showAlert('Password updated successfully. You may need to log in again.');
        await supabase.auth.signOut();
      } else {
        showAlert('Failed to update password: ' + (json.error || res.status));
      }
    } catch(e: any) {
      showAlert('Error updating password: ' + e.message);
    }
  };

  const saveMyProfile = async (data: Partial<EnterpriseUser>) => {
    if (!supabase || !currentUser) return;
    const { error } = await supabase
      .from('enterprise_users')
      .update({ first_name: data.first_name, last_name: data.last_name, phone: data.phone })
      .eq('id', currentUser.id);
    if (!error) { await fetchCurrentUser(); await fetchEnterpriseUsers(); showAlert('Profile Updated'); }
    else showAlert(error.message);
  };

  const fetchCurrentUser = async () => {
    if (!supabase || !session?.user) return;
    // Join roles to get data_scope immediately so applyDataSecurity works on first fetch
    let { data } = await tScope(supabase
      .from('enterprise_users').select('*, roles(id, role_name, role_code, data_scope)'))
      .eq('auth_user_id', session.user.id).maybeSingle();
    // Fallback: email match
    if (!data && session.user.email) {
      const { data: d2 } = await tScope(supabase
        .from('enterprise_users').select('*, roles(id, role_name, role_code, data_scope)'))
        .ilike('email', session.user.email).maybeSingle();
      data = d2;
    }
    if (data) {
      // A deactivated user's Supabase auth session stays valid on its own —
      // status is an app-level flag, not something Supabase Auth enforces.
      // Without this check, deactivating a user had no effect on any session
      // they already had open, and they'd keep full access until they
      // happened to log out themselves.
      if (data.status && data.status !== 'Active') {
        console.warn('[fetchCurrentUser] User is deactivated — signing out');
        showAlert('Your account has been deactivated. Please contact your administrator.', { variant:'danger', title:'Account Deactivated' });
        await supabase.auth.signOut();
        setCurrentUser(null);
        setSession(null);
        return;
      }
      const scope = data.roles?.data_scope || data.data_scope || null;
      setCurrentUser({ ...data, data_scope: scope });
      if (scope) setUserDataScope(scope);
      // If auth_user_id not set in DB, update it now
      if (!data.auth_user_id && session.user.id) {
        await supabase.from('enterprise_users')
          .update({ auth_user_id: session.user.id })
          .eq('id', data.id);
      }
    } else if (getScopeTenantId()) {
      // Authenticated platform-wide but no membership row in THIS tenant —
      // never allow the session to remain active in a foreign workspace.
      console.warn('[fetchCurrentUser] No enterprise_users row for this tenant — signing out');
      await supabase.auth.signOut();
      setCurrentUser(null);
      setSession(null);
    }
  };

  const loadCurrentUserPermissions = async () => {
    if (!supabase || !session?.user) return;
    setPermissionsLoaded(false);
    // Try by auth_user_id first (most reliable), then email
    let { data: userData } = await tScope(supabase
      .from('enterprise_users').select('*, roles(id, role_name, role_code, data_scope)'))
      .eq('auth_user_id', session.user.id).maybeSingle();
    if (!userData) {
      const { data: d2 } = await tScope(supabase
        .from('enterprise_users').select('*, roles(id, role_name, role_code, data_scope)'))
        .ilike('email', session.user.email || '').maybeSingle();
      userData = d2;
    }
    // Admin shortcut
    if (userData?.is_admin) {
      setCurrentUser((u: any) => u ? { ...u, data_scope: 'all' } : u);
      setUserDataScope('all');
      setCurrentUserPermissions(['__admin__']);
      setPermissionsLoaded(true);
      return;
    }
    if (!userData?.role_id) {
      setCurrentUserPermissions([]);
      setPermissionsLoaded(true);
      return;
    }
    // Store data_scope on currentUser AND dedicated state for applyDataSecurity
    if (userData.roles?.data_scope) {
      setCurrentUser((u: any) => u ? { ...u, data_scope: userData.roles.data_scope } : u);
      setUserDataScope(userData.roles.data_scope);
    } else if (userData.is_admin) {
      setUserDataScope('all');
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
    const { data, error } = await tScope(supabase.from('customers').select('*')).order('created_at', { ascending: false }).limit(LIST_FETCH_LIMIT);
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
    const { data, error } = await tScope(supabase.from('contacts').select('*')).order('created_at', { ascending: false }).limit(LIST_FETCH_LIMIT);
    if (error) console.error(error);
    if (data) {
      setContacts(applyDataSecurity(data).map((c: any) => ({
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
    const { data, error } = await tScope(supabase.from('products').select('*')).order('created_at', { ascending: false }).limit(LIST_FETCH_LIMIT);
    if (error) console.error(error);
    if (data) {
      setProducts(applyDataSecurity(data).map((p: any) => ({
        ...p,
        id: p.product_number || p.id, displayNumber: p.display_number, _uuid: p.id, name: p.name, category: p.category,
        price: Number(p.price || 0), status: p.status,
        stock_quantity: Number(p.stock_quantity || 0), reorder_level: Number(p.reorder_level ?? 10),
        track_inventory: p.track_inventory !== false,
        created_by: p.created_by, created_at: p.created_at, updated_by: p.updated_by, updated_at: p.updated_at,
        organization_id: p.organization_id, business_unit_id: p.business_unit_id,
      })));
    }
  };

  const fetchLeads = async () => {
    if (!supabase) return;
    const { data, error } = await tScope(supabase.from('leads').select('*')).order('created_at', { ascending: false }).limit(LIST_FETCH_LIMIT);
    if (error) console.error(error);
    if (data) {
      setLeads(applyDataSecurity(data).map((l: any) => ({
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
    const { data, error } = await tScope(supabase.from('opportunities').select('*')).order('created_at', { ascending: false }).limit(LIST_FETCH_LIMIT);
    if (error) console.error(error);
    if (data) {
      setOpportunities(applyDataSecurity(data).map((o: any) => ({
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
    const { data, error } = await tScope(supabase.from('orders').select('*')).order('created_at', { ascending: false }).limit(LIST_FETCH_LIMIT);
    if (error) console.error(error);
    if (data) {
      setOrders(applyDataSecurity(data).map((o: any) => ({
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
    const { data, error } = await tScope(supabase.from('invoices').select('*')).order('created_at', { ascending: false }).limit(LIST_FETCH_LIMIT);
    if (error) console.error(error);
    if (data) {
      setInvoices(applyDataSecurity(data).map((inv: any) => ({
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
    const { data, error } = await tScope(supabase.from('activities').select('*')).order('created_at', { ascending: false }).limit(LIST_FETCH_LIMIT);
    if (error) console.error(error);
    if (data) {
      setActivities(applyDataSecurity(data).map((a: any) => ({
        ...a,
        id: a.activity_number, displayNumber: a.display_number, name: a.name, customer: a.customer, customerId: a.customer_id,
        contact: a.contact, contactId: a.contact_id, subject: a.subject,
        activityType: a.activity_type, activityDate: a.activity_date, notes: a.notes, status: a.status,
        created_by: a.created_by, created_at: a.created_at, updated_by: a.updated_by, updated_at: a.updated_at,
        organization_id: a.organization_id, business_unit_id: a.business_unit_id,
      })));
    }
  };

  // Server-side exact row count for a list page's underlying table — used by
  // CRMListPage.tsx / RetailListPage.tsx to show an accurate total even when
  // only LIST_FETCH_LIMIT rows are loaded client-side (see the pagination
  // TODO near the top of this file). `{ count:'exact', head:true }` asks
  // PostgREST for just the count, not the rows, so this is cheap to call.
  const LIST_PAGE_TABLE: Record<string, string> = {
    customers: 'customers', products: 'products', leads: 'leads', opportunities: 'opportunities',
    orders: 'orders', invoices: 'invoices', contacts: 'contacts', activities: 'activities',
    quotations: 'quotations',
    retailCustomers: 'retail_customers', retailProducts: 'retail_products',
    retailActivities: 'retail_activities', retailOrders: 'retail_orders', retailInvoices: 'retail_invoices',
  };
  const fetchListCount = async (page: string): Promise<number> => {
    const table = LIST_PAGE_TABLE[page];
    if (!supabase || !table) return 0;
    const { count, error } = await tScope(supabase.from(table).select('*', { count: 'exact', head: true }));
    if (error) { console.error(error); return 0; }
    return count || 0;
  };

  const fetchLineItems = async (table: string, field: string, id: string): Promise<LineItem[]> => {
    if (!supabase) return [];
    const { data } = await tScope(supabase.from(table).select('*')).eq(field, id);
    return (data || []).map((item: any) => ({
      id: item.id, product: item.product_name,
      quantity: Number(item.quantity || 1), price: Number(item.price || 0),
    }));
  }

  // Provider-level line item upsert — used by quotation CRUD (richer payload than updateRecord's local one)
  const upsertLineItemsGeneric = async (table: string, fkField: string, id: string, items: any[]) => {
    if (!supabase || !items) return;
    // Always read freshest tenantId — state may not have updated yet if tenant resolved late
    const effectiveTenantId = tenantId
      || (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null)
      || null;
    await supabase.from(table).delete().eq(fkField, id);
    if (items.length) {
      const { error } = await supabase.from(table).insert(items.map((i: any, idx: number) => ({
        [fkField]:      id,
        product_name:   i.product_name || i.product || '',
        product_code:   i.product_code || '',
        description:    i.description  || '',
        quantity:       Number(i.quantity   || 1),
        unit_price:     Number(i.unit_price ?? i.price ?? 0),
        list_price:     Number(i.list_price ?? i.unit_price ?? i.price ?? 0),
        discount_pct:   Number(i.discount_pct ?? i.discount ?? 0),
        tax_pct:        Number(i.tax_pct    || 0),
        extended_price: Number(i.quantity||1) * Number(i.unit_price ?? i.price ?? 0) * (1 - Number(i.discount_pct ?? i.discount ?? 0)/100),
        sort_order:     idx,
        configuration:  i.configuration || {},
        custom_data:    i.custom_data || {},
        ...(effectiveTenantId ? { tenant_id: effectiveTenantId } : {}),
      })));
      if (error) console.error('[upsertLineItemsGeneric] insert error:', error.message, 'tenantId:', effectiveTenantId);
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
    const { data, error } = await tScope(supabase.from('retail_customers').select('*')).order('created_at', { ascending: false }).limit(LIST_FETCH_LIMIT);
    if (error) { if (!String(error.message).includes('does not exist')) console.error('fetchRetailCustomers:', error.message); return; }
    if (data) setRetailCustomers(applyDataSecurity(data).map((c: any) => ({ ...c, id: c.customer_number, _uuid: c.id, displayNumber: c.display_number })));
  };

  const fetchRetailProducts = async () => {
    if (!supabase) return;
    const { data, error } = await tScope(supabase.from('retail_products').select('*')).order('created_at', { ascending: false }).limit(LIST_FETCH_LIMIT);
    if (error) { if (!String(error.message).includes('does not exist')) console.error('fetchRetailProducts:', error.message); return; }
    if (data) setRetailProducts(applyDataSecurity(data).map((p: any) => ({ ...p, id: p.product_number, _uuid: p.id, displayNumber: p.display_number })));
  };

  const fetchRetailActivities = async () => {
    if (!supabase) return;
    const { data, error } = await tScope(supabase.from('retail_activities').select('*')).order('created_at', { ascending: false }).limit(LIST_FETCH_LIMIT);
    if (error) { if (!String(error.message).includes('does not exist')) console.error('fetchRetailActivities:', error.message); return; }
    if (data) setRetailActivities(applyDataSecurity(data).map((a: any) => ({ ...a, id: a.activity_number, _uuid: a.id, displayNumber: a.display_number })));
  };

  const fetchRetailOrders = async () => {
    if (!supabase) return;
    const { data, error } = await tScope(supabase.from('retail_orders').select('*')).order('created_at', { ascending: false }).limit(LIST_FETCH_LIMIT);
    if (error) { if (!String(error.message).includes('does not exist')) console.error('fetchRetailOrders:', error.message); return; }
    if (data) {
      const mapped = applyDataSecurity(data).map((o: any) => ({ ...o, id: o.order_number, _uuid: o.id, displayNumber: o.display_number }));
      setRetailOrders(mapped);
      if (typeof window !== 'undefined') (window as any).__bp_retail_orders = mapped;
    }
  };

  const fetchRetailInvoices = async () => {
    if (!supabase) return;
    const { data, error } = await tScope(supabase.from('retail_invoices').select('*')).order('created_at', { ascending: false }).limit(LIST_FETCH_LIMIT);
    if (error) { if (!String(error.message).includes('does not exist')) console.error('fetchRetailInvoices:', error.message); return; }
    if (data) {
      // Order # enrichment needs the orders cache — on first load both fetches race,
      // so populate it here if it's still empty
      if (!((window as any).__bp_retail_orders || []).length) {
        try { await fetchRetailOrders(); } catch {}
      }
      const orders = (window as any).__bp_retail_orders || [];
      setRetailInvoices(applyDataSecurity(data).map((i: any) => {
        let orderNum = i.order_number;
        if (orderNum && orderNum.length > 14) {
          const ord = orders.find((o: any) => o._uuid === orderNum || o.order_number === orderNum || o.id === orderNum);
          if (ord?.displayNumber) orderNum = 'RORD-' + String(ord.displayNumber).padStart(5, '0');
        }
        return { ...i, id: i.invoice_number, _uuid: i.id, displayNumber: i.display_number, order_number: orderNum };
      }));
    }
  };

  // ─── Retail line items (orders / invoices) ────────────────────────────────
  const fetchRetailLineItems = async (table: 'retail_order_line_items'|'retail_invoice_line_items', fkField: string, id: string) => {
    if (!supabase || !id) return [];
    const { data, error } = await tScope(supabase.from(table).select('*')).eq(fkField, id).order('sort_order');
    if (error) { console.error(`fetchRetailLineItems(${table}):`, error.message); return []; }
    return data || [];
  };

  // Is this order status one that should hold a rental booking (block other
  // orders from booking the same item over the same dates)? Configured by
  // the tenant in Admin Tools → Rental Settings; falls back to a sensible
  // default (Pending/Confirmed/Completed) if never explicitly configured.
  const isRentalBlockingStatus = (status: string): boolean => {
    const configured = appPreferences?.rental_blocking_statuses;
    const list = Array.isArray(configured) && configured.length ? configured : ['Draft','Pending','Completed'];
    return list.includes(status);
  };

  // Validates a rental date range: no past dates, and start must be on or
  // before end. Single source of truth for this rule across every save
  // path — the UI also enforces this locally (disabling past dates in the
  // date pickers, auto-correcting a backwards range selection) purely for
  // immediate feedback, but this is the check that actually blocks a save,
  // since UI-level restrictions alone can't be trusted (a stale page, a
  // different client, or someone bypassing the UI entirely).
  const validateRentalDateRange = (startISO: string, endISO: string, allowPast: boolean = false): string | null => {
    const todayISO = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time, no UTC conversion
    if (!allowPast && startISO < todayISO) return 'Rental start date cannot be in the past.';
    if (endISO < startISO) return 'Rental end date must be on or after the start date.';
    return null;
  };

  // The actual safety net for the rental feature — checks for an existing
  // OTHER order already holding an overlapping booking for the same product.
  // This runs before the write is attempted, giving a clear, specific error
  // ("already booked by order X") rather than a raw database constraint
  // violation. It is not the ONLY protection: the database's own exclusion
  // constraint (see 12_rental_booking_mode.sql) is what actually guarantees
  // correctness against a genuine race condition — two staff members saving
  // overlapping bookings within the same instant. This check exists to make
  // the common case (no race, just an honest scheduling conflict) fail with
  // a helpful message instead of a raw constraint-violation error string.
  const checkRentalConflict = async (
    productId: string, startDate: string, endDate: string, excludeOrderNumber?: string
  ): Promise<{ conflict: boolean; withOrder?: string; unresolved?: boolean }> => {
    if (!supabase || !productId || !startDate || !endDate) return { conflict: false };
    // Never run this query unscoped across tenants — on the shared DB that
    // would mean checking (and potentially matching against) every other
    // tenant's bookings. Poll briefly for tenant resolution (same reasoning
    // as verifyTenantMembership elsewhere in this file — window.__bp_tenant
    // is the reliable signal, never pre-populated with a placeholder) and
    // fail CLOSED — refuse to confirm availability — if it never resolves,
    // rather than silently proceeding without a tenant filter.
    let tid = (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null) || null;
    for (let i = 0; i < 20 && !tid; i++) {
      await new Promise(r => setTimeout(r, 100));
      tid = (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null) || null;
    }
    if (!tid) {
      console.error('[checkRentalConflict] Tenant context never resolved — refusing to check availability unscoped');
      return { conflict: true, unresolved: true };
    }
    let q = supabase.from('retail_order_line_items')
      .select('order_number, rental_start_date, rental_end_date')
      .eq('tenant_id', tid)
      .eq('product_id', productId)
      .eq('is_blocking', true)
      .lte('rental_start_date', endDate)
      .gte('rental_end_date', startDate)
      .limit(5);
    if (excludeOrderNumber) q = (q as any).neq('order_number', excludeOrderNumber);
    const { data, error } = await q;
    if (error) { console.error('[checkRentalConflict]', error.message); return { conflict: true, unresolved: true }; }
    if (data && data.length) {
      const rawOrderNumber = data[0].order_number;
      // Show the clean display number (e.g. RORD-00042), not the raw
      // timestamp-based order_number — matching how every other part of
      // this app identifies a record to the user.
      let withOrder = rawOrderNumber;
      try {
        const { data: ord } = await supabase.from('retail_orders').select('display_number').eq('order_number', rawOrderNumber).eq('tenant_id', tid).maybeSingle();
        if (ord?.display_number) withOrder = formatDisplayNumber('RORD', ord.display_number);
      } catch (e) { /* fall back to raw order_number below */ }
      return { conflict: true, withOrder };
    }
    return { conflict: false };
  };

  // Builds the right message for either an actual booking conflict (name the
  // conflicting order) or an unresolved/unverifiable check (never blame a
  // specific order for something we couldn't actually confirm).
  const rentalConflictMessage = (itemName: string, withOrder?: string, unresolved?: boolean) => unresolved
    ? `Could not verify availability for "${itemName || 'this item'}" right now — please try saving again in a moment.`
    : `"${itemName || 'This item'}" is already booked for an overlapping date range by order ${withOrder}. Choose different dates or a different item.`;

  // ─── Rental return reminders (rental mode only) ────────────────────────────
  // Checks for active rental bookings ending in exactly 2 days and creates an
  // in-app notification for the order's owner, plus a WhatsApp message to
  // both the customer and the owner when WhatsApp API sending is configured
  // and active for this tenant. This is a client-triggered check (runs when
  // someone has the app open) rather than a true server-side scheduled job —
  // a guarantee that fires even with nobody logged in would need a scheduled
  // Supabase Edge Function, separate infrastructure from this. Runs once on
  // load and periodically while the app stays open, which covers a business
  // actively being used during the day.
  const checkRentalReturnReminders = async () => {
    if (!supabase) return;
    if (appPreferences?.business_type !== 'rental') return;

    const target = new Date();
    target.setDate(target.getDate() + 2);
    const targetISO = `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}-${String(target.getDate()).padStart(2,'0')}`;

    const tid = (typeof window !== 'undefined' ? (window as any).__bp_tenant : null) || {};
    let q = supabase.from('retail_order_line_items')
      .select('order_number, product_name, rental_end_date')
      .eq('rental_end_date', targetISO)
      .eq('is_blocking', true);
    if (tid.id && !tid.db_url) q = q.eq('tenant_id', tid.id);
    const { data: bookings, error } = await q;
    if (error || !bookings?.length) return;

    for (const b of bookings) {
      const { data: existing } = await supabase.from('notifications')
        .select('id').eq('record_type', 'retailOrders').eq('record_id', b.order_number)
        .eq('type', 'rental_reminder')
        .gte('created_at', new Date(Date.now() - 3*86400000).toISOString())
        .limit(1);
      if (existing?.length) continue; // already reminded for this booking recently — see dedup note above

      let orderQ = supabase.from('retail_orders').select('owner, owner_id, customer, customer_phone, display_number').eq('order_number', b.order_number);
      if (tid.id && !tid.db_url) orderQ = orderQ.eq('tenant_id', tid.id);
      const { data: order } = await orderQ.maybeSingle();
      if (!order) continue;

      let recipientEmail = order.owner && order.owner.includes('@') ? order.owner : null;
      if (!recipientEmail && order.owner_id) {
        const u = enterpriseUsers.find((u: any) => u.id === order.owner_id);
        recipientEmail = u?.email || null;
      }

      const displayNum = order.display_number ? `RORD-${String(order.display_number).padStart(5,'0')}` : b.order_number;

      if (recipientEmail) {
        await supabase.from('notifications').insert({
          recipient_email: recipientEmail,
          type: 'rental_reminder',
          title: 'Rental Return Due Soon',
          body: `${b.product_name || 'Item'} for ${order.customer || 'customer'} is due back in 2 days (${targetISO}) — Order ${displayNum}.`,
          record_type: 'retailOrders',
          record_id: b.order_number,
        });
      }

      // WhatsApp — only attempted if the tenant has API sending configured,
      // active, and a template mapped for this key. Silently skipped
      // otherwise (the in-app notification above is unconditional and
      // always the baseline), never blocking or erroring the reminder loop
      // if WhatsApp isn't set up.
      try {
        const { data: waConfig } = await supabase.from('whatsapp_config').select('is_active').eq('tenant_id', tid.id || null).maybeSingle();
        if (waConfig?.is_active) {
          const params = [order.customer || 'Customer', b.product_name || 'your item', targetISO, displayNum];
          if (order.customer_phone) {
            const rawPhone = String(order.customer_phone).replace(/\D/g, '');
            const phone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
            fetch('/api/whatsapp/send', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ db_url: tid.db_url, tenantId: tid.id, to: phone, recordType: 'retailOrders', recordId: b.order_number, recipientType: 'customer', sendMode: 'automatic', templateKey: 'rental_return_reminder', templateParams: params }),
            }).catch(() => {}); // fire-and-forget — a failed WhatsApp send should never break the reminder loop or surface as a UI error for an automatic background check
          }
        }
      } catch (e) { /* WhatsApp not configured or unreachable — the in-app notification above already covers the reminder */ }
    }
    fetchNotifications();
  };

  const upsertRetailLineItems = async (table: 'retail_order_line_items'|'retail_invoice_line_items', fkField: string, id: string, items: any[], orderStatus?: string) => {
    if (!supabase || !id) return { error: null };
    const effectiveTenantId = (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null)
      || tenantId
      || null;
    const rentalModeOn = appPreferences?.business_type === 'rental' && table === 'retail_order_line_items';

    // Conflict check runs BEFORE the delete+insert below — if any item would
    // conflict, abort entirely and touch nothing, rather than partially
    // deleting the order's existing line items and then failing partway
    // through the insert. Runs regardless of the order's current status —
    // see the matching comment in createRetailRecord/updateRetailRecord for
    // why status must never gate whether to check against existing bookings.
    if (rentalModeOn && items && items.length) {
      for (const i of items) {
        if (!i.product_id || !i.rental_start_date || !i.rental_end_date) continue;
        const dateError = validateRentalDateRange(i.rental_start_date, i.rental_end_date, true);
        if (dateError) return { error: { message: `"${i.product_name || 'This item'}": ${dateError}` } };
        const { conflict, withOrder, unresolved } = await checkRentalConflict(i.product_id, i.rental_start_date, i.rental_end_date, id);
        if (conflict) {
          return { error: { message: rentalConflictMessage(i.product_name, withOrder, unresolved) } };
        }
      }
    }

    await supabase.from(table).delete().eq(fkField, id);
    if (items && items.length) {
      const { error } = await supabase.from(table).insert(items.map((i: any, idx: number) => ({
        [fkField]:      id,
        product_name:   i.product_name || i.product || '',
        product_code:   i.product_code || '',
        description:    i.description  || '',
        quantity:       Number(i.quantity   || 1),
        unit_price:     Number(i.unit_price ?? i.price ?? 0),
        list_price:     Number(i.list_price ?? i.unit_price ?? i.price ?? 0),
        discount_pct:   Number(i.discount_pct ?? i.discount ?? 0),
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
        custom_data:    i.custom_data || {},
        ...(rentalModeOn ? {
          product_id:         i.product_id || null,
          rental_start_date:  i.rental_start_date || null,
          rental_end_date:    i.rental_end_date || null,
          // is_blocking is deliberately NOT set here — a database trigger
          // (see 13_rental_is_blocking_trigger.sql) computes it
          // automatically from the order's current status and the tenant's
          // configured blocking statuses. This is the single source of
          // truth for that computation now, so every client that writes to
          // this table — web, mobile, any future integration — gets
          // correct behavior without needing to replicate this business
          // logic itself.
        } : (table === 'retail_invoice_line_items' && appPreferences?.business_type === 'rental' ? {
          product_id:         i.product_id || null,
          rental_start_date:  i.rental_start_date || null,
          rental_end_date:    i.rental_end_date || null,
        } : {})),
        ...(effectiveTenantId ? { tenant_id: effectiveTenantId } : {}),
      })));
      if (error) {
        console.error('[upsertRetailLineItems] error:', error.message, 'tenantId:', effectiveTenantId);
        // Surface a clear message if this was actually the database's own
        // exclusion constraint catching a genuine race condition (two saves
        // landing at almost the same instant) that slipped past the
        // check above.
        if (error.message?.includes('no_overlapping_rental_bookings') || error.message?.includes('exclusion')) {
          return { error: { message: 'This item was just booked by another order for overlapping dates — please choose different dates or refresh and try again.' } };
        }
        return { error };
      }
    }
    return { error: null };
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
    retail_products:   ['name','category','brand','sku','barcode','unit','price','mrp','cost','stock_quantity','reorder_level','description','hsn_code','gst_rate','taxable','tax_category','vat_rate','tax_rate','status','owner','owner_id','owner_name','comments','organization_id','business_unit_id','custom_data','is_rentable','rent_per_day'],
    retail_activities: ['subject','activity_type','customer','customer_id','customer_phone','activity_date','due_date','priority','status','description','notes','comments','owner','owner_id','owner_name','organization_id','business_unit_id','custom_data'],
    retail_orders:     ['customer','customer_id','customer_phone','order_date','channel','currency','payment_method','payment_status','delivery_method','delivery_address','delivery_date','subtotal','total_discount','total_tax','header_discount_pct','header_discount_amount','shipping_cost','amount','place_of_supply','gstin','tax_state','resale_certificate','vat_registration_number','tax_registration_number','status','notes','comments','owner','owner_id','owner_name','organization_id','business_unit_id','custom_data'],
    retail_invoices:   ['order_number','customer','customer_id','customer_phone','invoice_date','due_date','currency','subtotal','total_discount','total_tax','header_discount_pct','header_discount_amount','shipping_cost','amount','payment_method','payment_status','place_of_supply','gstin','tax_state','resale_certificate','vat_registration_number','tax_registration_number','status','notes','comments','owner','owner_id','owner_name','organization_id','business_unit_id','custom_data','invoice_template_id'],
  };

  const createRetailRecord = async (page: keyof typeof RETAIL_TABLE_MAP, data: any, items: any[] = []) => {
    if (!supabase || !currentUser) return null;
    const cfg = RETAIL_TABLE_MAP[page];
    if (!cfg) return null;
    try {
    // Mandatory-field guard — final gate regardless of which UI called this
    if ((page === 'retailCustomers' || page === 'retailProducts') && !String(data.name || '').trim()) {
      showAlert('Name is required.'); return null;
    }
    if ((page === 'retailOrders' || page === 'retailInvoices') && !data.customer_id) {
      showAlert('Please select a customer before creating this record.'); return null;
    }
    if (page === 'retailActivities' && !String(data.subject || '').trim()) {
      showAlert('Subject is required.'); return null;
    }
    // Duplicate check — B2C customer creation only, per the same pattern as
    // B2B below. Matches on name OR phone OR email; warns and lets the admin
    // decide rather than blocking outright, since a legitimate second
    // customer can share a common name.
    if (page === 'retailCustomers') {
      const nameNorm  = String(data.name||'').toLowerCase().trim();
      const phoneNorm = String(data.phone||'').replace(/\D/g,'');
      const emailNorm = String(data.email||'').toLowerCase().trim();
      const dup = (retailCustomers||[]).find(c =>
        (nameNorm && c.name?.toLowerCase().trim() === nameNorm) ||
        (phoneNorm && c.phone && c.phone.replace(/\D/g,'') === phoneNorm) ||
        (emailNorm && c.email?.toLowerCase().trim() === emailNorm)
      );
      if (dup) {
        const matchedOn = [
          nameNorm && dup.name?.toLowerCase().trim() === nameNorm ? 'name' : null,
          phoneNorm && dup.phone?.replace(/\D/g,'') === phoneNorm ? 'phone' : null,
          emailNorm && dup.email?.toLowerCase().trim() === emailNorm ? 'email' : null,
        ].filter(Boolean).join(' and ');
        const ok = await showConfirm(`A customer named "${dup.name}" already exists with a matching ${matchedOn}. Create this as a new, separate customer anyway?`, { title:'Possible Duplicate Customer', variant:'warning', confirmLabel:'Create Anyway' });
        if (!ok) return null;
      }
    }
    // Rental booking conflict check — runs BEFORE the order record itself is
    // created, not after, so a detected conflict never leaves behind an
    // orphaned order with no line items. Runs for ANY line item with
    // product_id+dates set, regardless of this order's own current status —
    // matching the UI warning's own logic exactly. The status only decides
    // whether THIS order's dates become a blocking reservation once saved
    // (see is_blocking below); it must never decide whether to check
    // against OTHER existing bookings, or a conflict could slip through
    // anytime the order isn't already in a blocking status at save time.
    if (page === 'retailOrders' && appPreferences?.business_type === 'rental') {
      for (const i of items) {
        if (!i.product_id || !i.rental_start_date || !i.rental_end_date) continue;
        const dateError = validateRentalDateRange(i.rental_start_date, i.rental_end_date);
        if (dateError) { showAlert(`"${i.product_name || 'This item'}": ${dateError}`, { variant:'warning', title:'Invalid Dates' }); return null; }
        const { conflict, withOrder, unresolved } = await checkRentalConflict(i.product_id, i.rental_start_date, i.rental_end_date);
        if (conflict) {
          showAlert(rentalConflictMessage(i.product_name, withOrder, unresolved), { variant:'danger', title:'Booking Conflict' });
          return null;
        }
      }
    }
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
      ...(tenantId ? { tenant_id: tenantId } : {}),
    };
    delete payload.id; delete payload._uuid;
    const { data: inserted, error } = await withTimeout(supabase.from(cfg.table).insert([payload]).select().single(), 20000, 'Save');
    if (error) { showAlert('Save failed: ' + error.message); return null; }
    if (cfg.lineItemTable && items.length) {
      const { error: liError } = await upsertRetailLineItems(cfg.lineItemTable as any, cfg.lineFK!, newId, items, payload.status);
      if (liError) { showAlert('Save failed: ' + liError.message, { variant:'danger', title:'Booking Conflict' }); return null; }
    }
    // Status automations
    if (page === 'retailOrders' || page === 'retailInvoices') {
      await autoSetRetailCustomerStatus(data.customer_id, 'Active');
    }
    await runAutomations(page, newId, { ...data, id: newId }, 'on_create');
    await cfg.fetch();
    return { ...inserted, id: inserted[cfg.idField], _uuid: inserted.id };
    } catch (e: any) {
      console.error('[createRetailRecord]', e);
      showAlert('Save failed: ' + (e?.message || 'An unexpected error occurred.'));
      return null;
    }
  };

  const updateRetailRecord = async (page: keyof typeof RETAIL_TABLE_MAP, record: any, items: any[] = []) => {
    if (!supabase) return;
    const cfg = RETAIL_TABLE_MAP[page];
    if (!cfg) return;
    try {

    // Terminal statuses can never be reverted (checked against the DB, not stale UI state)
    const TERMINAL = ['Completed','Paid','Cancelled','Refunded'];
    if (record.status && !TERMINAL.includes(record.status)) {
      const { data: cur } = await supabase.from(cfg.table).select('status').eq(cfg.idField, record.id).maybeSingle();
      if (cur && TERMINAL.includes(cur.status) && cur.status !== record.status) {
        showAlert(`This record is ${cur.status} and its status can no longer be changed to ${record.status}.`);
        return;
      }
    }

    // Allowlist filtering — only known DB columns are ever written, mirroring
    // createRetailRecord's approach. This is safer than a hand-maintained
    // denylist of specific client-side fields to exclude: a denylist has to
    // be remembered and updated every single time a new computed/display-only
    // field gets added anywhere in the record object, and reliably breaks
    // when it isn't — e.g. customer_name_resolved (added later for list-view
    // display) was never added to the old denylist, causing every retail
    // invoice/order/activity save to fail with a "column not found" error.
    const allowed = RETAIL_ALLOWED_COLS[cfg.table] || [];
    const filtered: any = {};
    allowed.forEach(k => { if (record[k] !== undefined) filtered[k] = record[k]; });
    // Invoices: order_number is enriched to a display format on fetch — never write it back
    if (page === 'retailInvoices') delete filtered.order_number;

    const payload: any = { ...filtered, ...buildSystemFields(true) };

    // Rental booking conflict check — before the order update itself, same
    // reasoning as createRetailRecord: avoids a mismatch between the order's
    // newly-saved status and line items that failed to save because of a
    // conflict. Runs for ANY line item with product_id+dates set, regardless
    // of this order's own current status — see the matching comment in
    // createRetailRecord above for why the status must never gate this
    // check. Excludes this order's own existing line items from the check,
    // since re-saving an order with unchanged dates on its own existing
    // booking is not a conflict with itself.
    if (page === 'retailOrders' && appPreferences?.business_type === 'rental') {
      for (const i of items) {
        if (!i.product_id || !i.rental_start_date || !i.rental_end_date) continue;
        const dateError = validateRentalDateRange(i.rental_start_date, i.rental_end_date, true);
        if (dateError) { showAlert(`"${i.product_name || 'This item'}": ${dateError}`, { variant:'warning', title:'Invalid Dates' }); return; }
        const { conflict, withOrder, unresolved } = await checkRentalConflict(i.product_id, i.rental_start_date, i.rental_end_date, record.id);
        if (conflict) {
          showAlert(rentalConflictMessage(i.product_name, withOrder, unresolved), { variant:'danger', title:'Booking Conflict' });
          return;
        }
      }
    }

    const { error } = await withTimeout(supabase.from(cfg.table).update(payload).eq(cfg.idField, record.id), 20000, 'Save');
    if (error) { console.error(`update ${cfg.table}:`, error.message); showAlert('Save failed: ' + error.message); return; }
    if (cfg.lineItemTable) {
      const { error: liError } = await upsertRetailLineItems(cfg.lineItemTable as any, cfg.lineFK!, record.id, items, payload.status);
      if (liError) { showAlert('Save failed: ' + liError.message, { variant:'danger', title:'Booking Conflict' }); return; }
    }
    if (page === 'retailOrders' || page === 'retailInvoices') {
      await autoSetRetailCustomerStatus(record.customer_id, 'Active');
    }
    await runAutomations(page, record.id, record, 'on_update');
    await cfg.fetch();
    } catch (e: any) {
      console.error('[updateRetailRecord]', e);
      showAlert('Save failed: ' + (e?.message || 'An unexpected error occurred.'));
    }
  };

  const deleteRetailRecord = async (page: keyof typeof RETAIL_TABLE_MAP, recordId: string) => {
    if (!supabase) return;
    if (!(await showConfirm('Delete this record?', { variant:'danger', confirmLabel:'Delete' }))) return;
    const cfg = RETAIL_TABLE_MAP[page];
    if (!cfg) return;
    try {
      if (cfg.lineItemTable) await supabase.from(cfg.lineItemTable).delete().eq(cfg.lineFK!, recordId);
      await supabase.from(cfg.table).delete().eq(cfg.idField, recordId);
      await cfg.fetch();
    } catch (e: any) {
      console.error('[deleteRetailRecord]', e);
      showAlert('Delete failed: ' + (e?.message || 'An unexpected error occurred.'));
    }
  };

  // ─── Retail Order → Retail Invoice conversion ──────────────────────────────
  const createRetailInvoiceFromOrder = async (order: any) => {
    if (!supabase || !currentUser) return null;
    // Check if invoice already exists for this order.
    // Invoices may have been created against the order's UUID, its raw order_number,
    // or its display format (RORD-#####) depending on when they were created —
    // so check ALL candidate formats in a single query rather than just one.
    const orderCandidates = Array.from(new Set([
      order._uuid,
      order.id,
      order.order_number,
      order.displayNumber ? 'RORD-' + String(order.displayNumber).padStart(5, '0') : null,
    ].filter(Boolean)));
    const { data: existingList } = await supabase
      .from('retail_invoices')
      .select('invoice_number')
      .in('order_number', orderCandidates)
      .limit(1);
    const existing = existingList?.[0];
    if (existing) {
      showAlert(`An invoice already exists for this order (${existing.invoice_number}). Cannot create duplicate.`);
      return null;
    }
    const items = await fetchRetailLineItems('retail_order_line_items', 'order_number', order.id);
    const invId = generateId('RINV');
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
    // Timezone-safe formatting — toISOString() converts to UTC before
    // formatting, which can shift the date back a day for any timezone
    // ahead of UTC (e.g. IST). Uses local date getters directly instead,
    // same fix already applied to the booking calendar's own date handling.
    const dueDateISO = `${dueDate.getFullYear()}-${String(dueDate.getMonth()+1).padStart(2,'0')}-${String(dueDate.getDate()).padStart(2,'0')}`;
    const payload: any = {
      ...buildSystemFields(),
      invoice_number: invId,
      order_number: order.displayNumber
        ? 'RORD-' + String(order.displayNumber).padStart(5, '0')
        : (order.order_number || order.id),
      customer: order.customer || '',
      customer_id: order.customer_id || null,
      customer_phone: order.customer_phone || '',
      currency: order.currency || 'INR',
      subtotal: Number(order.subtotal || 0),
      total_discount: Number(order.total_discount || 0),
      total_tax: Number(order.total_tax || 0),
      shipping_cost: Number(order.shipping_cost || 0),
      amount: Number(order.amount || 0),
      payment_method: order.payment_method || '',
      // Map order payment_status to invoice payment_status and invoice status
      // Paid order → Paid invoice; Unpaid/Pending → Sent invoice (awaiting payment)
      payment_status: order.payment_status || 'Unpaid',
      place_of_supply: order.place_of_supply || '',
      gstin: order.gstin || '',
      tax_state: order.tax_state || '',
      resale_certificate: order.resale_certificate || '',
      vat_registration_number: order.vat_registration_number || '',
      tax_registration_number: order.tax_registration_number || '',
      due_date: dueDateISO,
      // Invoice status when converted from order: always Draft so it's editable
      // Staff can review and mark Paid once confirmed
      status: 'Draft',
      owner: order.owner || currentUser.email,
      owner_id: order.owner_id || currentUser.id,
      // Previously not carried over at all, even though they exist on
      // retail_invoices and are genuinely useful context from the order —
      // delivery_method/delivery_address were considered too, but confirmed
      // NOT to exist as columns on retail_invoices at all, so they're
      // deliberately left out rather than causing an insert error.
      notes: order.notes || '',
      comments: order.comments || '',
      organization_id: order.organization_id || null,
      business_unit_id: order.business_unit_id || null,
      custom_data: order.custom_data || {},
    };
    // Copy Maps — apply any active record-conversion rules for
    // Order → Invoice, copying mapped fields from the order onto the
    // new invoice payload before it's saved.
    const conversionRules = await fetchFieldMappingRules(supabase, 'record_conversion', 'retailOrders', getScopeTenantId());
    applyFieldMapping(conversionRules.filter(r => r.conversion_context === 'retailOrder_to_retailInvoice'), order, payload);
    const { data: inserted, error } = await supabase.from('retail_invoices').insert([payload]).select().single();
    if (error) { showAlert('Failed to create invoice: ' + error.message); return null; }
    if (items.length) await upsertRetailLineItems('retail_invoice_line_items', 'invoice_number', invId, items);
    await autoSetRetailCustomerStatus(order.customer_id, 'Active');
    await fetchRetailInvoices();
    return { ...inserted, id: inserted.invoice_number, _uuid: inserted.id };
  };


  // \u2500\u2500\u2500 Fetch: Admin \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const fetchOrganizations = async () => {
    if (!supabase) return;
    const { data } = await tScope(supabase.from('organizations').select('*')).order('created_at', { ascending: false });
    if (data) setOrganizations(data);
  };

  const fetchBusinessUnits = async () => {
    if (!supabase) return;
    const { data } = await tScope(supabase.from('business_units').select('*')).order('created_at', { ascending: false });
    if (data) setBusinessUnits(data);
  };

  const fetchEnterpriseUsers = async () => {
    if (!supabase) return;
    const { data } = await tScope(supabase.from('enterprise_users').select('*')).order('created_at', { ascending: false });
    if (data) setEnterpriseUsers(data);
  };

  const fetchUserGroups = async () => {
    if (!supabase) return;
    const { data } = await tScope(supabase.from('user_groups').select('*')).order('created_at', { ascending: false });
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
    const { data } = await tScope(supabase.from('quote_templates').select('*')).order('created_at', { ascending: false });
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
    const { data } = await tScope(supabase.from('workflow_rules').select('*')).order('created_at', { ascending: false });
    if (data) setWorkflowRules(data);
  };

  const fetchAssignmentRules = async () => {
    if (!supabase) return;
    const { data } = await tScope(supabase.from('assignment_rules').select('*')).order('priority');
    if (data) setAssignmentRules(data);
  };

  const fetchSLAPolicies = async () => {
    if (!supabase) return;
    const { data } = await tScope(supabase.from('sla_policies').select('*')).order('created_at', { ascending: false });
    if (data) setSlaPolicies(data);
  };

  const fetchApprovalProcesses = async () => {
    if (!supabase) return;
    const { data } = await tScope(supabase.from('approval_processes').select('*')).order('created_at', { ascending: false });
    if (data) setApprovalProcesses(data);
  };

  const fetchApprovalRequests = async () => {
    if (!supabase) return;
    const { data } = await tScope(supabase.from('approval_requests').select('*')).order('submitted_at', { ascending: false });
    if (data) setApprovalRequests(data);
  };

  // \u2500\u2500\u2500 Fetch: Notifications \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const fetchNotifications = async () => {
    if (!supabase) return;
    const email = currentUser?.email || session?.user?.email;
    if (!email) return;
    // Not using the generic tScope() here deliberately — its non-demo
    // branch is a strict .eq('tenant_id', tid) with no null fallback,
    // which would permanently hide any notification created before
    // tenant_id started being set on insert (see createNotification).
    // recipient_email is the real access boundary for this table (a user
    // only ever sees their own notifications regardless of tenant_id), so
    // including legacy null-tenant_id rows here is safe in a way it
    // wouldn't necessarily be for other tables.
    const tid = getScopeTenantId();
    let q = supabase.from('notifications').select('*').eq('recipient_email', email);
    if (tid) q = q.or(`tenant_id.eq.${tid},tenant_id.is.null`);
    const { data } = await q.order('created_at', { ascending: false }).limit(50);
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
      tenant_id: getScopeTenantId(),
    }]);
    if (params.recipientEmail === currentUser?.email) await fetchNotifications();
  };

  // \u2500\u2500\u2500 Admin CRUD \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const saveOrganization = async (data: any, editingId?: string) => {
    if (!supabase) return;
    const name = (data.name||'').trim();
    if (!name) { showAlert('Organization Name is required.', { variant:'warning' }); return; }
    if (!/[a-zA-Z0-9]/.test(name)) { showAlert('Organization Name must contain at least one letter or number — special characters alone are not a valid name.', { variant:'warning' }); return; }
    if (data.website && data.website.trim()) {
      const site = data.website.trim();
      // Accept bare domains (example.com) and full URLs (https://example.com) —
      // reject obvious junk like "asdf" or "@#$%" with no domain shape at all.
      const domainLike = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;
      if (!domainLike.test(site)) { showAlert('Website doesn\'t look like a valid domain or URL (e.g. example.com or https://example.com).', { variant:'warning' }); return; }
    }
    const payload = { ...data, name, ...(tenantId ? { tenant_id: tenantId } : {}) };
    if (editingId) {
      const { error } = await supabase.from('organizations').update(payload).eq('id', editingId);
      if (error) { showAlert('Failed to update: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('organizations').insert([payload]);
      if (error) { showAlert('Failed to create: ' + error.message); return; }
    }
    await fetchOrganizations();
  };

  const saveBusinessUnit = async (data: any, editingId?: string) => {
    if (!supabase) return;
    const name = (data.name||'').trim();
    if (!name) { showAlert('Business Unit Name is required.', { variant:'warning' }); return; }
    if (!/[a-zA-Z0-9]/.test(name)) { showAlert('Business Unit Name must contain at least one letter or number — special characters alone are not a valid name.', { variant:'warning' }); return; }
    // Warn (don't silently allow) if the selected parent org is deactivated —
    // the record can still be created if the admin confirms, but this makes
    // an otherwise-invisible state an explicit, deliberate choice.
    if (data.organization_id) {
      const parentOrg = organizations.find(o => o.id === data.organization_id);
      if (parentOrg && parentOrg.status !== 'Active') {
        const ok = await showConfirm(`"${parentOrg.name}" is currently Inactive. Business units are usually only added to active organizations. Continue anyway?`, { title:'Inactive Organization', variant:'warning', confirmLabel:'Continue Anyway' });
        if (!ok) return;
      }
    }
    const payload = { ...data, name, ...(tenantId ? { tenant_id: tenantId } : {}) };
    if (editingId) {
      const { error } = await supabase.from('business_units').update(payload).eq('id', editingId);
      if (error) { showAlert('Failed to update: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('business_units').insert([payload]);
      if (error) { showAlert('Failed to create: ' + error.message); return; }
    }
    await fetchBusinessUnits();
  };

  const saveEnterpriseUser = async (data: any, editingId?: string, password?: string) => {
    if (!supabase) return;
    // Normalise UUID columns: empty string is invalid uuid input in Postgres
    const normaliseUser = (d: any) => {
      const out = { ...d };
      delete out.roles; // joined object from select — not a real column
      for (const k of ['organization_id','business_unit_id','role_id','user_group_id','auth_user_id','owner_id']) {
        if (out[k] === '') out[k] = null;
      }
      return out;
    };
    if (data.organization_id) {
      const org = organizations.find(o => o.id === data.organization_id);
      if (org && org.status !== 'Active') {
        const ok = await showConfirm(`"${org.name}" is currently Inactive. Continue assigning this user to it anyway?`, { title:'Inactive Organization', variant:'warning', confirmLabel:'Continue Anyway' });
        if (!ok) return;
      }
    }
    if (data.business_unit_id) {
      const bu = businessUnits.find(b => b.id === data.business_unit_id);
      if (bu && bu.status !== 'Active') {
        const ok = await showConfirm(`"${bu.name}" is currently Inactive. Continue assigning this user to it anyway?`, { title:'Inactive Business Unit', variant:'warning', confirmLabel:'Continue Anyway' });
        if (!ok) return;
      }
    }
    if (editingId) {
      // Duplicate email guard on edit too — changing an existing user's email
      // to one already used by someone else was previously unguarded (only
      // new-user creation checked this), and would otherwise surface as a
      // cryptic DB constraint error rather than a clear message.
      if (data.email) {
        const { data: existing } = await tScope(supabase.from('enterprise_users').select('id,email')).ilike('email', data.email).neq('id', editingId).limit(1);
        if (existing && existing.length) {
          showAlert(`A user with email "${data.email}" already exists in this workspace. Please use a different email.`);
          return;
        }
      }
      // Changing a user's Organization doesn't orphan any records they own
      // (leads/customers/etc. reference the user directly, not their org) —
      // but under an org-scoped Data Security Policy it can immediately
      // change what data they're able to see. Warn rather than silently
      // proceed, so this is a deliberate admin choice, not a surprise.
      const existingUser = enterpriseUsers.find(u => u.id === editingId);
      if (existingUser && data.organization_id && existingUser.organization_id && data.organization_id !== existingUser.organization_id) {
        const ownedCount =
          customers.filter(c => c.owner_id === editingId).length +
          leads.filter(l => l.owner_id === editingId).length +
          opportunities.filter(o => o.owner_id === editingId).length +
          orders.filter(o => o.owner_id === editingId).length +
          invoices.filter(i => i.owner_id === editingId).length;
        if (ownedCount > 0) {
          const ok = await showConfirm(`This user owns ${ownedCount} record${ownedCount>1?'s':''} (leads, customers, orders, etc.). Their existing records will stay assigned to them, but moving them to a different organization may change what data they can see if roles use organization-scoped visibility. Continue?`, { title:'User Has Existing Data', variant:'warning', confirmLabel:'Continue Anyway' });
          if (!ok) return;
        }
      }
      const updatePayload = { ...normaliseUser(data), ...(tenantId ? { tenant_id: tenantId } : {}) };
      const { error } = await supabase.from('enterprise_users').update(updatePayload).eq('id', editingId);
      if (error) { showAlert('Failed to update user: ' + error.message); return; }
      await fetchEnterpriseUsers();
      return;
    }
    // Duplicate email guard — reject clearly instead of a cryptic constraint error
    if (data.email) {
      const { data: existing } = await tScope(supabase.from('enterprise_users').select('id,email')).ilike('email', data.email).limit(1);
      if (existing && existing.length) {
        showAlert(`A user with email "${data.email}" already exists in this workspace. Please use a different email.`);
        return;
      }
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
            tenant_id:        tenantId               || null,
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
          showAlert('API error (status ' + res.status + '): ' + text.slice(0,200));
          await supabase.from('enterprise_users').insert([{ ...normaliseUser(data), ...(tenantId ? { tenant_id: tenantId } : {}) }]);
          await fetchEnterpriseUsers();
          return;
        }
        if (res.ok && json.success) {
          await fetchEnterpriseUsers();
          return;
        }
        showAlert('Could not create auth account: ' + (json?.error || json?.hint || text.slice(0,200)));
      }
    }
    // Fallback: insert enterprise_user only (no auth)
    const { error: insErr } = await supabase.from('enterprise_users').insert([{ ...normaliseUser(data), ...(tenantId ? { tenant_id: tenantId } : {}) }]);
    if (insErr) { showAlert('Failed to create user: ' + insErr.message); return; }
    await fetchEnterpriseUsers();
  };

  const saveUserGroup = async (data: any, editingId?: string) => {
    if (!supabase) return;
    const payload = { ...data, ...(tenantId ? { tenant_id: tenantId } : {}) };
    if (editingId) {
      const { error } = await supabase.from('user_groups').update(payload).eq('id', editingId);
      if (error) { showAlert('Failed: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('user_groups').insert([payload]);
      if (error) { showAlert('Failed: ' + error.message); return; }
    }
    await fetchUserGroups();
  };

  const saveRole = async (data: any, editingId: string | null, permissionIds: string[]) => {
    if (!supabase) return;
    let roleId = editingId || '';
    if (editingId) {
      const { error } = await supabase.from('roles').update(data).eq('id', editingId);
      if (error) { showAlert('Failed to update role'); return; }
    } else {
      const { data: newRole, error } = await supabase.from('roles').insert([data]).select().single();
      if (error || !newRole) { showAlert(error?.message || 'Unable to create role'); return; }
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
    const { error } = await supabase.from('user_group_members').insert(
      newIds.map(uid => ({ user_group_id: groupId, enterprise_user_id: uid, ...(tenantId ? { tenant_id: tenantId } : {}) }))
    );
    if (error) { showAlert('Could not add members: ' + error.message); return; }
    await fetchGroupMembers(groupId);
  };

  const removeUserFromGroup = async (membershipId: string, groupId: string) => {
    if (!supabase) return;
    await supabase.from('user_group_members').delete().eq('id', membershipId);
    await fetchGroupMembers(groupId);
  };

  const deleteAdminRecord = async (table: string, id: string): Promise<boolean> => {
    if (!supabase) return false;
    // Referential-integrity guard: block deletion (rather than silently
    // orphaning dependent records) when other records still point at this
    // one. Deactivating (status → Inactive) remains available as the
    // non-destructive alternative when a record is still referenced.
    if (table === 'organizations') {
      const buCount = businessUnits.filter(b => b.organization_id === id).length;
      const userCount = enterpriseUsers.filter(u => u.organization_id === id).length;
      if (buCount > 0 || userCount > 0) {
        const parts = [];
        if (buCount) parts.push(`${buCount} business unit${buCount>1?'s':''}`);
        if (userCount) parts.push(`${userCount} user${userCount>1?'s':''}`);
        showAlert(`Can't delete this organization — it still has ${parts.join(' and ')} assigned to it. Reassign or remove those first, or deactivate the organization instead.`, { variant:'danger', title:'Organization In Use' });
        return false;
      }
    }
    if (table === 'business_units') {
      const userCount = enterpriseUsers.filter(u => u.business_unit_id === id).length;
      if (userCount > 0) {
        showAlert(`Can't delete this business unit — it still has ${userCount} user${userCount>1?'s':''} assigned to it. Reassign those users first, or deactivate the business unit instead.`, { variant:'danger', title:'Business Unit In Use' });
        return false;
      }
    }
    if (!(await showConfirm('Are you sure you want to delete this record?', { variant:'danger', confirmLabel:'Delete' }))) return false;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { showAlert(error.message); return false; }
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
          // Duplicate check — warns rather than blocks, since a legitimate
          // second customer can share a common name. Matches on name OR
          // phone OR email, same pattern as the retail (B2C) customer check.
          const nameNorm  = String(data.name||'').toLowerCase().trim();
          const phoneNorm = String(data.phone||'').replace(/\D/g,'');
          const emailNorm = String(data.email||'').toLowerCase().trim();
          const dup = customers.find(c =>
            (nameNorm && c.name?.toLowerCase().trim() === nameNorm) ||
            (phoneNorm && c.phone && c.phone.replace(/\D/g,'') === phoneNorm) ||
            (emailNorm && c.email?.toLowerCase().trim() === emailNorm)
          );
          if (dup) {
            const matchedOn = [
              nameNorm && dup.name?.toLowerCase().trim() === nameNorm ? 'name' : null,
              phoneNorm && dup.phone?.replace(/\D/g,'') === phoneNorm ? 'phone' : null,
              emailNorm && dup.email?.toLowerCase().trim() === emailNorm ? 'email' : null,
            ].filter(Boolean).join(' and ');
            const ok = await showConfirm(`A customer named "${dup.name}" already exists with a matching ${matchedOn}. Create this as a new, separate customer anyway?`, { title:'Possible Duplicate Customer', variant:'warning', confirmLabel:'Create Anyway' });
            if (!ok) return null;
          }
          const id = generateId('CUST');
          const { error } = await supabase.from('customers').insert([{ ...sys, custom_data: data.custom_data||{}, owner: data.owner||currentUser?.email||'', owner_id: data.owner_id||currentUser?.id||null, comments: data.comments||'', customer_number: id, name: data.name, company: data.company, industry: data.industry, email: data.email, phone: data.phone, website: data.website, billing_address: data.billingAddress, shipping_address: data.shippingAddress, city: data.city, state: data.state, postal_code: data.postalCode, country: data.country, gst_number: data.gstNumber, status: data.status || 'Active' }]);
          if (error) throw error;
          await logAudit({ recordType: 'customer', recordId: id, recordName: data.name, action: 'created' });
          await runAutomations('customers', id, data, 'on_create');
          await fetchCustomers(); return { id, name: data.name };
        }
        case 'products': {
          const id = generateId('PROD');
          const { data: insertedProd, error } = await supabase.from('products').insert([{ ...sys, custom_data: data.custom_data||{}, product_number: id, owner: data.owner||currentUser?.email||'', owner_id: data.owner_id||currentUser?.id||null, comments: data.comments||'', name: data.name, category: data.category, price: Number(data.price || 0), status: data.status || 'Active', stock_quantity: Number(data.stock_quantity || 0), reorder_level: Number(data.reorder_level ?? 10), track_inventory: data.track_inventory !== false }]).select().single();
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
      showAlert(`Failed to create record: ${err.message}`);
      return null;
    }
  };

  const updateRecord = async (page: string, record: any, lineItems: LineItem[] | null = null) => {
    if (!supabase) return;
    const sys = buildSystemFields(true);
    const calcAmount = (lineItems||[]).reduce((s, i) => s + (i.quantity||1) * (i.price||0), 0);

    const upsertLineItems = async (table: string, field: string, id: string) => {
      if (lineItems === null) return; // caller explicitly handles line items itself elsewhere
      await supabase.from(table).delete().eq(field, id);
      if (lineItems.length) {
        await supabase.from(table).insert(lineItems.map(i => ({
          [field]: id, product_name: i.product || i.product_name || '',
          product_code: i.product_code || '', description: i.description || '',
          quantity: i.quantity, price: i.price,
          discount: Number((i as any).discount || 0),
          custom_data: (i as any).custom_data || {},
        })));
      }
    };

    switch (page) {
      case 'customers': {
        const { error: e_customers } = await supabase.from('customers').update({ ...sys, custom_data: record.custom_data||{}, name: record.name, email: record.email, phone: record.phone, company: record.company, industry: record.industry, primary_contact_id: record.primaryContactId, billing_address: record.billingAddress, shipping_address: record.shippingAddress, city: record.city, state: record.state, postal_code: record.postalCode||record.postal_code||'', country: record.country||'', website: record.website||'', gst_number: record.gstNumber||record.gst_number||'', description: record.description||'', owner: record.owner||'', owner_id: record.owner_id||null, status: record.status, comments: record.comments||'' }).eq('customer_number', record.id);
        if (e_customers) { console.error('update customers:', e_customers.message); showAlert('Save failed: ' + e_customers.message); return; }
        await logAudit({ recordType: 'customer', recordId: record.id, recordName: record.name, action: 'updated' });
        await runAutomations('customers', record.id, record, 'on_update');
        await fetchCustomers(); break; }
      case 'contacts': {
        const { error: e_contacts } = await supabase.from('contacts').update({ ...sys, custom_data: record.custom_data||{}, customer: record.customer, customer_id: record.customerId||null, name: record.name, email: record.email||'', phone: record.phone||'', mobile: record.mobile||'', designation: record.designation||'', department: record.department||'', is_primary: record.isPrimary||false, linked_in: record.linkedIn||'', description: record.description||'', owner: record.owner||'', owner_id: record.owner_id||null, status: record.status, comments: record.comments||'' }).eq('contact_number', record.id);
        if (e_contacts) { console.error('update contacts:', e_contacts.message); showAlert('Save failed: ' + e_contacts.message); return; }
        if (record.isPrimary && record.customerId) {
          await supabase.from('contacts').update({ is_primary: false }).eq('customer_id', record.customerId).neq('contact_number', record.id);
          await supabase.from('customers').update({ primary_contact_id: record.id }).eq('customer_number', record.customerId);
        }
        await runAutomations('contacts', record.id, record, 'on_update');
        await fetchContacts(); await fetchCustomers(); break; }
      case 'products': {
        const { error: e_products } = await supabase.from('products').update({ ...sys, custom_data: record.custom_data||{}, name: record.name, product_family: record.productFamily||'', category: record.category||'', sku: record.sku||'', price: Number(record.price||0), cost: Number(record.cost||0), unit: record.unit||'', tax_rate: Number(record.taxRate||record.tax_rate||0), hsn_code: record.hsn_code||'', gst_rate: record.gst_rate!=null?Number(record.gst_rate):null, taxable: record.taxable||'', tax_category: record.tax_category||'', vat_rate: record.vat_rate!=null?Number(record.vat_rate):null, description: record.description||'', owner: record.owner||'', status: record.status, comments: record.comments||'', stock_quantity: Number(record.stock_quantity||0), reorder_level: Number(record.reorder_level ?? 10), track_inventory: record.track_inventory !== false }).eq('id', record._uuid || record.id);
        if (e_products) { console.error('update products:', e_products.message); showAlert('Save failed: ' + e_products.message); return; }
        await runAutomations('products', record._uuid || record.id, record, 'on_update');
        await fetchProducts(); break; }
      case 'leads': {
        const { error: e_leads } = await supabase.from('leads').update({ ...sys, custom_data: record.custom_data||{}, name: record.name, customer: record.customer, customer_id: record.customerId||null, contact: record.contact, contact_id: record.contactId||null, email: record.email||'', phone: record.phone||'', source: record.source||'', amount: calcAmount||Number(record.amount||0), expected_close_date: record.expectedCloseDate||null, billing_address: record.billingAddress||record.billing_address||'', shipping_address: record.shippingAddress||record.shipping_address||'', description: record.description||'', owner: record.owner||'', owner_id: record.owner_id||null, status: record.status, comments: record.comments||'' }).eq('lead_number', record.id);
        if (e_leads) { console.error('update leads:', e_leads.message); showAlert('Save failed: ' + e_leads.message); return; }
        await upsertLineItems('lead_line_items', 'lead_number', record.id);
        await logAudit({ recordType: 'lead', recordId: record.id, recordName: record.name, action: 'updated' });
        await runAutomations('leads', record.id, record, 'on_update');
        await fetchLeads(); break; }
      case 'opportunities': {
        const { error: e_opportunities } = await supabase.from('opportunities').update({ ...sys, custom_data: record.custom_data||{}, name: record.name, customer: record.customer, customer_id: record.customerId||null, contact: record.contact, contact_id: record.contactId||null, stage: record.stage||'', amount: calcAmount||Number(record.amount||0), close_date: record.closeDate||null, probability: Number(record.probability||0), campaign: record.campaign||'', billing_address: record.billingAddress||record.billing_address||'', shipping_address: record.shippingAddress||record.shipping_address||'', description: record.description||'', owner: record.owner||'', owner_id: record.owner_id||null, status: record.status, comments: record.comments||'' }).eq('opportunity_number', record.id);
        if (e_opportunities) { console.error('update opportunities:', e_opportunities.message); showAlert('Save failed: ' + e_opportunities.message); return; }
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
        if (e_orders) { console.error('update orders:', e_orders.message); showAlert('Save failed: ' + e_orders.message); return; }
        // When CPQ is enabled, CPQRecordDetail saves line items itself and
        // passes lineItems=null here to skip (upsertLineItems no-ops on null).
        // When CPQ is disabled, the fallback RecordDetailPanel view has no
        // other path to persist line-item edits — this call is what actually
        // saves them in that case (previously always skipped, silently
        // losing any line-item changes made via the fallback view).
        await upsertLineItems('order_line_items', 'order_number', record.id);
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
        if (e_invoices) { console.error('update invoices:', e_invoices.message); showAlert('Save failed: ' + e_invoices.message); return; }
        // See the matching comment in the 'orders' case above — same fix.
        await upsertLineItems('invoice_line_items', 'invoice_number', record.id);
        await logAudit({ recordType: 'invoice', recordId: record.id, recordName: record.name, action: 'updated' });
        await runAutomations('invoices', record.id, record, 'on_update');
        await fetchInvoices(); break; }
      case 'activities': {
        const { error: e_activities } = await supabase.from('activities').update({ ...sys, custom_data: record.custom_data||{}, name: record.name, customer: record.customer, customer_id: record.customerId||null, contact: record.contact, contact_id: record.contactId||null, activity_type: record.activityType||'', activity_date: record.activityDate||null, due_date: record.dueDate||null, priority: record.priority||'Medium', description: record.description||'', notes: record.notes||'', owner: record.owner||'', owner_id: record.owner_id||null, status: record.status, comments: record.comments||'' }).eq('activity_number', record.id);
        if (e_activities) { console.error('update activities:', e_activities.message); showAlert('Save failed: ' + e_activities.message); return; }
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

  // Creates an invoice from a B2B order. By default (no `selections`) invoices
  // the full remaining balance of every line item — this keeps all existing
  // call sites (quick 3-dot menu, list actions) working unchanged.
  // Pass `selections` as [{ _id: <order_line_item id>, qty: <number to invoice now> }]
  // to invoice only part of the order; the order and its line items track how
  // much has been invoiced so far via `invoiced_qty`, and repeat calls keep
  // reducing the remaining balance until fully invoiced.
  const createInvoiceFromOrder = async (order: Order, selections: { _id: any; qty: number }[] | null = null) => {
    if (!supabase) return null;
    const { data: rawItems } = await supabase.from('order_line_items').select('*').eq('order_number', order.id).order('sort_order');
    const allItems = rawItems || [];
    if (!allItems.length) { showAlert('This order has no line items to invoice.'); return null; }

    // Work out how much of each line to invoice now.
    const toInvoice = allItems.map((i: any) => {
      const qty = Number(i.quantity || 0);
      const already = Number(i.invoiced_qty || 0);
      const remaining = Math.max(0, qty - already);
      const sel = selections?.find((s) => String(s._id) === String(i.id));
      const qtyNow = selections ? Math.max(0, Math.min(Number(sel?.qty || 0), remaining)) : remaining;
      return { ...i, qtyNow, remaining };
    }).filter((i: any) => i.qtyNow > 0);

    if (!toInvoice.length) { showAlert('Nothing to invoice — all items are already fully invoiced, or no quantities were selected.'); return null; }

    const subtotal = toInvoice.reduce((s: number, i: any) => s + i.qtyNow * Number(i.price || 0), 0);
    const lineDisc = toInvoice.reduce((s: number, i: any) => s + i.qtyNow * Number(i.price || 0) * (Number(i.discount || 0) / 100), 0);
    const lineTax  = toInvoice.reduce((s: number, i: any) => {
      const net = i.qtyNow * Number(i.price || 0) * (1 - Number(i.discount || 0) / 100);
      return s + net * (Number(i.tax_pct || 0) / 100);
    }, 0);
    // Overall discount is a PERCENTAGE on the order — scales correctly with
    // this invoice's own subtotal, so it's safe to apply on every partial
    // invoice. (Previously this was never actually subtracted from the
    // invoice amount at all, despite being copied onto the invoice record —
    // the printed invoice would show a discount/shipping line that didn't
    // match its own total.)
    const overallDiscPct = Number((order as any).overall_discount || 0);
    const od = subtotal * overallDiscPct / 100;
    // Shipping is a flat amount on the order — charge it once, on whichever
    // invoice completes the order's full invoiced quantity, rather than
    // charging it on every partial invoice (double-billing) or never (as before).
    const invoicedPreview = new Map(toInvoice.map((i: any) => [i.id, i.qtyNow]));
    const willBeFullyInvoiced = allItems.every((i: any) => {
      const already = Number(i.invoiced_qty || 0) + (invoicedPreview.get(i.id) || 0);
      return already >= Number(i.quantity || 0);
    });
    const shippingCost = willBeFullyInvoiced ? Number((order as any).shipping_cost || 0) : 0;
    const totalAmount = subtotal - lineDisc + lineTax - od + shippingCost;
    const id = generateId('INV');
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);
    const orderNum = order.displayNumber
      ? 'ORD-' + String(order.displayNumber).padStart(5, '0')
      : (order.order_number || order.id);

    const { error } = await supabase.from('invoices').insert([{
      ...buildSystemFields(),
      invoice_number: id,
      name: order.name,
      order_number: orderNum,
      customer: order.customer,
      customer_id: order.customerId || (order as any).customer_id,
      contact: order.contact,
      contact_id: order.contactId || (order as any).contact_id,
      amount: Number(totalAmount.toFixed(2)),
      currency: (order as any).currency || 'INR',
      billing_address: (order as any).billing_address || (order as any).billingAddress || '',
      shipping_address: (order as any).shipping_address || (order as any).shippingAddress || '',
      payment_terms: (order as any).payment_terms || (order as any).paymentTerms || '',
      overall_discount: overallDiscPct,
      shipping_cost: shippingCost,
      subtotal: Number(subtotal.toFixed(2)),
      total_discount: Number((lineDisc + od).toFixed(2)),
      total_tax: Number(lineTax.toFixed(2)),
      notes: (order as any).notes || '',
      due_date: dueDate.toISOString().split('T')[0],
      owner: order.owner || currentUser?.email || '',
      owner_id: order.owner_id || currentUser?.id || null,
      status: 'Pending',
    }]);
    if (error) { showAlert('Failed to create invoice: ' + error.message); return null; }

    await supabase.from('invoice_line_items').insert(toInvoice.map((i: any, idx: number) => ({
      invoice_number: id,
      product_name:   i.product_name || i.product || '',
      product_code:   i.product_code || '',
      description:    i.description  || '',
      quantity:       i.qtyNow,
      price:          Number(i.price      || 0),
      list_price:     Number(i.list_price || i.price || 0),
      discount:       Number(i.discount   || 0),
      tax_pct:        Number(i.tax_pct    || 0),
      extended_price: i.qtyNow * Number(i.price||0) * (1 - Number(i.discount||0)/100) * (1 + Number(i.tax_pct||0)/100),
      sort_order:     idx,
      custom_data:    i.custom_data || {},
    })));

    // Update each order line item's running invoiced_qty.
    await Promise.all(toInvoice.map((i: any) =>
      supabase.from('order_line_items').update({ invoiced_qty: Number(i.invoiced_qty || 0) + i.qtyNow }).eq('id', i.id)
    ));

    // Order-level status reflects fulfillment: fully invoiced vs partially invoiced.
    // (Reuses willBeFullyInvoiced computed above, before the insert — the
    // underlying line items haven't changed since, so it's still accurate.)
    const fullyInvoiced = willBeFullyInvoiced;
    const newStatus = fullyInvoiced ? 'Invoiced' : 'Partially Invoiced';
    await supabase.from('orders').update({ status: newStatus, ...buildSystemFields(true) }).eq('order_number', order.id);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o));

    await logAudit({ recordType: 'order', recordId: order.id, recordName: order.name, action: 'converted_to_invoice' });
    await autoSetCustomerStatus(order.customerId || (order as any).customer_id, 'Active');
    await fetchInvoices();
    return { invoiceNumber: id, fullyInvoiced };
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
      if (error) { showAlert('Save failed: ' + error.message); return; }
    } else {
      const tNum = generateId('TEMP');
      const { error } = await supabase.from('quote_templates').insert([{ ...payload, template_number: tNum, is_default: false, ...(tenantId?{tenant_id:tenantId}:{}), created_by: currentUser?.email }]);
      if (error) { showAlert('Save failed: ' + error.message); return; }
    }
    await fetchQuoteTemplates();
  };

  // ─── Invoice Templates ────────────────────────────────────────────────────
  const fetchInvoiceTemplates = async () => {
    if (!supabase) return;
    const { data } = await tScope(supabase.from('invoice_templates').select('*')).order('created_at', { ascending: false });
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
      if (error) { showAlert('Save failed: ' + error.message); return; }
    } else {
      const tNum = 'INVTPL-' + Date.now();
      const { error } = await supabase.from('invoice_templates').insert([{ ...payload, template_number: tNum, ...(tenantId?{tenant_id:tenantId}:{}), created_by: currentUser?.email }]);
      if (error) { showAlert('Save failed: ' + error.message); return; }
    }
    await fetchInvoiceTemplates();
  };

  const deleteInvoiceTemplate = async (templateId: string) => {
    if (!supabase) return;
    if (!(await showConfirm('Delete this invoice template?', { variant:'danger', confirmLabel:'Delete' }))) return;
    await supabase.from('invoice_templates').delete().eq('id', templateId);
    await fetchInvoiceTemplates();
  };

  const setDefaultInvoiceTemplate = async (templateId: string) => {
    if (!supabase) return;
    // Unset default only for current tenant's templates
    let q1 = supabase.from('invoice_templates').update({ is_default: false }).neq('id', '');
    if (tenantId) q1 = (q1 as any).eq('tenant_id', tenantId);
    await q1;
    await supabase.from('invoice_templates').update({ is_default: true }).eq('id', templateId);
    await fetchInvoiceTemplates();
  };

  // ─── Warehouses / Subinventories ──────────────────────────────────────────
  const fetchWarehouses = async () => {
    if (!supabase) return;
    const { data } = await tScope(supabase.from('warehouses').select('*')).order('name');
    if (data) setWarehouses(data);
  };

  const saveWarehouse = async (data: any, editingId?: string) => {
    if (!supabase) return;
    const payload = { ...data, updated_at: new Date().toISOString() };
    if (editingId) {
      const { error } = await supabase.from('warehouses').update(payload).eq('id', editingId);
      if (error) { showAlert('Save failed: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('warehouses').insert([{ ...payload, created_at: new Date().toISOString(), ...(tenantId ? { tenant_id: tenantId } : {}) }]);
      if (error) { showAlert('Save failed: ' + error.message); return; }
    }
    await fetchWarehouses();
  };

  const deleteWarehouse = async (id: string) => {
    if (!supabase) return;
    if (!(await showConfirm('Delete this warehouse/location?', { variant:'danger', confirmLabel:'Delete' }))) return;
    await supabase.from('warehouses').delete().eq('id', id);
    await fetchWarehouses();
  };


  const deleteQuoteTemplate = async (templateId: string) => {
    if (!supabase) return;
    if (!(await showConfirm('Delete this template?', { variant:'danger', confirmLabel:'Delete' }))) return;
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
      if (error) { showAlert('Save failed: ' + error.message); return; }
    } else {
      const { data: rule, error } = await supabase.from('workflow_rules').insert([{ ...cleanData, ...buildSystemFields(), rule_number: generateId('WF') }]).select().single();
      if (error || !rule) { showAlert(error?.message || 'Error saving workflow rule'); return; }
      ruleId = rule.id;
    }
    // Replace all actions atomically
    await supabase.from('workflow_actions').delete().eq('workflow_rule_id', ruleId);
    if (actions.length) {
      const { error: actErr } = await supabase.from('workflow_actions').insert(
        actions.map((a, i) => ({ workflow_rule_id: ruleId, action_type: a.action_type, action_config: a.action_config || {}, execution_order: i + 1, ...(tenantId ? { tenant_id: tenantId } : {}) }))
      );
      if (actErr) console.error('workflow_actions insert:', actErr.message);
    }
    await fetchWorkflowRules();
  };

  const deleteWorkflowRule = async (id: string) => {
    if (!supabase) return;
    if (!(await showConfirm('Delete this workflow rule?', { variant:'danger', confirmLabel:'Delete' }))) return;
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
      if (error) { showAlert('Save failed: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('assignment_rules').insert([{ ...cleanData, ...buildSystemFields(), rule_number: generateId('AR') }]);
      if (error) { showAlert('Save failed: ' + error.message); return; }
    }
    await fetchAssignmentRules();
  };

  const deleteAssignmentRule = async (id: string) => {
    if (!supabase) return;
    if (!(await showConfirm('Delete this rule?', { variant:'danger', confirmLabel:'Delete' }))) return;
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
      if (error) { showAlert('Save failed: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('sla_policies').insert([{ ...cleanData, ...buildSystemFields(), policy_number: generateId('SLA') }]);
      if (error) { showAlert('Save failed: ' + error.message); return; }
    }
    await fetchSLAPolicies();
  };

  const deleteSLAPolicy = async (id: string) => {
    if (!supabase) return;
    if (!(await showConfirm('Delete this SLA policy?', { variant:'danger', confirmLabel:'Delete' }))) return;
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
      if (error) { showAlert('Save failed: ' + error.message); return; }
    } else {
      const { data: proc, error } = await supabase.from('approval_processes')
        .insert([{ ...payload, process_number: generateId('AP'), ...(tenantId?{tenant_id:tenantId}:{}) }]).select().single();
      if (error || !proc) { showAlert(error?.message || 'Error saving approval process'); return; }
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
      if (stepErr) { showAlert('Error saving steps: ' + stepErr.message); return; }
    }
    await fetchApprovalProcesses();
  };

  const deleteApprovalProcess = async (id: string) => {
    if (!supabase) return;
    if (!(await showConfirm('Delete this approval process?', { variant:'danger', confirmLabel:'Delete' }))) return;
    await supabase.from('approval_processes').delete().eq('id', id);
    await fetchApprovalProcesses();
  };

  

  const submitForApproval = async (recordType: string, recordId: string, recordName: string, matchedProcess?: any) => {
    if (!supabase || !currentUser) return;
    // Use the pre-matched process if provided, otherwise find first active one for this type
    const process = matchedProcess || approvalProcesses.find(p => p.object_type === recordType && p.is_active);
    if (!process) { showAlert('No active approval process found for this record type.'); return; }
    // Load steps fresh from DB to get current step IDs
    const { data: steps, error: stepsErr } = await supabase
      .from('approval_steps').select('*').eq('approval_process_id', process.id).order('step_number');
    if (stepsErr || !steps?.length) { showAlert('No approval steps configured for this process.'); return; }
    const firstStep = steps[0];
    // Check if already pending
    const { data: existing } = await supabase.from('approval_requests')
      .select('id').eq('record_id', recordId).eq('record_type', recordType).eq('status', 'Pending').maybeSingle();
    if (existing) { showAlert('An approval request is already pending for this record.'); return; }
    const { error } = await supabase.from('approval_requests').insert([{
      ...(tenantId ? { tenant_id: tenantId } : {}),
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
    if (error) { showAlert('Submission failed: ' + error.message); return; }

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
    showAlert('Submitted for approval successfully.');
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

  // Which line-item table (and its foreign-key column) belongs to each
  // object type that actually has line items. Retail orders/invoices use
  // their own richer line-item schema; CRM leads/opportunities/orders/
  // invoices share a simpler one (product_name, quantity, price).
  const LINE_ITEM_TABLE_CONFIG: Record<string, { table: string; fk: string }> = {
    retailOrders:   { table: 'retail_order_line_items',   fk: 'order_number' },
    retailInvoices: { table: 'retail_invoice_line_items', fk: 'invoice_number' },
    leads:          { table: 'lead_line_items',           fk: 'lead_number' },
    opportunities:  { table: 'opportunity_line_items',    fk: 'opportunity_number' },
    orders:         { table: 'order_line_items',          fk: 'order_number' },
    invoices:       { table: 'invoice_line_items',        fk: 'invoice_number' },
    quotations:     { table: 'quotation_line_items',      fk: 'quote_number' },
  };

  // The shared condition-evaluation engine for both Workflow Rules and
  // Approval Processes — previously each had its own separate, inconsistent
  // logic (approvals supported multi-condition AND/OR; workflows silently
  // ignored the conditions builder entirely and only checked a single
  // legacy trigger_field/trigger_value pair). Now both call this directly.
  // Adds line-item-level conditions: a condition with scope:'line_item'
  // checks across the record's own line items rather than the header
  // record, using one of three aggregation modes (any/all/sum).
  const evaluateConditionsWithLineItems = async (
    objectType: string,
    recordData: any,
    conditionsConfig: { logic?: 'AND'|'OR'; conditions?: any[] } | null | undefined,
    legacyField?: string, legacyOperator?: string, legacyValue?: string
  ): Promise<boolean> => {
    const conds = conditionsConfig?.conditions || [];
    if (!conds.length) {
      // Fall back to the legacy single-condition fields, for rules/processes
      // saved before the multi-condition builder existed. Matches the
      // original semantics exactly: both must be set, not just the field.
      if (legacyField && legacyValue) return evaluateCondition(recordData[legacyField], legacyOperator || 'equals', legacyValue);
      return true; // no condition at all = always matches
    }

    const logic = conditionsConfig?.logic || 'AND';
    const needsLineItems = conds.some((c: any) => c.scope === 'line_item');
    let lineItems: any[] = [];
    if (needsLineItems && supabase) {
      const liConfig = LINE_ITEM_TABLE_CONFIG[objectType];
      const recordNumber = recordData.id || recordData[getObjectIdField(objectType)];
      if (liConfig && recordNumber) {
        try {
          const { data } = await withTimeout(
            supabase.from(liConfig.table).select('*').eq(liConfig.fk, recordNumber),
            10000, 'Fetch line items for condition check'
          );
          lineItems = data || [];
        } catch (e) {
          console.warn('[evaluateConditionsWithLineItems] line item fetch failed:', e);
        }
      }
    }

    const results = conds.map((c: any) => {
      if (c.scope === 'line_item') {
        if (c.aggregation === 'sum') {
          const sum = lineItems.reduce((s, li) => s + Number(li[c.field] || 0), 0);
          return evaluateCondition(sum, c.operator, c.value);
        }
        if (c.aggregation === 'all') {
          return lineItems.length > 0 && lineItems.every(li => evaluateCondition(li[c.field], c.operator, c.value));
        }
        // 'any' — default aggregation for line-item conditions
        return lineItems.some(li => evaluateCondition(li[c.field], c.operator, c.value));
      }
      return evaluateCondition(recordData[c.field], c.operator, c.value);
    });

    return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
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
        // Only act if this is a genuine reassignment — without this guard,
        // running assignment rules on every edit (not just create) would
        // re-send an "assigned to you" notification on every single save
        // for as long as the rule's condition stays true, even for edits
        // that have nothing to do with the assignment.
        const alreadyAssigned = recordData.owner_id === assignee.id || recordData.owner === assignee.email;
        if (!alreadyAssigned) {
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
  // Executes a workflow rule's configured actions against a specific
  // record — extracted from the body of runWorkflowRules so both the
  // existing event-based engine (on_create/on_update/on_delete) and the new
  // schedule-based engine (before_date) can share this exact logic rather
  // than duplicating it. Behavior is unchanged from before; this is purely
  // a code-organization change, not a logic rewrite.
  const executeWorkflowActions = async (rule: any, objectType: string, recordId: string, recordData: any) => {
    if (!supabase) return;
    let fieldsWereMutated = false;

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
            dueDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
        case 'send_whatsapp': {
          // Enables automatic WhatsApp messages/reminders from any
          // workflow rule - including the scheduled "before_date" trigger
          // type, e.g. "1 day before rental return, remind the customer"
          // or "notify the business phone when a high-value order closes."
          // Reuses the exact same send route and param_mappings resolution
          // that manual sends use, so these are just as customizable.
          if (!supabase) break;
          const { data: waConfigRow } = await supabase.from('whatsapp_config').select('*').eq('tenant_id', getScopeTenantId()).maybeSingle();
          if (!waConfigRow?.is_active) { console.warn('[Workflow send_whatsapp] WhatsApp is not active for this tenant — skipping.'); break; }

          const recipientType = cfg.recipient_type || 'customer'; // 'customer' | 'business'
          let toPhone = '';
          if (recipientType === 'business') {
            toPhone = String(waConfigRow.business_notify_phone || '').replace(/\D/g, '');
          } else {
            const rawPhone = String(recordData.customer_phone || recordData.phone || '').replace(/\D/g, '');
            toPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
          }
          if (!toPhone) {
            console.warn(`[Workflow send_whatsapp] No ${recipientType} phone number available — skipping.`);
            break;
          }

          try {
            const res = await fetch('/api/whatsapp/send', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tenantId: getScopeTenantId(), to: toPhone,
                recordType: objectType, recordId, recipientType, sendMode: 'automatic',
                templateKey: cfg.template_key, record: recordData,
              }),
            });
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              console.warn('[Workflow send_whatsapp] send failed:', errData?.error);
            }
          } catch (e) {
            console.warn('[Workflow send_whatsapp] send failed:', e);
          }
          break;
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

  const runWorkflowRules = async (objectType: string, recordId: string, recordData: any, triggerEvent: string) => {
    if (!supabase) return;
    const rules = workflowRules.filter(r =>
      r.object_type === objectType &&
      r.trigger_event === triggerEvent &&
      r.is_active
    );

    for (const rule of rules) {
      // Evaluate conditions via the shared engine — supports the full
      // multi-condition AND/OR builder plus line-item conditions, falling
      // back to the legacy single trigger_field/trigger_value pair for
      // rules saved before the conditions builder existed. Previously this
      // only ever checked trigger_field/trigger_value directly, silently
      // ignoring anything built with the conditions UI.
      const conditionMet = await evaluateConditionsWithLineItems(
        objectType, recordData, rule.conditions, rule.trigger_field, 'equals', rule.trigger_value
      );
      if (!conditionMet) continue;

      await executeWorkflowActions(rule, objectType, recordId, recordData);
    }
  };

  // ── Scheduled workflow triggers ("before_date") ─────────────────────
  // Fires a configurable amount of time before a date field reaches now —
  // e.g. "1 day before rental_end_date" or "1 hour before delivery_date" —
  // for header-level or line-item-level date fields. Unlike runWorkflowRules
  // above, nothing "happens" to trigger this (no create/update event), so
  // it has to be checked periodically. This is a client-triggered check
  // (runs while someone has the app open), not a guaranteed server-side
  // cron — a true guarantee would need a scheduled Supabase Edge Function,
  // separate infrastructure. The match uses a window around the exact
  // target moment (sized to the poll interval) rather than an exact-instant
  // comparison, since polling can't land on the precise second regardless.
  const SCHEDULED_WORKFLOW_POLL_WINDOW_MS = 10 * 60 * 1000; // ±10 min around the exact offset target
  const runScheduledWorkflowRules = async () => {
    if (!supabase) return;
    const scheduledRules = workflowRules.filter(r => r.trigger_event === 'before_date' && r.is_active && r.schedule_date_field);
    if (!scheduledRules.length) return;

    const tid = (typeof window !== 'undefined' ? (window as any).__bp_tenant : null) || {};
    const now = Date.now();
    const todayStr = todayLocalISO();
    const future = new Date(); future.setDate(future.getDate() + 3);
    const futureStr = `${future.getFullYear()}-${String(future.getMonth()+1).padStart(2,'0')}-${String(future.getDate()).padStart(2,'0')}`;

    for (const rule of scheduledRules) {
      const offsetMs = (rule.schedule_offset_value || 1) * (rule.schedule_offset_unit === 'hours' ? 3600000 : 86400000);
      const [dueHour, dueMin] = (rule.schedule_due_time || '18:00').split(':').map(Number);
      const liConfig = LINE_ITEM_TABLE_CONFIG[rule.object_type];
      const isLineItemScoped = rule.schedule_date_scope === 'line_item' && !!liConfig;

      // Broad candidate fetch (next few days) — exact time-window
      // precision happens in JS below, since a date-only column can't
      // express "within N hours" directly in the query.
      let candidates: any[] = [];
      try {
        if (isLineItemScoped) {
          let q = supabase.from(liConfig!.table).select('*').gte(rule.schedule_date_field, todayStr).lte(rule.schedule_date_field, futureStr);
          if (tid.id && !tid.db_url) q = q.eq('tenant_id', tid.id);
          const { data } = await withTimeout(q, 15000, 'Scheduled workflow candidate fetch');
          candidates = data || [];
        } else {
          const table = getObjectTable(rule.object_type);
          let q = supabase.from(table).select('*').gte(rule.schedule_date_field, todayStr).lte(rule.schedule_date_field, futureStr);
          if (tid.id && !tid.db_url) q = q.eq('tenant_id', tid.id);
          const { data } = await withTimeout(q, 15000, 'Scheduled workflow candidate fetch');
          candidates = data || [];
        }
      } catch (e) { console.warn('[runScheduledWorkflowRules] candidate fetch failed:', e); continue; }

      for (const candidate of candidates) {
        const dateVal = candidate[rule.schedule_date_field];
        if (!dateVal) continue;
        const [y, m, d] = String(dateVal).slice(0, 10).split('-').map(Number);
        if (!y || !m || !d) continue;
        const dueMoment = new Date(y, m - 1, d, dueHour || 0, dueMin || 0, 0).getTime();
        const msUntilDue = dueMoment - now;
        // Only fire once we're within the poll window around the exact
        // requested offset — e.g. for "1 hour before", only when we're
        // roughly (within ±10 min) 1 hour away from the due moment.
        if (Math.abs(msUntilDue - offsetMs) > SCHEDULED_WORKFLOW_POLL_WINDOW_MS) continue;

        const idField = getObjectIdField(rule.object_type);
        const parentId = isLineItemScoped ? candidate[liConfig!.fk] : (candidate.id || candidate[idField]);
        const lineItemId = isLineItemScoped ? candidate.id : null;
        if (!parentId) continue;

        // Dedup — has this exact rule already fired for this exact
        // record/line-item? Without this, every poll within the window
        // would re-fire the same notification.
        let dedupQuery = supabase.from('workflow_rule_firings').select('id').eq('workflow_rule_id', rule.id).eq('record_id', parentId);
        dedupQuery = lineItemId ? dedupQuery.eq('line_item_id', lineItemId) : dedupQuery.is('line_item_id', null);
        const { data: existingFiring } = await dedupQuery.maybeSingle();
        if (existingFiring) continue;

        // Resolve the parent header record — needed for header-level
        // condition evaluation and for action context (owner, customer,
        // etc.) even when the trigger itself is line-item scoped.
        let parentRecord = candidate;
        if (isLineItemScoped) {
          const table = getObjectTable(rule.object_type);
          const idF = getObjectIdField(rule.object_type);
          const { data: parent } = await supabase.from(table).select('*').eq(idF, parentId).maybeSingle();
          parentRecord = parent ? { ...parent, id: parent[idF] } : { id: parentId };
        }

        const conditionsMet = await evaluateConditionsWithLineItems(rule.object_type, parentRecord, rule.conditions);
        if (!conditionsMet) continue;

        await executeWorkflowActions(rule, rule.object_type, parentId, parentRecord);
        await supabase.from('workflow_rule_firings').insert({
          tenant_id: tid.id || null, workflow_rule_id: rule.id,
          record_type: rule.object_type, record_id: parentId, line_item_id: lineItemId,
        });
      }
    }
  };

  // ── SLA Policies ──────────────────────────────────────────────────
  const runSLAPolicies = async (objectType: string, recordId: string, recordData: any) => {
    if (!supabase) return;
    const policies = slaPolicies?.filter(p => p.object_type === objectType && p.is_active) || [];

    for (const policy of policies) {
      const conditionMet = await evaluateConditionsWithLineItems(
        objectType, recordData, policy.conditions, policy.condition_field, 'equals', policy.condition_value
      );
      if (!conditionMet) continue;

      const now = new Date();
      const responseDate  = new Date(now.getTime() + (policy.response_time_hours   || 24) * 3600000);
      const resolutionDate = new Date(now.getTime() + (policy.resolution_time_hours || 72) * 3600000);

      await supabase.from('sla_records').insert([{
        ...(tenantId ? { tenant_id: tenantId } : {}),
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
      const matches = await evaluateConditionsWithLineItems(
        objectType, recordData, process.conditions,
        process.condition_field, process.condition_operator || 'equals', process.condition_value
      );
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
        // Assignment rules now fire on update too (e.g. reassign owner when
        // status changes to "Discontinued"), not just on create — the
        // alreadyAssigned guard in runAssignmentRules prevents this from
        // re-sending a notification on every unrelated edit.
        event !== 'on_delete' ? runAssignmentRules(objectType, recordId, recordData) : Promise.resolve(),
        // SLA policies intentionally stay create-only — they track time
        // elapsed since the record was first created, so re-running them on
        // every edit would incorrectly reset the response/resolution clock.
        event === 'on_create' ? runSLAPolicies(objectType, recordId, recordData) : Promise.resolve(),
      ]);
    } catch(e: any) {
      console.warn('[Automation] Error:', e.message);
    }
  };

  // \u2500\u2500\u2500 Effects \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  useEffect(() => {
    if (!supabase) return;
    const t0 = Date.now();
    console.log('[AppContext] Starting session restore...');
    // Whichever of these two paths resolves FIRST wins and sets the initial
    // auth state — the other becomes a no-op for the initial resolution.
    // onAuthStateChange fires its own initial event (reflecting whatever
    // session is already in local storage) independently of getSession(),
    // and is typically much faster since it doesn't necessarily wait on a
    // token-refresh network round-trip the way getSession() can. Previously
    // the app always waited on getSession() (or its 25s timeout) even when
    // onAuthStateChange had already resolved the same information sooner.
    let initialResolved = false;

    // getSession() has no built-in timeout. If it ever hangs (a known
    // Supabase SDK behavior when a stale refresh token needs renewing and
    // that attempt stalls, or a plain network hiccup), setAuthLoading(false)
    // below would never fire, leaving the entire app stuck on the loading
    // screen indefinitely — AppShell gates everything on authLoading. This
    // races the real call against a bounded timeout so a hang here always
    // resolves to a safe, recoverable state (treated as logged out — the
    // user can simply log in again) rather than an infinite wait.
    const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => { if (!initialResolved) console.error('[AppContext] getSession() timed out after 25s — treating as logged out'); resolve({ data: { session: null } }); }, 25000)
    );
    const realGetSession = supabase.auth.getSession();
    realGetSession.then(({ data: { session: realSession } }) => {
      console.log('[AppContext] REAL getSession() actually resolved after', Date.now() - t0, 'ms — session:', realSession ? 'present' : 'none');
    }).catch((e) => {
      console.error('[AppContext] REAL getSession() rejected after', Date.now() - t0, 'ms:', e);
    });
    Promise.race([realGetSession, timeoutPromise]).then(async ({ data: { session } }: any) => {
      if (initialResolved) return; // onAuthStateChange's initial event already handled this
      console.log('[AppContext] getSession path resolved in', Date.now() - t0, 'ms, session:', session ? 'present' : 'none');
      if (session?.user) {
        // Cross-tenant guard for restored sessions (e.g. token persisted before this fix)
        const ok = await verifyTenantMembership(session.user);
        if (!ok) { await supabase.auth.signOut(); initialResolved = true; setSession(null); setAuthLoading(false); return; }
      }
      initialResolved = true;
      setSession(session); setAuthLoading(false);
    }).catch((e) => {
      if (initialResolved) return;
      console.error('[AppContext] Session restore failed:', e);
      initialResolved = true;
      setSession(null); setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (e, s) => {
      // CRITICAL: verify tenant membership on EVERY session change, not just
      // the initial page-load restore above. Supabase fires this listener
      // directly whenever a sign-in happens (including from handleLogin's own
      // signInWithPassword call) — without this check here, signing out and
      // signing back in as a different user belonging to a different tenant,
      // without a full page reload, would bypass the cross-tenant guard
      // entirely: this listener would accept the new session unconditionally
      // regardless of whether that user actually belongs to the tenant
      // context (window.__bp_tenant) the browser is currently scoped to.
      if (s?.user) {
        const ok = await verifyTenantMembership(s.user);
        if (!ok) {
          console.error('[onAuthStateChange] Session rejected — user does not belong to this tenant');
          await supabase.auth.signOut();
          if (!initialResolved) { initialResolved = true; setAuthLoading(false); }
          setSession(null);
          return;
        }
      }
      if (!initialResolved) {
        console.log('[AppContext] onAuthStateChange resolved initial state first, after', Date.now() - t0, 'ms, event:', e, 'session:', s ? 'present' : 'none');
        initialResolved = true;
        setAuthLoading(false);
      }
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  // Periodically re-validate the current user's status. fetchCurrentUser()
  // only runs on initial load / auth-state changes by default, so someone
  // already using an open tab wouldn't be caught if an admin deactivates
  // them mid-session — this closes that window down to a few minutes rather
  // than "until they happen to refresh or log out".
  useEffect(() => {
    if (!session?.user?.id) return;
    const interval = setInterval(() => { fetchCurrentUser(); }, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    // Fully parallel — fetchCurrentUser does NOT need to complete before the
    // rest of these fire. It used to be sequenced ahead of everything else
    // specifically to fix a race where fetchReports/fetchSavedSearches/
    // fetchNotifications read the (still-null-at-that-instant) currentUser
    // React state. That race is now fixed more precisely, in those 3
    // functions themselves, by reading session.user.email directly instead
    // of depending on currentUser at all — so this sequential wait is no
    // longer needed for correctness, and it introduces a real risk of its
    // own: if fetchCurrentUser is ever slow (a network hiccup, a slow
    // query), the entire rest of the app's bootstrap was blocked waiting on
    // it alone, since nothing else even started until it resolved — a
    // single point of failure that could leave the whole app stuck on
    // loading after a refresh.
    Promise.all([
      fetchCurrentUser(), fetchCustomers(), fetchProducts(), fetchLeads(),
      fetchOpportunities(), fetchOrders(), fetchInvoices(), fetchContacts(),
      fetchActivities(), fetchQuoteTemplates(), fetchOrganizations(), fetchBusinessUnits(),
      fetchEnterpriseUsers(), fetchUserGroups(), fetchRoles(), fetchPermissions(),
      fetchWorkflowRules(), fetchAssignmentRules(), fetchSLAPolicies(),
      fetchApprovalProcesses(), fetchApprovalRequests(),
      fetchQuotations(), fetchReports(), fetchSavedSearches(), fetchInvoiceTemplates(),
      fetchNotifications(), fetchAppPreferences(), fetchAppearance(),
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
    if (supabase && tenantId) fetchAppearance();
  }, [tenantId]);

  useEffect(() => {
    if (!session?.user?.email) return;
    loadCurrentUserPermissions();
  }, [session?.user?.email, currentUser?.role_id]);

  // Re-fetch all data once permissions + data_scope are confirmed
  // This ensures applyDataSecurity runs with the correct scope after auth resolves
  useEffect(() => {
    if (!permissionsLoaded) return;
    // Re-fetch for EVERY scope once permissions resolve — the pre-permission
    // fetch pass stored [] (no-leak guard), so all users need one clean pass.
    // Re-fetch all B2B objects with correct scope applied
    Promise.all([
      fetchCustomers(), fetchLeads(), fetchOpportunities(), fetchOrders(),
      fetchInvoices(), fetchContacts(), fetchActivities(), fetchProducts(), fetchQuotations(),
      fetchRetailCustomers(), fetchRetailProducts(), fetchRetailActivities(),
      fetchRetailOrders(), fetchRetailInvoices(),
    ]);
  }, [permissionsLoaded, userDataScope]);

  useEffect(() => {
    if (!currentUser?.email) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.email]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // \u2500\u2500\u2500 Context Value \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500


  // ─── App Preferences (localStorage + Supabase) ────────────────────────────
  // Tenant-scoped localStorage key — prevents cross-tenant preference bleed
  const _LS_KEY = tenantId ? `bp_app_preferences_${tenantId}` : 'bp_app_preferences';
  const _DEF_PREFS = { crm_enabled:true, cpq_enabled:true, b2c_mode:false, default_currency:'INR', date_format:'DD/MM/YYYY', fiscal_year_start:'April', global_search_enabled:false, business_mode:'B2B', business_type:'general', rental_blocking_statuses:['Draft','Pending','Completed'] };
  const _cp = (p) => ({ crm_enabled:p?.crm_enabled??true, cpq_enabled:p?.cpq_enabled??true, b2c_mode:p?.b2c_mode??false, default_currency:p?.default_currency||'INR', date_format:p?.date_format||'DD/MM/YYYY', fiscal_year_start:p?.fiscal_year_start||'April', global_search_enabled:p?.global_search_enabled??false, business_mode:(p?.b2c_mode??false)?'B2C':'B2B', business_type:p?.business_type||'general', rental_blocking_statuses:p?.rental_blocking_statuses||['Draft','Pending','Completed'] });
  // ─── Appearance ───────────────────────────────────────────────────────────
  const _APP_KEY = tenantId ? `bp_appearance_${tenantId}` : 'bp_appearance';
  const _DEF_APP = { company_logo_url:'', company_name:'Umbrella Suite', theme:'navy', language:'en', font:'geist', font_size:'md', font_weight:'normal' };

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
  // Publish to window so components mounted outside AppProvider's tree (e.g.
  // AlertProvider, which wraps TenantProvider/AppProvider at the app root and
  // therefore can't call useApp()) can still read the current language for
  // translated dialog button labels.
  useEffect(() => {
    if (typeof window !== 'undefined') (window as any).__bp_appearance = appearance || {};
  }, [appearance]);

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
      const fetchTenantId = tenantId
        || (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null)
        || null;
      let aq = supabase.from('appearance').select('*').limit(1);
      if (fetchTenantId) aq = (aq as any).eq('tenant_id', fetchTenantId);
      const { data } = await (aq as any).maybeSingle();
      if (data) {
        const a = { ..._DEF_APP, ...data };
        if (data.company_logo_url) a.company_logo_url = data.company_logo_url;
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
      const effectiveTenantId = (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null) || tenantId || null;
      let q = supabase.from('appearance').select('id').limit(1);
      if (effectiveTenantId) q = (q as any).eq('tenant_id', effectiveTenantId);
      const { data:row } = await q.maybeSingle();
      // Only save columns that exist in the appearance table — not themeColors etc.
      const savePayload: any = {
        company_name: clean.company_name || 'Umbrella Suite',
        theme:        clean.theme        || 'navy',
        language:     clean.language     || 'en',
        font:         clean.font         || 'geist',
        font_size:    clean.font_size    || 'md',
        font_weight:  clean.font_weight  || 'normal',
        updated_at:   new Date().toISOString(),
        ...(effectiveTenantId ? { tenant_id: effectiveTenantId } : {}),
      };
      // Only touch logo_url if the caller explicitly included it in this save
      // call — but an explicit empty string (removal) must still be saved,
      // not silently dropped. Checking the raw `data` param (not `clean`,
      // which always has a value after the _DEF_APP spread) is what lets us
      // tell "omitted" apart from "explicitly cleared".
      if ('company_logo_url' in data) savePayload.company_logo_url = clean.company_logo_url;
      if (row?.id) {
        await supabase.from('appearance').update(savePayload).eq('id', row.id);
      } else {
        await supabase.from('appearance').insert([savePayload]);
      }
      // Sync logo to tenants table so the pre-login page and mobile app can
      // read it — same fix: an explicit removal must propagate here too.
      if ('company_logo_url' in data && effectiveTenantId) {
        await supabase.from('tenants').update({ logo_url: clean.company_logo_url || null }).eq('id', effectiveTenantId);
      }
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
      // Base font weight — a plain `body` selector has low specificity, so
      // any element with an explicit Tailwind weight class (font-bold,
      // font-semibold, headings, buttons, etc.) still correctly overrides
      // this via normal cascade rules. Only applies to otherwise-unweighted
      // regular body text, by design.
      app.font_weight && app.font_weight !== 'normal'
        ? `body { font-weight: ${{medium:'500',semibold:'600'}[app.font_weight] || '400'}; }`
        : '',
    ].join("\n");

    // RTL for Arabic
    document.body.dir = RTL_LANGS.includes(app.language) ? 'rtl' : 'ltr';

    // Base font size — scales the root element so every rem-based Tailwind
    // text utility (text-sm, text-base, text-lg, ...) scales proportionally,
    // without needing to touch individual components.
    const FONT_SIZE_SCALE = { sm: '87.5%', md: '100%', lg: '112.5%' };
    document.documentElement.style.fontSize = FONT_SIZE_SCALE[app.font_size] || '100%';

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
  // Publish prefs to window so lib/utils formatters follow regional settings
  useEffect(() => {
    if (typeof window !== 'undefined') (window as any).__bp_prefs = appPreferences || {};
  }, [appPreferences]);

  // Rental return reminders — checked once on load and every 4 hours while
  // the app stays open (see checkRentalReturnReminders, defined earlier in
  // this file, for why this is a client-triggered check rather than a
  // guaranteed server-side cron). This effect has to live here, after
  // appPreferences is declared above — its dependency array reads
  // appPreferences directly, which is evaluated immediately during render,
  // unlike the checkRentalReturnReminders function body itself, which only
  // runs later when actually called and is safe wherever it's defined.
  useEffect(() => {
    if (!session?.user?.id || appPreferences?.business_type !== 'rental') return;
    checkRentalReturnReminders();
    const interval = setInterval(() => { checkRentalReturnReminders(); }, 4 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session?.user?.id, appPreferences?.business_type]);

  // Scheduled ("before_date") workflow rules — checked every 15 minutes
  // while the app stays open. More frequent than the rental-reminder poll
  // above since this needs to support hour-level offsets ("1 hour before
  // delivery date"), not just day-level ones — see
  // SCHEDULED_WORKFLOW_POLL_WINDOW_MS for how the match window relates to
  // this interval. Same client-triggered-check caveat applies as elsewhere:
  // this runs while someone has the app open, not as a guaranteed
  // server-side cron.
  useEffect(() => {
    if (!session?.user?.id) return;
    runScheduledWorkflowRules();
    const interval = setInterval(() => { runScheduledWorkflowRules(); }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session?.user?.id, workflowRules.length]);

  const fetchAppPreferences = async () => {
    // Try localStorage first (fast path)
    try {
      const s = window.localStorage.getItem(_LS_KEY);
      if (s) { setAppPreferences(_cp(JSON.parse(s))); }
    } catch(e) {}
    // Always fetch from DB to get latest
    if (!supabase) return;
    try {
      const tid = (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null) || tenantId || null;
      let q = supabase.from('app_preferences').select('*');
      // Explicit tenant scoping as defense-in-depth — RLS's tenant_isolation
      // policy should already restrict this to the correct tenant, but this
      // codebase's established pattern is to never rely solely on RLS for
      // this kind of query. More importantly: without an explicit order,
      // if more than one row ever exists for this tenant (e.g. from a past
      // insert/update race), .limit(1) could non-deterministically return a
      // stale row instead of the one most recently saved — exactly what
      // "I select rental mode, save, and it reverts to general" looks like
      // from the outside.
      if (tid) q = (q as any).eq('tenant_id', tid);
      const { data } = await q.order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (data) {
        console.log('[fetchAppPreferences] Loaded business_type:', data.business_type, 'row id:', data.id);
        const p = _cp(data.settings ? { ..._cp(data), ...data.settings } : data);
        setAppPreferences(p);
        try { window.localStorage.setItem(_LS_KEY, JSON.stringify(p)); } catch(e) {}
      } else {
        // No app_preferences row yet — use tenant-level b2c_enabled as fallback
        const tenantInfo = typeof window !== 'undefined' ? (window as any).__bp_tenant : null;
        if (tenantInfo?.b2c_enabled !== undefined) {
          const defaults = {
            b2c_mode:         !!tenantInfo.b2c_enabled,
            crm_enabled:      !tenantInfo.b2c_enabled,
            cpq_enabled:      !tenantInfo.b2c_enabled,
            date_format:      'DD/MM/YYYY',
            default_currency: 'INR',
          };
          setAppPreferences(defaults as any);
        }
      }
    } catch(e: any) { console.error('[fetchAppPreferences] error:', e.message); }
  };
  const saveAppPreferences = async (prefs): Promise<{ success: boolean; error?: string }> => {
    const clean = _cp(prefs);
    console.log('[saveAppPreferences] Saving with business_type:', clean.business_type);
    // Always save to localStorage immediately
    try { window.localStorage.setItem(_LS_KEY, JSON.stringify(clean)); } catch(e) {}
    setAppPreferences(clean);
    if (!supabase) { console.log('[saveAppPreferences] No supabase client — local-only save'); return { success: true }; }
    try {
      const payload = {
        settings: clean,
        default_currency:        clean.default_currency,
        crm_enabled:             clean.crm_enabled,
        cpq_enabled:             clean.cpq_enabled,
        b2c_mode:                clean.b2c_mode,
        date_format:             clean.date_format,
        fiscal_year_start:       clean.fiscal_year_start,
        global_search_enabled:   clean.global_search_enabled,
        business_type:           clean.business_type || 'general',
        updated_at:              new Date().toISOString(),
        ...(tenantId ? { tenant_id: tenantId } : {}),
        ...(currentUser?.organization_id ? { organization_id: currentUser.organization_id } : {}),
      };
      // Find existing row for THIS tenant
      const effectiveTenantId2 = (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null) || tenantId || null;
      console.log('[saveAppPreferences] Effective tenant id:', effectiveTenantId2);
      let pq = supabase.from('app_preferences').select('id').order('updated_at', { ascending: false }).limit(1);
      if (effectiveTenantId2) pq = (pq as any).eq('tenant_id', effectiveTenantId2);
      const { data: row } = await pq.maybeSingle();
      console.log('[saveAppPreferences] Existing row found:', row?.id || 'none — will insert');
      if (row?.id) {
        const { error } = await supabase.from('app_preferences').update(payload).eq('id', row.id);
        if (error) {
          console.error('[saveAppPreferences] update error:', error.message);
          // Previously this error was only logged to the console and never
          // shown to the user — setAppPreferences(clean) above already
          // updated the UI regardless of whether the database write
          // actually succeeded, so a failed save looked identical to a
          // successful one until the next page refresh silently reverted
          // it. Surface it clearly instead.
          showAlert('Could not save preferences: ' + error.message, { variant:'danger', title:'Save Failed' });
          return { success: false, error: error.message };
        }
        console.log('[saveAppPreferences] Update succeeded for row', row.id);
      } else {
        const { error } = await supabase.from('app_preferences').insert([{ ...payload, ...(effectiveTenantId2 ? { tenant_id: effectiveTenantId2 } : {}) }]);
        if (error) {
          console.error('[saveAppPreferences] insert error:', error.message);
          showAlert('Could not save preferences: ' + error.message, { variant:'danger', title:'Save Failed' });
          return { success: false, error: error.message };
        }
      }
    } catch(e: any) {
      console.error('[saveAppPreferences] error:', e.message);
      showAlert('Could not save preferences: ' + e.message, { variant:'danger', title:'Save Failed' });
      return { success: false, error: e.message };
    }
    if (prefs.default_currency) fetchExchangeRates(prefs.default_currency);
    return { success: true };
  };

  // ─── Exchange Rates ────────────────────────────────────────────────────────
  const [exchangeRates, setExchangeRates] = useState({});
  const fetchExchangeRates = async (base='INR') => { try{const r=await fetch(`https://open.er-api.com/v6/latest/${base}`);const d=await r.json();if(d?.rates)setExchangeRates(d.rates);}catch(e){} };
  const convertCurrency = (amt,from,to) => { if(!amt||from===to)return amt; if(!exchangeRates[from]||!exchangeRates[to])return amt; return(amt/exchangeRates[from])*exchangeRates[to]; };

  // ─── Quotations ────────────────────────────────────────────────────────────
  const [quotations, setQuotations] = useState([]);
  const fetchQuotations = async () => {
    if (!supabase) return;
    const { data, error } = await tScope(supabase.from('quotations').select('*')).order('created_at', { ascending: false }).limit(LIST_FETCH_LIMIT);
    if (error) console.error('fetchQuotations:', error);
    if (data) setQuotations(applyDataSecurity(data).map(q => ({ ...q, customerId: q.customer_id, displayNumber: q.display_number })));
  };
  const createQuotation = async (data,items=[]) => { if(!supabase||!currentUser)return null; const qNum=generateId('QUO'); const{_uuid,id,customerId,displayNumber,contactId,activityType,activityDate,dueDate,closeDate,isPrimary,linkedIn,ownerName,...cleanData}=data; const{data:inserted,error}=await supabase.from('quotations').insert([{...buildSystemFields(),quote_number:qNum,...cleanData,status:cleanData.status||'Draft',version:1,owner:cleanData.owner||currentUser.email,owner_id:cleanData.owner_id||currentUser.id}]).select().single(); if(error){showAlert('Failed: '+error.message);return null;} if(items.length)await upsertLineItemsGeneric('quotation_line_items','quote_number',qNum,items); await autoSetCustomerStatus(data.customer_id, 'Prospect'); await runAutomations('quotations', qNum, inserted, 'on_create'); await fetchQuotations(); return {...inserted, customerId: inserted.customer_id}; };
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
    if(error){ console.error('updateQuotation:',error.message); showAlert('Save failed: '+error.message); return; }
    if(items) await upsertLineItemsGeneric('quotation_line_items','quote_number',quote_number,items);
    await runAutomations('quotations', quote_number, data, 'on_update');
    await fetchQuotations();
  };
  const deleteQuotation = async (qNum) => { if(!supabase)return; if(!(await showConfirm('Delete this quotation?', { variant:'danger', confirmLabel:'Delete' })))return; await supabase.from('quotation_line_items').delete().eq('quote_number',qNum); await supabase.from('quotations').delete().eq('quote_number',qNum); await fetchQuotations(); };
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
    const{data:inserted,error}=await supabase.from('quotations').insert([{...buildSystemFields(),quote_number:qNum,name:`Quote - ${opp.name}`,status:'Draft',version:1,customer:opp.customer||'',customer_id:opp.customerId||null,contact:opp.contact||'',contact_id:opp.contactId||null,opportunity_id:opp.id,currency:opp.currency||'INR',subtotal:Number(subtotal.toFixed(2)),total_discount:Number(totalDisc.toFixed(2)),total_tax:Number(totalTax.toFixed(2)),grand_total:Number(grandTotal.toFixed(2)),billing_address:opp.billingAddress||opp.billing_address||'',shipping_address:opp.shippingAddress||opp.shipping_address||'',payment_terms:opp.paymentTerms||opp.payment_terms||'',owner:opp.owner||currentUser.email,owner_id:opp.owner_id||currentUser.id}]).select().single(); if(error){showAlert('Failed: '+error.message);return null;} if(items.length)await supabase.from('quotation_line_items').insert(items.map((i,idx)=>({quote_number:qNum,product_name:i.product||i.product_name||'',product_id:i.product_id||null,quantity:Number(i.quantity||1),unit_price:Number(i.price||0),list_price:Number(i.list_price||i.price||0),discount_pct:Number(i.discount||i.discount_pct||0),tax_pct:Number(i.tax_pct||0),extended_price:Number(i.quantity||1)*Number(i.price||0)*(1-Number(i.discount||i.discount_pct||0)/100),sort_order:idx,configuration:i.configuration||{}}))); await autoSetCustomerStatus(opp.customerId, 'Prospect'); await supabase.from('opportunities').update({ status:'Negotiation', stage:'Negotiation', updated_at:new Date().toISOString() }).eq('opportunity_number', opp.id);
    await fetchOpportunities();
    await fetchQuotations(); return{...inserted, customerId: inserted.customer_id}; };

  // ─── CPQ Flow: Quote→Order→Invoice, Opp→Order ─────────────────────────────
  // Creates an order from a B2B quotation. By default (no `selections`) orders
  // the full remaining balance of every line item — existing callers that
  // don't pass `selections` keep working exactly as before.
  // Pass `selections` as [{ _id: <quotation_line_item id>, qty: <number to order now> }]
  // to convert only part of the quote; each quotation line item tracks how
  // much has been ordered so far via `ordered_qty`.
  const createOrderFromQuotation = async (quotation, selections: { _id: any; qty: number }[] | null = null) => {
    if (!supabase || !currentUser) return null;
    const { data: qItems } = await supabase.from('quotation_line_items').select('*').eq('quote_number', quotation.quote_number).order('sort_order');
    const allItems = qItems || [];
    if (!allItems.length) { showAlert('This quotation has no line items to order.'); return null; }

    const toOrder = allItems.map((i: any) => {
      const qty = Number(i.quantity || 0);
      const already = Number(i.ordered_qty || 0);
      const remaining = Math.max(0, qty - already);
      const sel = selections?.find((s) => String(s._id) === String(i.id));
      const qtyNow = selections ? Math.max(0, Math.min(Number(sel?.qty || 0), remaining)) : remaining;
      return { ...i, qtyNow, remaining };
    }).filter((i: any) => i.qtyNow > 0);

    if (!toOrder.length) { showAlert('Nothing to order — all items are already fully ordered, or no quantities were selected.'); return null; }

    const sub  = toOrder.reduce((s: number, i: any) => s + i.qtyNow * Number(i.unit_price || i.price || 0), 0);
    const disc = toOrder.reduce((s: number, i: any) => s + i.qtyNow * Number(i.unit_price || i.price || 0) * (Number(i.discount_pct || i.discount || 0) / 100), 0);
    const tax  = toOrder.reduce((s: number, i: any) => {
      const n = i.qtyNow * Number(i.unit_price || i.price || 0) * (1 - Number(i.discount_pct || 0) / 100);
      return s + n * (Number(i.tax_pct || 0) / 100);
    }, 0);
    // Overall discount is a PERCENTAGE, so it scales correctly with `sub` on
    // its own — apply it to every order, full or partial, rather than only
    // full conversions. (Previously this was gated to full-conversions only,
    // which silently dropped the discount entirely on any partial order.)
    const od = sub * Number(quotation.overall_discount || 0) / 100;
    // Shipping is a flat amount on the quote, not naturally divisible per
    // line item — charge it once, on whichever order completes the quote's
    // full ordered quantity, rather than splitting it across partial orders
    // or (as before) silently dropping it whenever the quote isn't fully
    // converted in one shot.
    const orderedPreview = new Map(toOrder.map((i: any) => [i.id, i.qtyNow]));
    const willBeFullyOrdered = allItems.every((i: any) => {
      const already = Number(i.ordered_qty || 0) + (orderedPreview.get(i.id) || 0);
      return already >= Number(i.quantity || 0);
    });
    const shippingCost = willBeFullyOrdered ? Number(quotation.shipping_cost || 0) : 0;
    const gt = sub - disc + tax - od + shippingCost;
    const ordId = generateId('ORD');

    const { error } = await supabase.from('orders').insert([{
      ...buildSystemFields(),
      order_number: ordId,
      name: quotation.name || `Order - ${quotation.quote_number}`,
      quote_number: quotation.quote_number,
      customer: quotation.customer || '', customer_id: quotation.customer_id || null,
      contact: quotation.contact || '', contact_id: quotation.contact_id || null,
      billing_address: quotation.billing_address || '', shipping_address: quotation.shipping_address || '',
      payment_terms: quotation.payment_terms || '', currency: quotation.currency || 'INR',
      overall_discount: Number(quotation.overall_discount || 0),
      shipping_cost: shippingCost,
      subtotal: Number(sub.toFixed(2)), total_discount: Number((disc + od).toFixed(2)),
      total_tax: Number(tax.toFixed(2)), amount: Number(gt.toFixed(2)),
      status: 'Draft', owner: quotation.owner || currentUser.email, owner_id: quotation.owner_id || currentUser.id,
    }]);
    if (error) { showAlert('Failed to create order: ' + error.message); return null; }

    await supabase.from('order_line_items').insert(toOrder.map((i: any, idx: number) => ({
      order_number: ordId,
      product_name: i.product_name || '', product_code: i.product_code || '', description: i.description || '',
      quantity: i.qtyNow, price: Number(i.unit_price || i.price || 0), list_price: Number(i.unit_price || i.price || 0),
      discount: Number(i.discount_pct || i.discount || 0), tax_pct: Number(i.tax_pct || 0),
      extended_price: i.qtyNow * Number(i.unit_price || i.price || 0) * (1 - Number(i.discount_pct || 0) / 100),
      sort_order: idx, invoiced_qty: 0, custom_data: i.custom_data || {},
    })));

    // Update each quotation line item's running ordered_qty.
    await Promise.all(toOrder.map((i: any) =>
      supabase.from('quotation_line_items').update({ ordered_qty: Number(i.ordered_qty || 0) + i.qtyNow }).eq('id', i.id)
    ));

    // Quotation-level status reflects fulfillment: fully vs. partially ordered.
    // (Reuses willBeFullyOrdered computed above, before the insert — the
    // underlying line items haven't changed since, so it's still accurate.)
    const fullyOrdered = willBeFullyOrdered;
    const newQStatus = fullyOrdered ? 'Ordered' : 'Partially Ordered';
    await supabase.from('quotations').update({ status: newQStatus, ...buildSystemFields(true) }).eq('quote_number', quotation.quote_number);
    setQuotations(prev => prev.map(q => q.quote_number === quotation.quote_number ? { ...q, status: newQStatus } : q));
    await autoSetCustomerStatus(quotation.customer_id, 'Active');

    if (quotation.opportunity_id && fullyOrdered) {
      await supabase.from('opportunities').update({ status: 'Closed Won', stage: 'Closed Won', updated_at: new Date().toISOString() }).eq('opportunity_number', quotation.opportunity_id);
      await fetchOpportunities();
    }
    await fetchOrders();
    return ordId;
  };

  // ─── Reports ───────────────────────────────────────────────────────────────
  const [reports, setReports] = useState([]);
  const fetchReports = async () => {
    if (!supabase) return;
    // Read the email from session (not the currentUser React state) — this
    // function is a closure captured when the bootstrap effect was set up,
    // which only depends on session/supabase, not currentUser. Awaiting
    // fetchCurrentUser() elsewhere only schedules a future re-render with a
    // NEW closure; it does not retroactively update currentUser as seen by
    // THIS already-running closure. session.user.email is available
    // synchronously and isn't being mutated within this same effect run, so
    // it sidesteps the stale-closure trap instead of racing against it.
    const email = currentUser?.email || session?.user?.email;
    if (!email) return;
    // Built as a single .or() (not stacked on top of tScope's own .or() for
    // the demo tenant) to avoid two same-named `or=` query params landing on
    // one request, which is ambiguous. Tenant scoping is folded directly into
    // this one filter instead.
    const tid = (window as any).__bp_tenant?.id || null;
    const orClause = `created_by.eq.${email},is_public.eq.true`;
    const { data, error } = await supabase.from('reports').select('*')
      .or(orClause)
      .order('created_at', { ascending: false });
    if (error) { console.error('fetchReports:', error.message); showAlert('Could not load saved reports: ' + error.message, { variant:'danger', title:'Load Failed' }); return; }
    // Tenant-scope client-side (matches tScope's own logic) since the tenant
    // filter can't safely combine with the OR above in one request.
    const scoped = (data||[]).filter((r:any) => {
      if (!tid) return true;
      if (r.tenant_id === tid) return true;
      if (r.tenant_id == null && tid === DEMO_TENANT_ID) return true;
      return false;
    });
    setReports(scoped);
  };
  const saveReport = async (data) => {
    if(!supabase||!currentUser)return null;
    if(!data?.name?.trim()){ showAlert('Report needs a name.', { variant:'warning' }); return null; }
    const tid = (window as any).__bp_tenant?.id || null;
    let r, error;
    if(data.id){
      // UPDATE — id is the target row, not a field to write.
      const { id, ...fields } = data;
      ({ data: r, error } = await supabase.from('reports').update({...fields,updated_at:new Date().toISOString()}).eq('id',id).select().single());
    } else {
      // INSERT — never spread `id` here: data.id is null/undefined for a new
      // report, and explicitly writing `id: null` overrides the column's
      // gen_random_uuid() default, violating the NOT NULL primary key
      // constraint and causing every "new report" save to fail silently
      // (the previous version never even checked this error).
      const { id, ...fields } = data;
      ({ data: r, error } = await supabase.from('reports').insert([{...fields,created_by:currentUser.email,organization_id:currentUser.organization_id,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),...(tid?{tenant_id:tid}:{})}]).select().single());
    }
    if(error){ console.error('saveReport:',error.message); showAlert('Failed to save report: ' + error.message, { variant:'danger', title:'Save Failed' }); return null; }
    await fetchReports();
    return r;
  };
  const deleteReport = async (id) => { if(!supabase)return; if(!(await showConfirm('Delete this report?', { variant:'danger', confirmLabel:'Delete' })))return; const{error}=await supabase.from('reports').delete().eq('id',id); if(error){showAlert('Failed to delete report: '+error.message,{variant:'danger'});return;} await fetchReports(); };

  // ─── Saved Searches ────────────────────────────────────────────────────────
  const [savedSearches, setSavedSearches] = useState([]);
  // Accepts an optional `page`/object_type to filter server-side — passing
  // none (or omitting it) fetches all saved searches for the user, same as
  // before, so existing bare calls keep working.
  const fetchSavedSearches = async (page?: string) => {
    if(!supabase)return;
    const email = currentUser?.email || session?.user?.email;
    if(!email)return;
    const tid = (window as any).__bp_tenant?.id || null;
    let q = supabase.from('saved_searches').select('*').or(`created_by.eq.${email},is_global_default.eq.true`).order('created_at',{ascending:false});
    if(tid) q = (q as any).eq('tenant_id', tid);
    if(page) q = (q as any).eq('object_type', page);
    const{data}=await q;
    if(data)setSavedSearches(data);
  };
  // Pass a single object: { name, object_type, filters, is_default?, is_global_default? }
  const createSavedSearch = async (data: { name: string; object_type: string; filters: any; is_default?: boolean; is_global_default?: boolean }) => {
    if(!supabase||!currentUser)return null;
    if(!data?.name?.trim()||!data?.object_type){ showAlert('Saved search needs a name and an object type.', { variant:'warning' }); return null; }
    const tid = (window as any).__bp_tenant?.id || null;
    const payload = {
      name: data.name, object_type: data.object_type, filters: data.filters||{},
      is_default: !!data.is_default, is_global_default: !!data.is_global_default,
      created_by:currentUser.email,organization_id:currentUser.organization_id,created_at:new Date().toISOString(),
      ...(tid?{tenant_id:tid}:{}),
    };
    const{data:r,error}=await supabase.from('saved_searches').insert([payload]).select().single();
    if(error){ console.error('createSavedSearch:',error.message); showAlert('Failed to save search: ' + error.message, { variant:'danger', title:'Save Failed' }); return null; }
    await fetchSavedSearches();
    return r;
  };
  const updateSavedSearch = async (id: string, patch: { name?: string; filters?: any }) => {
    if(!supabase)return null;
    if(patch.name !== undefined && !patch.name.trim()){ showAlert('Saved search name cannot be empty.', { variant:'warning' }); return null; }
    const{data:r,error}=await supabase.from('saved_searches').update(patch).eq('id',id).select().single();
    if(error){ showAlert('Failed to update search: '+error.message, { variant:'danger' }); return null; }
    await fetchSavedSearches();
    showAlert(patch.filters !== undefined ? 'Saved search updated with your current filters.' : 'Saved search renamed.', { variant:'success', title:'Updated' });
    return r;
  };
  const deleteSavedSearch = async (id, name = 'this saved search') => {
    if(!supabase)return;
    if(!(await showConfirm(`Delete "${name}"? This can't be undone.`, { variant:'danger', confirmLabel:'Delete', title:'Delete Saved Search' })))return;
    const{error}=await supabase.from('saved_searches').delete().eq('id',id);
    if(error){showAlert('Failed to delete search: '+error.message,{variant:'danger'});return;}
    await fetchSavedSearches();
  };
  // isGlobal: false = personal default (only affects the current user),
  // true = team-wide default (visible/applied for everyone on this object).
  const setDefaultSavedSearch = async (id: string, isGlobal: boolean = false) => {
    if(!supabase||!currentUser)return;
    await supabase.from('saved_searches').update({is_default:false,is_global_default:false}).eq('created_by',currentUser.email);
    const{error}=await supabase.from('saved_searches').update({is_default:true,is_global_default:isGlobal}).eq('id',id);
    if(error){showAlert('Failed to set default: '+error.message,{variant:'danger'});return;}
    await fetchSavedSearches();
  };

  // ─── List View Preferences (column visibility/order + sort, per user/page) ─
  const [listViewPrefs, setListViewPrefs] = useState<Record<string, { columns: string[]; sort: any }>>({});
  const fetchListViewPrefs = async (page: string) => {
    if(!supabase||!currentUser) return null;
    const tid = (window as any).__bp_tenant?.id || null;
    let q = supabase.from('list_view_prefs').select('*').eq('user_email',currentUser.email).eq('page',page);
    if(tid) q = (q as any).eq('tenant_id', tid);
    const{data,error} = await q.maybeSingle();
    if(error){ console.error('fetchListViewPrefs:',error.message); return null; }
    if(data) setListViewPrefs(prev => ({ ...prev, [page]: { columns: data.columns||[], sort: data.sort||{} } }));
    return data;
  };
  const saveListViewPrefs = async (page: string, prefs: { columns: string[]; sort: any }) => {
    if(!supabase||!currentUser) return;
    const tid = (window as any).__bp_tenant?.id || null;
    setListViewPrefs(prev => ({ ...prev, [page]: prefs })); // optimistic
    const payload = {
      user_email: currentUser.email, page, columns: prefs.columns||[], sort: prefs.sort||{},
      updated_at: new Date().toISOString(), ...(tid?{tenant_id:tid}:{}),
    };
    const{error} = await supabase.from('list_view_prefs').upsert([payload], { onConflict: 'tenant_id,user_email,page' });
    if(error){ console.error('saveListViewPrefs:',error.message); showAlert('Failed to save column preferences: '+error.message,{variant:'danger'}); }
  };

  // ─── Notes / Comments / Attachments ───────────────────────────────────────
  const fetchRecordNotes = async (rType,rId) => { if(!supabase)return[]; const{data}=await tScope(supabase.from('record_notes').select('*')).eq('record_type',rType).eq('record_id',rId).order('created_at',{ascending:false}); return data||[]; };
  const saveNote = async (rType,rId,note) => { if(!supabase||!currentUser)return; if(note.id)await supabase.from('record_notes').update({...note,updated_at:new Date().toISOString()}).eq('id',note.id); else await supabase.from('record_notes').insert([{...note,record_type:rType,record_id:rId,created_by:currentUser.email,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),...(tenantId?{tenant_id:tenantId}:{}),...(tenantId?{tenant_id:tenantId}:{})}]); };
  const deleteNote = async (id) => { if(!supabase)return; await supabase.from('record_notes').delete().eq('id',id); };
  const toggleNotePin = async (id,pinned) => { if(!supabase)return; await supabase.from('record_notes').update({is_pinned:!pinned}).eq('id',id); };
  const fetchRecordComments = async (rType,rId) => { if(!supabase)return[]; const{data}=await tScope(supabase.from('record_comments').select('*')).eq('record_type',rType).eq('record_id',rId).order('created_at',{ascending:false}); return data||[]; };
  const postComment = async (rType,rId,body) => { if(!supabase||!currentUser)return; await supabase.from('record_comments').insert([{record_type:rType,record_id:rId,body,created_by:currentUser.email,created_at:new Date().toISOString(),...(tenantId?{tenant_id:tenantId}:{})}]); };
  const deleteComment = async (id) => { if(!supabase)return; await supabase.from('record_comments').delete().eq('id',id); };
  const fetchRecordAttachments = async (rType,rId) => { if(!supabase)return[]; const{data}=await tScope(supabase.from('record_attachments').select('*')).eq('record_type',rType).eq('record_id',rId).order('created_at',{ascending:false}); return data||[]; };
  const uploadAttachment = async (rType,rId,file) => { if(!supabase||!currentUser)return null; try{const path=`${rType}/${rId}/${Date.now()}_${file.name}`; const{error}=await supabase.storage.from('attachments').upload(path,file); if(error)return null; await supabase.from('record_attachments').insert([{record_type:rType,record_id:rId,file_name:file.name,file_path:path,file_size:file.size,created_by:currentUser.email,created_at:new Date().toISOString()}]); return path;}catch(e){return null;} };
  const deleteAttachment = async (id,path) => { if(!supabase)return; if(path)await supabase.storage.from('attachments').remove([path]); await supabase.from('record_attachments').delete().eq('id',id); };
  const getAttachmentUrl = (path) => { if(!supabase||!path)return null; const{data}=supabase.storage.from('attachments').getPublicUrl(path); return data?.publicUrl||null; };
  const fetchApprovalRequestsForRecord = async (rType,rId) => { if(!supabase)return[]; const{data}=await tScope(supabase.from('approval_requests').select('*')).eq('record_type',rType).eq('record_id',rId).order('created_at',{ascending:false}); return data||[]; };
  const fetchAuditLog = async (rType,rId) => { if(!supabase)return[]; const{data}=await tScope(supabase.from('audit_log').select('*')).eq('record_type',rType).eq('record_id',rId).order('performed_at',{ascending:false}).limit(50); return data||[]; };
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
    if (!supabase) return;
    if (!(await showConfirm('Delete this record?', { variant:'danger', confirmLabel:'Delete' }))) return;
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

  const adminResetPassword = async (authUserId: string, password: string) => {
    if (!authUserId || !password) return;
    try {
      const tenant = (window as any).__bp_tenant || {};
      const r = await fetch('/api/admin/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authUserId, password, db_url: tenant.db_url || null }),
      });
      const j = await r.json();
      if (!r.ok) showAlert('Password reset failed: ' + (j.error || r.status));
    } catch(e: any) { showAlert('Password reset error: ' + e.message); }
  };


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
    roles, permissions, rolePermissions, quoteTemplates, invoiceTemplates,
    fetchInvoiceTemplates, saveInvoiceTemplate, deleteInvoiceTemplate, setDefaultInvoiceTemplate,
    listViewPrefs, fetchListViewPrefs, saveListViewPrefs,
    workflowRules, assignmentRules, slaPolicies, approvalProcesses, approvalRequests,
    notifications, unreadCount, markNotificationRead, markAllNotificationsRead,
    retailCustomers, retailProducts, retailActivities, retailOrders, retailInvoices,
    fetchRetailCustomers, fetchRetailProducts, fetchRetailActivities, fetchRetailOrders, fetchRetailInvoices,
    fetchRetailLineItems, upsertRetailLineItems, checkRentalConflict, isRentalBlockingStatus, validateRentalDateRange,
    createRetailRecord, updateRetailRecord, deleteRetailRecord, createRetailInvoiceFromOrder,
    fetchCustomers, fetchContacts, fetchProducts, fetchLeads, fetchOpportunities,
    fetchOrders, fetchInvoices, fetchActivities, fetchOrganizations, fetchBusinessUnits,
    fetchEnterpriseUsers, fetchUserGroups, fetchGroupMembers, fetchRoles, fetchPermissions,
    fetchRolePermissions, fetchQuoteTemplates, fetchWorkflowRules, fetchAssignmentRules,
    fetchSLAPolicies, fetchApprovalProcesses, fetchApprovalRequests, fetchNotifications,
    fetchLineItems, buildSystemFields, applyDataSecurity, fetchListCount,
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
    savedSearches, fetchSavedSearches, createSavedSearch, updateSavedSearch, deleteSavedSearch, setDefaultSavedSearch,
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
