import { Router } from "express";
import * as orders from "../controllers/order.controller.js";
import * as kitchen from "../controllers/kitchen.controller.js";
import * as payments from "../controllers/payment.controller.js";
import * as purchases from "../controllers/purchase.controller.js";
import * as misc from "../controllers/misc.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { permit } from "../middleware/permission.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  brandLogoUpload,
  menuImageUpload,
} from "../middleware/upload.middleware.js";
import { enforceMaintenance } from "../middleware/maintenance.middleware.js";
const r = Router();
r.use(authenticate);
r.use(enforceMaintenance);
r.get("/orders", permit("orders.view"), asyncHandler(orders.list));
r.post("/orders", permit("orders.create"), asyncHandler(orders.create));
r.get("/orders/:id", permit("orders.view"), asyncHandler(orders.get));
r.post(
  "/orders/:id/items",
  permit("orders.update"),
  asyncHandler(orders.addItems),
);
r.patch(
  "/orders/:id/discount",
  permit("orders.update"),
  asyncHandler(orders.updateDiscount),
);
r.post(
  "/orders/:id/send-kitchen",
  permit("orders.update"),
  asyncHandler(orders.sendKitchen),
);
r.post(
  "/orders/:id/items/:itemId/cancel",
  permit("orders.cancel"),
  asyncHandler(orders.cancelItem),
);
r.post(
  "/orders/:id/cancel",
  permit("orders.cancel"),
  asyncHandler(orders.cancelOrder),
);
r.post(
  "/orders/:id/transfer-table",
  permit("orders.update"),
  asyncHandler(orders.transferTable),
);
r.get(
  "/table-operations",
  permit("tables.view"),
  asyncHandler(orders.tableOverview),
);
r.get(
  "/tables/:tableId/open-order",
  permit("orders.view"),
  asyncHandler(orders.openTableOrder),
);
r.patch(
  "/tables/:id/status",
  permit("tables.manage"),
  asyncHandler(orders.setTableStatus),
);
r.get("/kitchen/queue", permit("kitchen.view"), asyncHandler(kitchen.queue));
r.patch(
  "/kitchen/tickets/:id/status",
  permit("kitchen.update"),
  asyncHandler(kitchen.status),
);
r.get(
  "/orders/:orderId/payments",
  permit("orders.view"),
  asyncHandler(payments.list),
);
r.post(
  "/orders/:orderId/payments",
  permit("payments.create"),
  asyncHandler(payments.pay),
);
r.post(
  "/payments/:id/void",
  permit("payments.void"),
  asyncHandler(payments.voidPayment),
);
r.get(
  "/cash-registers",
  permit("payments.create"),
  asyncHandler(payments.registers),
);
r.get(
  "/cash-sessions/current",
  permit("payments.create"),
  asyncHandler(payments.currentCashSession),
);
r.post(
  "/cash-sessions/open",
  permit("payments.create"),
  asyncHandler(payments.openCashSession),
);
r.post(
  "/cash-sessions/:id/close",
  permit("payments.create"),
  asyncHandler(payments.closeCashSession),
);
r.get("/purchases", permit("purchases.manage"), asyncHandler(purchases.list));
r.post(
  "/purchases",
  permit("purchases.manage"),
  asyncHandler(purchases.create),
);
r.post(
  "/purchases/:id/receive",
  permit("purchases.manage"),
  asyncHandler(purchases.receive),
);
r.get("/inventory", permit("inventory.view"), asyncHandler(misc.inventory));
r.get(
  "/inventory/movements",
  permit("inventory.view"),
  asyncHandler(misc.movements),
);
r.get("/expenses", permit("expenses.manage"), asyncHandler(misc.expenses));
r.post(
  "/expenses",
  permit("expenses.manage"),
  asyncHandler(misc.createExpense),
);
r.get(
  "/reservations",
  permit("reservations.manage"),
  asyncHandler(misc.reservations),
);
r.post(
  "/reservations",
  permit("reservations.manage"),
  asyncHandler(misc.createReservation),
);
r.post(
  "/reservations/:id/confirm",
  permit("reservations.manage"),
  asyncHandler(misc.confirmReservation),
);
r.post(
  "/reservations/:id/check-in",
  permit("reservations.manage"),
  permit("orders.create"),
  asyncHandler(misc.checkInReservation),
);
r.post(
  "/reservations/:id/cancel",
  permit("reservations.manage"),
  asyncHandler(misc.cancelReservation),
);
r.get(
  "/menu-items/:menuItemId/recipe",
  permit("menu.view"),
  asyncHandler(misc.recipes),
);
r.put(
  "/menu-items/:menuItemId/recipe",
  permit("menu.manage"),
  asyncHandler(misc.saveRecipe),
);
r.post(
  "/menu-images",
  permit("menu.manage"),
  menuImageUpload.single("image"),
  asyncHandler(misc.uploadMenuImage),
);
r.post(
  "/setting-logo",
  permit("settings.manage"),
  brandLogoUpload.single("logo"),
  asyncHandler(misc.uploadBrandLogo),
);
r.get("/settings", permit("settings.manage"), asyncHandler(misc.settings));
r.put("/settings", permit("settings.manage"), asyncHandler(misc.saveSetting));
r.put(
  "/settings/batch",
  permit("settings.manage"),
  asyncHandler(misc.saveSettingsBatch),
);
r.get("/dashboard", permit("dashboard.view"), asyncHandler(misc.dashboard));
r.get("/reports", permit("reports.view"), asyncHandler(misc.reports));
export default r;
