const Channel = require('../models/Channel');
const { createRoom, destroyRoom } = require('../mediasoup/roomManager');

async function initChannels(io) {
  const channels = await Channel.find({}).lean();

  if (channels.length === 0) {
    await Channel.create({ roomId: 'lobby', name: '大厅', maxUsers: 50, isDefault: true });
    await Channel.create({ roomId: 'music', name: '音乐频道', maxUsers: 20 });
    await Channel.create({ roomId: 'gaming', name: '游戏频道', maxUsers: 20 });
  }

  const allChannels = await Channel.find({}).lean();

  for (const ch of allChannels) {
    const room = createRoom(ch.roomId, ch.name, ch.maxUsers, io);
    await room.init();
  }

  console.log(`[Channel] Loaded ${allChannels.length} channels from DB`);
  return allChannels;
}

async function getAllChannels() {
  return Channel.find({}).lean();
}

async function createChannel(data) {
  const channel = await Channel.create({
    roomId: data.roomId || data.name.toLowerCase().replace(/\s+/g, '-'),
    name: data.name,
    maxUsers: data.maxUsers || 20,
  });
  return channel;
}

async function updateChannel(roomId, updates) {
  const channel = await Channel.findOneAndUpdate(
    { roomId },
    { $set: updates },
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

module.exports = {
  initChannels, getAllChannels, createChannel,
  updateChannel, deleteChannel, getAnnouncement, getSiteName,
};
