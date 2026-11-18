/**
 * Minimal fixed-window in-memory rate limiter.
 *
 * Copied verbatim (in-memory part only) from Promethe src/lib/rate-limit.ts.
 * Single-process friendly — swap for Upstash or Redis when scaling
 * horizontally. The DB-backed bucket part of Promethe's module is NOT
 * copied: Gaïa has no rate_limit_buckets table and only the auth routes
 * need a guard.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

/** Returns true when the request is allowed, false when the limit is exceeded. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** Housekeeping: drop expired buckets (called occasionally). */
export function sweepRateLimits(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
