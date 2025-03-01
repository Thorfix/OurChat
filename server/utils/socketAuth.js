const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('./jwtUtils');
const { ipAnomalyDetection } = require('./securityUtils');
const SecurityAudit = require('../models/SecurityAudit');

/**
 * Middleware to authenticate Socket.io connections using JWT tokens
 */
const authenticateSocket = async (socket, next) => {
  try {
    // Get token from handshake auth object
    const token = socket.handshake.auth.token;
    
    if (!token) {
      logSocketSecurityEvent(null, socket, 'AUTH_FAILURE', {
        reason: 'No token provided'
      });
      return next(new Error('Authentication error: Token required'));
    }
    
    // Verify token
    const decoded = verifyToken(token);
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      logSocketSecurityEvent(decoded.id, socket, 'AUTH_FAILURE', {
        reason: 'User not found'
      });
      return next(new Error('Authentication error: User not found'));
    }
    
    // Check for email verification if required
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.isEmailVerified) {
      logSocketSecurityEvent(user._id, socket, 'AUTH_FAILURE', {
        reason: 'Email not verified'
      });
      return next(new Error('Authentication error: Email verification required'));
    }
    
    // Check for IP-based anomalies
    const clientIp = socket.handshake.address;
    const anomalyResult = ipAnomalyDetection.checkLoginAnomaly(
      user._id.toString(),
      clientIp,
      socket.handshake.headers['user-agent']
    );
    
    if (anomalyResult.anomalous) {
      // Log the anomaly but don't block connection - just attach the info
      logSocketSecurityEvent(user._id, socket, 'ANOMALOUS_LOGIN', {
        reason: anomalyResult.reason,
        knownIpCount: anomalyResult.knownIpCount
      });
      socket.loginAnomaly = anomalyResult;
    }
    
    // Attach user to socket
    socket.user = user;
    socket.token = token;
    
    // Update last active timestamp
    await User.findByIdAndUpdate(user._id, { lastActive: new Date() });
    
    // Log successful socket connection
    logSocketSecurityEvent(user._id, socket, 'LOGIN_SUCCESS', {
      connectionType: 'websocket'
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
    
    logSocketSecurityEvent(userId, socket, 'AUTH_FAILURE', {
      error: error.message
    });
    
    return next(new Error('Authentication error: Invalid token'));
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