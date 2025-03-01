/**
 * End-to-End Encryption Integration Tests
 * 
 * These tests verify the complete encryption workflow from key generation
 * to message exchange, ensuring all components work together correctly.
 */

import {
  generateKeyPair,
  encryptMessage,
  decryptMessage,
  prepareEncryptedMessage,
  generateKeyFingerprint,
  compareFingerprints,
  backupKeys,
  restoreKeysFromBackup
} from '../utils/encryptionUtils';

// This is an integration test that tests the full encryption flow
describe('End-to-End Encryption Integration', () => {
  // We'll use the actual WebCrypto API for these tests if available
  const hasWebCrypto = typeof window !== 'undefined' && 
                      window.crypto && 
                      window.crypto.subtle;
  
  // Skip tests if WebCrypto is not available (e.g., in Node.js environment)
  const testOrSkip = hasWebCrypto ? test : test.skip;
  
  testOrSkip('Full message encryption and decryption workflow', async () => {
    // 1. Generate key pairs for both sender and recipient
    const senderKeyPair = await generateKeyPair(30);
    const recipientKeyPair = await generateKeyPair(30);
    
    // 2. Prepare a test message
    const originalMessage = 'This is a secret message for integration testing!';
    
    // 3. Encrypt the message from sender to recipient
    const encryptedData = await encryptMessage(originalMessage, recipientKeyPair.publicKey);
    
    // 4. Decrypt the message with recipient's private key
    const decryptedMessage = await decryptMessage(encryptedData, recipientKeyPair.privateKey);
    
    // 5. Verify the decrypted message matches the original
    expect(decryptedMessage).toEqual(originalMessage);
    
    // 6. Try to encrypt with prepareEncryptedMessage (with expiration)
    const messagePackage = await prepareEncryptedMessage(
      'Message with expiration',
      recipientKeyPair.publicKey,
      null, // no image
      10    // expires in 10 minutes
    );
    
    // 7. Verify the message package format
    expect(messagePackage).toHaveProperty('content');
    expect(messagePackage).toHaveProperty('expiresInMinutes', 10);
    
    // 8. Parse and decrypt the prepared message
    const parsedContent = JSON.parse(messagePackage.content);
    const decryptedPreparedMessage = await decryptMessage(parsedContent, recipientKeyPair.privateKey);
    
    expect(decryptedPreparedMessage).toEqual('Message with expiration');
  }, 10000); // Increased timeout for crypto operations

  testOrSkip('Key backup and restore workflow', async () => {
    // 1. Generate a key pair to back up
    const originalKeyPair = await generateKeyPair(30);
    
    // 2. Create a backup with a password
    const backupPassword = 'secure-test-password-123';
    const backupData = await backupKeys(originalKeyPair, backupPassword);
    
    expect(backupData).toHaveProperty('backupData');
    expect(backupData).toHaveProperty('createdAt');
    
    // 3. Restore the keys from backup
    const restoredKeyPair = await restoreKeysFromBackup(
      backupData.backupData,
      backupPassword
    );
    
    // 4. Verify the restored keys match the original
    expect(restoredKeyPair.keyId).toEqual(originalKeyPair.keyId);
    expect(restoredKeyPair.publicKey).toEqual(originalKeyPair.publicKey);
    expect(restoredKeyPair.privateKey).toEqual(originalKeyPair.privateKey);
    
    // 5. Try to restore with wrong password (should fail)
    try {
      await restoreKeysFromBackup(backupData.backupData, 'wrong-password');
      // If we get here, the test should fail
      expect(true).toBe(false); // This should not execute
    } catch (error) {
      // We expect an error here
      expect(error.message).toContain('Failed to restore from backup');
    }
  }, 10000); // Increased timeout for crypto operations

  testOrSkip('Key fingerprint generation and verification', async () => {
    // 1. Generate a key pair
    const keyPair = await generateKeyPair(30);
    
    // 2. Generate a fingerprint for the public key
    const fingerprint = await generateKeyFingerprint(keyPair.publicKey);
    
    expect(fingerprint).toHaveProperty('hex');
    expect(fingerprint).toHaveProperty('numeric');
    
    // 3. Generate it again - should be identical for the same key
    const fingerprint2 = await generateKeyFingerprint(keyPair.publicKey);
    
    // 4. Verify fingerprints match
    expect(compareFingerprints(fingerprint, fingerprint2)).toBe(true);
    
    // 5. Generate a different key pair
    const differentKeyPair = await generateKeyPair(30);
    const differentFingerprint = await generateKeyFingerprint(differentKeyPair.publicKey);
    
    // 6. Verify fingerprints don't match
    expect(compareFingerprints(fingerprint, differentFingerprint)).toBe(false);
  }, 10000); // Increased timeout for crypto operations
});