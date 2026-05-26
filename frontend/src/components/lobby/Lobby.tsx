import React, { useEffect, useState, useRef } from 'react';
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
import { ChannelPasswordModal } from './ChannelPasswordModal';
import { CreateUserChannelModal } from './CreateUserChannelModal';
import { EditUserChannelModal } from './EditUserChannelModal';
import { showToast } from '../common/Toast';

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
  const setNotification = useRoomStore((s) => s.setNotification);
  const announcements = useRoomStore((s) => s.announcements);
  const siteName = useRoomStore((s) => s.siteName);
  const showAdmin = useAdminStore((s) => s.isAdmin);
  const adminConfig = useAdminStore((s) => s.config);
  const setShowPanel = useAdminStore((s) => s.setShowPanel);
  const allowedBitrates = adminConfig.userChannelAllowedBitrates.split(',').filter(Boolean).map(Number);
  const showAdminEntry = new URLSearchParams(window.location.search).has('admin');
  const [editingNickname, setEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [editError, setEditError] = useState('');
  const [pwdRoomId, setPwdRoomId] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editChannelRoomId, setEditChannelRoomId] = useState('');
  const editChannel = channels.find(c => c.roomId === editChannelRoomId);
  const connectionState = useUserStore((s) => s.connectionState);
  const reconnectAttempt = useUserStore((s) => s.reconnectAttempt);
  const pwdRoomRef = useRef(pwdRoomId);
  useEffect(() => {
    pwdRoomRef.current = pwdRoomId;
  }, [pwdRoomId]);

  useEffect(() => {
    getSocket()?.emit(EVENTS.CLIENT.ROOM_LIST);
    getSocket()?.emit('user:channel-config');
    const handler = (config: any) => {
      useAdminStore.getState().setConfig({
        ...useAdminStore.getState().config,
        userChannelEnabled: config.enabled !== false,
        userChannelMaxNameLen: config.maxNameLen ?? 6,
        userChannelMaxUsers: config.maxUsers ?? 10,
        userChannelAllowedBitrates: config.allowedBitrates ?? '48',
        userChannelMaxPerDevice: config.maxPerDevice ?? 1,
      });
    };
    getSocket()?.on('user:channel-config', handler);
    return () => { getSocket()?.off('user:channel-config', handler); };
  }, []);

  useEffect(() => {
    const handler = (data: any) => {
      showToast(`频道 "${data.roomId}" 已删除`, 'success');
    };
    getSocket()?.on('user:channel-deleted', handler);
    return () => { getSocket()?.off('user:channel-deleted', handler); };
  }, []);

  // Persistent password error handler (only for active modal)
  useEffect(() => {
    const handler = (data: any) => {
      if (data.event === EVENTS.CLIENT.ROOM_JOIN && pwdRoomRef.current) {
        setPwdError(data.message || '密码错误');
      }
    };
    getSocket()?.on(EVENTS.SERVER.ERROR, handler);
    return () => { getSocket()?.off(EVENTS.SERVER.ERROR, handler); };
  }, []);

  const handleJoin = (roomId: string) => {
    getSocket()?.emit(EVENTS.CLIENT.ROOM_JOIN, { roomId });
  };

  const handleJoinWithPwd = (roomId: string) => {
    if (showAdmin) {
      handleJoin(roomId);
      return;
    }
    setPwdRoomId(roomId);
    setPwdError('');
  };

  const handlePwdSubmit = async (password: string) => {
    getSocket()?.emit(EVENTS.CLIENT.ROOM_JOIN, { roomId: pwdRoomId, password });
  };

  const handlePwdClose = () => {
    setPwdRoomId('');
    setPwdError('');
  };

  const handleEditChannel = (roomId: string) => {
    setEditChannelRoomId(roomId);
  };

  const handleDeleteChannel = (roomId: string) => {
    if (window.confirm('确定要删除该频道吗？')) {
      getSocket()?.emit('user:channel-delete', { roomId });
    }
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
    setEditError('');
    setEditingNickname(true);
  };

  const handleSaveNickname = () => {
    const trimmed = newNickname.trim();
    if (!trimmed || trimmed === nickname) {
      setEditingNickname(false);
      return;
    }
    if (containsBlockedWord(trimmed)) {
      setEditError('昵称包含违规词汇，请修改');
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
              {import.meta.env.DEV && (
                <span className="text-[10px] text-gray-600">uid:{userId?.slice(0,6)} did:{deviceId?.slice(0,8)}</span>
              )}
              <button
                onClick={handleStartEditNickname}
                className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                编辑
              </button>
            </p>
          </div>
          <div className="flex gap-3">
            <SoundSettings />
            <button
              onClick={handleLogout}
              title="退出登录"
              className="p-3 sm:p-2 bg-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/10 rounded-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
            {!showAdmin && showAdminEntry && <AdminLogin />}
            {showAdmin && (
              <button
                onClick={() => setShowPanel(true)}
                title="管理面板"
                className="p-3 sm:p-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
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

        {channels.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <p className="text-lg">暂无可用频道</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-1">固定频道</h2>
              <p className="text-gray-500 text-sm">管理员创建的频道</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {channels.filter(c => c.type !== 'user').map((ch) => (
                <ChannelCard key={ch.roomId} channel={ch} onJoin={handleJoin} onJoinWithPwd={handleJoinWithPwd} disabled={currentRoom === ch.roomId} currentUserId={userId} />
              ))}
            </div>

            {adminConfig.userChannelEnabled && (
            <>
            <hr className="border-gray-700/30 mb-6" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">临时频道</h2>
                <p className="text-gray-500 text-sm">临时频道，无人时自动删除</p>
              </div>
              <button onClick={() => setShowCreateModal(true)} className="bg-primary-600 hover:bg-primary-500 text-white text-sm px-4 py-2 rounded-lg transition-all">
                + 创建频道
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(channels.filter(c => c.type === 'user') as any[]).sort((a, b) => {
                const aOwn = a.creatorUserId === userId;
                const bOwn = b.creatorUserId === userId;
                if (aOwn && !bOwn) return -1;
                if (!aOwn && bOwn) return 1;
                return 0;
              }).map((ch) => (
                <ChannelCard key={ch.roomId} channel={ch} onJoin={handleJoin} onJoinWithPwd={handleJoinWithPwd} disabled={currentRoom === ch.roomId} isAdmin={showAdmin} currentUserId={userId} onEdit={handleEditChannel} onDelete={handleDeleteChannel} />
              ))}
            </div>
            </>
            )}
          </>
        )}
      </div>

      {editingNickname && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 fade-in duration-200">
            <h3 className="text-lg font-semibold text-white mb-4">修改昵称</h3>
            <input
              value={newNickname}
              onChange={(e) => { setNewNickname(e.target.value); setEditError(''); }}
              maxLength={16}
              placeholder="输入新昵称"
              className="w-full bg-gray-800/60 border border-gray-600/50 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 mb-2"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNickname();
                if (e.key === 'Escape') setEditingNickname(false);
              }}
            />
            {editError && <p className="text-red-400 text-xs mb-3">{editError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setEditingNickname(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2.5 rounded-xl transition-all">取消</button>
              <button onClick={handleSaveNickname} className="flex-1 bg-primary-600 hover:bg-primary-500 text-white text-sm py-2.5 rounded-xl transition-all">保存</button>
            </div>
          </div>
        </div>
      )}

      {pwdRoomId && (
        <ChannelPasswordModal
          channelName={channels.find(c => c.roomId === pwdRoomId)?.name || pwdRoomId}
          onSubmit={handlePwdSubmit}
          onClose={handlePwdClose}
          error={pwdError}
        />
      )}

      {showCreateModal && (
        <CreateUserChannelModal
          onClose={() => setShowCreateModal(false)}
          maxNameLen={adminConfig.userChannelMaxNameLen}
          maxUsers={adminConfig.userChannelMaxUsers}
          allowedBitrates={allowedBitrates}
        />
      )}

      {editChannel && (
        <EditUserChannelModal
          channel={editChannel}
          maxNameLen={adminConfig.userChannelMaxNameLen}
          maxUsers={adminConfig.userChannelMaxUsers}
          allowedBitrates={allowedBitrates}
          onClose={() => setEditChannelRoomId('')}
        />
      )}
    </div>
  );
};
