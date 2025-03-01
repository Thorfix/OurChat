const rateLimit = require('express-rate-limit');
const SecurityAudit = require('../models/SecurityAudit');

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

// Create a rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  max: 5, // 5 requests per window per IP
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: 429,
    message: 'Too many login attempts, please try again after 15 minutes'
  },
  skipSuccessfulRequests: false, // Count all requests
  handler: (req, res, next, options) => {
    logRateLimitViolation(req, options.max, 'auth');
    res.status(options.statusCode).json(options.message);
  }
});

// API rate limiter for general endpoints
const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minute window
  max: 100, // 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests, please try again later'
  },
  handler: (req, res, next, options) => {
    logRateLimitViolation(req, options.max, 'api');
    res.status(options.statusCode).json(options.message);
  }
});

// More aggressive rate limiter for password reset
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 3, // 3 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many password reset attempts, please try again after an hour'
  },
  handler: (req, res, next, options) => {
    logRateLimitViolation(req, options.max, 'password-reset');
    res.status(options.statusCode).json(options.message);
  }
});

// Rate limiter for api key requests
const apiKeyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minute window
  max: 5, // 5 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many API key operations, please try again later'
  },
  handler: (req, res, next, options) => {
    logRateLimitViolation(req, options.max, 'api-key');
    res.status(options.statusCode).json(options.message);
  }
});

module.exports = {
  authLimiter,
  apiLimiter,
  passwordResetLimiter,
  apiKeyLimiter
};