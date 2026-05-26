import React, { useState, useEffect } from 'react';
import { useRoomStore } from '../../stores/roomStore';
import type { UserInfo } from '../../utils/constants';
import { getAvatarColor, getInitial } from '../../utils/helpers';
import { SpeakingIndicator } from './SpeakingIndicator';
import { RemoteVolume } from '../audio/RemoteVolume';
import { useUserStore } from '../../stores/userStore';
import { useAdminStore } from '../../stores/adminStore';
import { useMediaStore } from '../../stores/mediaStore';
import { getSocket } from '../../services/socketService';
import { muteRemote, unmuteRemote } from '../../services/audioService';
import { LatencyIndicator } from './LatencyIndicator';
import { EVENTS } from '../../utils/constants';

interface UserCardProps {
  user: UserInfo;
}

export const UserCard: React.FC<UserCardProps> = ({ user }) => {
  const activeSpeakers = useRoomStore((s) => s.activeSpeakers);
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const currentUserId = useUserStore((s) => s.userId);
  const currentRoom = useUserStore((s) => s.currentRoom);
  const channels = useRoomStore((s) => s.channels);
  const currentChannel = channels.find(c => c.roomId === currentRoom);
  const isCreator = currentChannel?.type === 'user' && currentChannel?.creatorUserId === currentUserId;
  const mutedUsers = useMediaStore((s) => s.mutedUsers);
  const toggleMuteUser = useMediaStore((s) => s.toggleMuteUser);
  const getProducerIdByDeviceId = useMediaStore((s) => s.getProducerIdByDeviceId);
  const peerLatencies = useRoomStore((s) => s.peerLatencies);
  const [showMenu, setShowMenu] = useState(false);

  const speaker = activeSpeakers.get(user.deviceId);
  const isSpeaking = !!speaker?.isSpeaking;
  const isSelf = user.userId === currentUserId;
  const isMuted = mutedUsers.has(user.deviceId);
  const serverMutedUsers = useMediaStore((s) => s.serverMutedUsers);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const peerLatency = peerLatencies.get(user.deviceId);

  const serverMutedExpires = serverMutedUsers.get(user.userId);
  if (serverMutedExpires && serverMutedExpires <= now) {
    useMediaStore.getState().removeServerMutedUser(user.userId);
    if (isSelf) useMediaStore.getState().setAmIServerMuted(false);
  }
  const isServerMuted = !!(serverMutedExpires && serverMutedExpires > now);

  const handleToggleLocalMute = () => {
    const pid = getProducerIdByDeviceId(user.deviceId);
    if (!pid) return;
    if (isMuted) {
      unmuteRemote(pid);
    } else {
      muteRemote(pid);
    }
    toggleMuteUser(user.deviceId);
  };

  const handleTempMute = () => {
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_TEMP_MUTE, { targetUserId: user.userId });
    setShowMenu(false);
  };

  const color = getAvatarColor(user.userId);
  const initial = getInitial(user.nickname);

  const handleKick = () => {
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_KICK, { targetDeviceId: user.deviceId });
    setShowMenu(false);
  };

  const handleBan = () => {
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_BAN, { targetDeviceId: user.deviceId, reason: '违反规则' });
    setShowMenu(false);
  };

  const handleMute = () => {
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_MUTE_TARGET, { targetDeviceId: user.deviceId });
    setShowMenu(false);
  };

  const handleUnmute = () => {
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_UNMUTE_TARGET, { targetDeviceId: user.deviceId });
    setShowMenu(false);
  };

  return (
    <div
      className={`glass-card p-4 flex flex-col items-center gap-2 relative transition-all duration-300 group/hover ${
        isSpeaking ? 'ring-1 ring-green-500/50 shadow-lg shadow-green-500/10' : ''
      } ${isSelf ? 'ring-1 ring-primary-500/30' : ''}`}
      onMouseLeave={() => { setShowMenu(false); }}
    >
      {/* Avatar */}
      <div className="relative">
        <div
          className="rounded-full flex items-center justify-center text-white font-bold text-lg select-none"
          style={{
            width: 48,
            height: 48,
            backgroundColor: color,
            boxShadow: isSpeaking ? `0 0 20px ${color}80` : 'none',
          }}
        >
          {initial}
        </div>
        <SpeakingIndicator isSpeaking={isSpeaking} level={speaker?.level ?? -100} />
      </div>

      {/* Name + Badge */}
      <div className="text-center">
        <p className="text-xs sm:text-sm font-medium text-white truncate max-w-[80px] sm:max-w-[100px]">
          {user.nickname}
          {isSelf && <span className="text-gray-500 text-xs ml-1">(我)</span>}
        </p>
        {isServerMuted && (
          <p className="text-[10px] text-yellow-400 mt-0.5">
            已被禁言
            {(isAdmin || isSelf) && serverMutedExpires ? ` ${Math.max(0, Math.ceil((serverMutedExpires - now) / 1000))}s` : ''}
          </p>
        )}
        {isSpeaking && (
          <div className="flex items-center justify-center gap-1 mt-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-0.5 bg-green-400 rounded-full animate-audio-bar"
                style={{
                  height: `${4 + Math.random() * 12}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}
        {peerLatency != null && (
          <div className="mt-1 flex justify-center">
            <LatencyIndicator latency={peerLatency} />
          </div>
        )}
      </div>

      {/* Desktop: controls on hover at bottom */}
      {!isSelf && (
        <div className="hidden sm:flex absolute bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover/hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover/hover:pointer-events-auto z-10 items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-900/80 backdrop-blur">
          <button
            onClick={handleToggleLocalMute}
            className={`text-gray-400 hover:text-white transition-colors p-0.5 ${isMuted ? 'text-yellow-400' : ''}`}
            title={isMuted ? '取消静音' : '静音'}
          >
            {isMuted ? (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2" />
                <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
          <RemoteVolume producerDeviceId={user.deviceId} />
        </div>
      )}

      {/* Mobile: horizontal inline */}
      {!isSelf && (
        <div className="sm:hidden flex items-center gap-1 mt-1">
          <button
            onClick={handleToggleLocalMute}
            className={`text-gray-400 hover:text-white transition-colors p-1 ${isMuted ? 'text-yellow-400' : ''}`}
            title={isMuted ? '取消静音' : '静音'}
          >
            {isMuted ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2" />
                <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
          <RemoteVolume producerDeviceId={user.deviceId} />
        </div>
      )}

      {/* Admin/Creator menu */}
      {(isAdmin || isCreator) && !isSelf && (
        <div className="absolute top-1 right-1">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-gray-500 hover:text-white text-xs px-1.5 py-0.5 rounded transition-colors"
          >
            ···
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 glass-panel p-1.5 flex flex-col gap-1 min-w-[80px] z-20">
              {isServerMuted ? (
                <button onClick={handleUnmute} className="text-xs text-green-300 hover:bg-green-500/10 px-2 py-1 rounded text-left">解禁</button>
              ) : (
                <button onClick={handleMute} className="text-xs text-yellow-300 hover:bg-yellow-500/10 px-2 py-1 rounded text-left">禁言</button>
              )}
              <button onClick={handleKick} className="text-xs text-orange-300 hover:bg-orange-500/10 px-2 py-1 rounded text-left">踢出</button>
              <button onClick={handleTempMute} className="text-xs text-yellow-400 hover:bg-yellow-500/10 px-2 py-1 rounded text-left">强制关麦</button>
              {isAdmin && (
                <button onClick={handleBan} className="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded text-left">封禁</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
