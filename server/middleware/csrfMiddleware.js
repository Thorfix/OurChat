const csrf = require('csurf');
const { isTrustedOrigin } = require('../utils/securityUtils');

// CSRF protection middleware
const csrfProtection = csrf({ 
  cookie: {
    key: 'csrf',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600 // 1 hour
  }
});

// CSRF error handler middleware
const handleCsrfError = (err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') {
    return next(err);
  }

  // Check if the request is from a trusted origin before rejecting
  const origin = req.get('origin');
  if (origin && isTrustedOrigin(origin)) {
    return next();
  }

  // Log the CSRF attempt
  console.error('CSRF attempt detected', {
    ip: req.ip,
    method: req.method,
    url: req.originalUrl,
    headers: req.headers
  });

  // Return a 403 Forbidden response
  res.status(403).json({ 
    message: 'Invalid or missing CSRF token',
    error: 'CSRF_ERROR'
  });
};

module.exports = {
  csrfProtection,
  handleCsrfError
};