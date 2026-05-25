const { createRouter } = require('./mediasoupManager');
const { createAudioLevelObserver } = require('./audioObserver');
const { EVENTS } = require('../socket/events');

const rooms = new Map();

class Room {
  constructor(roomId, name, maxUsers, audioBitrate, io) {
    this.roomId = roomId;
    this.name = name;
    this.maxUsers = maxUsers;
    this.audioBitrate = audioBitrate || 32;
    this.router = null;
    this.audioObserver = null;
    this.producers = new Map();
    this.consumers = new Map();
    this.transports = new Map();
    this.users = new Map();
    this.io = io;
  }

  async init() {
    this.router = await createRouter(this.audioBitrate);
    this.audioObserver = await createAudioLevelObserver(this.router, this.roomId, this.io);
    console.log(`[Room] "${this.roomId}" created with Router`);
  }

  addUser(socketId, userInfo) {
    this.users.set(socketId, userInfo);
  }

  removeUser(socketId) {
    this.users.delete(socketId);
  }

  getUser(socketId) {
    return this.users.get(socketId);
  }

  getUserCount() {
    return this.users.size;
  }

  isFull() {
    return this.users.size >= this.maxUsers;
  }

  addTransport(transportId, transport) {
    this.transports.set(transportId, transport);
  }

  getTransport(transportId) {
    return this.transports.get(transportId);
  }

  removeTransport(transportId) {
    this.transports.delete(transportId);
  }

  addProducer(producerId, producerInfo) {
    this.producers.set(producerId, producerInfo);
  }

  getProducer(producerId) {
    return this.producers.get(producerId);
  }

  removeProducer(producerId) {
    const info = this.producers.get(producerId);
    this.producers.delete(producerId);
    return info;
  }

  addConsumer(consumerId, consumerInfo) {
    this.consumers.set(consumerId, consumerInfo);
  }

  getConsumer(consumerId) {
    return this.consumers.get(consumerId);
  }

  removeConsumer(consumerId) {
    this.consumers.delete(consumerId);
  }

  removeConsumersForProducer(producerId) {
    const toRemove = [];
    for (const [cid, info] of this.consumers) {
      if (info.producerId === producerId) {
        toRemove.push(cid);
      }
    }
    for (const cid of toRemove) {
      this.consumers.delete(cid);
    }
  }

  getProducersForUser(socketId) {
    const result = [];
    for (const [pid, info] of this.producers) {
      if (info.socketId === socketId) {
        result.push({ producerId: pid, ...info });
      }
    }
    return result;
  }

  getVoiceUserCount() {
    const voiceUsers = new Set();
    for (const [, info] of this.producers) {
      voiceUsers.add(info.socketId);
    }
    return voiceUsers.size;
  }

  getUserByDeviceId(deviceId) {
    for (const [, user] of this.users) {
      if (user.deviceId === deviceId) return user;
    }
    return null;
  }

  getUserSocketByDeviceId(deviceId) {
    for (const [sid, user] of this.users) {
      if (user.deviceId === deviceId) return sid;
    }
    return null;
  }

  broadcast(roomId, event, data) {
    this.io.to(roomId).emit(event, data);
  }

  async close() {
    for (const [, transport] of this.transports) {
      try { transport.close(); } catch (e) { /* ignore */ }
    }
    for (const [, producer] of this.producers) {
      try { producer.instance?.close(); } catch (e) { /* ignore */ }
    }
    for (const [, consumer] of this.consumers) {
      try { consumer.instance?.close(); } catch (e) { /* ignore */ }
    }
    if (this.audioObserver) {
      try { this.audioObserver.close(); } catch (e) { /* ignore */ }
    }
    if (this.router) {
      try { this.router.close(); } catch (e) { /* ignore */ }
    }
    console.log(`[Room] "${this.roomId}" destroyed`);
  }
}

function getRooms() {
  return rooms;
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function createRoom(roomId, name, maxUsers, audioBitrate, io) {
  const room = new Room(roomId, name, maxUsers, audioBitrate, io);
  rooms.set(roomId, room);
  return room;
}

function removeRoom(roomId) {
  rooms.delete(roomId);
}

async function destroyRoom(roomId) {
  const room = rooms.get(roomId);
  if (room) {
    await room.close();
    rooms.delete(roomId);
  }
}

function broadcastAllRoomOnlineCounts(io) {
  const counts = [];
  for (const [roomId, room] of rooms) {
    counts.push({
      roomId,
      onlineCount: room.users.size,
      voiceCount: room.getVoiceUserCount(),
    });
  }
  io.emit(EVENTS.SERVER.ROOM_ONLINE_UPDATED, { counts });
}

module.exports = { rooms, getRooms, getRoom, createRoom, removeRoom, destroyRoom, broadcastAllRoomOnlineCounts };
