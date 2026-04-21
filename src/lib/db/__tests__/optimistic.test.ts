import { describe, it, expect } from "vitest";
import { classifyUpdate, parseExpectedUpdatedAt } from "@/lib/db/optimistic";

describe("classifyUpdate", () => {
  it("returns ok when the update returned a row", () => {
    const result = classifyUpdate([{ id: "a" }], []);
    expect(result).toEqual({ ok: true, row: { id: "a" } });
  });

  it("returns not_found when neither update nor select found the row", () => {
    const result = classifyUpdate([], []);
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns conflict when the row exists but the version did not match", () => {
    const result = classifyUpdate([], [{ id: "a", v: 2 }]);
    expect(result).toEqual({
      ok: false,
      reason: "conflict",
      current: { id: "a", v: 2 },
    });
  });

  it("prefers the updated row even if a current row is also present", () => {
    // Defensive: this shouldn't happen in practice (you only query current
    // when the update returned zero rows), but the contract should be clear.
    const result = classifyUpdate([{ id: "a", v: 3 }], [{ id: "a", v: 2 }]);
    expect(result).toEqual({ ok: true, row: { id: "a", v: 3 } });
  });
});

describe("parseExpectedUpdatedAt", () => {
  it("parses a valid ISO string", () => {
    const out = parseExpectedUpdatedAt("2026-04-21T13:22:11.123Z");
    expect(out).toBeInstanceOf(Date);
    expect(out!.toISOString()).toBe("2026-04-21T13:22:11.123Z");
  });

  it("returns null for an invalid ISO string", () => {
    expect(parseExpectedUpdatedAt("not a date")).toBeNull();
  });

  it("passes through a Date", () => {
    const d = new Date("2026-04-21T13:22:11.123Z");
    expect(parseExpectedUpdatedAt(d)).toBe(d);
  });

  it("returns null for an Invalid Date object", () => {
    expect(parseExpectedUpdatedAt(new Date("not a date"))).toBeNull();
  });
});
