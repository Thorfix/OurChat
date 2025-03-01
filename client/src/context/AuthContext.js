import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

// Create auth context
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Check for existing user on mount
  useEffect(() => {
    const loadUser = async () => {
      const storedUser = localStorage.getItem('user');
      
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          
          // Set auth header for all future requests
          axios.defaults.headers.common['Authorization'] = `Bearer ${userData.accessToken}`;
          
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
  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await axios.post('/api/users/login', { email, password });
      
      // Set current user
      setCurrentUser(data);
      
      // Store in localStorage
      localStorage.setItem('user', JSON.stringify(data));
      
      // Set auth header for all future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
      
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
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
      
      return data.accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // If refresh fails, log the user out
      logout();
      throw new Error('Session expired. Please log in again.');
    }
  };
  
  const value = {
    currentUser,
    loading,
    error,
    register,
    login,
    logout,
    verifyEmail,
    forgotPassword,
    resetPassword,
    updateProfile,
    refreshToken
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};