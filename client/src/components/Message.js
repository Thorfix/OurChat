import React from 'react';
import styled from 'styled-components';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';

const MessageContainer = styled.div`
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  border-left: 3px solid ${props => 
    props.isOwnMessage ? 'var(--secondary-color)' : 'var(--primary-color)'};
  background-color: rgba(0, 0, 0, 0.3);
`;

const MessageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
`;

const Sender = styled.span`
  color: var(--secondary-color);
  font-weight: bold;
`;

const Timestamp = styled.span`
  color: #888;
  font-size: 0.8rem;
`;

const Content = styled.div`
  word-break: break-word;
  
  p {
    margin: 0 0 0.5rem 0;
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  code {
    background-color: rgba(0, 0, 0, 0.5);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-family: monospace;
  }
  
  pre {
    background-color: rgba(0, 0, 0, 0.5);
    padding: 0.5rem;
    border-radius: 3px;
    overflow-x: auto;
    margin: 0.5rem 0;
  }
  
  blockquote {
    border-left: 3px solid var(--secondary-color);
    margin: 0.5rem 0;
    padding-left: 0.5rem;
    font-style: italic;
  }
  
  ul, ol {
    padding-left: 1.5rem;
    margin: 0.5rem 0;
  }
  
  a {
    color: var(--secondary-color);
    text-decoration: underline;
    
    &:hover {
      text-decoration: none;
    }
  }
`;

const Message = ({ message, isOwnMessage = false }) => {
  const formattedTime = new Date(message.timestamp).toLocaleTimeString();
  
  return (
    <MessageContainer isOwnMessage={isOwnMessage}>
      <MessageHeader>
        <Sender>{message.sender || 'anonymous'}</Sender>
        <Timestamp>{formattedTime}</Timestamp>
      </MessageHeader>
      <Content>
        <ReactMarkdown>{DOMPurify.sanitize(message.content)}</ReactMarkdown>
      </Content>
    </MessageContainer>
  );
};

export default Message;