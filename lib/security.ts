import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.NEXT_PUBLIC_EXAM_SECRET_KEY || 'default-secret-key-123';

/**
 * Hashes a key for storage
 */
function hashKey(key: string): string {
  return CryptoJS.SHA256(key + SECRET_KEY).toString().substring(0, 16);
}

/**
 * Encrypts/Obfuscates a value for secure local storage
 */
export function secureSave(key: string, value: any): void {
  try {
    const hashedKey = hashKey(key);
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const encrypted = CryptoJS.AES.encrypt(stringValue, SECRET_KEY).toString();
    const hash = CryptoJS.HmacSHA256(stringValue, SECRET_KEY).toString();
    
    const payload = JSON.stringify({ data: encrypted, signature: hash });
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

    const { data, signature } = JSON.parse(payloadStr);
    const decryptedBytes = CryptoJS.AES.decrypt(data, SECRET_KEY);
    const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedString) return null;

    // Verify integrity
    const expectedHash = CryptoJS.HmacSHA256(decryptedString, SECRET_KEY).toString();
    if (expectedHash !== signature) {
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
