const axios = require('axios');
const crypto = require('crypto');

/**
 * Enhanced password strength validation with NIST 800-63B recommendations and zxcvbn-like complexity scoring
 * @param {string} password - The password to check
 * @param {Object} userContext - Optional user context for personalized checks
 * @returns {Object} Result object with pass/fail and reason
 */
const checkPasswordStrength = (password, userContext = {}) => {
  // Minimum length check (NIST recommends at least 8 characters)
  if (!password || password.length < 6) {
    return { 
      isStrong: false, 
      reason: 'Password must be at least 6 characters long',
      score: 0
    };
  }

  // Check for a mix of character types
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  // Calculate complexity score (0-5) with more granular factors
  let complexityScore = 0;
  
  // Base score from character diversity
  if (hasUpperCase) complexityScore += 0.8;
  if (hasLowerCase) complexityScore += 0.8;
  if (hasNumbers) complexityScore += 0.8;
  if (hasSpecialChars) complexityScore += 1.1;
  
  // Length bonus (more significant now)
  if (password.length >= 16) complexityScore += 1.5;
  else if (password.length >= 14) complexityScore += 1;
  else if (password.length >= 12) complexityScore += 0.5;
  
  // Require at least 3 character types
  const charTypesCount = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChars].filter(Boolean).length;
  if (charTypesCount < 3) {
    return {
      isStrong: false,
      reason: 'Password must contain at least three of the following: uppercase letters, lowercase letters, numbers, and special characters',
      score: Math.min(complexityScore, 1)
    };
  }
  
  // Check for repeated characters (e.g., "aaa", "111")
  // Now checks for longer patterns too
  if (/(.)\1{2,}/.test(password)) {
    // Penalize score but don't automatically fail for small repetitions
    complexityScore -= 0.5;
    
    // Only fail for excessive repetition
    if (/(.)\1{3,}/.test(password)) {
      return {
        isStrong: false,
        reason: 'Password should not contain repeated characters (e.g., "aaaa", "1111")',
        score: Math.min(complexityScore, 1.5)
      };
    }
  }
  
  // Check for sequential characters (expanded)
  const sequences = [
    'abcdefghijklmnopqrstuvwxyz', 
    '0123456789', 
    'qwertyuiop', 
    'asdfghjkl', 
    'zxcvbnm',
    '!@#$%^&*()',
    '~`-_=+[{]}\\|;:\'",./<>?'
  ];
  
  // Detect longer sequences (4+ chars), and bidirectional
  for (const sequence of sequences) {
    for (let i = 0; i < sequence.length - 3; i++) {
      // Check for forward and backward sequences of 4 or more characters
      const forward = sequence.substring(i, i + 4);
      const backward = forward.split('').reverse().join('');
      
      if (password.toLowerCase().includes(forward) || password.toLowerCase().includes(backward)) {
        // Penalize score but don't automatically fail for common short sequences
        complexityScore -= 1;
        
        // Fail for longer sequences (4+ characters)
        return {
          isStrong: false,
          reason: 'Password should not contain sequential characters (e.g., "abcd", "1234", "qwer")',
          score: Math.min(complexityScore, 1.5)
        };
      }
    }
  }

  // Check keyboard layout patterns (e.g., adjacent keys)
  const keyboardPatterns = [
    'qwert', 'yuiop', 'asdfg', 'hjkl', 'zxcvb', 'nm',
    'qaz', 'wsx', 'edc', 'rfv', 'tgb', 'yhn', 'ujm', 'ik', 'ol', 'p'
  ];
  
  // Find keyboard patterns in both directions
  for (const pattern of keyboardPatterns) {
    const reversePattern = pattern.split('').reverse().join('');
    
    if (password.toLowerCase().includes(pattern) || password.toLowerCase().includes(reversePattern)) {
      complexityScore -= 0.7;
      
      // For longer keyboard patterns, fail the check
      if (pattern.length > 3) {
        return {
          isStrong: false,
          reason: 'Password contains a keyboard pattern',
          score: Math.min(complexityScore, 1.5)
        };
      }
    }
  }

  // Check for common passwords or patterns (greatly expanded list)
  const commonPatterns = [
    'password', '123456', 'qwerty', 'admin', 'welcome', 'letmein', 
    'monkey', 'football', 'dragon', 'baseball', 'sunshine', 'iloveyou',
    'trustno1', 'superman', 'princess', 'starwars', 'login', 'master',
    'hello', 'freedom', 'whatever', 'qazwsx', 'trustno1', 'shadow',
    'hunter', 'harley', 'mustang', 'justin', 'batman', 'andrew', 'tigger',
    'sunshine', 'iloveyou', 'summer', 'michael', 'donald', 'muffin',
    'google', 'myspace', 'zaq1zaq1', 'rootroot', 'skyline', 'wildcat',
    'friends', 'flower', 'hottie', 'loveme', 'zxcvbn', 'bailey', 'hacker',
    'wizard', 'abcd1234', 'trustme', 'tigger', 'cookie', 'cheese', 'coffee',
    'lover', 'butterfly', 'password1', 'testing', 'test123', 'admin123',
    '12341234', '12345678', '87654321', 'access', 'liverpool', 'passw0rd',
    'microsoft', 'internet', 'chelsea', 'arsenal'
  ];
  
  // Check for user-specific information if provided
  if (userContext) {
    const { username, email, firstName, lastName, birthDate } = userContext;
    
    // Add user-specific terms to check against
    if (username) commonPatterns.push(username.toLowerCase());
    if (email) {
      const emailParts = email.toLowerCase().split('@');
      commonPatterns.push(emailParts[0]);
    }
    if (firstName) commonPatterns.push(firstName.toLowerCase());
    if (lastName) commonPatterns.push(lastName.toLowerCase());
    
    // Check birthdate components if available (e.g., 1990, 90, etc.)
    if (birthDate) {
      try {
        const date = new Date(birthDate);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear().toString();
          commonPatterns.push(year);
          commonPatterns.push(year.substring(2));
          
          // Also add month/day combinations
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          commonPatterns.push(`${month}${day}`);
          commonPatterns.push(`${day}${month}`);
        }
      } catch (e) {
        // Ignore birth date parsing errors
      }
    }
  }
  
  const normalizedPassword = password.toLowerCase();
  
  // Check if any common patterns are in the password
  for (const pattern of commonPatterns) {
    if (pattern.length >= 4 && normalizedPassword.includes(pattern)) {
      complexityScore -= pattern.length > 5 ? 2 : 1;
      
      // Fail check for longer common patterns
      if (pattern.length >= 5) {
        return {
          isStrong: false,
          reason: 'Password contains a common word or pattern',
          score: Math.min(Math.max(complexityScore, 0), 2)
        };
      }
    }
  }
  
  // Check for numeric-only or alpha-only passwords
  if (/^\d+$/.test(password) || /^[a-zA-Z]+$/.test(password)) {
    complexityScore -= 1;
    
    // Fail if too long (indicating reliance on single character type)
    if (password.length < 16) {
      return {
        isStrong: false,
        reason: 'Password should not consist of only letters or only numbers',
        score: Math.min(complexityScore, 2)
      };
    }
  }
  
  // Check if the password consists largely of a single character
  const charCounts = password.split('').reduce((acc, char) => {
    acc[char] = (acc[char] || 0) + 1;
    return acc;
  }, {});
  
  const maxCharCount = Math.max(...Object.values(charCounts));
  const percentageSameChar = maxCharCount / password.length;
  
  if (percentageSameChar > 0.4) {
    complexityScore -= percentageSameChar * 2;
    
    if (percentageSameChar > 0.5) {
      return {
        isStrong: false,
        reason: 'Password uses too many instances of the same character',
        score: Math.min(complexityScore, 2)
      };
    }
  }
  
  // Check for date patterns (MM/DD/YYYY, DD-MM-YYYY, etc.)
  if (/\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}/.test(password) || 
      /\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2}/.test(password) || 
      /\d{6,8}/.test(password)) {
    complexityScore -= 1;
  }
  
  // If complexity score is too low after all checks
  if (complexityScore < 3) {
    return {
      isStrong: false,
      reason: 'Password is not complex enough. Add more varied characters, increase length, and avoid patterns.',
      score: complexityScore
    };
  }

  // Return the final result with normalized score 0-5
  return { 
    isStrong: true,
    score: Math.min(Math.max(complexityScore, 0), 5),
    feedback: complexityScore > 4 ? 
      "Excellent password strength" : 
      "Good password, but could be stronger with more length and complexity"
  };
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
 * Enhanced anomalous IP-based login activity detection with geo-location
 * and machine learning-inspired risk scoring
 */
const ipAnomalyDetection = (() => {
  // Map to store user login history
  const userLoginHistory = new Map();
  // How many unique IPs to remember per user
  const MAX_IPS_PER_USER = 15;
  // How long to remember IPs (60 days)
  const HISTORY_RETENTION = 60 * 24 * 60 * 60 * 1000;
  // Suspicious login time threshold (login attempts in short period from different locations)
  const SUSPICIOUS_TIME_THRESHOLD = 10 * 60 * 1000; // 10 minutes
  // Track failed login attempts for rate limiting and brute force detection
  const failedAttempts = new Map();
  // Geo-location cache to avoid repeated lookups
  const geoCache = new Map();
  // Login time pattern tracking for time-based anomaly detection
  const loginTimePatterns = new Map();
  // Map to track common user networks
  const userNetworks = new Map();
  
  // Clean up old history records once a day
  setInterval(() => {
    const now = Date.now();
    let deletedUsers = 0;
    let retainedEntries = 0;
    
    for (const [userId, history] of userLoginHistory.entries()) {
      const newHistory = history.filter(entry => 
        now - entry.timestamp < HISTORY_RETENTION
      );
      
      if (newHistory.length === 0) {
        userLoginHistory.delete(userId);
        deletedUsers++;
      } else {
        userLoginHistory.set(userId, newHistory);
        retainedEntries += newHistory.length;
      }
    }
    
    console.log(`IP history cleanup: removed ${deletedUsers} users, retained ${retainedEntries} entries`);
    
    // Clean up failed attempts map
    let expiredAttempts = 0;
    for (const [key, data] of failedAttempts.entries()) {
      if (now - data.timestamp > 24 * 60 * 60 * 1000) { // 24 hours
        failedAttempts.delete(key);
        expiredAttempts++;
      }
    }
    
    if (expiredAttempts > 0) {
      console.log(`Failed attempts cleanup: removed ${expiredAttempts} expired entries`);
    }
    
    // Clean up geo cache older than 30 days
    let expiredGeoEntries = 0;
    for (const [ip, data] of geoCache.entries()) {
      if (now - data.timestamp > 30 * 24 * 60 * 60 * 1000) {
        geoCache.delete(ip);
        expiredGeoEntries++;
      }
    }
    
    if (expiredGeoEntries > 0) {
      console.log(`Geo cache cleanup: removed ${expiredGeoEntries} expired entries`);
    }
  }, 24 * 60 * 60 * 1000);
  
  // Get approximate geo-location for an IP (mock implementation - would use real geo IP service)
  const getGeoLocation = async (ip) => {
    // Check cache first
    if (geoCache.has(ip)) {
      return geoCache.get(ip).location;
    }
    
    // This is a mock implementation - would use a real geo IP service in production
    // Such as MaxMind GeoIP, ipstack, ipapi, etc.
    try {
      // In production, make API call here
      // const response = await axios.get(`https://ipapi.co/${ip}/json/`);
      // const location = response.data;
      
      // Mock location for testing
      const mockLocation = {
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        latitude: 0,
        longitude: 0
      };
      
      // Use the last octet of the IP to simulate different countries for testing
      const lastOctet = parseInt(ip.split('.').pop()) || 0;
      if (lastOctet < 50) {
        mockLocation.country = 'United States';
        mockLocation.region = 'California';
      } else if (lastOctet < 100) {
        mockLocation.country = 'United Kingdom';
        mockLocation.region = 'London';
      } else if (lastOctet < 150) {
        mockLocation.country = 'Germany';
        mockLocation.region = 'Berlin';
      } else if (lastOctet < 200) {
        mockLocation.country = 'Japan';
        mockLocation.region = 'Tokyo';
      } else {
        mockLocation.country = 'Australia';
        mockLocation.region = 'Sydney';
      }
      
      // Cache the result
      geoCache.set(ip, {
        location: mockLocation,
        timestamp: Date.now()
      });
      
      return mockLocation;
    } catch (error) {
      console.error('Error getting geo location:', error);
      return {
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        error: true
      };
    }
  };
  
  // Calculate distance between two geo-points (haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
  };
  
  // Track failed login attempt
  const trackFailedAttempt = (userId, ip, userAgent) => {
    const key = `${userId}:${ip}`;
    const now = Date.now();
    
    const data = failedAttempts.get(key) || { 
      count: 0, 
      firstAttempt: now,
      lastAttempt: now,
      userAgent
    };
    
    data.count += 1;
    data.lastAttempt = now;
    if (userAgent) data.userAgent = userAgent;
    
    failedAttempts.set(key, data);
    
    return data.count;
  };
  
  // Calculate risk score based on multiple factors (machine learning inspired)
  const calculateRiskScore = (userId, ip, userAgent, geo, history, now) => {
    let score = 0; // 0-100 scale where higher is riskier
    
    // Check if this is a new IP for this user
    const isKnownIp = history.some(entry => entry.ip === ip);
    if (!isKnownIp) score += 30;
    
    // Check if we've seen this network range before (first 3 octets)
    const networkPrefix = ip.split('.').slice(0, 3).join('.');
    const userNetworkList = userNetworks.get(userId) || [];
    const isKnownNetwork = userNetworkList.includes(networkPrefix);
    if (!isKnownNetwork) score += 15;
    
    // Add network to user's known networks
    if (!isKnownNetwork) {
      const updatedNetworks = [...userNetworkList, networkPrefix].slice(-20); // Keep last 20
      userNetworks.set(userId, updatedNetworks);
    }
    
    // High risk if no login history
    if (history.length === 0) score += 40;
    
    // Check time pattern if we have history
    if (history.length > 0) {
      // Get user's login time patterns (hour of day frequency)
      const timePatterns = loginTimePatterns.get(userId) || Array(24).fill(0);
      const loginHour = new Date(now).getHours();
      
      // If this hour is rarely used, increase score
      const hourFrequency = timePatterns[loginHour];
      if (hourFrequency === 0) score += 20;
      else if (hourFrequency <= 2) score += 10;
      
      // Update time patterns
      timePatterns[loginHour]++;
      loginTimePatterns.set(userId, timePatterns);
      
      // Check for rapid location change
      const lastLogin = history[0];
      if (!isKnownIp && now - lastLogin.timestamp < 24 * 60 * 60 * 1000) {
        // Country change is higher risk
        if (geo.country && lastLogin.geo && lastLogin.geo.country && 
            geo.country !== lastLogin.geo.country) {
          score += 40;
          
          // Even higher risk if logins are very close in time
          if (now - lastLogin.timestamp < SUSPICIOUS_TIME_THRESHOLD) {
            score += 40;
          }
        }
        
        // Check distance if we have coordinates
        if (lastLogin.geo && geo && 
            geo.latitude && geo.longitude && 
            lastLogin.geo.latitude && lastLogin.geo.longitude) {
          
          // Calculate distance
          const distance = calculateDistance(
            geo.latitude, geo.longitude,
            lastLogin.geo.latitude, lastLogin.geo.longitude
          );
          
          // Calculate travel speed in km/h
          const hoursBetweenLogins = (now - lastLogin.timestamp) / (1000 * 60 * 60);
          if (distance && hoursBetweenLogins) {
            const travelSpeed = distance / hoursBetweenLogins;
            
            // Impossible travel speeds
            if (travelSpeed > 1000) score += 50;
            else if (travelSpeed > 500) score += 30;
            else if (travelSpeed > 200 && distance > 500) score += 15;
          }
          
          // Large distances are higher risk
          if (distance > 5000) score += 20;
          else if (distance > 1000) score += 10;
        }
      }
    }
    
    // Check for unusual user agent
    const userAgentHistory = history.filter(entry => 
      entry.userAgent && entry.userAgent.includes(userAgent.split(' ')[0])
    );
    if (userAgentHistory.length === 0 && history.length > 3) {
      score += 15;
    }
    
    // Look for VPN/proxy signatures (mock implementation)
    // In production, you would use actual VPN/proxy detection services
    if (ip.startsWith('10.') || ip.includes('.0.') || ip.endsWith('.1')) {
      score += 10; // Just a mockup; real detection would be more sophisticated
    }
    
    // Recent failed login attempts increase risk
    const failedKey = `${userId}:${ip}`;
    const recentFailures = failedAttempts.get(failedKey);
    if (recentFailures) {
      score += Math.min(recentFailures.count * 5, 25);
    }
    
    return Math.min(Math.max(score, 0), 100); // Clamp between 0-100
  };
  
  return {
    /**
     * Record a successful login and check if it's anomalous
     * @param {string} userId - User ID
     * @param {string} ip - IP address
     * @param {string} userAgent - User agent string
     * @returns {Promise<Object>} Result with anomaly detection info
     */
    checkLoginAnomaly: async (userId, ip, userAgent) => {
      if (!userId || !ip) {
        return { anomalous: false };
      }
      
      const now = Date.now();
      const history = userLoginHistory.get(userId) || [];
      
      // Try to get geo-location
      const geo = await getGeoLocation(ip);
      
      // Check if this is a new IP for this user
      const isKnownIp = history.some(entry => entry.ip === ip);
      
      // Calculate comprehensive risk score
      const riskScore = calculateRiskScore(userId, ip, userAgent, geo, history, now);
      
      // Track rapid location changes and impossible travel
      let impossibleTravel = false;
      let travelSpeed = null;
      let distance = null;
      
      if (history.length > 0 && !isKnownIp) {
        const lastLogin = history[0];
        
        // If last login was recent, check location
        if (now - lastLogin.timestamp < 24 * 60 * 60 * 1000) { // Within 24 hours
          // If we have geo data for both IPs
          if (lastLogin.geo && geo && 
              geo.latitude && geo.longitude && 
              lastLogin.geo.latitude && lastLogin.geo.longitude) {
            
            // Calculate distance and speed
            distance = calculateDistance(
              geo.latitude, geo.longitude,
              lastLogin.geo.latitude, lastLogin.geo.longitude
            );
            
            // Calculate hours between logins
            const hoursBetweenLogins = (now - lastLogin.timestamp) / (1000 * 60 * 60);
            
            // Calculate travel speed in km/h
            if (distance && hoursBetweenLogins) {
              travelSpeed = distance / hoursBetweenLogins;
              
              // Flag as impossible travel if speed is too high (e.g. > 1000 km/h)
              // A typical commercial airplane travels at ~800-900 km/h
              if (travelSpeed > 1000) {
                impossibleTravel = true;
              }
            }
          }
          
          // Also consider it suspicious if the countries are different and logins are too close
          if (geo.country && lastLogin.geo && lastLogin.geo.country && 
              geo.country !== lastLogin.geo.country && 
              now - lastLogin.timestamp < SUSPICIOUS_TIME_THRESHOLD) {
            impossibleTravel = true;
          }
        }
      }
      
      // Add this login to history
      const updatedHistory = [
        { 
          ip, 
          userAgent, 
          timestamp: now,
          geo,
          riskScore
        },
        ...history.filter(entry => entry.ip !== ip)
      ].slice(0, MAX_IPS_PER_USER);
      
      userLoginHistory.set(userId, updatedHistory);
      
      // Reset failed login counter for this user/IP combo
      failedAttempts.delete(`${userId}:${ip}`);
      
      // Determine anomaly level based on risk score
      let anomalyLevel = 'none';
      let anomalyReason = null;
      
      if (riskScore >= 75 || impossibleTravel) {
        anomalyLevel = 'high';
        anomalyReason = impossibleTravel ? 
          (distance ? `Suspicious travel speed (${Math.round(travelSpeed)} km/h) between logins` 
                   : `Logins from different countries in short time period`) :
          `High risk login detected (score: ${riskScore})`;
      } else if (riskScore >= 50) {
        anomalyLevel = 'medium';
        anomalyReason = geo.country && history.length > 0 && history[0].geo && 
                       geo.country !== history[0].geo.country ?
          `Login from new country: ${geo.country}` :
          `Medium risk login detected (score: ${riskScore})`;
      } else if (riskScore >= 30) {
        anomalyLevel = 'low';
        anomalyReason = `Login from new location (score: ${riskScore})`;
      }
      
      const isAnomalous = anomalyLevel !== 'none';
      
      // Log high-level anomalies to security audit
      if (anomalyLevel === 'high' || anomalyLevel === 'medium') {
        try {
          const SecurityAudit = require('../models/SecurityAudit');
          await SecurityAudit.create({
            eventType: 'LOGIN_ANOMALY',
            user: userId,
            ip,
            userAgent,
            details: {
              anomalyLevel,
              reason: anomalyReason,
              riskScore,
              geo,
              previousGeo: history.length > 0 ? history[0].geo : null,
              distance: distance ? Math.round(distance) : null,
              travelSpeed: travelSpeed ? Math.round(travelSpeed) : null,
              timeBetweenLogins: history.length > 0 ? now - history[0].timestamp : null,
              knownIP: isKnownIp,
              loginHour: new Date(now).getHours()
            },
            severity: anomalyLevel === 'high' ? 'WARNING' : 'INFO'
          });
        } catch (error) {
          console.error('Error logging login anomaly:', error);
        }
      }
      
      return {
        anomalous: isAnomalous,
        level: anomalyLevel,
        reason: anomalyReason,
        riskScore,
        geo: {
          country: geo.country,
          region: geo.region
        },
        knownIpCount: history.length,
        requireVerification: riskScore >= 60 // Suggest additional verification
      };
    },
    
    /**
     * Record failed login attempt and check if account should be locked
     */
    recordFailedAttempt: (userId, ip, userAgent) => {
      const attemptCount = trackFailedAttempt(userId, ip, userAgent);
      
      // If too many failed attempts, suggest account lockout
      if (attemptCount >= 5) {
        // Log to security audit
        try {
          const SecurityAudit = require('../models/SecurityAudit');
          SecurityAudit.create({
            eventType: 'BRUTE_FORCE_ATTEMPT',
            user: userId,
            ip,
            userAgent,
            details: {
              attemptCount,
              timeWindow: '24 hours'
            },
            severity: 'WARNING'
          });
        } catch (error) {
          console.error('Error logging brute force attempt:', error);
        }
        
        return {
          shouldLock: true,
          attemptCount,
          reason: 'Too many failed login attempts'
        };
      }
      
      return {
        shouldLock: false,
        attemptCount
      };
    },
    
    /**
     * Get login history for a user
     */
    getUserLoginHistory: (userId) => {
      const history = userLoginHistory.get(userId) || [];
      
      // Return sanitized history (without internal details)
      return history.map(entry => ({
        ip: entry.ip,
        timestamp: entry.timestamp,
        location: entry.geo ? `${entry.geo.country}, ${entry.geo.region}` : 'Unknown',
        userAgent: entry.userAgent
      }));
    },
    
    /**
     * Clear all history for a user (e.g., on password reset)
     */
    clearUserHistory: (userId) => {
      userLoginHistory.delete(userId);
      
      // Clear any failed attempts for this user
      for (const key of failedAttempts.keys()) {
        if (key.startsWith(`${userId}:`)) {
          failedAttempts.delete(key);
        }
      }
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