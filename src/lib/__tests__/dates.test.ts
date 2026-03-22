import {
  getToday,
  formatDate,
  addDays,
  startOfWeek,
  endOfWeek,
  getDateRange,
  isToday,
  formatRelativeDate,
  getDayOfWeek,
  startOfMonth,
  endOfMonth,
  addMonths,
  formatMonth,
  getCalendarGridDates,
} from "@/lib/dates";

describe("addDays", () => {
  it("adds positive days", () => {
    expect(addDays("2026-03-01", 5)).toBe("2026-03-06");
  });

  it("subtracts with negative days", () => {
    expect(addDays("2026-03-06", -5)).toBe("2026-03-01");
  });

  it("crosses month boundary forward", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
  });

  it("crosses month boundary backward", () => {
    expect(addDays("2026-02-02", -3)).toBe("2026-01-30");
  });

  it("crosses year boundary", () => {
    expect(addDays("2025-12-30", 3)).toBe("2026-01-02");
  });

  it("adds zero days", () => {
    expect(addDays("2026-03-15", 0)).toBe("2026-03-15");
  });
});

describe("startOfWeek", () => {
  it("returns Monday for a Monday", () => {
    expect(startOfWeek("2026-03-09")).toBe("2026-03-09"); // Monday
  });

  it("returns Monday for a Wednesday", () => {
    expect(startOfWeek("2026-03-11")).toBe("2026-03-09");
  });

  it("returns Monday for a Sunday", () => {
    expect(startOfWeek("2026-03-15")).toBe("2026-03-09");
  });

  it("returns Monday for a Saturday", () => {
    expect(startOfWeek("2026-03-14")).toBe("2026-03-09");
  });

  it("returns Monday for a Tuesday", () => {
    expect(startOfWeek("2026-03-10")).toBe("2026-03-09");
  });

  it("returns Monday for a Friday", () => {
    expect(startOfWeek("2026-03-13")).toBe("2026-03-09");
  });

  it("returns Monday for a Thursday", () => {
    expect(startOfWeek("2026-03-12")).toBe("2026-03-09");
  });
});

describe("endOfWeek", () => {
  it("returns Sunday for a Monday", () => {
    expect(endOfWeek("2026-03-09")).toBe("2026-03-15");
  });

  it("returns Sunday for a Sunday", () => {
    expect(endOfWeek("2026-03-15")).toBe("2026-03-15");
  });

  it("returns Sunday for mid-week", () => {
    expect(endOfWeek("2026-03-11")).toBe("2026-03-15");
  });
});

describe("getDateRange", () => {
  it("returns range of dates", () => {
    expect(getDateRange("2026-03-01", "2026-03-03")).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ]);
  });

  it("returns single date when start equals end", () => {
    expect(getDateRange("2026-03-01", "2026-03-01")).toEqual(["2026-03-01"]);
  });

  it("returns empty when start > end", () => {
    expect(getDateRange("2026-03-05", "2026-03-01")).toEqual([]);
  });
});

describe("getDayOfWeek", () => {
  // 2026-03-09 is Monday
  it("returns 1 for Monday", () => {
    expect(getDayOfWeek("2026-03-09")).toBe(1);
  });

  it("returns 2 for Tuesday", () => {
    expect(getDayOfWeek("2026-03-10")).toBe(2);
  });

  it("returns 3 for Wednesday", () => {
    expect(getDayOfWeek("2026-03-11")).toBe(3);
  });

  it("returns 4 for Thursday", () => {
    expect(getDayOfWeek("2026-03-12")).toBe(4);
  });

  it("returns 5 for Friday", () => {
    expect(getDayOfWeek("2026-03-13")).toBe(5);
  });

  it("returns 6 for Saturday", () => {
    expect(getDayOfWeek("2026-03-14")).toBe(6);
  });

  it("returns 7 for Sunday", () => {
    expect(getDayOfWeek("2026-03-15")).toBe(7);
  });
});

describe("startOfMonth / endOfMonth", () => {
  it("startOfMonth returns first day", () => {
    expect(startOfMonth("2026-03")).toBe("2026-03-01");
  });

  it("endOfMonth returns last day for 31-day month", () => {
    expect(endOfMonth("2026-03")).toBe("2026-03-31");
  });

  it("endOfMonth returns 28 for non-leap Feb", () => {
    expect(endOfMonth("2025-02")).toBe("2025-02-28");
  });

  it("endOfMonth returns 29 for leap Feb", () => {
    expect(endOfMonth("2024-02")).toBe("2024-02-29");
  });

  it("endOfMonth returns 30 for April", () => {
    expect(endOfMonth("2026-04")).toBe("2026-04-30");
  });
});

describe("addMonths", () => {
  it("adds months forward", () => {
    expect(addMonths("2026-03", 2)).toBe("2026-05");
  });

  it("subtracts months backward", () => {
    expect(addMonths("2026-03", -2)).toBe("2026-01");
  });

  it("rolls over to next year", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
  });

  it("rolls back to previous year", () => {
    expect(addMonths("2026-02", -3)).toBe("2025-11");
  });
});

describe("formatMonth", () => {
  it("formats month and year", () => {
    expect(formatMonth("2026-03")).toBe("March 2026");
  });

  it("formats January", () => {
    expect(formatMonth("2026-01")).toBe("January 2026");
  });
});

describe("formatDate", () => {
  it("formats short date", () => {
    const result = formatDate("2026-03-15");
    expect(result).toBe("Mar 15");
  });

  it("formats long date", () => {
    const result = formatDate("2026-03-15", "long");
    expect(result).toBe("Sunday, March 15, 2026");
  });
});

describe("getToday / isToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("getToday returns current date", () => {
    expect(getToday()).toBe("2026-03-11");
  });

  it("isToday returns true for today", () => {
    expect(isToday("2026-03-11")).toBe(true);
  });

  it("isToday returns false for other dates", () => {
    expect(isToday("2026-03-10")).toBe(false);
  });
});

describe("formatRelativeDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns Today for today", () => {
    expect(formatRelativeDate("2026-03-11")).toBe("Today");
  });

  it("returns Yesterday for yesterday", () => {
    expect(formatRelativeDate("2026-03-10")).toBe("Yesterday");
  });

  it("returns Tomorrow for tomorrow", () => {
    expect(formatRelativeDate("2026-03-12")).toBe("Tomorrow");
  });

  it("returns long format for other dates", () => {
    expect(formatRelativeDate("2026-03-15")).toBe("Sunday, March 15, 2026");
  });
});

describe("getCalendarGridDates", () => {
  it("returns dates starting on Monday and ending on Sunday", () => {
    const dates = getCalendarGridDates("2026-03");
    // March 2026 starts on Sunday, so grid starts on Monday Feb 23
    expect(dates[0]).toBe("2026-02-23");
    // Grid always ends on a Sunday
    expect(getDayOfWeek(dates[dates.length - 1])).toBe(7);
    // Grid always starts on a Monday
    expect(getDayOfWeek(dates[0])).toBe(1);
    // Grid length is always a multiple of 7
    expect(dates.length % 7).toBe(0);
  });

  it("includes all days of the month", () => {
    const dates = getCalendarGridDates("2026-03");
    for (let d = 1; d <= 31; d++) {
      const day = `2026-03-${String(d).padStart(2, "0")}`;
      expect(dates).toContain(day);
    }
  });
});
