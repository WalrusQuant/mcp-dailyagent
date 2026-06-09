/**
 * In-process token-bucket rate limiter for /api/mcp.
 *
 * Two limiters:
 * 1. Post-auth (per userId): abuse guard for runaway agent loops.
 * 2. Pre-auth (per IP): throttles bearer-token brute-force attempts.
 *
 * Both limiters share the same consumeToken() implementation; they differ
 * only in bucket parameters and the key namespace.
 */

// Post-auth limiter parameters (high ceiling, legitimate agent traffic)
const BUCKET_SIZE = 100;
const REFILL_PER_SEC = 10;

// Pre-auth (failed-auth) limiter parameters (tight ceiling for brute-force)
const AUTH_FAIL_BUCKET_SIZE = 10;
const AUTH_FAIL_REFILL_PER_SEC = 1 / 60; // 1 token per minute

const IDLE_EVICT_MS = 60 * 60 * 1000; // 1h

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const buckets = new Map<string, Bucket>();
// Auth-fail buckets live in a separate namespace ("auth_fail:<key>") within
// the same map so they participate in the same idle-sweep cycle.
let lastSweepMs = 0;

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** Core token-bucket consume. Shared by all rate-limit flavors. */
function consume(
  key: string,
  bucketSize: number,
  refillPerSec: number,
  now: number
): RateLimitDecision {
  const bucket = buckets.get(key) ?? { tokens: bucketSize, lastRefillMs: now };

  const elapsedSec = Math.max(0, (now - bucket.lastRefillMs) / 1000);
  bucket.tokens = Math.min(bucketSize, bucket.tokens + elapsedSec * refillPerSec);
  bucket.lastRefillMs = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  buckets.set(key, bucket);
  const needed = 1 - bucket.tokens;
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(needed / refillPerSec)),
  };
}

/** Post-auth rate limit keyed by userId (abuse guard for runaway agent loops). */
export function consumeToken(
  key: string,
  now: number = Date.now()
): RateLimitDecision {
  sweepIdle(now);
  return consume(key, BUCKET_SIZE, REFILL_PER_SEC, now);
}

/**
 * Pre-auth rate limit keyed by client IP (throttles bearer-token brute-force).
 * Much tighter ceiling than the post-auth limiter.
 */
export function consumeAuthFailToken(
  ip: string,
  now: number = Date.now()
): RateLimitDecision {
  sweepIdle(now);
  return consume(`auth_fail:${ip}`, AUTH_FAIL_BUCKET_SIZE, AUTH_FAIL_REFILL_PER_SEC, now);
}

function sweepIdle(now: number): void {
  if (now - lastSweepMs < 60_000) return;
  lastSweepMs = now;
  for (const [k, b] of buckets) {
    if (now - b.lastRefillMs > IDLE_EVICT_MS) buckets.delete(k);
  }
}

// Test-only helper. Resets module state between cases.
export function __resetForTests(): void {
  buckets.clear();
  lastSweepMs = 0;
}
