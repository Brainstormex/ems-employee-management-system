import { Router } from "express";
import { z } from "zod";
import {
  requireAuth,
  requirePermission,
  requireAnyPermission,
} from "../middleware/auth";
import { asyncHandler, validate } from "../middleware/error";
import { PERMISSIONS } from "../lib/permissions";
import {
  adminUserQuerySchema,
  createRoleSchema,
  updateRoleSchema,
  updateUserAdminSchema,
} from "../schemas/employee.schema";
import * as adminController from "../controllers/admin.controller";

const router = Router();

const idParamSchema = z.object({
  id: z.string().uuid("Invalid ID"),
});

router.use(requireAuth);

router.get(
  "/users",
  requirePermission(PERMISSIONS.USERS_MANAGE),
  validate(adminUserQuerySchema, "query"),
  asyncHandler(adminController.listUsers)
);

router.patch(
  "/users/:id",
  requirePermission(PERMISSIONS.USERS_MANAGE),
  validate(idParamSchema, "params"),
  validate(updateUserAdminSchema),
  asyncHandler(adminController.updateUser)
);

router.get(
  "/permissions",
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  asyncHandler(adminController.listPermissions)
);

router.get(
  "/roles",
  requireAnyPermission(
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.ROLES_MANAGE,
    PERMISSIONS.EMPLOYEES_CREATE
  ),
  asyncHandler(adminController.listRoles)
);

router.post(
  "/roles",
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate(createRoleSchema),
  asyncHandler(adminController.createRole)
);

router.put(
  "/roles/:id",
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate(idParamSchema, "params"),
  validate(updateRoleSchema),
  asyncHandler(adminController.updateRole)
);

router.delete(
  "/roles/:id",
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate(idParamSchema, "params"),
  asyncHandler(adminController.deleteRole)
);

export default router;
