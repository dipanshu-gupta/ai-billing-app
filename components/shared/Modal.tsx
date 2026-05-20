// @ts-nocheck
'use client';

export default function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  if (!open) return null;

  const sizeClass = {
    sm:   'max-w-md',
    md:   'max-w-2xl',
    lg:   'max-w-4xl',
    xl:   'max-w-6xl',
    full: 'max-w-[96vw]',
  }[size] || 'max-w-2xl';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-auto">
      <div className={`bg-white rounded-[32px] shadow-2xl border border-blue-100 w-full ${sizeClass} max-h-[95vh] flex flex-col`}>
        <div className="px-8 py-6 border-b border-blue-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-[#0F172A]">{title}</h2>
            {subtitle && <p className="text-gray-500 mt-1 text-sm">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-gray-100 hover:bg-gray-200 text-[#0F172A] font-bold text-lg flex items-center justify-center transition-all"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-8">{children}</div>
        {footer && (
          <div className="px-8 py-5 border-t border-blue-100 flex justify-end gap-3 flex-shrink-0 bg-white rounded-b-[32px]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
