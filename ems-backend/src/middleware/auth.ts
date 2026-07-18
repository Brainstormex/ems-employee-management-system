import { NextFunction, Request, Response } from "express";
import { Role } from "../types";
import { verifyAccessToken } from "../lib/jwt";
import { ACCESS_COOKIE } from "../lib/cookies";
import { AppError } from "./error";
import { prisma } from "../lib/prisma";

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
      throw new AppError(401, "User account is inactive or not found");
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as Role,
      employeeId: user.employeeId,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, "Authentication required"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError(403, "Insufficient permissions"));
      return;
    }
    next();
  };
}
