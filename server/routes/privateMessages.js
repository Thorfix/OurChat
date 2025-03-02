const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { validatePayloadSize } = require('../middleware/validationMiddleware');
const { protect } = require('../middleware/authMiddleware');
const PrivateMessage = require('../models/PrivateMessage');
const UserPublicKey = require('../models/UserPublicKey');
const User = require('../models/User');
const SecurityAudit = require('../models/SecurityAudit');

// Apply authentication to all private message routes
router.use(protect);

// Apply more strict payload size limit for encrypted messages
router.use(validatePayloadSize(100 * 1024)); // 100KB limit for encrypted content

// Endpoint to broadcast user typing status
router.post('/typing', async (req, res) => {
  try {
    const { recipientId, isTyping } = req.body;
    
    // Validate recipient ID
    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({ message: 'Invalid recipient ID' });
    }
    
    // Get the socket.io instance
    const io = req.app.get('io');
    if (io) {
      const privateRoomId = `private_${recipientId}`;
      
      // Emit typing status to recipient
      io.to(privateRoomId).emit('typing_status', {
        senderId: req.user._id,
        senderUsername: req.user.username,
        isTyping: !!isTyping
      });
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error broadcasting typing status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Store user's public key
router.post('/keys', async (req, res) => {
  try {
    const { publicKey, keyId } = req.body;
    
    if (!publicKey || !keyId) {
      return res.status(400).json({ message: 'Public key and keyId are required' });
    }
    
    // Validate key format (basic check)
    if (typeof publicKey !== 'string' || publicKey.length < 64) {
      return res.status(400).json({ message: 'Invalid public key format' });
    }
    
    // Deactivate any previous active keys for this user
    await UserPublicKey.updateMany(
      { userId: req.user._id, isActive: true },
      { isActive: false }
    );
    
    // Create a new active key
    const userPublicKey = new UserPublicKey({
      userId: req.user._id,
      keyId,
      publicKey,
      isActive: true
    });
    
    await userPublicKey.save();
    
    // Log key creation for security audit
    await SecurityAudit.create({
      eventType: 'PUBLIC_KEY_CREATED',
      user: req.user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        keyId
      },
      severity: 'INFO'
    });
    
    res.status(201).json({
      message: 'Public key stored successfully',
      keyId
    });
  } catch (error) {
    console.error('Error storing public key:', error);
    res.status(500).json({ message: 'Server error storing public key' });
  }
});

// Get a user's active public key
router.get('/keys/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate that the userId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    // Find the target user to verify they exist
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get the user's active public key
    const userPublicKey = await UserPublicKey.findOne({
      userId,
      isActive: true
    });
    
    // Update the lastUsedAt timestamp
    if (userPublicKey) {
      userPublicKey.lastUsedAt = new Date();
      await userPublicKey.save();
    }
    
    if (!userPublicKey) {
      return res.status(404).json({ message: 'No active public key found for this user' });
    }
    
    // Log key access for security audit
    await SecurityAudit.create({
      eventType: 'PUBLIC_KEY_ACCESSED',
      user: req.user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        targetUserId: userId,
        keyId: userPublicKey.keyId
      },
      severity: 'INFO'
    });
    
    res.json({
      keyId: userPublicKey.keyId,
      publicKey: userPublicKey.publicKey,
      userId: userPublicKey.userId,
      createdAt: userPublicKey.createdAt
    });
  } catch (error) {
    console.error('Error retrieving public key:', error);
    res.status(500).json({ message: 'Server error retrieving public key' });
  }
});

// Send a private message
router.post('/', async (req, res) => {
  try {
    const { encryptedContent, recipientId, expiresInMinutes, encryptedImageData, senderPublicKeyId } = req.body;
    
    if (!encryptedContent || !recipientId) {
      return res.status(400).json({ message: 'Encrypted content and recipient ID are required' });
    }
    
    // Validate that the recipientId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({ message: 'Invalid recipient ID format' });
    }
    
    // Validate encrypted content format
    if (typeof encryptedContent !== 'string') {
      return res.status(400).json({ message: 'Invalid encrypted content format' });
    }
    
    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    // Calculate expiration time if provided, with validation
    let expiresAt = null;
    if (expiresInMinutes) {
      const minutes = parseInt(expiresInMinutes, 10);
      // Valid expiration times: 5min, 10min, 30min, 1hr, 24hr, 7days
      const validExpirationTimes = [5, 10, 30, 60, 1440, 10080];
      
      if (Number.isInteger(minutes) && validExpirationTimes.includes(minutes)) {
        expiresAt = new Date(Date.now() + minutes * 60 * 1000);
      } else {
        return res.status(400).json({ 
          message: 'Invalid expiration time. Choose from: 5, 10, 30, 60, 1440, or 10080 minutes'
        });
      }
    }
    
    // Create the new private message
    const privateMessage = new PrivateMessage({
      encryptedContent,
      senderId: req.user._id,
      recipientId,
      senderPublicKeyId: senderPublicKeyId || null,
      expiresAt,
      hasEncryptedImage: !!encryptedImageData,
      encryptedImageData: encryptedImageData || null
    });
    
    const savedMessage = await privateMessage.save();
    
    // Log message creation for security audit (without content)
    await SecurityAudit.create({
      eventType: 'PRIVATE_MESSAGE_SENT',
      user: req.user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        messageId: savedMessage._id,
        recipientId,
        hasImage: !!encryptedImageData,
        expiresAt
      },
      severity: 'INFO'
    });
    
    // Emit socket event to notify the recipient about the new message
    // Get socket.io instance from app
    const io = req.app.get('io');
    if (io) {
      const privateRoomId = `private_${recipientId}`;
      
      // Send notification with minimal information (no encrypted content)
      io.to(privateRoomId).emit('private_message_received', {
        type: 'new_message',
        messageId: savedMessage._id,
        senderId: req.user._id,
        senderUsername: req.user.username,
        hasImage: !!encryptedImageData,
        timestamp: savedMessage.createdAt,
        isEncrypted: true
      });
    }
    
    res.status(201).json({
      messageId: savedMessage._id,
      createdAt: savedMessage.createdAt,
      expiresAt: savedMessage.expiresAt
    });
  } catch (error) {
    console.error('Error sending private message:', error);
    res.status(500).json({ message: 'Server error sending private message' });
  }
});

// Get conversation with another user - paginated
router.get('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 50); // Limit max page size
    
    // Validate that the userId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    // Find the target user to verify they exist
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get messages between the two users (current user and target user)
    // Both sent and received messages in one query
    const messages = await PrivateMessage.find({
      $or: [
        { senderId: req.user._id, recipientId: userId },
        { senderId: userId, recipientId: req.user._id }
      ]
    })
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize);
    
    // Get total message count for pagination
    const totalMessages = await PrivateMessage.countDocuments({
      $or: [
        { senderId: req.user._id, recipientId: userId },
        { senderId: userId, recipientId: req.user._id }
      ]
    });
    
    // Mark received messages as read
    await PrivateMessage.updateMany(
      { senderId: userId, recipientId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    
    // Format the response
    const formattedMessages = messages.map(message => ({
      id: message._id,
      encryptedContent: message.encryptedContent,
      senderId: message.senderId,
      recipientId: message.recipientId,
      senderPublicKeyId: message.senderPublicKeyId,
      isFromSelf: message.senderId.toString() === req.user._id.toString(),
      createdAt: message.createdAt,
      expiresAt: message.expiresAt,
      isRead: message.isRead,
      readAt: message.readAt,
      hasEncryptedImage: message.hasEncryptedImage,
      encryptedImageData: message.encryptedImageData
    }));
    
    res.json({
      messages: formattedMessages,
      pagination: {
        page,
        pageSize,
        totalMessages,
        totalPages: Math.ceil(totalMessages / pageSize)
      }
    });
  } catch (error) {
    console.error('Error retrieving private messages:', error);
    res.status(500).json({ message: 'Server error retrieving private messages' });
  }
});

// Get all conversations for the current user
router.get('/conversations', async (req, res) => {
  try {
    // Finding the latest message with each user the current user has exchanged messages with
    const conversations = await PrivateMessage.aggregate([
      {
        $match: {
          $or: [
            { senderId: new mongoose.Types.ObjectId(req.user._id) },
            { recipientId: new mongoose.Types.ObjectId(req.user._id) }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", new mongoose.Types.ObjectId(req.user._id)] },
              "$recipientId",
              "$senderId"
            ]
          },
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    { $eq: ["$recipientId", new mongoose.Types.ObjectId(req.user._id)] },
                    { $eq: ["$isRead", false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $project: {
          userId: "$_id",
          username: { $arrayElemAt: ["$user.username", 0] },
          lastMessageAt: "$lastMessage.createdAt",
          lastMessageId: "$lastMessage._id",
          unreadCount: 1,
          _id: 0
        }
      },
      {
        $sort: { lastMessageAt: -1 }
      }
    ]);
    
    res.json({ conversations });
  } catch (error) {
    console.error('Error retrieving conversations:', error);
    res.status(500).json({ message: 'Server error retrieving conversations' });
  }
});

// Delete all messages in a conversation (for the current user only)
router.delete('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    // Find all messages between current user and target user
    const result = await PrivateMessage.deleteMany({
      $or: [
        { senderId: req.user._id, recipientId: userId },
        { senderId: userId, recipientId: req.user._id }
      ]
    });
    
    // Log conversation deletion for security audit
    await SecurityAudit.create({
      eventType: 'PRIVATE_CONVERSATION_DELETED',
      user: req.user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        conversationWith: userId,
        messagesDeleted: result.deletedCount
      },
      severity: 'INFO'
    });
    
    res.json({
      message: 'Conversation deleted successfully',
      deletedMessages: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ message: 'Server error deleting conversation' });
  }
});

// Delete a specific message (if you're the sender or recipient)
router.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    
    // Validate message ID
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: 'Invalid message ID format' });
    }
    
    // Find the message
    const message = await PrivateMessage.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Check if user is the sender or recipient
    const isAuthorized = message.senderId.toString() === req.user._id.toString() || 
                         message.recipientId.toString() === req.user._id.toString();
                         
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }
    
    // Delete the message
    await message.remove();
    
    // Log message deletion for security audit
    await SecurityAudit.create({
      eventType: 'PRIVATE_MESSAGE_DELETED',
      user: req.user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        messageId,
        deletedBy: req.user._id,
        wasSender: message.senderId.toString() === req.user._id.toString()
      },
      severity: 'INFO'
    });
    
    // Notify the other party about message deletion via socket
    const io = req.app.get('io');
    if (io) {
      // Determine the recipient of the notification (the other user)
      const notificationRecipientId = message.senderId.toString() === req.user._id.toString() 
        ? message.recipientId.toString()
        : message.senderId.toString();
        
      const privateRoomId = `private_${notificationRecipientId}`;
      
      io.to(privateRoomId).emit('private_message_deleted', {
        messageId,
        deletedBy: req.user._id
      });
    }
    
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Server error deleting message' });
  }
});

module.exports = router;