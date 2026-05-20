// @ts-nocheck

'use client';


import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { formatDateTime, timeAgo, formatFileSize } from '@/lib/utils';
import { EmptyState, inputClass, textareaClass, Button } from '@/components/shared';

interface CollabProps {
  recordType: string;
  recordId: string;
  recordName: string;
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

function NotesTab({ recordType, recordId, recordName }: CollabProps) {
  const { currentUser, buildSystemFields } = useApp();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from('record_notes').select('*')
      .eq('record_type', recordType).eq('record_id', recordId)
      .order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    setNotes(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [recordId]);

  const save = async () => {
    if (!supabase || !currentUser || !form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    if (editingId) {
      await supabase.from('record_notes').update({ title: form.title, body: form.body, updated_at: new Date().toISOString() }).eq('id', editingId);
    } else {
      await supabase.from('record_notes').insert([{
        record_type: recordType, record_id: recordId,
        title: form.title, body: form.body, is_pinned: false,
        created_by: currentUser.email, created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        organization_id: currentUser.organization_id, business_unit_id: currentUser.business_unit_id,
      }]);
    }
    setForm({ title: '', body: '' }); setEditingId(null); setShowForm(false);
    await fetch(); setSaving(false);
  };

  const togglePin = async (id: string, pinned: boolean) => {
    if (!supabase) return;
    await supabase.from('record_notes').update({ is_pinned: !pinned }).eq('id', id);
    await fetch();
  };

  const deleteNote = async (id: string) => {
    if (!supabase || !window.confirm('Delete this note?')) return;
    await supabase.from('record_notes').delete().eq('id', id);
    await fetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#0F172A]">Notes ({notes.length})</h3>
        <Button size="sm" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ title: '', body: '' }); }}>
          {showForm ? 'Cancel' : '+ Add Note'}
        </Button>
      </div>

      {showForm && (
        <div className="bg-blue-50 rounded-2xl p-5 space-y-3">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Note title" className={inputClass} />
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Write your note..." rows={4} className={textareaClass} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update Note' : 'Save Note'}</Button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-8 text-gray-400">Loading notes...</div> : notes.length === 0 ? (
        <EmptyState icon="📝" title="No notes yet" subtitle="Add a note to capture important information." />
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className={`rounded-2xl border p-5 ${note.is_pinned ? 'border-yellow-300 bg-yellow-50' : 'border-blue-100 bg-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {note.is_pinned && <span className="text-yellow-500 text-sm">📌</span>}
                    <h4 className="font-bold text-[#0F172A]">{note.title}</h4>
                  </div>
                  <p className="text-gray-600 text-sm mt-2 leading-relaxed whitespace-pre-wrap">{note.body}</p>
                  <div className="text-xs text-gray-400 mt-3">{note.created_by} · {timeAgo(note.created_at)}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => togglePin(note.id, note.is_pinned)} title={note.is_pinned ? 'Unpin' : 'Pin'} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-sm">
                    {note.is_pinned ? '📌' : '📍'}
                  </button>
                  {note.created_by === currentUser?.email && (
                    <>
                      <button onClick={() => { setForm({ title: note.title, body: note.body }); setEditingId(note.id); setShowForm(true); }} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-sm">✏️</button>
                      <button onClick={() => deleteNote(note.id)} className="w-8 h-8 rounded-lg hover:bg-red-100 flex items-center justify-center text-sm">🗑️</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Comments Tab ─────────────────────────────────────────────────────────────

function CommentsTab({ recordType, recordId }: CollabProps) {
  const { currentUser, enterpriseUsers, createNotification } = useApp();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetch = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from('record_comments').select('*')
      .eq('record_type', recordType).eq('record_id', recordId)
      .order('created_at', { ascending: true });
    setComments(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [recordId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments]);

  const extractMentions = (text: string): string[] => {
    const matches = text.match(/@(\S+)/g) || [];
    return matches.map(m => m.slice(1));
  };

  const post = async () => {
    if (!supabase || !currentUser || !body.trim()) return;
    setPosting(true);
    const mentions = extractMentions(body);
    await supabase.from('record_comments').insert([{
      record_type: recordType, record_id: recordId, parent_comment_id: null,
      body, mentions, created_by: currentUser.email, created_at: new Date().toISOString(),
      organization_id: currentUser.organization_id, business_unit_id: currentUser.business_unit_id,
    }]);
    for (const mention of mentions) {
      const user = enterpriseUsers.find(u => u.username === mention || u.email.startsWith(mention));
      if (user && user.email !== currentUser.email) {
        await createNotification({ recipientEmail: user.email, type: 'mention', title: `${currentUser.first_name} mentioned you`, body: body.substring(0, 100), recordType, recordId });
      }
    }
    setBody('');
    await fetch(); setPosting(false);
  };

  const deleteComment = async (id: string) => {
    if (!supabase) return;
    await supabase.from('record_comments').delete().eq('id', id);
    await fetch();
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <h3 className="font-bold text-[#0F172A]">Comments ({comments.length})</h3>
      <div className="flex-1 space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : comments.length === 0 ? (
          <EmptyState icon="💬" title="No comments yet" subtitle="Start the conversation." />
        ) : (
          comments.map(c => {
            const isMe = c.created_by === currentUser?.email;
            const initials = c.created_by?.split('@')[0]?.slice(0, 2).toUpperCase();
            return (
              <div key={c.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isMe ? 'bg-[#0F172A] text-white' : 'bg-blue-100 text-blue-700'}`}>{initials}</div>
                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isMe ? 'bg-[#0F172A] text-white rounded-tr-sm' : 'bg-gray-100 text-[#0F172A] rounded-tl-sm'}`}>
                    {c.body}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{isMe ? 'You' : c.created_by?.split('@')[0]} · {timeAgo(c.created_at)}</span>
                    {isMe && <button onClick={() => deleteComment(c.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-3 border-t border-blue-100 pt-4">
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); } }}
          placeholder="Write a comment... use @username to mention"
          className={`${inputClass} flex-1`}
        />
        <Button onClick={post} disabled={posting || !body.trim()} size="sm">Send</Button>
      </div>
    </div>
  );
}

// ─── Attachments Tab ──────────────────────────────────────────────────────────

function AttachmentsTab({ recordType, recordId }: CollabProps) {
  const { currentUser } = useApp();
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetch = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from('record_attachments').select('*')
      .eq('record_type', recordType).eq('record_id', recordId)
      .order('uploaded_at', { ascending: false });
    setAttachments(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [recordId]);

  const upload = async (files: FileList | null) => {
    if (!supabase || !currentUser || !files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const path = `${recordType}/${recordId}/${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage.from('record-attachments').upload(path, file);
      if (storageError) { alert(`Upload failed: ${storageError.message}`); continue; }
      await supabase.from('record_attachments').insert([{
        record_type: recordType, record_id: recordId,
        file_name: file.name, file_size: file.size, file_type: file.type,
        storage_path: path, uploaded_by: currentUser.email,
        uploaded_at: new Date().toISOString(),
        organization_id: currentUser.organization_id, business_unit_id: currentUser.business_unit_id,
      }]);
    }
    await fetch(); setUploading(false);
  };

  const download = async (attachment: any) => {
    if (!supabase) return;
    const { data } = await supabase.storage.from('record-attachments').createSignedUrl(attachment.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const deleteAttachment = async (id: string, path: string) => {
    if (!supabase || !window.confirm('Delete this attachment?')) return;
    await supabase.storage.from('record-attachments').remove([path]);
    await supabase.from('record_attachments').delete().eq('id', id);
    await fetch();
  };

  const fileIcon = (type: string): string => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    if (type.includes('word') || type.includes('document')) return '📝';
    return '📎';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#0F172A]">Attachments ({attachments.length})</h3>
        <div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => upload(e.target.files)} />
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading...' : '+ Upload Files'}
          </Button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-blue-200 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files); }}
      >
        <div className="text-4xl mb-2">📁</div>
        <p className="text-gray-500 text-sm">Drag & drop files here or click to upload</p>
      </div>

      {loading ? <div className="text-center py-4 text-gray-400">Loading...</div> : attachments.length === 0 ? null : (
        <div className="space-y-2">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-4 p-4 bg-white border border-blue-100 rounded-2xl hover:bg-blue-50 transition-all">
              <span className="text-2xl">{fileIcon(att.file_type)}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#0F172A] text-sm truncate">{att.file_name}</div>
                <div className="text-xs text-gray-400 mt-1">{formatFileSize(att.file_size)} · {att.uploaded_by} · {timeAgo(att.uploaded_at)}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => download(att)} className="w-8 h-8 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm flex items-center justify-center" title="Download">⬇️</button>
                <button onClick={() => deleteAttachment(att.id, att.storage_path)} className="w-8 h-8 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-sm flex items-center justify-center" title="Delete">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ recordType, recordId }: CollabProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    supabase.from('audit_log').select('*')
      .eq('record_type', recordType).eq('record_id', recordId)
      .order('performed_at', { ascending: false })
      .then(({ data }) => { setLogs(data || []); setLoading(false); });
  }, [recordId]);

  const actionIcon: Record<string, string> = {
    created: '✅', updated: '✏️', deleted: '🗑️', status_changed: '🔄',
    converted_to_opportunity: '🔀', converted_to_order: '🔀', converted_to_invoice: '🔀',
    submitted_for_approval: '📋', approval_approved: '✅', approval_rejected: '❌',
  };

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-[#0F172A]">Audit History ({logs.length})</h3>
      {loading ? <div className="text-center py-8 text-gray-400">Loading history...</div> : logs.length === 0 ? (
        <EmptyState icon="📋" title="No history yet" subtitle="Activity will appear here as changes are made." />
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-blue-100" />
          <div className="space-y-4">
            {logs.map(log => (
              <div key={log.id} className="flex gap-4 relative">
                <div className="w-8 h-8 rounded-full bg-white border-2 border-blue-200 flex items-center justify-center text-sm flex-shrink-0 z-10">
                  {actionIcon[log.action] || '📌'}
                </div>
                <div className="flex-1 bg-white border border-blue-100 rounded-2xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-semibold text-[#0F172A] text-sm capitalize">{log.action.replace(/_/g, ' ')}</span>
                      {log.field_changed && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{log.field_changed}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-3">{timeAgo(log.performed_at)}</span>
                  </div>
                  {log.old_value && log.new_value && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="bg-red-50 text-red-600 px-2 py-1 rounded-lg line-through">{log.old_value}</span>
                      <span className="text-gray-400">→</span>
                      <span className="bg-green-50 text-green-600 px-2 py-1 rounded-lg">{log.new_value}</span>
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-2">{log.performed_by} · {formatDateTime(log.performed_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Approval Tab ─────────────────────────────────────────────────────────────

function ApprovalTab({ recordType, recordId, recordName }: CollabProps) {
  const { approvalRequests, approvalProcesses, submitForApproval, processApproval, currentUser } = useApp();
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);

  const requests = approvalRequests.filter(r => r.record_type === recordType && r.record_id === recordId);
  const hasActiveProcess = approvalProcesses.some(p => p.object_type === recordType && p.is_active);
  const pendingRequest = requests.find(r => r.status === 'Pending');

  const handle = async (decision: 'Approved' | 'Rejected') => {
    if (!pendingRequest) return;
    setProcessing(true);
    await processApproval(pendingRequest.id, decision, comment);
    setComment(''); setProcessing(false);
  };

  const statusColor: Record<string, string> = {
    Pending: 'bg-yellow-100 text-yellow-700', Approved: 'bg-green-100 text-green-700', Rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#0F172A]">Approvals</h3>
        {hasActiveProcess && !pendingRequest && (
          <Button size="sm" onClick={() => submitForApproval(recordType, recordId, recordName)}>Submit for Approval</Button>
        )}
      </div>

      {pendingRequest && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-yellow-500 text-xl">⏳</span>
            <div>
              <div className="font-bold text-[#0F172A]">Pending Approval</div>
              <div className="text-sm text-gray-500">Submitted by {pendingRequest.submitted_by}</div>
            </div>
          </div>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment (optional)" rows={3} className={textareaClass} />
          <div className="flex gap-3">
            <Button onClick={() => handle('Approved')} disabled={processing} className="flex-1">✅ Approve</Button>
            <Button variant="danger" onClick={() => handle('Rejected')} disabled={processing} className="flex-1">❌ Reject</Button>
          </div>
        </div>
      )}

      {requests.length === 0 ? (
        <EmptyState icon="📋" title="No approval history" subtitle={hasActiveProcess ? 'Submit this record for approval.' : 'No approval process is configured for this record type.'} />
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="bg-white border border-blue-100 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#0F172A] text-sm">{req.request_number}</div>
                  <div className="text-xs text-gray-400 mt-1">Submitted by {req.submitted_by} · {timeAgo(req.submitted_at)}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor[req.status] || 'bg-gray-100 text-gray-600'}`}>{req.status}</span>
              </div>
              {req.comments && <div className="mt-2 text-sm text-gray-600 border-t border-blue-50 pt-2">{req.comments}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Collaboration Tabs Wrapper ───────────────────────────────────────────────

const TABS = [
  { key: 'feed', label: '💬 Feed' },
  { key: 'notes', label: '📝 Notes' },
  { key: 'attachments', label: '📎 Files' },
  { key: 'approvals', label: '✅ Approvals' },
  { key: 'history', label: '📋 History' },
];

export default function CollaborationTabs({ recordType, recordId, recordName }: CollabProps) {
  const [activeTab, setActiveTab] = useState('feed');

  return (
    <div className="bg-white rounded-[28px] border border-blue-100 shadow-lg overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-blue-100 overflow-x-auto bg-gray-50 px-4 pt-3 gap-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-t-xl text-sm font-semibold whitespace-nowrap transition-all ${activeTab === tab.key ? 'bg-white text-[#0F172A] border border-b-white border-blue-100 -mb-px' : 'text-gray-500 hover:text-[#0F172A]'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'feed' && <CommentsTab recordType={recordType} recordId={recordId} recordName={recordName} />}
        {activeTab === 'notes' && <NotesTab recordType={recordType} recordId={recordId} recordName={recordName} />}
        {activeTab === 'attachments' && <AttachmentsTab recordType={recordType} recordId={recordId} recordName={recordName} />}
        {activeTab === 'approvals' && <ApprovalTab recordType={recordType} recordId={recordId} recordName={recordName} />}
        {activeTab === 'history' && <HistoryTab recordType={recordType} recordId={recordId} recordName={recordName} />}
      </div>
    </div>
  );
}
