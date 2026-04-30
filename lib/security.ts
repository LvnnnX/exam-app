import CryptoJS from 'crypto-js';

const STORAGE_VERSION = '4';
const STORAGE_SALT = 'exam-app-storage-v4';
const STORAGE_PREFIX = 's2_';
const LEGACY_PREFIX = 's_';
const LEGACY_SECRET = process.env.NEXT_PUBLIC_EXAM_SECRET_KEY?.trim() || '';

const INTERNAL_SECRET = 'smd-exam-v4-sec-' + STORAGE_SALT;
const AES_KEY = CryptoJS.PBKDF2(INTERNAL_SECRET, 'aes-salt', { keySize: 256 / 32, iterations: 10 }).toString();
const HMAC_KEY = CryptoJS.PBKDF2(INTERNAL_SECRET, 'hmac-salt', { keySize: 256 / 32, iterations: 10 }).toString();

function stableHash(key: string): string {
  return CryptoJS.SHA512(`${key}|${STORAGE_SALT}`).toString().substring(0, 32);
}

function currentStorageKey(key: string): string {
  return `${STORAGE_PREFIX}${stableHash(key)}`;
}

function legacyStorageKey(key: string): string | null {
  if (!LEGACY_SECRET) {
    return null;
  }

  const hashedKey = CryptoJS.SHA512(`${key}|${STORAGE_SALT}|${LEGACY_SECRET}`).toString().substring(0, 32);
  return `${LEGACY_PREFIX}${hashedKey}`;
}

function parseJsonPayload(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readLegacyValue<T>(key: string, payloadStr: string): T | null {
  if (!LEGACY_SECRET) {
    return null;
  }

  const payload = parseJsonPayload(payloadStr) as { data?: string; signature?: string } | null;
  if (!payload?.data || !payload.signature) {
    return null;
  }

  const hashedKey = CryptoJS.SHA512(`${key}|${STORAGE_SALT}|${LEGACY_SECRET}`).toString().substring(0, 32);
  const encryptionKey = CryptoJS.PBKDF2(LEGACY_SECRET, hashedKey, {
    keySize: 256 / 32,
    iterations: 1000,
  });
  const decryptedBytes = CryptoJS.AES.decrypt(payload.data, encryptionKey.toString());
  const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);

  if (!decryptedString) {
    return null;
  }

  const expectedSignature = CryptoJS.SHA512(decryptedString + LEGACY_SECRET).toString();
  if (expectedSignature !== payload.signature) {
    return null;
  }

  try {
    return JSON.parse(decryptedString) as T;
  } catch {
    return decryptedString as unknown as T;
  }
}

/**
 * Persist a cached value for the exam UI.
 */
export function secureSave(key: string, value: unknown): void {
  try {
    const rawValue = JSON.stringify(value === undefined ? null : value);
    
    // Encrypt with AES-256
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const ct = CryptoJS.AES.encrypt(rawValue, AES_KEY, { iv }).toString();
    
    // Sign with HMAC-SHA256
    const mac = CryptoJS.HmacSHA256(iv.toString() + ct, HMAC_KEY).toString();
    
    const payload = JSON.stringify({ v: STORAGE_VERSION, iv: iv.toString(), ct, mac });
    localStorage.setItem(currentStorageKey(key), payload);

    const legacyKey = legacyStorageKey(key);
    if (legacyKey) {
      localStorage.removeItem(legacyKey);
    }
  } catch (error) {
    console.error('Failed to save storage value:', error);
  }
}

/**
 * Loads a cached value for the exam UI.
 */
export function secureLoad<T>(key: string): T | null {
  try {
    const payloadStr = localStorage.getItem(currentStorageKey(key));
    if (payloadStr) {
      const payload = parseJsonPayload(payloadStr) as { v?: string; value?: unknown; iv?: string; ct?: string; mac?: string; data?: string; signature?: string } | null;

      if (payload) {
        if (payload.v === '4' && payload.iv && payload.ct && payload.mac) {
          // Verify MAC
          const expectedMac = CryptoJS.HmacSHA256(payload.iv + payload.ct, HMAC_KEY).toString();
          if (expectedMac === payload.mac) {
            const decryptedBytes = CryptoJS.AES.decrypt(payload.ct, AES_KEY, { iv: CryptoJS.enc.Hex.parse(payload.iv) });
            const decryptedStr = decryptedBytes.toString(CryptoJS.enc.Utf8);
            if (decryptedStr) {
              return JSON.parse(decryptedStr) as T;
            }
          } else {
            console.warn('Storage integrity check failed for key:', key);
          }
        } else if (payload.v === '3' && Object.prototype.hasOwnProperty.call(payload, 'value')) {
          // Fallback to version 3 plaintext migration
          const legacyValue = payload.value as T;
          secureSave(key, legacyValue); // Migrate to v4
          return legacyValue;
        }
      }

      if (payload?.data && payload?.signature) {
        const legacyValue = readLegacyValue<T>(key, payloadStr);
        if (legacyValue !== null) {
          secureSave(key, legacyValue);
          return legacyValue;
        }
      }
    }

    const legacyKey = legacyStorageKey(key);
    if (!legacyKey) {
      return null;
    }

    const legacyPayload = localStorage.getItem(legacyKey);
    if (!legacyPayload) {
      return null;
    }

    const legacyValue = readLegacyValue<T>(key, legacyPayload);
    if (legacyValue === null) {
      return null;
    }

    secureSave(key, legacyValue);
    localStorage.removeItem(legacyKey);
    return legacyValue;
  } catch (error) {
    console.error('Failed to load storage value:', error);
    return null;
  }
}

/**
 * Removes a cached key from storage.
 */
export function secureRemove(key: string): void {
  try {
    localStorage.removeItem(currentStorageKey(key));
    const legacyKey = legacyStorageKey(key);
    if (legacyKey) {
      localStorage.removeItem(legacyKey);
    }
  } catch (error) {
    console.error('Failed to remove storage value:', error);
  }
}

/**
 * Clears all cached exam storage keys.
 */
export function secureClear(): void {
  const keysToRemove: string[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && (key.startsWith(STORAGE_PREFIX) || key.startsWith(LEGACY_PREFIX))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}
