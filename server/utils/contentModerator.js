/**
 * Content Moderation System for RetroChat
 * 
 * This module provides content moderation capabilities including:
 * - Profanity filtering
 * - Message rate limiting
 * - Spam detection
 * - Content flagging
 */

// Basic profanity list - in a production app, this should be more comprehensive
// and perhaps loaded from an external file or database
const basicProfanityList = [
  'fuck', 'shit', 'ass', 'bitch', 'dick', 'pussy', 'cunt', 'asshole',
  'bastard', 'whore', 'nigger', 'faggot', 'slut'
];

// More severe profanity/harmful content
const severeProfanityList = [
  'kill yourself', 'kys', 'suicide', 'rape', 'child porn', 'cp', 'pedo'
];

// Spam patterns
const spamPatterns = [
  /(\S+)(\s+\1){4,}/i,  // Same word repeated multiple times
  /(https?:\/\/\S+(\s|$)){3,}/i, // Multiple URLs
  /(.)\1{10,}/i // Character repeated many times (like "aaaaaaaaaaa")
];

/**
 * Configuration for the content moderation system
 */
const defaultConfig = {
  // Profanity filtering settings
  profanityFilter: {
    enabled: true,
    action: 'filter', // 'filter', 'block', or 'flag'
    replacement: '****'
  },
  
  // Severe content settings
  severeContentFilter: {
    enabled: true,
    action: 'block', // 'filter', 'block', or 'flag'
  },
  
  // Spam detection
  spamDetection: {
    enabled: true,
    action: 'flag', // 'filter', 'block', or 'flag'
  },
  
  // Rate limiting
  rateLimit: {
    enabled: true,
    maxMessages: 5,
    timeWindow: 10000, // 10 seconds
    action: 'block'
  },
  
  // Image moderation
  imageModeration: {
    enabled: true,
    action: 'flag', // 'block' or 'flag'
    maxSizeKB: 2048, // 2MB max file size
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  }
};

// In-memory store for flagged messages that need review
// Store flagged messages in memory (for quick access) and sync with database
const flaggedMessages = [];

// Track user message rates for rate limiting
const userMessageCounts = new Map();

// Import FlaggedMessage model
const FlaggedMessage = require('../models/FlaggedMessage');

/**
 * Main content moderation function
 * @param {string} content - The message content to moderate
 * @param {string} userId - The sender's ID
 * @param {string} roomId - The room where the message is being sent
 * @param {string} messageId - Optional ID of the message (for database reference)
 * @param {Object} config - Custom configuration (will be merged with default)
 * @returns {Object} - Result of the moderation
 */
async function moderateContent(content, userId, roomId, messageId = null, config = {}) {
  // Merge with default config
  const modConfig = { ...defaultConfig, ...config };
  const result = {
    originalContent: content,
    modifiedContent: content,
    action: 'allow', // 'allow', 'filter', 'block', 'flag'
    flagged: false,
    flagReason: null,
    severity: 'none', // 'none', 'low', 'medium', 'high'
    timestamp: new Date()
  };

  // Check rate limiting first
  if (modConfig.rateLimit.enabled) {
    const rateLimitResult = checkRateLimit(userId, modConfig.rateLimit);
    if (rateLimitResult.blocked) {
      result.action = 'block';
      result.flagged = true;
      result.flagReason = 'Rate limit exceeded';
      result.severity = 'medium';
      
      // Flag the message for review
      try {
        await flagMessage(result, userId, roomId, messageId);
      } catch (error) {
        console.error('Error flagging rate-limited message:', error);
      }
      
      return result;
    }
  }

  // Check for severe content - this has highest priority
  if (modConfig.severeContentFilter.enabled) {
    const severeContentCheck = checkSevereContent(content, modConfig.severeContentFilter);
    if (severeContentCheck.found) {
      result.flagged = true;
      result.flagReason = `Severe content: "${severeContentCheck.match}"`;
      result.severity = 'high';
      result.action = modConfig.severeContentFilter.action;
      
      if (result.action === 'filter') {
        result.modifiedContent = severeContentCheck.modified;
      }
      
      // Add to flagged messages queue if action is 'flag'
      if (result.action === 'flag') {
        try {
          await flagMessage(result, userId, roomId, messageId);
        } catch (error) {
          console.error('Error flagging severe content message:', error);
        }
      }
      
      return result;
    }
  }

  // Check for spam patterns
  if (modConfig.spamDetection.enabled) {
    const spamCheck = checkForSpam(content);
    if (spamCheck.isSpam) {
      result.flagged = true;
      result.flagReason = `Potential spam: ${spamCheck.reason}`;
      result.severity = 'medium';
      result.action = modConfig.spamDetection.action;
      
      // Add to flagged messages queue if action is 'flag'
      if (result.action === 'flag') {
        try {
          await flagMessage(result, userId, roomId, messageId);
        } catch (error) {
          console.error('Error flagging spam message:', error);
        }
      }
      
      return result;
    }
  }

  // Check for basic profanity
  if (modConfig.profanityFilter.enabled) {
    const profanityCheck = checkProfanity(content, modConfig.profanityFilter.replacement);
    if (profanityCheck.found) {
      result.modifiedContent = profanityCheck.modified;
      result.flagged = true;
      result.flagReason = `Profanity: "${profanityCheck.match}"`;
      result.severity = 'low';
      result.action = modConfig.profanityFilter.action;
      
      // Add to flagged messages queue if action is 'flag'
      if (result.action === 'flag') {
        try {
          await flagMessage(result, userId, roomId, messageId);
        } catch (error) {
          console.error('Error flagging profanity message:', error);
        }
      }
      
      // If action is 'filter', we still allow but with modified content
      if (result.action === 'filter') {
        result.action = 'allow';
      }
    }
  }

  return result;
}

/**
 * Check message for basic profanity
 * @param {string} content - Message content
 * @param {string} replacement - String to replace profanity with
 * @returns {Object} - Result of the check
 */
function checkProfanity(content, replacement) {
  const result = {
    found: false,
    match: null,
    modified: content
  };

  // Check for whole words only with word boundaries
  for (const word of basicProfanityList) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(content)) {
      result.found = true;
      result.match = word;
      result.modified = content.replace(regex, replacement);
      break;
    }
  }

  return result;
}

/**
 * Check message for severe content
 * @param {string} content - Message content
 * @param {Object} config - Configuration for severe content filtering
 * @returns {Object} - Result of the check
 */
function checkSevereContent(content, config) {
  const result = {
    found: false,
    match: null,
    modified: content
  };

  // Check for whole phrases or words
  for (const term of severeProfanityList) {
    const regex = new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    if (regex.test(content)) {
      result.found = true;
      result.match = term;
      
      // If filtering is requested, replace the content
      if (config.action === 'filter') {
        result.modified = content.replace(regex, '******');
      }
      break;
    }
  }

  return result;
}

/**
 * Check for spam patterns in the message
 * @param {string} content - Message content
 * @returns {Object} - Result of the check
 */
function checkForSpam(content) {
  const result = {
    isSpam: false,
    reason: null
  };

  // Check for known spam patterns
  for (const pattern of spamPatterns) {
    if (pattern.test(content)) {
      result.isSpam = true;
      result.reason = 'Detected repetitive pattern';
      break;
    }
  }

  // Check for ALL CAPS (if message is long enough)
  if (content.length > 20) {
    const upperCount = content.split('').filter(char => char.match(/[A-Z]/)).length;
    const letterCount = content.split('').filter(char => char.match(/[a-zA-Z]/)).length;
    
    if (letterCount > 0 && (upperCount / letterCount) > 0.8) {
      result.isSpam = true;
      result.reason = 'Excessive use of capital letters';
    }
  }

  return result;
}

/**
 * Implement rate limiting
 * @param {string} userId - User identifier
 * @param {Object} config - Rate limiting configuration
 * @returns {Object} - Result of rate limit check
 */
function checkRateLimit(userId, config) {
  const now = Date.now();
  const result = {
    blocked: false,
    remainingMessages: config.maxMessages
  };

  if (!userMessageCounts.has(userId)) {
    userMessageCounts.set(userId, {
      count: 1,
      lastReset: now
    });
    result.remainingMessages -= 1;
    return result;
  }

  const userStat = userMessageCounts.get(userId);
  
  // Reset counter if time window has passed
  if (now - userStat.lastReset > config.timeWindow) {
    userStat.count = 1;
    userStat.lastReset = now;
    result.remainingMessages -= 1;
    return result;
  }

  // Check if user exceeded limit
  if (userStat.count >= config.maxMessages) {
    result.blocked = true;
    result.remainingMessages = 0;
    return result;
  }

  // Increment counter
  userStat.count += 1;
  result.remainingMessages = config.maxMessages - userStat.count;
  return result;
}

/**
 * Add a message to the flagged messages queue and database
 * @param {Object} moderationResult - Result from moderation
 * @param {string} userId - User identifier
 * @param {string} roomId - Room identifier
 * @param {string} messageId - Optional Message ID reference
 */
async function flagMessage(moderationResult, userId, roomId, messageId = null) {
  const flaggedMessage = {
    ...moderationResult,
    userId,
    roomId,
    messageId,
    reviewStatus: 'pending',
    flaggedAt: new Date()
  };
  
  // Add to in-memory queue
  flaggedMessages.push(flaggedMessage);
  
  // Keep only the last 1000 flagged messages in memory
  if (flaggedMessages.length > 1000) {
    flaggedMessages.shift();
  }
  
  // Persist to database
  try {
    const dbFlaggedMessage = new FlaggedMessage(flaggedMessage);
    await dbFlaggedMessage.save();
    
    // Update the in-memory object with the database ID
    flaggedMessage._id = dbFlaggedMessage._id;
  } catch (error) {
    console.error('Error saving flagged message to database:', error);
    // Continue with in-memory storage even if database save fails
  }
}

/**
 * Get all flagged messages for admin review
 * Attempts to fetch from database first, falls back to in-memory if database access fails
 * @param {Object} filters - Optional filters like status, severity, etc.
 * @param {Number} page - Page number for pagination
 * @param {Number} limit - Number of items per page
 * @returns {Promise<Array>} - Filtered flagged messages
 */
async function getFlaggedMessages(filters = {}, page = 1, limit = 10) {
  try {
    // Build database query
    const query = {};
    if (filters.status) query.reviewStatus = filters.status;
    if (filters.severity) query.severity = filters.severity;
    if (filters.roomId) query.roomId = filters.roomId;
    
    // Fetch from database with pagination
    const skip = (page - 1) * limit;
    const flaggedMessagesFromDB = await FlaggedMessage.find(query)
      .sort({ flaggedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    return flaggedMessagesFromDB;
  } catch (error) {
    console.error('Error fetching flagged messages from database:', error);
    
    // Fallback to in-memory if database fails
    let result = [...flaggedMessages];
    
    // Apply filters
    if (filters.status) {
      result = result.filter(msg => msg.reviewStatus === filters.status);
    }
    
    if (filters.severity) {
      result = result.filter(msg => msg.severity === filters.severity);
    }
    
    if (filters.roomId) {
      result = result.filter(msg => msg.roomId === filters.roomId);
    }
    
    // Always sort by timestamp descending (newest first)
    result.sort((a, b) => b.flaggedAt - a.flaggedAt);
    
    // Apply pagination
    const skip = (page - 1) * limit;
    result = result.slice(skip, skip + limit);
    
    return result;
  }
}

/**
 * Update the status of a flagged message
 * @param {string} messageId - ID of the flagged message
 * @param {string} status - New status ('reviewed', 'actioned')
 * @param {string} reviewerId - ID of admin who reviewed the message
 * @param {string} actionTaken - Optional action taken ('none', 'removed', 'user_restricted', 'warning_issued')
 * @returns {Promise<boolean>} - Success or failure
 */
async function updateFlaggedMessageStatus(messageId, status, reviewerId, actionTaken = 'none') {
  try {
    // Update in database
    const updatedMessage = await FlaggedMessage.findByIdAndUpdate(
      messageId,
      { 
        reviewStatus: status, 
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
        actionTaken: actionTaken
      },
      { new: true }
    );
    
    if (!updatedMessage) {
      return false;
    }
    
    // Update in memory as well
    const index = flaggedMessages.findIndex(msg => msg._id && msg._id.toString() === messageId);
    if (index !== -1) {
      flaggedMessages[index].reviewStatus = status;
      flaggedMessages[index].reviewedAt = new Date();
      flaggedMessages[index].reviewedBy = reviewerId;
      flaggedMessages[index].actionTaken = actionTaken;
    }
    
    return true;
  } catch (error) {
    console.error('Error updating flagged message status:', error);
    return false;
  }
}

/**
 * Clear rate limiting for a user
 * @param {string} userId - User identifier
 */
function clearRateLimit(userId) {
  if (userMessageCounts.has(userId)) {
    userMessageCounts.delete(userId);
  }
}

/**
 * Remove a flagged message and optionally the original message from the chat
 * @param {string} flaggedMessageId - ID of the flagged message
 * @param {boolean} removeOriginal - Whether to remove the original message from chat
 * @param {string} reviewerId - ID of admin who performed the action
 * @returns {Promise<boolean>} - Success or failure
 */
async function removeFlaggedMessage(flaggedMessageId, removeOriginal, reviewerId) {
  try {
    // Find the flagged message
    const flaggedMessage = await FlaggedMessage.findById(flaggedMessageId);
    if (!flaggedMessage) {
      return false;
    }
    
    // If we need to remove the original message from chat history
    if (removeOriginal && flaggedMessage.messageId) {
      const Message = require('../models/Message');
      await Message.findByIdAndDelete(flaggedMessage.messageId);
    }
    
    // Mark the flagged message as actioned
    await updateFlaggedMessageStatus(
      flaggedMessageId, 
      'actioned', 
      reviewerId, 
      'removed'
    );
    
    return true;
  } catch (error) {
    console.error('Error removing flagged message:', error);
    return false;
  }
}

/**
 * Apply a temporary restriction to a user who posted flagged content
 * @param {string} flaggedMessageId - ID of the flagged message
 * @param {string} reviewerId - ID of admin who performed the action
 * @param {string} restrictionType - Type of restriction ('warning', 'temporary_ban')
 * @param {number} duration - Duration of restriction in minutes (for temporary bans)
 * @returns {Promise<boolean>} - Success or failure
 */
async function restrictUser(flaggedMessageId, reviewerId, restrictionType = 'warning', duration = 60) {
  try {
    // Find the flagged message
    const flaggedMessage = await FlaggedMessage.findById(flaggedMessageId);
    if (!flaggedMessage) {
      return false;
    }
    
    // Get User model
    const User = require('../models/User');
    const user = await User.findById(flaggedMessage.userId);
    if (!user) {
      return false;
    }
    
    // Apply the restriction based on type
    if (restrictionType === 'warning') {
      // Create a new warning entry
      if (!user.warnings) {
        user.warnings = {
          count: 0,
          history: []
        };
      }
      
      // Increment warning count
      user.warnings.count = (user.warnings.count || 0) + 1;
      
      // Add to warning history
      user.warnings.history.push({
        reason: flaggedMessage.flagReason,
        message: `Warning for content: "${flaggedMessage.originalContent.substring(0, 50)}${flaggedMessage.originalContent.length > 50 ? '...' : ''}"`,
        messageId: flaggedMessage.messageId,
        flaggedMessageId: flaggedMessage._id,
        issuedAt: new Date(),
        issuedBy: reviewerId
      });
      
      await user.save();
      
      // Update the flagged message status
      await updateFlaggedMessageStatus(
        flaggedMessageId, 
        'actioned', 
        reviewerId, 
        'warning_issued'
      );
    } else if (restrictionType === 'temporary_ban') {
      // Set a temporary ban until date
      const banUntil = new Date();
      banUntil.setMinutes(banUntil.getMinutes() + duration);
      
      user.restrictions = {
        ...user.restrictions,
        isBanned: true,
        banReason: 'Violation of community guidelines',
        banUntil: banUntil,
        bannedBy: reviewerId
      };
      
      await user.save();
      
      // Update the flagged message status
      await updateFlaggedMessageStatus(
        flaggedMessageId, 
        'actioned', 
        reviewerId, 
        'user_restricted'
      );
    }
    
    return true;
  } catch (error) {
    console.error('Error restricting user:', error);
    return false;
  }
}

// Initialize the system by loading flagged messages from the database into memory
async function initializeFromDatabase() {
  try {
    const recentFlaggedMessages = await FlaggedMessage.find({})
      .sort({ flaggedAt: -1 })
      .limit(1000);
    
    // Replace the in-memory array with database results
    flaggedMessages.length = 0;
    flaggedMessages.push(...recentFlaggedMessages);
    
    console.log(`Loaded ${flaggedMessages.length} flagged messages from database`);
  } catch (error) {
    console.error('Error initializing flagged messages from database:', error);
  }
}

// Initialize on module load
setTimeout(initializeFromDatabase, 1000);

/**
 * Moderate an image file
 * @param {Object} file - The file object with buffer, mimetype, etc.
 * @param {string} userId - User identifier
 * @param {Object} config - Configuration for image moderation
 * @returns {Object} - Result of the moderation
 */
async function moderateImage(file, userId, config = {}) {
  // Merge with default config
  const modConfig = { ...defaultConfig.imageModeration, ...config };
  
  const result = {
    allowed: true,
    flagged: false,
    flagReason: null,
    severity: 'none',
    timestamp: new Date()
  };
  
  // Check file size
  if (file.size > modConfig.maxSizeKB * 1024) {
    result.allowed = false;
    result.flagged = true;
    result.flagReason = `Image exceeds maximum size of ${modConfig.maxSizeKB}KB`;
    result.severity = 'low';
    return result;
  }
  
  // Check file type
  if (!modConfig.allowedTypes.includes(file.mimetype)) {
    result.allowed = false;
    result.flagged = true;
    result.flagReason = `Image type ${file.mimetype} is not allowed`;
    result.severity = 'medium';
    return result;
  }
  
  // In a production environment, you would want to implement more sophisticated
  // image moderation here, such as:
  // 1. Content detection APIs (Google Cloud Vision, Azure Computer Vision, etc.)
  // 2. NSFW image detection
  // 3. Image hash comparison against known bad images
  // 4. Manual review for flagged images
  
  // For now, we'll implement a basic placeholder
  // This simulates image moderation by checking if file size is suspicious
  // (This is just a placeholder for demonstration purposes)
  if (file.size > modConfig.maxSizeKB * 1024 * 0.8) {
    result.flagged = true;
    result.flagReason = 'Large image flagged for review';
    result.severity = 'low';
    
    if (modConfig.action === 'block') {
      result.allowed = false;
    }
  }
  
  return result;
}

module.exports = {
  moderateContent,
  getFlaggedMessages,
  updateFlaggedMessageStatus,
  clearRateLimit,
  removeFlaggedMessage,
  restrictUser,
  moderateImage
};