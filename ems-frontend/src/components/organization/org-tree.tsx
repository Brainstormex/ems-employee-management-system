"use client";

import { useQuery } from "@tanstack/react-query";
import { getOrganizationTree } from "@/lib/organization-api";
import { OrgTreeNodeRow } from "@/components/organization/org-tree-node";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function OrgTree() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["organization", "tree"],
    queryFn: getOrganizationTree,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unable to load hierarchy</CardTitle>
          <CardDescription>
            Check that the backend is running and you are signed in.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const roots = data.data;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {data.meta.employeeCount} employees · {data.meta.rootCount} top-level
        {data.meta.rootCount === 1 ? " root" : " roots"}
      </p>

      {roots.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No employees in the hierarchy.
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-card p-3">
          {roots.map((node) => (
            <OrgTreeNodeRow key={node.id} node={node} defaultOpen />
          ))}
        </div>
      )}
    </div>
  );
}
