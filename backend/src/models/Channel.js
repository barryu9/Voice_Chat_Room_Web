const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  roomId:       { type: String, required: true, unique: true, index: true },
  name:         { type: String, required: true },
  maxUsers:     { type: Number, required: true, default: 10, min: 2, max: 100 },
  isDefault:    { type: Boolean, default: false },
  sortOrder:    { type: Number, default: 0 },
  audioBitrate: { type: Number, default: 32 },
}, { timestamps: true });

module.exports = mongoose.model('Channel', channelSchema);
