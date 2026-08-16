// @ts-nocheck
'use client';
import { createContext, useContext, useState, useCallback, useRef } from 'react';

// Replaces window.alert()/window.confirm() everywhere in the app with a
// branded, non-blocking modal. Two APIs:
//   showAlert(message, { title?, variant? })              — fire-and-forget notice
//   showConfirm(message, { title?, confirmLabel?, cancelLabel?, variant? })
//     → Promise<boolean> — resolves true if confirmed, false if cancelled/dismissed
//
// Both accept a `variant` of 'info' | 'success' | 'warning' | 'danger' which
// controls the icon/color. Multiple calls queue — only one dialog shows at a
// time, next one opens as soon as the current one is dismissed.

const AlertContext = createContext(null);

const VARIANT_META = {
  info:    { icon: 'ℹ️', ring: 'ring-blue-100',   accent: 'bg-blue-600 hover:bg-blue-700' },
  success: { icon: '✅', ring: 'ring-green-100',  accent: 'bg-green-600 hover:bg-green-700' },
  warning: { icon: '⚠️', ring: 'ring-amber-100',  accent: 'bg-amber-500 hover:bg-amber-600' },
  danger:  { icon: '🚫', ring: 'ring-red-100',    accent: 'bg-red-600 hover:bg-red-700' },
};

export function AlertProvider({ children }) {
  const [queue, setQueue] = useState([]); // [{ id, kind:'alert'|'confirm', message, title, variant, confirmLabel, cancelLabel, resolve }]
  const idRef = useRef(0);

  const push = useCallback((entry) => {
    const id = ++idRef.current;
    return new Promise((resolve) => {
      setQueue((q) => [...q, { id, resolve, ...entry }]);
    });
  }, []);

  const showAlert = useCallback((message, opts = {}) => {
    return push({ kind: 'alert', message, title: opts.title || null, variant: opts.variant || 'info' });
  }, [push]);

  const showConfirm = useCallback((message, opts = {}) => {
    return push({
      kind: 'confirm', message, title: opts.title || 'Please confirm', variant: opts.variant || 'warning',
      confirmLabel: opts.confirmLabel || 'Confirm', cancelLabel: opts.cancelLabel || 'Cancel',
    });
  }, [push]);

  const current = queue[0] || null;

  const dismiss = (result) => {
    if (!current) return;
    current.resolve(result);
    setQueue((q) => q.slice(1));
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {current && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => current.kind === 'alert' && dismiss(true)}>
          <div onClick={(e) => e.stopPropagation()} className={`bg-white rounded-[24px] shadow-2xl w-full max-w-sm overflow-hidden ring-8 ${VARIANT_META[current.variant].ring}`}>
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="text-4xl mb-3">{VARIANT_META[current.variant].icon}</div>
              {current.title && <h3 className="text-lg font-bold text-[#0F172A] mb-1.5">{current.title}</h3>}
              <p className="text-gray-500 text-sm leading-relaxed whitespace-pre-line">{current.message}</p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              {current.kind === 'confirm' && (
                <button onClick={() => dismiss(false)} className="flex-1 px-4 py-2.5 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  {current.cancelLabel}
                </button>
              )}
              <button
                onClick={() => dismiss(true)}
                className={`flex-1 px-4 py-2.5 rounded-2xl text-sm font-bold text-white shadow-lg ${VARIANT_META[current.variant].accent}`}
              >
                {current.kind === 'confirm' ? current.confirmLabel : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    // Defensive fallback so a missing provider never hard-crashes the app —
    // falls back to native dialogs instead of throwing.
    return {
      showAlert: (msg) => { window.alert(msg); return Promise.resolve(true); },
      showConfirm: (msg) => Promise.resolve(window.confirm(msg)),
    };
  }
  return ctx;
}
