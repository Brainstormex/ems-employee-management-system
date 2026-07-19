import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import {
  getRefreshExpiryDate,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt";
import {
  clearAuthCookies,
  REFRESH_COOKIE,
  setAuthCookies,
} from "../lib/cookies";
import { AppError } from "../middleware/error";
import { LoginInput } from "../schemas/employee.schema";
import {
  extractPermissionKeys,
  loadUserAuthContext,
  serializeRoleSummary,
} from "../services/rbac.service";

const BCRYPT_ROUNDS = 10;

const authUserInclude = {
  role: {
    include: {
      permissions: {
        include: {
          permission: { select: { key: true, name: true, groupName: true } },
        },
      },
    },
  },
  employee: {
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
      designation: true,
      deletedAt: true,
      department: { select: { id: true, name: true } },
    },
  },
} as const;

function toPublicUser(user: {
  id: string;
  email: string;
  employeeId: string | null;
  isActive: boolean;
  lastLoginAt?: Date | null;
  role: {
    id: string;
    slug: string;
    name: string;
    isSystem: boolean;
    permissions: { permission: { key: string; name: string; groupName: string } }[];
  };
  employee?: {
    id: string;
    fullName: string;
    employeeCode: string;
    designation?: string;
    department?: { id: string; name: string } | null;
  } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    employeeId: user.employeeId,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    role: serializeRoleSummary(user.role),
    permissions: extractPermissionKeys(user.role),
    fullName: user.employee?.fullName ?? null,
    employeeCode: user.employee?.employeeCode ?? null,
    employee: user.employee
      ? {
          id: user.employee.id,
          fullName: user.employee.fullName,
          employeeCode: user.employee.employeeCode,
          designation: user.employee.designation ?? "",
          department: user.employee.department ?? null,
        }
      : null,
  };
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;

  const user = await prisma.user.findUnique({
    where: { email },
    include: authUserInclude,
  });

  if (!user || !user.isActive) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  if (user.employee?.deletedAt) {
    throw new AppError(401, "Associated employee record has been deleted");
  }

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    roleId: user.roleId,
    roleSlug: user.role.slug,
    employeeId: user.employeeId,
  });

  const { token: refreshToken } = signRefreshToken(user.id);
  const tokenHash = hashToken(refreshToken);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: getRefreshExpiryDate(),
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  setAuthCookies(res, accessToken, refreshToken);

  res.json({ user: toPublicUser(user) });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;

  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  clearAuthCookies(res);
  res.json({ message: "Logged out successfully" });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!refreshToken) {
    throw new AppError(401, "Refresh token required");
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    clearAuthCookies(res);
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      userId: payload.sub,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!stored) {
    clearAuthCookies(res);
    throw new AppError(401, "Refresh token revoked or expired");
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const ctx = await loadUserAuthContext(payload.sub);
  if (!ctx || !ctx.isActive) {
    clearAuthCookies(res);
    throw new AppError(401, "User account is inactive or not found");
  }

  const accessToken = signAccessToken({
    sub: ctx.id,
    email: ctx.email,
    roleId: ctx.role.id,
    roleSlug: ctx.role.slug,
    employeeId: ctx.employeeId,
  });

  const { token: newRefreshToken } = signRefreshToken(ctx.id);
  await prisma.refreshToken.create({
    data: {
      userId: ctx.id,
      tokenHash: hashToken(newRefreshToken),
      expiresAt: getRefreshExpiryDate(),
    },
  });

  setAuthCookies(res, accessToken, newRefreshToken);
  res.json({ message: "Token refreshed" });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: authUserInclude,
  });

  if (!user || !user.isActive) {
    clearAuthCookies(res);
    throw new AppError(401, "User account is inactive or not found");
  }

  res.json({ user: toPublicUser(user) });
}

/** Exported for tests / future user creation */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
