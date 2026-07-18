import { OrgTreeNode, Status } from "../types";

export type FlatOrgEmployee = {
  id: string;
  employeeCode: string;
  fullName: string;
  designation: string;
  status: Status;
  reportingManagerId: string | null;
  departmentName: string;
};

/**
 * Assemble a nested org tree from a flat employee list (single query → in-memory).
 * Employees whose manager is missing/soft-deleted become roots.
 */
export function buildOrgTree(employees: FlatOrgEmployee[]): OrgTreeNode[] {
  const nodes = new Map<string, OrgTreeNode>();

  for (const emp of employees) {
    nodes.set(emp.id, {
      id: emp.id,
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      designation: emp.designation,
      departmentName: emp.departmentName,
      status: emp.status,
      directReportCount: 0,
      children: [],
    });
  }

  const roots: OrgTreeNode[] = [];

  for (const emp of employees) {
    const node = nodes.get(emp.id)!;
    const parentId = emp.reportingManagerId;

    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRecursive = (list: OrgTreeNode[]) => {
    list.sort((a, b) => a.fullName.localeCompare(b.fullName));
    for (const n of list) {
      sortRecursive(n.children);
      n.directReportCount = n.children.length;
    }
  };

  sortRecursive(roots);
  return roots;
}
