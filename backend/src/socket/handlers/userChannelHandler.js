const { createUserChannel, getUserChannelCount, updateUserChannel, deleteUserChannel, getAllChannels, serializeChannels } = require('../../services/channelService');
const { createRoom, removeRoom, destroyRoom, getRooms, getRoom } = require('../../mediasoup/roomManager');
const { getConnection } = require('./connection');
const { containsBlockedWord } = require('../../utils/blockedWords');
const { getConfig } = require('../../services/configService');
const { leaveCurrentRoom } = require('./roomHandler');

function handleUserChannelEvents(socket, io) {

  socket.on('user:channel-create', async (data) => {
    const conn = getConnection(socket.id);
    if (!conn) return;

    if (!(await getConfig('config:user_channel_enabled'))) {
      socket.emit('user:channel-error', { message: '临时频道功能已被管理员关闭' });
      return;
    }

    const maxPerDevice = await getConfig('config:user_channel_max_per_device');
    const count = await getUserChannelCount(conn.deviceId);
    if (count >= maxPerDevice) {
      socket.emit('user:channel-error', { message: `最多只能创建 ${maxPerDevice} 个频道` });
      return;
    }

    const maxNameLen = await getConfig('config:user_channel_max_name_len');
    if (!data.name || data.name.trim().length === 0 || data.name.trim().length > maxNameLen) {
      socket.emit('user:channel-error', { message: `频道名需为 1-${maxNameLen} 个字符` });
      return;
    }

    if (containsBlockedWord(data.name.trim())) {
      socket.emit('user:channel-error', { message: '频道名包含违规词汇' });
      return;
    }

    const maxUsers = await getConfig('config:user_channel_max_users');
    const bitrates = (await getConfig('config:user_channel_allowed_bitrates')).toString().split(',').map(Number);
    if (data.audioBitrate && !bitrates.includes(data.audioBitrate)) {
      data.audioBitrate = bitrates[0] || 48;
    }

    try {
      const ch = await createUserChannel({
        name: data.name.trim(),
        maxUsers: Math.max(2, Math.min(Number(data.maxUsers) || 10, Number(maxUsers))),
        audioBitrate: data.audioBitrate || bitrates[0] || 48,
        password: data.password || '',
        voiceChangerEnabled: data.voiceChangerEnabled !== false,
        creatorUserId: conn.userId,
        creatorNickname: conn.nickname,
        creatorDeviceId: conn.deviceId,
      });

      const room = createRoom(ch.roomId, ch.name, ch.maxUsers, ch.audioBitrate, io);
      await room.init();

      // Auto-join creator
      const { leaveCurrentRoom } = require('./roomHandler');
      if (conn.currentRoom) leaveCurrentRoom(socket, io);
      conn.currentRoom = ch.roomId;
      room.addUser(socket.id, { socketId: socket.id, userId: conn.userId, nickname: conn.nickname, deviceId: conn.deviceId });
      socket.join(ch.roomId);
      const { refreshActivity } = require('../../services/channelService');
      refreshActivity(ch.roomId).catch(() => {});

      // Notify frontend to navigate into room
      const { EVENTS } = require('../events');
      const { broadcastAllRoomOnlineCounts } = require('../../mediasoup/roomManager');
      broadcastAllRoomOnlineCounts(io);

      // Notify frontend to navigate into room
      socket.emit(EVENTS.SERVER.ROOM_USERS, { roomId: ch.roomId, users: [], count: 0 });

      const allCh = await getAllChannels();
      io.emit('room:list', { rooms: serializeChannels(allCh) });
      socket.emit('user:channel-created', { roomId: ch.roomId });
    } catch (e) {
      socket.emit('user:channel-error', { message: '创建失败' });
    }
  });

  socket.on('user:channel-update', async (data) => {
    const conn = getConnection(socket.id);
    if (!conn) return;

    if (!(await getConfig('config:user_channel_enabled'))) {
      socket.emit('user:channel-error', { message: '临时频道功能已被管理员关闭' });
      return;
    }

    const { isAdmin } = require('../../services/adminService');
    const isOwner = await (async () => {
      if (isAdmin(socket.id)) return true;
      const chs = await getAllChannels();
      const ch = chs.find(c => c.roomId === data.roomId);
      return ch?.creatorDeviceId === conn.deviceId;
    })();
    if (!isOwner) { socket.emit('user:channel-error', { message: '无权限修改' }); return; }

    const maxNameLen = await getConfig('config:user_channel_max_name_len');
    if (data.name && (data.name.trim().length === 0 || data.name.trim().length > maxNameLen)) {
      socket.emit('user:channel-error', { message: `频道名需为 1-${maxNameLen} 个字符` });
      return;
    }
    if (data.name && containsBlockedWord(data.name.trim())) {
      socket.emit('user:channel-error', { message: '频道名包含违规词汇' });
      return;
    }

    const maxUsers = Number(await getConfig('config:user_channel_max_users'));
    if (data.maxUsers !== undefined) {
      const requestedMaxUsers = Number(data.maxUsers);
      if (!Number.isInteger(requestedMaxUsers) || requestedMaxUsers < 2 || requestedMaxUsers > maxUsers) {
        socket.emit('user:channel-error', { message: `人数上限需为 2-${maxUsers}` });
        return;
      }
    }

    const bitrates = (await getConfig('config:user_channel_allowed_bitrates')).toString().split(',').map(Number);
    if (data.audioBitrate !== undefined && !bitrates.includes(Number(data.audioBitrate))) {
      socket.emit('user:channel-error', { message: '不支持该音质设置' });
      return;
    }

    const deviceId = isAdmin(socket.id) ? null : conn.deviceId;
    const updates = {
      name: data.name?.trim(),
      maxUsers: data.maxUsers === undefined ? undefined : Number(data.maxUsers),
      audioBitrate: data.audioBitrate === undefined ? undefined : Number(data.audioBitrate),
      password: data.password,
      voiceChangerEnabled: data.voiceChangerEnabled,
    };
    const ch = await updateUserChannel(data.roomId, deviceId, updates);
    if (!ch) {
      socket.emit('user:channel-error', { message: '无法修改' });
      return;
    }

    const room = getRoom(data.roomId);
    if (room) {
      if (ch.name) room.name = ch.name;
      if (ch.maxUsers) room.maxUsers = ch.maxUsers;
      if (ch.audioBitrate) room.audioBitrate = ch.audioBitrate;
    }

    const allCh = await getAllChannels();
    io.emit('room:list', { rooms: serializeChannels(allCh) });
    socket.emit('user:channel-updated', { roomId: data.roomId });
  });

  socket.on('user:channel-delete', async (data) => {
    const conn = getConnection(socket.id);
    if (!conn) return;

    const { isAdmin } = require('../../services/adminService');
    const { getAllChannels: getChs } = require('../../services/channelService');
    const channels = await getChs();
    const ch = channels.find(c => {
      if (c.roomId !== data.roomId || c.type !== 'user') return false;
      if (isAdmin(socket.id)) return true;
      return c.creatorDeviceId === conn.deviceId;
    });
    if (!ch) {
      socket.emit('user:channel-error', { message: '无权限删除' });
      return;
    }

    const room = getRoom(data.roomId);
    if (room) {
      const usersToKick = [...room.users.entries()];
      for (const [sid] of usersToKick) {
        const targetSocket = io.sockets.sockets.get(sid);
        if (targetSocket) {
          leaveCurrentRoom(targetSocket, io);
          if (sid !== socket.id) {
            const msg = isAdmin(socket.id) ? '频道已被管理员删除' : '频道已被创建者删除';
            targetSocket.emit('room:closed', { roomId: data.roomId, message: msg });
          }
        }
      }
    }

    await deleteUserChannel(data.roomId);
    removeRoom(data.roomId);
    if (room) await room.close();

    const allCh = await getAllChannels();
    io.emit('room:list', { rooms: serializeChannels(allCh) });
    socket.emit('user:channel-deleted', { roomId: data.roomId });
  });

}

module.exports = { handleUserChannelEvents };
