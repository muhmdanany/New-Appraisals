import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";

interface PresentationModeContextValue {
  active: boolean;
  setActive: (next: boolean) => void;
}

const PresentationModeContext = createContext<PresentationModeContextValue | null>(null);

export function PresentationModeProvider({ children }: { children: ReactNode }) {
  const [active, setActiveState] = useState(false);
  const setActive = useCallback((next: boolean) => setActiveState(next), []);
  const value = useMemo(() => ({ active, setActive }), [active, setActive]);
  return (
    <PresentationModeContext.Provider value={value}>
      {children}
    </PresentationModeContext.Provider>
  );
}

export function usePresentationMode() {
  const ctx = useContext(PresentationModeContext);
  if (!ctx) {
    throw new Error("usePresentationMode must be used within PresentationModeProvider");
  }
  return ctx;
}
