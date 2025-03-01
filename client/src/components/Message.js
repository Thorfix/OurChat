import React, { useState } from 'react';
import styled from 'styled-components';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import { FaFlag, FaExclamationTriangle } from 'react-icons/fa';

const MessageContainer = styled.div`
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  border-left: 3px solid ${props => 
    props.flagged ? 'var(--danger-color, #ff4444)' :
    props.isOwnMessage ? 'var(--secondary-color)' : 'var(--primary-color)'};
  background-color: rgba(0, 0, 0, 0.3);
  position: relative;
`;

const MessageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
`;

const Sender = styled.span`
  color: var(--secondary-color);
  font-weight: bold;
`;

const Timestamp = styled.span`
  color: #888;
  font-size: 0.8rem;
`;

const Content = styled.div`
  word-break: break-word;
  
  p {
    margin: 0 0 0.5rem 0;
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  code {
    background-color: rgba(0, 0, 0, 0.5);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-family: monospace;
  }
  
  pre {
    background-color: rgba(0, 0, 0, 0.5);
    padding: 0.5rem;
    border-radius: 3px;
    overflow-x: auto;
    margin: 0.5rem 0;
  }
  
  blockquote {
    border-left: 3px solid var(--secondary-color);
    margin: 0.5rem 0;
    padding-left: 0.5rem;
    font-style: italic;
  }
  
  ul, ol {
    padding-left: 1.5rem;
    margin: 0.5rem 0;
  }
  
  a {
    color: var(--secondary-color);
    text-decoration: underline;
    
    &:hover {
      text-decoration: none;
    }
  }
`;

const ActionButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #888;
  padding: 0.2rem;
  margin-left: 0.5rem;
  font-size: 0.8rem;
  
  &:hover {
    color: var(--secondary-color);
  }
  
  display: flex;
  align-items: center;
  svg {
    margin-right: 0.2rem;
  }
`;

const MessageActions = styled.div`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  opacity: 0;
  transition: opacity 0.2s;
  
  ${MessageContainer}:hover & {
    opacity: 1;
  }
`;

const ReportModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ReportForm = styled.form`
  background-color: var(--background-color, #121212);
  border: 2px solid var(--primary-color);
  padding: 1.5rem;
  max-width: 500px;
  width: 90%;
`;

const ReportTitle = styled.h3`
  color: var(--primary-color);
  margin-top: 0;
  margin-bottom: 1rem;
`;

const FormGroup = styled.div`
  margin-bottom: 1rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.3rem;
  color: var(--text-color, #fff);
`;

const Select = styled.select`
  width: 100%;
  padding: 0.5rem;
  background-color: var(--background-color, #121212);
  color: var(--text-color, #fff);
  border: 1px solid var(--primary-color);
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.5rem;
  background-color: var(--background-color, #121212);
  color: var(--text-color, #fff);
  border: 1px solid var(--primary-color);
  min-height: 80px;
`;

const FormButtons = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
`;

const Button = styled.button`
  background-color: ${props => props.cancel ? 'transparent' : 'var(--primary-color)'};
  color: ${props => props.cancel ? 'var(--text-color, #fff)' : 'var(--background-color, #121212)'};
  border: 1px solid var(--primary-color);
  padding: 0.5rem 1rem;
  cursor: pointer;
  
  &:hover {
    background-color: ${props => props.cancel ? 'rgba(255, 255, 255, 0.1)' : 'var(--secondary-color)'};
  }
`;

const FlaggedBadge = styled.div`
  background-color: rgba(255, 0, 0, 0.2);
  color: var(--text-color, #fff);
  padding: 0.3rem 0.5rem;
  border-radius: 3px;
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  
  svg {
    margin-right: 0.3rem;
    color: var(--danger-color, #ff4444);
  }
`;

const Message = ({ message, isOwnMessage = false, socket, room }) => {
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  
  const formattedTime = new Date(message.timestamp).toLocaleTimeString();
  
  const handleReport = () => {
    setShowReportModal(true);
  };
  
  const closeModal = () => {
    setShowReportModal(false);
    // Reset form state if user reopens the form
    if (reportSubmitted) {
      setReportReason('');
      setReportDetails('');
      setReportSubmitted(false);
    }
  };
  
  const submitReport = (e) => {
    e.preventDefault();
    
    if (!reportReason) {
      alert('Please select a reason for your report');
      return;
    }
    
    // Submit report to server
    socket.emit('report_message', {
      messageId: message.id,
      messageContent: message.content,
      reason: reportReason,
      details: reportDetails,
      channel: room
    });
    
    setReportSubmitted(true);
    
    // Close the modal after a short delay
    setTimeout(() => {
      closeModal();
    }, 1500);
  };
  
  return (
    <MessageContainer isOwnMessage={isOwnMessage} flagged={message.flagged}>
      <MessageHeader>
        <Sender>{message.sender || 'anonymous'}</Sender>
        <Timestamp>{formattedTime}</Timestamp>
      </MessageHeader>
      
      {message.flagged && (
        <FlaggedBadge>
          <FaExclamationTriangle /> This message has been flagged by moderation system
        </FlaggedBadge>
      )}
      
      <Content>
        <ReactMarkdown>{DOMPurify.sanitize(message.content)}</ReactMarkdown>
      </Content>
      
      <MessageActions>
        <ActionButton onClick={handleReport} title="Report this message">
          <FaFlag /> Report
        </ActionButton>
      </MessageActions>
      
      {showReportModal && (
        <ReportModal onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <ReportForm onSubmit={submitReport}>
            {reportSubmitted ? (
              <>
                <ReportTitle>Report Submitted</ReportTitle>
                <p>Thank you for helping to keep our community safe.</p>
                <FormButtons>
                  <Button type="button" onClick={closeModal}>Close</Button>
                </FormButtons>
              </>
            ) : (
              <>
                <ReportTitle>Report Message</ReportTitle>
                <FormGroup>
                  <Label>Reason for report:</Label>
                  <Select 
                    value={reportReason} 
                    onChange={(e) => setReportReason(e.target.value)}
                    required
                  >
                    <option value="">Select a reason</option>
                    <option value="spam">Spam</option>
                    <option value="harassment">Harassment</option>
                    <option value="inappropriate">Inappropriate content</option>
                    <option value="violence">Violence or threats</option>
                    <option value="hate-speech">Hate speech</option>
                    <option value="illegal-content">Illegal content</option>
                    <option value="other">Other</option>
                  </Select>
                </FormGroup>
                <FormGroup>
                  <Label>Additional details (optional):</Label>
                  <TextArea 
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Please provide any additional context..."
                  />
                </FormGroup>
                <FormButtons>
                  <Button type="button" cancel onClick={closeModal}>Cancel</Button>
                  <Button type="submit">Submit Report</Button>
                </FormButtons>
              </>
            )}
          </ReportForm>
        </ReportModal>
      )}
    </MessageContainer>
  );
};

export default Message;