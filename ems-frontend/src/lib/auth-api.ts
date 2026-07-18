import { apiFetch } from "@/lib/api";
import { AuthUser } from "@/types";
import { LoginInput } from "@/schemas/auth.schema";

export async function login(input: LoginInput): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: input,
    skipRefresh: true,
  });
}

export async function logout(): Promise<void> {
  await apiFetch<{ message: string }>("/api/auth/logout", {
    method: "POST",
    skipRefresh: true,
  });
}

export async function fetchMe(): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>("/api/auth/me", {
    skipRefresh: false,
  });
}

export async function refreshSession(): Promise<void> {
  await apiFetch<{ message: string }>("/api/auth/refresh", {
    method: "POST",
    skipRefresh: true,
  });
}
