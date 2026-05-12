import { describe, it, expect } from "vitest";
import { getMcpCounts } from "@/lib/mcp/server";

describe("getMcpCounts", () => {
  it("returns positive counts for tools, prompts, and resources", () => {
    const counts = getMcpCounts();
    expect(counts.tools).toBeGreaterThan(0);
    expect(counts.prompts).toBeGreaterThan(0);
    expect(counts.resources).toBeGreaterThan(0);
  });

  // Lower bounds picked to catch the SDK renaming its internal registries
  // (would silently return 0) or a register* call being accidentally removed.
  // Bump these when the surface grows; they're not strict equality so adding
  // a tool doesn't break the test.
  it("returns at least the expected baseline counts", () => {
    const counts = getMcpCounts();
    expect(counts.tools).toBeGreaterThanOrEqual(30);
    expect(counts.prompts).toBeGreaterThanOrEqual(10);
    expect(counts.resources).toBeGreaterThanOrEqual(10);
  });

  it("returns a cached object on repeated calls", () => {
    const a = getMcpCounts();
    const b = getMcpCounts();
    expect(a).toBe(b);
  });
});
