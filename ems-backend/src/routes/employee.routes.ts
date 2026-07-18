import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler, validate } from "../middleware/error";
import { csvUpload } from "../middleware/upload";
import {
  createEmployeeSchema,
  employeeQuerySchema,
  employeeSelfUpdateSchema,
  updateEmployeeSchema,
  assignManagerSchema,
} from "../schemas/employee.schema";
import * as employeeController from "../controllers/employee.controller";
import * as organizationController from "../controllers/organization.controller";
import { Role } from "../types";

const router = Router();

const idParamSchema = z.object({
  id: z.string().uuid("Invalid employee ID"),
});

/** Pick update schema based on authenticated role */
function validateEmployeeUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.role === Role.EMPLOYEE) {
    validate(employeeSelfUpdateSchema)(req, res, next);
    return;
  }
  validate(updateEmployeeSchema)(req, res, next);
}

router.use(requireAuth);

router.get(
  "/",
  validate(employeeQuerySchema, "query"),
  asyncHandler(employeeController.listEmployees)
);

router.post(
  "/",
  requireRole(Role.SUPER_ADMIN, Role.HR_MANAGER),
  validate(createEmployeeSchema),
  asyncHandler(employeeController.createEmployee)
);

router.post(
  "/import",
  requireRole(Role.SUPER_ADMIN, Role.HR_MANAGER),
  csvUpload.single("file"),
  asyncHandler(employeeController.importEmployees)
);

// Hierarchy routes (more specific than /:id)
router.get(
  "/:id/reportees",
  validate(idParamSchema, "params"),
  asyncHandler(organizationController.getReportees)
);

router.patch(
  "/:id/manager",
  requireRole(Role.SUPER_ADMIN, Role.HR_MANAGER),
  validate(idParamSchema, "params"),
  validate(assignManagerSchema),
  asyncHandler(organizationController.assignManager)
);

router.get(
  "/:id",
  validate(idParamSchema, "params"),
  asyncHandler(employeeController.getEmployee)
);

router.put(
  "/:id",
  validate(idParamSchema, "params"),
  validateEmployeeUpdate,
  asyncHandler(employeeController.updateEmployee)
);

router.delete(
  "/:id",
  requireRole(Role.SUPER_ADMIN),
  validate(idParamSchema, "params"),
  asyncHandler(employeeController.softDeleteEmployee)
);

router.post(
  "/:id/restore",
  requireRole(Role.SUPER_ADMIN),
  validate(idParamSchema, "params"),
  asyncHandler(employeeController.restoreEmployee)
);

export default router;
