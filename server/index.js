const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIo = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const { marked } = require('marked');
const connectDB = require('./config/db');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Message = require('./models/Message');
const Channel = require('./models/Channel');
const Report = require('./models/Report');
const User = require('./models/User');
const SecurityAudit = require('./models/SecurityAudit');
const channelRoutes = require('./routes/channels');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');
const privateMessageRoutes = require('./routes/privateMessages');
const contentModerator = require('./utils/contentModerator');
const { authenticateSocket, logSocketSecurityEvent } = require('./utils/socketAuth');
const { getSecurityHeaders } = require('./utils/securityUtils');
const { apiLimiter, authLimiter, passwordResetLimiter } = require('./middleware/rateLimitMiddleware');
const { csrfProtection, handleCsrfError } = require('./middleware/csrfMiddleware');

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
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Add comprehensive security headers with enhanced protections
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      blockAllMixedContent: process.env.NODE_ENV === 'production' ? [] : null,
      sandbox: ['allow-forms', 'allow-scripts', 'allow-same-origin'],
      reportUri: process.env.CSP_REPORT_URI ? process.env.CSP_REPORT_URI : null
    }
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  expectCt: {
    enforce: true,
    maxAge: 86400 // 1 day in seconds
  },
  dnsPrefetchControl: { allow: false },
  // Feature-Policy/Permissions-Policy - restrict browser features
  permissionsPolicy: {
    features: {
      geolocation: ["'none'"],
      camera: ["'none'"],
      microphone: ["'none'"],
      speaker: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"],
      fullscreen: ["'self'"],
      accelerometer: ["'none'"],
      ambient: ["'none'"],
      autoplay: ["'none'"],
      document: ["'none'"],
      webShare: ["'none'"],
      displayCapture: ["'none'"]
    }
  },
  // New security headers not included in helmet
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  originAgentCluster: true
}));

// Add additional security headers not covered by helmet
app.use((req, res, next) => {
  // Cache control - prevent caching of API responses
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Content-Security-Policy-Report-Only for monitoring without blocking
  if (process.env.CSP_REPORT_URI) {
    res.setHeader('Content-Security-Policy-Report-Only', 
      "default-src 'self'; report-to " + process.env.CSP_REPORT_URI);
  }
  
  // Clear-Site-Data header for logout routes
  if (req.path === '/api/users/logout') {
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  }
  
  next();
});

// Socket authentication middleware
io.use(authenticateSocket);

// Middleware
app.use(cookieParser(process.env.COOKIE_SECRET || 'cookie-secret-fallback'));

// Enhanced CORS with stronger security settings
app.use(cors({
  // Validate origin against allowlist
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || 'http://localhost:3000').split(',');
    
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin);
    } else {
      // Log rejected origins for security monitoring
      console.warn(`CORS blocked request from origin: ${origin}`);
      try {
        new SecurityAudit({
          eventType: 'CORS_ORIGIN_BLOCKED',
          ip: req.ip,
          details: {
            blockedOrigin: origin,
            allowedOrigins
          },
          severity: 'WARNING'
        }).save();
      } catch (err) {
        console.error('Error logging CORS block:', err);
      }
      
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: [
    'X-CSRF-Token', 
    'Content-Type', 
    'X-Token-Expiring', 
    'X-Token-Expires-In',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400, // Cache preflight requests for 1 day
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-CSRF-Token', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  // Stronger preflight options
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Add request validation middleware
const { sanitizeInputs, validatePayloadSize } = require('./middleware/validationMiddleware');

// Request size limits to prevent DOS attacks
app.use(express.json({ limit: '10kb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// XSS protection middleware 
app.use(sanitizeInputs);

// Payload size validation
app.use(validatePayloadSize(10 * 1024)); // 10kb max for most endpoints

// Apply API rate limiting to all requests
app.use(apiLimiter);

// Add additional security timestamp to track request age
app.use((req, res, next) => {
  req.requestTime = Date.now();
  next();
});

// Apply additional rate limiting to auth routes
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api/users/forgot-password', passwordResetLimiter);
app.use('/api/users/reset-password', passwordResetLimiter);
app.use('/api/users/2fa/setup', authLimiter);
app.use('/api/users/2fa/verify', authLimiter);
app.use('/api/users/2fa/recovery', authLimiter);

// Apply CSRF protection to all routes that change state
app.use('/api/users/register', csrfProtection);
app.use('/api/users/login', csrfProtection);
app.use('/api/users/profile', csrfProtection);
app.use('/api/users/forgot-password', csrfProtection);
app.use('/api/users/reset-password', csrfProtection);
app.use('/api/users/2fa', csrfProtection);
app.use('/api/reports', csrfProtection);

// Handle CSRF errors
app.use(handleCsrfError);

// Generate and send CSRF token
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Add security audit logging middleware
app.use((req, res, next) => {
  // Save the original end method
  const originalEnd = res.end;
  
  // Add a listener for the finish event
  res.on('finish', () => {
    // Don't log health checks or static assets
    if (req.path === '/api/health' || req.path.startsWith('/static')) {
      return;
    }
    
    // Don't log successful GET requests to reduce noise
    if (req.method === 'GET' && res.statusCode < 400) {
      return;
    }
    
    // Log suspicious requests (4xx and 5xx)
    if (res.statusCode >= 400) {
      try {
        new SecurityAudit({
          eventType: res.statusCode >= 500 ? 'SERVER_ERROR' : 'INVALID_REQUEST',
          user: req.user ? req.user._id : null,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          details: {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            requestBody: req.method !== 'GET' ? 
              JSON.stringify(req.body).substring(0, 500) : undefined
          },
          severity: res.statusCode >= 500 ? 'ERROR' : 'WARNING'
        }).save();
      } catch (error) {
        console.error('Error logging security event:', error);
      }
    }
  });
  
  next();
});

// Routes
app.use('/api/channels', channelRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/private-messages', privateMessageRoutes);

// Simple route for API health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'RetroChat server is running' });
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up file storage using multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create a unique filename with UUID to prevent overwriting
    const uniqueFilename = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

// Create the multer instance with file size limits and filters
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only image files
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
    }
  }
});

// Handle image uploads
app.post('/api/upload/image', upload.single('image'), async (req, res) => {
  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    let decoded;
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
    
    // Check if user exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }
    
    // If no file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }
    
    // Apply image moderation
    const moderationResult = await contentModerator.moderateImage(req.file, user._id);
    
    // If moderation blocks the image
    if (!moderationResult.allowed) {
      // Delete the uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ 
        message: 'Image rejected by content moderation',
        reason: moderationResult.flagReason
      });
    }
    
    // Generate URL for the uploaded file
    const imageUrl = `/uploads/${req.file.filename}`;
    
    // Return success with image URL
    res.json({
      url: imageUrl,
      filename: req.file.filename,
      isFlagged: moderationResult.flagged,
      flagReason: moderationResult.flagReason
    });
    
    // If the image was flagged but still allowed, log it for later review
    if (moderationResult.flagged) {
      try {
        // Log the flagged image for admin review
        new SecurityAudit({
          eventType: 'IMAGE_FLAGGED',
          user: user._id,
          ip: req.ip,
          details: {
            imageUrl,
            reason: moderationResult.flagReason,
            severity: moderationResult.severity
          },
          severity: 'WARNING'
        }).save();
      } catch (error) {
        console.error('Error logging flagged image:', error);
      }
    }
  } catch (error) {
    console.error('Error uploading image:', error);
    
    // Clean up file if there was an error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ message: 'Server error during upload' });
  }
});

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
    // Check if there's content or an image (at least one is required)
    if (!data.content && !data.image) {
      socket.emit('message_rejected', {
        reason: 'Empty message: Please provide either text or an image',
        severity: 'low',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Sanitize the message content to prevent XSS attacks (if exists)
    const sanitizedContent = data.content ? DOMPurify.sanitize(data.content) : '';
    
    // Apply content moderation (if there's text content)
    let moderationResult = {
      action: 'allow',
      modifiedContent: sanitizedContent,
      flagged: false
    };
    
    if (sanitizedContent) {
      moderationResult = contentModerator.moderateContent(
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
    
    // Add image data if present
    if (data.image) {
      messageData.hasImage = true;
      messageData.imageUrl = data.image.url;
      messageData.imageModerationStatus = data.image.isFlagged ? 'pending' : 'approved';
      messageData.imageModerationReason = data.image.flagReason || null;
    }
    
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
        sender: data.sender || socket.user.username || 'anonymous',
        timestamp: new Date().toISOString(),
        id: savedMessage._id || Math.random().toString(36).substr(2, 9)
      };
      
      // Add image data to broadcast if present
      if (data.image) {
        broadcastMessage.hasImage = true;
        broadcastMessage.imageUrl = data.image.url;
        broadcastMessage.isFlagged = data.image.isFlagged || false;
        broadcastMessage.imageModerationStatus = messageData.imageModerationStatus;
        broadcastMessage.imageModerationReason = messageData.imageModerationReason;
      }
      
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
        sender: data.sender || socket.user.username || 'anonymous',
        timestamp: new Date().toISOString(),
        id: Math.random().toString(36).substr(2, 9),
        hasImage: data.image ? true : false,
        imageUrl: data.image ? data.image.url : null,
        isFlagged: data.image ? data.image.isFlagged : false,
        imageModerationStatus: data.image ? (data.image.isFlagged ? 'pending' : 'approved') : null,
        imageModerationReason: data.image ? data.image.flagReason : null
      });
    }
  });
  
  // Handle message edits
  socket.on('edit_message', async (data) => {
    try {
      // Get message from database
      const message = await Message.findById(data.messageId);
      
      // Check if message exists and if the user has permission to edit it
      if (!message) {
        socket.emit('edit_error', { 
          error: 'Message not found',
          messageId: data.messageId 
        });
        return;
      }
      
      // Verify ownership - user can only edit their own messages
      if (message.user && message.user.toString() !== socket.user._id.toString()) {
        logSocketSecurityEvent(socket, {
          eventType: 'MESSAGE_EDIT_UNAUTHORIZED',
          details: { messageId: data.messageId }
        });
        socket.emit('edit_error', { 
          error: 'You can only edit your own messages',
          messageId: data.messageId 
        });
        return;
      }
      
      // Check edit time window (10 minutes)
      const MESSAGE_EDIT_WINDOW = 10 * 60 * 1000; // 10 minutes in milliseconds
      const messageTime = new Date(message.timestamp).getTime();
      const currentTime = new Date().getTime();
      
      if ((currentTime - messageTime) > MESSAGE_EDIT_WINDOW) {
        socket.emit('edit_error', { 
          error: 'Messages can only be edited within 10 minutes of sending',
          messageId: data.messageId 
        });
        return;
      }
      
      // Sanitize the new content
      const sanitizedContent = DOMPurify.sanitize(data.newContent);
      
      // Apply content moderation to edited content
      const moderationResult = contentModerator.moderateContent(
        sanitizedContent,
        socket.id,
        data.room
      );
      
      // If edited content is blocked, reject the edit
      if (moderationResult.action === 'block') {
        socket.emit('edit_error', {
          error: `Edit rejected: ${moderationResult.flagReason || 'Message flagged by automated moderation'}`,
          messageId: data.messageId,
          severity: moderationResult.severity
        });
        return;
      }
      
      // Get the final content (either original or filtered version)
      const finalContent = moderationResult.action === 'filter' ? 
        moderationResult.modifiedContent : sanitizedContent;
      
      // Update the message
      message.content = finalContent;
      message.isEdited = true;
      message.editedAt = new Date();
      
      // If moderation flagged the message, add the flag info
      if (moderationResult.flagged) {
        message.flagged = true;
        message.flagReason = moderationResult.flagReason;
      }
      
      await message.save();
      
      // Prepare the updated message for broadcasting
      const updatedMessage = {
        id: message._id,
        content: finalContent,
        sender: message.sender,
        timestamp: message.timestamp,
        isEdited: true,
        editedAt: message.editedAt,
        flagged: message.flagged,
        flagReason: message.flagReason
      };
      
      // Broadcast the edited message to everyone in the room
      io.to(data.room).emit('message_updated', updatedMessage);
      
      // If content was filtered, notify the sender
      if (moderationResult.action === 'filter') {
        socket.emit('message_filtered', {
          original: sanitizedContent,
          filtered: finalContent,
          reason: moderationResult.flagReason,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error editing message:', error);
      socket.emit('edit_error', { 
        error: 'Server error while editing message',
        messageId: data.messageId 
      });
    }
  });
  
  // Handle message deletions
  socket.on('delete_message', async (data) => {
    try {
      // Find the message
      const message = await Message.findById(data.messageId);
      
      // Check if message exists
      if (!message) {
        socket.emit('delete_error', { 
          error: 'Message not found',
          messageId: data.messageId 
        });
        return;
      }
      
      // Verify ownership - user can only delete their own messages
      if (message.user && message.user.toString() !== socket.user._id.toString()) {
        logSocketSecurityEvent(socket, {
          eventType: 'MESSAGE_DELETE_UNAUTHORIZED',
          details: { messageId: data.messageId }
        });
        socket.emit('delete_error', { 
          error: 'You can only delete your own messages',
          messageId: data.messageId 
        });
        return;
      }
      
      // Check delete time window (10 minutes)
      const MESSAGE_DELETE_WINDOW = 10 * 60 * 1000; // 10 minutes in milliseconds
      const messageTime = new Date(message.timestamp).getTime();
      const currentTime = new Date().getTime();
      
      if ((currentTime - messageTime) > MESSAGE_DELETE_WINDOW) {
        socket.emit('delete_error', { 
          error: 'Messages can only be deleted within 10 minutes of sending',
          messageId: data.messageId 
        });
        return;
      }
      
      // Soft delete the message (mark as deleted, but keep in database)
      message.isDeleted = true;
      message.deletedAt = new Date();
      await message.save();
      
      // Broadcast deletion to everyone in the room
      io.to(data.room).emit('message_deleted', {
        id: message._id,
        isDeleted: true,
        deletedAt: message.deletedAt
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      socket.emit('delete_error', { 
        error: 'Server error while deleting message',
        messageId: data.messageId 
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