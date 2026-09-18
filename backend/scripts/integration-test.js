import "dotenv/config";
import { pool } from "../src/config/database.js";

const base = String(
  process.env.TEST_API_URL ||
    `http://127.0.0.1:${process.env.PORT || 5000}/api`,
).replace(/\/$/, "");
const branchId = Number(process.env.TEST_BRANCH_ID || 1);
let token = "";
const stamp = Date.now().toString().slice(-8);
const pass = (name) => console.log(`PASS  ${name}`);
const fail = (name, e) => {
  console.error(`FAIL  ${name}: ${e.message}`);
  throw e;
};
async function api(path, { method = "GET", body, auth = true } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(auth && token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(
      `${method} ${path} -> ${r.status}: ${data.message || JSON.stringify(data)}`,
    );
  return data.data;
}
async function step(name, fn) {
  try {
    const x = await fn();
    pass(name);
    return x;
  } catch (e) {
    fail(name, e);
  }
}

try {
  await step("Health", () => api("/health", { auth: false }));
  const login = await step("Admin login", () =>
    api("/auth/login", {
      method: "POST",
      auth: false,
      body: {
        username: process.env.TEST_USERNAME || "admin",
        password: process.env.TEST_PASSWORD || "Admin@123",
      },
    }),
  );
  token = login.accessToken;
  await step("Current user and permissions", () => api("/auth/me"));
  const tables = await step("List restaurant tables", () =>
    api(`/tables?branch_id=${branchId}`),
  );
  const table =
    tables.items.find((x) => x.status === "available") || tables.items[0];
  if (!table) throw new Error("No seeded table");
  const categories = await api("/categories");
  const category = categories.items[0];
  const stations = await api(`/stations?branch_id=${branchId}`);
  const station = stations.items[0];
  const units = await api("/units");
  const unit = units.items[0];
  const ingredient = await step("Create ingredient", () =>
    api("/ingredients", {
      method: "POST",
      body: {
        unit_id: unit.id,
        sku: `TEST-ING-${stamp}`,
        name: `Integration Ingredient ${stamp}`,
        average_cost: 2,
        minimum_stock: 1,
        is_active: 1,
      },
    }),
  );
  const menu = await step("Create menu item", () =>
    api("/menuItems", {
      method: "POST",
      body: {
        category_id: category.id,
        kitchen_station_id: station.id,
        sku: `TEST-MENU-${stamp}`,
        name: `Integration Meal ${stamp}`,
        base_price: 10,
        cost_price: 2,
        item_type: "food",
        track_stock: 1,
        is_available: 1,
        is_active: 1,
      },
    }),
  );
  await step("Save recipe", () =>
    api(`/menu-items/${menu.id}/recipe`, {
      method: "PUT",
      body: {
        items: [
          { ingredient_id: ingredient.id, quantity: 0.5, wastage_percent: 0 },
        ],
      },
    }),
  );
  await pool.execute(
    `INSERT INTO inventory(branch_id,ingredient_id,quantity_on_hand,average_cost,last_movement_at) VALUES(?,?,10,2,NOW()) ON DUPLICATE KEY UPDATE quantity_on_hand=10,average_cost=2`,
    [branchId, ingredient.id],
  );
  const order = await step("Open table order", () =>
    api("/orders", {
      method: "POST",
      body: {
        branch_id: branchId,
        table_id: table.id,
        order_type: "dine_in",
        guest_count: 2,
      },
    }),
  );
  await step("Add idempotent order item", () =>
    api(`/orders/${order.id}/items`, {
      method: "POST",
      body: {
        branch_id: branchId,
        submission_key: `TEST-${stamp}`,
        items: [{ menu_item_id: menu.id, quantity: 2 }],
      },
    }),
  );
  await step("Apply audited guest discount", async () => {
    const discounted = await api(`/orders/${order.id}/discount`, {
      method: "PATCH",
      body: {
        branch_id: branchId,
        discount_type: "percent",
        discount_value: 10,
        discount_reason: "Integration test guest discount",
      },
    });
    if (
      Number(discounted.discount_amount) <= 0 ||
      discounted.discount_reason !== "Integration test guest discount"
    )
      throw new Error("Guest discount was not calculated or audited");
    return discounted;
  });
  await step("Send order to kitchen", () =>
    api(`/orders/${order.id}/send-kitchen`, {
      method: "POST",
      body: { branch_id: branchId },
    }),
  );
  const queue = await step("Read kitchen queue", () =>
    api(`/kitchen/queue?branch_id=${branchId}&station_id=${station.id}`),
  );
  const ticket = queue.find((x) => x.order_id === order.id);
  if (!ticket) throw new Error("Kitchen ticket missing");
  await step("Mark kitchen ticket ready", () =>
    api(`/kitchen/tickets/${ticket.id}/status`, {
      method: "PATCH",
      body: { branch_id: branchId, status: "ready" },
    }),
  );
  const registers = await api(`/cash-registers?branch_id=${branchId}`);
  let cashSession = await api(`/cash-sessions/current?branch_id=${branchId}`);
  if (!cashSession)
    cashSession = await step("Open cashier shift", () =>
      api("/cash-sessions/open", {
        method: "POST",
        body: {
          branch_id: branchId,
          cash_register_id: registers[0].id,
          opening_amount: 20,
        },
      }),
    );
  await step("Complete idempotent cash payment", () =>
    api(`/orders/${order.id}/payments`, {
      method: "POST",
      body: {
        branch_id: branchId,
        request_key: `PAY-${stamp}`,
        payments: [
          {
            payment_method: "cash",
            currency_code: "USD",
            exchange_rate: 1,
            tendered_amount: 20,
            cash_session_id: cashSession.id,
          },
        ],
      },
    }),
  );
  const [[stock]] = await pool.execute(
    "SELECT quantity_on_hand FROM inventory WHERE branch_id=? AND ingredient_id=?",
    [branchId, ingredient.id],
  );
  if (Number(stock.quantity_on_hand) !== 9)
    throw new Error(`Expected stock 9; got ${stock.quantity_on_hand}`);
  pass("Recipe stock deducted exactly once");
  const supplier = await api("/suppliers", {
    method: "POST",
    body: {
      code: `TEST-SUP-${stamp}`,
      name: `Integration Supplier ${stamp}`,
      is_active: 1,
    },
  });
  const purchase = await step("Create purchase", () =>
    api("/purchases", {
      method: "POST",
      body: {
        branch_id: branchId,
        supplier_id: supplier.id,
        items: [
          { ingredient_id: ingredient.id, ordered_quantity: 2, unit_cost: 3 },
        ],
      },
    }),
  );
  await step("Receive purchase and weighted stock", () =>
    api(`/purchases/${purchase.id}/receive`, {
      method: "POST",
      body: { branch_id: branchId },
    }),
  );
  const expenseCategories = await api("/expenseCategories");
  await step("Create paid expense", () =>
    api("/expenses", {
      method: "POST",
      body: {
        branch_id: branchId,
        category_id: expenseCategories.items[0].id,
        title: `Integration Expense ${stamp}`,
        amount: 1,
        currency_code: "USD",
        exchange_rate: 1,
        payment_method: "cash",
        status: "paid",
      },
    }),
  );
  const reservation = await step("Create reservation", () =>
    api("/reservations", {
      method: "POST",
      body: {
        branch_id: branchId,
        guest_name: "Integration Guest",
        guest_phone: `TEST${stamp}`,
        guest_count: 2,
        reservation_at: new Date(Date.now() + 86400000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
        status: "pending",
      },
    }),
  );
  await step("Confirm reservation and reserve table", () =>
    api(`/reservations/${reservation.id}/confirm`, {
      method: "POST",
      body: { branch_id: branchId, table_id: table.id },
    }),
  );
  const reservationOrder = await step(
    "Check in reservation and open order",
    () =>
      api(`/reservations/${reservation.id}/check-in`, {
        method: "POST",
        body: { branch_id: branchId },
      }),
  );
  await step("Add item to reservation order", () =>
    api(`/orders/${reservationOrder.order_id}/items`, {
      method: "POST",
      body: {
        branch_id: branchId,
        submission_key: `RSV-${stamp}`,
        items: [{ menu_item_id: menu.id, quantity: 1 }],
      },
    }),
  );
  await step("Pay reservation order", () =>
    api(`/orders/${reservationOrder.order_id}/payments`, {
      method: "POST",
      body: {
        branch_id: branchId,
        request_key: `RSVPAY-${stamp}`,
        payments: [
          {
            payment_method: "cash",
            currency_code: "USD",
            exchange_rate: 1,
            tendered_amount: 10,
            cash_session_id: cashSession.id,
          },
        ],
      },
    }),
  );
  await step("Complete reservation and release table", async () => {
    const reservations = await api(`/reservations?branch_id=${branchId}`);
    const completed = reservations.find((item) => item.id === reservation.id);
    if (completed?.status !== "completed")
      throw new Error(
        `Expected completed reservation; got ${completed?.status}`,
      );
    const tableRows = await api(`/table-operations?branch_id=${branchId}`);
    const released = tableRows.find((item) => item.id === table.id);
    if (released?.status !== "available")
      throw new Error(`Expected available table; got ${released?.status}`);
    return completed;
  });
  await step("Save branch settings batch", () =>
    api("/settings/batch", {
      method: "PUT",
      body: {
        branch_id: branchId,
        scope: "branch",
        settings: [{ key: "theme_mode", value: "system" }],
      },
    }),
  );
  await step("Dashboard report", () => api(`/dashboard?branch_id=${branchId}`));
  const reportDate = new Date().toISOString().slice(0, 10);
  await step("Printable sales/purchase/expense reports", () =>
    api(`/reports?branch_id=${branchId}&from=${reportDate}&to=${reportDate}`),
  );
  console.log("\nINTEGRATION TEST PASSED");
} catch (_e) {
  process.exitCode = 1;
} finally {
  await pool.end();
}
