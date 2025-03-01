import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import Header from './components/Header';
import Footer from './components/Footer';
import HomeScreen from './screens/HomeScreen';
import ChatScreen from './screens/ChatScreen';
import AdminScreen from './screens/AdminScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ProfileScreen from './screens/ProfileScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import VerifyEmailScreen from './screens/VerifyEmailScreen';
import UnauthorizedScreen from './screens/UnauthorizedScreen';
import TwoFactorAuthScreen from './screens/TwoFactorAuthScreen';
import TwoFactorSetupScreen from './screens/TwoFactorSetupScreen';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import styled from 'styled-components';

// Styled components
const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const Main = styled.main`
  flex: 1;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
`;

// Scanlines effect for retro look
const ScanLines = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.1) 50%,
    rgba(0, 0, 0, 0) 100%
  );
  background-size: 100% 4px;
  z-index: 999;
  pointer-events: none;
  opacity: 0.3;
`;

const App = () => {
  // Configure axios defaults
  useEffect(() => {
    // Set base URL for API calls - this assumes the API is running on the same host in development
    axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  }, []);

  return (
    <AuthProvider>
      <Router>
        <AppContainer>
          <ScanLines />
          <Header />
          <Main>
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/chat/:roomId" element={
                <ProtectedRoute>
                  <ChatScreen />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin', 'moderator']}>
                  <AdminScreen />
                </ProtectedRoute>
              } />
              <Route path="/login" element={<LoginScreen />} />
              <Route path="/register" element={<RegisterScreen />} />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <ProfileScreen />
                </ProtectedRoute>
              } />
              <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
              <Route path="/reset-password" element={<ResetPasswordScreen />} />
              <Route path="/verify-email" element={<VerifyEmailScreen />} />
              <Route path="/unauthorized" element={<UnauthorizedScreen />} />
              <Route path="/two-factor-auth" element={<TwoFactorAuthScreen />} />
              <Route path="/2fa-setup" element={
                <ProtectedRoute>
                  <TwoFactorSetupScreen />
                </ProtectedRoute>
              } />
            </Routes>
          </Main>
          <Footer />
        </AppContainer>
      </Router>
    </AuthProvider>
  );
};

export default App;