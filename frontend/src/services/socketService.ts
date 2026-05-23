import { io, Socket } from 'socket.io-client';
import { EVENTS } from '../utils/constants';
import { useRoomStore } from '../stores/roomStore';
import { useUserStore } from '../stores/userStore';
import { useAdminStore } from '../stores/adminStore';
import { useMediaStore } from '../stores/mediaStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  registerListeners();
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

function registerListeners() {
  if (!socket) return;

  socket.on(EVENTS.SERVER.LOGIN_SUCCESS, (data) => {
    useUserStore.getState().setLogin(data.userId, data.nickname, data.deviceId);
    useRoomStore.getState().setChannels(data.rooms || []);
  });

  socket.on(EVENTS.SERVER.LOGIN_ERROR, (data) => {
    useRoomStore.getState().setAnnouncement(`登录失败: ${data.message}`);
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
  });

  socket.on(EVENTS.SERVER.USER_LEFT, (data) => {
    useRoomStore.getState().removeUser(data.userId);
  });

  socket.on(EVENTS.SERVER.ACTIVE_SPEAKER, (data) => {
    const threshold = useMediaStore.getState().noiseGateThreshold;
    const isSpeaking = data.isSpeaking && data.level > threshold;
    useRoomStore.getState().setActiveSpeaker(data.deviceId, data.level, isSpeaking);
  });

  socket.on(EVENTS.SERVER.ANNOUNCEMENT, (data) => {
    useRoomStore.getState().setAnnouncement(data.message);
    if (data.siteName) useRoomStore.getState().setSiteName(data.siteName);
  });

  socket.on(EVENTS.SERVER.KICKED, (data) => {
    useUserStore.getState().setCurrentRoom(null);
    useRoomStore.getState().setAnnouncement(`你已被踢出: ${data.reason}`);
  });

  socket.on(EVENTS.SERVER.BANNED, (data) => {
    useUserStore.getState().setCurrentRoom(null);
    useRoomStore.getState().setAnnouncement(`你已被封禁: ${data.reason}`);
  });

  socket.on(EVENTS.SERVER.ROOM_INFO_UPDATED, (data) => {
    if (data.deleted) {
      useRoomStore.getState().removeChannel(data.roomId);
    } else {
      useRoomStore.getState().updateChannel(data.roomId, {
        name: data.name,
        maxUsers: data.maxUsers,
      });
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
  });

  socket.on(EVENTS.SERVER.ADMIN_AUTH_RESULT, (data) => {
    if (data.success) {
      useAdminStore.getState().setAdmin(true);
      useAdminStore.getState().setShowPanel(true);
    }
  });

  socket.on(EVENTS.SERVER.ADMIN_BANLIST, (data) => {
    useAdminStore.getState().setBans(data.bans || []);
  });

  socket.on(EVENTS.SERVER.ERROR, (data) => {
    console.error(`[Error] ${data.event}: ${data.message}`);
    useRoomStore.getState().setAnnouncement(data.message);
  });
}
