/**
 * Client-side caching utility to reduce Supabase egress bandwidth
 * Uses localStorage with TTL (time-to-live) for automatic expiration
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

type CacheOptions = {
  ttl?: number; // Time to live in milliseconds
  prefix?: string; // Cache key prefix
};

const DEFAULT_TTL = 3600000; // 1 hour in milliseconds
const DEFAULT_PREFIX = 'cache_';

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * Generate a cache key from components
 */
export function generateCacheKey(components: (string | number | boolean | null | undefined)[]): string {
  return components
    .filter(c => c !== null && c !== undefined)
    .map(c => String(c))
    .join('_');
}

/**
 * Get data from cache
 * Returns null if cache miss or expired
 */
export function getCache<T>(key: string, options: CacheOptions = {}): T | null {
  if (!isBrowser()) return null;

  const { prefix = DEFAULT_PREFIX } = options;
  const fullKey = `${prefix}${key}`;

  try {
    const cached = localStorage.getItem(fullKey);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);
    const now = Date.now();

    // Check if expired
    if (now - entry.timestamp > entry.ttl) {
      localStorage.removeItem(fullKey);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.warn('Cache read error:', error);
    return null;
  }
}

/**
 * Set data in cache with TTL
 */
export function setCache<T>(key: string, data: T, options: CacheOptions = {}): void {
  if (!isBrowser()) return;

  const { ttl = DEFAULT_TTL, prefix = DEFAULT_PREFIX } = options;
  const fullKey = `${prefix}${key}`;

  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    localStorage.setItem(fullKey, JSON.stringify(entry));
  } catch (error) {
    console.warn('Cache write error:', error);
    // If localStorage is full, clear old entries
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      clearExpiredCache(prefix);
      // Try again after clearing
      try {
        const entry: CacheEntry<T> = {
          data,
          timestamp: Date.now(),
          ttl,
        };
        localStorage.setItem(fullKey, JSON.stringify(entry));
      } catch {
        // If still fails, silently fail (app will fetch from Supabase)
      }
    }
  }
}

/**
 * Invalidate (delete) a specific cache entry
 */
export function invalidateCache(key: string, options: CacheOptions = {}): void {
  if (!isBrowser()) return;

  const { prefix = DEFAULT_PREFIX } = options;
  const fullKey = `${prefix}${key}`;

  try {
    localStorage.removeItem(fullKey);
  } catch (error) {
    console.warn('Cache invalidation error:', error);
  }
}

/**
 * Invalidate all cache entries matching a pattern
 */
export function invalidateCachePattern(pattern: string, options: CacheOptions = {}): void {
  if (!isBrowser()) return;

  const { prefix = DEFAULT_PREFIX } = options;

  try {
    const keys = Object.keys(localStorage);
    const fullPattern = `${prefix}${pattern}`;

    keys.forEach(key => {
      if (key.startsWith(fullPattern)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Cache pattern invalidation error:', error);
  }
}

/**
 * Clear all expired cache entries
 */
export function clearExpiredCache(prefix: string = DEFAULT_PREFIX): void {
  if (!isBrowser()) return;

  try {
    const keys = Object.keys(localStorage);
    const now = Date.now();

    keys.forEach(key => {
      if (!key.startsWith(prefix)) return;

      try {
        const cached = localStorage.getItem(key);
        if (!cached) return;

        const entry: CacheEntry<unknown> = JSON.parse(cached);
        if (now - entry.timestamp > entry.ttl) {
          localStorage.removeItem(key);
        }
      } catch {
        // If parsing fails, remove the corrupted entry
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Clear expired cache error:', error);
  }
}

/**
 * Clear all cache entries
 */
export function clearAllCache(prefix: string = DEFAULT_PREFIX): void {
  if (!isBrowser()) return;

  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Clear all cache error:', error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(prefix: string = DEFAULT_PREFIX): {
  totalEntries: number;
  expiredEntries: number;
  totalSize: number;
} {
  if (!isBrowser()) {
    return { totalEntries: 0, expiredEntries: 0, totalSize: 0 };
  }

  try {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    let totalEntries = 0;
    let expiredEntries = 0;
    let totalSize = 0;

    keys.forEach(key => {
      if (!key.startsWith(prefix)) return;

      totalEntries++;
      const cached = localStorage.getItem(key);
      if (!cached) return;

      totalSize += cached.length;

      try {
        const entry: CacheEntry<unknown> = JSON.parse(cached);
        if (now - entry.timestamp > entry.ttl) {
          expiredEntries++;
        }
      } catch {
        expiredEntries++;
      }
    });

    return { totalEntries, expiredEntries, totalSize };
  } catch (error) {
    console.warn('Get cache stats error:', error);
    return { totalEntries: 0, expiredEntries: 0, totalSize: 0 };
  }
}

/**
 * Wrapper function to cache async function results
 * Usage: const cachedFn = withCache(expensiveFn, 'my-cache-key', { ttl: 3600000 });
 */
export function withCache<T>(
  fn: () => Promise<T>,
  key: string,
  options: CacheOptions = {}
): () => Promise<T> {
  return async () => {
    // Try to get from cache first
    const cached = getCache<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch data
    const data = await fn();

    // Store in cache
    setCache(key, data, options);

    return data;
  };
}

/**
 * Cache TTL presets for different data types
 */
export const CACHE_TTL = {
  QUESTIONS: 3600000,        // 1 hour - questions rarely change
  CATEGORIES: 1800000,       // 30 minutes - categories change occasionally
  SETTINGS: 600000,          // 10 minutes - settings may change
  RESULTS: 300000,           // 5 minutes - results update frequently
  ANALYTICS: 600000,         // 10 minutes - analytics can be slightly stale
  SESSION: 60000,            // 1 minute - session data needs to be fresh
} as const;
