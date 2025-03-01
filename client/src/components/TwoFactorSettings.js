import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthContext';

const Container = styled.div`
  border: 1px solid var(--primary-color);
  padding: 1.5rem;
  margin-top: 2rem;
  background-color: rgba(0, 0, 0, 0.2);
`;

const Title = styled.h3`
  color: var(--primary-color);
  margin-bottom: 1rem;
  font-family: var(--font-header);
`;

const Description = styled.p`
  color: var(--text-color);
  margin-bottom: 1.5rem;
  line-height: 1.5;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
`;

const Button = styled.button`
  padding: 0.75rem 1rem;
  background-color: ${(props) => (props.secondary ? 'transparent' : 'var(--primary-color)')};
  color: ${(props) => (props.secondary ? 'var(--primary-color)' : 'var(--background-color)')};
  border: ${(props) => (props.secondary ? '1px solid var(--primary-color)' : 'none')};
  cursor: pointer;
  font-family: var(--font-header);
  font-size: 0.9rem;
  transition: all 0.2s;
  
  &:hover {
    background-color: ${(props) => 
      props.secondary ? 'rgba(var(--primary-color-rgb), 0.1)' : 'var(--secondary-color)'};
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const DisableForm = styled.div`
  margin-top: 1.5rem;
  padding: 1.5rem;
  background-color: rgba(255, 107, 107, 0.1);
  border-left: 3px solid #ff6b6b;
`;

const FormGroup = styled.div`
  margin-bottom: 1rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  color: var(--text-color);
`;

const Input = styled.input`
  width: 100%;
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

const RecoveryCodes = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  margin: 1.5rem 0;
`;

const RecoveryCode = styled.div`
  background-color: rgba(0, 0, 0, 0.3);
  padding: 0.75rem 0.5rem;
  border-radius: 3px;
  font-family: var(--font-mono);
  text-align: center;
  font-size: 0.9rem;
  letter-spacing: 0.1rem;
`;

const Alert = styled.div`
  background-color: rgba(255, 209, 102, 0.1);
  color: #ffd166;
  padding: 1rem;
  margin: 1rem 0;
  border-left: 3px solid #ffd166;
  line-height: 1.5;
`;

const ErrorMessage = styled.div`
  color: #ff6b6b;
  margin-top: 0.5rem;
  font-size: 0.9rem;
`;

const SuccessMessage = styled.div`
  color: #6bff8f;
  margin-top: 0.5rem;
  font-size: 0.9rem;
`;

const TwoFactorSettings = () => {
  const { currentUser, disableTwoFactor, generateRecoveryCodes, loading, error } = useContext(AuthContext);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState('');
  const [newRecoveryCodes, setNewRecoveryCodes] = useState([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  
  const navigate = useNavigate();
  
  const handleSetup = () => {
    navigate('/2fa-setup');
  };
  
  const handleDisableClick = () => {
    setShowDisableForm(true);
    setLocalError('');
    setSuccess('');
  };
  
  const handleCancel = () => {
    setShowDisableForm(false);
    setPassword('');
  };
  
  const handleDisable = async (e) => {
    e.preventDefault();
    setLocalError('');
    
    if (!password) {
      setLocalError('Please enter your password');
      return;
    }
    
    try {
      await disableTwoFactor(password);
      setShowDisableForm(false);
      setPassword('');
      setSuccess('Two-factor authentication has been disabled.');
    } catch (err) {
      // Error is handled in the AuthContext
    }
  };
  
  const handleGenerateRecoveryCodes = async () => {
    setLocalError('');
    setSuccess('');
    setNewRecoveryCodes([]);
    
    try {
      const response = await generateRecoveryCodes();
      setNewRecoveryCodes(response.recoveryCodes);
      setShowRecoveryCodes(true);
    } catch (err) {
      // Error is handled in the AuthContext
    }
  };
  
  // Determine if 2FA is enabled for the current user
  const isTwoFactorEnabled = currentUser && currentUser.twoFactorAuthEnabled;
  
  return (
    <Container>
      <Title>Two-Factor Authentication</Title>
      
      <Description>
        Two-factor authentication adds an extra layer of security to your account by requiring
        a verification code in addition to your password when you sign in.
      </Description>
      
      {localError && <ErrorMessage>{localError}</ErrorMessage>}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}
      
      {isTwoFactorEnabled ? (
        <>
          <Description>
            <strong>Status:</strong> Enabled
          </Description>
          
          <ButtonGroup>
            <Button onClick={handleDisableClick}>Disable 2FA</Button>
            <Button secondary onClick={handleGenerateRecoveryCodes}>
              Generate New Recovery Codes
            </Button>
          </ButtonGroup>
          
          {showDisableForm && (
            <DisableForm>
              <p>Please enter your password to disable two-factor authentication:</p>
              <form onSubmit={handleDisable}>
                <FormGroup>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </FormGroup>
                
                <ButtonGroup>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Processing...' : 'Confirm Disable'}
                  </Button>
                  <Button type="button" secondary onClick={handleCancel}>
                    Cancel
                  </Button>
                </ButtonGroup>
              </form>
            </DisableForm>
          )}
          
          {showRecoveryCodes && newRecoveryCodes.length > 0 && (
            <>
              <Alert>
                <strong>New recovery codes generated.</strong> These codes replace any 
                previously generated codes. Please save these codes in a safe place.
              </Alert>
              
              <RecoveryCodes>
                {newRecoveryCodes.map((code, index) => (
                  <RecoveryCode key={index}>{code}</RecoveryCode>
                ))}
              </RecoveryCodes>
              
              <Button 
                secondary 
                onClick={() => setShowRecoveryCodes(false)}>
                Hide Recovery Codes
              </Button>
            </>
          )}
        </>
      ) : (
        <>
          <Description>
            <strong>Status:</strong> Disabled
          </Description>
          
          <ButtonGroup>
            <Button onClick={handleSetup}>Enable 2FA</Button>
          </ButtonGroup>
        </>
      )}
    </Container>
  );
};

export default TwoFactorSettings;