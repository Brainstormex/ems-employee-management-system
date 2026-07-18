"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { StatCards } from "@/components/dashboard/stat-cards";
import { roleLabel, canManageEmployees } from "@/types";
import { getDashboardStats } from "@/lib/dashboard-api";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  const statsQuery = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: getDashboardStats,
    enabled: Boolean(user),
  });

  if (!user) return null;

  const name = user.employee?.fullName || user.fullName || user.email;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {name}.
          </p>
        </div>
        <Badge variant="secondary">{roleLabel(user.role)}</Badge>
      </div>

      {statsQuery.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {statsQuery.isError && (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load dashboard</CardTitle>
            <CardDescription>
              Check that the backend is running and try refreshing the page.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {statsQuery.data && (
        <>
          <StatCards stats={statsQuery.data.data} />
          <DashboardCharts stats={statsQuery.data.data} />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick links</CardTitle>
          <CardDescription>Jump to common actions</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/employees" className={cn(buttonVariants())}>
            Employees
          </Link>
          <Link
            href="/organization"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Organization
          </Link>
          <Link
            href="/profile"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            My profile
          </Link>
          {canManageEmployees(user.role) && (
            <Link
              href="/employees/new"
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              Add employee
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
