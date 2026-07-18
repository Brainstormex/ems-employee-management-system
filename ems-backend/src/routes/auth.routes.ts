import { Router } from "express";
import rateLimit from "express-rate-limit";
import { loginSchema } from "../schemas/employee.schema";
import { validate, asyncHandler } from "../middleware/error";
import { requireAuth } from "../middleware/auth";
import * as authController from "../controllers/auth.controller";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});

router.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  asyncHandler(authController.login)
);

router.post("/logout", asyncHandler(authController.logout));

router.post("/refresh", asyncHandler(authController.refresh));

router.get("/me", requireAuth, asyncHandler(authController.me));

export default router;
