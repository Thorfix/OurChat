const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const { marked } = require('marked');
const connectDB = require('./config/db');
const jwt = require('jsonwebtoken');
const Message = require('./models/Message');
const Channel = require('./models/Channel');
const Report = require('./models/Report');
const User = require('./models/User');
const channelRoutes = require('./routes/channels');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');
const contentModerator = require('./utils/contentModerator');
const { verifyToken } = require('./utils/jwtUtils');

// Initialize DOMPurify for server-side sanitization
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Configure marked options for security
marked.setOptions({
  sanitize: true,
  headerIds: false,
  mangle: false
});

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token is required'));
    }
    
    // Verify token
    const decoded = verifyToken(token);
    
    // Get user
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new Error('User not found'));
    }
    
    // Update last active
    await User.findByIdAndUpdate(user._id, { lastActive: new Date() });
    
    // Attach user to socket
    socket.user = user;
    next();
  } catch (error) {
    return next(new Error('Authentication failed'));
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/channels', channelRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

// Simple route for API health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'RetroChat server is running' });
});

// Get messages for a specific room
app.get('/api/messages/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const messages = await Message.find({ room: roomId })
      .sort({ timestamp: -1 })
      .limit(50);
    
    res.json(messages.reverse());
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Track active users in each channel
const activeChannels = new Map();

// Initialize predefined channels on server start
const initializeDefaultChannels = async () => {
  const defaultChannels = [
    {
      name: 'general',
      displayName: 'General Chat',
      description: 'Talk about anything and everything',
      category: 'general',
      isFeatured: true
    },
    {
      name: 'tech',
      displayName: 'Tech Talk',
      description: 'Discuss technology, programming, and gadgets',
      category: 'tech',
      isFeatured: true
    },
    {
      name: 'random',
      displayName: 'Random',
      description: 'Random discussions, memes, and everything in between',
      category: 'entertainment',
      isFeatured: true
    },
    {
      name: 'games',
      displayName: 'Gaming',
      description: 'Chat about video games, board games, and more',
      category: 'gaming',
      isFeatured: true
    }
  ];

  try {
    for (const channel of defaultChannels) {
      const exists = await Channel.findOne({ name: channel.name });
      if (!exists) {
        await new Channel(channel).save();
        console.log(`Created default channel: ${channel.name}`);
      }
    }
  } catch (error) {
    console.error('Error creating default channels:', error);
  }
};

// Schedule cleanup of inactive channels
const cleanupInactiveChannels = async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  try {
    // Find channels with no activity in the last 30 days
    // Don't delete featured channels
    const result = await Channel.deleteMany({
      lastActivity: { $lt: thirtyDaysAgo },
      isFeatured: false
    });
    
    if (result.deletedCount > 0) {
      console.log(`Deleted ${result.deletedCount} inactive channels`);
    }
  } catch (error) {
    console.error('Error cleaning up inactive channels:', error);
  }
};

// Initialize default channels and schedule cleanup
initializeDefaultChannels();
setInterval(cleanupInactiveChannels, 24 * 60 * 60 * 1000); // Run once a day

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  let currentChannel = null;
  
  // Join a chat room
  socket.on('join_room', async (roomId) => {
    // Leave previous room if any
    if (currentChannel) {
      socket.leave(currentChannel);
      
      // Decrement user count for previous channel
      if (activeChannels.has(currentChannel)) {
        const count = activeChannels.get(currentChannel) - 1;
        activeChannels.set(currentChannel, Math.max(0, count));
        
        // Update active users count in database
        await Channel.findOneAndUpdate(
          { name: currentChannel },
          { activeUsers: Math.max(0, count) }
        );
        
        // Broadcast updated user count
        io.to(currentChannel).emit('user_count', Math.max(0, count));
      }
    }
    
    // Join new room
    socket.join(roomId);
    currentChannel = roomId;
    console.log(`User ${socket.id} joined room: ${roomId}`);
    
    // Increment user count for this channel
    const currentCount = activeChannels.get(roomId) || 0;
    activeChannels.set(roomId, currentCount + 1);
    
    // Update channel in database
    try {
      const channel = await Channel.findOneAndUpdate(
        { name: roomId },
        { 
          $inc: { activeUsers: 1 },
          lastActivity: new Date()
        },
        { new: true, upsert: false }
      );
      
      // If channel doesn't exist in database but users are trying to join,
      // create it as a custom channel
      if (!channel) {
        const newChannel = new Channel({
          name: roomId,
          displayName: roomId.charAt(0).toUpperCase() + roomId.slice(1).replace(/-/g, ' '),
          description: 'A user-created channel',
          category: 'other',
          createdAt: new Date(),
          lastActivity: new Date(),
          activeUsers: 1
        });
        await newChannel.save();
      }
    } catch (error) {
      console.error('Error updating channel activity:', error);
    }
    
    // Broadcast updated user count
    io.to(roomId).emit('user_count', activeChannels.get(roomId) || 0);
  });

  // Handle chat messages
  socket.on('send_message', async (data) => {
    // Sanitize the message content to prevent XSS attacks
    const sanitizedContent = DOMPurify.sanitize(data.content);
    
    // Apply content moderation
    const moderationResult = contentModerator.moderateContent(
      sanitizedContent,
      socket.id,
      data.room
    );
    
    // If content is blocked, send rejection to just the sender
    if (moderationResult.action === 'block') {
      socket.emit('message_rejected', {
        reason: moderationResult.flagReason || 'Message flagged by automated moderation',
        severity: moderationResult.severity,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Get the final content (either original or filtered version)
    const finalContent = moderationResult.action === 'filter' ? 
      moderationResult.modifiedContent : sanitizedContent;
    
    const messageData = {
      content: finalContent,
      sender: socket.user.username,
      user: socket.user._id,
      room: data.room,
      timestamp: new Date()
    };
    
    try {
      // Save message to database
      const message = new Message(messageData);
      const savedMessage = await message.save();
      
      // Update channel's last activity and message count
      await Channel.findOneAndUpdate(
        { name: data.room },
        { 
          lastActivity: new Date(),
          $inc: { totalMessages: 1 }
        }
      );
      
      // Prepare the message for broadcasting
      const broadcastMessage = {
        content: finalContent,
        sender: data.sender || 'anonymous',
        timestamp: new Date().toISOString(),
        id: savedMessage._id || Math.random().toString(36).substr(2, 9)
      };
      
      // If message was flagged but still allowed, add flag data for potential admin viewing
      if (moderationResult.flagged && moderationResult.action === 'allow') {
        broadcastMessage.flagged = true;
        broadcastMessage.flagReason = moderationResult.flagReason;
      }
      
      // Broadcast the message to everyone in the room
      io.to(data.room).emit('receive_message', broadcastMessage);
      
      // If message was filtered, notify the sender
      if (moderationResult.action === 'filter') {
        socket.emit('message_filtered', {
          original: sanitizedContent,
          filtered: finalContent,
          reason: moderationResult.flagReason,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error saving message:', error);
      // Still emit the message even if there's an error saving to the database
      io.to(data.room).emit('receive_message', {
        content: finalContent,
        sender: data.sender || 'anonymous',
        timestamp: new Date().toISOString(),
        id: Math.random().toString(36).substr(2, 9)
      });
    }
  });
  
  // Handle message reports
  socket.on('report_message', async (data) => {
    try {
      const { messageId, messageContent, reason, details, channel } = data;
      
      if (!messageId || !reason || !channel) {
        socket.emit('report_error', {
          message: 'Missing required fields for report'
        });
        return;
      }
      
      // Create report
      const report = new Report({
        messageId,
        messageContent,
        reportedBy: socket.user._id,
        reason,
        details: details || '',
        channel
      });
      
      await report.save();
      
      socket.emit('report_received', {
        messageId,
        status: 'submitted',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error processing report:', error);
      socket.emit('report_error', {
        message: 'Server error processing report',
        error: error.message
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Decrement user count for the channel if user was in one
    if (currentChannel) {
      if (activeChannels.has(currentChannel)) {
        const count = activeChannels.get(currentChannel) - 1;
        activeChannels.set(currentChannel, Math.max(0, count));
        
        // Update database
        Channel.findOneAndUpdate(
          { name: currentChannel },
          { activeUsers: Math.max(0, count) }
        ).catch(err => console.error('Error updating channel on disconnect:', err));
        
        // Broadcast updated user count
        io.to(currentChannel).emit('user_count', Math.max(0, count));
      }
    }
  });
});

// Set up the port
const PORT = process.env.PORT || 5000;

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});