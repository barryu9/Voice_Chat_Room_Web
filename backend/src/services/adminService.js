const config = require('../config/env');

const adminSessions = new Map();

function isAdmin(socketId) {
  return adminSessions.has(socketId);
}

function authenticate(password, socketId) {
  if (password === config.ADMIN_PASSWORD) {
    adminSessions.set(socketId, { authenticatedAt: Date.now() });
    return true;
  }
  return false;
}

function removeAdmin(socketId) {
  adminSessions.delete(socketId);
}

module.exports = { isAdmin, authenticate, removeAdmin, adminSessions };
