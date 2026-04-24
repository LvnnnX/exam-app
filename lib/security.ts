import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.NEXT_PUBLIC_EXAM_SECRET_KEY || 'default-secret-key-123';
const SALT = 'exam-app-salt-v2';

/**
 * Derives a secure key using PBKDF2
 */
function deriveKey(salt: string): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(SECRET_KEY, salt, {
    keySize: 256 / 32,
    iterations: 1000
  });
}

/**
 * Hashes a key for storage using SHA-512
 */
function hashKey(key: string): string {
  return CryptoJS.SHA512(key + SALT + SECRET_KEY).toString().substring(0, 32);
}

/**
 * Encrypts data for secure local storage with PBKDF2 derived keys
 */
export function secureSave(key: string, value: any): void {
  try {
    const hashedKey = hashKey(key);
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    // Derive a unique key for this save operation
    const encryptionKey = deriveKey(hashedKey);
    const encrypted = CryptoJS.AES.encrypt(stringValue, encryptionKey.toString()).toString();
    
    // Use SHA-512 for high-security signature
    const signature = CryptoJS.SHA512(stringValue + SECRET_KEY).toString();
    
    const payload = JSON.stringify({ data: encrypted, signature: signature, v: '2' });
    localStorage.setItem(`s_${hashedKey}`, payload);
  } catch (e) {
    console.error('Failed to securely save data:', e);
  }
}

/**
 * Decrypts and verifies a value from local storage
 */
export function secureLoad<T>(key: string): T | null {
  try {
    const hashedKey = hashKey(key);
    const securedKey = `s_${hashedKey}`;
    const payloadStr = localStorage.getItem(securedKey);
    if (!payloadStr) return null;

    const { data, signature, v } = JSON.parse(payloadStr);
    
    // Support migration or strictly enforce v2
    const encryptionKey = deriveKey(hashedKey);
    const decryptedBytes = CryptoJS.AES.decrypt(data, encryptionKey.toString());
    const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedString) return null;

    // Verify integrity using SHA-512
    const expectedSignature = CryptoJS.SHA512(decryptedString + SECRET_KEY).toString();
    if (expectedSignature !== signature) {
      console.error('Data integrity check failed for key:', key);
      localStorage.removeItem(securedKey);
      return null;
    }

    try {
      return JSON.parse(decryptedString) as T;
    } catch {
      return decryptedString as unknown as T;
    }
  } catch (e) {
    console.error('Failed to securely load data:', e);
    return null;
  }
}

/**
 * Removes a secured key from storage
 */
export function secureRemove(key: string): void {
  localStorage.removeItem(`s_${hashKey(key)}`);
}

/**
 * Clears all secured storage keys
 */
export function secureClear(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('s_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}
