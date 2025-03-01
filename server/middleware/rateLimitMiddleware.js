const rateLimit = require('express-rate-limit');
const SecurityAudit = require('../models/SecurityAudit');
const redis = require('redis');
const RedisStore = require('rate-limit-redis');

// Configure Redis store if in production
let redisClient;
let limiterStore;

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
      console.log('Redis connected for rate limiting');
    } catch (err) {
      console.error('Redis connection failed:', err);
    }
  })();
  
  limiterStore = new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  });
} else {
  console.log('Using memory store for rate limiting');
  limiterStore = undefined; // Use default memory store
}

// Helper to log rate limit violations
const logRateLimitViolation = async (req, limit, type) => {
  try {
    await SecurityAudit.create({
      eventType: 'RATE_LIMIT_VIOLATION',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        path: req.originalUrl,
        method: req.method,
        limitType: type,
        limit: limit
      },
      severity: 'WARNING'
    });
  } catch (error) {
    console.error('Failed to log rate limit violation:', error);
  }
};

// Create options for rate limiters with enhanced logging and security
const createLimiterOptions = (windowMs, max, type, message) => ({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message
  },
  store: limiterStore,
  skipSuccessfulRequests: false,
  // Skip well-known bots and trusted IPs
  skip: (req) => {
    // Allow monitoring/health check bots
    if (req.path === '/api/health' && req.method === 'GET') {
      return true;
    }
    
    // Skip if from trusted IP (e.g., internal monitoring)
    const trustedIps = process.env.TRUSTED_IPS ? process.env.TRUSTED_IPS.split(',') : [];
    if (trustedIps.includes(req.ip)) {
      return true;
    }
    
    return false;
  },
  handler: (req, res, next, options) => {
    logRateLimitViolation(req, options.max, type);
    
    // For auth endpoints, add small delay to prevent timing attacks
    if (type === 'auth' || type === 'password-reset') {
      setTimeout(() => {
        res.status(options.statusCode).json(options.message);
      }, 1000 + Math.random() * 1000); // Random delay 1-2 seconds
    } else {
      res.status(options.statusCode).json(options.message);
    }
  },
  keyGenerator: (req) => {
    // Use IP and partial user-agent to limit more precisely
    // This helps with IP rotation attacks but doesn't collect full fingerprints
    const userAgentParts = req.headers['user-agent']?.split(' ') || [];
    const userAgentBase = userAgentParts.length > 0 ? userAgentParts[0] : '';
    
    return `${req.ip}:${userAgentBase}`;
  }
});

// Create a rate limiter for authentication endpoints
const authLimiter = rateLimit(createLimiterOptions(
  15 * 60 * 1000, // 15 minute window
  5, // 5 requests per window per IP
  'auth',
  'Too many login attempts, please try again after 15 minutes'
));

// API rate limiter for general endpoints
const apiLimiter = rateLimit(createLimiterOptions(
  10 * 60 * 1000, // 10 minute window
  100, // 100 requests per window per IP
  'api',
  'Too many requests, please try again later'
));

// More aggressive rate limiter for password reset
const passwordResetLimiter = rateLimit(createLimiterOptions(
  60 * 60 * 1000, // 1 hour window
  3, // 3 requests per hour
  'password-reset',
  'Too many password reset attempts, please try again after an hour'
));

// Rate limiter for api key requests
const apiKeyLimiter = rateLimit(createLimiterOptions(
  5 * 60 * 1000, // 5 minute window
  5, // 5 requests per window
  'api-key',
  'Too many API key operations, please try again later'
));

// Rate limiter for verification endpoints (email, 2FA, etc.)
const verificationLimiter = rateLimit(createLimiterOptions(
  30 * 60 * 1000, // 30 minute window
  5, // 5 requests per window
  'verification',
  'Too many verification attempts, please try again after 30 minutes'
));

// Strict rate limiter for sensitive operations (delete account, change email, etc.)
const sensitiveOperationsLimiter = rateLimit(createLimiterOptions(
  60 * 60 * 1000, // 1 hour window
  3, // 3 requests per hour
  'sensitive-operations',
  'Too many sensitive operations attempted. Please try again later'
));

// Socket connection rate limiter
const socketConnectionLimiter = () => {
  const connections = new Map();
  const MAX_CONNECTIONS = 10;
  const WINDOW_MS = 60 * 1000; // 1 minute
  
  return (ip, userAgent) => {
    const now = Date.now();
    const key = `${ip}:${userAgent?.split(' ')[0] || ''}`;
    
    // Clean expired entries
    connections.forEach((data, entryKey) => {
      if (now - data.timestamp > WINDOW_MS) {
        connections.delete(entryKey);
      }
    });
    
    // Get or initialize data for this key
    const data = connections.get(key) || {
      count: 0,
      timestamp: now
    };
    
    // If window expired, reset counter
    if (now - data.timestamp > WINDOW_MS) {
      data.count = 1;
      data.timestamp = now;
    } else {
      data.count++;
    }
    
    connections.set(key, data);
    
    return {
      limited: data.count > MAX_CONNECTIONS,
      current: data.count,
      limit: MAX_CONNECTIONS
    };
  };
};

// Create socket connection limiter instance
const socketLimiter = socketConnectionLimiter();

// IP-based user brute force prevention
const accountBruteForce = (() => {
  const attempts = new Map();
  const MAX_ATTEMPTS_PER_USER = 5;
  const LOCKOUT_WINDOW = 30 * 60 * 1000; // 30 minutes
  
  // Clean up old entries every hour
  setInterval(() => {
    const now = Date.now();
    let expiredCount = 0;
    
    attempts.forEach((data, key) => {
      if (now - data.timestamp > LOCKOUT_WINDOW) {
        attempts.delete(key);
        expiredCount++;
      }
    });
    
    if (expiredCount > 0) {
      console.log(`Cleaned up ${expiredCount} expired brute force entries`);
    }
  }, 60 * 60 * 1000);
  
  return {
    check: (username, ip) => {
      const now = Date.now();
      const key = `${username.toLowerCase()}:${ip}`;
      
      // Get or create entry
      const entry = attempts.get(key) || {
        attempts: 0,
        timestamp: now
      };
      
      // Reset if lockout period has passed
      if (now - entry.timestamp > LOCKOUT_WINDOW) {
        entry.attempts = 0;
        entry.timestamp = now;
      }
      
      return {
        attempts: entry.attempts,
        limited: entry.attempts >= MAX_ATTEMPTS_PER_USER,
        windowEnd: entry.timestamp + LOCKOUT_WINDOW
      };
    },
    
    increment: (username, ip) => {
      const now = Date.now();
      const key = `${username.toLowerCase()}:${ip}`;
      
      const entry = attempts.get(key) || {
        attempts: 0,
        timestamp: now
      };
      
      // Reset if lockout period has passed
      if (now - entry.timestamp > LOCKOUT_WINDOW) {
        entry.attempts = 1;
        entry.timestamp = now;
      } else {
        entry.attempts++;
      }
      
      attempts.set(key, entry);
      
      return {
        attempts: entry.attempts,
        limited: entry.attempts >= MAX_ATTEMPTS_PER_USER,
        windowEnd: entry.timestamp + LOCKOUT_WINDOW
      };
    },
    
    reset: (username, ip) => {
      const key = `${username.toLowerCase()}:${ip}`;
      attempts.delete(key);
    }
  };
})();

module.exports = {
  authLimiter,
  apiLimiter,
  passwordResetLimiter,
  apiKeyLimiter,
  verificationLimiter,
  sensitiveOperationsLimiter,
  socketLimiter,
  accountBruteForce
};