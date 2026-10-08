// @ts-nocheck
'use client';
/**
 * Create modal for a Custom Object - same template as the standard
 * CreateRecordModal: gradient header, scrolling field grid, Cancel /
 * Create footer. Honours Page Layout Designer (labels, hidden, read-only,
 * order, sections) for the 'create' page scope.
 */
import RedwoodSkin from '@/components/shared/RedwoodSkin';
import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';
import { useAlert } from '@/components/shared/AlertProvider';
import { useFieldLayout, resolveFieldRow, resolveLayoutDefault } from '@/lib/useFieldLayout';
import { isTemplateDefault, useTemplateDefaults } from '@/lib/defaultTemplates';
import { t } from '@/lib/i18n';
import { ObjectIcon } from '@/lib/lineIcons';

import { resolveStatusOptions } from '@/lib/statusOptions';
import { CUSTOM_STATUS_OPTIONS } from '@/lib/customObjects';
import { createCustomObjectRecord, resolveLookupLabel } from '@/lib/customObjects';
import {
  useCustomLookups, CustomSectionsView, CustomLineItemsCard, buildCustomSections, ownerPatch,
} from '@/components/shared/CustomObjectForm';

export default function CustomObjectCreateModal({ customObject, headerFields, lineFields, open, onClose, onCreated, prefill = null, lockedKeys = [] }) {
  const { currentUser, enterpriseUsers, appearance, customObjects } = useApp();
  const { supabase, tenant } = useTenant();
  const { showAlert } = useAlert();
  const lang = appearance?.language || 'en';
  const { fields: layout, sections: layoutSections } = useFieldLayout(`custom_${customObject.api_name}`);
  const lookups = useCustomLookups(headerFields);
  const ctx = useMemo(() => ({ supabase, tenantId: tenant?.id, currentUser, showAlert }), [supabase, tenant?.id, currentUser]);

  const [values, setValues] = useState({});
  const [lineRows, setLineRows] = useState([]);
  const [saving, setSaving] = useState(false);

  // Defaults: App Composer default first, then the Page Layout Designer default for the Create page
  // (Create-only row, else Both Pages) wins.
  const buildDefaults = () => {
    const v: any = { __name: '', __status: resolveStatusOptions(`custom_${customObject.api_name}`, CUSTOM_STATUS_OPTIONS)[0] || 'Active' };
    headerFields.forEach(f => {
      const row = resolveFieldRow(f.api_name, layout || [], 'create');
      const raw = row?.default_value || f.default_value;
      const val = resolveLayoutDefault(f.field_type === 'date' ? 'date' : f.field_type === 'datetime' ? 'datetime' : f.field_type === 'checkbox' ? 'checkbox' : f.field_type === 'number' ? 'number' : 'text', raw, v);
      if (val !== undefined) v[f.api_name] = val;
    });
    const nameRow = resolveFieldRow('name', layout || [], 'create');
    if (nameRow?.default_value && !isTemplateDefault(nameRow.default_value, 'text')) v.__name = nameRow.default_value;
    const statusRow = resolveFieldRow('status', layout || [], 'create');
    if (statusRow?.default_value) v.__status = statusRow.default_value;
    return v;
  };

  // Fresh form each time it opens.
  useEffect(() => {
    if (!open) return;
    const v = buildDefaults();
    if (currentUser) Object.assign(v, ownerPatch(currentUser));
    if (prefill) Object.assign(v, prefill);
    setValues(v); setLineRows([]);
  }, [open, customObject.id]);

  // Layout config that finishes loading after the form opened: fill only fields that are still empty.
  const layoutSig = JSON.stringify((layout || []).map(r => [r.field_key, r.page_scope, r.default_value || '']));
  useEffect(() => {
    if (!open) return;
    const d = buildDefaults();
    setValues(v => {
      const n = { ...v };
      Object.keys(d).forEach(k => { if (d[k] !== '' && (n[k] === undefined || n[k] === '') && !(prefill && k in prefill)) n[k] = d[k]; });
      return n;
    });
  }, [open, layoutSig]);

  const patch = (p) => setValues(v => ({ ...v, ...p }));
  const merged = { ...values, name: values.__name, status: values.__status };
  const sections = useMemo(
    () => buildCustomSections({ headerFields, layout, layoutSections, pageScope: 'create', values: merged }),
    [headerFields, layout, layoutSections, values],
  );

  // Names for lookup values that aren't in the (first-300) option list - e.g. a configured default pointing at an
  // older record. Resolved once per id so {{LookupField}} in a template always reads as a name, never an id.
  const [extraLabels, setExtraLabels] = useState<Record<string, string>>({});
  const lookupValSig = JSON.stringify(headerFields.filter(x => x.field_type === 'lookup').map(f => values[f.api_name] || ''));
  useEffect(() => {
    if (!open) return;
    let dead = false;
    (async () => {
      for (const f of headerFields.filter(x => x.field_type === 'lookup')) {
        const id = values[f.api_name];
        if (!id || (lookups[f.api_name] || []).some(o => o.id === id)) continue;
        const k = f.api_name + ':' + id;
        if (extraLabels[k] !== undefined) continue;
        let lbl = '';
        try { lbl = await resolveLookupLabel(f, String(id), customObjects || []); } catch { lbl = ''; }
        if (!dead) setExtraLabels(p => ({ ...p, [k]: lbl && lbl !== String(id) ? lbl : '' }));
      }
    })();
    return () => { dead = true; };
  }, [open, lookupValSig, Object.keys(lookups).length]);

  // ── {{token}} templates & = formulas (e.g. Name = "Salary of {{CoachName}} for {{Month}}") ──
  const _skipTypes = ['checkbox', 'single_select', 'multi_select', 'lookup'];
  const _tplTargets: Record<string, { raw: string; type: string }> = {};
  const _nameRaw = resolveFieldRow('name', layout || [], 'create')?.default_value;
  if (_nameRaw && isTemplateDefault(_nameRaw, 'text')) _tplTargets['__name'] = { raw: _nameRaw, type: 'text' };
  headerFields.forEach(f => {
    const raw = resolveFieldRow(f.api_name, layout || [], 'create')?.default_value || f.default_value;
    const ty = f.field_type === 'date' ? 'date' : f.field_type === 'datetime' ? 'datetime' : f.field_type === 'number' || f.field_type === 'currency' ? 'number' : 'text';
    if (!_skipTypes.includes(f.field_type) && isTemplateDefault(raw, ty)) _tplTargets[f.api_name] = { raw, type: ty };
  });
  const _tplFields = [
    { key: '__name', label: 'Name', type: 'text', alt: ['name', layout?.find(r => r.field_key === 'name')?.custom_label].filter(Boolean) },
    { key: '__status', label: 'Status', type: 'text', alt: ['status'] },
    ...headerFields.map(f => ({ key: f.api_name, label: f.label, type: f.field_type === 'currency' ? 'number' : f.field_type, alt: [layout?.find(r => r.field_key === f.api_name)?.custom_label].filter(Boolean) })),
  ];
  useTemplateDefaults({
    open, templates: _tplTargets, fields: _tplFields, user: currentUser,
    display: (key, val) => (lookups?.[key] || []).find(o => o.id === val)?.label ?? (extraLabels[key + ':' + val] || undefined),
    values,
    onPatch: patch,
  });

  if (!open) return null;

  const handleCreate = async () => {
    if (!String(values.__name ?? '').trim()) { showAlert('Name is required.', { variant: 'warning' }); return; }
    for (const f of headerFields) {
      if (!f.required || f.show_on === 'detail' || f.field_type === 'checkbox') continue;
      const v = values[f.api_name];
      if (v === undefined || v === null || String(Array.isArray(v) ? v.join('') : v).trim() === '') {
        showAlert(`"${f.label}" is required.`, { variant: 'warning' }); return;
      }
    }
    setSaving(true);
    const rec = await createCustomObjectRecord(ctx, customObject, headerFields, values, lineRows, lineFields);
    setSaving(false);
    if (!rec) return;
    showAlert(`${customObject.singular_label} "${rec.name}" created successfully.`, { variant: 'success' });
    onClose();
    onCreated && onCreated(rec);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="rw-panel rw-modal relative bg-white rounded-[28px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <RedwoodSkin />
        <div className="rw-header bg-gradient-to-r from-[#0F172A] to-blue-900 px-6 py-5 flex items-center justify-between flex-shrink-0">
          <h2 className="text-white text-xl font-bold"><span className="inline-flex items-center gap-2"><ObjectIcon icon={customObject.icon} className="w-6 h-6"/> Create {customObject.singular_label}</span></h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <CustomSectionsView sections={sections} values={values} patch={patch} lookups={lookups} lockedKeys={lockedKeys} objectType={`custom_${customObject.api_name}`} cols="sm:grid-cols-2" cardClass="bg-white rounded-[20px] border border-blue-100" />
          {customObject.supports_line_items && (
            <CustomLineItemsCard customObject={customObject} lineFields={lineFields} rows={lineRows} setRows={setLineRows} />
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0 bg-gray-50">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-100">{t(lang, 'cancel')}</button>
          <button onClick={handleCreate} disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0F172A] to-blue-800 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 shadow-md flex items-center gap-2">
            {saving ? `⏳ ${t(lang, 'loading')}` : `✓ ${t(lang, 'create')} ${customObject.singular_label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
