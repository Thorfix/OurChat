import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

// Create auth context
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requireTwoFactor, setRequireTwoFactor] = useState(false);
  const [twoFactorUserId, setTwoFactorUserId] = useState(null);
  
  // Check for existing user on mount
  useEffect(() => {
    const loadUser = async () => {
      const storedUser = localStorage.getItem('user');
      
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          
          // Set auth header for all future requests
          axios.defaults.headers.common['Authorization'] = `Bearer ${userData.accessToken.token}`;
          
          // Verify token is still valid by making a request to get user profile
          const { data } = await axios.get('/api/users/profile');
          
          // Update user data
          setCurrentUser({
            ...userData,
            ...data
          });
        } catch (error) {
          // Token might be expired or invalid
          console.error('Error loading authenticated user:', error);
          localStorage.removeItem('user');
          delete axios.defaults.headers.common['Authorization'];
        }
      }
      
      setLoading(false);
    };
    
    loadUser();
  }, []);
  
  // Register a new user
  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await axios.post('/api/users/register', userData);
      
      setLoading(false);
      return data;
    } catch (error) {
      setLoading(false);
      const message = 
        error.response && error.response.data.message
          ? error.response.data.message
          : 'Registration failed. Please try again.';
      
      setError(message);
      throw new Error(message);
    }
  };
  
  // Login user
  const login = async (email, password, totpToken = null) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await axios.post('/api/users/login', { 
        email, 
        password,
        totpToken
      });
      
      // Check if 2FA is required
      if (data.requireTwoFactorAuth) {
        setRequireTwoFactor(true);
        setTwoFactorUserId(data._id);
        setLoading(false);
        return data;
      }
      
      // If we got here, authentication is complete
      setRequireTwoFactor(false);
      setTwoFactorUserId(null);
      
      // Set current user
      setCurrentUser(data);
      
      // Store in localStorage
      localStorage.setItem('user', JSON.stringify(data));
      
      // Set auth header for all future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken.token}`;
      
      setLoading(false);
      return data;
    } catch (error) {
      setLoading(false);
      const message = 
        error.response && error.response.data.message
          ? error.response.data.message
          : 'Login failed. Please check your credentials.';
      
      setError(message);
      throw new Error(message);
    }
  };
  
  // Logout user
  const logout = async () => {
    try {
      // Call logout endpoint if needed
      if (currentUser && currentUser.accessToken) {
        await axios.post('/api/users/logout');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear user data regardless of server response
      setCurrentUser(null);
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
    }
  };
  
  // Verify email
  const verifyEmail = async (token) => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/api/users/verify-email/${token}`);
      setLoading(false);
      return data;
    } catch (error) {
      setLoading(false);
      const message = 
        error.response && error.response.data.message
          ? error.response.data.message
          : 'Email verification failed.';
      
      setError(message);
      throw new Error(message);
    }
  };
  
  // Request password reset
  const forgotPassword = async (email) => {
    try {
      setLoading(true);
      const { data } = await axios.post('/api/users/forgot-password', { email });
      setLoading(false);
      return data;
    } catch (error) {
      setLoading(false);
      const message = 
        error.response && error.response.data.message
          ? error.response.data.message
          : 'Password reset request failed.';
      
      setError(message);
      throw new Error(message);
    }
  };
  
  // Reset password
  const resetPassword = async (token, newPassword) => {
    try {
      setLoading(true);
      const { data } = await axios.post(`/api/users/reset-password/${token}`, { newPassword });
      setLoading(false);
      return data;
    } catch (error) {
      setLoading(false);
      const message = 
        error.response && error.response.data.message
          ? error.response.data.message
          : 'Password reset failed.';
      
      setError(message);
      throw new Error(message);
    }
  };
  
  // Update user profile
  const updateProfile = async (userData) => {
    try {
      setLoading(true);
      const { data } = await axios.put('/api/users/profile', userData);
      
      // Update current user
      setCurrentUser(prev => ({
        ...prev,
        ...data
      }));
      
      // Update localStorage
      const storedUser = JSON.parse(localStorage.getItem('user'));
      localStorage.setItem('user', JSON.stringify({
        ...storedUser,
        ...data
      }));
      
      setLoading(false);
      return data;
    } catch (error) {
      setLoading(false);
      const message = 
        error.response && error.response.data.message
          ? error.response.data.message
          : 'Profile update failed.';
      
      setError(message);
      throw new Error(message);
    }
  };
  
  // Refresh access token
  const refreshToken = async () => {
    try {
      if (!currentUser || !currentUser.refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const { data } = await axios.post('/api/users/refresh-token', {
        refreshToken: currentUser.refreshToken
      });
      
      // Update current user with new access token
      const updatedUser = {
        ...currentUser,
        accessToken: data.accessToken
      };
      
      setCurrentUser(updatedUser);
      
      // Update localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Update auth header
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken.token}`;
      
      return data.accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // If refresh fails, log the user out
      logout();
      throw new Error('Session expired. Please log in again.');
    }
  };
  
  // Verify with recovery code for 2FA
  const verifyRecoveryCode = async (email, recoveryCode) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await axios.post('/api/users/2fa/recovery', { 
        email, 
        recoveryCode 
      });
      
      // Set current user
      setCurrentUser(data);
      
      // Store in localStorage
      localStorage.setItem('user', JSON.stringify(data));
      
      // Set auth header for all future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken.token}`;
      
      setRequireTwoFactor(false);
      setTwoFactorUserId(null);
      setLoading(false);
      return data;
    } catch (error) {
      setLoading(false);
      const message = 
        error.response && error.response.data.message
          ? error.response.data.message
          : 'Recovery code verification failed.';
      
      setError(message);
      throw new Error(message);
    }
  };
  
  // Setup 2FA
  const setupTwoFactor = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await axios.post('/api/users/2fa/setup');
      
      setLoading(false);
      return data;
    } catch (error) {
      setLoading(false);
      const message = 
        error.response && error.response.data.message
          ? error.response.data.message
          : 'Two-factor authentication setup failed.';
      
      setError(message);
      throw new Error(message);
    }
  };
  
  // Verify and enable 2FA
  const verifyAndEnableTwoFactor = async (token) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await axios.post('/api/users/2fa/verify', { token });
      
      // Update user state to reflect 2FA is now enabled
      setCurrentUser(prev => ({
        ...prev,
        twoFactorAuthEnabled: true
      }));
      
      // Update localStorage
      const storedUser = JSON.parse(localStorage.getItem('user'));
      localStorage.setItem('user', JSON.stringify({
        ...storedUser,
        twoFactorAuthEnabled: true
      }));
      
      setLoading(false);
      return data;
    } catch (error) {
      setLoading(false);
      const message = 
        error.response && error.response.data.message
          ? error.response.data.message
          : 'Two-factor authentication verification failed.';
      
      setError(message);
      throw new Error(message);
    }
  };
  
  // Disable 2FA
  const disableTwoFactor = async (password) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await axios.post('/api/users/2fa/disable', { password });
      
      // Update user state to reflect 2FA is now disabled
      setCurrentUser(prev => ({
        ...prev,
        twoFactorAuthEnabled: false
      }));
      
      // Update localStorage
      const storedUser = JSON.parse(localStorage.getItem('user'));
      localStorage.setItem('user', JSON.stringify({
        ...storedUser,
        twoFactorAuthEnabled: false
      }));
      
      setLoading(false);
      return data;
    } catch (error) {
      setLoading(false);
      const message = 
        error.response && error.response.data.message
          ? error.response.data.message
          : 'Failed to disable two-factor authentication.';
      
      setError(message);
      throw new Error(message);
    }
  };
  
  // Generate new recovery codes
  const generateRecoveryCodes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await axios.post('/api/users/2fa/recovery-codes');
      
      setLoading(false);
      return data;
    } catch (error) {
      setLoading(false);
      const message = 
        error.response && error.response.data.message
          ? error.response.data.message
          : 'Failed to generate recovery codes.';
      
      setError(message);
      throw new Error(message);
    }
  };
  
  const value = {
    currentUser,
    loading,
    error,
    requireTwoFactor,
    twoFactorUserId,
    register,
    login,
    logout,
    verifyEmail,
    forgotPassword,
    resetPassword,
    updateProfile,
    refreshToken,
    setupTwoFactor,
    verifyAndEnableTwoFactor,
    disableTwoFactor,
    verifyRecoveryCode,
    generateRecoveryCodes
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};