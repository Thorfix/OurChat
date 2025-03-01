import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { usePrivateMessaging } from '../context/PrivateMessagingContext';
import { FaLock, FaTrash, FaUser, FaKey, FaPlus, FaShieldAlt, FaExclamationTriangle, FaQuestion } from 'react-icons/fa';
import axios from 'axios';

const PageContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--primary-color);
`;

const PageTitle = styled.h1`
  color: var(--primary-color);
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const NewMessageButton = styled.button`
  background: var(--background-color);
  color: var(--primary-color);
  border: 2px solid var(--primary-color);
  padding: 0.5rem 1rem;
  font-family: var(--font-header);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: var(--primary-color);
    color: var(--background-color);
  }
`;

const ConversationsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ConversationCard = styled(Link)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid var(--primary-color);
  background: rgba(0, 0, 0, 0.2);
  text-decoration: none;
  color: var(--text-color);
  transition: all 0.2s;
  
  &:hover {
    background: rgba(0, 0, 0, 0.4);
    border-color: var(--secondary-color);
  }
`;

const ConversationInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const UserIcon = styled.div`
  width: 40px;
  height: 40px;
  background: var(--primary-color);
  color: var(--background-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Username = styled.div`
  font-weight: bold;
  color: var(--secondary-color);
`;

const LastMessageTime = styled.div`
  font-size: 0.8rem;
  color: #888;
`;

const ConversationActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button`
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 1rem;
  
  &:hover {
    color: var(--danger-color, #ff4444);
  }
`;

const UnreadBadge = styled.div`
  background: var(--secondary-color);
  color: var(--background-color);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: bold;
`;

const EncryptionStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-left: 3px solid ${props => {
    switch(props.status) {
      case 'active': return 'var(--success-color, #00ff00)';
      case 'error': return 'var(--danger-color, #ff4444)';
      case 'unknown': return 'var(--warning-color, #ffaa00)';
      default: return 'var(--primary-color)';
    }
  }};
`;

const EncryptionIcon = styled.div`
  font-size: 1.5rem;
  color: ${props => {
    switch(props.status) {
      case 'active': return 'var(--success-color, #00ff00)';
      case 'error': return 'var(--danger-color, #ff4444)';
      case 'unknown': return 'var(--warning-color, #ffaa00)';
      default: return 'var(--primary-color)';
    }
  }};
`;

const EncryptionInfo = styled.div`
  flex: 1;
`;

const EncryptionTitle = styled.div`
  font-weight: bold;
  margin-bottom: 0.2rem;
`;

const EncryptionDescription = styled.div`
  font-size: 0.9rem;
  opacity: 0.8;
`;

const KeyAction = styled.button`
  background: none;
  border: none;
  color: var(--secondary-color);
  text-decoration: underline;
  cursor: pointer;
  margin-left: 0.5rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  background: rgba(0, 0, 0, 0.2);
  border: 1px dashed var(--primary-color);
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

const FormGroup = styled.div`
  margin-bottom: 1rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--primary-color);
  color: var(--text-color);
  font-family: var(--font-retro);
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
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const UserResults = styled.div`
  margin-top: 1rem;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--primary-color);
`;

const UserResultItem = styled.div`
  padding: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  
  &:hover {
    background: rgba(0, 0, 0, 0.2);
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const ConversationsScreen = () => {
  const { 
    keyPair, 
    isGeneratingKeys, 
    generateNewKeyPair, 
    conversations, 
    isLoadingConversations, 
    loadConversations, 
    deleteConversation,
    encryptionStatus,
    error: encryptionError
  } = usePrivateMessaging();
  
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Format date to readable format
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // If less than 24 hours, show time
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // If less than a week, show day
    else if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days[date.getDay()];
    }
    // Otherwise show date
    else {
      return date.toLocaleDateString();
    }
  };

  const handleDeleteConversation = async (e, userId) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this conversation? This will delete all messages.')) {
      try {
        await deleteConversation(userId);
      } catch (error) {
        console.error('Error deleting conversation:', error);
      }
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await axios.get(`/api/users/search?query=${searchTerm}`);
      setSearchResults(response.data.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartConversation = (userId) => {
    setShowModal(false);
    navigate(`/messages/${userId}`);
  };

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>
          <FaLock /> Private Messages
        </PageTitle>
        <NewMessageButton onClick={() => setShowModal(true)}>
          <FaPlus /> New Message
        </NewMessageButton>
      </PageHeader>
      
      <EncryptionStatus status={encryptionStatus}>
        <EncryptionIcon status={encryptionStatus}>
          {encryptionStatus === 'active' && <FaShieldAlt />}
          {encryptionStatus === 'error' && <FaExclamationTriangle />}
          {encryptionStatus === 'unknown' && <FaQuestion />}
          {encryptionStatus === 'inactive' && <FaKey />}
        </EncryptionIcon>
        
        <EncryptionInfo>
          <EncryptionTitle>
            {encryptionStatus === 'active' && 'End-to-End Encryption Active'}
            {encryptionStatus === 'error' && 'Encryption Error'}
            {encryptionStatus === 'unknown' && 'Checking Encryption Status...'}
            {encryptionStatus === 'inactive' && 'Encryption Not Active'}
          </EncryptionTitle>
          
          <EncryptionDescription>
            {encryptionStatus === 'active' && 'Your private messages are encrypted. Only you and your recipient can read them.'}
            {encryptionStatus === 'error' && (encryptionError || 'There was an error with your encryption keys. Generate new keys to fix this issue.')}
            {encryptionStatus === 'unknown' && 'Verifying encryption keys...'}
            {encryptionStatus === 'inactive' && 'You need to generate encryption keys to send private messages.'}
          </EncryptionDescription>
          
          <KeyAction 
            onClick={generateNewKeyPair} 
            disabled={isGeneratingKeys || encryptionStatus === 'unknown'}
          >
            {isGeneratingKeys ? 'Generating new keys...' : 'Generate new keys'}
          </KeyAction>
        </EncryptionInfo>
      </EncryptionStatus>
      
      <h2>Your Conversations</h2>
      
      {isLoadingConversations ? (
        <div>Loading conversations...</div>
      ) : conversations.length > 0 ? (
        <ConversationsList>
          {conversations.map(conversation => (
            <ConversationCard 
              key={conversation.userId} 
              to={`/messages/${conversation.userId}`}
            >
              <ConversationInfo>
                <UserIcon>
                  <FaUser />
                </UserIcon>
                <div>
                  <Username>{conversation.username}</Username>
                  <LastMessageTime>
                    {formatDate(conversation.lastMessageAt)}
                  </LastMessageTime>
                </div>
                {conversation.unreadCount > 0 && (
                  <UnreadBadge>{conversation.unreadCount}</UnreadBadge>
                )}
              </ConversationInfo>
              <ConversationActions>
                <ActionButton 
                  onClick={(e) => handleDeleteConversation(e, conversation.userId)}
                  title="Delete conversation"
                >
                  <FaTrash />
                </ActionButton>
              </ConversationActions>
            </ConversationCard>
          ))}
        </ConversationsList>
      ) : (
        <EmptyState>
          <FaLock size={40} />
          <h3>No private conversations yet</h3>
          <p>Start a new encrypted conversation by clicking "New Message"</p>
        </EmptyState>
      )}
      
      {showModal && (
        <Modal onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <ModalContent>
            <ModalTitle>
              <FaUser /> Start a New Conversation
            </ModalTitle>
            <FormGroup>
              <Label>Search for a user:</Label>
              <div style={{ display: 'flex' }}>
                <Input 
                  type="text" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Enter username"
                />
                <Button primary onClick={handleSearch} disabled={isSearching || !searchTerm.trim()}>
                  Search
                </Button>
              </div>
            </FormGroup>
            
            {searchResults.length > 0 && (
              <UserResults>
                {searchResults.map(user => (
                  <UserResultItem key={user._id}>
                    <div>{user.username}</div>
                    <Button onClick={() => handleStartConversation(user._id)}>
                      Message
                    </Button>
                  </UserResultItem>
                ))}
              </UserResults>
            )}
            
            {isSearching && <div>Searching...</div>}
            
            {searchResults.length === 0 && searchTerm && !isSearching && (
              <div>No users found. Try a different search term.</div>
            )}
            
            <ButtonGroup>
              <Button onClick={() => setShowModal(false)}>Cancel</Button>
            </ButtonGroup>
          </ModalContent>
        </Modal>
      )}
    </PageContainer>
  );
};

export default ConversationsScreen;