"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { OrgTreeNode, Status } from "@/types";
import { StatusBadge } from "@/components/employees/status-badge";
import { cn } from "@/lib/utils";

export function OrgTreeNodeRow({
  node,
  depth = 0,
  defaultOpen = false,
}: {
  node: OrgTreeNode;
  depth?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || depth === 0);
  const hasChildren = node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className={cn(
          "group flex items-center gap-2 rounded-lg py-2 pr-2 transition-colors hover:bg-muted/60",
          depth > 0 && "border-l border-border/60"
        )}
        style={{ marginLeft: depth * 20, paddingLeft: 12 }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={open ? "Collapse" : "Expand"}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/employees/${node.id}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {node.fullName}
            </Link>
            <span className="font-mono text-xs text-muted-foreground">
              {node.employeeCode}
            </span>
            {node.status === Status.INACTIVE && (
              <StatusBadge status={node.status} />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {node.designation} · {node.departmentName}
          </p>
        </div>

        {node.directReportCount > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Users className="size-3" />
            {node.directReportCount}
          </span>
        )}
      </div>

      {open &&
        hasChildren &&
        node.children.map((child) => (
          <OrgTreeNodeRow key={child.id} node={child} depth={depth + 1} />
        ))}
    </div>
  );
}
