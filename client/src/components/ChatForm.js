import React, { useState } from 'react';
import styled from 'styled-components';

const FormContainer = styled.form`
  display: flex;
  flex-direction: column;
  margin-top: 1rem;
`;

const TextArea = styled.textarea`
  background-color: var(--background-color);
  color: var(--text-color);
  border: 2px solid var(--primary-color);
  padding: 0.8rem;
  font-family: var(--font-retro);
  font-size: 1rem;
  resize: vertical;
  min-height: 80px;
  margin-bottom: 0.5rem;
  
  &:focus {
    outline: none;
    border-color: var(--secondary-color);
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: space-between;
`;

const SendButton = styled.button`
  background-color: var(--background-color);
  color: var(--primary-color);
  border: 2px solid var(--primary-color);
  padding: 0.5rem 1.5rem;
  font-family: var(--font-header);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  
  &:hover {
    background-color: var(--primary-color);
    color: var(--background-color);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CharCounter = styled.span`
  font-size: 0.8rem;
  color: ${props => props.isNearLimit ? 'var(--secondary-color)' : 'var(--text-color)'};
`;

const ChatForm = ({ onSendMessage }) => {
  const [message, setMessage] = useState('');
  const MAX_LENGTH = 500;
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && message.length <= MAX_LENGTH) {
      onSendMessage(message);
      setMessage('');
    }
  };
  
  return (
    <FormContainer onSubmit={handleSubmit}>
      <TextArea 
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message here..."
        maxLength={MAX_LENGTH}
      />
      <ButtonContainer>
        <CharCounter isNearLimit={message.length > MAX_LENGTH * 0.8}>
          {message.length}/{MAX_LENGTH}
        </CharCounter>
        <SendButton type="submit" disabled={!message.trim() || message.length > MAX_LENGTH}>
          Send Message
        </SendButton>
      </ButtonContainer>
    </FormContainer>
  );
};

export default ChatForm;