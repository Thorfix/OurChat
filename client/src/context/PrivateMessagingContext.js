import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { AuthContext } from './AuthContext';
import { 
  generateKeyPair, 
  verifyKeyPair, 
  prepareEncryptedMessage, 
  diagnoseAndRepairKeys,
  generateKeyFingerprint,
  checkKeyRotationStatus,
  backupKeys,
  restoreKeysFromBackup,
  saveVerificationStatus,
  getVerificationStatus,
  compareFingerprints,
  VERIFICATION_STATUS,
  secureErrorHandler
} from '../utils/encryptionUtils';

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
  const [encryptionStatus, setEncryptionStatus] = useState('unknown'); // 'active', 'inactive', 'error', 'unknown', 'expiring'
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState(null);

  // Key rotation and verification states
  const [keyFingerprint, setKeyFingerprint] = useState(null);
  const [keyRotationStatus, setKeyRotationStatus] = useState(null);
  const [verifiedContacts, setVerifiedContacts] = useState({});
  
  // Initialize socket connection
  useEffect(() => {
    if (!currentUser) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }
    
    // Create socket connection
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      withCredentials: true,
      transportOptions: {
        polling: {
          extraHeaders: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      }
    });
    
    // Connect to the private socket room for this user
    newSocket.on('connect', () => {
      console.log('Connected to socket server for private messages');
      newSocket.emit('join_private_room', currentUser.id);
    });
    
    // Handle private message notifications
    newSocket.on('private_message_received', (notification) => {
      // Add to notifications list
      setNotifications(prev => [notification, ...prev]);
      
      // Refresh conversations list
      loadConversations();
      
      // Trigger browser notification if supported and permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Encrypted Message', {
          body: `${notification.senderUsername} sent you an encrypted message`,
          icon: '/favicon.ico'
        });
      }
    });
    
    // Handle message deletion events
    newSocket.on('private_message_deleted', (data) => {
      // Update notifications
      setNotifications(prev => prev.filter(n => n.messageId !== data.messageId));
      
      // Event is emitted to update any open conversation views
      const deleteEvent = new CustomEvent('message_deleted', { 
        detail: { messageId: data.messageId } 
      });
      window.dispatchEvent(deleteEvent);
      
      // Refresh conversations list to update counts
      loadConversations();
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from socket server');
    });
    
    setSocket(newSocket);
    
    // Clean up on unmount
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [currentUser]);

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
          let parsedKeys;
          try {
            parsedKeys = JSON.parse(savedKeys);
          } catch (parseError) {
            console.error('Error parsing saved keys:', parseError);
            throw new Error('Saved encryption keys are corrupted');
          }
          
          // Verify keys are valid and working
          const verificationResult = await verifyKeyPair(parsedKeys);
          
          if (verificationResult.valid) {
            setKeyPair(parsedKeys);
            
            // Generate key fingerprint for verification
            const fingerprint = await generateKeyFingerprint(parsedKeys.publicKey);
            setKeyFingerprint(fingerprint);
            
            // Check key rotation status
            const rotationStatus = checkKeyRotationStatus(parsedKeys);
            setKeyRotationStatus(rotationStatus);
            
            if (rotationStatus.needsRotation) {
              console.info('Encryption keys need rotation - preparing new keys');
              setEncryptionStatus('expiring');
              // Don't auto-rotate, just notify the user to do it manually
            } else if (rotationStatus.warningPeriod) {
              console.info(`Encryption keys expiring soon (${rotationStatus.daysRemaining} days remaining)`);
              setEncryptionStatus('expiring');
            } else {
              setEncryptionStatus('active');
            }
            
            // Load verified contacts
            loadVerifiedContacts();
          } else {
            console.warn('Stored encryption keys failed verification:', verificationResult.error);
            
            // Try to repair the keys
            const repairResult = await diagnoseAndRepairKeys(parsedKeys);
            
            if (repairResult.repaired) {
              console.info('Successfully repaired encryption keys');
              setKeyPair(repairResult.newKeyPair);
              
              // Save the repaired keys
              localStorage.setItem(
                `encryption_keys_${currentUser.id}`, 
                JSON.stringify(repairResult.newKeyPair)
              );
              
              // Generate key fingerprint
              const fingerprint = await generateKeyFingerprint(repairResult.newKeyPair.publicKey);
              setKeyFingerprint(fingerprint);
              
              // Check rotation status on repaired keys
              const rotationStatus = checkKeyRotationStatus(repairResult.newKeyPair);
              setKeyRotationStatus(rotationStatus);
              
              if (rotationStatus.needsRotation || rotationStatus.warningPeriod) {
                setEncryptionStatus('expiring');
              } else {
                setEncryptionStatus('active');
              }
            } else {
              console.warn('Could not repair keys, generating new ones');
              await generateNewKeyPair();
            }
          }
        } else {
          // Generate new keys if none exist
          await generateNewKeyPair();
        }
      } catch (error) {
        console.error('Error initializing encryption keys:', error);
        const safeError = secureErrorHandler(error, 'key_initialization');
        setError(`Failed to initialize encryption: ${safeError.message}. ${safeError.userAction}`);
        setEncryptionStatus('error');
      }
    };
    
    initializeKeys();
  }, [currentUser]);
  
  // Load verified contacts from local storage
  const loadVerifiedContacts = useCallback(() => {
    try {
      const verificationStore = localStorage.getItem('key_verifications') || '{}';
      const verifications = JSON.parse(verificationStore);
      setVerifiedContacts(verifications);
    } catch (error) {
      console.error('Error loading verified contacts:', error);
      setVerifiedContacts({});
    }
  }, []);
  
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
  const generateNewKeyPair = async (rotationIntervalDays = 30) => {
    if (!currentUser) return;
    
    setIsGeneratingKeys(true);
    setError(null);
    setEncryptionStatus('unknown');
    
    try {
      // Generate new RSA key pair with rotation interval
      const newKeyPair = await generateKeyPair(rotationIntervalDays);
      
      // Verify keys work correctly
      const verificationResult = await verifyKeyPair(newKeyPair);
      if (!verificationResult.valid) {
        throw new Error(`Key verification failed after generation: ${verificationResult.error}`);
      }
      
      // Generate key fingerprint for verification
      const fingerprint = await generateKeyFingerprint(newKeyPair.publicKey);
      setKeyFingerprint(fingerprint);
      
      // Check rotation status on new keys
      const rotationStatus = checkKeyRotationStatus(newKeyPair);
      setKeyRotationStatus(rotationStatus);
      
      // Save to localStorage
      localStorage.setItem(`encryption_keys_${currentUser.id}`, JSON.stringify(newKeyPair));
      
      // Upload public key to server with expiration date
      await axios.post('/api/private-messages/keys', {
        publicKey: newKeyPair.publicKey,
        keyId: newKeyPair.keyId,
        expiresAt: newKeyPair.expiresAt
      });
      
      setKeyPair(newKeyPair);
      setEncryptionStatus('active');
      
      return newKeyPair;
    } catch (error) {
      console.error('Error generating new keys:', error);
      const safeError = secureErrorHandler(error, 'key_generation');
      setError(`Failed to generate new encryption keys: ${safeError.message}. ${safeError.userAction}`);
      setEncryptionStatus('error');
      return null;
    } finally {
      setIsGeneratingKeys(false);
    }
  };
  
  // Create a backup of encryption keys
  const createKeyBackup = async (password) => {
    if (!keyPair || !password) {
      setError('Cannot create backup: Keys or password missing');
      return null;
    }
    
    setIsBackingUp(true);
    setError(null);
    
    try {
      const backup = await backupKeys(keyPair, password);
      
      // Store backup creation date
      const backupInfo = {
        createdAt: backup.createdAt,
        keyId: keyPair.keyId
      };
      
      localStorage.setItem(`encryption_backup_info_${currentUser.id}`, JSON.stringify(backupInfo));
      setLastBackupDate(backup.createdAt);
      
      return backup;
    } catch (error) {
      console.error('Error creating key backup:', error);
      const safeError = secureErrorHandler(error, 'key_backup');
      setError(`Failed to create key backup: ${safeError.message}. ${safeError.userAction}`);
      return null;
    } finally {
      setIsBackingUp(false);
    }
  };
  
  // Restore keys from backup
  const restoreFromBackup = async (backupData, password) => {
    if (!backupData || !password) {
      setError('Cannot restore: Backup data or password missing');
      return false;
    }
    
    setIsRestoring(true);
    setError(null);
    setEncryptionStatus('unknown');
    
    try {
      const restoredKeyPair = await restoreKeysFromBackup(backupData, password);
      
      // Verify the restored key pair
      const verificationResult = await verifyKeyPair(restoredKeyPair);
      if (!verificationResult.valid) {
        throw new Error('Restored key verification failed');
      }
      
      // Generate key fingerprint
      const fingerprint = await generateKeyFingerprint(restoredKeyPair.publicKey);
      setKeyFingerprint(fingerprint);
      
      // Check rotation status
      const rotationStatus = checkKeyRotationStatus(restoredKeyPair);
      setKeyRotationStatus(rotationStatus);
      
      // Determine encryption status based on rotation
      if (rotationStatus.needsRotation) {
        setEncryptionStatus('expiring');
      } else if (rotationStatus.warningPeriod) {
        setEncryptionStatus('expiring');
      } else {
        setEncryptionStatus('active');
      }
      
      // Save restored keys
      localStorage.setItem(`encryption_keys_${currentUser.id}`, JSON.stringify(restoredKeyPair));
      
      // Upload public key to server
      await axios.post('/api/private-messages/keys', {
        publicKey: restoredKeyPair.publicKey,
        keyId: restoredKeyPair.keyId,
        expiresAt: restoredKeyPair.expiresAt,
        isRestored: true
      });
      
      setKeyPair(restoredKeyPair);
      return true;
    } catch (error) {
      console.error('Error restoring from backup:', error);
      const safeError = secureErrorHandler(error, 'key_restore');
      setError(`Failed to restore from backup: ${safeError.message}. ${safeError.userAction}`);
      setEncryptionStatus('error');
      return false;
    } finally {
      setIsRestoring(false);
    }
  };
  
  // Verify a contact's key fingerprint
  const verifyContactFingerprint = async (userId, contactKeyId, fingerprint, isVerified) => {
    if (!userId || !contactKeyId || !fingerprint) {
      return false;
    }
    
    try {
      // Get local fingerprint if available
      const recipientKeyData = await getRecipientPublicKey(userId);
      
      if (!recipientKeyData || !recipientKeyData.publicKey) {
        throw new Error('Cannot verify: Recipient public key not found');
      }
      
      // Generate fingerprint from public key
      const generatedFingerprint = await generateKeyFingerprint(recipientKeyData.publicKey);
      
      // Compare fingerprints
      const match = compareFingerprints(fingerprint, generatedFingerprint);
      
      // Save verification status
      const status = isVerified ? VERIFICATION_STATUS.VERIFIED : 
                    match ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.MISMATCH;
      
      saveVerificationStatus(userId, contactKeyId, status);
      
      // Reload verified contacts
      loadVerifiedContacts();
      
      return {
        verified: status === VERIFICATION_STATUS.VERIFIED,
        match: match
      };
    } catch (error) {
      console.error('Error verifying contact fingerprint:', error);
      return {
        verified: false,
        match: false,
        error: error.message
      };
    }
  };
  
  // Check verification status of a contact
  const getContactVerificationStatus = (userId, keyId) => {
    return getVerificationStatus(userId, keyId);
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
    keyFingerprint,
    isGeneratingKeys,
    isBackingUp,
    isRestoring,
    generateNewKeyPair,
    createKeyBackup,
    restoreFromBackup,
    conversations,
    isLoadingConversations,
    loadConversations,
    deleteConversation,
    sendPrivateMessage,
    error,
    encryptionStatus,
    keyRotationStatus,
    totalUnreadCount,
    getRecipientPublicKey,
    notifications,
    socket,
    verifyContactFingerprint,
    getContactVerificationStatus,
    verifiedContacts,
    lastBackupDate
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