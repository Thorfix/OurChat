const express = require('express');
const router = express.Router();
const User = require('../models/User');
const SecurityAudit = require('../models/SecurityAudit');
const { generateToken, generateRefreshToken, generateRandomToken, revokeToken, revokeAllUserTokens } = require('../utils/jwtUtils');
const { protect, authorize, requireEmailVerification, checkLoginAnomaly, trackSession, sessionManager } = require('../middleware/authMiddleware');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');
const { generateSecret, generateQRCode, verifyToken: verifyTOTP, generateRecoveryCodes } = require('../utils/twoFactorAuth');
const { validateRequest } = require('../middleware/validationMiddleware');
const { validateRegistration, validateLogin, validateForgotPassword, validateResetPassword, validateProfileUpdate } = require('../validators/userValidators');
const { checkPasswordBreached, loginAttemptTracker, ipAnomalyDetection } = require('../utils/securityUtils');

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
router.post('/register', validateRegistration, validateRequest, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ 
        message: 'User already exists with that email or username' 
      });
    }

    // Generate verification token
    const verificationToken = generateRandomToken();

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      verificationToken
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(email, verificationToken, username);

    if (user) {
      res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        emailSent,
        message: 'Registration successful. Please verify your email address.'
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// @desc    Verify email address
// @route   GET /api/users/verify-email/:token
// @access  Public
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find user by verification token
    const user = await User.findOne({ verificationToken: token });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }
    
    // Update user's verified status
    user.isEmailVerified = true;
    user.verificationToken = undefined;
    await user.save();
    
    res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: 'Server error during email verification' });
  }
});

// @desc    Resend verification email
// @route   POST /api/users/resend-verification
// @access  Public
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'No account found with that email address' });
    }
    
    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }
    
    // Generate new verification token
    const verificationToken = generateRandomToken();
    user.verificationToken = verificationToken;
    await user.save();
    
    // Send verification email
    const emailSent = await sendVerificationEmail(email, verificationToken, user.username);
    
    if (emailSent) {
      res.status(200).json({ message: 'Verification email resent successfully' });
    } else {
      res.status(500).json({ message: 'Failed to send verification email' });
    }
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Server error during email verification' });
  }
});

// @desc    Authenticate user & get token
// @route   POST /api/users/login
// @access  Public
router.post('/login', validateLogin, validateRequest, async (req, res) => {
  try {
    const { email, password, totpToken } = req.body;
    const clientIp = req.ip;
    const userAgent = req.headers['user-agent'];

    // Check if this IP/email combo is locked out due to too many failed attempts
    if (loginAttemptTracker.isLocked(clientIp, email)) {
      // Log the lockout event
      await new SecurityAudit({
        eventType: 'ACCOUNT_LOCKOUT',
        ip: clientIp,
        userAgent,
        details: {
          email,
          reason: 'Too many failed login attempts'
        },
        severity: 'WARNING'
      }).save();

      return res.status(429).json({ 
        message: 'Account temporarily locked due to too many failed attempts. Please try again later.' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      // Record the failed attempt
      loginAttemptTracker.recordAttempt(clientIp, email);
      
      // Log the failed login
      await new SecurityAudit({
        eventType: 'LOGIN_FAILURE',
        ip: clientIp,
        userAgent,
        details: {
          email,
          reason: 'User not found'
        },
        severity: 'WARNING'
      }).save();

      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      // Record the failed attempt
      const attemptCount = loginAttemptTracker.recordAttempt(clientIp, email);
      
      // Log the failed login
      await new SecurityAudit({
        eventType: 'LOGIN_FAILURE',
        user: user._id,
        ip: clientIp,
        userAgent,
        details: {
          email,
          reason: 'Invalid password',
          attemptCount
        },
        severity: 'WARNING'
      }).save();

      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if 2FA is enabled for the user
    if (user.twoFactorAuth && user.twoFactorAuth.enabled) {
      // If 2FA is enabled but no TOTP token was provided, notify client that 2FA is needed
      if (!totpToken) {
        return res.status(200).json({
          _id: user._id,
          requireTwoFactorAuth: true,
          message: 'Two-factor authentication code required'
        });
      }

      // Verify the TOTP token
      const isValid = verifyTOTP(totpToken, user.twoFactorAuth.secret);
      
      if (!isValid) {
        // Record the failed 2FA attempt
        loginAttemptTracker.recordAttempt(clientIp, email);
        
        // Log the failed 2FA verification
        await new SecurityAudit({
          eventType: 'LOGIN_FAILURE',
          user: user._id,
          ip: clientIp,
          userAgent,
          details: {
            email,
            reason: 'Invalid 2FA code'
          },
          severity: 'WARNING'
        }).save();
        
        return res.status(401).json({ message: 'Invalid two-factor authentication code' });
      }
    }

    // Check for IP-based anomalies
    const anomalyResult = ipAnomalyDetection.checkLoginAnomaly(
      user._id.toString(),
      clientIp,
      userAgent
    );

    // Reset failed login counter on successful login
    loginAttemptTracker.reset(clientIp, email);

    // Update last active
    user.lastActive = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateToken(user);
    const { token: refreshToken, family } = generateRefreshToken(user._id);

    // Log the successful login
    await new SecurityAudit({
      eventType: 'LOGIN_SUCCESS',
      user: user._id,
      ip: clientIp,
      userAgent,
      details: {
        email,
        anomalous: anomalyResult.anomalous,
        anomalyReason: anomalyResult.reason
      },
      severity: 'INFO'
    }).save();

    // Set session timeout 
    const sessionTimeoutMinutes = process.env.SESSION_TIMEOUT_MINUTES || 60;
    const expiresAt = new Date(Date.now() + sessionTimeoutMinutes * 60000);

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      profile: user.profile,
      twoFactorAuthEnabled: user.twoFactorAuth.enabled,
      accessToken,
      refreshToken,
      expiresAt: expiresAt.toISOString(),
      anomalousLogin: anomalyResult.anomalous ? {
        reason: anomalyResult.reason
      } : null
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error getting user profile' });
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update profile fields
    user.username = req.body.username || user.username;
    user.profile.displayName = req.body.displayName || user.profile.displayName;
    user.profile.bio = req.body.bio || user.profile.bio;
    user.profile.avatar = req.body.avatar || user.profile.avatar;
    
    // If password is included, update it
    if (req.body.password) {
      user.password = req.body.password;
    }
    
    const updatedUser = await user.save();
    
    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role,
      profile: updatedUser.profile,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error updating user profile' });
  }
});

// @desc    Request password reset
// @route   POST /api/users/forgot-password
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'No account found with that email address' });
    }
    
    // Generate reset token and expiry
    const resetToken = generateRandomToken();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();
    
    // Send password reset email
    const emailSent = await sendPasswordResetEmail(email, resetToken, user.username);
    
    if (emailSent) {
      res.status(200).json({ message: 'Password reset email sent successfully' });
    } else {
      res.status(500).json({ message: 'Failed to send password reset email' });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error processing password reset request' });
  }
});

// @desc    Reset password
// @route   POST /api/users/reset-password/:token
// @access  Public
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;
    
    // Find user by reset token and check expiry
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }
    
    // Set new password and clear reset token fields
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    res.status(200).json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error during password reset' });
  }
});

// @desc    Refresh access token with rotation
// @route   POST /api/users/refresh-token
// @access  Public (with refresh token)
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const clientIp = req.ip;
    const userAgent = req.headers['user-agent'];
    
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }
    
    // Verify refresh token and get new one with rotation
    try {
      const decoded = verifyRefreshToken(refreshToken);
      
      // Get user
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Rotate the refresh token (possible token theft detection)
      const { token: newRefreshToken } = rotateRefreshToken(refreshToken);
      
      // Generate new access token
      const accessToken = generateToken(user);
      
      // Log the token refresh
      await new SecurityAudit({
        eventType: 'TOKEN_REFRESH',
        user: user._id,
        ip: clientIp,
        userAgent,
        details: {
          tokenFamily: decoded.family
        },
        severity: 'INFO'
      }).save();
      
      // Set session timeout
      const sessionTimeoutMinutes = process.env.SESSION_TIMEOUT_MINUTES || 60;
      const expiresAt = new Date(Date.now() + sessionTimeoutMinutes * 60000);
      
      res.json({ 
        accessToken, 
        refreshToken: newRefreshToken,
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      // If there's a token verification error, it might be a token reuse attack
      // Log the security event
      await new SecurityAudit({
        eventType: 'SUSPICIOUS_ACTIVITY',
        ip: clientIp,
        userAgent,
        details: {
          activity: 'refresh_token_reuse',
          error: error.message
        },
        severity: 'WARNING'
      }).save();
      
      throw error;
    }
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

// @desc    Logout user with token revocation
// @route   POST /api/users/logout
// @access  Private
router.post('/logout', protect, trackSession, async (req, res) => {
  try {
    // Revoke the current access token
    if (req.token) {
      revokeToken(req.token);
    }
    
    // Remove session tracking
    if (req.user) {
      sessionManager.removeSession(req.user._id.toString(), req.token);
    }
    
    // Log the logout
    await new SecurityAudit({
      eventType: 'LOGOUT',
      user: req.user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        method: 'explicit'
      },
      severity: 'INFO'
    }).save();
    
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
});

// @desc    Logout from all devices
// @route   POST /api/users/logout-all
// @access  Private
router.post('/logout-all', protect, async (req, res) => {
  try {
    // Revoke all refresh tokens for the user
    revokeAllUserTokens(req.user._id.toString());
    
    // Clear all session tracking
    sessionManager.clearAllSessions(req.user._id.toString());
    
    // Log the action
    await new SecurityAudit({
      eventType: 'LOGOUT',
      user: req.user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        method: 'all_devices'
      },
      severity: 'INFO'
    }).save();
    
    res.status(200).json({ message: 'Logged out from all devices successfully' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ message: 'Server error during logout from all devices' });
  }
});

// @desc    Get active sessions
// @route   GET /api/users/sessions
// @access  Private
router.get('/sessions', protect, (req, res) => {
  try {
    const sessions = sessionManager.getActiveSessions(req.user._id.toString());
    
    // Don't send tokens back to client
    const sanitizedSessions = sessions.map(session => ({
      ip: session.ip,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      current: session.token === req.token
    }));
    
    res.status(200).json({
      sessions: sanitizedSessions,
      count: sanitizedSessions.length
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ message: 'Server error getting active sessions' });
  }
});

// @desc    Search for users
// @route   GET /api/users/search
// @access  Private
router.get('/search', protect, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }
    
    // Find users by username (partial match)
    const users = await User.find({
      username: { $regex: query, $options: 'i' },
      _id: { $ne: req.user._id } // Exclude current user
    })
    .select('_id username profile.displayName profile.avatar')
    .limit(10);
    
    res.json({ users });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ message: 'Server error searching users' });
  }
});

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('_id username profile.displayName profile.avatar');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error getting user' });
  }
});

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    await user.remove();
    res.json({ message: 'User removed' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error deleting user' });
  }
});

// @desc    Update user role
// @route   PUT /api/users/:id/role
// @access  Private/Admin
router.put('/:id/role', protect, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.role = role;
    await user.save();
    
    res.json({ message: `User role updated to ${role}` });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Server error updating user role' });
  }
});

// @desc    Setup two-factor authentication
// @route   POST /api/users/2fa/setup
// @access  Private
router.post('/2fa/setup', protect, requireEmailVerification, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Generate a new secret
    const secret = generateSecret(user.username);
    
    // Store the temporary secret
    user.twoFactorAuth.tempSecret = secret.base32;
    await user.save();
    
    // Generate a QR code for the secret
    const qrCode = await generateQRCode(secret.otpauth_url);
    
    res.json({
      message: 'Two-factor authentication setup initiated',
      secret: secret.base32,
      qrCode
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ message: 'Server error during 2FA setup' });
  }
});

// @desc    Verify and enable two-factor authentication
// @route   POST /api/users/2fa/verify
// @access  Private
router.post('/2fa/verify', protect, requireEmailVerification, async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user.twoFactorAuth.tempSecret) {
      return res.status(400).json({ message: 'Two-factor authentication not set up yet' });
    }
    
    // Verify the token against the temporary secret
    const isValid = verifyToken(token, user.twoFactorAuth.tempSecret);
    
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid verification code' });
    }
    
    // Enable 2FA and move the temporary secret to the permanent secret
    user.twoFactorAuth.enabled = true;
    user.twoFactorAuth.secret = user.twoFactorAuth.tempSecret;
    user.twoFactorAuth.tempSecret = null;
    
    // Generate recovery codes
    const recoveryCodes = generateRecoveryCodes();
    user.twoFactorAuth.recoveryCodes = recoveryCodes;
    
    await user.save();
    
    res.json({
      message: 'Two-factor authentication enabled successfully',
      recoveryCodes
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ message: 'Server error during 2FA verification' });
  }
});

// @desc    Disable two-factor authentication
// @route   POST /api/users/2fa/disable
// @access  Private
router.post('/2fa/disable', protect, async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id);
    
    // Require password to disable 2FA
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    
    // Disable 2FA
    user.twoFactorAuth.enabled = false;
    user.twoFactorAuth.secret = null;
    user.twoFactorAuth.recoveryCodes = [];
    
    await user.save();
    
    res.json({ message: 'Two-factor authentication disabled successfully' });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ message: 'Server error disabling 2FA' });
  }
});

// @desc    Verify with recovery code
// @route   POST /api/users/2fa/recovery
// @access  Public
router.post('/2fa/recovery', async (req, res) => {
  try {
    const { email, recoveryCode } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user || !user.twoFactorAuth.enabled) {
      return res.status(400).json({ message: 'Invalid request' });
    }
    
    // Check if the recovery code is valid
    const codeIndex = user.twoFactorAuth.recoveryCodes.findIndex(
      code => code === recoveryCode
    );
    
    if (codeIndex === -1) {
      return res.status(401).json({ message: 'Invalid recovery code' });
    }
    
    // Remove the used recovery code
    user.twoFactorAuth.recoveryCodes.splice(codeIndex, 1);
    await user.save();
    
    // Generate tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user._id);
    
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      profile: user.profile,
      twoFactorAuthEnabled: user.twoFactorAuth.enabled,
      accessToken,
      refreshToken,
      message: 'Recovery successful. Please generate new recovery codes.'
    });
  } catch (error) {
    console.error('Recovery code verification error:', error);
    res.status(500).json({ message: 'Server error during recovery' });
  }
});

// @desc    Generate new recovery codes
// @route   POST /api/users/2fa/recovery-codes
// @access  Private
router.post('/2fa/recovery-codes', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user.twoFactorAuth.enabled) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled' });
    }
    
    // Generate new recovery codes
    const recoveryCodes = generateRecoveryCodes();
    user.twoFactorAuth.recoveryCodes = recoveryCodes;
    
    await user.save();
    
    res.json({
      message: 'New recovery codes generated successfully',
      recoveryCodes
    });
  } catch (error) {
    console.error('Recovery codes generation error:', error);
    res.status(500).json({ message: 'Server error generating recovery codes' });
  }
});

// @desc    Get user warnings
// @route   GET /api/users/me/warnings
// @access  Private
router.get('/me/warnings', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return warnings from user document
    res.json(user.warnings?.history || []);
  } catch (error) {
    console.error('Get warnings error:', error);
    res.status(500).json({ message: 'Server error getting user warnings' });
  }
});

// @desc    Acknowledge a warning
// @route   POST /api/users/me/warnings/:warningId/acknowledge
// @access  Private
router.post('/me/warnings/:warningId/acknowledge', protect, async (req, res) => {
  try {
    const { warningId } = req.params;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Find the warning in the history
    if (!user.warnings || !user.warnings.history || user.warnings.history.length === 0) {
      return res.status(404).json({ message: 'Warning not found' });
    }
    
    // Find and update the warning
    const warningIndex = user.warnings.history.findIndex(
      warning => warning._id.toString() === warningId
    );
    
    if (warningIndex === -1) {
      return res.status(404).json({ message: 'Warning not found' });
    }
    
    // Mark the warning as acknowledged
    user.warnings.history[warningIndex].acknowledged = true;
    await user.save();
    
    res.json({ 
      message: 'Warning acknowledged successfully',
      warning: user.warnings.history[warningIndex]
    });
  } catch (error) {
    console.error('Acknowledge warning error:', error);
    res.status(500).json({ message: 'Server error acknowledging warning' });
  }
});

module.exports = router;