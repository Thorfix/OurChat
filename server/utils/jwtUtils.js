const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const SecurityAudit = require('../models/SecurityAudit');
const redis = require('redis');

// Determine token storage based on environment
let redisClient;
let useRedis = false;

// Set up Redis for token storage in production
if (process.env.NODE_ENV === 'production' && process.env.REDIS_URL) {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
    }
  });
  
  redisClient.on('error', (err) => console.error('Redis client error:', err));
  
  // Connect to Redis (async)
  (async () => {
    try {
      await redisClient.connect();
      console.log('Redis connected for token management');
      useRedis = true;
    } catch (err) {
      console.error('Redis connection failed:', err);
      console.log('Falling back to in-memory token storage');
    }
  })();
}

// Fallback to in-memory storage
const tokenBlacklist = new Set();
const refreshTokens = new Map();
const tokenUsageLog = new Map(); // Track token usage for anomaly detection
const tokenBindings = new Map(); // Track token-device bindings for theft detection

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

// Advanced token usage tracker with better anomaly detection
const logTokenUsage = async (tokenId, userId, ipAddress, userAgent, isRefresh = false) => {
  try {
    // Get user's token usage log
    const userLog = tokenUsageLog.get(userId) || [];
    
    // Generate device fingerprint
    const fingerprint = crypto.createHash('sha256')
      .update(`${ipAddress}:${userAgent}`)
      .digest('hex')
      .substring(0, 16);
    
    // Check if this is a known device by comparing fingerprints
    const isKnownDevice = userLog.some(entry => {
      // Generate historical fingerprint for comparison
      const histFingerprint = crypto.createHash('sha256')
        .update(`${entry.ipAddress}:${entry.userAgent}`)
        .digest('hex')
        .substring(0, 16);
      
      // Match with some tolerance (e.g., IP might change but user agent stays the same)
      return histFingerprint === fingerprint || 
             (entry.userAgent === userAgent && entry.ipAddress.split('.').slice(0, 2).join('.') === 
              ipAddress.split('.').slice(0, 2).join('.')); 
    });
    
    // Add new entry with device fingerprint
    userLog.push({
      tokenId,
      timestamp: Date.now(),
      ipAddress,
      userAgent,
      isRefresh,
      fingerprint,
      isKnownDevice
    });
    
    // Keep only the last 30 entries
    if (userLog.length > 30) {
      userLog.shift();
    }
    
    tokenUsageLog.set(userId, userLog);
    
    // Check if this token has been used by a different device
    if (tokenBindings.has(tokenId)) {
      const binding = tokenBindings.get(tokenId);
      // Generate stored fingerprint
      const storedFingerprint = crypto.createHash('sha256')
        .update(`${binding.ipAddress}:${binding.userAgent}`)
        .digest('hex')
        .substring(0, 16);
      
      // If fingerprints don't match and it's not a known device, this could be token theft
      if (storedFingerprint !== fingerprint && !isKnownDevice) {
        await SecurityAudit.create({
          eventType: 'POTENTIAL_TOKEN_THEFT',
          user: userId,
          ip: ipAddress,
          userAgent,
          details: {
            tokenId,
            originalIp: binding.ipAddress,
            originalUserAgent: binding.userAgent.substring(0, 100), // Truncate for log space
            currentIp: ipAddress,
            isRefresh,
            timeSinceIssue: Date.now() - binding.timestamp,
            originalFingerprint: storedFingerprint,
            currentFingerprint: fingerprint
          },
          severity: 'WARNING'
        });
        
        // Return true to indicate potential theft
        return true;
      }
    } else {
      // First usage of this token - bind it to this device
      tokenBindings.set(tokenId, {
        userId,
        ipAddress,
        userAgent,
        timestamp: Date.now()
      });
    }
    
    // More sophisticated anomaly detection:
    
    // 1. Check for unusually rapid usage from different locations
    if (userLog.length >= 3) {
      const recentLogs = userLog.slice(-3);
      const uniqueIPs = new Set(recentLogs.map(entry => entry.ipAddress));
      
      // Calculate time between first and last recent usage
      const timeSpan = recentLogs[2].timestamp - recentLogs[0].timestamp;
      const minutesBetween = timeSpan / (1000 * 60);
      
      // If 3 different IPs in last 3 usages within a short time, log suspicious activity
      if (uniqueIPs.size >= 3 && minutesBetween < 30) {
        await SecurityAudit.create({
          eventType: 'SUSPICIOUS_TOKEN_USAGE',
          user: userId,
          ip: ipAddress,
          userAgent,
          details: {
            tokenId,
            uniqueIPs: Array.from(uniqueIPs),
            isRefresh,
            minutesBetween,
            recentUsage: recentLogs.map(log => ({
              ip: log.ipAddress,
              timestamp: new Date(log.timestamp).toISOString()
            }))
          },
          severity: 'WARNING'
        });
      }
    }
    
    // 2. Check for unusual usage patterns (time of day, etc.)
    const userLogByToken = userLog.filter(entry => entry.tokenId === tokenId);
    if (userLogByToken.length >= 3) {
      const usageFrequency = userLogByToken.length / 
        ((Date.now() - userLogByToken[0].timestamp) / (1000 * 60 * 60));
      
      // Unusually high usage frequency (more than once every 10 minutes over 3+ usages)
      if (usageFrequency > 6) {
        await SecurityAudit.create({
          eventType: 'HIGH_FREQUENCY_TOKEN_USAGE',
          user: userId,
          ip: ipAddress,
          userAgent,
          details: {
            tokenId,
            usageFrequency,
            usageCount: userLogByToken.length,
            timeSpanHours: (Date.now() - userLogByToken[0].timestamp) / (1000 * 60 * 60)
          },
          severity: 'INFO'
        });
      }
    }
    
    return false; // No theft detected
  } catch (error) {
    console.error('Error logging token usage:', error);
    return false;
  }
};

// Add token to blacklist/storage
const blacklistToken = async (token, expiresAt) => {
  if (useRedis && redisClient.isOpen) {
    try {
      // Use the token itself as the key with expiration time matching the token
      const ttl = Math.floor((expiresAt - Date.now()) / 1000);
      if (ttl > 0) {
        await redisClient.set(`bl:${token}`, '1', { EX: ttl });
      }
      return true;
    } catch (error) {
      console.error('Redis blacklist error, falling back to memory:', error);
      tokenBlacklist.add(token);
      return true;
    }
  } else {
    // In-memory fallback
    tokenBlacklist.add(token);
    return true;
  }
};

// Check if token is blacklisted
const isTokenBlacklisted = async (token) => {
  if (useRedis && redisClient.isOpen) {
    try {
      return (await redisClient.get(`bl:${token}`)) !== null;
    } catch (error) {
      console.error('Redis blacklist check error, falling back to memory:', error);
      return tokenBlacklist.has(token);
    }
  } else {
    // In-memory fallback
    return tokenBlacklist.has(token);
  }
};

// Generate JWT Token with enhanced security
const generateToken = (user, jti = crypto.randomBytes(16).toString('hex'), ipAddress = null, userAgent = null) => {
  // Add fingerprint to prevent token reuse across devices
  const fingerprint = ipAddress && userAgent ? 
    crypto.createHash('sha256').update(`${ipAddress}:${userAgent}`).digest('hex').substring(0, 8) : 
    undefined;
  
  // Enhanced payload with more security metadata
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = parseInt(process.env.JWT_EXPIRES_IN_SECONDS || '900'); // Default 15 minutes
  
  const token = jwt.sign(
    { 
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      jti, // JWT ID for token revocation
      fingerprint, // Optional device fingerprint
      version: '2.0', // Token version for future upgrades
      iat: now, // Issued at - explicit for token tracking
      deviceInfo: userAgent ? userAgent.substring(0, 50) : undefined, // Include partial device info
      ip: ipAddress ? ipAddress.split('.')[0] + '.' + ipAddress.split('.')[1] + '.x.x' : undefined, // Partial IP for logging
      sub: user._id.toString(), // Subject = user ID
      loginTime: now * 1000 // Track login time in ms for analysis
    },
    process.env.JWT_SECRET || 'jwt_fallback_secret',
    { 
      expiresIn: `${expiresIn}s`, // Shorter lived tokens for better security
      audience: process.env.JWT_AUDIENCE || 'retrochat-users',
      issuer: process.env.JWT_ISSUER || 'retrochat-api',
      notBefore: 0 // Token valid immediately
    }
  );
  
  // Log token generation for security auditing
  if (ipAddress && userAgent) {
    logTokenUsage(jti, user._id, ipAddress, userAgent, false);
  }
  
  // Token binding for theft detection
  tokenBindings.set(jti, {
    userId: user._id,
    ipAddress,
    userAgent,
    timestamp: Date.now(),
    expiresAt: Date.now() + (expiresIn * 1000)
  });
  
  return {
    token,
    expiresIn,
    expiresAt: new Date(now * 1000 + expiresIn * 1000).toISOString()
  };
};

// Generate refresh token with enhanced family rotation and security features
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
    
  // Add network segment for IP-based verification
  const ipSegment = ipAddress ? 
    ipAddress.split('.').slice(0, 2).join('.') : undefined;
  
  // Add user agent hash for user agent verification
  const uaHash = userAgent ? 
    crypto.createHash('sha256').update(userAgent).digest('hex').substring(0, 8) : 
    undefined;
  
  const now = Math.floor(Date.now() / 1000);
  
  const token = jwt.sign(
    { 
      id: userId,
      jti,
      family, // Used to invalidate all refresh tokens in a family when rotated
      fingerprint, // Device fingerprint 
      ipSegment, // Network segment for additional verification
      uaHash, // User agent hash
      version: '2.0', // Token version for future upgrades
      iat: now, // Issued at time
      sub: userId, // Subject = user ID
      tokenType: 'refresh', // Explicit token type
      scope: 'refresh_token' // OAuth-like scope
    },
    process.env.JWT_REFRESH_SECRET || 'jwt_refresh_fallback_secret',
    { 
      expiresIn,
      audience: process.env.JWT_AUDIENCE || 'retrochat-users',
      issuer: process.env.JWT_ISSUER || 'retrochat-api',
      notBefore: 0 // Token valid immediately
    }
  );
  
  // Enhanced token metadata
  const tokenData = {
    userId,
    family,
    fingerprint,
    ipSegment,
    uaHash,
    expiresAt,
    createdAt: Date.now(),
    lastUsed: Date.now(),
    timesUsed: 0,
    rotationCount: 0, // Track how many times token has been rotated
    ipCreated: ipAddress,
    uaCreated: userAgent && userAgent.length > 100 ? userAgent.substring(0, 100) : userAgent,
    lastIp: ipAddress,
    lastUa: userAgent && userAgent.length > 100 ? userAgent.substring(0, 100) : userAgent
  };
  
  // Store token metadata
  if (useRedis && redisClient.isOpen) {
    try {
      // Store with TTL matching token expiration
      const ttlSeconds = Math.floor((expiresAt - Date.now()) / 1000);
      redisClient.set(`rt:${jti}`, JSON.stringify(tokenData), { EX: ttlSeconds })
        .catch(err => {
          console.error('Redis token storage error, falling back to memory:', err);
          refreshTokens.set(jti, tokenData);
        });
    } catch (error) {
      console.error('Redis token storage error, falling back to memory:', error);
      refreshTokens.set(jti, tokenData);
    }
  } else {
    // In-memory fallback
    refreshTokens.set(jti, tokenData);
  }
  
  // Log refresh token generation
  if (ipAddress && userAgent) {
    logTokenUsage(jti, userId, ipAddress, userAgent, true);
  }
  
  return { 
    token, 
    family, 
    jti,
    expiresAt: new Date(expiresAt).toISOString(),
    expiresIn: Math.floor(expiryMs / 1000)
  };
};

// Verify JWT token with enhanced security checks
const verifyToken = async (token, ipAddress = null, userAgent = null) => {
  try {
    // Check if token is blacklisted
    if (await isTokenBlacklisted(token)) {
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
    
    // Check token age and warn if almost expired (helpful for debugging session issues)
    const tokenRemainingTime = decoded.payload.exp - (Date.now() / 1000);
    if (tokenRemainingTime < 60) { // Less than a minute remaining
      console.warn(`Token for user ${decoded.payload.id} is about to expire in ${Math.floor(tokenRemainingTime)} seconds`);
    }
    
    // Verify fingerprint if present with enhanced accuracy
    // This helps detect token theft where the attacker has the token but is using it from a different device
    if (decoded.payload.fingerprint && ipAddress && userAgent) {
      const currentFingerprint = crypto.createHash('sha256')
        .update(`${ipAddress}:${userAgent}`)
        .digest('hex')
        .substring(0, 8);
        
      // Check if fingerprints match exactly
      const fingerprintMatch = decoded.payload.fingerprint === currentFingerprint;
      
      // If fingerprints don't match, it could be token theft or just a user switching networks
      if (!fingerprintMatch) {
        // For more accurate detection, check if this is a known device for this user
        // even if the fingerprint doesn't match exactly
        
        // Get the token binding if it exists
        const binding = tokenBindings.get(decoded.payload.jti);
        let bindingMatch = false;
        
        // If we have a binding, check for partial matches (e.g., same user agent but different IP)
        if (binding && binding.userId === decoded.payload.id) {
          const sameUserAgent = binding.userAgent === userAgent;
          const sameIpPrefix = ipAddress.startsWith(binding.ipAddress.split('.').slice(0, 2).join('.'));
          
          // Consider it a match if user agent is identical (likely same device) but IP changed (mobile network)
          // or if it's the same network prefix (likely same location, different device)
          bindingMatch = sameUserAgent || sameIpPrefix;
        }
        
        // If it's not a known device binding, log as potential token theft
        if (!bindingMatch) {
          await SecurityAudit.create({
            eventType: 'TOKEN_FINGERPRINT_MISMATCH',
            user: decoded.payload.id,
            ip: ipAddress,
            userAgent,
            details: {
              jti: decoded.payload.jti,
              expectedFingerprint: decoded.payload.fingerprint,
              actualFingerprint: currentFingerprint,
              tokenIssuedAt: new Date(decoded.payload.iat * 1000).toISOString(),
              secondsSinceIssued: Date.now() / 1000 - decoded.payload.iat
            },
            severity: 'WARNING'
          });
          
          throw new Error('Token fingerprint mismatch');
        }
      }
    }
    
    // Log token usage for security auditing
    if (ipAddress && userAgent && decoded.payload.id && decoded.payload.jti) {
      // The logTokenUsage function now returns true if potential token theft is detected
      const potentialTheft = await logTokenUsage(decoded.payload.jti, decoded.payload.id, ipAddress, userAgent, false);
      
      // If potential theft is detected, invalidate this token
      if (potentialTheft) {
        // Blacklist the token
        await blacklistToken(token, decoded.payload.exp * 1000);
        
        // Remove token binding
        tokenBindings.delete(decoded.payload.jti);
        
        throw new Error('Suspicious token usage detected');
      }
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

// Get token data from storage
const getRefreshTokenData = async (jti) => {
  if (useRedis && redisClient.isOpen) {
    try {
      const data = await redisClient.get(`rt:${jti}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis get token error, falling back to memory:', error);
      return refreshTokens.get(jti);
    }
  } else {
    return refreshTokens.get(jti);
  }
};

// Update token data in storage
const updateRefreshTokenData = async (jti, data) => {
  if (useRedis && redisClient.isOpen) {
    try {
      // Calculate remaining TTL
      const ttlSeconds = Math.max(1, Math.floor((data.expiresAt - Date.now()) / 1000));
      await redisClient.set(`rt:${jti}`, JSON.stringify(data), { EX: ttlSeconds });
      return true;
    } catch (error) {
      console.error('Redis update token error, falling back to memory:', error);
      refreshTokens.set(jti, data);
      return true;
    }
  } else {
    refreshTokens.set(jti, data);
    return true;
  }
};

// Delete token data from storage
const deleteRefreshToken = async (jti) => {
  if (useRedis && redisClient.isOpen) {
    try {
      await redisClient.del(`rt:${jti}`);
      return true;
    } catch (error) {
      console.error('Redis delete token error, falling back to memory:', error);
      refreshTokens.delete(jti);
      return true;
    }
  } else {
    refreshTokens.delete(jti);
    return true;
  }
};

// Delete all tokens in a family
const deleteTokenFamily = async (family) => {
  if (useRedis && redisClient.isOpen) {
    try {
      // Get all keys with pattern rt:*
      const keys = await redisClient.keys('rt:*');
      let deletedCount = 0;
      
      for (const key of keys) {
        const data = JSON.parse(await redisClient.get(key));
        if (data && data.family === family) {
          await redisClient.del(key);
          deletedCount++;
        }
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Redis delete family error, falling back to memory:', error);
      
      // Memory fallback
      let deletedCount = 0;
      for (const [jti, data] of refreshTokens.entries()) {
        if (data.family === family) {
          refreshTokens.delete(jti);
          deletedCount++;
        }
      }
      return deletedCount;
    }
  } else {
    // Memory implementation
    let deletedCount = 0;
    for (const [jti, data] of refreshTokens.entries()) {
      if (data.family === family) {
        refreshTokens.delete(jti);
        deletedCount++;
      }
    }
    return deletedCount;
  }
};

// Verify refresh token with enhanced security and fraud detection
const verifyRefreshToken = async (token, ipAddress = null, userAgent = null, checkReuse = true) => {
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
    
    // Verify this is actually a refresh token
    if (decoded.payload.tokenType !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    // Check if the token is in our stored refresh tokens
    const tokenData = await getRefreshTokenData(decoded.payload.jti);
    if (!tokenData) {
      // This might be a token reuse attempt if the JTI is valid format but not found
      if (decoded.payload.jti && decoded.payload.jti.length === 32) {
        // Log potential token reuse
        await SecurityAudit.create({
          eventType: 'REFRESH_TOKEN_REUSE_ATTEMPT',
          user: decoded.payload.id,
          ip: ipAddress,
          userAgent,
          details: {
            jti: decoded.payload.jti,
            family: decoded.payload.family,
            tokenAge: Math.floor((Date.now() / 1000) - decoded.payload.iat) + ' seconds'
          },
          severity: 'WARNING'
        });
        
        // Invalidate all tokens in the family if ID format is valid
        if (decoded.payload.family && checkReuse) {
          const count = await deleteTokenFamily(decoded.payload.family);
          
          console.warn(`Invalidated ${count} tokens in family ${decoded.payload.family} due to potential reuse`);
        }
      }
      throw new Error('Refresh token not found or revoked');
    }
    
    // Check if token is expired in our records
    if (tokenData.expiresAt < Date.now()) {
      await deleteRefreshToken(decoded.payload.jti);
      throw new Error('Refresh token expired');
    }
    
    // Enhanced fingerprint and device verification
    // This catches token theft even if the attacker has the token but uses it from a different device
    if (ipAddress && userAgent) {
      // Calculate multiple verification factors
      const currentFingerprint = decoded.payload.fingerprint ? 
        crypto.createHash('sha256')
          .update(`${ipAddress}:${userAgent}`)
          .digest('hex')
          .substring(0, 8) : 
        null;
      
      const currentUaHash = decoded.payload.uaHash ? 
        crypto.createHash('sha256')
          .update(userAgent)
          .digest('hex')
          .substring(0, 8) : 
        null;
        
      const currentIpSegment = ipAddress ? 
        ipAddress.split('.').slice(0, 2).join('.') : null;
      
      // Check if any verification factors match
      const fingerprintMatch = currentFingerprint && 
                              decoded.payload.fingerprint && 
                              decoded.payload.fingerprint === currentFingerprint;
                            
      const uaHashMatch = currentUaHash && 
                         decoded.payload.uaHash && 
                         decoded.payload.uaHash === currentUaHash;
                       
      const ipSegmentMatch = currentIpSegment && 
                            decoded.payload.ipSegment && 
                            decoded.payload.ipSegment === currentIpSegment;
      
      // Determine verification level
      const passedVerifications = [fingerprintMatch, uaHashMatch, ipSegmentMatch].filter(Boolean).length;
      const hasVerifications = [currentFingerprint, currentUaHash, currentIpSegment].filter(Boolean).length;
      
      // At least one verification factor should match if available
      if (hasVerifications > 0 && passedVerifications === 0) {
        // Log potential token stealing and invalidate entire family
        await SecurityAudit.create({
          eventType: 'REFRESH_TOKEN_VERIFICATION_FAILURE',
          user: decoded.payload.id,
          ip: ipAddress,
          userAgent,
          details: {
            jti: decoded.payload.jti,
            family: decoded.payload.family,
            expectedFingerprint: decoded.payload.fingerprint,
            actualFingerprint: currentFingerprint,
            expectedUaHash: decoded.payload.uaHash,
            actualUaHash: currentUaHash,
            expectedIpSegment: decoded.payload.ipSegment,
            actualIpSegment: currentIpSegment,
            tokenAge: Math.floor((Date.now() / 1000) - decoded.payload.iat) + ' seconds'
          },
          severity: 'WARNING'
        });
        
        // Invalidate all tokens in the family
        if (checkReuse) {
          const count = await deleteTokenFamily(tokenData.family);
          console.warn(`Invalidated ${count} tokens in family ${tokenData.family} due to verification failure`);
        }
        
        throw new Error('Refresh token verification failure');
      }
    }
    
    // Update token usage data
    tokenData.lastUsed = Date.now();
    tokenData.timesUsed += 1;
    if (ipAddress) tokenData.lastIp = ipAddress;
    if (userAgent) tokenData.lastUa = userAgent && userAgent.length > 100 ? userAgent.substring(0, 100) : userAgent;
    await updateRefreshTokenData(decoded.payload.jti, tokenData);
    
    // Log token usage for security auditing
    if (ipAddress && userAgent && decoded.payload.id) {
      const potentialTheft = await logTokenUsage(decoded.payload.jti, decoded.payload.id, ipAddress, userAgent, true);
      
      // If potential theft is detected, invalidate this token family
      if (potentialTheft && checkReuse) {
        const count = await deleteTokenFamily(tokenData.family);
        console.warn(`Invalidated ${count} tokens in family ${tokenData.family} due to suspicious usage`);
        
        throw new Error('Suspicious token usage detected');
      }
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

// Rotate refresh token with advanced security, fraud prevention, and token binding
const rotateRefreshToken = async (oldToken, ipAddress = null, userAgent = null, invalidateFamily = false) => {
  try {
    // Verify token without auto invalidation
    const decoded = await verifyRefreshToken(oldToken, ipAddress, userAgent, false); 
    
    // Get the token data
    const tokenData = await getRefreshTokenData(decoded.jti);
    if (!tokenData) {
      throw new Error('Token data not found');
    }
    
    // Track rotation frequency
    tokenData.rotationCount = (tokenData.rotationCount || 0) + 1;
    
    // Check for excessive use (more than expected within timeframe)
    const tokenAge = Date.now() - tokenData.createdAt;
    const expectedMaxUses = Math.floor(tokenAge / (6 * 60 * 60 * 1000)) + 2; // Expect rotation every ~6 hours + initial use + buffer
    
    // If token used too frequently or rotated too many times, consider it suspicious
    if (tokenData.timesUsed > expectedMaxUses || tokenData.rotationCount > 10) {
      invalidateFamily = true;
      
      // Log suspicious token usage
      await SecurityAudit.create({
        eventType: 'SUSPICIOUS_TOKEN_ROTATION',
        user: decoded.id,
        ip: ipAddress,
        userAgent,
        details: {
          jti: decoded.jti,
          family: decoded.family,
          timesUsed: tokenData.timesUsed,
          rotationCount: tokenData.rotationCount,
          expectedMaxUses,
          tokenAgeHours: Math.floor(tokenAge / (60 * 60 * 1000))
        },
        severity: 'WARNING'
      });
    }
    
    // Check for IP mismatch from creation IP
    if (ipAddress && tokenData.ipCreated && !ipAddress.startsWith(tokenData.ipCreated.split('.').slice(0, 2).join('.'))) {
      // Log significant IP change
      await SecurityAudit.create({
        eventType: 'REFRESH_TOKEN_IP_CHANGE',
        user: decoded.id,
        ip: ipAddress,
        userAgent,
        details: {
          jti: decoded.jti,
          family: decoded.family,
          originalIp: tokenData.ipCreated,
          newIp: ipAddress,
          rotationCount: tokenData.rotationCount
        },
        severity: 'INFO'
      });
    }
    
    // Delete the used token - important for security!
    await deleteRefreshToken(decoded.jti);
    
    // If we suspect token theft, invalidate all tokens in the family and create a new family
    if (invalidateFamily) {
      // Invalidate all tokens in the family
      const invalidatedCount = await deleteTokenFamily(tokenData.family);
      
      // Log family invalidation
      if (invalidatedCount > 0) {
        await SecurityAudit.create({
          eventType: 'REFRESH_TOKEN_FAMILY_INVALIDATED',
          user: decoded.id,
          ip: ipAddress,
          userAgent,
          details: {
            family: decoded.family,
            tokensInvalidated: invalidatedCount,
            reason: tokenData.timesUsed > expectedMaxUses ? 'Excessive usage' : 'Too many rotations'
          },
          severity: 'WARNING'
        });
      }
      
      // Generate a completely new family
      return generateRefreshToken(decoded.id, undefined, ipAddress, userAgent);
    }
    
    // For regular rotation, issue new token in same family but track rotation count
    // Pass rotation count so we can limit the rotation chain length
    return generateRefreshToken(decoded.id, tokenData.family, ipAddress, userAgent);
  } catch (error) {
    throw new Error(`Refresh token rotation failed: ${error.message}`);
  }
};

// Revoke a specific token with enhanced logging and secure storage
const revokeToken = async (token, reason = 'user_logout', ipAddress = null, userAgent = null) => {
  try {
    // Verify the token first to ensure it's valid
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwt_fallback_secret');
    
    // Calculate token expiry time in milliseconds
    const expiryTime = decoded.exp * 1000;
    
    // Add to blacklist only if it's not expired yet
    if (expiryTime > Date.now()) {
      await blacklistToken(token, expiryTime);
      
      // Remove from token bindings
      if (decoded.jti) {
        tokenBindings.delete(decoded.jti);
      }
      
      // Log token revocation
      if (decoded.id && ipAddress) {
        await SecurityAudit.create({
          eventType: 'TOKEN_REVOKED',
          user: decoded.id,
          ip: ipAddress,
          userAgent,
          details: {
            reason,
            jti: decoded.jti,
            tokenExpiry: new Date(decoded.exp * 1000).toISOString(),
            timeUntilExpiry: Math.floor((decoded.exp * 1000 - Date.now()) / 1000) + ' seconds'
          },
          severity: 'INFO'
        });
      }
    }
    
    return true;
  } catch (error) {
    // If token is already expired, no need to revoke
    if (error instanceof jwt.TokenExpiredError) {
      return true;
    }
    console.error('Error revoking token:', error);
    return false;
  }
};

// Revoke all refresh tokens for a user
const revokeAllUserTokens = async (userId, reason = 'security_action', ipAddress = null, userAgent = null) => {
  let revokedCount = 0;
  
  if (useRedis && redisClient.isOpen) {
    try {
      // Get all refresh token keys
      const keys = await redisClient.keys('rt:*');
      
      // Check each token and delete if it belongs to user
      for (const key of keys) {
        const data = JSON.parse(await redisClient.get(key));
        if (data && data.userId === userId) {
          await redisClient.del(key);
          revokedCount++;
        }
      }
    } catch (error) {
      console.error('Redis token revocation error, falling back to memory:', error);
      // Memory fallback
      for (const [jti, data] of refreshTokens.entries()) {
        if (data.userId === userId) {
          refreshTokens.delete(jti);
          revokedCount++;
        }
      }
    }
  } else {
    // Memory implementation
    for (const [jti, data] of refreshTokens.entries()) {
      if (data.userId === userId) {
        refreshTokens.delete(jti);
        revokedCount++;
      }
    }
  }
  
  // Clean up token bindings
  for (const [jti, data] of tokenBindings.entries()) {
    if (data.userId === userId) {
      tokenBindings.delete(jti);
    }
  }
  
  // Log the mass revocation
  if (revokedCount > 0 && userId) {
    await SecurityAudit.create({
      eventType: 'USER_TOKENS_REVOKED',
      user: userId,
      ip: ipAddress,
      userAgent,
      details: {
        reason,
        tokensRevoked: revokedCount
      },
      severity: 'INFO'
    });
  }
  
  return revokedCount;
};

// Generate a random token for email verification or password reset
const generateRandomToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Get all active sessions for a user
const getUserActiveSessions = async (userId) => {
  const sessions = [];
  
  // First get tokens from tokenBindings (access tokens)
  for (const [jti, data] of tokenBindings.entries()) {
    if (data.userId === userId) {
      sessions.push({
        type: 'access',
        jti,
        createdAt: data.timestamp,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent
      });
    }
  }
  
  // Then get refresh tokens
  if (useRedis && redisClient.isOpen) {
    try {
      // Get all refresh token keys
      const keys = await redisClient.keys('rt:*');
      
      // Check each token and add if it belongs to user
      for (const key of keys) {
        const data = JSON.parse(await redisClient.get(key));
        if (data && data.userId === userId) {
          sessions.push({
            type: 'refresh',
            jti: key.substring(3), // Remove 'rt:' prefix
            family: data.family,
            createdAt: data.createdAt,
            expiresAt: data.expiresAt,
            lastUsed: data.lastUsed,
            ipAddress: data.ipCreated,
            userAgent: data.uaCreated,
            timesUsed: data.timesUsed
          });
        }
      }
    } catch (error) {
      console.error('Redis get sessions error, falling back to memory:', error);
      // Memory fallback
      for (const [jti, data] of refreshTokens.entries()) {
        if (data.userId === userId) {
          sessions.push({
            type: 'refresh',
            jti,
            family: data.family,
            createdAt: data.createdAt,
            expiresAt: data.expiresAt,
            lastUsed: data.lastUsed,
            ipAddress: data.ipCreated,
            userAgent: data.uaCreated,
            timesUsed: data.timesUsed
          });
        }
      }
    }
  } else {
    // Memory implementation for refresh tokens
    for (const [jti, data] of refreshTokens.entries()) {
      if (data.userId === userId) {
        sessions.push({
          type: 'refresh',
          jti,
          family: data.family,
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
          lastUsed: data.lastUsed,
          ipAddress: data.ipCreated,
          userAgent: data.uaCreated,
          timesUsed: data.timesUsed
        });
      }
    }
  }
  
  return sessions;
};

// Revoke a specific session
const revokeSession = async (userId, sessionJti, ipAddress = null, userAgent = null) => {
  // Try to remove from token bindings first (access tokens)
  let binding = tokenBindings.get(sessionJti);
  if (binding && binding.userId === userId) {
    tokenBindings.delete(sessionJti);
    
    // Log the revocation
    await SecurityAudit.create({
      eventType: 'SESSION_REVOKED',
      user: userId,
      ip: ipAddress,
      userAgent,
      details: {
        sessionJti,
        type: 'access',
        reason: 'User requested'
      },
      severity: 'INFO'
    });
    
    return { success: true, type: 'access' };
  }
  
  // Try to revoke refresh token
  if (useRedis && redisClient.isOpen) {
    try {
      const data = await redisClient.get(`rt:${sessionJti}`);
      if (data) {
        const tokenData = JSON.parse(data);
        if (tokenData.userId === userId) {
          await redisClient.del(`rt:${sessionJti}`);
          
          // Log the revocation
          await SecurityAudit.create({
            eventType: 'SESSION_REVOKED',
            user: userId,
            ip: ipAddress,
            userAgent,
            details: {
              sessionJti,
              type: 'refresh',
              family: tokenData.family,
              reason: 'User requested'
            },
            severity: 'INFO'
          });
          
          return { success: true, type: 'refresh' };
        }
      }
    } catch (error) {
      console.error('Redis revoke session error, falling back to memory:', error);
    }
  }
  
  // Memory fallback for refresh tokens
  const tokenData = refreshTokens.get(sessionJti);
  if (tokenData && tokenData.userId === userId) {
    refreshTokens.delete(sessionJti);
    
    // Log the revocation
    await SecurityAudit.create({
      eventType: 'SESSION_REVOKED',
      user: userId,
      ip: ipAddress,
      userAgent,
      details: {
        sessionJti,
        type: 'refresh',
        family: tokenData.family,
        reason: 'User requested'
      },
      severity: 'INFO'
    });
    
    return { success: true, type: 'refresh' };
  }
  
  return { success: false, error: 'Session not found or not owned by user' };
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeToken,
  revokeAllUserTokens,
  generateRandomToken,
  getUserActiveSessions,
  revokeSession
};