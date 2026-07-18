"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { EmployeeForm } from "@/components/employees/employee-form";
import { useAuth } from "@/components/providers/auth-provider";
import { listDepartments } from "@/lib/departments-api";
import { createEmployee, listEmployees } from "@/lib/employees-api";
import { Role } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function NewEmployeeContent() {
  const router = useRouter();
  const { user } = useAuth();

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
  });

  const managersQuery = useQuery({
    queryKey: ["employees", "managers-options"],
    queryFn: () =>
      listEmployees({ limit: 100, sortBy: "fullName", sortOrder: "asc" }),
  });

  if (!user || departmentsQuery.isLoading || managersQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New employee</h1>
        <p className="text-sm text-muted-foreground">
          Creates an employee record and linked login user.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employee details</CardTitle>
          <CardDescription>
            Required fields are validated on both client and server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeForm
            mode="create"
            currentRole={user.role}
            departments={departmentsQuery.data?.data ?? []}
            managers={managersQuery.data?.data ?? []}
            onCancel={() => router.push("/employees")}
            onSubmitCreate={async (payload) => {
              const res = await createEmployee(payload);
              toast.success("Employee created");
              router.push(`/employees/${res.data.id}`);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewEmployeePage() {
  return (
    <ProtectedRoute roles={[Role.SUPER_ADMIN, Role.HR_MANAGER]}>
      <NewEmployeeContent />
    </ProtectedRoute>
  );
}
