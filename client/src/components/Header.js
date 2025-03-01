import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthContext';
import { usePrivateMessaging } from '../context/PrivateMessagingContext';
import { FaLock, FaEnvelope } from 'react-icons/fa';

const HeaderContainer = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 2px solid var(--primary-color);
  margin-bottom: 2rem;
`;

const Logo = styled.h1`
  font-size: 2rem;
  color: var(--primary-color);
  margin: 0;
  text-shadow: 3px 3px var(--secondary-color);
  
  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`;

const Nav = styled.nav`
  display: flex;
  gap: 1.5rem;
  align-items: center;
`;

const NavLink = styled(Link)`
  color: var(--primary-color);
  font-family: var(--font-header);
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  
  &:hover {
    color: var(--secondary-color);
  }
`;

const MessagesBadge = styled.div`
  position: relative;
  
  span {
    position: absolute;
    top: -8px;
    right: -8px;
    background: var(--secondary-color);
    color: var(--background-color);
    border-radius: 50%;
    width: 16px;
    height: 16px;
    font-size: 0.7rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const PrivateMessagesLink = styled(NavLink)`
  position: relative;
  color: ${props => props.active ? 'var(--secondary-color)' : 'var(--primary-color)'};
  
  &::after {
    content: '';
    position: absolute;
    bottom: -3px;
    left: 0;
    width: 100%;
    height: 2px;
    background: ${props => props.active ? 'var(--secondary-color)' : 'transparent'};
  }
`;

const EncryptionPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.7rem;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.1rem 0.3rem;
  border-radius: 10px;
  margin-left: 0.3rem;
  color: ${props => props.active ? 'var(--success-color, #00ff00)' : 'var(--danger-color, #ff4444)'};
  border: 1px solid currentColor;
`;

const AuthButton = styled(Link)`
  background-color: var(--primary-color);
  color: var(--background-color);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-family: var(--font-header);
  
  &:hover {
    background-color: var(--secondary-color);
    color: var(--background-color);
  }
`;

const LogoutButton = styled.button`
  background-color: transparent;
  border: 1px solid var(--primary-color);
  color: var(--primary-color);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-family: var(--font-header);
  cursor: pointer;
  
  &:hover {
    background-color: var(--primary-color);
    color: var(--background-color);
  }
`;

const UserBadge = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-color);
`;

const Avatar = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
`;

const Header = () => {
  const { currentUser, logout } = useContext(AuthContext);
  const { encryptionStatus, totalUnreadCount } = usePrivateMessaging();
  
  const handleLogout = () => {
    logout();
  };
  
  return (
    <HeaderContainer>
      <Link to="/">
        <Logo>RetroChat</Logo>
      </Link>
      <Nav>
        <NavLink to="/">Home</NavLink>
        {currentUser && (
          <>
            <NavLink to="/chat/general">General</NavLink>
            <NavLink to="/chat/tech">Tech</NavLink>
            <NavLink to="/chat/random">Random</NavLink>
            <PrivateMessagesLink to="/messages" active={encryptionStatus === 'active'}>
              <MessagesBadge>
                <FaEnvelope />
                {totalUnreadCount > 0 && <span>{totalUnreadCount > 9 ? '9+' : totalUnreadCount}</span>}
              </MessagesBadge>
              Private Messages
              <EncryptionPill active={encryptionStatus === 'active'}>
                <FaLock size={10} /> {encryptionStatus === 'active' ? 'Encrypted' : 'Setup'}
              </EncryptionPill>
            </PrivateMessagesLink>
          </>
        )}
        
        {currentUser && currentUser.role === 'admin' && (
          <NavLink to="/admin">Admin</NavLink>
        )}
        
        {currentUser ? (
          <>
            <UserBadge to="/profile">
              <Avatar>
                {currentUser.username.charAt(0).toUpperCase()}
              </Avatar>
              {currentUser.username}
            </UserBadge>
            <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
          </>
        ) : (
          <>
            <NavLink to="/login">Login</NavLink>
            <AuthButton to="/register">Sign Up</AuthButton>
          </>
        )}
      </Nav>
    </HeaderContainer>
  );
};

export default Header;