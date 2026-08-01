import { describe, expect, it } from "vitest";
import { taskMatchesView } from "../TaskList";
import type { Task } from "@/types/database";

const task = {
  id: "task-1",
  title: "Review plan",
  task_date: "2026-08-01",
  space_id: "space-1",
} as Task;

describe("taskMatchesView", () => {
  it("removes a task moved to another date from the current view", () => {
    expect(taskMatchesView({ ...task, task_date: "2026-08-02" }, "2026-08-01", "")).toBe(false);
  });

  it("removes a task moved outside the active space filter", () => {
    expect(taskMatchesView({ ...task, space_id: "space-2" }, "2026-08-01", "space-1")).toBe(false);
  });

  it("keeps matching tasks and ignores space when no filter is active", () => {
    expect(taskMatchesView(task, "2026-08-01", "space-1")).toBe(true);
    expect(taskMatchesView(task, "2026-08-01", "")).toBe(true);
  });
});
