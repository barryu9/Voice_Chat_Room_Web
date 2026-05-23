const path = require('path');

const envFile = process.env.NODE_ENV === 'production'
  ? '.env.production'
  : '.env.development';

require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

const required = ['MONGODB_URI', 'MEDIASOUP_LISTEN_IP', 'MEDIASOUP_ANNOUNCED_IP', 'ADMIN_PASSWORD'];
for (const key of required) {
  if (!process.env[key]) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required env variable: ${key}`);
    }
    console.warn(`[WARN] Missing env variable: ${key} (using default)`);
  }
}

module.exports = {
  NODE_ENV:                 process.env.NODE_ENV || 'development',
  PORT:                     parseInt(process.env.PORT, 10) || 3001,
  HOST:                     process.env.HOST || '0.0.0.0',
  MONGODB_URI:              process.env.MONGODB_URI || 'mongodb://localhost:27017/voice-chat-dev',
  MEDIASOUP_LISTEN_IP:      process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
  MEDIASOUP_ANNOUNCED_IP:   process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
  MEDIASOUP_RTC_MIN_PORT:   parseInt(process.env.MEDIASOUP_RTC_MIN_PORT, 10) || 40000,
  MEDIASOUP_RTC_MAX_PORT:   parseInt(process.env.MEDIASOUP_RTC_MAX_PORT, 10) || 49999,
  ADMIN_PASSWORD:           process.env.ADMIN_PASSWORD || 'admin123',
  CORS_ORIGIN:              process.env.CORS_ORIGIN || 'http://localhost:5173',
};
