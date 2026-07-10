const { isBanned } = require('../../services/banService');
const { getAllChannels, serializeChannels } = require('../../services/channelService');
const { containsBlockedWord } = require('../../utils/blockedWords');
const { EVENTS } = require('../events');

const connections = new Map();
const RECONNECT_GRACE_MS = 60000;
const FAST_RECONNECT_MS = 5000;
const STALE_CONNECTION_MS = 5000;

function getOnlineUsers() {
  const { getRoom } = require('../../mediasoup/roomManager');
  const { isUserIdAdmin } = require('../../services/adminService');
  return Array.from(connections.values())
    .filter((conn) => !conn.disconnected)
    .map((conn) => {
      const room = conn.currentRoom ? getRoom(conn.currentRoom) : null;
      return {
        socketId: conn.socketId,
        userId: conn.userId,
        nickname: conn.nickname,
        deviceId: conn.deviceId,
        roomId: conn.currentRoom || null,
        inVoice: !!room && room.getProducersForUser(conn.socketId).length > 0,
        isAdmin: isUserIdAdmin(conn.userId),
      };
    });
}

function broadcastOnlineUsers(io) {
  io.emit(EVENTS.SERVER.ONLINE_USERS, { users: getOnlineUsers() });
}

function clearReconnectTimer(conn) {
  if (conn?.reconnectTimer) {
    clearTimeout(conn.reconnectTimer);
    conn.reconnectTimer = null;
  }
}

function clearReconnectNotifyTimer(conn) {
  if (conn?.reconnectNotifyTimer) {
    clearTimeout(conn.reconnectNotifyTimer);
    conn.reconnectNotifyTimer = null;
  }
}

function buildReconnectUser(conn, socketId) {
  return {
    socketId,
    userId: conn.userId,
    nickname: conn.nickname,
    deviceId: conn.deviceId,
  };
}

function notifyUserReconnecting(sid, conn) {
  if (!conn?.currentRoom || conn.reconnectNotified) return;

  const { getRoom } = require('../../mediasoup/roomManager');
  const room = getRoom(conn.currentRoom);
  if (!room || room.getProducersForUser(sid).length === 0) return;

  conn.reconnectNotified = true;
  const user = room.getUser(sid);
  if (user) {
    room.addUser(sid, { ...user, reconnecting: true });
  }
  room.broadcast(conn.currentRoom, EVENTS.SERVER.USER_RECONNECTING, buildReconnectUser(conn, sid));
}

function notifyUserReconnected(conn, socketId) {
  if (!conn?.recoveredRoom || !conn.reconnectNotified) return;

  const { getRoom } = require('../../mediasoup/roomManager');
  const room = getRoom(conn.recoveredRoom);
  if (!room) return;

  room.broadcast(conn.recoveredRoom, EVENTS.SERVER.USER_RECONNECTED, buildReconnectUser(conn, socketId));
  conn.reconnectNotified = false;
}

function cleanupConnectionResources(sid, conn, io, reason) {
  if (!conn?.currentRoom) return;

  const { getRoom, broadcastAllRoomOnlineCounts } = require('../../mediasoup/roomManager');
  const room = getRoom(conn.currentRoom);
  if (!room) return;

  room.removeUser(sid);
  room.removeVcState(conn.deviceId);
  io.sockets.sockets.get(sid)?.leave(conn.currentRoom);

  const producers = room.getProducersForUser(sid);
  const hadProducers = producers.length > 0;

  for (const p of producers) {
    const info = room.removeProducer(p.producerId);
    if (info?.instance) {
      try { info.instance.close(); } catch (e) { /* ignore */ }
    }
    room.removeConsumersForProducer(p.producerId);
    room.broadcast(conn.currentRoom, EVENTS.SERVER.PRODUCER_CLOSED, {
      producerId: p.producerId,
      userId: conn.userId,
      deviceId: conn.deviceId,
      reason,
    });
  }

  if (hadProducers && (reason === 'disconnect' || reason === 'leave')) {
    room.broadcast(conn.currentRoom, EVENTS.SERVER.USER_LEFT, {
      userId: conn.userId,
      deviceId: conn.deviceId,
      nickname: conn.nickname,
      reason: reason === 'disconnect' ? 'disconnect' : 'leave',
    });
  }

  const transportsToRemove = [];
  for (const [tid, t] of room.transports) {
    if (t.appData.socketId === sid) transportsToRemove.push(tid);
  }
  for (const tid of transportsToRemove) {
    const t = room.getTransport(tid);
    try { t?.close(); } catch (e) { /* ignore */ }
    room.removeTransport(tid);
  }

  if (room.users.size === 0 && reason !== 'reconnect') {
    const { refreshActivity, getAllChannels } = require('../../services/channelService');
    refreshActivity(conn.currentRoom).catch(() => {});
    const { startAutoDelete } = require('./roomHandler');
    getAllChannels().then(async chs => {
      const ch = chs.find(c => c.roomId === conn.currentRoom);
      if (ch?.type === 'user') await startAutoDelete(conn.currentRoom, io);
    }).catch((e) => console.error('[AutoDelete] Error in disconnect:', e));
  }

  if (reason !== 'reconnect') {
    broadcastAllRoomOnlineCounts(io);
  }
}

function cleanupVoiceResourcesForSocket(room, sid, conn, reason) {
  const producers = room.getProducersForUser(sid);
  for (const p of producers) {
    const info = room.removeProducer(p.producerId);
    if (info?.instance) {
      try { info.instance.close(); } catch (e) { /* ignore */ }
    }
    room.removeConsumersForProducer(p.producerId);
    room.broadcast(conn.currentRoom, EVENTS.SERVER.PRODUCER_CLOSED, {
      producerId: p.producerId,
      userId: conn.userId,
      deviceId: conn.deviceId,
      reason,
    });
  }

  const transportsToRemove = [];
  for (const [tid, t] of room.transports) {
    if (t.appData.socketId === sid) transportsToRemove.push(tid);
  }
  for (const tid of transportsToRemove) {
    const t = room.getTransport(tid);
    try { t?.close(); } catch (e) { /* ignore */ }
    room.removeTransport(tid);
  }
}

function endConnection(sid, io, reason) {
  const conn = connections.get(sid);
  if (!conn) return;

  clearReconnectTimer(conn);
  clearReconnectNotifyTimer(conn);
  cleanupConnectionResources(sid, conn, io, reason);

  const { removeAdmin } = require('../../services/adminService');
  removeAdmin(sid);
  connections.delete(sid);
  broadcastOnlineUsers(io);
}

function clearSupersededLogin(sid, io, existingSocket) {
  endConnection(sid, io, 'leave');
  existingSocket?.disconnect(true);
}

function finalizeDisconnectedConnection(sid, io) {
  const conn = connections.get(sid);
  if (!conn || !conn.disconnected) return;

  endConnection(sid, io, 'disconnect');
}

function recoverDisconnectedConnection(oldSid, socket, conn, nickname, io) {
  clearReconnectTimer(conn);
  clearReconnectNotifyTimer(conn);
  const recoveredRoom = conn.currentRoom;
  const disconnectedFor = conn.disconnectedAt ? Date.now() - conn.disconnectedAt : RECONNECT_GRACE_MS;
  let recoveredVoice = false;
  if (recoveredRoom) {
    const { getRoom } = require('../../mediasoup/roomManager');
    const room = getRoom(recoveredRoom);
    recoveredVoice = !!room && room.getProducersForUser(oldSid).length > 0;
  }

  if (disconnectedFor <= FAST_RECONNECT_MS) {
    const { getRoom } = require('../../mediasoup/roomManager');
    const room = recoveredRoom ? getRoom(recoveredRoom) : null;
    if (room) {
      const user = room.getUser(oldSid);
      room.removeUser(oldSid);
      cleanupVoiceResourcesForSocket(room, oldSid, conn, 'reconnect');
      room.addUser(socket.id, {
        ...(user || {}),
        socketId: socket.id,
        userId: conn.userId,
        nickname,
        deviceId: conn.deviceId,
        reconnecting: false,
      });
      for (const [, info] of room.consumers) {
        if (info.socketId === oldSid) info.socketId = socket.id;
      }
    }
  } else {
    cleanupConnectionResources(oldSid, conn, io, 'reconnect');
  }
  connections.delete(oldSid);

  conn.socketId = socket.id;
  conn.nickname = nickname;
  conn.socketId = socket.id;
  conn.currentRoom = null;
  conn.disconnected = false;
  conn.disconnectedAt = null;
  conn.reconnectTimer = null;
  conn.reconnectNotifyTimer = null;
  conn.recoveredRoom = recoveredRoom;
  conn.recoveredVoice = recoveredVoice;
  conn.suppressNextVoiceJoin = recoveredVoice;
  conn.lastSeenAt = Date.now();
  connections.set(socket.id, conn);
  notifyUserReconnected(conn, socket.id);
  return conn;
}

function handleConnection(socket, io) {
  socket.use((_, next) => {
    const conn = connections.get(socket.id);
    if (conn) conn.lastSeenAt = Date.now();
    next();
  });

  socket.on(EVENTS.CLIENT.USER_LOGIN, async ({ nickname, deviceId, recoverSession }) => {
    if (!nickname || !deviceId) {
      socket.emit(EVENTS.SERVER.LOGIN_ERROR, { message: 'Missing nickname or deviceId' });
      return;
    }

    const trimmed = nickname.trim();
    if (!trimmed || containsBlockedWord(trimmed)) {
      socket.emit(EVENTS.SERVER.LOGIN_ERROR, { message: '昵称包含违规词汇' });
      return;
    }

    const banned = await isBanned(deviceId);
    if (banned) {
      const Ban = require('../../models/Ban');
      const ban = await Ban.findOne({ deviceId });
      const remain = ban?.expiresAt ? Math.max(0, Math.ceil((new Date(ban.expiresAt).getTime() - Date.now()) / 1000)) : 0;
      const remainStr = remain > 0 ? `，解封剩余 ${Math.floor(remain / 60)} 分 ${remain % 60} 秒` : '';
      socket.emit(EVENTS.SERVER.LOGIN_ERROR, { message: `已被封禁${remainStr}` });
      return;
    }

    const { getConfig } = require('../../services/configService');
    const multiLogin = await getConfig('config:multi_login');
    let existingSid = null;
    let recoveredConn = null;
    for (const [sid, conn] of connections) {
      if (conn.deviceId === deviceId && sid !== socket.id) {
        const existingSocket = io.sockets.sockets.get(sid);
        const stale = conn.lastSeenAt && Date.now() - conn.lastSeenAt > STALE_CONNECTION_MS;
        if (recoverSession) {
          conn.disconnected = true;
          conn.disconnectedAt = conn.disconnectedAt || Date.now();
          existingSocket?.disconnect(true);
          recoveredConn = recoverDisconnectedConnection(sid, socket, conn, trimmed, io);
          break;
        }
        if (!existingSocket || !existingSocket.connected || stale) {
          if (conn.disconnected && conn.disconnectedAt && Date.now() - conn.disconnectedAt <= RECONNECT_GRACE_MS) {
            clearSupersededLogin(sid, io, existingSocket);
            continue;
          }
          if (stale && !recoverSession) {
            clearSupersededLogin(sid, io, existingSocket);
            continue;
          }
          // Stale connection — clean up the old entry
          if (conn.currentRoom) {
            const { getRoom } = require('../../mediasoup/roomManager');
            const room = getRoom(conn.currentRoom);
            if (room) {
              room.removeUser(sid);
              const producers = room.getProducersForUser(sid);
              for (const p of producers) {
                const info = room.removeProducer(p.producerId);
                if (info?.instance) try { info.instance.close(); } catch (e) {}
                room.removeConsumersForProducer(p.producerId);
                room.broadcast(conn.currentRoom, EVENTS.SERVER.PRODUCER_CLOSED, {
                  producerId: p.producerId,
                  userId: conn.userId,
                  deviceId: conn.deviceId,
                  reason: 'disconnect',
                });
              }
              if (producers.length > 0) {
                room.broadcast(conn.currentRoom, EVENTS.SERVER.USER_LEFT, {
                  userId: conn.userId,
                  deviceId: conn.deviceId,
                  nickname: conn.nickname,
                  reason: 'disconnect',
                });
              }
              const transportsToRemove = [];
              for (const [tid, t] of room.transports) {
                if (t.appData.socketId === sid) transportsToRemove.push(tid);
              }
              for (const tid of transportsToRemove) {
                const t = room.getTransport(tid);
                try { t?.close(); } catch (e) {}
                room.removeTransport(tid);
              }
              if (room.users.size === 0) {
                const { refreshActivity, getAllChannels } = require('../../services/channelService');
                refreshActivity(conn.currentRoom).catch(() => {});
                const { startAutoDelete } = require('./roomHandler');
                getAllChannels().then(async chs => {
                  const ch = chs.find(c => c.roomId === conn.currentRoom);
                  if (ch?.type === 'user') await startAutoDelete(conn.currentRoom, io);
                }).catch(() => {});
              }
            }
            const { broadcastAllRoomOnlineCounts } = require('../../mediasoup/roomManager');
            broadcastAllRoomOnlineCounts(io);
          }
          const { removeAdmin } = require('../../services/adminService');
          removeAdmin(sid);
          connections.delete(sid);
          continue;
        }
        existingSid = sid;
        break;
      }
    }
    if (existingSid) {
      if (multiLogin) {
        socket.emit('dev:multi-login', { message: '本设备登录了多个账号' });
      } else {
        socket.emit(EVENTS.SERVER.LOGIN_ERROR, { message: '该设备已经在其他地方登录过了' });
        setTimeout(() => socket.disconnect(true), 1500);
        return;
      }
    }

    const userId = recoveredConn ? recoveredConn.userId : socket.id;
    if (!recoveredConn) {
      connections.set(socket.id, {
        socketId: socket.id,
        userId,
        nickname: trimmed,
        deviceId,
        currentRoom: null,
        disconnected: false,
        disconnectedAt: null,
        reconnectTimer: null,
        reconnectNotifyTimer: null,
        reconnectNotified: false,
        recoveredRoom: null,
        recoveredVoice: false,
        lastSeenAt: Date.now(),
      });
    }

    const channels = await getAllChannels();
    const { getRooms } = require('../../mediasoup/roomManager');
    const roomMap = getRooms();
    const enriched = channels.map((ch) => {
      const room = roomMap.get(ch.roomId);
      return {
        ...ch,
        onlineCount: room ? room.users.size : 0,
        voiceCount: room ? room.getVoiceUserCount() : 0,
      };
    });

    socket.emit(EVENTS.SERVER.LOGIN_SUCCESS, {
      userId,
      nickname: trimmed,
      deviceId,
      rooms: serializeChannels(enriched),
      recoveredRoom: recoveredConn?.recoveredRoom || null,
      recoveredVoice: !!recoveredConn?.recoveredVoice,
    });

    const { getAnnouncements, getSiteName, getSetting } = require('../../services/channelService');
    const announcements = await getAnnouncements();
    const siteName = await getSiteName();
    const version = await getSetting('version');
    const loginFooter = await getSetting('loginFooter');
    socket.emit(EVENTS.SERVER.ANNOUNCEMENTS_UPDATED, { announcements });
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { siteName });
    socket.emit('site:info', { siteName, version, loginFooter });
    broadcastOnlineUsers(io);
  });

  socket.on(EVENTS.CLIENT.ONLINE_USERS_GET, () => {
    socket.emit(EVENTS.SERVER.ONLINE_USERS, { users: getOnlineUsers() });
  });

  socket.on('latency:ping', (cb) => {
    if (typeof cb === 'function') cb({ time: Date.now() });
  });

  socket.on('latency:pong', () => {});

  socket.on('site:info', async () => {
    const { getSiteName, getSetting } = require('../../services/channelService');
    const siteName = await getSiteName();
    const version = await getSetting('version') || '2026.05.24.v1';
    const loginFooter = await getSetting('loginFooter') || '';
    socket.emit('site:info', { siteName, version, loginFooter });
  });

  socket.on('latency:report', ({ deviceId, latency }) => {
    const conn = connections.get(socket.id);
    if (!conn) return;
    if (conn.currentRoom) {
      socket.to(conn.currentRoom).emit('latency:update', { deviceId, latency });
    }
  });

  socket.on('user:updateNickname', ({ nickname }) => {
    const trimmed = (nickname || '').trim();
    if (!trimmed || containsBlockedWord(trimmed)) return;
    const conn = connections.get(socket.id);
    if (!conn) return;
    conn.nickname = trimmed;
    broadcastOnlineUsers(io);
    if (conn.currentRoom) {
      const { getRoom } = require('../../mediasoup/roomManager');
      const room = getRoom(conn.currentRoom);
      if (room) {
        room.broadcast(conn.currentRoom, 'user:nickname-changed', {
          userId: conn.userId,
          deviceId: conn.deviceId,
          nickname: conn.nickname,
        });
      }
    }
  });

  socket.on(EVENTS.CLIENT.USER_LOGOUT, () => {
    endConnection(socket.id, io, 'leave');
  });

  socket.on('disconnect', (reason) => {
    const conn = connections.get(socket.id);
    if (conn) {
      if (reason === 'client namespace disconnect') {
        endConnection(socket.id, io, 'leave');
        return;
      }
      conn.disconnected = true;
      conn.disconnectedAt = Date.now();
      broadcastOnlineUsers(io);
      clearReconnectTimer(conn);
      clearReconnectNotifyTimer(conn);
      conn.reconnectNotifyTimer = setTimeout(() => {
        const current = connections.get(socket.id);
        if (!current || !current.disconnected) return;
        current.reconnectNotifyTimer = null;
        notifyUserReconnecting(socket.id, current);
      }, FAST_RECONNECT_MS + 100);
      conn.reconnectTimer = setTimeout(() => {
        finalizeDisconnectedConnection(socket.id, io);
      }, RECONNECT_GRACE_MS);
      return;
    }
    if (conn && conn.currentRoom) {
      const { getRoom } = require('../../mediasoup/roomManager');
      const room = getRoom(conn.currentRoom);
      if (room) {
        room.removeUser(socket.id);
        room.removeVcState(conn.deviceId);

        const producers = room.getProducersForUser(socket.id);
        const hadProducers = producers.length > 0;

        for (const p of producers) {
          const producerInfo = room.removeProducer(p.producerId);
          if (producerInfo?.instance) {
            try { producerInfo.instance.close(); } catch (e) { /* ignore */ }
          }
          room.removeConsumersForProducer(p.producerId);
          room.broadcast(conn.currentRoom, EVENTS.SERVER.PRODUCER_CLOSED, {
            producerId: p.producerId,
            userId: conn.userId,
            deviceId: conn.deviceId,
            reason: 'disconnect',
          });
        }

        if (hadProducers) {
          room.broadcast(conn.currentRoom, EVENTS.SERVER.USER_LEFT, {
            userId: conn.userId,
            deviceId: conn.deviceId,
            nickname: conn.nickname,
            reason: 'disconnect',
          });
        }

        const transportsToRemove = [];
        for (const [tid, t] of room.transports) {
          if (t.appData.socketId === socket.id) {
            transportsToRemove.push(tid);
          }
        }
        for (const tid of transportsToRemove) {
          const t = room.getTransport(tid);
          try { t?.close(); } catch (e) { /* ignore */ }
          room.removeTransport(tid);
        }

        if (room.users.size === 0) {
          const { refreshActivity, getAllChannels } = require('../../services/channelService');
          refreshActivity(conn.currentRoom).catch(() => {});
          const { startAutoDelete } = require('./roomHandler');
          getAllChannels().then(async chs => {
            const ch = chs.find(c => c.roomId === conn.currentRoom);
            if (ch?.type === 'user') await startAutoDelete(conn.currentRoom, io);
          }).catch((e) => console.error('[AutoDelete] Error in disconnect:', e));
        }
      }
      const { broadcastAllRoomOnlineCounts } = require('../../mediasoup/roomManager');
      broadcastAllRoomOnlineCounts(io);
    }

    const { removeAdmin } = require('../../services/adminService');
    removeAdmin(socket.id);
    connections.delete(socket.id);
  });
}

function getConnections() {
  return connections;
}

function getConnection(socketId) {
  return connections.get(socketId);
}

module.exports = { handleConnection, getConnections, getConnection, broadcastOnlineUsers };
