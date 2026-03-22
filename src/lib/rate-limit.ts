export type RateLimitCategory = "chat" | "image" | "search" | "ai";

const RATE_LIMITS: Record<RateLimitCategory, number> = {
  chat: 30,
  image: 10,
  search: 20,
  ai: 20,
};

const WINDOW_MS = 60_000; // 1 minute
const MAX_ENTRIES = 500; // Purge when map exceeds this size

// In-memory sliding window: key = "userId:category" -> array of timestamps
// Note: In serverless environments (Vercel), this resets on cold start and does not
// share state across instances. This provides best-effort rate limiting — for strict
// enforcement in multi-instance deployments, use a shared store (Redis, DB).
const windows = new Map<string, number[]>();

function purgeExpired() {
  const now = Date.now();
  for (const [key, timestamps] of windows) {
    const valid = timestamps.filter((t) => now - t < WINDOW_MS);
    if (valid.length === 0) {
      windows.delete(key);
    } else {
      windows.set(key, valid);
    }
  }
}

/**
 * Check rate limit for a user+category. Returns a 429 Response if exceeded, or null if allowed.
 */
export function checkRateLimit(
  userId: string,
  category: RateLimitCategory,
  isAdmin: boolean
): Response | null {
  if (isAdmin) return null;

  // Purge when map grows beyond threshold to prevent memory leaks on quiet servers
  if (windows.size > MAX_ENTRIES) purgeExpired();

  const key = `${userId}:${category}`;
  const now = Date.now();
  const limit = RATE_LIMITS[category];

  const timestamps = windows.get(key) || [];
  const valid = timestamps.filter((t) => now - t < WINDOW_MS);

  if (valid.length >= limit) {
    const oldestInWindow = valid[0];
    const retryAfter = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000);

    return new Response(
      JSON.stringify({ error: "Rate limit exceeded", retryAfter }),
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "Content-Type": "application/json",
        },
      }
    );
  }

  valid.push(now);
  windows.set(key, valid);
  return null;
}
