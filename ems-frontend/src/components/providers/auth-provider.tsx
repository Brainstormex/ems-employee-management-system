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
import { AuthUser, Role } from "@/types";
import { LoginInput } from "@/schemas/auth.schema";

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
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
    (...roles: Role[]) => {
      if (!meQuery.data) return false;
      return roles.includes(meQuery.data.role);
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
    }),
    [meQuery.data, meQuery.isLoading, login, logout, hasRole]
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
