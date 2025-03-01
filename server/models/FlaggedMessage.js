const mongoose = require('mongoose');

const FlaggedMessageSchema = mongoose.Schema({
  originalContent: {
    type: String,
    required: true
  },
  modifiedContent: {
    type: String
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roomId: {
    type: String,
    required: true
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  flagReason: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high']
  },
  reviewStatus: {
    type: String,
    default: 'pending',
    enum: ['pending', 'reviewed', 'actioned']
  },
  flaggedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  actionTaken: {
    type: String,
    enum: ['none', 'removed', 'user_restricted', 'warning_issued']
  }
});

// Create indexes for faster queries
FlaggedMessageSchema.index({ reviewStatus: 1, flaggedAt: -1 });
FlaggedMessageSchema.index({ roomId: 1 });
FlaggedMessageSchema.index({ severity: 1 });

module.exports = mongoose.model('FlaggedMessage', FlaggedMessageSchema);