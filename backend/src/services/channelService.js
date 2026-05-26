const Channel = require('../models/Channel');
const { createRoom, destroyRoom } = require('../mediasoup/roomManager');

async function initChannels(io) {
  const channels = await Channel.find({}).lean();

  if (channels.length === 0) {
    await Channel.create({ roomId: 'lobby', name: '大厅', maxUsers: 50, isDefault: true, sortOrder: 0, audioBitrate: 48 });
    await Channel.create({ roomId: 'music', name: '音乐频道', maxUsers: 20, sortOrder: 1, audioBitrate: 128 });
    await Channel.create({ roomId: 'gaming', name: '游戏频道', maxUsers: 20, sortOrder: 2, audioBitrate: 96 });
  }

  const allChannels = await Channel.find({}).lean();

  for (const ch of allChannels) {
    const room = createRoom(ch.roomId, ch.name, ch.maxUsers, ch.audioBitrate, io);
    await room.init();
  }

  console.log(`[Channel] Loaded ${allChannels.length} channels from DB`);
  return allChannels;
}

async function getAllChannels() {
  return Channel.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean();
}

async function createChannel(data) {
  const existing = await Channel.findOne({ name: data.name }).lean();
  if (existing) throw new Error('频道名已存在');

  let sortOrder = data.sortOrder;
  if (sortOrder === undefined || sortOrder === null) {
    const maxCh = await Channel.findOne({}).sort({ sortOrder: -1 }).lean();
    sortOrder = maxCh ? (maxCh.sortOrder || 0) + 1 : 0;
  }

  const channel = await Channel.create({
    roomId: data.roomId || data.name.toLowerCase().replace(/\s+/g, '-'),
    name: data.name,
    maxUsers: data.maxUsers || 20,
    sortOrder,
    audioBitrate: data.audioBitrate ?? 48,
    password: data.password || '',
    passwordText: data.passwordText || '',
  });
  return channel;
}

async function updateChannel(roomId, updates) {
  const setFields = { ...updates };
  const newRoomId = setFields.newRoomId;
  delete setFields.newRoomId;

  if (updates.name) {
    const dup = await Channel.findOne({ name: updates.name, roomId: { $ne: roomId } }).lean();
    if (dup) throw new Error('频道名已存在');
  }

  if (newRoomId && newRoomId !== roomId) {
    setFields.roomId = newRoomId;
  }

  const channel = await Channel.findOneAndUpdate(
    { roomId },
    { $set: setFields },
    { new: true }
  ).lean();
  return channel;
}

async function deleteChannel(roomId) {
  const channel = await Channel.findOne({ roomId });
  if (!channel) return null;
  if (channel.isDefault) throw new Error('Cannot delete default channel');
  await Channel.deleteOne({ roomId });
  await destroyRoom(roomId);
  return channel;
}

async function getAnnouncement() {
  const SiteSettings = require('../models/SiteSettings');
  const doc = await SiteSettings.findOne({ key: 'announcement' });
  return doc?.value || '';
}

async function getSiteName() {
  const SiteSettings = require('../models/SiteSettings');
  const doc = await SiteSettings.findOne({ key: 'siteName' });
  return doc?.value || '语音聊天室';
}

async function getAnnouncements() {
  const SiteSettings = require('../models/SiteSettings');
  const doc = await SiteSettings.findOne({ key: 'announcements' });
  if (!doc?.value) return [];
  const list = JSON.parse(doc.value);
  return list.filter((a) => a.active);
}

async function getSetting(key) {
  const SiteSettings = require('../models/SiteSettings');
  const doc = await SiteSettings.findOne({ key });
  return doc?.value || '';
}

async function reorderChannels(items) {
  await Promise.all(
    items.map(({ roomId, sortOrder }) =>
      Channel.updateOne({ roomId }, { $set: { sortOrder } })
    )
  );
}

async function createUserChannel(data) {
  const existing = await Channel.findOne({ name: data.name }).lean();
  if (existing) throw new Error('频道名已存在');

  const rid = 'user-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ch = await Channel.create({
    roomId: rid,
    name: data.name,
    maxUsers: data.maxUsers || 10,
    sortOrder: 99999,
    audioBitrate: data.audioBitrate || 48,
    password: data.password || '',
    passwordText: data.passwordText || '',
    type: 'user',
    creatorUserId: data.creatorUserId,
    creatorNickname: data.creatorNickname,
    creatorDeviceId: data.creatorDeviceId,
    lastActivityAt: new Date(),
  });
  return ch;
}

async function getUserChannelCount(deviceId) {
  return Channel.countDocuments({ type: 'user', creatorDeviceId: deviceId });
}

async function getUserChannelsByDevice(deviceId) {
  return Channel.find({ type: 'user' }).lean();
}

async function updateUserChannel(roomId, deviceId, updates) {
  const query = deviceId
    ? { roomId, type: 'user', creatorDeviceId: deviceId }
    : { roomId, type: 'user' };
  const ch = await Channel.findOne(query);
  if (!ch) return null;
  const setFields = {};
  if (updates.name !== undefined) setFields.name = updates.name;
  if (updates.maxUsers !== undefined) setFields.maxUsers = updates.maxUsers;
  if (updates.audioBitrate !== undefined) setFields.audioBitrate = updates.audioBitrate;
  if (updates.password !== undefined) setFields.password = updates.password;
  return Channel.findOneAndUpdate({ roomId }, { $set: setFields }, { new: true }).lean();
}

async function refreshActivity(roomId) {
  await Channel.updateOne({ roomId, type: 'user' }, { $set: { lastActivityAt: new Date() } });
}

async function deleteUserChannel(roomId) {
  await Channel.deleteOne({ roomId, type: 'user' });
}

module.exports = {
  initChannels, getAllChannels, createChannel, reorderChannels,
  updateChannel, deleteChannel, getAnnouncement, getSiteName, getAnnouncements, getSetting,
  createUserChannel, getUserChannelCount, updateUserChannel, refreshActivity, deleteUserChannel, getUserChannelsByDevice,
};
