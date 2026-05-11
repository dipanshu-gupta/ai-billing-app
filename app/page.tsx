'use client';
// @ts-nocheck

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
};

export default function AIBillingApp() {
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  const fetchCustomers = async () => {
  const { data, error } = await supabase?
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error && data) {
    setCustomers(data);
  }

  console.log(error);
};
useEffect(() => {
  fetchCustomers();
}, []);

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
    stage: '',
    closeDate: '',
    shippingAddressOrder: '',
    deliveryDate: '',
    dueDate: '',
    paymentTerms: '',
  });
  const [lineItems, setLineItems] = useState<any[]>([]);

  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const navigatorRef = useRef<HTMLElement | null>(null);

const [customers, setCustomers] = useState<any[]>([]);

  const addCustomer = async () => {
  const { data, error } = await supabase?
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

  const [products, setProducts] = useState([
    {
      id: 'PROD-001',
      name: 'Cloud Subscription',
      category: 'Software',
      status: 'Active',
      price: 25000,
    },
  ]);

  const [leads, setLeads] = useState([
    {
      id: 'LEAD-001',
      name: 'Rahul Sharma',
      customer: 'ABC Corp',
      status: 'Qualified',
      amount: 120000,
    },
  ]);

  const [opportunities, setOpportunities] = useState([
    {
      id: 'OPP-001',
      name: 'Vision Tech Renewal',
      customer: 'ABC Corp',
      status: 'Open',
      amount: 200000,
    },
  ]);

  const [orders, setOrders] = useState([
    {
      id: 'ORD-001',
      customer: 'ABC Corp',
      status: 'Processing',
      amount: 78000,
    },
  ]);

  const [invoices, setInvoices] = useState([
    {
      id: 'INV-001',
      customer: 'ABC Corp',
      status: 'Pending',
      amount: 52000,
    },
  ]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target as Node)
      ) {
        setOpenActionMenu(null);
      }

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

  const openDetailsPage = (record: any) => {
    setSelectedRecord(record);
    setEditedRecord(record);
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
          'status',
        ];
      case 'products':
        return ['name', 'category', 'price', 'status'];
      case 'leads':
        return ['name', 'customer', 'email', 'phone', 'source', 'amount', 'status'];
      case 'opportunities':
        return ['name', 'customer', 'stage', 'amount', 'closeDate', 'status'];
      case 'orders':
        return ['customer', 'amount', 'shippingAddress', 'deliveryDate', 'status'];
      case 'invoices':
        return ['customer', 'amount', 'dueDate', 'paymentTerms', 'status'];
      default:
        return ['name', 'status'];
    }
  };
const createNewRecord = async () => {
  if (activePage === 'customers') {
    const { error } = await supabase?
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
    }

    console.log(error);

    return;
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

  const saveRecordChanges = () => {
    if (activePage === 'leads') {
      setLeads((prev:any) =>
        prev.map((item:any) =>
          item.id === editedRecord.id ? editedRecord : item
        )
      );
    } else if (activePage === 'opportunities') {
      setOpportunities((prev:any) =>
        prev.map((item:any) =>
          item.id === editedRecord.id ? editedRecord : item
        )
      );
    } else if (activePage === 'customers') {
      setCustomers((prev:any) =>
        prev.map((item:any) =>
          item.id === editedRecord.id ? editedRecord : item
        )
      );
    } else if (activePage === 'products') {
      setProducts((prev:any) =>
        prev.map((item:any) =>
          item.id === editedRecord.id ? editedRecord : item
        )
      );
    } else if (activePage === 'orders') {
      setOrders((prev:any) =>
        prev.map((item:any) =>
          item.id === editedRecord.id ? editedRecord : item
        )
      );
    } else if (activePage === 'invoices') {
      setInvoices((prev:any) =>
        prev.map((item:any) =>
          item.id === editedRecord.id ? editedRecord : item
        )
      );
    }

    setSelectedRecord(editedRecord);
  };

  const convertLeadToOpportunity = (lead:any) => {
    const updatedLead = {
      ...lead,
      status: 'Converted',
    };

    setLeads((prev:any) =>
      prev.map((item:any) =>
        item.id === lead.id ? updatedLead : item
      )
    );

    const newOpportunity = {
      id: `OPP-${Date.now()}`,
      name: lead.name,
      customer: lead.customer,
      status: 'Open',
      amount: lead.amount,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      lineItems: [...lineItems],
    };

    setOpportunities((prev:any) => [...prev, newOpportunity]);
    setOpenActionMenu(null);
  };

  const createOrderFromOpportunity = (opportunity:any) => {
    const updatedOpportunity = {
      ...opportunity,
      status: 'Closed Won',
    };

    setOpportunities((prev:any) =>
      prev.map((item:any) =>
        item.id === opportunity.id ? updatedOpportunity : item
      )
    );

    const newOrder = {
      id: `ORD-${Date.now()}`,
      customer: opportunity.customer,
      name: opportunity.name,
      status: 'Processing',
      amount: opportunity.amount,
      lineItems: [...lineItems],
    };

    setOrders((prev:any) => [...prev, newOrder]);
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
      default:
        return [];
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-white via-blue-50 to-blue-100">
      <aside
        ref={navigatorRef}
        className={`${sidebarCollapsed ? 'w-24' : 'w-72'} bg-[#0F172A] text-white transition-all duration-300 min-h-screen sticky top-0 shadow-2xl`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            {!sidebarCollapsed && (
              <h2 className="text-2xl font-bold">Navigator</h2>
            )}

            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="bg-blue-800 hover:bg-blue-700 px-3 py-2 rounded-xl"
            >
              {sidebarCollapsed ? '→' : '←'}
            </button>
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

      <main className="flex-1 p-8 overflow-auto">
        <div className="bg-white rounded-[32px] p-8 shadow-xl border border-blue-100 w-full min-h-screen">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-[#0F172A] capitalize">
              {activePage}
            </h1>

            {activePage !== 'dashboard' && (
              <button
                onClick={() => setCreateModalOpen(true)}
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
                    <button
  onClick={addCustomer}
  className="bg-green-600 text-white px-6 py-3 rounded-2xl font-semibold"
>
  Test Supabase
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
                          onClick={() => {
                            setOpenActionMenu(
                              openActionMenu === record.id ? null : record.id
                            );
                          }}
                          className="inline-flex w-10 h-10 items-center justify-center rounded-full bg-[#0F172A] text-white hover:bg-blue-800 shadow-lg border border-blue-700 transition-all mx-auto text-2xl font-bold cursor-pointer"
                        >
                          ⋮
                        </button>

                        {openActionMenu === record.id && (
                          <div
                            ref={actionMenuRef}
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
                              <button
                              onClick={() => createOrderFromOpportunity(record)}
                              className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-800 text-white"
                            >
                              Create Order
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
                            product: products[0]?.name || 'Product',
                            price: products[0]?.price || 0,
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
                      placeholder="customer@company.com"
                      className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase text-gray-700">
                      Phone
                    </label>

                    <input
                      type="text"
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
                      placeholder="Enter billing address"
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
                      placeholder="25000"
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
                      value={createFormData.customer}
                      onChange={(e) =>
                        setCreateFormData((prev:any) => ({
                          ...prev,
                          customer: e.target.value,
                        }))
                      }
                      className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
                    >
                      {customers.map((customer:any) => (
                        <option key={customer.id}>{customer.name}</option>
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
                      Source
                    </label>

                    <select className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]">
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

                    <select className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]">
                      {customers.map((customer:any) => (
                        <option key={customer.id}>{customer.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase text-gray-700">
                      Amount
                    </label>

                    <input
                      type="number"
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
    </main>
    </div>
  );
}
