import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import * as organizationController from "../controllers/organization.controller";

const router = Router();

router.use(requireAuth);

router.get("/tree", asyncHandler(organizationController.getOrganizationTree));

export default router;
