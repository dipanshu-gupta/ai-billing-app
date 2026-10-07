// @ts-nocheck
'use client';

/**
 * RedwoodSavedSearchBar — Oracle-Fusion-Redwood-style saved search strip for every list page.
 *
 * Modelled on Redwood's list pattern: a saved-search switcher (tabs + "More"), removable filter
 * chips with inline editing, "+ Add filter" (field picker), a "modified" indicator, and
 * Save / Save As / Reset / Manage actions. A saved search stores the WHOLE view: search text,
 * status, period, owner, advanced filters, sort and visible columns (+ order).
 *
 * Multi-tenant: saved_searches rows are tenant-scoped through AppContext (tenant_id on insert,
 * fetchSavedSearches filters by tenant); this component only talks to those context functions.
 *
 * Props
 *   page            object key used as saved_searches.object_type
 *   filters         the page's current filter object { search,status,timePeriod,advFilters,owner,sortField,sortDir,columns? }
 *   onApply(patch)  apply a (partial) filter object to the page
 *   fields          catalog [{key,label,type,opts?,group?,column?,scope?,line?}] — standard, custom and line-item fields
 *   owners          [{value,label}] owner choices;  statusOptions: string[]
 *   valuesOf(f,q)   async -> [{value,label}] suggestions for the value picker (distinct values / lookups)
 *   optionsOf(meta) optional -> string[] choices for 'select' fields
 *   labelOf(key)    optional label resolver
 *   onClear()       optional clear-all
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useAlert } from '@/components/shared/AlertProvider';

const OPS = {
  text:    [{v:'contains',l:'contains'},{v:'equals',l:'is exactly'},{v:'not_equals',l:'is not'},{v:'is_empty',l:'is empty'},{v:'is_not_empty',l:'is not empty'}],
  number:  [{v:'eq',l:'='},{v:'neq',l:'≠'},{v:'gt',l:'>'},{v:'gte',l:'≥'},{v:'lt',l:'<'},{v:'lte',l:'≤'},{v:'is_empty',l:'is empty'}],
  date:    [{v:'on',l:'on'},{v:'before',l:'before'},{v:'after',l:'after'},{v:'is_empty',l:'is empty'}],
  select:  [{v:'equals',l:'is'},{v:'not_equals',l:'is not'}],
  boolean: [{v:'is_true',l:'is true'},{v:'is_false',l:'is false'}],
};
const NO_VALUE = ['is_empty', 'is_not_empty', 'is_true', 'is_false'];
const PERIODS = {
  today: 'Today', yesterday: 'Yesterday', last_7: 'Last 7 days', last_30: 'Last 30 days', last_90: 'Last 90 days',
  this_month: 'This month', last_month: 'Last month', this_year: 'This year',
};
const opLabel = (op) => { for (const l of Object.values(OPS)) { const f = l.find(o => o.v === op); if (f) return f.l; } return op; };

const norm = (f, withCols) => JSON.stringify({
  search: f?.search || '', status: f?.status || 'All', timePeriod: f?.timePeriod || '',
  advFilters: (f?.advFilters || []).filter(c => c.field).map(c => [c.scope || '', c.field, c.op, c.value ?? '']),
  owner: f?.owner || '', sortField: f?.sortField || '', sortDir: f?.sortField ? (f?.sortDir || 'asc') : 'asc',
  ...(withCols ? { columns: f?.columns || [] } : {}),
});
const sameView = (saved, cur) => {
  const withCols = !!saved?.columns?.length && !!cur?.columns?.length;
  return norm(saved, withCols) === norm(cur, withCols);
};

const CSS = String.raw`
.rsb { --a: var(--rw-accent, #7A4E9B); --as: var(--rw-accent-soft, #F1EAF6); --ink: var(--rw-ink, #1B1A18); --mu: var(--rw-muted, #6F6A62); --bd: var(--rw-border, #E3DFD9); --tl: var(--rw-teal, #2F8F83);
  position: relative; background: #fff; border: 1px solid var(--bd); border-radius: 14px; padding: 0 14px 10px; margin-bottom: 4px; color: var(--ink); font-size: 13px; }
.rsb * { box-sizing: border-box; }
.rsb-tabs { display: flex; align-items: flex-end; gap: 2px; border-bottom: 1px solid var(--bd); margin: 0 -14px 10px; padding: 0 14px; flex-wrap: wrap; }
.rsb-tab { position: relative; background: none; border: 0; padding: 11px 12px 10px; font-size: 13px; font-weight: 600; color: var(--mu); cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; border-bottom: 3px solid transparent; margin-bottom: -1px; }
.rsb-tab:hover { color: var(--ink); }
.rsb-tab.on { color: var(--ink); border-bottom-color: var(--a); }
.rsb-star { color: #E1A93B; font-size: 12px; }
.rsb-team { font-size: 10px; background: var(--as); color: var(--a); border-radius: 99px; padding: 1px 6px; font-weight: 700; }
.rsb-mod { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #B4690E; background: #FDF1DC; border-radius: 99px; padding: 1px 8px; }
.rsb-sp { flex: 1; }
.rsb-act { background: none; border: 0; padding: 9px 10px; font-size: 12.5px; font-weight: 600; color: var(--a); cursor: pointer; border-radius: 8px; }
.rsb-act:hover { background: var(--as); }
.rsb-act[disabled] { color: #B9B4AB; cursor: default; background: none; }
.rsb-act.solid { background: var(--ink); color: #fff; padding: 6px 14px; margin: 4px 0 4px 4px; border-radius: 99px; }
.rsb-act.solid:hover { background: #000; }
.rsb-box { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; border: 1px solid #CFC9BF; border-radius: 12px; padding: 6px 10px; background: #fff; min-height: 44px; cursor: text; }
.rsb-box:focus-within { border-color: var(--a); box-shadow: 0 0 0 3px #E7DAF2; }
.rsb-box > svg { color: var(--mu); flex: none; }
.rsb-in { flex: 1; min-width: 160px; border: 0 !important; outline: 0 !important; box-shadow: none !important; background: transparent; font-size: 14px; padding: 6px 4px; color: var(--ink); }
.rsb-dd { position: absolute; z-index: 70; left: 0; right: 0; top: calc(100% + 6px); background: #fff; border: 1px solid var(--bd); border-radius: 12px; box-shadow: 0 16px 40px rgba(27,26,24,.18); max-height: 420px; overflow-y: auto; padding: 6px; }
.rsb-gh { font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--mu); font-weight: 700; padding: 8px 10px 4px; }
.rsb-it { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; background: none; border: 0; padding: 8px 10px; border-radius: 8px; font-size: 13.5px; color: var(--ink); cursor: pointer; }
.rsb-it:hover, .rsb-it.hot { background: var(--as); }
.rsb-it small { color: var(--mu); margin-left: auto; font-size: 11.5px; }
.rsb-ai { background: linear-gradient(90deg, #F6EFFB, #EAF6F4); border: 1px solid #DCCBE8; }
.rsb-vh { display: flex; align-items: center; gap: 8px; padding: 6px 8px 8px; border-bottom: 1px solid var(--bd); margin-bottom: 6px; font-weight: 700; }
.rsb-vh button { background: none; border: 0; cursor: pointer; color: var(--mu); font-size: 16px; }
.rsb-row2 { display: flex; gap: 6px; padding: 0 6px 6px; }
.rsb-row2 select, .rsb-row2 input { border: 1px solid #D6D1C9; border-radius: 8px; padding: 7px 9px; font-size: 13px; background: #fff; color: var(--ink); }
.rsb-row2 input { flex: 1; min-width: 0; }
.rsb-chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; min-height: 30px; }
.rsb-chip { position: relative; display: inline-flex; align-items: center; background: var(--as); border: 1px solid #DCCBE8; color: var(--ink); border-radius: 99px; font-size: 12.5px; }
.rsb-chip > button.main { background: none; border: 0; padding: 5px 4px 5px 12px; cursor: pointer; color: inherit; font: inherit; }
.rsb-chip > button.x { background: none; border: 0; padding: 5px 10px 5px 4px; cursor: pointer; color: var(--mu); font-size: 14px; line-height: 1; }
.rsb-chip > button.x:hover { color: #B3261E; }
.rsb-chip b { font-weight: 700; }
.rsb-chip.plain > button.main { cursor: default; }
.rsb-add { background: #fff; border: 1px dashed #BDB5C9; color: var(--a); border-radius: 99px; padding: 5px 12px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.rsb-add:hover { background: var(--as); }
.rsb-clear { background: none; border: 0; color: var(--mu); font-size: 12.5px; cursor: pointer; text-decoration: underline; margin-left: 4px; }
.rsb-empty { color: var(--mu); font-size: 12.5px; }
.rsb-pop { position: absolute; z-index: 60; top: calc(100% + 6px); left: 0; min-width: 270px; max-width: 340px; background: #fff; border: 1px solid var(--bd); border-radius: 12px; box-shadow: 0 12px 32px rgba(27,26,24,.16); padding: 12px; }
.rsb-pop.right { left: auto; right: 0; }
.rsb-pop h4 { margin: 0 0 8px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--mu); font-weight: 700; }
.rsb-pop select, .rsb-pop input[type=text], .rsb-pop input[type=number], .rsb-pop input[type=date], .rsb-field { width: 100%; border: 1px solid #D6D1C9; border-radius: 8px; padding: 7px 9px; font-size: 13px; color: var(--ink); background: #fff; margin-bottom: 8px; }
.rsb-pop select:focus, .rsb-pop input:focus, .rsb-field:focus { outline: 2px solid #D9C6E8; border-color: var(--a); }
.rsb-pl { max-height: 260px; overflow-y: auto; }
.rsb-pi { display: block; width: 100%; text-align: left; background: none; border: 0; padding: 7px 8px; border-radius: 8px; font-size: 13px; color: var(--ink); cursor: pointer; }
.rsb-pi:hover { background: var(--as); }
.rsb-btn { border: 0; border-radius: 99px; padding: 7px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
.rsb-btn.p { background: var(--ink); color: #fff; }
.rsb-btn.s { background: #F1EEE9; color: var(--ink); }
.rsb-btn[disabled] { opacity: .45; cursor: default; }
.rsb-veil { position: fixed; inset: 0; background: rgba(27,26,24,.45); z-index: 9000; display: flex; align-items: center; justify-content: center; padding: 16px; }
.rsb-dlg { background: #fff; border-radius: 16px; width: 100%; max-width: 640px; max-height: 86vh; display: flex; flex-direction: column; box-shadow: 0 24px 60px rgba(0,0,0,.3); overflow: hidden; color: var(--ink); }
.rsb-dlg > header { padding: 18px 22px 14px; border-bottom: 1px solid var(--bd); position: relative; }
.rsb-dlg > header h3 { margin: 0; font-family: var(--rw-serif, Georgia, serif); font-weight: 400; font-size: 22px; }
.rsb-dlg > header::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 4px; background: linear-gradient(90deg, #7A4E9B 0 38%, #2F8F83 38% 62%, #E1A93B 62% 78%, #C9BFD6 78% 100%); }
.rsb-dlg > .bd { padding: 16px 22px; overflow-y: auto; }
.rsb-dlg > footer { padding: 12px 22px; border-top: 1px solid var(--bd); display: flex; gap: 8px; justify-content: flex-end; background: #FAF9F7; }
.rsb-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; padding: 10px 0; border-bottom: 1px solid #EEEBE6; }
.rsb-row small { display: block; color: var(--mu); font-size: 11.5px; margin-top: 2px; }
.rsb-mini { background: #F1EEE9; border: 0; border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--ink); margin-left: 4px; }
.rsb-mini:hover { background: var(--as); color: var(--a); }
.rsb-mini.del:hover { background: #FBE4E2; color: #B3261E; }
.rsb-mini.on { background: var(--as); color: var(--a); }
.rsb-lbl { display: flex; align-items: center; gap: 8px; font-size: 13px; margin: 6px 0; cursor: pointer; }
`;

export default function RedwoodSavedSearchBar({ page, filters, onApply, fields = [], optionsOf = null, labelOf = null, onClear = null, owners = null, statusOptions = null, valuesOf = null, placeholder = 'Search or add a filter…' }) {
  const { currentUser, savedSearches, fetchSavedSearches, createSavedSearch, updateSavedSearch, deleteSavedSearch, setDefaultSavedSearch } = useApp();
  const { showAlert, showConfirm } = useAlert();

  const [activeId, setActiveId] = useState(null);
  const [menu, setMenu] = useState(null);          // 'more' | 'add' | {chip:idx} | null
  const [dlg, setDlg] = useState(null);            // 'saveas' | 'manage' | null
  const [name, setName] = useState('');
  const [asDef, setAsDef] = useState(false);
  const [asTeam, setAsTeam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const wrap = useRef(null);

  useEffect(() => { fetchSavedSearches && fetchSavedSearches(page); }, [page]);
  useEffect(() => {
    try { setActiveId(sessionStorage.getItem('rsb_active_' + page) || null); } catch { setActiveId(null); }
    setMenu(null); setDlg(null);
  }, [page]);
  const remember = (id) => { setActiveId(id); try { id ? sessionStorage.setItem('rsb_active_' + page, id) : sessionStorage.removeItem('rsb_active_' + page); } catch {} };

  useEffect(() => {
    const h = (e) => { if (wrap.current && !wrap.current.contains(e.target)) { setMenu(null); setDdOpen(false); setStage(null); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const mine = (currentUser?.email || '');
  const all = useMemo(() => (savedSearches || []).filter(s => s.object_type === page), [savedSearches, page]);
  const visible = useMemo(() => all.filter(s => s.created_by === mine || s.is_global_default), [all, mine]);
  const lab = (k) => (labelOf ? labelOf(k) : (fields.find(f => f.key === k)?.label || k));

  // Active search: explicit pick, else any saved search the view happens to equal.
  const explicit = visible.find(s => s.id === activeId) || null;
  const matched = explicit || visible.find(s => sameView(s.filters, filters)) || null;
  const active = matched;
  const modified = !!active && !sameView(active.filters, filters);
  const ownsActive = !!active && active.created_by === mine;

  // ── Smart search box state ──────────────────────────────────────────────
  const [ddOpen, setDdOpen] = useState(false);
  const [text, setText] = useState('');
  const [stage, setStage] = useState<any>(null);    // { f, editIdx? } while picking a value
  const [op, setOp] = useState('contains');
  const [val, setVal] = useState('');
  const [valLabel, setValLabel] = useState('');
  const [opts, setOpts] = useState<any[]>([]);
  const [hot, setHot] = useState(0);
  const inRef = useRef<any>(null);

  const specials = useMemo(() => {
    const a: any[] = [];
    if (statusOptions?.length) a.push({ key: '__status', label: 'Status', type: 'select', group: 'Quick filters' });
    if (owners?.length) a.push({ key: '__owner', label: 'Owner', type: 'owner', group: 'Quick filters' });
    a.push({ key: '__period', label: 'Created (quick range)', type: 'period', group: 'Quick filters' });
    return a;
  }, [statusOptions, owners]);
  const catalog = useMemo(() => [
    ...specials,
    ...fields.filter(f => f.key !== 'id' && !((f.key === 'status') && statusOptions?.length) && !((f.key === 'owner' || f.key === 'owner_name') && owners?.length)).map(f => ({ ...f, group: f.group || 'Fields' })),
  ], [specials, fields, statusOptions, owners]);

  const ownerLabel = (v) => owners?.find(o => o.value === v)?.label || v;
  const crit: any[] = [];
  if (filters?.search) crit.push({ kind: 'search', text: <><b>Keyword</b>: “{filters.search}”</> });
  if (filters?.status && filters.status !== 'All') crit.push({ kind: 'status', key: '__status', text: <><b>Status</b>: {filters.status}</> });
  if (filters?.timePeriod) crit.push({ kind: 'timePeriod', key: '__period', text: <><b>Created</b>: {PERIODS[filters.timePeriod] || filters.timePeriod}</> });
  if (filters?.owner) crit.push({ kind: 'owner', key: '__owner', text: <><b>Owner</b>: {ownerLabel(filters.owner)}</> });
  (filters?.advFilters || []).forEach((c, i) => {
    if (!c.field) return;
    const done = NO_VALUE.includes(c.op) || (c.value !== undefined && c.value !== '');
    const name = (c.scope === 'line' ? 'Line › ' : '') + (c.label || lab(c.field));
    crit.push({ kind: 'adv', idx: i, c, key: c.field, incomplete: !done, text: <><b>{name}</b> {opLabel(c.op)}{NO_VALUE.includes(c.op) ? '' : <> {done ? (c.display ?? c.value) : '…'}</>}</> });
  });
  const removeCrit = (x) => {
    if (x.kind === 'search') onApply({ search: '' });
    else if (x.kind === 'status') onApply({ status: 'All' });
    else if (x.kind === 'timePeriod') onApply({ timePeriod: '' });
    else if (x.kind === 'owner') onApply({ owner: '' });
    else if (x.kind === 'adv') onApply({ advFilters: (filters.advFilters || []).filter((_, i) => i !== x.idx) });
    setMenu(null);
  };

  const pick = (s) => { onApply(s.filters || {}); remember(s.id); setMenu(null); };
  const pickAll = () => { if (onClear) onClear(); else onApply({ search: '', status: 'All', timePeriod: '', advFilters: [], owner: '' }); remember(null); setMenu(null); };

  const save = async () => {
    if (!active || !ownsActive) { setDlg('saveas'); return; }
    await updateSavedSearch(active.id, { filters });
  };
  const doSaveAs = async () => {
    if (!name.trim()) { showAlert('Enter a name for the saved search.', { variant: 'warning' }); return; }
    setBusy(true);
    const r = await createSavedSearch({ name: name.trim(), object_type: page, filters, is_default: asDef || asTeam, is_global_default: asTeam });
    setBusy(false);
    if (r) { remember(r.id); setName(''); setAsDef(false); setAsTeam(false); setDlg(null); }
  };
  const resetToActive = () => { if (active) onApply(active.filters || {}); };

  const TABS = 5;
  const tabs = visible.slice(0, TABS);
  const more = visible.slice(TABS);
  const activeInMore = active && more.some(s => s.id === active.id);

  const defaultOp = (f) => f.type === 'number' ? 'eq' : f.type === 'date' ? 'on' : (f.type === 'select' || f.type === 'owner' || f.lookup) ? 'equals' : 'contains';
  const closeAll = () => { setDdOpen(false); setStage(null); setText(''); setVal(''); setValLabel(''); setHot(0); };
  const openField = (f, editIdx = null, cond = null) => {
    setStage({ f, editIdx });
    setOp(cond?.op || defaultOp(f)); setVal(cond?.value ?? ''); setValLabel(cond?.display ?? ''); setText(''); setHot(0); setDdOpen(true);
    setTimeout(() => inRef.current && inRef.current.focus(), 0);
  };
  const commit = (f, o, value, display = undefined) => {
    if (f.key === '__status') onApply({ status: value });
    else if (f.key === '__owner') onApply({ owner: value });
    else if (f.key === '__period') onApply({ timePeriod: value });
    else {
      const cond = { field: f.key, type: f.type === 'owner' ? 'select' : f.type, op: o, value, display: display ?? value, label: f.label, column: f.column, scope: f.scope, line: f.line };
      const list = [...(filters.advFilters || [])];
      if (stage?.editIdx !== null && stage?.editIdx !== undefined) list[stage.editIdx] = cond; else list.push(cond);
      onApply({ advFilters: list });
    }
    closeAll();
  };

  // Suggestions for the value picker: fixed lists, owners, or distinct values from the data.
  const stageF = stage?.f;
  useEffect(() => {
    if (!stageF) { setOpts([]); return; }
    const q = String(val || '').toLowerCase();
    const filt = (arr) => arr.filter(o => !q || String(o.label).toLowerCase().includes(q));
    if (stageF.type === 'period') { setOpts(Object.entries(PERIODS).map(([v, l]) => ({ value: v, label: l }))); return; }
    if (stageF.type === 'owner') { setOpts(filt(owners || [])); return; }
    if (stageF.key === '__status') { setOpts(filt((statusOptions || []).map(v => ({ value: v, label: v })))); return; }
    const staticOpts = (optionsOf ? optionsOf(stageF) : (stageF.opts || stageF.options || [])) || [];
    if (stageF.type === 'select' && staticOpts.length) { setOpts(filt(staticOpts.map(v => ({ value: v, label: v })))); return; }
    if (stageF.type === 'boolean') { setOpts([]); return; }
    if ((stageF.type === 'text' || stageF.type === 'select' || stageF.lookup) && valuesOf) {
      let dead = false;
      const t = setTimeout(() => { valuesOf(stageF, val || '').then(r => { if (!dead) setOpts(r || []); }).catch(() => { if (!dead) setOpts([]); }); }, 180);
      return () => { dead = true; clearTimeout(t); };
    }
    setOpts([]);
  }, [stageF, val, owners, statusOptions]);

  // Lightweight natural-language reading of what was typed ("active customers created last 30 days").
  const interpret = (raw) => {
    const t = ' ' + raw.toLowerCase() + ' ';
    const patch: any = {}; const labels: string[] = []; const conds: any[] = [];
    const per: [RegExp, string][] = [[/\btoday\b/, 'today'], [/\byesterday\b/, 'yesterday'], [/\b(last|past) (7|seven) days\b|\bthis week\b/, 'last_7'], [/\b(last|past) 30 days\b/, 'last_30'], [/\b(last|past) 90 days\b/, 'last_90'], [/\bthis month\b/, 'this_month'], [/\blast month\b/, 'last_month'], [/\bthis year\b/, 'this_year']];
    for (const [re, v] of per) if (re.test(t)) { patch.timePeriod = v; labels.push(`Created: ${PERIODS[v]}`); break; }
    const st = (statusOptions || []).find(o => new RegExp('\\b' + String(o).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(t));
    if (st) { patch.status = st; labels.push(`Status: ${st}`); }
    if (/\b(my|mine)\b/.test(t) && currentUser?.email && owners?.some(o => o.value === currentUser.email)) { patch.owner = currentUser.email; labels.push('Owner: me'); }
    else { const ow = (owners || []).find(o => o.label && o.label.length > 2 && t.includes(' ' + String(o.label).toLowerCase())); if (ow) { patch.owner = ow.value; labels.push(`Owner: ${ow.label}`); } }
    for (const f of catalog) {
      if (f.key.startsWith('__') || !f.label || f.label.length < 3) continue;
      const i = t.indexOf(' ' + f.label.toLowerCase() + ' ');
      if (i < 0) continue;
      const rest = t.slice(i + f.label.length + 2).trim();
      const m = rest.match(/^(>=|<=|>|<|=|is not|is|contains|equals|over|under|above|below)?\s*([\w@.\-]+)/);
      if (!m || !m[2]) continue;
      const map: any = { '>=': 'gte', '<=': 'lte', '>': 'gt', '<': 'lt', '=': 'eq', over: 'gt', above: 'gt', under: 'lt', below: 'lt', 'is not': 'not_equals', is: 'equals', equals: 'equals', contains: 'contains' };
      let o = m[1] ? map[m[1]] : defaultOp(f);
      if (f.type === 'number' && (o === 'equals' || o === 'contains')) o = 'eq';
      if (f.type === 'number' && Number.isNaN(Number(m[2]))) continue;
      conds.push({ field: f.key, type: f.type, op: o, value: m[2], display: m[2], label: f.label, column: f.column, scope: f.scope, line: f.line });
      labels.push(`${f.scope === 'line' ? 'Line › ' : ''}${f.label} ${opLabel(o)} ${m[2]}`);
    }
    return { patch, conds, labels };
  };
  const applyInterp = (ix) => { onApply({ ...ix.patch, ...(ix.conds.length ? { advFilters: [...(filters.advFilters || []), ...ix.conds] } : {}) }); closeAll(); };

  // Rows of the dropdown (stage === null)
  const q = text.trim().toLowerCase();
  const ix = q ? interpret(text) : null;
  const rows: any[] = [];
  if (ix && ix.labels.length) rows.push({ kind: 'ai', ix });
  if (q) rows.push({ kind: 'kw' });
  catalog.filter(f => !q || f.label.toLowerCase().includes(q) || (f.group || '').toLowerCase().includes(q)).forEach(f => rows.push({ kind: 'field', f }));
  const select = (r) => {
    if (!r) return;
    if (r.kind === 'ai') applyInterp(r.ix);
    else if (r.kind === 'kw') { onApply({ search: text.trim() }); closeAll(); }
    else if (r.kind === 'field') openField(r.f);
  };

  // Rows of the value picker
  const opList = stageF ? (stageF.type === 'select' || stageF.type === 'owner' || stageF.lookup ? OPS.select : (OPS[stageF.type] || OPS.text)) : [];
  const applyTyped = () => {
    if (!stageF) return;
    if (NO_VALUE.includes(op)) { commit(stageF, op, ''); return; }
    if (val === '' || val === undefined) return;
    commit(stageF, op, val);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { closeAll(); return; }
    if (stage) { if (e.key === 'Enter') { e.preventDefault(); if (opts[hot] && !['number', 'date'].includes(stageF.type)) pickOpt(opts[hot]); else applyTyped(); } else if (e.key === 'ArrowDown') { e.preventDefault(); setHot(h => Math.min(h + 1, Math.max(0, opts.length - 1))); } else if (e.key === 'ArrowUp') { e.preventDefault(); setHot(h => Math.max(0, h - 1)); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setDdOpen(true); setHot(h => Math.min(h + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHot(h => Math.max(0, h - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); select(rows[hot] || rows[0]); }
    else if (e.key === 'Backspace' && !text && crit.length) removeCrit(crit[crit.length - 1]);
  };
  const pickOpt = (o) => {
    if (!stageF) return;
    if (stageF.type === 'period' || stageF.type === 'owner' || stageF.key === '__status') { commit(stageF, 'equals', o.value, o.label); return; }
    commit(stageF, (stageF.type === 'text' ? 'equals' : (op === 'not_equals' ? 'not_equals' : 'equals')), o.value, o.label);
  };

  return (
    <div className="rsb" ref={wrap}>
      <style>{CSS}</style>

      <div className="rsb-tabs" role="tablist" aria-label="Saved searches">
        <button className={'rsb-tab' + (!active && crit.length === 0 ? ' on' : '')} onClick={pickAll} role="tab">All records</button>
        {tabs.map(s => (
          <button key={s.id} role="tab" className={'rsb-tab' + (active?.id === s.id ? ' on' : '')} onClick={() => pick(s)} title={s.name}>
            {(s.is_default || s.is_global_default) && <span className="rsb-star" title="Default">★</span>}
            {s.name}
            {s.is_global_default && s.created_by !== mine && <span className="rsb-team">Team</span>}
            {active?.id === s.id && modified && <span className="rsb-mod" title="You changed filters, columns or sort after applying this search">● Modified</span>}
          </button>
        ))}
        {more.length > 0 && (
          <span style={{ position: 'relative' }}>
            <button className={'rsb-tab' + (activeInMore ? ' on' : '')} onClick={() => setMenu(menu === 'more' ? null : 'more')}>
              {activeInMore ? active.name : 'More'} ▾{activeInMore && modified && <span className="rsb-mod">● Modified</span>}
            </button>
            {menu === 'more' && (
              <div className="rsb-pop"><h4>More saved searches</h4><div className="rsb-pl">
                {more.map(s => <button key={s.id} className="rsb-pi" onClick={() => pick(s)}>{(s.is_default || s.is_global_default) ? '★ ' : ''}{s.name}</button>)}
              </div></div>
            )}
          </span>
        )}
        <span className="rsb-sp" />
        {modified && <button className="rsb-act" onClick={resetToActive} title="Discard changes and go back to the saved search">Reset</button>}
        {modified && ownsActive && <button className="rsb-act" onClick={save}>Save</button>}
        <button className="rsb-act" onClick={() => { setName(''); setDlg('saveas'); }}>Save as…</button>
        <button className="rsb-act" onClick={() => setDlg('manage')}>Manage</button>
      </div>

      <div style={{ position: 'relative' }}>
        <div className="rsb-box" onClick={() => { setDdOpen(true); inRef.current && inRef.current.focus(); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          {crit.map((x, i) => (
            <span key={i} className="rsb-chip" style={x.incomplete ? { borderStyle: 'dashed' } : null}>
              <button className="main" onClick={(e) => { e.stopPropagation(); if (x.kind === 'adv') { const f = catalog.find(c => c.key === x.c.field && (c.scope || '') === (x.c.scope || '')) || { key: x.c.field, label: x.c.label || x.c.field, type: x.c.type || 'text', column: x.c.column, scope: x.c.scope, line: x.c.line }; openField(f, x.idx, x.c); } else if (x.key) openField(catalog.find(c => c.key === x.key) || specials[0]); }}>{x.text}</button>
              <button className="x" onClick={(e) => { e.stopPropagation(); removeCrit(x); }} aria-label="Remove filter">×</button>
            </span>
          ))}
          <input ref={inRef} className="rsb-in" value={stage ? '' : text} disabled={!!stage}
            onChange={e => { setText(e.target.value); setHot(0); setDdOpen(true); }}
            onFocus={() => setDdOpen(true)} onKeyDown={onKey}
            placeholder={crit.length ? 'Add another filter or keyword…' : placeholder} />
          {crit.length > 0 && <button className="rsb-clear" onClick={(e) => { e.stopPropagation(); pickAll(); }}>Clear all</button>}
        </div>

        {ddOpen && !stage && (
          <div className="rsb-dd">
            {rows.length === 0 && <div className="rsb-empty" style={{ padding: 12 }}>Nothing matches “{text}”.</div>}
            {rows.map((r, i) => {
              const prev = rows[i - 1];
              const head = r.kind === 'field' && (!prev || prev.kind !== 'field' || prev.f.group !== r.f.group) ? r.f.group : null;
              return (
                <div key={i}>
                  {head && <div className="rsb-gh">{head === 'Line items' ? 'Line item fields (has a line where…)' : head}</div>}
                  {r.kind === 'ai' && <button className={'rsb-it rsb-ai' + (hot === i ? ' hot' : '')} onClick={() => select(r)} onMouseEnter={() => setHot(i)}>✨ <span>Understood: <b>{r.ix.labels.join(' · ')}</b></span><small>Enter</small></button>}
                  {r.kind === 'kw' && <button className={'rsb-it' + (hot === i ? ' hot' : '')} onClick={() => select(r)} onMouseEnter={() => setHot(i)}>🔎 <span>Search all fields for “<b>{text.trim()}</b>”</span>{!(ix && ix.labels.length) && <small>Enter</small>}</button>}
                  {r.kind === 'field' && <button className={'rsb-it' + (hot === i ? ' hot' : '')} onClick={() => select(r)} onMouseEnter={() => setHot(i)}>{r.f.label}<small>{r.f.scope === 'line' ? 'line' : r.f.type === 'period' ? 'range' : r.f.type}</small></button>}
                </div>
              );
            })}
          </div>
        )}

        {ddOpen && stage && stageF && (
          <div className="rsb-dd">
            <div className="rsb-vh"><button onClick={() => { setStage(null); setVal(''); setTimeout(() => inRef.current && inRef.current.focus(), 0); }} aria-label="Back">←</button>{stageF.scope === 'line' ? 'Line › ' : ''}{stageF.label}<span style={{ flex: 1 }} /><button onClick={closeAll} aria-label="Close">✕</button></div>
            {stageF.type !== 'period' && stageF.type !== 'boolean' && (
              <div className="rsb-row2">
                {stageF.type !== 'owner' && stageF.key !== '__status' && (
                  <select value={op} onChange={e => setOp(e.target.value)}>{opList.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
                )}
                {!NO_VALUE.includes(op) && (
                  <input autoFocus type={stageF.type === 'date' ? 'date' : stageF.type === 'number' ? 'number' : 'text'} value={val} onChange={e => { setVal(e.target.value); setHot(0); }} onKeyDown={onKey}
                    placeholder={['number', 'date'].includes(stageF.type) ? 'Value' : 'Type to search values…'} />
                )}
                {(NO_VALUE.includes(op) || ['number', 'date'].includes(stageF.type) || (stageF.type === 'text' && val)) && (
                  <button className="rsb-btn p" onClick={applyTyped}>Apply</button>
                )}
              </div>
            )}
            {stageF.type === 'boolean' && (
              <>
                <button className="rsb-it" onClick={() => commit(stageF, 'is_true', '', 'Yes')}>Yes / True</button>
                <button className="rsb-it" onClick={() => commit(stageF, 'is_false', '', 'No')}>No / False</button>
              </>
            )}
            {!NO_VALUE.includes(op) && !['number', 'date', 'boolean'].includes(stageF.type) && (
              <div>
                {opts.length === 0 && <div className="rsb-empty" style={{ padding: '6px 12px' }}>{stageF.type === 'text' ? (val ? 'No saved values match — press Enter to use what you typed.' : 'Start typing to see matching values.') : 'No values.'}</div>}
                {opts.map((o, i) => <button key={o.value + ':' + i} className={'rsb-it' + (hot === i ? ' hot' : '')} onClick={() => pickOpt(o)} onMouseEnter={() => setHot(i)}>{o.label}</button>)}
              </div>
            )}
          </div>
        )}
      </div>

      {dlg === 'saveas' && (
        <div className="rsb-veil" onMouseDown={() => setDlg(null)}>
          <div className="rsb-dlg" style={{ maxWidth: 460 }} onMouseDown={e => e.stopPropagation()}>
            <header><h3>Save search</h3></header>
            <div className="bd">
              <label style={{ fontSize: 12, fontWeight: 700, color: '#6F6A62' }}>Name</label>
              <input className="rsb-field" autoFocus type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doSaveAs(); }} placeholder="e.g. My open deals this quarter" />
              <div style={{ fontSize: 12, color: '#6F6A62', margin: '2px 0 10px' }}>
                Saves the filters{filters?.columns?.length ? ', columns' : ''} and sort you see now ({crit.length} filter{crit.length === 1 ? '' : 's'}).
              </div>
              <label className="rsb-lbl"><input type="checkbox" checked={asDef} onChange={e => setAsDef(e.target.checked)} /> Open this search by default for me</label>
              <label className="rsb-lbl"><input type="checkbox" checked={asTeam} onChange={e => setAsTeam(e.target.checked)} /> Share as team default (visible to everyone in this organisation)</label>
            </div>
            <footer><button className="rsb-btn s" onClick={() => setDlg(null)}>Cancel</button><button className="rsb-btn p" disabled={busy} onClick={doSaveAs}>{busy ? 'Saving…' : 'Save'}</button></footer>
          </div>
        </div>
      )}

      {dlg === 'manage' && (
        <div className="rsb-veil" onMouseDown={() => setDlg(null)}>
          <div className="rsb-dlg" onMouseDown={e => e.stopPropagation()}>
            <header><h3>Manage saved searches</h3></header>
            <div className="bd">
              {visible.length === 0 && <div className="rsb-empty" style={{ padding: '12px 0' }}>Nothing saved yet. Set up filters, then choose “Save as…”.</div>}
              {visible.map(s => {
                const own = s.created_by === mine;
                const isDef = s.is_default || s.is_global_default;
                return (
                  <div className="rsb-row" key={s.id}>
                    <div>
                      {renaming === s.id
                        ? <input className="rsb-field" style={{ marginBottom: 0 }} autoFocus type="text" value={renameVal} onChange={e => setRenameVal(e.target.value)}
                            onKeyDown={async e => { if (e.key === 'Enter') { if (renameVal.trim() && renameVal.trim() !== s.name) await updateSavedSearch(s.id, { name: renameVal.trim() }); setRenaming(null); } if (e.key === 'Escape') setRenaming(null); }}
                            onBlur={async () => { if (renameVal.trim() && renameVal.trim() !== s.name) await updateSavedSearch(s.id, { name: renameVal.trim() }); setRenaming(null); }} />
                        : <strong>{isDef ? '★ ' : ''}{s.name}{s.is_global_default && <span className="rsb-team" style={{ marginLeft: 6 }}>Team default</span>}{!own && <span className="rsb-team" style={{ marginLeft: 6 }}>Shared</span>}</strong>}
                      <small>{describeFilters(s.filters || {}, lab)}</small>
                    </div>
                    <div style={{ whiteSpace: 'nowrap' }}>
                      <button className="rsb-mini" onClick={() => { pick(s); setDlg(null); }}>Apply</button>
                      {own && <button className={'rsb-mini' + (isDef ? ' on' : '')} onClick={() => setDefaultSavedSearch(s.id, s.is_global_default)} title="Open by default">{isDef ? '★ Default' : '☆ Default'}</button>}
                      {own && <button className="rsb-mini" onClick={() => { setRenaming(s.id); setRenameVal(s.name); }}>Rename</button>}
                      {own && !sameView(s.filters, filters) && <button className="rsb-mini" onClick={async () => { const ok = await showConfirm(`Replace "${s.name}" with the view you have now (filters, columns, sort)?`, { title: 'Update saved search', variant: 'warning', confirmLabel: 'Update' }); if (ok) await updateSavedSearch(s.id, { filters }); }}>Use current</button>}
                      {own && <button className="rsb-mini del" onClick={() => { if (active?.id === s.id) remember(null); deleteSavedSearch(s.id, s.name); }}>Delete</button>}
                    </div>
                  </div>
                );
              })}
            </div>
            <footer><button className="rsb-btn p" onClick={() => setDlg(null)}>Done</button></footer>
          </div>
        </div>
      )}
    </div>
  );
}

function describeFilters(f, lab) {
  const p = [];
  if (f.search) p.push(`Search “${f.search}”`);
  if (f.status && f.status !== 'All') p.push(`Status ${f.status}`);
  if (f.timePeriod) p.push(PERIODS[f.timePeriod] || f.timePeriod);
  if (f.owner) p.push(`Owner ${f.owner}`);
  (f.advFilters || []).forEach(c => { if (c.field) p.push(`${c.scope === 'line' ? 'Line › ' : ''}${c.label || lab(c.field)} ${opLabel(c.op)} ${NO_VALUE.includes(c.op) ? '' : (c.display ?? c.value ?? '')}`.trim()); });
  if (f.sortField) p.push(`Sorted by ${lab(f.sortField)} ${f.sortDir === 'desc' ? '↓' : '↑'}`);
  if (f.columns?.length) p.push(`${f.columns.length} columns`);
  return p.length ? p.join(' · ') : 'All records, no filters';
}
