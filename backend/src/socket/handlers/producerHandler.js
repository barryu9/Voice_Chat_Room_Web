const { getRoom } = require('../../mediasoup/roomManager');
const { getConnection } = require('./connection');
const { EVENTS } = require('../events');

function handleProducerEvents(socket, io) {

  socket.on(EVENTS.CLIENT.PRODUCER_CREATE, async ({ transportId, kind, rtpParameters }) => {
    const conn = getConnection(socket.id);
    if (!conn || !conn.currentRoom) return;

    const room = getRoom(conn.currentRoom);
    if (!room) return;

    const transport = room.getTransport(transportId);
    if (!transport) {
      socket.emit(EVENTS.SERVER.ERROR, { event: EVENTS.CLIENT.PRODUCER_CREATE, message: 'Transport not found' });
      return;
    }

    const producer = await transport.produce({ kind, rtpParameters });
    const producerInfo = {
      instance: producer,
      socketId: socket.id,
      userId: conn.userId,
      deviceId: conn.deviceId,
      kind,
      muted: false,
    };

    const isFirstProducer = room.getProducersForUser(socket.id).length === 0;

    room.addProducer(producer.id, producerInfo);
    room.audioObserver.addProducer({ producerId: producer.id });

    socket.emit(EVENTS.SERVER.PRODUCER_CREATED, { producerId: producer.id });

    room.broadcast(conn.currentRoom, EVENTS.SERVER.NEW_PRODUCER, {
      producerId: producer.id,
      userId: conn.userId,
      deviceId: conn.deviceId,
      kind,
    });

    if (isFirstProducer) {
      room.broadcast(conn.currentRoom, EVENTS.SERVER.USER_JOINED, {
        userId: conn.userId,
        nickname: conn.nickname,
        deviceId: conn.deviceId,
      });
    }

    producer.on('transportclose', () => {
      const remaining = room.getProducersForUser(socket.id).length;
      const wasLastProducer = remaining === 1;
      room.removeProducer(producer.id);
      room.removeConsumersForProducer(producer.id);
      room.broadcast(conn.currentRoom, EVENTS.SERVER.PRODUCER_CLOSED, {
        producerId: producer.id,
        deviceId: conn.deviceId,
      });
      if (wasLastProducer) {
        room.broadcast(conn.currentRoom, EVENTS.SERVER.USER_LEFT, {
          userId: conn.userId,
          deviceId: conn.deviceId,
          nickname: conn.nickname,
        });
      }
    });
  });

  socket.on(EVENTS.CLIENT.PRODUCER_CLOSE, ({ producerId }) => {
    const conn = getConnection(socket.id);
    if (!conn || !conn.currentRoom) return;
    const room = getRoom(conn.currentRoom);
    if (!room) return;

    const wasLastProducer = room.getProducersForUser(socket.id).length === 1;

    const info = room.removeProducer(producerId);
    if (info?.instance) {
      try { info.instance.close(); } catch (e) { /* ignore */ }
    }
    room.removeConsumersForProducer(producerId);
    room.broadcast(conn.currentRoom, EVENTS.SERVER.PRODUCER_CLOSED, {
      producerId,
      deviceId: conn.deviceId,
    });

    if (wasLastProducer) {
      room.broadcast(conn.currentRoom, EVENTS.SERVER.USER_LEFT, {
        userId: conn.userId,
        deviceId: conn.deviceId,
        nickname: conn.nickname,
      });
    }
  });

  socket.on(EVENTS.CLIENT.PRODUCER_REPLACE_TRACK, async ({ producerId }) => {
    const conn = getConnection(socket.id);
    if (!conn || !conn.currentRoom) return;
    const room = getRoom(conn.currentRoom);
    if (!room) return;

    const info = room.getProducer(producerId);
    if (!info?.instance) return;

    socket.emit(EVENTS.SERVER.ERROR, {
      event: EVENTS.CLIENT.PRODUCER_REPLACE_TRACK,
      message: 'replaceTrack should be initiated client-side via producer.replaceTrack({ track })',
    });
  });

  socket.on(EVENTS.CLIENT.USER_MUTE_SELF, ({ muted }) => {
    const conn = getConnection(socket.id);
    if (!conn || !conn.currentRoom) return;
    const room = getRoom(conn.currentRoom);
    if (!room) return;

    const producers = room.getProducersForUser(socket.id);
    for (const p of producers) {
      const info = room.getProducer(p.producerId);
      if (info?.instance) {
        try {
          if (muted) info.instance.pause();
          else info.instance.resume();
          info.muted = muted;
        } catch (e) { /* ignore */ }
      }
    }

    room.broadcast(conn.currentRoom, EVENTS.SERVER.SELF_MUTED, {
      deviceId: conn.deviceId,
      muted,
    });
  });
}

module.exports = { handleProducerEvents };
