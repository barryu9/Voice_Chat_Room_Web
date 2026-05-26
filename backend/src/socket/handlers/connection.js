const { isBanned } = require('../../services/banService');
const { getAllChannels } = require('../../services/channelService');
const { containsBlockedWord } = require('../../utils/blockedWords');
const { EVENTS } = require('../events');

const connections = new Map();

function handleConnection(socket, io) {

  socket.on(EVENTS.CLIENT.USER_LOGIN, async ({ nickname, deviceId }) => {
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
    for (const [sid, conn] of connections) {
      if (conn.deviceId === deviceId && sid !== socket.id) {
        const existingSocket = io.sockets.sockets.get(sid);
        if (!existingSocket || !existingSocket.connected) {
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
                  deviceId: conn.deviceId,
                });
              }
              if (producers.length > 0) {
                room.broadcast(conn.currentRoom, EVENTS.SERVER.USER_LEFT, {
                  userId: conn.userId,
                  deviceId: conn.deviceId,
                  nickname: conn.nickname,
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

    const userId = socket.id;
    connections.set(socket.id, {
      socketId: socket.id,
      userId,
      nickname: trimmed,
      deviceId,
      currentRoom: null,
    });

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
      rooms: enriched,
    });

    const { getAnnouncements, getSiteName, getSetting } = require('../../services/channelService');
    const announcements = await getAnnouncements();
    const siteName = await getSiteName();
    const version = await getSetting('version');
    const loginFooter = await getSetting('loginFooter');
    socket.emit(EVENTS.SERVER.ANNOUNCEMENTS_UPDATED, { announcements });
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { siteName });
    socket.emit('site:info', { siteName, version, loginFooter });
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

  socket.on('disconnect', () => {
    const conn = connections.get(socket.id);
    if (conn && conn.currentRoom) {
      const { getRoom } = require('../../mediasoup/roomManager');
      const room = getRoom(conn.currentRoom);
      if (room) {
        room.removeUser(socket.id);

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
            deviceId: conn.deviceId,
          });
        }

        if (hadProducers) {
          room.broadcast(conn.currentRoom, EVENTS.SERVER.USER_LEFT, {
            userId: conn.userId,
            deviceId: conn.deviceId,
            nickname: conn.nickname,
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

module.exports = { handleConnection, getConnections, getConnection };
