import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { prisma } from "./lib/prisma";
import authRoutes from "./routes/auth.routes";
import employeeRoutes from "./routes/employee.routes";
import departmentRoutes from "./routes/department.routes";
import organizationRoutes from "./routes/organization.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import adminRoutes from "./routes/admin.routes";
import { errorHandler } from "./middleware/error";
import { requireAuth, requirePermission } from "./middleware/auth";
import { PERMISSIONS } from "./lib/permissions";

export function createApp(): Express {
  const app = express();

  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(helmet());
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: "ok",
        service: "ems-backend",
        database: "connected",
      });
    } catch {
      res.status(503).json({
        status: "error",
        service: "ems-backend",
        database: "disconnected",
      });
    }
  });

  app.get("/", (_req, res) => {
    res.json({
      message: "EMS API",
      endpoints: {
        auth: [
          "POST /api/auth/login",
          "POST /api/auth/logout",
          "POST /api/auth/refresh",
          "GET /api/auth/me",
        ],
        employees: [
          "GET /api/employees",
          "POST /api/employees",
          "POST /api/employees/import",
          "GET /api/employees/:id",
          "PUT /api/employees/:id",
          "DELETE /api/employees/:id",
          "POST /api/employees/:id/restore",
          "GET /api/employees/:id/reportees",
          "PATCH /api/employees/:id/manager",
        ],
        organization: ["GET /api/organization/tree"],
        departments: ["GET /api/departments"],
        dashboard: ["GET /api/dashboard/stats"],
        admin: [
          "GET /api/admin/users",
          "PATCH /api/admin/users/:id",
          "GET /api/admin/roles",
          "POST /api/admin/roles",
          "PUT /api/admin/roles/:id",
          "DELETE /api/admin/roles/:id",
          "GET /api/admin/permissions",
        ],
      },
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/employees", employeeRoutes);
  app.use("/api/departments", departmentRoutes);
  app.use("/api/organization", organizationRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/admin", adminRoutes);

  if (process.env.NODE_ENV === "test") {
    app.get(
      "/rbac/admin-only",
      requireAuth,
      requirePermission(PERMISSIONS.USERS_MANAGE),
      (_req, res) => {
        res.json({ ok: true, gate: "admin" });
      }
    );
    app.get(
      "/rbac/hr-or-admin",
      requireAuth,
      requirePermission(PERMISSIONS.EMPLOYEES_CREATE),
      (_req, res) => {
        res.json({ ok: true, gate: "hr-or-admin" });
      }
    );
    app.get("/rbac/any-auth", requireAuth, (req, res) => {
      res.json({
        ok: true,
        role: req.user?.role.slug,
        permissions: req.user?.permissions,
      });
    });
  }

  app.use(errorHandler);

  return app;
}
