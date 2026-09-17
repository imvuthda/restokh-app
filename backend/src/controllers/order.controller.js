import { pool, withTransaction } from "../config/database.js";
import { resolveBranchId } from "../middleware/permission.middleware.js";
import { nextNumber } from "../services/sequence.service.js";
import { ApiError } from "../utils/api-error.js";
import { writeAudit } from "../middleware/audit.middleware.js";

async function effectiveNumber(db, branchId, key, fallback = 0) {
  const [[row]] = await db.execute(
    `SELECT setting_value FROM settings WHERE setting_key=? AND (branch_id=? OR branch_id IS NULL)
     ORDER BY branch_id IS NOT NULL DESC,id DESC LIMIT 1`,
    [key, branchId],
  );
  const value = Number(row?.setting_value);
  return Number.isFinite(value) ? value : fallback;
}

async function detail(id, branchId, db = pool) {
  const [[order]] = await db.execute(
    `SELECT o.*,
            t.code AS table_code,
            t.name AS table_name,
            b.name AS branch_name,
            b.name_kh AS branch_name_kh,
            u.full_name AS cashier_name,
            c.name AS customer_name,
            c.name_kh AS customer_name_kh,
            du.full_name AS discount_applied_by_name
       FROM orders o
       LEFT JOIN restaurant_tables t ON t.id=o.table_id
       JOIN branches b ON b.id=o.branch_id
       JOIN users u ON u.id=o.opened_by
       LEFT JOIN customers c ON c.id=o.customer_id
       LEFT JOIN users du ON du.id=o.discount_applied_by
      WHERE o.id=? AND o.branch_id=?`,
    [id, branchId],
  );
  if (!order) throw new ApiError(404, "Order not found");
  const [items] = await db.execute(
    "SELECT * FROM order_items WHERE order_id=? ORDER BY id",
    [id],
  );
  return { ...order, items };
}
export async function list(req, res) {
  const b = resolveBranchId(req);
  const args = [b];
  let where = "branch_id=?";
  if (req.query.status) {
    where += " AND status=?";
    args.push(req.query.status);
  }
  const [rows] = await pool.execute(
    `SELECT * FROM orders WHERE ${where} ORDER BY opened_at DESC LIMIT 200`,
    args,
  );
  res.json({ success: true, data: rows });
}
export async function get(req, res) {
  res.json({
    success: true,
    data: await detail(req.params.id, resolveBranchId(req)),
  });
}
export async function create(req, res) {
  const branchId = resolveBranchId(req);
  const result = await withTransaction(async (db) => {
    if (req.body.table_id) {
      const [[t]] = await db.execute(
        "SELECT * FROM restaurant_tables WHERE id=? AND branch_id=? FOR UPDATE",
        [req.body.table_id, branchId],
      );
      if (!t || !t.is_active) throw new ApiError(409, "Table unavailable");
      if (t.status === "occupied")
        throw new ApiError(409, "Table already occupied");
      if (t.status === "reserved" && !req.body.reservation_id)
        throw new ApiError(
          409,
          "Check in the reservation before opening this table",
        );
      if (["cleaning", "inactive"].includes(t.status))
        throw new ApiError(409, "Table unavailable");
    }
    if (req.body.reservation_id) {
      const [[reservation]] = await db.execute(
        "SELECT * FROM reservations WHERE id=? AND branch_id=? FOR UPDATE",
        [req.body.reservation_id, branchId],
      );
      if (
        !reservation ||
        reservation.status !== "seated" ||
        Number(reservation.table_id) !== Number(req.body.table_id)
      )
        throw new ApiError(409, "Reservation must be checked in first");
      const [[existingOrder]] = await db.execute(
        "SELECT id FROM orders WHERE reservation_id=? AND status NOT IN('cancelled','voided') LIMIT 1",
        [reservation.id],
      );
      if (existingOrder)
        throw new ApiError(409, "Reservation already has an order");
    }
    const no = await nextNumber(db, branchId, "order");
    const serviceRate = await effectiveNumber(
      db,
      branchId,
      "service_charge_rate",
      0,
    );
    let customerId = null;
    let customerDiscount = 0;
    if (req.body.customer_id) {
      const [[customer]] = await db.execute(
        "SELECT id,default_discount_percent FROM customers WHERE id=? AND is_active=1",
        [req.body.customer_id],
      );
      if (!customer) throw new ApiError(422, "Customer unavailable");
      customerId = customer.id;
      customerDiscount = Math.min(
        100,
        Math.max(0, Number(customer.default_discount_percent || 0)),
      );
    }
    const [r] = await db.execute(
      `INSERT INTO orders(branch_id,table_id,customer_id,reservation_id,order_no,order_type,status,guest_count,
        discount_type,discount_value,discount_reason,discount_applied_by,discount_applied_at,
        service_charge_rate,notes,opened_by)
       VALUES(?,?,?,?,?,?,'open',?,?,?,?,?,?,?,?,?)`,
      [
        branchId,
        req.body.table_id || null,
        customerId,
        req.body.reservation_id || null,
        no,
        req.body.order_type || "dine_in",
        req.body.guest_count || 1,
        customerDiscount > 0 ? "percent" : "none",
        customerDiscount,
        customerDiscount > 0 ? "បញ្ចុះតម្លៃលំនាំដើមរបស់អតិថិជន" : null,
        customerDiscount > 0 ? req.user.id : null,
        customerDiscount > 0 ? new Date() : null,
        serviceRate,
        req.body.notes || null,
        req.user.id,
      ],
    );
    if (req.body.table_id)
      await db.execute(
        "UPDATE restaurant_tables SET status='occupied' WHERE id=?",
        [req.body.table_id],
      );
    return detail(r.insertId, branchId, db);
  });
  res.status(201).json({ success: true, data: result });
}
export async function addItems(req, res) {
  const branchId = resolveBranchId(req);
  if (!Array.isArray(req.body.items) || !req.body.items.length)
    throw new ApiError(422, "At least one order item is required");
  const result = await withTransaction(async (db) => {
    const [[o]] = await db.execute(
      "SELECT * FROM orders WHERE id=? AND branch_id=? FOR UPDATE",
      [req.params.id, branchId],
    );
    const taxRate = await effectiveNumber(db, branchId, "tax_rate", 0);
    if (
      !o ||
      !["open", "sent_to_kitchen", "preparing", "ready", "served"].includes(
        o.status,
      )
    )
      throw new ApiError(409, "Order cannot be edited");
    for (let i = 0; i < req.body.items.length; i++) {
      const x = req.body.items[i];
      const [[m]] = await db.execute(
        "SELECT * FROM menu_items WHERE id=? AND is_active=1 AND is_available=1",
        [x.menu_item_id],
      );
      if (!m)
        throw new ApiError(422, `Menu item ${x.menu_item_id} unavailable`);
      const q = Number(x.quantity);
      const price = Number(x.unit_price ?? m.base_price);
      const discount = Number(x.discount_amount || 0);
      if (!Number.isFinite(q) || q <= 0)
        throw new ApiError(422, `Invalid quantity for ${m.name}`);
      if (!Number.isFinite(price) || price < 0)
        throw new ApiError(422, `Invalid price for ${m.name}`);
      if (!Number.isFinite(discount) || discount < 0 || discount > q * price)
        throw new ApiError(422, `Invalid discount for ${m.name}`);
      const tax =
        x.tax_amount == null
          ? (q * price * taxRate) / 100
          : Number(x.tax_amount);
      await db.execute(
        `INSERT INTO order_items(order_id,menu_item_id,kitchen_station_id,submission_key,submission_line,item_name,item_name_kh,quantity,unit_price,unit_cost,discount_amount,tax_amount,line_total,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          o.id,
          m.id,
          m.kitchen_station_id,
          req.body.submission_key || null,
          i,
          m.name,
          m.name_kh,
          q,
          price,
          m.cost_price,
          discount,
          tax,
          q * price - discount + tax,
          x.notes || null,
        ],
      );
    }
    await recalculate(db, o.id);
    return detail(o.id, branchId, db);
  });
  req.app.get("io").to(`branch:${branchId}`).emit("order:updated", result);
  res.json({ success: true, data: result });
}
async function recalculate(db, id) {
  const [[s]] = await db.execute(
    `SELECT
       COALESCE(SUM(CASE WHEN oi.kitchen_status='cancelled' THEN 0 ELSE oi.line_total END),0) subtotal,
       COALESCE(SUM(CASE WHEN oi.kitchen_status<>'cancelled' AND COALESCE(mi.allow_discount,1)=1 THEN oi.line_total ELSE 0 END),0) discountable_subtotal
       FROM order_items oi
       LEFT JOIN menu_items mi ON mi.id=oi.menu_item_id
      WHERE oi.order_id=?`,
    [id],
  );
  const [[o]] = await db.execute("SELECT * FROM orders WHERE id=?", [id]);
  const requestedDiscount =
    o.discount_type === "percent"
      ? (Number(s.discountable_subtotal) * Number(o.discount_value)) / 100
      : o.discount_type === "fixed"
        ? Number(o.discount_value)
        : 0;
  const discount = Math.min(
    Number(s.discountable_subtotal),
    Math.max(0, requestedDiscount),
  );
  const service = ((s.subtotal - discount) * o.service_charge_rate) / 100;
  const total = Math.max(
    0,
    s.subtotal -
      discount +
      service +
      Number(o.tax_amount) +
      Number(o.rounding_amount),
  );
  await db.execute(
    "UPDATE orders SET subtotal=?,discount_amount=?,service_charge_amount=?,total_amount=?,balance_amount=GREATEST(0,?-paid_amount) WHERE id=?",
    [s.subtotal, discount, service, total, total, id],
  );
}

export async function updateDiscount(req, res) {
  const branchId = resolveBranchId(req);
  const discountType = String(req.body.discount_type || "none");
  const discountValue = Number(req.body.discount_value || 0);
  const reason = String(req.body.discount_reason || "").trim();
  if (!["none", "percent", "fixed"].includes(discountType))
    throw new ApiError(422, "Invalid discount type");
  if (!Number.isFinite(discountValue) || discountValue < 0)
    throw new ApiError(422, "Invalid discount value");
  if (discountType === "percent" && discountValue > 100)
    throw new ApiError(422, "Percentage discount cannot exceed 100%");
  if (discountType !== "none" && discountValue > 0 && reason.length < 3)
    throw new ApiError(422, "Discount reason is required");
  const result = await withTransaction(async (db) => {
    const [[order]] = await db.execute(
      "SELECT * FROM orders WHERE id=? AND branch_id=? FOR UPDATE",
      [req.params.id, branchId],
    );
    if (!order) throw new ApiError(404, "Order not found");
    if (["paid", "cancelled", "voided"].includes(order.status))
      throw new ApiError(409, "Completed order discount cannot be changed");
    if (Number(order.paid_amount) > 0)
      throw new ApiError(409, "Discount cannot change after payment starts");
    const [[eligible]] = await db.execute(
      `SELECT COALESCE(SUM(CASE WHEN oi.kitchen_status<>'cancelled' AND COALESCE(mi.allow_discount,1)=1
        THEN oi.line_total ELSE 0 END),0) amount
         FROM order_items oi LEFT JOIN menu_items mi ON mi.id=oi.menu_item_id
        WHERE oi.order_id=?`,
      [order.id],
    );
    if (discountType === "fixed" && discountValue > Number(eligible.amount))
      throw new ApiError(422, "Fixed discount exceeds discountable subtotal");
    const activeType = discountValue > 0 ? discountType : "none";
    await db.execute(
      `UPDATE orders SET discount_type=?,discount_value=?,discount_reason=?,
        discount_applied_by=?,discount_applied_at=? WHERE id=?`,
      [
        activeType,
        activeType === "none" ? 0 : discountValue,
        activeType === "none" ? null : reason,
        activeType === "none" ? null : req.user.id,
        activeType === "none" ? null : new Date(),
        order.id,
      ],
    );
    await recalculate(db, order.id);
    await writeAudit(
      req,
      activeType === "none" ? "remove_discount" : "apply_discount",
      "order",
      order.id,
      {
        discount_type: order.discount_type,
        discount_value: order.discount_value,
        discount_reason: order.discount_reason,
      },
      {
        discount_type: activeType,
        discount_value: activeType === "none" ? 0 : discountValue,
        discount_reason: activeType === "none" ? null : reason,
      },
      db,
    );
    return detail(order.id, branchId, db);
  });
  req.app.get("io").to(`branch:${branchId}`).emit("order:updated", result);
  res.json({ success: true, data: result });
}
export async function sendKitchen(req, res) {
  const branchId = resolveBranchId(req);
  const data = await withTransaction(async (db) => {
    const [[o]] = await db.execute(
      "SELECT * FROM orders WHERE id=? AND branch_id=? FOR UPDATE",
      [req.params.id, branchId],
    );
    if (!o) throw new ApiError(404, "Order not found");
    const [groups] = await db.execute(
      `SELECT kitchen_station_id,GROUP_CONCAT(id) ids FROM order_items WHERE order_id=? AND kitchen_status='pending' AND kitchen_station_id IS NOT NULL GROUP BY kitchen_station_id`,
      [o.id],
    );
    for (const g of groups) {
      const no = await nextNumber(db, branchId, "kitchen_ticket");
      const [t] = await db.execute(
        `INSERT INTO kitchen_tickets(branch_id,order_id,kitchen_station_id,ticket_no,status) VALUES(?,?,?,?,'new')`,
        [branchId, o.id, g.kitchen_station_id, no],
      );
      const ids = g.ids.split(",").map(Number);
      for (const id of ids)
        await db.execute(
          "INSERT INTO kitchen_ticket_items(kitchen_ticket_id,order_item_id) VALUES(?,?)",
          [t.insertId, id],
        );
      await db.execute(
        `UPDATE order_items SET kitchen_status='sent',sent_at=NOW() WHERE id IN (${ids.map(() => "?").join(",")})`,
        ids,
      );
    }
    await db.execute(
      "UPDATE orders SET status=IF(EXISTS(SELECT 1 FROM order_items WHERE order_id=? AND kitchen_station_id IS NOT NULL),'sent_to_kitchen','served') WHERE id=?",
      [o.id, o.id],
    );
    return detail(o.id, branchId, db);
  });
  req.app.get("io").to(`branch:${branchId}`).emit("kitchen:new", data);
  res.json({ success: true, data });
}
export async function cancelItem(req, res) {
  const b = resolveBranchId(req);
  await withTransaction(async (db) => {
    const [[x]] = await db.execute(
      `SELECT oi.* FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.id=? AND o.id=? AND o.branch_id=? FOR UPDATE`,
      [req.params.itemId, req.params.id, b],
    );
    if (!x) throw new ApiError(404, "Item not found");
    await db.execute(
      "UPDATE order_items SET kitchen_status='cancelled',cancelled_at=NOW(),cancelled_by=?,cancellation_reason=? WHERE id=?",
      [req.user.id, req.body.reason, x.id],
    );
    await recalculate(db, req.params.id);
  });
  res.json({ success: true });
}
export async function cancelOrder(req, res) {
  const b = resolveBranchId(req);
  const reason = String(req.body.reason || "").trim();
  if (reason.length < 3)
    throw new ApiError(422, "Cancellation reason is required");
  const result = await withTransaction(async (db) => {
    const [[order]] = await db.execute(
      "SELECT * FROM orders WHERE id=? AND branch_id=? FOR UPDATE",
      [req.params.id, b],
    );
    if (!order) throw new ApiError(404, "Order not found");
    if (["paid", "cancelled", "voided"].includes(order.status))
      throw new ApiError(409, "Order cannot be cancelled");
    const [[payment]] = await db.execute(
      "SELECT id FROM payments WHERE order_id=? AND status='completed' LIMIT 1",
      [order.id],
    );
    if (payment)
      throw new ApiError(409, "Void active payments before cancelling order");
    await db.execute(
      `UPDATE order_items
          SET kitchen_status='cancelled',cancelled_at=NOW(),cancelled_by=?,cancellation_reason=?
        WHERE order_id=? AND kitchen_status<>'cancelled'`,
      [req.user.id, reason, order.id],
    );
    await db.execute(
      "UPDATE kitchen_tickets SET status='cancelled' WHERE order_id=? AND status NOT IN('completed','cancelled')",
      [order.id],
    );
    await db.execute(
      "UPDATE orders SET status='cancelled',balance_amount=0,closed_by=?,closed_at=NOW(),notes=CONCAT_WS(' | ',notes,?) WHERE id=?",
      [req.user.id, `Cancelled: ${reason}`, order.id],
    );
    if (order.reservation_id)
      await db.execute(
        `UPDATE reservations
            SET status='cancelled',cancelled_at=NOW(),cancelled_by=?,notes=CONCAT_WS(' | ',notes,?)
          WHERE id=? AND branch_id=? AND status='seated'`,
        [req.user.id, `Order cancelled: ${reason}`, order.reservation_id, b],
      );
    if (order.table_id)
      await db.execute(
        `UPDATE restaurant_tables t
            SET t.status=IF(EXISTS(
              SELECT 1 FROM reservations r
               WHERE r.table_id=t.id AND r.branch_id=? AND r.status='confirmed'
                 AND r.id<>COALESCE(?,0)
            ),'reserved','available')
          WHERE t.id=? AND t.branch_id=?`,
        [b, order.reservation_id, order.table_id, b],
      );
    await writeAudit(
      req,
      "cancel",
      "order",
      order.id,
      { status: order.status },
      { status: "cancelled", reason },
      db,
    );
    return { id: order.id, table_id: order.table_id, status: "cancelled" };
  });
  const room = req.app.get("io").to(`branch:${b}`);
  room.emit("order:updated", result);
  room.emit("kitchen:updated", { orderId: result.id, status: "cancelled" });
  room.emit("table:updated", {
    tableId: result.table_id,
    status: "available",
  });
  res.json({ success: true, data: result });
}
export async function transferTable(req, res) {
  const b = resolveBranchId(req);
  const result = await withTransaction(async (db) => {
    const [[o]] = await db.execute(
      "SELECT * FROM orders WHERE id=? AND branch_id=? FOR UPDATE",
      [req.params.id, b],
    );
    const [[t]] = await db.execute(
      "SELECT * FROM restaurant_tables WHERE id=? AND branch_id=? FOR UPDATE",
      [req.body.to_table_id, b],
    );
    if (!o || !t || t.status !== "available")
      throw new ApiError(409, "Order or destination table unavailable");
    if (o.table_id)
      await db.execute(
        `UPDATE restaurant_tables old_table
            SET old_table.status=IF(EXISTS(
              SELECT 1 FROM reservations r
               WHERE r.table_id=old_table.id AND r.branch_id=? AND r.status='confirmed'
                 AND r.id<>COALESCE(?,0)
            ),'reserved','available')
          WHERE old_table.id=? AND old_table.branch_id=?`,
        [b, o.reservation_id, o.table_id, b],
      );
    await db.execute(
      "UPDATE restaurant_tables SET status='occupied' WHERE id=?",
      [t.id],
    );
    await db.execute("UPDATE orders SET table_id=? WHERE id=?", [t.id, o.id]);
    if (o.reservation_id)
      await db.execute(
        "UPDATE reservations SET table_id=? WHERE id=? AND branch_id=? AND status='seated'",
        [t.id, o.reservation_id, b],
      );
    await db.execute(
      "INSERT INTO table_transfers(order_id,from_table_id,to_table_id,transferred_by,reason) VALUES(?,?,?,?,?)",
      [o.id, o.table_id, t.id, req.user.id, req.body.reason || null],
    );
    return { order_id: o.id, from_table_id: o.table_id, to_table_id: t.id };
  });
  const room = req.app.get("io").to(`branch:${b}`);
  room.emit("table:updated", { tableId: result.from_table_id });
  room.emit("table:updated", {
    tableId: result.to_table_id,
    status: "occupied",
  });
  room.emit("reservation:updated", { order_id: result.order_id });
  res.json({ success: true, data: result });
}
export async function tableOverview(req, res) {
  const b = resolveBranchId(req);
  const [rows] = await pool.execute(
    `SELECT t.*,a.name area_name,a.name_kh area_name_kh,
            o.id open_order_id,o.order_no,o.status order_status,o.total_amount,o.opened_at,u.full_name waiter_name,
            rv.id reservation_id,rv.reservation_no,rv.guest_name reservation_guest_name,
            rv.guest_count reservation_guest_count,rv.reservation_at,rv.status reservation_status
       FROM restaurant_tables t
       JOIN dining_areas a ON a.id=t.dining_area_id
       LEFT JOIN orders o ON o.id=(SELECT oo.id FROM orders oo WHERE oo.table_id=t.id AND oo.branch_id=t.branch_id AND oo.status NOT IN('paid','cancelled','voided') ORDER BY oo.id DESC LIMIT 1)
       LEFT JOIN users u ON u.id=o.opened_by
       LEFT JOIN reservations rv ON rv.id=(SELECT rr.id FROM reservations rr WHERE rr.table_id=t.id AND rr.branch_id=t.branch_id AND rr.status IN('confirmed','seated') ORDER BY rr.status='seated' DESC,rr.reservation_at LIMIT 1)
      WHERE t.branch_id=? AND t.is_active=1 ORDER BY a.sort_order,t.code`,
    [b],
  );
  res.json({ success: true, data: rows });
}
export async function openTableOrder(req, res) {
  const b = resolveBranchId(req);
  const [[row]] = await pool.execute(
    `SELECT id FROM orders WHERE table_id=? AND branch_id=? AND status NOT IN('paid','cancelled','voided') ORDER BY id DESC LIMIT 1`,
    [req.params.tableId, b],
  );
  res.json({ success: true, data: row ? await detail(row.id, b) : null });
}
export async function setTableStatus(req, res) {
  const b = resolveBranchId(req);
  const allowed = ["available", "reserved", "cleaning", "inactive"];
  if (!allowed.includes(req.body.status))
    throw new ApiError(422, "Invalid manual table status");
  await withTransaction(async (db) => {
    const [[t]] = await db.execute(
      "SELECT * FROM restaurant_tables WHERE id=? AND branch_id=? FOR UPDATE",
      [req.params.id, b],
    );
    if (!t) throw new ApiError(404, "Table not found");
    const [[open]] = await db.execute(
      `SELECT id FROM orders WHERE table_id=? AND status NOT IN('paid','cancelled','voided') LIMIT 1`,
      [t.id],
    );
    if (open) throw new ApiError(409, "Table has an open order");
    const [[reservation]] = await db.execute(
      `SELECT id,reservation_no,status FROM reservations
        WHERE table_id=? AND branch_id=? AND status IN('confirmed','seated')
        ORDER BY status='seated' DESC,reservation_at LIMIT 1 FOR UPDATE`,
      [t.id, b],
    );
    if (reservation && req.body.status !== "reserved")
      throw new ApiError(
        409,
        `Table has active reservation ${reservation.reservation_no}`,
      );
    await db.execute("UPDATE restaurant_tables SET status=? WHERE id=?", [
      req.body.status,
      t.id,
    ]);
  });
  req.app
    .get("io")
    .to(`branch:${b}`)
    .emit("table:updated", {
      tableId: Number(req.params.id),
      status: req.body.status,
    });
  res.json({ success: true });
}
