"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

type ProtectedProps = {
  children: React.ReactNode;
  /** Require all listed permission keys. Preferred over roles. */
  permissions?: string[];
  /** Require any of these role slugs (e.g. "super-admin"). */
  roles?: string[];
  redirectTo?: string;
};

/**
 * Client-side permission/role gate. Middleware already ensures a session cookie exists.
 * Backend remains the source of truth for authorization.
 */
export function ProtectedRoute({
  children,
  permissions,
  roles,
  redirectTo = "/dashboard",
}: ProtectedProps) {
  const { user, isLoading, isAuthenticated, hasPermission, hasRole } = useAuth();
  const router = useRouter();

  const allowedByPermissions =
    !permissions || permissions.length === 0 || hasPermission(...permissions);
  const allowedByRoles = !roles || roles.length === 0 || hasRole(...roles);
  const allowed = allowedByPermissions && allowedByRoles;

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (!allowed) {
      router.replace(redirectTo);
    }
  }, [isLoading, isAuthenticated, allowed, redirectTo, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!allowed || !user) {
    return null;
  }

  return <>{children}</>;
}
