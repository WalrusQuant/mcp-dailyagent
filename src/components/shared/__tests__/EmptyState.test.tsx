import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "@/components/shared/EmptyState";
import { Inbox } from "lucide-react";

describe("EmptyState", () => {
  it("renders icon and message", () => {
    const { container } = render(<EmptyState icon={Inbox} message="No items yet" />);
    expect(screen.getByText("No items yet")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders action button when actionLabel and onAction provided", () => {
    const onAction = vi.fn();
    render(
      <EmptyState icon={Inbox} message="Empty" actionLabel="Add Item" onAction={onAction} />
    );
    expect(screen.getByText("Add Item")).toBeInTheDocument();
  });

  it("calls onAction on button click", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <EmptyState icon={Inbox} message="Empty" actionLabel="Add Item" onAction={onAction} />
    );
    await user.click(screen.getByText("Add Item"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders suggestion chips", () => {
    const suggestions = [
      { label: "Suggestion 1" },
      { label: "Suggestion 2" },
    ];
    render(
      <EmptyState
        icon={Inbox}
        message="Empty"
        suggestions={suggestions}
        onSuggestionClick={vi.fn()}
      />
    );
    expect(screen.getByText("Suggestion 1")).toBeInTheDocument();
    expect(screen.getByText("Suggestion 2")).toBeInTheDocument();
  });

  it("calls onSuggestionClick with correct suggestion", async () => {
    const user = userEvent.setup();
    const onSuggestionClick = vi.fn();
    const suggestions = [
      { label: "Option A", data: { key: "a" } },
      { label: "Option B", data: { key: "b" } },
    ];
    render(
      <EmptyState
        icon={Inbox}
        message="Empty"
        suggestions={suggestions}
        onSuggestionClick={onSuggestionClick}
      />
    );
    await user.click(screen.getByText("Option B"));
    expect(onSuggestionClick).toHaveBeenCalledWith({ label: "Option B", data: { key: "b" } });
  });
});
