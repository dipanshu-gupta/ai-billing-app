'use client';
// @ts-nocheck

import React, { useEffect, useRef, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '@/lib/supabase';
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

// ─── Constants ───────────────────────────────────────────────────────────────

const navigationItems = [
  { key: 'dashboard',     label: 'Dashboard',     icon: '📊', permission: null },
  { key: 'customers',     label: 'Customers',     icon: '👥', permission: 'customers_view' },
  { key: 'products',      label: 'Products',      icon: '📦', permission: 'products_view' },
  { key: 'leads',         label: 'Leads',         icon: '🎯', permission: 'leads_view' },
  { key: 'opportunities', label: 'Opportunities', icon: '💼', permission: 'opportunities_view' },
  { key: 'activities',    label: 'Activities',    icon: '📅', permission: 'activities_view' },
  { key: 'contacts',      label: 'Contacts',      icon: '📇', permission: 'contacts_view' },
  { key: 'orders',        label: 'Orders',        icon: '🛒', permission: 'orders_view' },
  { key: 'invoices',      label: 'Invoices',      icon: '🧾', permission: 'invoices_view' },
  { key: 'adminTools',    label: 'Admin Tools',   icon: '⚙️', permission: 'admin_tools_view' },
];

const PAGE_LABELS: Record<string, string> = {
  customers:     'Customer',
  products:      'Product',
  leads:         'Lead',
  opportunities: 'Opportunity',
  activities:    'Activity',
  contacts:      'Contact',
  orders:        'Order',
  invoices:      'Invoice',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

const getPageLabel = (page: string): string => PAGE_LABELS[page] ?? 'Record';

// ─── Component ───────────────────────────────────────────────────────────────

export default function AIBillingApp() {

  // Auth
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  // UI state
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTimeline, setSelectedTimeline] = useState('Last 30 Days');
  const [detailsTab, setDetailsTab] = useState('details');
  const [customerSections, setCustomerSections] = useState({ company: true, address: true });

  // AI chat
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<any[]>([
    { type: 'assistant', text: 'Welcome to AI Billing Agent. Ask me about revenue, leads, opportunities, invoices or orders.' },
  ]);

  // Record editing
  const [editedRecord, setEditedRecord] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [timelineFilter, setTimelineFilter] = useState('All Time');
  const [lineItems, setLineItems] = useState<any[]>([]);

  // Admin tools
  const [adminToolPage, setAdminToolPage] = useState('home');
  const [adminActionMenu, setAdminActionMenu] = useState<string | null>(null);
  const [selectedAdminRecord, setSelectedAdminRecord] = useState<any>(null);
  const [adminModalMode, setAdminModalMode] = useState('');

  // Data collections
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [businessUnits, setBusinessUnits] = useState<any[]>([]);
  const [enterpriseUsers, setEnterpriseUsers] = useState<any[]>([]);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);

  // User / permissions
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserPermissions, setCurrentUserPermissions] = useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [profilePageOpen, setProfilePageOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [profileFormData, setProfileFormData] = useState({
    first_name: '', last_name: '', phone: '', designation: '',
  });

  // Forms — Organizations / BU / Users / Groups
  const [organizationFormOpen, setOrganizationFormOpen] = useState(false);
  const [organizationFormData, setOrganizationFormData] = useState({
    name: '', organization_code: '', status: 'Active',
    industry: '', website: '', country: '', timezone: '', currency: '',
  });
  const [businessUnitFormOpen, setBusinessUnitFormOpen] = useState(false);
  const [businessUnitFormData, setBusinessUnitFormData] = useState({
    name: '', business_unit_code: '', organization_id: '', description: '', status: 'Active',
  });
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [userFormData, setUserFormData] = useState({
    employee_code: '', username: '', first_name: '', last_name: '',
    email: '', temporary_password: '', phone: '', designation: '',
    organization_id: '', business_unit_id: '', role_id: '', status: 'Active',
  });
  const [userGroupFormOpen, setUserGroupFormOpen] = useState(false);
  const [userGroupFormData, setUserGroupFormData] = useState({
    group_name: '', group_code: '', description: '',
    organization_id: '', business_unit_id: '', status: 'Active',
  });
  const [userGroupMembers, setUserGroupMembers] = useState<any[]>([]);
  const [selectedGroupUsers, setSelectedGroupUsers] = useState<string[]>([]);
  const [groupWorkspaceOpen, setGroupWorkspaceOpen] = useState(false);

  // Roles
  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [roleFormData, setRoleFormData] = useState({
    role_name: '', role_code: '', description: '', status: 'Active',
  });
  const [selectedRolePermissions, setSelectedRolePermissions] = useState<string[]>([]);

  // Quote templates
  const [quoteTemplates, setQuoteTemplates] = useState<any[]>([
    {
      id: 'TEMP-001', name: 'Default Quote Template', isDefault: true,
      companyName: 'Your Company', companyEmail: 'sales@company.com',
      companyPhone: '+91 9999999998', companyAddress: 'Delhi, India',
      quoteTitle: 'Quotation', footerText: 'Thank you for your business.',
      termsAndConditions: 'Payment due within 15 days.',
      primaryColor: '#0F172A', secondaryColor: '#1E3A8A',
    },
  ]);
  const [templateFormData, setTemplateFormData] = useState<any>({
    name: '', companyName: '', companyEmail: '', companyPhone: '',
    companyAddress: '', quoteTitle: 'Quotation', footerText: '',
    termsAndConditions: '', primaryColor: '#0F172A', secondaryColor: '#1E3A8A',
  });
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [quotePreviewOpen, setQuotePreviewOpen] = useState(false);
  const [selectedQuoteOpportunity, setSelectedQuoteOpportunity] = useState<any>(null);
  const [selectedQuoteTemplate, setSelectedQuoteTemplate] = useState<any>(null);
  const [quoteLineItems, setQuoteLineItems] = useState<any[]>([]);

  // Create form
  const [createFormData, setCreateFormData] = useState<any>({
    name: '', customer: '', status: 'New', amount: '', email: '', phone: '',
    source: '', category: '', price: '', company: '', industry: '',
    billingAddress: '', shippingAddress: '', city: '', state: '',
    postalCode: '', country: '', website: '', gstNumber: '',
    stage: 'Qualification', closeDate: '', shippingAddressOrder: '',
    deliveryDate: '', dueDate: '', paymentTerms: '',
  });

  // Refs
  const navigatorRef = useRef<HTMLElement | null>(null);
  const printableQuoteRef = useRef<HTMLDivElement | null>(null);
  const quotePreviewRef = useRef<HTMLDivElement | null>(null);

  // ─── Derived / computed ──────────────────────────────────────────────────

  const isEditingUser = adminModalMode === 'editUser';

  // ─── System field helpers ────────────────────────────────────────────────

  const buildSystemFields = (isUpdate = false) => {
    if (!currentUser) return {};
    const now = new Date().toISOString();
    if (isUpdate) {
      return { updated_by: currentUser.email, updated_at: now };
    }
    return {
      created_by: currentUser.email,
      created_at: now,
      updated_by: currentUser.email,
      updated_at: now,
      organization_id: currentUser.organization_id,
      business_unit_id: currentUser.business_unit_id,
    };
  };

  const applyDataSecurity = (records: any[]) => {
    if (!currentUser) return records;
    return records.filter((record: any) => {
      const organizationMatch = !record.organization_id || record.organization_id === currentUser.organization_id;
      const businessUnitMatch = !record.business_unit_id || record.business_unit_id === currentUser.business_unit_id;
      return organizationMatch && businessUnitMatch;
    });
  };

  const canAccessRecord = (record: any) => {
    if (!currentUser) return false;
    return (
      (!record.organization_id || record.organization_id === currentUser.organization_id) &&
      (!record.business_unit_id || record.business_unit_id === currentUser.business_unit_id)
    );
  };

  // ─── Fetch functions ─────────────────────────────────────────────────────

  const fetchCustomers = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    if (!error && data) {
      const secured = applyDataSecurity(data);
      setCustomers(
        secured.map((c: any) => ({
          id: c.customer_number,
          primaryContactId: c.primary_contact_id,
          primaryContact: contacts.find((x: any) => x.id === c.primary_contact_id)?.name || '',
          name: c.name,
          email: c.email,
          phone: c.phone,
          company: c.company,
          industry: c.industry,
          billingAddress: c.billing_address,
          shippingAddress: c.shipping_address,
          city: c.city,
          state: c.state,
          postalCode: c.postal_code,
          country: c.country,
          website: c.website,
          gstNumber: c.gst_number,
          status: c.status,
          created_by: c.created_by, created_at: c.created_at,
          updated_by: c.updated_by, updated_at: c.updated_at,
          organization_id: c.organization_id, business_unit_id: c.business_unit_id,
        }))
      );
    }
  };

  const fetchProducts = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    if (!error && data) {
      setProducts(data.map((p: any) => ({
        id: p.product_number, name: p.name,
        category: p.category, price: Number(p.price || 0), status: p.status,
      })));
    }
  };

  const fetchLeads = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    if (!error && data) {
      setLeads(data.map((l: any) => ({
        id: l.lead_number, name: l.name,
        customer: l.customer, customerId: l.customer_id,
        contact: l.contact, contactId: l.contact_id,
        email: l.email, phone: l.phone, source: l.source,
        amount: Number(l.amount || 0), status: l.status,
        created_by: l.created_by, created_at: l.created_at,
        updated_by: l.updated_by, updated_at: l.updated_at,
        organization_id: l.organization_id, business_unit_id: l.business_unit_id,
      })));
    }
  };

  const fetchLeadLineItems = async (leadNumber: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('lead_line_items')
      .select('*')
      .eq('lead_number', leadNumber);
    if (error) console.error(error);
    if (!error && data && data.length > 0) {
      setLineItems(data.map((item: any) => ({
        id: item.id, product: item.product_name,
        quantity: Number(item.quantity || 1), price: Number(item.price || 0),
      })));
    } else {
      setLineItems([]);
    }
  };

  const fetchOpportunities = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    if (!error && data) {
      setOpportunities(data.map((o: any) => ({
        id: o.opportunity_number, name: o.name,
        customer: o.customer, customerId: o.customer_id,
        contact: o.contact, contactId: o.contact_id,
        stage: o.stage, amount: Number(o.amount || 0),
        closeDate: o.close_date, status: o.status,
        created_by: o.created_by, created_at: o.created_at,
        updated_by: o.updated_by, updated_at: o.updated_at,
        organization_id: o.organization_id, business_unit_id: o.business_unit_id,
      })));
    }
  };

  const fetchOpportunityLineItems = async (opportunityNumber: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('opportunity_line_items')
      .select('*')
      .eq('opportunity_number', opportunityNumber);
    if (error) console.error(error);
    if (!error && data && data.length > 0) {
      setLineItems(data.map((item: any) => ({
        id: item.id, product: item.product_name,
        quantity: Number(item.quantity || 1), price: Number(item.price || 0),
      })));
    } else {
      setLineItems([]);
    }
  };

  const fetchOrders = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    if (!error && data) {
      setOrders(data.map((o: any) => ({
        id: o.order_number, customer: o.customer, customerId: o.customer_id,
        contact: o.contact, contactId: o.contact_id, name: o.name,
        amount: Number(o.amount || 0), shippingAddress: o.shipping_address,
        deliveryDate: o.delivery_date, status: o.status,
        created_by: o.created_by, created_at: o.created_at,
        updated_by: o.updated_by, updated_at: o.updated_at,
        organization_id: o.organization_id, business_unit_id: o.business_unit_id,
      })));
    }
  };

  const fetchOrderLineItems = async (orderNumber: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('order_line_items')
      .select('*')
      .eq('order_number', orderNumber);
    if (error) console.error(error);
    if (!error && data && data.length > 0) {
      setLineItems(data.map((item: any) => ({
        id: item.id, product: item.product_name,
        quantity: Number(item.quantity || 1), price: Number(item.price || 0),
      })));
    } else {
      setLineItems([]);
    }
  };

  const fetchInvoices = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    if (!error && data) {
      setInvoices(data.map((inv: any) => ({
        id: inv.invoice_number, customer: inv.customer, customerId: inv.customer_id,
        contact: inv.contact, contactId: inv.contact_id, name: inv.name,
        amount: Number(inv.amount || 0), dueDate: inv.due_date,
        paymentTerms: inv.payment_terms, billingAddress: inv.billing_address,
        status: inv.status,
        created_by: inv.created_by, created_at: inv.created_at,
        updated_by: inv.updated_by, updated_at: inv.updated_at,
        organization_id: inv.organization_id, business_unit_id: inv.business_unit_id,
      })));
    }
  };

  const fetchInvoiceLineItems = async (invoiceNumber: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_number', invoiceNumber);
    if (error) console.error(error);
    if (!error && data && data.length > 0) {
      setLineItems(data.map((item: any) => ({
        id: item.id, product: item.product_name,
        quantity: Number(item.quantity || 1), price: Number(item.price || 0),
      })));
    } else {
      setLineItems([]);
    }
  };

  const fetchContacts = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    if (!error && data) {
      setContacts(data.map((c: any) => ({
        id: c.contact_number, customerId: c.customer_id,
        isPrimary: c.is_primary || false, customer: c.customer,
        name: c.name, email: c.email, phone: c.phone,
        designation: c.designation, department: c.department, status: c.status,
        created_by: c.created_by, created_at: c.created_at,
        updated_by: c.updated_by, updated_at: c.updated_at,
        organization_id: c.organization_id, business_unit_id: c.business_unit_id,
      })));
    }
  };

  const fetchActivities = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    if (!error && data) {
      setActivities(data.map((a: any) => ({
        id: a.activity_number, customerId: a.customer_id, contactId: a.contact_id,
        name: a.name, customer: a.customer, contact: a.contact,
        subject: a.subject, activityType: a.activity_type,
        activityDate: a.activity_date, notes: a.notes, status: a.status,
        created_by: a.created_by, created_at: a.created_at,
        updated_by: a.updated_by, updated_at: a.updated_at,
        organization_id: a.organization_id, business_unit_id: a.business_unit_id,
      })));
    }
  };

  const fetchQuoteTemplates = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('quote_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    if (!error && data) {
      setQuoteTemplates(data.map((t: any) => ({
        id: t.template_number, dbId: t.id, name: t.name,
        isDefault: t.is_default, companyName: t.company_name,
        companyEmail: t.company_email, companyPhone: t.company_phone,
        companyAddress: t.company_address, quoteTitle: t.quote_title,
        footerText: t.footer_text, termsAndConditions: t.terms_and_conditions,
        primaryColor: t.primary_color, secondaryColor: t.secondary_color,
      })));
    }
  };

  const fetchOrganizations = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setOrganizations(data);
  };

  const fetchBusinessUnits = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('business_units')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setBusinessUnits(data);
  };

  const fetchEnterpriseUsers = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('enterprise_users')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setEnterpriseUsers(data);
  };

  const fetchUserGroups = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('user_groups')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setUserGroups(data);
  };

  const fetchRoles = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('roles')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRoles(data);
  };

  const fetchPermissions = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('permissions')
      .select('*')
      .order('module_name');
    if (data) setPermissions(data);
  };

  const fetchGroupMembers = async (groupId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('user_group_members')
      .select(`id, enterprise_user_id, enterprise_users (id, first_name, last_name, email, employee_code)`)
      .eq('user_group_id', groupId);
    if (data) setUserGroupMembers(data);
  };

  const fetchRolePermissions = async (roleId: string) => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('role_permissions')
      .select(`id, permission_id, permissions (id, permission_name, permission_code, module_name)`)
      .eq('role_id', roleId);
    if (error) { console.error(error); return []; }
    if (data) setRolePermissions(data);
    return data || [];
  };

  const fetchCurrentUser = async () => {
    if (!supabase || !session?.user?.email) return;
    const { data, error } = await supabase
      .from('enterprise_users')
      .select('*')
      .eq('email', session.user.email)
      .single();
    if (data && !error) {
      setCurrentUser(data);
      setProfileFormData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone || '',
        designation: data.designation || '',
      });
    }
  };

  const loadCurrentUserPermissions = async () => {
    if (!supabase || !session?.user?.email) return;
    setPermissionsLoaded(false);
    const { data: userData } = await supabase
      .from('enterprise_users')
      .select(`*, roles (id, role_name)`)
      .eq('email', session.user.email)
      .single();

    if (!userData || !userData.role_id) {
      setCurrentUserPermissions([]);
      setPermissionsLoaded(true);
      return;
    }

    const { data: rolePermissionData } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', userData.role_id);

    const permissionIds = (rolePermissionData || []).map((item: any) => item.permission_id);

    if (permissionIds.length === 0) {
      setCurrentUserPermissions([]);
      setPermissionsLoaded(true);
      return;
    }

    const { data: permissionsData } = await supabase
      .from('permissions')
      .select('permission_code')
      .in('id', permissionIds);

    setCurrentUserPermissions((permissionsData || []).map((item: any) => item.permission_code));
    setPermissionsLoaded(true);
  };

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  // ✅ OPTIMIZED: All fetches run in parallel instead of sequentially
  useEffect(() => {
    if (!session?.user?.id) return;
    Promise.all([
      fetchCurrentUser(),
      fetchCustomers(),
      fetchProducts(),
      fetchLeads(),
      fetchOpportunities(),
      fetchOrders(),
      fetchInvoices(),
      fetchContacts(),
      fetchActivities(),
      fetchQuoteTemplates(),
      fetchOrganizations(),
      fetchBusinessUnits(),
      fetchEnterpriseUsers(),
      fetchUserGroups(),
      fetchRoles(),
      fetchPermissions(),
    ]);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.email) return;
    loadCurrentUserPermissions();
  }, [session?.user?.email, currentUser?.role_id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navigatorRef.current && !navigatorRef.current.contains(event.target as Node)) {
        setSidebarCollapsed(true);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Auth handlers ────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email, password: loginForm.password,
    });
    if (error) alert(error.message);
  };

  const handleLogout = async () => {
    if (!supabase) return;
    setCurrentUser(null);
    setCurrentUserPermissions([]);
    setPermissionsLoaded(false);
    await supabase.auth.signOut();
  };

  // ─── Profile handlers ────────────────────────────────────────────────────

  const resetMyPassword = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) { alert('Password Updated'); setNewPassword(''); }
  };

  const saveMyProfile = async () => {
    if (!supabase || !currentUser) return;
    const { error } = await supabase
      .from('enterprise_users')
      .update({
        first_name: profileFormData.first_name,
        last_name: profileFormData.last_name,
        phone: profileFormData.phone,
      })
      .eq('id', currentUser.id);
    if (!error) {
      await fetchCurrentUser();
      await fetchEnterpriseUsers();
      alert('Profile Updated');
    }
  };

  // ─── Admin CRUD ───────────────────────────────────────────────────────────

  const saveOrganization = async () => {
    if (!supabase) return;
    if (adminModalMode === 'editOrganization') {
      await supabase.from('organizations').update({ ...organizationFormData }).eq('id', selectedAdminRecord.id);
    } else {
      await supabase.from('organizations').insert([{ ...organizationFormData }]);
    }
    setAdminModalMode('');
    setSelectedAdminRecord(null);
    setOrganizationFormData({ name: '', organization_code: '', status: 'Active', industry: '', website: '', country: '', timezone: '', currency: '' });
    setOrganizationFormOpen(false);
    fetchOrganizations();
  };

  const saveBusinessUnit = async () => {
    if (!supabase) return;
    if (adminModalMode === 'editBusinessUnit') {
      const { error } = await supabase.from('business_units').update({ ...businessUnitFormData }).eq('id', selectedAdminRecord.id);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase.from('business_units').insert([{ ...businessUnitFormData }]).select();
      if (error) { alert(error.message); return; }
    }
    setAdminModalMode('');
    setSelectedAdminRecord(null);
    setBusinessUnitFormData({ name: '', business_unit_code: '', organization_id: '', description: '', status: 'Active' });
    setBusinessUnitFormOpen(false);
    fetchBusinessUnits();
  };

  const saveEnterpriseUser = async () => {
    if (!supabase) return;
    if (adminModalMode === 'editUser') {
      await supabase.from('enterprise_users').update({
        employee_code: userFormData.employee_code,
        username: userFormData.username,
        first_name: userFormData.first_name,
        last_name: userFormData.last_name,
        email: userFormData.email,
        phone: userFormData.phone,
        designation: userFormData.designation,
        organization_id: userFormData.organization_id,
        business_unit_id: userFormData.business_unit_id,
        role_id: userFormData.role_id,
        status: userFormData.status,
      }).eq('id', selectedAdminRecord.id);
    } else {
      await supabase.from('enterprise_users').insert([{ ...userFormData }]);
    }
    setAdminModalMode('');
    setSelectedAdminRecord(null);
    setUserFormData({
      employee_code: '', username: '', first_name: '', last_name: '',
      email: '', temporary_password: '', phone: '', designation: '',
      organization_id: '', business_unit_id: '', role_id: '', status: 'Active',
    });
    setUserFormOpen(false);
    fetchEnterpriseUsers();
  };

  const saveUserGroup = async () => {
    if (!supabase) return;
    if (adminModalMode === 'editUserGroup') {
      await supabase.from('user_groups').update({ ...userGroupFormData }).eq('id', selectedAdminRecord.id);
    } else {
      await supabase.from('user_groups').insert([{ ...userGroupFormData }]);
    }
    setAdminModalMode('');
    setSelectedAdminRecord(null);
    setUserGroupFormData({ group_name: '', group_code: '', description: '', organization_id: '', business_unit_id: '', status: 'Active' });
    setUserGroupFormOpen(false);
    fetchUserGroups();
  };

  const saveRole = async () => {
    if (!supabase) return;
    let roleId = '';
    if (adminModalMode === 'editRole') {
      const { error } = await supabase.from('roles').update({
        role_name: roleFormData.role_name.trim(),
        role_code: roleFormData.role_code.trim(),
        description: roleFormData.description.trim(),
        status: roleFormData.status,
      }).eq('id', selectedAdminRecord.id);
      if (error) { console.error(error); alert('Failed to update role'); return; }
      roleId = selectedAdminRecord.id;
    } else {
      const { data, error } = await supabase.from('roles').insert([{
        role_name: roleFormData.role_name.trim(),
        role_code: roleFormData.role_code.trim(),
        description: roleFormData.description.trim(),
        status: roleFormData.status,
      }]).select().single();
      if (error || !data) { console.error(error); alert(error?.message || 'Unable to create role'); return; }
      roleId = data.id;
    }
    await supabase.from('role_permissions').delete().eq('role_id', roleId);
    if (selectedRolePermissions.length) {
      await supabase.from('role_permissions').insert(
        selectedRolePermissions.map((permissionId: any) => ({ role_id: roleId, permission_id: permissionId }))
      );
    }
    setRoleFormData({ role_name: '', role_code: '', description: '', status: 'Active' });
    setSelectedRolePermissions([]);
    setRoleFormOpen(false);
    setAdminModalMode('');
    setSelectedAdminRecord(null);
    fetchRoles();
  };

  const addUsersToGroup = async () => {
    if (!selectedAdminRecord || !supabase) return;
    const existingUserIds = userGroupMembers.map((m) => m.enterprise_user_id);
    const filteredUsers = selectedGroupUsers.filter((uid) => !existingUserIds.includes(uid));
    const payload = filteredUsers.map((uid) => ({ user_group_id: selectedAdminRecord.id, enterprise_user_id: uid }));
    await supabase.from('user_group_members').insert(payload);
    setSelectedGroupUsers([]);
    fetchGroupMembers(selectedAdminRecord.id);
  };

  const removeUserFromGroup = async (membershipId: string) => {
    if (!supabase) return;
    await supabase.from('user_group_members').delete().eq('id', membershipId);
    fetchGroupMembers(selectedAdminRecord.id);
  };

  const deleteAdminRecord = async (table: string, id: string) => {
    if (!supabase) return;
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) {
      if (table === 'organizations') fetchOrganizations();
      if (table === 'business_units') fetchBusinessUnits();
      if (table === 'enterprise_users') fetchEnterpriseUsers();
      if (table === 'user_groups') fetchUserGroups();
    }
  };

  const updateAdminStatus = async (table: string, id: string, status: string) => {
    if (!supabase) return;
    const { error } = await supabase.from(table).update({ status }).eq('id', id);
    if (!error) {
      if (table === 'organizations') fetchOrganizations();
      if (table === 'business_units') fetchBusinessUnits();
      if (table === 'enterprise_users') fetchEnterpriseUsers();
      if (table === 'user_groups') fetchUserGroups();
    }
  };

  // ─── CRM helpers ─────────────────────────────────────────────────────────

  const getStatusOptions = () => {
    switch (activePage) {
      case 'customers':     return ['Active', 'Inactive', 'Prospect'];
      case 'products':      return ['Active', 'Inactive', 'Discontinued'];
      case 'leads':         return ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];
      case 'opportunities': return ['Open', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'];
      case 'orders':        return ['Draft', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
      case 'invoices':      return ['Draft', 'Pending', 'Paid', 'Overdue', 'Cancelled'];
      default:              return ['New', 'Active'];
    }
  };

  const getObjectFields = () => {
    switch (activePage) {
      case 'customers':     return ['name','email','phone','company','industry','billingAddress','shippingAddress','city','state','postalCode','country','website','gstNumber','primaryContact','status'];
      case 'products':      return ['name','category','price','status'];
      case 'leads':         return ['leadNumber','customer','contact','name','email','phone','source','status','amount'];
      case 'opportunities': return ['customer','contact','name','stage','closeDate','status','amount'];
      case 'orders':        return ['customer','contact','name','shippingAddress','deliveryDate','status','amount'];
      case 'invoices':      return ['customer','contact','name','dueDate','paymentTerms','billingAddress','status','amount'];
      case 'contacts':      return ['customer','name','email','phone','designation','department','isPrimary','status'];
      case 'activities':    return ['name','customer','contact','subject','activityType','activityDate','notes','status'];
      default:              return ['name','status'];
    }
  };

  const getCurrentData = () => {
    switch (activePage) {
      case 'customers':     return customers;
      case 'products':      return products;
      case 'leads':         return leads;
      case 'opportunities': return opportunities;
      case 'orders':        return orders;
      case 'invoices':      return invoices;
      case 'contacts':      return contacts;
      case 'activities':    return activities;
      default:              return [];
    }
  };

  // ✅ OPTIMIZED: memoized — recalculates only when inputs change
  const filteredData = useMemo(() => {
    let data: any[] = getCurrentData();
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      data = data.filter((record: any) =>
        String(record.name || '').toLowerCase().includes(lowerSearch) ||
        String(record.id || '').toLowerCase().includes(lowerSearch) ||
        String(record.customer || '').toLowerCase().includes(lowerSearch)
      );
    }
    if (statusFilter !== 'All') {
      data = data.filter((record: any) => record.status === statusFilter);
    }
    return data;
  }, [activePage, customers, products, leads, opportunities, orders, invoices, contacts, activities, searchTerm, statusFilter]);

  // ─── Details panel ────────────────────────────────────────────────────────

  const openDetailsPage = async (record: any) => {
    setSelectedRecord(record);
    setDetailsTab('details');
    setEditedRecord(record);
    if (activePage === 'leads')              await fetchLeadLineItems(record.id);
    else if (activePage === 'opportunities') await fetchOpportunityLineItems(record.id);
    else if (activePage === 'orders')        await fetchOrderLineItems(record.id);
    else if (activePage === 'invoices')      await fetchInvoiceLineItems(record.id);
    else                                     setLineItems([]);
    setOpenActionMenu(null);
  };

  // ─── AI query ─────────────────────────────────────────────────────────────

  const handleAIQuery = (query: string) => {
    const q = query.toLowerCase();
    let response = 'I could not find relevant CRM insights for your request.';
    if (q.includes('revenue')) {
      const revenue = invoices.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
      response = `Total revenue generated is ${formatCurrency(revenue)} from ${invoices.length} invoice(s).`;
    } else if (q.includes('qualified') || q.includes('lead')) {
      const qualified = leads.filter((l: any) => l.status === 'Qualified').length;
      const converted = leads.filter((l: any) => l.status === 'Converted').length;
      response = `There are ${qualified} qualified lead(s) and ${converted} converted lead(s) in the CRM.`;
    } else if (q.includes('invoice') || q.includes('order')) {
      const pending = invoices.filter((inv: any) => inv.status === 'Pending').length;
      const processing = orders.filter((o: any) => o.status === 'Processing').length;
      response = `There are ${pending} pending invoice(s) and ${processing} processing order(s).`;
    } else if (q.includes('opportunit')) {
      const total = opportunities.reduce((sum: number, o: any) => sum + (o.amount || 0), 0);
      response = `There are ${opportunities.length} opportunity record(s) with estimated pipeline value of ${formatCurrency(total)}.`;
    } else if (q.includes('customer')) {
      response = `There are ${customers.length} active customer record(s) currently managed in CRM.`;
    }
    setAiMessages((prev) => [
      ...prev,
      { type: 'user', text: query },
      { type: 'assistant', text: response },
    ]);
  };

  // ─── Create records ───────────────────────────────────────────────────────

  const createNewRecord = async () => {
    if (activePage === 'customers') {
      if (!supabase) return;
      const { error } = await supabase.from('customers').insert([{
        ...buildSystemFields(),
        customer_number: `CUST-${Date.now()}`,
        name: createFormData.name,
        company: createFormData.company,
        industry: createFormData.industry,
        email: createFormData.email,
        phone: createFormData.phone,
        website: createFormData.website,
        billing_address: createFormData.billingAddress,
        shipping_address: createFormData.shippingAddress,
        city: createFormData.city,
        state: createFormData.state,
        postal_code: createFormData.postalCode,
        country: createFormData.country,
        gst_number: createFormData.gstNumber,
        status: createFormData.status || 'Active',
      }]);
      if (error) { console.error(error); return; }
      await fetchCustomers();
      setCreateModalOpen(false); setCreateFormData({}); return;
    }

    if (activePage === 'products') {
      if (!supabase) return;
      const { error } = await supabase.from('products').insert([{
        ...buildSystemFields(),
        product_number: `PROD-${Date.now()}`,
        name: createFormData.name,
        category: createFormData.category,
        price: Number(createFormData.price || 0),
        status: createFormData.status || 'Active',
      }]);
      if (error) { console.error(error); return; }
      await fetchProducts();
      setCreateModalOpen(false); setCreateFormData({}); return;
    }

    if (activePage === 'leads') {
      if (!supabase) return;
      if (!currentUser) { alert('User profile not loaded yet. Please wait and try again.'); return; }
      const leadNumber = `LEAD-${Date.now()}`;
      const { error } = await supabase.from('leads').insert([{
        ...buildSystemFields(),
        lead_number: leadNumber,
        name: createFormData.name,
        customer: createFormData.customer,
        customer_id: createFormData.customerId,
        contact: createFormData.contact,
        contact_id: createFormData.contactId,
        email: createFormData.email,
        phone: createFormData.phone,
        source: createFormData.source,
        amount: Number(createFormData.amount || 0),
        status: createFormData.status || 'New',
      }]);
      if (error) { console.error(error); alert(`Failed to create lead: ${error.message}`); return; }
      if (lineItems.length > 0) {
        await supabase.from('lead_line_items').insert(
          lineItems.map((item: any) => ({ lead_number: leadNumber, product_name: item.product, quantity: item.quantity, price: item.price }))
        );
      }
      await fetchLeads();
      setLineItems([]); setCreateModalOpen(false); setCreateFormData({}); return;
    }

    if (activePage === 'opportunities') {
      if (!supabase) return;
      if (!currentUser) { alert('User profile not loaded yet. Please wait and try again.'); return; }
      const opportunityNumber = `OPP-${Date.now()}`;
      const { error } = await supabase.from('opportunities').insert([{
        ...buildSystemFields(),
        opportunity_number: opportunityNumber,
        name: createFormData.name,
        customer: createFormData.customer,
        customer_id: createFormData.customerId,
        contact: createFormData.contact,
        contact_id: createFormData.contactId,
        stage: createFormData.stage || 'Qualification',
        amount: Number(createFormData.amount || 0),
        close_date: createFormData.closeDate || null,
        status: createFormData.status || 'Open',
      }]);
      if (error) { console.error(error); alert(`Failed to create opportunity: ${error.message}`); return; }
      if (lineItems.length > 0) {
        await supabase.from('opportunity_line_items').insert(
          lineItems.map((item: any) => ({ opportunity_number: opportunityNumber, product_name: item.product, quantity: item.quantity, price: item.price }))
        );
      }
      await fetchOpportunities();
      setLineItems([]); setCreateModalOpen(false); setCreateFormData({}); return;
    }

    if (activePage === 'orders') {
      if (!supabase) return;
      if (!currentUser) { alert('User profile not loaded yet. Please wait and try again.'); return; }
      const orderNumber = `ORD-${Date.now()}`;
      const calculatedAmount = lineItems.reduce((sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0);
      const { error } = await supabase.from('orders').insert([{
        ...buildSystemFields(),
        order_number: orderNumber,
        customer: createFormData.customer,
        customer_id: createFormData.customerId,
        contact: createFormData.contact,
        contact_id: createFormData.contactId,
        name: createFormData.name,
        amount: calculatedAmount,
        shipping_address: createFormData.shippingAddressOrder || '',
        delivery_date: createFormData.deliveryDate || null,
        status: createFormData.status || 'Processing',
      }]);
      if (error) { console.error(error); alert(`Failed to create order: ${error.message}`); return; }
      if (lineItems.length > 0) {
        await supabase.from('order_line_items').insert(
          lineItems.map((item: any) => ({ order_number: orderNumber, product_name: item.product, quantity: item.quantity, price: item.price }))
        );
      }
      await fetchOrders();
      setLineItems([]); setCreateModalOpen(false); setCreateFormData({}); return;
    }

    if (activePage === 'invoices') {
      if (!supabase) return;
      if (!currentUser) { alert('User profile not loaded yet. Please wait and try again.'); return; }
      const invoiceNumber = `INV-${Date.now()}`;
      const calculatedAmount = lineItems.reduce((sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0);
      const { error } = await supabase.from('invoices').insert([{
        ...buildSystemFields(),
        invoice_number: invoiceNumber,
        customer: createFormData.customer,
        customer_id: createFormData.customerId,
        contact: createFormData.contact,
        contact_id: createFormData.contactId,
        name: createFormData.name,
        amount: calculatedAmount,
        due_date: createFormData.dueDate || null,
        payment_terms: createFormData.paymentTerms || '',
        billing_address: createFormData.billingAddressInvoice || createFormData.billingAddress || '',
        status: createFormData.status || 'Pending',
      }]);
      if (error) { console.error(error); alert(`Failed to create invoice: ${error.message}`); return; }
      if (lineItems.length > 0) {
        await supabase.from('invoice_line_items').insert(
          lineItems.map((item: any) => ({ invoice_number: invoiceNumber, product_name: item.product, quantity: item.quantity, price: item.price }))
        );
      }
      await fetchInvoices();
      setLineItems([]); setCreateModalOpen(false); setCreateFormData({}); return;
    }

    if (activePage === 'contacts') {
      if (!supabase) return;
      const contactNumber = `CONT-${Date.now()}`;
      const { error } = await supabase.from('contacts').insert([{
        ...buildSystemFields(),
        contact_number: contactNumber,
        customer: createFormData.customer,
        customer_id: createFormData.customerId,
        name: createFormData.name,
        email: createFormData.email,
        phone: createFormData.phone,
        designation: createFormData.designation,
        department: createFormData.department,
        status: createFormData.status || 'Active',
      }]);
      if (error) { console.error(error); return; }
      await fetchContacts();
      setCreateModalOpen(false); setCreateFormData({}); return;
    }

    if (activePage === 'activities') {
      if (!supabase) return;
      const activityNumber = `ACT-${Date.now()}`;
      const { error } = await supabase.from('activities').insert([{
        ...buildSystemFields(),
        activity_number: activityNumber,
        name: createFormData.name,
        customer: createFormData.customer,
        customer_id: createFormData.customerId,
        contact: createFormData.contact,
        contact_id: createFormData.contactId,
        subject: createFormData.subject,
        activity_type: createFormData.activityType,
        activity_date: createFormData.activityDate,
        notes: createFormData.notes,
        status: createFormData.status || 'Open',
      }]);
      if (error) { console.error(error); return; }
      await fetchActivities();
      setCreateModalOpen(false); setCreateFormData({}); return;
    }
  };

  // ─── Save record changes ──────────────────────────────────────────────────

  const saveRecordChanges = async () => {
    const calculatedAmount = lineItems.reduce(
      (sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0
    );
    if (activePage === 'leads' || activePage === 'opportunities') {
      editedRecord.amount = calculatedAmount;
    }

    if (activePage === 'leads') {
      setLeads((prev: any) => prev.map((item: any) => item.id === editedRecord.id ? editedRecord : item));
      if (supabase && editedRecord.id) {
        await supabase.from('leads').update({
          ...buildSystemFields(true), name: editedRecord.name,
          customer: editedRecord.customer, email: editedRecord.email,
          phone: editedRecord.phone, source: editedRecord.source,
          amount: Number(editedRecord.amount || 0), status: editedRecord.status,
        }).eq('lead_number', editedRecord.id);
        await supabase.from('lead_line_items').delete().eq('lead_number', editedRecord.id);
        if (lineItems.length > 0) {
          await supabase.from('lead_line_items').insert(
            lineItems.map((item: any) => ({ lead_number: editedRecord.id, product_name: item.product, quantity: item.quantity, price: item.price }))
          );
        }
      }
    } else if (activePage === 'opportunities') {
      setOpportunities((prev: any) => prev.map((item: any) => item.id === editedRecord.id ? editedRecord : item));
      if (supabase && editedRecord.id) {
        await supabase.from('opportunities').update({
          ...buildSystemFields(true), name: editedRecord.name,
          customer: editedRecord.customer, stage: editedRecord.stage,
          amount: Number(editedRecord.amount || 0), close_date: editedRecord.closeDate,
          status: editedRecord.status,
        }).eq('opportunity_number', editedRecord.id);
        await supabase.from('opportunity_line_items').delete().eq('opportunity_number', editedRecord.id);
        if (lineItems.length > 0) {
          await supabase.from('opportunity_line_items').insert(
            lineItems.map((item: any) => ({ opportunity_number: editedRecord.id, product_name: item.product, quantity: item.quantity, price: item.price }))
          );
        }
      }
    } else if (activePage === 'customers') {
      setCustomers((prev: any) => prev.map((item: any) => item.id === editedRecord.id ? editedRecord : item));
      if (editedRecord.primaryContactId) {
        setContacts((prev: any) => prev.map((contact: any) => {
          if (contact.customerId === editedRecord.id) {
            return { ...contact, isPrimary: contact.id === editedRecord.primaryContactId, customer: editedRecord.name };
          }
          return contact;
        }));
        if (supabase) {
          await supabase.from('contacts').update({ is_primary: false }).eq('customer_id', editedRecord.id);
          await supabase.from('contacts').update({ is_primary: true }).eq('contact_number', editedRecord.primaryContactId);
        }
        const selectedPrimaryContact = contacts.find((c: any) => c.id === editedRecord.primaryContactId);
        setCustomers((prev: any) => prev.map((customer: any) =>
          customer.id === editedRecord.id
            ? { ...customer, primaryContactId: editedRecord.primaryContactId, primaryContact: selectedPrimaryContact?.name || '' }
            : customer
        ));
      }
      if (supabase && editedRecord.id) {
        await supabase.from('customers').update({
          ...buildSystemFields(true), name: editedRecord.name,
          email: editedRecord.email, phone: editedRecord.phone,
          company: editedRecord.company, industry: editedRecord.industry,
          primary_contact_id: editedRecord.primaryContactId,
          billing_address: editedRecord.billingAddress, shipping_address: editedRecord.shippingAddress,
          city: editedRecord.city, state: editedRecord.state,
          postal_code: editedRecord.postalCode, country: editedRecord.country,
          website: editedRecord.website, gst_number: editedRecord.gstNumber,
          status: editedRecord.status,
        }).eq('customer_number', editedRecord.id);
      }
    } else if (activePage === 'contacts') {
      setContacts((prev: any) => prev.map((item: any) => item.id === editedRecord.id ? editedRecord : item));
      if (editedRecord.isPrimary && editedRecord.customerId) {
        const existingPrimary = contacts.find((c: any) =>
          c.customerId === editedRecord.customerId && c.isPrimary && c.id !== editedRecord.id
        );
        if (existingPrimary) {
          if (!window.confirm(`This customer already has a primary contact (${existingPrimary.name}). Replace it?`)) return;
          setContacts((prev: any) => prev.map((contact: any) =>
            contact.id === existingPrimary.id ? { ...contact, isPrimary: false } : contact
          ));
          if (supabase) await supabase.from('contacts').update({ is_primary: false }).eq('contact_number', existingPrimary.id);
        }
      }
      if (supabase) {
        await supabase.from('customers').update({ primary_contact_id: editedRecord.id }).eq('customer_number', editedRecord.customerId);
      }
      setCustomers((prev: any) => prev.map((customer: any) =>
        customer.id === editedRecord.customerId
          ? { ...customer, primaryContactId: editedRecord.id, primaryContact: editedRecord.name }
          : customer
      ));
      if (!editedRecord.isPrimary && editedRecord.customerId) {
        const customer = customers.find((c: any) => c.id === editedRecord.customerId);
        if (customer?.primaryContactId === editedRecord.id && supabase) {
          await supabase.from('customers').update({ primary_contact_id: null }).eq('customer_number', editedRecord.customerId);
        }
      }
      if (supabase && editedRecord.id) {
        await supabase.from('contacts').update({
          ...buildSystemFields(true), customer: editedRecord.customer,
          name: editedRecord.name, email: editedRecord.email,
          phone: editedRecord.phone, designation: editedRecord.designation,
          department: editedRecord.department, status: editedRecord.status,
        }).eq('contact_number', editedRecord.id);
      }
    } else if (activePage === 'activities') {
      setActivities((prev: any) => prev.map((item: any) => item.id === editedRecord.id ? editedRecord : item));
      if (supabase && editedRecord.id) {
        await supabase.from('activities').update({
          ...buildSystemFields(true), name: editedRecord.name,
          customer: editedRecord.customer, contact: editedRecord.contact,
          subject: editedRecord.subject, activity_type: editedRecord.activityType,
          activity_date: editedRecord.activityDate, notes: editedRecord.notes,
          status: editedRecord.status,
        }).eq('activity_number', editedRecord.id);
      }
    } else if (activePage === 'products') {
      setProducts((prev: any) => prev.map((item: any) => item.id === editedRecord.id ? editedRecord : item));
      if (supabase && editedRecord.id) {
        await supabase.from('products').update({
          ...buildSystemFields(true), name: editedRecord.name,
          category: editedRecord.category, price: Number(editedRecord.price || 0),
          status: editedRecord.status,
        }).eq('product_number', editedRecord.id);
      }
      setSelectedRecord(editedRecord); setEditedRecord(editedRecord);
    } else if (activePage === 'orders') {
      const updatedOrder = { ...editedRecord, amount: calculatedAmount };
      setOrders((prev: any) => prev.map((item: any) => item.id === updatedOrder.id ? updatedOrder : item));
      if (supabase && updatedOrder.id) {
        await supabase.from('orders').update({
          ...buildSystemFields(true), customer: updatedOrder.customer,
          name: updatedOrder.name, amount: Number(updatedOrder.amount || 0),
          shipping_address: updatedOrder.shippingAddress, delivery_date: updatedOrder.deliveryDate,
          status: updatedOrder.status,
        }).eq('order_number', updatedOrder.id);
        await supabase.from('order_line_items').delete().eq('order_number', updatedOrder.id);
        if (lineItems.length > 0) {
          await supabase.from('order_line_items').insert(
            lineItems.map((item: any) => ({ order_number: updatedOrder.id, product_name: item.product, quantity: item.quantity, price: item.price }))
          );
        }
      }
      setSelectedRecord(updatedOrder); setEditedRecord(updatedOrder);
    } else if (activePage === 'invoices') {
      const updatedInvoice = { ...editedRecord, amount: calculatedAmount };
      setInvoices((prev: any) => prev.map((item: any) => item.id === updatedInvoice.id ? updatedInvoice : item));
      if (supabase && updatedInvoice.id) {
        await supabase.from('invoices').update({
          ...buildSystemFields(true), customer: updatedInvoice.customer,
          name: updatedInvoice.name, amount: Number(updatedInvoice.amount || 0),
          due_date: updatedInvoice.dueDate, payment_terms: updatedInvoice.paymentTerms,
          billing_address: updatedInvoice.billingAddress, status: updatedInvoice.status,
        }).eq('invoice_number', updatedInvoice.id);
        await supabase.from('invoice_line_items').delete().eq('invoice_number', updatedInvoice.id);
        if (lineItems.length > 0) {
          await supabase.from('invoice_line_items').insert(
            lineItems.map((item: any) => ({ invoice_number: updatedInvoice.id, product_name: item.product, quantity: item.quantity, price: item.price }))
          );
        }
      }
      setSelectedRecord(updatedInvoice); setEditedRecord(updatedInvoice);
    }

    if (activePage !== 'orders' && activePage !== 'invoices' && activePage !== 'products') {
      setSelectedRecord(editedRecord);
    }
  };

  // ─── Pipeline actions ─────────────────────────────────────────────────────

  const convertLeadToOpportunity = async (lead: any) => {
    if (supabase) await supabase.from('leads').update({ status: 'Converted' }).eq('lead_number', lead.id);
    setLeads((prev: any) => prev.map((item: any) => item.id === lead.id ? { ...item, status: 'Converted' } : item));

    let leadItems: any[] = [];
    if (supabase) {
      const { data } = await supabase.from('lead_line_items').select('*').eq('lead_number', lead.id);
      leadItems = data?.map((item: any) => ({ product: item.product_name, quantity: item.quantity, price: item.price })) || [];
    }
    const totalAmount = leadItems.reduce((sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0);

    const newOpportunity = {
      id: `OPP-${Date.now()}`, name: lead.name,
      customer: lead.customer, customerId: lead.customerId,
      contact: lead.contact, contactId: lead.contactId,
      stage: 'Qualification', closeDate: '', status: 'Open',
      amount: totalAmount, email: lead.email, phone: lead.phone, source: lead.source,
    };

    if (supabase) {
      await supabase.from('opportunities').insert([{
        ...buildSystemFields(),
        opportunity_number: newOpportunity.id, name: newOpportunity.name,
        customer: newOpportunity.customer, customer_id: newOpportunity.customerId,
        contact: newOpportunity.contact, contact_id: newOpportunity.contactId,
        stage: newOpportunity.stage, amount: Number(newOpportunity.amount || 0),
        close_date: null, status: newOpportunity.status,
      }]);
      if (leadItems.length > 0) {
        await supabase.from('opportunity_line_items').insert(
          leadItems.map((item: any) => ({ opportunity_number: newOpportunity.id, product_name: item.product, quantity: item.quantity, price: item.price }))
        );
      }
    }
    setOpportunities((prev: any) => [...prev, newOpportunity]);
    setOpenActionMenu(null);
  };

  const createOrderFromOpportunity = async (opportunity: any) => {
    setOpportunities((prev: any) => prev.map((item: any) => item.id === opportunity.id ? { ...item, status: 'Closed Won' } : item));
    let opportunityItems: any[] = [];
    if (supabase) {
      await supabase.from('opportunities').update({ status: 'Closed Won', ...buildSystemFields(true) }).eq('opportunity_number', opportunity.id);
      const { data } = await supabase.from('opportunity_line_items').select('*').eq('opportunity_number', opportunity.id);
      opportunityItems = data?.map((item: any) => ({ product: item.product_name, quantity: item.quantity, price: item.price })) || [];
    }
    const totalAmount = opportunityItems.reduce((sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0);
    const newOrder = {
      id: `ORD-${Date.now()}`, customer: opportunity.customer, customerId: opportunity.customerId,
      contact: opportunity.contact, contactId: opportunity.contactId,
      name: opportunity.name, status: 'Processing', amount: totalAmount,
      shippingAddress: '', deliveryDate: '',
    };
    if (supabase) {
      await supabase.from('orders').insert([{
        ...buildSystemFields(), order_number: newOrder.id,
        customer: newOrder.customer, customer_id: newOrder.customerId,
        contact: newOrder.contact, contact_id: newOrder.contactId,
        name: newOrder.name, amount: Number(newOrder.amount || 0),
        shipping_address: '', delivery_date: '', status: newOrder.status,
      }]);
      if (opportunityItems.length > 0) {
        await supabase.from('order_line_items').insert(
          opportunityItems.map((item: any) => ({ order_number: newOrder.id, product_name: item.product, quantity: item.quantity, price: item.price }))
        );
      }
    }
    setOrders((prev: any) => [...prev, newOrder]);
    setOpenActionMenu(null);
  };

  const createQuoteFromOpportunity = async (opportunity: any) => {
    let opportunityItems: any[] = [];
    if (supabase) {
      const { data } = await supabase.from('opportunity_line_items').select('*').eq('opportunity_number', opportunity.id);
      opportunityItems = data?.map((item: any) => ({ product: item.product_name, quantity: item.quantity, price: item.price })) || [];
    }
    const defaultTemplate = quoteTemplates.find((t: any) => t.isDefault) || quoteTemplates[0];
    setSelectedQuoteOpportunity(opportunity);
    setSelectedQuoteTemplate(defaultTemplate);
    setQuoteLineItems(opportunityItems);
    setQuotePreviewOpen(true);
    setOpenActionMenu(null);
  };

  const downloadQuotePDF = async () => {
    try {
      if (!printableQuoteRef.current) return;
      const canvas = await html2canvas(printableQuoteRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${selectedQuoteOpportunity?.name || 'Quote'}.pdf`);
    } catch (error) {
      console.error(error);
      alert('Failed to generate PDF');
    }
  };

  const createInvoiceFromOrder = async (order: any) => {
    setOrders((prev: any) => prev.map((item: any) => item.id === order.id ? { ...item, status: 'Delivered' } : item));
    let orderItems: any[] = [];
    if (supabase) {
      await supabase.from('orders').update({ status: 'Delivered', ...buildSystemFields(true) }).eq('order_number', order.id);
      const { data } = await supabase.from('order_line_items').select('*').eq('order_number', order.id);
      orderItems = data?.map((item: any) => ({ product: item.product_name, quantity: item.quantity, price: item.price })) || [];
    }
    const totalAmount = orderItems.reduce((sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0);
    const newInvoice = {
      id: `INV-${Date.now()}`, customer: order.customer, customerId: order.customerId,
      contact: order.contact, contactId: order.contactId,
      name: order.name, status: 'Pending', amount: totalAmount,
      dueDate: '', paymentTerms: '', billingAddress: '',
    };
    if (supabase) {
      await supabase.from('invoices').insert([{
        ...buildSystemFields(), invoice_number: newInvoice.id,
        customer: newInvoice.customer, customer_id: newInvoice.customerId,
        contact: newInvoice.contact, contact_id: newInvoice.contactId,
        name: newInvoice.name, amount: Number(newInvoice.amount || 0),
        due_date: '', payment_terms: '', billing_address: '', status: newInvoice.status,
      }]);
      if (orderItems.length > 0) {
        await supabase.from('invoice_line_items').insert(
          orderItems.map((item: any) => ({ invoice_number: newInvoice.id, product_name: item.product, quantity: item.quantity, price: item.price }))
        );
      }
    }
    setInvoices((prev: any) => [...prev, newInvoice]);
    setOpenActionMenu(null);
  };

  // ─── Early returns (auth gates) ───────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-blue-900 to-blue-950 text-white text-3xl font-bold">
        Loading Business Pro ERP...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-blue-900 to-blue-950 p-8">
        <div className="w-full max-w-md bg-white rounded-[36px] shadow-2xl p-10">
          <div className="text-center mb-10">
            <div className="w-24 h-24 mx-auto rounded-[32px] bg-gradient-to-br from-[#0F172A] to-blue-800 text-white flex items-center justify-center text-4xl font-bold shadow-xl">BP</div>
            <h1 className="mt-6 text-4xl font-bold text-[#0F172A]">Business Pro</h1>
            <p className="text-gray-500 mt-3">Enterprise CRM Platform</p>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-2">Email</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                className="w-full border border-blue-200 rounded-2xl px-5 py-4 bg-white text-[#0F172A] placeholder:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-2">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full border border-blue-200 rounded-2xl px-5 py-4 bg-white text-[#0F172A] placeholder:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-[#0F172A] to-blue-800 hover:opacity-90 text-white py-4 rounded-2xl font-semibold text-lg shadow-lg transition-all"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main app render ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen overflow-auto bg-gradient-to-br from-white via-blue-50 to-blue-100">
      <div style={{ transform: 'scale(0.8)', transformOrigin: 'top left', width: '125%', minHeight: '125vh' }} className="flex">

        {/* SIDEBAR */}
        <aside
          ref={navigatorRef}
          className={`${sidebarCollapsed ? 'w-24' : 'w-72'} bg-[#0F172A] text-white transition-all duration-300 min-h-screen sticky top-0 shadow-2xl`}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-8">
              {!sidebarCollapsed && <h2 className="text-2xl font-bold">Navigator</h2>}
            </div>
            <div className="space-y-3">
              {navigationItems.map((item) => {
                if (item.permission && permissionsLoaded && !currentUserPermissions.includes(item.permission)) return null;
                if (item.key === 'adminTools') {
                  if (!permissionsLoaded) {
                    return (
                      <button key={item.key} onClick={() => { setActivePage(item.key); setSidebarCollapsed(true); }}
                        className={`w-full flex items-center rounded-2xl transition-all duration-200 py-3 px-4 ${activePage === item.key ? 'bg-white text-[#0F172A]' : 'bg-white/10 text-white hover:bg-blue-700'}`}>
                        <span className="text-xl">{item.icon}</span>
                        {!sidebarCollapsed && <span className="ml-3 font-medium">{item.label}</span>}
                      </button>
                    );
                  }
                  if (currentUser?.role_id && !currentUserPermissions.includes('admin_tools_view')) return null;
                }
                return (
                  <button key={item.key} onClick={() => { setActivePage(item.key); setSidebarCollapsed(true); }}
                    className={`w-full flex items-center rounded-2xl transition-all duration-200 py-3 px-4 ${activePage === item.key ? 'bg-white text-[#0F172A]' : 'bg-white/10 text-white hover:bg-blue-700'}`}>
                    <span className="text-xl">{item.icon}</span>
                    {!sidebarCollapsed && <span className="ml-3 font-medium">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 overflow-auto">

          {/* HEADER */}
          <div className="sticky top-0 z-40 bg-gradient-to-r from-[#0F172A] via-blue-900 to-blue-950 border-b border-blue-800 shadow-2xl">
            <div className="px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-5">
                <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-2xl transition-all">
                  ☰
                </button>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-3xl bg-white text-[#0F172A] flex items-center justify-center text-2xl font-bold shadow-lg">AI</div>
                  <div>
                    <h1 className="text-2xl font-bold text-white leading-tight">B Pro</h1>
                    <p className="text-sm text-blue-100">Enterprise CRM Platform</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 relative">
                <button className="relative w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl transition-all">
                  🔔
                  <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full" />
                </button>
                <button onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center gap-3 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-2xl transition-all">
                  <div className="w-11 h-11 rounded-2xl bg-white text-[#0F172A] flex items-center justify-center font-bold">
                    {currentUser?.first_name ? `${currentUser.first_name.charAt(0)}${currentUser.last_name?.charAt(0) || ''}` : 'U'}
                  </div>
                </button>
                {profileMenuOpen && (
                  <div className="absolute right-8 top-24 w-64 bg-white rounded-3xl shadow-2xl border border-blue-100 overflow-hidden z-50">
                    <div className="p-5 border-b border-blue-100">
                      <div className="font-bold text-[#0F172A]">{currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'User'}</div>
                      <div className="text-sm text-gray-500 mt-1">{currentUser?.designation || 'Employee'}</div>
                    </div>
                    <button onClick={() => { setProfileMenuOpen(false); setProfilePageOpen(true); }} className="w-full text-left px-5 py-4 hover:bg-blue-50 transition-all text-[#0F172A]">My Profile</button>
                    <button className="w-full text-left px-5 py-4 hover:bg-blue-50 transition-all text-[#0F172A]">Preferences</button>
                    <button onClick={handleLogout} className="w-full text-left px-5 py-4 hover:bg-red-50 transition-all text-red-600">Logout</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CONTENT */}
          <div className="p-8">
            <div className="bg-white rounded-[32px] p-8 shadow-xl border border-blue-100 w-full min-h-screen">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-[#0F172A] capitalize">{activePage}</h1>
                {activePage !== 'dashboard' && activePage !== 'adminTools' && (
                  <button onClick={() => {
                    setLineItems([]);
                    setCreateFormData({
                      name: '', customer: '', status: 'New', amount: '', email: '', phone: '',
                      source: '', category: '', price: '', company: '', industry: '',
                      billingAddress: '', shippingAddress: '', city: '', state: '',
                      postalCode: '', country: '', website: '', gstNumber: '',
                      stage: 'Qualification', closeDate: '', shippingAddressOrder: '',
                      deliveryDate: '', dueDate: '', paymentTerms: '',
                    });
                    setCreateModalOpen(true);
                  }} className="bg-[#0F172A] text-white px-5 py-3 rounded-2xl font-semibold">
                    Create {getPageLabel(activePage)}
                  </button>
                )}
              </div>

              {/* ── DASHBOARD ── */}
              {activePage === 'dashboard' ? (
                <div className="space-y-8">
                  <div className="bg-white rounded-[32px] p-8 shadow-xl border border-blue-100">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                      <div>
                        <h1 className="text-4xl font-bold text-[#0F172A] tracking-tight">CRM Analytics Dashboard</h1>
                        <p className="text-gray-600 mt-2 text-lg">Monitor sales, customers, invoices and opportunities in real time.</p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <select value={selectedTimeline} onChange={(e) => setSelectedTimeline(e.target.value)}
                          className="px-5 py-3 rounded-2xl border border-blue-200 bg-white text-[#0F172A] font-medium shadow-sm">
                          <option>Last 30 Days</option>
                          <option>Last Quarter</option>
                          <option>This Year</option>
                        </select>
                        <button onClick={() => setReportGenerated(true)}
                          className="bg-[#0F172A] text-white px-6 py-3 rounded-2xl font-semibold shadow-lg hover:scale-[1.02] transition-all">
                          Generate Report
                        </button>
                      </div>
                    </div>
                  </div>

                  {reportGenerated && (
                    <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[32px] p-6 text-white shadow-2xl border border-blue-800/30">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div>
                          <h2 className="text-3xl font-bold tracking-tight">Analytics Report Generated</h2>
                          <p className="text-blue-100 mt-2 text-lg">Report timeline: {selectedTimeline}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full lg:w-auto">
                          <div className="bg-white/10 rounded-2xl px-5 py-4 backdrop-blur-sm">
                            <div className="text-sm text-blue-100 uppercase tracking-wide">Total Revenue</div>
                            <div className="text-2xl font-bold mt-2">{formatCurrency(invoices.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0))}</div>
                          </div>
                          <div className="bg-white/10 rounded-2xl px-5 py-4 backdrop-blur-sm">
                            <div className="text-sm text-blue-100 uppercase tracking-wide">Converted Leads</div>
                            <div className="text-2xl font-bold mt-2">{leads.filter((l: any) => l.status === 'Converted').length}</div>
                          </div>
                          <div className="bg-white/10 rounded-2xl px-5 py-4 backdrop-blur-sm">
                            <div className="text-sm text-blue-100 uppercase tracking-wide">Closed Won Opportunities</div>
                            <div className="text-2xl font-bold mt-2">{opportunities.filter((o: any) => o.status === 'Closed Won').length}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 bg-white rounded-[32px] p-8 shadow-xl border border-blue-100 h-[460px]">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h2 className="text-2xl font-bold text-[#0F172A]">CRM Records Overview</h2>
                          <p className="text-gray-500 mt-1">Complete business object analytics overview.</p>
                        </div>
                        <div className="bg-blue-50 px-4 py-2 rounded-2xl text-[#0F172A] font-semibold">Live Analytics</div>
                      </div>
                      <ResponsiveContainer width="100%" height="80%">
                        <BarChart data={[
                          { name: 'Customers', value: customers.length },
                          { name: 'Products', value: products.length },
                          { name: 'Leads', value: leads.length },
                          { name: 'Opportunities', value: opportunities.length },
                          { name: 'Orders', value: orders.length },
                        ]}>
                          <XAxis dataKey="name" /><YAxis /><Tooltip />
                          <Bar dataKey="value" fill="#0F172A" radius={[10, 10, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="bg-gradient-to-br from-[#0F172A] via-blue-900 to-blue-950 rounded-[32px] p-8 text-white shadow-2xl min-h-[460px] flex flex-col border border-blue-800/30">
                      <div>
                        <h2 className="text-3xl font-bold tracking-tight">AI Billing Agent</h2>
                        <p className="text-blue-100 mt-2">AI-powered CRM assistant for insights and billing intelligence.</p>
                      </div>
                      <div className="space-y-4 mt-8 flex-1 overflow-y-auto pr-2">
                        {aiMessages.map((message: any, index: number) => (
                          <div key={index} className={`rounded-3xl p-5 shadow-lg ${message.type === 'assistant' ? 'bg-white text-[#0F172A]' : 'bg-blue-800 text-white ml-8'}`}>
                            <div className="font-semibold mb-2">{message.type === 'assistant' ? 'AI Billing Agent' : 'You'}</div>
                            <div className="leading-relaxed">{message.text}</div>
                          </div>
                        ))}
                        {aiMessages.length === 1 && (
                          <>
                            <button onClick={() => handleAIQuery('Show revenue summary for current month')} className="w-full bg-white text-[#0F172A] rounded-3xl p-5 text-left font-semibold hover:bg-blue-50 transition-all shadow-lg">Show revenue summary for current month</button>
                            <button onClick={() => handleAIQuery('Show qualified and converted leads')} className="w-full bg-white text-[#0F172A] rounded-3xl p-5 text-left font-semibold hover:bg-blue-50 transition-all shadow-lg">Show qualified and converted leads</button>
                            <button onClick={() => handleAIQuery('Show pending invoices and orders')} className="w-full bg-white text-[#0F172A] rounded-3xl p-5 text-left font-semibold hover:bg-blue-50 transition-all shadow-lg">Show pending invoices and orders</button>
                          </>
                        )}
                      </div>
                      <div className="mt-6 flex gap-3">
                        <input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && aiInput.trim()) { handleAIQuery(aiInput); setAiInput(''); } }}
                          placeholder="Ask AI about CRM analytics..."
                          className="flex-1 rounded-2xl px-5 py-4 bg-white text-[#0F172A] border border-blue-200 outline-none" />
                        <button onClick={() => { if (!aiInput.trim()) return; handleAIQuery(aiInput); setAiInput(''); }}
                          className="bg-white text-[#0F172A] px-6 py-4 rounded-2xl font-bold hover:bg-blue-50 transition-all">Send</button>
                      </div>
                    </div>
                  </div>
                </div>

              /* ── ADMIN TOOLS ── */
              ) : activePage === 'adminTools' ? (
                <div className="space-y-8">
                  <div className="bg-white rounded-[32px] p-8 shadow-xl border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h1 className="text-4xl font-bold text-[#0F172A]">
                          {adminToolPage === 'home' ? 'Admin Tools' : adminToolPage === 'templateDesigner' ? 'Template Designer' : adminToolPage === 'organizations' ? 'Organizations' : adminToolPage === 'businessUnits' ? 'Business Units' : adminToolPage === 'users' ? 'Users' : adminToolPage === 'userGroups' ? 'User Groups' : adminToolPage === 'securityConsole' ? 'Security Console' : 'Admin Tools'}
                        </h1>
                        <p className="text-gray-600 mt-2 text-lg">
                          {adminToolPage === 'home' ? 'Configure templates, branding, workflows and system tools.' : adminToolPage === 'templateDesigner' ? 'Configure quotation PDF templates and branding.' : adminToolPage === 'organizations' ? 'Manage enterprise organizations and legal entities.' : adminToolPage === 'businessUnits' ? 'Configure enterprise business units and hierarchy.' : adminToolPage === 'users' ? 'Manage enterprise users, workforce and access accounts.' : adminToolPage === 'userGroups' ? 'Configure workforce groups and department structures.' : adminToolPage === 'securityConsole' ? 'Manage enterprise roles, permissions and security access.' : 'Configure enterprise administration.'}
                        </p>
                      </div>
                      {adminToolPage !== 'home' && (
                        <button onClick={() => setAdminToolPage('home')} className="bg-[#0F172A] text-white px-5 py-3 rounded-2xl font-semibold">← Back</button>
                      )}
                    </div>
                  </div>

                  {adminToolPage === 'home' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      <button onClick={() => setAdminToolPage('templateDesigner')} className="bg-gradient-to-br from-[#0F172A] to-blue-900 rounded-[32px] p-8 text-white shadow-2xl text-left hover:scale-[1.02] transition-all">
                        <div className="text-5xl mb-6">📄</div>
                        <h2 className="text-2xl font-bold">Template Designer</h2>
                        <p className="text-blue-100 mt-3 leading-relaxed">Configure quotation, invoice and document templates.</p>
                      </button>
                      {[
                        { key: 'organizations', icon: '🏢', title: 'Organizations', desc: 'Manage enterprise organizations, subsidiaries and legal entities.' },
                        { key: 'businessUnits', icon: '🏬', title: 'Business Units', desc: 'Configure business hierarchy, departments and operational units.' },
                        { key: 'users', icon: '👥', title: 'Users', desc: 'Create enterprise users, access accounts and workforce hierarchy.' },
                        { key: 'userGroups', icon: '🏢', title: 'User Groups', desc: 'Configure workforce teams, operational groups and departments.' },
                      ].map(({ key, icon, title, desc }) => (
                        <button key={key} onClick={() => setAdminToolPage(key)} className="bg-white rounded-[32px] p-8 border border-blue-100 shadow-xl text-left hover:scale-[1.02] transition-all">
                          <div className="text-5xl mb-6">{icon}</div>
                          <h2 className="text-2xl font-bold text-[#0F172A]">{title}</h2>
                          <p className="text-gray-500 mt-3 leading-relaxed">{desc}</p>
                        </button>
                      ))}
                      <div onClick={() => setAdminToolPage('securityConsole')} className="bg-white rounded-[32px] p-8 shadow-xl border border-blue-100 hover:shadow-2xl transition-all cursor-pointer">
                        <div className="text-5xl">🔐</div>
                        <h2 className="mt-6 text-2xl font-bold text-[#0F172A]">Security Console</h2>
                        <p className="mt-3 text-gray-500 leading-relaxed">Manage roles, permissions, access policies and enterprise security.</p>
                      </div>
                      <div className="bg-white rounded-[32px] p-8 border border-dashed border-blue-200 text-gray-400 flex flex-col justify-center items-center min-h-[240px]">
                        <div className="text-5xl mb-4">⚡</div>
                        <div className="font-semibold text-lg">More Admin Tools Coming Soon</div>
                      </div>
                    </div>

                  ) : adminToolPage === 'securityConsole' ? (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-3xl font-bold text-[#0F172A]">Security Console</h2>
                          <p className="text-gray-500 mt-2">Manage enterprise roles and permissions</p>
                        </div>
                        <button onClick={() => { setAdminModalMode(''); setSelectedAdminRecord(null); setRoleFormData({ role_name: '', role_code: '', description: '', status: 'Active' }); setSelectedRolePermissions([]); setRoleFormOpen(true); }}
                          className="bg-[#0F172A] text-white px-6 py-4 rounded-2xl">+ New Role</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {roles.map((role: any) => (
                          <div key={role.id} className="bg-white rounded-[28px] p-6 shadow-lg border border-blue-100">
                            <h2 className="text-2xl font-bold text-[#0F172A]">{role.role_name}</h2>
                            <p className="text-sm text-gray-500 mt-2">{role.role_code}</p>
                            <p className="mt-5 text-gray-600">{role.description}</p>
                            <button onClick={async () => {
                              setSelectedAdminRecord(role); setAdminModalMode('editRole');
                              setRoleFormData({ role_name: role.role_name || '', role_code: role.role_code || '', description: role.description || '', status: role.status || 'Active' });
                              const perms = await fetchRolePermissions(role.id);
                              setSelectedRolePermissions((perms || []).map((item: any) => item.permission_id));
                              setRoleFormOpen(true);
                            }} className="mt-6 text-blue-700 font-semibold">Edit Role</button>
                          </div>
                        ))}
                      </div>
                    </div>

                  ) : adminToolPage === 'organizations' ? (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-3xl font-bold text-[#0F172A]">Organizations</h2>
                          <p className="text-gray-500 mt-2">Manage enterprise organizations</p>
                        </div>
                        <button onClick={() => { setAdminModalMode(''); setSelectedAdminRecord(null); setOrganizationFormData({ name: '', organization_code: '', status: 'Active', industry: '', website: '', country: '', timezone: '', currency: '' }); setOrganizationFormOpen(true); }}
                          className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-4 rounded-2xl font-semibold shadow-lg">
                          Create Organization
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {organizations.map((organization: any) => (
                          <div key={organization.id} className="relative bg-white rounded-[32px] p-8 border border-blue-100 shadow-xl">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="relative">
                                  <button onClick={() => setAdminActionMenu(adminActionMenu === organization.id ? null : organization.id)} className="w-10 h-10 rounded-xl hover:bg-gray-100 text-[#0F172A] text-xl">⋯</button>
                                  {adminActionMenu === organization.id && (
                                    <div className="absolute top-12 left-0 w-56 bg-white border border-blue-100 rounded-2xl shadow-2xl z-50 overflow-hidden">
                                      <button onClick={() => { setSelectedAdminRecord(organization); setAdminModalMode('editOrganization'); setOrganizationFormData({ name: organization.name || '', organization_code: organization.organization_code || '', status: organization.status || 'Active', industry: organization.industry || '', website: organization.website || '', country: organization.country || '', timezone: organization.timezone || '', currency: organization.currency || '' }); setOrganizationFormOpen(true); setAdminActionMenu(null); }} className="w-full text-left px-5 py-4 hover:bg-gray-50 text-[#0F172A]">Edit</button>
                                      <button onClick={() => { updateAdminStatus('organizations', organization.id, organization.status === 'Active' ? 'Inactive' : 'Active'); setAdminActionMenu(null); }} className="w-full text-left px-5 py-4 hover:bg-gray-50 text-[#0F172A]">{organization.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
                                      <button onClick={() => { deleteAdminRecord('organizations', organization.id); setAdminActionMenu(null); }} className="w-full text-left px-5 py-4 hover:bg-red-50 text-red-600">Delete</button>
                                    </div>
                                  )}
                                </div>
                                <h3 className="text-2xl font-bold text-[#0F172A]">{organization.name}</h3>
                                <p className="text-gray-500 mt-2">{organization.organization_code}</p>
                              </div>
                              <div className="px-4 py-2 rounded-2xl bg-green-100 text-green-700 text-sm font-semibold">{organization.status}</div>
                            </div>
                            <div className="mt-6 space-y-3 text-sm text-gray-600">
                              <div>Industry: {organization.industry}</div>
                              <div>Country: {organization.country}</div>
                              <div>Currency: {organization.currency}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {organizationFormOpen && (
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                          <div className="w-full max-w-3xl bg-white rounded-[36px] shadow-2xl p-10 max-h-[90vh] overflow-auto">
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <h2 className="text-3xl font-bold text-[#0F172A]">{adminModalMode === 'editOrganization' ? 'Edit Organization' : 'Create New Organization'}</h2>
                                <p className="text-gray-500 mt-2">Create enterprise organization</p>
                              </div>
                              <button onClick={() => setOrganizationFormOpen(false)} className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-[#0F172A] font-bold text-xl">✕</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {[
                                ['name', 'Organization Name'],
                                ['organization_code', 'Organization Code'],
                                ['industry', 'Industry'],
                                ['website', 'Website'],
                                ['country', 'Country'],
                                ['timezone', 'Timezone'],
                                ['currency', 'Currency'],
                              ].map(([field, placeholder]) => (
                                <input key={field} placeholder={placeholder} value={(organizationFormData as any)[field]} onChange={(e) => setOrganizationFormData({ ...organizationFormData, [field]: e.target.value })}
                                  className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500" />
                              ))}
                            </div>
                            <div className="flex justify-end mt-10">
                              <button onClick={saveOrganization} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-4 rounded-2xl font-semibold shadow-lg">Save Organization</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  ) : adminToolPage === 'businessUnits' ? (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-3xl font-bold text-[#0F172A]">Business Units</h2>
                          <p className="text-gray-500 mt-2">Configure enterprise business hierarchy</p>
                        </div>
                        <button onClick={() => { setSelectedRecord(null); setEditedRecord(null); setAdminModalMode(''); setSelectedAdminRecord(null); setBusinessUnitFormData({ name: '', business_unit_code: '', status: 'Active', organization_id: '', description: '' }); setBusinessUnitFormOpen(true); }}
                          className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-4 rounded-2xl font-semibold shadow-lg">
                          Create Business Unit
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {businessUnits.map((businessUnit: any) => {
                          const org = organizations.find((o: any) => o.id === businessUnit.organization_id);
                          return (
                            <div key={businessUnit.id} className="relative bg-white rounded-[32px] p-8 border border-blue-100 shadow-xl">
                              <div className="relative">
                                <button onClick={() => setAdminActionMenu(adminActionMenu === businessUnit.id ? null : businessUnit.id)} className="w-10 h-10 rounded-xl hover:bg-gray-100 text-[#0F172A] text-xl">⋯</button>
                                {adminActionMenu === businessUnit.id && (
                                  <div className="absolute top-12 left-0 w-56 bg-white border border-blue-100 rounded-2xl shadow-2xl z-50 overflow-hidden">
                                    <button onClick={() => { setSelectedAdminRecord(businessUnit); setAdminModalMode('editBusinessUnit'); setBusinessUnitFormData({ name: businessUnit.name || '', business_unit_code: businessUnit.business_unit_code || '', status: businessUnit.status || '', organization_id: businessUnit.organization_id || '', description: businessUnit.description || '' }); setBusinessUnitFormOpen(true); setAdminActionMenu(null); }} className="w-full text-left px-5 py-4 hover:bg-gray-50 text-[#0F172A]">Edit</button>
                                    <button onClick={() => { updateAdminStatus('business_units', businessUnit.id, businessUnit.status === 'Active' ? 'Inactive' : 'Active'); setAdminActionMenu(null); }} className="w-full text-left px-5 py-4 hover:bg-gray-50 text-[#0F172A]">{businessUnit.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
                                    <button onClick={() => { deleteAdminRecord('business_units', businessUnit.id); setAdminActionMenu(null); }} className="w-full text-left px-5 py-4 hover:bg-red-50 text-red-600">Delete</button>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="text-2xl font-bold text-[#0F172A]">{businessUnit.name}</h3>
                                  <p className="text-gray-500 mt-2">{businessUnit.business_unit_code}</p>
                                </div>
                                <div className="px-4 py-2 rounded-2xl bg-green-100 text-green-700 text-sm font-semibold">{businessUnit.status}</div>
                              </div>
                              <div className="mt-6 space-y-3 text-sm text-gray-600"><div>Organization: {org?.name}</div></div>
                            </div>
                          );
                        })}
                      </div>

                      {businessUnitFormOpen && (
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                          <div className="w-full max-w-3xl bg-white rounded-[36px] shadow-2xl p-10">
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <h2 className="text-3xl font-bold text-[#0F172A]">{adminModalMode === 'editBusinessUnit' ? 'Edit Business Unit' : 'Create New Business Unit'}</h2>
                                <p className="text-gray-500 mt-2">Configure operational hierarchy</p>
                              </div>
                              <button onClick={() => setBusinessUnitFormOpen(false)} className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-[#0F172A] font-bold text-xl">✕</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <input placeholder="Business Unit Name" value={businessUnitFormData.name} onChange={(e) => setBusinessUnitFormData({ ...businessUnitFormData, name: e.target.value })} className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500" />
                              <input placeholder="Business Unit Code" value={businessUnitFormData.business_unit_code} onChange={(e) => setBusinessUnitFormData({ ...businessUnitFormData, business_unit_code: e.target.value })} className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500" />
                              <select value={businessUnitFormData.organization_id} onChange={(e) => setBusinessUnitFormData({ ...businessUnitFormData, organization_id: e.target.value })} className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]">
                                <option value="">Select Organization</option>
                                {organizations.map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}
                              </select>
                            </div>
                            <div className="flex justify-end mt-10">
                              <button onClick={saveBusinessUnit} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-4 rounded-2xl font-semibold shadow-lg">Save Business Unit</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  ) : adminToolPage === 'users' ? (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-3xl font-bold text-[#0F172A]">Users</h2>
                          <p className="text-gray-500 mt-2">Manage enterprise workforce and access</p>
                        </div>
                        <button onClick={() => { setAdminModalMode('createUser'); setSelectedAdminRecord(null); setUserFormData({ employee_code: '', username: '', first_name: '', last_name: '', email: '', temporary_password: '', phone: '', designation: '', organization_id: '', business_unit_id: '', role_id: '', status: 'Active' }); setUserFormOpen(true); }}
                          className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-4 rounded-2xl font-semibold shadow-lg">
                          Create User
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {enterpriseUsers.map((user: any) => {
                          const org = organizations.find((o: any) => o.id === user.organization_id);
                          const bu = businessUnits.find((b: any) => b.id === user.business_unit_id);
                          return (
                            <div key={user.id} className="relative bg-white rounded-[32px] p-8 border border-blue-100 shadow-xl">
                              <div className="flex items-start justify-between">
                                <div className="relative">
                                  <button onClick={() => setAdminActionMenu(adminActionMenu === user.id ? null : user.id)} className="w-10 h-10 rounded-xl hover:bg-gray-100 text-[#0F172A] text-xl">⋯</button>
                                  {adminActionMenu === user.id && (
                                    <div className="absolute top-12 left-0 w-56 bg-white border border-blue-100 rounded-2xl shadow-2xl z-50 overflow-hidden">
                                      <button onClick={() => { setSelectedAdminRecord(user); setAdminModalMode('editUser'); setUserFormData({ employee_code: user.employee_code || '', username: user.username || '', first_name: user.first_name || '', last_name: user.last_name || '', email: user.email || '', temporary_password: '', phone: user.phone || '', designation: user.designation || '', organization_id: user.organization_id || '', business_unit_id: user.business_unit_id || '', role_id: user.role_id || '', status: user.status || 'Active' }); setUserFormOpen(true); setAdminActionMenu(null); }} className="w-full text-left px-5 py-4 hover:bg-gray-50 text-[#0F172A]">Edit</button>
                                      <button onClick={() => { updateAdminStatus('enterprise_users', user.id, user.status === 'Active' ? 'Inactive' : 'Active'); setAdminActionMenu(null); }} className="w-full text-left px-5 py-4 hover:bg-gray-50 text-[#0F172A]">{user.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
                                      <button onClick={() => { deleteAdminRecord('enterprise_users', user.id); setAdminActionMenu(null); }} className="w-full text-left px-5 py-4 hover:bg-red-50 text-red-600">Delete</button>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <h3 className="text-2xl font-bold text-[#0F172A]">{user.first_name} {user.last_name}</h3>
                                  <p className="text-gray-500 mt-2">{user.designation}</p>
                                  <p className="text-sm text-blue-700 mt-1">{roles.find((r: any) => r.id === user.role_id)?.role_name || 'No Role'}</p>
                                </div>
                                <div className="px-4 py-2 rounded-2xl bg-green-100 text-green-700 text-sm font-semibold">{user.status}</div>
                              </div>
                              <div className="mt-6 space-y-3 text-sm text-gray-600">
                                <div>Username: {user.username}</div>
                                <div>Email: {user.email}</div>
                                <div>Organization: {org?.name}</div>
                                <div>Business Unit: {bu?.name}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {userFormOpen && (
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6 overflow-auto">
                          <div className="w-full max-w-5xl bg-white rounded-[36px] shadow-2xl p-10">
                            <div className="flex items-center justify-between mb-10">
                              <div>
                                <h2 className="text-3xl font-bold text-[#0F172A]">{adminModalMode === 'editUser' ? 'Edit User' : 'Create New User'}</h2>
                                <p className="text-gray-500 mt-2">Create enterprise login-enabled user</p>
                              </div>
                              <button onClick={() => setUserFormOpen(false)} className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-[#0F172A] font-bold text-xl">✕</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {[
                                ['employee_code', 'Employee Code', 'text'],
                                ['username', 'Username', 'text'],
                                ['first_name', 'First Name', 'text'],
                                ['last_name', 'Last Name', 'text'],
                                ['email', 'Email', 'email'],
                                ['temporary_password', 'Temporary Password', 'password'],
                                ['phone', 'Phone', 'text'],
                                ['designation', 'Designation', 'text'],
                              ].map(([field, placeholder, type]) => (
                                <input key={field} type={type} placeholder={placeholder} value={(userFormData as any)[field]} onChange={(e) => setUserFormData({ ...userFormData, [field]: e.target.value })}
                                  className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500" />
                              ))}
                              <select value={userFormData.organization_id} onChange={(e) => setUserFormData({ ...userFormData, organization_id: e.target.value })} className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]">
                                <option value="">Select Organization</option>
                                {organizations.map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}
                              </select>
                              <select value={userFormData.business_unit_id} onChange={(e) => setUserFormData({ ...userFormData, business_unit_id: e.target.value })} className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]">
                                <option value="">Select Business Unit</option>
                                {businessUnits.map((bu: any) => <option key={bu.id} value={bu.id}>{bu.name}</option>)}
                              </select>
                              <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-[#0F172A]">Role</label>
                                <select value={userFormData.role_id} onChange={(e) => setUserFormData({ ...userFormData, role_id: e.target.value })} className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]">
                                  <option value="">Select Role</option>
                                  {roles.map((role: any) => <option key={role.id} value={role.id}>{role.role_name}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="flex justify-end mt-10">
                              <button onClick={saveEnterpriseUser} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-4 rounded-2xl font-semibold shadow-lg">{adminModalMode === 'editUser' ? 'Save Changes' : 'Create User'}</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  ) : adminToolPage === 'userGroups' ? (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-3xl font-bold text-[#0F172A]">User Groups</h2>
                          <p className="text-gray-500 mt-2">Configure enterprise workforce teams and departments</p>
                        </div>
                        <button onClick={() => { setAdminModalMode(''); setSelectedAdminRecord(null); setUserGroupFormData({ group_name: '', group_code: '', description: '', organization_id: '', business_unit_id: '', status: 'Active' }); setUserGroupFormOpen(true); }}
                          className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-4 rounded-2xl font-semibold shadow-lg">
                          Create User Group
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {userGroups.map((group: any) => {
                          const org = organizations.find((o: any) => o.id === group.organization_id);
                          const bu = businessUnits.find((b: any) => b.id === group.business_unit_id);
                          return (
                            <div key={group.id} onClick={() => { setSelectedAdminRecord(group); setAdminModalMode('groupWorkspace'); fetchGroupMembers(group.id); setGroupWorkspaceOpen(true); }}
                              className="relative bg-white rounded-[32px] p-8 border border-blue-100 shadow-xl cursor-pointer hover:scale-[1.01] transition-all">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => setAdminActionMenu(adminActionMenu === group.id ? null : group.id)} className="w-10 h-10 rounded-xl hover:bg-gray-100 text-[#0F172A] text-xl">⋯</button>
                                    {adminActionMenu === group.id && (
                                      <div className="absolute top-12 left-0 w-56 bg-white border border-blue-100 rounded-2xl shadow-2xl z-50 overflow-hidden">
                                        <button onClick={() => { setSelectedAdminRecord(group); setAdminModalMode('editUserGroup'); setUserGroupFormData({ group_name: group.group_name || '', group_code: group.group_code || '', description: group.description || '', organization_id: group.organization_id || '', business_unit_id: group.business_unit_id || '', status: group.status || '' }); setUserGroupFormOpen(true); setAdminActionMenu(null); }} className="w-full text-left px-5 py-4 hover:bg-gray-50 text-[#0F172A]">Edit</button>
                                        <button onClick={() => { updateAdminStatus('user_groups', group.id, group.status === 'Active' ? 'Inactive' : 'Active'); setAdminActionMenu(null); }} className="w-full text-left px-5 py-4 hover:bg-gray-50 text-[#0F172A]">{group.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
                                        <button onClick={() => { deleteAdminRecord('user_groups', group.id); setAdminActionMenu(null); }} className="w-full text-left px-5 py-4 hover:bg-red-50 text-red-600">Delete</button>
                                      </div>
                                    )}
                                  </div>
                                  <h3 className="text-2xl font-bold text-[#0F172A]">{group.group_name}</h3>
                                  <p className="text-gray-500 mt-2">{group.group_code}</p>
                                </div>
                                <div className="px-4 py-2 rounded-2xl bg-green-100 text-green-700 text-sm font-semibold">{group.status}</div>
                              </div>
                              <div className="mt-6 space-y-3 text-sm text-gray-600">
                                <div>Organization: {org?.name}</div>
                                <div>Business Unit: {bu?.name}</div>
                                <div>{group.description}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {userGroupFormOpen && (
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6 overflow-auto">
                          <div className="w-full max-w-4xl bg-white rounded-[36px] shadow-2xl p-10">
                            <div className="flex items-center justify-between mb-10">
                              <div>
                                <h2 className="text-3xl font-bold text-[#0F172A]">{adminModalMode === 'editUserGroup' ? 'Edit User Group' : 'Create New User Group'}</h2>
                                <p className="text-gray-500 mt-2">Create workforce operational groups</p>
                              </div>
                              <button onClick={() => setUserGroupFormOpen(false)} className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-[#0F172A] font-bold text-xl">✕</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <input placeholder="Group Name" value={userGroupFormData.group_name} onChange={(e) => setUserGroupFormData({ ...userGroupFormData, group_name: e.target.value })} className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500" />
                              <input placeholder="Group Code" value={userGroupFormData.group_code} onChange={(e) => setUserGroupFormData({ ...userGroupFormData, group_code: e.target.value })} className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500" />
                              <select value={userGroupFormData.organization_id} onChange={(e) => setUserGroupFormData({ ...userGroupFormData, organization_id: e.target.value })} className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]">
                                <option value="">Select Organization</option>
                                {organizations.map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}
                              </select>
                              <select value={userGroupFormData.business_unit_id} onChange={(e) => setUserGroupFormData({ ...userGroupFormData, business_unit_id: e.target.value })} className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]">
                                <option value="">Select Business Unit</option>
                                {businessUnits.map((bu: any) => <option key={bu.id} value={bu.id}>{bu.name}</option>)}
                              </select>
                              <select value={userFormData.role_id} onChange={(e) => setUserFormData({ ...userFormData, role_id: e.target.value })} className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]">
                                <option value="">Select Role</option>
                                {roles.map((role: any) => <option key={role.id} value={role.id}>{role.role_name}</option>)}
                              </select>
                              <textarea placeholder="Description" value={userGroupFormData.description} onChange={(e) => setUserGroupFormData({ ...userGroupFormData, description: e.target.value })}
                                className="md:col-span-2 border border-blue-200 rounded-2xl px-5 py-4 min-h-[140px] text-[#0F172A] placeholder:text-gray-500" />
                            </div>
                            <div className="flex justify-end mt-10">
                              <button onClick={saveUserGroup} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-4 rounded-2xl font-semibold shadow-lg">{adminModalMode === 'editUserGroup' ? 'Save Changes' : 'Create User Group'}</button>
                            </div>
                          </div>
                        </div>
                      )}

                      {groupWorkspaceOpen && (
                        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
                          <div className="bg-white w-full max-w-5xl rounded-[32px] shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <h2 className="text-3xl font-bold text-[#0F172A]">{selectedAdminRecord?.group_name}</h2>
                                <p className="text-gray-500 mt-1">User Group Workspace</p>
                              </div>
                              <button onClick={() => { setGroupWorkspaceOpen(false); setSelectedGroupUsers([]); }} className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-[#0F172A]">✕</button>
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                              <div>
                                <h3 className="text-xl font-semibold text-[#0F172A] mb-5">Add Users</h3>
                                <select multiple value={selectedGroupUsers} onChange={(e) => setSelectedGroupUsers(Array.from(e.target.selectedOptions, (option) => option.value))}
                                  className="w-full border border-blue-200 rounded-2xl p-5 min-h-[300px] text-[#0F172A]">
                                  {enterpriseUsers.filter((user) => !userGroupMembers.some((m) => m.enterprise_user_id === user.id)).map((user) => (
                                    <option key={user.id} value={user.id}>{user.first_name} {user.last_name} - {user.employee_code}</option>
                                  ))}
                                </select>
                                <button onClick={addUsersToGroup} className="mt-5 bg-[#0F172A] text-white px-6 py-4 rounded-2xl">Add Selected Users</button>
                              </div>
                              <div>
                                <h3 className="text-xl font-semibold text-[#0F172A] mb-5">Group Members</h3>
                                <div className="space-y-4">
                                  {userGroupMembers.map((member) => (
                                    <div key={member.id} className="border border-blue-100 rounded-2xl p-5 flex items-center justify-between">
                                      <div>
                                        <div className="font-semibold text-[#0F172A]">{member?.enterprise_users?.first_name} {member?.enterprise_users?.last_name}</div>
                                        <div className="text-sm text-gray-500">
                                          <div className="mt-3 inline-flex items-center px-4 py-2 rounded-2xl bg-blue-50 text-sm font-medium text-blue-700">
                                            Members: {userGroupMembers.filter((m) => m.user_group_id === selectedAdminRecord?.id).length}
                                          </div>
                                          {member?.enterprise_users?.email}
                                        </div>
                                      </div>
                                      <button onClick={() => removeUserFromGroup(member.id)} className="text-red-600 hover:text-red-700">Remove</button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  ) : (
                    /* ── TEMPLATE DESIGNER ── */
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                      <div className="xl:col-span-2 bg-white rounded-[32px] p-8 shadow-xl border border-blue-100">
                        <h2 className="text-2xl font-bold text-[#0F172A] mb-6">Quote Template Configuration</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {[['name', 'Template Name'], ['companyName', 'Company Name'], ['companyEmail', 'Company Email'], ['companyPhone', 'Company Phone'], ['companyAddress', 'Company Address'], ['quoteTitle', 'Quote Title']].map(([field, label]) => (
                            <div key={field}>
                              <label className="block text-sm font-semibold text-[#0F172A] mb-2">{label}</label>
                              <input type="text" value={templateFormData[field]} onChange={(e) => setTemplateFormData({ ...templateFormData, [field]: e.target.value })} className="w-full border border-blue-200 rounded-2xl px-5 py-3" />
                            </div>
                          ))}
                        </div>
                        <div className="mt-5">
                          <label className="block text-sm font-semibold text-[#0F172A] mb-2">Footer Text</label>
                          <textarea value={templateFormData.footerText} onChange={(e) => setTemplateFormData({ ...templateFormData, footerText: e.target.value })} rows={3} className="w-full border border-blue-200 rounded-2xl px-5 py-3" />
                        </div>
                        <div className="mt-5">
                          <label className="block text-sm font-semibold text-[#0F172A] mb-2">Terms & Conditions</label>
                          <textarea value={templateFormData.termsAndConditions} onChange={(e) => setTemplateFormData({ ...templateFormData, termsAndConditions: e.target.value })} rows={5} className="w-full border border-blue-200 rounded-2xl px-5 py-3" />
                        </div>
                        <button onClick={async () => {
                          if (!supabase) return;
                          if (editingTemplateId) {
                            await supabase.from('quote_templates').update({ name: templateFormData.name, company_name: templateFormData.companyName, company_email: templateFormData.companyEmail, company_phone: templateFormData.companyPhone, company_address: templateFormData.companyAddress, quote_title: templateFormData.quoteTitle, footer_text: templateFormData.footerText, terms_and_conditions: templateFormData.termsAndConditions, primary_color: templateFormData.primaryColor, secondary_color: templateFormData.secondaryColor }).eq('template_number', editingTemplateId);
                            setEditingTemplateId(null);
                            await fetchQuoteTemplates();
                            alert('Template Updated');
                            return;
                          }
                          const { error } = await supabase.from('quote_templates').insert([{ template_number: `TEMP-${Date.now()}`, name: templateFormData.name, is_default: false, company_name: templateFormData.companyName, company_email: templateFormData.companyEmail, company_phone: templateFormData.companyPhone, company_address: templateFormData.companyAddress, quote_title: templateFormData.quoteTitle, footer_text: templateFormData.footerText, terms_and_conditions: templateFormData.termsAndConditions, primary_color: templateFormData.primaryColor, secondary_color: templateFormData.secondaryColor }]);
                          if (error) { console.error(error); alert(error.message); return; }
                          await fetchQuoteTemplates();
                          alert('Template Saved');
                          setTemplateFormData({ name: '', companyName: '', companyEmail: '', companyPhone: '', companyAddress: '', quoteTitle: 'Quotation', footerText: '', termsAndConditions: '', primaryColor: '#0F172A', secondaryColor: '#1E3A8A' });
                        }} className="mt-6 bg-[#0F172A] text-white px-6 py-4 rounded-2xl font-semibold">Save Template</button>
                      </div>
                      <div className="bg-gradient-to-br from-[#0F172A] to-blue-900 rounded-[32px] p-8 text-white shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">Saved Templates</h2>
                        <div className="space-y-4">
                          {quoteTemplates.map((template: any) => (
                            <div key={template.id} className="bg-white/10 rounded-2xl p-5">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-bold text-lg">{template.name}</div>
                                  <div className="text-blue-100 text-sm mt-1">{template.companyName}</div>
                                </div>
                                {template.isDefault && <span className="bg-green-500 text-white text-xs px-3 py-1 rounded-full">Default</span>}
                              </div>
                              <div className="flex gap-2 mt-4">
                                <button onClick={() => { setEditingTemplateId(template.id); setTemplateFormData(template); }} className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl text-sm">Edit</button>
                                <button onClick={async () => {
                                  if (!supabase || !window.confirm('Delete this template?')) return;
                                  await supabase.from('quote_templates').delete().eq('template_number', template.id);
                                  await fetchQuoteTemplates();
                                }} className="bg-red-500 hover:bg-red-600 px-3 py-2 rounded-xl text-sm">Delete</button>
                                <button onClick={async () => {
                                  if (!supabase) return;
                                  await supabase.from('quote_templates').update({ is_default: false }).neq('id', '');
                                  await supabase.from('quote_templates').update({ is_default: true }).eq('template_number', template.id);
                                  await fetchQuoteTemplates();
                                  setQuoteTemplates((prev: any) => prev.map((item: any) => ({ ...item, isDefault: item.id === template.id })));
                                }} className="bg-green-500 hover:bg-green-600 px-3 py-2 rounded-xl text-sm">Default</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              /* ── CRM LIST PAGES ── */
              ) : (
                <div className="bg-gradient-to-br from-white to-blue-50 rounded-[32px] border border-blue-100 shadow-xl overflow-visible">
                  <div className="p-6 border-b border-blue-100 bg-white sticky top-0 z-10">
                    <div className="flex flex-col xl:flex-row gap-4 xl:items-center xl:justify-between">
                      <div className="flex-1">
                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder={`Search ${activePage} by Name, ID or Customer`}
                          className="w-full xl:max-w-xl border border-blue-200 rounded-2xl px-5 py-3 text-[#0F172A] bg-white shadow-sm" />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-blue-200 rounded-2xl px-5 py-3 bg-white text-[#0F172A] font-medium">
                          <option>All</option>
                          {getStatusOptions().map((status: string) => <option key={status}>{status}</option>)}
                        </select>
                        <select value={timelineFilter} onChange={(e) => setTimelineFilter(e.target.value)} className="border border-blue-200 rounded-2xl px-5 py-3 bg-white text-[#0F172A] font-medium">
                          <option>All Time</option><option>Today</option><option>Last 7 Days</option><option>Last 30 Days</option><option>This Year</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-[#0F172A] to-blue-900 text-white">
                      <tr>
                        <th className="px-6 py-4 text-left">ID</th>
                        <th className="px-6 py-4 text-left">Name</th>
                        <th className="px-6 py-4 text-left">Status</th>
                        <th className="px-6 py-4 text-center w-[160px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((record: any) => (
                        <tr key={record.id} className="border-t border-blue-100 hover:bg-blue-50/60 transition-all duration-200">
                          <td className="px-6 py-4 font-bold text-[#0F172A]">{record.id}</td>
                          <td onClick={() => openDetailsPage(record)} className="px-6 py-4 font-bold text-[#0F172A] underline cursor-pointer hover:text-blue-700 transition-all">
                            {record.name || record.customer}
                          </td>
                          <td className="px-6 py-4 font-bold text-[#0F172A]">{record.status}</td>
                          <td className="px-6 py-4 text-center relative w-[160px] overflow-visible">
                            <button onClick={(e) => { e.stopPropagation(); setOpenActionMenu(openActionMenu === record.id ? null : record.id); }}
                              className="inline-flex w-10 h-10 items-center justify-center rounded-full bg-[#0F172A] text-white hover:bg-blue-800 shadow-lg border border-blue-700 transition-all mx-auto text-2xl font-bold cursor-pointer">
                              ⋮
                            </button>
                            {openActionMenu === record.id && (
                              <div className="absolute right-6 top-16 bg-[#0F172A] border border-blue-800 shadow-2xl rounded-2xl p-2 z-[999] min-w-[220px] overflow-hidden">
                                <button onClick={() => openDetailsPage(record)} className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-800 text-white">Open Details</button>
                                <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-800 text-white">Change Status</button>
                                {activePage === 'leads' && record.status === 'Qualified' && (
                                  <button onClick={() => convertLeadToOpportunity(record)} className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-800 text-white">Convert to Opportunity</button>
                                )}
                                {activePage === 'opportunities' && (
                                  <>
                                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); createQuoteFromOpportunity(record); }} className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-800 text-white">Create Quote</button>
                                    <button onClick={() => createOrderFromOpportunity(record)} className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-800 text-white">Create Order</button>
                                  </>
                                )}
                                {activePage === 'orders' && (
                                  <button onClick={() => createInvoiceFromOrder(record)} className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-800 text-white">Create Invoice</button>
                                )}
                                <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-red-500/20 text-red-300">Delete Record</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── PROFILE PAGE ── */}
            {profilePageOpen && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6 overflow-auto">
                <div className="w-full max-w-4xl bg-white rounded-[36px] shadow-2xl p-10">
                  <div className="flex items-center justify-between mb-10">
                    <div>
                      <h2 className="text-3xl font-bold text-[#0F172A]">My Profile</h2>
                      <p className="text-gray-500 mt-2">Manage your profile and password</p>
                    </div>
                    <button onClick={() => setProfilePageOpen(false)} className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-[#0F172A] font-bold text-xl">✕</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <input value={profileFormData.first_name || ''} onChange={(e) => setProfileFormData({ ...profileFormData, first_name: e.target.value })} className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]" placeholder="First Name" />
                    <input value={profileFormData.last_name || ''} onChange={(e) => setProfileFormData({ ...profileFormData, last_name: e.target.value })} className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]" placeholder="Last Name" />
                    <input value={currentUser?.username || ''} readOnly className="border border-blue-200 rounded-2xl px-5 py-4 bg-gray-50 text-[#0F172A]" />
                    <input value={currentUser?.email || ''} readOnly className="border border-blue-200 rounded-2xl px-5 py-4 bg-gray-50 text-[#0F172A]" />
                    <input value={profileFormData.phone || ''} onChange={(e) => setProfileFormData({ ...profileFormData, phone: e.target.value })} className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]" placeholder="Phone" />
                    <input value={currentUser?.designation || ''} readOnly className="border border-blue-200 rounded-2xl px-5 py-4 bg-gray-50 text-[#0F172A]" />
                  </div>
                  <div className="flex justify-end mt-10">
                    <button onClick={saveMyProfile} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-4 rounded-2xl font-semibold">Save Profile</button>
                  </div>
                  <div className="mt-10 border-t border-blue-100 pt-10">
                    <h3 className="text-2xl font-bold text-[#0F172A] mb-6">Reset Password</h3>
                    <div className="flex gap-4">
                      <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="flex-1 border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500" />
                      <button onClick={resetMyPassword} className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-4 rounded-2xl font-semibold">Update Password</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── DETAILS PANEL ── */}
            {selectedRecord && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] overflow-y-auto">
                <div className="bg-white rounded-[32px] shadow-2xl border border-blue-100 w-[98vw] min-h-[96vh] my-[2vh] mx-auto overflow-hidden flex flex-col">
                  <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-8 py-6 text-white flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-bold capitalize">{getPageLabel(activePage)} Details</h2>
                      <p className="text-blue-100 mt-1">Record ID: {selectedRecord.id}</p>
                    </div>
                    <button onClick={() => setSelectedRecord(null)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20">✕</button>
                  </div>

                  {/* Customer tabs */}
                  {activePage === 'customers' && (
                    <div className="overflow-y-auto px-12 pt-8 pb-8 bg-gradient-to-br from-white to-blue-50">
                      <div className="flex gap-3 border-b border-blue-100 pb-4 flex-wrap">
                        {['details', 'contacts', 'leads', 'opportunities', 'orders', 'invoices', 'activities'].map((tab) => (
                          <button key={tab} onClick={() => setDetailsTab(tab)}
                            className={`px-5 py-3 rounded-2xl font-semibold transition-all capitalize ${detailsTab === tab ? 'bg-[#0F172A] text-white' : 'bg-white border border-blue-200 text-[#0F172A]'}`}>
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Customer sub-tabs */}
                  {activePage === 'customers' && detailsTab !== 'details' && (() => {
                    const tabConfig: Record<string, { title: string; data: any[]; columns: { header: string; key: string; render?: (r: any) => any }[]; page: string }> = {
                      contacts: {
                        title: 'Associated Contacts', page: 'contacts',
                        data: contacts.filter((c: any) => c.customerId === selectedRecord.id || c.customer === selectedRecord.name),
                        columns: [
                          { header: 'Contact Name', key: 'name' },
                          { header: 'Email', key: 'email' },
                          { header: 'Phone', key: 'phone' },
                          { header: 'Primary', key: 'isPrimary', render: (r: any) => selectedRecord.primaryContactId === r.id ? <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">Primary</span> : <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">Secondary</span> },
                          { header: 'Status', key: 'status' },
                        ],
                      },
                      leads: {
                        title: 'Associated Leads', page: 'leads',
                        data: leads.filter((l: any) => l.customerId === selectedRecord.id || l.customer === selectedRecord.name),
                        columns: [{ header: 'Lead', key: 'name' }, { header: 'Source', key: 'source' }, { header: 'Amount', key: 'amount', render: (r: any) => `₹${Number(r.amount || 0).toLocaleString()}` }, { header: 'Status', key: 'status' }],
                      },
                      opportunities: {
                        title: 'Associated Opportunities', page: 'opportunities',
                        data: opportunities.filter((o: any) => o.customerId === selectedRecord.id || o.customer === selectedRecord.name),
                        columns: [{ header: 'Opportunity', key: 'name' }, { header: 'Stage', key: 'stage' }, { header: 'Amount', key: 'amount', render: (r: any) => `₹${Number(r.amount || 0).toLocaleString()}` }, { header: 'Status', key: 'status' }],
                      },
                      orders: {
                        title: 'Associated Orders', page: 'orders',
                        data: orders.filter((o: any) => o.customerId === selectedRecord.id || o.customer === selectedRecord.name),
                        columns: [{ header: 'Order', key: 'name' }, { header: 'Amount', key: 'amount', render: (r: any) => `₹${Number(r.amount || 0).toLocaleString()}` }, { header: 'Status', key: 'status' }],
                      },
                      invoices: {
                        title: 'Associated Invoices', page: 'invoices',
                        data: invoices.filter((inv: any) => inv.customerId === selectedRecord.id),
                        columns: [{ header: 'Invoice', key: 'name' }, { header: 'Amount', key: 'amount', render: (r: any) => `₹${Number(r.amount || 0).toLocaleString()}` }, { header: 'Status', key: 'status' }],
                      },
                      activities: {
                        title: 'Associated Activities', page: 'activities',
                        data: activities.filter((a: any) => a.customerId === selectedRecord.id || a.customer === selectedRecord.name),
                        columns: [{ header: 'Activity', key: 'name' }, { header: 'Type', key: 'activityType' }, { header: 'Date', key: 'activityDate' }, { header: 'Status', key: 'status' }],
                      },
                    };
                    const cfg = tabConfig[detailsTab];
                    if (!cfg) return null;
                    return (
                      <div className="p-8 bg-gradient-to-br from-white to-blue-50">
                        <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
                          <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 text-white">
                            <h3 className="text-xl font-bold">{cfg.title}</h3>
                          </div>
                          {cfg.data.length === 0 ? (
                            <div className="p-6 text-gray-500">No associated {detailsTab} found.</div>
                          ) : (
                            <table className="w-full">
                              <thead className="bg-blue-50">
                                <tr>{cfg.columns.map((col) => <th key={col.header} className="px-6 py-4 text-left text-[#0F172A] font-semibold">{col.header}</th>)}</tr>
                              </thead>
                              <tbody>
                                {cfg.data.map((row: any) => (
                                  <tr key={row.id} className="border-t border-blue-100 hover:bg-blue-50/50">
                                    {cfg.columns.map((col, i) => (
                                      <td key={col.key} className="px-6 py-4">
                                        {col.render ? col.render(row) : i === 0 ? (
                                          <button onClick={() => { setActivePage(cfg.page); openDetailsPage(row); }} className="text-blue-700 underline hover:text-blue-900 font-semibold">{row[col.key]}</button>
                                        ) : row[col.key]}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Details fields */}
                  {detailsTab === 'details' && (
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 bg-gradient-to-br from-white to-blue-50">
                      {getObjectFields().map((field: string) => (
                        <div key={field} className="bg-white rounded-3xl border border-blue-100 p-5 shadow-sm">
                          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-3">{field}</label>
                          {field === 'status' ? (
                            <select value={editedRecord[field] || ''} onChange={(e) => setEditedRecord((prev: any) => ({ ...prev, [field]: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white">
                              {getStatusOptions().map((s: string) => <option key={s}>{s}</option>)}
                            </select>
                          ) : field === 'source' ? (
                            <select value={editedRecord[field] || ''} onChange={(e) => setEditedRecord((prev: any) => ({ ...prev, [field]: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white">
                              <option>Website</option><option>Campaign</option><option>Referral</option>
                            </select>
                          ) : field === 'customer' ? (
                            <select value={editedRecord.customerId || ''} onChange={(e) => { const c = customers.find((x: any) => x.id === e.target.value); setEditedRecord((prev: any) => ({ ...prev, customerId: c?.id || '', customer: c?.name || '', contact: '', contactId: '' })); }} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white">
                              <option value="">Select Customer</option>
                              {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          ) : field === 'primaryContact' ? (
                            <select value={editedRecord.primaryContactId || ''} onChange={(e) => { const c = contacts.find((x: any) => x.id === e.target.value); setEditedRecord((prev: any) => ({ ...prev, primaryContactId: c?.id || '', primaryContact: c?.name || '' })); }} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white">
                              <option value="">Select Primary Contact</option>
                              {contacts.filter((c: any) => c.customerId === editedRecord.id).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          ) : field === 'contact' ? (
                            <select value={editedRecord.contactId || ''} onChange={(e) => { const c = contacts.find((x: any) => x.id === e.target.value); setEditedRecord((prev: any) => ({ ...prev, contactId: c?.id || '', contact: c?.name || '' })); }} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white">
                              <option value="">Select Contact</option>
                              {contacts.filter((c: any) => !editedRecord.customerId || c.customerId === editedRecord.customerId).map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.customer ? ` — ${c.customer}` : ''}</option>)}
                            </select>
                          ) : field === 'activityType' ? (
                            <select value={editedRecord[field] || ''} onChange={(e) => setEditedRecord((prev: any) => ({ ...prev, [field]: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white">
                              <option>Call</option><option>Meeting</option><option>Email</option><option>Task</option><option>Demo</option>
                            </select>
                          ) : field === 'activityDate' || field === 'closeDate' ? (
                            <input type="date" value={editedRecord[field] || ''} onChange={(e) => setEditedRecord((prev: any) => ({ ...prev, [field]: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white" />
                          ) : field === 'notes' ? (
                            <textarea value={editedRecord[field] || ''} onChange={(e) => setEditedRecord((prev: any) => ({ ...prev, [field]: e.target.value }))} rows={4} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white" />
                          ) : field === 'stage' ? (
                            <select value={editedRecord[field] || 'Qualification'} onChange={(e) => setEditedRecord((prev: any) => ({ ...prev, [field]: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white">
                              <option>Qualification</option><option>Proposal Sent</option><option>Negotiation</option><option>Closed Won</option><option>Closed Lost</option>
                            </select>
                          ) : field === 'isPrimary' ? (
                            <select value={editedRecord.isPrimary ? 'Yes' : 'No'} onChange={(e) => setEditedRecord((prev: any) => ({ ...prev, isPrimary: e.target.value === 'Yes' }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]">
                              <option>No</option><option>Yes</option>
                            </select>
                          ) : (
                            <input type={field === 'amount' || field === 'price' ? 'number' : 'text'} value={editedRecord[field] || ''} onChange={(e) => setEditedRecord((prev: any) => ({ ...prev, [field]: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white" />
                          )}
                        </div>
                      ))}

                      {/* System info */}
                      <div className="col-span-full mt-10 w-full border border-gray-200 rounded-[28px] overflow-hidden bg-white shadow-sm">
                        <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-3xl font-bold text-[#0F172A]">System Information</h3>
                              <p className="text-sm text-gray-500 mt-1">System generated audit, ownership and governance information</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-2xl">🛡️</div>
                          </div>
                        </div>
                        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                          {[
                            ['Created By', selectedRecord?.created_by],
                            ['Creation Date', selectedRecord?.created_at ? new Date(selectedRecord.created_at).toLocaleString() : '-'],
                            ['Last Updated By', selectedRecord?.updated_by],
                            ['Last Updated Date', selectedRecord?.updated_at ? new Date(selectedRecord.updated_at).toLocaleString() : '-'],
                            ['Organization', organizations.find((o: any) => o.id === selectedRecord?.organization_id)?.name || '-'],
                            ['Business Unit', businessUnits.find((b: any) => b.id === selectedRecord?.business_unit_id)?.name || '-'],
                          ].map(([label, value]) => (
                            <div key={label} className="space-y-2">
                              <label className="text-xs font-bold tracking-[0.2em] text-gray-500 uppercase">{label}</label>
                              <div className="px-5 py-4 rounded-2xl border border-gray-200 bg-gray-50 text-[#0F172A]">{value || '-'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Line items */}
                  {['leads', 'opportunities', 'orders', 'invoices'].includes(activePage) && (
                    <div className="px-8 pb-8 bg-gradient-to-br from-white to-blue-50">
                      <div className="bg-white rounded-[32px] border border-blue-100 shadow-xl overflow-hidden">
                        <div className="px-8 py-6 border-b border-blue-100 flex items-center justify-between">
                          <div>
                            <h3 className="text-2xl font-bold text-[#0F172A]">Product Line Items</h3>
                            <p className="text-gray-500 mt-1">Manage products, quantity and pricing.</p>
                          </div>
                          <button onClick={() => setLineItems((prev: any) => [...prev, { id: Date.now(), product: '', price: 0, quantity: 1 }])}
                            className="bg-[#0F172A] text-white px-5 py-3 rounded-2xl font-semibold shadow-lg hover:bg-blue-900 transition-all">
                            + Add Product
                          </button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[900px]">
                            <thead className="bg-blue-50 text-[#0F172A]">
                              <tr>
                                <th className="px-6 py-4 text-left">Product</th>
                                <th className="px-6 py-4 text-left">Quantity</th>
                                <th className="px-6 py-4 text-left">Price</th>
                                <th className="px-6 py-4 text-left">Line Total</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lineItems.map((item: any) => (
                                <tr key={item.id} className="border-t border-blue-100 hover:bg-blue-50/50">
                                  <td className="px-6 py-4">
                                    <select value={item.product} onChange={(e) => { const p = products.find((x: any) => x.name === e.target.value); setLineItems((prev: any) => prev.map((l: any) => l.id === item.id ? { ...l, product: e.target.value, price: p?.price || 0 } : l)); }} className="w-full border border-blue-200 rounded-xl px-3 py-3 text-[#0F172A] bg-white">
                                      <option value="">Select Product</option>
                                      {products.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                                    </select>
                                  </td>
                                  <td className="px-6 py-4">
                                    <input type="number" value={item.quantity} onChange={(e) => setLineItems((prev: any) => prev.map((l: any) => l.id === item.id ? { ...l, quantity: Number(e.target.value) } : l))} className="w-24 border border-blue-200 rounded-xl px-3 py-2 text-[#0F172A]" />
                                  </td>
                                  <td className="px-6 py-4">
                                    <input type="number" value={item.price} onChange={(e) => setLineItems((prev: any) => prev.map((l: any) => l.id === item.id ? { ...l, price: Number(e.target.value) } : l))} className="w-36 border border-blue-200 rounded-xl px-3 py-2 text-[#0F172A]" />
                                  </td>
                                  <td className="px-6 py-4 font-semibold text-[#0F172A]">{formatCurrency(item.quantity * item.price)}</td>
                                  <td className="px-6 py-4 text-center">
                                    <button onClick={() => setLineItems((prev: any) => prev.filter((l: any) => l.id !== item.id))} className="text-red-500 hover:text-red-700 font-semibold">Remove</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="px-8 py-6 border-t border-blue-100 bg-white flex justify-end gap-4">
                    <button onClick={() => setSelectedRecord(null)} className="px-6 py-3 rounded-2xl border border-blue-200 text-[#0F172A] font-semibold">Close</button>
                    <button onClick={() => { saveRecordChanges(); setSelectedRecord(null); }} className="bg-[#0F172A] text-white px-6 py-3 rounded-2xl font-semibold shadow-lg">Save Changes</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── CREATE MODAL ── */}
            {createModalOpen && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
                <div className="bg-white rounded-[32px] shadow-2xl border border-blue-100 w-full max-w-2xl overflow-hidden">
                  <div className="px-8 py-6 border-b border-blue-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-bold text-[#0F172A]">Create {getPageLabel(activePage)}</h2>
                      <p className="text-gray-500 mt-1">Add a new record to {activePage}</p>
                    </div>
                    <button onClick={() => setCreateModalOpen(false)} className="w-10 h-10 rounded-full bg-blue-50 text-[#0F172A] font-bold">✕</button>
                  </div>
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[65vh] overflow-y-auto">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold uppercase text-gray-700">Name</label>
                      <input type="text" value={createFormData.name} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, name: e.target.value }))}
                        placeholder={`Enter ${getPageLabel(activePage).toLowerCase()} name`}
                        className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold uppercase text-gray-700">Status</label>
                      <select value={createFormData.status} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, status: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white">
                        <option>New</option><option>Active</option>
                      </select>
                    </div>

                    {activePage === 'customers' && (
                      <>
                        {[['email', 'Email', 'email'], ['phone', 'Phone', 'text'], ['company', 'Company', 'text'], ['industry', 'Industry', 'text'], ['website', 'Website', 'text']].map(([field, label, type]) => (
                          <div key={field} className="space-y-2">
                            <label className="text-sm font-semibold uppercase text-gray-700">{label}</label>
                            <input type={type} value={(createFormData as any)[field] || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, [field]: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                          </div>
                        ))}
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Billing Address</label>
                          <input type="text" value={createFormData.billingAddress || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, billingAddress: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                        </div>
                      </>
                    )}

                    {activePage === 'products' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Category</label>
                          <input type="text" value={createFormData.category || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, category: e.target.value }))} placeholder="Software / Service" className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Price</label>
                          <input type="number" value={createFormData.price || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, price: e.target.value }))} placeholder="25000" className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                        </div>
                      </>
                    )}

                    {/* Customer/Contact selectors shared by multiple pages */}
                    {['contacts', 'activities', 'leads', 'opportunities', 'orders', 'invoices'].includes(activePage) && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Customer</label>
                          <select value={createFormData.customerId || ''} onChange={(e) => { const c = customers.find((x: any) => x.id === e.target.value); setCreateFormData((prev: any) => ({ ...prev, customerId: c?.id || '', customer: c?.name || '', contact: '', contactId: '' })); }} className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]">
                            <option value="">Select Customer</option>
                            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        {['activities', 'leads', 'opportunities', 'orders', 'invoices'].includes(activePage) && (
                          <div className="space-y-2">
                            <label className="text-sm font-semibold uppercase text-gray-700">Contact</label>
                            <select value={createFormData.contactId || ''} onChange={(e) => { const c = contacts.find((x: any) => x.id === e.target.value); setCreateFormData((prev: any) => ({ ...prev, contactId: c?.id || '', contact: c?.name || '' })); }} className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]">
                              <option value="">Select Contact</option>
                              {contacts.filter((c: any) => !createFormData.customerId || c.customerId === createFormData.customerId).map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.customer ? ` — ${c.customer}` : ''}</option>)}
                            </select>
                          </div>
                        )}
                      </>
                    )}

                    {activePage === 'contacts' && (
                      <>
                        {[['email', 'Email', 'email'], ['phone', 'Phone', 'text'], ['designation', 'Designation', 'text'], ['department', 'Department', 'text']].map(([field, label, type]) => (
                          <div key={field} className="space-y-2">
                            <label className="text-sm font-semibold uppercase text-gray-700">{label}</label>
                            <input type={type} value={(createFormData as any)[field] || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, [field]: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                          </div>
                        ))}
                      </>
                    )}

                    {activePage === 'activities' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Subject</label>
                          <input type="text" value={createFormData.subject || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, subject: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Activity Type</label>
                          <select value={createFormData.activityType || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, activityType: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]">
                            <option value="">Select Type</option><option>Call</option><option>Meeting</option><option>Email</option><option>Task</option><option>Demo</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Activity Date</label>
                          <input type="date" value={createFormData.activityDate || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, activityDate: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Notes</label>
                          <textarea value={createFormData.notes || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, notes: e.target.value }))} rows={4} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                        </div>
                      </>
                    )}

                    {activePage === 'leads' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Amount</label>
                          <input type="number" value={createFormData.amount} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, amount: e.target.value }))} placeholder="120000" className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Email</label>
                          <input type="email" value={createFormData.email || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, email: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Phone</label>
                          <input type="text" value={createFormData.phone || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, phone: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Source</label>
                          <select value={createFormData.source || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, source: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]">
                            <option>Website</option><option>Campaign</option><option>Referral</option>
                          </select>
                        </div>
                      </>
                    )}

                    {activePage === 'opportunities' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Amount</label>
                          <input type="number" value={createFormData.amount || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, amount: e.target.value }))} placeholder="200000" className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Close Date</label>
                          <input type="date" value={createFormData.closeDate || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, closeDate: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Stage</label>
                          <select value={createFormData.stage || 'Qualification'} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, stage: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]">
                            <option>Qualification</option><option>Proposal Sent</option><option>Negotiation</option><option>Closed Won</option><option>Closed Lost</option>
                          </select>
                        </div>
                      </>
                    )}

                    {activePage === 'orders' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Delivery Date</label>
                          <input type="date" value={createFormData.deliveryDate || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, deliveryDate: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Shipping Address</label>
                          <input type="text" value={createFormData.shippingAddressOrder || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, shippingAddressOrder: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                        </div>
                      </>
                    )}

                    {activePage === 'invoices' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Due Date</label>
                          <input type="date" value={createFormData.dueDate || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, dueDate: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Payment Terms</label>
                          <select value={createFormData.paymentTerms || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, paymentTerms: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]">
                            <option value="">Select Terms</option><option>Due on Receipt</option><option>Net 15</option><option>Net 30</option><option>Net 45</option>
                          </select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-semibold uppercase text-gray-700">Billing Address</label>
                          <input type="text" value={createFormData.billingAddressInvoice || ''} onChange={(e) => setCreateFormData((prev: any) => ({ ...prev, billingAddressInvoice: e.target.value }))} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]" />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="px-8 py-6 border-t border-blue-100 flex justify-end gap-4">
                    <button onClick={() => setCreateModalOpen(false)} className="px-5 py-3 rounded-2xl border border-blue-200 text-[#0F172A] font-semibold">Cancel</button>
                    <button onClick={createNewRecord} className="bg-[#0F172A] text-white px-6 py-3 rounded-2xl font-semibold">Create {getPageLabel(activePage)}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Hidden printable quote */}
        <div style={{ position: 'fixed', left: '-99999px', top: 0, width: '900px', background: '#ffffff', padding: '40px', zIndex: -1 }}>
          <div ref={printableQuoteRef}>
            {selectedQuoteTemplate && selectedQuoteOpportunity && (
              <div style={{ background: '#ffffff', color: '#000000', fontFamily: 'Arial' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '20px' }}>{selectedQuoteTemplate.quoteTitle}</h1>
                <div style={{ marginBottom: '30px' }}>
                  <div>{selectedQuoteTemplate.companyName}</div>
                  <div>{selectedQuoteTemplate.companyEmail}</div>
                  <div>{selectedQuoteTemplate.companyPhone}</div>
                  <div>{selectedQuoteTemplate.companyAddress}</div>
                </div>
                <hr />
                <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                  <div><strong>Customer:</strong> {selectedQuoteOpportunity.customer}</div>
                  <div><strong>Contact:</strong> {selectedQuoteOpportunity.contact}</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Product', 'Qty', 'Price', 'Amount'].map((h) => <th key={h} style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'left' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {quoteLineItems.map((item: any, i: number) => (
                      <tr key={i}>
                        <td style={{ border: '1px solid #ccc', padding: '10px' }}>{item.product}</td>
                        <td style={{ border: '1px solid #ccc', padding: '10px' }}>{item.quantity}</td>
                        <td style={{ border: '1px solid #ccc', padding: '10px' }}>{formatCurrency(item.price)}</td>
                        <td style={{ border: '1px solid #ccc', padding: '10px' }}>{formatCurrency(item.quantity * item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Quote preview modal */}
        {quotePreviewOpen && selectedQuoteOpportunity && selectedQuoteTemplate && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[120] p-6 overflow-auto">
            <div className="bg-white rounded-[32px] shadow-2xl border border-blue-100 w-full max-w-6xl overflow-hidden">
              <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-8 py-6 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold">Quote Preview</h2>
                  <p className="text-blue-100 mt-1">Opportunity: {selectedQuoteOpportunity.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => window.print()} className="bg-white/10 hover:bg-white/20 px-5 py-3 rounded-2xl font-semibold">Print</button>
                  <button onClick={downloadQuotePDF} className="bg-white text-[#0F172A] px-5 py-3 rounded-2xl font-bold">Download PDF</button>
                  <button onClick={() => setQuotePreviewOpen(false)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20">✕</button>
                </div>
              </div>
              <div className="p-10 bg-gray-100 overflow-auto max-h-[80vh] print:bg-white">
                <div ref={quotePreviewRef} style={{ background: '#ffffff', color: '#000000' }} className="bg-white rounded-[24px] p-12 max-w-4xl mx-auto">
                  <div className="flex items-start justify-between border-b pb-8">
                    <div>
                      <h1 className="text-4xl font-bold text-[#0F172A]">{selectedQuoteTemplate.quoteTitle}</h1>
                      <div className="mt-4 text-gray-600 space-y-1">
                        <div>{selectedQuoteTemplate.companyName}</div>
                        <div>{selectedQuoteTemplate.companyEmail}</div>
                        <div>{selectedQuoteTemplate.companyPhone}</div>
                        <div>{selectedQuoteTemplate.companyAddress}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Quote Date</div>
                      <div className="font-semibold mt-1">{new Date().toLocaleDateString()}</div>
                      <div className="text-sm text-gray-500 mt-5">Opportunity</div>
                      <div className="font-semibold mt-1">{selectedQuoteOpportunity.id}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-8 mt-10">
                    <div>
                      <div className="text-sm text-gray-500 mb-2">Customer</div>
                      <div className="text-xl font-bold text-[#0F172A]">{selectedQuoteOpportunity.customer}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-2">Contact</div>
                      <div className="text-xl font-bold text-[#0F172A]">{selectedQuoteOpportunity.contact}</div>
                    </div>
                  </div>
                  <div className="mt-10 overflow-hidden rounded-2xl border border-blue-100">
                    <table className="w-full">
                      <thead className="bg-[#0F172A] text-white">
                        <tr>
                          <th className="px-6 py-4 text-left">Product</th>
                          <th className="px-6 py-4 text-left">Quantity</th>
                          <th className="px-6 py-4 text-left">Price</th>
                          <th className="px-6 py-4 text-left">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quoteLineItems.map((item: any, i: number) => (
                          <tr key={i} className="border-t border-blue-100">
                            <td className="px-6 py-4">{item.product}</td>
                            <td className="px-6 py-4">{item.quantity}</td>
                            <td className="px-6 py-4">{formatCurrency(item.price)}</td>
                            <td className="px-6 py-4 font-semibold">{formatCurrency(item.quantity * item.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end mt-8">
                    <div className="bg-blue-50 rounded-2xl px-8 py-6 w-[320px]">
                      <div className="flex justify-between text-lg">
                        <span>Total</span>
                        <span className="font-bold text-[#0F172A]">{formatCurrency(quoteLineItems.reduce((sum: number, item: any) => sum + item.quantity * item.price, 0))}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-12">
                    <div className="text-lg font-bold text-[#0F172A] mb-3">Terms & Conditions</div>
                    <div className="text-gray-600 leading-relaxed">{selectedQuoteTemplate.termsAndConditions}</div>
                  </div>
                  <div className="mt-12 border-t pt-6 text-gray-500 text-sm">{selectedQuoteTemplate.footerText}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Role form modal */}
        {roleFormOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[140] flex items-center justify-center p-6">
            <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-5xl border border-blue-100 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-8 py-6 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold">{adminModalMode === 'editRole' ? 'Edit Role' : 'Create Role'}</h2>
                  <p className="text-blue-100 mt-2">Configure enterprise security role and permissions</p>
                </div>
                <button onClick={() => { setRoleFormOpen(false); setSelectedRolePermissions([]); }} className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-2xl">✕</button>
              </div>
              <div className="p-8 grid grid-cols-1 xl:grid-cols-2 gap-8 max-h-[80vh] overflow-y-auto">
                <div className="space-y-5">
                  {[['Role Name', 'role_name'], ['Role Code', 'role_code']].map(([label, field]) => (
                    <div key={field}>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">{label}</label>
                      <input value={(roleFormData as any)[field]} onChange={(e) => setRoleFormData({ ...roleFormData, [field]: e.target.value })}
                        className="w-full border border-blue-200 rounded-2xl px-5 py-4 bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">Description</label>
                    <textarea rows={5} value={roleFormData.description} onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                      className="w-full border border-blue-200 rounded-2xl px-5 py-4 bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">Status</label>
                    <select value={roleFormData.status} onChange={(e) => setRoleFormData({ ...roleFormData, status: e.target.value })}
                      className="w-full border border-blue-200 rounded-2xl px-5 py-4 bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Active</option><option>Inactive</option>
                    </select>
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-[#0F172A] mb-6">Permissions</h3>
                  <div className="space-y-6">
                    {Array.from(new Set(permissions.map((p) => p.module_name))).map((moduleName) => (
                      <div key={moduleName} className="border border-blue-100 rounded-3xl p-5">
                        <h4 className="text-lg font-bold text-[#0F172A] mb-4">{moduleName}</h4>
                        <div className="space-y-3">
                          {permissions.filter((p) => p.module_name === moduleName).map((permission) => (
                            <label key={permission.id} className="flex items-center gap-3 text-gray-700">
                              <input type="checkbox" checked={selectedRolePermissions.includes(permission.id)} onChange={(e) => {
                                if (e.target.checked) setSelectedRolePermissions([...selectedRolePermissions, permission.id]);
                                else setSelectedRolePermissions(selectedRolePermissions.filter((id) => id !== permission.id));
                              }} />
                              <span>{permission.permission_name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-8 py-6 border-t border-blue-100 flex justify-end">
                <button onClick={saveRole} className="bg-gradient-to-r from-[#0F172A] to-blue-900 text-white px-8 py-4 rounded-2xl font-semibold shadow-lg">
                  {adminModalMode === 'editRole' ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
