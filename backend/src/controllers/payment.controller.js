import { pool, withTransaction } from "../config/database.js";
import { resolveBranchId } from "../middleware/permission.middleware.js";
import { nextNumber } from "../services/sequence.service.js";
import { ApiError } from "../utils/api-error.js";

export async function pay(req, res) {
  const b = resolveBranchId(req);
  const requestKey = String(req.body.request_key || "");
  if (!/^[A-Za-z0-9-]{8,100}$/.test(requestKey))
    throw new ApiError(422, "Valid request_key is required");
  if (!Array.isArray(req.body.payments))
    throw new ApiError(422, "Payments must be an array");
  const result = await withTransaction(async (db) => {
    const splitEnabled = await effectiveBoolean(
      db,
      b,
      "allow_split_payment",
      true,
    );
    const cashShiftRequired = await effectiveBoolean(
      db,
      b,
      "require_cash_shift",
      true,
    );
    if (!splitEnabled && req.body.payments.length > 1)
      throw new ApiError(409, "Split payment is disabled in System Settings");
    const [[o]] = await db.execute(
      "SELECT * FROM orders WHERE id=? AND branch_id=? FOR UPDATE",
      [req.params.orderId, b],
    );
    if (!o || ["cancelled", "voided"].includes(o.status))
      throw new ApiError(409, "Order cannot be paid");
    const [duplicate] = await db.execute(
      "SELECT id,payment_no FROM payments WHERE order_id=? AND request_key LIKE CONCAT(?,'-%')",
      [o.id, requestKey],
    );
    if (duplicate.length)
      return {
        payments: duplicate,
        paid_amount: o.paid_amount,
        balance_amount: o.balance_amount,
        status: o.status,
        idempotent: true,
      };
    if (o.status === "paid") {
      if (Number(o.total_amount) <= 0.000001)
        return {
          payments: [],
          paid_amount: o.paid_amount,
          balance_amount: 0,
          status: "paid",
          idempotent: true,
        };
      throw new ApiError(409, "Order is already paid");
    }
    let remaining = Math.max(0, Number(o.total_amount) - Number(o.paid_amount));
    if (remaining > 0.000001 && !req.body.payments.length)
      throw new ApiError(422, "At least one payment is required");
    const created = [];
    for (
      let index = 0;
      index < req.body.payments.length && remaining > 0;
      index++
    ) {
      const p = req.body.payments[index];
      const method = p.payment_method;
      const currency = p.currency_code || "USD";
      const rate = currency === "KHR" ? Number(p.exchange_rate) : 1;
      const tendered = Number(p.tendered_amount);
      const [[paymentMethod]] = await db.execute(
        `SELECT code,name,name_kh,method_type,requires_reference FROM payment_methods
          WHERE branch_id=? AND code=? AND is_active=1 LIMIT 1`,
        [b, method],
      );
      if (
        !paymentMethod ||
        !["USD", "KHR"].includes(currency) ||
        rate <= 0 ||
        tendered <= 0
      )
        throw new ApiError(422, "Invalid payment details");
      if (
        paymentMethod.requires_reference &&
        !String(p.reference_no || "").trim()
      )
        throw new ApiError(422, "Transaction reference is required");
      if (paymentMethod.method_type === "cash" && cashShiftRequired)
        await assertCashSession(db, p.cash_session_id, b, req.user.id);
      if (paymentMethod.method_type === "credit")
        await assertCustomerCredit(db, o, remaining);
      const base = tendered / rate;
      const applied = Math.min(remaining, base);
      const no = await nextNumber(db, b, "payment");
      const itemKey = `${requestKey}-${index}`;
      const [r] = await db.execute(
        `INSERT INTO payments(branch_id,order_id,cash_session_id,payment_no,request_key,payment_method,currency_code,exchange_rate,tendered_amount,applied_amount,base_amount,change_amount,reference_no,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          b,
          o.id,
          p.cash_session_id || null,
          no,
          itemKey,
          method,
          currency,
          rate,
          tendered,
          applied,
          applied,
          paymentMethod.method_type === "cash"
            ? Math.max(0, base - applied)
            : 0,
          p.reference_no || null,
          req.user.id,
        ],
      );
      if (paymentMethod.method_type === "credit")
        await db.execute(
          "UPDATE customers SET current_balance=current_balance+? WHERE id=?",
          [applied, o.customer_id],
        );
      created.push({
        id: r.insertId,
        payment_no: no,
        method,
        method_name: paymentMethod.name_kh || paymentMethod.name,
        applied_amount: applied,
        change_amount:
          paymentMethod.method_type === "cash"
            ? Math.max(0, base - applied)
            : 0,
      });
      remaining -= applied;
    }
    const paid = Number(o.total_amount) - remaining;
    const status = remaining <= 0.000001 ? "paid" : "partially_paid";
    await db.execute(
      `UPDATE orders SET paid_amount=?,balance_amount=?,status=?,closed_by=IF(?='paid',?,closed_by),closed_at=IF(?='paid',NOW(),closed_at) WHERE id=?`,
      [paid, Math.max(0, remaining), status, status, req.user.id, status, o.id],
    );
    if (status === "paid" && o.reservation_id)
      await db.execute(
        `UPDATE reservations
            SET status='completed',completed_at=NOW(),completed_by=?
          WHERE id=? AND branch_id=? AND status='seated'`,
        [req.user.id, o.reservation_id, b],
      );
    if (status === "paid" && o.table_id)
      await db.execute(
        `UPDATE restaurant_tables t
            SET t.status=IF(EXISTS(
              SELECT 1 FROM reservations r
               WHERE r.table_id=t.id AND r.branch_id=? AND r.status='confirmed'
                 AND r.id<>COALESCE(?,0)
            ),'reserved','available')
          WHERE t.id=? AND t.branch_id=?`,
        [b, o.reservation_id, o.table_id, b],
      );
    if (status === "paid") await deductStockOnce(db, o, b, req.user.id);
    return {
      payments: created,
      paid_amount: paid,
      balance_amount: Math.max(0, remaining),
      status,
    };
  });
  req.app
    .get("io")
    .to(`branch:${b}`)
    .emit("payment:completed", {
      orderId: Number(req.params.orderId),
      ...result,
    });
  res.status(201).json({ success: true, data: result });
}
async function effectiveBoolean(db, branchId, key, fallback) {
  const [[row]] = await db.execute(
    `SELECT setting_value FROM settings WHERE setting_key=? AND (branch_id=? OR branch_id IS NULL)
     ORDER BY branch_id IS NOT NULL DESC,id DESC LIMIT 1`,
    [key, branchId],
  );
  if (!row) return fallback;
  return ["true", "1"].includes(String(row.setting_value).toLowerCase());
}
async function assertCashSession(db, id, branchId, userId) {
  if (!id) throw new ApiError(409, "Open cash shift before receiving cash");
  const [[s]] = await db.execute(
    `SELECT cs.id FROM cash_sessions cs JOIN cash_registers cr ON cr.id=cs.cash_register_id WHERE cs.id=? AND cr.branch_id=? AND cs.opened_by=? AND cs.status='open' FOR UPDATE`,
    [id, branchId, userId],
  );
  if (!s) throw new ApiError(409, "Cash shift is not open for this cashier");
}
async function assertCustomerCredit(db, o, amount) {
  if (!o.customer_id)
    throw new ApiError(422, "Customer is required for credit payment");
  const [[c]] = await db.execute(
    "SELECT * FROM customers WHERE id=? AND is_active=1 FOR UPDATE",
    [o.customer_id],
  );
  if (!c) throw new ApiError(422, "Customer unavailable");
  if (
    Number(c.credit_limit) <= 0 ||
    Number(c.current_balance) + amount > Number(c.credit_limit)
  )
    throw new ApiError(409, "Customer credit limit exceeded");
}
async function deductStockOnce(db, o, b, user) {
  const [[done]] = await db.execute(
    "SELECT id FROM stock_movements WHERE branch_id=? AND reference_type='order' AND reference_id=? AND movement_type='sale' LIMIT 1",
    [b, o.id],
  );
  if (done) return;
  const [rows] = await db.execute(
    `SELECT r.ingredient_id,SUM(r.quantity*(1+r.wastage_percent/100)*oi.quantity) qty FROM order_items oi JOIN recipes r ON r.menu_item_id=oi.menu_item_id WHERE oi.order_id=? AND oi.kitchen_status<>'cancelled' GROUP BY r.ingredient_id`,
    [o.id],
  );
  const allowNegative = await effectiveBoolean(
    db,
    b,
    "allow_negative_stock",
    false,
  );
  for (const x of rows) {
    const [[inv]] = await db.execute(
      "SELECT * FROM inventory WHERE branch_id=? AND ingredient_id=? FOR UPDATE",
      [b, x.ingredient_id],
    );
    if (!inv)
      throw new ApiError(
        409,
        `Missing inventory row for ingredient ${x.ingredient_id}`,
      );
    const balance = Number(inv.quantity_on_hand) - Number(x.qty);
    if (balance < 0 && !allowNegative)
      throw new ApiError(
        409,
        `Insufficient stock for ingredient ${x.ingredient_id}`,
      );
    await db.execute(
      "UPDATE inventory SET quantity_on_hand=?,last_movement_at=NOW() WHERE branch_id=? AND ingredient_id=?",
      [balance, b, x.ingredient_id],
    );
    await db.execute(
      `INSERT INTO stock_movements(branch_id,ingredient_id,movement_type,quantity,unit_cost,balance_after,reference_type,reference_id,created_by) VALUES(?,?,'sale',?,?,?,'order',?,?)`,
      [
        b,
        x.ingredient_id,
        -Number(x.qty),
        inv.average_cost,
        balance,
        o.id,
        user,
      ],
    );
  }
}
export async function list(req, res) {
  const b = resolveBranchId(req);
  const [rows] = await pool.execute(
    `SELECT p.*,COALESCE(NULLIF(pm.name_kh,''),pm.name,p.payment_method) method_name
       FROM payments p
       LEFT JOIN payment_methods pm ON pm.branch_id=p.branch_id AND pm.code=p.payment_method
      WHERE p.branch_id=? AND p.order_id=? ORDER BY p.paid_at`,
    [b, req.params.orderId],
  );
  res.json({ success: true, data: rows });
}
export async function voidPayment(req, res) {
  const b = resolveBranchId(req);
  await withTransaction(async (db) => {
    const [[p]] = await db.execute(
      "SELECT p.*,o.customer_id,o.table_id,o.reservation_id FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=? AND p.branch_id=? FOR UPDATE",
      [req.params.id, b],
    );
    if (!p || p.status !== "completed")
      throw new ApiError(409, "Payment unavailable");
    if (!String(req.body.reason || "").trim())
      throw new ApiError(422, "Void reason is required");
    await db.execute(
      "UPDATE payments SET status='voided',voided_by=?,voided_at=NOW(),void_reason=? WHERE id=?",
      [req.user.id, req.body.reason, p.id],
    );
    await db.execute(
      `UPDATE orders SET paid_amount=GREATEST(0,paid_amount-?),balance_amount=LEAST(total_amount,balance_amount+?),status=IF(paid_amount-?<=0,'open','partially_paid'),closed_at=NULL,closed_by=NULL WHERE id=?`,
      [p.applied_amount, p.applied_amount, p.applied_amount, p.order_id],
    );
    if (p.payment_method === "credit" && p.customer_id)
      await db.execute(
        "UPDATE customers SET current_balance=GREATEST(0,current_balance-?) WHERE id=?",
        [p.applied_amount, p.customer_id],
      );
    if (p.reservation_id)
      await db.execute(
        `UPDATE reservations
            SET status='seated',completed_at=NULL,completed_by=NULL
          WHERE id=? AND branch_id=? AND status='completed'`,
        [p.reservation_id, b],
      );
    if (p.table_id)
      await db.execute(
        "UPDATE restaurant_tables SET status='occupied' WHERE id=? AND branch_id=? AND is_active=1",
        [p.table_id, b],
      );
  });
  res.json({ success: true });
}

export async function currentCashSession(req, res) {
  const b = resolveBranchId(req);
  const [[row]] = await pool.execute(
    `SELECT cs.*,cr.name register_name,
            COALESCE(pt.cash_sales,0) cash_sales,
            COALESCE(pt.non_cash_sales,0) non_cash_sales,
            cs.opening_amount+COALESCE(pt.cash_sales,0) live_expected_amount
       FROM cash_sessions cs
       JOIN cash_registers cr ON cr.id=cs.cash_register_id
       LEFT JOIN (
         SELECT cash_session_id,
                SUM(CASE WHEN COALESCE(pm.method_type,IF(p.payment_method='cash','cash','other'))='cash' THEN p.base_amount ELSE 0 END) cash_sales,
                SUM(CASE WHEN COALESCE(pm.method_type,IF(p.payment_method='cash','cash','other'))<>'cash' THEN p.base_amount ELSE 0 END) non_cash_sales
           FROM payments p
           LEFT JOIN payment_methods pm ON pm.branch_id=p.branch_id AND pm.code=p.payment_method
          WHERE p.status='completed' GROUP BY cash_session_id
       ) pt ON pt.cash_session_id=cs.id
      WHERE cr.branch_id=? AND cs.opened_by=? AND cs.status='open'
      ORDER BY cs.id DESC LIMIT 1`,
    [b, req.user.id],
  );
  res.json({ success: true, data: row || null });
}
export async function openCashSession(req, res) {
  const b = resolveBranchId(req);
  const opening = Number(req.body.opening_amount || 0);
  if (!Number.isFinite(opening) || opening < 0)
    throw new ApiError(422, "Opening amount must be zero or greater");
  const data = await withTransaction(async (db) => {
    const [[existing]] = await db.execute(
      `SELECT cs.id FROM cash_sessions cs JOIN cash_registers cr ON cr.id=cs.cash_register_id WHERE cr.branch_id=? AND cs.opened_by=? AND cs.status='open' FOR UPDATE`,
      [b, req.user.id],
    );
    if (existing) throw new ApiError(409, "Cash shift is already open");
    const [[register]] = await db.execute(
      "SELECT id FROM cash_registers WHERE id=? AND branch_id=? AND is_active=1",
      [req.body.cash_register_id, b],
    );
    if (!register) throw new ApiError(422, "Cash register unavailable");
    const [r] = await db.execute(
      "INSERT INTO cash_sessions(cash_register_id,opened_by,opening_amount,status) VALUES(?,?,?,'open')",
      [register.id, req.user.id, opening],
    );
    return {
      id: r.insertId,
      opening_amount: opening,
    };
  });
  res.status(201).json({ success: true, data });
}
export async function closeCashSession(req, res) {
  const b = resolveBranchId(req);
  const closing = Number(req.body.closing_amount);
  if (!Number.isFinite(closing) || closing < 0)
    throw new ApiError(422, "Closing amount must be zero or greater");
  const data = await withTransaction(async (db) => {
    const [[s]] = await db.execute(
      `SELECT cs.* FROM cash_sessions cs JOIN cash_registers cr ON cr.id=cs.cash_register_id WHERE cs.id=? AND cr.branch_id=? AND cs.opened_by=? AND cs.status='open' FOR UPDATE`,
      [req.params.id, b, req.user.id],
    );
    if (!s) throw new ApiError(409, "Open cash shift not found");
    const [[cash]] = await db.execute(
      `SELECT COALESCE(SUM(p.base_amount),0) total
         FROM payments p
         LEFT JOIN payment_methods pm ON pm.branch_id=p.branch_id AND pm.code=p.payment_method
        WHERE p.cash_session_id=? AND p.status='completed'
          AND COALESCE(pm.method_type,IF(p.payment_method='cash','cash','other'))='cash'`,
      [s.id],
    );
    const expected = Number(s.opening_amount) + Number(cash.total);
    await db.execute(
      `UPDATE cash_sessions SET expected_amount=?,closing_amount=?,difference_amount=?,status='closed',closed_by=?,closed_at=NOW(),notes=? WHERE id=?`,
      [
        expected,
        closing,
        closing - expected,
        req.user.id,
        req.body.notes || null,
        s.id,
      ],
    );
    return {
      id: s.id,
      expected_amount: expected,
      closing_amount: closing,
      difference_amount: closing - expected,
    };
  });
  res.json({ success: true, data });
}
export async function registers(req, res) {
  const b = resolveBranchId(req);
  const [rows] = await pool.execute(
    "SELECT * FROM cash_registers WHERE branch_id=? AND is_active=1 ORDER BY id",
    [b],
  );
  res.json({ success: true, data: rows });
}
