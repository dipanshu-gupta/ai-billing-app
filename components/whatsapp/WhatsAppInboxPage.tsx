// @ts-nocheck
'use client';
import { useState, useEffect, useRef } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAlert } from '@/components/shared/AlertProvider';
import { tenantScope } from '@/lib/utils';
import { waFetch } from '@/lib/waFetch';
import RedwoodSkin from '@/components/shared/RedwoodSkin';

// Normalizes a phone number for grouping - strips everything but digits, so
// the same customer's number formatted slightly differently (with/without a
// leading +, spaces, dashes) is still recognized as one conversation.
const normalizePhone = (p) => String(p || '').replace(/\D/g, '');

export default function WhatsAppInboxPage() {
  const { supabase, tenant } = useTenant();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const threadEndRef = useRef(null);

  const fetchAll = async () => {
    if (!supabase) return;
    setLoading(true);
    // Fetches a generous window rather than paginating - conversation
    // inboxes are read in full context, not paged like a records list, and
    // WhatsApp message volume per tenant is naturally bounded by Meta's own
    // conversation-based pricing (nobody sends 50,000 messages/day on a
    // per-conversation billing model without expecting the cost that comes
    // with it) - 2,000 most-recent rows comfortably covers realistic usage.
    const { data, error } = await tenantScope(supabase.from('whatsapp_message_log').select('*'))
      .not('recipient_phone', 'is', null)
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error) { console.error('[WhatsAppInbox] fetch failed:', error.message); setRows([]); }
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [supabase, tenant?.id]);

  // Group messages into one conversation per normalized phone number.
  const conversations = (() => {
    const byPhone = new Map();
    for (const r of rows) {
      const key = normalizePhone(r.recipient_phone);
      if (!key) continue;
      if (!byPhone.has(key)) byPhone.set(key, []);
      byPhone.get(key).push(r);
    }
    return Array.from(byPhone.entries())
      .map(([phone, msgs]) => {
        const sorted = msgs.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const last = sorted[sorted.length - 1];
        return { phone, messages: sorted, last };
      })
      .sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
  })();

  const filteredConversations = search.trim()
    ? conversations.filter(c => c.phone.includes(search.replace(/\D/g, '')) || c.messages.some(m => (m.record_id || '').toLowerCase().includes(search.toLowerCase())))
    : conversations;

  const activeConversation = conversations.find(c => c.phone === selectedPhone);

  useEffect(() => { threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [selectedPhone, activeConversation?.messages?.length]);

  const handleReply = async () => {
    if (!replyText.trim() || !activeConversation) return;
    setSending(true);
    try {
      const res = await waFetch('/api/whatsapp/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          db_url: tenant?.db_url, tenantId: tenant?.id, to: activeConversation.phone,
          recipientType: 'customer', sendMode: 'manual', freeformText: replyText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setReplyText('');
      await fetchAll();
    } catch (e) {
      showAlert('Could not send reply: ' + (e?.message || 'Unknown error') + ' — free-form replies only work within 24 hours of the customer\'s last message.', { variant: 'danger' });
    } finally {
      setSending(false);
    }
  };

  const timeLabel = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="rw-list wa-inbox flex h-[calc(100vh-64px)] bg-white"><RedwoodSkin /><style>{`.wa-inbox .wa-out{background:var(--rw-accent-soft)!important;color:var(--rw-ink)!important;border:1px solid #E3D6EE!important}.wa-inbox .wa-out div{color:var(--rw-muted)!important}.wa-inbox .wa-send{background:var(--rw-ink)!important;color:#fff!important}.wa-inbox .wa-send:hover{background:var(--rw-accent)!important}.wa-inbox .wa-sel{background:var(--rw-accent-soft)!important;box-shadow:inset 3px 0 0 var(--rw-accent)}.wa-inbox .wa-title{font-family:var(--rw-serif);font-weight:500}`}</style>
      {/* Conversation list */}
      <div className="w-80 flex-shrink-0 border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h2 className="wa-title text-[#1B1A18] text-xl mb-3">💬 WhatsApp Inbox</h2>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search phone or record..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>}
          {!loading && filteredConversations.length === 0 && (
            <div className="p-6 text-center text-gray-400 text-sm">No conversations yet — messages sent or received will appear here.</div>
          )}
          {filteredConversations.map(c => (
            <button key={c.phone} onClick={() => setSelectedPhone(c.phone)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-[#F1EAF6]/50 transition-colors ${selectedPhone === c.phone ? 'wa-sel' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#0F172A] text-sm">+{c.phone}</span>
                <span className="text-[11px] text-gray-400">{timeLabel(c.last.created_at)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {c.last.status === 'failed'
                  ? `⚠️ Failed: ${c.last.error_message || 'Unknown error'}`
                  : `${c.last.direction === 'outbound' ? '↗ ' : '↙ '}${c.last.message_body || '(no content)'}`}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Thread view */}
      <div className="flex-1 flex flex-col">
        {!activeConversation ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Select a conversation to view the full message history.</div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="wa-title text-[#1B1A18] text-lg">+{activeConversation.phone}</h3>
              <p className="text-xs text-gray-400">{activeConversation.messages.length} message{activeConversation.messages.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-[#FAF9F7]">
              {activeConversation.messages.map(m => (
                <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-md rounded-2xl px-4 py-2.5 ${m.direction === 'outbound' ? 'wa-out' : 'bg-white border border-gray-200 text-[#0F172A]'}`}>
                    <p className="text-sm whitespace-pre-wrap">
                      {m.message_body || '(no content logged)'}
                      {m.status === 'failed' && (
                        <span className="block mt-1.5 pt-1.5 border-t border-current/20 font-semibold">⚠️ Failed: {m.error_message || 'Unknown error'}</span>
                      )}
                    </p>
                    <div className={`text-[10px] mt-1 flex items-center gap-1.5 ${m.direction === 'outbound' ? '' : 'text-gray-400'}`}>
                      <span>{timeLabel(m.created_at)}</span>
                      {m.direction === 'outbound' && <span>· {m.status === 'delivered' ? '✓✓ Delivered' : m.status === 'read' ? '✓✓ Read' : m.status === 'failed' ? '✕ Failed' : '✓ Sent'}</span>}
                      {m.record_type && m.record_type !== 'inbound' && <span>· {m.record_type} {m.record_id}</span>}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-2">
              <input value={replyText} onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !sending) handleReply(); }}
                placeholder="Type a reply — only deliverable within 24h of their last message..."
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400" />
              <button onClick={handleReply} disabled={sending || !replyText.trim()}
                className="wa-send text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
