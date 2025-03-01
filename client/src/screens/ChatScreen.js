import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import io from 'socket.io-client';
import Message from '../components/Message';
import ChatForm from '../components/ChatForm';

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

const RoomName = styled.h2`
  color: var(--primary-color);
`;

const OnlineCount = styled.div`
  font-size: 0.9rem;
  color: var(--text-color);
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

const generateRandomNickname = () => {
  const adjectives = ['Anonymous', 'Mysterious', 'Secret', 'Hidden', 'Unknown', 'Shadowy', 'Incognito', 'Nameless'];
  const nouns = ['User', 'Chatter', 'Being', 'Entity', 'Visitor', 'Guest', 'Wanderer', 'Stranger'];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adjective}${noun}${Math.floor(Math.random() * 1000)}`;
};

const ChatScreen = () => {
  const { roomId } = useParams();
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [nickname] = useState(generateRandomNickname());
  const messagesEndRef = useRef(null);
  
  // Connect to socket.io when component mounts
  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  }, []);
  
  // Join room when socket is available and roomId changes
  useEffect(() => {
    if (socket && roomId) {
      // Join the room
      socket.emit('join_room', roomId);
      
      // Listen for messages
      socket.on('receive_message', (message) => {
        setMessages((prevMessages) => [...prevMessages, message]);
      });
      
      // Listen for user count updates
      socket.on('user_count', (count) => {
        setOnlineUsers(count);
      });
      
      // Clean up event listeners when component unmounts
      return () => {
        socket.off('receive_message');
        socket.off('user_count');
      };
    }
  }, [socket, roomId]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const sendMessage = (content) => {
    if (socket && content.trim()) {
      const messageData = {
        content,
        sender: nickname,
        room: roomId,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString()
      };
      
      socket.emit('send_message', messageData);
    }
  };
  
  return (
    <ChatContainer>
      <ChatHeader>
        <div>
          <BackLink to="/">&larr; Back to Rooms</BackLink>
          <RoomName>#{roomId}</RoomName>
        </div>
        <OnlineCount>You are: {nickname}</OnlineCount>
      </ChatHeader>
      
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
              isOwnMessage={msg.sender === nickname} 
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