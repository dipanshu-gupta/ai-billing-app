// Server-only multi-provider AI client. No default model; the key is never logged or echoed.
import { lookup } from 'dns/promises';
import { isIP } from 'net';

export const PROVIDERS: Record<string, { label: string; base?: string; kind: 'openai' | 'anthropic' | 'gemini' | 'compat' }> = {
  openai:     { label: 'OpenAI',            base: 'https://api.openai.com/v1',      kind: 'openai' },
  anthropic:  { label: 'Anthropic (Claude)', base: 'https://api.anthropic.com/v1',   kind: 'anthropic' },
  gemini:     { label: 'Google Gemini',      base: 'https://generativelanguage.googleapis.com/v1beta', kind: 'gemini' },
  groq:       { label: 'Groq',               base: 'https://api.groq.com/openai/v1', kind: 'compat' },
  mistral:    { label: 'Mistral',            base: 'https://api.mistral.ai/v1',      kind: 'compat' },
  deepseek:   { label: 'DeepSeek',           base: 'https://api.deepseek.com/v1',    kind: 'compat' },
  together:   { label: 'Together AI',        base: 'https://api.together.xyz/v1',    kind: 'compat' },
  openrouter: { label: 'OpenRouter',         base: 'https://openrouter.ai/api/v1',   kind: 'compat' },
  xai:        { label: 'xAI (Grok)',         base: 'https://api.x.ai/v1',            kind: 'compat' },
  custom:     { label: 'Custom (OpenAI-compatible)', kind: 'compat' },
};

export type AiSettings = { provider: string; model: string; apiKey: string; baseUrl?: string | null };

export class AiError extends Error {
  code: string; status: number;
  constructor(code: string, message: string, status = 400) { super(message); this.code = code; this.status = status; }
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
}

/** Resolve + validate the base URL. Custom URLs must be https and public (SSRF guard). */
async function resolveBase(provider: string, baseUrl?: string | null): Promise<string> {
  const p = PROVIDERS[provider];
  if (!p) throw new AiError('BAD_PROVIDER', 'Unknown AI provider.');
  if (provider !== 'custom') return p.base!;
  let u: URL;
  try { u = new URL(String(baseUrl || '').trim()); } catch { throw new AiError('BAD_URL', 'Enter a valid https base URL.'); }
  if (u.protocol !== 'https:' || u.username || u.password) throw new AiError('BAD_URL', 'The base URL must be https.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new AiError('BAD_URL', 'That address is not allowed.');
  let addrs: string[] = [];
  if (isIP(host)) addrs = [host];
  else {
    try { addrs = (await lookup(host, { all: true })).map((a: any) => a.address); } catch { throw new AiError('BAD_URL', 'Could not resolve that host.'); }
  }
  if (!addrs.length || addrs.some(isPrivateIp)) throw new AiError('BAD_URL', 'That address is not allowed.');
  return u.toString().replace(/\/+$/, '');
}

// The provider's own error text (with anything that looks like a key or token removed) makes "why did AI fail" answerable.
const scrubText = (t: string) => String(t || '').replace(/[A-Za-z0-9_\-]{30,}/g, '[hidden]').replace(/\s+/g, ' ').trim().slice(0, 300);
function mapStatus(status: number, detail = ''): AiError {
  const why = detail ? `: ${scrubText(detail)}` : '';
  if (status === 401 || status === 403) return new AiError('KEY_REJECTED', 'The AI provider rejected the API key', 502);
  if (status === 404) return new AiError('MODEL_UNAVAILABLE', `That model is not available to this key${why}`, 502);
  if (status === 429) return new AiError('RATE_LIMIT', 'AI quota or rate limit reached', 429);
  return new AiError('PROVIDER_ERROR', `AI provider error (HTTP ${status})${why}`, 502);
}

async function call(url: string, init: any): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 55000);
  try {
    const res = await fetch(url, { ...init, redirect: 'error', signal: ctrl.signal });
    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = j?.error?.message || j?.message || (typeof j?.error === 'string' ? j.error : ''); } catch { /* not json */ }
      throw mapStatus(res.status, detail);
    }
    return await res.json();
  } catch (e: any) {
    if (e instanceof AiError) throw e;
    if (e?.name === 'AbortError') throw new AiError('TIMEOUT', 'AI request timed out - please try again.', 504);
    throw new AiError('NETWORK', 'Could not reach the AI provider.', 502);
  } finally { clearTimeout(t); }
}

export async function listModels(provider: string, apiKey: string, baseUrl?: string | null): Promise<string[]> {
  const base = await resolveBase(provider, baseUrl);
  const kind = PROVIDERS[provider].kind;
  let ids: string[] = [];
  if (kind === 'anthropic') {
    const d = await call(`${base}/models?limit=100`, { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } });
    ids = (d?.data || []).map((m: any) => m.id);
  } else if (kind === 'gemini') {
    const d = await call(`${base}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } });
    ids = (d?.models || []).filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m: any) => String(m.name || '').replace(/^models\//, ''));
  } else {
    const d = await call(`${base}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
    ids = (d?.data || []).map((m: any) => m.id);
  }
  return Array.from(new Set(ids.filter(Boolean))).sort();
}

export async function chat(
  s: AiSettings,
  { system, messages, maxTokens }: { system: string; messages: { role: string; content: string }[]; maxTokens: number }
): Promise<{ text: string }> {
  if (!s?.apiKey || !s?.model || !s?.provider) throw new AiError('AI_NOT_CONFIGURED', 'AI is not set up for this business yet.', 409);
  const base = await resolveBase(s.provider, s.baseUrl);
  const kind = PROVIDERS[s.provider].kind;
  // Providers (Anthropic, Gemini) reject a conversation that does not start with the user or has two turns of the
  // same role in a row - which happened whenever the chat showed two assistant bubbles back to back (a reply plus a
  // "record created" note). Merge same-role neighbours, drop empties and leading assistant turns.
  const msgs: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of messages || []) {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const content = String(m.content ?? '').trim();
    if (!content) continue;
    const last = msgs[msgs.length - 1];
    if (last && last.role === role) last.content += '\n\n' + content;
    else msgs.push({ role, content });
  }
  while (msgs.length && msgs[0].role === 'assistant') msgs.shift();
  if (!msgs.length) msgs.push({ role: 'user', content: 'Hello' });

  if (kind === 'anthropic') {
    const d = await call(`${base}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': s.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: s.model, max_tokens: maxTokens, system, messages: msgs }),
    });
    return { text: (d?.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('') || 'No response generated.' };
  }
  if (kind === 'gemini') {
    const d = await call(`${base}/models/${encodeURIComponent(s.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: msgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    });
    return { text: (d?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('') || 'No response generated.' };
  }
  const d = await call(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.apiKey}` },
    body: JSON.stringify({ model: s.model, messages: [{ role: 'system', content: system }, ...msgs], ...(s.provider === 'openai' ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }) }),
  });
  return { text: d?.choices?.[0]?.message?.content || 'No response generated.' };
}
