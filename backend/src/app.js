import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import masterRoutes from "./routes/master.routes.js";
import operationRoutes from "./routes/operation.routes.js";
import publicRoutes from "./routes/public.routes.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";
import { auditTrail } from "./middleware/audit.middleware.js";
const app = express();
app.use("/api", (_req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});
if (env.trustProxy) app.set("trust proxy", env.trustProxy);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || env.frontendUrls.includes(origin.replace(/\/$/, "")))
        return cb(null, true);
      cb(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(auditTrail);
const root = path.dirname(fileURLToPath(import.meta.url));
app.use(
  "/uploads",
  express.static(path.resolve(root, "../uploads"), { maxAge: "1d" }),
);
app.get("/api/health", (_req, res) =>
  res.json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  }),
);
app.use("/api/auth", authRoutes);
app.use("/api/public", publicRoutes);
app.use("/api", operationRoutes);
app.use("/api", masterRoutes);
app.use(notFound);
app.use(errorHandler);
export default app;
