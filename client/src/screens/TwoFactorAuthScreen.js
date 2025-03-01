import React, { useState, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthContext';

const Container = styled.div`
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

const Subtitle = styled.p`
  color: var(--text-color);
  margin-bottom: 1.5rem;
  text-align: center;
  font-size: 0.9rem;
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
  text-align: center;
  letter-spacing: 0.5rem;
  font-size: 1.2rem;
  
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

const RecoveryLink = styled.button`
  background: none;
  border: none;
  color: var(--primary-color);
  font-size: 0.9rem;
  cursor: pointer;
  text-decoration: underline;
  margin-top: 1rem;
  
  &:hover {
    color: var(--secondary-color);
  }
`;

const TwoFactorAuthScreen = () => {
  const [totpToken, setTotpToken] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [localError, setLocalError] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get redirect path from location state or default to home
  const redirect = location.state?.from || '/';
  
  const { 
    login, 
    error, 
    loading, 
    requireTwoFactor, 
    twoFactorUserId, 
    verifyRecoveryCode 
  } = useContext(AuthContext);
  
  // Get email from state or localStorage
  const email = location.state?.email || '';
  const password = location.state?.password || '';
  
  if (!email || !password) {
    // If we don't have email/password, redirect back to login
    navigate('/login');
  }
  
  const handleTotpSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    
    if (!totpToken) {
      setLocalError('Please enter the authentication code');
      return;
    }
    
    try {
      // Login with 2FA token
      await login(email, password, totpToken);
      navigate(redirect);
    } catch (err) {
      // Error is already handled in the AuthContext
    }
  };
  
  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    
    if (!recoveryCode) {
      setLocalError('Please enter a recovery code');
      return;
    }
    
    try {
      // Verify with recovery code
      await verifyRecoveryCode(email, recoveryCode);
      navigate(redirect);
    } catch (err) {
      // Error is already handled in the AuthContext
    }
  };
  
  const toggleRecoveryMode = () => {
    setUseRecoveryCode(!useRecoveryCode);
    setLocalError('');
  };
  
  return (
    <Container>
      <FormTitle>Two-Factor Authentication</FormTitle>
      
      {!useRecoveryCode ? (
        <>
          <Subtitle>
            Enter the 6-digit code from your authenticator app
          </Subtitle>
          
          {(error || localError) && (
            <ErrorMessage>{localError || error}</ErrorMessage>
          )}
          
          <Form onSubmit={handleTotpSubmit}>
            <FormGroup>
              <Label htmlFor="totpToken">Authentication Code</Label>
              <Input
                type="text"
                id="totpToken"
                placeholder="000000"
                maxLength="6"
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value.replace(/[^0-9]/g, ''))}
                autoComplete="one-time-code"
              />
            </FormGroup>
            
            <Button type="submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </Button>
          </Form>
          
          <RecoveryLink onClick={toggleRecoveryMode}>
            Use a recovery code instead
          </RecoveryLink>
        </>
      ) : (
        <>
          <Subtitle>
            Enter one of your recovery codes
          </Subtitle>
          
          {(error || localError) && (
            <ErrorMessage>{localError || error}</ErrorMessage>
          )}
          
          <Form onSubmit={handleRecoverySubmit}>
            <FormGroup>
              <Label htmlFor="recoveryCode">Recovery Code</Label>
              <Input
                type="text"
                id="recoveryCode"
                placeholder="XXXX-XXXX-XXXX"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                style={{ letterSpacing: '0.2rem' }}
              />
            </FormGroup>
            
            <Button type="submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Use Recovery Code'}
            </Button>
          </Form>
          
          <RecoveryLink onClick={toggleRecoveryMode}>
            Use authenticator app instead
          </RecoveryLink>
        </>
      )}
    </Container>
  );
};

export default TwoFactorAuthScreen;