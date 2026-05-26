const { getConfig, getDurationMs } = require('./configService');

const kickedUsers = new Map();

function getKickKey(roomId, deviceId) {
  return `${roomId}:${deviceId}`;
}

async function kickUser(roomId, deviceId, nickname, onExpire) {
  const durMin = await getConfig('config:kick_duration');
  const duration = getDurationMs(durMin);
  const key = getKickKey(roomId, deviceId);
  const existing = kickedUsers.get(key);
  const remaining = existing && existing.expiresAt > Date.now()
    ? existing.expiresAt - Date.now() : 0;
  const expiresAt = Date.now() + duration + remaining;

  if (existing && existing.timer) clearTimeout(existing.timer);

  const record = { roomId, deviceId, nickname: nickname || '', expiresAt, timer: null };
  record.timer = setTimeout(() => {
    kickedUsers.delete(key);
    if (onExpire) onExpire(roomId, deviceId);
  }, expiresAt - Date.now());

  kickedUsers.set(key, record);
  return record;
}

function unkickUser(roomId, deviceId) {
  const key = getKickKey(roomId, deviceId);
  const record = kickedUsers.get(key);
  if (record && record.timer) clearTimeout(record.timer);
  kickedUsers.delete(key);
}

function isKicked(roomId, deviceId) {
  const key = getKickKey(roomId, deviceId);
  const record = kickedUsers.get(key);
  if (!record) return false;
  if (record.expiresAt <= Date.now()) {
    kickedUsers.delete(key);
    return false;
  }
  return true;
}

function getKickRemaining(roomId, deviceId) {
  const key = getKickKey(roomId, deviceId);
  const record = kickedUsers.get(key);
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    kickedUsers.delete(key);
    return null;
  }
  return record.expiresAt - Date.now();
}

function getKickedList(roomId) {
  const result = [];
  for (const [, record] of kickedUsers) {
    if (record.roomId === roomId && record.expiresAt > Date.now()) {
      result.push({
        deviceId: record.deviceId,
        nickname: record.nickname,
        expiresAt: record.expiresAt,
      });
    }
  }
  return result;
}

module.exports = { kickUser, unkickUser, isKicked, getKickedList, getKickRemaining };
