"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { Role } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

type ProtectedProps = {
  children: React.ReactNode;
  roles?: Role[];
  redirectTo?: string;
};

/**
 * Client-side role gate. Middleware already ensures a session cookie exists.
 * Backend remains the source of truth for authorization.
 */
export function ProtectedRoute({
  children,
  roles,
  redirectTo = "/dashboard",
}: ProtectedProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (roles && user && !roles.includes(user.role)) {
      router.replace(redirectTo);
    }
  }, [isLoading, isAuthenticated, user, roles, redirectTo, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (roles && user && !roles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
