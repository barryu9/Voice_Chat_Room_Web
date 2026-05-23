import React, { useState } from 'react';
import { getSocket } from '../../services/socketService';
import { EVENTS } from '../../utils/constants';

export const AdminLogin: React.FC = () => {
  const [show, setShow] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const socket = getSocket();
    socket?.emit(EVENTS.CLIENT.ADMIN_AUTH, { password });

    socket?.once(EVENTS.SERVER.ADMIN_AUTH_RESULT, (data: any) => {
      if (data.success) {
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
        className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
      >
        管理员
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
