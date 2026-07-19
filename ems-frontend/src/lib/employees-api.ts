import { apiFetch } from "@/lib/api";
import {
  EmployeePublic,
  PaginatedResponse,
  Status,
} from "@/types";

export type EmployeeListParams = {
  search?: string;
  department?: string;
  roleId?: string;
  status?: Status | "";
  sortBy?: "joiningDate" | "fullName";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
};

export async function listEmployees(
  params: EmployeeListParams = {}
): Promise<PaginatedResponse<EmployeePublic>> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.department) qs.set("department", params.department);
  if (params.roleId) qs.set("roleId", params.roleId);
  if (params.status) qs.set("status", params.status);
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.includeDeleted) qs.set("includeDeleted", "true");

  const query = qs.toString();
  return apiFetch(`/api/employees${query ? `?${query}` : ""}`);
}

export async function getEmployee(
  id: string
): Promise<{ data: EmployeePublic }> {
  return apiFetch(`/api/employees/${id}`);
}

export async function createEmployee(
  body: Record<string, unknown>
): Promise<{ data: EmployeePublic }> {
  return apiFetch("/api/employees", { method: "POST", body });
}

export async function updateEmployee(
  id: string,
  body: Record<string, unknown>
): Promise<{ data: EmployeePublic }> {
  return apiFetch(`/api/employees/${id}`, { method: "PUT", body });
}

export async function deleteEmployee(id: string): Promise<{ message: string }> {
  return apiFetch(`/api/employees/${id}`, { method: "DELETE" });
}

export async function restoreEmployee(
  id: string
): Promise<{ data: EmployeePublic }> {
  return apiFetch(`/api/employees/${id}/restore`, { method: "POST" });
}

export type EmployeeImportResult = {
  successCount: number;
  failedCount: number;
  failedRows: { row: number; errors: Record<string, string> }[];
  created: EmployeePublic[];
};

export async function importEmployeesCsv(
  file: File
): Promise<{ data: EmployeeImportResult }> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch("/api/employees/import", {
    method: "POST",
    body: form,
  });
}
