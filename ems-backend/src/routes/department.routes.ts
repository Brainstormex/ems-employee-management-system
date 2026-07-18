import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, validate } from "../middleware/error";
import * as departmentController from "../controllers/department.controller";

const router = Router();

const idParamSchema = z.object({
  id: z.string().uuid("Invalid department ID"),
});

router.use(requireAuth);

router.get("/", asyncHandler(departmentController.listDepartments));

router.get(
  "/:id",
  validate(idParamSchema, "params"),
  asyncHandler(departmentController.getDepartment)
);

export default router;
