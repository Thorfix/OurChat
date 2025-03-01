const { validationResult } = require('express-validator');
const SecurityAudit = require('../models/SecurityAudit');

/**
 * Middleware to validate request using express-validator
 * @returns {Function} Express middleware
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Log invalid request
    try {
      new SecurityAudit({
        eventType: 'INVALID_REQUEST',
        user: req.user ? req.user._id : null,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          method: req.method,
          path: req.originalUrl,
          validation: errors.array()
        },
        severity: 'WARNING'
      }).save();
    } catch (error) {
      console.error('Error logging security event:', error);
    }

    return res.status(400).json({ 
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  next();
};

module.exports = {
  validateRequest
};