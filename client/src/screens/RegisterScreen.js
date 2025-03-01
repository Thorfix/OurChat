import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthContext';

const RegisterContainer = styled.div`
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

const RegisterScreen = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState('');
  
  const navigate = useNavigate();
  
  const { register, loading, error } = useContext(AuthContext);
  
  const validateEmail = (email) => {
    const regex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return regex.test(email);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSuccess('');
    
    // Form validation
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }
    
    if (username.length < 3) {
      setLocalError('Username must be at least 3 characters');
      return;
    }
    
    if (!validateEmail(email)) {
      setLocalError('Please provide a valid email address');
      return;
    }
    
    try {
      const result = await register({ username, email, password });
      
      setSuccess(
        'Registration successful! Please check your email to verify your account.'
      );
      
      // Clear form
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      // Error is already handled in the AuthContext
    }
  };
  
  return (
    <RegisterContainer>
      <FormTitle>Create Account</FormTitle>
      
      {(error || localError) && (
        <ErrorMessage>{localError || error}</ErrorMessage>
      )}
      
      {success && <SuccessMessage>{success}</SuccessMessage>}
      
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label htmlFor="username">Username</Label>
          <Input
            type="text"
            id="username"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength="3"
          />
        </FormGroup>
        
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
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength="6"
          />
          <PasswordRequirements>
            <li>Password must be at least 6 characters long</li>
          </PasswordRequirements>
        </FormGroup>
        
        <FormGroup>
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            type="password"
            id="confirmPassword"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </FormGroup>
        
        <Button type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </Button>
      </Form>
      
      <LinkContainer>
        <p>Already have an account? <Link to="/login">Log in instead</Link></p>
      </LinkContainer>
    </RegisterContainer>
  );
};

export default RegisterScreen;