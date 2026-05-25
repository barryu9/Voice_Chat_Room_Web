import React, { useEffect, useState } from 'react';
import { useRoomStore } from '../../stores/roomStore';
import { useUserStore, ConnectionState } from '../../stores/userStore';
import { useAdminStore } from '../../stores/adminStore';
import { useMediaStore } from '../../stores/mediaStore';
import { getSocket } from '../../services/socketService';
import { EVENTS } from '../../utils/constants';
import { deleteCookie, getCookie, setCookie } from '../../utils/cookies';
import { containsBlockedWord } from '../../utils/blockedWords';
import { ChannelCard } from './ChannelCard';
import { NicknameModal } from './NicknameModal';
import { AdminLogin } from '../admin/AdminLogin';
import { Announcement } from '../common/Announcement';
import { TechBackground } from '../common/TechBackground';
import { SoundSettings } from '../common/SoundSettings';

export const Lobby: React.FC = () => {
  const channels = useRoomStore((s) => s.channels);
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const currentRoom = useUserStore((s) => s.currentRoom);
  const userId = useUserStore((s) => s.userId);
  const nickname = useUserStore((s) => s.nickname);
  const deviceId = useUserStore((s) => s.deviceId);
  const setNickname = useUserStore((s) => s.setNickname);
  const logout = useUserStore((s) => s.logout);
  const announcement = useRoomStore((s) => s.notification);
  const announcements = useRoomStore((s) => s.announcements);
  const siteName = useRoomStore((s) => s.siteName);
  const showAdmin = useAdminStore((s) => s.isAdmin);
  const setShowPanel = useAdminStore((s) => s.setShowPanel);
  const [editingNickname, setEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const connectionState = useUserStore((s) => s.connectionState);
  const reconnectAttempt = useUserStore((s) => s.reconnectAttempt);

  useEffect(() => {
    getSocket()?.emit(EVENTS.CLIENT.ROOM_LIST);
  }, []);

  const handleJoin = (roomId: string) => {
    getSocket()?.emit(EVENTS.CLIENT.ROOM_JOIN, { roomId });
  };

  const handleLogout = () => {
    if (currentRoom) {
      getSocket()?.emit(EVENTS.CLIENT.ROOM_LEAVE);
    }
    deleteCookie('vc_nickname');
    useMediaStore.getState().reset();
    logout();
  };

  const handleStartEditNickname = () => {
    setNewNickname(nickname);
    setEditingNickname(true);
  };

  const handleSaveNickname = () => {
    const trimmed = newNickname.trim();
    if (!trimmed || trimmed === nickname) {
      setEditingNickname(false);
      return;
    }
    if (containsBlockedWord(trimmed)) {
      useRoomStore.getState().setNotification('昵称包含违规词汇，请修改');
      return;
    }
    getSocket()?.emit('user:updateNickname', { nickname: trimmed });
    setNickname(trimmed);
    setCookie('vc_nickname', trimmed);
    setEditingNickname(false);
  };

  if (!isLoggedIn) {
    return <NicknameModal onClose={() => {}} />;
  }

  return (
    <div className="min-h-[100dvh] relative">
      <TechBackground />
      <div className="max-w-5xl mx-auto px-4 py-8 relative z-10">
        {connectionState !== 'connected' && (
          <div className={`mb-4 px-4 py-2 rounded-lg text-xs text-center ${
            connectionState === 'reconnecting' ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-300' :
            connectionState === 'disconnected' ? 'bg-orange-500/10 border border-orange-500/30 text-orange-300' :
            'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}>
            {connectionState === 'reconnecting' && `正在重连服务器... (${reconnectAttempt}/5)`}
            {connectionState === 'disconnected' && '连接已断开，正在尝试重连...'}
            {connectionState === 'failed' && '服务器连接失败，请刷新页面重试'}
          </div>
        )}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-violet-400 bg-clip-text text-transparent">
              {siteName}
            </h1>
            <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
              已登录: <span className="text-gray-300">{nickname}</span>
              <button
                onClick={handleStartEditNickname}
                className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                编辑
              </button>
            </p>
            {editingNickname && (
              <div className="flex items-center gap-1 mt-1">
                <input
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  maxLength={16}
                  className="bg-gray-800/60 border border-gray-600/50 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-primary-500/50 w-36"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNickname(); if (e.key === 'Escape') setEditingNickname(false); }}
                />
                <button onClick={handleSaveNickname} className="text-xs bg-primary-600 hover:bg-primary-500 text-white px-2 py-1 rounded-lg">保存</button>
                <button onClick={() => setEditingNickname(false)} className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded-lg">取消</button>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <SoundSettings />
            <button
              onClick={handleLogout}
              className="text-sm bg-white/10 hover:bg-white/20 text-gray-300 px-4 py-2 rounded-lg transition-all border border-white/10"
            >
              退出登录
            </button>
            {!showAdmin && <AdminLogin />}
            {showAdmin && (
              <button
                onClick={() => setShowPanel(true)}
                className="text-sm bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg transition-all"
              >
                管理面板
              </button>
            )}
          </div>
        </header>

        {announcements.length > 0 && (
          <div className="mb-6">
            <Announcement announcements={announcements} />
          </div>
        )}
        {announcement && (
          <div className="mb-6">
            <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 px-4 py-3 rounded-xl text-sm">
              {announcement}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-1">频道列表</h2>
          <p className="text-gray-500 text-sm">选择一个频道加入语音聊天</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((ch) => (
            <ChannelCard
              key={ch.roomId}
              channel={ch}
              onJoin={handleJoin}
              disabled={currentRoom === ch.roomId}
            />
          ))}
          {channels.length === 0 && (
            <div className="col-span-full text-center py-16 text-gray-600">
              <p className="text-lg">暂无可用频道</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
