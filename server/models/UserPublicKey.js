const mongoose = require('mongoose');

const UserPublicKeySchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // The public key ID (to support multiple keys per user and key rotation)
  keyId: {
    type: String,
    required: true
  },
  // The actual public key data
  publicKey: {
    type: String,
    required: true
  },
  // When this key was created
  createdAt: {
    type: Date,
    default: Date.now
  },
  // When this key was last used
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  // Is this the user's current active key
  isActive: {
    type: Boolean,
    default: true
  },
  // When this key expires (if applicable)
  expiresAt: {
    type: Date
  },
  // Optional user-provided key name for multiple devices
  keyName: {
    type: String,
    default: 'Default Key'
  }
});

// Compound index for efficient lookup
UserPublicKeySchema.index({ userId: 1, keyId: 1 }, { unique: true });
UserPublicKeySchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('UserPublicKey', UserPublicKeySchema);