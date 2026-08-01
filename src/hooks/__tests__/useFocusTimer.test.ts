import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFocusTimer } from "../useFocusTimer";

describe("useFocusTimer mutations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    });
  });

  it("keeps a running timer unchanged when pausing fails", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "session-1" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "failed" }), { status: 500 }));
    const { result } = renderHook(() => useFocusTimer());

    await act(async () => {
      expect(await result.current.start(25, 5, null, null)).toBe(true);
    });
    await act(async () => {
      expect(await result.current.pause()).toBe(false);
    });

    expect(fetchMock).toHaveBeenLastCalledWith("/api/focus/session-1", expect.objectContaining({ method: "PATCH" }));
    expect(result.current.isRunning).toBe(true);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.mutationError).toMatch(/left unchanged/i);
  });

  it("does not clear an active timer when cancellation fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "session-1" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    const { result } = renderHook(() => useFocusTimer());

    await act(async () => { await result.current.start(25, 5, null, null); });
    await act(async () => { expect(await result.current.reset()).toBe(false); });

    expect(result.current.isActive).toBe(true);
    expect(localStorage.getItem("focus-timer-state")).not.toBeNull();
  });

  it("does not loop automatic completion requests after an expired session fails", async () => {
    localStorage.setItem("focus-timer-state", JSON.stringify({
      startTime: Date.now() - 60_000,
      duration: 1,
      breakDuration: 300,
      taskId: null,
      taskName: null,
      sessionId: "session-1",
      isBreak: false,
      pausedAt: null,
    }));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "offline" }), { status: 503 })
    );

    const { result } = renderHook(() => useFocusTimer());

    await waitFor(() => expect(result.current.mutationError).not.toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.isPaused).toBe(true);
  });
});
