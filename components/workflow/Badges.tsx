// @ts-nocheck

'use client';

import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

// ─── SLA Badge ────────────────────────────────────────────────────────────────

interface SLABadgeProps {
  recordType: string;
  recordId: string;
}

export function SLABadge({ recordType, recordId }: SLABadgeProps) {
  const [slaRecord, setSlaRecord] = useState<any>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('sla_records').select('*')
      .eq('record_type', recordType).eq('record_id', recordId).eq('status', 'Active').single()
      .then(({ data }) => setSlaRecord(data));
  }, [recordId]);

  if (!slaRecord) return null;

  const now = new Date();
  const due = new Date(slaRecord.resolution_due_at);
  const minsLeft = Math.floor((due.getTime() - now.getTime()) / 60000);
  const hoursLeft = Math.floor(minsLeft / 60);
  const isBreached = minsLeft < 0;
  const isWarning = !isBreached && minsLeft < 60;

  const label = isBreached ? 'SLA Breached' : isWarning ? `SLA: ${minsLeft}m left` : `SLA: ${hoursLeft}h left`;
  const color = isBreached ? 'bg-red-100 text-red-700 border-red-200' : isWarning ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-green-100 text-green-700 border-green-200';

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isBreached ? 'bg-red-500' : isWarning ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
      {label}
    </span>
  );
}

// ─── Approval Banner ──────────────────────────────────────────────────────────

interface ApprovalBannerProps {
  recordType: string;
  recordId: string;
}

export function ApprovalBanner({ recordType, recordId }: ApprovalBannerProps) {
  const { approvalRequests, currentUser } = useApp();

  const pending = approvalRequests.find(
    r => r.record_type === recordType && r.record_id === recordId && r.status === 'Pending'
  );

  if (!pending) return null;

  return (
    <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-3 text-sm">
      <span className="text-yellow-500 text-xl">⏳</span>
      <div className="flex-1">
        <span className="font-semibold text-yellow-800">Pending Approval</span>
        <span className="text-yellow-700 ml-2">— Submitted by {pending.submitted_by}</span>
      </div>
      <span className="text-xs text-yellow-500 bg-yellow-100 px-3 py-1 rounded-full font-semibold">{pending.request_number}</span>
    </div>
  );
}
