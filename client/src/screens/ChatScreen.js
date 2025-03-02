import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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



const ChatScreen = () => {
  const { roomId } = useParams();
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  
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
  }, [roomId]);
  
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
      };
    }
  }, [socket, roomId]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
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
            <Message 
              key={msg.id} 
              message={msg} 
              isOwnMessage={msg.sender === currentUser.username}
              socket={socket}
              room={roomId}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </MessagesContainer>
      
      <ChatForm onSendMessage={sendMessage} />
    </ChatContainer>
  );
};

export default ChatScreen;