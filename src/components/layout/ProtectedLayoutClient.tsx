"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ModelProvider } from "@/lib/model-context";
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

  const focusSidebarSearch = useCallback(() => {
    setSidebarOpen(true);
    setCollapsed(false);
    setTimeout(() => {
      window.dispatchEvent(new Event("focus-sidebar-search"));
    }, 100);
  }, []);

  // Fix iOS PWA bottom gap: innerHeight excludes ~62px on initial load
  // in standalone mode, but screen.height is always correct (874 vs 812).
  // Use screen.height on mount, innerHeight on resize (corrected by then).
  useEffect(() => {
    const isStandalone = "standalone" in navigator &&
      (navigator as unknown as { standalone: boolean }).standalone;
    document.documentElement.style.setProperty(
      "--app-height",
      `${isStandalone ? screen.height : window.innerHeight}px`
    );
    const onResize = () => {
      document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useKeyboardShortcuts([
    { key: "k", metaKey: true, allowInInput: true, handler: toggleCommandPalette },
    { key: "/", metaKey: true, handler: () => window.dispatchEvent(new Event("toggle-model-selector")) },
    { key: "s", metaKey: true, shiftKey: true, handler: focusSidebarSearch },
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

      <div className="flex-1 flex flex-col min-h-0 relative">
        <main className="flex-1 flex flex-col min-h-0 pb-[calc(60px+env(safe-area-inset-bottom,0px))] md:pb-0">
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
    <ModelProvider>
      <FocusTimerProvider>
        <ToastProvider>
          <CommandPaletteProvider>
            <LayoutInner>{children}</LayoutInner>
          </CommandPaletteProvider>
        </ToastProvider>
      </FocusTimerProvider>
    </ModelProvider>
  );
}
