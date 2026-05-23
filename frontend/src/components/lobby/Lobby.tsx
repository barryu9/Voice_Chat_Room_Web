import React, { useEffect } from 'react';
import { useRoomStore } from '../../stores/roomStore';
import { useUserStore } from '../../stores/userStore';
import { useAdminStore } from '../../stores/adminStore';
import { getSocket } from '../../services/socketService';
import { EVENTS } from '../../utils/constants';
import { ChannelCard } from './ChannelCard';
import { NicknameModal } from './NicknameModal';
import { AdminLogin } from '../admin/AdminLogin';
import { Announcement } from '../common/Announcement';

export const Lobby: React.FC = () => {
  const channels = useRoomStore((s) => s.channels);
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const currentRoom = useUserStore((s) => s.currentRoom);
  const userId = useUserStore((s) => s.userId);
  const nickname = useUserStore((s) => s.nickname);
  const announcement = useRoomStore((s) => s.roomAnnouncement);
  const siteName = useRoomStore((s) => s.siteName);
  const showAdmin = useAdminStore((s) => s.isAdmin);
  const setShowPanel = useAdminStore((s) => s.setShowPanel);

  useEffect(() => {
    getSocket()?.emit(EVENTS.CLIENT.ROOM_LIST);
  }, []);

  const handleJoin = (roomId: string) => {
    getSocket()?.emit(EVENTS.CLIENT.ROOM_JOIN, { roomId });
  };

  if (!isLoggedIn) {
    return <NicknameModal onClose={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-violet-400 bg-clip-text text-transparent">
              {siteName}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              已登录: <span className="text-gray-300">{nickname}</span>
            </p>
          </div>
          <div className="flex gap-3">
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

        {announcement && (
          <div className="mb-6">
            <Announcement message={announcement} onDismiss={() => {}} />
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
