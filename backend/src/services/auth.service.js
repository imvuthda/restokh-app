import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { pool, withTransaction } from "../config/database.js";
import { ApiError } from "../utils/api-error.js";
import { signAccessToken } from "../utils/jwt.js";
import { env } from "../config/env.js";

const tokenHash = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

export async function login(username, password, req) {
  const result = await withTransaction(async (db) => {
    const [rows] = await db.execute(
      `SELECT u.*,r.code role_code,r.name role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.username=? LIMIT 1 FOR UPDATE`,
      [username],
    );
    const user = rows[0];
    if (
      !user ||
      !user.is_active ||
      (user.locked_until && new Date(user.locked_until) > new Date()) ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      if (user)
        await db.execute(
          `UPDATE users SET failed_login_attempts=failed_login_attempts+1,locked_until=IF(failed_login_attempts+1>=5,DATE_ADD(NOW(),INTERVAL 15 MINUTE),locked_until) WHERE id=?`,
          [user.id],
        );
      return { invalid: true };
    }
    await db.execute(
      `UPDATE users SET failed_login_attempts=0,locked_until=NULL,last_login_at=NOW() WHERE id=?`,
      [user.id],
    );
    const refreshToken = crypto.randomBytes(48).toString("hex");
    await db.execute(
      `INSERT INTO refresh_tokens(user_id,token_hash,device_name,ip_address,expires_at) VALUES(?,?,?,?,DATE_ADD(NOW(),INTERVAL ? DAY))`,
      [
        user.id,
        tokenHash(refreshToken),
        req.get("user-agent")?.slice(0, 200) || null,
        req.ip,
        env.refreshTokenDays,
      ],
    );
    delete user.password_hash;
    return {
      accessToken: signAccessToken(user),
      refreshToken,
      user: {
        id: user.id,
        branch_id: user.branch_id,
        username: user.username,
        full_name: user.full_name,
        role_code: user.role_code,
        role_name: user.role_name,
      },
    };
  });
  if (result.invalid) throw new ApiError(401, "Invalid username or password");
  return result;
}

export async function refresh(value) {
  const [rows] = await pool.execute(
    `SELECT rt.*,u.branch_id,u.username,u.full_name,r.code role_code FROM refresh_tokens rt JOIN users u ON u.id=rt.user_id JOIN roles r ON r.id=u.role_id WHERE rt.token_hash=? AND rt.revoked_at IS NULL AND rt.expires_at>NOW() AND u.is_active=1`,
    [tokenHash(value)],
  );
  if (!rows[0]) throw new ApiError(401, "Invalid refresh token");
  return { accessToken: signAccessToken(rows[0]) };
}
