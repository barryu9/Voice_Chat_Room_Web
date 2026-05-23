const mongoose = require('mongoose');
const config = require('./env');

let memoryServer = null;

async function connectDB() {
  let uri = config.MONGODB_URI;

  if (config.NODE_ENV !== 'production' && !process.env.MONGODB_URI) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'voice-chat-dev',
      },
    });
    uri = memoryServer.getUri();
    console.log(`[MongoDB] In-memory server started at ${uri}`);
  }

  try {
    await mongoose.connect(uri);
    console.log('[MongoDB] Connected successfully');
  } catch (err) {
    console.error('[MongoDB] Connection failed:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Runtime error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected');
  });
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    console.log('[MongoDB] In-memory server stopped');
  }
}

module.exports = { connectDB, disconnectDB };
