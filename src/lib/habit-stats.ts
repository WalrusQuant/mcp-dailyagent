import { getToday, addDays, getDayOfWeek } from "@/lib/dates";

/**
 * Calculates the current streak of consecutive logged applicable days.
 *
 * Rules:
 * - Walk backwards from today through days that match `targetDays`.
 * - If today is an applicable day but has not been logged yet, skip it
 *   (today in-progress does not break the streak).
 * - Any other unlogged applicable day ends the streak immediately.
 */
export function calculateStreak(logs: string[], targetDays: number[]): number {
  const logSet = new Set(logs);
  let streak = 0;
  const today = getToday();
  let checkDate = today;
  let skippedToday = false;

  for (let i = 0; i < 365; i++) {
    const dayOfWeek = getDayOfWeek(checkDate);

    if (!targetDays.includes(dayOfWeek)) {
      // Non-applicable day — always skip
      checkDate = addDays(checkDate, -1);
      continue;
    }

    if (logSet.has(checkDate)) {
      streak++;
      checkDate = addDays(checkDate, -1);
    } else if (!skippedToday && checkDate === today) {
      // Today is applicable but not yet logged — skip once without breaking
      skippedToday = true;
      checkDate = addDays(checkDate, -1);
    } else {
      // Unlogged applicable day in the past — streak is broken
      break;
    }
  }
  return streak;
}

export function getApplicableDays(startDate: string, endDate: string, targetDays: number[]): number {
  let count = 0;
  let cursor = startDate;

  while (cursor <= endDate) {
    if (targetDays.includes(getDayOfWeek(cursor))) {
      count++;
    }
    cursor = addDays(cursor, 1);
  }

  return count;
}
