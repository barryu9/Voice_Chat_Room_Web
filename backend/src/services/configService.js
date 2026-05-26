const SiteSettings = require('../models/SiteSettings');

const isDev = process.env.NODE_ENV !== 'production';

const DEFAULTS = {
  'config:multi_login': isDev,
  'config:ban_duration': isDev ? 1 : 24 * 60,       // minutes
  'config:mute_duration': isDev ? 1 : 60,           // minutes
  'config:kick_duration': isDev ? 1 : 60,           // minutes
  'config:pwd_retry_cooldown': isDev ? 1 : 5,        // minutes
  'config:user_channel_max_per_device': isDev ? 5 : 1,
  'config:user_channel_max_users': isDev ? 20 : 10,
  'config:user_channel_allowed_bitrates': isDev ? '48,64' : '48',
  'config:user_channel_auto_delete': isDev ? 2 : 10,    // minutes
  'config:user_channel_max_name_len': isDev ? 6 : 6,
  'config:user_channel_enabled': true,
  'config:random_device_id': isDev,
};

async function getConfig(key) {
  const doc = await SiteSettings.findOne({ key });
  const val = doc?.value !== undefined && doc.value !== null ? doc.value : DEFAULTS[key];
  if (key.includes('user_channel')) {
    console.log(`[Config] getConfig(${key}) = ${val} (from ${doc ? 'DB' : 'default'})`);
  }
  return val;
}

async function setConfig(key, value) {
  console.log(`[Config] setConfig(${key}, ${value})`);
  await SiteSettings.findOneAndUpdate(
    { key },
    { key, value },
    { upsert: true, new: true }
  );
  console.log(`[Config] setConfig saved`);
}

async function getAllConfig() {
  const keys = Object.keys(DEFAULTS);
  const docs = await SiteSettings.find({ key: { $in: keys } }).lean();
  const result = {};
  for (const k of keys) {
    const doc = docs.find(d => d.key === k);
    result[k] = doc?.value ?? DEFAULTS[k];
  }
  return result;
}

function getDurationMs(minutes) {
  return (minutes || 1) * 60 * 1000;
}

module.exports = { getConfig, setConfig, getAllConfig, getDurationMs, DEFAULTS };
