"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FocusTimerProvider } from "@/lib/focus-timer-context";
import { ToastProvider } from "@/lib/toast-context";
import { CommandPaletteProvider, useCommandPalette } from "@/lib/command-palette-context";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

const ToastContainer = dynamic(
  () => import("@/components/shared/Toast").then((m) => m.ToastContainer),
  { ssr: false }
);

const Sidebar = dynamic(() => import("./Sidebar").then((m) => m.Sidebar), {
  ssr: false,
});

const CommandPalette = dynamic(
  () => import("@/components/shared/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false }
);

const BottomNav = dynamic(() => import("./BottomNav").then((m) => m.BottomNav), { ssr: false });

function LayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { toggle: toggleCommandPalette } = useCommandPalette();

  useEffect(() => {
    const updateAppHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${height}px`);
    };

    updateAppHeight();
    window.addEventListener("resize", updateAppHeight);
    window.addEventListener("pageshow", updateAppHeight);
    window.visualViewport?.addEventListener("resize", updateAppHeight);

    return () => {
      window.removeEventListener("resize", updateAppHeight);
      window.removeEventListener("pageshow", updateAppHeight);
      window.visualViewport?.removeEventListener("resize", updateAppHeight);
    };
  }, []);

  useKeyboardShortcuts([
    { key: "k", metaKey: true, allowInInput: true, handler: toggleCommandPalette },
    {
      key: "Escape",
      handler: () => {
        if (sidebarOpen) setSidebarOpen(false);
      },
    },
  ]);

  return (
    <div data-app-shell className="flex w-full overflow-hidden relative" style={{ background: "var(--bg-base)", height: "var(--app-height, 100dvh)" }}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />

      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        {/*
          Safe-area insets live here, not in page components: `viewportFit:
          "cover"` lets content run under the Dynamic Island / home indicator,
          and every page needs the same treatment. Reserving the top inset once
          keeps headers clear of the camera cutout on notched devices; on
          desktop `env()` is 0 and the `md:` resets keep the box flush.
        */}
        <main className="flex-1 flex flex-col min-h-0 pt-[env(safe-area-inset-top,0px)] md:pt-0 pb-[calc(60px+env(safe-area-inset-bottom,0px))] md:pb-0">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>

      <BottomNav />

      <ToastContainer />
      <CommandPalette />
    </div>
  );
}

export function ProtectedLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FocusTimerProvider>
      <ToastProvider>
        <CommandPaletteProvider>
          <LayoutInner>{children}</LayoutInner>
        </CommandPaletteProvider>
      </ToastProvider>
    </FocusTimerProvider>
  );
}
