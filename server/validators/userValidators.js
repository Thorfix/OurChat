const { check } = require('express-validator');
const { checkPasswordStrength } = require('../utils/securityUtils');

// Validate registration data
const validateRegistration = [
  check('username')
    .trim()
    .not().isEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3-30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username can only contain letters, numbers, hyphens and underscores')
    .escape(),
  
  check('email')
    .trim()
    .not().isEmpty().withMessage('Email address is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  check('password')
    .trim()
    .not().isEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .custom((value) => {
      const result = checkPasswordStrength(value);
      if (!result.isStrong) {
        throw new Error(result.reason);
      }
      return true;
    })
];

// Validate login data
const validateLogin = [
  check('email')
    .trim()
    .not().isEmpty().withMessage('Email address is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  check('password')
    .trim()
    .not().isEmpty().withMessage('Password is required')
];

// Validate password reset request
const validateForgotPassword = [
  check('email')
    .trim()
    .not().isEmpty().withMessage('Email address is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail()
];

// Validate password reset
const validateResetPassword = [
  check('newPassword')
    .trim()
    .not().isEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .custom((value) => {
      const result = checkPasswordStrength(value);
      if (!result.isStrong) {
        throw new Error(result.reason);
      }
      return true;
    })
];

// Validate profile update
const validateProfileUpdate = [
  check('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3-30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username can only contain letters, numbers, hyphens and underscores')
    .escape(),
  
  check('displayName')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Display name cannot exceed 50 characters')
    .escape(),
  
  check('bio')
    .optional()
    .trim()
    .isLength({ max: 250 }).withMessage('Bio cannot exceed 250 characters')
    .escape(),
  
  check('password')
    .optional()
    .trim()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .custom((value) => {
      const result = checkPasswordStrength(value);
      if (!result.isStrong) {
        throw new Error(result.reason);
      }
      return true;
    })
];

// Validate 2FA verification
const validateTwoFactorVerification = [
  check('token')
    .trim()
    .not().isEmpty().withMessage('2FA token is required')
    .isLength({ min: 6, max: 6 }).withMessage('2FA token must be 6 digits')
    .isNumeric().withMessage('2FA token must contain only digits')
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateProfileUpdate,
  validateTwoFactorVerification
};