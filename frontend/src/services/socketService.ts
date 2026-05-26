import { io, Socket } from 'socket.io-client';
import { EVENTS } from '../utils/constants';
import { useRoomStore } from '../stores/roomStore';
import { useUserStore } from '../stores/userStore';
import { useAdminStore } from '../stores/adminStore';
import { useMediaStore } from '../stores/mediaStore';
import { playSound } from './soundService';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  registerConnectionListeners();
  registerListeners();
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

function registerConnectionListeners() {
  if (!socket) return;

  socket.on('connect', () => {
    useUserStore.getState().setConnectionState('connected');
  });

  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') {
      useUserStore.getState().setConnectionState('failed');
      return;
    }
    useUserStore.getState().setConnectionState('disconnected');
  });

  socket.on('reconnect_attempt', (attempt) => {
    useUserStore.getState().setConnectionState('reconnecting', attempt);
  });

  socket.on('reconnect', () => {
    useUserStore.getState().setConnectionState('connected');
  });

  socket.on('reconnect_error', () => {
    useUserStore.getState().setConnectionState('reconnecting');
  });

  socket.on('reconnect_failed', () => {
    useUserStore.getState().setConnectionState('failed');
  });
}

function registerListeners() {
  if (!socket) return;

  socket.on(EVENTS.SERVER.LOGIN_SUCCESS, (data) => {
    useUserStore.getState().setLogin(data.userId, data.nickname, data.deviceId);
    useRoomStore.getState().setChannels(data.rooms || []);
  });

  socket.on(EVENTS.SERVER.LOGIN_ERROR, (data) => {
    useRoomStore.getState().setNotification(`登录失败: ${data.message}`);
  });

  socket.on(EVENTS.SERVER.ROOM_LIST, (data) => {
    useRoomStore.getState().setChannels(data.rooms || []);
  });

  socket.on(EVENTS.SERVER.ROOM_USERS, (data) => {
    useUserStore.getState().setCurrentRoom(data.roomId);
    useRoomStore.getState().setRoomUsers(data.users || []);
  });

  socket.on(EVENTS.SERVER.USER_JOINED, (data) => {
    useRoomStore.getState().addUser(data);
    if (data.userId !== useUserStore.getState().userId) {
      playSound('otherJoined');
    }
  });

  socket.on(EVENTS.SERVER.USER_LEFT, (data) => {
    useRoomStore.getState().removeUser(data.userId);
    if (data.userId !== useUserStore.getState().userId && data.reason !== 'disconnect') {
      playSound('otherLeft');
    }
  });

  socket.on('user:nickname-changed', (data: { userId: string; nickname: string }) => {
    useRoomStore.getState().updateUserNickname(data.userId, data.nickname);
  });

  socket.on(EVENTS.SERVER.ACTIVE_SPEAKER, (data) => {
    const threshold = useMediaStore.getState().noiseGateThreshold;
    const isSpeaking = data.isSpeaking && data.level > threshold;
    useRoomStore.getState().setActiveSpeaker(data.deviceId, data.level, isSpeaking);
  });

  socket.on(EVENTS.SERVER.ANNOUNCEMENTS_UPDATED, (data: { announcements: Array<{ id: string; message: string; createdAt: string }> }) => {
    useRoomStore.getState().setAnnouncements(data.announcements || []);
  });

  socket.on(EVENTS.SERVER.KICKED, (data) => {
    useUserStore.getState().setCurrentRoom(null);
    useMediaStore.getState().reset();
    useRoomStore.getState().setNotification(`你已被踢出: ${data.reason}`);
    playSound('disconnected');
  });

  socket.on(EVENTS.SERVER.BANNED, (data) => {
    useUserStore.getState().setCurrentRoom(null);
    useMediaStore.getState().reset();
    useRoomStore.getState().setNotification(`你已被封禁: ${data.reason}`);
    playSound('disconnected');
  });

  socket.on(EVENTS.SERVER.FORCE_LOGOUT, (data) => {
    useUserStore.getState().setCurrentRoom(null);
    useMediaStore.getState().reset();
    useRoomStore.getState().setNotification(data.message);
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
          });
        } else {
          useRoomStore.getState().updateChannel(data.roomId, {
            name: data.name,
            maxUsers: data.maxUsers,
            sortOrder: data.sortOrder,
            audioBitrate: data.audioBitrate,
          });
        }
      } else {
        useRoomStore.getState().addChannel({
          roomId: data.roomId,
          name: data.name,
          maxUsers: data.maxUsers,
          sortOrder: data.sortOrder,
          audioBitrate: data.audioBitrate,
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
    if (data.userId !== useUserStore.getState().userId && data.reason === 'disconnect') {
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
    useRoomStore.getState().setNotification(data.message);
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

  socket.on('user:server-muted', (data: { userId: string; expiresAt: number; remaining: number }) => {
    useMediaStore.getState().setServerMutedUser(data.userId, data.expiresAt);
    if (data.userId === useUserStore.getState().userId) {
      useMediaStore.getState().setAmIServerMuted(true);
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
}
