import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error";
import { Status } from "../types";
import { PERMISSIONS } from "../lib/permissions";
import { AssignManagerInput } from "../schemas/employee.schema";
import {
  assertNoCircularReporting,
  employeeInclude,
  serializeEmployee,
} from "../services/employee.service";
import { buildOrgTree } from "../services/organization.service";
import { userHasPermission } from "../services/rbac.service";

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, "Authentication required");
  return req.user;
}

/** GET /api/organization/tree */
export async function getOrganizationTree(
  req: Request,
  res: Response
): Promise<void> {
  requireUser(req);

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      designation: true,
      status: true,
      reportingManagerId: true,
      department: { select: { name: true } },
    },
    orderBy: { fullName: "asc" },
  });

  const tree = buildOrgTree(
    employees.map((e) => ({
      id: e.id,
      employeeCode: e.employeeCode,
      fullName: e.fullName,
      designation: e.designation,
      status: e.status as Status,
      reportingManagerId: e.reportingManagerId,
      departmentName: e.department.name,
    }))
  );

  res.json({
    data: tree,
    meta: { employeeCount: employees.length, rootCount: tree.length },
  });
}

/** GET /api/employees/:id/reportees — direct reports only */
export async function getReportees(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params;

  const employee = await prisma.employee.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, fullName: true },
  });

  if (!employee) {
    throw new AppError(404, "Employee not found");
  }

  const canReadAll = userHasPermission(user, PERMISSIONS.EMPLOYEES_READ_ALL);
  if (!canReadAll && user.employeeId !== id) {
    throw new AppError(403, "You can only view your own direct reports");
  }

  const reportees = await prisma.employee.findMany({
    where: { reportingManagerId: id, deletedAt: null },
    include: employeeInclude,
    orderBy: { fullName: "asc" },
  });

  res.json({
    data: reportees.map(serializeEmployee),
    meta: {
      managerId: id,
      managerName: employee.fullName,
      count: reportees.length,
    },
  });
}

/** PATCH /api/employees/:id/manager */
export async function assignManager(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { reportingManagerId } = req.body as AssignManagerInput;

  const employee = await prisma.employee.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });

  if (!employee) {
    throw new AppError(404, "Employee not found");
  }

  await assertNoCircularReporting(id, reportingManagerId);

  const updated = await prisma.employee.update({
    where: { id },
    data: { reportingManagerId },
    include: employeeInclude,
  });

  res.json({ data: serializeEmployee(updated) });
}
