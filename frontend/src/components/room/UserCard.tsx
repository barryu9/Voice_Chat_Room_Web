import React, { useState, useEffect, useRef } from 'react';
import { useRoomStore } from '../../stores/roomStore';
import type { UserInfo } from '../../utils/constants';
import { getAvatarColor, getInitial, getLightAvatarColor } from '../../utils/helpers';
import { SpeakingIndicator } from './SpeakingIndicator';
import { RemoteVolume } from '../audio/RemoteVolume';
import { useUserStore } from '../../stores/userStore';
import { useAdminStore } from '../../stores/adminStore';
import { useMediaStore } from '../../stores/mediaStore';
import { getSocket } from '../../services/socketService';
import { muteRemote, setRemoteVolume } from '../../services/audioService';
import { LatencyIndicator } from './LatencyIndicator';
import { EVENTS } from '../../utils/constants';

interface UserCardProps {
  user: UserInfo;
}

const SPEAKING_HOLD_MS = 200;

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
  const vcStates = useRoomStore((s) => s.vcStates);
  const [showMenu, setShowMenu] = useState(false);

  const vcState = vcStates.get(user.deviceId);
  const speaker = activeSpeakers.get(user.deviceId);
  const isSelf = user.userId === currentUserId;
  const isReconnecting = !!user.reconnecting;
  const speakingHoldUntil = useRef(0);
  const rawSpeaking = !!speaker?.isSpeaking;
  if (rawSpeaking) {
    speakingHoldUntil.current = Date.now() + SPEAKING_HOLD_MS;
  }
  const isSpeaking = rawSpeaking || Date.now() < speakingHoldUntil.current;
  const speakingLevel = speaker?.level ?? -100;
  const isMuted = mutedUsers.has(user.deviceId);
  const serverMutedUsers = useMediaStore((s) => s.serverMutedUsers);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), SPEAKING_HOLD_MS);
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
      const savedGain = useMediaStore.getState().remoteAudioGains.get(user.deviceId) ?? 1.0;
      setRemoteVolume(pid, savedGain);
    } else {
      muteRemote(pid);
    }
    toggleMuteUser(user.deviceId);
  };

  const handleTempMute = () => {
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_TEMP_MUTE, { targetUserId: user.userId });
    setShowMenu(false);
  };

  const avatarDarkColor = getAvatarColor(user.userId);
  const avatarLightColor = getLightAvatarColor(user.userId);
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
        isSelf ? 'ring-1 ring-primary-500/30' : ''
      } ${isReconnecting ? 'opacity-75 ring-1 ring-yellow-500/30' : ''}`}
      onMouseLeave={() => { setShowMenu(false); }}
    >
      {/* Avatar */}
      <div className="relative">
        <div
          className={`avatar-circle rounded-full flex items-center justify-center text-white font-bold text-lg select-none ${isSpeaking && !isReconnecting ? 'avatar-speaking' : ''}`}
          style={{
            width: 48,
            height: 48,
            '--avatar-dark': avatarDarkColor,
            '--avatar-light': avatarLightColor,
            '--avatar-glow-dark': `${avatarDarkColor}80`,
            '--avatar-glow-light': `${avatarLightColor}99`,
          } as React.CSSProperties}
        >
          {initial}
        </div>
        <SpeakingIndicator isSpeaking={isSpeaking && !isReconnecting} level={speakingLevel} />
      </div>

      {/* Name + Badge */}
      <div className="text-center">
        {isReconnecting && (
          <p className="text-[10px] text-yellow-400 mb-0.5">正在连接</p>
        )}
        {isMuted && (
          <p className="text-[10px] text-red-400 mb-0.5">已被你静音</p>
        )}
        {vcState?.enabled && (
          <p className="text-[10px] text-green-400 mb-0.5">变声：{vcState.presetLabel}</p>
        )}
        <div className="flex items-center justify-center gap-1 max-w-[92px] sm:max-w-[112px] mx-auto">
          {isSpeaking && (
            <span className="theme-speaking-badge shrink-0" aria-hidden="true">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 9.5v5h3.5L13 18V6L8.5 9.5H5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 9a4 4 0 010 6" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 6.5a7.5 7.5 0 010 11" />
              </svg>
            </span>
          )}
          <p className="min-w-0 text-xs sm:text-sm font-medium text-white truncate">
            {user.nickname}
            {isSelf && <span className="text-gray-500 text-xs ml-1">(我)</span>}
          </p>
        </div>
        {peerLatency != null && (
          <div className="mt-0.5 flex justify-center">
            <LatencyIndicator latency={peerLatency} />
          </div>
        )}
        {isServerMuted && (
          <p className="text-[10px] text-yellow-400 mt-0.5">
            已被禁言
            {(isAdmin || isSelf) && serverMutedExpires ? ` ${Math.max(0, Math.ceil((serverMutedExpires - now) / 1000))}s` : ''}
          </p>
        )}
      </div>

      {/* Desktop: controls on hover at bottom */}
      {!isSelf && (
        <div className="remote-volume-toolbar hidden sm:flex absolute bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover/hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover/hover:pointer-events-auto z-10 items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-900/80 backdrop-blur">
          <button
            onClick={handleToggleLocalMute}
            className={`remote-volume-icon text-gray-400 hover:text-white transition-colors p-0.5 ${isMuted ? 'text-yellow-400' : ''}`}
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
            className={`remote-volume-icon text-gray-400 hover:text-white transition-colors p-1 ${isMuted ? 'text-yellow-400' : ''}`}
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
