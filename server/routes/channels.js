const express = require('express');
const router = express.Router();
const Channel = require('../models/Channel');

// Get all channels
router.get('/', async (req, res) => {
  try {
    let query = {};
    
    // Filter by category if provided
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Handle search query
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }
    
    // Get channels
    const channels = await Channel.find(query)
      .sort({ 
        isFeatured: -1, 
        activeUsers: -1, 
        lastActivity: -1 
      })
      .lean();
    
    res.json(channels);
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get trending channels
router.get('/trending', async (req, res) => {
  try {
    const channels = await Channel.find()
      .sort({ activeUsers: -1, totalMessages: -1 })
      .limit(5)
      .lean();
    
    res.json(channels);
  } catch (error) {
    console.error('Error fetching trending channels:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a single channel by ID
router.get('/:channelId', async (req, res) => {
  try {
    const channel = await Channel.findOne({ 
      name: req.params.channelId 
    }).lean();
    
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    res.json(channel);
  } catch (error) {
    console.error('Error fetching channel:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new channel
router.post('/', async (req, res) => {
  try {
    const { name, displayName, description, rules, category, createdBy } = req.body;
    
    // Check if name already exists
    const existingChannel = await Channel.findOne({ name });
    if (existingChannel) {
      return res.status(400).json({ message: 'Channel name already exists' });
    }
    
    // Server-side validation
    if (!name.match(/^[a-z0-9-]+$/)) {
      return res.status(400).json({ 
        message: 'Channel name can only contain lowercase letters, numbers, and hyphens' 
      });
    }
    
    const channel = new Channel({
      name,
      displayName,
      description,
      rules,
      category,
      createdBy
    });
    
    const savedChannel = await channel.save();
    res.status(201).json(savedChannel);
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update a channel
router.put('/:channelId', async (req, res) => {
  try {
    const { description, rules, category } = req.body;
    
    const channel = await Channel.findOne({ name: req.params.channelId });
    
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Update fields
    if (description) channel.description = description;
    if (rules) channel.rules = rules;
    if (category) channel.category = category;
    
    const updatedChannel = await channel.save();
    res.json(updatedChannel);
  } catch (error) {
    console.error('Error updating channel:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a channel
router.delete('/:channelId', async (req, res) => {
  try {
    const result = await Channel.deleteOne({ name: req.params.channelId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    res.json({ message: 'Channel deleted successfully' });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;