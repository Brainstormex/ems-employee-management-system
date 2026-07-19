import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { ACCESS_COOKIE } from "../lib/cookies";
import { AppError } from "./error";
import { prisma } from "../lib/prisma";
import { PermissionKey } from "../lib/permissions";
import {
  loadUserAuthContext,
  userHasPermission,
} from "../services/rbac.service";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    if (!token) {
      throw new AppError(401, "Authentication required");
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError(401, "Invalid or expired access token");
    }

    const ctx = await loadUserAuthContext(payload.sub);
    if (!ctx || !ctx.isActive) {
      throw new AppError(401, "User account is inactive or not found");
    }

    req.user = ctx;
    next();
  } catch (err) {
    next(err);
  }
}

export function requirePermission(...permissions: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, "Authentication required"));
      return;
    }
    const ok = permissions.every((p) => userHasPermission(req.user!, p));
    if (!ok) {
      next(new AppError(403, "Insufficient permissions"));
      return;
    }
    next();
  };
}

export function requireAnyPermission(...permissions: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, "Authentication required"));
      return;
    }
    const ok = permissions.some((p) => userHasPermission(req.user!, p));
    if (!ok) {
      next(new AppError(403, "Insufficient permissions"));
      return;
    }
    next();
  };
}

/** @deprecated Prefer requirePermission — kept for transitional test probes */
export async function assertActiveUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });
  return Boolean(user?.isActive);
}
