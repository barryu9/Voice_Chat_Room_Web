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

  async function isChannelCreator(roomId) {
    if (!roomId) return false;
    const conn = getConnection(socket.id);
    if (!conn) return false;
    const { getAllChannels } = require('../../services/channelService');
    const chs = await getAllChannels();
    const ch = chs.find(c => c.roomId === roomId);
    return ch?.type === 'user' && ch?.creatorUserId === conn.userId;
  }

  async function hasMutePower(roomId) {
    return isAdmin(socket.id) || await isChannelCreator(roomId);
  }

  socket.on(EVENTS.CLIENT.ADMIN_AUTH, ({ password }) => {
    const conn = getConnection(socket.id);
    const success = authenticate(password, socket.id, conn?.deviceId || '');
    socket.emit(EVENTS.SERVER.ADMIN_AUTH_RESULT, { success, message: success ? 'Authenticated' : 'Wrong password' });
  });

  socket.on(EVENTS.CLIENT.ADMIN_CHANNEL_CREATE, async ({ name, maxUsers, roomId, sortOrder, audioBitrate, password, voiceChangerEnabled }) => {
    if (!isAdmin(socket.id)) return;

    const rid = (roomId && roomId.trim()) ? roomId.trim() : name.toLowerCase().replace(/\s+/g, '-');
    try {
      const channel = await createChannel({ name, roomId: rid, maxUsers, sortOrder, audioBitrate, password, voiceChangerEnabled });

      const room = createRoom(rid, channel.name, channel.maxUsers, channel.audioBitrate, io);
      await room.init();

      io.emit(EVENTS.SERVER.ROOM_INFO_UPDATED, {
        roomId: rid, name: channel.name, maxUsers: channel.maxUsers,
        sortOrder: channel.sortOrder, audioBitrate: channel.audioBitrate,
        password: channel.password, voiceChangerEnabled: channel.voiceChangerEnabled,
      });
      socket.emit('admin:channel-created', { roomId: rid, name: channel.name });
      socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: `频道 "${name}" 已创建`, type: 'success' });
    } catch (e) {
      socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.ADMIN_CHANNEL_CREATE, message: '频道已存在或创建失败' });
    }
  });

  socket.on(EVENTS.CLIENT.ADMIN_CHANNEL_UPDATE, async ({ roomId, newRoomId, name, maxUsers, sortOrder, audioBitrate, password, voiceChangerEnabled }) => {
    if (!isAdmin(socket.id)) return;

    try {
      const channel = await updateChannel(roomId, { name, maxUsers, newRoomId, sortOrder, audioBitrate, password, voiceChangerEnabled });
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
        password: channel.password, voiceChangerEnabled: channel.voiceChangerEnabled,
      });
      socket.emit('admin:channel-updated', { roomId, name: channel.name });
      socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: `频道 "${name}" 已更新`, type: 'success' });
    } catch (e) {
      socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.ADMIN_CHANNEL_UPDATE, message: '频道名已存在或更新失败' });
    }
  });

  socket.on(EVENTS.CLIENT.ADMIN_CHANNEL_DELETE, async ({ roomId }) => {
    if (!isAdmin(socket.id)) return;

    const room = getRoom(roomId);
    if (room) {
      const usersToKick = [...room.users.entries()];
      for (const [sid] of usersToKick) {
        const targetSocket = io.sockets.sockets.get(sid);
        if (targetSocket) {
          leaveCurrentRoom(targetSocket, io);
          if (sid !== socket.id) {
            targetSocket.emit('room:closed', { roomId, message: '频道已被管理员删除' });
          }
        }
      }
    }

    await deleteChannel(roomId);
    removeRoom(roomId);
    if (room) await room.close();

    io.emit(EVENTS.SERVER.ROOM_INFO_UPDATED, { roomId, deleted: true });
    socket.emit('admin:channel-deleted', { roomId });
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

  socket.on('user:channel-config', async () => {
    const { getConfig } = require('../../services/configService');
    const config = {
      maxNameLen: await getConfig('config:user_channel_max_name_len'),
      maxUsers: await getConfig('config:user_channel_max_users'),
      allowedBitrates: await getConfig('config:user_channel_allowed_bitrates'),
      maxPerDevice: await getConfig('config:user_channel_max_per_device'),
      enabled: await getConfig('config:user_channel_enabled'),
      voiceChangerEnabled: await getConfig('config:voice_changer_enabled'),
    };
    socket.emit('user:channel-config', config);
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
    socket.emit('admin:announcement-created', { id: entry.id, message: entry.message });
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
    socket.emit('admin:announcement-deleted', { id });
  });

  socket.on('admin:announcements:list', async () => {
    if (!isAdmin(socket.id)) return;
    const doc = await SiteSettings.findOne({ key: 'announcements' });
    const list = doc?.value ? JSON.parse(doc.value) : [];
    socket.emit('admin:announcements:list', { announcements: list });
  });

  socket.on(EVENTS.CLIENT.ADMIN_KICK, async ({ targetDeviceId }) => {
    const conn = getConnection(socket.id);
    if (!isAdmin(socket.id) && !(await isChannelCreator(conn?.currentRoom))) return;

    let roomId = null;
    let foundTarget = false;
    let targetIsAdmin = false;
    const kickPromises = [];
    for (const [, room] of require('../../mediasoup/roomManager').getRooms()) {
      for (const [sid, user] of room.users) {
        if (user.deviceId === targetDeviceId) {
          foundTarget = true;
          if (isUserIdAdmin(user.userId)) { targetIsAdmin = true; continue; }
          const targetSocket = io.sockets.sockets.get(sid);
          if (targetSocket) {
            const conn = getConnection(sid);
            const nickname = conn?.nickname || '';
            roomId = conn?.currentRoom;
            const byAdmin = isAdmin(socket.id);
            leaveCurrentRoom(targetSocket, io);
            if (roomId) {
              kickPromises.push(kickUser(roomId, targetDeviceId, nickname));
            }
            targetSocket.emit(EVENTS.SERVER.KICKED, { reason: '你已被踢出频道', byAdmin });
          }
        }
      }
    }
    await Promise.all(kickPromises);

    if (foundTarget && targetIsAdmin && kickPromises.length === 0) {
      socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.ADMIN_KICK, message: '无法对管理员进行踢出' });
      return;
    }

    if (roomId) {
      io.to(roomId).emit(EVENTS.SERVER.KICKED_LIST, { kicked: getKickedList(roomId) });
    }
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: '已踢出用户', type: 'warning' });
  });

  socket.on(EVENTS.CLIENT.ADMIN_KICKLIST, async () => {
    const conn = getConnection(socket.id);
    if (!isAdmin(socket.id) && !(await isChannelCreator(conn?.currentRoom))) return;
    if (!conn?.currentRoom) return;
    const list = getKickedList(conn.currentRoom);
    socket.emit(EVENTS.SERVER.KICKED_LIST, { kicked: list });
  });

  socket.on(EVENTS.CLIENT.ADMIN_UNKICK, async ({ deviceId }) => {
    const conn = getConnection(socket.id);
    if (!isAdmin(socket.id) && !(await isChannelCreator(conn?.currentRoom))) return;
    if (!conn?.currentRoom) return;
    unkickUser(conn.currentRoom, deviceId);
    io.to(conn.currentRoom).emit(EVENTS.SERVER.KICKED_LIST, { kicked: getKickedList(conn.currentRoom) });
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: '已解除踢出', type: 'success' });
  });

  socket.on(EVENTS.CLIENT.ADMIN_BAN, async ({ targetDeviceId, reason }) => {
    if (!isAdmin(socket.id)) return;

    let targetNickname = '';
    let foundTarget = false;
    let targetIsAdmin = false;
    const socketsToDisconnect = [];
    for (const [, room] of require('../../mediasoup/roomManager').getRooms()) {
      for (const [sid, user] of room.users) {
        if (user.deviceId === targetDeviceId) {
          foundTarget = true;
          if (isUserIdAdmin(user.userId)) { targetIsAdmin = true; continue; }
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

    if (foundTarget && targetIsAdmin && socketsToDisconnect.length === 0) {
      socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.ADMIN_BAN, message: '无法对管理员进行封禁' });
      return;
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
    const conn = getConnection(socket.id);
    if (!isAdmin(socket.id) && !(await isChannelCreator(conn?.currentRoom))) return;
    if (!conn?.currentRoom) return;

    const room = getRoom(conn.currentRoom);
    if (!room) return;

    const targets = [];
    let foundTarget = false;
    for (const [sid, user] of room.users) {
      if (user.deviceId === targetDeviceId) {
        foundTarget = true;
        if (!isUserIdAdmin(user.userId)) {
          targets.push({ sid, userId: user.userId });
        }
      }
    }

    if (foundTarget && targets.length === 0) {
      socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.ADMIN_MUTE_TARGET, message: '无法对管理员进行禁言' });
      return;
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
          const byAdmin = isAdmin(socket.id);
          targetSocket.emit('user:server-muted', {
            userId: t.userId,
            expiresAt: info.expiresAt,
            remaining: info.remaining,
            byAdmin,
          });
        }
      }

      io.to(conn.currentRoom).emit('user:server-muted-list', { muted: getMutedList(conn.currentRoom) });
    }
  });

  socket.on(EVENTS.CLIENT.ADMIN_UNMUTE_TARGET, async ({ targetDeviceId }) => {
    const conn = getConnection(socket.id);
    if (!isAdmin(socket.id) && !(await isChannelCreator(conn?.currentRoom))) return;
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

  socket.on(EVENTS.CLIENT.ADMIN_TEMP_MUTE, async ({ targetUserId }) => {
    const conn = getConnection(socket.id);
    if (!isAdmin(socket.id) && !(await isChannelCreator(conn?.currentRoom))) return;
    if (!conn?.currentRoom) return;

    const room = getRoom(conn.currentRoom);
    if (!room) return;

    let foundTarget = false;
    let mutedCount = 0;
    for (const [sid, user] of room.users) {
      if (user.userId === targetUserId) {
        foundTarget = true;
        if (isUserIdAdmin(user.userId)) continue;
        const targetSocket = io.sockets.sockets.get(sid);
        if (targetSocket) {
          const byAdmin = isAdmin(socket.id);
          targetSocket.emit('temp-muted', { userId: targetUserId, byAdmin });
          mutedCount++;
        }
      }
    }
    if (foundTarget && mutedCount === 0) {
      socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.ADMIN_TEMP_MUTE, message: '无法对管理员进行强制关麦' });
    }
  });
}

module.exports = { handleAdminEvents };
