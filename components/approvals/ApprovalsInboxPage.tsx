// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { formatDateTime, getStatusColor } from '@/lib/utils';

export default function ApprovalsInboxPage() {
  const { currentUser, approvalRequests, processApproval, fetchApprovalRequests } = useApp();
  const [myRequests,  setMyRequests]  = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [tab,         setTab]         = useState('mine');
  const [comment,     setComment]     = useState({});
  const [deciding,    setDeciding]    = useState(null);
  const [loading,     setLoading]     = useState(true);

  const load = async () => {
    if (!supabase || !currentUser) return;
    setLoading(true);
    const { data: pending } = await supabase.from('approval_requests').select('*').eq('status','Pending').order('submitted_at',{ascending:false});
    const approvable = [];
    for (const req of (pending||[])) {
      const { data: step } = await supabase.from('approval_steps').select('*').eq('id', req.current_step_id).single();
      if (step?.approver_user_id === currentUser.id) approvable.push({ ...req, step });
    }
    setMyRequests(approvable);
    const { data: mine } = await supabase.from('approval_requests').select('*').eq('submitted_by', currentUser.email).order('submitted_at',{ascending:false});
    setAllRequests(mine||[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentUser?.id, approvalRequests.length]);

  const handleDecision = async (requestId, decision) => {
    setDeciding(requestId);
    await processApproval(requestId, decision, comment[requestId]||'');
    setComment(p => ({...p,[requestId]:''}));
    setDeciding(null);
    await fetchApprovalRequests();
    setMyRequests(p => p.filter(r => r.id !== requestId));
  };

  const Pill = ({ status }) => <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>{status}</span>;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[28px] p-6 text-white flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Approvals Inbox</h1><p className="text-blue-200 mt-1">Review and act on approval requests</p></div>
        {myRequests.length>0&&<div className="bg-yellow-400 text-[#0F172A] px-5 py-2.5 rounded-2xl font-bold text-lg">{myRequests.length} Pending</div>}
      </div>

      <div className="flex gap-3">
        {[{key:'mine',label:'Requires My Action',count:myRequests.length},{key:'submitted',label:'Submitted by Me',count:allRequests.length}].map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold transition-all ${tab===t.key?'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white shadow-lg':'bg-white border border-blue-100 text-[#0F172A] hover:border-blue-300'}`}>
            {t.label}
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${tab===t.key?'bg-white/20 text-white':t.count>0?'bg-yellow-100 text-yellow-700':'bg-blue-100 text-blue-700'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {loading&&<div className="bg-white rounded-[24px] border border-blue-100 p-12 text-center text-gray-400"><div className="text-4xl mb-3 animate-pulse">⏳</div>Loading approvals...</div>}

      {!loading&&tab==='mine'&&(
        <div className="space-y-4">
          {myRequests.length===0
            ? <div className="bg-white rounded-[24px] border border-blue-100 p-16 text-center"><div className="text-6xl mb-4">✅</div><h2 className="text-xl font-bold text-[#0F172A] mb-2">All caught up!</h2><p className="text-gray-400">No approval requests waiting for your action.</p></div>
            : myRequests.map(req=>(
              <div key={req.id} className="bg-white rounded-[24px] border-2 border-yellow-200 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 px-6 py-4 border-b border-yellow-200">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-[#0F172A] text-xl">{req.record_name}</h3>
                    <Pill status={req.status}/>
                    {req.step&&<span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-3 py-1 rounded-full">Step {req.step.step_number}: {req.step.step_name}</span>}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                    <span>📁 <span className="font-medium text-[#0F172A] capitalize">{req.record_type}</span></span>
                    <span>🔢 {req.request_number}</span>
                    <span>👤 Submitted by <span className="font-medium text-[#0F172A]">{req.submitted_by}</span></span>
                    <span>📅 {formatDateTime(req.submitted_at)}</span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">Comment (optional)</label>
                    <textarea rows={2} value={comment[req.id]||''} onChange={e=>setComment(p=>({...p,[req.id]:e.target.value}))} placeholder="Add a comment explaining your decision..." className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"/>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={()=>handleDecision(req.id,'Approved')} disabled={deciding===req.id} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-50 shadow-lg flex items-center justify-center gap-2 transition-all">
                      <span className="text-xl">✅</span>{deciding===req.id?'Processing...':'Approve'}
                    </button>
                    <button onClick={()=>handleDecision(req.id,'Rejected')} disabled={deciding===req.id} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-50 shadow-lg flex items-center justify-center gap-2 transition-all">
                      <span className="text-xl">❌</span>{deciding===req.id?'Processing...':'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {!loading&&tab==='submitted'&&(
        <div className="bg-white rounded-[24px] border border-blue-100 shadow overflow-hidden">
          {allRequests.length===0
            ? <div className="p-16 text-center"><div className="text-5xl mb-3">📋</div><p className="text-gray-400">No approval requests submitted yet.</p></div>
            : <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-[#0F172A] to-blue-900 text-white"><tr>{['Request #','Record','Type','Submitted','Status'].map(h=><th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>)}</tr></thead>
                <tbody>{allRequests.map(req=>(
                  <tr key={req.id} className="border-t border-blue-50 hover:bg-blue-50/40">
                    <td className="px-5 py-4 font-mono text-xs text-gray-400">{req.request_number}</td>
                    <td className="px-5 py-4 font-semibold text-[#0F172A]">{req.record_name}</td>
                    <td className="px-5 py-4 capitalize text-gray-500">{req.record_type}</td>
                    <td className="px-5 py-4 text-gray-500">{formatDateTime(req.submitted_at)}</td>
                    <td className="px-5 py-4"><Pill status={req.status}/></td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      )}
    </div>
  );
}
