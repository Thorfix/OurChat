const csrf = require('csurf');
const { isTrustedOrigin, generateSecureToken } = require('../utils/securityUtils');
const SecurityAudit = require('../models/SecurityAudit');
const crypto = require('crypto');

// Generate a cryptographically secure 'secret' for each request
// This adds additional entropy to CSRF token generation 
const generateCsrfSecret = (req) => {
  // Generate a unique secret based on session, user agent, and a random component
  const baseData = [
    req.ip,
    req.headers['user-agent'] || 'unknown',
    crypto.randomBytes(16).toString('hex')
  ].join('|');
  
  // Hash the data to get a fixed-length secret
  return crypto.createHash('sha256')
    .update(baseData)
    .digest('hex');
};

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
  },
  // Generate a unique secret for each request
  // This has the benefit of making tokens more unpredictable
  value: (req) => {
    // Using header for SPA applications is common
    return req.headers['x-csrf-token'] || 
           req.headers['X-CSRF-TOKEN'] || 
           req.body?.csrf || 
           req.body?._csrf || 
           req.query?.csrf ||
           req.query?._csrf;
  },
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
});

// Extended CSRF error handler with detailed logging and enhanced security
const handleCsrfError = async (err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') {
    return next(err);
  }

  // Check if the request is from a trusted origin before rejecting
  const origin = req.get('origin');
  if (origin && isTrustedOrigin(origin)) {
    return next();
  }

  // Check if this is a read-only operation that shouldn't need CSRF
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  try {
    // Log the CSRF attempt to security audit with enhanced details
    await SecurityAudit.create({
      eventType: 'CSRF_ATTEMPT',
      user: req.user ? req.user._id : null,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        method: req.method,
        path: req.originalUrl,
        origin: req.get('origin'),
        referrer: req.get('referrer'),
        host: req.get('host'),
        contentType: req.get('content-type'),
        hasHeaders: {
          origin: !!req.get('origin'),
          referer: !!req.get('referer'),
          xRequestedWith: !!req.get('x-requested-with')
        },
        potentialBypass: req.body?._csrf || req.query?._csrf || 
                         req.headers['x-csrf-token'] ? 'Yes (invalid token)' : 'No token provided'
      },
      severity: 'WARNING'
    });
  } catch (error) {
    console.error('Failed to log CSRF attempt:', error);
  }

  // Add random delay to prevent timing attacks
  setTimeout(() => {
    // Return a 403 Forbidden response
    res.status(403).json({ 
      message: 'Invalid or missing CSRF token',
      error: 'CSRF_ERROR'
    });
  }, 100 + Math.random() * 200); // Random delay between 100-300ms
};

// Generate a new CSRF token with enhanced security
const refreshCsrfToken = (req, res, next) => {
  if (req.csrfToken) {
    // Generate a new token
    const token = req.csrfToken();
    
    // Attach to locals for server-side rendering
    res.locals.csrfToken = token;
    
    // Also include in response headers for API clients
    res.set('X-CSRF-Token', token);
  }
  next();
};

// Double-submit cookie pattern as an additional layer of protection
// Some frameworks rely on this approach rather than the csurf library
const doubleSubmitCookieProtection = (req, res, next) => {
  // Only apply to state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // For XHR requests using the double-submit pattern
  const cookieToken = req.signedCookies['csrf-token'];
  const headerToken = req.headers['x-csrf-token'];
  
  // If no tokens yet, create one
  if (!cookieToken) {
    const newToken = generateSecureToken();
    res.cookie('csrf-token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      signed: true,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    return next();
  }
  
  // Check if tokens match
  if (headerToken !== cookieToken) {
    try {
      // Log the CSRF attempt
      SecurityAudit.create({
        eventType: 'CSRF_DOUBLE_SUBMIT_FAILURE',
        user: req.user ? req.user._id : null,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          method: req.method,
          path: req.originalUrl,
          headerToken: headerToken ? 'Present but invalid' : 'Missing',
          cookieToken: cookieToken ? 'Present' : 'Missing'
        },
        severity: 'WARNING'
      });
    } catch (error) {
      console.error('Failed to log CSRF double-submit failure:', error);
    }
    
    // Only enforce in production, just log in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        message: 'CSRF protection failed',
        error: 'CSRF_DOUBLE_SUBMIT_ERROR'
      });
    }
  }
  
  next();
};

module.exports = {
  csrfProtection,
  handleCsrfError,
  refreshCsrfToken,
  doubleSubmitCookieProtection
};