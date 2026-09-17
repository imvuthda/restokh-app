import { pool } from "../config/database.js";
export async function writeAudit(
  req,
  action,
  entityType,
  entityId,
  oldValues = null,
  newValues = null,
  connection = pool,
) {
  req.auditWritten = true;
  await connection.execute(
    `INSERT INTO audit_logs(branch_id,user_id,action,entity_type,entity_id,old_values,new_values,ip_address,user_agent) VALUES(?,?,?,?,?,?,?,?,?)`,
    [
      req.user?.branch_id || req.body?.branch_id || null,
      req.user?.id || null,
      action,
      entityType,
      String(entityId || ""),
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      req.ip,
      req.get("user-agent")?.slice(0, 500) || null,
    ],
  );
}

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const sensitiveKeys = new Set([
  "password",
  "password_hash",
  "currentPassword",
  "newPassword",
  "new_password",
  "refreshToken",
  "accessToken",
  "token",
]);

function activity(req) {
  const path = req.path.replace(/^\/api\//, "");
  if (path === "auth/refresh") return null;
  const parts = path.split("/").filter(Boolean);
  let action = {
    POST: "create",
    PUT: "update",
    PATCH: "update",
    DELETE: "delete",
  }[req.method];
  if (path === "auth/login") action = "login";
  else if (path === "auth/logout") action = "logout";
  else if (path.includes("change-password")) action = "change_password";
  else if (path.includes("reset-password")) action = "reset_password";
  else if (path.endsWith("/cancel")) action = "cancel";
  else if (path.endsWith("/confirm")) action = "confirm";
  else if (path.endsWith("/check-in")) action = "check_in";
  else if (path.endsWith("/discount")) action = "apply_discount";
  else if (path.includes("/payments")) action = "payment";
  else if (path.includes("/close")) action = "close";
  else if (path.includes("/open")) action = "open";
  const changedFields = Object.keys(req.body || {}).filter(
    (key) => !sensitiveKeys.has(key),
  );
  return {
    action,
    entityType: parts[0] === "auth" ? "authentication" : parts[0] || "system",
    entityId: parts.find((part) => /^\d+$/.test(part)) || null,
    changedFields,
    path,
  };
}

export function auditTrail(req, res, next) {
  if (!mutationMethods.has(req.method)) return next();
  let responseBody;
  const json = res.json.bind(res);
  res.json = (body) => {
    responseBody = body;
    return json(body);
  };
  res.on("finish", () => {
    if (res.statusCode >= 400 || req.auditWritten) return;
    const entry = activity(req);
    if (!entry) return;
    const responseUser = responseBody?.data?.user;
    const userId = req.user?.id || responseUser?.id || null;
    const branchId =
      req.user?.branch_id ||
      responseUser?.branch_id ||
      Number(req.body?.branch_id || 0) ||
      null;
    const entityId =
      entry.entityId || responseBody?.data?.id || responseUser?.id || null;
    pool
      .execute(
        `INSERT INTO audit_logs(branch_id,user_id,action,entity_type,entity_id,new_values,ip_address,user_agent)
         VALUES(?,?,?,?,?,?,?,?)`,
        [
          branchId,
          userId,
          entry.action,
          entry.entityType,
          entityId ? String(entityId) : null,
          JSON.stringify({
            path: entry.path,
            status: res.statusCode,
            changed_fields: entry.changedFields,
          }),
          req.ip,
          req.get("user-agent")?.slice(0, 500) || null,
        ],
      )
      .catch((error) => console.error("Audit log write failed", error.message));
  });
  next();
}
