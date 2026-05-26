const { getConfig, getDurationMs } = require('./configService');

const mutedUsers = new Map();

function getMuteKey(roomId, userId) {
  return `${roomId}:${userId}`;
}

function getRemaining(expiresAt) {
  return Math.max(0, expiresAt - Date.now());
}

async function muteUsers(roomId, userIds) {
  const durMin = await getConfig('config:mute_duration');
  const duration = getDurationMs(durMin);
  const now = Date.now();
  const expiresAt = now + duration;

  for (const uid of userIds) {
    const key = getMuteKey(roomId, uid);
    const existing = mutedUsers.get(key);
    if (existing && existing.timer) clearTimeout(existing.timer);

    const record = { roomId, userId: uid, expiresAt, timer: null };
    record.timer = setTimeout(() => {
      mutedUsers.delete(key);
    }, expiresAt - now);
    mutedUsers.set(key, record);
  }

  return { expiresAt, remaining: duration };
}

function unmuteUsers(roomId, userIds) {
  for (const uid of userIds) {
    const key = getMuteKey(roomId, uid);
    const record = mutedUsers.get(key);
    if (record?.timer) clearTimeout(record.timer);
    mutedUsers.delete(key);
  }
}

function isUserMuted(roomId, userId) {
  const key = getMuteKey(roomId, userId);
  const record = mutedUsers.get(key);
  if (!record) return false;
  if (getRemaining(record.expiresAt) <= 0) {
    mutedUsers.delete(key);
    return false;
  }
  return true;
}

function getMutedList(roomId) {
  const result = [];
  for (const [, record] of mutedUsers) {
    if (record.roomId === roomId && getRemaining(record.expiresAt) > 0) {
      result.push({ userId: record.userId, expiresAt: record.expiresAt, remaining: getRemaining(record.expiresAt) });
    }
  }
  return result;
}

function cleanupMutes(roomId) {
  for (const [key, record] of mutedUsers) {
    if (record.roomId === roomId) {
      if (record.timer) clearTimeout(record.timer);
      mutedUsers.delete(key);
    }
  }
}

module.exports = { muteUsers, unmuteUsers, isUserMuted, getMutedList, cleanupMutes };
