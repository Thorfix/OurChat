import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { FaBold, FaItalic, FaLink, FaCode, FaListUl, FaQuoteLeft, FaMarkdown, FaImage, FaTimes } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import axios from 'axios';
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

const ImageUploadContainer = styled.div`
  margin-bottom: 0.5rem;
  position: relative;
`;

const ImagePreview = styled.div`
  border: 1px dashed var(--primary-color);
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  position: relative;
  
  img {
    max-height: 100px;
    max-width: 200px;
    object-fit: contain;
    border: 2px solid black;
    background-color: black;
    opacity: 0.8;
    image-rendering: pixelated;
  }
`;

const ImageInfo = styled.div`
  margin-left: 1rem;
  font-size: 0.8rem;
`;

const RemoveImageButton = styled.button`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  
  &:hover {
    background: var(--primary-color);
  }
`;

const FileInput = styled.input`
  display: none;
`;

const UploadProgressBar = styled.div`
  height: 4px;
  background-color: rgba(255, 255, 255, 0.2);
  width: 100%;
  margin-top: 0.5rem;
  
  &::before {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.progress || 0}%;
    background-color: var(--primary-color);
    transition: width 0.2s;
  }
`;

const ErrorMessage = styled.div`
  color: var(--danger-color, #ff4444);
  font-size: 0.8rem;
  margin-top: 0.5rem;
`;

const Spinner = styled.div`
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: var(--primary-color);
  animation: spin 1s linear infinite;
  margin-right: 0.5rem;
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const ChatForm = ({ onSendMessage }) => {
  const [message, setMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  const MAX_LENGTH = 500;
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if ((message.trim() || uploadedImage) && message.length <= MAX_LENGTH) {
      onSendMessage(message, uploadedImage);
      setMessage('');
      setUploadedImage(null);
      setShowPreview(false);
      setUploadError('');
    }
  };
  
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
      return;
    }
    
    // Check file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image is too large. Maximum size is 2MB.');
      return;
    }
    
    setUploading(true);
    setUploadError('');
    setUploadProgress(0);
    
    // Create form data
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      // Get the auth token from localStorage
      const token = JSON.parse(localStorage.getItem('user'))?.accessToken?.token;
      
      // Set up axios with progress monitoring
      const response = await axios.post('/api/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        onUploadProgress: progressEvent => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      
      // Set the uploaded image data
      setUploadedImage({
        url: response.data.url,
        filename: response.data.filename,
        isFlagged: response.data.isFlagged,
        flagReason: response.data.flagReason
      });
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploadError(error.response?.data?.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };
  
  const removeImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
        <FormatButton 
          type="button" 
          onClick={() => fileInputRef.current.click()} 
          title="Attach Image"
          disabled={uploading || uploadedImage !== null}
        >
          {uploading ? <Spinner /> : <FaImage />} Image
        </FormatButton>
        <FileInput 
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleImageUpload}
          disabled={uploading}
        />
      </MarkdownButtons>
      
      {uploading && (
        <UploadProgressBar progress={uploadProgress} />
      )}
      
      {uploadError && (
        <ErrorMessage>{uploadError}</ErrorMessage>
      )}
      
      {uploadedImage && (
        <ImageUploadContainer>
          <ImagePreview>
            <img src={uploadedImage.url} alt="Uploaded content" />
            <ImageInfo>
              {uploadedImage.isFlagged && (
                <div style={{ color: 'var(--danger-color, #ff4444)' }}>
                  <small>⚠️ Flagged: {uploadedImage.flagReason}</small>
                </div>
              )}
              <div>
                <small>Image ready to send</small>
              </div>
            </ImageInfo>
            <RemoveImageButton onClick={removeImage} title="Remove image">
              <FaTimes />
            </RemoveImageButton>
          </ImagePreview>
        </ImageUploadContainer>
      )}
      
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
        placeholder={uploadedImage ? "Add a message (optional) or just send the image..." : "Type your message here... (Markdown supported)"}
        maxLength={MAX_LENGTH}
      />
      
      <ButtonContainer>
        <CharCounter isNearLimit={message.length > MAX_LENGTH * 0.8}>
          {message.length}/{MAX_LENGTH}
        </CharCounter>
        <SendButton 
          type="submit" 
          disabled={(!(message.trim() || uploadedImage)) || message.length > MAX_LENGTH || uploading}
        >
          Send Message
        </SendButton>
      </ButtonContainer>
    </FormContainer>
  );
};

export default ChatForm;