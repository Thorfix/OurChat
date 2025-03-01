import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthContext';

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
  
  &:hover {
    color: var(--secondary-color);
  }
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
            <NavLink to="/messages" style={{ color: 'var(--secondary-color)' }}>
              Private Messages
            </NavLink>
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