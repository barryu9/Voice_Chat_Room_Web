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
  const currentRoom = useUserStore((s) => s.currentRoom);
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const [banTarget, setBanTarget] = useState<OnlineUser | null>(null);
  const sidebarOpen = useRoomStore((s) => s.onlineSidebarOpen);
  const setSidebarOpen = useRoomStore((s) => s.setOnlineSidebarOpen);
  const [mobileOpen, setMobileOpen] = useState(false);

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
  const userGroups = useMemo(() => {
    if (currentRoom) {
      return [
        { label: '本频道在线', users: orderedUsers.filter((user) => user.roomId === currentRoom) },
        { label: '其他在线', users: orderedUsers.filter((user) => user.roomId !== currentRoom) },
      ].filter((group) => group.users.length > 0);
    }
    return [
      { label: '大厅在线', users: orderedUsers.filter((user) => !user.roomId) },
      { label: '频道内成员', users: orderedUsers.filter((user) => !!user.roomId) },
    ].filter((group) => group.users.length > 0);
  }, [currentRoom, orderedUsers]);

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
      <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} className={`glass-panel fixed top-1/2 z-30 hidden h-12 w-9 -translate-y-1/2 items-center justify-center rounded-full p-0 text-gray-400 shadow-lg transition-all duration-200 hover:scale-105 hover:text-primary-300 lg:flex ${sidebarOpen ? 'left-[15rem]' : 'left-3'}`} title={sidebarOpen ? '收起在线成员' : '展开在线成员'}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} /></svg>
      </button>
      <aside className={`fixed bottom-0 left-0 top-0 z-20 hidden w-64 flex-col border-r border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-2xl backdrop-blur-xl transition-transform duration-200 lg:flex ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-label="在线成员">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">在线成员</h2>
          <span className="rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] text-primary-300">{orderedUsers.length}</span>
        </div>
        <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
          {userGroups.map((group) => <div key={group.label}><p className="mb-1 px-1 text-[10px] font-medium text-gray-500">{group.label} · {group.users.length}</p>{group.users.map((user) => {
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
          })}</div>)}
        </div>
      </aside>

      <button type="button" onClick={() => setMobileOpen(true)} className="glass-panel fixed bottom-24 left-3 z-30 flex h-10 w-10 items-center justify-center overflow-visible rounded-full text-gray-400 shadow-lg transition-all hover:scale-105 hover:text-primary-300 lg:hidden" aria-label="查看在线成员" title="在线成员">
        <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m12-10a4 4 0 100-8 4 4 0 000 8zm2 4h.01M6 11a4 4 0 100-8 4 4 0 000 8z" /></svg>
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary-500 px-1 text-center text-[9px] leading-4 text-white">{orderedUsers.length}</span>
      </button>
      {mobileOpen && <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}>
        <aside className="absolute bottom-0 left-0 top-0 w-72 border-r border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-left-2" onClick={(event) => event.stopPropagation()} aria-label="在线成员">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold text-white">在线成员</h2><button type="button" onClick={() => setMobileOpen(false)} className="p-1 text-gray-400">✕</button></div>
          <div className="max-h-[calc(100dvh-5rem)] space-y-3 overflow-y-auto">
            {userGroups.map((group) => <div key={group.label}><p className="mb-1 px-1 text-xs font-medium text-gray-500">{group.label} · {group.users.length}</p>{group.users.map((user) => { const isSelf = user.userId === selfId; return <div key={user.socketId} className={`rounded-lg px-2 py-2 ${isSelf ? 'bg-primary-500/10' : 'bg-white/5'}`}><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${user.inVoice ? 'bg-green-400' : 'bg-gray-500'}`} /><span className="min-w-0 flex-1 truncate text-sm text-white">{user.nickname}{isSelf ? '（你）' : ''}</span>{user.isAdmin && <span className="rounded bg-primary-500/20 px-1 py-0.5 text-[9px] text-primary-300">管理员</span>}{isAdmin && !isSelf && !user.isAdmin && <button type="button" onClick={() => { setBanTarget(user); setMobileOpen(false); }} className="text-xs text-red-400">封禁</button>}</div><p className="ml-4 mt-1 text-xs text-gray-500">{getStatus(user, channelNames)}</p></div>; })}</div>)}
          </div>
        </aside>
      </div>}

      {banTarget && <ConfirmModal title="封禁用户" message={`确定封禁“${banTarget.nickname}”吗？该用户将被强制下线。`} onCancel={() => setBanTarget(null)} onConfirm={confirmBan} />}
    </>
  );
};
