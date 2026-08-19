// @ts-nocheck
'use client';

// Renders a single, appropriately-typed input for one custom field on one
// line-item row. Shared across every line-item grid (Quotations, B2B
// Orders/Invoices — both the CPQ and fallback views — and Retail
// Orders/Invoices) so the input behavior and styling stays consistent
// everywhere custom fields on a line item can appear.
export default function LineItemCustomFieldInput({ field, value, onChange, className }) {
  const cls = className || 'w-full border border-blue-200 rounded-lg px-2 py-2 text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs';

  switch (field.field_type) {
    case 'checkbox':
      return (
        <div className="flex justify-center">
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} className="w-4 h-4 accent-blue-600"/>
        </div>
      );
    case 'number':
    case 'currency':
      return <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} className={cls}/>;
    case 'date':
      return <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} className={cls}/>;
    case 'datetime':
      return <input type="datetime-local" value={value || ''} onChange={e => onChange(e.target.value)} className={cls}/>;
    case 'url':
      return <input type="url" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="https://" className={cls}/>;
    case 'email':
      return <input type="email" value={value || ''} onChange={e => onChange(e.target.value)} className={cls}/>;
    case 'single_select':
      return (
        <select value={value || ''} onChange={e => onChange(e.target.value)} className={cls}>
          <option value="">—</option>
          {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'multi_select': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <select multiple value={selected} onChange={e => onChange(Array.from(e.target.selectedOptions).map(o => o.value))} className={cls} style={{ height: 'auto', minHeight: 32 }}>
          {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    default:
      return <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} className={cls}/>;
  }
}
