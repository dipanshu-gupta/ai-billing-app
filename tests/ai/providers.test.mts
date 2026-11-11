import assert from 'node:assert/strict';
const P = await import(process.env.REPO + '/lib/ai/providers.ts');
let sent: any = null;
(globalThis as any).fetch = async (_u: string, init: any) => { sent = JSON.parse(init.body); return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'hi' }] }) }; };
await P.chat({ provider: 'anthropic', model: 'm', apiKey: 'k' }, { system: 's', maxTokens: 10, messages: [
  { role: 'assistant', content: 'greeting' }, { role: 'user', content: 'q' }, { role: 'assistant', content: 'a1' }, { role: 'assistant', content: 'a2' }, { role: 'user', content: '' }, { role: 'user', content: 'r' } ] });
assert.deepEqual(sent.messages.map((m: any) => m.role), ['user', 'assistant', 'user']);
assert.equal(sent.messages[1].content, 'a1\n\na2');
(globalThis as any).fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'messages: roles must alternate sk-ant-api03-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } }) });
await assert.rejects(P.chat({ provider: 'anthropic', model: 'm', apiKey: 'k' }, { system: 's', maxTokens: 10, messages: [{ role: 'user', content: 'x' }] }), (e: any) => /roles must alternate/.test(e.message) && !/aaaaaaaaaaaa/.test(e.message));
console.log('PROVIDER TESTS PASSED');
