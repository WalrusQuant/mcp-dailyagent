import { useEffect, useRef } from "react";

interface Shortcut {
  key: string;
  metaKey?: boolean;
  shiftKey?: boolean;
  allowInInput?: boolean;
  handler: () => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      for (const shortcut of shortcutsRef.current) {
        // Allow Escape and explicitly opted-in shortcuts in inputs, skip others
        if (isInput && shortcut.key !== "Escape" && !shortcut.allowInInput) continue;

        const needsMeta = !!shortcut.metaKey;
        const needsShift = !!shortcut.shiftKey;
        const hasMeta = e.metaKey || e.ctrlKey;

        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          needsMeta === hasMeta &&
          needsShift === e.shiftKey
        ) {
          e.preventDefault();
          shortcut.handler();
          return;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
