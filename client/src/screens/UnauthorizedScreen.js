import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

const Container = styled.div`
  max-width: 600px;
  margin: 4rem auto;
  text-align: center;
  padding: 2rem;
  background-color: rgba(0, 0, 0, 0.2);
  border: 2px solid var(--primary-color);
`;

const Title = styled.h1`
  color: var(--primary-color);
  font-family: var(--font-header);
  margin-bottom: 2rem;
`;

const Message = styled.p`
  margin-bottom: 2rem;
  font-size: 1.1rem;
  line-height: 1.5;
`;

const GlitchText = styled.div`
  color: #ff6b6b;
  font-size: 3rem;
  font-family: var(--font-mono);
  margin: 2rem 0;
  text-shadow: 0.05em 0 0 rgba(255, 0, 0, 0.75),
              -0.025em -0.05em 0 rgba(0, 255, 0, 0.75),
              0.025em 0.05em 0 rgba(0, 0, 255, 0.75);
  animation: glitch 1s infinite;
  
  @keyframes glitch {
    0% {
      text-shadow: 0.05em 0 0 rgba(255, 0, 0, 0.75),
                  -0.025em -0.05em 0 rgba(0, 255, 0, 0.75),
                  0.025em 0.05em 0 rgba(0, 0, 255, 0.75);
    }
    14% {
      text-shadow: 0.05em 0 0 rgba(255, 0, 0, 0.75),
                  -0.025em -0.05em 0 rgba(0, 255, 0, 0.75),
                  0.025em 0.05em 0 rgba(0, 0, 255, 0.75);
    }
    15% {
      text-shadow: -0.05em -0.025em 0 rgba(255, 0, 0, 0.75),
                  0.025em 0.025em 0 rgba(0, 255, 0, 0.75),
                  -0.05em -0.05em 0 rgba(0, 0, 255, 0.75);
    }
    49% {
      text-shadow: -0.05em -0.025em 0 rgba(255, 0, 0, 0.75),
                  0.025em 0.025em 0 rgba(0, 255, 0, 0.75),
                  -0.05em -0.05em 0 rgba(0, 0, 255, 0.75);
    }
    50% {
      text-shadow: 0.025em 0.05em 0 rgba(255, 0, 0, 0.75),
                  0.05em 0 0 rgba(0, 255, 0, 0.75),
                  0 -0.05em 0 rgba(0, 0, 255, 0.75);
    }
    99% {
      text-shadow: 0.025em 0.05em 0 rgba(255, 0, 0, 0.75),
                  0.05em 0 0 rgba(0, 255, 0, 0.75),
                  0 -0.05em 0 rgba(0, 0, 255, 0.75);
    }
    100% {
      text-shadow: -0.025em 0 0 rgba(255, 0, 0, 0.75),
                  -0.025em -0.025em 0 rgba(0, 255, 0, 0.75),
                  -0.025em -0.05em 0 rgba(0, 0, 255, 0.75);
    }
  }
`;

const Button = styled(Link)`
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background-color: var(--primary-color);
  color: var(--background-color);
  border: none;
  margin: 0.5rem;
  cursor: pointer;
  font-family: var(--font-header);
  font-size: 1rem;
  text-decoration: none;
  
  &:hover {
    background-color: var(--secondary-color);
  }
`;

const UnauthorizedScreen = () => {
  return (
    <Container>
      <Title>Access Denied</Title>
      <GlitchText>403</GlitchText>
      <Message>
        You don't have permission to access this page.
        <br />
        Please contact an administrator if you believe this is an error.
      </Message>
      <div>
        <Button to="/">Go to Home</Button>
        <Button to="/profile">Go to Profile</Button>
      </div>
    </Container>
  );
};

export default UnauthorizedScreen;