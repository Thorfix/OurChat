const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('../utils/jwtUtils');
const { loginAttemptTracker, ipAnomalyDetection } = require('../utils/securityUtils');
const SecurityAudit = require('../models/SecurityAudit');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = verifyToken(token);

      // Get user from the token (exclude password)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        throw new Error('User not found');
      }

      // Store the actual token for potential revocation
      req.token = token;

      // Add token expiry time to the request for session management
      if (decoded.exp) {
        req.tokenExpiry = new Date(decoded.exp * 1000);
      }

      // Update last active timestamp
      await User.findByIdAndUpdate(req.user._id, { lastActive: new Date() });

      next();
    } catch (error) {
      console.error('Authentication error:', error.message);
      
      // Log security event
      try {
        await new SecurityAudit({
          eventType: 'AUTH_FAILURE',
          user: null, // Unknown user
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          details: {
            method: req.method,
            path: req.originalUrl,
            errorMessage: error.message,
            tokenPresent: !!token
          }
        }).save();
      } catch (logError) {
        console.error('Error logging security event:', logError);
      }
      
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token provided' });
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