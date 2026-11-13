// @ts-nocheck
'use client';
/**
 * Custom objects inside the automation engine (Workflow Rules, Assignment Rules, SLA Policies, Approvals,
 * scheduled "before date" rules).
 *
 * A custom object's object_type is "custom_<api_name>" (the same key RBAC, saved searches and Page Layout Designer
 * use). Its records live in custom_object_records / custom_object_line_items with named fields packed into generic
 * storage columns (text_3, number_1 ...). Rules are always written against the NAMED field (api_name), so this file
 * translates between the two: flatten a raw row into {api_name: value} before conditions are evaluated, and map an
 * api_name back to its storage column when an action writes to it or a scheduled rule queries a date.
 */
import {
  fetchCustomObjectFields, flattenCustomRecord, unpackFieldValues, CUSTOM_SYSTEM_FIELDS, CUSTOM_SYSTEM_KEYS,
  formatCustomDisplayNumber,
} from './customObjects';

export const isCustomType = (t: any) => typeof t === 'string' && t.startsWith('custom_');

export const customObjectFor = (objectType: string, customObjects: any[] = []) =>
  isCustomType(objectType) ? (customObjects || []).find(o => `custom_${o.api_name}` === objectType) || null : null;

export async function customFieldsFor(obj: any) {
  if (!obj) return { header: [], line: [] };
  const [header, line] = await Promise.all([
    fetchCustomObjectFields(obj.id, 'header'),
    obj.supports_line_items ? fetchCustomObjectFields(obj.id, 'line_item') : Promise.resolve([]),
  ]);
  return { header: header || [], line: line || [] };
}

/** Raw custom_object_records row -> row + {api_name: value} so rule conditions / {{tokens}} resolve by field name. */
export function flattenForRules(obj: any, header: any[], row: any) {
  if (!row) return row;
  const flat = flattenCustomRecord(header, row);
  // Every field is reachable by its plain api_name, even one exposed as cf_<name> in list views.
  header.forEach(f => {
    const v = f.storage_column === 'custom_data' ? (row.custom_data || {})[f.api_name] : row[f.storage_column];
    if (!CUSTOM_SYSTEM_KEYS.has(f.api_name)) flat[f.api_name] = v;
    flat[`cf_${f.api_name}`] = v;
  });
  flat.displayNumber = formatCustomDisplayNumber(obj, row.display_number);
  return flat;
}

/** Physical column for a named field (system or custom). null for jsonb-overflow fields. */
export function columnFor(header: any[], key: string, scope: 'header' | 'line_item' = 'header') {
  if (!key) return null;
  const k = key.startsWith('custom:') ? key.slice(7) : key;
  if (scope === 'header') {
    const sys = CUSTOM_SYSTEM_FIELDS.find(f => f.key === k);
    if (sys) return sys.col;
  }
  const api = k.startsWith('cf_') ? k.slice(3) : k;
  const f = header.find(x => x.api_name === api);
  if (!f) return null;
  return f.storage_column === 'custom_data' ? null : f.storage_column;
}

export function fieldDef(header: any[], key: string) {
  const k = key?.startsWith('custom:') ? key.slice(7) : key;
  const api = k?.startsWith('cf_') ? k.slice(3) : k;
  return header.find(x => x.api_name === api) || null;
}

/** Payload for setting one named field (used by the workflow "Update Field" action). */
export function updatePayloadFor(header: any[], key: string, value: any, row: any) {
  const k = key.startsWith('custom:') ? key.slice(7) : key;
  if (['name', 'status', 'owner'].includes(k)) return { [k]: value };
  const f = fieldDef(header, k);
  if (!f) return null;
  let v: any = value;
  if (f.field_type === 'number' || f.field_type === 'currency') v = value === '' || value == null ? null : Number(value);
  else if (f.field_type === 'checkbox') v = value === true || String(value).toLowerCase() === 'true' || value === '1' || String(value).toLowerCase() === 'yes';
  if (f.storage_column === 'custom_data') return { custom_data: { ...(row?.custom_data || {}), [f.api_name]: v } };
  return { [f.storage_column]: v };
}

/** Line items of one custom record, each flattened to {api_name: value} (plus the raw row). */
export async function fetchCustomLinesForRules(supabase: any, lineFields: any[], recordId: string) {
  if (!supabase || !recordId) return [];
  const { data } = await supabase.from('custom_object_line_items').select('*').eq('parent_record_id', recordId).order('sort_order');
  return (data || []).map(r => ({ ...r, ...unpackFieldValues(lineFields, r) }));
}

/** Field list (key/label/type/options) a rule builder shows for a custom object - header or line scope. */
export function ruleFieldsFor(header: any[], scope: 'header' | 'line_item' = 'header') {
  const TYPE = { number: 'number', currency: 'number', date: 'date', datetime: 'date', checkbox: 'boolean', single_select: 'select', multi_select: 'select' };
  const sys = scope === 'header'
    ? [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'status', label: 'Status', type: 'select' },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'created_by', label: 'Created By', type: 'text' },
        { key: 'created_at', label: 'Created Date', type: 'date' },
      ]
    : [];
  return [...sys, ...header.map(f => ({
    key: CUSTOM_SYSTEM_KEYS.has(f.api_name) && scope === 'header' ? `cf_${f.api_name}` : f.api_name,
    label: f.label, type: TYPE[f.field_type] || 'text', options: f.options || undefined,
  }))];
}
