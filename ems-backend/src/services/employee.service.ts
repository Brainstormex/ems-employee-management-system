import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error";

const employeeInclude = {
  department: { select: { id: true, name: true } },
  reportingManager: {
    select: { id: true, fullName: true, employeeCode: true, designation: true },
  },
  user: {
    select: {
      id: true,
      isActive: true,
      role: {
        select: { id: true, slug: true, name: true, isSystem: true },
      },
    },
  },
  _count: { select: { directReports: { where: { deletedAt: null } } } },
} satisfies Prisma.EmployeeInclude;

export type EmployeeWithRelations = Prisma.EmployeeGetPayload<{
  include: typeof employeeInclude;
}>;

export function serializeEmployee(employee: EmployeeWithRelations) {
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    email: employee.email,
    phone: employee.phone,
    departmentId: employee.departmentId,
    department: employee.department,
    designation: employee.designation,
    salary: Number(employee.salary),
    joiningDate: employee.joiningDate.toISOString().slice(0, 10),
    status: employee.status,
    profileImageUrl: employee.profileImageUrl,
    reportingManagerId: employee.reportingManagerId,
    reportingManager: employee.reportingManager,
    role: employee.user?.role
      ? {
          id: employee.user.role.id,
          slug: employee.user.role.slug,
          name: employee.user.role.name,
          isSystem: employee.user.role.isSystem,
        }
      : null,
    roleId: employee.user?.role?.id ?? null,
    userId: employee.user?.id ?? null,
    isUserActive: employee.user?.isActive ?? null,
    directReportCount: employee._count.directReports,
    deletedAt: employee.deletedAt?.toISOString() ?? null,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}

export { employeeInclude };

/** Next human-readable code: EMP-0001, EMP-0002, ... */
export async function generateEmployeeCode(
  tx: Prisma.TransactionClient = prisma
): Promise<string> {
  const employees = await tx.employee.findMany({
    select: { employeeCode: true },
  });

  let max = 0;
  for (const emp of employees) {
    const match = /^EMP-(\d+)$/.exec(emp.employeeCode);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }

  return `EMP-${String(max + 1).padStart(4, "0")}`;
}

/** Ensure the proposed manager exists and is not soft-deleted. */
export async function assertManagerExists(
  managerId: string | null | undefined
): Promise<void> {
  if (!managerId) return;

  const manager = await prisma.employee.findFirst({
    where: { id: managerId, deletedAt: null },
    select: { id: true },
  });

  if (!manager) {
    throw new AppError(400, "Reporting manager not found or has been deleted", {
      reportingManagerId: "Reporting manager not found or has been deleted",
    });
  }
}

/**
 * Walk up the proposed manager's chain. Reject if `employeeId` appears
 * (would create a cycle) or if manager is the employee themselves.
 */
export async function assertNoCircularReporting(
  employeeId: string,
  managerId: string | null | undefined
): Promise<void> {
  if (!managerId) return;

  if (managerId === employeeId) {
    throw new AppError(400, "An employee cannot be their own reporting manager", {
      reportingManagerId: "An employee cannot be their own reporting manager",
    });
  }

  await assertManagerExists(managerId);

  let currentId: string | null = managerId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === employeeId) {
      throw new AppError(
        400,
        "Circular reporting detected: this assignment would create a cycle",
        { reportingManagerId: "Circular reporting detected" }
      );
    }
    if (visited.has(currentId)) {
      throw new AppError(400, "Circular reporting detected in existing hierarchy", {
        reportingManagerId: "Circular reporting detected",
      });
    }
    visited.add(currentId);

    const current: { reportingManagerId: string | null } | null =
      await prisma.employee.findUnique({
        where: { id: currentId },
        select: { reportingManagerId: true },
      });

    currentId = current?.reportingManagerId ?? null;
  }
}

export async function assertDepartmentExists(departmentId: string): Promise<void> {
  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept) {
    throw new AppError(400, "Department not found", {
      departmentId: "Department not found",
    });
  }
}

export async function assertEmailAvailable(
  email: string,
  excludeEmployeeId?: string
): Promise<void> {
  const existing = await prisma.employee.findUnique({ where: { email } });
  if (existing && existing.id !== excludeEmployeeId) {
    throw new AppError(400, "Email already in use", {
      email: "Email already in use",
    });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser && existingUser.employeeId !== excludeEmployeeId) {
    throw new AppError(400, "Email already in use", {
      email: "Email already in use",
    });
  }
}
