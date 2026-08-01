import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagsTab } from "@/components/settings/TagsTab";
import { ToastProvider } from "@/lib/toast-context";

describe("TagsTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renames and recolors an existing tag", async () => {
    const original = { id: "tag-1", user_id: "user-1", name: "Old", color: "#8fb5f2", created_at: "2026-08-01T00:00:00.000Z" };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        return { ok: true, json: async () => ({ ...original, ...body }) } as Response;
      }
      return { ok: true, json: async () => [original] } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ToastProvider><TagsTab /></ToastProvider>);
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText("Edit Old"));
    const input = screen.getByLabelText("Name for Old");
    await user.clear(input);
    await user.type(input, "Updated");
    await user.click(screen.getByLabelText("Set Old color to #5ecf8a"));
    await user.click(screen.getByLabelText("Save Old"));

    await waitFor(() => expect(screen.getByText("Updated")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/tags/tag-1", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ name: "Updated", color: "#5ecf8a" }),
    }));
  });
});
