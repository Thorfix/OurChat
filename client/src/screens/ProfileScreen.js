import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthContext';
import TwoFactorSettings from '../components/TwoFactorSettings';

const ProfileContainer = styled.div`
  max-width: 600px;
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

const TextArea = styled.textarea`
  padding: 0.75rem;
  background-color: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--primary-color);
  color: var(--text-color);
  font-family: var(--font-mono);
  min-height: 100px;
  resize: vertical;
  
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

const UserInfo = styled.div`
  margin-bottom: 2rem;
  padding: 1rem;
  background-color: rgba(0, 0, 0, 0.3);
  border-left: 3px solid var(--primary-color);
`;

const UserInfoItem = styled.div`
  margin-bottom: 0.5rem;
  
  strong {
    color: var(--primary-color);
    margin-right: 0.5rem;
  }
`;

const RoleBadge = styled.span`
  background-color: ${props => {
    switch(props.role) {
      case 'admin':
        return '#e03131';
      case 'moderator':
        return '#5c940d';
      default:
        return '#4c6ef5';
    }
  }};
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.8rem;
  text-transform: uppercase;
`;

const ProfileScreen = () => {
  const { currentUser, updateProfile, loading, error } = useContext(AuthContext);
  
  const [username, setUsername] = useState(currentUser?.username || '');
  const [displayName, setDisplayName] = useState(currentUser?.profile?.displayName || '');
  const [bio, setBio] = useState(currentUser?.profile?.bio || '');
  const [avatar, setAvatar] = useState(currentUser?.profile?.avatar || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState('');
  
  const navigate = useNavigate();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSuccess('');
    
    // Validate form inputs
    if (password && password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }
    
    if (password && password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    
    // Prepare data to update
    const updateData = {
      username,
      displayName,
      bio,
      avatar
    };
    
    // Only include password if it's being changed
    if (password) {
      updateData.password = password;
    }
    
    try {
      await updateProfile(updateData);
      setSuccess('Profile updated successfully');
      
      // Clear password fields
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      // Error is handled in AuthContext
    }
  };
  
  if (!currentUser) {
    navigate('/login', { state: { from: '/profile' } });
    return null;
  }
  
  return (
    <ProfileContainer>
      <FormTitle>Your Profile</FormTitle>
      
      <UserInfo>
        <UserInfoItem>
          <strong>Email:</strong> {currentUser.email}
          {!currentUser.isEmailVerified && ' (unverified)'}
        </UserInfoItem>
        <UserInfoItem>
          <strong>Role:</strong> <RoleBadge role={currentUser.role}>{currentUser.role}</RoleBadge>
        </UserInfoItem>
        <UserInfoItem>
          <strong>Member since:</strong> {new Date(currentUser.createdAt).toLocaleDateString()}
        </UserInfoItem>
      </UserInfo>
      
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
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength="3"
          />
        </FormGroup>
        
        <FormGroup>
          <Label htmlFor="displayName">Display Name (optional)</Label>
          <Input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </FormGroup>
        
        <FormGroup>
          <Label htmlFor="bio">Bio (optional)</Label>
          <TextArea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us a bit about yourself..."
          />
        </FormGroup>
        
        <FormGroup>
          <Label htmlFor="avatar">Avatar URL (optional)</Label>
          <Input
            type="url"
            id="avatar"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://example.com/your-avatar.jpg"
          />
        </FormGroup>
        
        <h3 style={{ color: 'var(--primary-color)', marginTop: '1rem', fontFamily: 'var(--font-header)' }}>
          Change Password (leave blank to keep current password)
        </h3>
        
        <FormGroup>
          <Label htmlFor="password">New Password</Label>
          <Input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
          />
        </FormGroup>
        
        <FormGroup>
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
          />
        </FormGroup>
        
        <Button type="submit" disabled={loading}>
          {loading ? 'Updating...' : 'Update Profile'}
        </Button>
      </Form>
      
      <TwoFactorSettings />
    </ProfileContainer>
  );
};

export default ProfileScreen;