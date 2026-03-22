import { calculateCost, formatCost, formatTokens } from "@/lib/cost";

describe("calculateCost", () => {
  it("returns 0 when no pricing provided", () => {
    expect(calculateCost(1000, 500)).toBe(0);
  });

  it("returns 0 when no pricing is undefined", () => {
    expect(calculateCost(1000, 500, undefined)).toBe(0);
  });

  it("calculates cost with typical values", () => {
    const cost = calculateCost(1000, 500, { prompt: 3, completion: 15 });
    // (1000/1M)*3 + (500/1M)*15 = 0.003 + 0.0075 = 0.0105
    expect(cost).toBeCloseTo(0.0105);
  });

  it("calculates cost with large token counts", () => {
    const cost = calculateCost(1_000_000, 500_000, { prompt: 3, completion: 15 });
    // (1M/1M)*3 + (500K/1M)*15 = 3 + 7.5 = 10.5
    expect(cost).toBeCloseTo(10.5);
  });

  it("returns 0 when token counts are 0", () => {
    expect(calculateCost(0, 0, { prompt: 3, completion: 15 })).toBe(0);
  });

  it("handles prompt-only tokens", () => {
    const cost = calculateCost(10000, 0, { prompt: 1, completion: 2 });
    expect(cost).toBeCloseTo(0.01);
  });

  it("handles completion-only tokens", () => {
    const cost = calculateCost(0, 10000, { prompt: 1, completion: 2 });
    expect(cost).toBeCloseTo(0.02);
  });
});

describe("formatCost", () => {
  it("uses 6 decimals for costs below $0.01", () => {
    expect(formatCost(0.001234)).toBe("$0.001234");
  });

  it("uses 4 decimals for costs >= $0.01", () => {
    expect(formatCost(0.0123)).toBe("$0.0123");
  });

  it("formats zero", () => {
    expect(formatCost(0)).toBe("$0.000000");
  });

  it("formats boundary at exactly $0.01", () => {
    expect(formatCost(0.01)).toBe("$0.0100");
  });

  it("formats larger values", () => {
    expect(formatCost(1.5)).toBe("$1.5000");
  });

  it("uses 6 decimals just below boundary", () => {
    expect(formatCost(0.009999)).toBe("$0.009999");
  });
});

describe("formatTokens", () => {
  it("returns raw number below 1000", () => {
    expect(formatTokens(500)).toBe("500");
  });

  it("returns k-format at 1000", () => {
    expect(formatTokens(1000)).toBe("1.0k");
  });

  it("returns k-format above 1000", () => {
    expect(formatTokens(1500)).toBe("1.5k");
  });

  it("returns raw number at 999", () => {
    expect(formatTokens(999)).toBe("999");
  });

  it("formats large numbers", () => {
    expect(formatTokens(150000)).toBe("150.0k");
  });
});
