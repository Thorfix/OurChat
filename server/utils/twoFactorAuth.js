const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');

/**
 * Generate a new TOTP secret for a user
 * @returns {Object} Object containing the secret in various formats
 */
const generateSecret = (username) => {
  // Generate a new secret using the speakeasy library
  const secret = speakeasy.generateSecret({
    name: `RetroChat:${username}`,
    length: 20
  });
  
  return {
    otpauth_url: secret.otpauth_url,
    base32: secret.base32
  };
};

/**
 * Generate a QR code for the TOTP secret
 * @param {string} otpauthUrl - The OTP auth URL
 * @returns {Promise<string>} The generated QR code as a data URL
 */
const generateQRCode = async (otpauthUrl) => {
  try {
    const dataUrl = await qrcode.toDataURL(otpauthUrl);
    return dataUrl;
  } catch (error) {
    throw new Error('Error generating QR code');
  }
};

/**
 * Verify a TOTP token against a secret
 * @param {string} token - The token to verify
 * @param {string} secret - The secret to verify against
 * @returns {boolean} Whether the token is valid
 */
const verifyToken = (token, secret) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1 // Allow tokens that are 1 step before or after current time
  });
};

/**
 * Generate recovery codes for a user
 * @param {number} count - Number of recovery codes to generate
 * @returns {Array<string>} Array of recovery codes
 */
const generateRecoveryCodes = (count = 10) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Generate a random code of 10 characters
    const code = crypto.randomBytes(5).toString('hex').toUpperCase();
    // Format as XXXX-XXXX-XXXX
    const formattedCode = code.match(/.{1,4}/g).join('-');
    codes.push(formattedCode);
  }
  return codes;
};

module.exports = {
  generateSecret,
  generateQRCode,
  verifyToken,
  generateRecoveryCodes
};