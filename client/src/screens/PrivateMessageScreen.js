import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import { 
  FaLock, FaArrowLeft, FaImage, FaTrash, FaHourglassEnd, FaClock, 
  FaShieldAlt, FaExclamationTriangle, FaSync, FaCheckCircle, 
  FaTimesCircle, FaQuestionCircle, FaKey, FaFingerprint, FaBell
} from 'react-icons/fa';
import { usePrivateMessaging } from '../context/PrivateMessagingContext';
import { 
  decryptMessage, 
  decryptImage, 
  generateKeyFingerprint, 
  VERIFICATION_STATUS 
} from '../utils/encryptionUtils';

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
  color: ${props => {
    if (props.error) return 'var(--danger-color, #ff4444)';
    if (props.warning) return 'var(--warning-color, #ffbb00)';
    if (props.verified) return 'var(--verified-color, #00cc00)';
    return 'var(--success-color, #00aa00)';
  }};
  font-size: 0.8rem;
  border: 1px solid currentColor;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.2);
  margin-top: 0.3rem;
  animation: ${props => {
    if (props.pulse) return 'pulseFade 2s infinite';
    if (props.warning) return 'warningPulse 1.5s infinite';
    return 'none';
  }};
  cursor: pointer;
  
  @keyframes pulseFade {
    0% { opacity: 0.7; }
    50% { opacity: 1; }
    100% { opacity: 0.7; }
  }
  
  @keyframes warningPulse {
    0% { opacity: 0.8; background: rgba(255, 187, 0, 0.1); }
    50% { opacity: 1; background: rgba(255, 187, 0, 0.2); }
    100% { opacity: 0.8; background: rgba(255, 187, 0, 0.1); }
  }
  
  &:hover {
    background: rgba(0, 0, 0, 0.4);
  }
`;

const VerificationBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  margin-left: 0.5rem;
  background: ${props => {
    if (props.verified) return 'rgba(0, 204, 0, 0.15)';
    if (props.mismatch) return 'rgba(255, 68, 68, 0.15)';
    return 'rgba(255, 255, 255, 0.1)';
  }};
  color: ${props => {
    if (props.verified) return 'var(--verified-color, #00cc00)';
    if (props.mismatch) return 'var(--danger-color, #ff4444)';
    return 'var(--text-color)';
  }};
  border: 1px solid currentColor;
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

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: var(--background-color);
  border: 2px solid var(--primary-color);
  padding: 2rem;
  max-width: 500px;
  width: 90%;
`;

const ModalTitle = styled.h3`
  color: var(--primary-color);
  margin-top: 0;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 1.5rem;
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  background: ${props => props.primary ? 'var(--primary-color)' : 'transparent'};
  color: ${props => props.primary ? 'var(--background-color)' : 'var(--text-color)'};
  border: 1px solid var(--primary-color);
  cursor: pointer;
  font-family: var(--font-retro);
  
  &:hover {
    background: ${props => props.primary ? 'var(--secondary-color)' : 'rgba(255, 255, 255, 0.1)'};
  }
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

const TypingIndicator = styled.div`
  font-size: 0.8rem;
  color: var(--secondary-color);
  padding: 0.5rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  @keyframes blink {
    0% { opacity: 0.2; }
    20% { opacity: 1; }
    100% { opacity: 0.2; }
  }
  
  .dot {
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: currentColor;
    animation: blink 1.4s infinite;
    animation-fill-mode: both;
  }
  
  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }
`;

const PrivateMessageScreen = () => {
  const { userId } = useParams();
  const { keyPair, keyFingerprint, sendPrivateMessage, getRecipientPublicKey, socket } = usePrivateMessaging();
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
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const [typingTimeoutId, setTypingTimeoutId] = useState(null);
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
  
  // Clean up typing indicator when component unmounts
  useEffect(() => {
    return () => {
      // Clear any existing typing timeout
      if (typingTimeoutId) {
        clearTimeout(typingTimeoutId);
      }
      
      // Notify that we stopped typing when leaving the chat
      if (userId) {
        axios.post('/api/private-messages/typing', {
          recipientId: userId,
          isTyping: false
        }).catch(err => console.error('Error clearing typing status', err));
      }
    };
  }, [typingTimeoutId, userId]);
  
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
  
  // Enhanced state for key verification modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [recipientFingerprint, setRecipientFingerprint] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(VERIFICATION_STATUS.UNVERIFIED);
  const [manualVerification, setManualVerification] = useState('');
  const [verificationError, setVerificationError] = useState(null);
  const [showExpirationWarning, setShowExpirationWarning] = useState(false);
  
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
    if (hours < 24) {
      return { 
        text: `${hours}h ${minutes % 60}m left`,
        expiringSoon
      };
    }
    
    const days = Math.floor(hours / 24);
    return {
      text: `${days}d ${hours % 24}h left`,
      expiringSoon
    };
  };
  
  // Setup interval to update expiration times
  useEffect(() => {
    // Update timer every minute
    const intervalId = setInterval(() => {
      // Force re-render to update timers
      setMessages([...messages]);
    }, 60000);
    
    return () => clearInterval(intervalId);
  }, [messages]);
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
  
  // Enhanced function to load recipient's key fingerprint and verification status
  const loadRecipientKeyFingerprint = useCallback(async () => {
    if (!userId) return;
    try {
      const keyData = await getRecipientPublicKey(userId);
      if (keyData && keyData.publicKey) {
        const fingerprint = await generateKeyFingerprint(keyData.publicKey);
        setRecipientFingerprint(fingerprint);
        
        // Check if key is expiring soon
        if (keyData.expiresAt) {
          const expiryDate = new Date(keyData.expiresAt);
          const now = new Date();
          const timeRemaining = expiryDate - now;
          
          // Show warning if less than 3 days remaining
          if (timeRemaining > 0 && timeRemaining < 3 * 24 * 60 * 60 * 1000) {
            setShowExpirationWarning(true);
          }
        }
        
        // Get verification status
        const status = getContactVerificationStatus(userId, keyData.keyId);
        setVerificationStatus(status);
      }
    } catch (error) {
      console.error('Error loading recipient key fingerprint:', error);
    }
  }, [userId, getRecipientPublicKey, getContactVerificationStatus]);
  
  // Load fingerprint when modal is opened
  useEffect(() => {
    if (showKeyModal && !recipientFingerprint) {
      loadRecipientKeyFingerprint();
    }
  }, [showKeyModal, recipientFingerprint, loadRecipientKeyFingerprint]);
  
  // Listen for message_deleted events from socket
  useEffect(() => {
    const handleMessageDeleted = (event) => {
      const { messageId } = event.detail;
      setMessages(messages => messages.filter(msg => msg.id !== messageId));
    };
    
    window.addEventListener('message_deleted', handleMessageDeleted);
    
    return () => {
      window.removeEventListener('message_deleted', handleMessageDeleted);
    };
  }, []);
  
  // Listen for typing status events
  useEffect(() => {
    if (!socket) return;
    
    const handleTypingStatus = (data) => {
      if (data.senderId.toString() === userId) {
        setIsRecipientTyping(data.isTyping);
      }
    };
    
    socket.on('typing_status', handleTypingStatus);
    
    return () => {
      socket.off('typing_status', handleTypingStatus);
    };
  }, [socket, userId]);
  
  // Send typing status when user is typing
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setNewMessage(newValue);
    
    // Don't send typing events if message is empty and was empty
    if (!newValue.trim() && !newMessage.trim()) return;
    
    // Clear any existing timeout
    if (typingTimeoutId) {
      clearTimeout(typingTimeoutId);
    }
    
    // Send typing status
    axios.post('/api/private-messages/typing', {
      recipientId: userId,
      isTyping: true
    }).catch(err => console.error('Error sending typing status', err));
    
    // Set timeout to stop typing indicator after 2 seconds of inactivity
    const timeoutId = setTimeout(() => {
      axios.post('/api/private-messages/typing', {
        recipientId: userId,
        isTyping: false
      }).catch(err => console.error('Error sending typing status', err));
    }, 2000);
    
    setTypingTimeoutId(timeoutId);
  };
  
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
            <EncryptionIndicator 
              pulse={!error && verificationStatus !== VERIFICATION_STATUS.VERIFIED} 
              warning={verificationStatus === VERIFICATION_STATUS.MISMATCH || showExpirationWarning}
              verified={verificationStatus === VERIFICATION_STATUS.VERIFIED}
              error={!!error}
              onClick={() => setShowKeyModal(true)}
              title="Click to verify encryption keys"
            >
              {error ? <FaExclamationTriangle /> : 
               verificationStatus === VERIFICATION_STATUS.VERIFIED ? <FaCheckCircle /> :
               verificationStatus === VERIFICATION_STATUS.MISMATCH ? <FaTimesCircle /> :
               showExpirationWarning ? <FaBell /> : <FaShieldAlt />}
              
              {error ? 'Encryption Error' : 
               verificationStatus === VERIFICATION_STATUS.VERIFIED ? 'Verified Encryption' :
               verificationStatus === VERIFICATION_STATUS.MISMATCH ? 'Verification Failed' :
               showExpirationWarning ? 'Key Expiring Soon' : 'End-to-End Encrypted'}
            </EncryptionIndicator>
          </RecipientInfo>
        )}
      </Header>
      
      {showKeyModal && (
        <Modal onClick={(e) => e.target === e.currentTarget && setShowKeyModal(false)}>
          <ModalContent>
            <ModalTitle>
              <FaShieldAlt /> Verify Encryption
            </ModalTitle>
            
            <p>End-to-end encryption is active for this conversation.</p>
            
            <div style={{ margin: '1.5rem 0', padding: '1rem', background: 'rgba(0,0,0,0.2)' }}>
              <h4>Your Key Fingerprint:</h4>
              <div style={{ 
                fontFamily: 'monospace', 
                color: 'var(--primary-color)',
                background: 'rgba(0,0,0,0.3)',
                padding: '0.5rem',
                borderRadius: '4px'
              }}>
                {keyFingerprint ? (
                  <>
                    <div><FaFingerprint /> Hex: {keyFingerprint.hex}</div>
                    <div style={{marginTop: '0.5rem'}}><FaKey /> Numbers: {keyFingerprint.numeric}</div>
                  </>
                ) : 'Loading...'}
              </div>
              
              <h4 style={{ marginTop: '1rem' }}>
                {recipient?.username}'s Key Fingerprint:
                {verificationStatus !== VERIFICATION_STATUS.UNVERIFIED && (
                  <VerificationBadge 
                    verified={verificationStatus === VERIFICATION_STATUS.VERIFIED}
                    mismatch={verificationStatus === VERIFICATION_STATUS.MISMATCH}
                  >
                    {verificationStatus === VERIFICATION_STATUS.VERIFIED ? 
                      <><FaCheckCircle /> Verified</> : 
                      <><FaTimesCircle /> Mismatch</>}
                  </VerificationBadge>
                )}
              </h4>
              <div style={{ 
                fontFamily: 'monospace', 
                color: 'var(--secondary-color)',
                background: 'rgba(0,0,0,0.3)',
                padding: '0.5rem',
                borderRadius: '4px'
              }}>
                {recipientFingerprint ? (
                  <>
                    <div><FaFingerprint /> Hex: {recipientFingerprint.hex}</div>
                    <div style={{marginTop: '0.5rem'}}><FaKey /> Numbers: {recipientFingerprint.numeric}</div>
                  </>
                ) : 'Loading...'}
              </div>
              
              {keyFingerprint && recipientFingerprint && (
                <>
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.5rem',
                    background: 'rgba(0,255,0,0.1)',
                    border: '1px solid var(--success-color, #00ff00)',
                    borderRadius: '4px'
                  }}>
                    <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                      <FaShieldAlt color="var(--success-color, #00ff00)" /> Secure Verification
                    </div>
                    <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      To confirm your communication is secure, ask {recipient?.username} to share 
                      their key fingerprint through another channel (in-person, phone call, etc.).
                    </p>
                    <p style={{ fontSize: '0.85rem' }}>
                      If the fingerprints match exactly, your conversation is secure from 
                      man-in-the-middle attacks.
                    </p>
                  </div>
                  
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                      Manual Verification:
                    </label>
                    <input 
                      type="text" 
                      placeholder="Enter fingerprint for verification..."
                      value={manualVerification}
                      onChange={(e) => setManualVerification(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--primary-color)',
                        color: 'var(--text-color)',
                        fontFamily: 'monospace'
                      }}
                    />
                    {verificationError && (
                      <div style={{ color: 'var(--danger-color)', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                        {verificationError}
                      </div>
                    )}
                    <ButtonGroup style={{ marginTop: '0.5rem' }}>
                      <Button
                        onClick={async () => {
                          setVerificationError(null);
                          
                          if (!manualVerification.trim()) {
                            setVerificationError('Please enter a fingerprint to verify');
                            return;
                          }
                          
                          try {
                            const recipientData = await getRecipientPublicKey(userId);
                            const result = await verifyContactFingerprint(
                              userId, 
                              recipientData.keyId, 
                              manualVerification,
                              true // mark as verified
                            );
                            
                            if (result.verified) {
                              setVerificationStatus(VERIFICATION_STATUS.VERIFIED);
                              setManualVerification('');
                              alert('Verification successful! This conversation is now verified as secure.');
                            } else {
                              setVerificationStatus(VERIFICATION_STATUS.MISMATCH);
                              setVerificationError('Verification failed! The fingerprint you entered does not match.');
                            }
                          } catch (error) {
                            console.error('Verification error:', error);
                            setVerificationError('Error during verification: ' + error.message);
                          }
                        }}
                      >
                        Verify Fingerprint
                      </Button>
                      <Button 
                        primary 
                        onClick={async () => {
                          try {
                            setVerificationError(null);
                            
                            const recipientData = await getRecipientPublicKey(userId);
                            const result = await verifyContactFingerprint(
                              userId, 
                              recipientData.keyId, 
                              recipientFingerprint,
                              true // mark as verified
                            );
                            
                            if (result.verified) {
                              setVerificationStatus(VERIFICATION_STATUS.VERIFIED);
                              alert('This conversation is now marked as verified!');
                            }
                          } catch (error) {
                            console.error('Verification error:', error);
                            setVerificationError('Error during verification: ' + error.message);
                          }
                        }}
                      >
                        Mark as Verified
                      </Button>
                    </ButtonGroup>
                  </div>
                </>
              )}
            </div>
            
            <ButtonGroup>
              <Button onClick={() => setShowKeyModal(false)}>Close</Button>
              <Button 
                primary 
                onClick={() => {
                  if (navigator.clipboard && keyFingerprint) {
                    navigator.clipboard.writeText(
                      `RetroChat Security Verification:\n` +
                      `Hex: ${keyFingerprint.hex}\n` +
                      `Numbers: ${keyFingerprint.numeric}`
                    );
                    alert('Your key fingerprint copied to clipboard');
                  }
                }}
              >
                Copy My Fingerprint
              </Button>
            </ButtonGroup>
          </ModalContent>
        </Modal>
      )}
      
      <StatusBar>
        <StatusItem>
          {verificationStatus === VERIFICATION_STATUS.VERIFIED ? (
            <>
              <FaCheckCircle style={{ color: 'var(--verified-color, #00cc00)' }} />
              <span style={{ color: 'var(--verified-color, #00cc00)' }}>Verified</span>
            </>
          ) : (
            <>
              <FaLock /> Private Conversation
              {verificationStatus === VERIFICATION_STATUS.MISMATCH && (
                <span style={{ color: 'var(--danger-color, #ff4444)', marginLeft: '0.5rem' }}>
                  <FaExclamationTriangle /> Verification Failed
                </span>
              )}
            </>
          )}
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
                    
                    {message.expiresAt && (() => {
                      const { text, expiringSoon } = getExpirationTime(message.expiresAt);
                      return text && (
                        <ExpirationBadge expiringSoon={expiringSoon}>
                          <FaClock /> {text}
                        </ExpirationBadge>
                      );
                    })()}
                    
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
        
        {isRecipientTyping && (
          <TypingIndicator>
            <span>{recipient?.username} is typing</span>
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </TypingIndicator>
        )}
        
        <MessageInput
          placeholder="Type your encrypted message here..."
          value={newMessage}
          onChange={handleInputChange}
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