// @ts-nocheck
'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { timeAgo } from '@/lib/utils';

export default function Header({ onToggleSidebar, onOpenProfile }) {
  const { currentUser, notifications, unreadCount, markNotificationRead, markAllNotificationsRead, handleLogout } = useApp();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-[#0F172A] via-blue-900 to-blue-950 border-b border-blue-800 shadow-2xl">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onToggleSidebar} className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl transition-all">☰</button>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Business Pro</h1>
            <p className="text-xs text-blue-300">Enterprise CRM Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-3 relative">
          <div className="relative">
            <button onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }} className="relative w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl transition-all">
              🔔
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-14 w-96 bg-white rounded-3xl shadow-2xl border border-blue-100 overflow-hidden z-50">
                <div className="px-5 py-4 border-b border-blue-100 flex items-center justify-between">
                  <h3 className="font-bold text-[#0F172A]">Notifications</h3>
                  {unreadCount > 0 && <button onClick={markAllNotificationsRead} className="text-xs text-blue-600 font-semibold hover:underline">Mark all read</button>}
                </div>
                <div className="max-h-[400px] overflow-y-auto divide-y divide-blue-50">
                  {notifications.length === 0
                    ? <div className="p-6 text-center text-gray-400 text-sm">No notifications</div>
                    : notifications.slice(0, 20).map(n => (
                      <button key={n.id} onClick={() => markNotificationRead(n.id)} className={`w-full text-left px-5 py-4 hover:bg-blue-50 transition-all ${!n.is_read ? 'bg-blue-50/50' : ''}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${!n.is_read ? 'bg-blue-500' : 'bg-gray-300'}`} />
                          <div>
                            <div className="font-semibold text-[#0F172A] text-sm">{n.title}</div>
                            <div className="text-gray-500 text-xs mt-1">{n.body}</div>
                            <div className="text-gray-400 text-xs mt-2">{timeAgo(n.created_at)}</div>
                          </div>
                        </div>
                      </button>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }} className="flex items-center gap-3 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-2xl transition-all">
              <div className="w-9 h-9 rounded-xl bg-white text-[#0F172A] flex items-center justify-center font-bold text-sm">
                {currentUser?.first_name?.charAt(0)}{currentUser?.last_name?.charAt(0) || ''}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-semibold text-white">{currentUser?.first_name} {currentUser?.last_name}</div>
                <div className="text-xs text-blue-300">{currentUser?.designation || 'Employee'}</div>
              </div>
              <span className="text-white/60 text-xs">▾</span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-14 w-64 bg-white rounded-3xl shadow-2xl border border-blue-100 overflow-hidden z-50">
                <div className="p-5 border-b border-blue-100">
                  <div className="font-bold text-[#0F172A]">{currentUser?.first_name} {currentUser?.last_name}</div>
                  <div className="text-sm text-gray-500 mt-1">{currentUser?.email}</div>
                </div>
                <button onClick={() => { setProfileOpen(false); onOpenProfile(); }} className="w-full text-left px-5 py-4 hover:bg-blue-50 text-[#0F172A] text-sm font-medium">👤 My Profile</button>
                <div className="border-t border-blue-100" />
                <button onClick={() => { setProfileOpen(false); handleLogout(); }} className="w-full text-left px-5 py-4 hover:bg-red-50 text-red-600 text-sm font-medium">🚪 Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}