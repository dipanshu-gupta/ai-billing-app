// @ts-nocheck
'use client';
/**
 * Express Dashboard — modelled on the Oracle Fusion Redwood Sales dashboard:
 *   • a row of summary cards (each a live metric); selecting a card shows ITS charts and lists below
 *   • charts / lists / to-dos built from saved searches, objects and fields (standard + custom + custom objects)
 *   • users add, remove, reorder and reconfigure their own cards and widgets; admins can publish a team default
 * Multi-tenant: layouts live in express_dashboards (tenant_id + RLS + auto_fill trigger); data is read through the same
 * tenant-scoped, data-security-scoped queries the list pages use, so a dashboard never shows more than the user may see.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useTenant } from '@/context/TenantContext';
import { useAlert } from '@/components/shared/AlertProvider';
import RedwoodSkin from '@/components/shared/RedwoodSkin';
import { tenantScope } from '@/lib/utils';
import { getSources, defaultConfig, emptyWidget, uid, invalidateDashboardFieldCache } from '@/lib/expressDashboard';
import { useWidgetData, WidgetBody, WidgetEditor, metricValue, describeFilters } from '@/components/dashboard/ExpressWidgets';

const CSS = String.raw`
.xd { --xd-r: 12px; padding: 24px 28px 48px; background: var(--rw-bg); min-height: 100%; color: var(--rw-ink); }
.xd h2.xd-title { font-family: var(--rw-serif); font-weight: 400; font-size: 28px; letter-spacing: -0.01em; margin: 0; }
.xd .xd-sub { color: var(--rw-muted); font-size: 13px; margin-top: 4px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.xd .xd-badge { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 999px; background: var(--rw-accent-soft); color: var(--rw-accent); }
.xd .xd-bar { height: 5px; border-radius: 3px; margin: 14px 0 20px; background: linear-gradient(90deg, var(--rw-accent) 0 38%, var(--rw-teal) 38% 62%, var(--rw-gold) 62% 78%, #C9BFD6 78% 100%); }
.xd .xd-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.xd .xd-acts { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.xd .xd-btn { border: 1px solid #D6D1CA; background: #fff; color: var(--rw-ink); border-radius: 8px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
.xd .xd-btn:hover { border-color: var(--rw-accent); color: var(--rw-accent); }
.xd .xd-btn.primary { background: var(--rw-ink); color: #fff; border-color: var(--rw-ink); }
.xd .xd-btn.primary:hover { background: var(--rw-accent); border-color: var(--rw-accent); color: #fff; }
.xd .xd-btn:disabled { opacity: .45; cursor: not-allowed; }
.xd .xd-banner { background: #FBF1DC; border: 1px solid #EBD6A2; color: #6B4E10; border-radius: 10px; padding: 10px 14px; font-size: 12.5px; margin-bottom: 14px; }
.xd .xd-banner.err { background: #F8E6E1; border-color: #E8BDB1; color: #8A2F1B; }

.xd .xd-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px; margin-bottom: 22px; }
.xd .xd-card { position: relative; background: #fff; border: 1px solid var(--rw-border); border-radius: var(--xd-r); padding: 14px 16px 14px; cursor: pointer; text-align: left; transition: box-shadow .15s, border-color .15s, transform .15s; min-height: 112px; }
.xd .xd-card:hover { border-color: #CFC4DA; box-shadow: 0 4px 14px rgba(27,26,24,.07); }
.xd .xd-card.on { border-color: var(--rw-accent); box-shadow: 0 0 0 1px var(--rw-accent), 0 6px 18px rgba(122,78,155,.14); }
.xd .xd-card.on::after { content: ""; position: absolute; left: 50%; bottom: -9px; width: 14px; height: 14px; background: #fff; border-right: 1px solid var(--rw-accent); border-bottom: 1px solid var(--rw-accent); transform: translateX(-50%) rotate(45deg); }
.xd .xd-mt { font-size: 12.5px; color: var(--rw-muted); font-weight: 600; letter-spacing: .01em; display: flex; gap: 6px; align-items: center; }
.xd .xd-mv { font-family: var(--rw-serif); font-size: 34px; line-height: 1.1; margin-top: 8px; color: var(--rw-ink); }
.xd .xd-ms { font-size: 11.5px; color: var(--rw-faint); margin-top: 6px; }
.xd .xd-mf { font-size: 11px; color: var(--rw-accent); margin-top: 2px; min-height: 14px; }
.xd .xd-card-add { border: 1.5px dashed #CFC9C0; background: transparent; color: var(--rw-muted); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; }
.xd .xd-card-add:hover { border-color: var(--rw-accent); color: var(--rw-accent); background: var(--rw-accent-soft); box-shadow: none; }
.xd .xd-tools { position: absolute; top: 6px; right: 6px; display: flex; gap: 2px; opacity: 0; transition: opacity .12s; }
.xd.edit .xd-card:hover .xd-tools, .xd.edit .xd-widget:hover .xd-tools, .xd.edit .xd-tools:focus-within { opacity: 1; }
.xd .xd-tools button { border: 1px solid var(--rw-border); background: #fff; border-radius: 6px; font-size: 11px; line-height: 1; padding: 4px 6px; cursor: pointer; color: var(--rw-muted); }
.xd .xd-tools button:hover { color: var(--rw-accent); border-color: var(--rw-accent); }
.xd.edit .xd-card, .xd.edit .xd-widget { outline: 1px dashed #D5CCDF; outline-offset: 2px; }

.xd .xd-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.xd .xd-widget { position: relative; background: #fff; border: 1px solid var(--rw-border); border-radius: var(--xd-r); padding: 16px 18px 14px; min-width: 0; }
.xd .s1 { grid-column: span 1; } .xd .s2 { grid-column: span 2; } .xd .s3 { grid-column: span 3; }
@media (max-width: 1100px) { .xd .xd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .xd .s3 { grid-column: span 2; } }
@media (max-width: 720px) { .xd { padding: 16px 14px 40px; } .xd .xd-grid { grid-template-columns: minmax(0, 1fr); } .xd .s1, .xd .s2, .xd .s3 { grid-column: span 1; } }
.xd .xd-wtitle { font-family: var(--rw-serif); font-size: 17px; font-weight: 400; color: var(--rw-ink); }
.xd .xd-wsub { font-size: 11.5px; color: var(--rw-faint); margin: 2px 0 10px; min-height: 14px; }
.xd .xd-add { border: 1.5px dashed #CFC9C0; border-radius: var(--xd-r); min-height: 110px; display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--rw-muted); background: transparent; }
.xd .xd-add button { border: 1px solid #D6D1CA; background: #fff; border-radius: 8px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--rw-ink); }
.xd .xd-add button:hover { border-color: var(--rw-accent); color: var(--rw-accent); }

.xd .xd-empty { color: var(--rw-faint); font-size: 13px; text-align: center; padding: 34px 12px; }
.xd .xd-empty.err { color: #A33F28; }
.xd .xd-note { font-size: 11px; color: var(--rw-faint); margin-top: 6px; }
.xd .xd-skel { border-radius: 8px; background: linear-gradient(90deg, #F1EEEA 25%, #F8F6F3 50%, #F1EEEA 75%); background-size: 200% 100%; animation: xdsk 1.2s infinite; }
@keyframes xdsk { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.xd .xd-tablewrap { overflow-x: auto; }
.xd .xd-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.xd .xd-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--rw-muted); font-weight: 600; padding: 7px 10px; border-bottom: 1px solid var(--rw-border); white-space: nowrap; }
.xd .xd-table td { padding: 9px 10px; border-bottom: 1px solid var(--rw-line); color: #34312C; white-space: nowrap; max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
.xd .xd-table td.first { font-weight: 600; color: var(--rw-ink); }
.xd .xd-table .r { text-align: right; }
.xd .xd-table tbody tr { cursor: pointer; } .xd .xd-table tbody tr:hover td { background: #FAF8FC; }
.xd .xd-pill { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }
.xd .xd-tfoot { display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: var(--rw-faint); padding-top: 8px; }
.xd .xd-tfoot button, .xd .xd-link { background: none; border: 0; color: var(--rw-accent); font-weight: 600; font-size: 12px; cursor: pointer; padding: 2px 0; text-align: left; }
.xd .xd-tfoot button:hover, .xd .xd-link:hover { text-decoration: underline; }

/* editor */
.xd-overlay { position: fixed; inset: 0; background: rgba(27,26,24,.45); z-index: 80; display: flex; align-items: center; justify-content: center; padding: 20px; }
.xd-modal { background: #fff; width: min(1040px, 100%); max-height: 92vh; border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.28); color: #1B1A18; --rw-bg: #F6F4F1; --rw-border: #E3DFD9; --rw-line: #EEEBE6; --rw-ink: #1B1A18; --rw-muted: #6F6A62; --rw-faint: #9A958C; --rw-accent: #7A4E9B; --rw-accent-soft: #F1EAF6; --rw-serif: Georgia, "Times New Roman", serif; }
.xd-mhead { display: flex; justify-content: space-between; gap: 12px; padding: 18px 22px 12px; border-bottom: 1px solid var(--rw-border); position: relative; }
.xd-mhead::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 4px; background: linear-gradient(90deg, #7A4E9B 0 38%, #2F8F83 38% 62%, #E1A93B 62% 78%, #C9BFD6 78% 100%); }
.xd-mhead h3 { font-family: var(--rw-serif); font-weight: 400; font-size: 22px; margin: 0; }
.xd-mhead p { margin: 3px 0 0; font-size: 12.5px; color: var(--rw-muted); }
.xd-x { border: 0; background: none; cursor: pointer; color: var(--rw-muted); font-size: 14px; padding: 4px 8px; border-radius: 6px; }
.xd-x:hover { background: #F1EEEA; color: #A33F28; }
.xd-mbody { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 0; overflow: hidden; flex: 1; min-height: 0; }
@media (max-width: 860px) { .xd-mbody { grid-template-columns: minmax(0, 1fr); overflow-y: auto; } }
.xd-form { padding: 14px 22px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.xd-preview { background: var(--rw-bg); padding: 14px 18px; overflow-y: auto; border-left: 1px solid var(--rw-border); }
.xd-phead { display: flex; justify-content: space-between; align-items: center; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--rw-muted); font-weight: 700; margin-bottom: 8px; }
.xd-pcard { background: #fff; border: 1px solid var(--rw-border); border-radius: 12px; padding: 16px; min-height: 180px; }
.xd-pcard .xd-mt { font-size: 12.5px; color: var(--rw-muted); font-weight: 600; } .xd-pcard .xd-mv { font-family: var(--rw-serif); font-size: 36px; margin-top: 8px; } .xd-pcard .xd-ms { font-size: 11.5px; color: var(--rw-faint); margin-top: 6px; }
.xd-pcard .xd-wtitle { font-family: var(--rw-serif); font-size: 17px; margin-bottom: 8px; }
.xd-pcard .xd-empty { color: var(--rw-faint); font-size: 13px; text-align: center; padding: 34px 12px; } .xd-pcard .xd-empty.err { color: #A33F28; }
.xd-pcard .xd-skel { border-radius: 8px; background: linear-gradient(90deg, #F1EEEA 25%, #F8F6F3 50%, #F1EEEA 75%); background-size: 200% 100%; animation: xdsk 1.2s infinite; }
.xd-pcard .xd-table { width: 100%; border-collapse: collapse; font-size: 12px; } .xd-pcard .xd-tablewrap { overflow-x: auto; }
.xd-pcard .xd-table th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--rw-muted); padding: 6px 8px; border-bottom: 1px solid var(--rw-border); white-space: nowrap; }
.xd-pcard .xd-table td { padding: 7px 8px; border-bottom: 1px solid var(--rw-line); white-space: nowrap; max-width: 180px; overflow: hidden; text-overflow: ellipsis; } .xd-pcard .xd-table .r { text-align: right; }
.xd-pcard .xd-pill { display: inline-block; font-size: 10.5px; font-weight: 600; padding: 2px 8px; border-radius: 999px; }
.xd-pcard .xd-tfoot { display: flex; justify-content: space-between; font-size: 11px; color: var(--rw-faint); padding-top: 6px; } .xd-pcard .xd-tfoot button { background: none; border: 0; color: var(--rw-accent); font-weight: 600; font-size: 11.5px; }
.xd-pcard .xd-note { font-size: 11px; color: var(--rw-faint); margin-top: 6px; }
.xd-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; color: var(--rw-muted); margin-top: 8px; display: block; }
.xd-in { width: 100%; border: 1px solid #D6D1CA; border-radius: 8px; padding: 7px 10px; font-size: 13px; background: #fff; color: #1B1A18; min-width: 0; }
.xd-in:focus { outline: none; border-color: var(--rw-accent); box-shadow: 0 0 0 3px rgba(122,78,155,.14); }
.xd-row { display: flex; gap: 8px; align-items: flex-end; }
.xd-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.xd-chips button { border: 1px solid #D6D1CA; background: #fff; border-radius: 999px; padding: 5px 12px; font-size: 12px; font-weight: 600; color: #4A463F; cursor: pointer; }
.xd-chips button.on { background: var(--rw-accent-soft); border-color: var(--rw-accent); color: var(--rw-accent); }
.xd-chips.sm button { padding: 3px 10px; font-size: 11.5px; }
.xd-cols { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 4px 10px; font-size: 12.5px; max-height: 150px; overflow-y: auto; border: 1px solid var(--rw-border); border-radius: 8px; padding: 8px 10px; }
.xd-cols label { display: flex; gap: 6px; align-items: center; cursor: pointer; }
.xd-sec { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--rw-line); font-family: var(--rw-serif); font-size: 16px; }
.xd-mfoot { display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding: 12px 22px; border-top: 1px solid var(--rw-border); background: #fff; }
.xd-prob { margin-right: auto; font-size: 12px; color: #A33F28; }
.xd-modal .xd-btn { border: 1px solid #D6D1CA; background: #fff; color: #1B1A18; border-radius: 8px; padding: 8px 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
.xd-modal .xd-btn.primary { background: #1B1A18; color: #fff; border-color: #1B1A18; } .xd-modal .xd-btn.primary:hover { background: #7A4E9B; border-color: #7A4E9B; }
.xd-modal .xd-btn:disabled { opacity: .45; cursor: not-allowed; }
.xd-modal .xd-link { background: none; border: 0; color: #7A4E9B; font-weight: 600; font-size: 12px; cursor: pointer; text-align: left; padding: 2px 0; }
`;

const ls = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch {} },
};

function SummaryCard({ tab, active, onSelect, edit, tools, ctxProps }: any) {
  const w = tab.metric;
  const d = useWidgetData(w, ctxProps);
  const m = metricValue(w, d);
  return (
    <div className={`xd-card ${active ? 'on' : ''}`} role="button" tabIndex={0} onClick={onSelect} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}>
      <div className="xd-mt">{tab.icon ? <span>{tab.icon}</span> : null}{w.title}</div>
      {d.state === 'nosource' ? <div className="xd-ms" style={{ marginTop: 14 }}>Object unavailable</div>
        : d.state === 'error' ? <div className="xd-ms" style={{ marginTop: 14, color: '#A33F28' }}>Couldn’t load</div>
        : m ? (<><div className="xd-mv" title={m.full || ''}>{m.text}</div><div className="xd-ms">{m.sub}</div></>)
        : <div className="xd-skel" style={{ height: 40, marginTop: 12 }} />}
      <div className="xd-mf">{describeFilters(w, ctxProps.savedSearches)}</div>
      {edit && tools}
    </div>
  );
}

function WidgetCard({ w, ctxProps, edit, tools, onOpen, nonce }: any) {
  const d = useWidgetData(w, { ...ctxProps, nonce });
  return (
    <div className={`xd-widget s${Math.min(3, Math.max(1, Number(w.span) || 1))}`}>
      <div className="xd-wtitle">{w.title}</div>
      <div className="xd-wsub">{d.source ? d.source.label : ''}{describeFilters(w, ctxProps.savedSearches) ? ` · ${describeFilters(w, ctxProps.savedSearches)}` : ''}</div>
      <WidgetBody w={w} d={d} onOpen={onOpen} />
      {edit && tools}
    </div>
  );
}

export default function ExpressDashboard({ onNavigate }: { onNavigate?: (p: string) => void }) {
  const { currentUser, dataSecurityScope, savedSearches, fetchSavedSearches, customObjects, appPreferences, currentUserPermissions, permissionsLoaded } = useApp();
  const { supabase } = useTenant();
  const { showConfirm, showAlert } = useAlert();
  const email = currentUser?.email;
  const b2c = appPreferences?.b2c_mode === true;
  const isAdmin = !!dataSecurityScope?.isAdmin;
  const isManager = isAdmin || !!dataSecurityScope?.viewAll || !!dataSecurityScope?.viewTeam;
  const canView = useCallback((perm: string | null) => !perm || isAdmin || (currentUserPermissions || []).includes(perm), [isAdmin, currentUserPermissions]);

  const sources = useMemo(() => getSources({ b2c, customObjects, canView }), [b2c, customObjects, canView]);
  const sourceMap = useMemo(() => Object.fromEntries(sources.map(s => [s.key, s])), [sources]);

  const [cfg, setCfg] = useState<any>(null);          // { tabs:[…] }
  const [origin, setOrigin] = useState('standard');   // 'personal' | 'team' | 'standard'
  const [tabId, setTabId] = useState<string>('');
  const [edit, setEdit] = useState(false);
  const [editor, setEditor] = useState<any>(null);    // { kind, draft, tabId, isNew }
  const [nonce, setNonce] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveErr, setSaveErr] = useState('');
  const [dbMissing, setDbMissing] = useState(false);
  const personalId = useRef<string | null>(null);
  const teamId = useRef<string | null>(null);
  const dirty = useRef(false);
  const timer = useRef<any>(null);
  const loadedFor = useRef('');

  useEffect(() => { if (fetchSavedSearches) fetchSavedSearches(); }, [email]);

  const tid = () => (typeof window !== 'undefined' ? (window as any).__bp_tenant?.id : null) || null;
  const standard = useCallback(() => defaultConfig({ b2c, isManager, has: (k: string) => !!sourceMap[k] }), [b2c, isManager, sourceMap]);
  const sanitize = (c: any) => (c && Array.isArray(c.tabs) ? { ...c, tabs: c.tabs.filter(t => t && t.metric).map(t => ({ ...t, widgets: Array.isArray(t.widgets) ? t.widgets.filter(Boolean) : [] })) } : null);

  // ── load: personal → team default → standard ──
  useEffect(() => {
    if (!supabase || !email || !dataSecurityScope?.ready || !sources.length) return;
    const sig = `${email}|${b2c}|${sources.length}`;
    if (loadedFor.current === sig) return;
    loadedFor.current = sig;
    (async () => {
      let mine = null, team = null;
      try {
        const a = await tenantScope(supabase.from('express_dashboards').select('*')).eq('scope', 'user').eq('owner_email', email).order('updated_at', { ascending: false }).limit(1);
        if (a.error) throw a.error;
        mine = a.data?.[0] || null;
        const b = await tenantScope(supabase.from('express_dashboards').select('*')).eq('scope', 'tenant').order('updated_at', { ascending: false }).limit(1);
        if (!b.error) team = b.data?.[0] || null;
        setDbMissing(false);
      } catch (e: any) {
        if (/express_dashboards|relation|schema cache|does not exist/i.test(e?.message || '')) setDbMissing(true);
      }
      personalId.current = mine?.id || null; teamId.current = team?.id || null;
      const c = sanitize(mine?.config) && sanitize(mine.config).tabs.length ? sanitize(mine.config) : null;
      const t = !c && sanitize(team?.config) && sanitize(team.config).tabs.length ? sanitize(team.config) : null;
      const next = c || t || standard();
      setOrigin(c ? 'personal' : t ? 'team' : 'standard');
      setCfg(next);
      const want = ls.get('xd_tab');
      setTabId(next.tabs.find(x => x.id === want)?.id || next.tabs[0]?.id || '');
    })();
  }, [supabase, email, dataSecurityScope?.ready, b2c, sources.length]);

  // ── save (debounced, copy-on-write into the user's own layout) ──
  const savePersonal = useCallback(async (c: any) => {
    if (!supabase || !email) return;
    setSaveState('saving');
    const now = new Date().toISOString();
    let r: any;
    if (personalId.current) r = await supabase.from('express_dashboards').update({ config: c, updated_by: email, updated_at: now }).eq('id', personalId.current).select('id').single();
    else r = await supabase.from('express_dashboards').insert([{ name: 'My Dashboard', scope: 'user', owner_email: email, config: c, created_by: email, updated_by: email, ...(tid() ? { tenant_id: tid() } : {}) }]).select('id').single();
    if (r.error) { setSaveState('error'); setSaveErr(r.error.message); if (/express_dashboards|relation|schema cache|does not exist/i.test(r.error.message)) setDbMissing(true); return; }
    personalId.current = r.data.id; setSaveState('saved'); setSaveErr(''); setOrigin('personal'); dirty.current = false;
  }, [supabase, email]);

  const commit = (next: any) => {
    setCfg(next); setOrigin('personal'); dirty.current = true; setSaveState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => savePersonal(next), 700);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const tab = cfg?.tabs?.find(t => t.id === tabId) || cfg?.tabs?.[0];
  useEffect(() => { if (tab && tab.id !== tabId) setTabId(tab.id); }, [tab?.id]);
  const select = (id: string) => { setTabId(id); ls.set('xd_tab', id); };

  const ctx = useMemo(() => ({ user: currentUser, security: dataSecurityScope, savedSearches }), [currentUser, dataSecurityScope, savedSearches]);
  const ctxProps = { sourceMap, supabase, ctx, nonce, savedVersion: (savedSearches || []).length, savedSearches };

  // ── layout operations ──
  const upTab = (id: string, fn: (t: any) => any) => commit({ ...cfg, tabs: cfg.tabs.map(t => (t.id === id ? fn(t) : t)) });
  const move = (arr: any[], i: number, d: number) => { const j = i + d; if (j < 0 || j >= arr.length) return arr; const c = [...arr]; [c[i], c[j]] = [c[j], c[i]]; return c; };
  const openEditor = (kind: string, draft: any, tId: string | null, isNew: boolean) => setEditor({ kind, draft, tabId: tId, isNew });
  const firstSource = (prefer: string[] = []) => (prefer.find(k => sourceMap[k]) || sources[0]?.key || '');

  const addCard = () => openEditor('metric', emptyWidget('metric', firstSource(['opportunities', 'retailOrders'])), null, true);
  const addWidget = (kind: string) => openEditor(kind, emptyWidget(kind, tab?.metric?.source && sourceMap[tab.metric.source] ? tab.metric.source : firstSource()), tab.id, true);

  const saveEditor = (w: any) => {
    const { kind, tabId: tId, isNew } = editor;
    if (kind === 'metric') {
      if (isNew) { const t = { id: uid('t'), label: w.title, icon: '📊', metric: w, widgets: [] }; commit({ ...cfg, tabs: [...cfg.tabs, t] }); select(t.id); }
      else upTab(tId, t => ({ ...t, label: w.title, metric: w }));
    } else if (isNew) upTab(tId, t => ({ ...t, widgets: [...t.widgets, w] }));
    else upTab(tId, t => ({ ...t, widgets: t.widgets.map(x => (x.id === w.id ? w : x)) }));
    setEditor(null);
  };

  const removeCard = async (t: any) => {
    const ok = await showConfirm(`Remove the “${t.metric.title}” card and its ${t.widgets.length} widget(s)?`, { variant: 'danger', confirmLabel: 'Remove' });
    if (!ok) return;
    const tabs = cfg.tabs.filter(x => x.id !== t.id); commit({ ...cfg, tabs }); if (tabId === t.id) select(tabs[0]?.id || '');
  };
  const removeWidget = async (w: any) => {
    const ok = await showConfirm(`Remove “${w.title}” from this dashboard?`, { variant: 'danger', confirmLabel: 'Remove' });
    if (ok) upTab(tab.id, t => ({ ...t, widgets: t.widgets.filter(x => x.id !== w.id) }));
  };

  const publishTeam = async () => {
    const ok = await showConfirm('Publish this layout as the team default? Anyone without a personal layout will see it.', { confirmLabel: 'Publish' });
    if (!ok) return;
    const now = new Date().toISOString();
    const r = teamId.current
      ? await supabase.from('express_dashboards').update({ config: cfg, updated_by: email, updated_at: now }).eq('id', teamId.current).select('id').single()
      : await supabase.from('express_dashboards').insert([{ name: 'Team Dashboard', scope: 'tenant', owner_email: null, config: cfg, created_by: email, updated_by: email, ...(tid() ? { tenant_id: tid() } : {}) }]).select('id').single();
    if (r.error) { showAlert('Could not publish: ' + r.error.message, { variant: 'danger' }); return; }
    teamId.current = r.data.id; showAlert('Published as the team default.', { variant: 'success' });
  };

  const resetLayout = async () => {
    const ok = await showConfirm(teamId.current ? 'Discard your personal layout and go back to the team default?' : 'Discard your changes and go back to the standard layout?', { variant: 'danger', confirmLabel: 'Reset' });
    if (!ok) return;
    clearTimeout(timer.current);
    if (personalId.current) { await supabase.from('express_dashboards').delete().eq('id', personalId.current); personalId.current = null; }
    invalidateDashboardFieldCache(); dirty.current = false; setSaveState('idle'); setEdit(false);
    setReloadTick(t => t + 1);
  };
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    if (!reloadTick || !supabase || !email) return;
    (async () => {
      let team = null;
      try { const b = await tenantScope(supabase.from('express_dashboards').select('*')).eq('scope', 'tenant').order('updated_at', { ascending: false }).limit(1); team = b.data?.[0] || null; } catch {}
      teamId.current = team?.id || null;
      const t = sanitize(team?.config); const next = t && t.tabs.length ? t : standard();
      setOrigin(t && t.tabs.length ? 'team' : 'standard'); setCfg(next); setTabId(next.tabs[0]?.id || '');
    })();
  }, [reloadTick]);

  const toolBtns = (items: any[]) => <div className="xd-tools" onClick={e => e.stopPropagation()}>{items.map(([l, t, f], i) => <button key={i} title={t} onClick={f}>{l}</button>)}</div>;

  const originLabel = origin === 'personal' ? 'Your layout' : origin === 'team' ? 'Team default' : 'Standard layout';

  return (
    <div className={`rw-list xd ${edit ? 'edit' : ''}`}>
      <RedwoodSkin />
      <style>{CSS}</style>

      <div className="xd-head">
        <div>
          <h2 className="xd-title">Express Dashboard</h2>
          <div className="xd-sub">
            <span className="xd-badge">{originLabel}</span>
            <span>Live data, scoped to what you can access.</span>
            {saveState === 'saving' && <span>· Saving…</span>}
            {saveState === 'saved' && <span style={{ color: '#25615B' }}>· Saved</span>}
          </div>
        </div>
        <div className="xd-acts">
          <button className="xd-btn" onClick={() => { invalidateDashboardFieldCache(); setNonce(n => n + 1); }}>↻ Refresh</button>
          {edit && <button className="xd-btn" onClick={addCard}>＋ Add card</button>}
          {edit && isAdmin && <button className="xd-btn" onClick={publishTeam} disabled={dbMissing}>Publish as team default</button>}
          {edit && (origin === 'personal') && <button className="xd-btn" onClick={resetLayout}>Reset layout</button>}
          <button className={`xd-btn ${edit ? 'primary' : ''}`} onClick={() => setEdit(e => !e)}>{edit ? '✓ Done' : '✎ Customize'}</button>
        </div>
      </div>
      <div className="xd-bar" />

      {dbMissing && <div className="xd-banner">Layout storage isn’t set up yet — run <b>48_express_dashboard.sql</b> in the Supabase SQL Editor. You can still customise now; changes last until you leave this page.</div>}
      {saveState === 'error' && !dbMissing && <div className="xd-banner err">Couldn’t save your layout: {saveErr}</div>}

      {!cfg && <div className="xd-skel" style={{ height: 130 }} />}
      {cfg && cfg.tabs.length === 0 && (
        <div className="xd-widget" style={{ textAlign: 'center', padding: 40 }}>
          <div className="xd-wtitle">Your dashboard is empty</div>
          <div className="xd-wsub" style={{ margin: '6px 0 16px' }}>Add a summary card, then charts and lists under it — or start from the standard layout.</div>
          <div className="xd-acts" style={{ justifyContent: 'center' }}>
            <button className="xd-btn primary" onClick={() => { setEdit(true); addCard(); }}>＋ Add card</button>
            <button className="xd-btn" onClick={() => { const s = standard(); commit(s); setTabId(s.tabs[0]?.id || ''); }}>Use standard layout</button>
          </div>
        </div>
      )}

      {cfg && cfg.tabs.length > 0 && (<>
        <div className="xd-cards">
          {cfg.tabs.map((t, i) => (
            <SummaryCard key={t.id} tab={t} active={t.id === tab?.id} onSelect={() => select(t.id)} edit={edit} ctxProps={ctxProps}
              tools={toolBtns([
                ['◀', 'Move left', () => commit({ ...cfg, tabs: move(cfg.tabs, i, -1) })],
                ['▶', 'Move right', () => commit({ ...cfg, tabs: move(cfg.tabs, i, 1) })],
                ['✎', 'Edit card', () => openEditor('metric', t.metric, t.id, false)],
                ['✕', 'Remove card', () => removeCard(t)],
              ])} />
          ))}
          {edit && <button className="xd-card xd-card-add" onClick={addCard}>＋ Add card</button>}
        </div>

        {tab && (
          <div className="xd-grid">
            {tab.widgets.map((w, i) => (
              <WidgetCard key={w.id} w={w} ctxProps={ctxProps} nonce={nonce} edit={edit} onOpen={k => onNavigate && onNavigate(k)}
                tools={toolBtns([
                  ['◀', 'Move earlier', () => upTab(tab.id, t => ({ ...t, widgets: move(t.widgets, i, -1) }))],
                  ['▶', 'Move later', () => upTab(tab.id, t => ({ ...t, widgets: move(t.widgets, i, 1) }))],
                  ['↔', 'Change width', () => upTab(tab.id, t => ({ ...t, widgets: t.widgets.map(x => (x.id === w.id ? { ...x, span: (Number(x.span) || 1) % 3 + 1 } : x)) }))],
                  ['⧉', 'Duplicate', () => upTab(tab.id, t => ({ ...t, widgets: [...t.widgets.slice(0, i + 1), { ...JSON.parse(JSON.stringify(w)), id: uid('w'), title: w.title + ' (copy)' }, ...t.widgets.slice(i + 1)] }))],
                  ['✎', 'Edit', () => openEditor(w.kind === 'table' ? 'table' : 'chart', w, tab.id, false)],
                  ['✕', 'Remove', () => removeWidget(w)],
                ])} />
            ))}
            {edit && (
              <div className="xd-add s3">
                <span>Add to “{tab.metric.title}”:</span>
                <button onClick={() => addWidget('chart')}>📊 Chart</button>
                <button onClick={() => addWidget('table')}>📋 List / To-do</button>
              </div>
            )}
            {!edit && tab.widgets.length === 0 && (
              <div className="xd-widget s3"><div className="xd-empty">No widgets under this card yet. Choose <b>Customize</b> to add charts and lists.</div></div>
            )}
          </div>
        )}
      </>)}

      {editor && (
        <WidgetEditor draft={editor.draft} kind={editor.kind} isNew={editor.isNew} sources={sources} sourceMap={sourceMap}
          supabase={supabase} ctx={ctx} savedSearches={savedSearches} onSave={saveEditor} onCancel={() => setEditor(null)} onNavigate={onNavigate} />
      )}
    </div>
  );
}
