import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/lib/toast-context";
import { FocusSessionHistory } from "../FocusSessionHistory";
import { FocusSession } from "@/types/database";

const SESSION: FocusSession = {
  id: "session-1", user_id: "user-1", task_id: null, duration_minutes: 25,
  break_minutes: 5, started_at: "2026-08-01T12:00:00.000Z", completed_at: null,
  status: "active", notes: null, updated_at: "2026-08-01T12:00:00.000Z",
};

function renderHistory(onUpdated = vi.fn(), onDeleted = vi.fn()) {
  render(<ToastProvider><FocusSessionHistory sessions={[SESSION]} onUpdated={onUpdated} onDeleted={onDeleted} /></ToastProvider>);
  return { onUpdated, onDeleted };
}

describe("FocusSessionHistory", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("updates session status and notes with an optimistic-lock token", async () => {
    const updated = { ...SESSION, status: "completed" as const, notes: "Corrected" };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(updated), { status: 200 }));
    const { onUpdated } = renderHistory();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Edit focus session" }));
    await user.selectOptions(screen.getByLabelText("Session status"), "completed");
    await user.type(screen.getByLabelText("Session notes"), "Corrected");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ status: "completed", notes: "Corrected", expected_updated_at: SESSION.updated_at });
  });

  it("deletes a session after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    const { onDeleted } = renderHistory();

    await userEvent.click(screen.getByRole("button", { name: "Delete focus session" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(SESSION.id));
  });

  it("does not allow the currently running session to be edited or deleted", () => {
    render(
      <ToastProvider>
        <FocusSessionHistory
          sessions={[SESSION]}
          lockedSessionId={SESSION.id}
          onUpdated={vi.fn()}
          onDeleted={vi.fn()}
        />
      </ToastProvider>
    );

    expect(screen.queryByRole("button", { name: "Edit focus session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete focus session" })).not.toBeInTheDocument();
  });
});
