import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { PERMISSIONS } from "../lib/permissions";
import * as organizationController from "../controllers/organization.controller";

const router = Router();

router.use(requireAuth);
router.use(requirePermission(PERMISSIONS.ORGANIZATION_READ));

router.get("/tree", asyncHandler(organizationController.getOrganizationTree));

export default router;
