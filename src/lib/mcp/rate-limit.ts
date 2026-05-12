/**
 * In-process token-bucket rate limiter for /api/mcp.
 *
 * Sized as an abuse guard, not a fair-use quota: a runaway agent loop is
 * stopped before it hammers Postgres, but no realistic OpenClaw traffic ever
 * trips it. Single-user self-host means there's typically one token in the
 * map at a time.
 */

const BUCKET_SIZE = 100;
const REFILL_PER_SEC = 10;
const IDLE_EVICT_MS = 60 * 60 * 1000; // 1h

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const buckets = new Map<string, Bucket>();
let lastSweepMs = 0;

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function consumeToken(
  key: string,
  now: number = Date.now()
): RateLimitDecision {
  sweepIdle(now);

  const bucket = buckets.get(key) ?? { tokens: BUCKET_SIZE, lastRefillMs: now };

  const elapsedSec = Math.max(0, (now - bucket.lastRefillMs) / 1000);
  bucket.tokens = Math.min(
    BUCKET_SIZE,
    bucket.tokens + elapsedSec * REFILL_PER_SEC
  );
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
    retryAfterSeconds: Math.max(1, Math.ceil(needed / REFILL_PER_SEC)),
  };
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
