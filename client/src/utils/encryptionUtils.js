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
 * Encrypts an image for private messaging
 */
const encryptImage = async (imageData, recipientPublicKeyString) => {
  try {
    // If we have a base64 image, we can encrypt it directly
    const base64Data = imageData.startsWith('data:') 
      ? imageData.split(',')[1]
      : imageData;
    
    // Encrypt the image as if it were a regular message
    return await encryptMessage(base64Data, recipientPublicKeyString);
  } catch (error) {
    console.error('Error encrypting image:', error);
    throw new Error('Failed to encrypt image');
  }
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
 */
const prepareEncryptedMessage = async (content, recipientPublicKeyString, imageData = null) => {
  try {
    // Encrypt the message content
    const encryptedContent = await encryptMessage(content, recipientPublicKeyString);
    
    // Create the message package
    const messagePackage = {
      content: JSON.stringify(encryptedContent)
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

export {
  generateKeyPair,
  encryptMessage,
  decryptMessage,
  encryptImage,
  decryptImage,
  prepareEncryptedMessage
};