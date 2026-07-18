"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import {
  employeeSelfUpdateSchema,
  EmployeeSelfUpdateFormValues,
  toSelfUpdatePayload,
} from "@/schemas/employee.schema";
import { getEmployee, updateEmployee } from "@/lib/employees-api";
import { roleLabel } from "@/types";
import { applyApiFieldErrors } from "@/lib/form-errors";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const employeeId = user?.employeeId;

  const employeeQuery = useQuery({
    queryKey: ["employees", employeeId],
    queryFn: () => getEmployee(employeeId!),
    enabled: Boolean(employeeId),
  });

  const form = useForm<EmployeeSelfUpdateFormValues>({
    resolver: zodResolver(employeeSelfUpdateSchema),
    values: {
      phone: employeeQuery.data?.data.phone ?? "",
      profileImageUrl: employeeQuery.data?.data.profileImageUrl ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      updateEmployee(employeeId!, payload),
    onSuccess: () => {
      toast.success("Profile updated");
      void queryClient.invalidateQueries({ queryKey: ["employees", employeeId] });
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });

  if (!user) return null;

  if (!employeeId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No employee profile</CardTitle>
          <CardDescription>
            Your user account is not linked to an employee record.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (employeeQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const emp = employeeQuery.data?.data;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My profile</h1>
        <p className="text-sm text-muted-foreground">
          Employees can update phone and profile image only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {emp?.fullName || user.email}
          </CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Role" value={<Badge variant="secondary">{roleLabel(user.role)}</Badge>} />
          {emp?.employeeCode && <Row label="Employee ID" value={emp.employeeCode} />}
          {emp?.designation && <Row label="Designation" value={emp.designation} />}
          {emp?.department?.name && (
            <Row label="Department" value={emp.department.name} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Editable fields</CardTitle>
          <CardDescription>
            Salary, role, department, and manager are locked for your role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            noValidate
            onSubmit={form.handleSubmit(async (values) => {
              try {
                const payload = toSelfUpdatePayload(values);
                await mutation.mutateAsync(payload);
              } catch (err) {
                if (
                  err instanceof Error &&
                  !(err instanceof ApiError) &&
                  err.message.includes("URL")
                ) {
                  form.setError("profileImageUrl", { message: err.message });
                  return;
                }
                const msg = applyApiFieldErrors(err, form.setError);
                if (msg) toast.error(msg);
              }
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (E.164)</Label>
              <Input id="phone" {...form.register("phone")} />
              {form.formState.errors.phone && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileImageUrl">Profile image URL</Label>
              <Input
                id="profileImageUrl"
                placeholder="https://…"
                {...form.register("profileImageUrl")}
              />
              {form.formState.errors.profileImageUrl && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.profileImageUrl.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save profile"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
