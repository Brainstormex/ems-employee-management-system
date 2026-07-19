import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../middleware/auth";
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
import { PERMISSIONS } from "../lib/permissions";
import { userHasPermission } from "../services/rbac.service";

const router = Router();

const idParamSchema = z.object({
  id: z.string().uuid("Invalid employee ID"),
});

/** Pick update schema based on permissions */
function validateEmployeeUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = req.user;
  if (
    user &&
    !userHasPermission(user, PERMISSIONS.EMPLOYEES_UPDATE_ALL) &&
    userHasPermission(user, PERMISSIONS.EMPLOYEES_UPDATE_SELF)
  ) {
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
  requirePermission(PERMISSIONS.EMPLOYEES_CREATE),
  validate(createEmployeeSchema),
  asyncHandler(employeeController.createEmployee)
);

router.post(
  "/import",
  requirePermission(PERMISSIONS.EMPLOYEES_IMPORT),
  csvUpload.single("file"),
  asyncHandler(employeeController.importEmployees)
);

router.get(
  "/:id/reportees",
  validate(idParamSchema, "params"),
  asyncHandler(organizationController.getReportees)
);

router.patch(
  "/:id/manager",
  requirePermission(PERMISSIONS.EMPLOYEES_ASSIGN_MANAGER),
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
  requirePermission(PERMISSIONS.EMPLOYEES_DELETE),
  validate(idParamSchema, "params"),
  asyncHandler(employeeController.softDeleteEmployee)
);

router.post(
  "/:id/restore",
  requirePermission(PERMISSIONS.EMPLOYEES_RESTORE),
  validate(idParamSchema, "params"),
  asyncHandler(employeeController.restoreEmployee)
);

export default router;
