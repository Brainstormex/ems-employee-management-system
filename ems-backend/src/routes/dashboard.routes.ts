import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { PERMISSIONS } from "../lib/permissions";
import * as dashboardController from "../controllers/dashboard.controller";

const router = Router();

router.use(requireAuth);
router.use(requirePermission(PERMISSIONS.DASHBOARD_READ));

router.get("/stats", asyncHandler(dashboardController.getDashboardStats));

export default router;
