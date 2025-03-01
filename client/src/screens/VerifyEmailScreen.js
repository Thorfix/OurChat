import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthContext';

const Container = styled.div`
  max-width: 500px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: rgba(0, 0, 0, 0.2);
  border: 2px solid var(--primary-color);
  text-align: center;
`;

const Title = styled.h2`
  color: var(--primary-color);
  margin-bottom: 1.5rem;
  font-family: var(--font-header);
`;

const Message = styled.p`
  margin-bottom: 1.5rem;
  color: var(--text-color);
  line-height: 1.5;
`;

const ErrorMessage = styled.div`
  color: #ff6b6b;
  background-color: rgba(255, 107, 107, 0.1);
  padding: 0.75rem;
  margin: 1rem 0;
  border-left: 3px solid #ff6b6b;
  text-align: left;
`;

const SuccessMessage = styled.div`
  color: #51cf66;
  background-color: rgba(81, 207, 102, 0.1);
  padding: 0.75rem;
  margin: 1rem 0;
  border-left: 3px solid #51cf66;
  text-align: left;
`;

const Button = styled(Link)`
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background-color: var(--primary-color);
  color: var(--background-color);
  border: none;
  cursor: pointer;
  font-family: var(--font-header);
  font-size: 1rem;
  margin-top: 1rem;
  text-decoration: none;
  
  &:hover {
    background-color: var(--secondary-color);
  }
`;

const LinkContainer = styled.div`
  margin-top: 1.5rem;
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

const VerifyEmailScreen = () => {
  const [isVerifying, setIsVerifying] = useState(true);
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get token from URL query parameters
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');
  
  const { verifyEmail, loading, error } = useContext(AuthContext);
  
  useEffect(() => {
    if (!token) {
      setIsVerifying(false);
      setLocalError('Verification token is missing. Please use the link from your email.');
      return;
    }
    
    const verifyUserEmail = async () => {
      try {
        const result = await verifyEmail(token);
        setSuccess('Your email has been verified successfully!');
        setIsVerifying(false);
        
        // Redirect to login after a short delay
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } catch (err) {
        setIsVerifying(false);
      }
    };
    
    verifyUserEmail();
  }, [token, verifyEmail, navigate]);
  
  return (
    <Container>
      <Title>Email Verification</Title>
      
      {isVerifying ? (
        <Message>Verifying your email address... Please wait.</Message>
      ) : (
        <>
          {(error || localError) ? (
            <>
              <ErrorMessage>{localError || error}</ErrorMessage>
              <Message>
                There was a problem verifying your email address. The verification link may be expired or invalid.
              </Message>
              <LinkContainer>
                <p>
                  <Link to="/login">Go to Login</Link> or request a 
                  <Link to="/resend-verification"> new verification email</Link>
                </p>
              </LinkContainer>
            </>
          ) : (
            <>
              <SuccessMessage>{success}</SuccessMessage>
              <Message>
                Your email has been verified. You can now log in to your account.
              </Message>
              <Button to="/login">Log In</Button>
            </>
          )}
        </>
      )}
    </Container>
  );
};

export default VerifyEmailScreen;