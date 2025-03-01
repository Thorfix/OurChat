import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import HomeScreen from './screens/HomeScreen';
import ChatScreen from './screens/ChatScreen';
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
  return (
    <Router>
      <AppContainer>
        <ScanLines />
        <Header />
        <Main>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/chat/:roomId" element={<ChatScreen />} />
          </Routes>
        </Main>
        <Footer />
      </AppContainer>
    </Router>
  );
};

export default App;