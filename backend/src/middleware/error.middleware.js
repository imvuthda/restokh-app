import { ApiError } from "../utils/api-error.js";

export function notFound(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}
export function errorHandler(error, _req, res, _next) {
  const status =
    error.status ||
    (error.code === "LIMIT_FILE_SIZE"
      ? 413
      : error.code === "ER_DUP_ENTRY"
        ? 409
        : 500);
  if (process.env.NODE_ENV !== "test" && status >= 500) console.error(error);
  res.status(status).json({
    success: false,
    message:
      status === 500 && process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message,
    details: error.details || undefined,
  });
}
