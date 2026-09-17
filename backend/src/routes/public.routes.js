import { Router } from "express";
import { publicSettings } from "../controllers/misc.controller.js";
import { asyncHandler } from "../utils/async-handler.js";
const r = Router();
r.get("/settings", asyncHandler(publicSettings));
export default r;
