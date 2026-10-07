// @ts-nocheck
'use client';
/**
 * Express Dashboard building blocks: data hook, chart / list / metric renderers and the widget editor.
 * Everything is driven by the widget config + the live field catalog (standard + custom fields),
 * so nothing here is hard-wired to a particular tenant, object or field.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, FunnelChart, Funnel, LabelList,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { distinctValues } from '@/lib/searchCatalog';
import {
  AGGS, TIME_PERIODS, CHART_TYPES, DATE_BUCKETS, FILTER_OPS, loadSourceFields, loadRows, aggregate, measureOf, rawValue, fmtCompact,
} from '@/lib/expressDashboard';

export const PALETTE = ['#7A4E9B', '#2F8F83', '#E1A93B', '#C0573B', '#4A6FA5', '#8C8478', '#B07AA1', '#5B9E6C', '#D98E73', '#6C8EAD'];

// ── data hook ───────────────────────────────────────────────────────────────────────────────────────
export function useWidgetData(w: any, { sourceMap, supabase, ctx, nonce, savedVersion }: any) {
  const [st, setSt] = useState<any>({ state: 'loading' });
  const seq = useRef(0);
  const source = sourceMap[w?.source];
  const key = JSON.stringify([w?.kind, w?.source, w?.groupBy, w?.bucket, w?.agg, w?.measureField, w?.limit, w?.sortKey, w?.sortAsc, w?.filters, w?.topN, w?.sort, nonce, w?.filters?.savedSearchId ? savedVersion : 0, ctx?.security?.ready]);
  useEffect(() => {
    if (!w) return;
    if (!source) { setSt({ state: 'nosource' }); return; }
    if (!ctx?.security?.ready) { setSt({ state: 'loading' }); return; }
    const mine = ++seq.current;
    setSt(s => ({ ...s, state: s.fields ? 'refreshing' : 'loading' }));
    (async () => {
      try {
        const fields = await loadSourceFields(supabase, source);
        let res: any;
        if (w.kind === 'table') res = await loadRows(supabase, source, fields, w, ctx, { limit: Math.max(1, Number(w.limit) || 8), sortKey: w.sortKey, sortAsc: !!w.sortAsc });
        else if (w.kind === 'metric' && (w.agg || 'count') === 'count') res = await loadRows(supabase, source, fields, w, ctx, { limit: 1 });
        else res = await loadRows(supabase, source, fields, w, ctx);
        if (mine !== seq.current) return;
        if (res.error) { setSt({ state: 'error', error: res.error.message || String(res.error), fields }); return; }
        setSt({ state: 'ready', fields, rows: res.rows, total: res.total, truncated: res.truncated });
      } catch (e: any) {
        if (mine === seq.current) setSt({ state: 'error', error: e?.message || 'Failed to load' });
      }
    })();
  }, [key, source, supabase]);
  return { ...st, source };
}

// ── formatting ──────────────────────────────────────────────────────────────────────────────────────
export function fmtCell(v: any, f: any) {
  if (v === null || v === undefined || v === '') return '—';
  if (!f) return String(v);
  if (f.type === 'number') { const n = Number(v); if (!Number.isFinite(n)) return String(v); return f.currency ? formatCurrency(n) : n.toLocaleString(undefined, { maximumFractionDigits: 2 }); }
  if (f.type === 'date') { const d = new Date(`${String(v).slice(0, 10)}T00:00:00`); return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
  if (f.type === 'datetime') { const d = new Date(v); return isNaN(d.getTime()) ? String(v) : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  if (f.type === 'boolean') return v === true || v === 'true' ? 'Yes' : 'No';
  return String(v);
}
const pillColor = (s: string) => {
  const x = String(s || '').toLowerCase();
  if (/won|paid|complete|done|convert|accept|deliver|approved|active/.test(x)) return ['#E5F1EF', '#25615B'];
  if (/lost|reject|cancel|fail|overdue|expired|high|urgent/.test(x)) return ['#F8E6E1', '#A33F28'];
  if (/pending|progress|negotiat|proposal|draft|medium|new|open/.test(x)) return ['#FBF1DC', '#8A6417'];
  return ['#EFEDEA', '#5C574F'];
};

// ── renderers ───────────────────────────────────────────────────────────────────────────────────────
function MeasureLabel({ w, fields }: any) {
  const mf = fields?.find(f => f.key === w.measureField);
  return (w.agg && w.agg !== 'count' && mf) ? `${AGGS.find(a => a.v === w.agg)?.l?.replace(' of', '')} ${mf.label}` : 'Records';
}

export function ChartView({ data, w, fields, height = 230 }: any) {
  const mf = fields?.find(f => f.key === w.measureField);
  const cur = !!(mf && mf.currency && w.agg !== 'count');
  const gf = fields?.find(f => f.key === w.groupBy);
  const isDate = gf && (gf.type === 'date' || gf.type === 'datetime');
  const fv = (n: number) => (cur ? formatCurrency(n) : Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 }));
  if (!data.length) return <div className="xd-empty">No data for this selection.</div>;
  const tick = { fontSize: 11, fill: '#6F6A62' };
  const common = { data, margin: { top: 8, right: 8, left: 0, bottom: 0 } };
  const axisX = <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: '#E3DFD9' }} interval={data.length > 8 ? 'preserveStartEnd' : 0} tickFormatter={s => (String(s).length > 12 ? String(s).slice(0, 11) + '…' : s)} />;
  const axisY = <YAxis tick={tick} tickLine={false} axisLine={false} width={46} tickFormatter={n => fmtCompact(n, cur, formatCurrency)} />;
  const grid = <CartesianGrid stroke="#EEEBE6" vertical={false} />;
  const tip = <Tooltip formatter={(v: any) => [fv(v), MeasureLabel({ w, fields })]} contentStyle={{ borderRadius: 8, border: '1px solid #E3DFD9', fontSize: 12 }} cursor={{ fill: 'rgba(122,78,155,.06)' }} />;
  const t = w.chart || 'bar';
  let chart: any;
  if (t === 'bar') chart = (
    <BarChart {...common}>{grid}{axisX}{axisY}{tip}
      <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44}>{data.map((d, i) => <Cell key={i} fill={isDate ? PALETTE[0] : PALETTE[i % PALETTE.length]} />)}</Bar>
    </BarChart>);
  else if (t === 'hbar') chart = (
    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
      <CartesianGrid stroke="#EEEBE6" horizontal={false} />
      <XAxis type="number" tick={tick} tickLine={false} axisLine={false} tickFormatter={n => fmtCompact(n, cur, formatCurrency)} />
      <YAxis type="category" dataKey="label" tick={tick} tickLine={false} axisLine={false} width={92} tickFormatter={s => (String(s).length > 14 ? String(s).slice(0, 13) + '…' : s)} />
      {tip}
      <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>{data.map((d, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Bar>
    </BarChart>);
  else if (t === 'line') chart = (
    <LineChart {...common}>{grid}{axisX}{axisY}{tip}<Line type="monotone" dataKey="value" stroke={PALETTE[0]} strokeWidth={2.4} dot={{ r: 3, fill: PALETTE[0] }} /></LineChart>);
  else if (t === 'area') chart = (
    <AreaChart {...common}>{grid}{axisX}{axisY}{tip}<Area type="monotone" dataKey="value" stroke={PALETTE[0]} strokeWidth={2.2} fill={PALETTE[0]} fillOpacity={0.14} /></AreaChart>);
  else if (t === 'pie' || t === 'donut') chart = (
    <PieChart>
      <Pie data={data} dataKey="value" nameKey="label" innerRadius={t === 'donut' ? '58%' : 0} outerRadius="86%" paddingAngle={t === 'donut' ? 2 : 0} stroke="#fff">
        {data.map((d, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
      </Pie>
      {tip}
      <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#3B3833' }} formatter={(s: any) => (String(s).length > 16 ? String(s).slice(0, 15) + '…' : s)} />
    </PieChart>);
  else chart = (
    <FunnelChart>
      <Tooltip formatter={(v: any) => [fv(v), MeasureLabel({ w, fields })]} contentStyle={{ borderRadius: 8, border: '1px solid #E3DFD9', fontSize: 12 }} />
      <Funnel dataKey="value" nameKey="label" data={[...data].sort((a, b) => b.value - a.value).map((d, i) => ({ ...d, fill: PALETTE[i % PALETTE.length] }))} isAnimationActive={false}>
        <LabelList position="right" fill="#3B3833" stroke="none" dataKey="label" style={{ fontSize: 11 }} />
      </Funnel>
    </FunnelChart>);
  return <div style={{ width: '100%', height }}><ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer></div>;
}

export function TableView({ w, d, onOpen }: any) {
  const src = d.source; const fields = d.fields || [];
  const keys = (w.columns && w.columns.length ? w.columns : [src.titleKey, src.statusKey, src.amountKey, src.dateKey]).filter(Boolean);
  const cols = keys.map(k => fields.find(f => f.key === k)).filter(Boolean);
  if (!d.rows.length) return <div className="xd-empty">Nothing to show — no matching records.</div>;
  return (
    <div>
      <div className="xd-tablewrap">
        <table className="xd-table">
          <thead><tr>{cols.map(c => <th key={c.key} className={c.type === 'number' ? 'r' : ''}>{c.label}</th>)}</tr></thead>
          <tbody>
            {d.rows.map((r, i) => (
              <tr key={r.id || i} onClick={() => onOpen && onOpen(src.key)} title="Open list">
                {cols.map((c, ci) => {
                  let v = rawValue(r, c);
                  if (c.key === 'owner' || c.key === 'owner_name') v = r.owner_name || r.owner || v;
                  const txt = fmtCell(v, c);
                  if (c.key === src.statusKey || c.key === 'stage' || c.key === 'priority' || c.key === 'payment_status') {
                    const [bg, fg] = pillColor(txt); return <td key={c.key}><span className="xd-pill" style={{ background: bg, color: fg }}>{txt}</span></td>;
                  }
                  return <td key={c.key} className={`${c.type === 'number' ? 'r' : ''} ${ci === 0 ? 'first' : ''}`}>{txt}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="xd-tfoot">
        <span>Showing {d.rows.length} of {d.total}</span>
        <button onClick={() => onOpen && onOpen(src.key)}>View all →</button>
      </div>
    </div>
  );
}

/** One widget's body (chart / list / metric) — also used for the editor's live preview. */
export function WidgetBody({ w, d, onOpen, height }: any) {
  if (d.state === 'nosource') return <div className="xd-empty">This object isn’t available (removed, or you don’t have access).</div>;
  if (d.state === 'error') return <div className="xd-empty err">Couldn’t load: {d.error}</div>;
  if (d.state === 'loading') return <div className="xd-skel" style={{ height: height || 160 }} />;
  const fields = d.fields || [];
  if (w.kind === 'table') return <TableView w={w} d={d} onOpen={onOpen} />;
  if (!w.groupBy) return <div className="xd-empty">Choose a “Group by” field to draw this chart.</div>;
  const data = aggregate(d.rows, fields, w, d.source);
  return (
    <div>
      <ChartView data={data} w={w} fields={fields} height={height || 230} />
      {d.truncated && <div className="xd-note">Based on the first {d.rows.length.toLocaleString()} of {d.total.toLocaleString()} records.</div>}
    </div>
  );
}

export function metricValue(w: any, d: any) {
  if (d.state !== 'ready') return null;
  const fields = d.fields || [];
  const mf = (w.agg && w.agg !== 'count') ? fields.find(f => f.key === w.measureField) : null;
  if (!mf) return { text: Number(d.total).toLocaleString(), sub: `${d.source.label}` };
  const val = measureOf(d.rows, w.agg, mf);
  return { text: mf.currency ? fmtCompact(val, true, formatCurrency) : fmtCompact(val), full: mf.currency ? formatCurrency(val) : String(val), sub: `${d.source.label} · ${d.total.toLocaleString()} record${d.total === 1 ? '' : 's'}` };
}

export function describeFilters(w: any, savedSearches: any[] = []) {
  const f = w.filters || {}; const bits: string[] = [];
  if (f.mine) bits.push('My records');
  if (f.mode === 'open') bits.push('Open'); if (f.mode === 'closed') bits.push('Closed');
  if (f.statuses?.length) bits.push(f.statuses.join(', '));
  if (f.period && f.period !== 'all') bits.push(TIME_PERIODS.find(p => p.v === f.period)?.l || f.period);
  if (f.savedSearchId) { const s = savedSearches.find(x => x.id === f.savedSearchId); if (s) bits.push(`“${s.name}”`); }
  if (f.conds?.length) bits.push(`${f.conds.length} condition${f.conds.length > 1 ? 's' : ''}`);
  return bits.join(' · ');
}

// ── editor ──────────────────────────────────────────────────────────────────────────────────────────
const Lbl = ({ children }: any) => <label className="xd-lbl">{children}</label>;

export function WidgetEditor({ draft, kind, sources, sourceMap, supabase, ctx, savedSearches, onSave, onCancel, onNavigate, isNew }: any) {
  const [w, setW] = useState<any>(draft);
  const [fields, setFields] = useState<any[]>([]);
  const [statusOpts, setStatusOpts] = useState<string[]>([]);
  const [nonce, setNonce] = useState(0);
  const source = sourceMap[w.source];
  const set = (patch: any) => setW(p => ({ ...p, ...patch }));
  const setF = (patch: any) => setW(p => ({ ...p, filters: { ...p.filters, ...patch } }));

  useEffect(() => { let off = false; setFields([]); if (source) loadSourceFields(supabase, source).then(f => { if (!off) setFields(f); }); return () => { off = true; }; }, [w.source]);
  useEffect(() => {
    let off = false; setStatusOpts([]);
    if (!source) return;
    const sf = fields.find(f => f.key === (w.filters?.statusField || source.statusKey));
    if (!sf) return;
    const extraEq = source.extraEq || null;
    distinctValues(supabase, { table: source.table, column: sf.column, extraEq, limit: 300 }).then(v => { if (!off) setStatusOpts(v.map(x => x.value)); });
    return () => { off = true; };
  }, [w.source, fields.length]);

  const numFields = fields.filter(f => f.type === 'number');
  const groupFields = fields.filter(f => f.type !== 'number' || f.custom || ['stage', 'status'].includes(f.key));
  const dateFields = fields.filter(f => f.type === 'date' || f.type === 'datetime');
  const gf = fields.find(f => f.key === w.groupBy);
  const saved = (savedSearches || []).filter(s => s.object_type === w.source);
  const changeSource = (key: string) => {
    const s = sourceMap[key];
    setW(p => ({ ...p, source: key, groupBy: '', measureField: '', columns: [], sortKey: '', filters: { ...p.filters, statuses: [], savedSearchId: '', conds: [], dateField: '', statusField: '' } }));
  };
  const toggleCol = (k: string) => set({ columns: (w.columns || []).includes(k) ? w.columns.filter(c => c !== k) : [...(w.columns || []), k] });
  const toggleStatus = (v: string) => setF({ statuses: (w.filters.statuses || []).includes(v) ? w.filters.statuses.filter(x => x !== v) : [...(w.filters.statuses || []), v] });
  const conds = w.filters.conds || [];
  const setCond = (i: number, patch: any) => setF({ conds: conds.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  const problem =
    !source ? 'Choose an object.' :
    kind === 'chart' && !w.groupBy ? 'Choose a “Group by” field.' :
    (w.agg && w.agg !== 'count' && !w.measureField) ? 'Choose the field to calculate.' :
    !String(w.title || '').trim() ? 'Give it a title.' : '';

  const pv = useWidgetData(problem ? null : w, { sourceMap, supabase, ctx, nonce, savedVersion: savedSearches?.length });
  const aggUsesField = (w.agg || 'count') !== 'count';

  return (
    <div className="xd-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="xd-modal">
        <div className="xd-mhead">
          <div>
            <h3>{isNew ? 'Add' : 'Edit'} {kind === 'metric' ? 'summary card' : kind === 'table' ? 'list' : 'chart'}</h3>
            <p>{kind === 'metric' ? 'A headline number. Clicking the card shows its own set of charts and lists.' : 'Configure what this shows — it reads your live data, scoped to your access.'}</p>
          </div>
          <button className="xd-x" onClick={onCancel} aria-label="Close">✕</button>
        </div>
        <div className="xd-mbody">
          <div className="xd-form">
            <Lbl>Title</Lbl>
            <input value={w.title} onChange={e => set({ title: e.target.value })} className="xd-in" />

            <Lbl>Object</Lbl>
            <select value={w.source} onChange={e => changeSource(e.target.value)} className="xd-in">
              {!sourceMap[w.source] && <option value={w.source}>{w.source} (unavailable)</option>}
              {sources.map(s => <option key={s.key} value={s.key}>{s.label}{s.isCustomObject ? ' (custom)' : ''}</option>)}
            </select>

            {kind === 'chart' && (<>
              <Lbl>Chart type</Lbl>
              <div className="xd-chips">{CHART_TYPES.map(c => <button key={c.v} className={w.chart === c.v ? 'on' : ''} onClick={() => set({ chart: c.v })}>{c.l}</button>)}</div>
              <Lbl>Group by</Lbl>
              <div className="xd-row">
                <select value={w.groupBy} onChange={e => set({ groupBy: e.target.value })} className="xd-in">
                  <option value="">Select a field…</option>
                  {['Fields', 'Custom fields'].map(g => (
                    <optgroup key={g} label={g}>{groupFields.filter(f => (g === 'Custom fields') === !!f.custom).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</optgroup>
                  ))}
                </select>
                {gf && (gf.type === 'date' || gf.type === 'datetime') && (
                  <select value={w.bucket} onChange={e => set({ bucket: e.target.value })} className="xd-in" style={{ maxWidth: 120 }}>{DATE_BUCKETS.map(b => <option key={b.v} value={b.v}>by {b.l}</option>)}</select>
                )}
              </div>
            </>)}

            {kind !== 'table' && (<>
              <Lbl>{kind === 'metric' ? 'Value' : 'Measure'}</Lbl>
              <div className="xd-row">
                <select value={w.agg || 'count'} onChange={e => set({ agg: e.target.value })} className="xd-in" style={{ maxWidth: 170 }}>{AGGS.map(a => <option key={a.v} value={a.v}>{a.l}</option>)}</select>
                {aggUsesField && (
                  <select value={w.measureField} onChange={e => set({ measureField: e.target.value })} className="xd-in">
                    <option value="">Select a number field…</option>
                    {numFields.map(f => <option key={f.key} value={f.key}>{f.label}{f.custom ? ' (custom)' : ''}</option>)}
                  </select>
                )}
              </div>
            </>)}

            {kind === 'chart' && (
              <div className="xd-row">
                <div style={{ flex: 1 }}><Lbl>Order</Lbl>
                  <select value={w.sort || ''} onChange={e => set({ sort: e.target.value })} className="xd-in">
                    <option value="">Automatic</option><option value="value_desc">Largest first</option><option value="value_asc">Smallest first</option><option value="label_asc">By label / date</option>
                  </select></div>
                <div style={{ flex: 1 }}><Lbl>Show top</Lbl>
                  <select value={w.topN || 0} onChange={e => set({ topN: Number(e.target.value) })} className="xd-in">
                    <option value={0}>All</option>{[5, 8, 10, 15].map(n => <option key={n} value={n}>Top {n} + Others</option>)}
                  </select></div>
              </div>
            )}

            {kind === 'table' && (<>
              <Lbl>Columns</Lbl>
              <div className="xd-cols">
                {fields.map(f => <label key={f.key}><input type="checkbox" checked={(w.columns || []).includes(f.key)} onChange={() => toggleCol(f.key)} /> {f.label}{f.custom ? ' ✦' : ''}</label>)}
              </div>
              <div className="xd-row">
                <div style={{ flex: 2 }}><Lbl>Sort by</Lbl>
                  <select value={w.sortKey || ''} onChange={e => set({ sortKey: e.target.value })} className="xd-in">
                    <option value="">Newest first</option>{fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select></div>
                <div style={{ flex: 1 }}><Lbl>Direction</Lbl>
                  <select value={w.sortAsc ? 'asc' : 'desc'} onChange={e => set({ sortAsc: e.target.value === 'asc' })} className="xd-in"><option value="desc">High → Low / Newest</option><option value="asc">Low → High / Oldest</option></select></div>
                <div style={{ flex: 1 }}><Lbl>Rows</Lbl>
                  <select value={w.limit || 8} onChange={e => set({ limit: Number(e.target.value) })} className="xd-in">{[5, 8, 10, 15, 25].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
              </div>
            </>)}

            <div className="xd-sec">Filters</div>
            <Lbl>Records</Lbl>
            <div className="xd-chips">
              <button className={!w.filters.mine ? 'on' : ''} onClick={() => setF({ mine: false })}>Everything I can see</button>
              <button className={w.filters.mine ? 'on' : ''} onClick={() => setF({ mine: true })}>Only my records</button>
            </div>
            <Lbl>Status</Lbl>
            <div className="xd-chips">
              {[['all', 'Any'], ['open', 'Open only'], ['closed', 'Finished only']].map(([v, l]) => <button key={v} className={(w.filters.mode || 'all') === v && !(w.filters.statuses || []).length ? 'on' : ''} onClick={() => setF({ mode: v, statuses: [] })}>{l}</button>)}
            </div>
            {statusOpts.length > 0 && (
              <div className="xd-chips sm">{statusOpts.map(s => <button key={s} className={(w.filters.statuses || []).includes(s) ? 'on' : ''} onClick={() => setF({ statuses: (w.filters.statuses || []).includes(s) ? w.filters.statuses.filter(x => x !== s) : [...(w.filters.statuses || []), s], mode: 'all' })}>{s}</button>)}</div>
            )}
            <div className="xd-row">
              <div style={{ flex: 1 }}><Lbl>Time period</Lbl>
                <select value={w.filters.period || 'all'} onChange={e => setF({ period: e.target.value })} className="xd-in">{TIME_PERIODS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}</select></div>
              {(w.filters.period || 'all') !== 'all' && (
                <div style={{ flex: 1 }}><Lbl>…applied to</Lbl>
                  <select value={w.filters.dateField || source?.dateKey || ''} onChange={e => setF({ dateField: e.target.value })} className="xd-in">{dateFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select></div>
              )}
            </div>
            {saved.length > 0 && (<>
              <Lbl>Start from a saved search</Lbl>
              <select value={w.filters.savedSearchId || ''} onChange={e => setF({ savedSearchId: e.target.value })} className="xd-in">
                <option value="">None</option>{saved.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </>)}
            <Lbl>More conditions</Lbl>
            {conds.map((c, i) => {
              const cf = fields.find(f => f.key === c.field);
              const ops = FILTER_OPS[cf?.type || 'text'] || FILTER_OPS.text;
              const needsVal = !['is_empty', 'is_not_empty', 'is_true', 'is_false'].includes(c.op);
              return (
                <div className="xd-row" key={i}>
                  <select value={c.field} onChange={e => setCond(i, { field: e.target.value, op: (FILTER_OPS[fields.find(f => f.key === e.target.value)?.type || 'text'] || FILTER_OPS.text)[0][0], value: '' })} className="xd-in"><option value="">Field…</option>{fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
                  <select value={c.op} onChange={e => setCond(i, { op: e.target.value })} className="xd-in" style={{ maxWidth: 120 }}>{ops.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  {needsVal && <input value={c.value ?? ''} type={cf?.type === 'number' ? 'number' : cf?.type === 'date' ? 'date' : 'text'} onChange={e => setCond(i, { value: e.target.value })} className="xd-in" />}
                  <button className="xd-x" onClick={() => setF({ conds: conds.filter((_, j) => j !== i) })} aria-label="Remove">✕</button>
                </div>
              );
            })}
            <button className="xd-link" onClick={() => setF({ conds: [...conds, { field: '', op: 'equals', value: '' }] })}>＋ Add condition</button>

            {kind !== 'metric' && (<>
              <Lbl>Width</Lbl>
              <div className="xd-chips">{[[1, 'Narrow'], [2, 'Wide'], [3, 'Full width']].map(([n, l]) => <button key={n} className={Number(w.span) === n ? 'on' : ''} onClick={() => set({ span: n })}>{l}</button>)}</div>
            </>)}
          </div>

          <div className="xd-preview">
            <div className="xd-phead"><span>Preview</span><button className="xd-link" onClick={() => setNonce(n => n + 1)}>↻ Refresh</button></div>
            <div className="xd-pcard">
              {problem ? <div className="xd-empty">{problem}</div> : kind === 'metric'
                ? (() => { const m = metricValue(w, pv); return pv.state === 'ready' && m ? (<div><div className="xd-mt">{w.title}</div><div className="xd-mv">{m.text}</div><div className="xd-ms">{m.sub}</div></div>) : <WidgetBody w={w} d={pv} />; })()
                : (<><div className="xd-wtitle">{w.title}</div><WidgetBody w={w} d={pv} onOpen={() => {}} height={210} /></>)}
            </div>
          </div>
        </div>
        <div className="xd-mfoot">
          {problem && <span className="xd-prob">{problem}</span>}
          <button className="xd-btn" onClick={onCancel}>Cancel</button>
          <button className="xd-btn primary" disabled={!!problem} onClick={() => onSave({ ...w, title: w.title.trim() })}>{isNew ? 'Add' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
