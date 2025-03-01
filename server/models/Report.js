const mongoose = require('mongoose');

const ReportSchema = mongoose.Schema({
  messageId: {
    type: String,
    required: true
  },
  messageContent: {
    type: String,
    required: true
  },
  reportedBy: {
    type: String, // User ID or session ID
    default: 'anonymous'
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'spam', 
      'harassment', 
      'inappropriate', 
      'violence', 
      'hate-speech', 
      'illegal-content',
      'other'
    ]
  },
  details: {
    type: String,
    default: ''
  },
  channel: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'reviewed', 'actioned', 'dismissed']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: String
  },
  actionTaken: {
    type: String,
    enum: ['none', 'removed', 'user_banned', 'warning_issued']
  }
});

// Create index for faster queries
ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ channel: 1 });

module.exports = mongoose.model('Report', ReportSchema);