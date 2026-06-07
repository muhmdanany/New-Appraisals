import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

/**
 * Contributor note:
 * When you add a new global keybinding anywhere in the app, also add a matching
 * entry to the SHORTCUTS array below AND to `shortcuts.entries.*` in both
 * `src/i18n/en.ts` and `src/i18n/ar.ts`. This registry is the single source of
 * truth rendered in the keyboard shortcuts help dialog (press "?"), so any
 * undocumented shortcut is effectively invisible to users.
 */

export type ShortcutCategory = "navigation" | "editing" | "chart" | "export";

export interface ShortcutEntry {
  id: string;
  keys: string[];
  descriptionKey: string;
  category: ShortcutCategory;
}

export const SHORTCUTS: ShortcutEntry[] = [
  {
    id: "open-command-palette",
    keys: ["Ctrl/⌘", "K"],
    descriptionKey: "shortcuts.entries.openCommandPalette",
    category: "navigation",
  },
  {
    id: "open-shortcuts",
    keys: ["Shift", "/"],
    descriptionKey: "shortcuts.entries.openShortcuts",
    category: "navigation",
  },
  {
    id: "close-dialog",
    keys: ["Esc"],
    descriptionKey: "shortcuts.entries.closeDialog",
    category: "navigation",
  },
  {
    id: "undo-history",
    keys: ["Ctrl", "Z"],
    descriptionKey: "shortcuts.entries.undoHistory",
    category: "editing",
  },
  {
    id: "redo-history",
    keys: ["Ctrl", "Y"],
    descriptionKey: "shortcuts.entries.redoHistory",
    category: "editing",
  },
  {
    id: "expand-collapse-toggle",
    keys: ["Enter"],
    descriptionKey: "shortcuts.entries.toggleNode",
    category: "chart",
  },
  {
    id: "expand-collapse-space",
    keys: ["Space"],
    descriptionKey: "shortcuts.entries.toggleNode",
    category: "chart",
  },
  {
    id: "reorder-sibling-left",
    keys: ["Alt", "←"],
    descriptionKey: "shortcuts.entries.reorderSiblingPrev",
    category: "editing",
  },
  {
    id: "reorder-sibling-right",
    keys: ["Alt", "→"],
    descriptionKey: "shortcuts.entries.reorderSiblingNext",
    category: "editing",
  },
  {
    id: "presentation-mode",
    keys: ["P"],
    descriptionKey: "shortcuts.entries.presentationMode",
    category: "chart",
  },
  {
    id: "presentation-follow",
    keys: ["F"],
    descriptionKey: "shortcuts.entries.presentationFollow",
    category: "chart",
  },
  {
    id: "presentation-nav",
    keys: ["↑", "↓", "←", "→"],
    descriptionKey: "shortcuts.entries.presentationNav",
    category: "chart",
  },
  {
    id: "export-hint",
    keys: ["—"],
    descriptionKey: "shortcuts.entries.exportHint",
    category: "export",
  },
];

export const SHORTCUT_CATEGORY_ORDER: ShortcutCategory[] = [
  "navigation",
  "editing",
  "chart",
  "export",
];

interface KeyboardShortcutsContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null);

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const value = useMemo(() => ({ isOpen, open, close, toggle }), [isOpen, open, close, toggle]);

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const ctx = useContext(KeyboardShortcutsContext);
  if (!ctx) {
    throw new Error("useKeyboardShortcuts must be used within KeyboardShortcutsProvider");
  }
  return ctx;
}
