import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  PermissionKey,
  PRIVILEGED_PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
} from "../lib/permissions";
import { AppError } from "../middleware/error";
import { AuthUser, RoleSummary } from "../types";

export const roleInclude = {
  permissions: {
    include: {
      permission: { select: { key: true, name: true, groupName: true } },
    },
  },
} satisfies Prisma.AccessRoleInclude;

export type RoleWithPermissions = Prisma.AccessRoleGetPayload<{
  include: typeof roleInclude;
}>;

export function serializeRoleSummary(role: {
  id: string;
  slug: string;
  name: string;
  isSystem: boolean;
}): RoleSummary {
  return {
    id: role.id,
    slug: role.slug,
    name: role.name,
    isSystem: role.isSystem,
  };
}

export function extractPermissionKeys(
  role: RoleWithPermissions | { permissions: { permission: { key: string } }[] }
): PermissionKey[] {
  return role.permissions.map((rp) => rp.permission.key as PermissionKey);
}

export async function loadUserAuthContext(
  userId: string
): Promise<(AuthUser & { permissions: PermissionKey[] }) | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: { include: roleInclude },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    employeeId: user.employeeId,
    isActive: user.isActive,
    role: serializeRoleSummary(user.role),
    permissions: extractPermissionKeys(user.role),
  };
}

export function userHasPermission(
  user: { permissions: string[] },
  permission: PermissionKey
): boolean {
  return user.permissions.includes(permission);
}

export async function getRoleById(roleId: string) {
  return prisma.accessRole.findUnique({
    where: { id: roleId },
    include: roleInclude,
  });
}

export async function getRoleBySlug(slug: string) {
  return prisma.accessRole.findUnique({
    where: { slug },
    include: roleInclude,
  });
}

export function slugifyRoleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function assertAssignableRole(
  actor: { permissions: string[]; role: RoleSummary },
  targetRoleId: string
): Promise<void> {
  const role = await getRoleById(targetRoleId);
  if (!role) {
    throw new AppError(400, "Role not found", { roleId: "Role not found" });
  }

  if (
    role.slug === SYSTEM_ROLE_SLUGS.SUPER_ADMIN &&
    !userHasPermission(actor, "users:manage" as PermissionKey)
  ) {
    throw new AppError(403, "Only administrators can assign the Super Admin role", {
      roleId: "Only administrators can assign the Super Admin role",
    });
  }

  if (
    !userHasPermission(actor, "users:manage" as PermissionKey) &&
    role.permissions.some((rp) =>
      PRIVILEGED_PERMISSIONS.includes(rp.permission.key as PermissionKey)
    )
  ) {
    throw new AppError(403, "You cannot assign a privileged role", {
      roleId: "You cannot assign a privileged role",
    });
  }
}

export async function countActivePrivilegedUsers(
  excludeUserId?: string
): Promise<number> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      role: {
        permissions: {
          some: {
            permission: {
              key: { in: [...PRIVILEGED_PERMISSIONS] },
            },
          },
        },
      },
    },
    select: { id: true },
  });
  return users.length;
}

export async function assertNotLastPrivilegedUser(
  userId: string,
  nextIsActive: boolean,
  nextRoleId?: string
): Promise<void> {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { include: roleInclude } },
  });
  if (!current || !current.isActive) return;

  const currentlyPrivileged = current.role.permissions.some((rp) =>
    PRIVILEGED_PERMISSIONS.includes(rp.permission.key as PermissionKey)
  );
  if (!currentlyPrivileged) return;

  let stillPrivileged = currentlyPrivileged && nextIsActive;
  if (nextRoleId && nextRoleId !== current.roleId) {
    const nextRole = await getRoleById(nextRoleId);
    stillPrivileged =
      nextIsActive &&
      Boolean(
        nextRole?.permissions.some((rp) =>
          PRIVILEGED_PERMISSIONS.includes(rp.permission.key as PermissionKey)
        )
      );
  } else if (!nextIsActive) {
    stillPrivileged = false;
  }

  if (stillPrivileged) return;

  const others = await countActivePrivilegedUsers(userId);
  if (others === 0) {
    throw new AppError(
      400,
      "Cannot remove the last active administrator. Assign another privileged user first."
    );
  }
}
