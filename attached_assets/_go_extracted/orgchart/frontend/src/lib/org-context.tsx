import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useListOrganizations } from "@workspace/api-client-react";

interface OrgContextType {
  selectedOrgId: number | null;
  setSelectedOrgId: (id: number | null) => void;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children }: { children: ReactNode }) {
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = window.localStorage.getItem("orgchart_selected_org");
    if (!saved) return null;
    const parsed = parseInt(saved, 10);
    return Number.isFinite(parsed) ? parsed : null;
  });

  // Save to localStorage when it changes
  useEffect(() => {
    if (selectedOrgId) {
      localStorage.setItem("orgchart_selected_org", selectedOrgId.toString());
    } else {
      localStorage.removeItem("orgchart_selected_org");
    }
  }, [selectedOrgId]);

  return (
    <OrgContext.Provider value={{ selectedOrgId, setSelectedOrgId }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (context === undefined) {
    throw new Error("useOrg must be used within an OrgProvider");
  }
  return context;
}
