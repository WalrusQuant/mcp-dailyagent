import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { UserPlan } from "@/lib/mcp/types";

describe("checkMcpRateLimit", () => {
  let checkMcpRateLimit: typeof import("@/lib/mcp/rate-limit").checkMcpRateLimit;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const mod = await import("@/lib/mcp/rate-limit");
    checkMcpRateLimit = mod.checkMcpRateLimit;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for the first request (allowed)", () => {
    expect(checkMcpRateLimit("user1", "free")).toBeNull();
  });

  it("returns null for requests under the free plan limit (500)", () => {
    for (let i = 0; i < 499; i++) {
      expect(checkMcpRateLimit("user-free", "free")).toBeNull();
    }
  });

  it("blocks after 500 requests on the free plan", () => {
    for (let i = 0; i < 500; i++) {
      checkMcpRateLimit("user-free-block", "free");
    }
    const result = checkMcpRateLimit("user-free-block", "free");
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0);
  });

  it("returns null for requests under the active plan limit (10,000)", () => {
    for (let i = 0; i < 9_999; i++) {
      expect(checkMcpRateLimit("user-active", "active")).toBeNull();
    }
  });

  it("blocks after 10,000 requests on the active plan", () => {
    for (let i = 0; i < 10_000; i++) {
      checkMcpRateLimit("user-active-block", "active");
    }
    const result = checkMcpRateLimit("user-active-block", "active");
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0);
  });

  it("returns a positive retryAfter number when blocked", () => {
    for (let i = 0; i < 500; i++) {
      checkMcpRateLimit("user-retry", "free");
    }
    const retryAfter = checkMcpRateLimit("user-retry", "free");
    expect(typeof retryAfter).toBe("number");
    expect(retryAfter).toBeGreaterThan(0);
  });

  it("old entries expire after 24 hours, allowing requests again", () => {
    for (let i = 0; i < 500; i++) {
      checkMcpRateLimit("user-expire", "free");
    }
    // Should be blocked now
    expect(checkMcpRateLimit("user-expire", "free")).not.toBeNull();

    // Advance past the 24-hour window
    vi.advanceTimersByTime(86_400_001);

    // Should be allowed again after expiry
    expect(checkMcpRateLimit("user-expire", "free")).toBeNull();
  });

  it("canceled plan uses 500-request limit", () => {
    for (let i = 0; i < 500; i++) {
      checkMcpRateLimit("user-canceled", "canceled");
    }
    const result = checkMcpRateLimit("user-canceled", "canceled");
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0);
  });

  it("expired plan uses 500-request limit", () => {
    for (let i = 0; i < 500; i++) {
      checkMcpRateLimit("user-expired", "expired");
    }
    const result = checkMcpRateLimit("user-expired", "expired");
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0);
  });

  it("tracks different users independently", () => {
    for (let i = 0; i < 500; i++) {
      checkMcpRateLimit("user-a", "free");
    }
    // user-a is blocked
    expect(checkMcpRateLimit("user-a", "free")).not.toBeNull();
    // user-b is not affected
    expect(checkMcpRateLimit("user-b", "free")).toBeNull();
  });

  it("retryAfter decreases as time advances", () => {
    for (let i = 0; i < 500; i++) {
      checkMcpRateLimit("user-time", "free");
    }
    const first = checkMcpRateLimit("user-time", "free") as number;
    vi.advanceTimersByTime(3600_000); // advance 1 hour
    const second = checkMcpRateLimit("user-time", "free") as number;
    expect(second).toBeLessThan(first);
  });
});

// Type check: UserPlan covers all plan strings used in tests
const _planCheck: UserPlan = "free";
void _planCheck;
