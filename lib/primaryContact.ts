// @ts-nocheck
import { tenantScope } from '@/lib/utils';

/**
 * Before a contact is made Primary, tell the user which contact will stop being Primary for that customer and ask
 * them to confirm. Returns true to go ahead (also when there is no other primary contact).
 */
export async function confirmPrimarySwitch({ supabase, showConfirm, customerId, customerName, selfNumber, selfName }) {
  if (!supabase || !customerId) return true;
  try {
    let q = tenantScope(supabase.from('contacts').select('contact_number, name')).eq('customer_id', customerId).eq('is_primary', true);
    if (selfNumber) q = q.neq('contact_number', selfNumber);
    const { data } = await q.limit(1);
    const current = data?.[0];
    if (!current) return true;
    return await showConfirm(
      `${current.name} is currently the primary contact for ${customerName || 'this customer'}. If you make ${selfName || 'this contact'} the primary contact, ${current.name} will no longer be primary.`,
      { title: 'Change primary contact?', confirmLabel: 'Make primary', variant: 'warning' });
  } catch { return true; }
}
