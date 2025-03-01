import React from 'react';
import styled from 'styled-components';

const FooterContainer = styled.footer`
  text-align: center;
  padding: 1rem;
  border-top: 2px solid var(--primary-color);
  margin-top: 2rem;
  font-family: var(--font-header);
  font-size: 0.7rem;
`;

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <FooterContainer>
      <p>&copy; {currentYear} RetroChat - All your chats are anonymous</p>
      <p>Made with ♥ for the retro web</p>
    </FooterContainer>
  );
};

export default Footer;