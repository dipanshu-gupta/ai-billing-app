'use client';
// @ts-nocheck

import React, { useEffect, useRef, useState } from 'react';
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
  { key: 'invoices', label: 'Invoices', icon: '🧾' },
  { key: 'orders', label: 'Orders', icon: '🛒' },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function AIBillingApp() {
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [editableRecord, setEditableRecord] = useState<any | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newRecord, setNewRecord] = useState<any>({ products: [] });
  const [reportGenerated, setReportGenerated] = useState(false);
  const [selectedTimeline, setSelectedTimeline] = useState('Last 30 Days');
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  const [customers] = useState([
    {
      id: 'CUST-001',
      name: 'ABC Corp',
      email: 'finance@abccorp.com',
      status: 'Active',
    },
  ]);

  const [products] = useState([
    {
      id: 'PROD-001',
      name: 'Cloud Subscription',
      category: 'Software',
      status: 'Active',
      price: 25000,
    },
    {
      id: 'PROD-002',
      name: 'AI Analytics Suite',
      category: 'Analytics',
      status: 'Active',
      price: 45000,
    },
  ]);

  const [leads, setLeads] = useState([
    {
      id: 'LEAD-001',
      name: 'Rahul Sharma',
      company: 'Vision Tech',
      status: 'Qualified',
      amount: 120000,
      products: [],
    },
  ]);

  const [opportunities, setOpportunities] = useState([
    {
      id: 'OPP-001',
      name: 'Vision Tech Renewal',
      stage: 'Proposal',
      status: 'Open',
      amount: 200000,
      products: [],
    },
  ]);

  const [activities] = useState([
    {
      id: 'ACT-001',
      subject: 'Client Follow-up',
      status: 'Scheduled',
    },
  ]);

  const [contacts] = useState([
    {
      id: 'CONT-001',
      name: 'Aman Verma',
      status: 'Active',
    },
  ]);

  const [invoices, setInvoices] = useState([
    {
      id: 'INV-001',
      customer: 'ABC Corp',
      status: 'Pending',
      amount: 52000,
      products: [],
    },
  ]);

  const [orders, setOrders] = useState([
    {
      id: 'ORD-001',
      customer: 'ABC Corp',
      total: 78000,
      status: 'Processing',
      products: [],
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
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
      case 'activities':
        return activities;
      case 'contacts':
        return contacts;
      case 'invoices':
        return invoices;
      case 'orders':
        return orders;
      default:
        return [];
    }
  };

  const getSingularLabel = () => {
    switch (activePage) {
      case 'customers':
        return 'Customer';
      case 'products':
        return 'Product';
      case 'leads':
        return 'Lead';
      case 'opportunities':
        return 'Opportunity';
      case 'activities':
        return 'Activity';
      case 'contacts':
        return 'Contact';
      case 'invoices':
        return 'Invoice';
      case 'orders':
        return 'Order';
      default:
        return 'Record';
    }
  };

  const getStatusOptions = () => {
    switch (activePage) {
      case 'leads':
        return ['New', 'Qualified', 'Converted'];
      case 'opportunities':
        return ['Open', 'Proposal', 'Closed Won'];
      case 'activities':
        return ['Scheduled', 'Completed'];
      case 'contacts':
        return ['Active', 'Inactive'];
      case 'invoices':
        return ['Draft', 'Pending', 'Paid'];
      case 'orders':
        return ['Processing', 'Shipped', 'Delivered'];
      default:
        return ['Active', 'Inactive'];
    }
  };

  const openRecordDetails = (record: any) => {
    setSelectedRecord(record);
    setEditableRecord(JSON.parse(JSON.stringify(record)));
  };

  const handleSaveRecord = () => {
    switch (activePage) {
      case 'leads':
        setLeads((prev: any) =>
          prev.map((record: any) =>
            record.id === editableRecord.id ? editableRecord : record
          )
        );
        break;

      case 'opportunities':
        setOpportunities((prev: any) =>
          prev.map((record: any) =>
            record.id === editableRecord.id ? editableRecord : record
          )
        );
        break;

      case 'orders':
        setOrders((prev: any) =>
          prev.map((record: any) =>
            record.id === editableRecord.id ? editableRecord : record
          )
        );
        break;

      case 'invoices':
        setInvoices((prev: any) =>
          prev.map((record: any) =>
            record.id === editableRecord.id ? editableRecord : record
          )
        );
        break;

      default:
        break;
    }

    setSelectedRecord(null);
    setEditableRecord(null);
  };

  const handleCreateRecord = () => {
    const createdRecord = {
      id: `${activePage.slice(0, 3).toUpperCase()}-${Date.now()}`,
      ...newRecord,
    };

    switch (activePage) {
      case 'leads':
        setLeads((prev: any) => [...prev, createdRecord]);
        break;
      case 'opportunities':
        setOpportunities((prev: any) => [...prev, createdRecord]);
        break;
      case 'orders':
        setOrders((prev: any) => [...prev, createdRecord]);
        break;
      default:
        break;
    }

    setCreateModalOpen(false);
    setNewRecord({ products: [] });
  };

  const handleConvertLead = (leadRecord: any) => {
    setLeads((prev: any) =>
      prev.map((lead: any) =>
        lead.id === leadRecord.id
          ? { ...lead, status: 'Converted' }
          : lead
      )
    );

    setOpportunities((prev: any) => [
      ...prev,
      {
        id: `OPP-${Date.now()}`,
        name: leadRecord.name,
        stage: 'Qualification',
        status: 'Open',
        amount: leadRecord.amount,
        products: leadRecord.products || [],
      },
    ]);

    setOpenActionMenu(null);
  };

  const handleCreateOrder = (opportunityRecord: any) => {
    setOpportunities((prev: any) =>
      prev.map((opp: any) =>
        opp.id === opportunityRecord.id
          ? { ...opp, status: 'Closed Won' }
          : opp
      )
    );

    setOrders((prev: any) => [
      ...prev,
      {
        id: `ORD-${Date.now()}`,
        customer: opportunityRecord.name,
        total: opportunityRecord.amount,
        status: 'Processing',
        products: opportunityRecord.products || [],
      },
    ]);

    setOpenActionMenu(null);
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-white via-blue-50 to-blue-100">
      <aside
        className={`${sidebarCollapsed ? 'w-24' : 'w-72'} bg-[#0F172A] text-white transition-all duration-300 min-h-screen`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            {!sidebarCollapsed && (
              <h2 className="text-2xl font-bold">Navigator</h2>
            )}

            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="bg-blue-800/60 hover:bg-blue-700 px-3 py-2 rounded-xl"
            >
              {sidebarCollapsed ? '→' : '←'}
            </button>
          </div>

          <div className="space-y-3">
            {navigationItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActivePage(item.key)}
                className={`w-full flex items-center rounded-2xl transition-all duration-200 py-3 px-4 ${activePage===item.key ? 'bg-white text-[#0F172A] shadow-lg font-semibold' : 'bg-white/10 hover:bg-blue-700/60 text-white'}`}
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

      <main className="flex-1 p-8 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-white">
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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <div className="bg-white rounded-[28px] p-6 shadow-lg border border-blue-100">
                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Total Customers
                </div>
                <div className="text-4xl font-bold text-[#0F172A] mt-4">
                  {customers.length}
                </div>
              </div>

              <div className="bg-white rounded-[28px] p-6 shadow-lg border border-blue-100">
                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Qualified Leads
                </div>
                <div className="text-4xl font-bold text-[#0F172A] mt-4">
                  {leads.filter((lead:any)=>lead.status==='Qualified').length}
                </div>
              </div>

              <div className="bg-white rounded-[28px] p-6 shadow-lg border border-blue-100">
                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Open Opportunities
                </div>
                <div className="text-4xl font-bold text-[#0F172A] mt-4">
                  {opportunities.length}
                </div>
              </div>

              <div className="bg-white rounded-[28px] p-6 shadow-lg border border-blue-100">
                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Revenue
                </div>
                <div className="text-3xl font-bold text-[#0F172A] mt-4 break-words">
                  {formatCurrency(invoices.reduce((sum:any,invoice:any)=>sum+(invoice.amount||0),0))}
                </div>
              </div>
            </div>

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

                <div className="space-y-4 mt-8 flex-1">
                  <button className="w-full bg-white text-[#0F172A] rounded-3xl p-5 text-left font-semibold hover:bg-blue-50 transition-all shadow-lg">
                    Show revenue summary for current month
                  </button>

                  <button className="w-full bg-white text-[#0F172A] rounded-3xl p-5 text-left font-semibold hover:bg-blue-50 transition-all shadow-lg">
                    Show qualified and converted leads
                  </button>

                  <button className="w-full bg-white text-[#0F172A] rounded-3xl p-5 text-left font-semibold hover:bg-blue-50 transition-all shadow-lg">
                    Show pending invoices and orders
                  </button>
                </div>

                <div className="mt-6 flex gap-3">
                  <input
                    type="text"
                    placeholder="Ask AI about CRM analytics..."
                    className="flex-1 rounded-2xl px-5 py-4 bg-white text-[#0F172A] border border-blue-200 outline-none"
                  />

                  <button className="bg-white text-[#0F172A] px-6 py-4 rounded-2xl font-bold hover:bg-blue-50 transition-all">
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[32px] p-8 shadow-xl overflow-hidden border border-blue-100">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold capitalize text-[#0F172A]">
                {activePage}
              </h1>

              <button
                onClick={() => setCreateModalOpen(true)}
                className="bg-[#0F172A] text-white px-5 py-3 rounded-2xl font-semibold"
              >
                + Create {getSingularLabel()}
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-blue-100">
              <table className="w-full min-w-[900px]">
                <thead className="bg-blue-50 text-[#0F172A]">
                  <tr>
                    <th className="text-left px-6 py-4">Record ID</th>
                    <th className="text-left px-6 py-4">Name</th>
                    <th className="text-left px-6 py-4">Status</th>
                    <th className="text-center px-6 py-4">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {getCurrentData().map((record: any) => (
                    <tr
                      key={record.id}
                      onClick={() => openRecordDetails(record)}
                      className="border-t border-blue-50 hover:bg-blue-50/50 cursor-pointer"
                    >
                      <td className="px-6 py-4 text-[#0F172A]">
                        {record.id}
                      </td>

                      <td className="px-6 py-4 text-[#0F172A]">
                        {record.name || record.customer}
                      </td>

                      <td className="px-6 py-4 text-[#0F172A]">
                        {record.status}
                      </td>

                      <td className="px-6 py-4 text-center relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenu(
                              openActionMenu === record.id
                                ? null
                                : record.id
                            );
                          }}
                          className="w-10 h-10 rounded-full hover:bg-blue-100"
                        >
                          ⋮
                        </button>

                        {openActionMenu === record.id && (
                          <div
                            ref={actionMenuRef}
                            className="absolute right-6 top-16 bg-white border border-blue-100 shadow-2xl rounded-2xl p-2 z-50 min-w-[190px]"
                          >
                            {activePage === 'leads' &&
                              record.status === 'Qualified' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConvertLead(record);
                                  }}
                                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-green-50 text-green-700"
                                >
                                  Convert to Opportunity
                                </button>
                              )}

                            {activePage === 'opportunities' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCreateOrder(record);
                                }}
                                className="w-full text-left px-4 py-3 rounded-xl hover:bg-indigo-50 text-indigo-700"
                              >
                                Create Order
                              </button>
                            )}

                            <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-red-50 text-red-600">
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
          </div>
        )}

        {selectedRecord && editableRecord && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl border border-blue-100 overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="px-8 py-6 border-b border-blue-100 flex items-center justify-between sticky top-0 bg-white">
                <h2 className="text-3xl font-bold text-[#0F172A]">
                  {getSingularLabel()} Details
                </h2>

                <button
                  onClick={() => {
                    setSelectedRecord(null);
                    setEditableRecord(null);
                  }}
                  className="w-10 h-10 rounded-full hover:bg-blue-50"
                >
                  ✕
                </button>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(editableRecord).map(([key, value]: any) => {
                  if (key === 'products') return null;

                  return (
                    <div key={key} className="space-y-2">
                      <label className="text-sm font-semibold uppercase text-gray-700">
                        {key}
                      </label>

                      {key === 'status' ? (
                        <select
                          value={value}
                          onChange={(e) =>
                            setEditableRecord((prev: any) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
                        >
                          {getStatusOptions().map((status: string) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      ) : key === 'customer' ? (
                        <select
                          value={value || ''}
                          onChange={(e) =>
                            setEditableRecord((prev: any) => ({
                              ...prev,
                              customer: e.target.value,
                            }))
                          }
                          className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
                        >
                          <option value="">Select Customer</option>

                          {customers.map((customer: any) => (
                            <option key={customer.id} value={customer.name}>
                              {customer.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={String(value)}
                          onChange={(e) =>
                            setEditableRecord((prev: any) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
                        />
                      )}
                    </div>
                  );
                })}

                {['leads', 'opportunities', 'orders', 'invoices'].includes(activePage) && (
                  <div className="md:col-span-2 mt-6 border border-blue-100 rounded-3xl p-6 bg-blue-50/40">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-[#0F172A]">
                          Product Line Items
                        </h3>
                      </div>

                      <select
                        onChange={(e) => {
                          if (!e.target.value) return;

                          const selectedProduct = products.find(
                            (product: any) => product.name === e.target.value
                          );

                          if (!selectedProduct) return;

                          setEditableRecord((prev: any) => ({
                            ...prev,
                            products: [
                              ...(prev.products || []),
                              {
                                productName: selectedProduct.name,
                                quantity: 1,
                                price: selectedProduct.price,
                                lineTotal: selectedProduct.price,
                              },
                            ],
                          }));

                          e.target.value = '';
                        }}
                        className="border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
                      >
                        <option value="">+ Add Product</option>

                        {products.map((product: any) => (
                          <option key={product.id} value={product.name}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-4">
                      {(editableRecord.products || []).map((productLine: any, index: number) => (
                        <div
                          key={index}
                          className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white rounded-2xl border border-blue-100 p-4"
                        >
                          <input
                            type="text"
                            value={productLine.productName}
                            disabled
                            className="border border-blue-200 rounded-2xl px-4 py-3 bg-gray-100 text-[#0F172A]"
                          />

                          <input
                            type="number"
                            value={productLine.quantity}
                            onChange={(e) => {
                              const quantity = Number(e.target.value);

                              setEditableRecord((prev: any) => {
                                const updatedProducts = [...(prev.products || [])];

                                updatedProducts[index] = {
                                  ...updatedProducts[index],
                                  quantity,
                                  lineTotal: quantity * updatedProducts[index].price,
                                };

                                return {
                                  ...prev,
                                  products: updatedProducts,
                                };
                              });
                            }}
                            className="border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
                          />

                          <input
                            type="number"
                            value={productLine.price}
                            onChange={(e) => {
                              const price = Number(e.target.value);

                              setEditableRecord((prev: any) => {
                                const updatedProducts = [...(prev.products || [])];

                                updatedProducts[index] = {
                                  ...updatedProducts[index],
                                  price,
                                  lineTotal: updatedProducts[index].quantity * price,
                                };

                                return {
                                  ...prev,
                                  products: updatedProducts,
                                };
                              });
                            }}
                            className="border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
                          />

                          <input
                            type="text"
                            value={formatCurrency(productLine.lineTotal || 0)}
                            disabled
                            className="border border-blue-200 rounded-2xl px-4 py-3 bg-gray-100 text-[#0F172A]"
                          />

                          <button
                            onClick={() => {
                              setEditableRecord((prev: any) => ({
                                ...prev,
                                products: (prev.products || []).filter(
                                  (_: any, idx: number) => idx !== index
                                ),
                              }));
                            }}
                            className="bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl px-4 py-3 font-semibold"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-8 py-6 border-t border-blue-100 flex items-center justify-end gap-4 sticky bottom-0 bg-white">
                <button
                  onClick={() => {
                    setSelectedRecord(null);
                    setEditableRecord(null);
                  }}
                  className="px-5 py-3 rounded-2xl border border-blue-200 text-[#0F172A] font-semibold"
                >
                  Cancel
                </button>

                <button
                  onClick={handleSaveRecord}
                  className="bg-[#0F172A] text-white px-6 py-3 rounded-2xl font-semibold shadow-lg"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {createModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-blue-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-blue-100 flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-[#0F172A]">
                    Create {getSingularLabel()}
                  </h2>
                </div>

                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="w-10 h-10 rounded-full hover:bg-blue-50"
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
                    value={newRecord.name || ''}
                    onChange={(e) =>
                      setNewRecord((prev: any) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold uppercase text-gray-700">
                    Customer
                  </label>

                  <select
                    value={newRecord.customer || ''}
                    onChange={(e) =>
                      setNewRecord((prev: any) => ({
                        ...prev,
                        customer: e.target.value,
                      }))
                    }
                    className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
                  >
                    <option value="">Select Customer</option>

                    {customers.map((customer: any) => (
                      <option key={customer.id} value={customer.name}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold uppercase text-gray-700">
                    Status
                  </label>

                  <select
                    value={newRecord.status || ''}
                    onChange={(e) =>
                      setNewRecord((prev: any) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                    className="w-full border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
                  >
                    {getStatusOptions().map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </div>

                {['leads', 'opportunities', 'orders', 'invoices'].includes(activePage) && (
                  <div className="md:col-span-2 mt-4 border border-blue-100 rounded-3xl p-6 bg-blue-50/40">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-[#0F172A]">
                        Product Line Items
                      </h3>

                      <select
                        onChange={(e) => {
                          if (!e.target.value) return;

                          const selectedProduct = products.find(
                            (product: any) => product.name === e.target.value
                          );

                          if (!selectedProduct) return;

                          setNewRecord((prev: any) => ({
                            ...prev,
                            products: [
                              ...(prev.products || []),
                              {
                                productName: selectedProduct.name,
                                quantity: 1,
                                price: selectedProduct.price,
                                lineTotal: selectedProduct.price,
                              },
                            ],
                          }));

                          e.target.value = '';
                        }}
                        className="border border-blue-200 rounded-2xl px-4 py-3 bg-white text-[#0F172A]"
                      >
                        <option value="">+ Add Product</option>

                        {products.map((product: any) => (
                          <option key={product.id} value={product.name}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-4">
                      {(newRecord.products || []).map((productLine: any, index: number) => (
                        <div
                          key={index}
                          className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white rounded-2xl border border-blue-100 p-4"
                        >
                          <input
                            type="text"
                            value={productLine.productName}
                            disabled
                            className="border border-blue-200 rounded-2xl px-4 py-3 bg-gray-100 text-[#0F172A]"
                          />

                          <input
                            type="number"
                            value={productLine.quantity}
                            onChange={(e) => {
                              const quantity = Number(e.target.value);

                              setNewRecord((prev: any) => {
                                const updatedProducts = [...(prev.products || [])];

                                updatedProducts[index] = {
                                  ...updatedProducts[index],
                                  quantity,
                                  lineTotal: quantity * updatedProducts[index].price,
                                };

                                return {
                                  ...prev,
                                  products: updatedProducts,
                                };
                              });
                            }}
                            className="border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
                          />

                          <input
                            type="number"
                            value={productLine.price}
                            onChange={(e) => {
                              const price = Number(e.target.value);

                              setNewRecord((prev: any) => {
                                const updatedProducts = [...(prev.products || [])];

                                updatedProducts[index] = {
                                  ...updatedProducts[index],
                                  price,
                                  lineTotal: updatedProducts[index].quantity * price,
                                };

                                return {
                                  ...prev,
                                  products: updatedProducts,
                                };
                              });
                            }}
                            className="border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A]"
                          />

                          <input
                            type="text"
                            value={formatCurrency(productLine.lineTotal || 0)}
                            disabled
                            className="border border-blue-200 rounded-2xl px-4 py-3 bg-gray-100 text-[#0F172A]"
                          />

                          <button
                            onClick={() => {
                              setNewRecord((prev: any) => ({
                                ...prev,
                                products: (prev.products || []).filter(
                                  (_: any, idx: number) => idx !== index
                                ),
                              }));
                            }}
                            className="bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl px-4 py-3 font-semibold"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-8 py-6 border-t border-blue-100 flex items-center justify-end gap-4">
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="px-5 py-3 rounded-2xl border border-blue-200 text-[#0F172A] font-semibold"
                >
                  Cancel
                </button>

                <button
                  onClick={handleCreateRecord}
                  className="bg-[#0F172A] text-white px-6 py-3 rounded-2xl font-semibold"
                >
                  Create {getSingularLabel()}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
