import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { 
  FaShieldAlt, 
  FaFingerprint, 
  FaKey, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaQuestionCircle,
  FaCopy
} from 'react-icons/fa';
import { VERIFICATION_STATUS } from '../utils/encryptionUtils';

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: var(--background-color);
  border: 2px solid var(--primary-color);
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
`;

const ModalTitle = styled.h3`
  color: var(--primary-color);
  margin-top: 0;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const VerificationSection = styled.div`
  margin: 1.5rem 0;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
`;

const KeyFingerprint = styled.div`
  font-family: monospace;
  color: ${props => props.isRecipient ? 'var(--secondary-color)' : 'var(--primary-color)'};
  background: rgba(0, 0, 0, 0.3);
  padding: 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
`;

const FingerprintDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FingerprintRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;

  button {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    padding: 0.2rem;
    
    &:hover {
      color: var(--primary-color);
    }
  }
`;

const VerificationBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  margin-left: 0.5rem;
  background: ${props => {
    if (props.verified) return 'rgba(0, 204, 0, 0.15)';
    if (props.mismatch) return 'rgba(255, 68, 68, 0.15)';
    return 'rgba(255, 255, 255, 0.1)';
  }};
  color: ${props => {
    if (props.verified) return 'var(--verified-color, #00cc00)';
    if (props.mismatch) return 'var(--danger-color, #ff4444)';
    return 'var(--text-color)';
  }};
  border: 1px solid currentColor;
`;

const VerificationInstruction = styled.div`
  margin-top: 1rem;
  padding: 0.5rem;
  background: rgba(0, 255, 0, 0.1);
  border: 1px solid var(--success-color, #00ff00);
  border-radius: 4px;
  font-size: 0.85rem;
`;

const ManualVerificationSection = styled.div`
  margin-top: 1rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--primary-color);
  color: var(--text-color);
  font-family: monospace;
  margin-top: 0.5rem;
`;

const ErrorMessage = styled.div`
  color: var(--danger-color, #ff4444);
  font-size: 0.8rem;
  margin-top: 0.3rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 1.5rem;
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  background: ${props => props.primary ? 'var(--primary-color)' : 'transparent'};
  color: ${props => props.primary ? 'var(--background-color)' : 'var(--text-color)'};
  border: 1px solid var(--primary-color);
  cursor: pointer;
  font-family: var(--font-retro);
  
  &:hover {
    background: ${props => props.primary ? 'var(--secondary-color)' : 'rgba(255, 255, 255, 0.1)'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Tabs = styled.div`
  display: flex;
  border-bottom: 1px solid var(--primary-color);
  margin-bottom: 1rem;
`;

const Tab = styled.button`
  background: ${props => props.active ? 'rgba(255, 255, 255, 0.1)' : 'transparent'};
  border: none;
  border-bottom: 2px solid ${props => props.active ? 'var(--secondary-color)' : 'transparent'};
  color: ${props => props.active ? 'var(--secondary-color)' : 'var(--text-color)'};
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-family: var(--font-retro);
  
  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
`;

const StatusMessage = styled.div`
  padding: 0.5rem;
  margin-top: 1rem;
  text-align: center;
  background: ${props => props.success ? 'rgba(0, 204, 0, 0.15)' : 'transparent'};
  color: ${props => props.success ? 'var(--verified-color, #00cc00)' : 'var(--text-color)'};
  font-size: 0.9rem;
  border-radius: 4px;
`;

/**
 * Key Verification Modal Component
 * 
 * This component provides a UI for comparing and verifying encryption keys
 * with other users, similar to Signal's safety number verification.
 * 
 * Props:
 * - isOpen: boolean to control visibility
 * - onClose: function to call when closing the modal
 * - userFingerprint: object containing the current user's key fingerprint
 * - recipientFingerprint: object containing the recipient's key fingerprint
 * - recipientName: string with recipient's username
 * - verificationStatus: current verification status
 * - onVerify: function called when verifying a fingerprint
 * - keyRotationStatus: object with info about key rotation status
 */
const KeyVerificationModal = ({
  isOpen,
  onClose,
  userFingerprint,
  recipientFingerprint,
  recipientName,
  verificationStatus,
  onVerify,
  keyRotationStatus
}) => {
  // Skip rendering if modal is not open
  if (!isOpen) return null;
  
  const [activeTab, setActiveTab] = useState('verify');
  const [manualFingerprint, setManualFingerprint] = useState('');
  const [verificationError, setVerificationError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setManualFingerprint('');
      setVerificationError(null);
      setStatusMessage('');
    }
  }, [isOpen]);
  
  // Handle copy to clipboard
  const copyToClipboard = (text, type) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setStatusMessage(`${type} fingerprint copied to clipboard`);
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };
  
  // Handle verification
  const handleVerify = async () => {
    setVerificationError(null);
    
    if (!manualFingerprint.trim()) {
      setVerificationError('Please enter a fingerprint to verify');
      return;
    }
    
    try {
      const result = await onVerify(manualFingerprint, true);
      
      if (result.verified) {
        setManualFingerprint('');
        setStatusMessage('Verification successful! This conversation is now verified as secure.');
      } else {
        setVerificationError('Verification failed! The fingerprints do not match.');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationError('Error during verification: ' + (error.message || 'Unknown error'));
    }
  };
  
  // Handle mark as verified
  const handleMarkAsVerified = async () => {
    try {
      const result = await onVerify(recipientFingerprint, true);
      
      if (result.verified) {
        setStatusMessage('This conversation is now marked as verified!');
      } else {
        setVerificationError('Could not mark as verified: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationError('Error marking as verified: ' + (error.message || 'Unknown error'));
    }
  };
  
  return (
    <Modal onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContent>
        <ModalTitle>
          <FaShieldAlt /> End-to-End Encryption
        </ModalTitle>
        
        <Tabs>
          <Tab
            active={activeTab === 'verify'}
            onClick={() => setActiveTab('verify')}
          >
            Verify Security
          </Tab>
          <Tab
            active={activeTab === 'about'}
            onClick={() => setActiveTab('about')}
          >
            About Encryption
          </Tab>
        </Tabs>
        
        {activeTab === 'verify' && (
          <>
            <p>End-to-end encryption is active for this conversation.</p>
            
            {keyRotationStatus && keyRotationStatus.warningPeriod && (
              <div style={{
                padding: '0.5rem',
                margin: '0.5rem 0',
                background: 'rgba(255, 187, 0, 0.1)',
                border: '1px solid var(--warning-color, #ffbb00)',
                borderRadius: '4px',
                fontSize: '0.9rem'
              }}>
                <strong>Note:</strong> Your encryption keys will expire in {keyRotationStatus.daysRemaining} days.
                Generate new keys soon to maintain secure communication.
              </div>
            )}
            
            <VerificationSection>
              <h4>Your Key Fingerprint:</h4>
              <KeyFingerprint>
                <FingerprintDetails>
                  <FingerprintRow>
                    <FaFingerprint /> Hex: {userFingerprint?.hex || 'Loading...'}
                    <button 
                      onClick={() => copyToClipboard(userFingerprint?.hex, 'Hex')}
                      title="Copy hex fingerprint"
                    >
                      <FaCopy />
                    </button>
                  </FingerprintRow>
                  <FingerprintRow>
                    <FaKey /> Numbers: {userFingerprint?.numeric || 'Loading...'}
                    <button 
                      onClick={() => copyToClipboard(userFingerprint?.numeric, 'Numeric')}
                      title="Copy numeric fingerprint"
                    >
                      <FaCopy />
                    </button>
                  </FingerprintRow>
                </FingerprintDetails>
              </KeyFingerprint>
              
              <h4>
                {recipientName}'s Key Fingerprint:
                {verificationStatus !== VERIFICATION_STATUS.UNVERIFIED && (
                  <VerificationBadge 
                    verified={verificationStatus === VERIFICATION_STATUS.VERIFIED}
                    mismatch={verificationStatus === VERIFICATION_STATUS.MISMATCH}
                  >
                    {verificationStatus === VERIFICATION_STATUS.VERIFIED ? 
                      <><FaCheckCircle /> Verified</> : 
                      <><FaTimesCircle /> Mismatch</>}
                  </VerificationBadge>
                )}
              </h4>
              
              <KeyFingerprint isRecipient>
                <FingerprintDetails>
                  <FingerprintRow>
                    <FaFingerprint /> Hex: {recipientFingerprint?.hex || 'Loading...'}
                    <button 
                      onClick={() => copyToClipboard(recipientFingerprint?.hex, 'Recipient hex')}
                      title="Copy hex fingerprint"
                    >
                      <FaCopy />
                    </button>
                  </FingerprintRow>
                  <FingerprintRow>
                    <FaKey /> Numbers: {recipientFingerprint?.numeric || 'Loading...'}
                    <button 
                      onClick={() => copyToClipboard(recipientFingerprint?.numeric, 'Recipient numeric')}
                      title="Copy numeric fingerprint"
                    >
                      <FaCopy />
                    </button>
                  </FingerprintRow>
                </FingerprintDetails>
              </KeyFingerprint>
              
              {userFingerprint && recipientFingerprint && (
                <>
                  <VerificationInstruction>
                    <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                      <FaShieldAlt color="var(--success-color, #00ff00)" /> Secure Verification
                    </div>
                    <p style={{ marginBottom: '0.5rem' }}>
                      To confirm your conversation is secure, ask {recipientName} to share 
                      their key fingerprint through another channel (in-person, phone call, etc.).
                    </p>
                    <p>
                      If the fingerprints match exactly, your conversation is secure from 
                      man-in-the-middle attacks.
                    </p>
                  </VerificationInstruction>
                  
                  <ManualVerificationSection>
                    <label>
                      Manual Verification:
                      <Input 
                        type="text" 
                        placeholder="Enter fingerprint for verification..."
                        value={manualFingerprint}
                        onChange={(e) => setManualFingerprint(e.target.value)}
                      />
                    </label>
                    
                    {verificationError && (
                      <ErrorMessage>{verificationError}</ErrorMessage>
                    )}
                    
                    <ButtonGroup>
                      <Button onClick={handleVerify}>
                        Verify Fingerprint
                      </Button>
                      <Button 
                        primary 
                        onClick={handleMarkAsVerified}
                        disabled={verificationStatus === VERIFICATION_STATUS.VERIFIED}
                      >
                        {verificationStatus === VERIFICATION_STATUS.VERIFIED ? 
                          'Already Verified' : 'Mark as Verified'}
                      </Button>
                    </ButtonGroup>
                  </ManualVerificationSection>
                </>
              )}
            </VerificationSection>
            
            {statusMessage && (
              <StatusMessage success={!statusMessage.includes('failed') && !statusMessage.includes('error')}>
                {statusMessage}
              </StatusMessage>
            )}
          </>
        )}
        
        {activeTab === 'about' && (
          <div>
            <h4>About End-to-End Encryption</h4>
            <p>
              RetroChat uses strong encryption to protect your private messages. Only you and 
              {recipientName} can read these messages - not even our servers can access the content.
            </p>
            
            <h4>Key Features:</h4>
            <ul>
              <li>Messages are encrypted on your device before sending</li>
              <li>Only the recipient's device can decrypt the messages</li>
              <li>Keys are automatically rotated for enhanced security</li>
              <li>You can verify security through key fingerprints</li>
              <li>Self-destructing messages are available for extra privacy</li>
            </ul>
            
            <h4>Verifying Security</h4>
            <p>
              To ensure maximum security, verify that you're communicating with the real 
              {recipientName} by comparing fingerprints through a different channel (in person, 
              phone call, etc.).
            </p>
            
            <h4>Key Management</h4>
            <p>
              Your encryption keys are stored securely on your device. For added security:
            </p>
            <ul>
              <li>Create regular backups of your keys</li>
              <li>Generate new keys if you suspect compromise</li>
              <li>Verify contacts after they generate new keys</li>
            </ul>
            
            <p style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.8 }}>
              For more details, see our full <a href="/encryption-protocol" target="_blank" rel="noopener noreferrer">Encryption Protocol documentation</a>.
            </p>
          </div>
        )}
        
        <ButtonGroup>
          <Button onClick={onClose}>Close</Button>
          <Button 
            primary 
            onClick={() => {
              if (navigator.clipboard && userFingerprint) {
                copyToClipboard(
                  `RetroChat Security Verification:\n` +
                  `Hex: ${userFingerprint.hex}\n` +
                  `Numbers: ${userFingerprint.numeric}`,
                  'Complete'
                );
              }
            }}
          >
            Copy My Fingerprint
          </Button>
        </ButtonGroup>
      </ModalContent>
    </Modal>
  );
};

export default KeyVerificationModal;