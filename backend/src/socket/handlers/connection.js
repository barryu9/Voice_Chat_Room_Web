const { isBanned } = require('../services/banService');
const { getAllChannels } = require('../services/channelService');
const { EVENTS } = require('./events');

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
  });

  socket.on('disconnect', () => {
    const conn = connections.get(socket.id);
    if (conn && conn.currentRoom) {
      const { getRoom } = require('../mediasoup/roomManager');
      const room = getRoom(conn.currentRoom);
      if (room) {
        room.removeUser(socket.id);

        const producers = room.getProducersForUser(socket.id);
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

        room.broadcast(conn.currentRoom, EVENTS.SERVER.USER_LEFT, {
          userId: conn.userId,
          deviceId: conn.deviceId,
          nickname: conn.nickname,
        });

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
    }

    connections.delete(socket.id);
    const { adminSessions } = require('../services/adminService');
    adminSessions.delete(socket.id);
  });
}

function getConnections() {
  return connections;
}

function getConnection(socketId) {
  return connections.get(socketId);
}

module.exports = { handleConnection, getConnections, getConnection };
