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
  }
};

// In-memory store for flagged messages that need review
const flaggedMessages = [];

// Track user message rates for rate limiting
const userMessageCounts = new Map();

/**
 * Main content moderation function
 * @param {string} content - The message content to moderate
 * @param {string} userId - The sender's ID
 * @param {string} roomId - The room where the message is being sent
 * @param {Object} config - Custom configuration (will be merged with default)
 * @returns {Object} - Result of the moderation
 */
function moderateContent(content, userId, roomId, config = {}) {
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
        flagMessage(result, userId, roomId);
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
        flagMessage(result, userId, roomId);
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
        flagMessage(result, userId, roomId);
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
 * Add a message to the flagged messages queue
 * @param {Object} moderationResult - Result from moderation
 * @param {string} userId - User identifier
 * @param {string} roomId - Room identifier
 */
function flagMessage(moderationResult, userId, roomId) {
  flaggedMessages.push({
    ...moderationResult,
    userId,
    roomId,
    reviewStatus: 'pending',
    flaggedAt: new Date()
  });
  
  // Keep only the last 1000 flagged messages
  if (flaggedMessages.length > 1000) {
    flaggedMessages.shift();
  }
}

/**
 * Get all flagged messages for admin review
 * @param {Object} filters - Optional filters like status, severity, etc.
 * @returns {Array} - Filtered flagged messages
 */
function getFlaggedMessages(filters = {}) {
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
  
  return result;
}

/**
 * Update the status of a flagged message
 * @param {string} messageId - ID of the flagged message
 * @param {string} status - New status ('approved', 'rejected', 'pending')
 * @returns {boolean} - Success or failure
 */
function updateFlaggedMessageStatus(messageId, status) {
  const index = flaggedMessages.findIndex(msg => msg.id === messageId);
  if (index !== -1) {
    flaggedMessages[index].reviewStatus = status;
    flaggedMessages[index].reviewedAt = new Date();
    return true;
  }
  return false;
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

module.exports = {
  moderateContent,
  getFlaggedMessages,
  updateFlaggedMessageStatus,
  clearRateLimit
};