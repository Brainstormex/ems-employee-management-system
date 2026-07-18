"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  createEmployeeSchema,
  CreateEmployeeFormValues,
  toCreatePayload,
  toUpdatePayload,
} from "@/schemas/employee.schema";
import { Role, Status, EmployeePublic, DepartmentPublic, roleLabel } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyApiFieldErrors } from "@/lib/form-errors";
import { ApiError } from "@/lib/api";

type Props = {
  mode: "create" | "edit";
  departments: DepartmentPublic[];
  managers: EmployeePublic[];
  currentRole: Role;
  initial?: EmployeePublic;
  onSubmitCreate?: (payload: Record<string, unknown>) => Promise<void>;
  onSubmitUpdate?: (payload: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
};

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

export function EmployeeForm({
  mode,
  departments,
  managers,
  currentRole,
  initial,
  onSubmitCreate,
  onSubmitUpdate,
  onCancel,
}: Props) {
  const isCreate = mode === "create";
  const canAssignSuperAdmin = currentRole === Role.SUPER_ADMIN;
  const canEditRole =
    currentRole === Role.SUPER_ADMIN || currentRole === Role.HR_MANAGER;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateEmployeeFormValues>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      fullName: initial?.fullName ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      departmentId: initial?.departmentId ?? departments[0]?.id ?? "",
      designation: initial?.designation ?? "",
      salary: initial?.salary ?? 50000,
      joiningDate:
        initial?.joiningDate?.slice(0, 10) ??
        new Date().toISOString().slice(0, 10),
      status: initial?.status ?? Status.ACTIVE,
      role: (initial?.role as Role) ?? Role.EMPLOYEE,
      reportingManagerId: initial?.reportingManagerId ?? "",
      profileImageUrl: initial?.profileImageUrl ?? "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (!canAssignSuperAdmin && values.role === Role.SUPER_ADMIN) {
        setError("role", {
          message: "Only Super Admins can assign the SUPER_ADMIN role",
        });
        return;
      }

      if (isCreate) {
        await onSubmitCreate?.(toCreatePayload(values));
      } else {
        await onSubmitUpdate?.(toUpdatePayload(values));
      }
    } catch (err) {
      if (
        err instanceof Error &&
        !(err instanceof ApiError) &&
        err.message.includes("URL")
      ) {
        setError("profileImageUrl", { message: err.message });
        return;
      }
      applyApiFieldErrors(err, setError);
    }
  });

  const roleOptions = [
    Role.EMPLOYEE,
    Role.HR_MANAGER,
    ...(canAssignSuperAdmin ? [Role.SUPER_ADMIN] : []),
  ];

  const managerOptions = managers.filter((m) => m.id !== initial?.id);

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={errors.fullName?.message}>
          <Input
            {...register("fullName")}
            aria-invalid={Boolean(errors.fullName)}
          />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input
            type="email"
            {...register("email")}
            aria-invalid={Boolean(errors.email)}
          />
        </Field>
        <Field label="Phone (E.164)" error={errors.phone?.message}>
          <Input
            placeholder="+14155552671"
            {...register("phone")}
            aria-invalid={Boolean(errors.phone)}
          />
        </Field>
        <Field label="Designation" error={errors.designation?.message}>
          <Input
            {...register("designation")}
            aria-invalid={Boolean(errors.designation)}
          />
        </Field>
        <Field label="Department" error={errors.departmentId?.message}>
          <select className={selectClass} {...register("departmentId")}>
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Salary" error={errors.salary?.message}>
          <Input
            type="number"
            step="0.01"
            {...register("salary", { valueAsNumber: true })}
            aria-invalid={Boolean(errors.salary)}
          />
        </Field>
        <Field label="Joining date" error={errors.joiningDate?.message}>
          <Input type="date" {...register("joiningDate")} />
        </Field>
        <Field label="Status" error={errors.status?.message}>
          <select className={selectClass} {...register("status")}>
            <option value={Status.ACTIVE}>Active</option>
            <option value={Status.INACTIVE}>Inactive</option>
          </select>
        </Field>
        {canEditRole && (
          <Field label="Role" error={errors.role?.message}>
            <select className={selectClass} {...register("role")}>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field
          label="Reporting manager"
          error={errors.reportingManagerId?.message}
        >
          <select className={selectClass} {...register("reportingManagerId")}>
            <option value="">No manager</option>
            {managerOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName} ({m.employeeCode})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Profile image URL" error={errors.profileImageUrl?.message}>
          <Input
            placeholder="https://…"
            {...register("profileImageUrl")}
            aria-invalid={Boolean(errors.profileImageUrl)}
          />
        </Field>
        {isCreate && (
          <Field label="Temp password (optional)" error={errors.password?.message}>
            <Input
              type="password"
              placeholder="Defaults if empty"
              {...register("password")}
            />
          </Field>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : isCreate ? (
            "Create employee"
          ) : (
            "Save changes"
          )}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
