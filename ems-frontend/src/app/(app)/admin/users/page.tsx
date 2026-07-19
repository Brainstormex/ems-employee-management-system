"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  listAdminUsers,
  listRoles,
  updateAdminUser,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { PERMISSIONS, roleLabel } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const selectClass =
  "flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function AdminUsersContent() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState("");
  const [isActive, setIsActive] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = useMemo(
    () => ({
      search: search || undefined,
      roleId: roleId || undefined,
      isActive:
        isActive === "" ? undefined : isActive === "true",
      page,
      limit,
    }),
    [search, roleId, isActive, page]
  );

  const rolesQuery = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: listRoles,
  });

  const usersQuery = useQuery({
    queryKey: ["admin", "users", params],
    queryFn: () => listAdminUsers(params),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { roleId?: string; isActive?: boolean };
    }) => updateAdminUser(id, body),
    onSuccess: () => {
      toast.success("User updated");
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Update failed");
    },
  });

  const data = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta;
  const roles = rolesQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin users</h1>
        <p className="text-sm text-muted-foreground">
          Assign roles and enable or disable login accounts.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search email or name…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select
          className={selectClass}
          value={roleId}
          onChange={(e) => {
            setRoleId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={isActive}
          onChange={(e) => {
            setIsActive(e.target.value as "" | "true" | "false");
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Disabled</option>
        </select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Accounts</CardTitle>
          <CardDescription>
            Role changes take effect on the user’s next request.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden border-t border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden md:table-cell">Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersQuery.isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}

                {!usersQuery.isLoading && data.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No users match your filters.
                    </TableCell>
                  </TableRow>
                )}

                {data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{u.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.lastLoginAt
                            ? `Last login ${new Date(u.lastLoginAt).toLocaleString()}`
                            : "Never logged in"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {u.employee ? (
                        <div>
                          <p className="text-sm">{u.employee.fullName}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {u.employee.employeeCode}
                          </p>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <select
                        className={selectClass}
                        value={u.role.id}
                        disabled={updateMutation.isPending}
                        onChange={(e) => {
                          const nextRoleId = e.target.value;
                          if (nextRoleId === u.role.id) return;
                          updateMutation.mutate({
                            id: u.id,
                            body: { roleId: nextRoleId },
                          });
                        }}
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                        {!roles.some((r) => r.id === u.role.id) && (
                          <option value={u.role.id}>
                            {roleLabel(u.role)}
                          </option>
                        )}
                      </select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={u.isActive ? "secondary" : "outline"}>
                          {u.isActive ? "Active" : "Disabled"}
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={updateMutation.isPending}
                          onClick={() =>
                            updateMutation.mutate({
                              id: u.id,
                              body: { isActive: !u.isActive },
                            })
                          }
                        >
                          {u.isActive ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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

export default function AdminUsersPage() {
  return (
    <ProtectedRoute permissions={[PERMISSIONS.USERS_MANAGE]}>
      <AdminUsersContent />
    </ProtectedRoute>
  );
}
