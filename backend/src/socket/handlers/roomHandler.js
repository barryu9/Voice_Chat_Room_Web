const { getRoom, getRooms, broadcastAllRoomOnlineCounts } = require('../../mediasoup/roomManager');
const { getConnection } = require('./connection');
const { EVENTS } = require('../events');

function handleRoomEvents(socket, io) {

  socket.on(EVENTS.CLIENT.ROOM_LIST, async (_, cb) => {
    const { getAllChannels } = require('../../services/channelService');
    const channels = await getAllChannels();
    const rooms = getRooms();
    const enriched = channels.map((ch) => {
      const room = rooms.get(ch.roomId);
      return {
        ...ch,
        onlineCount: room ? room.users.size : 0,
        voiceCount: room ? room.getVoiceUserCount() : 0,
      };
    });
    socket.emit(EVENTS.SERVER.ROOM_LIST, { rooms: enriched });
    if (typeof cb === 'function') cb(enriched);
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

    // Only send voice-connected users (those with active producers)
    const voiceUsers = [];
    for (const [sid, user] of room.users) {
      if (room.getProducersForUser(sid).length > 0) {
        voiceUsers.push(user);
      }
    }
    socket.emit(EVENTS.SERVER.ROOM_USERS, { roomId, users: voiceUsers, count: voiceUsers.length });

    const { getAnnouncement, getSiteName, getAnnouncements } = require('../../services/channelService');
    const announcement = await getAnnouncement();
    const siteName = await getSiteName();
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: announcement, type: 'info', siteName });

    const announcements = await getAnnouncements();
    socket.emit(EVENTS.SERVER.ANNOUNCEMENTS_UPDATED, { announcements });

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

    broadcastAllRoomOnlineCounts(io);
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
  const hadProducers = producers.length > 0;

  for (const p of producers) {
    const info = room.removeProducer(p.producerId);
    if (info?.instance) {
      try { info.instance.close(); } catch (e) { /* ignore */ }
    }
    room.removeConsumersForProducer(p.producerId);
    room.broadcast(roomId, EVENTS.SERVER.PRODUCER_CLOSED, {
      producerId: p.producerId,
      userId: conn.userId,
      deviceId: conn.deviceId,
      reason: 'leave',
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

  if (hadProducers) {
    room.broadcast(roomId, EVENTS.SERVER.USER_LEFT, {
      userId: conn.userId,
      deviceId: conn.deviceId,
      nickname: conn.nickname,
      reason: 'leave',
    });
  }

  conn.currentRoom = null;
  broadcastAllRoomOnlineCounts(io);
}

module.exports = { handleRoomEvents, leaveCurrentRoom };
