const { getRoom, getRooms, broadcastAllRoomOnlineCounts, removeRoom } = require('../../mediasoup/roomManager');
const { getConnection, broadcastOnlineUsers } = require('./connection');
const { EVENTS } = require('../events');

const autoDeleteTimers = new Map();

async function startAutoDelete(roomId, io) {
  clearAutoDelete(roomId);
  const room = getRoom(roomId);
  if (!room || room.users.size > 0) return;

  const { getConfig } = require('../../services/configService');
  const minutes = Number(await getConfig('config:user_channel_auto_delete'));
  const delayMs = Math.max(1, Number.isFinite(minutes) ? minutes : 10) * 60 * 1000;
  const timer = setTimeout(async () => {
    autoDeleteTimers.delete(roomId);
    try {
      const currentRoom = getRoom(roomId);
      if (!currentRoom || currentRoom.users.size > 0) return;
      console.log(`[AutoDelete] Deleting empty user channel ${roomId}...`);
      const { deleteUserChannel, getAllChannels, serializeChannels } = require('../../services/channelService');
      await currentRoom.close();
      await deleteUserChannel(roomId);
      removeRoom(roomId);
      io.emit('room:list', { rooms: serializeChannels(await getAllChannels()) });
    } catch (e) {
      console.error(`[AutoDelete] Failed to delete ${roomId}:`, e);
    }
  }, delayMs);
  autoDeleteTimers.set(roomId, timer);
}

function clearAutoDelete(roomId) {
  const timer = autoDeleteTimers.get(roomId);
  if (timer) clearTimeout(timer);
  autoDeleteTimers.delete(roomId);
}

function handleRoomEvents(socket, io) {

  socket.on(EVENTS.CLIENT.ROOM_LIST, async (_, cb) => {
    const { getAllChannels, serializeChannels } = require('../../services/channelService');
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
    socket.emit(EVENTS.SERVER.ROOM_LIST, { rooms: serializeChannels(enriched) });
    if (typeof cb === 'function') cb(serializeChannels(enriched));
  });

  socket.on(EVENTS.CLIENT.ROOM_JOIN, async ({ roomId, password }) => {
    const conn = getConnection(socket.id);
    if (!conn) return;

    const { isKicked, getKickRemaining } = require('../../services/kickService');
    const { isUserIdAdmin } = require('../../services/adminService');
    if (isKicked(roomId, conn.deviceId) && !isUserIdAdmin(conn.userId)) {
      const remaining = getKickRemaining(roomId, conn.deviceId);
      let msg = '你已被踢出该频道';
      if (remaining != null && remaining > 0) {
        const sec = Math.ceil(remaining / 1000);
        const min = Math.floor(sec / 60);
        const s = sec % 60;
        msg = min > 0 ? `你已被踢出该频道，${min}分${s}秒后可重新加入` : `${s}秒后可重新加入`;
      }
      socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.ROOM_JOIN, message: msg });
      return;
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

    const { getAllChannels } = require('../../services/channelService');
    const channels = await getAllChannels();
    const ch = channels.find(c => c.roomId === roomId);
    if (ch?.password && !isUserIdAdmin(conn.userId) && ch.creatorDeviceId !== conn.deviceId) {
      const { getStatus, recordAttempt, lock, clear, MAX_ATTEMPTS } = require('../../services/passwordRateLimit');
      const { getConfig, getDurationMs } = require('../../services/configService');

      const status = getStatus(roomId, conn.deviceId);
      if (status.locked) {
        const waitMin = Math.ceil(status.waitSeconds / 60);
        socket.emit(EVENTS.SERVER.ERROR, {
          event: EVENTS.CLIENT.ROOM_JOIN,
          message: `密码错误次数过多，请 ${waitMin} 分钟后再试`,
        });
        return;
      }

      if (!password || password !== ch.password) {
        const count = recordAttempt(roomId, conn.deviceId);
        if (count >= MAX_ATTEMPTS) {
          const cdMin = await getConfig('config:pwd_retry_cooldown');
          lock(roomId, conn.deviceId, getDurationMs(cdMin));
          socket.emit(EVENTS.SERVER.ERROR, {
            event: EVENTS.CLIENT.ROOM_JOIN,
            message: `密码错误次数过多，请 ${cdMin} 分钟后再试`,
          });
        } else {
          socket.emit(EVENTS.SERVER.ERROR, {
            event: EVENTS.CLIENT.ROOM_JOIN,
            message: `密码错误 (${count}/${MAX_ATTEMPTS})`,
          });
        }
        return;
      }

      clear(roomId, conn.deviceId);
    }

    if (conn.currentRoom) {
      leaveCurrentRoom(socket, io);
    }

    conn.currentRoom = roomId;
    room.addUser(socket.id, { socketId: socket.id, userId: conn.userId, nickname: conn.nickname, deviceId: conn.deviceId });
    socket.join(roomId);

    clearAutoDelete(roomId);
    const { refreshActivity } = require('../../services/channelService');
    refreshActivity(roomId).catch(() => {});

    const { getMutedList } = require('../../services/muteService');
    const mutedList = getMutedList(roomId);
    socket.emit('user:server-muted-list', { muted: mutedList });

    // Only send voice-connected users (those with active producers)
    const voiceUsers = [];
    for (const [sid, user] of room.users) {
      if (room.getProducersForUser(sid).length > 0) {
        voiceUsers.push(user);
      }
    }
    socket.emit(EVENTS.SERVER.ROOM_USERS, { roomId, users: voiceUsers, count: voiceUsers.length, vcStates: room.getVcStates() });

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
    broadcastOnlineUsers(io);
  });

  // Voice changer status relay
  socket.on(EVENTS.CLIENT.VC_STATUS, (data) => {
    const conn = getConnection(socket.id);
    if (!conn || !conn.currentRoom) return;
    const room = getRoom(conn.currentRoom);
    if (!room) return;

    if (data.enabled) {
      room.setVcState(conn.deviceId, { enabled: true, presetLabel: data.presetLabel || '' });
    } else {
      room.removeVcState(conn.deviceId);
    }
    room.broadcast(conn.currentRoom, EVENTS.SERVER.VC_STATUS, {
      deviceId: conn.deviceId,
      enabled: !!data.enabled,
      presetLabel: data.presetLabel || '',
    });
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
  room.removeVcState(conn.deviceId);
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
  broadcastOnlineUsers(io);

  console.log(`[AutoDelete] leaveCurrentRoom: roomId=${roomId}, users.size=${room.users.size}`);
  if (room.users.size === 0) {
    console.log(`[AutoDelete] Room ${roomId} is empty, checking channel type...`);
    const { refreshActivity, getAllChannels } = require('../../services/channelService');
    refreshActivity(roomId).catch(() => {});
    getAllChannels().then(async chs => {
      const ch = chs.find(c => c.roomId === roomId);
      console.log(`[AutoDelete] Channel ${roomId} found:`, ch ? `type=${ch.type}` : 'NOT FOUND');
      if (ch?.type === 'user') {
        console.log(`[AutoDelete] Starting auto-delete for user channel ${roomId}`);
        await startAutoDelete(roomId, io);
      }
    }).catch((e) => console.error('[AutoDelete] Error in leaveCurrentRoom:', e));
  }
}

module.exports = { handleRoomEvents, leaveCurrentRoom, startAutoDelete };
