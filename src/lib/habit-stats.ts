export function calculateStreak(logs: string[], targetDays: number[]): number {
  const logSet = new Set(logs);
  let streak = 0;
  let started = false;
  const checkDate = new Date();

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split("T")[0];
    const dayOfWeek = checkDate.getDay() === 0 ? 7 : checkDate.getDay();

    if (!targetDays.includes(dayOfWeek)) {
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    }

    if (logSet.has(dateStr)) {
      started = true;
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (started) {
      break;
    } else {
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }
  return streak;
}

export function getApplicableDays(startDate: Date, endDate: Date, targetDays: number[]): number {
  let count = 0;
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const dayOfWeek = cursor.getDay() === 0 ? 7 : cursor.getDay();
    if (targetDays.includes(dayOfWeek)) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}
