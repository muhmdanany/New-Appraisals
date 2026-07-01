import { createContext, useContext, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListUsers, setUserIdGetter, type User } from "@workspace/api-client-react";

const STORAGE_KEY = "selectedUserId";

// Register the identity header getter once at module load so every API request
// carries the selected user id (read synchronously from localStorage).
setUserIdGetter(() =>
  typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
);

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "مدير النظام",
  HR_MANAGER: "مدير الموارد البشرية",
  FIRST_LEVEL_MANAGER: "مدير مباشر",
  SECOND_LEVEL_MANAGER: "مدير أعلى",
  EMPLOYEE: "موظف",
};

type IdentityValue = {
  userId: string | null;
  user: User | null;
  users: User[];
  isLoading: boolean;
  select: (id: string) => void;
  clear: () => void;
};

const IdentityContext = createContext<IdentityValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
  );
  const { data: users = [], isLoading } = useListUsers();
  const user = users.find((u) => u.id === userId) ?? null;

  const select = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setUserId(id);
    // Drop cached data so every query refetches under the new identity.
    qc.clear();
  };

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUserId(null);
    qc.clear();
  };

  return (
    <IdentityContext.Provider value={{ userId, user, users, isLoading, select, clear }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity(): IdentityValue {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentity must be used within IdentityProvider");
  return ctx;
}
