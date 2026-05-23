const mongoose = require('mongoose');

const banSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, index: true },
  nickname: { type: String, default: '' },
  reason:   { type: String, default: '' },
  bannedBy: { type: String, default: 'admin' },
}, { timestamps: true });

module.exports = mongoose.model('Ban', banSchema);
