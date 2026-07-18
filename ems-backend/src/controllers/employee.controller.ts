import { Prisma } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error";
import { Role, Status } from "../types";
import {
  CreateEmployeeInput,
  EmployeeQueryInput,
  EmployeeSelfUpdateInput,
  UpdateEmployeeInput,
} from "../schemas/employee.schema";
import {
  assertDepartmentExists,
  assertEmailAvailable,
  assertNoCircularReporting,
  employeeInclude,
  serializeEmployee,
} from "../services/employee.service";
import {
  createEmployeeRecord,
  importEmployeesFromCsv,
} from "../services/employee-import.service";

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, "Authentication required");
  return req.user;
}

export async function listEmployees(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const query = req.query as unknown as EmployeeQueryInput;

  // EMPLOYEE: only their own record
  if (user.role === Role.EMPLOYEE) {
    if (!user.employeeId) {
      res.json({ data: [], meta: { page: 1, limit: query.limit, total: 0, totalPages: 0 } });
      return;
    }
    const employee = await prisma.employee.findFirst({
      where: { id: user.employeeId, deletedAt: null },
      include: employeeInclude,
    });
    const data = employee ? [serializeEmployee(employee)] : [];
    res.json({
      data,
      meta: { page: 1, limit: 1, total: data.length, totalPages: data.length },
    });
    return;
  }

  const includeDeleted =
    query.includeDeleted === true && user.role === Role.SUPER_ADMIN;

  const where: Prisma.EmployeeWhereInput = {
    ...(includeDeleted ? {} : { deletedAt: null }),
    ...(query.department ? { departmentId: query.department } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.role ? { user: { role: query.role } } : {}),
    ...(query.search
      ? {
          OR: [
            { fullName: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
            { employeeCode: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const orderBy: Prisma.EmployeeOrderByWithRelationInput =
    query.sortBy === "joiningDate"
      ? { joiningDate: query.sortOrder }
      : { fullName: query.sortOrder };

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: employeeInclude,
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  res.json({
    data: employees.map(serializeEmployee),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  });
}

export async function getEmployee(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: employeeInclude,
  });

  if (!employee) {
    throw new AppError(404, "Employee not found");
  }

  if (employee.deletedAt && user.role !== Role.SUPER_ADMIN) {
    throw new AppError(404, "Employee not found");
  }

  if (user.role === Role.EMPLOYEE && user.employeeId !== employee.id) {
    throw new AppError(403, "You can only view your own profile");
  }

  res.json({ data: serializeEmployee(employee) });
}

export async function createEmployee(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const body = req.body as CreateEmployeeInput;
  const employee = await createEmployeeRecord(body, user.role);
  res.status(201).json({ data: employee });
}

export async function importEmployees(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const file = req.file;

  if (!file?.buffer?.length) {
    throw new AppError(400, "CSV file is required (field name: file)");
  }

  const result = await importEmployeesFromCsv(file.buffer, user.role);
  res.status(200).json({ data: result });
}

export async function updateEmployee(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params;

  const existing = await prisma.employee.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!existing || (existing.deletedAt && user.role !== Role.SUPER_ADMIN)) {
    throw new AppError(404, "Employee not found");
  }

  // --- EMPLOYEE: own profile, whitelist only ---
  if (user.role === Role.EMPLOYEE) {
    if (user.employeeId !== id) {
      throw new AppError(403, "You can only edit your own profile");
    }

    const allowed = req.body as EmployeeSelfUpdateInput;
    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...(allowed.phone !== undefined ? { phone: allowed.phone } : {}),
        ...(allowed.profileImageUrl !== undefined
          ? { profileImageUrl: allowed.profileImageUrl }
          : {}),
      },
      include: employeeInclude,
    });

    res.json({ data: serializeEmployee(updated) });
    return;
  }

  // --- HR / SUPER_ADMIN ---
  const body = req.body as UpdateEmployeeInput;

  // Reject disallowed fields that slipped through (defense in depth for EMPLOYEE already handled)
  if (body.role === Role.SUPER_ADMIN && user.role !== Role.SUPER_ADMIN) {
    throw new AppError(403, "Only Super Admins can assign the SUPER_ADMIN role", {
      role: "Only Super Admins can assign the SUPER_ADMIN role",
    });
  }

  // HR cannot change an existing SUPER_ADMIN's role
  if (
    user.role === Role.HR_MANAGER &&
    existing.user?.role === Role.SUPER_ADMIN &&
    body.role !== undefined &&
    body.role !== Role.SUPER_ADMIN
  ) {
    throw new AppError(403, "HR Managers cannot change a Super Admin's role", {
      role: "HR Managers cannot change a Super Admin's role",
    });
  }

  if (body.email && body.email !== existing.email) {
    await assertEmailAvailable(body.email, id);
  }

  if (body.departmentId) {
    await assertDepartmentExists(body.departmentId);
  }

  if (body.reportingManagerId !== undefined) {
    await assertNoCircularReporting(id, body.reportingManagerId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id },
      data: {
        ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.departmentId !== undefined
          ? { departmentId: body.departmentId }
          : {}),
        ...(body.designation !== undefined ? { designation: body.designation } : {}),
        ...(body.salary !== undefined ? { salary: body.salary } : {}),
        ...(body.joiningDate !== undefined
          ? { joiningDate: new Date(body.joiningDate) }
          : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.profileImageUrl !== undefined
          ? { profileImageUrl: body.profileImageUrl }
          : {}),
        ...(body.reportingManagerId !== undefined
          ? { reportingManagerId: body.reportingManagerId }
          : {}),
      },
    });

    if (existing.user) {
      const userUpdate: Prisma.UserUpdateInput = {};
      if (body.email !== undefined) userUpdate.email = body.email;
      if (body.role !== undefined && user.role === Role.SUPER_ADMIN) {
        userUpdate.role = body.role;
      } else if (
        body.role !== undefined &&
        user.role === Role.HR_MANAGER &&
        body.role !== Role.SUPER_ADMIN
      ) {
        userUpdate.role = body.role;
      }

      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({
          where: { id: existing.user.id },
          data: userUpdate,
        });
      }
    }

    return tx.employee.findUniqueOrThrow({
      where: { id },
      include: employeeInclude,
    });
  });

  res.json({ data: serializeEmployee(updated) });
}

export async function softDeleteEmployee(
  req: Request,
  res: Response
): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params;

  if (user.role !== Role.SUPER_ADMIN) {
    throw new AppError(403, "Only Super Admins can delete employees");
  }

  const existing = await prisma.employee.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!existing || existing.deletedAt) {
    throw new AppError(404, "Employee not found");
  }

  if (existing.user?.id === user.id) {
    throw new AppError(400, "You cannot delete your own account");
  }

  await prisma.$transaction(async (tx) => {
    // Unassign direct reports (do not silently orphan)
    await tx.employee.updateMany({
      where: { reportingManagerId: id, deletedAt: null },
      data: { reportingManagerId: null },
    });

    await tx.employee.update({
      where: { id },
      data: { deletedAt: new Date(), status: Status.INACTIVE },
    });

    if (existing.user) {
      await tx.user.update({
        where: { id: existing.user.id },
        data: { isActive: false },
      });
      await tx.refreshToken.updateMany({
        where: { userId: existing.user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  });

  res.json({ message: "Employee soft-deleted successfully" });
}

export async function restoreEmployee(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params;

  if (user.role !== Role.SUPER_ADMIN) {
    throw new AppError(403, "Only Super Admins can restore employees");
  }

  const existing = await prisma.employee.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!existing || !existing.deletedAt) {
    throw new AppError(404, "Deleted employee not found");
  }

  const restored = await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id },
      data: { deletedAt: null, status: Status.ACTIVE },
    });

    if (existing.user) {
      await tx.user.update({
        where: { id: existing.user.id },
        data: { isActive: true },
      });
    }

    return tx.employee.findUniqueOrThrow({
      where: { id },
      include: employeeInclude,
    });
  });

  res.json({ data: serializeEmployee(restored) });
}
