import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthContext';

const LoginContainer = styled.div`
  max-width: 500px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: rgba(0, 0, 0, 0.2);
  border: 2px solid var(--primary-color);
`;

const FormTitle = styled.h2`
  color: var(--primary-color);
  margin-bottom: 1.5rem;
  text-align: center;
  font-family: var(--font-header);
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  color: var(--text-color);
  font-size: 0.9rem;
`;

const Input = styled.input`
  padding: 0.75rem;
  background-color: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--primary-color);
  color: var(--text-color);
  font-family: var(--font-mono);
  
  &:focus {
    outline: none;
    border-color: var(--secondary-color);
  }
`;

const Button = styled.button`
  padding: 0.75rem;
  background-color: var(--primary-color);
  color: var(--background-color);
  border: none;
  cursor: pointer;
  font-family: var(--font-header);
  font-size: 1rem;
  margin-top: 1rem;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: var(--secondary-color);
  }
  
  &:disabled {
    background-color: #666;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: #ff6b6b;
  background-color: rgba(255, 107, 107, 0.1);
  padding: 0.75rem;
  margin-bottom: 1rem;
  border-left: 3px solid #ff6b6b;
`;

const LinkContainer = styled.div`
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.9rem;
  
  a {
    color: var(--primary-color);
    text-decoration: none;
    
    &:hover {
      color: var(--secondary-color);
      text-decoration: underline;
    }
  }
`;

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get redirect path from location state or default to home
  const redirect = location.state?.from || '/';
  
  const { login, loading, error, requireTwoFactor } = useContext(AuthContext);
  
  // If 2FA is required, redirect to the 2FA screen
  useEffect(() => {
    if (requireTwoFactor) {
      navigate('/two-factor-auth', { 
        state: { 
          email, 
          password,
          from: redirect 
        } 
      });
    }
  }, [requireTwoFactor, navigate, email, password, redirect]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    
    if (!email || !password) {
      setLocalError('Please enter both email and password');
      return;
    }
    
    try {
      await login(email, password);
      navigate(redirect);
    } catch (err) {
      // Error is already handled in the AuthContext
      // and will be available via the error state
    }
  };
  
  return (
    <LoginContainer>
      <FormTitle>Log In</FormTitle>
      
      {(error || localError) && (
        <ErrorMessage>{localError || error}</ErrorMessage>
      )}
      
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label htmlFor="email">Email Address</Label>
          <Input
            type="email"
            id="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormGroup>
        
        <FormGroup>
          <Label htmlFor="password">Password</Label>
          <Input
            type="password"
            id="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormGroup>
        
        <Button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Log In'}
        </Button>
      </Form>
      
      <LinkContainer>
        <p>Forgot password? <Link to="/forgot-password">Reset it here</Link></p>
        <p>Don't have an account? <Link to="/register">Register now</Link></p>
      </LinkContainer>
    </LoginContainer>
  );
};

export default LoginScreen;