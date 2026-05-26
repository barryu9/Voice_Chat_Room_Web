const SiteSettings = require('../models/SiteSettings');

const isDev = process.env.NODE_ENV !== 'production';

const DEFAULTS = {
  'config:multi_login': isDev,
  'config:ban_duration': isDev ? 1 : 24 * 60,       // minutes
  'config:mute_duration': isDev ? 1 : 60,           // minutes
  'config:kick_duration': isDev ? 1 : 60,           // minutes
};

async function getConfig(key) {
  const doc = await SiteSettings.findOne({ key });
  if (doc?.value !== undefined && doc.value !== null) return doc.value;
  return DEFAULTS[key];
}

async function setConfig(key, value) {
  await SiteSettings.findOneAndUpdate(
    { key },
    { key, value },
    { upsert: true, new: true }
  );
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
