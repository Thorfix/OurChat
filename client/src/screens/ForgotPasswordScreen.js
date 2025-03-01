import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
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

const SuccessMessage = styled.div`
  color: #51cf66;
  background-color: rgba(81, 207, 102, 0.1);
  padding: 0.75rem;
  margin-bottom: 1rem;
  border-left: 3px solid #51cf66;
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

const Description = styled.p`
  margin-bottom: 1.5rem;
  color: var(--text-color);
  font-size: 0.9rem;
`;

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { forgotPassword, loading, error } = useContext(AuthContext);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSuccess('');
    
    if (!email) {
      setLocalError('Please enter your email address');
      return;
    }
    
    try {
      const result = await forgotPassword(email);
      setSuccess('Password reset instructions have been sent to your email.');
      setEmail('');
    } catch (err) {
      // Error is already handled in AuthContext
    }
  };
  
  return (
    <Container>
      <FormTitle>Reset Password</FormTitle>
      
      <Description>
        Enter your email address below, and we'll send you instructions to reset your password.
      </Description>
      
      {(error || localError) && (
        <ErrorMessage>{localError || error}</ErrorMessage>
      )}
      
      {success && <SuccessMessage>{success}</SuccessMessage>}
      
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
        
        <Button type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </Button>
      </Form>
      
      <LinkContainer>
        <p>Remember your password? <Link to="/login">Back to Login</Link></p>
      </LinkContainer>
    </Container>
  );
};

export default ForgotPasswordScreen;