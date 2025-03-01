const mongoose = require('mongoose');

const ChannelSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9-]+$/, 'Channel name can only contain lowercase letters, numbers, and hyphens']
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 250
  },
  rules: {
    type: String,
    trim: true,
    default: ''
  },
  category: {
    type: String,
    default: 'general',
    enum: ['general', 'tech', 'gaming', 'social', 'entertainment', 'education', 'other']
  },
  createdBy: {
    type: String,
    default: 'system'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  activeUsers: {
    type: Number,
    default: 0
  },
  totalMessages: {
    type: Number,
    default: 0
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  }
});

// Create a text index for search
ChannelSchema.index({ name: 'text', displayName: 'text', description: 'text' });

module.exports = mongoose.model('Channel', ChannelSchema);