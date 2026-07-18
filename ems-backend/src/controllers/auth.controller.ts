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
import { Role } from "../types";
import { LoginInput } from "../schemas/employee.schema";

const BCRYPT_ROUNDS = 10;

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      employee: {
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          deletedAt: true,
        },
      },
    },
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
    role: user.role as Role,
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

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      fullName: user.employee?.fullName ?? null,
      employeeCode: user.employee?.employeeCode ?? null,
    },
  });
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

  // Rotate: revoke old, issue new pair
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      role: true,
      employeeId: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    clearAuthCookies(res);
    throw new AppError(401, "User account is inactive or not found");
  }

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role as Role,
    employeeId: user.employeeId,
  });

  const { token: newRefreshToken } = signRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
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
    select: {
      id: true,
      email: true,
      role: true,
      employeeId: true,
      lastLoginAt: true,
      employee: {
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          designation: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  res.json({ user });
}

/** Exported for tests / future user creation */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
