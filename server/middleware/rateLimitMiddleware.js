const rateLimit = require('express-rate-limit');

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
  skipSuccessfulRequests: false // Count all requests
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
  }
});

module.exports = {
  authLimiter,
  apiLimiter
};