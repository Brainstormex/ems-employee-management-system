import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error";
import {
  AdminUserQueryInput,
  CreateRoleInput,
  UpdateRoleInput,
  UpdateUserAdminInput,
} from "../schemas/employee.schema";
import {
  assertNotLastPrivilegedUser,
  extractPermissionKeys,
  roleInclude,
  serializeRoleSummary,
  slugifyRoleName,
} from "../services/rbac.service";

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, "Authentication required");
  return req.user;
}

function serializeAdminUser(user: {
  id: string;
  email: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  employeeId: string | null;
  role: {
    id: string;
    slug: string;
    name: string;
    isSystem: boolean;
    permissions: { permission: { key: string } }[];
  };
  employee: {
    id: string;
    fullName: string;
    employeeCode: string;
    designation: string;
    deletedAt: Date | null;
  } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    employeeId: user.employeeId,
    role: serializeRoleSummary(user.role),
    permissions: extractPermissionKeys(user.role),
    employee: user.employee
      ? {
          id: user.employee.id,
          fullName: user.employee.fullName,
          employeeCode: user.employee.employeeCode,
          designation: user.employee.designation,
          deletedAt: user.employee.deletedAt?.toISOString() ?? null,
        }
      : null,
  };
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  requireUser(req);
  const query = req.query as unknown as AdminUserQueryInput;

  const where = {
    ...(query.roleId ? { roleId: query.roleId } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: "insensitive" as const } },
            {
              employee: {
                fullName: { contains: query.search, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: {
        role: { include: roleInclude },
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            designation: true,
            deletedAt: true,
          },
        },
      },
      orderBy: { email: "asc" },
      skip,
      take: limit,
    }),
  ]);

  res.json({
    data: users.map((user) => serializeAdminUser(user)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  });
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const { id } = req.params;
  const body = req.body as UpdateUserAdminInput;

  if (body.roleId === undefined && body.isActive === undefined) {
    throw new AppError(400, "Provide roleId and/or isActive");
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    include: { role: { include: roleInclude } },
  });
  if (!existing) throw new AppError(404, "User not found");

  if (body.isActive === false && existing.id === actor.id) {
    throw new AppError(400, "You cannot disable your own account");
  }

  const nextIsActive = body.isActive ?? existing.isActive;
  const nextRoleId = body.roleId ?? existing.roleId;

  await assertNotLastPrivilegedUser(id, nextIsActive, nextRoleId);

  if (body.roleId && body.roleId !== existing.roleId) {
    const role = await prisma.accessRole.findUnique({ where: { id: body.roleId } });
    if (!role) {
      throw new AppError(400, "Role not found", { roleId: "Role not found" });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        ...(body.roleId !== undefined ? { roleId: body.roleId } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
      include: {
        role: { include: roleInclude },
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            designation: true,
            deletedAt: true,
          },
        },
      },
    });

    if (body.isActive === false) {
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return user;
  });

  res.json({ data: serializeAdminUser(updated) });
}

export async function listPermissions(
  req: Request,
  res: Response
): Promise<void> {
  requireUser(req);
  const permissions = await prisma.permission.findMany({
    orderBy: [{ groupName: "asc" }, { name: "asc" }],
  });
  res.json({
    data: permissions.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
      group: p.groupName,
    })),
  });
}

export async function listRoles(req: Request, res: Response): Promise<void> {
  requireUser(req);
  const roles = await prisma.accessRole.findMany({
    include: {
      permissions: roleInclude.permissions,
      _count: { select: { users: true } },
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  res.json({
    data: roles.map((role) => ({
      ...serializeRoleSummary(role),
      description: role.description,
      permissionKeys: extractPermissionKeys(role),
      userCount: role._count.users,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    })),
  });
}

export async function createRole(req: Request, res: Response): Promise<void> {
  requireUser(req);
  const body = req.body as CreateRoleInput;
  const slug = slugifyRoleName(body.name);
  if (!slug) {
    throw new AppError(400, "Invalid role name", { name: "Invalid role name" });
  }

  const existing = await prisma.accessRole.findFirst({
    where: { OR: [{ slug }, { name: body.name.trim() }] },
  });
  if (existing) {
    throw new AppError(400, "A role with this name already exists", {
      name: "A role with this name already exists",
    });
  }

  const permissions = await prisma.permission.findMany({
    where: { key: { in: body.permissionKeys } },
  });
  if (permissions.length !== body.permissionKeys.length) {
    throw new AppError(400, "One or more permissions are invalid", {
      permissionKeys: "One or more permissions are invalid",
    });
  }

  const role = await prisma.accessRole.create({
    data: {
      slug,
      name: body.name.trim(),
      description: body.description ?? null,
      isSystem: false,
      permissions: {
        create: permissions.map((p) => ({ permissionId: p.id })),
      },
    },
    include: {
      permissions: roleInclude.permissions,
      _count: { select: { users: true } },
    },
  });

  res.status(201).json({
    data: {
      ...serializeRoleSummary(role),
      description: role.description,
      permissionKeys: extractPermissionKeys(role),
      userCount: role._count.users,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    },
  });
}

export async function updateRole(req: Request, res: Response): Promise<void> {
  requireUser(req);
  const { id } = req.params;
  const body = req.body as UpdateRoleInput;

  const existing = await prisma.accessRole.findUnique({
    where: { id },
    include: roleInclude,
  });
  if (!existing) throw new AppError(404, "Role not found");
  if (existing.isSystem) {
    throw new AppError(400, "System roles cannot be modified");
  }

  if (body.name) {
    const slug = slugifyRoleName(body.name);
    const clash = await prisma.accessRole.findFirst({
      where: {
        id: { not: id },
        OR: [{ slug }, { name: body.name.trim() }],
      },
    });
    if (clash) {
      throw new AppError(400, "A role with this name already exists", {
        name: "A role with this name already exists",
      });
    }
  }

  let permissionIds: string[] | undefined;
  if (body.permissionKeys) {
    const permissions = await prisma.permission.findMany({
      where: { key: { in: body.permissionKeys } },
    });
    if (permissions.length !== body.permissionKeys.length) {
      throw new AppError(400, "One or more permissions are invalid", {
        permissionKeys: "One or more permissions are invalid",
      });
    }
    permissionIds = permissions.map((p) => p.id);
  }

  const role = await prisma.$transaction(async (tx) => {
    if (permissionIds) {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: id,
          permissionId,
        })),
      });
    }

    return tx.accessRole.update({
      where: { id },
      data: {
        ...(body.name
          ? { name: body.name.trim(), slug: slugifyRoleName(body.name) }
          : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
      },
      include: {
        permissions: roleInclude.permissions,
        _count: { select: { users: true } },
      },
    });
  });

  res.json({
    data: {
      ...serializeRoleSummary(role),
      description: role.description,
      permissionKeys: extractPermissionKeys(role),
      userCount: role._count.users,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    },
  });
}

export async function deleteRole(req: Request, res: Response): Promise<void> {
  requireUser(req);
  const { id } = req.params;

  const existing = await prisma.accessRole.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) throw new AppError(404, "Role not found");
  if (existing.isSystem) {
    throw new AppError(400, "System roles cannot be deleted");
  }
  if (existing._count.users > 0) {
    throw new AppError(400, "Cannot delete a role that is still assigned to users");
  }

  await prisma.accessRole.delete({ where: { id } });
  res.json({ message: "Role deleted" });
}
