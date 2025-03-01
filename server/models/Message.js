const mongoose = require('mongoose');

const MessageSchema = mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  sender: {
    type: String,
    default: 'anonymous'
  },
  room: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Message', MessageSchema);