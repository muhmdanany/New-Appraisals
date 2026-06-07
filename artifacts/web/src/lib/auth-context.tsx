import { createContext, useContext, ReactNode } from "react";
import { useGetMe, getGetMeQueryKey, CurrentUser } from "@workspace/api-client-react";

interface AuthContextType {
  user: CurrentUser | null | undefined;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: undefined,
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });

  return (
    <AuthContext.Provider value={{ user: isError ? null : user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}