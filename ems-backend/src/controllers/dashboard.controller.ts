import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error";
import { DashboardStats } from "../types";

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, "Authentication required");
  return req.user;
}

type HiresByMonthRow = {
  month: Date;
  count: number;
};

/**
 * GET /api/dashboard/stats
 * Core cards via COUNT aggregates; chart series via GROUP BY (not JS row counting).
 */
export async function getDashboardStats(
  req: Request,
  res: Response
): Promise<void> {
  requireUser(req);

  const notDeleted = { deletedAt: null };

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setUTCDate(1);
  twelveMonthsAgo.setUTCHours(0, 0, 0, 0);
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 11);

  const [
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    departmentCount,
    byDepartment,
    byStatus,
    hiresRaw,
  ] = await Promise.all([
    prisma.employee.count({ where: notDeleted }),
    prisma.employee.count({
      where: { ...notDeleted, status: "ACTIVE" },
    }),
    prisma.employee.count({
      where: { ...notDeleted, status: "INACTIVE" },
    }),
    prisma.department.count(),
    prisma.employee.groupBy({
      by: ["departmentId"],
      where: notDeleted,
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ["status"],
      where: notDeleted,
      _count: { _all: true },
    }),
    prisma.$queryRaw<HiresByMonthRow[]>`
      SELECT date_trunc('month', "joiningDate") AS month,
             COUNT(*)::int AS count
      FROM employees
      WHERE "deletedAt" IS NULL
        AND "joiningDate" >= ${twelveMonthsAgo}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ]);

  const departmentIds = byDepartment.map((d) => d.departmentId);
  const departments = departmentIds.length
    ? await prisma.department.findMany({
        where: { id: { in: departmentIds } },
        select: { id: true, name: true },
      })
    : [];
  const deptNameById = new Map(departments.map((d) => [d.id, d.name]));

  const stats: DashboardStats = {
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    departmentCount,
  };

  // Fill missing months with 0 for a stable 12-point chart series
  const hiresByMonth: { month: string; count: number }[] = [];
  const countByMonthKey = new Map<string, number>();
  for (const row of hiresRaw) {
    const key = toYearMonth(row.month);
    countByMonthKey.set(key, Number(row.count));
  }

  for (let i = 0; i < 12; i++) {
    const d = new Date(twelveMonthsAgo);
    d.setUTCMonth(twelveMonthsAgo.getUTCMonth() + i);
    const key = toYearMonth(d);
    hiresByMonth.push({ month: key, count: countByMonthKey.get(key) ?? 0 });
  }

  res.json({
    data: {
      ...stats,
      charts: {
        employeesPerDepartment: byDepartment
          .map((row) => ({
            departmentId: row.departmentId,
            departmentName: deptNameById.get(row.departmentId) ?? "Unknown",
            count: row._count._all,
          }))
          .sort((a, b) => a.departmentName.localeCompare(b.departmentName)),
        employeesByStatus: byStatus.map((row) => ({
          status: row.status,
          count: row._count._all,
        })),
        hiresPerMonth: hiresByMonth,
      },
    },
  });
}

function toYearMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
