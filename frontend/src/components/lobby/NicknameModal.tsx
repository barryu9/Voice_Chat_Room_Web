import React, { useState, useEffect } from 'react';
import { useUserStore, ConnectionState } from '../../stores/userStore';
import { useRoomStore } from '../../stores/roomStore';
import { getSocket } from '../../services/socketService';
import { EVENTS } from '../../utils/constants';
import { setCookie } from '../../utils/cookies';
import { containsBlockedWord } from '../../utils/blockedWords';
import { TechBackground } from '../common/TechBackground';
import { PreferencesModal } from '../common/SettingsPanel';

interface NicknameModalProps {
  onClose: () => void;
}

const connectionStatusConfig: Record<ConnectionState, { text: string; color: string; icon: string }> = {
  connecting:   { text: '正在连接服务器...',       color: 'text-yellow-400', icon: '⟳' },
  connected:    { text: '服务器已连接',            color: 'text-green-400',  icon: '●' },
  disconnected: { text: '连接已断开，等待重连...', color: 'text-orange-400', icon: '◉' },
  reconnecting: { text: '正在重连...',             color: 'text-yellow-400', icon: '⟳' },
  failed:       { text: '无法连接服务器，请检查网络', color: 'text-red-400',   icon: '✕' },
};

export const NicknameModal: React.FC<NicknameModalProps> = ({ onClose }) => {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPreferences, setShowPreferences] = useState(false);
  const deviceId = useUserStore((s) => s.deviceId);
  const setLogin = useUserStore((s) => s.setLogin);
  const siteName = useRoomStore((s) => s.siteName);
  const version = useRoomStore((s) => s.version);
  const loginFooter = useRoomStore((s) => s.loginFooter);
  const connectionState = useUserStore((s) => s.connectionState);
  const reconnectAttempt = useUserStore((s) => s.reconnectAttempt);

  const cfg = connectionStatusConfig[connectionState];
  const isLoginError = !!(error && !error.includes('违规'));

  // Priority: login error > banned > connection failed
  const statusText = isLoginError ? error : cfg.text;
  const statusColor = isLoginError ? 'text-red-400' : cfg.color;
  const statusIcon = isLoginError ? '✕' : cfg.icon;

  useEffect(() => {
    getSocket()?.emit('site:info');
    const onErr = (data: any) => setError(data.message || '登录失败');
    getSocket()?.on(EVENTS.SERVER.LOGIN_ERROR, onErr);
    const existing = useRoomStore.getState().notification;
    if (existing && existing.includes('登录')) {
      setError(existing);
      useRoomStore.getState().setNotification('');
    }
    return () => { getSocket()?.off(EVENTS.SERVER.LOGIN_ERROR, onErr); };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed || !deviceId) return;

    if (containsBlockedWord(trimmed)) {
      setError('昵称包含违规词汇，请修改');
      return;
    }

    setError('');
    setLoading(true);
    const socket = getSocket();
    if (!socket?.connected) {
      setLoading(false);
      return;
    }

    const onSuccess = (data: any) => {
      setLogin(data.userId, data.nickname, data.deviceId);
      setCookie('vc_nickname', data.nickname);
      setLoading(false);
      onClose();
    };

    const onError = (data: any) => {
      setError(data.message || '登录失败');
      setLoading(false);
    };

    socket.once(EVENTS.SERVER.LOGIN_SUCCESS, onSuccess);
    socket.once(EVENTS.SERVER.LOGIN_ERROR, onError);

    socket.emit(EVENTS.CLIENT.USER_LOGIN, {
      nickname: trimmed,
      deviceId,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <TechBackground />

      <div className="relative w-full max-w-md mx-4">
        <div className="glass-panel p-8 animate-in zoom-in-95 fade-in duration-300">
          <h2 className="text-2xl font-bold text-center mb-1 text-white">欢迎来到</h2>
          <p className="theme-brand-title text-center mb-2 text-lg bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent font-semibold">
            {siteName}
          </p>
          <p className="text-gray-500 text-center mb-6 text-sm">输入昵称开始聊天</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={nickname}
                onChange={(e) => { setNickname(e.target.value); setError(''); }}
                placeholder="输入你的昵称..."
                maxLength={16}
                className="w-full bg-gray-800/60 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                autoFocus
              />
              {error && !isLoginError && (
                <p className="text-red-400 text-xs mt-1.5">{error}</p>
              )}
            </div>

            <div className={`flex items-center gap-2 text-xs ${statusColor} justify-center`}>
                <span className={connectionState === 'reconnecting' || connectionState === 'connecting' ? 'animate-spin inline-block' : ''}>
                  {statusIcon}
                </span>
                <span>
                  {connectionState === 'reconnecting' && reconnectAttempt > 0 && !isLoginError
                    ? `${statusText} (${reconnectAttempt}/120)`
                    : statusText}
                </span>
              </div>

              <button
                type="submit"
                disabled={
                  !nickname.trim() ||
                  !deviceId ||
                  loading ||
                  connectionState === 'connecting' ||
                  connectionState === 'failed' ||
                  isLoginError
                }
                className="w-full bg-primary-600 hover:bg-primary-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-3 rounded-xl transition-all active:scale-[0.98]"
              >
                {loading
                  ? '连接中...'
                  : isLoginError
                    ? '无法登录'
                    : connectionState === 'failed'
                      ? '服务器不可用'
                      : connectionState === 'connecting' || connectionState === 'reconnecting'
                        ? '等待连接...'
                        : '进入聊天室'}
              </button>
          </form>
        </div>

        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setShowPreferences(true)}
            className="text-xs text-primary-400 transition-colors hover:text-primary-300"
          >
            偏好设置
          </button>
        </div>

        {(loginFooter || version) && (
          <div className="mt-4 text-center text-xs text-gray-600 px-4">
            {loginFooter && <span>{loginFooter}</span>}
            {loginFooter && version && <span className="mx-2">|</span>}
            {version && <span>{version}</span>}
          </div>
        )}
      </div>

      {showPreferences && <PreferencesModal onClose={() => setShowPreferences(false)} />}
    </div>
  );
};
