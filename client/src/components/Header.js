import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

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
`;

const NavLink = styled(Link)`
  color: var(--primary-color);
  font-family: var(--font-header);
  font-size: 1rem;
  
  &:hover {
    color: var(--secondary-color);
  }
`;

const Header = () => {
  return (
    <HeaderContainer>
      <Link to="/">
        <Logo>RetroChat</Logo>
      </Link>
      <Nav>
        <NavLink to="/">Home</NavLink>
        <NavLink to="/chat/general">General</NavLink>
        <NavLink to="/chat/tech">Tech</NavLink>
        <NavLink to="/chat/random">Random</NavLink>
      </Nav>
    </HeaderContainer>
  );
};

export default Header;