const MAX_ATTEMPTS = 5;

const attempts = new Map();

function getKey(roomId, deviceId) {
  return `${roomId}:${deviceId}`;
}

function recordAttempt(roomId, deviceId) {
  const key = getKey(roomId, deviceId);
  const entry = attempts.get(key) || { count: 0, lockedUntil: 0 };
  entry.count++;
  attempts.set(key, entry);
  return entry.count;
}

function lock(roomId, deviceId, cooldownMs) {
  const key = getKey(roomId, deviceId);
  attempts.set(key, { count: MAX_ATTEMPTS, lockedUntil: Date.now() + cooldownMs });
}

function getStatus(roomId, deviceId) {
  const key = getKey(roomId, deviceId);
  const entry = attempts.get(key);
  if (!entry) return { locked: false, remaining: MAX_ATTEMPTS, waitSeconds: 0 };

  if (entry.lockedUntil > Date.now()) {
    const waitSeconds = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    return { locked: true, remaining: 0, waitSeconds };
  }

  if (entry.lockedUntil > 0 && entry.lockedUntil <= Date.now()) {
    attempts.delete(key);
    return { locked: false, remaining: MAX_ATTEMPTS, waitSeconds: 0 };
  }

  return { locked: false, remaining: MAX_ATTEMPTS - entry.count, waitSeconds: 0 };
}

function clear(roomId, deviceId) {
  attempts.delete(getKey(roomId, deviceId));
}

module.exports = { recordAttempt, lock, getStatus, clear, MAX_ATTEMPTS };
