const { createWebRtcTransport } = require('./mediasoupManager');
const { getRoom } = require('./roomManager');
const { EVENTS } = require('../socket/events');

async function handleCreateProducerTransport(socket, roomId) {
  const room = getRoom(roomId);
  if (!room) {
    socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.TRANSPORT_CREATE, message: 'Room not found' });
    return;
  }

  const transport = await createWebRtcTransport(room.router, 'producer', socket.id);
  room.addTransport(transport.id, transport);

  socket.emit(EVENTS.SERVER.TRANSPORT_CREATED, {
    transportId: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
    direction: 'producer',
  });

  return transport;
}

async function handleCreateConsumerTransport(socket, roomId) {
  const room = getRoom(roomId);
  if (!room) {
    socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.TRANSPORT_CREATE, message: 'Room not found' });
    return;
  }

  const transport = await createWebRtcTransport(room.router, 'consumer', socket.id);
  room.addTransport(transport.id, transport);

  socket.emit(EVENTS.SERVER.TRANSPORT_CREATED, {
    transportId: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
    direction: 'consumer',
  });

  return transport;
}

async function handleTransportConnect(socket, transportId, dtlsParameters) {
  const room = findRoomBySocket(socket.id);
  const transport = room?.getTransport(transportId);
  if (!transport) {
    socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.TRANSPORT_CONNECT, message: 'Transport not found' });
    return;
  }

  await transport.connect({ dtlsParameters });
}

function findRoomBySocket(socketId) {
  const { getRooms } = require('./roomManager');
  for (const [, room] of getRooms()) {
    if (room.users.has(socketId)) return room;
  }
  return null;
}

module.exports = {
  handleCreateProducerTransport,
  handleCreateConsumerTransport,
  handleTransportConnect,
  findRoomBySocket,
};
