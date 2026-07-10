const mediasoup = require('mediasoup');
const config = require('../config/env');

let worker = null;

async function createWorker() {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: config.MEDIASOUP_RTC_MIN_PORT,
    rtcMaxPort: config.MEDIASOUP_RTC_MAX_PORT,
  });

  worker.on('died', () => {
    console.error('[Mediasoup] Worker died, exiting...');
    process.exit(1);
  });

  console.log(`[Mediasoup] Worker started (RTP ports: ${config.MEDIASOUP_RTC_MIN_PORT}-${config.MEDIASOUP_RTC_MAX_PORT})`);
  return worker;
}

async function createRouter(opusMaxBitrate) {
  const opusCodec = {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    // Voice is always mono/48 kHz. FEC protects isolated packet loss and DTX
    // avoids spending bitrate during silence without changing speech quality.
    channels: 1,
    parameters: {
      useinbandfec: 1,
      usedtx: 1,
      minptime: 10,
      maxptime: 20,
    },
  };

  if (opusMaxBitrate) {
    opusCodec.parameters = {
      ...opusCodec.parameters,
      'maxaveragebitrate': opusMaxBitrate * 1000,
    };
  }

  const router = await worker.createRouter({
    mediaCodecs: [opusCodec],
  });
  return router;
}

async function createWebRtcTransport(router, direction, socketId) {
  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: config.MEDIASOUP_LISTEN_IP, announcedIp: config.MEDIASOUP_ANNOUNCED_IP }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
    appData: { direction, socketId },
  });

  return transport;
}

function getWorker() {
  return worker;
}

module.exports = { createWorker, createRouter, createWebRtcTransport, getWorker };
