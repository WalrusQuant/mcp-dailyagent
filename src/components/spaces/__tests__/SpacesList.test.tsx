import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpacesList } from "@/components/spaces/SpacesList";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

const space = (id: string, name: string) => ({
  id, user_id: "user-1", name, description: null, status: "active", progress: 0,
  deadline: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z",
});

describe("SpacesList filtering", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not render an aborted filter response", async () => {
    const all = deferredResponse();
    const active = deferredResponse();
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => String(input).includes("status=active") ? active.promise : all.promise));
    render(<SpacesList />);

    await userEvent.click(screen.getByRole("button", { name: "Active" }));
    active.resolve({ ok: true, json: async () => [space("active", "Current filter")] } as Response);
    expect(await screen.findByText("Current filter")).toBeInTheDocument();
    all.resolve({ ok: true, json: async () => [space("all", "Stale result")] } as Response);

    await Promise.resolve();
    expect(screen.queryByText("Stale result")).not.toBeInTheDocument();
  });
});
