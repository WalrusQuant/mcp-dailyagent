import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoalDetail } from "@/components/goals/GoalDetail";
import { ToastProvider } from "@/lib/toast-context";

const GOAL = {
  id: "goal-1",
  user_id: "user-1",
  title: "Ship the release",
  description: null,
  category: "career" as const,
  status: "active" as const,
  progress: 80,
  progress_mode: "manual" as const,
  target_date: null,
  completed_at: null,
  sort_order: 0,
  created_at: "2026-08-01T12:00:00.000Z",
  updated_at: "2026-08-01T12:00:00.000Z",
  tasks: [],
  habits: [],
};

describe("GoalDetail lifecycle", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("completes an active goal and offers to reopen it", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (init?.method === "PATCH") {
        const requested = JSON.parse(String(init.body)) as { status: "active" | "completed" };
        return {
          ok: true,
          json: async () => ({
            ...GOAL,
            status: requested.status,
            completed_at: requested.status === "completed" ? "2026-08-01T13:00:00.000Z" : null,
            updated_at: "2026-08-01T13:00:00.000Z",
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => (url.endsWith("/progress") ? [] : GOAL),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const onStatusChange = vi.fn();

    render(
      <ToastProvider>
        <GoalDetail goalId={GOAL.id} onBack={vi.fn()} onStatusChange={onStatusChange} />
      </ToastProvider>
    );

    await userEvent.click(await screen.findByRole("button", { name: "Complete goal" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Reopen goal" })).toBeInTheDocument());
    const patchCall = fetchMock.mock.calls.find((call) => call[1]?.method === "PATCH");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      status: "completed",
      expected_updated_at: GOAL.updated_at,
    });
    expect(onStatusChange).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));

    await userEvent.click(screen.getByRole("button", { name: "Reopen goal" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Complete goal" })).toBeInTheDocument());
    const patchCalls = fetchMock.mock.calls.filter((call) => call[1]?.method === "PATCH");
    expect(JSON.parse(String(patchCalls[1]?.[1]?.body))).toEqual({
      status: "active",
      expected_updated_at: "2026-08-01T13:00:00.000Z",
    });
  });
});
