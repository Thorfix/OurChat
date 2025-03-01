const csrf = require('csurf');
const { isTrustedOrigin } = require('../utils/securityUtils');
const SecurityAudit = require('../models/SecurityAudit');

// CSRF protection middleware with enhanced security options
const csrfProtection = csrf({ 
  cookie: {
    key: 'csrf',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600, // 1 hour
    signed: true, // Adds signature to prevent tampering
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined
  }
});

// Extended CSRF error handler with detailed logging
const handleCsrfError = async (err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') {
    return next(err);
  }

  // Check if the request is from a trusted origin before rejecting
  const origin = req.get('origin');
  if (origin && isTrustedOrigin(origin)) {
    return next();
  }

  try {
    // Log the CSRF attempt to security audit
    await SecurityAudit.create({
      eventType: 'CSRF_ATTEMPT',
      user: req.user ? req.user._id : null,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        method: req.method,
        path: req.originalUrl,
        origin: req.get('origin'),
        referrer: req.get('referrer')
      },
      severity: 'WARNING'
    });
  } catch (error) {
    console.error('Failed to log CSRF attempt:', error);
  }

  // Return a 403 Forbidden response
  res.status(403).json({ 
    message: 'Invalid or missing CSRF token',
    error: 'CSRF_ERROR'
  });
};

// Generate a new CSRF token
const refreshCsrfToken = (req, res, next) => {
  if (req.csrfToken) {
    res.locals.csrfToken = req.csrfToken();
  }
  next();
};

module.exports = {
  csrfProtection,
  handleCsrfError,
  refreshCsrfToken
};