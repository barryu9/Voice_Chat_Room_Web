import { io, Socket } from 'socket.io-client';
import { useRoomStore } from '../stores/roomStore';
import { useUserStore } from '../stores/userStore';
import { useAdminStore } from '../stores/adminStore';
import { useMediaStore } from '../stores/mediaStore';
import { playSound } from './soundService';
import { showToast } from '../components/common/Toast';
import { EVENTS } from '../utils/constants';
import { clearChannelUrlParam } from '../utils/helpers';
import { handleLocalVoiceSessionLost } from './voiceSessionService';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;
const SPEAKING_HOLD_MS = 200;
const SOCKET_DISCONNECT_GRACE_MS = 5000;
const SOCKET_RECONNECT_DELAY_MS = 500;
const SOCKET_RECONNECT_ATTEMPTS = 120;

let socket: Socket | null = null;
const speakerExpiryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
const recentlyReconnectedUsers: Map<string, ReturnType<typeof setTimeout>> = new Map();
let socketDisconnectTimer: ReturnType<typeof setTimeout> | null = null;
let socketHasConnectedOnce = false;
let socketReconnectWarningShown = false;
let pageLifecycleRegistered = false;

function clearSocketDisconnectTimer() {
  if (socketDisconnectTimer) {
    clearTimeout(socketDisconnectTimer);
    socketDisconnectTimer = null;
  }
}

function clearSpeakingAfter(deviceId: string, delayMs: number) {
  const existing = speakerExpiryTimers.get(deviceId);
  if (existing) clearTimeout(existing);
  speakerExpiryTimers.set(deviceId, setTimeout(() => {
    useRoomStore.getState().setActiveSpeaker(deviceId, -100, false);
    speakerExpiryTimers.delete(deviceId);
  }, delayMs));
}

function markRecentlyReconnected(userId: string) {
  const existing = recentlyReconnectedUsers.get(userId);
  if (existing) clearTimeout(existing);
  recentlyReconnectedUsers.set(userId, setTimeout(() => {
    recentlyReconnectedUsers.delete(userId);
  }, 5000));
}

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: SOCKET_RECONNECT_ATTEMPTS,
    reconnectionDelay: SOCKET_RECONNECT_DELAY_MS,
    reconnectionDelayMax: SOCKET_RECONNECT_DELAY_MS,
    randomizationFactor: 0,
  });

  registerConnectionListeners();
  registerListeners();
  registerPageLifecycleListeners();
  return socket;
}

function resetSocketLifecycleState() {
  clearSocketDisconnectTimer();
  for (const timer of recentlyReconnectedUsers.values()) {
    clearTimeout(timer);
  }
  recentlyReconnectedUsers.clear();
  socketHasConnectedOnce = false;
  socketReconnectWarningShown = false;
}

export function endCurrentSession(options: { disconnect?: boolean } = {}) {
  if (!socket?.connected) return;

  socket.emit(EVENTS.CLIENT.USER_LOGOUT);

  if (options.disconnect) {
    socket.disconnect();
    socket = null;
    resetSocketLifecycleState();
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  resetSocketLifecycleState();
}

function registerPageLifecycleListeners() {
  if (pageLifecycleRegistered) return;
  pageLifecycleRegistered = true;

  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    const { isLoggedIn, connectionState } = useUserStore.getState();
    if (!isLoggedIn || connectionState !== 'connected' || !socket?.connected) return;
    endCurrentSession({ disconnect: true });
  });
}

function registerConnectionListeners() {
  if (!socket) return;

  const emitCurrentLogin = (recoverSession = false) => {
    const { isLoggedIn, nickname, deviceId } = useUserStore.getState();
    if (isLoggedIn && nickname && deviceId) {
      socket?.emit(EVENTS.CLIENT.USER_LOGIN, { nickname, deviceId, recoverSession });
    }
  };

  socket.on('connect', () => {
    const isReconnect = socketHasConnectedOnce;
    socketHasConnectedOnce = true;
    clearSocketDisconnectTimer();
    useUserStore.getState().setConnectionState('connected');
    if (isReconnect) emitCurrentLogin(true);
  });

  socket.on('disconnect', (reason) => {
    clearSocketDisconnectTimer();
    if (reason === 'io server disconnect') {
      handleLocalVoiceSessionLost('socket');
      useUserStore.getState().setConnectionState('failed');
      return;
    }
    useUserStore.getState().setConnectionState('disconnected');
    if (!socketReconnectWarningShown && useUserStore.getState().isLoggedIn) {
      socketReconnectWarningShown = true;
      if (useUserStore.getState().currentRoom) {
        useRoomStore.getState().setNotification('连接已断开，正在尝试重连服务器...');
      }
      playSound('connectionLost');
    }
    socketDisconnectTimer = setTimeout(() => {
      socketDisconnectTimer = null;
      handleLocalVoiceSessionLost('socket');
    }, SOCKET_DISCONNECT_GRACE_MS);
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    useUserStore.getState().setConnectionState('reconnecting', attempt);
    if (useUserStore.getState().currentRoom) {
      useRoomStore.getState().setNotification(`连接已断开，正在尝试重连服务器... (${attempt}/120)`);
    }
  });

  socket.io.on('reconnect', () => {
    clearSocketDisconnectTimer();
    useUserStore.getState().setConnectionState('connected');
  });

  socket.io.on('reconnect_error', () => {
    useUserStore.getState().setConnectionState('reconnecting');
  });

  socket.io.on('reconnect_failed', () => {
    useUserStore.getState().setConnectionState('failed');
    socketReconnectWarningShown = false;
  });
}

function registerListeners() {
  if (!socket) return;

  socket.on(EVENTS.SERVER.LOGIN_SUCCESS, (data) => {
    useUserStore.getState().setLogin(data.userId, data.nickname, data.deviceId);
    useRoomStore.getState().setChannels(data.rooms || []);
    const { voiceReconnectPending, voiceReconnectTargetRoom, isVoiceConnected } = useMediaStore.getState();
    if (data.recoveredRoom && data.recoveredVoice && !voiceReconnectPending && !isVoiceConnected) {
      useMediaStore.getState().requestVoiceReconnect(data.recoveredRoom);
    }
    const roomToRestore = voiceReconnectPending && voiceReconnectTargetRoom
      ? voiceReconnectTargetRoom
      : data.recoveredRoom || useUserStore.getState().currentRoom;
    if (roomToRestore) {
      socket?.emit(EVENTS.CLIENT.ROOM_JOIN, { roomId: roomToRestore });
    }
    if (socketReconnectWarningShown && roomToRestore && (!data.recoveredVoice || isVoiceConnected)) {
      playSound('connected');
    }
    socketReconnectWarningShown = false;
  });

  socket.on(EVENTS.SERVER.LOGIN_ERROR, (data) => {
    // NicknameModal reads this for auto-login failure fallback
    useRoomStore.getState().setNotification(`登录失败: ${data.message}`);
  });

  socket.on(EVENTS.SERVER.ROOM_LIST, (data) => {
    useRoomStore.getState().setChannels(data.rooms || []);
  });

  socket.on(EVENTS.SERVER.ROOM_USERS, (data) => {
    useUserStore.getState().setCurrentRoom(data.roomId);
    useRoomStore.getState().setRoomUsers(data.users || []);
    const { voiceReconnectPending, voiceReconnectTargetRoom } = useMediaStore.getState();
    if (voiceReconnectPending && voiceReconnectTargetRoom === data.roomId) {
      useMediaStore.getState().setVoiceReconnectRoomReady(true);
    }
    useRoomStore.getState().clearVcStates();
    if (data.vcStates) {
      for (const [deviceId, state] of Object.entries(data.vcStates)) {
        useRoomStore.getState().setVcState(deviceId, state as any);
      }
    }
  });

  socket.on(EVENTS.SERVER.USER_JOINED, (data) => {
    useRoomStore.getState().addUser(data);
    if (data.userId !== useUserStore.getState().userId && !recentlyReconnectedUsers.has(data.userId)) {
      playSound('otherJoined');
    }
  });

  socket.on(EVENTS.SERVER.USER_LEFT, (data) => {
    useRoomStore.getState().removeUser(data.userId);
    useRoomStore.getState().removeVcState(data.deviceId);
    if (data.userId !== useUserStore.getState().userId && data.reason !== 'disconnect') {
      playSound('otherLeft');
    }
  });

  socket.on(EVENTS.SERVER.USER_RECONNECTING, (data) => {
    const currentUserId = useUserStore.getState().userId;
    const existing = useRoomStore.getState().roomUsers.get(data.userId);
    useRoomStore.getState().setUserReconnecting(data, true);
    if (data.userId !== currentUserId && !existing?.reconnecting) {
      playSound('otherDisconnected');
    }
  });

  socket.on(EVENTS.SERVER.USER_RECONNECTED, (data) => {
    const currentUserId = useUserStore.getState().userId;
    const existing = useRoomStore.getState().roomUsers.get(data.userId);
    useRoomStore.getState().setUserReconnecting(data, false);
    if (data.userId !== currentUserId && existing?.reconnecting) {
      markRecentlyReconnected(data.userId);
      playSound('otherJoined');
    }
  });

  socket.on(EVENTS.SERVER.VC_STATUS, (data: { deviceId: string; enabled: boolean; presetLabel: string }) => {
    if (data.enabled) {
      useRoomStore.getState().setVcState(data.deviceId, { enabled: true, presetLabel: data.presetLabel });
    } else {
      useRoomStore.getState().removeVcState(data.deviceId);
    }
  });

  socket.on('user:nickname-changed', (data: { userId: string; nickname: string }) => {
    useRoomStore.getState().updateUserNickname(data.userId, data.nickname);
  });

  socket.on(EVENTS.SERVER.ACTIVE_SPEAKER, (data) => {
    const isSpeaking = data.isSpeaking;
    useRoomStore.getState().setActiveSpeaker(data.deviceId, data.level, isSpeaking);
    if (isSpeaking) {
      clearSpeakingAfter(data.deviceId, SPEAKING_HOLD_MS);
    } else {
      const timer = speakerExpiryTimers.get(data.deviceId);
      if (timer) { clearTimeout(timer); speakerExpiryTimers.delete(data.deviceId); }
    }
  });

  socket.on(EVENTS.SERVER.ANNOUNCEMENTS_UPDATED, (data: { announcements: Array<{ id: string; message: string; createdAt: string }> }) => {
    useRoomStore.getState().setAnnouncements(data.announcements || []);
  });

  socket.on(EVENTS.SERVER.KICKED, (data) => {
    useUserStore.getState().setCurrentRoom(null);
    useMediaStore.getState().reset();
    clearChannelUrlParam();
    const actor = data.byAdmin ? '管理员' : '频道创建者';
    useRoomStore.getState().setNotification(`${actor}已将你踢出频道`);
    playSound('disconnected');
  });

  socket.on('room:closed', (data) => {
    useUserStore.getState().setCurrentRoom(null);
    useMediaStore.getState().reset();
    clearChannelUrlParam();
    useRoomStore.getState().setNotification(data.message || '频道已关闭');
    playSound('disconnected');
  });

  socket.on(EVENTS.SERVER.BANNED, (data) => {
    useUserStore.getState().setCurrentRoom(null);
    useMediaStore.getState().reset();
    clearChannelUrlParam();
    showToast(`你已被封禁: ${data.reason}`, 'error');
    playSound('disconnected');
  });

  socket.on(EVENTS.SERVER.FORCE_LOGOUT, (data) => {
    useUserStore.getState().setCurrentRoom(null);
    useMediaStore.getState().reset();
    clearChannelUrlParam();
    showToast(data.message || '你已被强制下线', 'error');
    useUserStore.getState().logout();
  });

  socket.on('dev:multi-login', (data) => {
    useRoomStore.getState().setNotification(data.message);
  });

  socket.on(EVENTS.SERVER.ROOM_INFO_UPDATED, (data) => {
    if (data.deleted) {
      useRoomStore.getState().removeChannel(data.roomId);
    } else {
      const channels = useRoomStore.getState().channels;
      const exists = channels.some((c) => c.roomId === data.roomId);
      if (exists) {
        if (data.newRoomId && data.newRoomId !== data.roomId) {
          useRoomStore.getState().removeChannel(data.roomId);
          useRoomStore.getState().addChannel({
            roomId: data.newRoomId,
            name: data.name,
            maxUsers: data.maxUsers,
            sortOrder: data.sortOrder,
            audioBitrate: data.audioBitrate,
            hasPassword: data.hasPassword,
            voiceChangerEnabled: data.voiceChangerEnabled,
          });
        } else {
          useRoomStore.getState().updateChannel(data.roomId, {
            name: data.name,
            maxUsers: data.maxUsers,
            sortOrder: data.sortOrder,
            audioBitrate: data.audioBitrate,
            hasPassword: data.hasPassword,
            voiceChangerEnabled: data.voiceChangerEnabled,
          });
        }
      } else {
        useRoomStore.getState().addChannel({
          roomId: data.roomId,
          name: data.name,
          maxUsers: data.maxUsers,
          sortOrder: data.sortOrder,
          audioBitrate: data.audioBitrate,
          hasPassword: data.hasPassword,
          voiceChangerEnabled: data.voiceChangerEnabled,
        });
      }
    }
  });

  socket.on(EVENTS.SERVER.ROOM_ONLINE_UPDATED, (data: { counts: Array<{ roomId: string; onlineCount: number; voiceCount: number }> }) => {
    for (const c of data.counts) {
      useRoomStore.getState().updateChannel(c.roomId, {
        onlineCount: c.onlineCount,
        voiceCount: c.voiceCount,
      } as any);
    }
  });

  socket.on(EVENTS.SERVER.SELF_MUTED, (data) => {
    const store = useRoomStore.getState();
    store.setActiveSpeaker(data.deviceId, -100, false);
    const timer = speakerExpiryTimers.get(data.deviceId);
    if (timer) { clearTimeout(timer); speakerExpiryTimers.delete(data.deviceId); }
  });

  socket.on(EVENTS.SERVER.NEW_PRODUCER, (data) => {
    useMediaStore.getState().addRemoteProducer({
      producerId: data.producerId,
      userId: data.userId,
      deviceId: data.deviceId,
      kind: data.kind,
    });
  });

  socket.on(EVENTS.SERVER.PRODUCER_CLOSED, (data) => {
    useMediaStore.getState().removeRemoteProducer(data.producerId);
    useMediaStore.getState().removeConsumer(data.producerId);
    const user = useRoomStore.getState().roomUsers.get(data.userId);
    if (data.userId !== useUserStore.getState().userId && data.reason === 'disconnect' && !user?.reconnecting) {
      playSound('otherDisconnected');
    }
  });

  socket.on(EVENTS.SERVER.ADMIN_AUTH_RESULT, (data) => {
    if (data.success) {
      useAdminStore.getState().setAdmin(true);
    }
  });

  socket.on(EVENTS.SERVER.ADMIN_BANLIST, (data) => {
    useAdminStore.getState().setBans(data.bans || []);
  });

  socket.on(EVENTS.SERVER.ERROR, (data) => {
    console.error(`[Error] ${data.event}: ${data.message}`);
    const isRoomJoin = data.event === EVENTS.CLIENT.ROOM_JOIN;
    const isPasswordError = data.message?.includes('密码');
    const isAdminEvent = data.event?.startsWith('admin:');
    if (isAdminEvent) return; // admin events have dedicated toast handlers
    if (!isRoomJoin || !isPasswordError) {
      useRoomStore.getState().setNotification(data.message);
    }
  });

  socket.on('latency:update', (data: { deviceId: string; latency: number }) => {
    useRoomStore.getState().setPeerLatency(data.deviceId, data.latency);
  });

  socket.on('site:info', (data: { siteName: string; version: string; loginFooter: string }) => {
    if (data.siteName) useRoomStore.getState().setSiteName(data.siteName);
    if (data.version) useRoomStore.getState().setVersion(data.version);
    if (data.loginFooter != null) useRoomStore.getState().setLoginFooter(data.loginFooter);
  });

  socket.on('site:info-updated', (data: { key: string; value: string }) => {
    if (data.key === 'version') useRoomStore.getState().setVersion(data.value);
    if (data.key === 'loginFooter') useRoomStore.getState().setLoginFooter(data.value);
  });

  socket.on(EVENTS.SERVER.ANNOUNCEMENT, (data) => {
    if (data.siteName) useRoomStore.getState().setSiteName(data.siteName);
  });

  socket.on('user:server-muted', (data: { userId: string; expiresAt: number; remaining: number; byAdmin?: boolean }) => {
    useMediaStore.getState().setServerMutedUser(data.userId, data.expiresAt);
    if (data.userId === useUserStore.getState().userId) {
      useMediaStore.getState().setAmIServerMuted(true, data.byAdmin);
    }
  });

  socket.on('user:server-muted-list', (data: { muted: Array<{ userId: string; expiresAt: number }> }) => {
    const store = useMediaStore.getState();
    store.clearServerMutedUsers();
    for (const m of data.muted || []) {
      store.setServerMutedUser(m.userId, m.expiresAt);
      if (m.userId === useUserStore.getState().userId) {
        store.setAmIServerMuted(true);
      }
    }
  });

  socket.on('user:server-unmuted', (data: { userId: string }) => {
    useMediaStore.getState().removeServerMutedUser(data.userId);
    if (data.userId === useUserStore.getState().userId) {
      useMediaStore.getState().setAmIServerMuted(false);
    }
  });

  socket.on(EVENTS.SERVER.KICKED_LIST, (data: { kicked: Array<{ deviceId: string; nickname?: string; expiresAt: number }> }) => {
    useAdminStore.getState().setKickedList(data.kicked || []);
  });

  socket.on('admin:config-list', (data: any) => {
    if (data.config) {
      useAdminStore.getState().setConfig({
        ...useAdminStore.getState().config,
        multiLogin: !!data.config['config:multi_login'],
        banDuration: data.config['config:ban_duration'] ?? 1440,
        muteDuration: data.config['config:mute_duration'] ?? 60,
        kickDuration: data.config['config:kick_duration'] ?? 60,
        pwdCooldown: data.config['config:pwd_retry_cooldown'] ?? 5,
        randomDeviceId: !!data.config['config:random_device_id'],
        userChannelEnabled: !!data.config['config:user_channel_enabled'],
        voiceChangerEnabled: !!data.config['config:voice_changer_enabled'],
        userChannelMaxPerDevice: data.config['config:user_channel_max_per_device'] ?? 1,
        userChannelMaxUsers: data.config['config:user_channel_max_users'] ?? 10,
        userChannelAllowedBitrates: data.config['config:user_channel_allowed_bitrates'] ?? '48',
        userChannelAutoDelete: data.config['config:user_channel_auto_delete'] ?? 10,
        userChannelMaxNameLen: data.config['config:user_channel_max_name_len'] ?? 6,
      });
    }
  });

  socket.on('config:voice-changer-updated', (data: { enabled: boolean }) => {
    useAdminStore.getState().setConfig({
      ...useAdminStore.getState().config,
      voiceChangerEnabled: data.enabled,
    });
  });
}
