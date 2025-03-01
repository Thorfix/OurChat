/**
 * End-to-End Encryption Tests
 * 
 * Comprehensive test suite for encryption utilities
 * Verifies all core functionality including key generation, encryption/decryption, 
 * and security verification features.
 */

import {
  generateKeyPair,
  encryptMessage,
  decryptMessage,
  generateKeyFingerprint,
  validateKeyFingerprint,
  compareFingerprints,
  verifyKeyPair,
  checkKeyRotationStatus,
  saveVerificationStatus,
  getVerificationStatus,
  VERIFICATION_STATUS,
  secureErrorHandler,
  calculateExpirationTime
} from '../encryptionUtils';

// Mock the Web Crypto API
const mockSubtleCrypto = {
  generateKey: jest.fn(),
  exportKey: jest.fn(),
  importKey: jest.fn(),
  encrypt: jest.fn(),
  decrypt: jest.fn(),
  digest: jest.fn()
};

// Mock for crypto.getRandomValues
const mockGetRandomValues = jest.fn(array => {
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
});

// Setup global mocks
global.window = {
  crypto: {
    subtle: mockSubtleCrypto,
    getRandomValues: mockGetRandomValues
  },
  btoa: jest.fn(str => Buffer.from(str, 'binary').toString('base64')),
  atob: jest.fn(b64 => Buffer.from(b64, 'base64').toString('binary'))
};

// TextEncoder and TextDecoder mocks
global.TextEncoder = jest.fn(() => ({
  encode: jest.fn(text => new Uint8Array([...text].map(c => c.charCodeAt(0))))
}));

global.TextDecoder = jest.fn(() => ({
  decode: jest.fn(buffer => String.fromCharCode.apply(null, new Uint8Array(buffer)))
}));

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    getAll: () => store
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Utility function to create mock key pairs for testing
const createMockKeyPair = (id = '1234567890abcdef') => {
  return {
    keyId: id,
    publicKey: JSON.stringify({
      kty: 'RSA',
      n: 'mock-modulus-value',
      e: 'AQAB',
      alg: 'RSA-OAEP-256'
    }),
    privateKey: JSON.stringify({
      kty: 'RSA',
      n: 'mock-modulus-value',
      e: 'AQAB',
      d: 'mock-private-exponent',
      p: 'mock-prime-1',
      q: 'mock-prime-2',
      dp: 'mock-exponent-1',
      dq: 'mock-exponent-2',
      qi: 'mock-coefficient',
      alg: 'RSA-OAEP-256'
    }),
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString() // 20 days from now
  };
};

// Setup and teardown
beforeEach(() => {
  // Reset all mocks
  jest.clearAllMocks();
  localStorageMock.clear();
  
  // Setup default mock behavior
  mockSubtleCrypto.generateKey.mockImplementation(() => {
    return Promise.resolve({
      publicKey: 'mock-public-key',
      privateKey: 'mock-private-key'
    });
  });
  
  mockSubtleCrypto.exportKey.mockImplementation(() => {
    return Promise.resolve({ kty: 'RSA', n: 'mock-n-value', e: 'AQAB' });
  });
  
  mockSubtleCrypto.importKey.mockImplementation(() => {
    return Promise.resolve('mock-imported-key');
  });
  
  mockSubtleCrypto.encrypt.mockImplementation(() => {
    return Promise.resolve(new Uint8Array([1, 2, 3, 4]));
  });
  
  mockSubtleCrypto.decrypt.mockImplementation(() => {
    return Promise.resolve(new Uint8Array([100, 101, 102, 103]));
  });
  
  mockSubtleCrypto.digest.mockImplementation(() => {
    return Promise.resolve(new Uint8Array([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]));
  });
});

// Test suites
describe('Key Generation and Management', () => {
  test('generateKeyPair should create keys with correct properties', async () => {
    const keyPair = await generateKeyPair(30);
    
    expect(keyPair).toHaveProperty('keyId');
    expect(keyPair).toHaveProperty('publicKey');
    expect(keyPair).toHaveProperty('privateKey');
    expect(keyPair).toHaveProperty('createdAt');
    expect(keyPair).toHaveProperty('expiresAt');
    expect(keyPair).toHaveProperty('rotationIntervalDays', 30);
    
    expect(mockSubtleCrypto.generateKey).toHaveBeenCalledTimes(1);
    expect(mockSubtleCrypto.exportKey).toHaveBeenCalledTimes(2); // Once for each key
  });
  
  test('checkKeyRotationStatus should correctly identify expiring keys', () => {
    // Key that expires in 20 days
    const goodKey = createMockKeyPair();
    const goodStatus = checkKeyRotationStatus(goodKey);
    
    expect(goodStatus.needsRotation).toBe(false);
    expect(goodStatus.daysRemaining).toBeGreaterThan(0);
    
    // Key that has already expired
    const expiredKey = {
      ...createMockKeyPair(),
      expiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
    };
    const expiredStatus = checkKeyRotationStatus(expiredKey);
    
    expect(expiredStatus.needsRotation).toBe(true);
    expect(expiredStatus.daysRemaining).toBe(0);
    
    // Key that expires very soon (in warning period)
    const warningKey = {
      ...createMockKeyPair(),
      expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days from now
    };
    const warningStatus = checkKeyRotationStatus(warningKey);
    
    expect(warningStatus.needsRotation).toBe(false);
    expect(warningStatus.warningPeriod).toBe(true);
  });
  
  test('verifyKeyPair should validate working key pairs', async () => {
    // Mock successful encrypt/decrypt operations
    mockSubtleCrypto.encrypt.mockImplementation(() => {
      return Promise.resolve(new Uint8Array([1, 2, 3, 4]));
    });
    
    mockSubtleCrypto.decrypt.mockImplementation(() => {
      // Return the encoded test message
      return Promise.resolve(new TextEncoder().encode('Encryption verification test'));
    });
    
    const keyPair = createMockKeyPair();
    const result = await verifyKeyPair(keyPair);
    
    expect(result.valid).toBe(true);
    expect(mockSubtleCrypto.encrypt).toHaveBeenCalledTimes(1);
    expect(mockSubtleCrypto.decrypt).toHaveBeenCalledTimes(1);
  });
  
  test('verifyKeyPair should detect invalid key pairs', async () => {
    // Mock a decrypt operation that returns wrong data
    mockSubtleCrypto.decrypt.mockImplementation(() => {
      return Promise.resolve(new TextEncoder().encode('Wrong data'));
    });
    
    const keyPair = createMockKeyPair();
    const result = await verifyKeyPair(keyPair);
    
    expect(result.valid).toBe(false);
    expect(result).toHaveProperty('error');
  });
});

describe('Encryption and Decryption', () => {
  test('encryptMessage should encrypt messages with recipient public key', async () => {
    const message = 'Hello, this is a secret message';
    const recipientPublicKey = JSON.stringify({ kty: 'RSA', n: 'mock-n-value', e: 'AQAB' });
    
    const encryptedData = await encryptMessage(message, recipientPublicKey);
    
    expect(encryptedData).toHaveProperty('encryptedContent');
    expect(encryptedData).toHaveProperty('encryptedSymmetricKey');
    expect(encryptedData).toHaveProperty('iv');
    
    expect(mockSubtleCrypto.importKey).toHaveBeenCalled();
    expect(mockSubtleCrypto.encrypt).toHaveBeenCalled();
  });
  
  test('decryptMessage should decrypt messages with private key', async () => {
    // Setup mock encrypted data
    const encryptedData = {
      encryptedContent: 'base64-content',
      encryptedSymmetricKey: 'base64-sym-key',
      iv: 'base64-iv'
    };
    
    // Mock successful decryption
    mockSubtleCrypto.decrypt.mockImplementation(() => {
      return Promise.resolve(new TextEncoder().encode('Decrypted message'));
    });
    
    const privateKeyString = JSON.stringify({ 
      kty: 'RSA', 
      n: 'mock-n-value', 
      e: 'AQAB',
      d: 'mock-d-value'
    });
    
    const decryptedMessage = await decryptMessage(encryptedData, privateKeyString);
    
    expect(decryptedMessage).toBe('Decrypted message');
    expect(mockSubtleCrypto.importKey).toHaveBeenCalled();
    expect(mockSubtleCrypto.decrypt).toHaveBeenCalled();
  });
  
  test('calculateExpirationTime should return correct expiration time', () => {
    const now = Date.now();
    
    // Test with 10 minutes
    const expiration10Min = calculateExpirationTime(10);
    const expectedTime10Min = new Date(now + 10 * 60 * 1000);
    
    // Allow for small timing differences in test execution
    expect(expiration10Min.getTime()).toBeGreaterThanOrEqual(expectedTime10Min.getTime() - 100);
    expect(expiration10Min.getTime()).toBeLessThanOrEqual(expectedTime10Min.getTime() + 100);
    
    // Test with null
    expect(calculateExpirationTime(null)).toBeNull();
    
    // Test with invalid values
    expect(calculateExpirationTime('invalid')).toBeNull();
    expect(calculateExpirationTime(-5)).toBeNull();
  });
});

describe('Key Verification', () => {
  test('generateKeyFingerprint should create consistent fingerprints', async () => {
    const publicKeyString = JSON.stringify({ kty: 'RSA', n: 'mock-n-value', e: 'AQAB' });
    
    const fingerprint = await generateKeyFingerprint(publicKeyString);
    
    expect(fingerprint).toHaveProperty('hex');
    expect(fingerprint).toHaveProperty('numeric');
    expect(fingerprint.hex).toMatch(/[0-9a-f]{5}(\s[0-9a-f]{5})+/i);
    expect(fingerprint.numeric).toMatch(/\d{3}(-\d{3})+/);
    
    expect(mockSubtleCrypto.digest).toHaveBeenCalledTimes(1);
  });
  
  test('validateKeyFingerprint should normalize fingerprints', () => {
    // Test with hex fingerprint with spaces
    const fingerprint = '05 0a 0f 14 19 1e 23 28 2d 32 37 3c';
    const normalized = validateKeyFingerprint(fingerprint);
    
    expect(normalized).toHaveProperty('hex');
    expect(normalized).toHaveProperty('numeric');
    expect(normalized.hex).toMatch(/[0-9a-f]{5}(\s[0-9a-f]{5})+/i);
    
    // Test with fingerprint without spaces
    const fingerprintNoSpaces = '050a0f14191e23282d3237';
    const normalizedNoSpaces = validateKeyFingerprint(fingerprintNoSpaces);
    
    expect(normalizedNoSpaces).toHaveProperty('hex');
    expect(normalizedNoSpaces.hex).toMatch(/[0-9a-f]{5}(\s[0-9a-f]{5})+/i);
    
    // Test with invalid input
    expect(validateKeyFingerprint('')).toEqual({ hex: null, numeric: null });
    expect(validateKeyFingerprint(null)).toEqual({ hex: null, numeric: null });
    expect(validateKeyFingerprint('xyz')).toEqual({ hex: null, numeric: null });
  });
  
  test('compareFingerprints should correctly identify matching fingerprints', () => {
    // Test exact match
    const fp1 = '0a1b2c3d4e5f';
    const fp2 = '0a1b2c3d4e5f';
    expect(compareFingerprints(fp1, fp2)).toBe(true);
    
    // Test match with different formatting
    const fp3 = '0a 1b 2c 3d 4e 5f';
    const fp4 = '0a1b2c3d4e5f';
    expect(compareFingerprints(fp3, fp4)).toBe(true);
    
    // Test non-match
    const fp5 = '0a1b2c3d4e5f';
    const fp6 = '1a2b3c4d5e6f';
    expect(compareFingerprints(fp5, fp6)).toBe(false);
    
    // Test with object format
    const fpObj1 = { hex: '0a1b2c3d4e5f' };
    const fpObj2 = { hex: '0a 1b 2c 3d 4e 5f' };
    expect(compareFingerprints(fpObj1, fpObj2)).toBe(true);
  });
  
  test('saveVerificationStatus and getVerificationStatus should store and retrieve status', () => {
    const userId = 'user123';
    const keyId = 'key456';
    
    // Save verified status
    saveVerificationStatus(userId, keyId, VERIFICATION_STATUS.VERIFIED);
    
    // Get it back
    const status = getVerificationStatus(userId, keyId);
    expect(status).toBe(VERIFICATION_STATUS.VERIFIED);
    expect(localStorageMock.setItem).toHaveBeenCalled();
    expect(localStorageMock.getItem).toHaveBeenCalled();
    
    // Try with missing data
    expect(getVerificationStatus(null, null)).toBe(VERIFICATION_STATUS.UNVERIFIED);
    expect(getVerificationStatus('nonexistent', 'nonexistent')).toBe(VERIFICATION_STATUS.UNVERIFIED);
  });
});

describe('Error Handling', () => {
  test('secureErrorHandler should sanitize errors', () => {
    // Test with known error pattern
    const error1 = new Error('Failed to encrypt message: crypto operation failed');
    const handled1 = secureErrorHandler(error1, 'test');
    
    expect(handled1).toHaveProperty('code', 'E003');
    expect(handled1).toHaveProperty('message');
    expect(handled1).toHaveProperty('userAction');
    expect(handled1).toHaveProperty('errorId');
    
    // Error ID should be unique per error
    const error2 = new Error('Failed to encrypt message: different reason');
    const handled2 = secureErrorHandler(error2, 'test');
    
    expect(handled2.errorId).not.toBe(handled1.errorId);
    
    // Test with unknown error pattern
    const error3 = new Error('Some completely different error');
    const handled3 = secureErrorHandler(error3, 'test');
    
    expect(handled3).toHaveProperty('code', 'E999');
    expect(handled3).toHaveProperty('message');
    expect(handled3).toHaveProperty('userAction');
  });
});