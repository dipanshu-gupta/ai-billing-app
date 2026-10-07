// @ts-nocheck
'use client';
/**
 * useRelabel - applies a tenant's object renames (Customers -> Patients,
 * Orders -> Bookings ...) to free text such as dashboard card titles, chart
 * names and button captions that are written with the default object words.
 *
 *   const L = useRelabel();   L('Total Customers')  ->  'Total Patients'
 *
 * Whole-word, case-preserving for the first letter, plural before singular,
 * and mode-aware (B2C tenants map Orders/Invoices/... to the retail objects).
 */
import { useCallback } from 'react';
import { useObjectLabels, labelsSnapshot } from '@/lib/useObjectLabels';
import { useApp } from '@/context/AppContext';

const CRM_WORDS = [
  ['Opportunities', 'opportunities', 'plural'], ['Opportunity', 'opportunities', 'singular'],
  ['Quotations', 'quotations', 'plural'], ['Quotation', 'quotations', 'singular'],
  ['Activities', 'activities', 'plural'], ['Activity', 'activities', 'singular'],
  ['Customers', 'customers', 'plural'], ['Customer', 'customers', 'singular'],
  ['Contacts', 'contacts', 'plural'], ['Contact', 'contacts', 'singular'],
  ['Invoices', 'invoices', 'plural'], ['Invoice', 'invoices', 'singular'],
  ['Products', 'products', 'plural'], ['Product', 'products', 'singular'],
  ['Orders', 'orders', 'plural'], ['Order', 'orders', 'singular'],
  ['Leads', 'leads', 'plural'], ['Lead', 'leads', 'singular'],
];
const RETAIL_WORDS = [
  ['Activities', 'retailActivities', 'plural'], ['Activity', 'retailActivities', 'singular'],
  ['Customers', 'retailCustomers', 'plural'], ['Customer', 'retailCustomers', 'singular'],
  ['Invoices', 'retailInvoices', 'plural'], ['Invoice', 'retailInvoices', 'singular'],
  ['Products', 'retailProducts', 'plural'], ['Product', 'retailProducts', 'singular'],
  ['Orders', 'retailOrders', 'plural'], ['Order', 'retailOrders', 'singular'],
];

export function useRelabel() {
  const { labels } = useObjectLabels();
  const { appPreferences } = useApp();
  const words = appPreferences?.b2c_mode === true ? RETAIL_WORDS : CRM_WORDS;
  return useCallback((text) => {
    if (typeof text !== 'string' || !text) return text;
    let out = text;
    for (const [word, key, form] of words) {
      const o = labels?.[key];
      const repl = o && (form === 'singular' ? o.singular : o.plural);
      if (!repl || repl === word) continue;
      out = out.replace(new RegExp(`\\b${word}\\b`, 'g'), repl);
    }
    return out;
  }, [labels, words]);
}

/**
 * Non-hook version for places that cannot call hooks (the global alert /
 * confirm dialog). Text inside "double quotes" is left alone, so a record
 * called "Order Desk" in a message is never renamed.
 */
export function relabelText(text) {
  if (typeof text !== 'string' || !text) return text;
  const labels = labelsSnapshot();
  if (!labels || !Object.keys(labels).length) return text;
  const b2c = typeof window !== 'undefined' && (window as any).__bp_prefs?.b2c_mode === true;
  const words = b2c ? RETAIL_WORDS : CRM_WORDS;
  return text.split(/(\"[^\"]*\")/).map((part) => {
    if (part.startsWith('"') && part.endsWith('"') && part.length > 1) return part;
    let out = part;
    for (const [word, key, form] of words) {
      const o = labels[key];
      const repl = o && (form === 'singular' ? o.singular : o.plural);
      if (!repl || repl === word) continue;
      out = out.replace(new RegExp(`\\b${word}\\b`, 'g'), repl);
    }
    return out;
  }).join('');
}

/**
 * AI helpers. The model is told the tenant's own object names so it speaks
 * (and understands the user) in them, while technical object keys used by
 * <action> blocks stay unchanged. Summary headings ("Orders: 12 | ...") are
 * renamed too; record data lines are never touched.
 */
export function terminologyBlock() {
  const labels = labelsSnapshot();
  const b2c = typeof window !== 'undefined' && (window as any).__bp_prefs?.b2c_mode === true;
  const words = b2c ? RETAIL_WORDS : CRM_WORDS;
  const lines = [];
  for (const [word, key, form] of words) {
    if (form !== 'singular') continue;
    const o = labels[key];
    if (!o || (!o.singular && !o.plural)) continue;
    const sing = o.singular || word;
    const plur = o.plural || (word.endsWith('y') ? word.slice(0, -1) + 'ies' : word + 's');
    if (sing === word && plur === (word.endsWith('y') ? word.slice(0, -1) + 'ies' : word + 's')) continue;
    lines.push(`- "${word}" is called "${sing}" (plural "${plur}") in this business`);
  }
  if (!lines.length) return '';
  return `\n\nTERMINOLOGY — this business renamed some objects. ALWAYS use these names when you write to the user, and treat the user's use of them as the same objects:\n${lines.join('\n')}\nKeep the technical object keys inside <action> blocks exactly as specified above.`;
}
export function relabelHeadings(prompt) {
  if (typeof prompt !== 'string') return prompt;
  return prompt.split('\n').map(line => {
    const i = line.indexOf(':');
    if (i <= 0 || i > 40) return line;
    return relabelText(line.slice(0, i)) + line.slice(i);
  }).join('\n') ;
}
export function withTerminology(prompt) {
  return relabelHeadings(prompt) + terminologyBlock();
}
