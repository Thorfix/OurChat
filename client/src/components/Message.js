import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import { FaFlag, FaExclamationTriangle, FaEdit, FaTrash, FaTimes, FaSave, FaHistory, FaImage } from 'react-icons/fa';

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

const MessageImage = styled.div`
  margin: 0.5rem 0;
  
  img {
    max-width: 100%;
    max-height: 300px;
    border: 2px solid #000;
    background-color: #000;
    opacity: 0.9;
    image-rendering: pixelated;
    box-shadow: 0 3px 6px rgba(0,0,0,0.3);
    
    @media (max-width: 768px) {
      max-height: 200px;
    }
  }
`;

const MessageImageCaption = styled.div`
  font-size: 0.8rem;
  color: #888;
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
`;

const ImageFlaggedWarning = styled.div`
  background-color: rgba(255, 0, 0, 0.1);
  border-left: 3px solid var(--danger-color, #ff4444);
  padding: 0.3rem 0.5rem;
  margin: 0.3rem 0;
  font-size: 0.8rem;
  color: var(--danger-color, #ff4444);
  display: flex;
  align-items: center;
  
  svg {
    margin-right: 0.3rem;
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

const EditTextArea = styled.textarea`
  background-color: rgba(0, 0, 0, 0.3);
  color: var(--text-color);
  border: 1px solid var(--primary-color);
  padding: 0.5rem;
  font-size: 0.9rem;
  width: 100%;
  min-height: 80px;
  margin-bottom: 0.5rem;
  font-family: inherit;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: var(--secondary-color);
  }
`;

const EditButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
  
  button {
    background-color: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--primary-color);
    padding: 0.3rem 0.6rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    
    svg {
      margin-right: 0.3rem;
    }
    
    &:hover {
      background-color: var(--primary-color);
      color: var(--background-color);
    }
  }
`;

const DeletedMessage = styled.div`
  font-style: italic;
  color: #888;
  padding: 0.5rem 0;
  display: flex;
  align-items: center;
  
  svg {
    margin-right: 0.5rem;
  }
`;

const EditedIndicator = styled.span`
  font-size: 0.7rem;
  color: #888;
  margin-left: 0.5rem;
  display: inline-flex;
  align-items: center;
  
  svg {
    margin-right: 0.2rem;
    font-size: 0.7rem;
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
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  // Calculate if message is within editable timeframe (10 minutes)
  const messageTime = new Date(message.timestamp).getTime();
  const currentTime = new Date().getTime();
  const MESSAGE_EDIT_WINDOW = 10 * 60 * 1000; // 10 minutes in milliseconds
  const isEditable = (currentTime - messageTime) < MESSAGE_EDIT_WINDOW;
  
  const formattedTime = new Date(message.timestamp).toLocaleTimeString();
  let formattedEditTime = null;
  if (message.editedAt) {
    formattedEditTime = new Date(message.editedAt).toLocaleTimeString();
  }
  
  useEffect(() => {
    if (editMode) {
      setEditedContent(message.content);
    }
  }, [editMode, message.content]);
  
  // Reset confirm delete state if user navigates away
  useEffect(() => {
    return () => setConfirmDelete(false);
  }, []);
  
  const handleEdit = () => {
    if (isEditable && isOwnMessage) {
      setEditMode(true);
    }
  };
  
  const cancelEdit = () => {
    setEditMode(false);
    setEditedContent('');
  };
  
  const saveEdit = () => {
    if (editedContent.trim() === '') return;
    
    // Emit the edit message event
    socket.emit('edit_message', {
      messageId: message.id,
      newContent: editedContent,
      room
    });
    
    setEditMode(false);
  };
  
  const handleDelete = () => {
    if (confirmDelete) {
      // Emit the delete message event
      socket.emit('delete_message', {
        messageId: message.id,
        room
      });
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Auto-reset confirm after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };
  
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
        <Sender>
          {message.sender || 'anonymous'}
          {message.isEdited && !message.isDeleted && (
            <EditedIndicator title={`Edited at ${formattedEditTime}`}>
              <FaHistory /> edited
            </EditedIndicator>
          )}
        </Sender>
        <Timestamp>{formattedTime}</Timestamp>
      </MessageHeader>
      
      {message.flagged && (
        <FlaggedBadge>
          <FaExclamationTriangle /> This message has been flagged by moderation system
        </FlaggedBadge>
      )}
      
      {!editMode && !message.isDeleted && (
        <>
          <Content>
            <ReactMarkdown>{DOMPurify.sanitize(message.content)}</ReactMarkdown>
          </Content>
          
          {message.hasImage && message.imageUrl && (
            <>
              <MessageImage>
                <img 
                  src={message.imageUrl} 
                  alt="Shared content" 
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"%3E%3Cpath fill="%23DD2E44" d="M18 0C8.06 0 0 8.06 0 18c0 9.943 8.06 18 18 18 9.943 0 18-8.057 18-18 0-9.942-8.057-18-18-18zm-5 10c1.105 0 2 .896 2 2s-.895 2-2 2c-1.104 0-2-.896-2-2s.896-2 2-2zm10 0c1.105 0 2 .896 2 2s-.895 2-2 2-2-.896-2-2 .895-2 2-2zm-13 9c.552 0 1 .449 1 1 0 5.047 4.953 9 10 9 5.048 0 10-3.953 10-9 0-.551.447-1 1-1 .553 0 1 .449 1 1 0 6.075-5.925 11-12 11s-12-4.925-12-11c0-.551.448-1 1-1z"%3E%3C/path%3E%3C/svg%3E';
                    e.target.style.padding = '20px';
                    e.target.style.opacity = '0.6';
                  }}
                />
              </MessageImage>
              <MessageImageCaption>
                <FaImage style={{ marginRight: '5px' }} /> Shared image
              </MessageImageCaption>
              
              {message.isFlagged && (
                <ImageFlaggedWarning>
                  <FaExclamationTriangle /> This image has been flagged and is pending review
                </ImageFlaggedWarning>
              )}
            </>
          )}
        </>
      )}
      
      {!editMode && message.isDeleted && (
        <DeletedMessage>
          <FaTimes /> This message has been deleted
        </DeletedMessage>
      )}
      
      {editMode && (
        <>
          <EditTextArea 
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            maxLength={500}
          />
          <EditButtons>
            <button onClick={cancelEdit}>
              <FaTimes /> Cancel
            </button>
            <button onClick={saveEdit}>
              <FaSave /> Save
            </button>
          </EditButtons>
        </>
      )}
      
      <MessageActions>
        {isOwnMessage && isEditable && !message.isDeleted && !editMode && (
          <>
            <ActionButton onClick={handleEdit} title="Edit message">
              <FaEdit /> Edit
            </ActionButton>
            <ActionButton 
              onClick={handleDelete} 
              title={confirmDelete ? "Click again to confirm deletion" : "Delete message"}
              style={confirmDelete ? { color: 'var(--danger-color)' } : {}}
            >
              <FaTrash /> {confirmDelete ? "Confirm" : "Delete"}
            </ActionButton>
          </>
        )}
        {!isOwnMessage && !message.isDeleted && (
          <ActionButton onClick={handleReport} title="Report this message">
            <FaFlag /> Report
          </ActionButton>
        )}
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