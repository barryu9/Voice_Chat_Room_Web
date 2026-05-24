const { isBanned } = require('../../services/banService');
const { getAllChannels } = require('../../services/channelService');
const { EVENTS } = require('../events');

const connections = new Map();

function handleConnection(socket, io) {

  socket.on(EVENTS.CLIENT.USER_LOGIN, async ({ nickname, deviceId }) => {
    if (!nickname || !deviceId) {
      socket.emit(EVENTS.SERVER.LOGIN_ERROR, { message: 'Missing nickname or deviceId' });
      return;
    }

    const banned = await isBanned(deviceId);
    if (banned) {
      socket.emit(EVENTS.SERVER.LOGIN_ERROR, { message: 'You have been banned' });
      socket.disconnect(true);
      return;
    }

    const userId = socket.id;
    connections.set(socket.id, {
      socketId: socket.id,
      userId,
      nickname,
      deviceId,
      currentRoom: null,
    });

    const channels = await getAllChannels();

    socket.emit(EVENTS.SERVER.LOGIN_SUCCESS, {
      userId,
      nickname,
      deviceId,
      rooms: channels,
    });

    const { getAnnouncements, getSiteName } = require('../../services/channelService');
    const announcements = await getAnnouncements();
    const siteName = await getSiteName();
    socket.emit(EVENTS.SERVER.ANNOUNCEMENTS_UPDATED, { announcements });
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { siteName });
  });

  socket.on('latency:ping', (cb) => {
    if (typeof cb === 'function') cb({ time: Date.now() });
  });

  socket.on('latency:pong', () => {});

  socket.on('latency:report', ({ deviceId, latency }) => {
    const conn = connections.get(socket.id);
    if (!conn) return;
    if (conn.currentRoom) {
      socket.to(conn.currentRoom).emit('latency:update', { deviceId, latency });
    }
  });

  socket.on('user:updateNickname', ({ nickname }) => {
    if (!nickname || !nickname.trim()) return;
    const conn = connections.get(socket.id);
    if (!conn) return;
    conn.nickname = nickname.trim();
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
