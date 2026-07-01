import { useCallback, useEffect, useRef, useState } from "react";
import type { UndoAction } from "@/lib/org-chart/types";

const DEFAULT_HISTORY_LIMIT = 5;

interface UseUndoStackArgs {
  onUndo: (action: UndoAction) => void;
  onRedo: (action: UndoAction) => void;
  onUndoStatus: (action: UndoAction) => string;
  onRedoStatus: (action: UndoAction) => string;
  historyLimit?: number;
}

function pushLimited<T>(items: T[], item: T, limit: number) {
  return [...items, item].slice(-limit);
}

function isTextEditingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName?.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    element.isContentEditable
  );
}

export function useUndoStack({
  onUndo,
  onRedo,
  onUndoStatus,
  onRedoStatus,
  historyLimit = DEFAULT_HISTORY_LIMIT,
}: UseUndoStackArgs) {
  const [undoToast, setUndoToast] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setUndoToast(message);
    toastTimerRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 3000);
  }, []);

  const reset = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setUndoToast(null);
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  const showUndoToast = useCallback((action: UndoAction) => {
    setUndoStack(prev => pushLimited(prev, action, historyLimit));
    setRedoStack([]);
    showToast(action.message);
  }, [historyLimit, showToast]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    onUndo(action);
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack(prev => pushLimited(prev, action, historyLimit));
    showToast(onUndoStatus(action));
  }, [undoStack, onUndo, onUndoStatus, historyLimit, showToast]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    onRedo(action);
    setRedoStack(redoStack.slice(0, -1));
    setUndoStack(prev => pushLimited(prev, action, historyLimit));
    showToast(onRedoStatus(action));
  }, [redoStack, onRedo, onRedoStatus, historyLimit, showToast]);

  useEffect(() => {
    if (undoStack.length === 0 && redoStack.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const actualTarget = (e.composedPath?.()[0] ?? e.target) as EventTarget | null;
      if (isTextEditingTarget(actualTarget)) return;

      const modifier = e.ctrlKey || e.metaKey;
      if (!modifier || e.altKey) return;

      const key = e.key.toLowerCase();
      const wantsUndo = key === "z" && !e.shiftKey;
      const wantsRedo = key === "y" || (key === "z" && e.shiftKey);
      if (!wantsUndo && !wantsRedo) return;

      e.preventDefault();
      if (wantsUndo) handleUndo();
      else handleRedo();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoStack.length, redoStack.length, handleUndo, handleRedo]);

  return {
    undoToast,
    undoStack,
    redoStack,
    showUndoToast,
    handleUndo,
    handleRedo,
    reset,
  };
}
