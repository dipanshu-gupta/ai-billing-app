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
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  const [customers] = useState([
    { id: 'CUST-001', name: 'ABC Corp', email: 'finance@abccorp.com', status: 'Active' },
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
    { id: 'ACT-001', subject: 'Follow Up Call', type: 'Call', status: 'Scheduled' },
  ]);

  const [contacts] = useState([
    { id: 'CONT-001', name: 'Aman Verma', email: 'aman@abccorp.com', status: 'Active' },
  ]);

  const [invoices] = useState([
    {
      id: 'INV-1001',
      customer: 'ABC Corp',
      amount: 52000,
      status: 'Pending',
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

  const getStatusOptions = () => {
    switch (activePage) {
      case 'customers':
        return ['Active', 'Inactive', 'Prospect'];
      case 'products':
        return ['Active', 'Inactive', 'Discontinued'];
      case 'leads':
        return ['New', 'Qualified', 'Converted', 'Lost'];
      case 'opportunities':
        return ['Open', 'Proposal', 'Negotiation', 'Closed Won'];
      case 'activities':
        return ['Scheduled', 'Completed', 'Cancelled'];
      case 'contacts':
        return ['Active', 'Inactive'];
      case 'invoices':
        return ['Draft', 'Pending', 'Paid'];
      case 'orders':
        return ['Processing', 'Shipped', 'Delivered'];
      default:
        return ['Active'];
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

  const openRecordDetails = (record: any) => {
    setSelectedRecord(record);
    setEditableRecord(record);
  };

  const handleFieldChange = (field: string, value: string) => {
    setEditableRecord((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addProductToRecord = (productName: string) => {
    const selectedProduct = products.find(
      (product: any) => product.name === productName
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
  };

  const handleProductLineChange = (
    index: number,
    field: string,
    value: any
  ) => {
    setEditableRecord((prev: any) => {
      const updatedProducts = [...(prev.products || [])];

      updatedProducts[index] = {
        ...updatedProducts[index],
        [field]: value,
      };

      updatedProducts[index].lineTotal =
        updatedProducts[index].quantity * updatedProducts[index].price;

      return {
        ...prev,
        products: updatedProducts,
      };
    });
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
        company: leadRecord.company || '',
        details:
          leadRecord.details ||
          leadRecord.company ||
          'Opportunity created from Lead',
        stage: 'Qualification',
        status: 'Open',
        amount: leadRecord.amount || 0,
        products: (leadRecord.products || []).map((product: any) => ({
          productName: product.productName,
          quantity: product.quantity || 1,
          price: product.price || 0,
          lineTotal:
            product.lineTotal ||
            (product.quantity || 1) * (product.price || 0),
        })),
      },
    ]);

    setOpenActionMenu(null);
  };

  const handleCreateOrder = (opportunityRecord: any) => {
    setOpportunities((prev: any) =>
      prev.map((opportunity: any) =>
        opportunity.id === opportunityRecord.id
          ? {
              ...opportunity,
              status: 'Closed Won',
            }
          : opportunity
      )
    );

    setOrders((prev: any) => [
      ...prev,
      {
        id: `ORD-${Date.now()}`,
        customer: opportunityRecord.name,
        total: opportunityRecord.amount || 0,
        status: 'Processing',
        products: opportunityRecord.products || [],
        details: opportunityRecord.stage || 'Order created from Opportunity',
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
                className={`w-full flex items-center rounded-2xl bg-white/10 hover:bg-blue-700/60 transition-all duration-200 py-3 ${
                  sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-4'
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

      <main className="flex-1 p-6 overflow-hidden">
        {activePage === 'dashboard' ? (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-blue-100">
              <div className="flex flex-col lg:flex-row gap-4 lg:items-end lg:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-[#0F172A]">
                    CRM Analytics Dashboard
                  </h1>

                  <p className="text-gray-500 mt-2 text-sm">
                    Real-time sales, customer and billing insights.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full lg:w-auto">
                  <select className="border border-blue-200 rounded-2xl px-4 py-3 bg-white">
                    <option>Last 30 Days</option>
                    <option>Last Quarter</option>
                    <option>This Year</option>
                  </select>

                  <input
                    type="date"
                    className="border border-blue-200 rounded-2xl px-4 py-3 bg-white"
                  />

                  <input
                    type="date"
                    className="border border-blue-200 rounded-2xl px-4 py-3 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl p-6 shadow-xl h-[360px] overflow-hidden">
                  <h2 className="text-xl font-bold mb-6 text-[#0F172A]">
                    CRM Records Overview
                  </h2>

                  <ResponsiveContainer width="100%" height="82%">
                    <BarChart
                      data={[
                        { name: 'Customers', value: customers.length },
                        { name: 'Products', value: products.length },
                        { name: 'Leads', value: leads.length },
                        { name: 'Orders', value: orders.length },
                      ]}
                    >
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#0F172A" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-xl h-[360px] overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-[#0F172A]">
                      Sales Pipeline Report
                    </h2>

                    <select className="border border-blue-200 rounded-2xl px-4 py-2 bg-white text-sm">
                      <option>Qualified Leads</option>
                      <option>Converted Leads</option>
                      <option>Won Opportunities</option>
                    </select>
                  </div>

                  <ResponsiveContainer width="100%" height="82%">
                    <BarChart
                      data={[
                        { stage: 'Prospecting', value: 18 },
                        { stage: 'Qualified', value: 12 },
                        { stage: 'Proposal', value: 7 },
                        { stage: 'Won', value: 4 },
                      ]}
                    >
                      <XAxis dataKey="stage" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#0F172A" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-3xl p-5 shadow-xl border border-blue-100">
                    <div className="text-sm text-gray-500 mb-2">
                      Total Customers
                    </div>

                    <div className="text-3xl font-bold text-[#0F172A]">
                      {customers.length}
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-5 shadow-xl border border-blue-100">
                    <div className="text-sm text-gray-500 mb-2">
                      Open Opportunities
                    </div>

                    <div className="text-3xl font-bold text-[#0F172A]">
                      {opportunities.length}
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-5 shadow-xl border border-blue-100">
                    <div className="text-sm text-gray-500 mb-2">
                      Total Orders
                    </div>

                    <div className="text-3xl font-bold text-[#0F172A]">
                      {orders.length}
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-5 shadow-xl border border-blue-100">
                    <div className="text-sm text-gray-500 mb-2">
                      Revenue
                    </div>

                    <div className="text-2xl font-bold text-[#0F172A] break-words">
                      {formatCurrency(
                        invoices.reduce(
                          (sum: number, invoice: any) =>
                            sum + (invoice.amount || 0),
                          0
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-[#0F172A] via-blue-900 to-blue-950 text-white rounded-3xl p-6 shadow-2xl flex flex-col min-h-[420px] border border-blue-800/40">
                  <div className="mb-5">
                    <h2 className="text-2xl font-bold tracking-tight">
                      AI Billing Agent
                    </h2>

                    <p className="text-blue-100 text-sm mt-1">
                      AI powered CRM and billing assistant
                    </p>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                    <div className="bg-blue-800/70 rounded-3xl p-4 text-white border border-blue-700/30 max-w-[90%]">
                      Hello! I can help analyze customers, leads, revenue, invoices and opportunities.
                    </div>

                    <button className="w-full bg-white text-[#0F172A] rounded-2xl p-4 text-left hover:bg-blue-50 transition-all duration-200 font-medium">
                      Show revenue summary
                    </button>

                    <button className="w-full bg-white text-[#0F172A] rounded-2xl p-4 text-left hover:bg-blue-50 transition-all duration-200 font-medium">
                      Show qualified leads
                    </button>

                    <button className="w-full bg-white text-[#0F172A] rounded-2xl p-4 text-left hover:bg-blue-50 transition-all duration-200 font-medium">
                      Show pending invoices
                    </button>
                  </div>

                  <div className="mt-5 flex gap-3">
                    <input
                      type="text"
                      placeholder="Ask AI about CRM analytics..."
                      className="flex-1 rounded-2xl px-4 py-3 bg-white text-slate-900 border border-blue-200 outline-none"
                    />

                    <button className="bg-white text-[#0F172A] px-5 py-3 rounded-2xl font-semibold hover:bg-blue-50 transition-all duration-200">
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold capitalize text-[#0F172A]">
                  {activePage}
                </h1>
              </div>

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
                    <th className="text-left px-6 py-4 font-semibold">Record ID</th>
                    <th className="text-left px-6 py-4 font-semibold">Name</th>
                    <th className="text-left px-6 py-4 font-semibold">Details</th>
                    <th className="text-left px-6 py-4 font-semibold">Status</th>
                    <th className="text-center px-6 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {getCurrentData().map((record: any, index: number) => (
                    <tr
                      key={record.id || index}
                      onClick={() => openRecordDetails(record)}
                      className="border-t border-blue-50 hover:bg-blue-50/50 cursor-pointer"
                    >
                      <td className="px-6 py-4">{record.id}</td>

                      <td className="px-6 py-4">
                        {record.name || record.customer || record.subject}
                      </td>

                      <td className="px-6 py-4">
                        {record.email ||
                          record.company ||
                          record.category ||
                          record.stage ||
                          record.type ||
                          formatCurrency(record.amount || record.total || 0)}
                      </td>

                      <td className="px-6 py-4">{record.status}</td>

                      <td
                        className="px-6 py-4 text-center relative"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenu(
                              openActionMenu === record.id ? null : record.id
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
                            <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50">
                              Change Status
                            </button>

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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-blue-100">
              <div className="sticky top-0 bg-white border-b border-blue-100 px-8 py-6 flex items-center justify-between">
                <h2 className="text-3xl font-bold text-[#0F172A]">
                  Record Details
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
                      <label className="text-sm font-semibold uppercase text-gray-500">
                        {key}
                      </label>

                      {key.toLowerCase() === 'status' ? (
                        <select
                          value={String(value)}
                          onChange={(e) =>
                            handleFieldChange(key, e.target.value)
                          }
                          className="w-full border border-blue-200 rounded-2xl px-4 py-3"
                        >
                          {getStatusOptions().map((statusOption) => (
                            <option key={statusOption}>{statusOption}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={String(value)}
                          onChange={(e) =>
                            handleFieldChange(key, e.target.value)
                          }
                          className="w-full border border-blue-200 rounded-2xl px-4 py-3"
                        />
                      )}
                    </div>
                  );
                })}

                {['leads', 'opportunities', 'orders', 'invoices'].includes(activePage) && (
                  <div className="md:col-span-2 mt-4 space-y-4 border border-blue-100 rounded-3xl p-6 bg-blue-50/30">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-[#0F172A]">
                        Product Line Items
                      </h3>

                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            addProductToRecord(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="border border-blue-200 rounded-2xl px-4 py-3 bg-white"
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
                      {(editableRecord.products || []).map(
                        (productLine: any, productIndex: number) => (
                          <div
                            key={productIndex}
                            className="border border-blue-100 rounded-2xl p-5 bg-white"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                              <input
                                type="text"
                                value={productLine.productName}
                                disabled
                                className="border border-blue-200 rounded-2xl px-4 py-3 bg-gray-100"
                              />

                              <input
                                type="number"
                                value={productLine.quantity}
                                onChange={(e) =>
                                  handleProductLineChange(
                                    productIndex,
                                    'quantity',
                                    Number(e.target.value)
                                  )
                                }
                                className="border border-blue-200 rounded-2xl px-4 py-3"
                              />

                              <input
                                type="number"
                                value={productLine.price}
                                onChange={(e) =>
                                  handleProductLineChange(
                                    productIndex,
                                    'price',
                                    Number(e.target.value)
                                  )
                                }
                                className="border border-blue-200 rounded-2xl px-4 py-3"
                              />

                              <input
                                type="text"
                                value={formatCurrency(productLine.lineTotal || 0)}
                                disabled
                                className="border border-blue-200 rounded-2xl px-4 py-3 bg-gray-100"
                              />

                              <button
                                onClick={() => {
                                  setEditableRecord((prev: any) => ({
                                    ...prev,
                                    products: prev.products.filter(
                                      (_: any, idx: number) => idx !== productIndex
                                    ),
                                  }));
                                }}
                                className="bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl px-4 py-3"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
