const config = require('../config/env');

const adminSessions = new Map();

function isAdmin(socketId) {
  const { getConnection } = require('../socket/handlers/connection');
  const conn = getConnection(socketId);
  if (!conn) return false;
  return adminSessions.has(conn.deviceId);
}

function authenticate(password, socketId, deviceId) {
  if (password === config.ADMIN_PASSWORD) {
    adminSessions.set(deviceId, { authenticatedAt: Date.now() });
    return true;
  }
  return false;
}

function removeAdmin(socketId) {
  const { getConnection } = require('../socket/handlers/connection');
  const conn = getConnection(socketId);
  if (conn) {
    adminSessions.delete(conn.deviceId);
  }
}

module.exports = { isAdmin, authenticate, removeAdmin, adminSessions };
