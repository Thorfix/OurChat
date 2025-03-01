const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken, blacklistToken } = require('../utils/jwtUtils');
const { loginAttemptTracker, ipAnomalyDetection } = require('../utils/securityUtils');
const SecurityAudit = require('../models/SecurityAudit');

// Session timeout settings
const SESSION_IDLE_TIMEOUT = parseInt(process.env.SESSION_IDLE_TIMEOUT || 30) * 60 * 1000; // 30 minutes default

// Enhanced protect routes middleware with security features
const protect = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token with enhanced security checks - now async for better security features
      const decoded = await verifyToken(token, req.ip, req.headers['user-agent']);

      // Get user from the token (exclude password and sensitive fields)
      req.user = await User.findById(decoded.id).select('-password -securityQuestions -otpSecret');

      if (!req.user) {
        throw new Error('User not found');
      }

      // Check if user is active and not locked
      if (req.user.isLocked) {
        await SecurityAudit.create({
          eventType: 'ACCESS_ATTEMPT_LOCKED_ACCOUNT',
          user: decoded.id,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          details: {
            method: req.method,
            path: req.originalUrl
          },
          severity: 'WARNING'
        });
        throw new Error('Account locked');
      }

      // Enhanced session idle timeout check
      if (req.user.lastActive) {
        const idleTime = Date.now() - new Date(req.user.lastActive).getTime();
        
        // If user has been idle for too long, force re-authentication
        if (idleTime > SESSION_IDLE_TIMEOUT) {
          // Blacklist the current token
          if (decoded.exp) {
            await blacklistToken(token, decoded.exp * 1000);
          }
          
          await SecurityAudit.create({
            eventType: 'SESSION_IDLE_TIMEOUT',
            user: req.user._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: {
              idleTimeMinutes: Math.floor(idleTime / 60000),
              maxIdleMinutes: Math.floor(SESSION_IDLE_TIMEOUT / 60000)
            },
            severity: 'INFO'
          });
          
          throw new Error('Session expired due to inactivity');
        }
      }

      // Store token info for potential revocation and session management
      req.token = token;
      req.jti = decoded.jti;

      // Add token expiry time to the request for session management
      if (decoded.exp) {
        req.tokenExpiry = new Date(decoded.exp * 1000);
        
        // Warn if token is about to expire
        const timeToExpiry = decoded.exp * 1000 - Date.now();
        if (timeToExpiry < 60000) { // Less than a minute
          res.set('X-Token-Expiring', 'true');
          res.set('X-Token-Expires-In', Math.floor(timeToExpiry / 1000).toString());
        }
      }

      // Check token version for migrations
      if (decoded.version && decoded.version !== '2.0') {
        console.warn(`Deprecated token version used: ${decoded.version}`);
      }

      // Update last active timestamp
      await User.findByIdAndUpdate(req.user._id, { 
        lastActive: new Date(),
        lastActiveIp: req.ip
      });

      next();
    } catch (error) {
      console.error('Authentication error:', error.message);
      
      // Extract user ID from token if possible for better logging
      let userId = null;
      try {
        if (token) {
          const decoded = jwt.decode(token);
          userId = decoded ? decoded.id : null;
        }
      } catch (err) {
        // Ignore decode errors
      }
      
      // Log security event with enhanced details
      try {
        await SecurityAudit.create({
          eventType: 'AUTH_FAILURE',
          user: userId,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          details: {
            method: req.method,
            path: req.originalUrl,
            errorMessage: error.message,
            tokenPresent: !!token,
            endpoint: `${req.method} ${req.originalUrl}`,
            origin: req.headers.origin || 'unknown',
            referer: req.headers.referer
          },
          severity: 'WARNING'
        });
      } catch (logError) {
        console.error('Error logging security event:', logError);
      }
      
      // Different error message based on the type of error
      let message = 'Authentication failed';
      if (error.message.includes('expired')) {
        message = 'Session expired, please log in again';
      } else if (error.message.includes('fingerprint')) {
        message = 'Security validation failed, please log in again';
      } else if (error.message.includes('Account locked')) {
        message = 'Account locked, please contact support';
      }
      
      res.status(401).json({ message, code: 'AUTH_FAILED' });
      return;
    }
  } else {
    // No Bearer token found, check if token might be in cookies for non-API routes
    token = req.cookies?.token;
    
    if (token) {
      return res.status(400).json({ 
        message: 'Invalid authentication method, use Authorization header',
        code: 'INVALID_AUTH_METHOD' 
      });
    }
    
    // Log missing token
    try {
      await SecurityAudit.create({
        eventType: 'AUTH_FAILURE',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          method: req.method,
          path: req.originalUrl,
          errorMessage: 'No token provided',
          endpoint: `${req.method} ${req.originalUrl}`,
          origin: req.headers.origin || 'unknown',
          referer: req.headers.referer
        },
        severity: 'INFO'
      });
    } catch (logError) {
      console.error('Error logging security event:', logError);
    }
    
    res.status(401).json({ message: 'Authentication required', code: 'NO_TOKEN' });
    return;
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (!roles.includes(req.user.role)) {
      // Log unauthorized access attempt
      try {
        new SecurityAudit({
          eventType: 'UNAUTHORIZED_ACCESS',
          user: req.user._id,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          details: {
            method: req.method,
            path: req.originalUrl,
            userRole: req.user.role,
            requiredRoles: roles
          }
        }).save();
      } catch (logError) {
        console.error('Error logging security event:', logError);
      }
      
      return res.status(403).json({
        message: `Role ${req.user.role} is not authorized to access this resource`
      });
    }
    
    next();
  };
};

// Email verification middleware
const requireEmailVerification = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({ message: 'Email verification required' });
  }
  next();
};

// Check for IP-based login anomalies
const checkLoginAnomaly = async (req, res, next) => {
  const { user } = req;
  if (!user) return next();
  
  const anomalyResult = ipAnomalyDetection.checkLoginAnomaly(
    user._id.toString(),
    req.ip,
    req.headers['user-agent']
  );
  
  if (anomalyResult.anomalous) {
    // Log the anomalous login
    try {
      await new SecurityAudit({
        eventType: 'ANOMALOUS_LOGIN',
        user: user._id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          reason: anomalyResult.reason,
          knownIpCount: anomalyResult.knownIpCount
        }
      }).save();
    } catch (error) {
      console.error('Error logging security event:', error);
    }
    
    // Attach info to request but don't block (could escalate to requiring 2FA)
    req.loginAnomaly = anomalyResult;
  }
  
  next();
};

// Enhanced session manager with device tracking
const sessionManager = (() => {
  // Map of userId -> array of active sessions
  const activeSessions = new Map();
  
  // Map of userId -> location/device tracking
  const deviceTracking = new Map();
  
  // Max concurrent sessions per user (can be adjusted per user role)
  const getMaxSessions = (userRole) => {
    switch (userRole) {
      case 'admin': 
        return parseInt(process.env.MAX_ADMIN_SESSIONS || '10');
      case 'moderator':
        return parseInt(process.env.MAX_MODERATOR_SESSIONS || '8');
      default:
        return parseInt(process.env.MAX_USER_SESSIONS || '5');
    }
  };
  
  // Clean up expired sessions periodically
  setInterval(() => {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [userId, sessions] of activeSessions.entries()) {
      const validSessions = sessions.filter(s => !s.expiresAt || s.expiresAt > now);
      
      if (validSessions.length !== sessions.length) {
        expiredCount += (sessions.length - validSessions.length);
        activeSessions.set(userId, validSessions);
      }
    }
    
    if (expiredCount > 0) {
      console.log(`Session cleanup: removed ${expiredCount} expired sessions`);
    }
  }, 30 * 60 * 1000); // Run every 30 minutes
  
  return {
    trackSession: (userId, token, req, res, next) => {
      if (!userId || !token) return next();
      
      // Get user from request if available to check role
      const userRole = req.user?.role || 'user';
      const MAX_SESSIONS = getMaxSessions(userRole);
      
      // Get current sessions for user
      const sessions = activeSessions.get(userId) || [];
      
      // Extract jti if available for better tracking
      let jti = req.jti || null;
      
      // If no jti available, try to extract from token
      if (!jti) {
        try {
          const decoded = jwt.decode(token);
          jti = decoded?.jti;
        } catch (err) {
          // Ignore decode errors
        }
      }
      
      // Generate session fingerprint for device tracking
      const fingerprint = crypto.createHash('sha256')
        .update(`${req.ip}:${req.headers['user-agent'] || 'unknown'}`)
        .digest('hex');
      
      // Track device/location information
      const deviceInfo = deviceTracking.get(userId) || {};
      
      if (!deviceInfo[fingerprint]) {
        // New device/location, add to tracking
        deviceInfo[fingerprint] = {
          firstSeen: new Date(),
          lastSeen: new Date(),
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          count: 1,
          sessions: [jti]
        };
      } else {
        // Update existing device tracking
        deviceInfo[fingerprint].lastSeen = new Date();
        deviceInfo[fingerprint].count++;
        if (jti && !deviceInfo[fingerprint].sessions.includes(jti)) {
          deviceInfo[fingerprint].sessions.push(jti);
          
          // Keep only recent sessions
          if (deviceInfo[fingerprint].sessions.length > 10) {
            deviceInfo[fingerprint].sessions.shift();
          }
        }
      }
      
      deviceTracking.set(userId, deviceInfo);
      
      // Add this session with additional metadata
      sessions.push({
        token,
        jti,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        createdAt: new Date(),
        expiresAt: req.tokenExpiry || null,
        fingerprint
      });
      
      // If user has too many sessions, remove oldest
      if (sessions.length > MAX_SESSIONS) {
        sessions.sort((a, b) => a.createdAt - b.createdAt);
        
        // Get token of oldest session for logging
        const oldestSession = sessions.shift();
        
        // Log that we're terminating the oldest session
        try {
          SecurityAudit.create({
            eventType: 'SESSION_LIMIT_REACHED',
            user: userId,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: {
              maxSessions: MAX_SESSIONS,
              removedSessionAge: Date.now() - oldestSession.createdAt,
              removedSessionIp: oldestSession.ip
            },
            severity: 'INFO'
          });
        } catch (error) {
          console.error('Failed to log session limit:', error);
        }
      }
      
      activeSessions.set(userId, sessions);
      next();
    },
    
    getActiveSessions: (userId) => {
      const sessions = activeSessions.get(userId) || [];
      
      // Filter out expired sessions
      const now = Date.now();
      return sessions.filter(s => !s.expiresAt || s.expiresAt > now);
    },
    
    getDeviceHistory: (userId) => {
      const devices = deviceTracking.get(userId) || {};
      
      // Convert to array and add fingerprint
      return Object.entries(devices).map(([fingerprint, data]) => ({
        ...data,
        fingerprint: fingerprint.substring(0, 8) // Only return partial fingerprint for privacy
      }));
    },
    
    removeSession: (userId, token) => {
      const sessions = activeSessions.get(userId);
      if (!sessions) return false;
      
      // Find the session to remove
      const sessionToRemove = sessions.find(s => s.token === token);
      if (!sessionToRemove) return false;
      
      // Update sessions list
      const newSessions = sessions.filter(s => s.token !== token);
      activeSessions.set(userId, newSessions);
      
      // Update device tracking if we have jti
      if (sessionToRemove.jti) {
        const deviceInfo = deviceTracking.get(userId) || {};
        
        // Remove this jti from all device fingerprints
        for (const [fingerprint, data] of Object.entries(deviceInfo)) {
          if (data.sessions.includes(sessionToRemove.jti)) {
            data.sessions = data.sessions.filter(j => j !== sessionToRemove.jti);
          }
        }
        
        deviceTracking.set(userId, deviceInfo);
      }
      
      return true;
    },
    
    clearAllSessions: (userId) => {
      activeSessions.delete(userId);
      // Keep device tracking for security audit purposes
    },
    
    // Track WebSocket connections too
    trackSocketSession: (userId, socketId, ip, userAgent) => {
      const sessions = activeSessions.get(userId) || [];
      
      // Generate session fingerprint
      const fingerprint = crypto.createHash('sha256')
        .update(`${ip}:${userAgent || 'unknown'}`)
        .digest('hex');
      
      // Add socket session
      sessions.push({
        socketId,
        ip,
        userAgent,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hour default for sockets
        isSocket: true,
        fingerprint
      });
      
      activeSessions.set(userId, sessions);
      
      // Update device tracking
      const deviceInfo = deviceTracking.get(userId) || {};
      
      if (!deviceInfo[fingerprint]) {
        deviceInfo[fingerprint] = {
          firstSeen: new Date(),
          lastSeen: new Date(),
          ip,
          userAgent,
          count: 1,
          sessions: [socketId]
        };
      } else {
        deviceInfo[fingerprint].lastSeen = new Date();
        deviceInfo[fingerprint].count++;
        if (!deviceInfo[fingerprint].sessions.includes(socketId)) {
          deviceInfo[fingerprint].sessions.push(socketId);
        }
      }
      
      deviceTracking.set(userId, deviceInfo);
    }
  };
})();

// Track session for the user
const trackSession = (req, res, next) => {
  if (!req.user || !req.token) return next();
  
  sessionManager.trackSession(req.user._id.toString(), req.token, req, res, next);
};

module.exports = {
  protect,
  authorize,
  requireEmailVerification,
  checkLoginAnomaly,
  sessionManager,
  trackSession
};