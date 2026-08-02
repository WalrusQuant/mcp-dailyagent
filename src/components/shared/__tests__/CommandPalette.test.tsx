import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { CommandPaletteProvider, useCommandPalette } from "@/lib/command-palette-context";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function Harness() {
  const { open } = useCommandPalette();
  return <><button onClick={open}>Open commands</button><CommandPalette /></>;
}

describe("CommandPalette", () => {
  it("acts as a labelled modal, traps focus, and restores its opener", async () => {
    render(<CommandPaletteProvider><Harness /></CommandPaletteProvider>);
    const opener = screen.getByRole("button", { name: "Open commands" });
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByRole("dialog", { name: "Command palette" })).toHaveAttribute("aria-modal", "true");
    const search = screen.getByRole("combobox", { name: "Search commands and pages" });
    await waitFor(() => expect(search).toHaveFocus());
    expect(search).toHaveAttribute("aria-controls", "command-palette-results");

    fireEvent.keyDown(search, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });
});
