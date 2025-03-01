const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('./jwtUtils');
const { ipAnomalyDetection } = require('./securityUtils');
const SecurityAudit = require('../models/SecurityAudit');

/**
 * Enhanced middleware to authenticate Socket.io connections with comprehensive security
 */
const authenticateSocket = async (socket, next) => {
  try {
    // Get token from handshake auth object
    const token = socket.handshake.auth.token;
    const clientIp = socket.handshake.address;
    const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
    
    if (!token) {
      logSocketSecurityEvent(null, socket, 'AUTH_FAILURE', {
        reason: 'No token provided'
      });
      return next(new Error('Authentication error: Token required'));
    }
    
    // Rate limiting - check for too many connection attempts from same IP
    const connectionKey = `ws:${clientIp}`;
    
    // Simple in-memory rate limiter for socket connections
    if (!global.socketRateLimiter) {
      global.socketRateLimiter = new Map();
    }
    
    const now = Date.now();
    const rateLimitWindow = 60 * 1000; // 1 minute
    const maxConnectionsPerWindow = 50;
    
    const limitData = global.socketRateLimiter.get(connectionKey) || {
      count: 0,
      resetAt: now + rateLimitWindow
    };
    
    // If window expired, reset counter
    if (now > limitData.resetAt) {
      limitData.count = 0;
      limitData.resetAt = now + rateLimitWindow;
    }
    
    limitData.count++;
    global.socketRateLimiter.set(connectionKey, limitData);
    
    // If too many connections, reject
    if (limitData.count > maxConnectionsPerWindow) {
      logSocketSecurityEvent(null, socket, 'RATE_LIMIT_EXCEEDED', {
        count: limitData.count,
        window: 'last minute',
        connectionType: 'websocket'
      });
      return next(new Error('Too many connection attempts. Please try again later.'));
    }
    
    // Verify token with enhanced security - include IP & user agent for fingerprint verification
    const decoded = verifyToken(token, clientIp, userAgent);
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      logSocketSecurityEvent(decoded.id, socket, 'AUTH_FAILURE', {
        reason: 'User not found'
      });
      return next(new Error('Authentication error: User not found'));
    }
    
    // Check if account is locked
    if (user.isLocked) {
      logSocketSecurityEvent(user._id, socket, 'AUTH_FAILURE', {
        reason: 'Account locked'
      });
      return next(new Error('Authentication error: Account locked'));
    }
    
    // Check for required user verification status (email, etc)
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.isEmailVerified) {
      logSocketSecurityEvent(user._id, socket, 'AUTH_FAILURE', {
        reason: 'Email not verified'
      });
      return next(new Error('Authentication error: Email verification required'));
    }
    
    // Check for IP-based anomalies - enhanced with geo-location data
    const anomalyResult = await ipAnomalyDetection.checkLoginAnomaly(
      user._id.toString(),
      clientIp,
      userAgent
    );
    
    // If high-level anomaly detected, potentially reject connection or require re-authentication
    if (anomalyResult.level === 'high') {
      logSocketSecurityEvent(user._id, socket, 'HIGH_RISK_ANOMALY', {
        reason: anomalyResult.reason,
        geo: anomalyResult.geo,
        level: anomalyResult.level
      });
      
      // For high-risk anomalies, we could reject the connection
      // Uncomment below to enforce this security measure
      // return next(new Error('Security alert: Unusual login location detected. Please log in again.'));
      
      // Instead of rejecting, attach anomaly info to socket for special handling
      socket.loginAnomaly = anomalyResult;
      socket.requireReauth = true;
    } 
    // For medium level anomalies, just track and warn
    else if (anomalyResult.anomalous) {
      logSocketSecurityEvent(user._id, socket, 'ANOMALOUS_LOGIN', {
        reason: anomalyResult.reason,
        geo: anomalyResult.geo,
        level: anomalyResult.level
      });
      socket.loginAnomaly = anomalyResult;
    }
    
    // Track connection in session manager if available
    if (global.sessionManager && global.sessionManager.trackSocketSession) {
      global.sessionManager.trackSocketSession(user._id.toString(), socket.id, clientIp, userAgent);
    }
    
    // Attach user and auth data to socket
    socket.user = user;
    socket.token = token;
    socket.authenticated = true;
    socket.connectedAt = new Date();
    
    // Update user's last active timestamp
    await User.findByIdAndUpdate(user._id, { lastActive: new Date() });
    
    // Attach heartbeat system to detect dead connections
    socket.heartbeatInterval = setInterval(() => {
      // Check if socket is still connected
      if (socket.connected) {
        socket.emit('heartbeat');
      } else {
        clearInterval(socket.heartbeatInterval);
      }
    }, 30000); // 30 second heartbeat
    
    // Log successful socket connection
    logSocketSecurityEvent(user._id, socket, 'LOGIN_SUCCESS', {
      connectionType: 'websocket',
      geo: anomalyResult.geo
    });
    
    next();
  } catch (error) {
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
    
    logSocketSecurityEvent(userId, socket, 'AUTH_FAILURE', {
      error: error.message,
      tokenFingerprint: tokenFingerprint,
      errorType: error.name || 'Unknown'
    });
    
    // Send appropriate error message based on error type
    let errorMessage = 'Authentication error: Invalid token';
    if (error.message.includes('expired')) {
      errorMessage = 'Session expired, please log in again';
    } else if (error.message.includes('fingerprint')) {
      errorMessage = 'Security validation failed';
    } else if (error.message.includes('rate limit')) {
      errorMessage = 'Too many connection attempts';
    }
    
    return next(new Error(errorMessage));
  }
};

/**
 * Log socket security events
 */
const logSocketSecurityEvent = async (userId, socket, eventType, details = {}) => {
  try {
    await new SecurityAudit({
      eventType,
      user: userId,
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
      details: {
        socketId: socket.id,
        query: socket.handshake.query,
        ...details
      },
      severity: eventType.includes('FAILURE') || eventType.includes('ANOMALOUS') ? 'WARNING' : 'INFO'
    }).save();
  } catch (error) {
    console.error('Error logging socket security event:', error);
  }
};

/**
 * Middleware to authorize socket events based on user roles
 */
const authorizeSocketEvent = (socket, eventName, roles = ['user', 'moderator', 'admin']) => {
  if (!socket.user) {
    return false;
  }
  
  if (!roles.includes(socket.user.role)) {
    // Log unauthorized event attempt
    logSocketSecurityEvent(socket.user._id, socket, 'UNAUTHORIZED_ACCESS', {
      eventName,
      userRole: socket.user.role,
      requiredRoles: roles
    });
    return false;
  }
  
  return true;
};

module.exports = { 
  authenticateSocket,
  authorizeSocketEvent,
  logSocketSecurityEvent
};