import { pool } from "../config/database.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { ApiError } from "../utils/api-error.js";

export async function authenticate(req, _res, next) {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null;
    if (!token) throw new ApiError(401, "Authentication required");
    const payload = verifyAccessToken(token);
    const [[revoked]] = await pool.execute(
      "SELECT jti FROM revoked_access_tokens WHERE jti=? AND expires_at>NOW() LIMIT 1",
      [payload.jti],
    );
    if (revoked) throw new ApiError(401, "Session has been logged out");
    const [rows] = await pool.execute(
      `SELECT u.id,u.branch_id,u.username,u.full_name,u.preferred_language,r.code role_code,r.name role_name,b.name branch_name
       FROM users u JOIN roles r ON r.id=u.role_id LEFT JOIN branches b ON b.id=u.branch_id WHERE u.id=? AND u.is_active=1 AND r.is_active=1 LIMIT 1`,
      [payload.sub],
    );
    if (!rows[0]) throw new ApiError(401, "User is unavailable");
    const [permissions] = await pool.execute(
      `SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id JOIN users u ON u.role_id=rp.role_id WHERE u.id=?`,
      [payload.sub],
    );
    req.user = {
      ...rows[0],
      permissions: permissions.map((p) => p.code),
      isSuperAdmin: rows[0].role_code === "super_admin",
    };
    req.authPayload = payload;
    next();
  } catch (error) {
    next(
      error.name === "JsonWebTokenError" || error.name === "TokenExpiredError"
        ? new ApiError(401, "Invalid or expired token")
        : error,
    );
  }
}
