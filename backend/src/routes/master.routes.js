import { Router } from "express";
import * as c from "../controllers/master.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { permit } from "../middleware/permission.middleware.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { enforceMaintenance } from "../middleware/maintenance.middleware.js";
const r = Router();
r.use(authenticate);
r.use(enforceMaintenance);
r.get("/users", permit("users.manage"), asyncHandler(c.users));
r.get("/audit-logs", permit("users.manage"), asyncHandler(c.auditLogs));
r.post("/users", permit("users.manage"), asyncHandler(c.createUser));
r.get("/users/:id", permit("users.manage"), asyncHandler(c.getUser));
r.put("/users/:id", permit("users.manage"), asyncHandler(c.updateUser));
r.patch(
  "/users/:id/status",
  permit("users.manage"),
  asyncHandler(c.setUserStatus),
);
r.post(
  "/users/:id/reset-password",
  permit("users.manage"),
  asyncHandler(c.resetUserPassword),
);
r.get("/roles", permit("roles.manage"), asyncHandler(c.roles));
r.post("/roles", permit("roles.manage"), asyncHandler(c.createRole));
r.get("/roles/:id", permit("roles.manage"), asyncHandler(c.getRole));
r.put("/roles/:id", permit("roles.manage"), asyncHandler(c.updateRole));
r.get("/permissions", permit("roles.manage"), asyncHandler(c.permissions));
r.put(
  "/roles/:id/permissions",
  permit("roles.manage"),
  asyncHandler(c.setRolePermissions),
);
r.get("/sku-preview/:type", asyncHandler(c.skuPreview));
const resourcePermissions = {
  branches: "branches.manage",
  areas: "tables.view",
  shapes: "tables.view",
  tables: "tables.view",
  categories: "menu.view",
  menuItems: "menu.view",
  stations: "menu.view",
  units: "inventory.view",
  ingredients: "inventory.view",
  suppliers: "purchases.manage",
  customers: "customers.manage",
  expenseCategories: "expenses.manage",
  paymentMethods: "settings.manage",
};
const authorizeResource =
  (write = false) =>
  (req, _res, next) => {
    const code = resourcePermissions[req.params.resource];
    if (!code) return next(new ApiError(404, "Resource not found"));
    const writeCode =
      {
        areas: "tables.manage",
        shapes: "tables.manage",
        tables: "tables.manage",
        categories: "menu.manage",
        menuItems: "menu.manage",
        stations: "menu.manage",
        units: "inventory.adjust",
        ingredients: "inventory.adjust",
        paymentMethods: "settings.manage",
      }[req.params.resource] || code;
    // Cashiers and waiters need the active methods in POS, while only
    // settings managers may create, change, or delete payment methods.
    const readCodes =
      req.params.resource === "paymentMethods"
        ? ["settings.manage", "payments.create", "orders.create"]
        : [code];
    if (
      req.user.isSuperAdmin ||
      (write
        ? req.user.permissions.includes(writeCode)
        : readCodes.some((permission) => req.user.permissions.includes(permission)))
    )
      return next();
    next(new ApiError(403, "Permission denied"));
  };
r.get("/:resource", authorizeResource(false), asyncHandler(c.list));
r.get("/:resource/:id", authorizeResource(false), asyncHandler(c.get));
r.post("/:resource", authorizeResource(true), asyncHandler(c.create));
r.put("/:resource/:id", authorizeResource(true), asyncHandler(c.update));
r.delete("/:resource/:id", authorizeResource(true), asyncHandler(c.remove));
export default r;
