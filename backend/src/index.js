const express = require('express');
const http = require('http');
const cors = require('cors');
const config = require('./config/env');
const { connectDB } = require('./config/db');
const { initSocket } = require('./socket');
const { initChannels } = require('./services/channelService');
const { createWorker } = require('./mediasoup/mediasoupManager');

async function main() {
  await connectDB();

  const app = express();
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  const server = http.createServer(app);
  const io = initSocket(server);

  await createWorker();
  await initChannels(io);

  server.listen(config.PORT, config.HOST, () => {
    console.log(`[Server] Running on http://${config.HOST}:${config.PORT}`);
  });
}

main().catch((err) => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});
