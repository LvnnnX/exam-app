// AES-256 + HMAC-SHA256 untuk state sesi di localStorage (pola legacy-v1/lib/security.ts, dirapikan).
// ponytail: kunci ada di bundle client, jadi ini anti-utak-atik kasual, bukan rahasia kriptografis.
// Pengaman sebenarnya: secret sesi di-hash di server (exam_sessions.secret_hash), skor & kunci tidak pernah di client.
import CryptoJS from 'crypto-js';

const VERSION = '5';
const SALT = 'exam-app-v2-ujian';
const PREFIX = 'v2_';
const AES_KEY = CryptoJS.PBKDF2(SALT, 'aes', { keySize: 256 / 32, iterations: 1000 }).toString();
const HMAC_KEY = CryptoJS.PBKDF2(SALT, 'hmac', { keySize: 256 / 32, iterations: 1000 }).toString();

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const storageKey = (key: string) => PREFIX + CryptoJS.SHA256(`${key}|${SALT}`).toString().slice(0, 32);

export function encryptPayload(value: unknown): string {
  const iv = CryptoJS.lib.WordArray.random(16);
  const ivHex = iv.toString();
  const ct = CryptoJS.AES.encrypt(JSON.stringify(value ?? null), CryptoJS.enc.Hex.parse(AES_KEY), { iv }).toString();
  const mac = CryptoJS.HmacSHA256(`${VERSION}.${ivHex}.${ct}`, HMAC_KEY).toString();
  return JSON.stringify({ v: VERSION, iv: ivHex, ct, mac });
}

/** null kalau format salah, MAC tidak cocok (tamper), atau gagal dekripsi. */
export function decryptPayload<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as { v?: string; iv?: string; ct?: string; mac?: string };
    if (p.v !== VERSION || !p.iv || !p.ct || !p.mac) return null;
    const expected = CryptoJS.HmacSHA256(`${p.v}.${p.iv}.${p.ct}`, HMAC_KEY).toString();
    if (!timingSafeEqual(expected, p.mac)) return null;
    const plain = CryptoJS.AES.decrypt(p.ct, CryptoJS.enc.Hex.parse(AES_KEY), { iv: CryptoJS.enc.Hex.parse(p.iv) })
      .toString(CryptoJS.enc.Utf8);
    return plain ? (JSON.parse(plain) as T) : null;
  } catch {
    return null;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const browser = (): KV | null => (typeof window === 'undefined' ? null : window.localStorage);

export function secureSave(key: string, value: unknown, store: KV | null = browser()): void {
  store?.setItem(storageKey(key), encryptPayload(value));
}

/** Payload rusak/tamper otomatis dihapus supaya tidak dicoba terus. */
export function secureLoad<T>(key: string, store: KV | null = browser()): T | null {
  if (!store) return null;
  const k = storageKey(key);
  const raw = store.getItem(k);
  const value = decryptPayload<T>(raw);
  if (raw && value === null) store.removeItem(k);
  return value;
}

export function secureRemove(key: string, store: KV | null = browser()): void {
  store?.removeItem(storageKey(key));
}
