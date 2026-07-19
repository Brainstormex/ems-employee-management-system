"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { fetchMe, login as loginRequest, logout as logoutRequest } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import { AuthUser } from "@/types";
import { LoginInput } from "@/schemas/auth.schema";

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Check role by slug (e.g. "super-admin", "hr-manager", "employee"). */
  hasRole: (...slugs: string[]) => boolean;
  /** Require all listed permission keys. */
  hasPermission: (...keys: string[]) => boolean;
  /** Require any of the listed permission keys. */
  hasAnyPermission: (...keys: string[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        const res = await fetchMe();
        return res.user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Clear stale cookies so middleware does not redirect-loop.
          try {
            await logoutRequest();
          } catch {
            // ignore logout failures when session is already invalid
          }
          return null;
        }
        throw err;
      }
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.clear();
      router.replace("/login");
    },
  });

  const login = useCallback(
    async (input: LoginInput) => {
      await loginMutation.mutateAsync(input);
      router.replace("/dashboard");
    },
    [loginMutation, router]
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const hasRole = useCallback(
    (...slugs: string[]) => {
      if (!meQuery.data) return false;
      return slugs.includes(meQuery.data.role.slug);
    },
    [meQuery.data]
  );

  const hasPermission = useCallback(
    (...keys: string[]) => {
      if (!meQuery.data || keys.length === 0) return false;
      return keys.every((key) => meQuery.data!.permissions.includes(key));
    },
    [meQuery.data]
  );

  const hasAnyPermission = useCallback(
    (...keys: string[]) => {
      if (!meQuery.data || keys.length === 0) return false;
      return keys.some((key) => meQuery.data!.permissions.includes(key));
    },
    [meQuery.data]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isLoading: meQuery.isLoading,
      isAuthenticated: Boolean(meQuery.data),
      login,
      logout,
      hasRole,
      hasPermission,
      hasAnyPermission,
    }),
    [
      meQuery.data,
      meQuery.isLoading,
      login,
      logout,
      hasRole,
      hasPermission,
      hasAnyPermission,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
