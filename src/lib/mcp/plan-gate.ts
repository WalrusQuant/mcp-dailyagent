import { UserPlan } from "./types";

/** Check if user has a paid/active plan */
export function isPaidPlan(plan: UserPlan): boolean {
  return plan === "active";
}

/** Error message for free users trying write operations */
export const PAID_PLAN_REQUIRED = "This action requires a paid plan. Upgrade at https://dailyagent.dev/pricing";
