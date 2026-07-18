"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { EmployeeForm } from "@/components/employees/employee-form";
import { StatusBadge } from "@/components/employees/status-badge";
import {
  deleteEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
} from "@/lib/employees-api";
import { listDepartments } from "@/lib/departments-api";
import {
  Role,
  canDeleteEmployees,
  canManageEmployees,
  roleLabel,
} from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const employeeQuery = useQuery({
    queryKey: ["employees", id],
    queryFn: () => getEmployee(id),
    enabled: Boolean(id),
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
    enabled: editing,
  });

  const managersQuery = useQuery({
    queryKey: ["employees", "managers-options"],
    queryFn: () =>
      listEmployees({ limit: 100, sortBy: "fullName", sortOrder: "asc" }),
    enabled: editing,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      updateEmployee(id, payload),
    onSuccess: () => {
      toast.success("Employee updated");
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Update failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEmployee(id),
    onSuccess: () => {
      toast.success("Employee soft-deleted");
      setDeleteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
      router.push("/employees");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Delete failed");
    },
  });

  if (employeeQuery.isLoading || !user) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (employeeQuery.isError || !employeeQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Employee not found</CardTitle>
          <CardDescription>
            You may not have access, or the record was removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/employees" className={cn(buttonVariants())}>
            Back to employees
          </Link>
        </CardContent>
      </Card>
    );
  }

  const emp = employeeQuery.data.data;
  const canEditManagers = canManageEmployees(user.role);
  const isSelfOnly =
    user.role === Role.EMPLOYEE && user.employeeId === emp.id;
  const canDelete = canDeleteEmployees(user.role);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/employees"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Employees
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {emp.fullName}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            {emp.employeeCode}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditManagers && !editing && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
          )}
          {isSelfOnly && (
            <Link
              href="/profile"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Edit on profile
            </Link>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Soft-delete this employee?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be hidden from lists and their login disabled. Direct
              reports will have their manager cleared. You can restore later as
              Super Admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Soft delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editing && canEditManagers ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit employee</CardTitle>
          </CardHeader>
          <CardContent>
            {departmentsQuery.isLoading || managersQuery.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <EmployeeForm
                key={emp.id}
                mode="edit"
                currentRole={user.role}
                initial={emp}
                departments={departmentsQuery.data?.data ?? []}
                managers={managersQuery.data?.data ?? []}
                onCancel={() => setEditing(false)}
                onSubmitUpdate={async (payload) => {
                  await updateMutation.mutateAsync(payload);
                }}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Overview</CardTitle>
            <StatusBadge status={emp.status} />
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Email" value={emp.email} />
            <Info label="Phone" value={emp.phone} />
            <Info label="Department" value={emp.department?.name ?? "—"} />
            <Info label="Designation" value={emp.designation} />
            <Info
              label="Salary"
              value={emp.salary.toLocaleString(undefined, {
                style: "currency",
                currency: "USD",
              })}
            />
            <Info label="Joining date" value={emp.joiningDate} />
            <Info
              label="Role"
              value={
                emp.role ? (
                  <Badge variant="secondary">{roleLabel(emp.role)}</Badge>
                ) : (
                  "—"
                )
              }
            />
            <Info
              label="Reporting manager"
              value={
                emp.reportingManager ? (
                  <Link
                    href={`/employees/${emp.reportingManager.id}`}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {emp.reportingManager.fullName}
                  </Link>
                ) : (
                  "Unassigned"
                )
              }
            />
            <Info
              label="Direct reports"
              value={String(emp.directReportCount ?? 0)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-medium">{value}</div>
    </div>
  );
}
