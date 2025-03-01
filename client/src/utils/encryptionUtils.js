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
 * - Key generation and management
 * - Message encryption and decryption
 * - Secure image encryption for sharing media
 * - Support for ephemeral (self-destructing) messages
 * - Visual encryption status indicators
 * - Key verification and repair mechanisms
 */

// Constants for encryption algorithms
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
 * Generates an RSA key pair for encryption
 * Returns an object with public and private keys in JWK format
 */
const generateKeyPair = async () => {
  try {
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

    return {
      keyId,
      publicKey: publicKeyString,
      privateKey: privateKeyString
    };
  } catch (error) {
    console.error('Error generating key pair:', error);
    throw new Error('Failed to generate encryption keys');
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
 * Creates a visual representation of the encryption key fingerprint
 * This helps users verify they're communicating with the right person
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
    
    // Format with colons for readability 
    // Only use the first 40 characters (20 bytes) for display purposes - increased for better security
    const formattedFingerprint = fingerprintHex.substring(0, 40).match(/.{1,4}/g).join(':');
    
    return formattedFingerprint;
  } catch (error) {
    console.error('Error generating key fingerprint:', error);
    return null;
  }
};

/**
 * Validates a key fingerprint format
 * Returns the formatted fingerprint if valid, null otherwise
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
    
    // Format with colons for consistent display
    return cleanFingerprint.substring(0, 40).match(/.{1,4}/g).join(':');
  } catch (error) {
    console.error('Error validating fingerprint:', error);
    return null;
  }
};

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
  validateKeyFingerprint
};