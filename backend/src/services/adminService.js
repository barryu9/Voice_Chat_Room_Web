const config = require('../config/env');

const adminUserIds = new Set();

function isAdmin(socketId) {
  const { getConnection } = require('../socket/handlers/connection');
  const conn = getConnection(socketId);
  if (!conn) return false;
  return adminUserIds.has(conn.userId);
}

function isUserIdAdmin(userId) {
  return adminUserIds.has(userId);
}

function authenticate(password, socketId, _deviceId) {
  if (password === config.ADMIN_PASSWORD) {
    const { getConnection } = require('../socket/handlers/connection');
    const conn = getConnection(socketId);
    const userId = conn?.userId || socketId;
    adminUserIds.add(userId);
    return true;
  }
  return false;
}

function removeAdmin(socketId) {
  const { getConnection } = require('../socket/handlers/connection');
  const conn = getConnection(socketId);
  if (conn?.userId) {
    adminUserIds.delete(conn.userId);
  }
}

module.exports = { isAdmin, authenticate, removeAdmin, isUserIdAdmin };
