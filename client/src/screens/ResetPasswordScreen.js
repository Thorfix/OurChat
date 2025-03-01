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

const PasswordRequirements = styled.ul`
  list-style-type: none;
  padding: 0.5rem 0;
  font-size: 0.8rem;
  color: #888;
  
  li {
    margin-bottom: 0.25rem;
  }
`;

const ResetPasswordScreen = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get token from URL query parameters
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');
  
  const { resetPassword, loading, error } = useContext(AuthContext);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSuccess('');
    
    if (!token) {
      setLocalError('Reset token is missing. Please use the link from your email.');
      return;
    }
    
    if (newPassword.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    
    try {
      const result = await resetPassword(token, newPassword);
      setSuccess('Password has been reset successfully!');
      
      // Clear form
      setNewPassword('');
      setConfirmPassword('');
      
      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      // Error is already handled in AuthContext
    }
  };
  
  // If no token is provided, show error and link to the forgot password page
  if (!token) {
    return (
      <Container>
        <FormTitle>Reset Password</FormTitle>
        <ErrorMessage>
          Reset token is missing. Please request a new password reset email.
        </ErrorMessage>
        <LinkContainer>
          <p><Link to="/forgot-password">Request Password Reset</Link></p>
          <p><Link to="/login">Back to Login</Link></p>
        </LinkContainer>
      </Container>
    );
  }
  
  return (
    <Container>
      <FormTitle>Reset Password</FormTitle>
      
      {(error || localError) && (
        <ErrorMessage>{localError || error}</ErrorMessage>
      )}
      
      {success && <SuccessMessage>{success}</SuccessMessage>}
      
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            type="password"
            id="newPassword"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength="6"
          />
          <PasswordRequirements>
            <li>Password must be at least 6 characters long</li>
          </PasswordRequirements>
        </FormGroup>
        
        <FormGroup>
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            type="password"
            id="confirmPassword"
            placeholder="Confirm your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </FormGroup>
        
        <Button type="submit" disabled={loading}>
          {loading ? 'Resetting...' : 'Reset Password'}
        </Button>
      </Form>
      
      <LinkContainer>
        <p><Link to="/login">Back to Login</Link></p>
      </LinkContainer>
    </Container>
  );
};

export default ResetPasswordScreen;