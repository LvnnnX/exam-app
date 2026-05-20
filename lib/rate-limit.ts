import { getSupabaseServer } from '@/lib/supabase';

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

/**
 * Distributed rate limit backed by Postgres. Falls back to the local map if
 * the RPC fails so a transient DB blip does not lock out every caller.
 */
export async function rateLimitAsync(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  if (!key || limit <= 0 || windowMs <= 0) return false;

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.rpc('consume_rate_limit', {
      p_key: key.slice(0, 200),
      p_limit: limit,
      p_window_ms: windowMs,
    });
    if (error) {
      // Graceful degradation. Logging the message but not the key/value.
      console.warn('rateLimitAsync DB error, falling back to local map');
      return localRateLimit(key, limit, windowMs);
    }
    return data === true;
  } catch {
    return localRateLimit(key, limit, windowMs);
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return forwarded || realIp || 'unknown';
}
