const mongoose = require('mongoose');
const config = require('./env');

async function connectDB() {
  try {
    await mongoose.connect(config.MONGODB_URI);
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

module.exports = { connectDB };
