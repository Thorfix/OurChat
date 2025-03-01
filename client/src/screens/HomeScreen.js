import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const HomeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 2rem;
`;

const Title = styled.h1`
  font-size: 3rem;
  color: var(--primary-color);
  text-align: center;
  margin-bottom: 2rem;
  text-shadow: 3px 3px var(--secondary-color);
  
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.8; }
    100% { opacity: 1; }
  }
  
  animation: pulse 2s infinite;
`;

const Subtitle = styled.p`
  font-size: 1.2rem;
  text-align: center;
  margin-bottom: 3rem;
  max-width: 800px;
`;

const RoomGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 2rem;
  width: 100%;
  max-width: 900px;
`;

const RoomCard = styled(Link)`
  border: 2px solid var(--primary-color);
  padding: 1.5rem;
  text-align: center;
  transition: all 0.3s;
  
  &:hover {
    transform: translateY(-5px);
    border-color: var(--secondary-color);
    box-shadow: 0 0 10px var(--primary-color);
    text-decoration: none;
  }
`;

const RoomTitle = styled.h2`
  margin-bottom: 1rem;
  color: var(--primary-color);
`;

const RoomDescription = styled.p`
  color: var(--text-color);
`;

const CustomRoomSection = styled.div`
  margin-top: 3rem;
  width: 100%;
  max-width: 500px;
  text-align: center;
`;

const InputContainer = styled.div`
  display: flex;
  margin-top: 1rem;
  
  @media (max-width: 600px) {
    flex-direction: column;
  }
`;

const Input = styled.input`
  flex: 1;
  padding: 0.8rem;
  font-family: var(--font-retro);
  font-size: 1rem;
  border: 2px solid var(--primary-color);
  background: var(--background-color);
  color: var(--text-color);
  
  &:focus {
    outline: none;
    border-color: var(--secondary-color);
  }
`;

const JoinButton = styled.button`
  padding: 0 1.5rem;
  background-color: var(--background-color);
  color: var(--primary-color);
  border: 2px solid var(--primary-color);
  cursor: pointer;
  font-family: var(--font-header);
  
  @media (max-width: 600px) {
    margin-top: 1rem;
    padding: 0.8rem;
  }
  
  &:hover {
    background-color: var(--primary-color);
    color: var(--background-color);
  }
`;

const HomeScreen = () => {
  const [customRoom, setCustomRoom] = useState('');
  const navigate = useNavigate();
  
  const predefinedRooms = [
    {
      id: 'general',
      title: 'General Chat',
      description: 'Talk about anything and everything'
    },
    {
      id: 'tech',
      title: 'Tech Talk',
      description: 'Discuss technology, programming, and gadgets'
    },
    {
      id: 'random',
      title: 'Random',
      description: 'Random discussions, memes, and everything in between'
    },
    {
      id: 'games',
      title: 'Gaming',
      description: 'Chat about video games, board games, and more'
    }
  ];
  
  const handleJoinCustomRoom = (e) => {
    e.preventDefault();
    if (customRoom.trim()) {
      navigate(`/chat/${customRoom.trim().toLowerCase().replace(/\s+/g, '-')}`);
    }
  };
  
  return (
    <HomeContainer>
      <Title>RetroChat</Title>
      <Subtitle>
        Welcome to RetroChat, an anonymous chat forum with a retro feel.
        No registration required. Join a room and start chatting!
      </Subtitle>
      
      <RoomGrid>
        {predefinedRooms.map(room => (
          <RoomCard key={room.id} to={`/chat/${room.id}`}>
            <RoomTitle>{room.title}</RoomTitle>
            <RoomDescription>{room.description}</RoomDescription>
          </RoomCard>
        ))}
      </RoomGrid>
      
      <CustomRoomSection>
        <h2>Join Custom Room</h2>
        <form onSubmit={handleJoinCustomRoom}>
          <InputContainer>
            <Input
              type="text"
              value={customRoom}
              onChange={(e) => setCustomRoom(e.target.value)}
              placeholder="Enter room name..."
              required
            />
            <JoinButton type="submit">Join</JoinButton>
          </InputContainer>
        </form>
      </CustomRoomSection>
    </HomeContainer>
  );
};

export default HomeScreen;