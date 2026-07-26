import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkoutDashboard } from "@/components/workouts/WorkoutDashboard";
import { ToastProvider } from "@/lib/toast-context";

const TEMPLATE = {
  id: "t-1",
  user_id: "u-1",
  name: "Morning Pump",
  description: "Short activation",
  created_at: "2026-07-26T18:26:01.559Z",
  workout_exercises: [
    {
      id: "e-1",
      template_id: "t-1",
      name: "Pushups",
      exercise_type: "strength",
      sort_order: 0,
      default_sets: 3,
      default_reps: 10,
      default_weight: 0,
      default_duration: null,
      notes: null,
    },
  ],
};

function mockFetch(overrides: Record<string, unknown> = {}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const key = `${method} ${url.split("?")[0]}`;
    if (key in overrides) {
      return { ok: true, json: async () => overrides[key] } as Response;
    }
    if (key === "GET /api/workouts/templates") {
      return { ok: true, json: async () => [TEMPLATE] } as Response;
    }
    if (key === "GET /api/workouts/logs") {
      return { ok: true, json: async () => [] } as Response;
    }
    if (key === "GET /api/workouts/stats") {
      return {
        ok: true,
        json: async () => ({ totalWorkouts: 0, totalVolume: 0, weeklyAverage: 0, personalRecords: [] }),
      } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
}

function renderDashboard() {
  return render(
    <ToastProvider>
      <WorkoutDashboard />
    </ToastProvider>
  );
}

describe("WorkoutDashboard templates", () => {
  beforeEach(() => {
    // Node's built-in localStorage isn't a full Storage here, and the logger
    // mirrors in-progress workouts to it — give each test a clean fake.
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    });
    vi.stubGlobal("fetch", mockFetch());
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The card used to be one big "start workout" button, so opening a template
  // to look at it dropped you into the logger — where Finish writes a workout
  // that never happened. Inspecting a template must never reach the logger.
  it("does not open the workout logger when the card body is clicked", async () => {
    const user = userEvent.setup();
    renderDashboard();

    const name = await screen.findByText("Morning Pump");
    await user.click(name);

    expect(screen.queryByText("Add exercise...")).not.toBeInTheDocument();
    expect(screen.getByText("Templates")).toBeInTheDocument();
  });

  it("opens the logger only from the explicit Start button", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByLabelText("Start Morning Pump"));

    expect(await screen.findByPlaceholderText("Add exercise...")).toBeInTheDocument();
  });

  // Edit was unreachable dead code: the modal and its PATCH route existed, but
  // nothing ever set the template being edited.
  it("opens the form in edit mode, prefilled, from the Edit button", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByLabelText("Edit Morning Pump"));

    expect(await screen.findByText("Edit Template")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Morning Pump")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Pushups")).toBeInTheDocument();
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });

  it("deletes a template through the API and drops it from the list", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderDashboard();

    await user.click(await screen.findByLabelText("Delete Morning Pump"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/workouts/templates/t-1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
    await waitFor(() => {
      expect(screen.queryByText("Morning Pump")).not.toBeInTheDocument();
    });
  });

  it("never posts a workout log while creating a template", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      "POST /api/workouts/templates": { ...TEMPLATE, id: "t-2", name: "Nightly Pump" },
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDashboard();

    await user.click(await screen.findByText("New"));
    await user.type(screen.getByPlaceholderText("e.g., Upper Body Push"), "Nightly Pump");
    await user.type(screen.getByPlaceholderText("Exercise name"), "Situps");
    await user.click(screen.getByText("Create Template"));

    await waitFor(() => expect(screen.getByText("Nightly Pump")).toBeInTheDocument());

    const logPosts = fetchMock.mock.calls.filter(
      ([url, init]) =>
        String(url).startsWith("/api/workouts/logs") &&
        (init as RequestInit | undefined)?.method === "POST"
    );
    expect(logPosts).toEqual([]);
  });
});
