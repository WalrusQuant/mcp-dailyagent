import { getToday, addDays, getDayOfWeek } from "@/lib/dates";

export function calculateStreak(logs: string[], targetDays: number[]): number {
  const logSet = new Set(logs);
  let streak = 0;
  let started = false;
  let checkDate = getToday();

  for (let i = 0; i < 365; i++) {
    const dayOfWeek = getDayOfWeek(checkDate);

    if (!targetDays.includes(dayOfWeek)) {
      checkDate = addDays(checkDate, -1);
      continue;
    }

    if (logSet.has(checkDate)) {
      started = true;
      streak++;
      checkDate = addDays(checkDate, -1);
    } else if (started) {
      break;
    } else {
      checkDate = addDays(checkDate, -1);
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
