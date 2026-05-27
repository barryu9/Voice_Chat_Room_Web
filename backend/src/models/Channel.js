const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  roomId:          { type: String, required: true, unique: true, index: true },
  name:            { type: String, required: true },
  maxUsers:        { type: Number, required: true, default: 10, min: 2, max: 100 },
  isDefault:       { type: Boolean, default: false },
  sortOrder:       { type: Number, default: 0 },
  audioBitrate:    { type: Number, default: 48 },
  password:     { type: String, default: '' },
  passwordText:  { type: String, default: '' },
  type:          { type: String, default: 'fixed' },
  creatorUserId:   { type: String, default: '' },
  creatorNickname: { type: String, default: '' },
  creatorDeviceId: { type: String, default: '' },
  lastActivityAt:  { type: Date },
  voiceChangerEnabled: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Channel', channelSchema);
