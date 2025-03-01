import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import { FaLock, FaArrowLeft, FaImage, FaTrash, FaHourglassEnd, FaClock, FaShieldAlt, FaExclamationTriangle, FaSync } from 'react-icons/fa';
import { usePrivateMessaging } from '../context/PrivateMessagingContext';
import { decryptMessage, decryptImage } from '../utils/encryptionUtils';

const PageContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 2px solid var(--primary-color);
`;

const BackButton = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary-color);
  text-decoration: none;
  
  &:hover {
    color: var(--secondary-color);
  }
`;

const RecipientInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
`;

const RecipientName = styled.h2`
  margin: 0;
  color: var(--secondary-color);
`;

const EncryptionIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: ${props => props.error ? 'var(--danger-color, #ff4444)' : 'var(--success-color, #00ff00)'};
  font-size: 0.8rem;
  border: 1px solid currentColor;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.2);
  margin-top: 0.3rem;
  animation: ${props => props.pulse ? 'pulseFade 2s infinite' : 'none'};
  
  @keyframes pulseFade {
    0% { opacity: 0.7; }
    50% { opacity: 1; }
    100% { opacity: 0.7; }
  }
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0;
  margin: 1rem 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
  padding: 1rem;
  
  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: var(--background-color);
  }
  
  &::-webkit-scrollbar-thumb {
    background: var(--primary-color);
  }
`;

const MessageBubble = styled.div`
  max-width: 75%;
  margin-bottom: 1rem;
  padding: 0.8rem;
  border-radius: 4px;
  position: relative;
  word-break: break-word;
  
  /* Position right if from self, left if from other */
  align-self: ${props => props.fromSelf ? 'flex-end' : 'flex-start'};
  margin-left: ${props => props.fromSelf ? 'auto' : '0'};
  margin-right: ${props => props.fromSelf ? '0' : 'auto'};
  
  /* Color based on sender */
  background-color: ${props => props.fromSelf ? 'rgba(var(--secondary-color-rgb), 0.2)' : 'rgba(var(--primary-color-rgb), 0.2)'};
  border-left: ${props => props.fromSelf ? 'none' : '3px solid var(--primary-color)'};
  border-right: ${props => props.fromSelf ? '3px solid var(--secondary-color)' : 'none'};
`;

const MessageTimestamp = styled.div`
  font-size: 0.75rem;
  color: #888;
  text-align: right;
  margin-top: 0.3rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.3rem;
`;

const MessageImage = styled.img`
  max-width: 100%;
  max-height: 200px;
  border: 2px solid black;
  margin-top: 0.5rem;
  display: block;
  background: #000;
  image-rendering: pixelated;
`;

const ExpirationBadge = styled.span`
  font-size: 0.75rem;
  background-color: rgba(var(--danger-color-rgb, 255, 68, 68), 0.2);
  color: var(--danger-color, #ff4444);
  padding: 0.2rem 0.4rem;
  border-radius: 2px;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  animation: ${props => props.expiringSoon ? 'blinkFade 1s infinite' : 'none'};
  
  @keyframes blinkFade {
    0% { opacity: 0.5; }
    50% { opacity: 1; }
    100% { opacity: 0.5; }
  }
`;

const MessageActions = styled.div`
  position: absolute;
  top: 0.3rem;
  right: 0.3rem;
  opacity: 0;
  transition: opacity 0.2s;
  
  ${MessageBubble}:hover & {
    opacity: 1;
  }
`;

const ActionButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  
  &:hover {
    color: var(--danger-color, #ff4444);
  }
`;

const MessageList = styled.div`
  display: flex;
  flex-direction: column;
`;

const MessageForm = styled.form`
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.2);
  padding: 1rem;
  border: 1px solid var(--primary-color);
`;

const MessageInput = styled.textarea`
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--primary-color);
  color: var(--text-color);
  padding: 0.8rem;
  font-family: var(--font-retro);
  resize: none;
  min-height: 80px;
  margin-bottom: 0.5rem;
  
  &:focus {
    outline: none;
    border-color: var(--secondary-color);
  }
`;

const FormControls = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SendButton = styled.button`
  background: var(--background-color);
  color: var(--primary-color);
  border: 2px solid var(--primary-color);
  padding: 0.5rem 1.5rem;
  font-family: var(--font-header);
  cursor: pointer;
  
  &:hover {
    background: var(--primary-color);
    color: var(--background-color);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FormOptions = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const ImageUploadButton = styled.button`
  background: none;
  border: none;
  color: var(--primary-color);
  display: flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  
  &:hover {
    color: var(--secondary-color);
  }
`;

const ExpirationSelector = styled.select`
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--primary-color);
  color: var(--text-color);
  padding: 0.3rem;
  font-family: var(--font-retro);
`;

const FileInput = styled.input`
  display: none;
`;

const ImagePreview = styled.div`
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  position: relative;
  display: inline-block;
  
  img {
    max-height: 100px;
    border: 1px solid var(--primary-color);
  }
  
  button {
    position: absolute;
    top: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.7);
    border: none;
    color: white;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    
    &:hover {
      background: var(--danger-color, #ff4444);
    }
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  opacity: 0.6;
  text-align: center;
  padding: 1rem;
  
  & svg {
    margin-bottom: 1rem;
    color: var(--primary-color);
  }
`;

const RetroGradientText = styled.h3`
  background: linear-gradient(to right, var(--primary-color), var(--secondary-color));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-bottom: 0.5rem;
`;

const StatusBar = styled.div`
  padding: 0.3rem 0.6rem;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid var(--primary-color);
  border-bottom: 1px solid var(--primary-color);
  font-size: 0.8rem;
  color: var(--text-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0.2rem 0;
`;

const StatusItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
`;

const RefreshButton = styled.button`
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  
  &:hover {
    color: var(--secondary-color);
    text-decoration: underline;
  }
`;

const DecryptionFailedMessage = styled.div`
  padding: 0.5rem;
  color: var(--danger-color, #ff4444);
  font-style: italic;
  font-size: 0.9rem;
`;

const PrivateMessageScreen = () => {
  const { userId } = useParams();
  const { keyPair, sendPrivateMessage } = usePrivateMessaging();
  const [messages, setMessages] = useState([]);
  const [recipient, setRecipient] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [expiration, setExpiration] = useState('0');
  const [decryptedContents, setDecryptedContents] = useState({});
  const [decryptedImages, setDecryptedImages] = useState({});
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Load messages when component mounts or userId changes
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Get recipient info
        const userResponse = await axios.get(`/api/users/${userId}`);
        setRecipient(userResponse.data);
        
        // Get messages
        const messagesResponse = await axios.get(`/api/private-messages/conversations/${userId}?page=${page}`);
        setMessages(messagesResponse.data.messages || []);
        setHasMore(page < messagesResponse.data.pagination.totalPages);
      } catch (error) {
        console.error('Error fetching messages:', error);
        setError('Failed to load messages');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (userId && keyPair) {
      fetchData();
    }
  }, [userId, keyPair, page]);
  
  // Decrypt messages when they change or when keyPair becomes available
  useEffect(() => {
    const decryptAllMessages = async () => {
      if (!keyPair || !keyPair.privateKey) return;
      
      const newDecryptedContents = { ...decryptedContents };
      const newDecryptedImages = { ...decryptedImages };
      
      for (const message of messages) {
        // Skip if already decrypted
        if (newDecryptedContents[message.id]) continue;
        
        try {
          // Decrypt message content
          const encryptedData = JSON.parse(message.encryptedContent);
          const decryptedContent = await decryptMessage(encryptedData, keyPair.privateKey);
          newDecryptedContents[message.id] = decryptedContent;
          
          // Decrypt image if present
          if (message.hasEncryptedImage && message.encryptedImageData) {
            try {
              const encryptedImageData = JSON.parse(message.encryptedImageData);
              const decryptedImage = await decryptImage(encryptedImageData, keyPair.privateKey);
              newDecryptedImages[message.id] = decryptedImage;
            } catch (imgError) {
              console.error('Error decrypting image:', imgError);
              newDecryptedImages[message.id] = null;
            }
          }
        } catch (error) {
          console.error('Error decrypting message:', error);
          newDecryptedContents[message.id] = null;
        }
      }
      
      setDecryptedContents(newDecryptedContents);
      setDecryptedImages(newDecryptedImages);
    };
    
    if (messages.length > 0 && keyPair) {
      decryptAllMessages();
    }
  }, [messages, keyPair, decryptedContents, decryptedImages]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, decryptedContents]);
  
  // Handle file upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file type and size
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validImageTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, GIF, WebP)');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setError('Image must be less than 5MB');
      return;
    }
    
    setImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };
  
  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Send a new message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if ((!newMessage.trim() && !imageFile) || !keyPair) return;
    
    try {
      let imageData = null;
      if (imageFile) {
        // Convert image to base64
        const reader = new FileReader();
        imageData = await new Promise((resolve, reject) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
      }
      
      // Convert expiration string to number or null
      const expirationMinutes = expiration === '0' ? null : parseInt(expiration);
      
      // Send message
      await sendPrivateMessage(
        userId,
        newMessage,
        imageData,
        expirationMinutes
      );
      
      // Reset form
      setNewMessage('');
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Reload messages
      const response = await axios.get(`/api/private-messages/conversations/${userId}?page=1`);
      setMessages(response.data.messages || []);
      setPage(1);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    }
  };
  
  // Delete a message
  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message? This cannot be undone.')) {
      return;
    }
    
    try {
      await axios.delete(`/api/private-messages/${messageId}`);
      // Remove from local state
      setMessages(messages.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
      setError('Failed to delete message');
    }
  };
  
  // Format date to readable format
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Calculate time until message expires with indicator for soon-to-expire
  const getExpirationTime = (expiresAt) => {
    if (!expiresAt) return { text: null, expiringSoon: false };
    
    const now = new Date();
    const expiry = new Date(expiresAt);
    const timeLeft = expiry - now;
    
    if (timeLeft <= 0) return { text: 'Expired', expiringSoon: false };
    
    // Flag messages expiring in less than 5 minutes
    const expiringSoon = timeLeft < 5 * 60 * 1000;
    
    const minutes = Math.floor(timeLeft / (1000 * 60));
    if (minutes < 60) return { 
      text: `${minutes}m left`, 
      expiringSoon 
    };
    
    const hours = Math.floor(minutes / 60);
    return { 
      text: `${hours}h ${minutes % 60}m left`,
      expiringSoon
    };
  };
  // Refresh decrypted messages and update UI
  const refreshMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`/api/private-messages/conversations/${userId}?page=${page}`);
      setMessages(response.data.messages || []);
      setHasMore(page < response.data.pagination.totalPages);
    } catch (error) {
      console.error('Error refreshing messages:', error);
      setError('Failed to refresh messages');
    } finally {
      setIsLoading(false);
    }
  }, [userId, page]);
  
  if (!keyPair) {
    return (
      <PageContainer>
        <EmptyState>
          <FaLock size={60} />
          <RetroGradientText>Encryption Keys Required</RetroGradientText>
          <p>Please generate encryption keys in your private messages section before continuing.</p>
          <Link to="/messages" style={{ color: 'var(--secondary-color)', marginTop: '1rem' }}>
            Go to Private Messages
          </Link>
        </EmptyState>
      </PageContainer>
    );
  }
  
  return (
    <PageContainer>
      <Header>
        <BackButton to="/messages">
          <FaArrowLeft /> Back to Conversations
        </BackButton>
        
        {recipient && (
          <RecipientInfo>
            <RecipientName>{recipient.username}</RecipientName>
            <EncryptionIndicator pulse={!error}>
              {error ? <FaExclamationTriangle /> : <FaShieldAlt />}
              {error ? 'Encryption Error' : 'End-to-End Encrypted'}
            </EncryptionIndicator>
          </RecipientInfo>
        )}
      </Header>
      
      <StatusBar>
        <StatusItem>
          <FaLock /> Private Conversation
        </StatusItem>
        <RefreshButton onClick={refreshMessages}>
          <FaSync /> Refresh
        </RefreshButton>
      </StatusBar>
      
      <MessagesContainer>
        {isLoading && <div>Loading messages...</div>}
        
        {error && <div>{error}</div>}
        
        {!isLoading && messages.length === 0 && (
          <EmptyState>
            <FaLock size={50} />
            <RetroGradientText>No messages yet</RetroGradientText>
            <p>Your conversation with {recipient?.username} will be end-to-end encrypted.</p>
            <p>Only you and {recipient?.username} can read these messages.</p>
          </EmptyState>
        )}
        
        <MessageList>
          {messages.map((message) => (
            <MessageBubble key={message.id} fromSelf={message.isFromSelf}>
              {decryptedContents[message.id] === undefined ? (
                'Decrypting message...'
              ) : decryptedContents[message.id] === null ? (
                <DecryptionFailedMessage>
                  This message cannot be decrypted. It may have been encrypted with a different key.
                </DecryptionFailedMessage>
              ) : (
                <>
                  <div>{decryptedContents[message.id]}</div>
                  
                  {message.hasEncryptedImage && (
                    decryptedImages[message.id] ? (
                      <MessageImage src={decryptedImages[message.id]} alt="Encrypted image" />
                    ) : (
                      <DecryptionFailedMessage>
                        Image cannot be decrypted.
                      </DecryptionFailedMessage>
                    )
                  )}
                  
                  <MessageTimestamp>
                    {formatTime(message.createdAt)}
                    
                    {message.expiresAt && (
                      () => {
                        const { text, expiringSoon } = getExpirationTime(message.expiresAt);
                        return (
                          <ExpirationBadge expiringSoon={expiringSoon}>
                            <FaClock /> {text}
                          </ExpirationBadge>
                        );
                      }
                    )()}
                    
                    {message.isRead && !message.isFromSelf && (
                      <span style={{ fontSize: '0.7rem', marginLeft: '0.3rem' }}>Read</span>
                    )}
                  </MessageTimestamp>
                  
                  <MessageActions>
                    <ActionButton 
                      onClick={() => handleDeleteMessage(message.id)}
                      title="Delete message"
                    >
                      <FaTrash />
                    </ActionButton>
                  </MessageActions>
                </>
              )}
            </MessageBubble>
          ))}
          <div ref={messagesEndRef} />
        </MessageList>
      </MessagesContainer>
      
      <MessageForm onSubmit={handleSendMessage}>
        {imagePreview && (
          <ImagePreview>
            <img src={imagePreview} alt="Upload preview" />
            <button type="button" onClick={removeImage} title="Remove image">
              <FaTrash />
            </button>
          </ImagePreview>
        )}
        
        <MessageInput
          placeholder="Type your encrypted message here..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        
        <FormControls>
          <FormOptions>
            <FileInput
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageUpload}
            />
            
            <ImageUploadButton 
              type="button" 
              onClick={() => fileInputRef.current.click()}
              title="Attach encrypted image"
            >
              <FaImage /> Image
            </ImageUploadButton>
            
            <div>
              <FaHourglassEnd />
              <ExpirationSelector 
                value={expiration} 
                onChange={(e) => setExpiration(e.target.value)}
                title="Message will self-destruct after this time"
              >
                <option value="0">No expiration</option>
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="1440">24 hours</option>
                <option value="10080">7 days</option>
              </ExpirationSelector>
            </div>
          </FormOptions>
          
          <SendButton 
            type="submit" 
            disabled={(!newMessage.trim() && !imageFile) || !keyPair}
          >
            Send Encrypted
          </SendButton>
        </FormControls>
      </MessageForm>
    </PageContainer>
  );
};

export default PrivateMessageScreen;