describe("checkRateLimit", () => {
  let checkRateLimit: typeof import("@/lib/rate-limit").checkRateLimit;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const mod = await import("@/lib/rate-limit");
    checkRateLimit = mod.checkRateLimit;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request", () => {
    expect(checkRateLimit("user1", "chat", false)).toBeNull();
  });

  it("allows requests within the limit", () => {
    for (let i = 0; i < 29; i++) {
      expect(checkRateLimit("user1", "chat", false)).toBeNull();
    }
  });

  it("returns 429 when limit exceeded (chat=30)", () => {
    for (let i = 0; i < 30; i++) {
      checkRateLimit("user1", "chat", false);
    }
    const result = checkRateLimit("user1", "chat", false);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
    expect(result!.headers.get("Retry-After")).toBeTruthy();
  });

  it("admin bypasses rate limit", () => {
    for (let i = 0; i < 50; i++) {
      expect(checkRateLimit("admin1", "chat", true)).toBeNull();
    }
  });

  it("expired timestamps do not count", () => {
    // Use up the limit
    for (let i = 0; i < 30; i++) {
      checkRateLimit("user2", "chat", false);
    }
    expect(checkRateLimit("user2", "chat", false)).not.toBeNull();

    // Advance past the window (60s)
    vi.advanceTimersByTime(61_000);

    // Should be allowed again
    expect(checkRateLimit("user2", "chat", false)).toBeNull();
  });

  it("tracks different categories independently", () => {
    // Fill up image limit (10)
    for (let i = 0; i < 10; i++) {
      checkRateLimit("user3", "image", false);
    }
    expect(checkRateLimit("user3", "image", false)).not.toBeNull();

    // Chat should still work
    expect(checkRateLimit("user3", "chat", false)).toBeNull();
  });

  it("tracks different users independently", () => {
    for (let i = 0; i < 30; i++) {
      checkRateLimit("userA", "chat", false);
    }
    expect(checkRateLimit("userA", "chat", false)).not.toBeNull();
    expect(checkRateLimit("userB", "chat", false)).toBeNull();
  });

  it("429 response includes retry-after in body", async () => {
    for (let i = 0; i < 30; i++) {
      checkRateLimit("user4", "chat", false);
    }
    const result = checkRateLimit("user4", "chat", false);
    const body = await result!.json();
    expect(body.error).toBe("Rate limit exceeded");
    expect(body.retryAfter).toBeGreaterThan(0);
  });
});
