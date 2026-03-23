import { UserPlan } from "./types";

const DAY_MS = 86_400_000;

const LIMITS: Record<UserPlan, number> = {
  free: 500,
  active: 10_000,
  canceled: 500,
  expired: 500,
};

// In-memory daily request counts: userId -> timestamp[]
const requestLog = new Map<string, number[]>();

/**
 * Check MCP daily rate limit. Returns null if allowed,
 * or a Retry-After value in seconds if rate limited.
 */
export function checkMcpRateLimit(userId: string, plan: UserPlan): number | null {
  const now = Date.now();
  const limit = LIMITS[plan];
  const cutoff = now - DAY_MS;

  let timestamps = requestLog.get(userId);
  if (!timestamps) {
    timestamps = [];
    requestLog.set(userId, timestamps);
  }

  // Prune old entries
  timestamps = timestamps.filter((t) => t > cutoff);
  requestLog.set(userId, timestamps);

  if (timestamps.length >= limit) {
    // Earliest timestamp that will expire
    const oldest = timestamps[0];
    const retryAfter = Math.ceil((oldest + DAY_MS - now) / 1000);
    return retryAfter;
  }

  timestamps.push(now);

  // Purge stale users periodically
  if (requestLog.size > 500) {
    for (const [key, ts] of requestLog) {
      const filtered = ts.filter((t) => t > cutoff);
      if (filtered.length === 0) {
        requestLog.delete(key);
      } else {
        requestLog.set(key, filtered);
      }
    }
  }

  return null;
}
