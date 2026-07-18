import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import * as dashboardController from "../controllers/dashboard.controller";

const router = Router();

router.use(requireAuth);

router.get("/stats", asyncHandler(dashboardController.getDashboardStats));

export default router;
