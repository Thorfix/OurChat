const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('../utils/jwtUtils');

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

      // Update last active timestamp
      await User.findByIdAndUpdate(req.user._id, { lastActive: new Date() });

      next();
    } catch (error) {
      console.error('Authentication error:', error.message);
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

module.exports = {
  protect,
  authorize,
  requireEmailVerification
};