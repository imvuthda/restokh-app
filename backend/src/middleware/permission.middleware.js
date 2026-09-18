import { ApiError } from "../utils/api-error.js";

export const permit =
  (...codes) =>
  (req, _res, next) => {
    if (
      req.user?.isSuperAdmin ||
      codes.some((code) => req.user?.permissions.includes(code))
    )
      return next();
    next(new ApiError(403, "Permission denied"));
  };

export function resolveBranchId(req, requested = null) {
  if (req.user.isSuperAdmin) {
    const branchId = Number(
      requested || req.query.branch_id || req.body?.branch_id,
    );
    if (!branchId) throw new ApiError(400, "branch_id is required");
    return branchId;
  }
  if (!req.user.branch_id) throw new ApiError(403, "No branch assigned");
  if (requested && Number(requested) !== Number(req.user.branch_id))
    throw new ApiError(403, "Cannot access another branch");
  return Number(req.user.branch_id);
}
