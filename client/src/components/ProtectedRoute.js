import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import styled from 'styled-components';

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 70vh;
  font-family: var(--font-mono);
  color: var(--primary-color);
`;

const LoadingText = styled.div`
  text-align: center;
  
  h3 {
    margin-bottom: 1rem;
  }
  
  .dots {
    display: inline-block;
    position: relative;
    width: 80px;
    height: 20px;
    
    &:after {
      content: '...';
      font-size: 2rem;
      animation: dots 1.5s infinite;
    }
  }
  
  @keyframes dots {
    0%, 20% {
      content: '.';
    }
    40% {
      content: '..';
    }
    60%, 100% {
      content: '...';
    }
  }
`;

/**
 * A wrapper component for routes that require authentication
 * If user is not authenticated, redirects to login page with return URL
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to render if authenticated
 * @param {Array<string>} [props.allowedRoles] - Optional list of roles allowed to access this route
 */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { currentUser, loading } = useContext(AuthContext);
  const location = useLocation();
  
  // Show loading spinner while auth state is being determined
  if (loading) {
    return (
      <LoadingContainer>
        <LoadingText>
          <h3>Authenticating</h3>
          <div className="dots"></div>
        </LoadingText>
      </LoadingContainer>
    );
  }
  
  // Not logged in - redirect to login
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  
  // Check for role-based authorization if allowedRoles are specified
  if (allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  // User is authenticated and authorized
  return children;
};

export default ProtectedRoute;