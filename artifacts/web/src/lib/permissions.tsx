import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIdentity } from "@/lib/identity";

// ---------- Types ----------

export type Action = "view" | "create" | "edit" | "delete";
export type Resource =
  | "dashboard"
  | "jobs"
  | "competencies"
  | "grades"
  | "career-paths"
  | "employees"
  | "kpis"
  | "evaluations"
  | "reports"
  | "bell-curve"
  | "org-chart"
  | "admin";

export type PermissionMatrix = Record<string, Record<string, string[]>>;

// ---------- Fetch helper ----------

function getHeaders(): Record<string, string> {
  const uid =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("selectedUserId")
      : null;
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (uid) h["X-User-Id"] = uid;
  return h;
}

async function fetchPermissions(): Promise<PermissionMatrix> {
  const res = await fetch("/api/settings/permissions", { headers: getHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------- Context ----------

type PermsCtx = {
  matrix: PermissionMatrix;
  isLoading: boolean;
};

const PermissionsContext = createContext<PermsCtx>({
  matrix: {},
  isLoading: true,
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["permissions"],
    queryFn: fetchPermissions,
    staleTime: 60_000,
  });

  return (
    <PermissionsContext.Provider value={{ matrix: data ?? {}, isLoading }}>
      {children}
    </PermissionsContext.Provider>
  );
}

// ---------- Hooks ----------

/** Check if the current user has a specific permission. */
export function usePermission(resource: Resource | string, action: Action): boolean {
  const { matrix } = useContext(PermissionsContext);
  const { user } = useIdentity();
  if (!user) return false;
  const role = user.role;
  const rolePerms = matrix[role];
  if (!rolePerms) return false;
  const actions = rolePerms[resource];
  if (!actions) return false;
  return actions.includes(action);
}

/** Shortcut: can the current user view a resource? */
export function useCanView(resource: Resource | string): boolean {
  return usePermission(resource, "view");
}

/** Shortcut: can the current user create in a resource? */
export function useCanCreate(resource: Resource | string): boolean {
  return usePermission(resource, "create");
}

/** Shortcut: can the current user edit in a resource? */
export function useCanEdit(resource: Resource | string): boolean {
  return usePermission(resource, "edit");
}

/** Shortcut: can the current user delete in a resource? */
export function useCanDelete(resource: Resource | string): boolean {
  return usePermission(resource, "delete");
}

/** Get the full permissions matrix (for the admin UI). */
export function usePermissions() {
  return useContext(PermissionsContext);
}

/** Hook to invalidate permissions cache after saving. */
export function useInvalidatePermissions() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["permissions"] });
}
