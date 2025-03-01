const { validationResult } = require('express-validator');
const SecurityAudit = require('../models/SecurityAudit');
const xss = require('xss');

/**
 * Enhanced middleware to validate and sanitize requests
 * @returns {Function} Express middleware
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Log validation failure details
    try {
      new SecurityAudit({
        eventType: 'VALIDATION_FAILURE',
        user: req.user ? req.user._id : null,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          method: req.method,
          path: req.originalUrl,
          validation: errors.array(),
          body: JSON.stringify(req.body).substring(0, 200) // Only log first 200 chars for privacy
        },
        severity: 'WARNING'
      }).save();
    } catch (error) {
      console.error('Error logging validation failure:', error);
    }

    return res.status(400).json({ 
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  next();
};

/**
 * Middleware to sanitize request inputs against XSS
 * This provides a second layer of defense beyond client-side validation
 */
const sanitizeInputs = (req, res, next) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
      }
    }
  }
  
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key]);
      }
    }
  }
  
  if (req.params) {
    for (const key in req.params) {
      if (typeof req.params[key] === 'string') {
        req.params[key] = xss(req.params[key]);
      }
    }
  }
  
  next();
};

/**
 * Check payload size to prevent DOS attacks
 */
const validatePayloadSize = (maxSize = 100 * 1024) => (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || 0);
  
  if (contentLength > maxSize) {
    try {
      new SecurityAudit({
        eventType: 'OVERSIZED_PAYLOAD',
        user: req.user ? req.user._id : null,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          method: req.method,
          path: req.originalUrl,
          contentLength,
          maxSize
        },
        severity: 'WARNING'
      }).save();
    } catch (error) {
      console.error('Error logging oversized payload:', error);
    }
    
    return res.status(413).json({
      message: 'Payload too large',
      error: 'PAYLOAD_TOO_LARGE'
    });
  }
  
  next();
};

/**
 * Perform schema validation on JSON request body
 * @param {Object} schema - Joi schema
 */
const validateSchema = (schema) => (req, res, next) => {
  if (!schema || !schema.validate) {
    console.error('Invalid schema provided to validateSchema middleware');
    return next();
  }
  
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    // Log schema validation failure
    try {
      new SecurityAudit({
        eventType: 'SCHEMA_VALIDATION_FAILURE',
        user: req.user ? req.user._id : null,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          method: req.method,
          path: req.originalUrl,
          errors: error.details.map(d => d.message)
        },
        severity: 'INFO'
      }).save();
    } catch (logError) {
      console.error('Error logging schema validation:', logError);
    }
    
    return res.status(400).json({
      message: 'Invalid request data',
      errors: error.details.map(d => d.message)
    });
  }
  
  // Replace request body with validated and sanitized data
  req.body = value;
  
  next();
};

module.exports = {
  validateRequest,
  sanitizeInputs,
  validatePayloadSize,
  validateSchema
};