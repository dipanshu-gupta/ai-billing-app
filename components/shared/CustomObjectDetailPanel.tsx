// @ts-nocheck
'use client';
/**
 * Full-screen record detail for a Custom Object - the same template as the
 * standard RecordDetailPanel: gradient header (name, status, owner, record
 * number), action bar (Back to list · Cancel · Save Changes · Save & Close),
 * Page-Layout-Designer-driven field sections, line items, and the System
 * Information card.
 */
import RedwoodSkin from '@/components/shared/RedwoodSkin';
import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';
import { useAlert } from '@/components/shared/AlertProvider';
import { useFieldLayout } from '@/lib/useFieldLayout';
import { formatDateTime, getStatusColor } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { ObjectIcon } from '@/lib/lineIcons';

import {
  updateCustomObjectRecord, fetchCustomObjectLineItems, unpackFieldValues, formatCustomDisplayNumber,
} from '@/lib/customObjects';
import {
  useCustomLookups, CustomSectionsView, CustomLineItemsCard, buildCustomSections,
} from '@/components/shared/CustomObjectForm';
import RecordHighlights from '@/components/shared/RecordHighlights';
import CustomRelatedLists, { useHasRelated } from '@/components/shared/CustomRelatedLists';

export default function CustomObjectDetailPanel({ customObject, headerFields, lineFields, record, onClose, onSaved, initialTab = null }) {
  const { currentUser, hasPermission, enterpriseUsers, organizations, businessUnits, appearance } = useApp();
  const { supabase, tenant } = useTenant();
  const { showAlert, showConfirm } = useAlert();
  const lang = appearance?.language || 'en';
  const objectType = `custom_${customObject.api_name}`;
  const canEdit = hasPermission ? hasPermission(`${objectType}_edit`) : true;
  const { fields: layout, sections: layoutSections } = useFieldLayout(objectType);
  const lookups = useCustomLookups(headerFields);
  // "360" tab: every object that has a Lookup field pointing at this object shows its records here (same idea as Customer 360).
  const hasRelated = useHasRelated('custom', customObject.api_name);
  const [tab, setTab] = useState(initialTab || 'details');
  useEffect(() => { setTab(initialTab || 'details'); }, [record?.id, initialTab]);
  const activeTab = tab === '360' && hasRelated ? '360' : 'details';
  const ctx = useMemo(() => ({ supabase, tenantId: tenant?.id, currentUser, showAlert }), [supabase, tenant?.id, currentUser]);

  const initial = (rec) => ({
    ...unpackFieldValues(headerFields, rec),
    __name: rec.name ?? '', __status: rec.status || 'Active',
    __owner: rec.owner, __owner_id: rec.owner_id, __owner_name: rec.owner_name,
  });
  const [current, setCurrent] = useState(record);
  const [values, setValues] = useState(() => initial(record));
  const [lineRows, setLineRows] = useState([]);
  const [loadingLI, setLoadingLI] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setCurrent(record); setValues(initial(record)); setIsDirty(false);
    if (!customObject.supports_line_items) { setLineRows([]); return; }
    setLoadingLI(true);
    fetchCustomObjectLineItems(record.id).then(items => {
      setLineRows(items.map(it => unpackFieldValues(lineFields, it)));
      setLoadingLI(false);
    });
  }, [record.id]);

  const patch = (p) => { if (!canEdit) return; setIsDirty(true); setValues(v => ({ ...v, ...p })); };
  const setRows = (updater) => { if (!canEdit) return; setIsDirty(true); setLineRows(updater); };

  const mergedForRules = { ...values, name: values.__name, status: values.__status };
  const sections = useMemo(
    () => buildCustomSections({ headerFields, layout, layoutSections, pageScope: 'detail', values: mergedForRules }),
    [headerFields, layout, layoutSections, values],
  );

  const handleSave = async (andClose = false) => {
    if (!String(values.__name ?? '').trim()) { showAlert('Name is required.', { variant: 'warning' }); return; }
    for (const f of headerFields) {
      const v = values[f.api_name];
      if (f.required && f.show_on !== 'create' && (v === undefined || v === null || String(Array.isArray(v) ? v.join('') : v).trim() === '') && f.field_type !== 'checkbox') {
        showAlert(`"${f.label}" is required.`, { variant: 'warning' }); return;
      }
    }
    setSaving(true);
    const ok = await updateCustomObjectRecord(ctx, customObject, record.id, headerFields, values, lineRows, lineFields);
    if (!ok) { setSaving(false); return; }
    const { data: fresh } = await supabase.from('custom_object_records').select('*').eq('id', record.id).maybeSingle();
    if (fresh) { setCurrent(fresh); setValues(initial(fresh)); onSaved && onSaved(fresh); }
    setIsDirty(false); setSaving(false);
    if (andClose) onClose();
    else { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2500); }
  };

  const close = async () => {
    if (isDirty) {
      const ok = await showConfirm('You have unsaved changes. Discard them?', { title: 'Unsaved Changes', variant: 'warning', confirmLabel: 'Discard' });
      if (!ok) return;
    }
    onClose();
  };

  const ownerUser = (enterpriseUsers || []).find(u => u.id === values.__owner_id || u.email === values.__owner);
  const numberLabel = formatCustomDisplayNumber(customObject, current.display_number) || current.record_number || '';
  const sysInfo = [
    ['Record Number', numberLabel || '-'],
    ['Record ID', current.id || '-'],
    ['Created By', current.created_by || '-'],
    ['Created At', current.created_at ? formatDateTime(current.created_at) : '-'],
    ['Updated By', current.updated_by || '-'],
    ['Updated At', current.updated_at ? formatDateTime(current.updated_at) : '-'],
    ['Owner', ownerUser ? `${ownerUser.first_name} ${ownerUser.last_name}` : (current.owner_name || current.owner || '-')],
    ['Organization', (organizations || []).find(o => o.id === current.organization_id)?.name || '-'],
    ['Business Unit', (businessUnits || []).find(b => b.id === current.business_unit_id)?.name || '-'],
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-[110] overflow-y-auto">
      <div className="rw-panel bg-white rounded-[28px] shadow-2xl w-[98vw] my-4 mx-auto overflow-hidden flex flex-col" style={{ minHeight: '95vh' }}>
        <RedwoodSkin />

        {/* Header */}
        <div className="rw-header bg-gradient-to-r from-[#0F172A] to-blue-900 px-8 py-5 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl"><ObjectIcon icon={customObject.icon} className="w-7 h-7"/></span>
              <h2 className="text-2xl font-bold">{values.__name || customObject.singular_label}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(values.__status)}`}>{values.__status}</span>
              {ownerUser && <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full">👤 {ownerUser.first_name} {ownerUser.last_name}</span>}
            </div>
            <p className="text-blue-300 text-sm mt-1 flex items-center gap-2 flex-wrap">
              <span className="bg-blue-600 text-white font-mono font-bold px-3 py-0.5 rounded-full text-xs tracking-wider shadow-sm">{numberLabel}</span>
              <span className="text-blue-300">{customObject.singular_label}</span>
            </p>
          </div>
          <button onClick={close} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg">✕</button>
        </div>

        {/* Action bar */}
        <div className="bg-white border-b border-blue-100 px-8 py-3 flex items-center justify-between flex-shrink-0">
          <button onClick={close} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0F172A] font-semibold transition-all">← Back to list</button>
          <div className="flex items-center gap-3">
            {saveSuccess && <span className="text-green-600 text-sm font-semibold flex items-center gap-1">✓ Saved</span>}
            <button onClick={close} className="px-4 py-2 text-sm rounded-xl font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">{t(lang, 'cancel')}</button>
            {canEdit && (<>
              <button onClick={() => handleSave(false)} disabled={saving || !isDirty}
                className={`px-4 py-2 text-sm rounded-xl font-semibold transition-all ${isDirty && !saving ? 'bg-blue-100 hover:bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'} disabled:opacity-50`}>
                {saving ? t(lang, 'loading') : t(lang, 'saveChanges')}
              </button>
              <button onClick={() => handleSave(true)} disabled={saving || !isDirty}
                className="px-5 py-2 text-sm rounded-xl font-semibold bg-gradient-to-r from-[#0F172A] to-blue-800 text-white hover:opacity-90 disabled:opacity-50 shadow-md">
                {saving ? t(lang, 'loading') : t(lang, 'saveClose')}
              </button>
            </>)}
          </div>
        </div>

        {(() => {
          const hl = [];
          for (const sec of sections) for (const it of sec.items) {
            if (hl.length >= 5) break;
            if (it.key === 'name' || (it.field && ['textarea','richtext'].includes(it.field.field_type))) continue;
            let raw = it.key === 'status' ? values.__status : it.key === 'owner' ? (values.__owner_name || values.__owner || '') : values[it.key];
            // Lookup fields store the related record's id — show its resolved name (same source the form control uses).
            if (it.field?.field_type === 'lookup') raw = ((lookups[it.key] || []).find(o => o.id === raw)?.label) || '';
            hl.push({ label: it.label, value: Array.isArray(raw) ? raw.join(', ') : typeof raw === 'boolean' ? (raw ? 'Yes' : 'No') : (raw ?? '') });
          }
          return hl.length ? <RecordHighlights items={hl} /> : null;
        })()}
        {hasRelated && (
          <div className="rw-tabs flex bg-slate-800 border-b border-slate-700 px-6 flex-shrink-0">
            {[{ k: 'details', l: '📋 Details' }, { k: '360', l: `🔄 ${customObject.singular_label} 360` }].map(tb => (
              <button key={tb.k} type="button" onClick={() => setTab(tb.k)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${activeTab === tb.k ? 'border-blue-400 text-white' : 'border-transparent text-white/50 hover:text-white/80'}`}>
                {tb.l}
              </button>
            ))}
          </div>
        )}
        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-br from-white to-blue-50 p-8 space-y-6">
          {activeTab === '360' ? (
            <CustomRelatedLists parentKind="custom" parentKey={customObject.api_name} parentId={record.id} parentName={values.__name} parentPage={objectType} parentRecord={current} returnTab="360" />
          ) : (<>
          {!canEdit && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3">
              <span className="text-xl">🔒</span>
              <div><p className="text-sm font-bold text-amber-800">This record is read-only</p><p className="text-xs text-amber-600">You don't have permission to edit {customObject.plural_label}.</p></div>
            </div>
          )}

          <div className="flex items-center gap-3 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{customObject.singular_label} Number</span>
            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full text-sm border border-blue-200">{numberLabel}</span>
          </div>

          <CustomSectionsView sections={sections} values={values} patch={patch} lookups={lookups} createdBy={current.created_by} objectType={objectType} locked={!canEdit} />

          {customObject.supports_line_items && (loadingLI
            ? <div className="bg-white rounded-[24px] border border-blue-100 p-8 text-center text-gray-400">Loading {customObject.line_item_plural_label?.toLowerCase() || 'line items'}…</div>
            : <CustomLineItemsCard customObject={customObject} lineFields={lineFields} rows={lineRows} setRows={setRows} readOnly={!canEdit} />)}

          {/* System Information */}
          <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#0F172A]">System Information</h3>
              <span className="text-2xl">🛡️</span>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {sysInfo.map(([lbl, val]) => (
                <div key={lbl}>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{lbl}</div>
                  <div className="text-sm text-[#0F172A] font-medium bg-gray-50 rounded-xl px-3 py-2 truncate" title={String(val)}>{val}</div>
                </div>
              ))}
            </div>
          </div>
          </>)}
        </div>

        <div className="px-8 py-3 border-t border-blue-100 bg-gray-50 flex items-center gap-3 flex-shrink-0">
          {customObject.supports_line_items && <span className="text-xs text-gray-400 ml-auto">{lineRows.length} {(lineRows.length === 1 ? customObject.line_item_singular_label : customObject.line_item_plural_label || 'line items').toLowerCase()}</span>}
        </div>
      </div>
    </div>
  );
}
