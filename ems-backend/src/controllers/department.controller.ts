import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error";

export async function listDepartments(_req: Request, res: Response): Promise<void> {
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      _count: {
        select: { employees: { where: { deletedAt: null } } },
      },
    },
  });

  res.json({
    data: departments.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      employeeCount: d._count.employees,
    })),
  });
}

export async function getDepartment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const department = await prisma.department.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      _count: {
        select: { employees: { where: { deletedAt: null } } },
      },
    },
  });

  if (!department) {
    throw new AppError(404, "Department not found");
  }

  res.json({
    data: {
      id: department.id,
      name: department.name,
      description: department.description,
      employeeCount: department._count.employees,
    },
  });
}
