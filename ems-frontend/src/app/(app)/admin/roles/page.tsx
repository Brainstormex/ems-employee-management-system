"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  updateRole,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import type { PermissionCatalogItem } from "@/types";
import { AccessRole, PERMISSIONS } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RoleFormState = {
  name: string;
  description: string;
  permissionKeys: string[];
};

const emptyForm: RoleFormState = {
  name: "",
  description: "",
  permissionKeys: [],
};

function AdminRolesContent() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AccessRole | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<RoleFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<AccessRole | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: listRoles,
  });

  const permissionsQuery = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: listPermissions,
  });

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionCatalogItem[]>();
    for (const p of permissionsQuery.data?.data ?? []) {
      const list = groups.get(p.group) ?? [];
      list.push(p);
      groups.set(p.group, list);
    }
    return Array.from(groups.entries());
  }, [permissionsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) {
        throw new Error("Name is required");
      }
      if (form.permissionKeys.length === 0) {
        throw new Error("Select at least one permission");
      }
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        permissionKeys: form.permissionKeys,
      };
      if (editing) {
        return updateRole(editing.id, body);
      }
      return createRole(body);
    },
    onSuccess: () => {
      toast.success(editing ? "Role updated" : "Role created");
      setCreating(false);
      setEditing(null);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Save failed"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      toast.success("Role deleted");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Delete failed");
    },
  });

  function openCreate() {
    setEditing(null);
    setCreating(true);
    setForm(emptyForm);
  }

  function openEdit(role: AccessRole) {
    if (role.isSystem) {
      toast.error("System roles cannot be modified");
      return;
    }
    setCreating(false);
    setEditing(role);
    setForm({
      name: role.name,
      description: role.description ?? "",
      permissionKeys: [...role.permissionKeys],
    });
  }

  function togglePermission(key: string) {
    setForm((prev) => ({
      ...prev,
      permissionKeys: prev.permissionKeys.includes(key)
        ? prev.permissionKeys.filter((k) => k !== key)
        : [...prev.permissionKeys, key],
    }));
  }

  const showForm = creating || Boolean(editing);
  const roles = rolesQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin roles</h1>
          <p className="text-sm text-muted-foreground">
            Create custom roles and assign permission keys.
          </p>
        </div>
        <Button type="button" onClick={openCreate} className="gap-1.5">
          <Plus className="size-4" />
          New role
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editing ? `Edit ${editing.name}` : "Create role"}
            </CardTitle>
            <CardDescription>
              System roles are read-only. Custom roles can be edited or deleted
              when unused.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="role-name">Name</Label>
                <Input
                  id="role-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Payroll Clerk"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="role-description">Description</Label>
                <Textarea
                  id="role-description"
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Optional summary of this role"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Permissions</Label>
              {permissionsQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {groupedPermissions.map(([group, items]) => (
                    <div
                      key={group}
                      className="space-y-2 rounded-lg border border-border p-3"
                    >
                      <p className="text-sm font-medium">{group}</p>
                      <div className="space-y-2">
                        {items.map((p) => (
                          <label
                            key={p.key}
                            className="flex cursor-pointer items-start gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              className="mt-1 size-4 rounded border border-input"
                              checked={form.permissionKeys.includes(p.key)}
                              onChange={() => togglePermission(p.key)}
                            />
                            <span>
                              <span className="font-medium">{p.name}</span>
                              <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                                {p.key}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {editing ? "Save changes" : "Create role"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Roles</CardTitle>
          <CardDescription>
            {roles.length} role{roles.length === 1 ? "" : "s"} configured
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden border-t border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Slug</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Permissions
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolesQuery.isLoading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}

                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{role.name}</span>
                        {role.isSystem && (
                          <Badge variant="secondary">System</Badge>
                        )}
                      </div>
                      {role.description && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {role.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell">
                      {role.slug}
                    </TableCell>
                    <TableCell>{role.userCount}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {role.permissionKeys.length} keys
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={role.isSystem}
                          onClick={() => openEdit(role)}
                        >
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={role.isSystem || role.userCount > 0}
                          onClick={() => setDeleteTarget(role)}
                        >
                          <Trash2 className="size-4" />
                          Delete
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

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name}” will be permanently removed. This cannot be undone.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminRolesPage() {
  return (
    <ProtectedRoute permissions={[PERMISSIONS.ROLES_MANAGE]}>
      <AdminRolesContent />
    </ProtectedRoute>
  );
}
