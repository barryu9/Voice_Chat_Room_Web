const http = require('http');
const socketIO = require('socket.io');
const { EVENTS } = require('./events');
const { handleConnection } = require('./handlers/connection');
const { handleRoomEvents } = require('./handlers/roomHandler');
const { handleTransportEvents } = require('./handlers/transportHandler');
const { handleProducerEvents } = require('./handlers/producerHandler');
const { handleConsumerEvents } = require('./handlers/consumerHandler');
const { handleAdminEvents } = require('./handlers/adminHandler');
const { handleUserChannelEvents } = require('./handlers/userChannelHandler');

let io;

function initSocket(server) {
  io = socketIO(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    handleConnection(socket, io);
    handleRoomEvents(socket, io);
    handleTransportEvents(socket);
    handleProducerEvents(socket, io);
    handleConsumerEvents(socket);
    handleAdminEvents(socket, io);
    handleUserChannelEvents(socket, io);
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO, EVENTS };
