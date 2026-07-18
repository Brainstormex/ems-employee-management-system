import { apiFetch } from "@/lib/api";
import { EmployeePublic, OrgTreeNode } from "@/types";

export async function getOrganizationTree(): Promise<{
  data: OrgTreeNode[];
  meta: { employeeCount: number; rootCount: number };
}> {
  return apiFetch("/api/organization/tree");
}

export async function getReportees(
  employeeId: string
): Promise<{
  data: EmployeePublic[];
  meta: { managerId: string; managerName: string; count: number };
}> {
  return apiFetch(`/api/employees/${employeeId}/reportees`);
}
