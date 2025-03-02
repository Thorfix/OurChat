import React, {useState, useEffect, useContext} from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import {AuthContext} from '../context/AuthContext';

const AdminContainer = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const AdminHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  border-bottom: 2px solid var(--primary-color);
  padding-bottom: 1rem;
`;

const TabContainer = styled.div`
  display: flex;
  margin-bottom: 1.5rem;
`;

const Tab = styled.button`
  background: ${props => props.active ? 'var(--primary-color)' : 'transparent'};
  color: ${props => props.active ? 'var(--background-color)' : 'var(--text-color)'};
  border: 1px solid var(--primary-color);
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  margin-right: 0.5rem;
  transition: all 0.2s;
  
  &:hover {
    background: ${props => props.active ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.1)'};
  }
`;

const FilterContainer = styled.div`
  display: flex;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const FilterSelect = styled.select`
  background-color: var(--background-color);
  color: var(--text-color);
  border: 1px solid var(--primary-color);
  padding: 0.5rem;
`;

const ReportTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 2rem;
`;

const TableHeader = styled.th`
  text-align: left;
  padding: 1rem;
  background-color: rgba(0, 0, 0, 0.3);
  border-bottom: 2px solid var(--primary-color);
  color: var(--primary-color);
`;

const TableRow = styled.tr`
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.2);
  }
`;

const TableCell = styled.td`
  padding: 1rem;
  vertical-align: top;
`;

const MessageContent = styled.div`
  background-color: rgba(0, 0, 0, 0.3);
  padding: 0.8rem;
  border-left: 3px solid var(--primary-color);
  margin-bottom: 0.5rem;
  word-break: break-word;
`;

const Badge = styled.span`
  display: inline-block;
  padding: 0.3rem 0.6rem;
  border-radius: 3px;
  font-size: 0.8rem;
  font-weight: bold;
  color: var(--background-color);
  background-color: ${props => {
    switch(props.type) {
      case 'pending': return '#f39c12';
      case 'reviewed': return '#3498db';
      case 'actioned': return '#2ecc71';
      case 'dismissed': return '#7f8c8d';
      case 'spam': return '#e74c3c';
      case 'harassment': return '#c0392b';
      case 'inappropriate': return '#d35400';
      case 'violence': return '#c0392b';
      case 'hate-speech': return '#8e44ad';
      case 'illegal-content': return '#2c3e50';
      case 'other': return '#95a5a6';
      default: return 'var(--primary-color)';
    }
  }};
  margin-right: 0.5rem;
`;

const ActionButton = styled.button`
  background-color: ${props => {
    if (props.dismiss) return 'transparent';
    if (props.remove) return '#c0392b';
    return 'var(--primary-color)';
  }};
  color: ${props => props.dismiss ? 'var(--text-color)' : 'var(--background-color)'};
  border: 1px solid ${props => props.remove ? '#c0392b' : 'var(--primary-color)'};
  padding: 0.3rem 0.8rem;
  margin-right: 0.5rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
  font-size: 0.8rem;
  
  &:hover {
    background-color: ${props => {
      if (props.dismiss) return 'rgba(255, 255, 255, 0.1)';
      if (props.remove) return '#e74c3c';
      return 'var(--secondary-color)';
    }};
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  background-color: rgba(0, 0, 0, 0.2);
  border: 1px dashed var(--primary-color);
`;

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 2rem;
`;

const PaginationButton = styled.button`
  background-color: transparent;
  color: var(--text-color);
  border: 1px solid var(--primary-color);
  padding: 0.5rem 1rem;
  margin: 0 0.3rem;
  cursor: pointer;
  
  &:hover {
    background-color: var(--primary-color);
    color: var(--background-color);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: transparent;
    color: var(--text-color);
  }
`;

const AdminScreen = () => {
  const { currentUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [flaggedMessages, setFlaggedMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  
  useEffect(() => {
    fetchData();
  }, [activeTab, statusFilter, reasonFilter, channelFilter, severityFilter, page]);
  
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (activeTab === 'reports') {
        // Build query params for filtering
        const params = new URLSearchParams();
        if (statusFilter) params.append('status', statusFilter);
        if (reasonFilter) params.append('reason', reasonFilter);
        if (channelFilter) params.append('channel', channelFilter);
        params.append('limit', 10);
        params.append('page', page);
        
        const response = await axios.get(`/api/reports?${params.toString()}`);
        setReports(response.data);
        setHasMore(response.data.length === 10);
      } else {
        // Build query params for filtering flagged messages
        const params = new URLSearchParams();
        if (statusFilter) params.append('status', statusFilter);
        if (severityFilter) params.append('severity', severityFilter);
        if (channelFilter) params.append('roomId', channelFilter);
        params.append('limit', 10);
        params.append('page', page);
        
        const response = await axios.get(`/api/reports/flagged?${params.toString()}`);
        setFlaggedMessages(response.data.messages);
        setHasMore(response.data.pagination.hasMore);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleActionReport = async (reportId, action) => {
    try {
      await axios.put(`/api/reports/${reportId}`, {
        status: action === 'dismiss' ? 'dismissed' : 'actioned',
        actionTaken: action === 'dismiss' ? 'none' : action,
        reviewedBy: currentUser._id // In a real app, use the actual admin ID
      });
      
      // Refresh data after action
      fetchData();
    } catch (err) {
      console.error('Error taking action:', err);
      alert('Failed to process your action. Please try again.');
    }
  };
  
  const handleFlaggedMessageAction = async (messageId, action) => {
    try {
      const reviewerId = currentUser._id; // In a real app, use the actual admin ID
      
      switch (action) {
        case 'review':
          await axios.put(`/api/reports/flagged/${messageId}/review`, { reviewerId });
          break;
        
        case 'remove':
          const confirmRemove = window.confirm('Do you want to remove this message from chat history as well?');
          await axios.put(`/api/reports/flagged/${messageId}/remove`, { 
            removeOriginal: confirmRemove,
            reviewerId
          });
          break;
          
        case 'warn':
          await axios.put(`/api/reports/flagged/${messageId}/restrict-user`, {
            restrictionType: 'warning',
            reviewerId
          });
          break;
          
        case 'restrict':
          const duration = prompt('Enter restriction duration in minutes:', '60');
          if (duration) {
            await axios.put(`/api/reports/flagged/${messageId}/restrict-user`, {
              restrictionType: 'temporary_ban',
              duration: parseInt(duration),
              reviewerId
            });
          }
          break;
          
        default:
          console.error('Unknown action:', action);
          return;
      }
      
      // Refresh data after action
      fetchData();
    } catch (err) {
      console.error('Error taking action on flagged message:', err);
      alert('Failed to process your action. Please try again.');
    }
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  return (
    <AdminContainer>
      <AdminHeader>
        <div>
          <h1>RetroChat Admin Panel</h1>
          <p>Manage reported content and moderation</p>
        </div>
        <Link to="/">Return to Chat</Link>
      </AdminHeader>
      
      <TabContainer>
        <Tab 
          active={activeTab === 'reports'} 
          onClick={() => setActiveTab('reports')}
        >
          User Reports
        </Tab>
        <Tab 
          active={activeTab === 'flagged'} 
          onClick={() => setActiveTab('flagged')}
        >
          Flagged Messages
        </Tab>
      </TabContainer>
      
      <FilterContainer>
        <div>
          <label>Status: </label>
          <FilterSelect 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="actioned">Actioned</option>
            <option value="dismissed">Dismissed</option>
          </FilterSelect>
        </div>
        
        {activeTab === 'reports' && (
          <div>
            <label>Reason: </label>
            <FilterSelect 
              value={reasonFilter} 
              onChange={(e) => setReasonFilter(e.target.value)}
            >
              <option value="">All Reasons</option>
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="inappropriate">Inappropriate</option>
              <option value="violence">Violence</option>
              <option value="hate-speech">Hate Speech</option>
              <option value="illegal-content">Illegal Content</option>
              <option value="other">Other</option>
            </FilterSelect>
          </div>
        )}
        
        {activeTab === 'flagged' && (
          <div>
            <label>Severity: </label>
            <FilterSelect 
              value={severityFilter} 
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="">All Severity Levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </FilterSelect>
          </div>
        )}
        
        <div>
          <label>Channel: </label>
          <FilterSelect 
            value={channelFilter} 
            onChange={(e) => setChannelFilter(e.target.value)}
          >
            <option value="">All Channels</option>
            <option value="general">General</option>
            <option value="tech">Tech</option>
            <option value="random">Random</option>
            <option value="games">Games</option>
          </FilterSelect>
        </div>
      </FilterContainer>
      
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p>{error}</p>
      ) : activeTab === 'reports' ? (
        <>
          {reports.length === 0 ? (
            <EmptyState>
              <h3>No reports found</h3>
              <p>There are no user reports matching your filters.</p>
            </EmptyState>
          ) : (
            <ReportTable>
              <thead>
                <tr>
                  <TableHeader>Reported At</TableHeader>
                  <TableHeader>Message</TableHeader>
                  <TableHeader>Reason</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <TableRow key={report._id}>
                    <TableCell>
                      {formatDate(report.createdAt)}
                      <div>
                        <small>Channel: #{report.channel}</small>
                      </div>
                      <div>
                        <small>Reported by: {report.reportedBy}</small>
                      </div>
                    </TableCell>
                    <TableCell>
                      <MessageContent>
                        {report.messageContent}
                      </MessageContent>
                      {report.details && (
                        <div>
                          <small>Additional details: {report.details}</small>
                        </div>
                      )}
                      {report.messageId && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <Link 
                            to={`/chat/${report.channel}?messageId=${report.messageId}`}
                            target="_blank"
                            style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center' }}
                          >
                            <svg style={{ marginRight: '0.3rem' }} width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M10 5H8C6.34315 5 5 6.34315 5 8V16C5 17.6569 6.34315 19 8 19H16C17.6569 19 19 17.6569 19 16V14M19 5H12M19 5V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            View in chat
                          </Link>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge type={report.reason}>{report.reason.replace('-', ' ')}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge type={report.status}>{report.status}</Badge>
                      {report.reviewedAt && (
                        <div>
                          <small>Reviewed: {formatDate(report.reviewedAt)}</small>
                        </div>
                      )}
                      {report.actionTaken && report.actionTaken !== 'none' && (
                        <div>
                          <small>Action: {report.actionTaken.replace('_', ' ')}</small>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {report.status === 'pending' && (
                        <>
                          <ActionButton remove onClick={() => handleActionReport(report._id, 'removed')}>
                            Remove Message
                          </ActionButton>
                          <ActionButton onClick={() => handleActionReport(report._id, 'warning_issued')}>
                            Issue Warning
                          </ActionButton>
                          <ActionButton dismiss onClick={() => handleActionReport(report._id, 'dismiss')}>
                            Dismiss
                          </ActionButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </ReportTable>
          )}
        </>
      ) : (
        <>
          {flaggedMessages.length === 0 ? (
            <EmptyState>
              <h3>No flagged messages found</h3>
              <p>There are no automatically flagged messages matching your filters.</p>
            </EmptyState>
          ) : (
            <ReportTable>
              <thead>
                <tr>
                  <TableHeader>Flagged At</TableHeader>
                  <TableHeader>Message</TableHeader>
                  <TableHeader>Reason</TableHeader>
                  <TableHeader>Severity</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </tr>
              </thead>
              <tbody>
                {flaggedMessages.map((message, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {formatDate(message.timestamp)}
                      <div>
                        <small>Channel: #{message.roomId}</small>
                      </div>
                      <div>
                        <small>User ID: {message.userId}</small>
                      </div>
                    </TableCell>
                    <TableCell>
                      <MessageContent>
                        {message.originalContent}
                      </MessageContent>
                      {message.modifiedContent !== message.originalContent && (
                        <MessageContent>
                          <small>Modified to: {message.modifiedContent}</small>
                        </MessageContent>
                      )}
                      {message.messageId && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <Link 
                            to={`/chat/${message.roomId}?messageId=${message.messageId}`}
                            target="_blank"
                            style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center' }}
                          >
                            <svg style={{ marginRight: '0.3rem' }} width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M10 5H8C6.34315 5 5 6.34315 5 8V16C5 17.6569 6.34315 19 8 19H16C17.6569 19 19 17.6569 19 16V14M19 5H12M19 5V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            View original in chat
                          </Link>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {message.flagReason}
                    </TableCell>
                    <TableCell>
                      <Badge type={message.severity}>{message.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <ActionButton onClick={() => handleFlaggedMessageAction(message._id, 'review')}>
                        Mark as Reviewed
                      </ActionButton>
                      <ActionButton remove onClick={() => handleFlaggedMessageAction(message._id, 'remove')}>
                        Remove Message
                      </ActionButton>
                      <ActionButton onClick={() => handleFlaggedMessageAction(message._id, 'warn')}>
                        Issue Warning
                      </ActionButton>
                      <ActionButton onClick={() => handleFlaggedMessageAction(message._id, 'restrict')}>
                        Restrict User
                      </ActionButton>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </ReportTable>
          )}
        </>
      )}
      
      <PaginationContainer>
        <PaginationButton 
          disabled={page === 1} 
          onClick={() => setPage(prev => Math.max(1, prev - 1))}
        >
          Previous
        </PaginationButton>
        <span>Page {page}</span>
        <PaginationButton 
          disabled={!hasMore} 
          onClick={() => setPage(prev => prev + 1)}
        >
          Next
        </PaginationButton>
      </PaginationContainer>
    </AdminContainer>
  );
};

export default AdminScreen;