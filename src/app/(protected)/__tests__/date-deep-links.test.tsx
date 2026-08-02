import TasksPage from "../tasks/page";
import HabitsPage from "../habits/page";
import JournalPage from "../journal/page";
import WorkoutsPage from "../workouts/page";
import FocusPage from "../focus/page";
import { beforeAll } from "vitest";

beforeAll(() => {
  process.env.SELF_HOSTED_USER_ID = "00000000-0000-4000-8000-000000000001";
});

describe("calendar date deep links", () => {
  it.each([
    ["tasks", TasksPage],
    ["habits", HabitsPage],
    ["journal", JournalPage],
    ["workouts", WorkoutsPage],
    ["focus", FocusPage],
  ])("passes the requested date through the %s route", async (_name, Page) => {
    const element = await Page({ searchParams: Promise.resolve({ date: "2026-07-15" }) });

    expect(element.props.initialDate).toBe("2026-07-15");
  });
});
