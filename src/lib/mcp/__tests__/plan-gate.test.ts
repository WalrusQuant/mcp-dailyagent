import { describe, it, expect } from "vitest";
import { isPaidPlan, PAID_PLAN_REQUIRED } from "@/lib/mcp/plan-gate";
import { UserPlan } from "@/lib/mcp/types";

describe("isPaidPlan", () => {
  it('returns true for "active" plan', () => {
    expect(isPaidPlan("active")).toBe(true);
  });

  it('returns false for "free" plan', () => {
    expect(isPaidPlan("free")).toBe(false);
  });

  it('returns false for "canceled" plan', () => {
    expect(isPaidPlan("canceled")).toBe(false);
  });

  it('returns false for "expired" plan', () => {
    expect(isPaidPlan("expired")).toBe(false);
  });

  it("only active plan is paid — all other UserPlan values return false", () => {
    const plans: UserPlan[] = ["free", "canceled", "expired"];
    for (const plan of plans) {
      expect(isPaidPlan(plan)).toBe(false);
    }
  });
});

describe("PAID_PLAN_REQUIRED", () => {
  it("is a non-empty string", () => {
    expect(typeof PAID_PLAN_REQUIRED).toBe("string");
    expect(PAID_PLAN_REQUIRED.length).toBeGreaterThan(0);
  });

  it("mentions upgrading or pricing", () => {
    expect(PAID_PLAN_REQUIRED.toLowerCase()).toMatch(/upgrade|pricing|paid/);
  });
});
