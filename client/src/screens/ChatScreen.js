import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import io from 'socket.io-client';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Message from '../components/Message';
import ChatForm from '../components/ChatForm';
import { AuthContext } from '../context/AuthContext';

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 200px);
  min-height: 500px;
`;

const ChatHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--primary-color);
`;

const ChannelInfo = styled.div`
  margin-bottom: 1rem;
  padding: 0.8rem;
  background-color: rgba(0, 0, 0, 0.2);
  border-left: 3px solid var(--primary-color);
`;

const ChannelDescription = styled.p`
  margin-bottom: 0.5rem;
  font-style: italic;
  font-size: 0.9rem;
`;

const ChannelRules = styled.div`
  margin-top: 0.5rem;
  
  h4 {
    font-size: 0.9rem;
    margin-bottom: 0.3rem;
    color: var(--primary-color);
  }
  
  p {
    font-size: 0.8rem;
    white-space: pre-line;
  }
`;

const CategoryTag = styled.span`
  background: rgba(var(--primary-color-rgb), 0.1);
  padding: 0.2rem 0.5rem;
  margin-left: 0.5rem;
  font-size: 0.7rem;
  border-radius: 3px;
  vertical-align: middle;
`;

const RoomName = styled.h2`
  color: var(--primary-color);
  display: flex;
  align-items: center;
`;

const InfoToggle = styled.button`
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  font-size: 0.8rem;
  margin-left: 0.5rem;
  padding: 0.2rem 0.5rem;
  text-decoration: underline;
  
  &:hover {
    color: var(--secondary-color);
  }
`;

const OnlineCount = styled.div`
  font-size: 0.9rem;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const UserBadge = styled.span`
  background: var(--primary-color);
  color: var(--background-color);
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  font-size: 0.8rem;
`;

const BackLink = styled(Link)`
  font-family: var(--font-header);
  font-size: 0.8rem;
  margin-right: 1rem;
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  margin-bottom: 1rem;
  padding: 0.5rem;
  border: 2px solid var(--primary-color);
  background-color: rgba(0, 0, 0, 0.2);
  
  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 10px;
  }
  
  &::-webkit-scrollbar-track {
    background: var(--background-color);
  }
  
  &::-webkit-scrollbar-thumb {
    background: var(--primary-color);
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  opacity: 0.5;
`;

const StatusIndicator = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${props => props.online ? 'var(--success-color, #00ff00)' : 'var(--danger-color, #ff4444)'};
  margin-right: 0.5rem;
`;

const WarningBanner = styled.div`
  background-color: var(--warning-color, #ffa500);
  color: #000;
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 3px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const WarningIcon = styled.span`
  margin-right: 0.5rem;
  font-size: 1.2rem;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #000;
  cursor: pointer;
  font-size: 1.2rem;
  
  &:hover {
    opacity: 0.7;
  }
`;

const WarningText = styled.div`
  flex: 1;
  
  h4 {
    margin: 0 0 0.3rem 0;
    font-size: 1rem;
  }
  
  p {
    margin: 0;
    font-size: 0.9rem;
  }
`;

const MessageHighlight = styled.div`
  background-color: rgba(255, 255, 0, 0.1);
  border: 2px solid var(--warning-color, #ffa500);
  padding: 0.5rem;
  margin: 0.5rem 0;
  animation: highlight-pulse 2s infinite;
  
  @keyframes highlight-pulse {
    0% { box-shadow: 0 0 0 0 rgba(255, 165, 0, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(255, 165, 0, 0); }
    100% { box-shadow: 0 0 0 0 rgba(255, 165, 0, 0); }
  }
`;



const ChatScreen = () => {
  const { roomId } = useParams();
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState(null);
  const [userWarnings, setUserWarnings] = useState([]);
  const [currentWarning, setCurrentWarning] = useState(null);
  const [targetMessageId, setTargetMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const targetMessageRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get current user from auth context
  const { currentUser } = useContext(AuthContext);
  
  // Connect to socket.io and fetch channel info when component mounts
  useEffect(() => {
    // Create socket with auth token
    const newSocket = io('http://localhost:5000', {
      auth: {
        token: currentUser.accessToken.token
      }
    });
    setSocket(newSocket);
    
    const fetchChannelInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`/api/channels/${roomId}`);
        setChannel(response.data);
      } catch (error) {
        console.error('Error fetching channel info:', error);
        // If it's a 404, we'll create a basic channel object so the chat still works
        if (error.response?.status === 404) {
          setChannel({
            name: roomId,
            displayName: roomId.charAt(0).toUpperCase() + roomId.slice(1).replace(/-/g, ' '),
            description: 'This is a custom channel',
            category: 'other'
          });
        } else {
          setError('Failed to load channel information');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchChannelInfo();
    
    return () => {
      newSocket.disconnect();
    };
  }, [roomId, currentUser.accessToken.token]);
  
  // Fetch previous messages when component mounts
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await axios.get(`/api/messages/${roomId}`);
        if (response.data && Array.isArray(response.data)) {
          setMessages(response.data);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };
    
    if (roomId) {
      fetchMessages();
    }
  }, [roomId]);
  
  // Extract target message ID from URL query parameters
  useEffect(() => {
    if (location.search) {
      const params = new URLSearchParams(location.search);
      const messageId = params.get('messageId');
      if (messageId) {
        setTargetMessageId(messageId);
      }
    }
  }, [location.search]);
  
  // Fetch user warnings
  useEffect(() => {
    const fetchUserWarnings = async () => {
      try {
        const response = await axios.get('/api/users/me/warnings');
        if (response.data && Array.isArray(response.data)) {
          setUserWarnings(response.data.filter(warning => !warning.acknowledged));
          
          // Set the first unacknowledged warning as current
          if (response.data.length > 0 && !response.data[0].acknowledged) {
            setCurrentWarning(response.data[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching user warnings:', error);
      }
    };
    
    if (currentUser && currentUser.accessToken) {
      fetchUserWarnings();
    }
  }, [currentUser]);
  
  // Join room when socket is available and roomId changes
  useEffect(() => {
    if (socket && roomId) {
      // Join the room
      socket.emit('join_room', roomId);
      
      // Listen for messages
      socket.on('receive_message', (message) => {
        setMessages((prevMessages) => [...prevMessages, message]);
      });
      
      // Listen for message updates (edits)
      socket.on('message_updated', (updatedMessage) => {
        setMessages((prevMessages) => 
          prevMessages.map(msg => 
            msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg
          )
        );
      });
      
      // Listen for message deletions
      socket.on('message_deleted', (deletedInfo) => {
        setMessages((prevMessages) => 
          prevMessages.map(msg => 
            msg.id === deletedInfo.id ? { ...msg, isDeleted: true, deletedAt: deletedInfo.deletedAt } : msg
          )
        );
      });
      
      // Listen for user count updates
      socket.on('user_count', (count) => {
        setOnlineUsers(count);
      });
      
      // Listen for message rejection events
      socket.on('message_rejected', (data) => {
        toast.error(`Message blocked: ${data.reason}`, {
          position: "top-center",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true
        });
      });
      
      // Listen for message filtering notifications
      socket.on('message_filtered', (data) => {
        toast.warning(`Your message was modified: ${data.reason}`, {
          position: "top-center",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true
        });
      });
      
      // Listen for edit errors
      socket.on('edit_error', (data) => {
        toast.error(`Edit failed: ${data.error}`, {
          position: "top-center",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true
        });
      });
      
      // Listen for delete errors
      socket.on('delete_error', (data) => {
        toast.error(`Delete failed: ${data.error}`, {
          position: "top-center",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true
        });
      });
      
      // Listen for warning notifications
      socket.on('warning_issued', (data) => {
        // Add the new warning to the state
        setUserWarnings(prev => [data, ...prev]);
        setCurrentWarning(data);
        
        toast.error(`You have received a warning: ${data.reason}`, {
          position: "top-center",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true
        });
      });
      
      // Clean up event listeners when component unmounts
      return () => {
        socket.off('receive_message');
        socket.off('message_updated');
        socket.off('message_deleted');
        socket.off('user_count');
        socket.off('message_rejected');
        socket.off('message_filtered');
        socket.off('edit_error');
        socket.off('delete_error');
        socket.off('warning_issued');
      };
    }
  }, [socket, roomId]);
  
  // Scroll to bottom when messages change or to the target message if specified
  useEffect(() => {
    if (targetMessageId) {
      // Find the message element by ID and scroll to it
      const messageElement = document.getElementById(`message-${targetMessageId}`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add highlight class
        messageElement.classList.add('highlighted');
        // Remove the highlight after 5 seconds
        setTimeout(() => {
          messageElement.classList.remove('highlighted');
        }, 5000);
        
        // Clear the target ID after it's been found and scrolled to
        setTargetMessageId(null);
      }
    } else {
      // Otherwise scroll to bottom as normal
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, targetMessageId]);
  
  // Function to acknowledge a warning
  const acknowledgeWarning = async (warningId) => {
    try {
      await axios.post(`/api/users/me/warnings/${warningId}/acknowledge`);
      
      // Update state to remove the acknowledged warning
      setUserWarnings(prevWarnings => 
        prevWarnings.filter(warning => warning._id !== warningId)
      );
      
      // Set next warning as current if there are any left
      setCurrentWarning(prev => {
        if (prev && prev._id === warningId) {
          const nextWarning = userWarnings.find(w => w._id !== warningId);
          return nextWarning || null;
        }
        return prev;
      });
      
    } catch (error) {
      console.error('Error acknowledging warning:', error);
      toast.error('Failed to acknowledge warning');
    }
  };
  
  const sendMessage = (content, imageData = null) => {
    if (socket && (content.trim() || imageData)) {
      const messageData = {
        content: content.trim(),
        room: roomId,
        sender: currentUser.username,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString()
      };
      
      // Add image data if present
      if (imageData) {
        messageData.image = {
          url: imageData.url,
          isFlagged: imageData.isFlagged,
          flagReason: imageData.flagReason,
          filename: imageData.filename
        };
      }
      
      socket.emit('send_message', messageData);
    }
  };
  
  return (
    <ChatContainer>
      <ToastContainer theme="dark" />
      
      {currentWarning && (
        <WarningBanner>
          <WarningIcon>⚠️</WarningIcon>
          <WarningText>
            <h4>Moderation Warning</h4>
            <p>{currentWarning.message}</p>
            {currentWarning.messageId && (
              <Link to={`/chat/${roomId}?messageId=${currentWarning.messageId}`}>
                View message
              </Link>
            )}
          </WarningText>
          <CloseButton onClick={() => acknowledgeWarning(currentWarning._id)}>✕</CloseButton>
        </WarningBanner>
      )}
      
      <ChatHeader>
        <div>
          <BackLink to="/">&larr; Back to Channels</BackLink>
          <RoomName>
            #{loading ? roomId : channel?.displayName || roomId}
            {channel?.category && 
              <CategoryTag>{channel.category}</CategoryTag>
            }
            {!loading && 
              <InfoToggle onClick={() => setShowInfo(!showInfo)}>
                {showInfo ? 'Hide Info' : 'Show Info'}
              </InfoToggle>
            }
          </RoomName>
        </div>
        <OnlineCount>
          <UserBadge>{onlineUsers} online</UserBadge>
          You are: {currentUser.username}
        </OnlineCount>
      </ChatHeader>
      
      {showInfo && channel && (
        <ChannelInfo>
          <ChannelDescription>{channel.description}</ChannelDescription>
          {channel.rules && (
            <ChannelRules>
              <h4>Channel Rules:</h4>
              <p>{channel.rules}</p>
            </ChannelRules>
          )}
        </ChannelInfo>
      )}
      
      <MessagesContainer>
        {messages.length === 0 ? (
          <EmptyState>
            <p>No messages yet in #{roomId}</p>
            <p>Be the first to say something!</p>
          </EmptyState>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              id={`message-${msg.id}`}
              className={targetMessageId === msg.id ? 'highlighted-message' : ''}
              ref={targetMessageId === msg.id ? targetMessageRef : null}
            >
              <Message 
                message={msg} 
                isOwnMessage={msg.sender === currentUser.username}
                socket={socket}
                room={roomId}
              />
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </MessagesContainer>
      
      <ChatForm onSendMessage={sendMessage} />
    </ChatContainer>
  );
};

export default ChatScreen;