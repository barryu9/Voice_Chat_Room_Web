const { getRoom } = require('../../mediasoup/roomManager');
const { getConnection } = require('./connection');
const { EVENTS } = require('../events');

function handleConsumerEvents(socket) {

  socket.on(EVENTS.CLIENT.CONSUMER_CREATE, async ({ transportId, producerId, rtpCapabilities }) => {
    const conn = getConnection(socket.id);
    if (!conn || !conn.currentRoom) return;

    const room = getRoom(conn.currentRoom);
    if (!room) return;

    const transport = room.getTransport(transportId);
    if (!transport) {
      socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.CONSUMER_CREATE, message: 'Transport not found' });
      return;
    }

    const producerInfo = room.getProducer(producerId);
    if (!producerInfo?.instance) {
      socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.CONSUMER_CREATE, message: 'Producer not found' });
      return;
    }

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.CONSUMER_CREATE, message: 'Cannot consume this producer' });
      return;
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    });

    consumer.on('transportclose', () => {
      room.removeConsumer(consumer.id);
      socket.emit(EVENTS.SERVER.CONSUMER_CLOSED, { consumerId: consumer.id });
    });

    consumer.on('producerclose', () => {
      room.removeConsumer(consumer.id);
      socket.emit(EVENTS.SERVER.CONSUMER_CLOSED, { consumerId: consumer.id });
    });

    room.addConsumer(consumer.id, {
      instance: consumer,
      socketId: socket.id,
      producerId,
    });

    socket.emit(EVENTS.SERVER.CONSUMER_CREATED, {
      consumerId: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    });
  });

  socket.on(EVENTS.CLIENT.CONSUMER_PAUSE, ({ consumerId }) => {
    const conn = getConnection(socket.id);
    if (!conn || !conn.currentRoom) return;
    const room = getRoom(conn.currentRoom);
    if (!room) return;

    const info = room.getConsumer(consumerId);
    if (info?.instance) {
      info.instance.pause();
      socket.emit(EVENTS.SERVER.CONSUMER_PAUSED, { consumerId, producerId: info.producerId });
    }
  });

  socket.on(EVENTS.CLIENT.CONSUMER_RESUME, ({ consumerId }) => {
    const conn = getConnection(socket.id);
    if (!conn || !conn.currentRoom) return;
    const room = getRoom(conn.currentRoom);
    if (!room) return;

    const info = room.getConsumer(consumerId);
    if (info?.instance) {
      info.instance.resume();
      socket.emit(EVENTS.SERVER.CONSUMER_RESUMED, { consumerId, producerId: info.producerId });
    }
  });
}

module.exports = { handleConsumerEvents };
