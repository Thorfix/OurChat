import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from './AuthContext';
import { generateKeyPair, verifyKeyPair, prepareEncryptedMessage } from '../utils/encryptionUtils';

// Create the context
export const PrivateMessagingContext = createContext();

// Provider component
export const PrivateMessagingProvider = ({ children }) => {
  const { currentUser } = useContext(AuthContext);
  const [keyPair, setKeyPair] = useState(null);
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [error, setError] = useState(null);
  const [encryptionStatus, setEncryptionStatus] = useState('unknown'); // 'active', 'inactive', 'error', 'unknown'
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  // Initialize keys when user logs in
  useEffect(() => {
    const initializeKeys = async () => {
      if (!currentUser) {
        setEncryptionStatus('inactive');
        return;
      }
      
      setEncryptionStatus('unknown');
      
      try {
        // Try to load keys from localStorage first
        const savedKeys = localStorage.getItem(`encryption_keys_${currentUser.id}`);
        
        if (savedKeys) {
          const parsedKeys = JSON.parse(savedKeys);
          // Verify keys are valid and working
          const keysValid = await verifyKeyPair(parsedKeys);
          
          if (keysValid) {
            setKeyPair(parsedKeys);
            setEncryptionStatus('active');
          } else {
            console.warn('Stored encryption keys failed verification, generating new keys');
            await generateNewKeyPair();
          }
        } else {
          // Generate new keys if none exist
          await generateNewKeyPair();
        }
      } catch (error) {
        console.error('Error initializing encryption keys:', error);
        setError('Failed to initialize encryption. Private messaging may not work properly.');
        setEncryptionStatus('error');
      }
    };
    
    initializeKeys();
  }, [currentUser]);
  
  // Load conversations when user logs in
  useEffect(() => {
    if (currentUser) {
      loadConversations();
    } else {
      setConversations([]);
      setTotalUnreadCount(0);
    }
  }, [currentUser]);
  
  // Calculate total unread count whenever conversations change
  useEffect(() => {
    const count = conversations.reduce((total, conv) => total + (conv.unreadCount || 0), 0);
    setTotalUnreadCount(count);
  }, [conversations]);

  // Generate new key pair and upload public key to server
  const generateNewKeyPair = async () => {
    if (!currentUser) return;
    
    setIsGeneratingKeys(true);
    setError(null);
    setEncryptionStatus('unknown');
    
    try {
      // Generate new RSA key pair
      const newKeyPair = await generateKeyPair();
      
      // Verify keys work correctly
      const keysValid = await verifyKeyPair(newKeyPair);
      if (!keysValid) {
        throw new Error('Key verification failed after generation');
      }
      
      // Save to localStorage
      localStorage.setItem(`encryption_keys_${currentUser.id}`, JSON.stringify(newKeyPair));
      
      // Upload public key to server
      await axios.post('/api/private-messages/keys', {
        publicKey: newKeyPair.publicKey,
        keyId: newKeyPair.keyId
      });
      
      setKeyPair(newKeyPair);
      setEncryptionStatus('active');
    } catch (error) {
      console.error('Error generating new keys:', error);
      setError('Failed to generate new encryption keys.');
      setEncryptionStatus('error');
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  // Load all conversations
  const loadConversations = useCallback(async () => {
    if (!currentUser) return;
    
    setIsLoadingConversations(true);
    
    try {
      const response = await axios.get('/api/private-messages/conversations');
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setError('Failed to load conversations');
    } finally {
      setIsLoadingConversations(false);
    }
  }, [currentUser]);

  // Delete a conversation
  const deleteConversation = async (userId) => {
    if (!currentUser) return;
    
    try {
      await axios.delete(`/api/private-messages/conversations/${userId}`);
      // Remove from local state
      setConversations(conversations.filter(conv => conv.userId !== userId));
    } catch (error) {
      console.error('Error deleting conversation:', error);
      setError('Failed to delete conversation');
    }
  };

  // Get recipient's public key
  const getRecipientPublicKey = async (userId) => {
    try {
      const response = await axios.get(`/api/private-messages/keys/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting recipient public key:', error);
      throw new Error('Failed to get recipient public key');
    }
  };

  // Send an encrypted message with improved security
  const sendPrivateMessage = async (recipientId, content, imageData = null, expiresInMinutes = null) => {
    if (!currentUser || !keyPair) {
      throw new Error('You must be logged in with encryption keys to send private messages');
    }
    
    if (encryptionStatus !== 'active') {
      throw new Error('Encryption is not active. Please regenerate your keys.');
    }
    
    try {
      // Get recipient's public key
      const recipientKeyData = await getRecipientPublicKey(recipientId);
      
      // Use the prepareEncryptedMessage utility for consistent encryption
      const messagePackage = await prepareEncryptedMessage(
        content,
        recipientKeyData.publicKey,
        imageData,
        expiresInMinutes
      );
      
      // Prepare the request data
      const messageData = {
        encryptedContent: messagePackage.content,
        recipientId,
        senderPublicKeyId: keyPair.keyId
      };
      
      // Add expiration if specified
      if (expiresInMinutes && expiresInMinutes > 0) {
        messageData.expiresInMinutes = expiresInMinutes;
      }
      
      // Add encrypted image if present
      if (messagePackage.image) {
        messageData.encryptedImageData = messagePackage.image;
      }
      
      // Send to server
      const response = await axios.post('/api/private-messages', messageData);
      
      // Refresh conversations after sending
      await loadConversations();
      
      return response.data;
    } catch (error) {
      console.error('Error sending private message:', error);
      throw error;
    }
  };

  // The context value that will be supplied to any descendants of this provider
  const contextValue = {
    keyPair,
    isGeneratingKeys,
    generateNewKeyPair,
    conversations,
    isLoadingConversations,
    loadConversations,
    deleteConversation,
    sendPrivateMessage,
    error,
    encryptionStatus,
    totalUnreadCount,
    getRecipientPublicKey
  };

  return (
    <PrivateMessagingContext.Provider value={contextValue}>
      {children}
    </PrivateMessagingContext.Provider>
  );
};

// Custom hook for consuming the context
export const usePrivateMessaging = () => {
  const context = useContext(PrivateMessagingContext);
  if (!context) {
    throw new Error('usePrivateMessaging must be used within a PrivateMessagingProvider');
  }
  return context;
};