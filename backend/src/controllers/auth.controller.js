import bcrypt from "bcryptjs";
import { pool } from "../config/database.js";
import * as authService from "../services/auth.service.js";
import { ApiError } from "../utils/api-error.js";

export async function login(req, res) {
  try {
    res.json({
      success: true,
      data: await authService.login(req.body.username, req.body.password, req),
    });
  } catch (error) {
    const [[target]] = await pool.execute(
      "SELECT id,branch_id FROM users WHERE username=? LIMIT 1",
      [req.body.username],
    );
    await pool.execute(
      `INSERT INTO audit_logs(branch_id,user_id,action,entity_type,entity_id,new_values,ip_address,user_agent)
       VALUES(?,?,'login_failed','authentication',?,JSON_OBJECT('success',false),?,?)`,
      [
        target?.branch_id || null,
        target?.id || null,
        String(req.body.username || "").slice(0, 80),
        req.ip,
        req.get("user-agent")?.slice(0, 500) || null,
      ],
    );
    throw error;
  }
}
export async function me(req, res) {
  res.json({ success: true, data: req.user });
}
export async function refresh(req, res) {
  res.json({
    success: true,
    data: await authService.refresh(req.body.refreshToken),
  });
}
export async function changePassword(req, res) {
  const [[user]] = await pool.execute(
    "SELECT password_hash FROM users WHERE id=?",
    [req.user.id],
  );
  if (!(await bcrypt.compare(req.body.currentPassword, user.password_hash)))
    throw new ApiError(400, "Current password is incorrect");
  await pool.execute(
    "UPDATE users SET password_hash=?,password_changed_at=NOW() WHERE id=?",
    [await bcrypt.hash(req.body.newPassword, 12), req.user.id],
  );
  await pool.execute(
    "UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL",
    [req.user.id],
  );
  res.json({ success: true, message: "Password changed" });
}
export async function logout(req, res) {
  await pool.execute(
    "DELETE FROM revoked_access_tokens WHERE expires_at<=NOW()",
  );
  if (req.authPayload?.jti)
    await pool.execute(
      "INSERT IGNORE INTO revoked_access_tokens(jti,user_id,expires_at) VALUES(?,?,FROM_UNIXTIME(?))",
      [req.authPayload.jti, req.user.id, req.authPayload.exp],
    );
  if (req.body.refreshToken)
    await pool.execute(
      "UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=? AND token_hash=SHA2(?,256)",
      [req.user.id, req.body.refreshToken],
    );
  if (req.body.allDevices)
    await pool.execute(
      "UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL",
      [req.user.id],
    );
  res.json({
    success: true,
    message: req.body.allDevices ? "Logged out from all devices" : "Logged out",
  });
}
