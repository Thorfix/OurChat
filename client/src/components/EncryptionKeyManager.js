import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { 
  FaKey, 
  FaSync, 
  FaDownload, 
  FaUpload, 
  FaFingerprint, 
  FaExclamationTriangle, 
  FaCheckCircle,
  FaQuestionCircle,
  FaLock,
  FaShieldAlt,
  FaBell
} from 'react-icons/fa';
import { usePrivateMessaging } from '../context/PrivateMessagingContext';

const Container = styled.div`
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--primary-color);
  padding: 1.5rem;
  margin: 1.5rem 0;
  border-radius: 4px;
`;

const Title = styled.h3`
  color: var(--primary-color);
  margin-top: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const KeyStatusCard = styled.div`
  background: ${props => {
    if (props.error) return 'rgba(255, 68, 68, 0.1)';
    if (props.warning) return 'rgba(255, 187, 0, 0.1)';
    return 'rgba(0, 0, 0, 0.3)';
  }};
  border: 1px solid ${props => {
    if (props.error) return 'var(--danger-color, #ff4444)';
    if (props.warning) return 'var(--warning-color, #ffbb00)';
    return 'var(--primary-color)';
  }};
  padding: 1rem;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StatusInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const StatusIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: bold;
  color: ${props => {
    if (props.error) return 'var(--danger-color, #ff4444)';
    if (props.warning) return 'var(--warning-color, #ffbb00)';
    if (props.success) return 'var(--success-color, #00cc00)';
    return 'var(--text-color)';
  }};
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: ${props => props.marginTop || '1rem'};
`;

const Button = styled.button`
  background: ${props => props.primary ? 'var(--primary-color)' : 'transparent'};
  color: ${props => props.primary ? 'var(--background-color)' : 'var(--text-color)'};
  border: 1px solid var(--primary-color);
  padding: 0.5rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

const FingerprintDisplay = styled.div`
  font-family: monospace;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.8rem;
  margin: 0.5rem 0;
  border-radius: 3px;
  word-break: break-all;
`;

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
`;

const ModalTitle = styled.h3`
  color: var(--primary-color);
  margin-top: 0;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.7rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--primary-color);
  color: var(--text-color);
  font-family: var(--font-retro);
  margin-bottom: 1rem;
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 150px;
  padding: 0.7rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--primary-color);
  color: var(--text-color);
  font-family: monospace;
  margin-bottom: 1rem;
  resize: vertical;
`;

const ErrorMessage = styled.div`
  color: var(--danger-color, #ff4444);
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: rgba(255, 0, 0, 0.1);
  border-radius: 3px;
`;

const SuccessMessage = styled.div`
  color: var(--success-color, #00cc00);
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: rgba(0, 204, 0, 0.1);
  border-radius: 3px;
`;

const FileInput = styled.input`
  display: none;
`;

const InfoBox = styled.div`
  background: rgba(0, 0, 0, 0.2);
  padding: 0.8rem;
  margin: 1rem 0;
  border-radius: 3px;
  font-size: 0.9rem;
`;

const SelectGroup = styled.div`
  margin-bottom: 1rem;
`;

const Select = styled.select`
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--primary-color);
  color: var(--text-color);
  padding: 0.5rem;
  font-family: var(--font-retro);
  width: 100%;
`;

/**
 * EncryptionKeyManager Component
 * 
 * A comprehensive UI for managing encryption keys, including:
 * - Key status and rotation
 * - Key fingerprint display
 * - Key backup and recovery
 * - Key verification
 */
const EncryptionKeyManager = () => {
  const { 
    keyPair,
    keyFingerprint,
    isGeneratingKeys,
    generateNewKeyPair,
    createKeyBackup,
    restoreFromBackup,
    encryptionStatus,
    keyRotationStatus,
    error,
    lastBackupDate,
    isBackingUp,
    isRestoring
  } = usePrivateMessaging();
  
  // Component state
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [confirmBackupPassword, setConfirmBackupPassword] = useState('');
  const [backupData, setBackupData] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreData, setRestoreData] = useState('');
  const [modalError, setModalError] = useState(null);
  const [modalSuccess, setModalSuccess] = useState(null);
  const [rotationInterval, setRotationInterval] = useState(30);
  const [showFingerprint, setShowFingerprint] = useState(false);
  
  const fileInputRef = useRef(null);
  
  // Calculate key age if available
  const keyAge = keyPair?.createdAt ? 
    Math.ceil((new Date() - new Date(keyPair.createdAt)) / (24 * 60 * 60 * 1000)) : 
    null;
  
  // Reset modal state when closed
  useEffect(() => {
    if (!showBackupModal) {
      setBackupPassword('');
      setConfirmBackupPassword('');
      setBackupData('');
      setModalError(null);
      setModalSuccess(null);
    }
    
    if (!showRestoreModal) {
      setRestorePassword('');
      setRestoreData('');
      setModalError(null);
      setModalSuccess(null);
    }
  }, [showBackupModal, showRestoreModal]);
  
  // Handle key backup
  const handleCreateBackup = async () => {
    setModalError(null);
    setModalSuccess(null);
    
    if (!backupPassword) {
      setModalError('Please enter a password to encrypt your backup');
      return;
    }
    
    if (backupPassword !== confirmBackupPassword) {
      setModalError('Passwords do not match');
      return;
    }
    
    if (backupPassword.length < 8) {
      setModalError('Password must be at least 8 characters long');
      return;
    }
    
    try {
      const backup = await createKeyBackup(backupPassword);
      if (backup) {
        setBackupData(backup.backupData);
        setModalSuccess('Backup created successfully! Save this data securely.');
      }
    } catch (error) {
      console.error('Backup creation error:', error);
      setModalError('Failed to create backup: ' + (error.message || 'Unknown error'));
    }
  };
  
  // Handle backup download
  const handleDownloadBackup = () => {
    if (!backupData) return;
    
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retrochat-key-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Handle backup file selection
  const handleBackupFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        // Validate it's a proper JSON before setting
        JSON.parse(event.target.result);
        setRestoreData(event.target.result);
      } catch (error) {
        setModalError('Invalid backup file format');
      }
    };
    reader.onerror = () => {
      setModalError('Error reading backup file');
    };
    reader.readAsText(file);
  };
  
  // Handle key restoration
  const handleRestoreBackup = async () => {
    setModalError(null);
    setModalSuccess(null);
    
    if (!restoreData) {
      setModalError('Please enter or upload backup data');
      return;
    }
    
    if (!restorePassword) {
      setModalError('Please enter the backup password');
      return;
    }
    
    try {
      // Try to parse the backup data to validate it
      JSON.parse(restoreData);
      
      const success = await restoreFromBackup(restoreData, restorePassword);
      if (success) {
        setModalSuccess('Keys restored successfully!');
        // Close the modal after 2 seconds
        setTimeout(() => setShowRestoreModal(false), 2000);
      }
    } catch (error) {
      console.error('Restore error:', error);
      setModalError('Failed to restore from backup: ' + (error.message || 'Unknown error'));
    }
  };
  
  // Handle key rotation
  const handleKeyRotation = async () => {
    setModalError(null);
    setModalSuccess(null);
    
    try {
      const newKeyPair = await generateNewKeyPair(parseInt(rotationInterval));
      if (newKeyPair) {
        setModalSuccess('New encryption keys generated successfully!');
        // Close the modal after 2 seconds
        setTimeout(() => setShowRotateModal(false), 2000);
      }
    } catch (error) {
      console.error('Key rotation error:', error);
      setModalError('Failed to generate new keys: ' + (error.message || 'Unknown error'));
    }
  };
  
  return (
    <Container>
      <Title><FaKey /> Encryption Key Management</Title>
      
      <KeyStatusCard 
        error={encryptionStatus === 'error'} 
        warning={encryptionStatus === 'expiring'}
      >
        <StatusInfo>
          <StatusIndicator 
            error={encryptionStatus === 'error'}
            warning={encryptionStatus === 'expiring'}
            success={encryptionStatus === 'active'}
          >
            {encryptionStatus === 'error' && <FaExclamationTriangle />}
            {encryptionStatus === 'expiring' && <FaBell />}
            {encryptionStatus === 'active' && <FaCheckCircle />}
            
            {encryptionStatus === 'error' && 'Encryption Error'}
            {encryptionStatus === 'inactive' && 'Encryption Inactive'}
            {encryptionStatus === 'unknown' && 'Checking Status...'}
            {encryptionStatus === 'expiring' && 'Keys Expiring Soon'}
            {encryptionStatus === 'active' && 'Encryption Active'}
          </StatusIndicator>
          
          {keyPair && (
            <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
              <div>Key ID: {keyPair.keyId.substring(0, 8)}...</div>
              
              {keyRotationStatus && (
                <div style={{ marginTop: '0.3rem' }}>
                  {keyRotationStatus.needsRotation ? (
                    <span style={{ color: 'var(--danger-color, #ff4444)' }}>
                      Keys expired, please rotate now
                    </span>
                  ) : (
                    <>
                      <span>
                        Expires in {keyRotationStatus.daysRemaining} days
                      </span>
                      {keyRotationStatus.warningPeriod && (
                        <span style={{ color: 'var(--warning-color, #ffbb00)', marginLeft: '0.5rem' }}>
                          (Rotate soon!)
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {keyAge && (
                <div style={{ marginTop: '0.3rem' }}>
                  Key age: {keyAge} {keyAge === 1 ? 'day' : 'days'}
                </div>
              )}
              
              {lastBackupDate && (
                <div style={{ marginTop: '0.3rem', fontSize: '0.8rem' }}>
                  Last backup: {new Date(lastBackupDate).toLocaleDateString()}
                </div>
              )}
            </div>
          )}
          
          {error && (
            <div style={{ color: 'var(--danger-color, #ff4444)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}
        </StatusInfo>
        
        <ButtonGroup>
          <Button 
            primary 
            onClick={() => setShowRotateModal(true)} 
            disabled={isGeneratingKeys}
          >
            <FaSync /> {isGeneratingKeys ? 'Generating...' : 'Rotate Keys'}
          </Button>
        </ButtonGroup>
      </KeyStatusCard>
      
      {keyFingerprint && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>
              <FaFingerprint /> Your Key Fingerprint
            </h4>
            <Button onClick={() => setShowFingerprint(!showFingerprint)}>
              {showFingerprint ? 'Hide' : 'Show'} Fingerprint
            </Button>
          </div>
          
          {showFingerprint && (
            <div>
              <FingerprintDisplay>
                <div>Hex: {keyFingerprint.hex}</div>
                <div style={{ marginTop: '0.5rem' }}>Numbers: {keyFingerprint.numeric}</div>
              </FingerprintDisplay>
              
              <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                <FaShieldAlt style={{ marginRight: '0.5rem' }} />
                This fingerprint uniquely identifies your encryption keys. Verify 
                it with contacts for maximum security.
              </div>
            </div>
          )}
        </div>
      )}
      
      <InfoBox>
        <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
          <FaLock style={{ marginRight: '0.5rem' }} />
          Encryption Key Security
        </div>
        <p>
          Your encryption keys are stored only on this device. To prevent message loss
          if you change devices or clear your browser data, create a backup regularly.
        </p>
      </InfoBox>
      
      <ButtonGroup marginTop="1.5rem">
        <Button onClick={() => setShowBackupModal(true)} disabled={!keyPair || isBackingUp}>
          <FaDownload /> {isBackingUp ? 'Creating Backup...' : 'Backup Keys'}
        </Button>
        <Button onClick={() => setShowRestoreModal(true)} disabled={isRestoring}>
          <FaUpload /> {isRestoring ? 'Restoring...' : 'Restore from Backup'}
        </Button>
      </ButtonGroup>
      
      {/* Backup Modal */}
      {showBackupModal && (
        <Modal onClick={(e) => e.target === e.currentTarget && setShowBackupModal(false)}>
          <ModalContent>
            <ModalTitle>
              <FaDownload /> Backup Encryption Keys
            </ModalTitle>
            
            <p>
              Create an encrypted backup of your keys. You'll need this backup
              if you change devices or clear your browser data.
            </p>
            
            {modalError && <ErrorMessage>{modalError}</ErrorMessage>}
            {modalSuccess && <SuccessMessage>{modalSuccess}</SuccessMessage>}
            
            {!backupData ? (
              <>
                <Input
                  type="password"
                  placeholder="Backup Password"
                  value={backupPassword}
                  onChange={(e) => setBackupPassword(e.target.value)}
                />
                
                <Input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmBackupPassword}
                  onChange={(e) => setConfirmBackupPassword(e.target.value)}
                />
                
                <InfoBox>
                  <FaExclamationTriangle style={{ marginRight: '0.5rem', color: 'var(--warning-color, #ffbb00)' }} />
                  Choose a strong password you won't forget. If you lose this password,
                  you won't be able to restore your keys!
                </InfoBox>
                
                <ButtonGroup>
                  <Button onClick={() => setShowBackupModal(false)}>
                    Cancel
                  </Button>
                  <Button 
                    primary 
                    onClick={handleCreateBackup}
                    disabled={!backupPassword || backupPassword !== confirmBackupPassword || isBackingUp}
                  >
                    {isBackingUp ? 'Creating...' : 'Create Backup'}
                  </Button>
                </ButtonGroup>
              </>
            ) : (
              <>
                <div>
                  <label>Backup Data:</label>
                  <Textarea 
                    value={backupData} 
                    readOnly 
                    onClick={(e) => e.target.select()}
                  />
                </div>
                
                <InfoBox>
                  <FaExclamationTriangle style={{ marginRight: '0.5rem', color: 'var(--warning-color, #ffbb00)' }} />
                  Save this data securely. You can copy it to a password manager or
                  download it as a file. Keep it private!
                </InfoBox>
                
                <ButtonGroup>
                  <Button onClick={() => setShowBackupModal(false)}>
                    Close
                  </Button>
                  <Button 
                    primary
                    onClick={handleDownloadBackup}
                  >
                    <FaDownload /> Download Backup File
                  </Button>
                </ButtonGroup>
              </>
            )}
          </ModalContent>
        </Modal>
      )}
      
      {/* Restore Modal */}
      {showRestoreModal && (
        <Modal onClick={(e) => e.target === e.currentTarget && setShowRestoreModal(false)}>
          <ModalContent>
            <ModalTitle>
              <FaUpload /> Restore Encryption Keys
            </ModalTitle>
            
            <p>
              Restore your encryption keys from a backup. This will replace
              your current keys.
            </p>
            
            {modalError && <ErrorMessage>{modalError}</ErrorMessage>}
            {modalSuccess && <SuccessMessage>{modalSuccess}</SuccessMessage>}
            
            <div>
              <label>Backup Data:</label>
              <Textarea 
                value={restoreData} 
                onChange={(e) => setRestoreData(e.target.value)}
                placeholder="Paste your backup data here"
              />
              
              <ButtonGroup style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                <Button onClick={() => fileInputRef.current?.click()}>
                  <FaUpload /> Upload Backup File
                </Button>
                <FileInput 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".json,application/json" 
                  onChange={handleBackupFileSelected}
                />
              </ButtonGroup>
            </div>
            
            <Input
              type="password"
              placeholder="Backup Password"
              value={restorePassword}
              onChange={(e) => setRestorePassword(e.target.value)}
            />
            
            <InfoBox>
              <FaExclamationTriangle style={{ marginRight: '0.5rem', color: 'var(--warning-color, #ffbb00)' }} />
              Restoring will replace your current encryption keys. Any messages
              encrypted with your current keys won't be readable afterwards.
            </InfoBox>
            
            <ButtonGroup>
              <Button onClick={() => setShowRestoreModal(false)}>
                Cancel
              </Button>
              <Button 
                primary 
                onClick={handleRestoreBackup}
                disabled={!restoreData || !restorePassword || isRestoring}
              >
                {isRestoring ? 'Restoring...' : 'Restore Keys'}
              </Button>
            </ButtonGroup>
          </ModalContent>
        </Modal>
      )}
      
      {/* Rotate Keys Modal */}
      {showRotateModal && (
        <Modal onClick={(e) => e.target === e.currentTarget && setShowRotateModal(false)}>
          <ModalContent>
            <ModalTitle>
              <FaSync /> Generate New Encryption Keys
            </ModalTitle>
            
            <p>
              Generate new encryption keys to enhance your security. Your 
              old keys will be replaced.
            </p>
            
            {modalError && <ErrorMessage>{modalError}</ErrorMessage>}
            {modalSuccess && <SuccessMessage>{modalSuccess}</SuccessMessage>}
            
            <SelectGroup>
              <label>Key rotation interval:</label>
              <Select 
                value={rotationInterval} 
                onChange={(e) => setRotationInterval(e.target.value)}
              >
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days (recommended)</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </Select>
            </SelectGroup>
            
            <InfoBox>
              <FaExclamationTriangle style={{ marginRight: '0.5rem', color: 'var(--warning-color, #ffbb00)' }} />
              After rotation, you should:
              <ul style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                <li>Create a new backup of your keys</li>
                <li>Re-verify your fingerprint with contacts</li>
              </ul>
            </InfoBox>
            
            <ButtonGroup>
              <Button onClick={() => setShowRotateModal(false)}>
                Cancel
              </Button>
              <Button 
                primary 
                onClick={handleKeyRotation}
                disabled={isGeneratingKeys}
              >
                {isGeneratingKeys ? 'Generating...' : 'Generate New Keys'}
              </Button>
            </ButtonGroup>
          </ModalContent>
        </Modal>
      )}
    </Container>
  );
};

export default EncryptionKeyManager;