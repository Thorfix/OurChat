import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthContext';

const Container = styled.div`
  max-width: 600px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: rgba(0, 0, 0, 0.2);
  border: 2px solid var(--primary-color);
`;

const Title = styled.h2`
  color: var(--primary-color);
  margin-bottom: 1.5rem;
  text-align: center;
  font-family: var(--font-header);
`;

const Step = styled.div`
  margin-bottom: 2rem;
`;

const StepTitle = styled.h3`
  color: var(--secondary-color);
  margin-bottom: 1rem;
  font-family: var(--font-header);
`;

const StepContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const StepDescription = styled.p`
  color: var(--text-color);
  line-height: 1.5;
`;

const QRCodeContainer = styled.div`
  display: flex;
  justify-content: center;
  margin: 1.5rem 0;
  padding: 1rem;
  background-color: #fff;
  border-radius: 5px;
  width: fit-content;
  align-self: center;
`;

const QRCode = styled.img`
  width: 200px;
  height: 200px;
`;

const SecretKey = styled.div`
  background-color: rgba(0, 0, 0, 0.3);
  padding: 1rem;
  border-radius: 5px;
  font-family: var(--font-mono);
  letter-spacing: 0.1rem;
  text-align: center;
  margin: 1rem 0;
  word-break: break-all;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: 1.5rem;
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

const BackButton = styled.button`
  padding: 0.75rem;
  background-color: transparent;
  color: var(--text-color);
  border: 1px solid var(--text-color);
  cursor: pointer;
  font-family: var(--font-header);
  font-size: 1rem;
  margin-top: 1rem;
  transition: all 0.2s;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
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
  background-color: rgba(255, 107, 107, 0.1);
  padding: 0.75rem;
  margin-bottom: 1rem;
  border-left: 3px solid #ff6b6b;
`;

const SuccessMessage = styled.div`
  color: #6bff8f;
  background-color: rgba(107, 255, 143, 0.1);
  padding: 0.75rem;
  margin-bottom: 1rem;
  border-left: 3px solid #6bff8f;
`;

const TwoFactorSetupScreen = () => {
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [setupStep, setSetupStep] = useState(1);
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { setupTwoFactor, verifyAndEnableTwoFactor, loading, error } = useContext(AuthContext);
  
  // Fetch setup data when component mounts
  useEffect(() => {
    const initSetup = async () => {
      try {
        const data = await setupTwoFactor();
        setSetupData(data);
      } catch (err) {
        setLocalError('Failed to initialize two-factor authentication setup.');
      }
    };
    
    if (setupStep === 1) {
      initSetup();
    }
  }, [setupStep, setupTwoFactor]);
  
  const handleVerify = async (e) => {
    e.preventDefault();
    setLocalError('');
    
    if (!verificationCode) {
      setLocalError('Please enter the verification code');
      return;
    }
    
    try {
      const data = await verifyAndEnableTwoFactor(verificationCode);
      setRecoveryCodes(data.recoveryCodes);
      setSetupStep(3);
      setSuccess('Two-factor authentication has been successfully enabled!');
    } catch (err) {
      // Error is already handled in the AuthContext
    }
  };
  
  return (
    <Container>
      <Title>Two-Factor Authentication Setup</Title>
      
      {localError && <ErrorMessage>{localError}</ErrorMessage>}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}
      
      {setupStep === 1 && (
        <Step>
          <StepTitle>Step 1: Install an Authenticator App</StepTitle>
          <StepContent>
            <StepDescription>
              Two-factor authentication adds an extra layer of security to your account. 
              To use it, you'll need an authenticator app on your mobile device that 
              supports Time-based One-Time Password (TOTP).
            </StepDescription>
            
            <StepDescription>
              <strong>Recommended apps:</strong>
              <ul>
                <li>Google Authenticator (Android/iOS)</li>
                <li>Microsoft Authenticator (Android/iOS)</li>
                <li>Authy (Android/iOS/Desktop)</li>
              </ul>
            </StepDescription>
            
            <Button onClick={() => setSetupStep(2)} disabled={!setupData || loading}>
              {loading ? 'Loading...' : 'Continue'}
            </Button>
          </StepContent>
        </Step>
      )}
      
      {setupStep === 2 && setupData && (
        <Step>
          <StepTitle>Step 2: Scan the QR Code</StepTitle>
          <StepContent>
            <StepDescription>
              Open your authenticator app and scan the QR code below. The app will generate 
              a 6-digit code that changes every 30 seconds.
            </StepDescription>
            
            <QRCodeContainer>
              <QRCode src={setupData.qrCode} alt="QR Code for 2FA setup" />
            </QRCodeContainer>
            
            <StepDescription>
              If you can't scan the QR code, you can manually enter this key into your app:
            </StepDescription>
            
            <SecretKey>{setupData.secret}</SecretKey>
            
            <Form onSubmit={handleVerify}>
              <FormGroup>
                <Label htmlFor="verificationCode">Verification Code</Label>
                <Input
                  type="text"
                  id="verificationCode"
                  placeholder="000000"
                  maxLength="6"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </FormGroup>
              
              <Alert>
                Make sure to store your secret key in a safe place. If you lose 
                access to your authenticator app, you'll need it to regain access 
                to your account.
              </Alert>
              
              <Button type="submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Enable 2FA'}
              </Button>
              
              <BackButton type="button" onClick={() => setSetupStep(1)}>
                Back
              </BackButton>
            </Form>
          </StepContent>
        </Step>
      )}
      
      {setupStep === 3 && (
        <Step>
          <StepTitle>Step 3: Save Your Recovery Codes</StepTitle>
          <StepContent>
            <StepDescription>
              Here are your recovery codes. Store these somewhere safe. Each code can only be used once
              to regain access to your account if you lose your authenticator device.
            </StepDescription>
            
            <Alert>
              <strong>Important:</strong> Keep these recovery codes in a safe place! 
              They are the only way to regain access to your account if you lose 
              access to your authenticator app.
            </Alert>
            
            {recoveryCodes.length > 0 ? (
              <RecoveryCodes>
                {recoveryCodes.map((code, index) => (
                  <RecoveryCode key={index}>{code}</RecoveryCode>
                ))}
              </RecoveryCodes>
            ) : (
              <ErrorMessage>No recovery codes were generated. Please contact support.</ErrorMessage>
            )}
            
            <Button onClick={() => window.location.href = '/profile'}>
              Return to Profile
            </Button>
          </StepContent>
        </Step>
      )}
    </Container>
  );
};

export default TwoFactorSetupScreen;