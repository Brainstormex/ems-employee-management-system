"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { getReportees } from "@/lib/organization-api";
import { useAuth } from "@/components/providers/auth-provider";
import { StatusBadge } from "@/components/employees/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MyTeam() {
  const { user } = useAuth();
  const employeeId = user?.employeeId;

  const reporteesQuery = useQuery({
    queryKey: ["employees", employeeId, "reportees"],
    queryFn: () => getReportees(employeeId!),
    enabled: Boolean(employeeId),
  });

  if (!employeeId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" />
          My team
        </CardTitle>
        <CardDescription>Your direct reports</CardDescription>
      </CardHeader>
      <CardContent>
        {reporteesQuery.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {!reporteesQuery.isLoading && reporteesQuery.data?.data.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You have no direct reports assigned.
          </p>
        )}

        {reporteesQuery.data && reporteesQuery.data.data.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {reporteesQuery.data.data.map((emp) => (
              <li
                key={emp.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <div>
                  <p className="font-medium">{emp.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {emp.designation} · {emp.department?.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={emp.status} />
                  <Link
                    href={`/employees/${emp.id}`}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                  >
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
