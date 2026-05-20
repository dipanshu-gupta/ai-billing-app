// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { getPageLabel, getStatusOptions, formatCurrency } from '@/lib/utils';
import { getStatusColor } from '@/lib/utils';
import RecordDetailPanel from '@/components/crm/RecordDetailPanel';
import CreateRecordModal from '@/components/crm/CreateRecordModal';

function StatusBadge({ status }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>
      {status}
    </span>
  );
}

export default function CRMListPage({ page }) {
  const {
    customers, products, leads, opportunities, orders, invoices, contacts, activities,
    convertLeadToOpportunity, createOrderFromOpportunity, createInvoiceFromOrder,
  } = useApp();

  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('All');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [createOpen, setCreateOpen]       = useState(false);
  const [menuOpenId, setMenuOpenId]       = useState(null);

  const getData = () => {
    switch (page) {
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

  const filtered = useMemo(() => {
    let data = getData();
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        String(r.name || '').toLowerCase().includes(q) ||
        String(r.id || '').toLowerCase().includes(q) ||
        String(r.customer || '').toLowerCase().includes(q) ||
        String(r.email || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'All') data = data.filter(r => r.status === statusFilter);
    return data;
  }, [page, customers, products, leads, opportunities, orders, invoices, contacts, activities, search, statusFilter]);

  const pageLabel = getPageLabel(page);
  const hasAmount = ['leads', 'opportunities', 'orders', 'invoices'].includes(page);
  const hasPrice  = page === 'products';

  const getSecondary = (r) => r.customer || r.company || r.category || r.email || '';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] capitalize">{page}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90 transition-all"
        >
          + Create {pageLabel}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${page} by name, ID, customer...`}
          className="flex-1 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option>All</option>
          {getStatusOptions(page).map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-[#0F172A] to-blue-900 text-white">
              <tr>
                <th className="px-5 py-3.5 text-left text-sm font-semibold">ID</th>
                <th className="px-5 py-3.5 text-left text-sm font-semibold">Name</th>
                {page !== 'products' && (
                  <th className="px-5 py-3.5 text-left text-sm font-semibold">
                    {page === 'customers' ? 'Company' : 'Customer'}
                  </th>
                )}
                <th className="px-5 py-3.5 text-left text-sm font-semibold">Status</th>
                {hasAmount && <th className="px-5 py-3.5 text-right text-sm font-semibold">Amount</th>}
                {hasPrice  && <th className="px-5 py-3.5 text-right text-sm font-semibold">Price</th>}
                <th className="px-5 py-3.5 text-center text-sm font-semibold w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="text-5xl mb-3">🔍</div>
                    <div className="font-bold text-[#0F172A] text-lg">
                      {search || statusFilter !== 'All' ? 'No matching records' : `No ${page} yet`}
                    </div>
                    <div className="text-gray-400 text-sm mt-1">
                      {search || statusFilter !== 'All' ? 'Try adjusting your search or filter.' : `Create your first ${pageLabel.toLowerCase()} to get started.`}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(record => (
                  <tr key={record.id} className="border-t border-blue-50 hover:bg-blue-50/40 transition-all">
                    <td className="px-5 py-3.5 text-xs font-mono text-gray-400">{record.id}</td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setSelectedRecord(record)}
                        className="font-semibold text-[#0F172A] hover:text-blue-700 hover:underline text-sm text-left"
                      >
                        {record.name || record.subject || '—'}
                      </button>
                    </td>
                    {page !== 'products' && (
                      <td className="px-5 py-3.5 text-sm text-gray-600">{getSecondary(record) || '—'}</td>
                    )}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={record.status} />
                    </td>
                    {hasAmount && (
                      <td className="px-5 py-3.5 text-right text-sm font-semibold text-[#0F172A]">
                        {formatCurrency(record.amount || 0)}
                      </td>
                    )}
                    {hasPrice && (
                      <td className="px-5 py-3.5 text-right text-sm font-semibold text-[#0F172A]">
                        {formatCurrency(record.price || 0)}
                      </td>
                    )}
                    <td className="px-5 py-3.5">
                      <div className="relative flex justify-center">
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === record.id ? null : record.id)}
                          className="w-9 h-9 rounded-full bg-[#0F172A] text-white hover:bg-blue-800 flex items-center justify-center text-lg font-bold shadow transition-all"
                        >
                          ⋮
                        </button>
                        {menuOpenId === record.id && (
                          <div className="absolute right-0 top-10 bg-[#0F172A] border border-blue-800 shadow-2xl rounded-2xl p-2 z-[999] min-w-[200px]">
                            <button onClick={() => { setSelectedRecord(record); setMenuOpenId(null); }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">Open Details</button>
                            {page === 'leads' && record.status === 'Qualified' && (
                              <button onClick={() => { convertLeadToOpportunity(record); setMenuOpenId(null); }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">🔀 Convert to Opportunity</button>
                            )}
                            {page === 'opportunities' && (
                              <button onClick={() => { createOrderFromOpportunity(record); setMenuOpenId(null); }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">🛒 Create Order</button>
                            )}
                            {page === 'orders' && (
                              <button onClick={() => { createInvoiceFromOrder(record); setMenuOpenId(null); }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-800 text-white">🧾 Create Invoice</button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedRecord && (
        <RecordDetailPanel
          page={page}
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}

      {/* Create Modal */}
      <CreateRecordModal
        page={page}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
