import React, { useMemo, useState } from 'react';
import { useRoomStore } from '../../stores/roomStore';
import { useUserStore } from '../../stores/userStore';
import { useAdminStore } from '../../stores/adminStore';
import { getSocket } from '../../services/socketService';
import { EVENTS, type OnlineUser } from '../../utils/constants';
import { showToast } from './Toast';
import { ConfirmModal } from './ConfirmModal';

function getStatus(user: OnlineUser, channelNames: Map<string, string>) {
  if (!user.roomId) return '大厅中';
  const roomName = channelNames.get(user.roomId) || user.roomId;
  return user.inVoice ? `语音中 · ${roomName}` : `频道中 · ${roomName}`;
}

export const OnlineMembersPanel: React.FC = () => {
  const users = useRoomStore((s) => s.onlineUsers);
  const channels = useRoomStore((s) => s.channels);
  const selfId = useUserStore((s) => s.userId);
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const [banTarget, setBanTarget] = useState<OnlineUser | null>(null);

  const channelNames = useMemo(
    () => new Map(channels.map((channel) => [channel.roomId, channel.name])),
    [channels],
  );
  const orderedUsers = useMemo(() => [...users].sort((a, b) => {
    if (a.userId === selfId) return -1;
    if (b.userId === selfId) return 1;
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
    return a.nickname.localeCompare(b.nickname, 'zh-CN');
  }), [users, selfId]);

  const confirmBan = () => {
    if (!banTarget) return;
    const socket = getSocket();
    if (!socket) {
      showToast('连接已断开', 'error');
      return;
    }
    const cleanup = () => {
      socket.off(EVENTS.SERVER.ADMIN_BANNED, onBanned);
      socket.off(EVENTS.SERVER.ERROR, onError);
    };
    const onBanned = (data: { deviceId: string }) => {
      if (data.deviceId !== banTarget.deviceId) return;
      cleanup();
      setBanTarget(null);
      showToast('用户已封禁', 'success');
    };
    const onError = (data: { event?: string; message?: string }) => {
      if (data.event !== EVENTS.CLIENT.ADMIN_BAN) return;
      cleanup();
      showToast(data.message || '封禁失败', 'error');
    };
    socket.on(EVENTS.SERVER.ADMIN_BANNED, onBanned);
    socket.on(EVENTS.SERVER.ERROR, onError);
    socket.emit(EVENTS.CLIENT.ADMIN_BAN, { targetDeviceId: banTarget.deviceId, reason: '管理员封禁' });
  };

  return (
    <>
      <aside className="glass-panel fixed left-4 top-20 z-30 hidden w-56 max-h-[calc(100dvh-6rem)] flex-col p-3 lg:flex" aria-label="在线成员">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">在线成员</h2>
          <span className="rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] text-primary-300">{orderedUsers.length}</span>
        </div>
        <div className="min-h-0 space-y-1 overflow-y-auto pr-1">
          {orderedUsers.map((user) => {
            const isSelf = user.userId === selfId;
            return (
              <div key={user.socketId} className={`rounded-lg px-2 py-2 ${isSelf ? 'bg-primary-500/10' : 'hover:bg-white/5'}`}>
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${user.inVoice ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]' : 'bg-gray-500'}`} />
                  <span className="truncate text-xs font-medium text-white">{user.nickname}{isSelf ? '（你）' : ''}</span>
                  {user.isAdmin && <span className="shrink-0 rounded bg-primary-500/20 px-1 py-0.5 text-[9px] text-primary-300">管理员</span>}
                  {isAdmin && !isSelf && !user.isAdmin && (
                    <button type="button" onClick={() => setBanTarget(user)} className="ml-auto shrink-0 text-[10px] text-red-400 transition-colors hover:text-red-300" title={`封禁 ${user.nickname}`}>封禁</button>
                  )}
                </div>
                <p className="ml-4 mt-1 truncate text-[10px] text-gray-500">{getStatus(user, channelNames)}</p>
              </div>
            );
          })}
        </div>
      </aside>

      {banTarget && <ConfirmModal title="封禁用户" message={`确定封禁“${banTarget.nickname}”吗？该用户将被强制下线。`} onCancel={() => setBanTarget(null)} onConfirm={confirmBan} />}
    </>
  );
};
