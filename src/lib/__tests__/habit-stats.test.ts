import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { calculateStreak, getApplicableDays } from "@/lib/habit-stats";

// All tests pin "today" so streak results are deterministic.
// 2026-03-11 is a Wednesday (getDayOfWeek → 3).
const TODAY = "2026-03-11";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});

afterEach(() => {
  vi.useRealTimers();
});

// Every day of the week (1=Mon … 7=Sun)
const DAILY = [1, 2, 3, 4, 5, 6, 7];
// Weekdays only
const WEEKDAYS = [1, 2, 3, 4, 5];
// Mon + Wed + Fri
const MWF = [1, 3, 5];

describe("calculateStreak — basic correctness", () => {
  it("returns 0 when no logs exist", () => {
    expect(calculateStreak([], DAILY)).toBe(0);
  });

  it("returns 0 when no logs exist for weekday habit", () => {
    expect(calculateStreak([], WEEKDAYS)).toBe(0);
  });

  it("counts a single log on today", () => {
    expect(calculateStreak([TODAY], DAILY)).toBe(1);
  });

  it("counts consecutive days ending today", () => {
    const logs = ["2026-03-09", "2026-03-10", TODAY]; // Mon–Wed
    expect(calculateStreak(logs, DAILY)).toBe(3);
  });

  it("counts consecutive days ending yesterday when today is unlogged", () => {
    // Today (Wed) not logged; Mon and Tue are logged
    const logs = ["2026-03-09", "2026-03-10"]; // Mon, Tue
    expect(calculateStreak(logs, DAILY)).toBe(2);
  });
});

describe("calculateStreak — lapse resets streak", () => {
  it("resets after a missed applicable day", () => {
    // Streak of Mon+Tue with today (Wed) unlogged — allowed grace, streak = 2.
    const logs = [
      "2026-03-09", // Mon
      "2026-03-10", // Tue
      // today (Wed 11) not logged — allowed grace
    ];
    expect(calculateStreak(logs, DAILY)).toBe(2);
  });

  it("returns 0 when gap includes yesterday (today unlogged, yesterday unlogged)", () => {
    // Today (Wed) unlogged, yesterday (Tue 2026-03-10) also unlogged — streak must be 0.
    // Grace only covers today; a missed yesterday immediately breaks the streak.
    const logs = [
      "2026-03-08", // Sun
      "2026-03-09", // Mon (logged)
      // 2026-03-10 (Tue) = yesterday, NOT logged
      // 2026-03-11 (Wed) = today, NOT logged
    ];
    expect(calculateStreak(logs, DAILY)).toBe(0);
  });

  it("a run from months ago does not inflate the current streak", () => {
    const oldRun = [
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
    ];
    // No recent logs — streak must be 0, not 5
    expect(calculateStreak(oldRun, DAILY)).toBe(0);
  });

  it("old run plus a recent run returns only the recent run length", () => {
    const logs = [
      // Old 5-day run
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
      // Gap in between
      // Recent 3-day run ending today
      "2026-03-09",  // Mon
      "2026-03-10",  // Tue
      TODAY,          // Wed (today)
    ];
    expect(calculateStreak(logs, DAILY)).toBe(3);
  });
});

describe("calculateStreak — target_days awareness", () => {
  it("skips non-applicable days when counting streak", () => {
    // Weekdays only; today is Wed (applicable).
    // Sat 2026-03-07 and Sun 2026-03-08 are non-applicable and should not break the streak.
    const logs = [
      "2026-03-05", // Thu (applicable)
      "2026-03-06", // Fri (applicable)
      // Sat 2026-03-07 — not applicable, should be skipped
      // Sun 2026-03-08 — not applicable, should be skipped
      "2026-03-09", // Mon (applicable)
      "2026-03-10", // Tue (applicable)
      TODAY,         // Wed (applicable, logged)
    ];
    expect(calculateStreak(logs, WEEKDAYS)).toBe(5); // Thu–Fri + Mon–Wed = 5 applicable days
  });

  it("breaks streak on missed weekday even across weekend", () => {
    // Weekdays only; Friday was missed, then Mon–Wed logged.
    const logs = [
      "2026-03-05", // Thu (logged)
      // Fri 2026-03-06 — MISSED (applicable for WEEKDAYS)
      "2026-03-09", // Mon (logged)
      "2026-03-10", // Tue (logged)
      TODAY,         // Wed (logged)
    ];
    expect(calculateStreak(logs, WEEKDAYS)).toBe(3); // streak resets at Mon after missing Fri
  });

  it("MWF habit counts only Mon/Wed/Fri applicable days", () => {
    // Today is Wed; Mon was logged, today is logged.
    // Fri 2026-03-06 was also logged (last applicable before Mon).
    const logs = [
      "2026-03-06", // Fri (applicable)
      "2026-03-09", // Mon (applicable)
      TODAY,         // Wed (applicable, logged)
    ];
    expect(calculateStreak(logs, MWF)).toBe(3);
  });

  it("MWF habit resets if last Friday was missed", () => {
    // Last applicable day before Mon was Fri; Fri was NOT logged.
    const logs = [
      "2026-03-09", // Mon (logged)
      TODAY,         // Wed (logged)
    ];
    expect(calculateStreak(logs, MWF)).toBe(2);
  });

  it("returns 0 when no applicable days are logged", () => {
    // Daily log on a Saturday but habit is weekdays-only
    const logs = ["2026-03-07"]; // Sat — not in WEEKDAYS
    expect(calculateStreak(logs, WEEKDAYS)).toBe(0);
  });
});

describe("calculateStreak — today-unlogged grace", () => {
  it("does not break streak when today is unlogged but yesterday was logged", () => {
    const logs = ["2026-03-10"]; // Tue (yesterday)
    expect(calculateStreak(logs, DAILY)).toBe(1);
  });

  it("does not count today in the streak when unlogged", () => {
    const logs = ["2026-03-09", "2026-03-10"]; // Mon + Tue
    expect(calculateStreak(logs, DAILY)).toBe(2); // not 3
  });

  it("counts today when it IS logged", () => {
    const logs = ["2026-03-09", "2026-03-10", TODAY]; // Mon + Tue + today(Wed)
    expect(calculateStreak(logs, DAILY)).toBe(3);
  });
});

describe("getApplicableDays", () => {
  it("counts all days for a daily habit", () => {
    // 2026-03-01 to 2026-03-07 = 7 days
    expect(getApplicableDays("2026-03-01", "2026-03-07", DAILY)).toBe(7);
  });

  it("counts only weekdays for a weekday habit", () => {
    // 2026-03-01 (Sun) to 2026-03-07 (Sat) — 5 weekdays (Mon–Fri)
    expect(getApplicableDays("2026-03-01", "2026-03-07", WEEKDAYS)).toBe(5);
  });

  it("counts Mon+Wed+Fri in a week", () => {
    // 2026-03-09 (Mon) to 2026-03-15 (Sun)
    expect(getApplicableDays("2026-03-09", "2026-03-15", MWF)).toBe(3);
  });

  it("returns 0 when no day in range matches target", () => {
    // 2026-03-14 (Sat) to 2026-03-15 (Sun) — neither in WEEKDAYS
    expect(getApplicableDays("2026-03-14", "2026-03-15", WEEKDAYS)).toBe(0);
  });

  it("returns 1 for a single matching day", () => {
    expect(getApplicableDays(TODAY, TODAY, DAILY)).toBe(1);
  });

  it("returns 0 when start > end", () => {
    expect(getApplicableDays("2026-03-15", "2026-03-01", DAILY)).toBe(0);
  });
});
