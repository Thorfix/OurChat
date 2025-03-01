const mongoose = require('mongoose');

const PrivateMessageSchema = mongoose.Schema({
  // We only store encrypted messages - content is encrypted client-side
  encryptedContent: {
    type: String,
    required: true
  },
  // Store the sender/receiver user IDs
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Public keys used for this message (for key rotation support)
  senderPublicKeyId: {
    type: String
  },
  // We store when message will self-destruct (if enabled)
  expiresAt: {
    type: Date
  },
  // For image sharing
  hasEncryptedImage: {
    type: Boolean,
    default: false
  },
  encryptedImageData: {
    type: String
  },
  // Timestamps for message management
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Message read status
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  }
});

// Add indexes for efficient querying
PrivateMessageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });
PrivateMessageSchema.index({ recipientId: 1, createdAt: -1 });
PrivateMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

module.exports = mongoose.model('PrivateMessage', PrivateMessageSchema);