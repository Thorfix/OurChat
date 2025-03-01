const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// In-memory token blacklist (consider Redis for production)
const tokenBlacklist = new Set();
const refreshTokens = new Map();

// Clean up expired tokens from blacklist periodically
setInterval(() => {
  for (const token of tokenBlacklist) {
    try {
      jwt.verify(token, process.env.JWT_SECRET || 'jwt_fallback_secret');
    } catch (err) {
      // If verification fails due to expiration, remove from blacklist
      if (err instanceof jwt.TokenExpiredError) {
        tokenBlacklist.delete(token);
      }
    }
  }
}, 60 * 60 * 1000); // Run every hour

// Generate JWT Token with unique identifier
const generateToken = (user, jti = crypto.randomBytes(16).toString('hex')) => {
  return jwt.sign(
    { 
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      jti // JWT ID for token revocation
    },
    process.env.JWT_SECRET || 'jwt_fallback_secret',
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      audience: process.env.JWT_AUDIENCE || 'retrochat-users',
      issuer: process.env.JWT_ISSUER || 'retrochat-api'
    }
  );
};

// Generate refresh token with family for rotation
const generateRefreshToken = (userId, family = crypto.randomBytes(16).toString('hex')) => {
  const jti = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign(
    { 
      id: userId,
      jti,
      family // Used to invalidate all refresh tokens in a family when rotated
    },
    process.env.JWT_REFRESH_SECRET || 'jwt_refresh_fallback_secret',
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      audience: process.env.JWT_AUDIENCE || 'retrochat-users',
      issuer: process.env.JWT_ISSUER || 'retrochat-api'
    }
  );
  
  // Store refresh token metadata
  refreshTokens.set(jti, {
    userId,
    family,
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days in milliseconds
  });
  
  return { token, family };
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      throw new Error('Token has been revoked');
    }
    
    return jwt.verify(token, process.env.JWT_SECRET || 'jwt_fallback_secret');
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(
      token, 
      process.env.JWT_REFRESH_SECRET || 'jwt_refresh_fallback_secret'
    );
    
    // Check if the token is in our stored refresh tokens
    const tokenData = refreshTokens.get(decoded.jti);
    if (!tokenData) {
      throw new Error('Refresh token not found');
    }
    
    // Check if token is expired in our records
    if (tokenData.expiresAt < Date.now()) {
      refreshTokens.delete(decoded.jti);
      throw new Error('Refresh token expired');
    }
    
    return decoded;
  } catch (error) {
    throw new Error(`Invalid refresh token: ${error.message}`);
  }
};

// Rotate refresh token (and invalidate old family if breach suspected)
const rotateRefreshToken = (oldToken, invalidateFamily = false) => {
  try {
    const decoded = verifyRefreshToken(oldToken);
    
    // Get the token family
    const tokenData = refreshTokens.get(decoded.jti);
    
    // Delete the used token
    refreshTokens.delete(decoded.jti);
    
    // If we suspect token theft, invalidate all tokens in the family
    if (invalidateFamily) {
      for (const [jti, data] of refreshTokens.entries()) {
        if (data.family === tokenData.family) {
          refreshTokens.delete(jti);
        }
      }
      
      // Generate a completely new family
      return generateRefreshToken(decoded.id);
    }
    
    // Otherwise, create a new token in the same family
    return generateRefreshToken(decoded.id, tokenData.family);
  } catch (error) {
    throw new Error(`Refresh token rotation failed: ${error.message}`);
  }
};

// Revoke a specific token
const revokeToken = (token) => {
  try {
    // Verify the token first to ensure it's valid
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwt_fallback_secret');
    
    // Add to blacklist only if it's not expired yet
    tokenBlacklist.add(token);
    
    return true;
  } catch (error) {
    // If token is already expired, no need to revoke
    if (error instanceof jwt.TokenExpiredError) {
      return true;
    }
    return false;
  }
};

// Revoke all refresh tokens for a user
const revokeAllUserTokens = (userId) => {
  // Delete all refresh tokens for this user
  for (const [jti, data] of refreshTokens.entries()) {
    if (data.userId === userId) {
      refreshTokens.delete(jti);
    }
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
  verifyRefreshToken,
  rotateRefreshToken,
  revokeToken,
  revokeAllUserTokens,
  generateRandomToken
};