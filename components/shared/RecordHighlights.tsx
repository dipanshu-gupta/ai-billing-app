// @ts-nocheck
'use client';
/** Redwood-style "highlights" strip under a record header: key facts at a glance.
 *  Pure display; fully self-styled (Tailwind classes only) so it never depends on global CSS.
 *  Callers pass already-resolved labels (so Page Layout Designer relabels apply). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default function RecordHighlights({ items }) {
  const shown = (items || []).filter(i => i && i.label);
  if (!shown.length) return null;
  return (
    <div className="grid bg-white border-b border-[#E3DFD9]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
      {shown.map((i, n) => {
        const v = typeof i.value === 'string' && UUID.test(i.value) ? '' : i.value;
        return (
          <div key={i.label} className={`min-w-0 py-3 pr-6 ${n === 0 ? 'pl-8' : 'pl-5 border-l border-[#EEEBE6]'}`}>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[#6F6A62]">{i.label}</div>
            <div className="mt-0.5 text-[15px] font-semibold text-[#1B1A18] truncate" title={typeof v === 'string' ? v : undefined}>
              {v === undefined || v === null || v === '' ? <span className="text-[#9A958C] font-normal">—</span> : v}
            </div>
          </div>
        );
      })}
    </div>
  );
}
