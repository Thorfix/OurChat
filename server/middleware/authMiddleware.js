const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('../utils/jwtUtils');
const { loginAttemptTracker, ipAnomalyDetection } = require('../utils/securityUtils');
const SecurityAudit = require('../models/SecurityAudit');

// Protect routes - verify JWT token with enhanced security
const protect = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token with enhanced security checks
      const decoded = verifyToken(token, req.ip, req.headers['user-agent']);

      // Get user from the token (exclude password)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        throw new Error('User not found');
      }

      // Check if user is active and not locked
      if (req.user.isLocked) {
        throw new Error('Account locked');
      }

      // Store the actual token for potential revocation
      req.token = token;

      // Add token expiry time to the request for session management
      if (decoded.exp) {
        req.tokenExpiry = new Date(decoded.exp * 1000);
      }

      // Check token version for migrations
      if (decoded.version && decoded.version !== '2.0') {
        console.warn(`Deprecated token version used: ${decoded.version}`);
      }

      // Update last active timestamp
      await User.findByIdAndUpdate(req.user._id, { lastActive: new Date() });

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

// Track authenticated sessions (for limiting concurrent sessions)
const sessionManager = (() => {
  // Map of userId -> array of active sessions
  const activeSessions = new Map();
  
  // Max concurrent sessions per user
  const MAX_SESSIONS = 5;
  
  return {
    trackSession: (userId, token, req, res, next) => {
      if (!userId || !token) return next();
      
      // Get current sessions for user
      const sessions = activeSessions.get(userId) || [];
      
      // Add this session
      sessions.push({
        token,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        createdAt: new Date()
      });
      
      // If user has too many sessions, remove oldest
      if (sessions.length > MAX_SESSIONS) {
        sessions.sort((a, b) => a.createdAt - b.createdAt);
        sessions.shift(); // Remove oldest session
      }
      
      activeSessions.set(userId, sessions);
      next();
    },
    
    getActiveSessions: (userId) => {
      return activeSessions.get(userId) || [];
    },
    
    removeSession: (userId, token) => {
      const sessions = activeSessions.get(userId);
      if (!sessions) return false;
      
      const newSessions = sessions.filter(s => s.token !== token);
      if (newSessions.length === sessions.length) return false;
      
      activeSessions.set(userId, newSessions);
      return true;
    },
    
    clearAllSessions: (userId) => {
      activeSessions.delete(userId);
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