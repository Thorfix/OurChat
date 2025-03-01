const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to authenticate Socket.io connections using JWT tokens
 */
const authenticateSocket = async (socket, next) => {
  try {
    // Get token from handshake auth object
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }
    
    // Verify token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'jwt_fallback_secret'
    );
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    
    // Attach user to socket
    socket.user = user;
    
    // Update last active timestamp
    await User.findByIdAndUpdate(user._id, { lastActive: new Date() });
    
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    return next(new Error('Authentication error: Invalid token'));
  }
};

module.exports = { authenticateSocket };