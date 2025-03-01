import React, { useState } from 'react';
import styled from 'styled-components';
import { FaBold, FaItalic, FaLink, FaCode, FaListUl, FaQuoteLeft, FaMarkdown } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import MarkdownGuide from './MarkdownGuide';

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

const MarkdownButtons = styled.div`
  display: flex;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
`;

const FormatButton = styled.button`
  background-color: var(--background-color);
  color: var(--text-color);
  border: 1px solid var(--primary-color);
  margin-right: 0.5rem;
  margin-bottom: 0.3rem;
  padding: 0.3rem 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s;
  
  &:hover {
    background-color: var(--primary-color);
    color: var(--background-color);
  }
  
  svg {
    margin-right: 0.2rem;
  }
`;

const PreviewContainer = styled.div`
  border: 1px dashed var(--primary-color);
  padding: 0.8rem;
  margin-bottom: 0.5rem;
  background-color: rgba(0, 0, 0, 0.3);
  max-height: 200px;
  overflow-y: auto;
  
  p {
    margin: 0.5rem 0;
  }
  
  code {
    background-color: rgba(0, 0, 0, 0.5);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-family: monospace;
  }
`;

const PreviewToggle = styled.button`
  background: none;
  border: none;
  color: var(--secondary-color);
  cursor: pointer;
  font-size: 0.8rem;
  text-decoration: underline;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  
  svg {
    margin-right: 0.3rem;
  }
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
  const [showPreview, setShowPreview] = useState(false);
  const MAX_LENGTH = 500;
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && message.length <= MAX_LENGTH) {
      onSendMessage(message);
      setMessage('');
      setShowPreview(false);
    }
  };
  
  const insertMarkdown = (markdownSyntax, selectionOffset = 0) => {
    const textarea = document.querySelector('textarea');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    
    let replacement;
    
    // If text is selected, wrap it with markdown syntax
    if (selectedText) {
      replacement = markdownSyntax.replace('text', selectedText);
    } else {
      replacement = markdownSyntax;
    }
    
    const newMessage = message.substring(0, start) + replacement + message.substring(end);
    setMessage(newMessage);
    
    // Set cursor position based on selection offset
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + selectionOffset + (selectedText ? selectedText.length : 0);
      textarea.setSelectionRange(newPosition, newPosition);
    }, 10);
  };
  
  const formatBold = () => insertMarkdown('**text**', selectedText => selectedText ? selectedText.length + 4 : 2);
  const formatItalic = () => insertMarkdown('*text*', selectedText => selectedText ? selectedText.length + 2 : 1);
  const formatLink = () => insertMarkdown('[text](url)', selectedText => selectedText ? selectedText.length + 7 : 1);
  const formatCode = () => insertMarkdown('`text`', selectedText => selectedText ? selectedText.length + 2 : 1);
  const formatCodeBlock = () => insertMarkdown('```\ntext\n```', selectedText => selectedText ? selectedText.length + 8 : 4);
  const formatList = () => insertMarkdown('- text\n- ', selectedText => selectedText ? selectedText.length + 6 : 2);
  const formatQuote = () => insertMarkdown('> text', selectedText => selectedText ? selectedText.length + 2 : 2);
  
  return (
    <FormContainer onSubmit={handleSubmit}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <PreviewToggle onClick={() => setShowPreview(!showPreview)}>
          <FaMarkdown />
          {showPreview ? 'Hide Preview' : 'Show Markdown Preview'}
        </PreviewToggle>
        <MarkdownGuide />
      </div>
      
      <MarkdownButtons>
        <FormatButton type="button" onClick={formatBold} title="Bold">
          <FaBold /> Bold
        </FormatButton>
        <FormatButton type="button" onClick={formatItalic} title="Italic">
          <FaItalic /> Italic
        </FormatButton>
        <FormatButton type="button" onClick={formatLink} title="Link">
          <FaLink /> Link
        </FormatButton>
        <FormatButton type="button" onClick={formatCode} title="Inline Code">
          <FaCode /> Code
        </FormatButton>
        <FormatButton type="button" onClick={formatCodeBlock} title="Code Block">
          <FaCode /> Block
        </FormatButton>
        <FormatButton type="button" onClick={formatList} title="List">
          <FaListUl /> List
        </FormatButton>
        <FormatButton type="button" onClick={formatQuote} title="Quote">
          <FaQuoteLeft /> Quote
        </FormatButton>
      </MarkdownButtons>
      
      {showPreview && message.trim() && (
        <PreviewContainer>
          <ReactMarkdown>
            {DOMPurify.sanitize(message)}
          </ReactMarkdown>
        </PreviewContainer>
      )}
      
      <TextArea 
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message here... (Markdown supported)"
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