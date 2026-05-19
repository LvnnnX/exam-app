/**
 * Simple and fast obfuscation for quiz payloads.
 * This prevents casual snooping in the DevTools Network tab.
 * While not military-grade, it stops 99% of "inspect element" hackers.
 */

const SECRET_SALT = "exam-secure-salt-2026";

/**
 * Scrambles an object into an obfuscated string.
 */
export function scramble(data: unknown): string {
  try {
    const jsonStr = JSON.stringify(data);
    // Simple XOR-like scrambling with Base64
    let result = "";
    for (let i = 0; i < jsonStr.length; i++) {
      const charCode = jsonStr.charCodeAt(i) ^ SECRET_SALT.charCodeAt(i % SECRET_SALT.length);
      result += String.fromCharCode(charCode);
    }
    return btoa(encodeURIComponent(result));
  } catch (e) {
    console.error("Scrambling failed", e);
    return "";
  }
}

/**
 * Unscrambles an obfuscated string back into an object.
 */
export function unscramble<T = unknown>(scrambled: string): T | null {
  try {
    const decoded = decodeURIComponent(atob(scrambled));
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ SECRET_SALT.charCodeAt(i % SECRET_SALT.length);
      result += String.fromCharCode(charCode);
    }
    return JSON.parse(result);
  } catch (e) {
    console.error("Unscrambling failed", e);
    return null;
  }
}
