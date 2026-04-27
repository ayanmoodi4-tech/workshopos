import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, createContext, useContext } from "react";
import { UserRole } from "../backend";
import { useBackendActor } from "../lib/api";
import type { AppRole } from "../types";

interface AuthContextValue {
  isAuthenticated: boolean;
  isInitializing: boolean;
  isLoggingIn: boolean;
  login: () => void;
  logout: () => void;
  role: AppRole | null;
  isRoleLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapUserRoleToAppRole(role: UserRole): AppRole | null {
  switch (role) {
    case UserRole.admin:
      return "Admin";
    // backend uses generic "user" role — we treat it as WorkshopManager by default
    // SalesManager mapping is done via custom assignment
    case UserRole.user:
      return "WorkshopManager";
    default:
      return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    isAuthenticated,
    isInitializing,
    isLoggingIn,
    login,
    clear,
    identity,
  } = useInternetIdentity();
  const { actor, isFetching } = useBackendActor();

  const { data: userRole, isLoading: isRoleLoading } = useQuery({
    queryKey: ["userRole", identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor) return null;
      try {
        const role = await actor.getCallerUserRole();
        return role as UserRole;
      } catch {
        return null;
      }
    },
    enabled: !!actor && !isFetching && isAuthenticated,
    staleTime: 60_000,
  });

  const role = userRole ? mapUserRoleToAppRole(userRole) : null;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isInitializing,
        isLoggingIn,
        login,
        logout: clear,
        role,
        isRoleLoading: isRoleLoading || isFetching,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
