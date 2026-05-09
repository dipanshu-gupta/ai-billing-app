'use client';

import React, { useMemo, useState } from 'react';

const initialCustomers = [
  {
    id: 'CUST-001',
    name: 'ABC Corp',
    email: 'finance@abccorp.com',
    phone: '+91 9876543210',
    address: 'Gurgaon, Haryana',
  },
  {
    id: 'CUST-002',
    name: 'Delta Pvt Ltd',
    email: 'accounts@delta.com',
    phone: '+91 9988776655',
    address: 'Noida, Uttar Pradesh',
  },
  {
    id: 'CUST-003',
    name: 'Neo Systems',
    email: 'billing@neosystems.com',
    phone: '+91 9123456780',
    address: 'Delhi, India',
  },
];

const pricebooks = [
  {
    id: 'PB-001',
    product: 'Cloud Subscription',
    unitPrice: 25000,
  },
  {
    id: 'PB-002',
    product: 'AI Analytics Add-on',
    unitPrice: 12000,
  },
  {
    id: 'PB-003',
    product: 'Support Package',
    unitPrice: 15000,
  },
  {
    id: 'PB-004',
    product: 'GST Filing Service',
    unitPrice: 8500,
  },
];

const initialInvoices = [
  {
    id: 'INV-1001',
    customer: 'ABC Corp',
    amount: 52000,
    status: 'Pending',
    due: '2026-05-12',
    products: [
      {
        product: 'Cloud Subscription',
        quantity: 1,
        price: 25000,
      },
    ],
  },
  {
    id: 'INV-1002',
    customer: 'Delta Pvt Ltd',
    amount: 124000,
    status: 'Paid',
    due: '2026-05-02',
    products: [
      {
        product: 'Support Package',
        quantity: 2,
        price: 30000,
      },
    ],
  },
  {
    id: 'INV-1003',
    customer: 'Neo Systems',
    amount: 18500,
    status: 'Overdue',
    due: '2026-04-28',
    products: [
      {
        product: 'GST Filing Service',
        quantity: 1,
        price: 8500,
      },
    ],
  },
];

const aiSuggestions = [
  'Show overdue invoices',
  'What is the current revenue?',
  'How many customers exist?',
  'Show pending payment amount',
];

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
};

const formatDate = (date: string): string => {
  if (!date) return '-';

  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function AIBillingApp() {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [customerList, setCustomerList] = useState(initialCustomers);
  const [activePage, setActivePage] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  type InvoiceProduct = {
  product: string;
  quantity: number;
  price: number;
};

type Invoice = {
  id: string;
  customer: string;
  amount: number;
  status: string;
  due: string;
  products: InvoiceProduct[];
};

const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [aiInput, setAiInput] = useState('');

  const [aiMessages, setAiMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hello! I am your AI Billing Agent. Ask me about invoices, payments, customers, or reports.',
    },
  ]);

  const [invoiceForm, setInvoiceForm] = useState({
    customer: initialCustomers[0]?.name || '',
    amount: '',
    due: '',
    status: 'Pending',
    selectedProducts: [],
  });

  const [customerForm, setCustomerForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const content = `${invoice.id} ${invoice.customer} ${invoice.status}`.toLowerCase();
      return content.includes(searchTerm.toLowerCase());
    });
  }, [invoices, searchTerm]);

  const totalRevenue = invoices.reduce((sum, item) => sum + item.amount, 0);

  const pendingPayments = invoices
    .filter((item) => item.status !== 'Paid')
    .reduce((sum, item) => sum + item.amount, 0);

  const overdueInvoices = invoices.filter(
    (item) => item.status === 'Overdue'
  ).length;

  const getAiResponse = (input: string): string => {
    const lower = input.toLowerCase();

    if (lower.includes('overdue')) {
      return `There are currently ${overdueInvoices} overdue invoices.`;
    }

    if (lower.includes('revenue')) {
      return `Current total revenue is ${formatCurrency(totalRevenue)}.`;
    }

    if (lower.includes('pending')) {
      return `Pending payment amount is ${formatCurrency(pendingPayments)}.`;
    }

    if (lower.includes('customer')) {
      return `There are ${customerList.length} customer accounts.`;
    }

    if (lower.includes('invoice')) {
      return `There are ${invoices.length} invoices in the system.`;
    }

    return 'I can help with invoices, customers, products, payments, and reports.';
  };

  const handleAiSend = (message?: string): void => {
    const content = message || aiInput;

    if (!content.trim()) return;

    const response = getAiResponse(content);

    setAiMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content,
      },
      {
        role: 'assistant',
        content: response,
      },
    ]);

    setAiInput('');
  };

  const handleInvoiceSubmit = (
    e: React.FormEvent<HTMLFormElement>
  ): void => {
    e.preventDefault();

    const products = invoiceForm.selectedProducts.map((productId) => {
      const product = pricebooks.find((item) => item.id === productId);

      return {
        product: product?.product || '',
        quantity: 1,
        price: product?.unitPrice || 0,
      };
    });

    const newInvoice = {
      id: `INV-${1000 + invoices.length + 1}`,
      customer: invoiceForm.customer,
      amount: Number(invoiceForm.amount || 0),
      due: invoiceForm.due,
      status: invoiceForm.status,
      products,
    };

    setInvoices((prev) => [newInvoice, ...prev]);

    setInvoiceForm({
      customer: customerList[0]?.name || '',
      amount: '',
      due: '',
      status: 'Pending',
      selectedProducts: [],
    });

    setShowInvoiceModal(false);
  };

  const handleCustomerSubmit = (
    e: React.FormEvent<HTMLFormElement>
  ): void => {
    e.preventDefault();

    const newCustomer = {
      id: `CUST-${String(customerList.length + 1).padStart(3, '0')}`,
      ...customerForm,
    };

    setCustomerList((prev) => [...prev, newCustomer]);

    setCustomerForm({
      name: '',
      email: '',
      phone: '',
      address: '',
    });

    setShowCustomerModal(false);
  };

  const handleStatusChange = (
    invoiceId: string,
    status: string
  ): void => {
    setInvoices((prev) =>
      prev.map((invoice) =>
        invoice.id === invoiceId
          ? {
              ...invoice,
              status,
            }
          : invoice
      )
    );

    setOpenActionMenu(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside
        className={`fixed lg:static top-0 left-0 h-full bg-black text-white z-50 transition-all duration-300 ${
          sidebarCollapsed ? 'w-24' : 'w-72'
        } ${menuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            {!sidebarCollapsed && (
              <h2 className="text-2xl font-bold">Navigator</h2>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden lg:block bg-white/10 px-3 py-2 rounded-xl"
              >
                {sidebarCollapsed ? '→' : '←'}
              </button>

              <button
                className="lg:hidden text-2xl"
                onClick={() => setMenuOpen(false)}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setActivePage('dashboard')}
              className="w-full text-left px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20"
            >
              {sidebarCollapsed ? '🏠' : 'Dashboard'}
            </button>

            <button
              onClick={() => setActivePage('customers')}
              className="w-full text-left px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20"
            >
              {sidebarCollapsed ? '👥' : 'Customer Accounts'}
            </button>

            <button
              onClick={() => setActivePage('products')}
              className="w-full text-left px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20"
            >
              {sidebarCollapsed ? '📦' : 'Products'}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-6 overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="lg:hidden">
            <button
              onClick={() => setMenuOpen(true)}
              className="bg-black text-white px-4 py-3 rounded-2xl"
            >
              ☰
            </button>
          </div>

          {activePage === 'dashboard' && (
            <>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-bold">AI Billing Platform</h1>
                  <p className="text-gray-600 mt-2">
                    Smart billing software with embedded AI assistant
                  </p>
                </div>

                <button
                  onClick={() => setShowInvoiceModal(true)}
                  className="bg-black text-white px-5 py-3 rounded-2xl"
                >
                  + Create Invoice
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white rounded-3xl p-6">
                  <p className="text-gray-500">Total Revenue</p>
                  <h2 className="text-3xl font-bold mt-2">
                    {formatCurrency(totalRevenue)}
                  </h2>
                </div>

                <div className="bg-white rounded-3xl p-6">
                  <p className="text-gray-500">Pending Payments</p>
                  <h2 className="text-3xl font-bold mt-2">
                    {formatCurrency(pendingPayments)}
                  </h2>
                </div>

                <div className="bg-white rounded-3xl p-6">
                  <p className="text-gray-500">Overdue Invoices</p>
                  <h2 className="text-3xl font-bold mt-2">
                    {overdueInvoices}
                  </h2>
                </div>

                <div className="bg-white rounded-3xl p-6">
                  <p className="text-gray-500">Customers</p>
                  <h2 className="text-3xl font-bold mt-2">
                    {customerList.length}
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white rounded-3xl p-6 overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <h2 className="text-2xl font-semibold">Recent Invoices</h2>

                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setSearchTerm(e.target.value)
                      }
                      placeholder="Search invoice..."
                      className="border rounded-xl px-4 py-3 w-full md:w-72"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left">
                      <thead>
                        <tr className="border-b">
                          <th className="py-3">Invoice ID</th>
                          <th>Customer</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Due Date</th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredInvoices.map((invoice) => (
                          <tr
                            key={invoice.id}
                            className="border-b hover:bg-gray-50 cursor-pointer"
                            onClick={() => setSelectedInvoice(invoice)}
                          >
                            <td className="py-4 font-medium">{invoice.id}</td>
                            <td>{invoice.customer}</td>
                            <td>{formatCurrency(invoice.amount)}</td>
                            <td>{invoice.status}</td>
                            <td>{formatDate(invoice.due)}</td>
                            <td
                              className="relative text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="w-10 h-10 rounded-full hover:bg-gray-100"
                                onClick={() =>
                                  setOpenActionMenu(
                                    openActionMenu === invoice.id
                                      ? null
                                      : invoice.id
                                  )
                                }
                              >
                                ⋮
                              </button>

                              {openActionMenu === invoice.id && (
                                <div className="absolute right-0 top-12 bg-white border rounded-2xl shadow-xl p-2 z-20 min-w-[170px]">
                                  <button
                                    className="w-full text-left px-4 py-2 rounded-xl hover:bg-gray-100"
                                    onClick={() =>
                                      handleStatusChange(invoice.id, 'Pending')
                                    }
                                  >
                                    Mark as Pending
                                  </button>

                                  <button
                                    className="w-full text-left px-4 py-2 rounded-xl hover:bg-gray-100"
                                    onClick={() =>
                                      handleStatusChange(invoice.id, 'Paid')
                                    }
                                  >
                                    Mark as Paid
                                  </button>

                                  <button
                                    className="w-full text-left px-4 py-2 rounded-xl hover:bg-gray-100"
                                    onClick={() =>
                                      handleStatusChange(invoice.id, 'Overdue')
                                    }
                                  >
                                    Mark as Overdue
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

                <div className="bg-black text-white rounded-3xl p-6 flex flex-col min-h-[500px]">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold">AI Billing Agent</h2>
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3">
                    {aiMessages.map((message, index) => (
                      <div
                        key={index}
                        className={`rounded-2xl p-4 max-w-[90%] ${
                          message.role === 'user'
                            ? 'bg-white text-black ml-auto'
                            : 'bg-white/10 text-white'
                        }`}
                      >
                        {message.content}
                      </div>
                    ))}

                    {aiSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleAiSend(suggestion)}
                        className="w-full bg-white text-black text-left rounded-2xl p-3 hover:bg-gray-100 transition"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setAiInput(e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAiSend();
                        }
                      }}
                      placeholder="Ask AI anything..."
                      className="flex-1 rounded-2xl px-4 py-3 bg-white text-black"
                    />

                    <button
                      onClick={() => handleAiSend()}
                      className="bg-white text-black px-5 py-3 rounded-2xl font-semibold"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activePage === 'customers' && (
            <div className="bg-white rounded-3xl p-6 overflow-x-auto">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <h1 className="text-3xl font-bold">Customer Accounts</h1>

                <button
                  onClick={() => setShowCustomerModal(true)}
                  className="bg-black text-white px-5 py-3 rounded-2xl"
                >
                  + Create Customer Account
                </button>
              </div>

              <table className="w-full min-w-[700px] text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-4">Customer ID</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Address</th>
                  </tr>
                </thead>

                <tbody>
                  {customerList.map((customer) => (
                    <tr key={customer.id} className="border-t">
                      <td className="p-4">{customer.id}</td>
                      <td className="p-4">{customer.name}</td>
                      <td className="p-4">{customer.email}</td>
                      <td className="p-4">{customer.phone}</td>
                      <td className="p-4">{customer.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activePage === 'products' && (
            <div className="bg-white rounded-3xl p-6 overflow-x-auto">
              <h1 className="text-3xl font-bold mb-6">Products & Pricebooks</h1>

              <table className="w-full min-w-[700px] text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-4">Pricebook ID</th>
                    <th className="p-4">Product</th>
                    <th className="p-4">Unit Price</th>
                  </tr>
                </thead>

                <tbody>
                  {pricebooks.map((product) => (
                    <tr key={product.id} className="border-t">
                      <td className="p-4">{product.id}</td>
                      <td className="p-4">{product.product}</td>
                      <td className="p-4">
                        {formatCurrency(product.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedInvoice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Invoice Details</h2>

                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="border px-4 py-2 rounded-xl"
                >
                  Close
                </button>
              </div>

              <div className="overflow-x-auto border rounded-2xl">
                <table className="w-full text-left min-w-[500px]">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-4">Product</th>
                      <th className="p-4">Quantity</th>
                      <th className="p-4">Price</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedInvoice.products.map((product, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-4">{product.product}</td>
                        <td className="p-4">{product.quantity}</td>
                        <td className="p-4">
                          {formatCurrency(product.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {showCustomerModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 w-full max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Create Customer Account</h2>

                <button
                  onClick={() => setShowCustomerModal(false)}
                  className="text-xl"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCustomerSubmit} className="space-y-4">
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={customerForm.name}
                  onChange={(e) =>
                    setCustomerForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  className="w-full border rounded-xl px-4 py-3"
                  required
                />

                <input
                  type="email"
                  placeholder="Email"
                  value={customerForm.email}
                  onChange={(e) =>
                    setCustomerForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  className="w-full border rounded-xl px-4 py-3"
                  required
                />

                <input
                  type="text"
                  placeholder="Phone"
                  value={customerForm.phone}
                  onChange={(e) =>
                    setCustomerForm((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  className="w-full border rounded-xl px-4 py-3"
                  required
                />

                <textarea
                  placeholder="Address"
                  value={customerForm.address}
                  onChange={(e) =>
                    setCustomerForm((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                  className="w-full border rounded-xl px-4 py-3"
                  rows={4}
                  required
                />

                <button
                  type="submit"
                  className="w-full bg-black text-white px-5 py-3 rounded-2xl"
                >
                  Save Customer
                </button>
              </form>
            </div>
          </div>
        )}

        {showInvoiceModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Create Invoice</h2>

                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="text-xl"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleInvoiceSubmit} className="space-y-4">
                <select
                  value={invoiceForm.customer}
                  onChange={(e) =>
                    setInvoiceForm((prev) => ({
                      ...prev,
                      customer: e.target.value,
                    }))
                  }
                  className="w-full border rounded-xl px-4 py-3"
                >
                  {customerList.map((customer) => (
                    <option key={customer.id} value={customer.name}>
                      {customer.name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Invoice Amount"
                  value={invoiceForm.amount}
                  onChange={(e) =>
                    setInvoiceForm((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  className="w-full border rounded-xl px-4 py-3"
                />

                <input
                  type="date"
                  value={invoiceForm.due}
                  onChange={(e) =>
                    setInvoiceForm((prev) => ({
                      ...prev,
                      due: e.target.value,
                    }))
                  }
                  className="w-full border rounded-xl px-4 py-3"
                />

                <select
                  multiple
                  value={invoiceForm.selectedProducts}
                  onChange={(e) => {
                    const values = Array.from(
                      e.target.selectedOptions,
                      (option) => option.value
                    );

                    setInvoiceForm((prev) => ({
                      ...prev,
                      selectedProducts: values,
                    }));
                  }}
                  className="w-full border rounded-xl px-4 py-3 min-h-[140px]"
                >
                  {pricebooks.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.product} - {formatCurrency(product.unitPrice)}
                    </option>
                  ))}
                </select>

                <select
                  value={invoiceForm.status}
                  onChange={(e) =>
                    setInvoiceForm((prev) => ({
                      ...prev,
                      status: e.target.value,
                    }))
                  }
                  className="w-full border rounded-xl px-4 py-3"
                >
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                  <option value="Overdue">Overdue</option>
                </select>

                <button
                  type="submit"
                  className="w-full bg-black text-white px-5 py-3 rounded-2xl"
                >
                  Save Invoice
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
