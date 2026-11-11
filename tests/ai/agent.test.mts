import assert from 'node:assert/strict';
import { fakeSupabase } from './fake.mjs';
const A = await import(process.env.REPO + '/lib/ai/agent.ts');
const db = {
  retail_customers: [
    { id: 'c1', customer_number: 'RCUST-1', display_number: 1, name: 'Rakhi Rawat', phone: '7838345549', email: 'rakhi@x.com', status: 'Active', created_at: '2026-10-01' },
    { id: 'c2', customer_number: 'RCUST-2', display_number: 2, name: 'Rakesh Kumar', phone: '9999911111', status: 'Inactive', created_at: '2026-10-02' },
  ],
  retail_products: [
    { id: 'p1', product_number: 'RPROD-1', display_number: 1, name: 'Yoga Membership', price: 1000, gst_rate: 18, status: 'Active', created_at: '2026-09-01' },
    { id: 'p2', product_number: 'RPROD-2', display_number: 2, name: 'Yoga Mat', price: 500, gst_rate: 12, status: 'Active', created_at: '2026-09-01' },
  ],
  retail_invoices: [
    { id: 'i1', invoice_number: 'RINV-a', display_number: 41, customer: 'Rakhi Rawat', customer_id: 'c1', status: 'Paid', amount: 1180, invoice_date: '2026-11-01', created_at: '2026-11-01' },
    { id: 'i2', invoice_number: 'RINV-b', display_number: 42, customer: 'Rakhi Rawat', customer_id: 'c1', status: 'Draft', amount: 500, invoice_date: '2026-11-02', created_at: '2026-11-02' },
    { id: 'i3', invoice_number: 'RINV-c', display_number: 43, customer: 'Rakesh Kumar', customer_id: 'c2', status: 'Paid', amount: 2000, invoice_date: '2026-11-03', created_at: '2026-11-03' },
  ],
  retail_invoice_line_items: [{ invoice_number: 'RINV-a', product_name: 'Yoga Membership', quantity: 1, unit_price: 1000, discount_pct: 0, sort_order: 0 }],
  app_custom_fields: [{ object_type: 'retailInvoices', api_name: 'payment_terms', label: 'Payment terms', field_type: 'single_select', options: ['Net 7', 'Net 30'], is_published: true }],
};
const supabase = fakeSupabase(db);
const deny = new Set(['retailActivities']);
const can = (k, a) => !deny.has(k) && !(k === 'retailProducts' && a === 'create');
const cat = await A.buildCatalog({ supabase, b2cMode: true, can, customObjects: [] });
assert.ok(cat.objects.retailInvoices && !cat.objects.retailActivities && !cat.objects.customers, 'catalog respects mode + RBAC');
assert.equal(cat.objects.retailInvoices.customFields[0].api, 'payment_terms');
const ctx = { supabase, security: { ready: true, isAdmin: true }, appPreferences: { default_currency: 'INR' }, drafts: {}, cards: [] };
const run = async (name, args) => JSON.parse((await A.runTools(ctx, cat, [{ name, args }])).replace(/^<result name="[^"]+">/, '').replace(/<\/result>$/, ''));

// parse
const calls = A.parseTools('ok <tool>{"name":"search_records","args":{"object":"retailInvoices"}}</tool> <tool>{bad</tool>');
assert.equal(calls.length, 2); assert.equal(calls[1].name, '__bad_json__');
assert.equal(A.stripTools('Hi <tool>{"x":1}</tool> there'), 'Hi  there');

// search + filters + numbers
let r = await run('search_records', { object: 'retailInvoices', filters: [{ field: 'status', op: 'equals', value: 'Paid' }] });
assert.equal(r.total_matching, 2); assert.ok(r.records.every(x => x.status === 'Paid')); assert.ok(r.records[0].number.startsWith('RINV-000'));
r = await run('search_records', { object: 'customers' });
assert.ok(r.error, 'B2B object hidden in B2C mode');
r = await run('search_records', { object: 'retailActivities' });
assert.ok(r.error && /not permitted/.test(r.error), 'no-view object blocked');

// aggregate: paid sales only, grouped
r = await run('aggregate', { object: 'retailInvoices', metric: 'sum', field: 'amount', filters: [{ field: 'status', op: 'equals', value: 'Paid' }], group_by: 'customer' });
assert.equal(r.value, 3180); assert.equal(r.groups[0].group, 'Rakesh Kumar');

// get by display number with lines
r = await run('get_record', { object: 'retailInvoices', id: 'RINV-00041' });
assert.equal(r.record.number, 'RINV-00041'); assert.equal(r.line_items.length, 1);

// duplicates
r = await run('find_duplicates', { object: 'retailCustomers', name: 'Rakhi', phone: '+91 78383 45549' });
assert.equal(r.possible_duplicates.length, 1); assert.match(r.possible_duplicates[0].matched_on, /name.*phone|phone.*name/);

// prepare invoice: customer + products resolved, custom field validated, totals with GST
r = await run('prepare_create', { object: 'retailInvoices', fields: { customer: 'rakhi rawat', status: 'Draft', 'cf.payment_terms': 'net 30' }, line_items: [{ product: 'Yoga Membership', quantity: 2 }, { product: 'yoga mat', quantity: 1, discount_pct: 10 }] });
assert.equal(r.draft_ready, true, JSON.stringify(r)); assert.equal(r.fields.customer_id, 'c1'); assert.equal(r.custom_fields.payment_terms, 'Net 30');
assert.equal(r.totals.subtotal, 2500); assert.equal(r.totals.discount, 50); assert.equal(r.totals.tax, 414); assert.equal(r.totals.total, 2864);
assert.equal(ctx.cards[0]?.type, 'draft', 'ready draft gets a confirm card'); ctx.cards = [];
// unknown customer
r = await run('prepare_create', { object: 'retailInvoices', fields: { customer: 'Nobody Here' }, line_items: [{ product: 'Yoga Mat' }] });
assert.ok(r.customer_not_found);
// ambiguous customer
r = await run('prepare_create', { object: 'retailInvoices', fields: { customer: 'Rak' }, line_items: [{ product: 'Yoga Mat' }] });
assert.ok(r.needs_choice && r.candidates.length === 2);
// inactive customer warns
r = await run('prepare_create', { object: 'retailInvoices', fields: { customer: 'Rakesh Kumar' }, line_items: [{ product: 'Yoga Mat' }] });
assert.ok(r.warnings.some(w => /Inactive/.test(w)));
// missing lines
r = await run('prepare_create', { object: 'retailInvoices', fields: { customer: 'Rakhi Rawat' } });
assert.equal(r.draft_ready, false); assert.ok(r.missing.includes('at least one product line'));
// RBAC create denied
r = await run('prepare_create', { object: 'retailProducts', fields: { name: 'X' } });
assert.ok(/does not allow/.test(r.error));
// customer duplicate warning
r = await run('prepare_create', { object: 'retailCustomers', fields: { name: 'Rakhi Rawat', phone: '7838345549' } });
assert.ok(r.warnings.some(w => /duplicate/i.test(w)));
// bad date dropped
r = await run('prepare_create', { object: 'retailCustomers', fields: { name: 'New Person', date_of_birth: '5 May' } });
assert.ok(!('date_of_birth' in r.fields) && r.warnings.some(w => /not a date/.test(w)));
// record actions card
ctx.cards = [];
r = await run('record_actions', { object: 'retailInvoices', id: '42' });
assert.equal(r.number, 'RINV-00042'); assert.equal(ctx.cards[0].type, 'record');
// data-security: an 'own'-scope user only sees and totals their own records
db.retail_invoices.forEach((x, i) => { x.owner_id = i === 0 ? 'u1' : 'u2'; x.owner = i === 0 ? 'me@x.com' : 'other@x.com'; x.created_by = x.owner; });
const ctxOwn = { ...ctx, security: { ready: true, isAdmin: false, dataScope: 'own', userId: 'u1', userEmail: 'me@x.com' } };
const own = JSON.parse((await A.runTools(ctxOwn, cat, [{ name: 'aggregate', args: { object: 'retailInvoices', metric: 'sum', field: 'amount' } }])).replace(/^<result name="[^"]+">/, '').replace(/<\/result>$/, ''));
assert.equal(own.value, 1180); assert.equal(own.total_matching, 1);
const notReady = JSON.parse((await A.runTools({ ...ctx, security: { ready: false } }, cat, [{ name: 'search_records', args: { object: 'retailInvoices' } }])).replace(/^<result name="[^"]+">/, '').replace(/<\/result>$/, ''));
assert.equal(notReady.total_matching, 0, 'fails closed until permissions load');
console.log('ALL AGENT TESTS PASSED');
