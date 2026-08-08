"use client";

import { useState, useEffect } from "react";
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

  // Keep --app-height in sync with the usable layout viewport.
  // Do NOT use screen.height: on iOS PWA it is taller than the visible
  // area, so an absolute bottom bar floated above a gap (or sat clipped)
  // until a full relaunch resettled the measure. BottomNav is fixed now,
  // but the shell still needs a correct height for scroll regions.
  useEffect(() => {
    const setAppHeight = () => {
      const height = Math.round(window.innerHeight);
      if (height > 0) {
        document.documentElement.style.setProperty("--app-height", `${height}px`);
      }
    };

    setAppHeight();
    // iOS often reports a transitional height on first paint / resume.
    const t1 = window.setTimeout(setAppHeight, 50);
    const t2 = window.setTimeout(setAppHeight, 350);

    window.addEventListener("resize", setAppHeight);
    window.addEventListener("orientationchange", setAppHeight);
    // bfcache restore (swipe-back / relaunch from switcher)
    window.addEventListener("pageshow", setAppHeight);
    window.visualViewport?.addEventListener("resize", setAppHeight);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", setAppHeight);
      window.removeEventListener("orientationchange", setAppHeight);
      window.removeEventListener("pageshow", setAppHeight);
      window.visualViewport?.removeEventListener("resize", setAppHeight);
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
    <div className="flex w-full overflow-hidden relative" style={{ background: "var(--bg-base)", height: "var(--app-height, 100dvh)" }}>
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
