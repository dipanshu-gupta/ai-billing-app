// @ts-nocheck
'use client';

import { useState, useRef, useEffect } from 'react';
import { getStatusColor } from '@/lib/utils';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>
      {status}
    </span>
  );
}

interface Action { label: string; onClick: () => void; danger?: boolean; hidden?: boolean; }

export function ActionMenu({ actions, triggerClass }: { actions: Action[]; triggerClass?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className={triggerClass || 'w-10 h-10 rounded-full bg-[#0F172A] text-white hover:bg-blue-800 flex items-center justify-center text-xl font-bold shadow-lg'}>⋮</button>
      {open && (
        <div className="absolute right-0 top-12 bg-[#0F172A] border border-blue-800 shadow-2xl rounded-2xl p-2 z-[999] min-w-[200px]">
          {actions.filter(a => !a.hidden).map((a, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); a.onClick(); setOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${a.danger ? 'hover:bg-red-500/20 text-red-300' : 'hover:bg-blue-800 text-white'}`}>{a.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, subtitle, action }: { icon: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-[#0F172A] mb-2">{title}</h3>
      {subtitle && <p className="text-gray-500 mb-6 max-w-sm">{subtitle}</p>}
      {action}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-[#0F172A]">{title}</h2>
        {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function AdminCard({ title, subtitle, badge, badgeColor = 'bg-green-100 text-green-700', details = [], actions, onClick, children }: any) {
  return (
    <div onClick={onClick} className={`relative bg-white rounded-[28px] p-6 border border-blue-100 shadow-lg ${onClick ? 'cursor-pointer hover:scale-[1.01] transition-all' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div onClick={(e) => e.stopPropagation()}>
            <ActionMenu actions={actions} triggerClass="w-9 h-9 rounded-xl hover:bg-gray-100 text-[#0F172A] text-lg flex items-center justify-center" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#0F172A]">{title}</h3>
            {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
          </div>
        </div>
        {badge && <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeColor}`}>{badge}</span>}
      </div>
      {details.length > 0 && (
        <div className="space-y-2 text-sm text-gray-600 border-t border-blue-50 pt-4">
          {details.map((d: any, i: number) => (
            <div key={i}><span className="text-gray-400">{d.label}:</span> <span className="font-medium text-[#0F172A]">{d.value || '-'}</span></div>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

interface ButtonProps { onClick?: () => void; children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'sm' | 'md' | 'lg'; disabled?: boolean; type?: 'button' | 'submit'; className?: string; }
const variantClass: Record<string, string> = { primary: 'bg-gradient-to-r from-[#0F172A] to-blue-800 text-white hover:opacity-90 shadow-lg', secondary: 'bg-white border border-blue-200 text-[#0F172A] hover:bg-blue-50', danger: 'bg-red-500 hover:bg-red-600 text-white', ghost: 'bg-transparent text-[#0F172A] hover:bg-gray-100' };
const sizeClass: Record<string, string> = { sm: 'px-4 py-2 text-sm rounded-xl', md: 'px-6 py-3 text-sm rounded-2xl', lg: 'px-8 py-4 text-base rounded-2xl' };

export function Button({ onClick, children, variant = 'primary', size = 'md', disabled, type = 'button', className = '' }: ButtonProps) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`font-semibold transition-all ${variantClass[variant]} ${sizeClass[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-[28px] border border-blue-100 shadow-lg p-6 ${className}`}>{children}</div>;
}

export const inputClass = 'w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400 text-sm';
export const selectClass = 'w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm';
export const textareaClass = 'w-full border border-blue-200 rounded-2xl px-4 py-3 text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400 text-sm resize-none';