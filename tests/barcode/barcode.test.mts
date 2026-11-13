// Run: REPO=$PWD node --experimental-strip-types --import ./tests/barcode/register.mjs tests/barcode/barcode.test.mts
import assert from 'node:assert/strict';
const B = await import(process.env.REPO + '/lib/barcode.ts');
const A = await import(process.env.REPO + '/lib/customAutomation.ts');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

// fake supabase: tables -> rows; supports select/eq/in/limit/maybeSingle/order and tenantScope (no tenant on window)
function fake(tables) {
  const q = (table) => {
    let rows = [...(tables[table] || [])];
    const api = {
      select() { return api; }, order() { return api; }, limit(k) { rows = rows.slice(0, k); return api; },
      eq(c, v) { rows = rows.filter(r => String(r[c]) === String(v)); return api; },
      in(c, vs) { rows = rows.filter(r => vs.map(String).includes(String(r[c]))); return api; },
      or() { return api; }, is() { return api; },
      maybeSingle() { return Promise.resolve({ data: rows[0] || null, error: null }); },
      then(res, rej) { return Promise.resolve({ data: rows, error: null }).then(res, rej); },
    };
    return api;
  };
  return { from: q };
}

await t('normalize strips control chars and AIM prefix, keeps leading zeros', () => {
  assert.equal(B.normalizeBarcode(' ]E00012345678905\r\n'), '0012345678905');
  assert.equal(B.normalizeBarcode('\u0002ABC-123\u0003'), 'ABC-123');
});
await t('EAN-13 and UPC-A variants', () => {
  assert.ok(B.barcodeVariants('012345678905').includes('0012345678905'));
  assert.ok(B.barcodeVariants('0012345678905').includes('012345678905'));
});
await t('GTIN check digit', () => {
  assert.equal(B.gtinCheckOk('4006381333931'), true);
  assert.equal(B.gtinCheckOk('4006381333932'), false);
  assert.equal(B.gtinCheckOk('ABC123'), true);
});

const products = [
  { id: 'PROD-1', _uuid: 11, name: 'Pen', price: 10, barcode: '8901234567890', sku: 'PEN-1', status: 'Active', stock_quantity: 5 },
  { id: 'PROD-2', _uuid: 12, name: 'Ink', price: 50, barcode: '', sku: 'INK-1', status: 'Active' },
  { id: 'PROD-3', _uuid: 13, name: 'Old Pad', price: 5, barcode: '111222333', sku: 'PAD', status: 'Discontinued' },
];
const db = fake({ product_barcodes: [{ product_type: 'b2b', product_id: '11', barcode: '5551234567890', pack_qty: 12 }], products: [{ id: 14, product_number: 'PROD-4', name: 'Stapler', price: 99, barcode: '7777777', status: 'Active' }] });

await t('resolve main barcode / pack barcode / sku / db fallback / inactive / unknown', async () => {
  B.invalidateBarcodeCache();
  let r = await B.resolveBarcode(db, 'b2b', '8901234567890', products);
  assert.equal(r.product.name, 'Pen'); assert.equal(r.packQty, 1);
  r = await B.resolveBarcode(db, 'b2b', '5551234567890', products);
  assert.equal(r.product.name, 'Pen'); assert.equal(r.packQty, 12); assert.equal(r.matchedBy, 'pack');
  r = await B.resolveBarcode(db, 'b2b', 'ink-1', products);
  assert.equal(r.product.name, 'Ink'); assert.equal(r.matchedBy, 'sku');
  r = await B.resolveBarcode(db, 'b2b', '7777777', products);
  assert.equal(r.product.name, 'Stapler'); assert.equal(r.product.product_number, 'PROD-4');
  r = await B.resolveBarcode(db, 'b2b', '111222333', products);
  assert.equal(r.error, 'inactive');
  r = await B.resolveBarcode(db, 'b2b', '000', products);
  assert.equal(r.error, 'not_found');
});

await t('scanIntoItems: fills empty line, increments repeat, appends new, keeps configured lines apart', () => {
  let items = [{ product_name: '', quantity: 1, unit_price: 0 }];
  const setItems = (fn) => { items = fn(items); };
  const mk = () => ({ product_name: '', quantity: 1, unit_price: 0 });
  const apply = (u, pr) => ({ ...u, product_name: pr.name, unit_price: pr.price, product_id: String(pr._uuid) });
  const rec = (u) => ({ ...u, extended_price: u.quantity * u.unit_price });
  B.scanIntoItems({ setItems, product: products[0], qty: 1, makeBlank: mk, applyProduct: apply, recompute: rec });
  assert.equal(items.length, 1); assert.equal(items[0].product_name, 'Pen'); assert.equal(items[0].extended_price, 10);
  B.scanIntoItems({ setItems, product: products[0], qty: 12, makeBlank: mk, applyProduct: apply, recompute: rec });
  assert.equal(items.length, 1); assert.equal(items[0].quantity, 13); assert.equal(items[0].extended_price, 130);
  B.scanIntoItems({ setItems, product: products[1], qty: 1, makeBlank: mk, applyProduct: apply, recompute: rec });
  assert.equal(items.length, 2); assert.equal(items[1].product_name, 'Ink');
  items[1].configuration = { colour: 'Blue' };
  B.scanIntoItems({ setItems, product: products[1], qty: 1, makeBlank: mk, applyProduct: apply, recompute: rec });
  assert.equal(items.length, 3, 'configured line is not merged');
});

const obj = { id: 'o1', api_name: 'rentals', singular_label: 'Rental', supports_line_items: true };
const header = [
  { api_name: 'return_by', label: 'Return By', field_type: 'date', storage_column: 'date_2' },
  { api_name: 'deposit', label: 'Deposit', field_type: 'currency', storage_column: 'number_1' },
  { api_name: 'tags', label: 'Tags', field_type: 'multi_select', storage_column: 'custom_data' },
  { api_name: 'status', label: 'Own Status', field_type: 'text', storage_column: 'text_9' },
];
await t('custom automation: flatten row to field names', () => {
  const row = { id: 'u1', name: 'R1', status: 'Active', display_number: 7, date_2: '2026-11-20', number_1: 500, text_9: 'x', custom_data: { tags: ['a'] } };
  const f = A.flattenForRules(obj, header, row);
  assert.equal(f.return_by, '2026-11-20'); assert.equal(f.deposit, 500); assert.deepEqual(f.tags, ['a']);
  assert.equal(f.status, 'Active', 'system status wins'); assert.equal(f.cf_status, 'x');
  assert.equal(f.displayNumber, 'RENT-00007');
});
await t('custom automation: columns and update payloads', () => {
  assert.equal(A.columnFor(header, 'return_by'), 'date_2');
  assert.equal(A.columnFor(header, 'created_at'), 'created_at');
  assert.equal(A.columnFor(header, 'tags'), null);
  assert.deepEqual(A.updatePayloadFor(header, 'deposit', '750', {}), { number_1: 750 });
  assert.deepEqual(A.updatePayloadFor(header, 'status', 'Closed', {}), { status: 'Closed' });
  assert.deepEqual(A.updatePayloadFor(header, 'cf_status', 'y', {}), { text_9: 'y' });
  assert.deepEqual(A.updatePayloadFor(header, 'tags', ['b'], { custom_data: { other: 1 } }), { custom_data: { other: 1, tags: ['b'] } });
  assert.equal(A.updatePayloadFor(header, 'nope', 1, {}), null);
  assert.equal(A.isCustomType('custom_rentals'), true); assert.equal(A.isCustomType('orders'), false);
});
console.log(`\nALL ${n} BARCODE/CUSTOM-AUTOMATION TESTS PASSED`);
