import { withRetry } from "@/lib/retry";

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 0, maxDelay: 0 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure then succeeds (explicit shouldRetry)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 0,
      maxDelay: 0,
      shouldRetry: () => true,
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws last error after exhausting retries (explicit shouldRetry)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelay: 0, maxDelay: 0, shouldRetry: () => true })
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
      withRetry(fn, { maxRetries: 1, baseDelay: 0, maxDelay: 0, shouldRetry: () => true })
    ).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
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

  describe("default shouldRetry predicate", () => {
    it("does not retry plain programming errors", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("programming error"));
      await expect(
        withRetry(fn, { maxRetries: 3, baseDelay: 0, maxDelay: 0 })
      ).rejects.toThrow("programming error");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries fetch TypeError (network failure)", async () => {
      const networkErr = new TypeError("fetch failed");
      const fn = vi.fn().mockRejectedValueOnce(networkErr).mockResolvedValue("ok");
      const result = await withRetry(fn, { maxRetries: 3, baseDelay: 0, maxDelay: 0 });
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("retries 5xx Response errors", async () => {
      const res = new Response(null, { status: 503 });
      const fn = vi.fn().mockRejectedValueOnce(res).mockResolvedValue("ok");
      const result = await withRetry(fn, { maxRetries: 3, baseDelay: 0, maxDelay: 0 });
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("does not retry 4xx Response errors", async () => {
      const res = new Response(null, { status: 404 });
      const fn = vi.fn().mockRejectedValue(res);
      await expect(
        withRetry(fn, { maxRetries: 3, baseDelay: 0, maxDelay: 0 })
      ).rejects.toBeInstanceOf(Response);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not retry AbortError", async () => {
      const abortErr = new DOMException("aborted", "AbortError");
      const fn = vi.fn().mockRejectedValue(abortErr);
      await expect(
        withRetry(fn, { maxRetries: 3, baseDelay: 0, maxDelay: 0 })
      ).rejects.toThrow("aborted");
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
