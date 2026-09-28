type Bucket = {
  count: number;
  resetAt: number;
};

// In-memory fallback. Per-instance; only used when the DB-backed limiter is
// unavailable (cold start, transient DB error). The DB-backed limiter is the
// authoritative path on every other call.
const buckets = new Map<string, Bucket>();

function localRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) {
    return false;
  }

  current.count += 1;
  return true;
}

/**
 * Synchronous, per-instance rate limit. Kept for sites that cannot await
 * (e.g. middleware that has to return immediately). Treat as advisory only.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  return localRateLimit(key, limit, windowMs);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return forwarded || realIp || 'unknown';
}
