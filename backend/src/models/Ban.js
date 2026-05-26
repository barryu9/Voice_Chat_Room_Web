const mongoose = require('mongoose');

const banSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, index: true },
  nickname: { type: String, default: '' },
  reason:   { type: String, default: '' },
  bannedBy: { type: String, default: 'admin' },
  expiresAt: { type: Date, default: null },
}, { timestamps: true });

banSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model('Ban', banSchema);
