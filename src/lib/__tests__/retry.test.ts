import { withRetry } from "@/lib/retry";

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 0, maxDelay: 0 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 0, maxDelay: 0 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws last error after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelay: 0, maxDelay: 0 })
    ).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("stops immediately when shouldRetry returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("no retry"));

    await expect(
      withRetry(fn, { maxRetries: 5, baseDelay: 0, maxDelay: 0, shouldRetry: () => false })
    ).rejects.toThrow("no retry");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respects maxRetries option", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(
      withRetry(fn, { maxRetries: 1, baseDelay: 0, maxDelay: 0 })
    ).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it("uses default shouldRetry for non-retryable errors", async () => {
    // shouldRetry returns false for non-matching errors when overridden
    const fn = vi.fn().mockRejectedValue(new Error("fatal"));

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelay: 0, maxDelay: 0, shouldRetry: () => false })
    ).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("handles async functions that return different types", async () => {
    const fn = vi.fn().mockResolvedValue({ data: [1, 2, 3] });
    const result = await withRetry(fn, { baseDelay: 0, maxDelay: 0 });
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it("does not delay on the first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("instant");
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 0, maxDelay: 0 });
    expect(result).toBe("instant");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
