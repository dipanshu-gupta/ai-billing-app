// @ts-nocheck
/**
 * Loads canvas templates (document_templates / booking_receipt_templates)
 * for one document type, scoped to the current tenant, and merges them with
 * the classic (toggle-based) templates so existing tenants keep working:
 * canvas templates come first and take over the default as soon as one exists.
 */
import { tenantScope } from '@/lib/utils';
import { DOC_TYPES } from '@/lib/documentCanvas';

export async function loadCanvasTemplates(supabase: any, docType: string): Promise<any[]> {
  const dt = DOC_TYPES[docType];
  if (!supabase || !dt) return [];
  try {
    let q = supabase.from(dt.table).select('*');
    if (dt.table === 'document_templates') q = q.eq('doc_type', docType);
    const { data, error } = await tenantScope(q).order('created_at');
    if (error || !data) return [];
    return data.map((r: any) => ({ ...r, doc_type: docType, _canvas: true, isDefault: !!r.is_default, dbId: r.id }));
  } catch { return []; }
}

// canvas first; legacy rows lose their "default" flag once any canvas exists
export function mergeTemplates(canvas: any[], legacy: any[]) {
  if (!canvas.length) return legacy;
  return [...canvas, ...legacy.map(l => ({ ...l, is_default: false, isDefault: false }))];
}

export function pickDefault(list: any[]) {
  return list.find(t => t.is_default || t.isDefault) || list[0] || null;
}
