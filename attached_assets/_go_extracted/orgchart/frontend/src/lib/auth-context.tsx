import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";

interface UserRole {
  id: number;
  name: string;
  organizationId: number;
}

interface OrgPermission {
  organizationId: number;
  resource: string;
  action: string;
}

interface AuthUser {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  isSystemAdmin?: boolean;
  roles: UserRole[];
  permissions: OrgPermission[];
  mustEnable2FA?: boolean;
  mustChangePassword?: boolean;
}

interface RolePermission {
  id: number;
  resource: string;
  action: string;
}

interface RoleWithPermissions {
  id: number;
  name: string;
  permissions: RolePermission[];
}

interface UserWithRoles {
  id: number;
  roles: { id: number }[];
}

interface LoginResult {
  success: boolean;
  error?: string;
  requires2FA?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verify2FA: (code: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (resource: string, action: string) => boolean;
  activeOrgId: number | null;
  setActiveOrgId: (orgId: number | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeOrgId, setActiveOrgId] = useState<number | null>(null);

  const orgPermissions = useMemo(() => {
    if (!user?.permissions || !activeOrgId) return new Set<string>();
    const set = new Set<string>();
    for (const p of user.permissions) {
      if (p.organizationId === activeOrgId) {
        set.add(`${p.resource}:${p.action}`);
      }
    }
    return set;
  }, [user, activeOrgId]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
      if (res.ok) {
        const userData: AuthUser = await res.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data: AuthUser & { requires2FA?: boolean } = await res.json();
        if (data.requires2FA) {
          return { success: false, requires2FA: true };
        }
        setUser(data);
        setIsLoading(false);
        return { success: true };
      }

      const data: { message?: string } = await res.json();
      return { success: false, error: data.message || "Login failed" };
    } catch {
      return { success: false, error: "Network error" };
    }
  }, []);

  const verify2FA = useCallback(async (code: string): Promise<LoginResult> => {
    try {
      const res = await fetch(`${API_BASE}/auth/verify-2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        const userData: AuthUser = await res.json();
        setUser(userData);
        setIsLoading(false);
        return { success: true };
      }

      const data: { message?: string } = await res.json();
      return { success: false, error: data.message || "Invalid code" };
    } catch {
      return { success: false, error: "Network error" };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }, []);

  const hasPermission = useCallback((resource: string, action: string) => {
    return orgPermissions.has(`${resource}:${action}`);
  }, [orgPermissions]);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      verify2FA,
      logout,
      refreshUser,
      hasPermission,
      activeOrgId,
      setActiveOrgId,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
