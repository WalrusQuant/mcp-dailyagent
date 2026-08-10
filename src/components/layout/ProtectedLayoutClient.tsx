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

type ViewportSnapshot = {
  label: string;
  inner: number;
  visual: number | null;
  visualOffsetTop: number | null;
  document: number;
  screen: number;
  shell: number | null;
  shellBottom: number | null;
  navBottom: number | null;
  standalone: boolean;
};

function ViewportDebug() {
  const [snapshots, setSnapshots] = useState<ViewportSnapshot[]>([]);

  useEffect(() => {
    const measure = (label: string) => {
      const viewport = window.visualViewport;
      const shell = document.querySelector<HTMLElement>("[data-app-shell]");
      const nav = document.querySelector<HTMLElement>("[data-bottom-nav]");
      const shellRect = shell?.getBoundingClientRect();
      const navRect = nav?.getBoundingClientRect();
      const standalone = window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;

      const snapshot: ViewportSnapshot = {
        label,
        inner: Math.round(window.innerHeight),
        visual: viewport ? Math.round(viewport.height) : null,
        visualOffsetTop: viewport ? Math.round(viewport.offsetTop) : null,
        document: document.documentElement.clientHeight,
        screen: window.screen.height,
        shell: shell?.clientHeight ?? null,
        shellBottom: shellRect ? Math.round(shellRect.bottom) : null,
        navBottom: navRect ? Math.round(navRect.bottom) : null,
        standalone,
      };

      setSnapshots((current) => [...current.slice(-7), snapshot]);
    };

    const frame = window.requestAnimationFrame(() => measure("frame"));
    measure("mount");
    const timers = [100, 500, 1500].map((delay) => window.setTimeout(() => measure(`${delay}ms`), delay));
    const onResize = () => measure("resize");
    const onPageShow = () => measure("pageshow");

    window.addEventListener("resize", onResize);
    window.addEventListener("pageshow", onPageShow);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);

    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pageshow", onPageShow);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
    };
  }, []);

  return (
    <div
      data-viewport-debug
      className="fixed top-1 left-1 z-[9999] m-0 max-w-[calc(100vw-0.5rem)] overflow-x-auto rounded bg-black/90 p-2 font-mono text-[9px] leading-tight text-lime-300 pointer-events-none"
    >
      {snapshots.map((snapshot, index) => (
        <div key={`${snapshot.label}-${index}`}>
          {`${snapshot.label} standalone=${snapshot.standalone ? "Y" : "N"} inner=${snapshot.inner} visual=${snapshot.visual ?? "-"} offsetTop=${snapshot.visualOffsetTop ?? "-"} doc=${snapshot.document} screen=${snapshot.screen} shell=${snapshot.shell ?? "-"} shellBottom=${snapshot.shellBottom ?? "-"} navBottom=${snapshot.navBottom ?? "-"}`}
        </div>
      ))}
    </div>
  );
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { toggle: toggleCommandPalette } = useCommandPalette();

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

      <ViewportDebug />

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
