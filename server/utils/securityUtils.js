const axios = require('axios');
const crypto = require('crypto');

/**
 * Check if a password meets strength requirements
 * @param {string} password - The password to check
 * @returns {Object} Result object with pass/fail and reason
 */
const checkPasswordStrength = (password) => {
  if (!password || password.length < 8) {
    return { 
      isStrong: false, 
      reason: 'Password must be at least 8 characters long' 
    };
  }

  // Check for a mix of character types
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChars) {
    return {
      isStrong: false,
      reason: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    };
  }

  // Check for common passwords or patterns
  const commonPatterns = ['password', '123456', 'qwerty', 'admin'];
  const normalizedPassword = password.toLowerCase();
  
  for (const pattern of commonPatterns) {
    if (normalizedPassword.includes(pattern)) {
      return {
        isStrong: false,
        reason: 'Password contains a common word or pattern'
      };
    }
  }

  return { isStrong: true };
};

/**
 * Check if password has been compromised using Have I Been Pwned API
 * @param {string} password - The password to check
 * @returns {Promise<boolean>} True if password is compromised
 */
const checkPasswordBreached = async (password) => {
  try {
    // Generate SHA-1 hash of the password
    const sha1Password = crypto
      .createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();
    
    // Use k-anonymity model: We only send the first 5 characters of the hash
    const prefix = sha1Password.substring(0, 5);
    const suffix = sha1Password.substring(5);
    
    // Query the API
    const response = await axios.get(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: {
          'User-Agent': 'RetroChat-Security-Check',
        },
      }
    );
    
    // Check if our hash suffix is in the response
    const hashes = response.data.split('\n');
    for (const hash of hashes) {
      const [hashSuffix, count] = hash.split(':');
      if (hashSuffix.trim() === suffix) {
        return { 
          breached: true, 
          occurrences: parseInt(count.trim()) 
        };
      }
    }
    
    return { breached: false };
  } catch (error) {
    console.error('Error checking password breach:', error);
    // If the service is unavailable, we'll assume the password is safe
    // but log the error for monitoring
    return { breached: false, error: 'Service unavailable' };
  }
};

/**
 * Check if an origin is in the list of trusted origins
 * @param {string} origin - The origin to check
 * @returns {boolean} True if the origin is trusted
 */
const isTrustedOrigin = (origin) => {
  const trustedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'https://retrochat.example.com',
    // Add other trusted origins as needed
  ];
  
  return trustedOrigins.includes(origin);
};

/**
 * Generate a secure random token
 * @param {number} length - Length of the token in bytes (will produce 2x this length in hex)
 * @returns {string} The generated token
 */
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Track failed login attempts by IP and username
 */
const loginAttemptTracker = (() => {
  const attempts = new Map();
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
  
  // Clean up old attempts every hour
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of attempts.entries()) {
      if (now - data.timestamp > LOCKOUT_TIME) {
        attempts.delete(key);
      }
    }
  }, 60 * 60 * 1000);
  
  return {
    recordAttempt: (ip, username) => {
      const key = `${ip}:${username || 'unknown'}`;
      const data = attempts.get(key) || { count: 0, timestamp: Date.now() };
      
      data.count += 1;
      data.timestamp = Date.now();
      attempts.set(key, data);
      
      return data.count;
    },
    
    isLocked: (ip, username) => {
      const key = `${ip}:${username || 'unknown'}`;
      const data = attempts.get(key);
      
      if (!data) return false;
      
      // If the lockout period has passed, reset the count
      if (Date.now() - data.timestamp > LOCKOUT_TIME) {
        attempts.delete(key);
        return false;
      }
      
      return data.count >= MAX_ATTEMPTS;
    },
    
    reset: (ip, username) => {
      const key = `${ip}:${username || 'unknown'}`;
      attempts.delete(key);
    }
  };
})();

/**
 * Detect anomalous IP-based login activity 
 */
const ipAnomalyDetection = (() => {
  // Map to store user login history
  const userLoginHistory = new Map();
  // How many unique IPs to remember per user
  const MAX_IPS_PER_USER = 5;
  // How long to remember IPs (30 days)
  const HISTORY_RETENTION = 30 * 24 * 60 * 60 * 1000;
  
  // Clean up old history records once a day
  setInterval(() => {
    const now = Date.now();
    for (const [userId, history] of userLoginHistory.entries()) {
      const newHistory = history.filter(entry => 
        now - entry.timestamp < HISTORY_RETENTION
      );
      
      if (newHistory.length === 0) {
        userLoginHistory.delete(userId);
      } else {
        userLoginHistory.set(userId, newHistory);
      }
    }
  }, 24 * 60 * 60 * 1000);
  
  return {
    /**
     * Record a successful login and check if it's anomalous
     * @param {string} userId - User ID
     * @param {string} ip - IP address
     * @param {string} userAgent - User agent string
     * @returns {Object} Result with anomaly detection info
     */
    checkLoginAnomaly: (userId, ip, userAgent) => {
      if (!userId || !ip) {
        return { anomalous: false };
      }
      
      const now = Date.now();
      const history = userLoginHistory.get(userId) || [];
      
      // Check if this is a new IP for this user
      const isKnownIp = history.some(entry => entry.ip === ip);
      
      // Add this login to history
      const updatedHistory = [
        { ip, userAgent, timestamp: now },
        ...history.filter(entry => entry.ip !== ip)
      ].slice(0, MAX_IPS_PER_USER);
      
      userLoginHistory.set(userId, updatedHistory);
      
      // If this is a first-time login from this IP, return anomaly
      if (!isKnownIp && history.length > 0) {
        return {
          anomalous: true,
          reason: 'Login from new IP address',
          knownIpCount: history.length
        };
      }
      
      return { anomalous: false };
    }
  };
})();

/**
 * Generate security headers object for Express
 */
const getSecurityHeaders = () => {
  return {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self';",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'no-store, max-age=0'
  };
};

module.exports = {
  checkPasswordStrength,
  checkPasswordBreached,
  isTrustedOrigin,
  generateSecureToken,
  loginAttemptTracker,
  ipAnomalyDetection,
  getSecurityHeaders
};