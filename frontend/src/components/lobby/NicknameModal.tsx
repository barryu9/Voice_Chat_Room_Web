import React, { useState, useEffect } from 'react';
import { useUserStore } from '../../stores/userStore';
import { useRoomStore } from '../../stores/roomStore';
import { getSocket } from '../../services/socketService';
import { EVENTS } from '../../utils/constants';
import { setCookie } from '../../utils/cookies';
import { TechBackground } from '../common/TechBackground';

interface NicknameModalProps {
  onClose: () => void;
}

export const NicknameModal: React.FC<NicknameModalProps> = ({ onClose }) => {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const deviceId = useUserStore((s) => s.deviceId);
  const setLogin = useUserStore((s) => s.setLogin);
  const siteName = useRoomStore((s) => s.siteName);
  const version = useRoomStore((s) => s.version);
  const loginFooter = useRoomStore((s) => s.loginFooter);

  useEffect(() => {
    getSocket()?.emit('site:info');
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !deviceId) return;

    setLoading(true);
    const socket = getSocket();
    if (!socket?.connected) {
      setLoading(false);
      return;
    }

    socket.emit(EVENTS.CLIENT.USER_LOGIN, {
      nickname: nickname.trim(),
      deviceId,
    });

    const onSuccess = (data: any) => {
      setLogin(data.userId, data.nickname, data.deviceId);
      setCookie('vc_nickname', data.nickname);
      setLoading(false);
      onClose();
    };

    socket.once(EVENTS.SERVER.LOGIN_SUCCESS, onSuccess);
    socket.once(EVENTS.SERVER.LOGIN_ERROR, () => setLoading(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <TechBackground />

      <div className="relative w-full max-w-md mx-4">
        <div className="glass-panel p-8 animate-in zoom-in-95 fade-in duration-300">
          <h2 className="text-2xl font-bold text-center mb-1 text-white">欢迎来到</h2>
          <p className="text-center mb-2 text-lg bg-gradient-to-r from-primary-400 to-violet-400 bg-clip-text text-transparent font-semibold">
            {siteName}
          </p>
          <p className="text-gray-500 text-center mb-6 text-sm">输入昵称开始聊天</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="输入你的昵称..."
                maxLength={16}
                className="w-full bg-gray-800/60 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!nickname.trim() || !deviceId || loading}
              className="w-full bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-500 hover:to-violet-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-medium py-3 rounded-xl transition-all active:scale-[0.98]"
            >
              {loading ? '连接中...' : '进入聊天室'}
            </button>
          </form>
        </div>

        {(loginFooter || version) && (
          <div className="mt-4 text-center text-xs text-gray-600 px-4">
            {loginFooter && <span>{loginFooter}</span>}
            {loginFooter && version && <span className="mx-2">|</span>}
            {version && <span>{version}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
