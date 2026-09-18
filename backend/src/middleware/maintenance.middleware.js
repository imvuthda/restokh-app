import { pool } from "../config/database.js";
import { ApiError } from "../utils/api-error.js";

export async function enforceMaintenance(req, _res, next) {
  if (req.user?.isSuperAdmin) return next();
  const [[row]] = await pool.execute(
    `SELECT setting_value FROM settings WHERE setting_key='maintenance_mode'
     AND (branch_id=? OR branch_id IS NULL)
     ORDER BY branch_id IS NOT NULL DESC,id DESC LIMIT 1`,
    [req.user.branch_id],
  );
  if (["true", "1"].includes(String(row?.setting_value || "").toLowerCase()))
    return next(
      new ApiError(
        503,
        "System is under maintenance. Please contact the administrator.",
      ),
    );
  next();
}
