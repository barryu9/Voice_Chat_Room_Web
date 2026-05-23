const { getRoom } = require('../../mediasoup/roomManager');
const { getConnection } = require('./connection');
const { EVENTS } = require('../events');
const {
  handleCreateProducerTransport,
  handleCreateConsumerTransport,
  handleTransportConnect,
} = require('../../mediasoup/consumerManager');

function handleTransportEvents(socket) {

  socket.on(EVENTS.CLIENT.RTP_GET_CAPABILITIES, (_, cb) => {
    const conn = getConnection(socket.id);
    if (!conn || !conn.currentRoom) return;

    const room = getRoom(conn.currentRoom);
    if (!room) return;

    const rtpCapabilities = room.router.rtpCapabilities;
    socket.emit(EVENTS.SERVER.RTP_CAPABILITIES, { rtpCapabilities });
    if (typeof cb === 'function') cb(rtpCapabilities);
  });

  socket.on(EVENTS.CLIENT.TRANSPORT_CREATE, async ({ roomId, direction }) => {
    if (direction === 'producer') {
      await handleCreateProducerTransport(socket, roomId);
    } else if (direction === 'consumer') {
      await handleCreateConsumerTransport(socket, roomId);
    }
  });

  socket.on(EVENTS.CLIENT.TRANSPORT_CONNECT, async ({ transportId, dtlsParameters }) => {
    await handleTransportConnect(socket, transportId, dtlsParameters);
  });
}

module.exports = { handleTransportEvents };
