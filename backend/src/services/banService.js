const Ban = require('../models/Ban');

async function isBanned(deviceId) {
  const ban = await Ban.findOne({ deviceId });
  return !!ban;
}

async function addBan(deviceId, nickname, reason, bannedBy) {
  try {
    await Ban.create({ deviceId, nickname, reason, bannedBy: bannedBy || 'admin' });
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
  return Ban.find({}).lean();
}

module.exports = { isBanned, addBan, removeBan, getBanList };
