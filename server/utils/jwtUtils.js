const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const SecurityAudit = require('../models/SecurityAudit');

// In-memory token blacklist (consider Redis for production)
const tokenBlacklist = new Set();
const refreshTokens = new Map();
const tokenUsageLog = new Map(); // Track token usage for anomaly detection

// Enhanced token blacklist cleaner with statistics
const blacklistCleaner = () => {
  let expiredCount = 0;
  let remainingCount = 0;
  
  for (const token of tokenBlacklist) {
    try {
      jwt.verify(token, process.env.JWT_SECRET || 'jwt_fallback_secret');
      remainingCount++;
    } catch (err) {
      // If verification fails due to expiration, remove from blacklist
      if (err instanceof jwt.TokenExpiredError) {
        tokenBlacklist.delete(token);
        expiredCount++;
      } else {
        remainingCount++;
      }
    }
  }
  
  // Log token cleanup statistics
  console.log(`Token cleanup: removed ${expiredCount} expired tokens, ${remainingCount} active tokens remain`);
};

// Clean up expired tokens from blacklist periodically
setInterval(blacklistCleaner, 60 * 60 * 1000); // Run every hour

// Clean up expired refresh tokens
setInterval(() => {
  const now = Date.now();
  let expiredCount = 0;
  
  for (const [jti, data] of refreshTokens.entries()) {
    if (data.expiresAt < now) {
      refreshTokens.delete(jti);
      expiredCount++;
    }
  }
  
  if (expiredCount > 0) {
    console.log(`Refresh token cleanup: removed ${expiredCount} expired tokens`);
  }
}, 12 * 60 * 60 * 1000); // Run every 12 hours

// Track token usage for security
const logTokenUsage = async (tokenId, userId, ipAddress, userAgent, isRefresh = false) => {
  try {
    // Get user's token usage log
    const userLog = tokenUsageLog.get(userId) || [];
    
    // Add new entry
    userLog.push({
      tokenId,
      timestamp: Date.now(),
      ipAddress,
      userAgent,
      isRefresh
    });
    
    // Keep only the last 20 entries
    if (userLog.length > 20) {
      userLog.shift();
    }
    
    tokenUsageLog.set(userId, userLog);
    
    // Check for suspicious activity (multiple IPs in short time)
    if (userLog.length >= 3) {
      const recentLogs = userLog.slice(-3);
      const uniqueIPs = new Set(recentLogs.map(entry => entry.ipAddress));
      
      // If 3 different IPs in last 3 usages, log suspicious activity
      if (uniqueIPs.size >= 3) {
        await SecurityAudit.create({
          eventType: 'SUSPICIOUS_TOKEN_USAGE',
          user: userId,
          ip: ipAddress,
          userAgent,
          details: {
            tokenId,
            uniqueIPs: Array.from(uniqueIPs),
            isRefresh,
            recentUsage: recentLogs.map(log => ({
              ip: log.ipAddress,
              timestamp: new Date(log.timestamp).toISOString()
            }))
          },
          severity: 'WARNING'
        });
      }
    }
  } catch (error) {
    console.error('Error logging token usage:', error);
  }
};

// Generate JWT Token with enhanced security
const generateToken = (user, jti = crypto.randomBytes(16).toString('hex'), ipAddress = null, userAgent = null) => {
  // Add fingerprint to prevent token reuse across devices
  const fingerprint = ipAddress && userAgent ? 
    crypto.createHash('sha256').update(`${ipAddress}:${userAgent}`).digest('hex').substring(0, 8) : 
    undefined;
  
  const token = jwt.sign(
    { 
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      jti, // JWT ID for token revocation
      fingerprint, // Optional device fingerprint
      version: '2.0' // Token version for future upgrades
    },
    process.env.JWT_SECRET || 'jwt_fallback_secret',
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '15m', // Shorter lived tokens for better security
      audience: process.env.JWT_AUDIENCE || 'retrochat-users',
      issuer: process.env.JWT_ISSUER || 'retrochat-api',
      notBefore: 0 // Token valid immediately
    }
  );
  
  // Log token generation for security auditing
  if (ipAddress && userAgent) {
    logTokenUsage(jti, user._id, ipAddress, userAgent, false);
  }
  
  return token;
};

// Generate refresh token with enhanced family rotation
const generateRefreshToken = (userId, family = crypto.randomBytes(16).toString('hex'), ipAddress = null, userAgent = null) => {
  const jti = crypto.randomBytes(16).toString('hex');
  
  // Calculate token expiry
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  const expiryMs = expiresIn.endsWith('d') ? 
    parseInt(expiresIn) * 24 * 60 * 60 * 1000 : 
    expiresIn.endsWith('h') ? 
      parseInt(expiresIn) * 60 * 60 * 1000 :
      7 * 24 * 60 * 60 * 1000; // Default 7 days
      
  const expiresAt = Date.now() + expiryMs;
  
  // Add fingerprint to prevent token reuse across devices
  const fingerprint = ipAddress && userAgent ? 
    crypto.createHash('sha256').update(`${ipAddress}:${userAgent}`).digest('hex').substring(0, 8) : 
    undefined;
  
  const token = jwt.sign(
    { 
      id: userId,
      jti,
      family, // Used to invalidate all refresh tokens in a family when rotated
      fingerprint, // Optional device fingerprint 
      version: '2.0' // Token version for future upgrades
    },
    process.env.JWT_REFRESH_SECRET || 'jwt_refresh_fallback_secret',
    { 
      expiresIn,
      audience: process.env.JWT_AUDIENCE || 'retrochat-users',
      issuer: process.env.JWT_ISSUER || 'retrochat-api',
      notBefore: 0 // Token valid immediately
    }
  );
  
  // Store refresh token metadata with enhanced tracking
  refreshTokens.set(jti, {
    userId,
    family,
    fingerprint,
    expiresAt,
    createdAt: Date.now(),
    lastUsed: Date.now(),
    timesUsed: 0,
    ipCreated: ipAddress,
    uaCreated: userAgent
  });
  
  // Log refresh token generation
  if (ipAddress && userAgent) {
    logTokenUsage(jti, userId, ipAddress, userAgent, true);
  }
  
  return { token, family, expiresAt: new Date(expiresAt).toISOString() };
};

// Verify JWT token with enhanced security checks
const verifyToken = (token, ipAddress = null, userAgent = null) => {
  try {
    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      throw new Error('Token has been revoked');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwt_fallback_secret', {
      audience: process.env.JWT_AUDIENCE || 'retrochat-users',
      issuer: process.env.JWT_ISSUER || 'retrochat-api',
      complete: true // Get full decoded token with header and payload
    });
    
    // Verify token version is supported
    if (decoded.payload.version && decoded.payload.version !== '2.0') {
      throw new Error('Unsupported token version');
    }
    
    // Verify fingerprint if present
    if (decoded.payload.fingerprint && ipAddress && userAgent) {
      const currentFingerprint = crypto.createHash('sha256')
        .update(`${ipAddress}:${userAgent}`)
        .digest('hex')
        .substring(0, 8);
        
      if (decoded.payload.fingerprint !== currentFingerprint) {
        // Log potential token stealing
        SecurityAudit.create({
          eventType: 'TOKEN_FINGERPRINT_MISMATCH',
          user: decoded.payload.id,
          ip: ipAddress,
          userAgent,
          details: {
            jti: decoded.payload.jti,
            expectedFingerprint: decoded.payload.fingerprint,
            actualFingerprint: currentFingerprint
          },
          severity: 'WARNING'
        }).catch(err => console.error('Failed to log fingerprint mismatch:', err));
        
        throw new Error('Token fingerprint mismatch');
      }
    }
    
    // Log token usage for security auditing
    if (ipAddress && userAgent && decoded.payload.id && decoded.payload.jti) {
      logTokenUsage(decoded.payload.jti, decoded.payload.id, ipAddress, userAgent, false);
    }
    
    return decoded.payload;
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }
};

// Verify refresh token with enhanced security and fraud detection
const verifyRefreshToken = (token, ipAddress = null, userAgent = null, checkReuse = true) => {
  try {
    const decoded = jwt.verify(
      token, 
      process.env.JWT_REFRESH_SECRET || 'jwt_refresh_fallback_secret',
      {
        audience: process.env.JWT_AUDIENCE || 'retrochat-users',
        issuer: process.env.JWT_ISSUER || 'retrochat-api',
        complete: true
      }
    );
    
    // Check if the token is in our stored refresh tokens
    const tokenData = refreshTokens.get(decoded.payload.jti);
    if (!tokenData) {
      // This might be a token reuse attempt if the JTI is valid format but not found
      if (decoded.payload.jti && decoded.payload.jti.length === 32) {
        // Log potential token reuse
        SecurityAudit.create({
          eventType: 'REFRESH_TOKEN_REUSE_ATTEMPT',
          user: decoded.payload.id,
          ip: ipAddress,
          userAgent,
          details: {
            jti: decoded.payload.jti,
            family: decoded.payload.family
          },
          severity: 'WARNING'
        }).catch(err => console.error('Failed to log token reuse:', err));
        
        // Invalidate all tokens in the family if ID format is valid
        if (decoded.payload.family && checkReuse) {
          for (const [jti, data] of refreshTokens.entries()) {
            if (data.family === decoded.payload.family) {
              refreshTokens.delete(jti);
            }
          }
        }
      }
      throw new Error('Refresh token not found or revoked');
    }
    
    // Check if token is expired in our records
    if (tokenData.expiresAt < Date.now()) {
      refreshTokens.delete(decoded.payload.jti);
      throw new Error('Refresh token expired');
    }
    
    // Verify fingerprint if present
    if (decoded.payload.fingerprint && ipAddress && userAgent) {
      const currentFingerprint = crypto.createHash('sha256')
        .update(`${ipAddress}:${userAgent}`)
        .digest('hex')
        .substring(0, 8);
        
      if (decoded.payload.fingerprint !== currentFingerprint) {
        // Log potential token stealing and invalidate entire family
        SecurityAudit.create({
          eventType: 'REFRESH_TOKEN_FINGERPRINT_MISMATCH',
          user: decoded.payload.id,
          ip: ipAddress,
          userAgent,
          details: {
            jti: decoded.payload.jti,
            family: decoded.payload.family,
            expectedFingerprint: decoded.payload.fingerprint,
            actualFingerprint: currentFingerprint
          },
          severity: 'WARNING'
        }).catch(err => console.error('Failed to log fingerprint mismatch:', err));
        
        // Invalidate all tokens in the family
        if (checkReuse) {
          for (const [jti, data] of refreshTokens.entries()) {
            if (data.family === tokenData.family) {
              refreshTokens.delete(jti);
            }
          }
        }
        
        throw new Error('Refresh token fingerprint mismatch');
      }
    }
    
    // Update token usage data
    tokenData.lastUsed = Date.now();
    tokenData.timesUsed += 1;
    if (ipAddress) tokenData.lastIp = ipAddress;
    if (userAgent) tokenData.lastUa = userAgent;
    refreshTokens.set(decoded.payload.jti, tokenData);
    
    // Log token usage for security auditing
    if (ipAddress && userAgent && decoded.payload.id) {
      logTokenUsage(decoded.payload.jti, decoded.payload.id, ipAddress, userAgent, true);
    }
    
    return decoded.payload;
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    } else if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expired');
    } else {
      throw new Error(`Refresh token verification failed: ${error.message}`);
    }
  }
};

// Rotate refresh token with enhanced security
const rotateRefreshToken = (oldToken, ipAddress = null, userAgent = null, invalidateFamily = false) => {
  try {
    const decoded = verifyRefreshToken(oldToken, ipAddress, userAgent, false); // Verify without auto invalidation
    
    // Get the token family
    const tokenData = refreshTokens.get(decoded.jti);
    
    // Check for excessive use (more than expected within timeframe)
    const tokenAge = Date.now() - tokenData.createdAt;
    const expectedMaxUses = Math.floor(tokenAge / (12 * 60 * 60 * 1000)) + 1; // Expect usage every ~12 hours + 1 initial use
    
    // If token used too frequently, consider it suspicious
    if (tokenData.timesUsed > expectedMaxUses) {
      invalidateFamily = true;
      
      // Log suspicious token usage
      SecurityAudit.create({
        eventType: 'SUSPICIOUS_TOKEN_REUSE',
        user: decoded.id,
        ip: ipAddress,
        userAgent,
        details: {
          jti: decoded.jti,
          family: decoded.family,
          timesUsed: tokenData.timesUsed,
          expectedMaxUses,
          tokenAgeHours: Math.floor(tokenAge / (60 * 60 * 1000))
        },
        severity: 'WARNING'
      }).catch(err => console.error('Failed to log suspicious token usage:', err));
    }
    
    // Check for IP mismatch from creation IP
    if (ipAddress && tokenData.ipCreated && ipAddress !== tokenData.ipCreated) {
      // Log IP change but don't invalidate family automatically
      SecurityAudit.create({
        eventType: 'REFRESH_TOKEN_IP_CHANGE',
        user: decoded.id,
        ip: ipAddress,
        userAgent,
        details: {
          jti: decoded.jti,
          family: decoded.family,
          originalIp: tokenData.ipCreated,
          newIp: ipAddress
        },
        severity: 'INFO'
      }).catch(err => console.error('Failed to log IP change:', err));
    }
    
    // Delete the used token
    refreshTokens.delete(decoded.jti);
    
    // If we suspect token theft, invalidate all tokens in the family
    if (invalidateFamily) {
      // Count how many tokens we're invalidating for logging
      let invalidatedCount = 0;
      
      for (const [jti, data] of refreshTokens.entries()) {
        if (data.family === tokenData.family) {
          refreshTokens.delete(jti);
          invalidatedCount++;
        }
      }
      
      // Log family invalidation
      if (invalidatedCount > 0) {
        SecurityAudit.create({
          eventType: 'REFRESH_TOKEN_FAMILY_INVALIDATED',
          user: decoded.id,
          ip: ipAddress,
          userAgent,
          details: {
            family: decoded.family,
            tokensInvalidated: invalidatedCount
          },
          severity: 'WARNING'
        }).catch(err => console.error('Failed to log family invalidation:', err));
      }
      
      // Generate a completely new family
      return generateRefreshToken(decoded.id, undefined, ipAddress, userAgent);
    }
    
    // Otherwise, create a new token in the same family
    return generateRefreshToken(decoded.id, tokenData.family, ipAddress, userAgent);
  } catch (error) {
    throw new Error(`Refresh token rotation failed: ${error.message}`);
  }
};

// Revoke a specific token with enhanced logging
const revokeToken = (token, reason = 'user_logout', ipAddress = null, userAgent = null) => {
  try {
    // Verify the token first to ensure it's valid
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwt_fallback_secret');
    
    // Add to blacklist only if it's not expired yet
    tokenBlacklist.add(token);
    
    // Log token revocation
    if (decoded.id && ipAddress) {
      SecurityAudit.create({
        eventType: 'TOKEN_REVOKED',
        user: decoded.id,
        ip: ipAddress,
        userAgent,
        details: {
          reason,
          jti: decoded.jti,
          tokenExpiry: new Date(decoded.exp * 1000).toISOString()
        },
        severity: 'INFO'
      }).catch(err => console.error('Failed to log token revocation:', err));
    }
    
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