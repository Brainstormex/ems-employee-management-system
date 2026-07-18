"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { listEmployees, EmployeeListParams } from "@/lib/employees-api";
import { listDepartments } from "@/lib/departments-api";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Role,
  Status,
  canManageEmployees,
  roleLabel,
} from "@/types";
import { StatusBadge } from "@/components/employees/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const selectClass =
  "flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function EmployeesList() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [status, setStatus] = useState<Status | "">("");
  const [sortBy, setSortBy] = useState<"fullName" | "joiningDate">("fullName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params: EmployeeListParams = useMemo(
    () => ({
      search: search || undefined,
      department: department || undefined,
      role: role || undefined,
      status: status || undefined,
      sortBy,
      sortOrder,
      page,
      limit,
    }),
    [search, department, role, status, sortBy, sortOrder, page]
  );

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
  });

  const employeesQuery = useQuery({
    queryKey: ["employees", params],
    queryFn: () => listEmployees(params),
  });

  const canManage = user ? canManageEmployees(user.role) : false;
  const data = employeesQuery.data?.data ?? [];
  const meta = employeesQuery.data?.meta;

  function toggleSort(column: "fullName" | "joiningDate") {
    if (sortBy === column) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            Search, filter, and manage people records.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/employees/import"
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              Import CSV
            </Link>
            <Link
              href="/employees/new"
              className={cn(buttonVariants(), "gap-1.5")}
            >
              <Plus className="size-4" />
              Add employee
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select
          className={selectClass}
          value={department}
          onChange={(e) => {
            setDepartment(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All departments</option>
          {(departmentsQuery.data?.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={role}
          onChange={(e) => {
            setRole(e.target.value as Role | "");
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          {Object.values(Role).map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as Status | "");
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value={Status.ACTIVE}>Active</option>
          <option value={Status.INACTIVE}>Inactive</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => toggleSort("fullName")}
                >
                  Name
                  {sortBy === "fullName" &&
                    (sortOrder === "asc" ? (
                      <ArrowUpAZ className="size-3.5" />
                    ) : (
                      <ArrowDownAZ className="size-3.5" />
                    ))}
                </button>
              </TableHead>
              <TableHead className="hidden md:table-cell">Department</TableHead>
              <TableHead className="hidden lg:table-cell">Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => toggleSort("joiningDate")}
                >
                  Joined
                  {sortBy === "joiningDate" &&
                    (sortOrder === "asc" ? (
                      <ArrowUpAZ className="size-3.5" />
                    ) : (
                      <ArrowDownAZ className="size-3.5" />
                    ))}
                </button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employeesQuery.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!employeesQuery.isLoading && data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-muted-foreground"
                >
                  No employees match your filters.
                </TableCell>
              </TableRow>
            )}

            {data.map((emp) => (
              <TableRow key={emp.id}>
                <TableCell className="font-mono text-xs">
                  {emp.employeeCode}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{emp.fullName}</p>
                    <p className="text-xs text-muted-foreground">{emp.email}</p>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {emp.department?.name ?? "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {emp.role ? roleLabel(emp.role) : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={emp.status} />
                </TableCell>
                <TableCell className="hidden sm:table-cell tabular-nums">
                  {emp.joiningDate}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/employees/${emp.id}`}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" })
                    )}
                  >
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            Page {meta.page} of {meta.totalPages} · {meta.total} total
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
