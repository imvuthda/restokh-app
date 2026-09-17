import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import * as c from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  loginSchema,
  changePasswordSchema,
} from "../validators/auth.validator.js";
const router = Router();
router.post(
  "/login",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 }),
  validate(loginSchema),
  asyncHandler(c.login),
);
router.post("/refresh", asyncHandler(c.refresh));
router.post("/logout", authenticate, asyncHandler(c.logout));
router.get("/me", authenticate, asyncHandler(c.me));
router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(c.changePassword),
);
export default router;
