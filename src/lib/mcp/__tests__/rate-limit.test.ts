import { describe, it, expect, beforeEach } from "vitest";
import { consumeToken, __resetForTests } from "@/lib/mcp/rate-limit";

beforeEach(() => __resetForTests());

describe("consumeToken", () => {
  it("allows requests up to the burst size", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 100; i++) {
      const d = consumeToken("u1", t0);
      expect(d.allowed).toBe(true);
    }
  });

  it("rejects with Retry-After once the bucket is empty", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 100; i++) consumeToken("u1", t0);
    const denied = consumeToken("u1", t0);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("refills over time at ~10 tokens/sec", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 100; i++) consumeToken("u1", t0);
    expect(consumeToken("u1", t0).allowed).toBe(false);

    // 1 second later → ~10 tokens refilled.
    const t1 = t0 + 1000;
    for (let i = 0; i < 10; i++) {
      expect(consumeToken("u1", t1).allowed).toBe(true);
    }
    expect(consumeToken("u1", t1).allowed).toBe(false);
  });

  it("keeps buckets independent per key", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 100; i++) consumeToken("u1", t0);
    expect(consumeToken("u1", t0).allowed).toBe(false);
    // Different key has its own full bucket.
    expect(consumeToken("u2", t0).allowed).toBe(true);
  });

  it("caps refill at the burst size", () => {
    const t0 = 1_000_000;
    consumeToken("u1", t0); // bucket starts at 100, now 99
    // Huge time gap should not produce >100 tokens.
    const t1 = t0 + 60 * 60 * 1000;
    for (let i = 0; i < 100; i++) {
      expect(consumeToken("u1", t1).allowed).toBe(true);
    }
    expect(consumeToken("u1", t1).allowed).toBe(false);
  });
});
