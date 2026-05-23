const { getRoom } = require('../../mediasoup/roomManager');
const { getConnection } = require('./connection');
const { EVENTS } = require('../events');

function handleRoomEvents(socket, io) {

  socket.on(EVENTS.CLIENT.ROOM_LIST, async (_, cb) => {
    const { getAllChannels } = require('../../services/channelService');
    const channels = await getAllChannels();
    socket.emit(EVENTS.SERVER.ROOM_LIST, { rooms: channels });
    if (typeof cb === 'function') cb(channels);
  });

  socket.on(EVENTS.CLIENT.ROOM_JOIN, async ({ roomId }) => {
    const conn = getConnection(socket.id);
    if (!conn) return;

    if (conn.currentRoom) {
      leaveCurrentRoom(socket, io);
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.ROOM_JOIN, message: 'Room not found' });
      return;
    }

    if (room.isFull()) {
      socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.ROOM_JOIN, message: 'Room is full' });
      return;
    }

    conn.currentRoom = roomId;
    room.addUser(socket.id, { socketId: socket.id, userId: conn.userId, nickname: conn.nickname, deviceId: conn.deviceId });
    socket.join(roomId);

    room.broadcast(roomId, EVENTS.SERVER.USER_JOINED, {
      userId: conn.userId,
      nickname: conn.nickname,
      deviceId: conn.deviceId,
    });

    const users = Array.from(room.users.values());
    socket.emit(EVENTS.SERVER.ROOM_USERS, { roomId, users, count: room.getUserCount() });

    const { getAnnouncement, getSiteName } = require('../../services/channelService');
    const announcement = await getAnnouncement();
    const siteName = await getSiteName();
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: announcement, type: 'info', siteName });

    for (const [pid, info] of room.producers) {
      if (info.socketId !== socket.id) {
        socket.emit(EVENTS.SERVER.NEW_PRODUCER, {
          producerId: pid,
          userId: info.userId,
          deviceId: info.deviceId,
          kind: info.kind,
        });
      }
    }
  });

  socket.on(EVENTS.CLIENT.ROOM_LEAVE, () => {
    leaveCurrentRoom(socket, io);
  });
}

function leaveCurrentRoom(socket, io) {
  const conn = getConnection(socket.id);
  if (!conn || !conn.currentRoom) return;

  const roomId = conn.currentRoom;
  const room = getRoom(roomId);
  if (!room) return;

  const producers = room.getProducersForUser(socket.id);
  for (const p of producers) {
    const info = room.removeProducer(p.producerId);
    if (info?.instance) {
      try { info.instance.close(); } catch (e) { /* ignore */ }
    }
    room.removeConsumersForProducer(p.producerId);
    room.broadcast(roomId, EVENTS.SERVER.PRODUCER_CLOSED, {
      producerId: p.producerId,
      deviceId: conn.deviceId,
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

  room.removeUser(socket.id);
  socket.leave(roomId);

  room.broadcast(roomId, EVENTS.SERVER.USER_LEFT, {
    userId: conn.userId,
    deviceId: conn.deviceId,
    nickname: conn.nickname,
  });

  conn.currentRoom = null;
}

module.exports = { handleRoomEvents, leaveCurrentRoom };
