const SiteSettings = require('../../models/SiteSettings');
const { isAdmin, authenticate, removeAdmin, isUserIdAdmin } = require('../../services/adminService');
const { isBanned, addBan, removeBan, getBanList } = require('../../services/banService');
const { muteUsers, unmuteUsers, isUserMuted, getMutedList } = require('../../services/muteService');
const { kickUser, unkickUser, isKicked, getKickedList } = require('../../services/kickService');
const { createChannel, updateChannel, deleteChannel, getSiteName } = require('../../services/channelService');
const { getRoom, createRoom, removeRoom } = require('../../mediasoup/roomManager');
const { getConnection } = require('./connection');
const { leaveCurrentRoom } = require('./roomHandler');
const { EVENTS } = require('../events');

function handleAdminEvents(socket, io) {

  socket.on(EVENTS.CLIENT.ADMIN_AUTH, ({ password }) => {
    const conn = getConnection(socket.id);
    const success = authenticate(password, socket.id, conn?.deviceId || '');
    socket.emit(EVENTS.SERVER.ADMIN_AUTH_RESULT, { success, message: success ? 'Authenticated' : 'Wrong password' });
  });

  socket.on(EVENTS.CLIENT.ADMIN_CHANNEL_CREATE, async ({ name, maxUsers, roomId, sortOrder, audioBitrate }) => {
    if (!isAdmin(socket.id)) return;

    const rid = (roomId && roomId.trim()) ? roomId.trim() : name.toLowerCase().replace(/\s+/g, '-');
    const channel = await createChannel({ name, roomId: rid, maxUsers, sortOrder, audioBitrate });

    const room = createRoom(rid, channel.name, channel.maxUsers, channel.audioBitrate, io);
    await room.init();

    io.emit(EVENTS.SERVER.ROOM_INFO_UPDATED, {
      roomId: rid, name: channel.name, maxUsers: channel.maxUsers,
      sortOrder: channel.sortOrder, audioBitrate: channel.audioBitrate,
    });
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: `频道 "${name}" 已创建`, type: 'success' });
  });

  socket.on(EVENTS.CLIENT.ADMIN_CHANNEL_UPDATE, async ({ roomId, newRoomId, name, maxUsers, sortOrder, audioBitrate }) => {
    if (!isAdmin(socket.id)) return;

    const channel = await updateChannel(roomId, { name, maxUsers, newRoomId, sortOrder, audioBitrate });
    if (!channel) return;

    const effectiveRoomId = newRoomId || roomId;
    const room = getRoom(effectiveRoomId);
    if (room) {
      room.name = channel.name;
      room.maxUsers = channel.maxUsers;
      room.audioBitrate = channel.audioBitrate;
    }

    io.emit(EVENTS.SERVER.ROOM_INFO_UPDATED, {
      roomId, newRoomId: newRoomId || roomId,
      name: channel.name, maxUsers: channel.maxUsers,
      sortOrder: channel.sortOrder, audioBitrate: channel.audioBitrate,
    });
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: `频道 "${name}" 已更新`, type: 'success' });
  });

  socket.on(EVENTS.CLIENT.ADMIN_CHANNEL_DELETE, async ({ roomId }) => {
    if (!isAdmin(socket.id)) return;

    await deleteChannel(roomId);
    removeRoom(roomId);

    io.emit(EVENTS.SERVER.ROOM_INFO_UPDATED, { roomId, deleted: true });
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: `频道已删除`, type: 'warning' });
  });

  socket.on(EVENTS.CLIENT.ADMIN_SETTINGS_UPDATE, async ({ key, value }) => {
    if (!isAdmin(socket.id)) return;

    await SiteSettings.findOneAndUpdate(
      { key },
      { key, value, updatedBy: getConnection(socket.id)?.deviceId || 'admin' },
      { upsert: true, new: true }
    );

    if (key === 'announcement') {
      io.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: value, type: 'info' });
    }

    socket.emit(EVENTS.SERVER.SETTINGS_UPDATED, { key, value });
    if (key === 'siteName') {
      io.emit(EVENTS.SERVER.ANNOUNCEMENT, { siteName: value });
    }
    if (key === 'version' || key === 'loginFooter') {
      io.emit('site:info-updated', { key, value });
    }
  });

  socket.on('admin:config-getall', async () => {
    if (!isAdmin(socket.id)) return;
    const { getAllConfig } = require('../../services/configService');
    const config = await getAllConfig();
    socket.emit('admin:config-list', { config });
  });

  socket.on(EVENTS.CLIENT.ADMIN_ANNOUNCEMENT_CREATE, async ({ message }) => {
    if (!isAdmin(socket.id)) return;
    if (!message || !message.trim()) return;

    const doc = await SiteSettings.findOne({ key: 'announcements' });
    const list = doc?.value ? JSON.parse(doc.value) : [];
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      message: message.trim(),
      createdAt: new Date().toISOString(),
      active: true,
    };
    list.push(entry);

    await SiteSettings.findOneAndUpdate(
      { key: 'announcements' },
      { key: 'announcements', value: JSON.stringify(list) },
      { upsert: true, new: true }
    );

    const active = list.filter((a) => a.active);
    io.emit(EVENTS.SERVER.ANNOUNCEMENTS_UPDATED, { announcements: active });
  });

  socket.on(EVENTS.CLIENT.ADMIN_ANNOUNCEMENT_DELETE, async ({ id }) => {
    if (!isAdmin(socket.id)) return;

    const doc = await SiteSettings.findOne({ key: 'announcements' });
    if (!doc?.value) return;

    const list = JSON.parse(doc.value);
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) return;
    list[idx].active = false;

    await SiteSettings.findOneAndUpdate(
      { key: 'announcements' },
      { value: JSON.stringify(list) }
    );

    const active = list.filter((a) => a.active);
    io.emit(EVENTS.SERVER.ANNOUNCEMENTS_UPDATED, { announcements: active });
  });

  socket.on('admin:announcements:list', async () => {
    if (!isAdmin(socket.id)) return;
    const doc = await SiteSettings.findOne({ key: 'announcements' });
    const list = doc?.value ? JSON.parse(doc.value) : [];
    socket.emit('admin:announcements:list', { announcements: list });
  });

  socket.on(EVENTS.CLIENT.ADMIN_KICK, async ({ targetDeviceId }) => {
    if (!isAdmin(socket.id)) return;

    let roomId = null;
    const kickPromises = [];
    for (const [, room] of require('../../mediasoup/roomManager').getRooms()) {
      for (const [sid, user] of room.users) {
        if (user.deviceId === targetDeviceId) {
          if (isUserIdAdmin(user.userId)) continue;
          const targetSocket = io.sockets.sockets.get(sid);
          if (targetSocket) {
            const conn = getConnection(sid);
            const nickname = conn?.nickname || '';
            roomId = conn?.currentRoom;
            leaveCurrentRoom(targetSocket, io);
            if (roomId) {
              kickPromises.push(kickUser(roomId, targetDeviceId, nickname));
            }
            targetSocket.emit(EVENTS.SERVER.KICKED, { reason: '你已被踢出频道' });
          }
        }
      }
    }
    await Promise.all(kickPromises);

    if (roomId) {
      io.to(roomId).emit(EVENTS.SERVER.KICKED_LIST, { kicked: getKickedList(roomId) });
    }
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: '已踢出用户', type: 'warning' });
  });

  socket.on(EVENTS.CLIENT.ADMIN_KICKLIST, () => {
    if (!isAdmin(socket.id)) return;
    const conn = getConnection(socket.id);
    if (!conn?.currentRoom) return;
    const list = getKickedList(conn.currentRoom);
    socket.emit(EVENTS.SERVER.KICKED_LIST, { kicked: list });
  });

  socket.on(EVENTS.CLIENT.ADMIN_UNKICK, ({ deviceId }) => {
    if (!isAdmin(socket.id)) return;
    const conn = getConnection(socket.id);
    if (!conn?.currentRoom) return;
    unkickUser(conn.currentRoom, deviceId);
    io.to(conn.currentRoom).emit(EVENTS.SERVER.KICKED_LIST, { kicked: getKickedList(conn.currentRoom) });
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: '已解除踢出', type: 'success' });
  });

  socket.on(EVENTS.CLIENT.ADMIN_BAN, async ({ targetDeviceId, reason }) => {
    if (!isAdmin(socket.id)) return;

    let targetNickname = '';
    const socketsToDisconnect = [];
    for (const [, room] of require('../../mediasoup/roomManager').getRooms()) {
      for (const [sid, user] of room.users) {
        if (user.deviceId === targetDeviceId) {
          if (isUserIdAdmin(user.userId)) continue;
          const targetSocket = io.sockets.sockets.get(sid);
          if (targetSocket) {
            const conn = getConnection(sid);
            targetNickname = conn?.nickname || '';
            leaveCurrentRoom(targetSocket, io);
            targetSocket.emit(EVENTS.SERVER.BANNED, { reason: '你已被封禁' });
            socketsToDisconnect.push(targetSocket);
          }
        }
      }
    }
    for (const ts of socketsToDisconnect) ts.disconnect(true);

    await addBan(targetDeviceId, targetNickname, reason || '违反规则');
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: '已封禁用户', type: 'warning' });
  });

  socket.on(EVENTS.CLIENT.ADMIN_UNBAN, async ({ deviceId }) => {
    if (!isAdmin(socket.id)) return;
    await removeBan(deviceId);
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: '已解封用户', type: 'success' });
  });

  socket.on(EVENTS.CLIENT.ADMIN_BANLIST, async () => {
    if (!isAdmin(socket.id)) return;
    const bans = await getBanList();
    socket.emit(EVENTS.SERVER.ADMIN_BANLIST, { bans });
  });

  socket.on(EVENTS.CLIENT.ADMIN_MUTE_TARGET, async ({ targetDeviceId }) => {
    if (!isAdmin(socket.id)) return;
    const conn = getConnection(socket.id);
    if (!conn?.currentRoom) return;

    const room = getRoom(conn.currentRoom);
    if (!room) return;

    const targets = [];
    for (const [sid, user] of room.users) {
      if (user.deviceId === targetDeviceId && !isUserIdAdmin(user.userId)) {
        targets.push({ sid, userId: user.userId });
      }
    }

    if (targets.length > 0) {
      const userIds = targets.map(t => t.userId);
      const info = await muteUsers(conn.currentRoom, userIds);

      for (const t of targets) {
        const producers = room.getProducersForUser(t.sid);
        for (const p of producers) {
          const infoP = room.getProducer(p.producerId);
          if (infoP?.instance) {
            try { infoP.instance.pause(); } catch (e) { /* ignore */ }
            infoP.muted = true;
          }
        }
        const targetSocket = io.sockets.sockets.get(t.sid);
        if (targetSocket) {
          targetSocket.emit('user:server-muted', {
            userId: t.userId,
            expiresAt: info.expiresAt,
            remaining: info.remaining,
          });
        }
      }

      io.to(conn.currentRoom).emit('user:server-muted-list', { muted: getMutedList(conn.currentRoom) });
    }
  });

  socket.on(EVENTS.CLIENT.ADMIN_UNMUTE_TARGET, ({ targetDeviceId }) => {
    if (!isAdmin(socket.id)) return;
    const conn = getConnection(socket.id);
    if (!conn?.currentRoom) return;

    const room = getRoom(conn.currentRoom);
    if (!room) return;

    const targets = [];
    for (const [sid, user] of room.users) {
      if (user.deviceId === targetDeviceId && !isUserIdAdmin(user.userId)) {
        targets.push({ sid, userId: user.userId });
      }
    }

    if (targets.length > 0) {
      const userIds = targets.map(t => t.userId);
      unmuteUsers(conn.currentRoom, userIds);

      for (const t of targets) {
        const producers = room.getProducersForUser(t.sid);
        for (const p of producers) {
          const info = room.getProducer(p.producerId);
          if (info?.instance) {
            try { info.instance.resume(); } catch (e) { /* ignore */ }
            info.muted = false;
          }
        }
        const targetSocket = io.sockets.sockets.get(t.sid);
        if (targetSocket) {
          targetSocket.emit('user:server-unmuted', { userId: t.userId });
        }
      }

      io.to(conn.currentRoom).emit('user:server-muted-list', { muted: getMutedList(conn.currentRoom) });
    }
  });

  socket.on(EVENTS.CLIENT.ADMIN_CHANNELS_REORDER, async ({ channels }) => {
    if (!isAdmin(socket.id)) return;
    if (!Array.isArray(channels)) return;

    const { reorderChannels } = require('../../services/channelService');
    await reorderChannels(channels);

    const { getAllChannels } = require('../../services/channelService');
    const { getRooms } = require('../../mediasoup/roomManager');
    const allChannels = await getAllChannels();
    const rooms = getRooms();
    const enriched = allChannels.map((ch) => {
      const room = rooms.get(ch.roomId);
      return {
        ...ch,
        onlineCount: room ? room.users.size : 0,
        voiceCount: room ? room.getVoiceUserCount() : 0,
      };
    });
    io.emit(EVENTS.SERVER.ROOM_LIST, { rooms: enriched });
  });

  socket.on(EVENTS.CLIENT.ADMIN_TEMP_MUTE, ({ targetUserId }) => {
    if (!isAdmin(socket.id)) return;
    const conn = getConnection(socket.id);
    if (!conn?.currentRoom) return;

    const room = getRoom(conn.currentRoom);
    if (!room) return;

    for (const [sid, user] of room.users) {
      if (user.userId === targetUserId) {
        if (isUserIdAdmin(user.userId)) continue;
        const targetSocket = io.sockets.sockets.get(sid);
        if (targetSocket) {
          targetSocket.emit('temp-muted', { userId: targetUserId });
        }
      }
    }
  });
}

module.exports = { handleAdminEvents };
