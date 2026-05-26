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
  const channel = await Channel.create({
    roomId: data.roomId || data.name.toLowerCase().replace(/\s+/g, '-'),
    name: data.name,
    maxUsers: data.maxUsers || 20,
    sortOrder: data.sortOrder ?? 0,
    audioBitrate: data.audioBitrate ?? 48,
  });
  return channel;
}

async function updateChannel(roomId, updates) {
  const setFields = { ...updates };
  const newRoomId = setFields.newRoomId;
  delete setFields.newRoomId;

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

module.exports = {
  initChannels, getAllChannels, createChannel, reorderChannels,
  updateChannel, deleteChannel, getAnnouncement, getSiteName, getAnnouncements, getSetting,
};
