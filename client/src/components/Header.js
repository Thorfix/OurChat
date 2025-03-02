import React, { useContext, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthContext';
import { usePrivateMessaging } from '../context/PrivateMessagingContext';
import { FaLock, FaEnvelope, FaShieldAlt, FaBell, FaTimes, FaExclamationTriangle } from 'react-icons/fa';

const HeaderContainer = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 2px solid var(--primary-color);
  margin-bottom: 2rem;
`;

const Logo = styled.h1`
  font-size: 2rem;
  color: var(--primary-color);
  margin: 0;
  text-shadow: 3px 3px var(--secondary-color);
  
  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`;

const Nav = styled.nav`
  display: flex;
  gap: 1.5rem;
  align-items: center;
`;

const NavLink = styled(Link)`
  color: var(--primary-color);
  font-family: var(--font-header);
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  
  &:hover {
    color: var(--secondary-color);
  }
`;

const MessagesBadge = styled.div`
  position: relative;
  
  span {
    position: absolute;
    top: -8px;
    right: -8px;
    background: var(--secondary-color);
    color: var(--background-color);
    border-radius: 50%;
    width: 16px;
    height: 16px;
    font-size: 0.7rem;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: ${props => props.pulse ? 'pulse 1.5s infinite' : 'none'};
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
`;

const NotificationIcon = styled.div`
  position: relative;
  margin-left: 1rem;
  cursor: pointer;
  color: var(--primary-color);
  
  &:hover {
    color: var(--secondary-color);
  }
  
  span {
    position: absolute;
    top: -8px;
    right: -8px;
    background: var(--secondary-color);
    color: var(--background-color);
    border-radius: 50%;
    width: 16px;
    height: 16px;
    font-size: 0.7rem;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: ${props => props.hasNew ? 'pulse 1.5s infinite' : 'none'};
  }
`;

const NotificationsDropdown = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  width: 300px;
  max-height: 400px;
  overflow-y: auto;
  background: var(--background-color);
  border: 1px solid var(--primary-color);
  z-index: 100;
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
`;

const NotificationItem = styled.div`
  padding: 0.8rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.2);
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const NotificationContent = styled.div`
  flex: 1;
  margin-left: 0.8rem;
`;

const NotificationTitle = styled.div`
  font-weight: bold;
  color: var(--secondary-color);
  font-size: 0.9rem;
`;

const NotificationTime = styled.div`
  font-size: 0.7rem;
  color: #888;
  margin-top: 0.2rem;
`;

const EmptyNotifications = styled.div`
  padding: 2rem;
  text-align: center;
  color: #888;
  font-style: italic;
`;

const NotificationHeader = styled.div`
  padding: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ClearButton = styled.button`
  border: none;
  background: none;
  color: var(--primary-color);
  cursor: pointer;
  font-size: 0.8rem;
  
  &:hover {
    color: var(--secondary-color);
    text-decoration: underline;
  }
`;

const PrivateMessagesLink = styled(NavLink)`
  position: relative;
  color: ${props => props.active ? 'var(--secondary-color)' : 'var(--primary-color)'};
  
  &::after {
    content: '';
    position: absolute;
    bottom: -3px;
    left: 0;
    width: 100%;
    height: 2px;
    background: ${props => props.active ? 'var(--secondary-color)' : 'transparent'};
  }
`;

const EncryptionPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.7rem;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.2rem 0.4rem;
  border-radius: 10px;
  margin-left: 0.3rem;
  color: ${props => {
    if (props.active) return 'var(--success-color, #00ff00)';
    if (props.error) return 'var(--danger-color, #ff4444)';
    return 'var(--warning-color, #ffaa00)';
  }};
  border: 1px solid currentColor;
  animation: ${props => props.active ? 'glow 2s infinite alternate' : 'none'};
  
  @keyframes glow {
    from { box-shadow: 0 0 0px var(--success-color, #00ff00); }
    to { box-shadow: 0 0 8px var(--success-color, #00ff00); }
  }
`;

const AuthButton = styled(Link)`
  background-color: var(--primary-color);
  color: var(--background-color);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-family: var(--font-header);
  
  &:hover {
    background-color: var(--secondary-color);
    color: var(--background-color);
  }
`;

const LogoutButton = styled.button`
  background-color: transparent;
  border: 1px solid var(--primary-color);
  color: var(--primary-color);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-family: var(--font-header);
  cursor: pointer;
  
  &:hover {
    background-color: var(--primary-color);
    color: var(--background-color);
  }
`;

const UserBadge = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-color);
`;

const Avatar = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
`;

const Header = () => {
  const { currentUser, logout } = useContext(AuthContext);
  const { 
    encryptionStatus, 
    totalUnreadCount, 
    notifications,
    error: encryptionError
  } = usePrivateMessaging();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);
  const [newNotifications, setNewNotifications] = useState(false);
  const location = useLocation();
  const notificationsRef = useRef(null);
  
  // Toggle notifications dropdown
  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      setNewNotifications(false);
    }
  };
  
  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Update notifications list when new notifications come in
  useEffect(() => {
    if (notifications && notifications.length > 0) {
      setNotificationsList(notifications);
      setNewNotifications(true);
    }
  }, [notifications]);
  
  // Close notifications when route changes
  useEffect(() => {
    setShowNotifications(false);
  }, [location]);
  
  // Format notification time
  const formatNotificationTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };
  
  // Clear all notifications
  const clearNotifications = () => {
    setNotificationsList([]);
    setNewNotifications(false);
    setShowNotifications(false);
  };
  
  // Handle notification click
  const handleNotificationClick = (notification) => {
    // Navigate to the private message conversation
    window.location.href = `/messages/${notification.senderId}`;
    setShowNotifications(false);
  };
  
  const handleLogout = () => {
    logout();
  };
  
  return (
    <HeaderContainer>
      <Link to="/">
        <Logo>RetroChat</Logo>
      </Link>
      <Nav>
        <NavLink to="/">Home</NavLink>
        {currentUser && (
          <>
            <NavLink to="/chat/general">General</NavLink>
            <NavLink to="/chat/tech">Tech</NavLink>
            <NavLink to="/chat/random">Random</NavLink>
            <PrivateMessagesLink to="/messages" active={encryptionStatus === 'active'}>
              <MessagesBadge pulse={totalUnreadCount > 0}>
                <FaEnvelope />
                {totalUnreadCount > 0 && <span>{totalUnreadCount > 9 ? '9+' : totalUnreadCount}</span>}
              </MessagesBadge>
              Private Messages
              <EncryptionPill 
                active={encryptionStatus === 'active'} 
                error={encryptionStatus === 'error'}
              >
                {encryptionStatus === 'active' && <FaShieldAlt size={10} />}
                {encryptionStatus === 'error' && <FaExclamationTriangle size={10} />}
                {encryptionStatus === 'unknown' && <FaLock size={10} />}
                {encryptionStatus === 'active' ? 'Encrypted' : 
                 encryptionStatus === 'error' ? 'Error' : 'Setup'}
              </EncryptionPill>
            </PrivateMessagesLink>
            
            {/* Notifications Icon & Dropdown */}
            {encryptionStatus === 'active' && (
              <div style={{ position: 'relative' }} ref={notificationsRef}>
                <NotificationIcon hasNew={newNotifications} onClick={toggleNotifications}>
                  <FaBell />
                  {notificationsList.length > 0 && (
                    <span>{notificationsList.length > 9 ? '9+' : notificationsList.length}</span>
                  )}
                </NotificationIcon>
                
                {showNotifications && (
                  <NotificationsDropdown>
                    <NotificationHeader>
                      <h4 style={{ margin: '0' }}>Notifications</h4>
                      {notificationsList.length > 0 && (
                        <ClearButton onClick={clearNotifications}>Clear All</ClearButton>
                      )}
                    </NotificationHeader>
                    
                    {notificationsList.length === 0 ? (
                      <EmptyNotifications>No new notifications</EmptyNotifications>
                    ) : (
                      notificationsList.map((notification, index) => (
                        <NotificationItem 
                          key={index}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <NotificationIcon encrypted={notification.isEncrypted}>
                            {notification.isEncrypted ? <FaLock /> : <FaEnvelope />}
                          </NotificationIcon>
                          <NotificationContent>
                            <NotificationTitle>
                              {notification.senderUsername} sent you a {notification.isEncrypted ? 'secure' : ''} message
                            </NotificationTitle>
                            <NotificationTime>
                              {formatNotificationTime(notification.timestamp)}
                            </NotificationTime>
                          </NotificationContent>
                        </NotificationItem>
                      ))
                    )}
                  </NotificationsDropdown>
                )}
              </div>
            )}
          </>
        )}
        
        {currentUser && currentUser.role === 'admin' && (
          <NavLink to="/admin">Admin</NavLink>
        )}
        
        {currentUser ? (
          <>
            <UserBadge to="/profile">
              <Avatar>
                {currentUser.username.charAt(0).toUpperCase()}
              </Avatar>
              {currentUser.username}
            </UserBadge>
            <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
          </>
        ) : (
          <>
            <NavLink to="/login">Login</NavLink>
            <AuthButton to="/register">Sign Up</AuthButton>
          </>
        )}
      </Nav>
    </HeaderContainer>
  );
};

export default Header;