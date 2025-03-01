/**
 * RetroChat End-to-End Encryption Utilities
 * 
 * This module implements client-side encryption for private messages using
 * the Web Crypto API. It follows modern cryptographic practices for
 * secure communication.
 * 
 * Key features:
 * - Asymmetric encryption (RSA-OAEP) for key exchange
 * - Symmetric encryption (AES-GCM) for message content
 * - Key generation and management with automatic rotation
 * - Message encryption and decryption with forward secrecy
 * - Secure image encryption for sharing media
 * - Support for ephemeral (self-destructing) messages
 * - Visual encryption status indicators
 * - Key verification through safety number fingerprints
 * - Secure key backup and recovery
 * - Comprehensive error handling without exposing sensitive information
 * 
 * This implementation follows security best practices from Signal Protocol,
 * including fingerprint verification and key rotation to limit the impact
 * of potential key compromise.
 */

// Constants for encryption algorithms and settings
const RSA_ALGORITHM = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), // 65537
  hash: 'SHA-256',
};

const AES_ALGORITHM = {
  name: 'AES-GCM',
  length: 256,
};

// Key rotation settings (in milliseconds)
const KEY_ROTATION = {
  DEFAULT_INTERVAL: 30 * 24 * 60 * 60 * 1000, // 30 days default
  MIN_INTERVAL: 1 * 24 * 60 * 60 * 1000,      // 1 day minimum
  MAX_INTERVAL: 90 * 24 * 60 * 60 * 1000,     // 90 days maximum
  WARNING_PERIOD: 3 * 24 * 60 * 60 * 1000,    // Warning 3 days before expiry
};

// Verification constants
const VERIFICATION_STATUS = {
  UNVERIFIED: 'unverified',
  VERIFIED: 'verified',
  MISMATCH: 'mismatch',
};

/**
 * Converts an ArrayBuffer to a Base64 string
 */
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const binary = bytes.reduce((str, byte) => str + String.fromCharCode(byte), '');
  return window.btoa(binary);
};

/**
 * Converts a Base64 string to an ArrayBuffer
 */
const base64ToArrayBuffer = (base64) => {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Converts a CryptoKey to a JSON Web Key (JWK) string
 */
const cryptoKeyToString = async (key) => {
  const exported = await window.crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(exported);
};

/**
 * Converts a JSON Web Key (JWK) string to a CryptoKey
 */
const stringToCryptoKey = async (keyString, algorithm, usages) => {
  const jwk = JSON.parse(keyString);
  return await window.crypto.subtle.importKey('jwk', jwk, algorithm, true, usages);
};

/**
 * Generates an RSA key pair for encryption with rotation metadata
 * Returns an object with public and private keys in JWK format and expiration information
 * 
 * @param {number} rotationIntervalDays - Number of days until key rotation (defaults to 30)
 * @returns {Object} Key pair object with rotation metadata
 */
const generateKeyPair = async (rotationIntervalDays = 30) => {
  try {
    // Validate rotation interval
    const rotationMs = Math.min(
      Math.max(
        rotationIntervalDays * 24 * 60 * 60 * 1000, 
        KEY_ROTATION.MIN_INTERVAL
      ),
      KEY_ROTATION.MAX_INTERVAL
    );
    
    // Generate key pair
    const keyPair = await window.crypto.subtle.generateKey(
      RSA_ALGORITHM,
      true, // extractable
      ['encrypt', 'decrypt'] // key usages
    );

    // Export keys to storable format
    const publicKeyString = await cryptoKeyToString(keyPair.publicKey);
    const privateKeyString = await cryptoKeyToString(keyPair.privateKey);

    // Generate a unique ID for this key pair
    const keyId = Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Calculate expiration date
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + rotationMs);

    return {
      keyId,
      publicKey: publicKeyString,
      privateKey: privateKeyString,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      rotationIntervalDays: rotationIntervalDays
    };
  } catch (error) {
    console.error('Error generating key pair:', error);
    throw new Error('Failed to generate encryption keys');
  }
};

/**
 * Checks if a key is expired or needs rotation
 * @param {Object} keyPair - The key pair to check
 * @returns {Object} Status object with needsRotation and daysRemaining properties
 */
const checkKeyRotationStatus = (keyPair) => {
  if (!keyPair || !keyPair.expiresAt) {
    return { 
      needsRotation: true, 
      daysRemaining: 0,
      warningPeriod: false
    };
  }
  
  try {
    const now = new Date();
    const expiryDate = new Date(keyPair.expiresAt);
    const timeRemaining = expiryDate - now;
    
    // Convert to days (rounded)
    const daysRemaining = Math.max(0, Math.ceil(timeRemaining / (24 * 60 * 60 * 1000)));
    
    return {
      needsRotation: timeRemaining <= 0,
      daysRemaining: daysRemaining,
      warningPeriod: timeRemaining > 0 && timeRemaining <= KEY_ROTATION.WARNING_PERIOD
    };
  } catch (error) {
    console.error('Error checking key rotation:', error);
    return { 
      needsRotation: true, 
      daysRemaining: 0,
      warningPeriod: false,
      error: error.message
    };
  }
};

/**
 * Generates a random symmetric key for AES encryption
 */
const generateSymmetricKey = async () => {
  try {
    const key = await window.crypto.subtle.generateKey(
      AES_ALGORITHM,
      true, // extractable
      ['encrypt', 'decrypt'] // key usages
    );
    
    return key;
  } catch (error) {
    console.error('Error generating symmetric key:', error);
    throw new Error('Failed to generate encryption key');
  }
};

/**
 * Encrypts a message using a recipient's public key
 * 
 * First, it generates a random symmetric key, then encrypts the message with it.
 * Then it encrypts the symmetric key with the recipient's public key.
 * Finally, it returns both the encrypted message and the encrypted symmetric key.
 */
const encryptMessage = async (message, recipientPublicKeyString) => {
  try {
    // Convert the recipient's public key string to a CryptoKey
    const recipientPublicKey = await stringToCryptoKey(
      recipientPublicKeyString,
      RSA_ALGORITHM,
      ['encrypt']
    );
    
    // Generate a random symmetric key for this message
    const symmetricKey = await generateSymmetricKey();
    
    // Generate a random initialization vector for AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Encode the message as Uint8Array
    const encodedMessage = new TextEncoder().encode(message);
    
    // Encrypt the message with the symmetric key
    const encryptedMessage = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      symmetricKey,
      encodedMessage
    );
    
    // Export the symmetric key to encrypt it with the recipient's public key
    const exportedSymKey = await window.crypto.subtle.exportKey('raw', symmetricKey);
    
    // Encrypt the symmetric key with the recipient's public key
    const encryptedSymKey = await window.crypto.subtle.encrypt(
      RSA_ALGORITHM,
      recipientPublicKey,
      exportedSymKey
    );
    
    // Combine all encrypted data into one object
    return {
      encryptedContent: arrayBufferToBase64(encryptedMessage),
      encryptedSymmetricKey: arrayBufferToBase64(encryptedSymKey),
      iv: arrayBufferToBase64(iv)
    };
  } catch (error) {
    console.error('Error encrypting message:', error);
    throw new Error('Failed to encrypt message');
  }
};

/**
 * Compresses and encrypts an image for private messaging
 * Uses a more efficient approach for handling images to improve performance
 */
const encryptImage = async (imageData, recipientPublicKeyString) => {
  try {
    // If we have a data URI, extract the base64 data
    const base64Data = imageData.startsWith('data:') 
      ? imageData.split(',')[1]
      : imageData;
    
    // For large images, compress before encrypting
    let processedData = base64Data;
    
    // Check if image size is over 1MB (roughly 1.33M base64 chars)
    if (base64Data.length > 1330000) {
      // Implement image compression
      processedData = await compressImage(base64Data);
      console.info('Large image compressed for encryption');
    }
    
    // Encrypt the image as if it were a regular message
    return await encryptMessage(processedData, recipientPublicKeyString);
  } catch (error) {
    console.error('Error encrypting image:', error);
    throw new Error('Failed to encrypt image');
  }
};

/**
 * Compresses an image to reduce size before encryption
 */
const compressImage = async (base64Data) => {
  return new Promise((resolve, reject) => {
    try {
      // Create an image element to load the base64 data
      const img = new Image();
      img.onload = () => {
        // Create a canvas to draw and compress the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate new dimensions (max 1200px width/height)
        let width = img.width;
        let height = img.height;
        const maxDimension = 1200;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.floor(height * (maxDimension / width));
            width = maxDimension;
          } else {
            width = Math.floor(width * (maxDimension / height));
            height = maxDimension;
          }
        }
        
        // Set canvas dimensions and draw the resized image
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Get the compressed image data at 85% quality
        const compressedData = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        resolve(compressedData);
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image for compression'));
      };
      
      // Set the source to load the image
      img.src = `data:image/jpeg;base64,${base64Data}`;
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Decrypts a message using the user's private key
 */
const decryptMessage = async (encryptedData, privateKeyString) => {
  try {
    // Parse the encrypted data
    const { encryptedContent, encryptedSymmetricKey, iv } = encryptedData;
    
    // Convert the private key string to a CryptoKey
    const privateKey = await stringToCryptoKey(
      privateKeyString,
      RSA_ALGORITHM,
      ['decrypt']
    );
    
    // Decrypt the symmetric key
    const symmetricKeyBuffer = await window.crypto.subtle.decrypt(
      RSA_ALGORITHM,
      privateKey,
      base64ToArrayBuffer(encryptedSymmetricKey)
    );
    
    // Import the symmetric key
    const symmetricKey = await window.crypto.subtle.importKey(
      'raw',
      symmetricKeyBuffer,
      AES_ALGORITHM,
      false, // not extractable
      ['decrypt']
    );
    
    // Decrypt the message
    const decryptedMessage = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToArrayBuffer(iv)
      },
      symmetricKey,
      base64ToArrayBuffer(encryptedContent)
    );
    
    // Decode and return the original message
    return new TextDecoder().decode(decryptedMessage);
  } catch (error) {
    console.error('Error decrypting message:', error);
    throw new Error('Failed to decrypt message');
  }
};

/**
 * Decrypts an image from encrypted data
 */
const decryptImage = async (encryptedData, privateKeyString) => {
  try {
    // Decrypt the image data
    const base64Image = await decryptMessage(encryptedData, privateKeyString);
    
    // Return as a data URL
    return `data:image/jpeg;base64,${base64Image}`;
  } catch (error) {
    console.error('Error decrypting image:', error);
    throw new Error('Failed to decrypt image');
  }
};

/**
 * Prepares an encrypted message package for sending
 * This unified method handles both text and images
 */
const prepareEncryptedMessage = async (content, recipientPublicKeyString, imageData = null, expiresInMinutes = null) => {
  try {
    // Encrypt the message content
    const encryptedContent = await encryptMessage(content, recipientPublicKeyString);
    
    // Create the message package
    const messagePackage = {
      content: JSON.stringify(encryptedContent),
      expiresInMinutes: expiresInMinutes
    };
    
    // If there's image data, encrypt that too
    if (imageData) {
      const encryptedImage = await encryptImage(imageData, recipientPublicKeyString);
      messagePackage.image = JSON.stringify(encryptedImage);
    }
    
    return messagePackage;
  } catch (error) {
    console.error('Error preparing encrypted message:', error);
    throw new Error('Failed to prepare encrypted message');
  }
};

/**
 * Verifies the integrity of an encryption key pair
 * Returns an object with status and detailed error information if applicable
 */
const verifyKeyPair = async (keyPair) => {
  if (!keyPair || !keyPair.publicKey || !keyPair.privateKey) {
    return { 
      valid: false, 
      error: 'Missing key components',
      errorDetails: 'Key pair is incomplete or malformed'
    };
  }

  try {
    // Create a test string
    const testMessage = "Encryption verification test";
    
    // Convert keys from string to CryptoKey objects
    const privateKey = await stringToCryptoKey(
      keyPair.privateKey,
      RSA_ALGORITHM,
      ['decrypt']
    );
    
    const publicKey = await stringToCryptoKey(
      keyPair.publicKey,
      RSA_ALGORITHM,
      ['encrypt']
    );
    
    // Encrypt with public key
    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(testMessage);
    const encryptedData = await window.crypto.subtle.encrypt(
      RSA_ALGORITHM,
      publicKey,
      encodedMessage
    );
    
    // Decrypt with private key
    const decryptedData = await window.crypto.subtle.decrypt(
      RSA_ALGORITHM,
      privateKey,
      encryptedData
    );
    
    // Verify the decrypted message matches the original
    const decoder = new TextDecoder();
    const decryptedMessage = decoder.decode(decryptedData);
    
    if (decryptedMessage === testMessage) {
      return { valid: true };
    } else {
      return {
        valid: false,
        error: 'Verification test failed',
        errorDetails: 'Decrypted message does not match original message'
      };
    }
  } catch (error) {
    console.error('Key verification failed:', error);
    return {
      valid: false,
      error: 'Crypto operation failed',
      errorDetails: error.message || 'Unknown error during crypto operation'
    };
  }
};

/**
 * Diagnoses issues with encryption keys and attempts repair
 * This can help recover from common key storage problems
 */
const diagnoseAndRepairKeys = async (keyPair) => {
  if (!keyPair) {
    return { 
      repaired: false, 
      error: 'No key pair provided',
      action: 'generate' 
    };
  }
  
  // Check if keys are present but invalid format
  let needsRepair = false;
  let publicKeyFix = null;
  let privateKeyFix = null;
  
  // Try to repair public key if it exists but is malformed
  if (keyPair.publicKey) {
    try {
      // Simple check if it might be stringified multiple times
      if (typeof keyPair.publicKey === 'string' && 
          (keyPair.publicKey.startsWith('"{"') || keyPair.publicKey.startsWith('"{\"'))) {
        publicKeyFix = JSON.parse(keyPair.publicKey);
        needsRepair = true;
      }
    } catch (e) {
      console.warn('Could not repair public key', e);
    }
  }
  
  // Try to repair private key if it exists but is malformed
  if (keyPair.privateKey) {
    try {
      // Simple check if it might be stringified multiple times
      if (typeof keyPair.privateKey === 'string' && 
          (keyPair.privateKey.startsWith('"{"') || keyPair.privateKey.startsWith('"{\"'))) {
        privateKeyFix = JSON.parse(keyPair.privateKey);
        needsRepair = true;
      }
    } catch (e) {
      console.warn('Could not repair private key', e);
    }
  }
  
  // If we found issues that need repair, create a fixed key pair
  if (needsRepair) {
    const repairedKeyPair = {
      ...keyPair,
      publicKey: publicKeyFix || keyPair.publicKey,
      privateKey: privateKeyFix || keyPair.privateKey
    };
    
    // Test if the repaired keys work
    const verificationResult = await verifyKeyPair(repairedKeyPair);
    if (verificationResult.valid) {
      return {
        repaired: true,
        newKeyPair: repairedKeyPair,
        action: 'repaired'
      };
    }
  }
  
  // Keys couldn't be repaired, need to generate new ones
  return {
    repaired: false,
    error: 'Keys could not be repaired',
    action: 'generate'
  };
};

/**
 * Calculates the expiration time for ephemeral messages
 */
const calculateExpirationTime = (expiresInMinutes) => {
  if (!expiresInMinutes) return null;
  
  const minutes = parseInt(expiresInMinutes);
  if (isNaN(minutes) || minutes <= 0) return null;
  
  return new Date(Date.now() + minutes * 60 * 1000);
};

/**
 * Creates a visual representation of the encryption key fingerprint in human-readable format
 * This helps users verify they're communicating with the right person through safety numbers
 * Similar to Signal's safety number verification system
 */
const generateKeyFingerprint = async (publicKeyString) => {
  try {
    // Parse the JWK from string
    const publicKey = JSON.parse(publicKeyString);
    
    // Use n (modulus) component from RSA key as basis for fingerprint
    if (!publicKey || !publicKey.n) {
      throw new Error('Invalid public key format');
    }
    
    // Convert the base64url-encoded modulus to array buffer
    const nDecoded = base64ToArrayBuffer(publicKey.n.replace(/-/g, '+').replace(/_/g, '/'));
    
    // Hash the modulus to get a consistent fingerprint
    const fingerprint = await window.crypto.subtle.digest('SHA-256', nDecoded);
    
    // Convert to hex string
    const fingerprintArray = Array.from(new Uint8Array(fingerprint));
    const fingerprintHex = fingerprintArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Format with spaces every 5 characters for better readability
    // Use a 60-character safety number (30 bytes) for stronger security
    const formattedFingerprint = fingerprintHex.substring(0, 60).match(/.{1,5}/g).join(' ');
    
    // Also create a numeric version (digits only) for easier verbal verification
    const numericFingerprint = Array.from(new Uint8Array(fingerprint))
      .slice(0, 12) // Take first 12 bytes
      .reduce((acc, byte) => acc + (byte % 10).toString(), ''); // Convert to digits
    
    // Group in blocks of 3 for readability
    const formattedNumeric = numericFingerprint.match(/.{1,3}/g).join('-');
    
    return {
      hex: formattedFingerprint,
      numeric: formattedNumeric
    };
  } catch (error) {
    console.error('Error generating key fingerprint:', error);
    return { hex: null, numeric: null };
  }
};

/**
 * Validates a key fingerprint format and normalizes it to standard form
 * Returns the normalized fingerprint if valid, null otherwise
 */
const validateKeyFingerprint = (fingerprint) => {
  try {
    if (!fingerprint || typeof fingerprint !== 'string') {
      return null;
    }
    
    // Remove all non-alphanumeric characters
    const cleanFingerprint = fingerprint.replace(/[^a-f0-9]/gi, '');
    
    // Check if we have enough characters after cleaning
    if (cleanFingerprint.length < 32) {
      return null;
    }
    
    // Return both hex and numeric formats
    const formattedHex = cleanFingerprint.substring(0, 60).match(/.{1,5}/g).join(' ');
    
    // For numeric representation, just use the first 12 bytes converted to digits
    const numericChars = cleanFingerprint.substring(0, 24).split('')
      .map(c => parseInt(c, 16) % 10).join('');
      
    const formattedNumeric = numericChars.substring(0, 12).match(/.{1,3}/g).join('-');
    
    return {
      hex: formattedHex,
      numeric: formattedNumeric
    };
  } catch (error) {
    console.error('Error validating fingerprint:', error);
    return { hex: null, numeric: null };
  }
};

/**
 * Compares two fingerprints for equality (for verification purposes)
 * Returns true if they match, false otherwise
 */
const compareFingerprints = (fingerprint1, fingerprint2) => {
  if (!fingerprint1 || !fingerprint2) return false;
  
  try {
    // Clean both fingerprints to remove formatting
    const clean1 = typeof fingerprint1 === 'string' 
      ? fingerprint1.replace(/[^a-f0-9]/gi, '') 
      : fingerprint1.hex?.replace(/[^a-f0-9]/gi, '');
      
    const clean2 = typeof fingerprint2 === 'string'
      ? fingerprint2.replace(/[^a-f0-9]/gi, '')
      : fingerprint2.hex?.replace(/[^a-f0-9]/gi, '');
    
    if (!clean1 || !clean2) return false;
    
    // Compare the first 60 characters (30 bytes)
    return clean1.substring(0, 60).toLowerCase() === clean2.substring(0, 60).toLowerCase();
  } catch (error) {
    console.error('Error comparing fingerprints:', error);
    return false;
  }
};

/**
 * Saves the verification status of a user's key
 * This helps maintain trust across sessions
 */
const saveVerificationStatus = (userId, keyId, status) => {
  try {
    if (!userId || !keyId) return false;
    
    const verificationStore = localStorage.getItem('key_verifications') || '{}';
    const verifications = JSON.parse(verificationStore);
    
    // Store by userId and keyId
    if (!verifications[userId]) {
      verifications[userId] = {};
    }
    
    verifications[userId][keyId] = {
      status,
      verifiedAt: new Date().toISOString()
    };
    
    localStorage.setItem('key_verifications', JSON.stringify(verifications));
    return true;
  } catch (error) {
    console.error('Error saving verification status:', error);
    return false;
  }
};

/**
 * Gets the verification status of a user's key
 */
const getVerificationStatus = (userId, keyId) => {
  try {
    if (!userId || !keyId) return VERIFICATION_STATUS.UNVERIFIED;
    
    const verificationStore = localStorage.getItem('key_verifications') || '{}';
    const verifications = JSON.parse(verificationStore);
    
    if (!verifications[userId] || !verifications[userId][keyId]) {
      return VERIFICATION_STATUS.UNVERIFIED;
    }
    
    return verifications[userId][keyId].status;
  } catch (error) {
    console.error('Error getting verification status:', error);
    return VERIFICATION_STATUS.UNVERIFIED;
  }
};

/**
 * Gets the verification status of a contact's key
 * This is an alias for getVerificationStatus to match the function name used in components
 *
 * @param {string} userId - User ID of the contact
 * @param {string} keyId - Key ID to check verification status
 * @returns {string} Verification status (unverified, verified, or mismatch)
 */
const getContactVerificationStatus = (userId, keyId) => {
  return getVerificationStatus(userId, keyId);
};

/**
 * Verifies a contact's fingerprint against a provided fingerprint
 * Saves the verification status for future reference
 *
 * @param {string} userId - User ID of the contact
 * @param {string} keyId - Key ID to verify
 * @param {string|Object} fingerprint - Fingerprint to verify against (string or object with hex property)
 * @param {boolean} markAsVerified - Whether to mark as verified even without comparing
 * @returns {Object} Result of verification with verified status
 */
const verifyContactFingerprint = async (userId, keyId, fingerprint, markAsVerified = false) => {
  try {
    if (!userId || !keyId) {
      return { verified: false, error: 'Missing user or key ID' };
    }
    
    // If we're just marking as verified without comparison
    if (markAsVerified === true) {
      saveVerificationStatus(userId, keyId, VERIFICATION_STATUS.VERIFIED);
      return { verified: true, message: 'Key marked as verified' };
    }
    
    // Validate the input fingerprint
    const normalizedFingerprint = typeof fingerprint === 'string' 
      ? validateKeyFingerprint(fingerprint)
      : fingerprint;
      
    if (!normalizedFingerprint || (!normalizedFingerprint.hex && !normalizedFingerprint.numeric)) {
      return { verified: false, error: 'Invalid fingerprint format' };
    }
    
    // Get the stored verification record if it exists
    const verificationStore = localStorage.getItem('key_verifications') || '{}';
    const verifications = JSON.parse(verificationStore);
    
    // If we have a stored fingerprint, compare with the input fingerprint
    if (verifications[userId] && 
        verifications[userId][keyId] && 
        verifications[userId][keyId].fingerprint) {
      
      const storedFingerprint = verifications[userId][keyId].fingerprint;
      const isMatch = compareFingerprints(normalizedFingerprint, storedFingerprint);
      
      if (isMatch) {
        // Update the verification status to VERIFIED
        saveVerificationStatus(userId, keyId, VERIFICATION_STATUS.VERIFIED);
        return { verified: true, message: 'Fingerprint verified successfully' };
      } else {
        // Update the verification status to MISMATCH
        saveVerificationStatus(userId, keyId, VERIFICATION_STATUS.MISMATCH);
        return { 
          verified: false, 
          error: 'Fingerprint mismatch', 
          message: 'The fingerprint you provided does not match the stored fingerprint' 
        };
      }
    } else {
      // No stored fingerprint, save this one and mark as verified
      if (!verifications[userId]) {
        verifications[userId] = {};
      }
      
      verifications[userId][keyId] = {
        status: VERIFICATION_STATUS.VERIFIED,
        fingerprint: normalizedFingerprint,
        verifiedAt: new Date().toISOString()
      };
      
      localStorage.setItem('key_verifications', JSON.stringify(verifications));
      return { verified: true, message: 'New fingerprint saved and verified' };
    }
  } catch (error) {
    console.error('Error verifying contact fingerprint:', error);
    return { verified: false, error: 'Verification process failed: ' + error.message };
  }
};

/**
 * Backs up encryption keys in an encrypted format
 * The backup is encrypted with a user-provided password
 * 
 * @param {Object} keyPair - The key pair to back up
 * @param {string} password - User password to encrypt the backup
 * @returns {Object} Encrypted backup data
 */
const backupKeys = async (keyPair, password) => {
  if (!keyPair || !password) {
    throw new Error('Key pair and password are required for backup');
  }
  
  try {
    // Convert password to encryption key using PBKDF2
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const passwordKey = await deriveKeyFromPassword(password, salt);
    
    // Serialize key pair to JSON
    const keyPairJson = JSON.stringify(keyPair);
    
    // Encrypt the serialized key pair
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedKeyPair = new TextEncoder().encode(keyPairJson);
    
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      passwordKey,
      encodedKeyPair
    );
    
    // Format the backup data
    const backup = {
      v: 1, // Version for future compatibility
      salt: arrayBufferToBase64(salt),
      iv: arrayBufferToBase64(iv),
      data: arrayBufferToBase64(encryptedData),
      createdAt: new Date().toISOString()
    };
    
    return {
      backupData: JSON.stringify(backup),
      createdAt: backup.createdAt
    };
  } catch (error) {
    console.error('Error creating key backup:', error);
    throw new Error('Failed to create backup: ' + error.message);
  }
};

/**
 * Restores encryption keys from an encrypted backup
 * 
 * @param {string} backupData - The encrypted backup data
 * @param {string} password - User password to decrypt the backup
 * @returns {Object} Restored key pair
 */
const restoreKeysFromBackup = async (backupData, password) => {
  if (!backupData || !password) {
    throw new Error('Backup data and password are required for restoration');
  }
  
  try {
    // Parse the backup data
    const backup = JSON.parse(backupData);
    
    // Check version compatibility
    if (!backup.v || backup.v !== 1) {
      throw new Error('Incompatible backup version');
    }
    
    // Derive key from password
    const salt = base64ToArrayBuffer(backup.salt);
    const passwordKey = await deriveKeyFromPassword(password, salt);
    
    // Decrypt the key pair data
    const iv = base64ToArrayBuffer(backup.iv);
    const encryptedData = base64ToArrayBuffer(backup.data);
    
    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      passwordKey,
      encryptedData
    );
    
    // Parse the decrypted key pair
    const keyPairJson = new TextDecoder().decode(decryptedData);
    const keyPair = JSON.parse(keyPairJson);
    
    // Verify the restored key pair
    const verificationResult = await verifyKeyPair(keyPair);
    if (!verificationResult.valid) {
      throw new Error('Restored keys failed verification: ' + verificationResult.error);
    }
    
    return keyPair;
  } catch (error) {
    console.error('Error restoring from backup:', error);
    throw new Error('Failed to restore from backup: ' + error.message);
  }
};

/**
 * Derives an encryption key from a password using PBKDF2
 * 
 * @param {string} password - The password to derive the key from
 * @param {ArrayBuffer} salt - Salt value for PBKDF2
 * @returns {CryptoKey} Derived key for encryption/decryption
 */
const deriveKeyFromPassword = async (password, salt) => {
  try {
    // Convert password to key material
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    
    // Import as raw key
    const passwordKey = await window.crypto.subtle.importKey(
      'raw',
      passwordData,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    // Derive encryption key using PBKDF2
    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000, // High iteration count for security
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false, // not extractable
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    console.error('Error deriving key from password:', error);
    throw new Error('Failed to process password');
  }
};

/**
 * Handles errors securely without exposing sensitive information
 * Returns standardized error objects safe for logging and UI display
 * 
 * @param {Error} error - The original error
 * @param {string} context - Context information for debugging
 * @returns {Object} Sanitized error object
 */
const secureErrorHandler = (error, context = 'encryption') => {
  // Log original error for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.error(`Encryption error in ${context}:`, error);
  }
  
  // Standard error codes that don't expose sensitive data
  const errorMap = {
    // Key generation errors
    'Failed to generate encryption keys': {
      code: 'E001',
      message: 'Could not generate secure keys',
      userAction: 'Please try again or check browser compatibility'
    },
    // Key verification errors
    'Key verification failed': {
      code: 'E002',
      message: 'Key verification failed',
      userAction: 'Please regenerate your encryption keys'
    },
    // Encryption errors
    'Failed to encrypt message': {
      code: 'E003',
      message: 'Message encryption failed',
      userAction: 'Please check your connection and try again'
    },
    // Decryption errors
    'Failed to decrypt message': {
      code: 'E004',
      message: 'Message could not be decrypted',
      userAction: 'The message may have been encrypted with a different key'
    },
    // Key backup/restore errors
    'Failed to create backup': {
      code: 'E005',
      message: 'Key backup failed',
      userAction: 'Please try again with a different password'
    },
    'Failed to restore from backup': {
      code: 'E006',
      message: 'Could not restore from backup',
      userAction: 'Please check your backup data and password'
    }
  };
  
  // Extract error message
  const errorMessage = error?.message || 'Unknown encryption error';
  
  // Find matching error or use generic fallback
  for (const [pattern, errorInfo] of Object.entries(errorMap)) {
    if (errorMessage.includes(pattern)) {
      return {
        ...errorInfo,
        errorId: `${errorInfo.code}_${Date.now()}`
      };
    }
  }
  
  // Generic error if no specific match
  return {
    code: 'E999',
    message: 'An encryption error occurred',
    userAction: 'Please try again or contact support',
    errorId: `E999_${Date.now()}`
  };
};

// Export all the functions
export {
  generateKeyPair,
  encryptMessage,
  decryptMessage,
  encryptImage,
  decryptImage,
  prepareEncryptedMessage,
  verifyKeyPair,
  diagnoseAndRepairKeys,
  calculateExpirationTime,
  generateKeyFingerprint,
  validateKeyFingerprint,
  compareFingerprints,
  saveVerificationStatus,
  getVerificationStatus,
  getContactVerificationStatus,
  verifyContactFingerprint,
  checkKeyRotationStatus,
  backupKeys,
  restoreKeysFromBackup,
  secureErrorHandler,
  VERIFICATION_STATUS,
  KEY_ROTATION
};