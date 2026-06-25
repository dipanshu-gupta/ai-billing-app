// @ts-nocheck
'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';

export default function ApprovalBanner({ recordId, recordType, onDecision }) {
  const { currentUser, approvalRequests, processApproval,
    appPreferences, createOrderFromOpportunity,
    checkMatchingApprovalProcess, submitForApproval, fetchLineItems, createQuotationFromOpportunity, convertLeadToOpportunity, createInvoiceFromOrder
  } = useApp();
  const [request,    setRequest]    = useState(null);
  const [step,       setStep]       = useState(null);
  const [isApprover, setIsApprover] = useState(false);
  const [comment,    setComment]    = useState('');
  const [deciding,   setDeciding]   = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!supabase || !currentUser || !recordId) return;
      // Query pending requests — record_id is the text ID (e.g. CUST-xxx, ORD-xxx)
      const { data: reqs } = await supabase.from('approval_requests')
        .select('*').eq('record_id', String(recordId)).eq('record_type', recordType)
        .in('status', ['Pending']).order('submitted_at', { ascending: false }).limit(1);
      if (!reqs?.length) { setRequest(null); setStep(null); setIsApprover(false); return; }
      const req = reqs[0];
      setRequest(req);
      if (req.current_step_id) {
        const { data: stepData } = await supabase.from('approval_steps')
          .select('*').eq('id', req.current_step_id).maybeSingle();
        setStep(stepData || null);
        setIsApprover(!!(stepData && stepData.approver_user_id === currentUser.id));
      } else {
        setStep(null);
        setIsApprover(false);
      }
    };
    load();
  }, [recordId, recordType, currentUser?.id, approvalRequests.length]);

  if (!request) return null;

  const handleDecision = async (decision) => {
    setDeciding(true);
    await processApproval(request.id, decision, comment);
    setComment(''); setDeciding(false);
    if (onDecision) onDecision();
  };

  return (
    <div className={`rounded-[24px] border-2 p-5 ${isApprover ? 'border-yellow-300 bg-yellow-50' : 'border-blue-200 bg-blue-50'}`}>
      <div className="flex items-start gap-4">
        <div className="text-3xl">⏳</div>
        <div className="flex-1">
          <div className="font-bold text-[#0F172A] text-lg mb-1">Pending Approval</div>
          <div className="text-sm text-gray-600 mb-1">Submitted by <span className="font-semibold">{request.submitted_by}</span>
            {step && <span> · Step: <span className="font-semibold">{step.step_name}</span></span>}
          </div>
          <div className="text-xs text-gray-400">Request #{request.request_number}</div>
          {isApprover ? (
            <div className="mt-4 space-y-3">
              <div className="bg-white rounded-2xl border border-yellow-200 p-3">
                <p className="text-sm font-semibold text-yellow-800 mb-2">✋ Your approval is required</p>
                <input value={comment} onChange={e=>setComment(e.target.value)} placeholder="Add a comment (optional)..." className={iCls}/>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>handleDecision('Approved')} disabled={deciding} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-50 shadow-lg">
                  {deciding ? 'Processing...' : '✅ Approve'}
                </button>
                <button onClick={()=>handleDecision('Rejected')} disabled={deciding} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-50 shadow-lg">
                  {deciding ? 'Processing...' : '❌ Reject'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 bg-white rounded-2xl border border-blue-200 px-4 py-3">
              <p className="text-sm text-blue-700">Waiting for approver to review this record.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
