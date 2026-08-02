import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "@/components/layout/BottomNav";
import { CommandPaletteProvider } from "@/lib/command-palette-context";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

describe("BottomNav More sheet", () => {
  it("exposes dialog state, traps focus, closes with Escape, and restores focus", async () => {
    render(<CommandPaletteProvider><BottomNav /></CommandPaletteProvider>);
    const opener = screen.getByRole("button", { name: "More" });
    opener.focus();
    fireEvent.click(opener);

    expect(opener).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "More" })).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(screen.getByRole("button", { name: "Search" })).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "More" })).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    expect(opener).toHaveAttribute("aria-expanded", "false");
  });
});
