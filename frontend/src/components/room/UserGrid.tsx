import React from 'react';
import { useRoomStore } from '../../stores/roomStore';
import { useUserStore } from '../../stores/userStore';
import { UserCard } from './UserCard';

export const UserGrid: React.FC = React.memo(() => {
  const roomUsers = useRoomStore((s) => s.roomUsers);
  const userCount = useRoomStore((s) => s.userCount);
  const currentUserId = useUserStore((s) => s.userId);
  const users = Array.from(roomUsers.values()).sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    return 0;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400">
          在线用户 <span className="text-primary-400">{userCount}</span>
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {users.map((u) => (
          <UserCard key={u.userId} user={u} />
        ))}
        {users.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-600 text-sm">
            频道暂无其他用户
          </div>
        )}
      </div>
    </div>
  );
});
