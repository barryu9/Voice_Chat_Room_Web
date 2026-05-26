const Ban = require('../models/Ban');
const { getConfig, getDurationMs } = require('./configService');

async function isBanned(deviceId) {
  const ban = await Ban.findOne({ deviceId });
  if (!ban) return false;
  if (ban.expiresAt && ban.expiresAt <= new Date()) {
    await Ban.deleteOne({ deviceId });
    return false;
  }
  return true;
}

async function addBan(deviceId, nickname, reason, bannedBy) {
  const durMin = await getConfig('config:ban_duration');
  const expiresAt = new Date(Date.now() + getDurationMs(durMin));
  try {
    await Ban.findOneAndUpdate(
      { deviceId },
      { deviceId, nickname, reason, bannedBy: bannedBy || 'admin', expiresAt },
      { upsert: true, new: true }
    );
    return true;
  } catch (e) {
    return false;
  }
}

async function removeBan(deviceId) {
  await Ban.deleteOne({ deviceId });
  return true;
}

async function getBanList() {
  const bans = await Ban.find({}).lean();
  return bans.map((b) => ({
    ...b,
    remaining: b.expiresAt ? Math.max(0, new Date(b.expiresAt).getTime() - Date.now()) : 0,
  }));
}

module.exports = { isBanned, addBan, removeBan, getBanList };
