import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';

const HomeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 2rem;
  padding: 0 1rem;
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

const ChannelSections = styled.div`
  width: 100%;
  max-width: 1200px;
`;

const SectionTitle = styled.h2`
  margin: 2rem 0 1rem;
  color: var(--primary-color);
  border-bottom: 1px solid var(--primary-color);
  padding-bottom: 0.5rem;
`;

const RoomGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  width: 100%;
`;

const CategoryFilter = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
`;

const CategoryButton = styled.button`
  background: ${props => props.active ? 'var(--primary-color)' : 'var(--background-color)'};
  color: ${props => props.active ? 'var(--background-color)' : 'var(--primary-color)'};
  border: 1px solid var(--primary-color);
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-family: var(--font-retro);
  
  &:hover {
    background: ${props => props.active ? 'var(--primary-color)' : 'rgba(var(--primary-color-rgb), 0.2)'};
  }
`;

const SearchContainer = styled.div`
  margin: 1rem 0;
  width: 100%;
  display: flex;
`;

const SearchInput = styled.input`
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

const SearchButton = styled.button`
  padding: 0 1.5rem;
  background-color: var(--primary-color);
  color: var(--background-color);
  border: 2px solid var(--primary-color);
  cursor: pointer;
  font-family: var(--font-header);
  
  &:hover {
    background-color: var(--secondary-color);
    border-color: var(--secondary-color);
  }
`;

const RoomCard = styled(Link)`
  border: 2px solid var(--primary-color);
  padding: 1.5rem;
  text-align: center;
  transition: all 0.3s;
  position: relative;
  
  &:hover {
    transform: translateY(-5px);
    border-color: var(--secondary-color);
    box-shadow: 0 0 10px var(--primary-color);
    text-decoration: none;
  }
`;

const FeaturedBadge = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  background: var(--secondary-color);
  color: var(--background-color);
  font-size: 0.7rem;
  padding: 0.3rem 0.6rem;
  text-transform: uppercase;
  font-weight: bold;
`;

const ActiveUsersTag = styled.div`
  font-size: 0.8rem;
  margin-top: 1rem;
  color: ${props => props.count > 0 ? 'var(--secondary-color)' : 'var(--text-color)'};
`;

const CategoryTag = styled.div`
  background: rgba(var(--primary-color-rgb), 0.1);
  display: inline-block;
  padding: 0.2rem 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  border-radius: 3px;
`;

const RoomTitle = styled.h2`
  margin-bottom: 1rem;
  color: var(--primary-color);
`;

const RoomDescription = styled.p`
  color: var(--text-color);
`;

const CreateChannelSection = styled.div`
  margin-top: 3rem;
  width: 100%;
  max-width: 600px;
  text-align: center;
  border: 2px solid var(--primary-color);
  padding: 1.5rem;
`;

const CustomRoomSection = styled.div`
  margin-top: 3rem;
  width: 100%;
  max-width: 600px;
  text-align: center;
  border: 2px solid var(--primary-color);
  padding: 1.5rem;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;
  
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 1rem;
  
  label {
    margin-bottom: 0.5rem;
    color: var(--primary-color);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.8rem;
  font-family: var(--font-retro);
  font-size: 1rem;
  border: 2px solid var(--primary-color);
  background: var(--background-color);
  color: var(--text-color);
  min-height: 100px;
  
  &:focus {
    outline: none;
    border-color: var(--secondary-color);
  }
`;

const Select = styled.select`
  width: 100%;
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

const CreateButton = styled.button`
  padding: 0.8rem 1.5rem;
  background-color: var(--primary-color);
  color: var(--background-color);
  border: 2px solid var(--primary-color);
  cursor: pointer;
  font-family: var(--font-header);
  margin-top: 1rem;
  
  &:hover {
    background-color: var(--secondary-color);
    border-color: var(--secondary-color);
  }
  
  &:disabled {
    background-color: #666;
    border-color: #666;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: #ff5555;
  margin-top: 1rem;
  font-size: 0.9rem;
`;

const LoadingSpinner = styled.div`
  width: 20px;
  height: 20px;
  border: 3px solid rgba(var(--primary-color-rgb), 0.3);
  border-radius: 50%;
  border-top-color: var(--primary-color);
  animation: spin 1s ease-in-out infinite;
  margin: 0 auto;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: 2rem;
  color: var(--text-color);
  opacity: 0.7;
  font-style: italic;
`;

const HomeScreen = () => {
  const [customRoom, setCustomRoom] = useState('');
  const [channels, setChannels] = useState([]);
  const [trendingChannels, setTrendingChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  
  // New channel form state
  const [newChannel, setNewChannel] = useState({
    name: '',
    displayName: '',
    description: '',
    rules: '',
    category: 'general'
  });
  
  const navigate = useNavigate();

  // Categories for filtering
  const categories = [
    { id: 'all', name: 'All Channels' },
    { id: 'general', name: 'General' },
    { id: 'tech', name: 'Technology' },
    { id: 'gaming', name: 'Gaming' },
    { id: 'social', name: 'Social' },
    { id: 'entertainment', name: 'Entertainment' },
    { id: 'education', name: 'Education' },
    { id: 'other', name: 'Other' }
  ];
  
  // Fetch channels on component mount and when category/search changes
  useEffect(() => {
    const fetchChannels = async () => {
      setLoading(true);
      try {
        let url = '/api/channels';
        
        // Add query parameters for filtering
        const params = new URLSearchParams();
        if (selectedCategory !== 'all') {
          params.append('category', selectedCategory);
        }
        if (searchTerm) {
          params.append('search', searchTerm);
        }
        
        if (params.toString()) {
          url += '?' + params.toString();
        }
        
        const response = await axios.get(url);
        setChannels(response.data);
        
        // Also fetch trending channels
        const trendingResponse = await axios.get('/api/channels/trending');
        setTrendingChannels(trendingResponse.data);
      } catch (error) {
        console.error('Error fetching channels:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchChannels();
  }, [selectedCategory, searchTerm]);
  
  const handleJoinCustomRoom = (e) => {
    e.preventDefault();
    if (customRoom.trim()) {
      navigate(`/chat/${customRoom.trim().toLowerCase().replace(/\s+/g, '-')}`);
    }
  };
  
  const handleSearch = (e) => {
    e.preventDefault();
    // Search is triggered by the useEffect when searchTerm changes
  };
  
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
  };
  
  const handleCreateChannel = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);
    
    // Validate channel name
    if (!newChannel.name.match(/^[a-z0-9-]+$/)) {
      setFormError('Channel name can only contain lowercase letters, numbers, and hyphens');
      setFormSubmitting(false);
      return;
    }
    
    // Validate other required fields
    if (!newChannel.displayName.trim() || !newChannel.description.trim()) {
      setFormError('Display name and description are required');
      setFormSubmitting(false);
      return;
    }
    
    try {
      const response = await axios.post('/api/channels', {
        ...newChannel,
        createdBy: 'user-' + Math.floor(Math.random() * 10000) // Simple random user ID
      });
      
      // Reset form
      setNewChannel({
        name: '',
        displayName: '',
        description: '',
        rules: '',
        category: 'general'
      });
      
      // Hide form
      setShowCreateForm(false);
      
      // Navigate to the new channel
      navigate(`/chat/${response.data.name}`);
    } catch (error) {
      console.error('Error creating channel:', error);
      setFormError(error.response?.data?.message || 'Failed to create channel');
    } finally {
      setFormSubmitting(false);
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewChannel(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  return (
    <HomeContainer>
      <Title>RetroChat</Title>
      <Subtitle>
        Welcome to RetroChat, an anonymous chat forum with a retro feel.
        No registration required. Join a channel and start chatting!
      </Subtitle>
      
      <ChannelSections>
        {/* Search and Filter */}
        <SearchContainer>
          <SearchInput
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search channels..."
          />
          <SearchButton onClick={handleSearch}>Search</SearchButton>
        </SearchContainer>
        
        <CategoryFilter>
          {categories.map(category => (
            <CategoryButton
              key={category.id}
              active={selectedCategory === category.id}
              onClick={() => handleCategoryChange(category.id)}
            >
              {category.name}
            </CategoryButton>
          ))}
        </CategoryFilter>

        {/* Trending Channels Section */}
        {trendingChannels.length > 0 && (
          <>
            <SectionTitle>Trending Channels</SectionTitle>
            <RoomGrid>
              {trendingChannels.map(channel => (
                <RoomCard key={channel.name} to={`/chat/${channel.name}`}>
                  {channel.isFeatured && <FeaturedBadge>Featured</FeaturedBadge>}
                  <RoomTitle>{channel.displayName}</RoomTitle>
                  <RoomDescription>{channel.description}</RoomDescription>
                  <CategoryTag>{categories.find(c => c.id === channel.category)?.name || channel.category}</CategoryTag>
                  <ActiveUsersTag count={channel.activeUsers}>
                    {channel.activeUsers} active {channel.activeUsers === 1 ? 'user' : 'users'}
                  </ActiveUsersTag>
                </RoomCard>
              ))}
            </RoomGrid>
          </>
        )}

        {/* All Channels Section */}
        <SectionTitle>
          {selectedCategory === 'all' ? 'All Channels' : `${categories.find(c => c.id === selectedCategory)?.name} Channels`}
        </SectionTitle>
        
        {loading ? (
          <LoadingSpinner />
        ) : channels.length > 0 ? (
          <RoomGrid>
            {channels.map(channel => (
              <RoomCard key={channel.name} to={`/chat/${channel.name}`}>
                {channel.isFeatured && <FeaturedBadge>Featured</FeaturedBadge>}
                <RoomTitle>{channel.displayName}</RoomTitle>
                <RoomDescription>{channel.description}</RoomDescription>
                <CategoryTag>{categories.find(c => c.id === channel.category)?.name || channel.category}</CategoryTag>
                <ActiveUsersTag count={channel.activeUsers}>
                  {channel.activeUsers} active {channel.activeUsers === 1 ? 'user' : 'users'}
                </ActiveUsersTag>
              </RoomCard>
            ))}
          </RoomGrid>
        ) : (
          <EmptyMessage>
            No channels found. Try a different search or category, or create your own channel!
          </EmptyMessage>
        )}

        {/* Custom Room Quick Join */}
        <CustomRoomSection>
          <h2>Quick Join</h2>
          <form onSubmit={handleJoinCustomRoom}>
            <InputContainer>
              <Input
                type="text"
                value={customRoom}
                onChange={(e) => setCustomRoom(e.target.value)}
                placeholder="Enter channel name..."
                required
              />
              <JoinButton type="submit">Join</JoinButton>
            </InputContainer>
          </form>
        </CustomRoomSection>
        
        {/* Create Channel Section */}
        <CreateChannelSection>
          {!showCreateForm ? (
            <>
              <h2>Create a New Channel</h2>
              <p>Can't find what you're looking for? Create your own channel!</p>
              <CreateButton onClick={() => setShowCreateForm(true)}>
                Create Channel
              </CreateButton>
            </>
          ) : (
            <>
              <h2>Create a New Channel</h2>
              <form onSubmit={handleCreateChannel}>
                <FormGrid>
                  <FormGroup>
                    <label htmlFor="name">Channel Name (URL)</label>
                    <Input
                      type="text"
                      id="name"
                      name="name"
                      value={newChannel.name}
                      onChange={handleInputChange}
                      placeholder="lowercase-with-hyphens"
                      required
                    />
                  </FormGroup>
                  
                  <FormGroup>
                    <label htmlFor="displayName">Display Name</label>
                    <Input
                      type="text"
                      id="displayName"
                      name="displayName"
                      value={newChannel.displayName}
                      onChange={handleInputChange}
                      placeholder="Channel Display Name"
                      required
                    />
                  </FormGroup>
                </FormGrid>
                
                <FormGroup>
                  <label htmlFor="description">Description</label>
                  <TextArea
                    id="description"
                    name="description"
                    value={newChannel.description}
                    onChange={handleInputChange}
                    placeholder="Describe your channel in a few sentences..."
                    required
                  />
                </FormGroup>
                
                <FormGrid>
                  <FormGroup>
                    <label htmlFor="rules">Channel Rules (Optional)</label>
                    <TextArea
                      id="rules"
                      name="rules"
                      value={newChannel.rules}
                      onChange={handleInputChange}
                      placeholder="Optional rules for your channel..."
                    />
                  </FormGroup>
                  
                  <FormGroup>
                    <label htmlFor="category">Category</label>
                    <Select
                      id="category"
                      name="category"
                      value={newChannel.category}
                      onChange={handleInputChange}
                      required
                    >
                      {categories.slice(1).map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </FormGroup>
                </FormGrid>
                
                {formError && <ErrorMessage>{formError}</ErrorMessage>}
                
                <div>
                  <CreateButton type="submit" disabled={formSubmitting}>
                    {formSubmitting ? <LoadingSpinner /> : 'Create Channel'}
                  </CreateButton>
                  <JoinButton 
                    type="button" 
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormError('');
                    }}
                    style={{ marginLeft: '1rem' }}
                  >
                    Cancel
                  </JoinButton>
                </div>
              </form>
            </>
          )}
        </CreateChannelSection>
      </ChannelSections>
    </HomeContainer>
  );
};

export default HomeScreen;