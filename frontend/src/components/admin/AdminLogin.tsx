import React, { useState, useEffect } from 'react';
import { getSocket } from '../../services/socketService';
import { useAdminStore } from '../../stores/adminStore';
import { EVENTS } from '../../utils/constants';

const ADMIN_PASS_KEY = 'vc_admin_pass';

export const AdminLogin: React.FC = () => {
  const [show, setShow] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const isAdmin = useAdminStore((s) => s.isAdmin);

  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_PASS_KEY);
    if (!saved || isAdmin) return;

    const onResult = (data: any) => {
      if (!data.success) localStorage.removeItem(ADMIN_PASS_KEY);
    };

    if (getSocket()?.connected) {
      getSocket()?.once(EVENTS.SERVER.ADMIN_AUTH_RESULT, onResult);
      getSocket()?.emit(EVENTS.CLIENT.ADMIN_AUTH, { password: saved });
    } else {
      getSocket()?.once('connect', () => {
        getSocket()?.once(EVENTS.SERVER.ADMIN_AUTH_RESULT, onResult);
        getSocket()?.emit(EVENTS.CLIENT.ADMIN_AUTH, { password: saved });
      });
    }
  }, [isAdmin]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const socket = getSocket();
    socket?.emit(EVENTS.CLIENT.ADMIN_AUTH, { password });

    socket?.once(EVENTS.SERVER.ADMIN_AUTH_RESULT, (data: any) => {
      if (data.success) {
        localStorage.setItem(ADMIN_PASS_KEY, password);
        setShow(false);
        setPassword('');
      } else {
        setError('密码错误');
      }
    });
  };

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        title="管理员"
        className="p-3 sm:p-2 bg-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/10 rounded-lg transition-all"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 fade-in">
        <h3 className="text-lg font-semibold text-white mb-4">管理员认证</h3>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入管理员密码"
            className="w-full bg-gray-800/60 border border-gray-600/50 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 transition-all"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShow(false); setPassword(''); setError(''); }}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2.5 rounded-xl transition-all"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!password}
              className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm py-2.5 rounded-xl transition-all"
            >
              确认
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
