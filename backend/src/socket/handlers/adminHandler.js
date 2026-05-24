const SiteSettings = require('../../models/SiteSettings');
const { isAdmin, authenticate, removeAdmin } = require('../../services/adminService');
const { isBanned, addBan, removeBan, getBanList } = require('../../services/banService');
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

  socket.on(EVENTS.CLIENT.ADMIN_CHANNEL_CREATE, async ({ name, maxUsers }) => {
    if (!isAdmin(socket.id)) return;

    const roomId = name.toLowerCase().replace(/\s+/g, '-');
    const channel = await createChannel({ name, roomId, maxUsers });

    const room = createRoom(roomId, channel.name, channel.maxUsers, io);
    await room.init();

    io.emit(EVENTS.SERVER.ROOM_INFO_UPDATED, { roomId, name: channel.name, maxUsers: channel.maxUsers });
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: `频道 "${name}" 已创建`, type: 'success' });
  });

  socket.on(EVENTS.CLIENT.ADMIN_CHANNEL_UPDATE, async ({ roomId, name, maxUsers }) => {
    if (!isAdmin(socket.id)) return;

    const channel = await updateChannel(roomId, { name, maxUsers });
    if (!channel) return;

    const room = getRoom(roomId);
    if (room) {
      room.name = channel.name;
      room.maxUsers = channel.maxUsers;
    }

    io.emit(EVENTS.SERVER.ROOM_INFO_UPDATED, { roomId, name: channel.name, maxUsers: channel.maxUsers });
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

  socket.on(EVENTS.CLIENT.ADMIN_KICK, ({ targetDeviceId }) => {
    if (!isAdmin(socket.id)) return;

    for (const [, room] of require('../../mediasoup/roomManager').getRooms()) {
      const targetSocketId = room.getUserSocketByDeviceId(targetDeviceId);
      if (targetSocketId) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          leaveCurrentRoom(targetSocket, io);
          targetSocket.emit(EVENTS.SERVER.KICKED, { reason: 'You have been kicked by admin' });
        }
        break;
      }
    }
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: `已踢出用户`, type: 'warning' });
  });

  socket.on(EVENTS.CLIENT.ADMIN_BAN, async ({ targetDeviceId, reason }) => {
    if (!isAdmin(socket.id)) return;

    let targetNickname = '';
    for (const [, room] of require('../../mediasoup/roomManager').getRooms()) {
      const targetSocketId = room.getUserSocketByDeviceId(targetDeviceId);
      if (targetSocketId) {
        const conn = getConnection(targetSocketId);
        targetNickname = conn?.nickname || '';
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          leaveCurrentRoom(targetSocket, io);
          targetSocket.emit(EVENTS.SERVER.BANNED, { reason: reason || 'You have been banned' });
          targetSocket.disconnect(true);
        }
        break;
      }
    }

    await addBan(targetDeviceId, targetNickname, reason);
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: `已封禁用户`, type: 'warning' });
  });

  socket.on(EVENTS.CLIENT.ADMIN_UNBAN, async ({ deviceId }) => {
    if (!isAdmin(socket.id)) return;
    await removeBan(deviceId);
    socket.emit(EVENTS.SERVER.ANNOUNCEMENT, { message: `已解封用户`, type: 'success' });
  });

  socket.on(EVENTS.CLIENT.ADMIN_BANLIST, async () => {
    if (!isAdmin(socket.id)) return;
    const bans = await getBanList();
    socket.emit(EVENTS.SERVER.ADMIN_BANLIST, { bans });
  });

  socket.on(EVENTS.CLIENT.ADMIN_MUTE_TARGET, ({ targetDeviceId }) => {
    if (!isAdmin(socket.id)) return;

    for (const [, room] of require('../../mediasoup/roomManager').getRooms()) {
      const targetSocketId = room.getUserSocketByDeviceId(targetDeviceId);
      if (targetSocketId) {
        const producers = room.getProducersForUser(targetSocketId);
        for (const p of producers) {
          const info = room.getProducer(p.producerId);
          if (info?.instance) {
            try { info.instance.pause(); } catch (e) { /* ignore */ }
            info.muted = true;
          }
        }
        io.to(targetSocketId).emit(EVENTS.SERVER.TARGET_MUTED, { deviceId: targetDeviceId });
        break;
      }
    }
  });

  socket.on(EVENTS.CLIENT.ADMIN_UNMUTE_TARGET, ({ targetDeviceId }) => {
    if (!isAdmin(socket.id)) return;

    for (const [, room] of require('../../mediasoup/roomManager').getRooms()) {
      const targetSocketId = room.getUserSocketByDeviceId(targetDeviceId);
      if (targetSocketId) {
        const producers = room.getProducersForUser(targetSocketId);
        for (const p of producers) {
          const info = room.getProducer(p.producerId);
          if (info?.instance) {
            try { info.instance.resume(); } catch (e) { /* ignore */ }
            info.muted = false;
          }
        }
        io.to(targetSocketId).emit(EVENTS.SERVER.TARGET_UNMUTED, { deviceId: targetDeviceId });
        break;
      }
    }
  });
}

module.exports = { handleAdminEvents };
