import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormModal } from "@/components/shared/FormModal";

describe("FormModal", () => {
  it("labels the dialog, traps focus, closes on Escape, and restores focus", async () => {
    const onClose = vi.fn();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(
      <FormModal title="Edit item" onClose={onClose}>
        <button data-autofocus>First</button>
        <button>Last</button>
      </FormModal>
    );

    const dialog = screen.getByRole("dialog", { name: "Edit item" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(screen.getByText("First")).toHaveFocus());

    screen.getByText("Last").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
