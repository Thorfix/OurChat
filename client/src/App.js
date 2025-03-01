import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import Header from './components/Header';
import Footer from './components/Footer';
import HomeScreen from './screens/HomeScreen';
import ChatScreen from './screens/ChatScreen';
import AdminScreen from './screens/AdminScreen';
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
    <Router>
      <AppContainer>
        <ScanLines />
        <Header />
        <Main>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/chat/:roomId" element={<ChatScreen />} />
            <Route path="/admin" element={<AdminScreen />} />
          </Routes>
        </Main>
        <Footer />
      </AppContainer>
    </Router>
  );
};

export default App;