'use client';
// @ts-nocheck

import React, { useEffect, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '@/lib/supabase';
import { createClient }
from '@supabase/supabase-js';
import { flushSync } from 'react-dom';
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

const navigationItems = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'customers', label: 'Customers', icon: '👥' },
  { key: 'products', label: 'Products', icon: '📦' },
  { key: 'leads', label: 'Leads', icon: '🎯' },
  { key: 'opportunities', label: 'Opportunities', icon: '💼' },
  { key: 'activities', label: 'Activities', icon: '📅' },
  { key: 'contacts', label: 'Contacts', icon: '📇' },
  { key: 'orders', label: 'Orders', icon: '🛒' },
  { key: 'invoices', label: 'Invoices', icon: '🧾' },
  { key: 'adminTools', label: 'Admin Tools', icon: '⚙️' },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
};
const adminSupabase =
  createClient(

    process.env
      .NEXT_PUBLIC_SUPABASE_URL!,

    process.env
      .NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!

  );

export default function AIBillingApp() {
  const [session, setSession] =
  useState<any>(null);

const [authLoading, setAuthLoading] =
  useState(true);

const [loginForm, setLoginForm] =
  useState({
    email: '',
    password: '',
  });
  const [
  profileMenuOpen,
  setProfileMenuOpen
] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<any[]>([
    {
      type: 'assistant',
      text: 'Welcome to AI Billing Agent. Ask me about revenue, leads, opportunities, invoices or orders.',
    },
  ]);
  const [selectedTimeline, setSelectedTimeline] = useState('Last 30 Days');
  const [editedRecord, setEditedRecord] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [timelineFilter, setTimelineFilter] = useState('All Time');
  const [detailsTab, setDetailsTab] = useState('details');
  const [
  customerSections,
  setCustomerSections
] = useState({
  company: true,
  address: true,
});
  const [adminToolPage, setAdminToolPage] = useState('home');
  const [
  organizations,
  setOrganizations
] = useState<any[]>([]);

const [
  businessUnits,
  setBusinessUnits
] = useState<any[]>([]);

const [
  enterpriseUsers,
  setEnterpriseUsers
] = useState<any[]>([]);

const [
  userGroups,
  setUserGroups
] = useState<any[]>([]);

const [
  userGroupFormOpen,
  setUserGroupFormOpen
] = useState(false);

const [
  userGroupFormData,
  setUserGroupFormData
] = useState({

  group_name: '',
  group_code: '',
  description: '',
  organization_id: '',
  business_unit_id: '',
  status: 'Active',

});

const [
  currentUser,
  setCurrentUser
] = useState<any>(null);
const [
  profilePageOpen,
  setProfilePageOpen
] = useState(false);

const [
  newPassword,
  setNewPassword
] = useState('');

const [
  profileFormData,
  setProfileFormData
] = useState({

  first_name: '',
  last_name: '',
  phone: '',
  designation: '',

});

const [
  userFormOpen,
  setUserFormOpen
] = useState(false);

const [
  userFormData,
  setUserFormData
] = useState({

  employee_code: '',
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  temporary_password: '',
  phone: '',
  designation: '',
  organization_id: '',
  business_unit_id: '',
  status: 'Active',

});

const [
  organizationFormOpen,
  setOrganizationFormOpen
] = useState(false);

const [
  businessUnitFormOpen,
  setBusinessUnitFormOpen
] = useState(false);

const [
  organizationFormData,
  setOrganizationFormData
] = useState({

  name: '',
  organization_code: '',
  status: 'Active',
  industry: '',
  website: '',
  country: '',
  timezone: '',
  currency: '',

});

const [
  businessUnitFormData,
  setBusinessUnitFormData
] = useState({

  name: '',
  business_unit_code: '',
  organization_id: '',
  status: 'Active',

});

const [quoteTemplates, setQuoteTemplates] = useState<any[]>([
  {
    id: 'TEMP-001',
    name: 'Default Quote Template',
    isDefault: true,
    companyName: 'Your Company',
    companyEmail: 'sales@company.com',
    companyPhone: '+91 9999999999',
    companyAddress: 'Delhi, India',
    quoteTitle: 'Quotation',
    footerText: 'Thank you for your business.',
    termsAndConditions:
      'Payment due within 15 days.',
    primaryColor: '#0F172A',
    secondaryColor: '#1E3A8A',
  },
]);

const [templateFormData, setTemplateFormData] =
  useState<any>({
    name: '',
    companyName: '',
    companyEmail: '',
    companyPhone: '',
    companyAddress: '',
    quoteTitle: 'Quotation',
    footerText: '',
    termsAndConditions: '',
    primaryColor: '#0F172A',
    secondaryColor: '#1E3A8A',
  });
  const [editingTemplateId, setEditingTemplateId] =
  useState<string | null>(null);
  const [quotePreviewOpen, setQuotePreviewOpen] =
  useState(false);

const [selectedQuoteOpportunity, setSelectedQuoteOpportunity] =
  useState<any>(null);

const [selectedQuoteTemplate, setSelectedQuoteTemplate] =
  useState<any>(null);

const [quoteLineItems, setQuoteLineItems] =

  useState<any[]>([]);
  const printableQuoteRef =
  useRef<HTMLDivElement | null>(null);
  const saveOrganization =
  async () => {

  if (!supabase) return;

  const { error } =
    await supabase
      .from('organizations')
      .insert([
        {
          ...organizationFormData,
        },
      ]);

  if (!error) {

    setOrganizationFormOpen(
      false
    );

    setOrganizationFormData({

      name: '',
      organization_code: '',
      status: 'Active',
      industry: '',
      website: '',
      country: '',
      timezone: '',
      currency: '',

    });

    fetchOrganizations();

  }

};
const saveBusinessUnit =
  async () => {

  if (!supabase) return;

  const { error } =
    await supabase
      .from('business_units')
      .insert([
        {
          ...businessUnitFormData,
        },
      ]);

  if (!error) {

    setBusinessUnitFormOpen(
      false
    );

    setBusinessUnitFormData({

      name: '',
      business_unit_code: '',
      organization_id: '',
      status: 'Active',

    });

    fetchBusinessUnits();

  }

};
const saveEnterpriseUser =
  async () => {

  if (!supabase) return;

  const {
    data: authData,
    error: authError,
  } =
    await adminSupabase.auth.admin.createUser({

      email:
        userFormData.email,

      password:
        userFormData.temporary_password,

      email_confirm: true,

    });

  if (authError) {

    alert(authError.message);

    return;

  }

  const authUserId =
    authData.user.id;

  const { error } =
    await supabase
      .from('enterprise_users')
      .insert([
        {
          ...userFormData,

          auth_user_id:
            authUserId,
        },
      ]);

  if (!error) {

    setUserFormOpen(false);

    setUserFormData({

      employee_code: '',
      username: '',
      first_name: '',
      last_name: '',
      email: '',
      temporary_password: '',
      phone: '',
      designation: '',
      organization_id: '',
      business_unit_id: '',
      status: 'Active',

    });

    fetchEnterpriseUsers();

  }

};

const saveUserGroup =
  async () => {

  if (!supabase) return;

  const { error } =
    await supabase
      .from('user_groups')
      .insert([
        {
          ...userGroupFormData,
        },
      ]);

  if (!error) {

    setUserGroupFormOpen(
      false
    );

    setUserGroupFormData({

      group_name: '',
      group_code: '',
      description: '',
      organization_id: '',
      business_unit_id: '',
      status: 'Active',

    });

    fetchUserGroups();

  }

};
const handleLogin = async () => {

  if (!supabase) return;

  const { error } =
    await supabase.auth.signInWithPassword({

      email: loginForm.email,

      password:
        loginForm.password,

    });

  if (error) {

    alert(error.message);

  }

};
const handleLogout = async () => {

  if (!supabase) return;

  await supabase.auth.signOut();

};
const resetMyPassword =
  async () => {

  if (!supabase) return;

  const { error } =
    await supabase.auth.updateUser({

      password: newPassword,

    });

  if (!error) {

    alert(
      'Password Updated'
    );

    setNewPassword('');

  }

};
const saveMyProfile =
  async () => {

  if (!supabase || !currentUser)
    return;

  const { error } =
    await supabase
      .from('enterprise_users')
      .update({

        first_name:
          profileFormData.first_name,

        last_name:
          profileFormData.last_name,

        phone:
          profileFormData.phone,

        

      })
      .eq(
        'id',
        currentUser.id
      );

  if (!error) {

    await fetchCurrentUser();

    await fetchEnterpriseUsers();

    alert(
      'Profile Updated'
    );

  }

};
  const fetchCustomers = async () => {
    if (!supabase) return;
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error && data) {
    setCustomers(
  data.map((customer:any) => ({
    id: customer.customer_number,
    primaryContactId: customer.primary_contact_id,
    primaryContact:
  contacts.find(
    (c:any) =>
      c.id === customer.primary_contact_id
  )?.name || '',
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    company: customer.company,
    industry: customer.industry,
    billingAddress: customer.billing_address,
    shippingAddress: customer.shipping_address,
    city: customer.city,
    state: customer.state,
    postalCode: customer.postal_code,
    country: customer.country,
    website: customer.website,
    gstNumber: customer.gst_number,
    status: customer.status,
  }))
);
  }

  console.log(error);
};

const fetchOrganizations =
  async () => {

  if (!supabase) return;

  const { data } =
    await supabase
      .from('organizations')
      .select('*')
      .order('created_at', {
        ascending: false,
      });

  if (data) {

    setOrganizations(data);

  }

};

const fetchBusinessUnits =
  async () => {

  if (!supabase) return;

  const { data } =
    await supabase
      .from('business_units')
      .select('*')
      .order('created_at', {
        ascending: false,
      });

  if (data) {

    setBusinessUnits(data);

  }

};
const fetchEnterpriseUsers =
  async () => {

  if (!supabase) return;

  const { data } =
    await supabase
      .from('enterprise_users')
      .select('*')
      .order('created_at', {
        ascending: false,
      });

  if (data) {

    setEnterpriseUsers(data);

  }

};
const fetchUserGroups =
  async () => {

  if (!supabase) return;

  const { data } =
    await supabase
      .from('user_groups')
      .select('*')
      .order('created_at', {
        ascending: false,
      });

  if (data) {

    setUserGroups(data);

  }

};

const fetchCurrentUser =
  async () => {

  if (!supabase || !session)
    return;

  const { data } =
    await supabase
      .from('enterprise_users')
      .select('*')
      .eq(
        'auth_user_id',
        session.user.id
      )
      .single();

  if (data) {

  setCurrentUser(data);

  setProfileFormData({

    first_name:
      data.first_name || '',

    last_name:
      data.last_name || '',

    phone:
      data.phone || '',

    designation:
      data.designation || '',

  });

}

};

const fetchProducts = async () => {
  if (!supabase) return;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error && data) {
    setProducts(
      data.map((product:any) => ({
        id: product.product_number,
        name: product.name,
        category: product.category,
        price: Number(product.price || 0),
        status: product.status,
      }))
    );
  }

  console.log(error);
};
const fetchLeads = async () => {
  if (!supabase) return;

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error && data) {
    setLeads(
      data.map((lead:any) => ({
        id: lead.lead_number,
        name: lead.name,
        customer: lead.customer,
customerId: lead.customer_id,
contact: lead.contact,
contactId: lead.contact_id,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        amount: Number(lead.amount || 0),
        status: lead.status,
      }))
    );
  }

  console.log(error);
};
const fetchLeadLineItems = async (leadNumber:string) => {

  if (!supabase) return;

  const { data, error } = await supabase
    .from('lead_line_items')
    .select('*')
    .eq('lead_number', leadNumber);

  if (!error && data && data.length > 0) {

    setLineItems(
      data.map((item:any) => ({
        id: item.id,
        product: item.product_name,
        quantity: Number(item.quantity || 1),
        price: Number(item.price || 0),
      }))
    );

  } else {

    setLineItems([]);
  }

  console.log(error);
};
const fetchOpportunities = async () => {

  if (!supabase) return;

  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error && data) {

    setOpportunities(
      data.map((opp:any) => ({
        id: opp.opportunity_number,
        name: opp.name,
        customer: opp.customer,
customerId: opp.customer_id,
contact: opp.contact,
contactId: opp.contact_id,
        stage: opp.stage,
        amount: Number(opp.amount || 0),
        closeDate: opp.close_date,
        status: opp.status,
      }))
    );
  }

  console.log(error);
};
const fetchOpportunityLineItems = async (
  opportunityNumber:string
) => {

  if (!supabase) return;

  const { data, error } = await supabase
    .from('opportunity_line_items')
    .select('*')
    .eq('opportunity_number', opportunityNumber);

  if (!error && data && data.length > 0) {

    setLineItems(
      data.map((item:any) => ({
        id: item.id,
        product: item.product_name,
        quantity: Number(item.quantity || 1),
        price: Number(item.price || 0),
      }))
    );

  } else {

    setLineItems([]);
  }

  console.log(error);
};
const fetchOrders = async () => {

  if (!supabase) return;

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error && data) {

    setOrders(
      data.map((order:any) => ({
        id: order.order_number,
        customer: order.customer,
customerId: order.customer_id,
contact: order.contact,
contactId: order.contact_id,
        name: order.name,
        amount: Number(order.amount || 0),
        shippingAddress: order.shipping_address,
        deliveryDate: order.delivery_date,
        status: order.status,
      }))
    );
  }

  console.log(error);
};

const fetchOrderLineItems = async (
  orderNumber:string
) => {

  if (!supabase) return;

  const { data, error } = await supabase
    .from('order_line_items')
    .select('*')
    .eq('order_number', orderNumber);

  if (!error && data && data.length > 0) {

    setLineItems(
      data.map((item:any) => ({
        id: item.id,
        product: item.product_name,
        quantity: Number(item.quantity || 1),
        price: Number(item.price || 0),
      }))
    );

  } else {

    setLineItems([]);
  }

  console.log(error);
};
const fetchInvoices = async () => {

  if (!supabase) return;

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error && data) {

    setInvoices(
      data.map((invoice:any) => ({
        id: invoice.invoice_number,
       customer: invoice.customer,
customerId: invoice.customer_id,
contact: invoice.contact,
contactId: invoice.contact_id,
        name: invoice.name,
        amount: Number(invoice.amount || 0),
        dueDate: invoice.due_date,
        paymentTerms: invoice.payment_terms,
        billingAddress: invoice.billing_address,
        status: invoice.status,
      }))
    );
  }

  console.log(error);
};


const fetchInvoiceLineItems = async (
  invoiceNumber:string
) => {

  if (!supabase) return;

  const { data, error } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_number', invoiceNumber);

  if (!error && data && data.length > 0) {

    setLineItems(
      data.map((item:any) => ({
        id: item.id,
        product: item.product_name,
        quantity: Number(item.quantity || 1),
        price: Number(item.price || 0),
      }))
    );

  } else {

    setLineItems([]);
  }

  console.log(error);
};
const fetchContacts = async () => {

  if (!supabase) return;

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error && data) {

    setContacts(
      data.map((contact:any) => ({
        id: contact.contact_number,
        customerId: contact.customer_id,
        isPrimary: contact.is_primary || false,
        customer: contact.customer,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        designation: contact.designation,
        department: contact.department,
        status: contact.status,
      }))
    );
  }

  console.log(error);
};

const fetchActivities = async () => {

  if (!supabase) return;

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error && data) {

   setActivities(
  data.map((activity:any) => ({
    id: activity.activity_number,
    customerId: activity.customer_id,
    contactId: activity.contact_id,
    name: activity.name,
    customer: activity.customer,
    contact: activity.contact,
    subject: activity.subject,
    activityType: activity.activity_type,
    activityDate: activity.activity_date,
    notes: activity.notes,
    status: activity.status,
  }))
);
  }

  console.log(error);
};
const fetchQuoteTemplates = async () => {

  if (!supabase) return;

  const { data, error } = await supabase
    .from('quote_templates')
    .select('*')
    .order('created_at', {
      ascending: false,
    });

  if (!error && data) {

    setQuoteTemplates(
      data.map((template:any) => ({
        id: template.template_number,
        dbId: template.id,
        name: template.name,
        isDefault: template.is_default,
        companyName: template.company_name,
        companyEmail: template.company_email,
        companyPhone: template.company_phone,
        companyAddress: template.company_address,
        quoteTitle: template.quote_title,
        footerText: template.footer_text,
        termsAndConditions:
          template.terms_and_conditions,
        primaryColor:
          template.primary_color,
        secondaryColor:
          template.secondary_color,
      }))
    );
  }

  console.log(error);
};
useEffect(() => {

  if (!supabase) return;

  supabase.auth.getSession()
    .then(({ data: { session } }) => {

      setSession(session);

      setAuthLoading(false);

    });

  const {
    data: authListener,
  } = supabase.auth.onAuthStateChange(
    (_event, session) => {

      setSession(session);

    }
  );

  return () => {

    authListener.subscription.unsubscribe();

  };

}, []);

useEffect(() => {

  if (!session) return;

  fetchCustomers();

  fetchProducts();

  fetchLeads();

  fetchOpportunities();

  fetchOrders();

  fetchInvoices();

  fetchContacts();

  fetchActivities();

  fetchQuoteTemplates();

  fetchOrganizations();

  fetchBusinessUnits();

  fetchEnterpriseUsers();

  fetchUserGroups();

  fetchCurrentUser();

}, [session]);

  const [createFormData, setCreateFormData] = useState<any>({
    name: '',
    customer: '',
    status: 'New',
    amount: '',
    email: '',
    phone: '',
    source: '',
    category: '',
    price: '',
    company: '',
    industry: '',
    billingAddress: '',
    shippingAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    website: '',
    gstNumber: '',
    stage: 'Qualification',
    closeDate: '',
    shippingAddressOrder: '',
    deliveryDate: '',
    dueDate: '',
    paymentTerms: '',
  });
const [lineItems, setLineItems] = useState<any[]>([]);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const navigatorRef = useRef<HTMLElement | null>(null);
  const quotePreviewRef = useRef<HTMLDivElement | null>(null);

const [customers, setCustomers] = useState<any[]>([]);

  const addCustomer = async () => {
if (!supabase) return;
  const { data, error } = await supabase
    .from('customers')
    .insert([
      {
        name: 'Test Customer',
        company: 'ABC Corp',
        email: 'test@test.com',
        phone: '9999999999',
        status: 'Active',
      },
    ]);

  console.log('DATA:', data);
  console.log('ERROR:', error);

  if (!error) {
    alert('Customer inserted successfully');
  } else {
    alert('Supabase insert failed');
  }
};

const [products, setProducts] = useState<any[]>([]);

const [leads, setLeads] = useState<any[]>([]);

const [opportunities, setOpportunities] = useState<any[]>([]);

const [orders, setOrders] = useState<any[]>([]);

 const [invoices, setInvoices] = useState<any[]>([]);
 const [contacts, setContacts] = useState<any[]>([]);

const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {

      if (
        navigatorRef.current &&
        !navigatorRef.current.contains(event.target as Node)
      ) {
        setSidebarCollapsed(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAIQuery = (query: string) => {
    const lowerQuery = query.toLowerCase();

    let response = 'I could not find relevant CRM insights for your request.';

    if (lowerQuery.includes('revenue')) {
      const revenue = invoices.reduce(
        (sum: any, invoice: any) => sum + (invoice.amount || 0),
        0
      );

      response = `Total revenue generated is ${formatCurrency(revenue)} from ${invoices.length} invoice(s).`;
    } else if (
      lowerQuery.includes('qualified') ||
      lowerQuery.includes('lead')
    ) {
      const qualifiedLeads = leads.filter(
        (lead: any) => lead.status === 'Qualified'
      ).length;

      const convertedLeads = leads.filter(
        (lead: any) => lead.status === 'Converted'
      ).length;

      response = `There are ${qualifiedLeads} qualified lead(s) and ${convertedLeads} converted lead(s) in the CRM.`;
    } else if (
      lowerQuery.includes('invoice') ||
      lowerQuery.includes('order')
    ) {
      const pendingInvoices = invoices.filter(
        (invoice: any) => invoice.status === 'Pending'
      ).length;

      const processingOrders = orders.filter(
        (order: any) => order.status === 'Processing'
      ).length;

      response = `There are ${pendingInvoices} pending invoice(s) and ${processingOrders} processing order(s).`;
    } else if (lowerQuery.includes('opportunit')) {
      response = `There are ${opportunities.length} opportunity record(s) with estimated pipeline value of ${formatCurrency(
        opportunities.reduce(
          (sum: any, opp: any) => sum + (opp.amount || 0),
          0
        )
      )}.`;
    } else if (lowerQuery.includes('customer')) {
      response = `There are ${customers.length} active customer record(s) currently managed in CRM.`;
    }

    setAiMessages((prev) => [
      ...prev,
      {
        type: 'user',
        text: query,
      },
      {
        type: 'assistant',
        text: response,
      },
    ]);
  };

const openDetailsPage = async (record: any) => {

  setSelectedRecord(record);
  setDetailsTab('details');

  setEditedRecord(record);

 if (activePage === 'leads') {

  await fetchLeadLineItems(record.id);

} else if (activePage === 'opportunities') {

  await fetchOpportunityLineItems(record.id);

} else if (activePage === 'orders') {

  await fetchOrderLineItems(record.id);

} else if (activePage === 'invoices') {

  await fetchInvoiceLineItems(record.id);

} else {

  setLineItems([]);
}

  setOpenActionMenu(null);
};

  const getObjectFields = () => {
    switch (activePage) {
      case 'customers':
        return [
          'name',
          'email',
          'phone',
          'company',
          'industry',
          'billingAddress',
          'shippingAddress',
          'city',
          'state',
          'postalCode',
          'country',
          'website',
          'gstNumber',
          'primaryContact',
          'status',
        ];
      case 'products':
        return ['name', 'category', 'price', 'status'];
      case 'leads':
  return [
    'leadNumber',
    'customer',
    'contact',
    'name',
    'email',
    'phone',
    'source',
    'status',
    'amount',
  ];
      case 'opportunities':
  return [
    'customer',
    'contact',
    'name',
    'stage',
    'closeDate',
    'status',
    'amount',
  ];
      case 'orders':
  return [
    'customer',
    'contact',
    'name',
    'shippingAddress',
    'deliveryDate',
    'status',
    'amount',
  ];
      case 'invoices':
  return [
    'customer',
    'contact',
    'name',
    'dueDate',
    'paymentTerms',
    'billingAddress',
    'status',
    'amount',
  ];
        case 'contacts':
  return [
    'customer',
    'name',
    'email',
    'phone',
    'designation',
    'department',
    'isPrimary',
    'status',
  ];

case 'activities':
  return [
    'name',
    'customer',
    'contact',
    'subject',
    'activityType',
    'activityDate',
    'notes',
    'status',
  ];
      default:
        return ['name', 'status'];
    }
  };
const createNewRecord = async () => {
  if (activePage === 'customers') {
    if (!supabase) return;
    const { error } = await supabase
      .from('customers')
      .insert([
        {
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
        },
      ]);

if (!error) {
  await fetchCustomers();

  setCreateModalOpen(false);

  setCreateFormData({});

  return;
}

console.log(error);
  }

  if (activePage === 'products') {
  if (!supabase) return;

  const { error } = await supabase
    .from('products')
    .insert([
      {
        product_number: `PROD-${Date.now()}`,
        name: createFormData.name,
        category: createFormData.category,
        price: Number(createFormData.price || 0),
        status: createFormData.status || 'Active',
      },
    ]);

  if (!error) {
    await fetchProducts();

    setCreateModalOpen(false);

    setCreateFormData({});

    return;
  }

  console.log(error);
}
if (activePage === 'leads') {
  const leadNumber = `LEAD-${Date.now()}`;
  if (!supabase) return;

  const { error } = await supabase
    .from('leads')
    .insert([
      {
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
      },
    ]);

  if (!error) {
    await supabase
  .from('lead_line_items')
  .insert(
    lineItems.map((item:any) => ({
      lead_number: leadNumber,
      product_name: item.product,
      quantity: item.quantity,
      price: item.price,
    }))
  );
    await fetchLeads();
    setLineItems([]);
    setCreateModalOpen(false);

    setCreateFormData({});

    return;
  }

  console.log(error);
}
if (activePage === 'opportunities') {

  if (!supabase) return;

  const opportunityNumber = `OPP-${Date.now()}`;

  const { error } = await supabase
    .from('opportunities')
    .insert([
      {
        opportunity_number: opportunityNumber,
        name: createFormData.name,
        customer: createFormData.customer,
customer_id: createFormData.customerId,
contact: createFormData.contact,
contact_id: createFormData.contactId,
        stage: createFormData.stage,
        amount: Number(createFormData.amount || 0),
        close_date: createFormData.closeDate,
        status: createFormData.status || 'Open',
      },
    ]);

  if (!error) {

    await fetchOpportunities();
    setLineItems([]);
    setCreateModalOpen(false);

    setCreateFormData({});

    return;
  }

  console.log(error);
}
if (activePage === 'orders') {

  if (!supabase) return;

  const orderNumber = `ORD-${Date.now()}`;

  const calculatedAmount = lineItems.reduce(
    (sum:number, item:any) =>
      sum + (
        Number(item.quantity || 0) *
        Number(item.price || 0)
      ),
    0
  );

  const { error } = await supabase
    .from('orders')
    .insert([
      {
        order_number: orderNumber,
        customer: createFormData.customer,
customer_id: createFormData.customerId,
contact: createFormData.contact,
contact_id: createFormData.contactId,
        name: createFormData.name,
        amount: calculatedAmount,
        shipping_address: createFormData.shippingAddressOrder,
        delivery_date: createFormData.deliveryDate,
        status: createFormData.status || 'Processing',
      },
    ]);

  if (!error) {

    if (lineItems.length > 0) {

      await supabase
        .from('order_line_items')
        .insert(
          lineItems.map((item:any) => ({
            order_number: orderNumber,
            product_name: item.product,
            quantity: item.quantity,
            price: item.price,
          }))
        );
    }

    await fetchOrders();

    setLineItems([]);

    setCreateModalOpen(false);

    setCreateFormData({});

    return;
  }

  console.log(error);
}
if (activePage === 'invoices') {

  if (!supabase) return;

  const invoiceNumber = `INV-${Date.now()}`;

  const calculatedAmount = lineItems.reduce(
    (sum:number, item:any) =>
      sum + (
        Number(item.quantity || 0) *
        Number(item.price || 0)
      ),
    0
  );

  const { error } = await supabase
    .from('invoices')
    .insert([
      {
        invoice_number: invoiceNumber,
        customer: createFormData.customer,
customer_id: createFormData.customerId,
contact: createFormData.contact,
contact_id: createFormData.contactId,
        name: createFormData.name,
        amount: calculatedAmount,
        due_date: createFormData.dueDate,
        payment_terms: createFormData.paymentTerms,
        billing_address: createFormData.billingAddressInvoice,
        status: createFormData.status || 'Pending',
      },
    ]);

  if (!error) {

    if (lineItems.length > 0) {

      await supabase
        .from('invoice_line_items')
        .insert(
          lineItems.map((item:any) => ({
            invoice_number: invoiceNumber,
            product_name: item.product,
            quantity: item.quantity,
            price: item.price,
          }))
        );
    }

    await fetchInvoices();

    setLineItems([]);

    setCreateModalOpen(false);

    setCreateFormData({});

    return;
  }

  console.log(error);
}
if (activePage === 'contacts') {

  if (!supabase) return;

  const contactNumber = `CONT-${Date.now()}`;

  const { error } = await supabase
    .from('contacts')
    .insert([
      {
        contact_number: contactNumber,
        customer: createFormData.customer,
        customer_id: createFormData.customerId,
        name: createFormData.name,
        email: createFormData.email,
        phone: createFormData.phone,
        designation: createFormData.designation,
        department: createFormData.department,
        status: createFormData.status || 'Active',
      },
    ]);

  if (!error) {

    await fetchContacts();

    setCreateModalOpen(false);

    setCreateFormData({});

    return;
  }

  console.log(error);
}

if (activePage === 'activities') {

  if (!supabase) return;

  const activityNumber = `ACT-${Date.now()}`;

  const { error } = await supabase
    .from('activities')
    .insert([
      {
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
      },
    ]);

  if (!error) {

    await fetchActivities();

    setCreateModalOpen(false);

    setCreateFormData({});

    return;
  }

  console.log(error);
}

  const newRecord = {
    id: `${activePage.slice(0, 3).toUpperCase()}-${Date.now()}`,
    ...createFormData,
    amount: Number(createFormData.amount || 0),
    price: Number(createFormData.price || 0),
    status: createFormData.status || getStatusOptions()[0],
    lineItems: [],
  };

if (activePage === 'leads') {
  setLeads((prev: any[]) => [...prev, newRecord]);
} else if (activePage === 'opportunities') {
  setOpportunities((prev: any[]) => [...prev, newRecord]);
} else if (activePage === 'orders') {
  setOrders((prev: any[]) => [...prev, newRecord]);
} else if (activePage === 'invoices') {
  setInvoices((prev: any[]) => [...prev, newRecord]);
} else if (activePage === 'products') {
  setProducts((prev: any[]) => [...prev, newRecord]);
} else if (activePage === 'customers') {
  setCustomers((prev: any[]) => [...prev, newRecord]);
}

  setCreateFormData({});

  setCreateModalOpen(false);
};

  const getStatusOptions = () => {
    switch (activePage) {
      case 'customers':
        return ['Active', 'Inactive', 'Prospect'];
      case 'products':
        return ['Active', 'Inactive', 'Discontinued'];
      case 'leads':
        return ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];
      case 'opportunities':
        return ['Open', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'];
      case 'orders':
        return ['Draft', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
      case 'invoices':
        return ['Draft', 'Pending', 'Paid', 'Overdue', 'Cancelled'];
      default:
        return ['New', 'Active'];
    }
  };

  const saveRecordChanges = async () => {
    const calculatedAmount = lineItems.reduce(
  (sum:number, item:any) =>
    sum + (
      Number(item.quantity || 0) *
      Number(item.price || 0)
    ),
  0
);

if (
  activePage === 'leads' ||
  activePage === 'opportunities'
) {

  editedRecord.amount = calculatedAmount;
}
    if (activePage === 'leads') {
      setLeads((prev:any) =>
        prev.map((item:any) =>
          item.id === editedRecord.id ? editedRecord : item
        )
      );
      if (supabase && editedRecord.id) {

  await supabase
    .from('leads')
    .update({
      name: editedRecord.name,
      customer: editedRecord.customer,
      email: editedRecord.email,
      phone: editedRecord.phone,
      source: editedRecord.source,
      amount: Number(editedRecord.amount || 0),
      status: editedRecord.status,
    })
    .eq('lead_number', editedRecord.id);
}
      if (supabase && editedRecord.id) {

  await supabase
    .from('lead_line_items')
    .delete()
    .eq('lead_number', editedRecord.id);

  if (lineItems.length > 0) {
    await supabase
      .from('lead_line_items')
      .insert(
        lineItems.map((item:any) => ({
          lead_number: editedRecord.id,
          product_name: item.product,
          quantity: item.quantity,
          price: item.price,
        }))
      );
  }
}
    } else if (activePage === 'opportunities') {
      setOpportunities((prev:any) =>
        prev.map((item:any) =>
          item.id === editedRecord.id ? editedRecord : item
        )
      );
      if (supabase && editedRecord.id) {

  await supabase
    .from('opportunities')
    .update({
      name: editedRecord.name,
      customer: editedRecord.customer,
      stage: editedRecord.stage,
      amount: Number(editedRecord.amount || 0),
      close_date: editedRecord.closeDate,
      status: editedRecord.status,
    })
    .eq('opportunity_number', editedRecord.id);
}
if (supabase && editedRecord.id) {

  await supabase
    .from('opportunity_line_items')
    .delete()
    .eq('opportunity_number', editedRecord.id);

  if (lineItems.length > 0) {

    await supabase
      .from('opportunity_line_items')
      .insert(
        lineItems.map((item:any) => ({
          opportunity_number: editedRecord.id,
          product_name: item.product,
          quantity: item.quantity,
          price: item.price,
        }))
      );
  }
}
    } else if (activePage === 'customers') {
      setCustomers((prev:any) =>
        prev.map((item:any) =>
          item.id === editedRecord.id ? editedRecord : item
        )
      );
      if (
  editedRecord.primaryContactId
) {

  setContacts((prev:any) =>
    prev.map((contact:any) => {

      if (
        contact.customerId === editedRecord.id
      ) {

        return {
          ...contact,
          isPrimary:
            contact.id ===
            editedRecord.primaryContactId,
          customer: editedRecord.name,
        };
      }

      return contact;
    })
  );

  if (supabase) {

    await supabase
      .from('contacts')
      .update({
        is_primary: false,
      })
      .eq('customer_id', editedRecord.id);

    await supabase
      .from('contacts')
      .update({
        is_primary: true,
      })
      .eq(
        'contact_number',
        editedRecord.primaryContactId
      );
  }

  const selectedPrimaryContact =
    contacts.find(
      (c:any) =>
        c.id === editedRecord.primaryContactId
    );

  setCustomers((prev:any) =>
    prev.map((customer:any) =>
      customer.id === editedRecord.id
        ? {
            ...customer,
            primaryContactId:
              editedRecord.primaryContactId,
            primaryContact:
              selectedPrimaryContact?.name || '',
          }
        : customer
    )
  );
}

      if (supabase && editedRecord.id) {

  await supabase
    .from('customers')
    .update({
      name: editedRecord.name,
      email: editedRecord.email,
      phone: editedRecord.phone,
      company: editedRecord.company,
      industry: editedRecord.industry,
      primary_contact_id: editedRecord.primaryContactId,
      billing_address: editedRecord.billingAddress,
      shipping_address: editedRecord.shippingAddress,
      city: editedRecord.city,
      state: editedRecord.state,
      postal_code: editedRecord.postalCode,
      country: editedRecord.country,
      website: editedRecord.website,
      gst_number: editedRecord.gstNumber,
      status: editedRecord.status,
    })
    .eq('customer_number', editedRecord.id);
}
} else if (activePage === 'contacts') {

  setContacts((prev:any) =>
    prev.map((item:any) =>
      item.id === editedRecord.id
        ? editedRecord
        : item
    )
  );
if (
  editedRecord.isPrimary &&
  editedRecord.customerId
) {

  const existingPrimary =
    contacts.find(
      (c:any) =>
        c.customerId === editedRecord.customerId &&
        c.isPrimary &&
        c.id !== editedRecord.id
    );

  if (existingPrimary) {

    const confirmed = window.confirm(
      `This customer already has a primary contact (${existingPrimary.name}). Replace it?`
    );

    if (!confirmed) {
      return;
    }

    setContacts((prev:any) =>
      prev.map((contact:any) =>
        contact.id === existingPrimary.id
          ? {
              ...contact,
              isPrimary: false,
            }
          : contact
      )
    );


  if (supabase) {

  await supabase
    .from('contacts')
    .update({
      is_primary: false,
    })
    .eq('contact_number', existingPrimary.id);

}


  }
}

  if (supabase) {

  await supabase
    .from('customers')
    .update({
      primary_contact_id: editedRecord.id,
    })
    .eq('customer_number', editedRecord.customerId);

}
    setCustomers((prev:any) =>
  prev.map((customer:any) =>
    customer.id === editedRecord.customerId
      ? {
          ...customer,
          primaryContactId: editedRecord.id,
          primaryContact: editedRecord.name,
        }
      : customer
  )
);
if (
  !editedRecord.isPrimary &&
  editedRecord.customerId
) {

  const customer =
    customers.find(
      (c:any) =>
        c.id === editedRecord.customerId
    );

  if (
    customer?.primaryContactId === editedRecord.id
  ) {

    if (supabase) {

  await supabase
    .from('customers')
    .update({
      primary_contact_id: null,
    })
    .eq('customer_number', editedRecord.customerId);

}
}
}


  if (supabase && editedRecord.id) {

    await supabase
      .from('contacts')
      .update({
        customer: editedRecord.customer,
        name: editedRecord.name,
        email: editedRecord.email,
        phone: editedRecord.phone,
        designation: editedRecord.designation,
        department: editedRecord.department,
        status: editedRecord.status,
      })
      .eq('contact_number', editedRecord.id);
  }

} else if (activePage === 'activities') {

  setActivities((prev:any) =>
    prev.map((item:any) =>
      item.id === editedRecord.id
        ? editedRecord
        : item
    )
  );

  if (supabase && editedRecord.id) {

    await supabase
      .from('activities')
      .update({
        name: editedRecord.name,
        customer: editedRecord.customer,
        contact: editedRecord.contact,
        subject: editedRecord.subject,
        activity_type: editedRecord.activityType,
        activity_date: editedRecord.activityDate,
        notes: editedRecord.notes,
        status: editedRecord.status,
      })
      .eq('activity_number', editedRecord.id);
  }
    } else if (activePage === 'products') {
      setProducts((prev:any) =>
        prev.map((item:any) =>
          item.id === editedRecord.id ? editedRecord : item
        )
      );
    } else if (activePage === 'orders') {

  const calculatedAmount = lineItems.reduce(
    (sum:number, item:any) =>
      sum + (
        Number(item.quantity || 0) *
        Number(item.price || 0)
      ),
    0
  );

  const updatedOrder = {
    ...editedRecord,
    amount: calculatedAmount,
  };

  setOrders((prev:any) =>
    prev.map((item:any) =>
      item.id === updatedOrder.id ? updatedOrder : item
    )
  );

  if (supabase && updatedOrder.id) {

    await supabase
      .from('orders')
      .update({
        customer: updatedOrder.customer,
        name: updatedOrder.name,
        amount: Number(updatedOrder.amount || 0),
        shipping_address: updatedOrder.shippingAddress,
        delivery_date: updatedOrder.deliveryDate,
        status: updatedOrder.status,
      })
      .eq('order_number', updatedOrder.id);

    await supabase
      .from('order_line_items')
      .delete()
      .eq('order_number', updatedOrder.id);

    if (lineItems.length > 0) {

      await supabase
        .from('order_line_items')
        .insert(
          lineItems.map((item:any) => ({
            order_number: updatedOrder.id,
            product_name: item.product,
            quantity: item.quantity,
            price: item.price,
          }))
        );
    }
  }

  setSelectedRecord(updatedOrder);
  setEditedRecord(updatedOrder);
} else if (activePage === 'invoices') {

  const calculatedAmount = lineItems.reduce(
    (sum:number, item:any) =>
      sum + (
        Number(item.quantity || 0) *
        Number(item.price || 0)
      ),
    0
  );

  const updatedInvoice = {
    ...editedRecord,
    amount: calculatedAmount,
  };

  setInvoices((prev:any) =>
    prev.map((item:any) =>
      item.id === updatedInvoice.id
        ? updatedInvoice
        : item
    )
  );

  if (supabase && updatedInvoice.id) {

    await supabase
      .from('invoices')
      .update({
        customer: updatedInvoice.customer,
        name: updatedInvoice.name,
        amount: Number(updatedInvoice.amount || 0),
        due_date: updatedInvoice.dueDate,
        payment_terms: updatedInvoice.paymentTerms,
        billing_address: updatedInvoice.billingAddress,
        status: updatedInvoice.status,
      })
      .eq('invoice_number', updatedInvoice.id);

    await supabase
      .from('invoice_line_items')
      .delete()
      .eq('invoice_number', updatedInvoice.id);

    if (lineItems.length > 0) {

      await supabase
        .from('invoice_line_items')
        .insert(
          lineItems.map((item:any) => ({
            invoice_number: updatedInvoice.id,
            product_name: item.product,
            quantity: item.quantity,
            price: item.price,
          }))
        );
    }
  }

  setSelectedRecord(updatedInvoice);

  setEditedRecord(updatedInvoice);
}

    if (activePage !== 'orders') {
  setSelectedRecord(editedRecord);
}
  };

  const convertLeadToOpportunity = async (lead:any) => {
    const updatedLead = {
      ...lead,
      status: 'Converted',
    };
    if (supabase) {

  await supabase
    .from('leads')
    .update({
      status: 'Converted',
    })
    .eq('lead_number', lead.id);
}

    setLeads((prev:any) =>
      prev.map((item:any) =>
        item.id === lead.id ? updatedLead : item
      )
    );
let leadItems:any[] = [];

if (supabase) {

  const { data } = await supabase
    .from('lead_line_items')
    .select('*')
    .eq('lead_number', lead.id);

  leadItems =
    data?.map((item:any) => ({
      product: item.product_name,
      quantity: item.quantity,
      price: item.price,
    })) || [];
}
 const totalAmount = leadItems.reduce(
  (sum:number, item:any) =>
    sum + (Number(item.quantity || 0) * Number(item.price || 0)),
  0
);
    const newOpportunity = {
  id: `OPP-${Date.now()}`,
  name: lead.name,
  customer: lead.customer,
customerId: lead.customerId,
contact: lead.contact,
contactId: lead.contactId,
  stage: 'Qualification',
  closeDate: '',
  status: 'Open',
amount: totalAmount,
  email: lead.email,
  phone: lead.phone,
  source: lead.source,
  lineItems: [...lineItems],
};
    if (supabase) {

  await supabase
    .from('opportunities')
    .insert([
      {
        opportunity_number: newOpportunity.id,
        name: newOpportunity.name,
        customer: newOpportunity.customer,
customer_id: newOpportunity.customerId,
contact: newOpportunity.contact,
contact_id: newOpportunity.contactId,
        stage: newOpportunity.stage,
        amount: Number(newOpportunity.amount || 0),
        close_date: newOpportunity.closeDate,
        status: newOpportunity.status,
      },
    ]);

  if (leadItems.length > 0) {

    await supabase
      .from('opportunity_line_items')
      .insert(
        leadItems.map((item:any) => ({
          opportunity_number: newOpportunity.id,
          product_name: item.product,
          quantity: item.quantity,
          price: item.price,
        }))
      );
  }
}
    setOpportunities((prev:any) => [...prev, newOpportunity]);
    setOpenActionMenu(null);
  };

const createOrderFromOpportunity = async (
  opportunity:any
) => {

  const updatedOpportunity = {
    ...opportunity,
    status: 'Closed Won',
  };

  setOpportunities((prev:any) =>
    prev.map((item:any) =>
      item.id === opportunity.id
        ? updatedOpportunity
        : item
    )
  );

  let opportunityItems:any[] = [];

  if (supabase) {

    await supabase
      .from('opportunities')
      .update({
        status: 'Closed Won',
      })
      .eq('opportunity_number', opportunity.id);

    const { data } = await supabase
      .from('opportunity_line_items')
      .select('*')
      .eq('opportunity_number', opportunity.id);

    opportunityItems =
      data?.map((item:any) => ({
        product: item.product_name,
        quantity: item.quantity,
        price: item.price,
      })) || [];
  }

  const totalAmount = opportunityItems.reduce(
    (sum:number, item:any) =>
      sum + (
        Number(item.quantity || 0) *
        Number(item.price || 0)
      ),
    0
  );

  const newOrder = {
    id: `ORD-${Date.now()}`,
    customer: opportunity.customer,
customerId: opportunity.customerId,
contact: opportunity.contact,
contactId: opportunity.contactId,
    name: opportunity.name,
    status: 'Processing',
    amount: totalAmount,
    shippingAddress: '',
    deliveryDate: '',
    lineItems: [...opportunityItems],
  };

  if (supabase) {

    await supabase
      .from('orders')
      .insert([
        {
          order_number: newOrder.id,
          customer: newOrder.customer,
customer_id: newOrder.customerId,
contact: newOrder.contact,
contact_id: newOrder.contactId,
          name: newOrder.name,
          amount: Number(newOrder.amount || 0),
          shipping_address: '',
          delivery_date: '',
          status: newOrder.status,
        },
      ]);

    if (opportunityItems.length > 0) {

      await supabase
        .from('order_line_items')
        .insert(
          opportunityItems.map((item:any) => ({
            order_number: newOrder.id,
            product_name: item.product,
            quantity: item.quantity,
            price: item.price,
          }))
        );
    }
  }

  setOrders((prev:any) => [...prev, newOrder]);

  setOpenActionMenu(null);
};
const createQuoteFromOpportunity = async (
  opportunity:any
) => {

  let opportunityItems:any[] = [];

  if (supabase) {

    const { data } = await supabase
      .from('opportunity_line_items')
      .select('*')
      .eq(
        'opportunity_number',
        opportunity.id
      );

    opportunityItems =
      data?.map((item:any) => ({
        product: item.product_name,
        quantity: item.quantity,
        price: item.price,
      })) || [];
  }

  const defaultTemplate =
    quoteTemplates.find(
      (template:any) =>
        template.isDefault
    ) || quoteTemplates[0];

  setSelectedQuoteOpportunity(
    opportunity
  );

  setSelectedQuoteTemplate(
    defaultTemplate
  );

  setQuoteLineItems(
    opportunityItems
  );

  setQuotePreviewOpen(true);

  setOpenActionMenu(null);

};
const downloadQuotePDF = async () => {

  try {

    if (!printableQuoteRef.current)
      return;

    const canvas = await html2canvas(
      printableQuoteRef.current,
      {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      }
    );

    const imgData =
      canvas.toDataURL('image/png');

    const pdf = new jsPDF(
      'p',
      'mm',
      'a4'
    );

    const pdfWidth =
      pdf.internal.pageSize.getWidth();

    const pdfHeight =
      (canvas.height * pdfWidth) /
      canvas.width;

    pdf.addImage(
      imgData,
      'PNG',
      0,
      0,
      pdfWidth,
      pdfHeight
    );

    pdf.save(
      `${
        selectedQuoteOpportunity?.name ||
        'Quote'
      }.pdf`
    );

  } catch (error) {

    console.error(error);

    alert(
      'Failed to generate PDF'
    );
  }
};
const createInvoiceFromOrder = async (
  order:any
) => {

  const updatedOrder = {
    ...order,
    status: 'Delivered',
  };

  setOrders((prev:any) =>
    prev.map((item:any) =>
      item.id === order.id
        ? updatedOrder
        : item
    )
  );

  let orderItems:any[] = [];

  if (supabase) {

    await supabase
      .from('orders')
      .update({
        status: 'Delivered',
      })
      .eq('order_number', order.id);

    const { data } = await supabase
      .from('order_line_items')
      .select('*')
      .eq('order_number', order.id);

    orderItems =
      data?.map((item:any) => ({
        product: item.product_name,
        quantity: item.quantity,
        price: item.price,
      })) || [];
  }

  const totalAmount = orderItems.reduce(
    (sum:number, item:any) =>
      sum + (
        Number(item.quantity || 0) *
        Number(item.price || 0)
      ),
    0
  );

  const newInvoice = {
    id: `INV-${Date.now()}`,
    customer: order.customer,
customerId: order.customerId,
contact: order.contact,
contactId: order.contactId,
    name: order.name,
    status: 'Pending',
    amount: totalAmount,
    dueDate: '',
    paymentTerms: '',
    billingAddress: '',
    lineItems: [...orderItems],
  };

  if (supabase) {

    await supabase
      .from('invoices')
      .insert([
        {
          invoice_number: newInvoice.id,
          customer: newInvoice.customer,
customer_id: newInvoice.customerId,
contact: newInvoice.contact,
contact_id: newInvoice.contactId,
          name: newInvoice.name,
          amount: Number(newInvoice.amount || 0),
          due_date: '',
          payment_terms: '',
          billing_address: '',
          status: newInvoice.status,
        },
      ]);

    if (orderItems.length > 0) {

      await supabase
        .from('invoice_line_items')
        .insert(
          orderItems.map((item:any) => ({
            invoice_number: newInvoice.id,
            product_name: item.product,
            quantity: item.quantity,
            price: item.price,
          }))
        );
    }
  }

  setInvoices((prev:any) => [...prev, newInvoice]);

  setOpenActionMenu(null);
};

  const getFilteredData = () => {
    let data:any[] = getCurrentData();

    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();

      data = data.filter((record:any) => {
        return (
          String(record.name || '')
            .toLowerCase()
            .includes(lowerSearch) ||
          String(record.id || '')
            .toLowerCase()
            .includes(lowerSearch) ||
          String(record.customer || '')
            .toLowerCase()
            .includes(lowerSearch)
        );
      });
    }

    if (statusFilter !== 'All') {
      data = data.filter(
        (record:any) => record.status === statusFilter
      );
    }

    return data;
  };

  const getCurrentData = () => {
    switch (activePage) {
      case 'customers':
        return customers;
      case 'products':
        return products;
      case 'leads':
        return leads;
      case 'opportunities':
        return opportunities;
      case 'orders':
        return orders;
      case 'invoices':
        return invoices;
        case 'contacts':
  return contacts;

case 'activities':
  return activities;
      default:
        return [];
    }
  };
if (authLoading) {

  return (

    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-blue-900 to-blue-950 text-white text-3xl font-bold">

      Loading AI Billing ERP...

    </div>

  );

}
if (!session) {

  return (

    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-blue-900 to-blue-950 p-8">

      <div className="w-full max-w-md bg-white rounded-[36px] shadow-2xl p-10">

        <div className="text-center mb-10">

          <div className="w-24 h-24 mx-auto rounded-[32px] bg-gradient-to-br from-[#0F172A] to-blue-800 text-white flex items-center justify-center text-4xl font-bold shadow-xl">

            AI

          </div>

          <h1 className="mt-6 text-4xl font-bold text-[#0F172A]">
            AI Billing ERP
          </h1>

          <p className="text-gray-500 mt-3">
            Enterprise CRM Platform
          </p>

        </div>

        <div className="space-y-6">

          <div>

            <label className="block text-sm font-semibold text-[#0F172A] mb-2">
              Email
            </label>

            <input
              type="email"
              value={loginForm.email}
              onChange={(e) =>
                setLoginForm({
                  ...loginForm,
                  email: e.target.value,
                })
              }
              className="w-full border border-blue-200 rounded-2xl px-5 py-4"
            />

          </div>

          <div>

            <label className="block text-sm font-semibold text-[#0F172A] mb-2">
              Password
            </label>

            <input
              type="password"
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm({
                  ...loginForm,
                  password:
                    e.target.value,
                })
              }
              className="w-full border border-blue-200 rounded-2xl px-5 py-4"
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
  return (
    <div className="min-h-screen overflow-auto bg-gradient-to-br from-white via-blue-50 to-blue-100">

  <div
    style={{
      transform: 'scale(0.8)',
      transformOrigin: 'top left',
      width: '125%',
      minHeight: '125vh',
    }}
    className="flex"
  >
      <aside
        ref={navigatorRef}
        className={`${sidebarCollapsed ? 'w-24' : 'w-72'} bg-[#0F172A] text-white transition-all duration-300 min-h-screen sticky top-0 shadow-2xl`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            {!sidebarCollapsed && (
              <h2 className="text-2xl font-bold">Navigator</h2>
            )}

            
          </div>

          <div className="space-y-3">
            {navigationItems.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setActivePage(item.key);
                  setSidebarCollapsed(true);
                }}
                className={`w-full flex items-center rounded-2xl transition-all duration-200 py-3 px-4 ${
                  activePage === item.key
                    ? 'bg-white text-[#0F172A]'
                    : 'bg-white/10 text-white hover:bg-blue-700'
                }`}
              >
                <span className="text-xl">{item.icon}</span>

                {!sidebarCollapsed && (
                  <span className="ml-3 font-medium">{item.label}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">

  {/* ENTERPRISE HEADER */}

  <div className="sticky top-0 z-40 bg-gradient-to-r from-[#0F172A] via-blue-900 to-blue-950 border-b border-blue-800 shadow-2xl">

    <div className="px-8 py-5 flex items-center justify-between">

      {/* LEFT SECTION */}

      <div className="flex items-center gap-5">

        <button
          onClick={() =>
            setSidebarCollapsed(
              !sidebarCollapsed
            )
          }
className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-2xl transition-all"        >
          ☰
        </button>

        <div className="flex items-center gap-4">

<div className="w-14 h-14 rounded-3xl bg-white text-[#0F172A] flex items-center justify-center text-2xl font-bold shadow-lg">            AI
          </div>

          <div>

<h1 className="text-2xl font-bold text-white leading-tight">
                B Pro
            </h1>

<p className="text-sm text-blue-100">
                Enterprise CRM Platform
            </p>

          </div>

        </div>

      </div>

      {/* RIGHT SECTION */}

<div className="flex items-center gap-4 relative">
        <button
className="relative w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl transition-all"        >
          🔔

          <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full" />
        </button>

        <button
  onClick={() =>
    setProfileMenuOpen(
      !profileMenuOpen
    )
  }
  className="flex items-center gap-3 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-2xl transition-all"
>

<div className="w-11 h-11 rounded-2xl bg-white text-[#0F172A] flex items-center justify-center font-bold">
              {currentUser?.first_name
  ? `${currentUser.first_name.charAt(0)}${
      currentUser.last_name?.charAt(0) || ''
    }`
  : 'U'}
          </div>

         


        </button>
        {profileMenuOpen && (

  <div className="absolute right-8 top-24 w-64 bg-white rounded-3xl shadow-2xl border border-blue-100 overflow-hidden z-50">

    <div className="p-5 border-b border-blue-100">

      <div className="font-bold text-[#0F172A]">

  {currentUser
    ? `${currentUser.first_name} ${currentUser.last_name}`
    : 'User'}

</div>

<div className="text-sm text-gray-500 mt-1">

  {currentUser?.designation || 'Employee'}

</div>

    </div>

    <button
  onClick={() => {

    setProfileMenuOpen(false);

    setProfilePageOpen(true);

  }}
  className="w-full text-left px-5 py-4 hover:bg-blue-50 transition-all text-[#0F172A]"
>
  My Profile
</button>

    <button
      className="w-full text-left px-5 py-4 hover:bg-blue-50 transition-all text-[#0F172A]"
    >
      Preferences
    </button>

    <button
      onClick={handleLogout}
      className="w-full text-left px-5 py-4 hover:bg-red-50 transition-all text-red-600"
    >
      Logout
    </button>

  </div>

)}
{profilePageOpen && (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6 overflow-auto">

    <div className="w-full max-w-4xl bg-white rounded-[36px] shadow-2xl p-10">

      <div className="flex items-center justify-between mb-10">

        <div>

          <h2 className="text-3xl font-bold text-[#0F172A]">
            My Profile
          </h2>

          <p className="text-gray-500 mt-2">
            Manage your profile and password
          </p>

        </div>

        <button
          onClick={() =>
            setProfilePageOpen(
              false
            )
          }
          className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-[#0F172A] font-bold text-xl"
        >
          ✕
        </button>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <input
  value={
  profileFormData.first_name || ''
}
  onChange={(e) =>
    setProfileFormData({

      ...profileFormData,

      first_name:
        e.target.value,

    })
  }
  className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]"
/>

        <input
  value={
    profileFormData.last_name || ''
  }
  onChange={(e) =>
    setProfileFormData({

      ...profileFormData,

      last_name:
        e.target.value,

    })
  }
  className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]"
/>

        <input
          value={
            currentUser.username || ''
          }
          readOnly
          className="border border-blue-200 rounded-2xl px-5 py-4 bg-gray-50 text-[#0F172A]"
        />

        <input
          value={
            currentUser.email || ''
          }
          readOnly
          className="border border-blue-200 rounded-2xl px-5 py-4 bg-gray-50 text-[#0F172A]"
        />

        <input
  value={
    profileFormData.phone || ''
  }
  onChange={(e) =>
    setProfileFormData({

      ...profileFormData,

      phone:
        e.target.value,

    })
  }
  className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]"
/>

        <input
          value={
            currentUser.designation || ''
          }
          readOnly
          className="border border-blue-200 rounded-2xl px-5 py-4 bg-gray-50 text-[#0F172A]"
        />

      </div>

      <div className="flex justify-end mt-10">

  <button
    onClick={saveMyProfile}
    className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-4 rounded-2xl font-semibold"
  >
    Save Profile
  </button>

</div>

      <div className="mt-10 border-t border-blue-100 pt-10">

        <h3 className="text-2xl font-bold text-[#0F172A] mb-6">
          Reset Password
        </h3>

        <div className="flex gap-4">

          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) =>
              setNewPassword(
                e.target.value
              )
            }
            className="flex-1 border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
          />

          <button
            onClick={
              resetMyPassword
            }
            className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-4 rounded-2xl font-semibold"
          >
            Update Password
          </button>

        </div>

      </div>

    </div>

  </div>

)}

      </div>

    </div>

  </div>

  {/* MAIN CONTENT */}

  <div className="p-8">
        <div className="bg-white rounded-[32px] p-8 shadow-xl border border-blue-100 w-full min-h-screen">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-[#0F172A] capitalize">
              {activePage}
            </h1>

            {activePage !== 'dashboard' &&
 activePage !== 'adminTools' && (
              <button
                onClick={() => {

  setLineItems([]);

  setCreateFormData({
    name: '',
    customer: '',
    status: 'New',
    amount: '',
    email: '',
    phone: '',
    source: '',
    category: '',
    price: '',
    company: '',
    industry: '',
    billingAddress: '',
    shippingAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    website: '',
    gstNumber: '',
    stage: 'Qualification',
    closeDate: '',
    shippingAddressOrder: '',
    deliveryDate: '',
    dueDate: '',
    paymentTerms: '',
  });

  setCreateModalOpen(true);
}}
                className="bg-[#0F172A] text-white px-5 py-3 rounded-2xl font-semibold"
              >
                Create {activePage === 'customers' ? 'Customer' : activePage === 'products' ? 'Product' : activePage === 'leads' ? 'Lead' : activePage === 'opportunities' ? 'Opportunity' : activePage === 'activities' ? 'Activity' : activePage === 'contacts' ? 'Contact' : activePage === 'orders' ? 'Order' : activePage === 'invoices' ? 'Invoice' : 'Record'}
              </button>
            )}
          </div>

          {activePage === 'dashboard' ? (
            <div className="space-y-8">
              <div className="bg-white rounded-[32px] p-8 shadow-xl border border-blue-100">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div>
                    <h1 className="text-4xl font-bold text-[#0F172A] tracking-tight">
                      CRM Analytics Dashboard
                    </h1>

                    <p className="text-gray-600 mt-2 text-lg">
                      Monitor sales, customers, invoices and opportunities in real time.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <select
                      value={selectedTimeline}
                      onChange={(e) => setSelectedTimeline(e.target.value)}
                      className="px-5 py-3 rounded-2xl border border-blue-200 bg-white text-[#0F172A] font-medium shadow-sm"
                    >
                      <option>Last 30 Days</option>
                      <option>Last Quarter</option>
                      <option>This Year</option>
                    </select>

                    <button
                      onClick={() => setReportGenerated(true)}
                      className="bg-[#0F172A] text-white px-6 py-3 rounded-2xl font-semibold shadow-lg hover:scale-[1.02] transition-all"
                    >
                      Generate Report
                    </button>
                    
                  </div>
                </div>
              </div>

              {reportGenerated && (
                <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[32px] p-6 text-white shadow-2xl border border-blue-800/30">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight">
                        Analytics Report Generated
                      </h2>

                      <p className="text-blue-100 mt-2 text-lg">
                        Report timeline: {selectedTimeline}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full lg:w-auto">
                      <div className="bg-white/10 rounded-2xl px-5 py-4 backdrop-blur-sm">
                        <div className="text-sm text-blue-100 uppercase tracking-wide">
                          Total Revenue
                        </div>

                        <div className="text-2xl font-bold mt-2">
                          {formatCurrency(
                            invoices.reduce(
                              (sum: any, invoice: any) => sum + (invoice.amount || 0),
                              0
                            )
                          )}
                        </div>
                      </div>

                      <div className="bg-white/10 rounded-2xl px-5 py-4 backdrop-blur-sm">
                        <div className="text-sm text-blue-100 uppercase tracking-wide">
                          Converted Leads
                        </div>

                        <div className="text-2xl font-bold mt-2">
                          {leads.filter((lead:any)=>lead.status==='Converted').length}
                        </div>
                      </div>

                      <div className="bg-white/10 rounded-2xl px-5 py-4 backdrop-blur-sm">
                        <div className="text-sm text-blue-100 uppercase tracking-wide">
                          Closed Won Opportunities
                        </div>

                        <div className="text-2xl font-bold mt-2">
                          {opportunities.filter((opp:any)=>opp.status==='Closed Won').length}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white rounded-[32px] p-8 shadow-xl border border-blue-100 h-[460px]">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-2xl font-bold text-[#0F172A]">
                        CRM Records Overview
                      </h2>

                      <p className="text-gray-500 mt-1">
                        Complete business object analytics overview.
                      </p>
                    </div>

                    <div className="bg-blue-50 px-4 py-2 rounded-2xl text-[#0F172A] font-semibold">
                      Live Analytics
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height="80%">
                    <BarChart
                      data={[
                        { name: 'Customers', value: customers.length },
                        { name: 'Products', value: products.length },
                        { name: 'Leads', value: leads.length },
                        { name: 'Opportunities', value: opportunities.length },
                        { name: 'Orders', value: orders.length },
                      ]}
                    >
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#0F172A" radius={[10,10,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gradient-to-br from-[#0F172A] via-blue-900 to-blue-950 rounded-[32px] p-8 text-white shadow-2xl min-h-[460px] flex flex-col border border-blue-800/30">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">
                      AI Billing Agent
                    </h2>

                    <p className="text-blue-100 mt-2">
                      AI-powered CRM assistant for insights and billing intelligence.
                    </p>
                  </div>

                  <div className="space-y-4 mt-8 flex-1 overflow-y-auto pr-2">
                    {aiMessages.map((message: any, index: number) => (
                      <div
                        key={index}
                        className={`rounded-3xl p-5 shadow-lg ${
                          message.type === 'assistant'
                            ? 'bg-white text-[#0F172A]'
                            : 'bg-blue-800 text-white ml-8'
                        }`}
                      >
                        <div className="font-semibold mb-2">
                          {message.type === 'assistant'
                            ? 'AI Billing Agent'
                            : 'You'}
                        </div>

                        <div className="leading-relaxed">
                          {message.text}
                        </div>
                      </div>
                    ))}

                    {aiMessages.length === 1 && (
                      <>
                        <button
                          onClick={() =>
                            handleAIQuery('Show revenue summary for current month')
                          }
                          className="w-full bg-white text-[#0F172A] rounded-3xl p-5 text-left font-semibold hover:bg-blue-50 transition-all shadow-lg"
                        >
                          Show revenue summary for current month
                        </button>

                        <button
                          onClick={() =>
                            handleAIQuery('Show qualified and converted leads')
                          }
                          className="w-full bg-white text-[#0F172A] rounded-3xl p-5 text-left font-semibold hover:bg-blue-50 transition-all shadow-lg"
                        >
                          Show qualified and converted leads
                        </button>

                        <button
                          onClick={() =>
                            handleAIQuery('Show pending invoices and orders')
                          }
                          className="w-full bg-white text-[#0F172A] rounded-3xl p-5 text-left font-semibold hover:bg-blue-50 transition-all shadow-lg"
                        >
                          Show pending invoices and orders
                        </button>
                      </>
                    )}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && aiInput.trim()) {
                          handleAIQuery(aiInput);
                          setAiInput('');
                        }
                      }}
                      placeholder="Ask AI about CRM analytics..."
                      className="flex-1 rounded-2xl px-5 py-4 bg-white text-[#0F172A] border border-blue-200 outline-none"
                    />

                    <button
                      onClick={() => {
                        if (!aiInput.trim()) return;

                        handleAIQuery(aiInput);
                        setAiInput('');
                      }}
                      className="bg-white text-[#0F172A] px-6 py-4 rounded-2xl font-bold hover:bg-blue-50 transition-all"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : activePage === 'adminTools' ? (

  <div className="space-y-8">

    <div className="bg-white rounded-[32px] p-8 shadow-xl border border-blue-100">

      <div className="flex items-center justify-between">

  <div>

    <h1 className="text-4xl font-bold text-[#0F172A]">

      {
  adminToolPage === 'home'
    ? 'Admin Tools'
    : adminToolPage ===
      'templateDesigner'
    ? 'Template Designer'
    : adminToolPage ===
      'organizations'
    ? 'Organizations'
    : adminToolPage ===
      'businessUnits'
    ? 'Business Units'
    : adminToolPage ===
      'users'
    ? 'Users'
    : 'User Groups'
}

    </h1>

    <p className="text-gray-600 mt-2 text-lg">

      {
  adminToolPage === 'home'
    ? 'Configure templates, branding, workflows and system tools.'
    : adminToolPage ===
      'templateDesigner'
    ? 'Configure quotation PDF templates and branding.'
    : adminToolPage ===
      'organizations'
    ? 'Manage enterprise organizations and legal entities.'
    : adminToolPage ===
      'businessUnits'
    ? 'Configure enterprise business units and hierarchy.'
    : adminToolPage ===
      'users'
    ? 'Manage enterprise users, workforce and access accounts.'
    : 'Configure workforce groups and department structures.'
}

    </p>

  </div>

  {adminToolPage !== 'home' && (

    <button
      onClick={() =>
        setAdminToolPage('home')
      }
      className="bg-[#0F172A] text-white px-5 py-3 rounded-2xl font-semibold"
    >
      ← Back
    </button>

  )}

</div>

    </div>

    {adminToolPage === 'home' ? (

  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

    <button
      onClick={() => {
        setAdminToolPage('templateDesigner');
      }}
      className="bg-gradient-to-br from-[#0F172A] to-blue-900 rounded-[32px] p-8 text-white shadow-2xl text-left hover:scale-[1.02] transition-all"
    >

      <div className="text-5xl mb-6">
        📄
      </div>

      <h2 className="text-2xl font-bold">
        Template Designer
        
      </h2>

      <p className="text-blue-100 mt-3 leading-relaxed">
        Configure quotation, invoice and document templates.
      </p>

    </button>
    <button
  onClick={() => {
    setAdminToolPage(
      'organizations'
    );
  }}
  className="bg-white rounded-[32px] p-8 border border-blue-100 shadow-xl text-left hover:scale-[1.02] transition-all"
>

  <div className="text-5xl mb-6">
    🏢
  </div>

  <h2 className="text-2xl font-bold text-[#0F172A]">
    Organizations
  </h2>

  <p className="text-gray-500 mt-3 leading-relaxed">
    Manage enterprise organizations,
    subsidiaries and legal entities.
  </p>

</button>

<button
  onClick={() => {
    setAdminToolPage(
      'businessUnits'
    );
  }}
  className="bg-white rounded-[32px] p-8 border border-blue-100 shadow-xl text-left hover:scale-[1.02] transition-all"
>

  <div className="text-5xl mb-6">
    🏬
  </div>

  <h2 className="text-2xl font-bold text-[#0F172A]">
    Business Units
  </h2>

  <p className="text-gray-500 mt-3 leading-relaxed">
    Configure business hierarchy,
    departments and operational units.
  </p>

</button>
<button
  onClick={() => {
    setAdminToolPage(
      'users'
    );
  }}
  className="bg-white rounded-[32px] p-8 border border-blue-100 shadow-xl text-left hover:scale-[1.02] transition-all"
>

  <div className="text-5xl mb-6">
    👥
  </div>

  <h2 className="text-2xl font-bold text-[#0F172A]">
    Users
  </h2>

  <p className="text-gray-500 mt-3 leading-relaxed">
    Create enterprise users,
    access accounts and workforce hierarchy.
  </p>

</button>

<button
  onClick={() => {
    setAdminToolPage(
      'userGroups'
    );
  }}
  className="bg-white rounded-[32px] p-8 border border-blue-100 shadow-xl text-left hover:scale-[1.02] transition-all"
>

  <div className="text-5xl mb-6">
    🏢
  </div>

  <h2 className="text-2xl font-bold text-[#0F172A]">
    User Groups
  </h2>

  <p className="text-gray-500 mt-3 leading-relaxed">
    Configure workforce teams, operational groups and departments.
  </p>

</button>

    <div className="bg-white rounded-[32px] p-8 border border-dashed border-blue-200 text-gray-400 flex flex-col justify-center items-center min-h-[240px]">

      <div className="text-5xl mb-4">
        ⚡
      </div>

      <div className="font-semibold text-lg">
        More Admin Tools Coming Soon
      </div>

    </div>

  </div>

) : adminToolPage === 'organizations' ? (

  <div className="space-y-8">

    <div className="flex items-center justify-between">

      <div>

        <h2 className="text-3xl font-bold text-[#0F172A]">
          Organizations
        </h2>

        <p className="text-gray-500 mt-2">
          Manage enterprise organizations
        </p>

      </div>

      <button
        onClick={() =>
          setOrganizationFormOpen(
            true
          )
        }
        className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-4 rounded-2xl font-semibold shadow-lg"
      >
        + New Organization
      </button>

    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

      {organizations.map(
        (organization:any) => (

        <div
          key={organization.id}
          className="bg-white rounded-[32px] p-8 border border-blue-100 shadow-xl"
        >

          <div className="flex items-start justify-between">

            <div>

              <h3 className="text-2xl font-bold text-[#0F172A]">
                {organization.name}
              </h3>

              <p className="text-gray-500 mt-2">
                {
                  organization.organization_code
                }
              </p>

            </div>

            <div className="px-4 py-2 rounded-2xl bg-green-100 text-green-700 text-sm font-semibold">
              {organization.status}
            </div>

          </div>

          <div className="mt-6 space-y-3 text-sm text-gray-600">

            <div>
              Industry:
              {' '}
              {organization.industry}
            </div>

            <div>
              Country:
              {' '}
              {organization.country}
            </div>

            <div>
              Currency:
              {' '}
              {organization.currency}
            </div>

          </div>

        </div>

      ))}

    </div>
{organizationFormOpen && (

  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">

    <div className="w-full max-w-3xl bg-white rounded-[36px] shadow-2xl p-10 max-h-[90vh] overflow-auto">

      <div className="flex items-center justify-between mb-8">

        <div>

          <h2 className="text-3xl font-bold text-[#0F172A]">
            New Organization
          </h2>

          <p className="text-gray-500 mt-2">
            Create enterprise organization
          </p>

        </div>

        <button
          onClick={() =>
            setOrganizationFormOpen(
              false
            )
          }
className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-[#0F172A] font-bold text-xl"
        >
          ✕
        </button>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <input
          placeholder="Organization Name"
          value={
            organizationFormData.name
          }
          onChange={(e) =>
            setOrganizationFormData({
              ...organizationFormData,
              name: e.target.value,
            })
          }
className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
        />

        <input
          placeholder="Organization Code"
          value={
            organizationFormData.organization_code
          }
          onChange={(e) =>
            setOrganizationFormData({
              ...organizationFormData,
              organization_code:
                e.target.value,
            })
          }
className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
        />

        <input
          placeholder="Industry"
          value={
            organizationFormData.industry
          }
          onChange={(e) =>
            setOrganizationFormData({
              ...organizationFormData,
              industry:
                e.target.value,
            })
          }
          className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
        />

        <input
          placeholder="Website"
          value={
            organizationFormData.website
          }
          onChange={(e) =>
            setOrganizationFormData({
              ...organizationFormData,
              website:
                e.target.value,
            })
          }
className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
        />

        <input
          placeholder="Country"
          value={
            organizationFormData.country
          }
          onChange={(e) =>
            setOrganizationFormData({
              ...organizationFormData,
              country:
                e.target.value,
            })
          }
          className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
        />

        <input
          placeholder="Timezone"
          value={
            organizationFormData.timezone
          }
          onChange={(e) =>
            setOrganizationFormData({
              ...organizationFormData,
              timezone:
                e.target.value,
            })
          }
          className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
        />

        <input
          placeholder="Currency"
          value={
            organizationFormData.currency
          }
          onChange={(e) =>
            setOrganizationFormData({
              ...organizationFormData,
              currency:
                e.target.value,
            })
          }
          className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
        />

      </div>

      <div className="flex justify-end mt-10">

        <button
          onClick={saveOrganization}
          className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-4 rounded-2xl font-semibold shadow-lg"
        >
          Save Organization
        </button>

      </div>

    </div>

  </div>

)}
  </div>

) : adminToolPage === 'businessUnits' ? (

  <div className="space-y-8">

    <div className="flex items-center justify-between">

      <div>

        <h2 className="text-3xl font-bold text-[#0F172A]">
          Business Units
        </h2>

        <p className="text-gray-500 mt-2">
          Configure enterprise business hierarchy
        </p>

      </div>

      <button
        onClick={() =>
          setBusinessUnitFormOpen(
            true
          )
        }
        className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-4 rounded-2xl font-semibold shadow-lg"
      >
        + New Business Unit
      </button>

    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

      {businessUnits.map(
        (businessUnit:any) => {

        const organization =
          organizations.find(
            (org:any) =>
              org.id ===
              businessUnit.organization_id
          );

        return (

          <div
            key={businessUnit.id}
            className="bg-white rounded-[32px] p-8 border border-blue-100 shadow-xl"
          >

            <div className="flex items-start justify-between">

              <div>

                <h3 className="text-2xl font-bold text-[#0F172A]">
                  {businessUnit.name}
                </h3>

                <p className="text-gray-500 mt-2">
                  {
                    businessUnit.business_unit_code
                  }
                </p>

              </div>

              <div className="px-4 py-2 rounded-2xl bg-green-100 text-green-700 text-sm font-semibold">
                {businessUnit.status}
              </div>

            </div>

            <div className="mt-6 space-y-3 text-sm text-gray-600">

              <div>
                Organization:
                {' '}
                {
                  organization?.name
                }
              </div>

            </div>

          </div>

        );

      })}

    </div>

    {businessUnitFormOpen && (

      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">

        <div className="w-full max-w-3xl bg-white rounded-[36px] shadow-2xl p-10">

          <div className="flex items-center justify-between mb-8">

            <div>

              <h2 className="text-3xl font-bold text-[#0F172A]">
                New Business Unit
              </h2>

              <p className="text-gray-500 mt-2">
                Configure operational hierarchy
              </p>

            </div>

            <button
              onClick={() =>
                setBusinessUnitFormOpen(
                  false
                )
              }
              className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-[#0F172A] font-bold text-xl"
            >
              ✕
            </button>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <input
              placeholder="Business Unit Name"
              value={
                businessUnitFormData.name
              }
              onChange={(e) =>
                setBusinessUnitFormData({
                  ...businessUnitFormData,
                  name: e.target.value,
                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
            />

            <input
              placeholder="Business Unit Code"
              value={
                businessUnitFormData.business_unit_code
              }
              onChange={(e) =>
                setBusinessUnitFormData({
                  ...businessUnitFormData,
                  business_unit_code:
                    e.target.value,
                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
            />

            <select
              value={
                businessUnitFormData.organization_id
              }
              onChange={(e) =>
                setBusinessUnitFormData({
                  ...businessUnitFormData,
                  organization_id:
                    e.target.value,
                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]"
            >

              <option value="">
                Select Organization
              </option>

              {organizations.map(
                (organization:any) => (

                <option
                  key={organization.id}
                  value={organization.id}
                >
                  {organization.name}
                </option>

              ))}

            </select>

          </div>

          <div className="flex justify-end mt-10">

            <button
              onClick={
                saveBusinessUnit
              }
              className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-4 rounded-2xl font-semibold shadow-lg"
            >
              Save Business Unit
            </button>

          </div>

        </div>

      </div>

    )}

  </div>

) : adminToolPage === 'users' ? (

  <div className="space-y-8">

    <div className="flex items-center justify-between">

      <div>

        <h2 className="text-3xl font-bold text-[#0F172A]">
          Users
        </h2>

        <p className="text-gray-500 mt-2">
          Manage enterprise workforce and access
        </p>

      </div>

      <button
        onClick={() =>
          setUserFormOpen(true)
        }
        className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-4 rounded-2xl font-semibold shadow-lg"
      >
        + New User
      </button>

    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

      {enterpriseUsers.map(
        (user:any) => {

        const organization =
          organizations.find(
            (org:any) =>
              org.id ===
              user.organization_id
          );

        const businessUnit =
          businessUnits.find(
            (bu:any) =>
              bu.id ===
              user.business_unit_id
          );
          const [
  userGroups,
  setUserGroups
] = useState<any[]>([]);

const [
  userGroupFormOpen,
  setUserGroupFormOpen
] = useState(false);

const [
  userGroupFormData,
  setUserGroupFormData
] = useState({

  group_name: '',
  group_code: '',
  description: '',
  organization_id: '',
  business_unit_id: '',
  status: 'Active',

});

        return (

          <div
            key={user.id}
            className="bg-white rounded-[32px] p-8 border border-blue-100 shadow-xl"
          >

            <div className="flex items-start justify-between">

              <div>

                <h3 className="text-2xl font-bold text-[#0F172A]">
                  {user.first_name}
                  {' '}
                  {user.last_name}
                </h3>

                <p className="text-gray-500 mt-2">
                  {user.designation}
                </p>

              </div>

              <div className="px-4 py-2 rounded-2xl bg-green-100 text-green-700 text-sm font-semibold">
                {user.status}
              </div>

            </div>

            <div className="mt-6 space-y-3 text-sm text-gray-600">

              <div>
                Username:
                {' '}
                {user.username}
              </div>

              <div>
                Email:
                {' '}
                {user.email}
              </div>

              <div>
                Organization:
                {' '}
                {
                  organization?.name
                }
              </div>

              <div>
                Business Unit:
                {' '}
                {
                  businessUnit?.name
                }
              </div>

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

              <h2 className="text-3xl font-bold text-[#0F172A]">
                New User
              </h2>

              <p className="text-gray-500 mt-2">
                Create enterprise login-enabled user
              </p>

            </div>

            <button
              onClick={() =>
                setUserFormOpen(
                  false
                )
              }
              className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-[#0F172A] font-bold text-xl"
            >
              ✕
            </button>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <input
              placeholder="Employee Code"
              value={
                userFormData.employee_code
              }
              onChange={(e) =>
                setUserFormData({
                  ...userFormData,
                  employee_code:
                    e.target.value,
                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
            />

            <input
              placeholder="Username"
              value={
                userFormData.username
              }
              onChange={(e) =>
                setUserFormData({
                  ...userFormData,
                  username:
                    e.target.value,
                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
            />

            <input
              placeholder="First Name"
              value={
                userFormData.first_name
              }
              onChange={(e) =>
                setUserFormData({
                  ...userFormData,
                  first_name:
                    e.target.value,
                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
            />

            <input
              placeholder="Last Name"
              value={
                userFormData.last_name
              }
              onChange={(e) =>
                setUserFormData({
                  ...userFormData,
                  last_name:
                    e.target.value,
                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
            />

            <input
              placeholder="Email"
              value={
                userFormData.email
              }
              onChange={(e) =>
                setUserFormData({
                  ...userFormData,
                  email:
                    e.target.value,
                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
            />

            <input
              placeholder="Temporary Password"
              value={
                userFormData.temporary_password
              }
              onChange={(e) =>
                setUserFormData({
                  ...userFormData,
                  temporary_password:
                    e.target.value,
                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
            />

            <input
              placeholder="Phone"
              value={
                userFormData.phone
              }
              onChange={(e) =>
                setUserFormData({
                  ...userFormData,
                  phone:
                    e.target.value,
                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
            />

            <input
              placeholder="Designation"
              value={
                userFormData.designation
              }
              onChange={(e) =>
                setUserFormData({
                  ...userFormData,
                  designation:
                    e.target.value,
                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
            />

            <select
              value={
                userFormData.organization_id
              }
              onChange={(e) =>
                setUserFormData({
                  ...userFormData,
                  organization_id:
                    e.target.value,
                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]"
            >

              <option value="">
                Select Organization
              </option>

              {organizations.map(
                (organization:any) => (

                <option
                  key={organization.id}
                  value={organization.id}
                >
                  {organization.name}
                </option>

              ))}

            </select>

            <select
              value={
                userFormData.business_unit_id
              }
              onChange={(e) =>
                setUserFormData({
                  ...userFormData,
                  business_unit_id:
                    e.target.value,
                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]"
            >

              <option value="">
                Select Business Unit
              </option>

              {businessUnits.map(
                (businessUnit:any) => (

                <option
                  key={businessUnit.id}
                  value={businessUnit.id}
                >
                  {businessUnit.name}
                </option>

              ))}

            </select>

          </div>

          <div className="flex justify-end mt-10">

            <button
              onClick={
                saveEnterpriseUser
              }
              className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-4 rounded-2xl font-semibold shadow-lg"
            >
              Create User
            </button>

          </div>

        </div>

      </div>

    )}

  </div>

) : adminToolPage === 'userGroups' ? (

  <div className="space-y-8">

    <div className="flex items-center justify-between">

      <div>

        <h2 className="text-3xl font-bold text-[#0F172A]">
          User Groups
        </h2>

        <p className="text-gray-500 mt-2">
          Configure enterprise workforce teams and departments
        </p>

      </div>

      <button
        onClick={() =>
          setUserGroupFormOpen(
            true
          )
        }
        className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-6 py-4 rounded-2xl font-semibold shadow-lg"
      >
        + New User Group
      </button>

    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

      {userGroups.map(
        (group:any) => {

        const organization =
          organizations.find(
            (org:any) =>
              org.id ===
              group.organization_id
          );

        const businessUnit =
          businessUnits.find(
            (bu:any) =>
              bu.id ===
              group.business_unit_id
          );

        return (

          <div
            key={group.id}
            className="bg-white rounded-[32px] p-8 border border-blue-100 shadow-xl"
          >

            <div className="flex items-start justify-between">

              <div>

                <h3 className="text-2xl font-bold text-[#0F172A]">
                  {group.group_name}
                </h3>

                <p className="text-gray-500 mt-2">
                  {group.group_code}
                </p>

              </div>

              <div className="px-4 py-2 rounded-2xl bg-green-100 text-green-700 text-sm font-semibold">
                {group.status}
              </div>

            </div>

            <div className="mt-6 space-y-3 text-sm text-gray-600">

              <div>
                Organization:
                {' '}
                {
                  organization?.name
                }
              </div>

              <div>
                Business Unit:
                {' '}
                {
                  businessUnit?.name
                }
              </div>

              <div>
                {group.description}
              </div>

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

              <h2 className="text-3xl font-bold text-[#0F172A]">
                New User Group
              </h2>

              <p className="text-gray-500 mt-2">
                Create workforce operational groups
              </p>

            </div>

            <button
              onClick={() =>
                setUserGroupFormOpen(
                  false
                )
              }
              className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-[#0F172A] font-bold text-xl"
            >
              ✕
            </button>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <input
              placeholder="Group Name"
              value={
                userGroupFormData.group_name
              }
              onChange={(e) =>
                setUserGroupFormData({

                  ...userGroupFormData,

                  group_name:
                    e.target.value,

                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
            />

            <input
              placeholder="Group Code"
              value={
                userGroupFormData.group_code
              }
              onChange={(e) =>
                setUserGroupFormData({

                  ...userGroupFormData,

                  group_code:
                    e.target.value,

                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A] placeholder:text-gray-500"
            />

            <select
              value={
                userGroupFormData.organization_id
              }
              onChange={(e) =>
                setUserGroupFormData({

                  ...userGroupFormData,

                  organization_id:
                    e.target.value,

                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]"
            >

              <option value="">
                Select Organization
              </option>

              {organizations.map(
                (organization:any) => (

                <option
                  key={organization.id}
                  value={organization.id}
                >
                  {organization.name}
                </option>

              ))}

            </select>

            <select
              value={
                userGroupFormData.business_unit_id
              }
              onChange={(e) =>
                setUserGroupFormData({

                  ...userGroupFormData,

                  business_unit_id:
                    e.target.value,

                })
              }
              className="border border-blue-200 rounded-2xl px-5 py-4 text-[#0F172A]"
            >

              <option value="">
                Select Business Unit
              </option>

              {businessUnits.map(
                (businessUnit:any) => (

                <option
                  key={businessUnit.id}
                  value={businessUnit.id}
                >
                  {businessUnit.name}
                </option>

              ))}

            </select>

            <textarea
              placeholder="Description"
              value={
                userGroupFormData.description
              }
              onChange={(e) =>
                setUserGroupFormData({

                  ...userGroupFormData,

                  description:
                    e.target.value,

                })
              }
              className="md:col-span-2 border border-blue-200 rounded-2xl px-5 py-4 min-h-[140px] text-[#0F172A] placeholder:text-gray-500"
            />

          </div>

          <div className="flex justify-end mt-10">

            <button
              onClick={
                saveUserGroup
              }
              className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-4 rounded-2xl font-semibold shadow-lg"
            >
              Save User Group
            </button>

          </div>

        </div>

      </div>

    )}

  </div>

) : (

  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

    <div className="xl:col-span-2 bg-white rounded-[32px] p-8 shadow-xl border border-blue-100">

      <h2 className="text-2xl font-bold text-[#0F172A] mb-6">
        Quote Template Configuration
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {[
          ['name', 'Template Name'],
          ['companyName', 'Company Name'],
          ['companyEmail', 'Company Email'],
          ['companyPhone', 'Company Phone'],
          ['companyAddress', 'Company Address'],
          ['quoteTitle', 'Quote Title'],
        ].map(([field, label]) => (

          <div key={field}>

            <label className="block text-sm font-semibold text-[#0F172A] mb-2">
              {label}
            </label>

            <input
              type="text"
              value={templateFormData[field]}
              onChange={(e) =>
                setTemplateFormData({
                  ...templateFormData,
                  [field]: e.target.value,
                })
              }
              className="w-full border border-blue-200 rounded-2xl px-5 py-3"
            />

          </div>

        ))}

      </div>

      <div className="mt-5">

        <label className="block text-sm font-semibold text-[#0F172A] mb-2">
          Footer Text
        </label>

        <textarea
          value={templateFormData.footerText}
          onChange={(e) =>
            setTemplateFormData({
              ...templateFormData,
              footerText: e.target.value,
            })
          }
          rows={3}
          className="w-full border border-blue-200 rounded-2xl px-5 py-3"
        />

      </div>

      <div className="mt-5">

        <label className="block text-sm font-semibold text-[#0F172A] mb-2">
          Terms & Conditions
        </label>

        <textarea
          value={templateFormData.termsAndConditions}
          onChange={(e) =>
            setTemplateFormData({
              ...templateFormData,
              termsAndConditions: e.target.value,
            })
          }
          rows={5}
          className="w-full border border-blue-200 rounded-2xl px-5 py-3"
        />

      </div>

      <button
        onClick={async () => {
          if (editingTemplateId) {
            if (!supabase) return;

  await supabase
    .from('quote_templates')
    .update({
      name: templateFormData.name,
      company_name:
        templateFormData.companyName,
      company_email:
        templateFormData.companyEmail,
      company_phone:
        templateFormData.companyPhone,
      company_address:
        templateFormData.companyAddress,
      quote_title:
        templateFormData.quoteTitle,
      footer_text:
        templateFormData.footerText,
      terms_and_conditions:
        templateFormData.termsAndConditions,
      primary_color:
        templateFormData.primaryColor,
      secondary_color:
        templateFormData.secondaryColor,
    })
    .eq(
      'template_number',
      editingTemplateId
    );

  setEditingTemplateId(null);

  await fetchQuoteTemplates();

  alert('Template Updated');

  return;
}

         const templateNumber =
  `TEMP-${Date.now()}`;

if (!supabase) return;

const { error } = await supabase
  .from('quote_templates')
  .insert([
    {
      template_number: templateNumber,
      name: templateFormData.name,
      is_default: false,
      company_name:
        templateFormData.companyName,
      company_email:
        templateFormData.companyEmail,
      company_phone:
        templateFormData.companyPhone,
      company_address:
        templateFormData.companyAddress,
      quote_title:
        templateFormData.quoteTitle,
      footer_text:
        templateFormData.footerText,
      terms_and_conditions:
        templateFormData.termsAndConditions,
      primary_color:
        templateFormData.primaryColor,
      secondary_color:
        templateFormData.secondaryColor,
    },
  ]);

if (error) {

  console.log(error);

  alert(error.message);

  return;
}

await fetchQuoteTemplates();

alert('Template Saved');

          setTemplateFormData({
            name: '',
            companyName: '',
            companyEmail: '',
            companyPhone: '',
            companyAddress: '',
            quoteTitle: 'Quotation',
            footerText: '',
            termsAndConditions: '',
            primaryColor: '#0F172A',
            secondaryColor: '#1E3A8A',
          });
        }}
        className="mt-6 bg-[#0F172A] text-white px-6 py-4 rounded-2xl font-semibold"
      >
        Save Template
      </button>

    </div>

    <div className="bg-gradient-to-br from-[#0F172A] to-blue-900 rounded-[32px] p-8 text-white shadow-2xl">

      <h2 className="text-2xl font-bold mb-6">
        Saved Templates
      </h2>

      <div className="space-y-4">

        {quoteTemplates.map((template:any) => (

          <div
            key={template.id}
            className="bg-white/10 rounded-2xl p-5"
          >

            <div className="flex items-center justify-between">

              <div>

                <div className="font-bold text-lg">
                  {template.name}
                </div>

                <div className="text-blue-100 text-sm mt-1">
                  {template.companyName}
                </div>

              </div>

              {template.isDefault && (

                <span className="bg-green-500 text-white text-xs px-3 py-1 rounded-full">
                  Default
                </span>

              )}

            </div>
            <div className="flex gap-2 mt-4">

  <button
    onClick={() => {

      setEditingTemplateId(
  template.id
);

setTemplateFormData(template);

    }}
    className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl text-sm"
  >
    Edit
  </button>

  <button
    onClick={async () => {

      if (!supabase) return;

      const confirmed =
        window.confirm(
          'Delete this template?'
        );

      if (!confirmed) return;

      await supabase
        .from('quote_templates')
        .delete()
        .eq(
          'template_number',
          template.id
        );

      await fetchQuoteTemplates();

    }}
    className="bg-red-500 hover:bg-red-600 px-3 py-2 rounded-xl text-sm"
  >
    Delete
  </button>

  <button
    onClick={async () => {

      if (!supabase) return;

      await supabase
        .from('quote_templates')
        .update({
          is_default: false,
        })
        .neq('id', '');

      await supabase
        .from('quote_templates')
        .update({
          is_default: true,
        })
        .eq(
          'template_number',
          template.id
        );

      await fetchQuoteTemplates();
      setQuoteTemplates((prev:any) =>
  prev.map((item:any) => ({
    ...item,
    isDefault:
      item.id === template.id,
  }))
);

    }}
    className="bg-green-500 hover:bg-green-600 px-3 py-2 rounded-xl text-sm"
  >
    Default
  </button>

</div>

          </div>

        ))}

      </div>

    </div>

  </div>

)}

  </div>

) : (
            <div className="bg-gradient-to-br from-white to-blue-50 rounded-[32px] border border-blue-100 shadow-xl overflow-visible">
              <div className="p-6 border-b border-blue-100 bg-white sticky top-0 z-10">
                <div className="flex flex-col xl:flex-row gap-4 xl:items-center xl:justify-between">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={`Search ${activePage} by Name, ID or Customer`}
                      className="w-full xl:max-w-xl border border-blue-200 rounded-2xl px-5 py-3 text-[#0F172A] bg-white shadow-sm"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="border border-blue-200 rounded-2xl px-5 py-3 bg-white text-[#0F172A] font-medium"
                    >
                      <option>All</option>
                      {getStatusOptions().map((status:string) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>

                    <select
                      value={timelineFilter}
                      onChange={(e) => setTimelineFilter(e.target.value)}
                      className="border border-blue-200 rounded-2xl px-5 py-3 bg-white text-[#0F172A] font-medium"
                    >
                      <option>All Time</option>
                      <option>Today</option>
                      <option>Last 7 Days</option>
                      <option>Last 30 Days</option>
                      <option>This Year</option>
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
                  {getFilteredData().map((record: any) => (
                    <tr
                      key={record.id}
                      className="border-t border-blue-100 hover:bg-blue-50/60 transition-all duration-200"
                    >
                      <td className="px-6 py-4 font-bold text-[#0F172A]">{record.id}</td>
                      <td
                        onClick={() => openDetailsPage(record)}
                        className="px-6 py-4 font-bold text-[#0F172A] underline cursor-pointer hover:text-blue-700 transition-all"
                      >
                        {record.name || record.customer}
                      </td>
                      <td className="px-6 py-4 font-bold text-[#0F172A]">{record.status}</td>

                      <td className="px-6 py-4 text-center relative w-[160px] overflow-visible">
                        <button
                          onClick={(e) => {

  e.stopPropagation();

  setOpenActionMenu(
    openActionMenu === record.id
      ? null
      : record.id
  );

}}
                          className="inline-flex w-10 h-10 items-center justify-center rounded-full bg-[#0F172A] text-white hover:bg-blue-800 shadow-lg border border-blue-700 transition-all mx-auto text-2xl font-bold cursor-pointer"
                        >
                          ⋮
                        </button>

                        {openActionMenu === record.id && (
                          <div
                            className="absolute right-6 top-16 bg-[#0F172A] border border-blue-800 shadow-2xl rounded-2xl p-2 z-[999] min-w-[220px] overflow-hidden"
                          >
                            <button
                              onClick={() => openDetailsPage(record)}
                              className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-800 text-white"
                            >
                              Open Details
                            </button>

                            <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-800 text-white">
                              Change Status
                            </button>

                            {activePage === 'leads' && record.status === 'Qualified' && (
                              <button
                                onClick={() => convertLeadToOpportunity(record)}
                                className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-800 text-white"
                              >
                                Convert to Opportunity
                              </button>
                            )}

                            {activePage === 'opportunities' && (

  <>

    <button
  onClick={async (e) => {

    e.preventDefault();

    e.stopPropagation();

    createQuoteFromOpportunity(
      record
    );

  }}
  className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-800 text-white"
>
  Create Quote
</button>

    <button
      onClick={() =>
        createOrderFromOpportunity(record)
      }
      className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-800 text-white"
    >
      Create Order
    </button>

  </>

)}
                            
                            {activePage === 'orders' && (
  <button
    onClick={() => createInvoiceFromOrder(record)}
    className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-800 text-white"
  >
    Create Invoice
  </button>
)}

                            <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-red-500/20 text-red-300">
                              Delete Record
                            </button>
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
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[110] p-6 overflow-auto">
          <div className="bg-white rounded-[32px] shadow-2xl border border-blue-100 w-full max-w-5xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-8 py-6 text-white flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold capitalize">
                  {activePage === 'customers' ? 'Customer' : activePage === 'products' ? 'Product' : activePage === 'leads' ? 'Lead' : activePage === 'opportunities' ? 'Opportunity' : activePage === 'activities' ? 'Activity' : activePage === 'contacts' ? 'Contact' : activePage === 'orders' ? 'Order' : activePage === 'invoices' ? 'Invoice' : 'Record'} Details
                </h2>

                <p className="text-blue-100 mt-1">
                  Record ID: {selectedRecord.id}
                </p>
              </div>

              <button
                onClick={() => setSelectedRecord(null)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20"
              >
                ✕
              </button>
            </div>
            {activePage === 'customers' && (

  <div className="px-8 pt-6 bg-gradient-to-br from-white to-blue-50">

    <div className="flex gap-3 border-b border-blue-100 pb-4">

      <button
        onClick={() => setDetailsTab('details')}
        className={`px-5 py-3 rounded-2xl font-semibold transition-all ${
          detailsTab === 'details'
            ? 'bg-[#0F172A] text-white'
            : 'bg-white border border-blue-200 text-[#0F172A]'
        }`}
      >
        Details
      </button>

      <button
        onClick={() => setDetailsTab('contacts')}
        className={`px-5 py-3 rounded-2xl font-semibold transition-all ${
          detailsTab === 'contacts'
            ? 'bg-[#0F172A] text-white'
            : 'bg-white border border-blue-200 text-[#0F172A]'
        }`}
      >
        Contacts
      </button>
      <button
  onClick={() => setDetailsTab('leads')}
  className={`px-5 py-3 rounded-2xl font-semibold transition-all ${
    detailsTab === 'leads'
      ? 'bg-[#0F172A] text-white'
      : 'bg-white border border-blue-200 text-[#0F172A]'
  }`}
>
  Leads
</button>
      <button
  onClick={() => setDetailsTab('opportunities')}
  className={`px-5 py-3 rounded-2xl font-semibold transition-all ${
    detailsTab === 'opportunities'
      ? 'bg-[#0F172A] text-white'
      : 'bg-white border border-blue-200 text-[#0F172A]'
  }`}
>
  Opportunities
</button>

<button
  onClick={() => setDetailsTab('orders')}
  className={`px-5 py-3 rounded-2xl font-semibold transition-all ${
    detailsTab === 'orders'
      ? 'bg-[#0F172A] text-white'
      : 'bg-white border border-blue-200 text-[#0F172A]'
  }`}
>
  Orders
</button>

<button
  onClick={() => setDetailsTab('invoices')}
  className={`px-5 py-3 rounded-2xl font-semibold transition-all ${
    detailsTab === 'invoices'
      ? 'bg-[#0F172A] text-white'
      : 'bg-white border border-blue-200 text-[#0F172A]'
  }`}
>
  Invoices
</button>

<button
  onClick={() => setDetailsTab('activities')}
  className={`px-5 py-3 rounded-2xl font-semibold transition-all ${
    detailsTab === 'activities'
      ? 'bg-[#0F172A] text-white'
      : 'bg-white border border-blue-200 text-[#0F172A]'
  }`}
>
  Activities
</button>

    </div>

  </div>

)}
{activePage === 'customers' &&
 detailsTab === 'contacts' && (

  <div className="p-8 bg-gradient-to-br from-white to-blue-50">

    <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">

      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 text-white">
        <h3 className="text-xl font-bold">
          Associated Contacts
        </h3>

        <p className="text-blue-100 text-sm mt-1">
          Contacts related to this customer account
        </p>
      </div>

      {contacts.filter(
        (contact:any) =>
          contact.customerId === selectedRecord.id ||
contact.customer === selectedRecord.name
      ).length === 0 ? (

        <div className="p-6 text-gray-500">
          No associated contacts found.
        </div>

      ) : (

        <table className="w-full">

          <thead className="bg-blue-50">
            <tr>
              <th className="px-6 py-4 text-left">
                Contact Name
              </th>

              <th className="px-6 py-4 text-left">
                Email
              </th>

              <th className="px-6 py-4 text-left">
                Phone
              </th>

              <th className="px-6 py-4 text-left">
                Primary
              </th>

              <th className="px-6 py-4 text-left">
                Status
              </th>
            </tr>
          </thead>

          <tbody>

            {contacts
              .filter(
                (contact:any) =>
                  contact.customerId === selectedRecord.id ||
contact.customer === selectedRecord.name
              )
              .map((contact:any) => (

                <tr
                  key={contact.id}
                  className="border-t border-blue-100 hover:bg-blue-50/50"
                >

                  <td className="px-6 py-4 font-semibold">

                    <button
                      onClick={() => {
                        setActivePage('contacts');
                        openDetailsPage(contact);
                      }}
                      className="text-blue-700 underline hover:text-blue-900"
                    >
                      {contact.name}
                    </button>

                  </td>

                  <td className="px-6 py-4">
                    {contact.email}
                  </td>

                  <td className="px-6 py-4">
                    {contact.phone}
                  </td>

                  <td className="px-6 py-4">

                    {selectedRecord.primaryContactId === contact.id ? (

                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                        Primary
                      </span>

                    ) : (

                      <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
                        Secondary
                      </span>

                    )}

                  </td>

                  <td className="px-6 py-4">
                    {contact.status}
                  </td>

                </tr>

              ))}

          </tbody>

        </table>

      )}

    </div>

  </div>

)}
{activePage === 'customers' &&
 detailsTab === 'leads' && (

  <div className="p-8 bg-gradient-to-br from-white to-blue-50">

    <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">

      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 text-white">
        <h3 className="text-xl font-bold">
          Associated Leads
        </h3>
      </div>

      {leads.filter(
        (lead:any) =>
          lead.customerId === selectedRecord.id ||
lead.customer === selectedRecord.name
      ).length === 0 ? (

        <div className="p-6 text-gray-500">
          No associated leads found.
        </div>

      ) : (

        <table className="w-full">

          <thead className="bg-blue-50">
            <tr>
              <th className="px-6 py-4 text-left">
                Lead
              </th>

              <th className="px-6 py-4 text-left">
                Source
              </th>

              <th className="px-6 py-4 text-left">
                Amount
              </th>

              <th className="px-6 py-4 text-left">
                Status
              </th>
            </tr>
          </thead>

          <tbody>

            {leads
              .filter(
                (lead:any) =>
                  lead.customerId === selectedRecord.id ||
lead.customer === selectedRecord.name
              )
              .map((lead:any) => (

                <tr
                  key={lead.id}
                  className="border-t border-blue-100 hover:bg-blue-50/50"
                >

                  <td className="px-6 py-4 font-semibold">

                    <button
                      onClick={() => {
                        setActivePage('leads');
                        openDetailsPage(lead);
                      }}
                      className="text-blue-700 underline hover:text-blue-900"
                    >
                      {lead.name}
                    </button>

                  </td>

                  <td className="px-6 py-4">
                    {lead.source}
                  </td>

                  <td className="px-6 py-4">
                    ₹{Number(lead.amount || 0).toLocaleString()}
                  </td>

                  <td className="px-6 py-4">
                    {lead.status}
                  </td>

                </tr>

              ))}

          </tbody>

        </table>

      )}

    </div>

  </div>

)}
{activePage === 'customers' &&
 detailsTab === 'opportunities' && (

  <div className="p-8 bg-gradient-to-br from-white to-blue-50">

    <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">

      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 text-white">
        <h3 className="text-xl font-bold">
          Associated Opportunities
        </h3>
      </div>

      {opportunities.filter(
        (opportunity:any) =>
          opportunity.customerId === selectedRecord.id ||
opportunity.customer === selectedRecord.name
      ).length === 0 ? (

        <div className="p-6 text-gray-500">
          No associated opportunities found.
        </div>

      ) : (

        <table className="w-full">

          <thead className="bg-blue-50">
            <tr>
              <th className="px-6 py-4 text-left">
                Opportunity
              </th>

              <th className="px-6 py-4 text-left">
                Stage
              </th>

              <th className="px-6 py-4 text-left">
                Amount
              </th>

              <th className="px-6 py-4 text-left">
                Status
              </th>
            </tr>
          </thead>

          <tbody>

            {opportunities
              .filter(
                (opportunity:any) =>
                  opportunity.customerId === selectedRecord.id ||
                  opportunity.customer === selectedRecord.name
              )
              .map((opportunity:any) => (

                <tr
                  key={opportunity.id}
                  className="border-t border-blue-100 hover:bg-blue-50/50"
                >

                  <td className="px-6 py-4 font-semibold">

                    <button
                      onClick={() => {
                        setActivePage('opportunities');
                        openDetailsPage(opportunity);
                      }}
                      className="text-blue-700 underline hover:text-blue-900"
                    >
                      {opportunity.name}
                    </button>

                  </td>

                  <td className="px-6 py-4">
                    {opportunity.stage}
                  </td>

                  <td className="px-6 py-4">
                    ₹{Number(opportunity.amount || 0).toLocaleString()}
                  </td>

                  <td className="px-6 py-4">
                    {opportunity.status}
                  </td>

                </tr>

              ))}

          </tbody>

        </table>

      )}

    </div>

  </div>

)}
{activePage === 'customers' &&
 detailsTab === 'orders' && (

  <div className="p-8 bg-gradient-to-br from-white to-blue-50">

    <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">

      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 text-white">
        <h3 className="text-xl font-bold">
          Associated Orders
        </h3>
      </div>

      {orders.filter(
        (order:any) =>
          order.customerId === selectedRecord.id ||
order.customer === selectedRecord.name
      ).length === 0 ? (

        <div className="p-6 text-gray-500">
          No associated orders found.
        </div>

      ) : (

        <table className="w-full">

          <thead className="bg-blue-50">
            <tr>
              <th className="px-6 py-4 text-left">
                Order
              </th>

              <th className="px-6 py-4 text-left">
                Amount
              </th>

              <th className="px-6 py-4 text-left">
                Status
              </th>
            </tr>
          </thead>

          <tbody>

            {orders
              .filter(
                (order:any) =>
                  order.customerId === selectedRecord.id ||
order.customer === selectedRecord.name
              )
              .map((order:any) => (

                <tr
                  key={order.id}
                  className="border-t border-blue-100 hover:bg-blue-50/50"
                >

                  <td className="px-6 py-4 font-semibold">

                    <button
                      onClick={() => {
                        setActivePage('orders');
                        openDetailsPage(order);
                      }}
                      className="text-blue-700 underline hover:text-blue-900"
                    >
                      {order.name}
                    </button>

                  </td>

                  <td className="px-6 py-4">
                    ₹{Number(order.amount || 0).toLocaleString()}
                  </td>

                  <td className="px-6 py-4">
                    {order.status}
                  </td>

                </tr>

              ))}

          </tbody>

        </table>

      )}

    </div>

  </div>

)}
{activePage === 'customers' &&
 detailsTab === 'invoices' && (

  <div className="p-8 bg-gradient-to-br from-white to-blue-50">

    <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">

      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 text-white">
        <h3 className="text-xl font-bold">
          Associated Invoices
        </h3>
      </div>

      {invoices.filter(
        (invoice:any) =>
          invoice.customerId === selectedRecord.id ||
invoice.customer === selectedRecord.name
      ).length === 0 ? (

        <div className="p-6 text-gray-500">
          No associated invoices found.
        </div>

      ) : (

        <table className="w-full">

          <thead className="bg-blue-50">
            <tr>
              <th className="px-6 py-4 text-left">
                Invoice
              </th>

              <th className="px-6 py-4 text-left">
                Amount
              </th>

              <th className="px-6 py-4 text-left">
                Status
              </th>
            </tr>
          </thead>

          <tbody>

            {invoices
              .filter(
                (invoice:any) =>
                  invoice.customerId === selectedRecord.id
              )
              .map((invoice:any) => (

                <tr
                  key={invoice.id}
                  className="border-t border-blue-100 hover:bg-blue-50/50"
                >

                  <td className="px-6 py-4 font-semibold">

                    <button
                      onClick={() => {
                        setActivePage('invoices');
                        openDetailsPage(invoice);
                      }}
                      className="text-blue-700 underline hover:text-blue-900"
                    >
                      {invoice.name}
                    </button>

                  </td>

                  <td className="px-6 py-4">
                    ₹{Number(invoice.amount || 0).toLocaleString()}
                  </td>

                  <td className="px-6 py-4">
                    {invoice.status}
                  </td>

                </tr>

              ))}

          </tbody>

        </table>

      )}

    </div>

  </div>

)}
{activePage === 'customers' &&
 detailsTab === 'activities' && (

  <div className="p-8 bg-gradient-to-br from-white to-blue-50">

    <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">

      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-4 text-white">
        <h3 className="text-xl font-bold">
          Associated Activities
        </h3>
      </div>

      {activities.filter(
        (activity:any) =>
          activity.customerId === selectedRecord.id ||
          activity.customer === selectedRecord.name
      ).length === 0 ? (

        <div className="p-6 text-gray-500">
          No associated activities found.
        </div>

      ) : (

        <table className="w-full">

          <thead className="bg-blue-50">
            <tr>
              <th className="px-6 py-4 text-left">
                Activity
              </th>

              <th className="px-6 py-4 text-left">
                Type
              </th>

              <th className="px-6 py-4 text-left">
                Date
              </th>

              <th className="px-6 py-4 text-left">
                Status
              </th>
            </tr>
          </thead>

          <tbody>

            {activities
              .filter(
                (activity:any) =>
                  activity.customerId === selectedRecord.id ||
                  activity.customer === selectedRecord.name
              )
              .map((activity:any) => (

                <tr
                  key={activity.id}
                  className="border-t border-blue-100 hover:bg-blue-50/50"
                >

                  <td className="px-6 py-4 font-semibold">

                    <button
                      onClick={() => {
                        setActivePage('activities');
                        openDetailsPage(activity);
                      }}
                      className="text-blue-700 underline hover:text-blue-900"
                    >
                      {activity.name}
                    </button>

                  </td>

                  <td className="px-6 py-4">
                    {activity.activityType}
                  </td>

                  <td className="px-6 py-4">
                    {activity.activityDate}
                  </td>

                  <td className="px-6 py-4">
                    {activity.status}
                  </td>

                </tr>

              ))}

          </tbody>

        </table>

      )}

    </div>

  </div>

)}

            {(
  activePage !== 'customers' ||
  detailsTab === 'details'
) && (

<div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 bg-gradient-to-br from-white to-blue-50">
              {getObjectFields().map((field: string) => (
                <div
                  key={field}
                  className="bg-white rounded-3xl border border-blue-100 p-5 shadow-sm"
                >
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-3">
                    {field}
                  </label>

                 {field === 'status' ? (

  <select
    value={editedRecord[field] || ''}
    onChange={(e) =>
      setEditedRecord((prev:any) => ({
        ...prev,
        [field]: e.target.value,
      }))
    }
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white"
  >
    {getStatusOptions().map((status:string) => (
      <option key={status}>{status}</option>
    ))}
  </select>

) : field === 'source' ? (

  <select
    value={editedRecord[field] || ''}
    onChange={(e) =>
      setEditedRecord((prev:any) => ({
        ...prev,
        [field]: e.target.value,
      }))
    }
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white"
  >
    <option>Website</option>
    <option>Campaign</option>
    <option>Referral</option>
  </select>

) : field === 'customer' ? (

  <select
    value={editedRecord.customerId || ''}
    onChange={(e) => {

      const selectedCustomer =
        customers.find(
          (c:any) => c.id === e.target.value
        );

      setEditedRecord((prev:any) => ({
        ...prev,
        customerId: selectedCustomer?.id || '',
        customer: selectedCustomer?.name || '',
        contact: '',
        contactId: '',
      }));
    }}
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white"
  >
    <option value="">Select Customer</option>

    {customers.map((customer:any) => (
      <option
        key={customer.id}
        value={customer.id}
      >
        {customer.name}
      </option>
    ))}
  </select>


) : field === 'primaryContact' ? (

  <select
    value={editedRecord.primaryContactId || ''}
    onChange={(e) => {

      const selectedContact =
        contacts.find(
          (c:any) => c.id === e.target.value
        );

      setEditedRecord((prev:any) => ({
        ...prev,
        primaryContactId: selectedContact?.id || '',
        primaryContact: selectedContact?.name || '',
      }));
    }}
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white"
  >
    <option value="">Select Primary Contact</option>

    {contacts
      .filter(
        (contact:any) =>
          contact.customerId === editedRecord.id
      )
      .map((contact:any) => (
        <option
          key={contact.id}
          value={contact.id}
        >
          {contact.name}
        </option>
      ))}
  </select>

) : field === 'contact' ? (

  <select
    value={editedRecord.contactId || ''}
    onChange={(e) => {

      const selectedContact =
        contacts.find(
          (c:any) => c.id === e.target.value
        );

      setEditedRecord((prev:any) => ({
        ...prev,
        contactId: selectedContact?.id || '',
        contact: selectedContact?.name || '',
      }));
    }}
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white"
  >
    <option value="">Select Contact</option>

    {contacts
      .filter(
        (contact:any) =>
          !editedRecord.customerId ||
          contact.customerId === editedRecord.customerId
      )
      .map((contact:any) => (
        <option
          key={contact.id}
          value={contact.id}
        >
          {contact.name}
          {contact.customer
            ? ` — ${contact.customer}`
            : ''}
        </option>
      ))}
  </select>

) : field === 'activityType' ? (

  <select
    value={editedRecord[field] || ''}
    onChange={(e) =>
      setEditedRecord((prev:any) => ({
        ...prev,
        [field]: e.target.value,
      }))
    }
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white"
  >
    <option>Call</option>
    <option>Meeting</option>
    <option>Email</option>
    <option>Task</option>
    <option>Demo</option>
  </select>

) : field === 'activityDate' ? (

  <input
    type="date"
    value={editedRecord[field] || ''}
    onChange={(e) =>
      setEditedRecord((prev:any) => ({
        ...prev,
        [field]: e.target.value,
      }))
    }
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white"
  />

) : field === 'notes' ? (

  <textarea
    value={editedRecord[field] || ''}
    onChange={(e) =>
      setEditedRecord((prev:any) => ({
        ...prev,
        [field]: e.target.value,
      }))
    }
    rows={4}
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white"
  />

) : field === 'stage' ? (

  <select
    value={editedRecord[field] || 'Qualification'}
    onChange={(e) =>
      setEditedRecord((prev:any) => ({
        ...prev,
        [field]: e.target.value,
      }))
    }
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white"
  >
    <option>Qualification</option>
    <option>Proposal Sent</option>
    <option>Negotiation</option>
    <option>Closed Won</option>
    <option>Closed Lost</option>
  </select>

) : field === 'closeDate' ? (

  <input
    type="date"
    value={editedRecord[field] || ''}
    onChange={(e) =>
      setEditedRecord((prev:any) => ({
        ...prev,
        [field]: e.target.value,
      }))
    }
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white"
  />
) : field === 'isPrimary' ? (

  <select
    value={
      editedRecord.isPrimary
        ? 'Yes'
        : 'No'
    }
    onChange={(e) =>
      setEditedRecord((prev:any) => ({
        ...prev,
        isPrimary: e.target.value === 'Yes',
      }))
    }
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
  >
    <option>No</option>
    <option>Yes</option>
  </select>
) : (
                    <input
                      type={field === 'amount' || field === 'price' ? 'number' : 'text'}
                      value={editedRecord[field] || ''}
                      onChange={(e) =>
                        setEditedRecord((prev:any) => ({
                          ...prev,
                          [field]: e.target.value,
                        }))
                      }
                      className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white"
                    />
                  )}
                </div>
              ))}
              
            </div>
)}

            {['leads','opportunities','orders','invoices'].includes(activePage) && (
              <div className="px-8 pb-8 bg-gradient-to-br from-white to-blue-50">
                <div className="bg-white rounded-[32px] border border-blue-100 shadow-xl overflow-hidden">
                  <div className="px-8 py-6 border-b border-blue-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-[#0F172A]">
                        Product Line Items
                      </h3>

                      <p className="text-gray-500 mt-1">
                        Manage products, quantity and pricing.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setLineItems((prev:any) => [
                          ...prev,
                          {
                            id: Date.now(),
                            product: '',
                            price: 0,
                            quantity: 1,
                            
                          },
                        ]);
                      }}
                      className="bg-[#0F172A] text-white px-5 py-3 rounded-2xl font-semibold shadow-lg hover:bg-blue-900 transition-all"
                    >
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
                        {lineItems.map((item:any) => (
                          <tr
                            key={item.id}
                            className="border-t border-blue-100 hover:bg-blue-50/50"
                          >
                            <td className="px-6 py-4">
                              <select
                                value={item.product}
                                onChange={(e) => {
                                  const selectedProduct = products.find(
                                    (product:any) => product.name === e.target.value
                                  );

                                  setLineItems((prev:any) =>
                                    prev.map((line:any) =>
                                      line.id === item.id
                                        ? {
                                            ...line,
                                            product: e.target.value,
                                            price: selectedProduct?.price || 0,
                                          }
                                        : line
                                    )
                                  );
                                }}
                                className="w-full border border-blue-200 rounded-xl px-3 py-3 text-[#0F172A] bg-white"
                              >
                                <option value="">Select Product</option>
                                {products.map((product:any) => (
                                  <option key={product.id} value={product.name}>
                                    {product.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="px-6 py-4">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => {
                                  setLineItems((prev:any) =>
                                    prev.map((line:any) =>
                                      line.id === item.id
                                        ? {
                                            ...line,
                                            quantity: Number(e.target.value),
                                          }
                                        : line
                                    )
                                  );
                                }}
                                className="w-24 border border-blue-200 rounded-xl px-3 py-2 text-[#0F172A]"
                              />
                            </td>

                            <td className="px-6 py-4">
                              <input
                                type="number"
                                value={item.price}
                                onChange={(e) => {
                                  setLineItems((prev:any) =>
                                    prev.map((line:any) =>
                                      line.id === item.id
                                        ? {
                                            ...line,
                                            price: Number(e.target.value),
                                          }
                                        : line
                                    )
                                  );
                                }}
                                className="w-36 border border-blue-200 rounded-xl px-3 py-2 text-[#0F172A]"
                              />
                            </td>

                            <td className="px-6 py-4 font-semibold text-[#0F172A]">
                              {formatCurrency(item.quantity * item.price)}
                            </td>

                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => {
                                  setLineItems((prev:any) =>
                                    prev.filter((line:any) => line.id !== item.id)
                                  );
                                }}
                                className="text-red-500 hover:text-red-700 font-semibold"
                              >
                                Remove
                              </button>
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
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-6 py-3 rounded-2xl border border-blue-200 text-[#0F172A] font-semibold"
              >
                Close
              </button>

              <button
                onClick={() => {
                  saveRecordChanges();
                  setSelectedRecord(null);
                }}
                className="bg-[#0F172A] text-white px-6 py-3 rounded-2xl font-semibold shadow-lg"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {createModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white rounded-[32px] shadow-2xl border border-blue-100 w-full max-w-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-blue-100 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-[#0F172A] capitalize">
                  Create {activePage === 'customers' ? 'Customer' : activePage === 'products' ? 'Product' : activePage === 'leads' ? 'Lead' : activePage === 'opportunities' ? 'Opportunity' : activePage === 'activities' ? 'Activity' : activePage === 'contacts' ? 'Contact' : activePage === 'orders' ? 'Order' : activePage === 'invoices' ? 'Invoice' : 'Record'}
                </h2>

                <p className="text-gray-500 mt-1">
                  Add a new record to {activePage}
                </p>
              </div>

              <button
                onClick={createNewRecord}
                className="w-10 h-10 rounded-full bg-blue-50 text-[#0F172A] font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold uppercase text-gray-700">
                  Name
                </label>

                <input
                  type="text"
                  value={createFormData.name}
                  onChange={(e) =>
                    setCreateFormData((prev:any) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder={`Enter ${activePage === 'customers' ? 'customer' : activePage === 'products' ? 'product' : activePage === 'leads' ? 'lead' : activePage === 'opportunities' ? 'opportunity' : activePage === 'activities' ? 'activity' : activePage === 'contacts' ? 'contact' : activePage === 'orders' ? 'order' : activePage === 'invoices' ? 'invoice' : 'record'} name`}
                  className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
                />
                
                  </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold uppercase text-gray-700">
                  Status
                </label>

                <select
                  value={createFormData.status}
                  onChange={(e) =>
                    setCreateFormData((prev:any) => ({
                      ...prev,
                      status: e.target.value,
                    }))
                  }
                  className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white"
                >
                  <option>New</option>
                  <option>Active</option>
                </select>
              </div>

              {activePage === 'customers' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase text-gray-700">
                      Email
                    </label>

                    <input
                       type="email"
                        value={createFormData.email || ''}
                         onChange={(e) =>
                          setCreateFormData((prev: any) => ({
                              ...prev,
                         email: e.target.value,
                        }))
                         }
               className="w-full mt-2 border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
                     />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase text-gray-700">
                      Phone
                    </label>

                    <input
                      type="text"
                       value={createFormData.phone || ''}
                       onChange={(e) =>
                       setCreateFormData((prev:any) => ({
                        ...prev,
                         phone: e.target.value,
                         }))
                         }
                        placeholder="+91 9876543210"
                     className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
                     />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold uppercase text-gray-700">
                      Billing Address
                    </label>

                    <input
                     type="text"
                     value={createFormData.billingAddress || ''}
                     onChange={(e) =>
                    setCreateFormData((prev:any) => ({
                      ...prev,
                      billingAddress: e.target.value,
                       }))
                       }
                       placeholder="Enter billing address"
                       className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
                     />
                  </div>
                   <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase text-gray-700">
                        Website
                      </label>

                       <input
                        type="text"
                         value={createFormData.website || ''}
                        onChange={(e) =>
                         setCreateFormData((prev:any) => ({
                         ...prev,
                          website: e.target.value,
                          }))
                       }
                         placeholder="https://example.com"
                         className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
                       />
                      </div>

                      <div className="space-y-2">
  <label className="text-sm font-semibold uppercase text-gray-700">
    Company
  </label>

  <input
    type="text"
    value={createFormData.company || ''}
    onChange={(e) =>
      setCreateFormData((prev:any) => ({
        ...prev,
        company: e.target.value,
      }))
    }
    placeholder="Enter company"
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
  />
</div>

<div className="space-y-2">
  <label className="text-sm font-semibold uppercase text-gray-700">
    Industry
  </label>

  <input
    type="text"
    value={createFormData.industry || ''}
    onChange={(e) =>
      setCreateFormData((prev:any) => ({
        ...prev,
        industry: e.target.value,
      }))
    }
    placeholder="Technology"
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
  />
</div>


                </>
              )}

              {activePage === 'products' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase text-gray-700">
                      Category
                    </label>

                    <input
                      type="text"
                       value={createFormData.category || ''}
  onChange={(e) =>
    setCreateFormData((prev:any) => ({
      ...prev,
      category: e.target.value,
    }))
  }
  placeholder="Software / Service"
  className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
/>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase text-gray-700">
                      Price
                    </label>

                    <input
                      type="number"
                      value={createFormData.price || ''}
                      onChange={(e) =>
                        setCreateFormData((prev:any) => ({
                          ...prev,
                          price: e.target.value,
                        }))
                      }
                      placeholder="25000"
                      className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
                    />
                  </div>
                </>
              )}
              {activePage === 'contacts' && (
  <>
    <div className="space-y-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Customer
      </label>

      <select
        value={createFormData.customerId || ''}
        onChange={(e) => {

  const selectedCustomer =
    customers.find(
      (c:any) => c.id === e.target.value
    );

  setCreateFormData((prev:any) => ({
    ...prev,
    customerId: selectedCustomer?.id || '',
    customer: selectedCustomer?.name || '',
    contact: '',
    contactId: '',
  }));
}}
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
      >
        <option value="">Select Customer</option>

        {customers.map((customer:any) => (
          <option
            key={customer.id}
            value={customer.id}
          >
            {customer.name}
          </option>
        ))}
      </select>
    </div>

    <div className="space-y-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Email
      </label>

      <input
        type="email"
        value={createFormData.email || ''}
        onChange={(e) =>
          setCreateFormData((prev:any) => ({
            ...prev,
            email: e.target.value,
          }))
        }
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
      />
    </div>

    <div className="space-y-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Phone
      </label>

      <input
        type="text"
        value={createFormData.phone || ''}
        onChange={(e) =>
          setCreateFormData((prev:any) => ({
            ...prev,
            phone: e.target.value,
          }))
        }
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
      />
    </div>

    <div className="space-y-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Designation
      </label>

      <input
        type="text"
        value={createFormData.designation || ''}
        onChange={(e) =>
          setCreateFormData((prev:any) => ({
            ...prev,
            designation: e.target.value,
          }))
        }
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
      />
    </div>

    <div className="space-y-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Department
      </label>

      <input
        type="text"
        value={createFormData.department || ''}
        onChange={(e) =>
          setCreateFormData((prev:any) => ({
            ...prev,
            department: e.target.value,
          }))
        }
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
      />
    </div>
  </>
)}
{activePage === 'activities' && (
  <>
    <div className="space-y-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Customer
      </label>

      <select
        value={createFormData.customerId || ''}
        onChange={(e) => {

  const selectedCustomer =
    customers.find(
      (c:any) => c.id === e.target.value
    );

  setCreateFormData((prev:any) => ({
    ...prev,
    customerId: selectedCustomer?.id || '',
    customer: selectedCustomer?.name || '',
    contact: '',
    contactId: '',
  }));
}}
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
      >
        <option value="">Select Customer</option>

        {customers.map((customer:any) => (
          <option
            key={customer.id}
            value={customer.id}
          >
            {customer.name}
          </option>
        ))}
      </select>
    </div>

    <div className="space-y-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Contact
      </label>

      <select
        value={createFormData.contactId || ''}
        onChange={(e) => {

  const selectedContact =
    contacts.find(
      (c:any) => c.id === e.target.value
    );

  setCreateFormData((prev:any) => ({
    ...prev,
    contactId: selectedContact?.id || '',
    contact: selectedContact?.name || '',
  }));
}}
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
      >
        <option value="">Select Contact</option>

        {contacts
  .filter(
    (contact:any) =>
      !createFormData.customerId ||
      contact.customerId === createFormData.customerId
  )
  .map((contact:any) => (
    <option
      key={contact.id}
      value={contact.id}
    >
      {contact.name}
      {contact.customer
        ? ` — ${contact.customer}`
        : ''}
    </option>
))}
      </select>
    </div>

    <div className="space-y-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Subject
      </label>

      <input
        type="text"
        value={createFormData.subject || ''}
        onChange={(e) =>
          setCreateFormData((prev:any) => ({
            ...prev,
            subject: e.target.value,
          }))
        }
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
      />
    </div>

    <div className="space-y-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Activity Type
      </label>

      <select
        value={createFormData.activityType || ''}
        onChange={(e) =>
          setCreateFormData((prev:any) => ({
            ...prev,
            activityType: e.target.value,
          }))
        }
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
      >
        <option value="">Select Type</option>
        <option>Call</option>
        <option>Meeting</option>
        <option>Email</option>
        <option>Task</option>
        <option>Demo</option>
      </select>
    </div>

    <div className="space-y-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Activity Date
      </label>

      <input
        type="date"
        value={createFormData.activityDate || ''}
        onChange={(e) =>
          setCreateFormData((prev:any) => ({
            ...prev,
            activityDate: e.target.value,
          }))
        }
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
      />
    </div>

    <div className="space-y-2 md:col-span-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Notes
      </label>

      <textarea
        value={createFormData.notes || ''}
        onChange={(e) =>
          setCreateFormData((prev:any) => ({
            ...prev,
            notes: e.target.value,
          }))
        }
        rows={4}
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
      />
    </div>
  </>
)}

              {activePage === 'leads' && (
                <>
                  <div className="space-y-2">
  <label className="text-sm font-semibold uppercase text-gray-700">
    Customer
  </label>

  <select
    value={createFormData.customerId || ''}
    onChange={(e) => {

      const selectedCustomer =
        customers.find(
          (c:any) => c.id === e.target.value
        );

      setCreateFormData((prev:any) => ({
        ...prev,
        customerId: selectedCustomer?.id || '',
        customer: selectedCustomer?.name || '',
contact: '',
contactId: '',
      }));
    }}
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
  >
    <option value="">Select Customer</option>

    {customers.map((customer:any) => (
      <option
        key={customer.id}
        value={customer.id}
      >
        {customer.name}
      </option>
    ))}
  </select>
</div>
                  <div className="space-y-2">
  <label className="text-sm font-semibold uppercase text-gray-700">
    Contact
  </label>

  <select
    value={createFormData.contactId || ''}
    onChange={(e) => {

      const selectedContact =
        contacts.find(
          (c:any) => c.id === e.target.value
        );

      setCreateFormData((prev:any) => ({
        ...prev,
        contactId: selectedContact?.id || '',
        contact: selectedContact?.name || '',
      }));
    }}
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
  >
    <option value="">Select Contact</option>

    {contacts
  .filter(
    (contact:any) =>
      !createFormData.customerId ||
      contact.customerId === createFormData.customerId
  )
  .map((contact:any) => (
    <option
      key={contact.id}
      value={contact.id}
    >
      {contact.name}
      {contact.customer
        ? ` — ${contact.customer}`
        : ''}
    </option>
))}
  </select>
</div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase text-gray-700">
                      Amount
                    </label>

                    <input
                      type="number"
                      value={createFormData.amount}
                      onChange={(e) =>
                        setCreateFormData((prev:any) => ({
                          ...prev,
                          amount: e.target.value,
                        }))
                      }
                      placeholder="120000"
                      className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
                    />
                  </div>
                  <div className="space-y-2">
  <label className="text-sm font-semibold uppercase text-gray-700">
    Email
  </label>

  <input
    type="email"
    value={createFormData.email || ''}
    onChange={(e) =>
      setCreateFormData((prev:any) => ({
        ...prev,
        email: e.target.value,
      }))
    }
    placeholder="lead@example.com"
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
  />
</div>
<div className="space-y-2">
  <label className="text-sm font-semibold uppercase text-gray-700">
    Phone
  </label>

  <input
    type="text"
    value={createFormData.phone || ''}
    onChange={(e) =>
      setCreateFormData((prev:any) => ({
        ...prev,
        phone: e.target.value,
      }))
    }
    placeholder="+91 9876543210"
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
  />
</div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase text-gray-700">
                      Source
                    </label>

                    <select
  value={createFormData.source || ''}
  onChange={(e) =>
    setCreateFormData((prev:any) => ({
      ...prev,
      source: e.target.value,
    }))
  }
  className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
>
  <option>Website</option>
  <option>Campaign</option>
  <option>Referral</option>
</select>
                  </div>
                </>
              )}

              {activePage === 'opportunities' && (
                <>
                  <div className="space-y-2">
  <label className="text-sm font-semibold uppercase text-gray-700">
    Customer
  </label>

  <select
    value={createFormData.customerId || ''}
    onChange={(e) => {

      const selectedCustomer =
        customers.find(
          (c:any) => c.id === e.target.value
        );

      setCreateFormData((prev:any) => ({
        ...prev,
        customerId: selectedCustomer?.id || '',
        customer: selectedCustomer?.name || '',
contact: '',
contactId: '',
      }));
    }}
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
  >
    <option value="">Select Customer</option>

    {customers.map((customer:any) => (
  <option
    key={customer.id}
    value={customer.id}
  >
    {customer.name}
  </option>
))}
  </select>
</div>
                  <div className="space-y-2">
  <label className="text-sm font-semibold uppercase text-gray-700">
    Contact
  </label>

  <select
    value={createFormData.contactId || ''}
    onChange={(e) => {

      const selectedContact =
        contacts.find(
          (c:any) => c.id === e.target.value
        );

      setCreateFormData((prev:any) => ({
        ...prev,
        contactId: selectedContact?.id || '',
        contact: selectedContact?.name || '',
      }));
    }}
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
  >
    <option value="">Select Contact</option>

    {contacts
  .filter(
    (contact:any) =>
      !createFormData.customerId ||
      contact.customerId === createFormData.customerId
  )
  .map((contact:any) => (
    <option
      key={contact.id}
      value={contact.id}
    >
      {contact.name}
      {contact.customer
        ? ` — ${contact.customer}`
        : ''}
    </option>
))}
  </select>
</div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase text-gray-700">
                      Amount
                    </label>

                    <input
  type="number"
  value={createFormData.amount || ''}
  onChange={(e) =>
    setCreateFormData((prev:any) => ({
      ...prev,
      amount: e.target.value,
    }))
  }
  placeholder="200000"
  className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
/>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase text-gray-700">
                      Close Date
                    </label>

                    <input
  type="date"
  value={createFormData.closeDate || ''}
  onChange={(e) =>
    setCreateFormData((prev:any) => ({
      ...prev,
      closeDate: e.target.value,
    }))
  }
  className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
/>
                  </div>
                  <div className="space-y-2">
  <label className="text-sm font-semibold uppercase text-gray-700">
    Stage
  </label>

  <select
    value={createFormData.stage || 'Qualification'}
    onChange={(e) =>
      setCreateFormData((prev:any) => ({
        ...prev,
        stage: e.target.value,
      }))
    }
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
  >
    <option>Qualification</option>
    <option>Proposal Sent</option>
    <option>Negotiation</option>
    <option>Closed Won</option>
    <option>Closed Lost</option>
  </select>
</div>
                </>
              )}
            {activePage === 'orders' && (
  <>
    <div className="space-y-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Customer
      </label>

      <select
       value={createFormData.customerId || ''}
        onChange={(e) => {

  const selectedCustomer =
    customers.find(
      (c:any) => c.id === e.target.value
    );

  setCreateFormData((prev:any) => ({
    ...prev,
    customerId: selectedCustomer?.id || '',
    customer: selectedCustomer?.name || '',
    contact: '',
    contactId: '',
  }));
}}
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
      >
        <option value="">Select Customer</option>

        {customers.map((customer:any) => (
          <option
            key={customer.id}
            value={customer.id}
          >
            {customer.name}
          </option>
        ))}
      </select>
    </div>
    <div className="space-y-2">
  <label className="text-sm font-semibold uppercase text-gray-700">
    Contact
  </label>

  <select
    value={createFormData.contactId || ''}
    onChange={(e) => {

      const selectedContact =
        contacts.find(
          (c:any) => c.id === e.target.value
        );

      setCreateFormData((prev:any) => ({
        ...prev,
        contactId: selectedContact?.id || '',
        contact: selectedContact?.name || '',
      }));
    }}
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
  >
    <option value="">Select Contact</option>

    {contacts
  .filter(
    (contact:any) =>
      !createFormData.customerId ||
      contact.customerId === createFormData.customerId
  )
  .map((contact:any) => (
    <option
      key={contact.id}
      value={contact.id}
    >
      {contact.name}
      {contact.customer
        ? ` — ${contact.customer}`
        : ''}
    </option>
))}
  </select>
</div>

    <div className="space-y-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Delivery Date
      </label>

      <input
        type="date"
        value={createFormData.deliveryDate || ''}
        onChange={(e) =>
          setCreateFormData((prev:any) => ({
            ...prev,
            deliveryDate: e.target.value,
          }))
        }
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
      />
    </div>

    <div className="space-y-2 md:col-span-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Shipping Address
      </label>

      <input
        type="text"
        value={createFormData.shippingAddressOrder || ''}
        onChange={(e) =>
          setCreateFormData((prev:any) => ({
            ...prev,
            shippingAddressOrder: e.target.value,
          }))
        }
        placeholder="Enter shipping address"
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
      />
    </div>
  </>
)}
{activePage === 'invoices' && (
  <>
    <div className="space-y-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Customer
      </label>

      <select
       value={createFormData.customerId || ''}
        onChange={(e) => {

  const selectedCustomer =
    customers.find(
      (c:any) => c.id === e.target.value
    );

  setCreateFormData((prev:any) => ({
    ...prev,
    customerId: selectedCustomer?.id || '',
    customer: selectedCustomer?.name || '',
    contact: '',
    contactId: '',
  }));
}}
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
      >
        <option value="">Select Customer</option>

        {customers.map((customer:any) => (
          <option
            key={customer.id}
            value={customer.id}
          >
            {customer.name}
          </option>
        ))}
      </select>
    </div>
    <div className="space-y-2">
  <label className="text-sm font-semibold uppercase text-gray-700">
    Contact
  </label>

  <select
    value={createFormData.contactId || ''}
    onChange={(e) => {

      const selectedContact =
        contacts.find(
          (c:any) => c.id === e.target.value
        );

      setCreateFormData((prev:any) => ({
        ...prev,
        contactId: selectedContact?.id || '',
        contact: selectedContact?.name || '',
      }));
    }}
    className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
  >
    <option value="">Select Contact</option>

    {contacts
  .filter(
    (contact:any) =>
      !createFormData.customerId ||
      contact.customerId === createFormData.customerId
  )
  .map((contact:any) => (
      <option
        key={contact.id}
        value={contact.id}
      >
        {contact.name}
        {contact.customer
          ? ` — ${contact.customer}`
          : ''}
      </option>
    ))}
  </select>
</div>

    <div className="space-y-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Due Date
      </label>

      <input
        type="date"
        value={createFormData.dueDate || ''}
        onChange={(e) =>
          setCreateFormData((prev:any) => ({
            ...prev,
            dueDate: e.target.value,
          }))
        }
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
      />
    </div>

    <div className="space-y-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Payment Terms
      </label>

      <select
        value={createFormData.paymentTerms || ''}
        onChange={(e) =>
          setCreateFormData((prev:any) => ({
            ...prev,
            paymentTerms: e.target.value,
          }))
        }
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
      >
        <option value="">Select Terms</option>
        <option>Due on Receipt</option>
        <option>Net 15</option>
        <option>Net 30</option>
        <option>Net 45</option>
      </select>
    </div>

    <div className="space-y-2 md:col-span-2">
      <label className="text-sm font-semibold uppercase text-gray-700">
        Billing Address
      </label>

      <input
        type="text"
        value={createFormData.billingAddressInvoice || ''}
        onChange={(e) =>
          setCreateFormData((prev:any) => ({
            ...prev,
            billingAddressInvoice: e.target.value,
          }))
        }
        placeholder="Enter billing address"
        className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
      />
    </div>
  </>
)}
            </div>

            <div className="px-8 py-6 border-t border-blue-100 flex justify-end gap-4">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="px-5 py-3 rounded-2xl border border-blue-200 text-[#0F172A] font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={createNewRecord}
                className="bg-[#0F172A] text-white px-6 py-3 rounded-2xl font-semibold"
              >
                Create {activePage === 'customers' ? 'Customer' : activePage === 'products' ? 'Product' : activePage === 'leads' ? 'Lead' : activePage === 'opportunities' ? 'Opportunity' : activePage === 'activities' ? 'Activity' : activePage === 'contacts' ? 'Contact' : activePage === 'orders' ? 'Order' : activePage === 'invoices' ? 'Invoice' : 'Record'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
    <div
  style={{
    position: 'fixed',
    left: '-99999px',
    top: 0,
    width: '900px',
    background: '#ffffff',
    padding: '40px',
    zIndex: -1,
  }}
>

  <div ref={printableQuoteRef}>

    {selectedQuoteTemplate &&
     selectedQuoteOpportunity && (

      <div
        style={{
          background: '#ffffff',
          color: '#000000',
          fontFamily: 'Arial',
        }}
      >

        <h1
          style={{
            fontSize: '32px',
            fontWeight: 'bold',
            marginBottom: '20px',
          }}
        >
          {selectedQuoteTemplate.quoteTitle}
        </h1>

        <div style={{ marginBottom: '30px' }}>

          <div>
            {selectedQuoteTemplate.companyName}
          </div>

          <div>
            {selectedQuoteTemplate.companyEmail}
          </div>

          <div>
            {selectedQuoteTemplate.companyPhone}
          </div>

          <div>
            {selectedQuoteTemplate.companyAddress}
          </div>

        </div>

        <hr />

        <div
          style={{
            marginTop: '20px',
            marginBottom: '20px',
          }}
        >

          <div>
            <strong>Customer:</strong>
            {' '}
            {selectedQuoteOpportunity.customer}
          </div>

          <div>
            <strong>Contact:</strong>
            {' '}
            {selectedQuoteOpportunity.contact}
          </div>

        </div>

        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >

          <thead>

            <tr>

              {[
                'Product',
                'Qty',
                'Price',
                'Amount',
              ].map((head) => (

                <th
                  key={head}
                  style={{
                    border:
                      '1px solid #cccccc',
                    padding: '10px',
                    textAlign: 'left',
                  }}
                >
                  {head}
                </th>

              ))}

            </tr>

          </thead>

          <tbody>

            {quoteLineItems.map(
              (item:any, index:number) => (

                <tr key={index}>

                  <td
                    style={{
                      border:
                        '1px solid #cccccc',
                      padding: '10px',
                    }}
                  >
                    {item.product}
                  </td>

                  <td
                    style={{
                      border:
                        '1px solid #cccccc',
                      padding: '10px',
                    }}
                  >
                    {item.quantity}
                  </td>

                  <td
                    style={{
                      border:
                        '1px solid #cccccc',
                      padding: '10px',
                    }}
                  >
                    {formatCurrency(
                      item.price
                    )}
                  </td>

                  <td
                    style={{
                      border:
                        '1px solid #cccccc',
                      padding: '10px',
                    }}
                  >
                    {formatCurrency(
                      item.quantity *
                      item.price
                    )}
                  </td>

                </tr>

              )
            )}

          </tbody>

        </table>

      </div>

    )}

  </div>

</div>
{quotePreviewOpen &&
 selectedQuoteOpportunity &&
 selectedQuoteTemplate && (

  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[120] p-6 overflow-auto">

    <div className="bg-white rounded-[32px] shadow-2xl border border-blue-100 w-full max-w-6xl overflow-hidden">

      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 px-8 py-6 text-white flex items-center justify-between">

        <div>

          <h2 className="text-3xl font-bold">
            Quote Preview
          </h2>

          <p className="text-blue-100 mt-1">
            Opportunity:
            {' '}
            {selectedQuoteOpportunity.name}
          </p>

        </div>

        <div className="flex items-center gap-3">

  <button
    onClick={() =>
      window.print()
    }
    className="bg-white/10 hover:bg-white/20 px-5 py-3 rounded-2xl font-semibold"
  >
    Print
  </button>

  <button
    onClick={() =>
      downloadQuotePDF()
    }
    className="bg-white text-[#0F172A] px-5 py-3 rounded-2xl font-bold"
  >
    Download PDF
  </button>

  <button
    onClick={() =>
      setQuotePreviewOpen(false)
    }
    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20"
  >
    ✕
  </button>

</div>

      </div>

      <div className="p-10 bg-gray-100 overflow-auto max-h-[80vh] print:bg-white">

        <div
  ref={quotePreviewRef}
  style={{
    background: '#ffffff',
    color: '#000000',
  }}
  className="bg-white rounded-[24px] p-12 max-w-4xl mx-auto"
>

          <div className="flex items-start justify-between border-b pb-8">

            <div>

              <h1 className="text-4xl font-bold text-[#0F172A]">
                {selectedQuoteTemplate.quoteTitle}
              </h1>

              <div className="mt-4 text-gray-600 space-y-1">

                <div>
                  {selectedQuoteTemplate.companyName}
                </div>

                <div>
                  {selectedQuoteTemplate.companyEmail}
                </div>

                <div>
                  {selectedQuoteTemplate.companyPhone}
                </div>

                <div>
                  {selectedQuoteTemplate.companyAddress}
                </div>

              </div>

            </div>

            <div className="text-right">

              <div className="text-sm text-gray-500">
                Quote Date
              </div>

              <div className="font-semibold mt-1">
                {new Date().toLocaleDateString()}
              </div>

              <div className="text-sm text-gray-500 mt-5">
                Opportunity
              </div>

              <div className="font-semibold mt-1">
                {selectedQuoteOpportunity.id}
              </div>

            </div>

          </div>

          <div className="grid grid-cols-2 gap-8 mt-10">

            <div>

              <div className="text-sm text-gray-500 mb-2">
                Customer
              </div>

              <div className="text-xl font-bold text-[#0F172A]">
                {selectedQuoteOpportunity.customer}
              </div>

            </div>

            <div>

              <div className="text-sm text-gray-500 mb-2">
                Contact
              </div>

              <div className="text-xl font-bold text-[#0F172A]">
                {selectedQuoteOpportunity.contact}
              </div>

            </div>

          </div>

          <div className="mt-10 overflow-hidden rounded-2xl border border-blue-100">

            <table className="w-full">

              <thead className="bg-[#0F172A] text-white">

                <tr>

                  <th className="px-6 py-4 text-left">
                    Product
                  </th>

                  <th className="px-6 py-4 text-left">
                    Quantity
                  </th>

                  <th className="px-6 py-4 text-left">
                    Price
                  </th>

                  <th className="px-6 py-4 text-left">
                    Amount
                  </th>

                </tr>

              </thead>

              <tbody>

                {quoteLineItems.map(
                  (item:any, index:number) => (

                    <tr
                      key={index}
                      className="border-t border-blue-100"
                    >

                      <td className="px-6 py-4">
                        {item.product}
                      </td>

                      <td className="px-6 py-4">
                        {item.quantity}
                      </td>

                      <td className="px-6 py-4">
                        {formatCurrency(item.price)}
                      </td>

                      <td className="px-6 py-4 font-semibold">
                        {formatCurrency(
                          item.quantity * item.price
                        )}
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

          <div className="flex justify-end mt-8">

            <div className="bg-blue-50 rounded-2xl px-8 py-6 w-[320px]">

              <div className="flex justify-between text-lg">

                <span>
                  Total
                </span>

                <span className="font-bold text-[#0F172A]">

                  {formatCurrency(
                    quoteLineItems.reduce(
                      (sum:number, item:any) =>
                        sum +
                        (
                          item.quantity *
                          item.price
                        ),
                      0
                    )
                  )}

                </span>

              </div>

            </div>

          </div>

          <div className="mt-12">

            <div className="text-lg font-bold text-[#0F172A] mb-3">
              Terms & Conditions
            </div>

            <div className="text-gray-600 leading-relaxed">
              {
                selectedQuoteTemplate.termsAndConditions
              }
            </div>

          </div>

          <div className="mt-12 border-t pt-6 text-gray-500 text-sm">

            {
              selectedQuoteTemplate.footerText
            }

          </div>

        </div>

      </div>

    </div>

  </div>

)}
</div>

    </div>
  );
}
