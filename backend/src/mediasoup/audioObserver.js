const { EVENTS } = require('../socket/events');

async function createAudioLevelObserver(router, roomId, io) {
  let observedRoomId = roomId;
  const audioLevelObserver = await router.createAudioLevelObserver({
    maxEntries: 3,
    threshold: -65,
    interval: 200,
  });

  audioLevelObserver.on('volumes', (volumes) => {
    for (const volume of volumes) {
      const { producer, volume: level } = volume;
      const producerId = producer.id;
      const isSpeaking = level > -55;

      const { getRoom } = require('./roomManager');
      const room = getRoom(observedRoomId);
      if (!room) return;

      const producerInfo = room.getProducer(producerId);
      if (!producerInfo) return;

      io.to(observedRoomId).emit(EVENTS.SERVER.ACTIVE_SPEAKER, {
        roomId: observedRoomId,
        deviceId: producerInfo.deviceId,
        level,
        isSpeaking,
      });
    }
  });

  audioLevelObserver.on('silence', () => {
    // silence detected - could broadcast to room if needed
  });

  audioLevelObserver.setRoomId = (nextRoomId) => {
    observedRoomId = nextRoomId;
  };

  return audioLevelObserver;
}

module.exports = { createAudioLevelObserver };
