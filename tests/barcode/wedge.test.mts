// Handheld-scanner detection: a fast burst + Enter is a scan; human typing is not.
import assert from 'node:assert/strict';
let handler = null; let now = 0;
globalThis.window = { addEventListener: (_t, fn) => { handler = fn; }, removeEventListener() {} };
globalThis.performance = { now: () => now };
const B = await import(process.env.REPO + '/lib/barcode.ts');
const got = [];
const off = B.registerScannerTarget(c => got.push(c));
const key = (k, gap) => { now += gap; let prevented = false; handler({ key: k, target: {}, preventDefault() { prevented = true; }, stopPropagation() {} }); return prevented; };
const type = (s, gap) => { for (const ch of s) key(ch, gap); return key('Enter', gap); };
assert.equal(type('8901234567890', 8), true); assert.deepEqual(got, ['8901234567890']);
now += 1000; assert.equal(type('hello world', 140), false); assert.equal(got.length, 1, 'human typing ignored');
now += 1000; assert.equal(type('abc', 5), false, 'too short');
now += 1000; type('ABC-123', 10); assert.equal(got[1], 'ABC-123');
off(); now += 1000; type('99999999', 5); assert.equal(got.length, 2, 'unregistered grid gets nothing');
// nested: last registered wins
const a = [], b = [];
const offA = B.registerScannerTarget(c => a.push(c)); const offB = B.registerScannerTarget(c => b.push(c));
now += 1000; type('11112222', 6); assert.deepEqual([a.length, b.length], [0, 1]);
offB(); now += 1000; type('33334444', 6); assert.deepEqual([a.length, b.length], [1, 1]); offA();
console.log('ALL WEDGE TESTS PASSED');
