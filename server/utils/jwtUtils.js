const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET || 'jwt_fallback_secret',
    { expiresIn: '24h' }
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET || 'jwt_refresh_fallback_secret',
    { expiresIn: '7d' }
  );
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'jwt_fallback_secret');
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

// Generate a random token for email verification or password reset
const generateRandomToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  generateRandomToken
};