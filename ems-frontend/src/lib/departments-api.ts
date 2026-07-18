import { apiFetch } from "@/lib/api";
import { DepartmentPublic } from "@/types";

export async function listDepartments(): Promise<{ data: DepartmentPublic[] }> {
  return apiFetch("/api/departments");
}
