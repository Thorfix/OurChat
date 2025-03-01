const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const Message = require('../models/Message');
const FlaggedMessage = require('../models/FlaggedMessage');
const contentModerator = require('../utils/contentModerator');

// Get all reports (admin only)
router.get('/', async (req, res) => {
  try {
    // In a production app, add authentication middleware to ensure this is admin-only
    
    // Build filter from query params
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.channel) filter.channel = req.query.channel;
    if (req.query.reason) filter.reason = req.query.reason;
    
    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .limit(req.query.limit ? parseInt(req.query.limit) : 100);
    
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get flagged messages from the content moderator (admin only)
router.get('/flagged', async (req, res) => {
  try {
    // In a production app, add authentication middleware to ensure this is admin-only
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '10');
    
    const flaggedMessages = await contentModerator.getFlaggedMessages({
      status: req.query.status,
      severity: req.query.severity,
      roomId: req.query.roomId
    }, page, limit);
    
    // Get total count for pagination
    const totalCount = await FlaggedMessage.countDocuments({
      ...(req.query.status ? { reviewStatus: req.query.status } : {}),
      ...(req.query.severity ? { severity: req.query.severity } : {}),
      ...(req.query.roomId ? { roomId: req.query.roomId } : {})
    });
    
    res.json({
      messages: flaggedMessages,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        hasMore: page * limit < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching flagged messages:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark a flagged message as reviewed (admin only)
router.put('/flagged/:id/review', async (req, res) => {
  try {
    // In a production app, add authentication middleware to ensure this is admin-only
    const { id } = req.params;
    const { reviewerId } = req.body;
    
    if (!id) {
      return res.status(400).json({ message: 'Missing flagged message ID' });
    }
    
    const success = await contentModerator.updateFlaggedMessageStatus(
      id, 
      'reviewed', 
      reviewerId || 'admin'
    );
    
    if (!success) {
      return res.status(404).json({ message: 'Flagged message not found' });
    }
    
    res.json({ message: 'Flagged message marked as reviewed' });
  } catch (error) {
    console.error('Error updating flagged message:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove a flagged message (admin only)
router.put('/flagged/:id/remove', async (req, res) => {
  try {
    // In a production app, add authentication middleware to ensure this is admin-only
    const { id } = req.params;
    const { removeOriginal, reviewerId } = req.body;
    
    if (!id) {
      return res.status(400).json({ message: 'Missing flagged message ID' });
    }
    
    const success = await contentModerator.removeFlaggedMessage(
      id,
      removeOriginal === true,
      reviewerId || 'admin'
    );
    
    if (!success) {
      return res.status(404).json({ message: 'Flagged message not found' });
    }
    
    res.json({ 
      message: removeOriginal ? 
        'Flagged message removed and original message deleted' : 
        'Flagged message marked as removed' 
    });
  } catch (error) {
    console.error('Error removing flagged message:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Issue a warning or restriction to a user (admin only)
router.put('/flagged/:id/restrict-user', async (req, res) => {
  try {
    // In a production app, add authentication middleware to ensure this is admin-only
    const { id } = req.params;
    const { restrictionType, duration, reviewerId } = req.body;
    
    if (!id) {
      return res.status(400).json({ message: 'Missing flagged message ID' });
    }
    
    const success = await contentModerator.restrictUser(
      id,
      reviewerId || 'admin',
      restrictionType || 'warning',
      duration || 60
    );
    
    if (!success) {
      return res.status(404).json({ message: 'Flagged message or user not found' });
    }
    
    res.json({ 
      message: `User restriction (${restrictionType}) applied successfully` 
    });
  } catch (error) {
    console.error('Error restricting user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new report
router.post('/', async (req, res) => {
  try {
    const { messageId, messageContent, reportedBy, reason, details, channel } = req.body;
    
    // Basic validation
    if (!messageId || !reason || !channel) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Check if message exists
    const message = await Message.findById(messageId);
    if (!message && !messageContent) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Create report
    const report = new Report({
      messageId,
      messageContent: messageContent || message.content,
      reportedBy: reportedBy || 'anonymous',
      reason,
      details: details || '',
      channel
    });
    
    const savedReport = await report.save();
    res.status(201).json(savedReport);
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update report status (admin only)
router.put('/:reportId', async (req, res) => {
  try {
    // In a production app, add authentication middleware to ensure this is admin-only
    const { status, actionTaken, reviewedBy } = req.body;
    
    const report = await Report.findById(req.params.reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    // Update report fields
    if (status) report.status = status;
    if (actionTaken) report.actionTaken = actionTaken;
    if (reviewedBy) report.reviewedBy = reviewedBy;
    
    // Set review timestamp
    report.reviewedAt = new Date();
    
    // If action is to remove the message, delete it from the database
    if (actionTaken === 'removed') {
      try {
        await Message.findByIdAndDelete(report.messageId);
      } catch (deleteError) {
        console.error('Error deleting reported message:', deleteError);
        // Continue with report update even if message deletion fails
      }
    }
    
    const updatedReport = await report.save();
    res.json(updatedReport);
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;