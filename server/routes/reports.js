const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const Message = require('../models/Message');
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
router.get('/flagged', (req, res) => {
  try {
    // In a production app, add authentication middleware to ensure this is admin-only
    const flaggedMessages = contentModerator.getFlaggedMessages({
      status: req.query.status,
      severity: req.query.severity,
      roomId: req.query.roomId
    });
    
    res.json(flaggedMessages);
  } catch (error) {
    console.error('Error fetching flagged messages:', error);
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