// @ts-nocheck
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAlert } from '@/components/shared/AlertProvider';

const PROVIDER_OPTIONS = [
  ['openai', 'OpenAI'], ['anthropic', 'Anthropic (Claude)'], ['gemini', 'Google Gemini'], ['groq', 'Groq'],
  ['mistral', 'Mistral'], ['deepseek', 'DeepSeek'], ['together', 'Together AI'], ['openrouter', 'OpenRouter'],
  ['xai', 'xAI (Grok)'], ['custom', 'Custom (OpenAI-compatible)'],
];

async function api(method: string, path: string, body?: any) {
  const w: any = window;
  const t = w.__bp_tenant || {};
  const sb = w.__bp_supabase;
  const session = sb ? (await sb.auth.getSession()).data.session : null;
  const headers: any = { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) };
  const scope = { tenantId: t.id || undefined, db_url: t.db_url || undefined };
  let url = path;
  let init: any = { method, headers };
  if (method === 'GET' || method === 'DELETE') {
    const qs = new URLSearchParams(); if (scope.tenantId) qs.set('tenantId', scope.tenantId); if (scope.db_url) qs.set('db_url', scope.db_url);
    url = `${path}?${qs.toString()}`;
  } else init.body = JSON.stringify({ ...scope, ...body });
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

/**
 * Admin Tools > AI Settings. Each tenant brings its own provider, model and API key.
 * The key is encrypted server-side and never sent back to the browser (only the last 4 characters).
 */
export default function AiSettingsPanel() {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [cur, setCur] = useState<any>({ configured: false });
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState('');
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api('GET', '/api/ai/settings');
      setCur(d);
      if (d.configured) { setProvider(d.provider); setModel(d.model); setBaseUrl(d.base_url || ''); }
    } catch (e: any) { showAlert(e.message, { variant: 'error' }); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => models.filter(m => m.toLowerCase().includes(filter.toLowerCase())).slice(0, 200), [models, filter]);
  const needsKey = !cur.configured;
  const canSave = !!model.trim() && (apiKey.trim() || cur.configured) && (provider !== 'custom' || baseUrl.trim());

  const loadModels = async () => {
    setBusy('models'); setTestMsg(null);
    try {
      const d = await api('POST', '/api/ai/models', { provider, base_url: baseUrl, api_key: apiKey });
      setModels(d.models || []);
      if (!(d.models || []).length) showAlert('No models were returned. You can type a model name instead.', { variant: 'info' });
    } catch (e: any) { showAlert(e.message, { variant: 'error' }); }
    setBusy('');
  };
  const save = async () => {
    setBusy('save'); setTestMsg(null);
    try {
      const d = await api('PUT', '/api/ai/settings', { provider, model, base_url: baseUrl, api_key: apiKey });
      setCur(d); setApiKey('');
      showAlert('AI settings saved.', { variant: 'success' });
    } catch (e: any) { showAlert(e.message, { variant: 'error' }); }
    setBusy('');
  };
  const test = async () => {
    setBusy('test'); setTestMsg(null);
    try {
      const d = await api('POST', '/api/ai/test', {});
      setTestMsg({ ok: true, text: `Working - ${(d.ms / 1000).toFixed(1)}s` });
    } catch (e: any) { setTestMsg({ ok: false, text: e.message }); }
    setBusy('');
  };
  const remove = async () => {
    if (!window.confirm('Remove the saved AI key? AI features will stop working until you set it up again.')) return;
    setBusy('remove');
    try { await api('DELETE', '/api/ai/settings'); setCur({ configured: false }); setApiKey(''); setModel(''); setModels([]); showAlert('AI settings removed.', { variant: 'success' }); }
    catch (e: any) { showAlert(e.message, { variant: 'error' }); }
    setBusy('');
  };

  const inp = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500';
  const lbl = 'block text-xs font-bold text-gray-600 mb-1';
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[28px] px-6 py-5">
        <h2 className="text-white text-xl font-bold">🤖 AI Settings</h2>
        <p className="text-white/60 text-sm mt-1">Use your own AI provider for AI Advisor and AI Insights. Your key is encrypted on the server and is never shown again.</p>
      </div>

      <div className="bg-white rounded-[20px] border border-gray-200 shadow-sm p-5 space-y-4">
        {loading ? <p className="text-sm text-gray-500">Loading...</p> : (<>
          {cur.serverReady === false && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">AI key storage is not configured on this deployment (AI_KEYS_SECRET). Ask your platform administrator.</div>
          )}
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm">
            {cur.configured
              ? <span><b>{PROVIDER_OPTIONS.find(p => p[0] === cur.provider)?.[1] || cur.provider}</b> · {cur.model} · key ••••{cur.key_last4} · updated {cur.updated_at ? new Date(cur.updated_at).toLocaleDateString() : ''}</span>
              : <span className="text-gray-600">AI is not set up for this business.</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Provider</label>
              <select className={inp} value={provider} onChange={e => { setProvider(e.target.value); setModels([]); setModel(''); }}>
                {PROVIDER_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            {provider === 'custom' && (
              <div>
                <label className={lbl}>Base URL (https, OpenAI-compatible)</label>
                <input className={inp} value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" />
              </div>
            )}
            <div className={provider === 'custom' ? 'md:col-span-2' : ''}>
              <label className={lbl}>API key {cur.configured && <span className="font-normal text-gray-400">(leave empty to keep the saved key)</span>}</label>
              <input className={inp} type="password" autoComplete="new-password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={cur.configured ? `••••${cur.key_last4}` : 'Paste your API key'} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={lbl + ' mb-0'}>Model</label>
              <button type="button" onClick={loadModels} disabled={busy !== '' || (!apiKey.trim() && needsKey)} className="text-xs font-bold text-blue-600 disabled:opacity-40">
                {busy === 'models' ? 'Loading...' : 'Load my models'}
              </button>
            </div>
            <input className={inp} value={model} onChange={e => setModel(e.target.value)} placeholder="Type a model name, or load your models below" />
            {models.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
                <input className="w-full px-3 py-2 text-sm border-b border-gray-200 focus:outline-none" placeholder={`Search ${models.length} models`} value={filter} onChange={e => setFilter(e.target.value)} />
                <div className="max-h-52 overflow-y-auto">
                  {shown.map(m => (
                    <button type="button" key={m} onClick={() => setModel(m)} className={`block w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${m === model ? 'bg-blue-50 font-bold text-blue-700' : ''}`}>{m}</button>
                  ))}
                  {!shown.length && <p className="px-3 py-2 text-sm text-gray-400">No match</p>}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button onClick={save} disabled={!canSave || busy !== ''} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-40">{busy === 'save' ? 'Saving...' : 'Save'}</button>
            <button onClick={test} disabled={!cur.configured || busy !== ''} className="px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-bold disabled:opacity-40">{busy === 'test' ? 'Testing...' : 'Test'}</button>
            {cur.configured && <button onClick={remove} disabled={busy !== ''} className="px-5 py-2.5 rounded-xl border border-red-300 text-red-600 text-sm font-bold disabled:opacity-40">Remove</button>}
            {testMsg && <span className={`text-sm font-semibold ${testMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{testMsg.text}</span>}
          </div>
          <p className="text-xs text-gray-400">Test checks the saved settings, so save first. AI usage is billed by your provider to your key.</p>
        </>)}
      </div>
    </div>
  );
}
