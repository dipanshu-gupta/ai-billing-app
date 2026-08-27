// @ts-nocheck
'use client';
import { useState, useMemo } from 'react';
import { getStatusColor } from '@/lib/utils';

// A generic, reusable Kanban/board view — one column per status, cards
// draggable between columns to change status. Deliberately knows nothing
// about any specific object type (leads, orders, products, ...): the
// caller supplies the status list, how to read a record's status/id, how
// to render a card's body, and a callback for when a card is dropped into
// a new column. This keeps the board itself simple and reusable across
// every list page, rather than needing a bespoke board per object.
//
// Status changes are PROPOSED here via onStatusChange, never applied
// directly — the actual database write happens in the caller's own
// existing update function (updateRecord / updateRetailRecord), so every
// business rule already enforced there (terminal-status protection,
// tenant scoping, validation) automatically applies to board-driven status
// changes too, exactly as it does for changes made from the table or
// detail view. This component only ever proposes a change; it never
// bypasses the rules that already govern who can move what where.
export default function KanbanBoard({
  records,
  statusOptions,
  getStatus,
  getId,
  onStatusChange,
  onCardClick,
  renderCard,
  accentColor = '#0F172A',
}) {
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [movingId, setMovingId] = useState(null);

  const columns = useMemo(() => {
    const byStatus = {};
    statusOptions.forEach(s => { byStatus[s] = []; });
    // Records with a status value not in the known list (e.g. legacy data,
    // or a status option since removed from configuration) still need to
    // show up SOMEWHERE rather than silently vanishing from the board — an
    // extra trailing column catches these instead of losing them.
    const other = [];
    records.forEach(r => {
      const s = getStatus(r);
      if (byStatus[s]) byStatus[s].push(r);
      else other.push(r);
    });
    const cols = statusOptions.map(s => ({ status: s, records: byStatus[s] }));
    if (other.length) cols.push({ status: null, records: other });
    return cols;
  }, [records, statusOptions, getStatus]);

  const handleDrop = async (newStatus) => {
    setDragOverStatus(null);
    const id = draggedId;
    setDraggedId(null);
    if (!id) return;
    const record = records.find(r => String(getId(r)) === String(id));
    if (!record) return;
    if (getStatus(record) === newStatus) return; // dropped back in the same column
    setMovingId(id);
    try {
      await onStatusChange(record, newStatus);
    } finally {
      setMovingId(null);
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
      {columns.map(col => (
        <div
          key={col.status ?? '__other__'}
          className={`flex-shrink-0 w-72 rounded-2xl transition-colors ${dragOverStatus === col.status ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-gray-50'}`}
          onDragOver={e => { e.preventDefault(); if (col.status) setDragOverStatus(col.status); }}
          onDragLeave={() => setDragOverStatus(prev => (prev === col.status ? null : prev))}
          onDrop={e => { e.preventDefault(); if (col.status) handleDrop(col.status); }}
        >
          <div className="flex items-center justify-between px-3 py-3 sticky top-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${getStatusColor(col.status || 'Other')}`}>
                {col.status || 'Other'}
              </span>
              <span className="text-xs text-gray-400 font-semibold">{col.records.length}</span>
            </div>
          </div>
          <div className="px-2 pb-2 space-y-2 min-h-[80px]">
            {col.records.length === 0 && (
              <div className="text-center text-xs text-gray-300 py-6 select-none">No records</div>
            )}
            {col.records.map(r => {
              const id = getId(r);
              const isMoving = String(movingId) === String(id);
              return (
                <div
                  key={id}
                  draggable={!isMoving}
                  onDragStart={() => setDraggedId(id)}
                  onDragEnd={() => { setDraggedId(null); setDragOverStatus(null); }}
                  onClick={() => onCardClick?.(r)}
                  className={`bg-white rounded-xl border border-gray-200 shadow-sm p-3 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all ${isMoving ? 'opacity-50' : ''} ${String(draggedId) === String(id) ? 'opacity-40' : ''}`}
                  style={{ borderLeft: `3px solid ${accentColor}` }}
                >
                  {renderCard(r)}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
