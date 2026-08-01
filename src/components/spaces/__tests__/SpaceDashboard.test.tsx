import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpaceDashboard } from "@/components/spaces/SpaceDashboard";
import { ToastProvider } from "@/lib/toast-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const SPACE = {
  id: "space-1",
  user_id: "user-1",
  name: "Product launch",
  description: null,
  status: "active" as const,
  progress: 75,
  deadline: null,
  created_at: "2026-08-01T12:00:00.000Z",
  updated_at: "2026-08-01T12:00:00.000Z",
};

describe("SpaceDashboard lifecycle", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("completes an active space without changing its progress", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (init?.method === "PATCH") {
        return {
          ok: true,
          json: async () => ({
            ...SPACE,
            status: "completed",
            updated_at: "2026-08-01T13:00:00.000Z",
          }),
        } as Response;
      }
      if (url.startsWith("/api/tasks")) return { ok: true, json: async () => [] } as Response;
      if (url === "/api/spaces") return { ok: true, json: async () => [SPACE] } as Response;
      return { ok: true, json: async () => SPACE } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ToastProvider>
        <SpaceDashboard spaceId={SPACE.id} />
      </ToastProvider>
    );

    await userEvent.click(await screen.findByRole("button", { name: "Complete space" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Reopen space" })).toBeInTheDocument());
    expect(screen.getByText("75%")).toBeInTheDocument();
    const patchCall = fetchMock.mock.calls.find((call) => call[1]?.method === "PATCH");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      status: "completed",
      expected_updated_at: SPACE.updated_at,
    });
  });
});
