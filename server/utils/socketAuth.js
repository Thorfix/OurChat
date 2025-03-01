const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { verifyToken, blacklistToken } = require('./jwtUtils');
const { ipAnomalyDetection } = require('./securityUtils');
const SecurityAudit = require('../models/SecurityAudit');
const { socketLimiter } = require('../middleware/rateLimitMiddleware');

// Socket authentication timeout
const AUTH_TIMEOUT = 15000; // 15 seconds

/**
 * Enhanced middleware to authenticate Socket.io connections with comprehensive security
 */
const authenticateSocket = async (socket, next) => {
  // Set authentication timeout
  const authTimeout = setTimeout(() => {
    logSocketSecurityEvent(null, socket, 'AUTH_TIMEOUT', {
      connectionType: 'websocket'
    });
    next(new Error('Authentication timeout'));
  }, AUTH_TIMEOUT);
  
  try {
    // Get token from handshake auth object
    const token = socket.handshake.auth.token;
    const clientIp = socket.handshake.address;
    const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
    
    if (!token) {
      logSocketSecurityEvent(null, socket, 'AUTH_FAILURE', {
        reason: 'No token provided'
      });
      clearTimeout(authTimeout);
      return next(new Error('Authentication error: Token required'));
    }
    
    // Apply socket connection rate limiting
    const rateLimitResult = socketLimiter(clientIp, userAgent);
    
    // If too many connections, reject
    if (rateLimitResult.limited) {
      logSocketSecurityEvent(null, socket, 'RATE_LIMIT_EXCEEDED', {
        count: rateLimitResult.current,
        limit: rateLimitResult.limit,
        connectionType: 'websocket'
      });
      clearTimeout(authTimeout);
      return next(new Error('Too many connection attempts. Please try again later.'));
    }
    
    // Create additional socket security context
    const securityContext = {
      connectedAt: Date.now(),
      ipHash: crypto.createHash('md5').update(clientIp).digest('hex'),
      authenticated: false
    };
    socket.security = securityContext;
    
    // Verify token with enhanced security - include IP & user agent for fingerprint verification
    // This is now an async call for better security checks
    const decoded = await verifyToken(token, clientIp, userAgent);
    
    // Get user from database (excluding sensitive fields)
    const user = await User.findById(decoded.id).select('-password -otpSecret -securityQuestions');
    
    if (!user) {
      logSocketSecurityEvent(decoded.id, socket, 'AUTH_FAILURE', {
        reason: 'User not found'
      });
      clearTimeout(authTimeout);
      return next(new Error('Authentication error: User not found'));
    }
    
    // Check if account is locked
    if (user.isLocked) {
      logSocketSecurityEvent(user._id, socket, 'AUTH_FAILURE', {
        reason: 'Account locked'
      });
      clearTimeout(authTimeout);
      return next(new Error('Authentication error: Account locked'));
    }
    
    // Check for required user verification status (email, etc)
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.isEmailVerified) {
      logSocketSecurityEvent(user._id, socket, 'AUTH_FAILURE', {
        reason: 'Email not verified'
      });
      clearTimeout(authTimeout);
      return next(new Error('Authentication error: Email verification required'));
    }
    
    // Check user account type - we can restrict socket access for certain account types
    if (user.accountType === 'restricted') {
      logSocketSecurityEvent(user._id, socket, 'AUTH_FAILURE', {
        reason: 'Account restricted'
      });
      clearTimeout(authTimeout);
      return next(new Error('Authentication error: Account restricted from socket access'));
    }
    
    // Enhanced IP-based anomaly detection with additional security
    const anomalyResult = await ipAnomalyDetection.checkLoginAnomaly(
      user._id.toString(),
      clientIp,
      userAgent
    );
    
    socket.security.anomalyChecked = true;
    socket.security.anomalyResult = anomalyResult;
    
    // Handle different anomaly levels with enhanced security
    if (anomalyResult.level === 'high') {
      logSocketSecurityEvent(user._id, socket, 'HIGH_RISK_ANOMALY', {
        reason: anomalyResult.reason,
        geo: anomalyResult.geo,
        level: anomalyResult.level,
        riskScore: anomalyResult.riskScore
      });
      
      // For high-risk anomalies with very high risk scores, reject connection
      if (anomalyResult.riskScore >= 85) {
        // Blacklist the token to force a full re-authentication
        try {
          const jti = decoded.jti;
          if (jti) {
            const tokenExpiry = decoded.exp ? decoded.exp * 1000 : Date.now() + 3600000;
            await blacklistToken(token, tokenExpiry);
          }
        } catch (err) {
          console.error('Error blacklisting high-risk token:', err);
        }
        
        clearTimeout(authTimeout);
        return next(new Error('Security alert: Unusual login location detected. Please log in again.'));
      }
      
      // For high risk but not critical, attach info for special handling
      socket.loginAnomaly = anomalyResult;
      socket.requireAdditionalAuth = true;
      socket.security.highRisk = true;
      
      // Apply per-socket restrictions for high-risk connections
      socket.security.messageRateLimit = 10; // 10 messages per minute
      socket.security.requireVerificationInterval = 10 * 60 * 1000; // Re-verify every 10 minutes
      socket.security.restrictedChannels = true; // Limit which channels they can join
    } 
    // For medium level anomalies, apply milder restrictions
    else if (anomalyResult.level === 'medium') {
      logSocketSecurityEvent(user._id, socket, 'MEDIUM_RISK_ANOMALY', {
        reason: anomalyResult.reason,
        geo: anomalyResult.geo,
        level: anomalyResult.level,
        riskScore: anomalyResult.riskScore
      });
      
      socket.loginAnomaly = anomalyResult;
      socket.security.mediumRisk = true;
      socket.security.messageRateLimit = 30; // 30 messages per minute
      socket.security.requireVerificationInterval = 30 * 60 * 1000; // Re-verify every 30 minutes
    }
    // For low level anomalies, just track and warn
    else if (anomalyResult.anomalous) {
      logSocketSecurityEvent(user._id, socket, 'LOW_RISK_ANOMALY', {
        reason: anomalyResult.reason,
        geo: anomalyResult.geo,
        level: anomalyResult.level,
        riskScore: anomalyResult.riskScore
      });
      
      socket.loginAnomaly = anomalyResult;
      socket.security.lowRisk = true;
    }
    
    // Track connection in session manager if available for comprehensive session management
    if (global.sessionManager && global.sessionManager.trackSocketSession) {
      global.sessionManager.trackSocketSession(user._id.toString(), socket.id, clientIp, userAgent);
    }
    
    // Check if user has exceeded maximum connections
    const currentSessions = global.sessionManager?.getActiveSessions(user._id.toString()) || [];
    const socketSessions = currentSessions.filter(s => s.isSocket);
    
    // Apply limits based on user role
    const socketLimit = user.role === 'admin' ? 20 : (user.role === 'moderator' ? 10 : 5);
    
    if (socketSessions.length > socketLimit) {
      logSocketSecurityEvent(user._id, socket, 'SOCKET_LIMIT_EXCEEDED', {
        current: socketSessions.length,
        limit: socketLimit
      });
      
      // For non-admin users, enforce the limit
      if (user.role !== 'admin') {
        clearTimeout(authTimeout);
        return next(new Error(`Maximum of ${socketLimit} socket connections allowed. Please close some connections.`));
      }
    }
    
    // Enhanced token and user data tracking
    socket.user = user;
    socket.token = token;
    socket.jti = decoded.jti;
    socket.authenticated = true;
    socket.connectedAt = new Date();
    socket.security.authenticated = true;
    socket.security.authenticatedAt = Date.now();
    socket.security.role = user.role;
    
    // Message rate tracking for DoS prevention
    socket.messageCount = 0;
    socket.lastMessageTime = Date.now();
    socket.messageRateLimit = socket.security.messageRateLimit || 60; // Default 60 per minute
    
    // Update user's last active timestamp
    await User.findByIdAndUpdate(user._id, { 
      lastActive: new Date(),
      lastActiveIp: clientIp
    });
    
    // Enhanced heartbeat system to detect dead connections with security checks
    socket.heartbeatInterval = setInterval(() => {
      // Check if socket is still connected
      if (socket.connected) {
        socket.emit('heartbeat', { timestamp: Date.now() });
        
        // Verify high-risk connections more frequently
        if (socket.security.highRisk && 
            Date.now() - socket.security.authenticatedAt > (socket.security.requireVerificationInterval || 600000)) {
          // Force re-verification
          socket.emit('require_reverification');
          socket.security.needsReverification = true;
          
          // Log reverification request
          logSocketSecurityEvent(user._id, socket, 'REVERIFICATION_REQUESTED', {
            reason: 'High risk connection periodic check',
            timeSinceAuth: (Date.now() - socket.security.authenticatedAt) / 1000
          });
        }
      } else {
        clearInterval(socket.heartbeatInterval);
      }
    }, 30000); // 30 second heartbeat
    
    // Log successful socket connection
    logSocketSecurityEvent(user._id, socket, 'LOGIN_SUCCESS', {
      connectionType: 'websocket',
      geo: anomalyResult.geo,
      anomalyLevel: anomalyResult.level || 'none',
      securityContext: {
        highRisk: socket.security.highRisk || false,
        mediumRisk: socket.security.mediumRisk || false,
        messageRateLimit: socket.messageRateLimit
      }
    });
    
    // Clear the authentication timeout
    clearTimeout(authTimeout);
    next();
  } catch (error) {
    // Clear the authentication timeout
    clearTimeout(authTimeout);
    
    console.error('Socket authentication error:', error);
    
    // Try to extract user ID if token is partially valid
    let userId = null;
    try {
      // Just decode without verification to get potential user ID
      const decoded = jwt.decode(socket.handshake.auth.token);
      userId = decoded ? decoded.id : null;
    } catch (e) {
      // Ignore errors in token decoding
    }
    
    // Enhanced error logging with token fingerprinting
    // We don't log the full token, but we can log a hash of it for tracking
    let tokenFingerprint = null;
    if (socket.handshake.auth.token) {
      try {
        tokenFingerprint = crypto.createHash('sha256')
          .update(socket.handshake.auth.token)
          .digest('hex')
          .substring(0, 16);
      } catch (e) {
        // Ignore fingerprinting errors
      }
    }
    
    // Enhanced security context for error tracking
    const securityContext = socket.security || {};
    
    logSocketSecurityEvent(userId, socket, 'AUTH_FAILURE', {
      error: error.message,
      tokenFingerprint: tokenFingerprint,
      errorType: error.name || 'Unknown',
      securityContext: {
        ipHash: securityContext.ipHash,
        connectedAt: securityContext.connectedAt,
        anomalyChecked: securityContext.anomalyChecked || false
      }
    });
    
    // Send appropriate error message based on error type with enhanced user feedback
    let errorMessage = 'Authentication error: Invalid token';
    let errorCode = 'INVALID_TOKEN';
    
    if (error.message.includes('expired')) {
      errorMessage = 'Session expired, please log in again';
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.message.includes('fingerprint')) {
      errorMessage = 'Security validation failed. Please log in again from this device.';
      errorCode = 'SECURITY_MISMATCH';
    } else if (error.message.includes('rate limit')) {
      errorMessage = 'Too many connection attempts. Please try again in a few minutes.';
      errorCode = 'RATE_LIMITED';
    } else if (error.message.includes('blacklisted') || error.message.includes('revoked')) {
      errorMessage = 'Your session was revoked. Please log in again.';
      errorCode = 'TOKEN_REVOKED';
    } else if (error.message.includes('verification failure')) {
      errorMessage = 'Device verification failed. For your security, please log in again.';
      errorCode = 'VERIFICATION_FAILED';
    } else if (error.message.includes('locked')) {
      errorMessage = 'Your account is locked. Please contact support.';
      errorCode = 'ACCOUNT_LOCKED';
    }
    
    // Add security error context
    const socketError = new Error(errorMessage);
    socketError.code = errorCode;
    
    return next(socketError);
  }
};

/**
 * Enhanced socket security event logging with structured data
 */
const logSocketSecurityEvent = async (userId, socket, eventType, details = {}) => {
  try {
    // Determine severity based on event type
    let severity = 'INFO';
    
    if (eventType.includes('FAILURE') || 
        eventType.includes('HIGH_RISK') || 
        eventType.includes('RATE_LIMIT')) {
      severity = 'WARNING';
    } else if (eventType.includes('POTENTIAL_ATTACK') ||
              eventType.includes('INJECT') ||
              eventType.includes('EXPLOIT')) {
      severity = 'ERROR';
    }
    
    // Sanitize the query object to avoid storing sensitive data
    const sanitizedQuery = socket.handshake.query ? 
      Object.fromEntries(
        Object.entries(socket.handshake.query)
          .filter(([key]) => !['token', 'authorization', 'password'].includes(key.toLowerCase()))
      ) : {};
    
    // Add connection details with additional context
    const connectionDetails = {
      socketId: socket.id,
      query: sanitizedQuery,
      transportType: socket.conn?.transport?.name || 'unknown',
      remotePort: socket.handshake.address ? socket.handshake.address.split(':').pop() : 'unknown',
      authenticated: socket.authenticated || false,
      connectedAt: socket.connectedAt ? socket.connectedAt.toISOString() : null,
      securityContext: socket.security || {}
    };
    
    // Create security audit record with enhanced details
    await new SecurityAudit({
      eventType,
      user: userId,
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
      details: {
        ...connectionDetails,
        ...details,
        timestamp: new Date().toISOString()
      },
      severity
    }).save();
  } catch (error) {
    console.error('Error logging socket security event:', error);
  }
};

/**
 * Enhanced middleware to authorize socket events based on user roles
 * with additional security checks
 */
const authorizeSocketEvent = async (socket, eventName, roles = ['user', 'moderator', 'admin']) => {
  // If not authenticated, deny access
  if (!socket.user || !socket.authenticated) {
    await logSocketSecurityEvent(null, socket, 'UNAUTHORIZED_EVENT_ATTEMPT', {
      eventName,
      reason: 'Not authenticated'
    });
    return { authorized: false, reason: 'NOT_AUTHENTICATED' };
  }
  
  // Check for user reverification needed
  if (socket.security?.needsReverification) {
    await logSocketSecurityEvent(socket.user._id, socket, 'REVERIFICATION_REQUIRED', {
      eventName,
      userRole: socket.user.role
    });
    return { authorized: false, reason: 'REVERIFICATION_REQUIRED' };
  }
  
  // Check for role-based access
  if (!roles.includes(socket.user.role)) {
    // Log unauthorized event attempt
    await logSocketSecurityEvent(socket.user._id, socket, 'UNAUTHORIZED_ACCESS', {
      eventName,
      userRole: socket.user.role,
      requiredRoles: roles
    });
    return { authorized: false, reason: 'INSUFFICIENT_ROLE' };
  }
  
  // Check for message rate limiting
  const now = Date.now();
  const timeSinceLastMessage = now - (socket.lastMessageTime || 0);
  const timeWindow = 60 * 1000; // 1 minute
  
  // Reset counter if it's been more than a minute
  if (timeSinceLastMessage > timeWindow) {
    socket.messageCount = 1;
    socket.lastMessageTime = now;
  } else {
    socket.messageCount++;
  }
  
  // Check if exceeding rate limit
  if (socket.messageCount > socket.messageRateLimit) {
    await logSocketSecurityEvent(socket.user._id, socket, 'MESSAGE_RATE_LIMIT_EXCEEDED', {
      eventName,
      messageCount: socket.messageCount,
      rateLimit: socket.messageRateLimit,
      timeWindow: '1 minute'
    });
    return { authorized: false, reason: 'RATE_LIMITED' };
  }
  
  // All checks passed
  return { authorized: true };
};

/**
 * Enhanced socket message validation
 */
const validateSocketMessage = (message, maxLength = 5000) => {
  // Check for empty messages
  if (!message || typeof message !== 'string') {
    return { valid: false, reason: 'INVALID_MESSAGE_FORMAT' };
  }
  
  // Check message length
  if (message.length > maxLength) {
    return { valid: false, reason: 'MESSAGE_TOO_LONG', limit: maxLength };
  }
  
  // Check for potentially dangerous content
  if (/<script\b[^>]*>[\s\S]*?<\/script>/gi.test(message)) {
    return { valid: false, reason: 'POTENTIAL_XSS' };
  }
  
  // Check for excessive special characters that might indicate an injection attack
  const specialCharsCount = (message.match(/[^\w\s]/g) || []).length;
  const specialCharRatio = specialCharsCount / message.length;
  
  if (specialCharRatio > 0.4 && message.length > 20) {
    return { valid: false, reason: 'SUSPICIOUS_CONTENT' };
  }
  
  return { valid: true };
};

module.exports = { 
  authenticateSocket,
  authorizeSocketEvent,
  logSocketSecurityEvent,
  validateSocketMessage
};