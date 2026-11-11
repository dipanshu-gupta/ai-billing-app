// Minimal in-memory PostgREST-like builder for tests.
const get = (r, c) => c.includes('->>') ? (r[c.split('->>')[0]] || {})[c.split('->>')[1]] : r[c];
function cond(col, op, val) {
  return (r) => {
    const v = get(r, col);
    switch (op) {
      case 'eq': return String(v) === String(val);
      case 'neq': return String(v) !== String(val);
      case 'gt': return v > val; case 'gte': return v >= val; case 'lt': return v < val; case 'lte': return v <= val;
      case 'ilike': { const re = new RegExp('^' + String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i'); return re.test(String(v ?? '')); }
      case 'is': return val === 'null' || val === null ? v == null : v === val;
      case 'in': return val.map(String).includes(String(v));
    }
    return true;
  };
}
function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; }
function parseOr(s) {
  const parts = splitTop(s).map(p => {
    if (p.startsWith('and(')) { const sub = splitTop(p.slice(4, -1)).map(x => parseOr(x)); return r => sub.every(f => f(r)); }
    const [col, op, ...rest] = p.split('.'); const val = rest.join('.');
    return cond(col, op, val);
  });
  return r => parts.some(f => f(r));
}
export function fakeSupabase(db) {
  const log = [];
  function from(table) {
    const st = { table, filters: [], order: null, range: null, limit: null, single: false, maybe: false, op: 'select', payload: null, count: false };
    const b = {
      select(_c, o) { if (o?.count) st.count = true; return b; },
      insert(rows) { st.op = 'insert'; st.payload = rows; return b; },
      update(p) { st.op = 'update'; st.payload = p; return b; },
      eq(c, v) { st.filters.push(cond(c, 'eq', v)); return b; }, neq(c, v) { st.filters.push(cond(c, 'neq', v)); return b; },
      gt(c, v) { st.filters.push(cond(c, 'gt', v)); return b; }, gte(c, v) { st.filters.push(cond(c, 'gte', v)); return b; },
      lt(c, v) { st.filters.push(cond(c, 'lt', v)); return b; }, lte(c, v) { st.filters.push(cond(c, 'lte', v)); return b; },
      ilike(c, v) { st.filters.push(cond(c, 'ilike', v)); return b; }, is(c, v) { st.filters.push(cond(c, 'is', v)); return b; },
      in(c, v) { st.filters.push(cond(c, 'in', v)); return b; },
      not(c, op, v) { const f = op === 'is' ? cond(c, 'is', v) : cond(c, 'in', String(v).slice(1, -1).split(',').map(x => x.replace(/"/g, ''))); st.filters.push(r => !f(r)); return b; },
      or(s) { st.filters.push(parseOr(s)); return b; },
      order(c, o) { if (!st.order) st.order = [c, o?.ascending]; return b; },
      range(a, z) { st.range = [a, z]; return b; }, limit(n) { st.limit = n; return b; },
      maybeSingle() { st.maybe = true; return b; }, single() { st.single = true; return b; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    function run() {
      log.push({ table, op: st.op });
      const rows = db[table] || (db[table] = []);
      if (st.op === 'insert') { const ins = st.payload.map(r => ({ id: 'id' + Math.random().toString(36).slice(2), ...r })); rows.push(...ins); return { data: st.single ? ins[0] : ins, error: null }; }
      let list = rows.filter(r => st.filters.every(f => f(r)));
      if (st.op === 'update') { list.forEach(r => Object.assign(r, st.payload)); return { data: list, error: null }; }
      const count = list.length;
      if (st.order) { const [c, asc] = st.order; list = [...list].sort((a, z) => (a[c] > z[c] ? 1 : -1) * (asc ? 1 : -1)); }
      if (st.range) list = list.slice(st.range[0], st.range[1] + 1);
      if (st.limit) list = list.slice(0, st.limit);
      if (st.maybe || st.single) return { data: list[0] || null, error: null };
      return { data: list, error: null, count };
    }
    return b;
  }
  return { from, log };
}
