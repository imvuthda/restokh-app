import { pool } from "../config/database.js";
import { resolveBranchId } from "../middleware/permission.middleware.js";
import { nextNumber } from "../services/sequence.service.js";
import { withTransaction } from "../config/database.js";
import { ApiError } from "../utils/api-error.js";
import { deleteManagedUpload } from "../utils/upload-file.js";
export async function inventory(req, res) {
  const b = resolveBranchId(req);
  const [rows] = await pool.execute(
    `SELECT i.*,g.sku,g.name,g.name_kh,g.minimum_stock,u.code unit_code FROM inventory i JOIN ingredients g ON g.id=i.ingredient_id JOIN units u ON u.id=g.unit_id WHERE i.branch_id=? ORDER BY g.name`,
    [b],
  );
  res.json({ success: true, data: rows });
}
export async function movements(req, res) {
  const b = resolveBranchId(req);
  const [rows] = await pool.execute(
    `SELECT sm.*,g.name ingredient_name FROM stock_movements sm JOIN ingredients g ON g.id=sm.ingredient_id WHERE sm.branch_id=? ORDER BY sm.created_at DESC LIMIT 500`,
    [b],
  );
  res.json({ success: true, data: rows });
}
export async function settings(req, res) {
  const b = req.user.isSuperAdmin
    ? Number(req.query.branch_id || 0)
    : req.user.branch_id;
  const [rows] = await pool.execute(
    `SELECT * FROM settings WHERE branch_id IS NULL${b ? " OR branch_id=?" : ""} ORDER BY branch_id,setting_group,setting_key`,
    b ? [b] : [],
  );
  res.json({ success: true, data: rows });
}
export async function publicSettings(req, res) {
  const branchId = Number(req.query.branch_id || 0);
  const [rows] = await pool.execute(
    `SELECT setting_key,setting_value,value_type FROM settings
     WHERE is_public=1 AND (branch_id IS NULL${branchId ? " OR branch_id=?" : ""})
     ORDER BY branch_id IS NULL DESC,id`,
    branchId ? [branchId] : [],
  );
  res.json({
    success: true,
    data: Object.fromEntries(rows.map((x) => [x.setting_key, x.setting_value])),
  });
}
const settingRules = {
  business_name: ["business", "string", true],
  business_name_kh: ["business", "string", true],
  business_phone: ["business", "string", true],
  business_email: ["business", "string", true],
  business_address: ["business", "string", true],
  business_address_kh: ["business", "string", true],
  tax_number: ["business", "string", true],
  logo_url: ["business", "image", true],
  base_currency: ["currency", "string", true],
  secondary_currency: ["currency", "string", true],
  khr_exchange_rate: ["currency", "number", true],
  currency_rounding: ["currency", "number", true],
  service_charge_rate: ["pos", "number", true],
  tax_rate: ["pos", "number", true],
  require_cash_shift: ["pos", "boolean", true],
  allow_split_payment: ["pos", "boolean", true],
  allow_price_override: ["pos", "boolean", false],
  enable_payment_cash: ["payment", "boolean", true],
  enable_payment_aba_khqr: ["payment", "boolean", true],
  enable_payment_card: ["payment", "boolean", true],
  enable_payment_bank_transfer: ["payment", "boolean", true],
  enable_payment_credit: ["payment", "boolean", true],
  enable_payment_other: ["payment", "boolean", true],
  receipt_width: ["receipt", "number", true],
  receipt_header: ["receipt", "string", true],
  receipt_footer: ["receipt", "string", true],
  receipt_show_tax_number: ["receipt", "boolean", true],
  receipt_auto_print: ["receipt", "boolean", false],
  allow_negative_stock: ["inventory", "boolean", false],
  low_stock_alert: ["inventory", "boolean", false],
  default_language: ["display", "string", true],
  timezone: ["display", "string", true],
  primary_color: ["display", "color", true],
  theme_mode: ["display", "string", false],
  maintenance_mode: ["security", "boolean", false],
  session_timeout_minutes: ["security", "number", false],
};
function validateSetting(key, value) {
  const rule = settingRules[key];
  if (!rule) throw new ApiError(422, `Unsupported setting: ${key}`);
  if (
    rule[1] === "number" &&
    (!Number.isFinite(Number(value)) || Number(value) < 0)
  )
    throw new ApiError(422, `${key} must be zero or greater`);
  if (
    rule[1] === "boolean" &&
    !["true", "false", true, false, 1, 0, "1", "0"].includes(value)
  )
    throw new ApiError(422, `${key} must be boolean`);
  if (key === "khr_exchange_rate" && Number(value) < 1)
    throw new ApiError(422, "KHR exchange rate must be greater than zero");
  if (key === "receipt_width" && ![58, 80].includes(Number(value)))
    throw new ApiError(422, "Receipt width must be 58 or 80 mm");
  return rule;
}
export async function saveSettingsBatch(req, res) {
  if (!Array.isArray(req.body.settings) || !req.body.settings.length)
    throw new ApiError(422, "Settings are required");
  const globalScope = req.body.scope === "global";
  if (globalScope && !req.user.isSuperAdmin)
    throw new ApiError(403, "Only super admin can update global settings");
  const branchId = globalScope ? null : resolveBranchId(req);
  const unique = new Map(
    req.body.settings.map((item) => [item.key, item.value]),
  );
  const paymentKeys = [...unique.keys()].filter((key) =>
    key.startsWith("enable_payment_"),
  );
  if (
    paymentKeys.length &&
    paymentKeys.every((key) =>
      [false, 0, "0", "false"].includes(unique.get(key)),
    )
  )
    throw new ApiError(422, "At least one payment method must remain enabled");

  const oldManagedImages = [];
  await withTransaction(async (db) => {
    for (const [key, rawValue] of unique) {
      const [group, type, isPublic] = validateSetting(key, rawValue);
      const value =
        type === "boolean"
          ? [true, 1, "1", "true"].includes(rawValue)
            ? "true"
            : "false"
          : String(rawValue ?? "");
      const [[existing]] = await db.execute(
        `SELECT id,setting_value FROM settings WHERE setting_key=? AND ${branchId === null ? "branch_id IS NULL" : "branch_id=?"} ORDER BY id LIMIT 1 FOR UPDATE`,
        branchId === null ? [key] : [key, branchId],
      );
      if (
        type === "image" &&
        existing?.setting_value &&
        existing.setting_value !== value
      )
        oldManagedImages.push(existing.setting_value);

      if (existing)
        await db.execute(
          "UPDATE settings SET setting_group=?,setting_value=?,value_type=?,is_public=?,updated_by=? WHERE id=?",
          [group, value, type, isPublic ? 1 : 0, req.user.id, existing.id],
        );
      else
        await db.execute(
          "INSERT INTO settings(branch_id,setting_group,setting_key,setting_value,value_type,is_public,updated_by) VALUES(?,?,?,?,?,?,?)",
          [branchId, group, key, value, type, isPublic ? 1 : 0, req.user.id],
        );
    }
  });

  for (const oldUrl of new Set(oldManagedImages)) {
    const [[reference]] = await pool.execute(
      "SELECT COUNT(*) total FROM settings WHERE setting_value=?",
      [oldUrl],
    );
    if (!Number(reference.total)) await deleteManagedUpload(oldUrl);
  }

  res.json({ success: true, message: "Settings saved" });
}
export async function saveSetting(req, res) {
  const [group, type, isPublic] = validateSetting(
    req.body.setting_key,
    req.body.setting_value,
  );
  const b = req.user.isSuperAdmin
    ? req.body.branch_id || null
    : req.user.branch_id;
  const value = String(req.body.setting_value ?? "");
  const [[previous]] = await pool.execute(
    `SELECT setting_value FROM settings WHERE setting_key=? AND ${b === null ? "branch_id IS NULL" : "branch_id=?"} ORDER BY id LIMIT 1`,
    b === null ? [req.body.setting_key] : [req.body.setting_key, b],
  );

  await pool.execute(
    `INSERT INTO settings(branch_id,setting_group,setting_key,setting_value,value_type,is_public,updated_by) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),value_type=VALUES(value_type),is_public=VALUES(is_public),updated_by=VALUES(updated_by)`,
    [
      b,
      group,
      req.body.setting_key,
      value,
      type,
      isPublic ? 1 : 0,
      req.user.id,
    ],
  );

  if (
    type === "image" &&
    previous?.setting_value &&
    previous.setting_value !== value
  ) {
    const [[reference]] = await pool.execute(
      "SELECT COUNT(*) total FROM settings WHERE setting_value=?",
      [previous.setting_value],
    );
    if (!Number(reference.total))
      await deleteManagedUpload(previous.setting_value);
  }

  res.json({ success: true });
}
export async function dashboard(req, res) {
  const b = resolveBranchId(req);
  const [[sales]] = await pool.execute(
    `SELECT COUNT(*) orders,COALESCE(SUM(total_amount),0) sales,COALESCE(SUM(total_amount-subtotal+discount_amount),0) charges FROM orders WHERE branch_id=? AND status='paid' AND DATE(closed_at)=CURDATE()`,
    [b],
  );
  const [[expenses]] = await pool.execute(
    `SELECT COALESCE(SUM(base_amount),0) expenses FROM expenses WHERE branch_id=? AND status='paid' AND DATE(expense_date)=CURDATE()`,
    [b],
  );
  const [[tables]] = await pool.execute(
    `SELECT COUNT(*) total,SUM(status='occupied') occupied FROM restaurant_tables WHERE branch_id=? AND is_active=1`,
    [b],
  );
  res.json({
    success: true,
    data: {
      today: {
        ...sales,
        expenses: expenses.expenses,
        net_operating_result: Number(sales.sales) - Number(expenses.expenses),
      },
      tables,
    },
  });
}
function reportDates(req) {
  const today = new Date().toISOString().slice(0, 10);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || "")
    ? req.query.from
    : today;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || "")
    ? req.query.to
    : today;
  return { from, to };
}
export async function reports(req, res) {
  const b = resolveBranchId(req);
  const { from, to } = reportDates(req);
  const tableFilter = String(req.query.table_id || "").trim();
  const tableId = Number(tableFilter);
  if (
    tableFilter &&
    tableFilter !== "takeaway" &&
    (!Number.isInteger(tableId) || tableId <= 0)
  )
    throw new ApiError(422, "Invalid table filter");
  const tableSql = tableFilter
    ? tableFilter === "takeaway"
      ? " AND o.table_id IS NULL"
      : " AND o.table_id=?"
    : "";
  const tableArgs = tableFilter && tableFilter !== "takeaway" ? [tableId] : [];
  const reportSearch = String(req.query.search || "").trim();
  const searchSql = reportSearch ? " AND o.order_no LIKE ?" : "";
  const searchArgs = reportSearch ? [`%${reportSearch}%`] : [];
  const days =
    (new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000;
  if (days < 0 || days > 3650)
    throw new ApiError(422, "Report period must be between 0 and 3650 days");
  const [sales] = await pool.execute(
    `SELECT o.id,o.order_no document_no,o.closed_at document_date,o.order_type,o.status,o.subtotal,
            o.discount_type,o.discount_value,o.discount_amount,o.discount_reason,o.discount_applied_at,
            o.tax_amount,o.service_charge_amount,o.total_amount,u.full_name created_by_name,
            du.full_name discount_applied_by_name,t.name table_name
     FROM orders o JOIN users u ON u.id=o.opened_by
     LEFT JOIN users du ON du.id=o.discount_applied_by
     LEFT JOIN restaurant_tables t ON t.id=o.table_id
     WHERE o.branch_id=? AND o.status='paid' AND o.closed_at>=? AND o.closed_at<DATE_ADD(?,INTERVAL 1 DAY)${tableSql}${searchSql}
     ORDER BY o.closed_at DESC`,
    [b, from, to, ...tableArgs, ...searchArgs],
  );
  const [cancelledOrders] = await pool.execute(
    `SELECT o.id,o.order_no document_no,COALESCE(o.closed_at,o.updated_at) document_date,
            o.order_type,o.status,o.total_amount,o.notes,u.full_name created_by_name,t.name table_name
       FROM orders o JOIN users u ON u.id=o.opened_by LEFT JOIN restaurant_tables t ON t.id=o.table_id
      WHERE o.branch_id=? AND o.status='cancelled'
        AND COALESCE(o.closed_at,o.updated_at)>=?
        AND COALESCE(o.closed_at,o.updated_at)<DATE_ADD(?,INTERVAL 1 DAY)${tableSql}${searchSql}
      ORDER BY COALESCE(o.closed_at,o.updated_at) DESC`,
    [b, from, to, ...tableArgs, ...searchArgs],
  );
  const [paymentSummary] = await pool.execute(
    `SELECT p.payment_method,COALESCE(NULLIF(pm.name_kh,''),pm.name,p.payment_method) payment_method_name,
            COUNT(*) payment_count,COALESCE(SUM(p.base_amount),0) total_amount
       FROM payments p JOIN orders o ON o.id=p.order_id
       LEFT JOIN payment_methods pm ON pm.branch_id=p.branch_id AND pm.code=p.payment_method
      WHERE p.branch_id=? AND p.status='completed' AND o.status='paid'
        AND o.closed_at>=? AND o.closed_at<DATE_ADD(?,INTERVAL 1 DAY)${tableSql}${searchSql}
      GROUP BY p.payment_method,pm.name,pm.name_kh ORDER BY total_amount DESC`,
    [b, from, to, ...tableArgs, ...searchArgs],
  );
  const [menuSales] = await pool.execute(
    `SELECT oi.menu_item_id,COALESCE(NULLIF(oi.item_name_kh,''),oi.item_name) item_name,
            SUM(oi.quantity) quantity,SUM(oi.line_total) total_amount,
            COUNT(DISTINCT o.id) order_count
       FROM order_items oi JOIN orders o ON o.id=oi.order_id
      WHERE o.branch_id=? AND o.status='paid' AND oi.kitchen_status<>'cancelled'
        AND o.closed_at>=? AND o.closed_at<DATE_ADD(?,INTERVAL 1 DAY)${tableSql}${searchSql}
      GROUP BY oi.menu_item_id,COALESCE(NULLIF(oi.item_name_kh,''),oi.item_name)
      ORDER BY total_amount DESC`,
    [b, from, to, ...tableArgs, ...searchArgs],
  );
  const [dailySales] = await pool.execute(
    `SELECT DATE(o.closed_at) id,DATE(o.closed_at) document_date,
            COUNT(*) order_count,SUM(o.subtotal) subtotal,
            SUM(o.discount_amount) discount_amount,SUM(o.tax_amount) tax_amount,
            SUM(o.service_charge_amount) service_charge_amount,SUM(o.total_amount) total_amount
       FROM orders o
      WHERE o.branch_id=? AND o.status='paid'
        AND o.closed_at>=? AND o.closed_at<DATE_ADD(?,INTERVAL 1 DAY)${tableSql}${searchSql}
      GROUP BY DATE(o.closed_at) ORDER BY DATE(o.closed_at) DESC`,
    [b, from, to, ...tableArgs, ...searchArgs],
  );
  const [hourlySales] = await pool.execute(
    `SELECT HOUR(o.closed_at) id,
            CONCAT(LPAD(HOUR(MIN(o.closed_at)),2,'0'),':00 - ',LPAD(HOUR(MIN(o.closed_at)),2,'0'),':59') hour_label,
            COUNT(*) order_count,SUM(o.total_amount) total_amount
       FROM orders o
      WHERE o.branch_id=? AND o.status='paid'
        AND o.closed_at>=? AND o.closed_at<DATE_ADD(?,INTERVAL 1 DAY)${tableSql}${searchSql}
      GROUP BY HOUR(o.closed_at) ORDER BY HOUR(o.closed_at)`,
    [b, from, to, ...tableArgs, ...searchArgs],
  );
  const [cashierSales] = await pool.execute(
    `SELECT u.id,u.full_name created_by_name,COUNT(*) order_count,
            SUM(o.total_amount) total_amount
       FROM orders o JOIN users u ON u.id=o.opened_by
      WHERE o.branch_id=? AND o.status='paid'
        AND o.closed_at>=? AND o.closed_at<DATE_ADD(?,INTERVAL 1 DAY)${tableSql}${searchSql}
      GROUP BY u.id,u.full_name ORDER BY total_amount DESC`,
    [b, from, to, ...tableArgs, ...searchArgs],
  );
  const [specialCustomerSales] = await pool.execute(
    `SELECT c.id,COALESCE(NULLIF(c.name_kh,''),c.name) customer_name,
            c.customer_type,c.default_discount_percent,
            COUNT(*) order_count,SUM(o.subtotal) subtotal,
            SUM(o.discount_amount) discount_amount,SUM(o.total_amount) total_amount
       FROM orders o JOIN customers c ON c.id=o.customer_id
      WHERE o.branch_id=? AND o.status='paid' AND o.discount_amount>0
        AND o.closed_at>=? AND o.closed_at<DATE_ADD(?,INTERVAL 1 DAY)${tableSql}${searchSql}
      GROUP BY c.id,c.name,c.name_kh,c.customer_type,c.default_discount_percent
      ORDER BY total_amount DESC`,
    [b, from, to, ...tableArgs, ...searchArgs],
  );
  const [tableSales] = await pool.execute(
    `SELECT COALESCE(t.id,0) id,COALESCE(t.name,'Takeaway') table_name,
            COUNT(*) order_count,SUM(o.total_amount) total_amount
       FROM orders o LEFT JOIN restaurant_tables t ON t.id=o.table_id
      WHERE o.branch_id=? AND o.status='paid'
        AND o.closed_at>=? AND o.closed_at<DATE_ADD(?,INTERVAL 1 DAY)${tableSql}${searchSql}
      GROUP BY t.id,t.name ORDER BY total_amount DESC`,
    [b, from, to, ...tableArgs, ...searchArgs],
  );
  const [profitByItem] = await pool.execute(
    `SELECT oi.menu_item_id id,COALESCE(NULLIF(oi.item_name_kh,''),oi.item_name) item_name,
            SUM(oi.quantity) quantity,SUM(oi.line_total) sales_amount,
            SUM(oi.quantity*oi.unit_cost) cost_amount,
            SUM(oi.line_total-(oi.quantity*oi.unit_cost)) total_amount
       FROM order_items oi JOIN orders o ON o.id=oi.order_id
      WHERE o.branch_id=? AND o.status='paid' AND oi.kitchen_status<>'cancelled'
        AND o.closed_at>=? AND o.closed_at<DATE_ADD(?,INTERVAL 1 DAY)${tableSql}${searchSql}
      GROUP BY oi.menu_item_id,COALESCE(NULLIF(oi.item_name_kh,''),oi.item_name)
      ORDER BY total_amount DESC`,
    [b, from, to, ...tableArgs, ...searchArgs],
  );
  const [purchases] = await pool.execute(
    `SELECT p.id,p.purchase_no document_no,p.purchase_date document_date,s.name party_name,p.status,p.subtotal,p.discount_amount,p.tax_amount,p.total_amount,p.paid_amount,p.due_amount
     FROM purchases p JOIN suppliers s ON s.id=p.supplier_id
     WHERE p.branch_id=? AND p.purchase_date>=? AND p.purchase_date<DATE_ADD(?,INTERVAL 1 DAY)
     ORDER BY p.purchase_date DESC`,
    [b, from, to],
  );
  const [purchaseBySupplier] = await pool.execute(
    `SELECT s.id,COALESCE(NULLIF(s.name,''),s.code) supplier_name,
            COUNT(*) purchase_count,SUM(p.total_amount) total_amount,
            SUM(p.paid_amount) paid_amount,SUM(p.due_amount) due_amount
       FROM purchases p JOIN suppliers s ON s.id=p.supplier_id
      WHERE p.branch_id=? AND p.status<>'cancelled'
        AND p.purchase_date>=? AND p.purchase_date<DATE_ADD(?,INTERVAL 1 DAY)
      GROUP BY s.id,s.name,s.code ORDER BY total_amount DESC`,
    [b, from, to],
  );
  const [expenses] = await pool.execute(
    `SELECT e.id,e.expense_no document_no,e.expense_date document_date,e.title,c.name category_name,e.payment_method,e.status,e.base_amount total_amount,u.full_name created_by_name
     FROM expenses e JOIN expense_categories c ON c.id=e.category_id JOIN users u ON u.id=e.created_by
     WHERE e.branch_id=? AND e.expense_date>=? AND e.expense_date<DATE_ADD(?,INTERVAL 1 DAY)
     ORDER BY e.expense_date DESC`,
    [b, from, to],
  );
  const [expenseByCategory] = await pool.execute(
    `SELECT c.id,COALESCE(NULLIF(c.name_kh,''),c.name) category_name,
            COUNT(*) expense_count,SUM(e.base_amount) total_amount
       FROM expenses e JOIN expense_categories c ON c.id=e.category_id
      WHERE e.branch_id=? AND e.status NOT IN ('rejected','cancelled')
        AND e.expense_date>=? AND e.expense_date<DATE_ADD(?,INTERVAL 1 DAY)
      GROUP BY c.id,c.name,c.name_kh ORDER BY total_amount DESC`,
    [b, from, to],
  );
  const [paymentTransactions] = await pool.execute(
    `SELECT p.id,p.payment_no document_no,p.paid_at document_date,p.payment_method,
            COALESCE(NULLIF(pm.name_kh,''),pm.name,p.payment_method) payment_method_name,
            p.currency_code,p.tendered_amount,p.base_amount total_amount,p.reference_no,
            p.status,o.order_no,u.full_name created_by_name,t.name table_name
       FROM payments p JOIN orders o ON o.id=p.order_id
       JOIN users u ON u.id=p.created_by
       LEFT JOIN restaurant_tables t ON t.id=o.table_id
       LEFT JOIN payment_methods pm ON pm.branch_id=p.branch_id AND pm.code=p.payment_method
      WHERE p.branch_id=? AND p.paid_at>=? AND p.paid_at<DATE_ADD(?,INTERVAL 1 DAY)
      ORDER BY p.paid_at DESC`,
    [b, from, to],
  );
  const [cashShifts] = await pool.execute(
    `SELECT cs.id,cs.opened_at document_date,cs.closed_at,cs.status,
            cs.opening_amount,cs.expected_amount,cs.closing_amount,cs.difference_amount,
            cr.name register_name,u.full_name cashier_name,
            COALESCE(SUM(CASE WHEN p.status='completed' AND COALESCE(pm.method_type,IF(p.payment_method='cash','cash','other'))='cash' THEN p.base_amount ELSE 0 END),0) cash_sales,
            COALESCE(SUM(CASE WHEN p.status='completed' AND pm.method_type='qr' THEN p.base_amount ELSE 0 END),0) aba_sales,
            COALESCE(SUM(CASE WHEN p.status='completed' AND pm.method_type='card' THEN p.base_amount ELSE 0 END),0) card_sales,
            COALESCE(SUM(CASE WHEN p.status='completed' AND pm.method_type='bank' THEN p.base_amount ELSE 0 END),0) bank_sales,
            COALESCE(SUM(CASE WHEN p.status='completed' AND pm.method_type='credit' THEN p.base_amount ELSE 0 END),0) credit_sales,
            COALESCE(SUM(CASE WHEN p.status='completed' AND pm.method_type='other' THEN p.base_amount ELSE 0 END),0) other_sales,
            COALESCE(SUM(CASE WHEN p.status='completed' AND COALESCE(pm.method_type,IF(p.payment_method='cash','cash','other'))<>'cash' THEN p.base_amount ELSE 0 END),0) non_cash_sales,
            COUNT(CASE WHEN p.status='completed' THEN 1 END) payment_count
       FROM cash_sessions cs
       JOIN cash_registers cr ON cr.id=cs.cash_register_id
       JOIN users u ON u.id=cs.opened_by
       LEFT JOIN payments p ON p.cash_session_id=cs.id
       LEFT JOIN payment_methods pm ON pm.branch_id=cr.branch_id AND pm.code=p.payment_method
      WHERE cr.branch_id=? AND cs.opened_at>=? AND cs.opened_at<DATE_ADD(?,INTERVAL 1 DAY)
      GROUP BY cs.id,cs.opened_at,cs.closed_at,cs.status,cs.opening_amount,cs.expected_amount,
               cs.closing_amount,cs.difference_amount,cr.name,u.full_name
      ORDER BY cs.opened_at DESC`,
    [b, from, to],
  );
  const [lowStock] = await pool.execute(
    `SELECT i.ingredient_id id,g.sku,COALESCE(NULLIF(g.name_kh,''),g.name) item_name,
            i.quantity_on_hand,g.minimum_stock,u.code unit_code,i.average_cost,
            i.quantity_on_hand*i.average_cost total_amount
       FROM inventory i JOIN ingredients g ON g.id=i.ingredient_id
       JOIN units u ON u.id=g.unit_id
      WHERE i.branch_id=? AND g.is_active=1
        AND i.quantity_on_hand<=g.minimum_stock
      ORDER BY (g.minimum_stock-i.quantity_on_hand) DESC,g.name`,
    [b],
  );
  const [stockMovements] = await pool.execute(
    `SELECT sm.id,sm.created_at document_date,sm.movement_type,
            g.sku,COALESCE(NULLIF(g.name_kh,''),g.name) item_name,u.code unit_code,
            sm.quantity,sm.unit_cost,sm.balance_after,
            ABS(sm.quantity*sm.unit_cost) total_amount,
            sm.reference_type,sm.reference_id,sm.notes,usr.full_name created_by_name
       FROM stock_movements sm
       JOIN ingredients g ON g.id=sm.ingredient_id
       JOIN units u ON u.id=g.unit_id
       LEFT JOIN users usr ON usr.id=sm.created_by
      WHERE sm.branch_id=? AND sm.created_at>=?
        AND sm.created_at<DATE_ADD(?,INTERVAL 1 DAY)
      ORDER BY sm.created_at DESC,sm.id DESC LIMIT 5000`,
    [b, from, to],
  );
  const total = (rows, key = "total_amount") =>
    rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
  res.json({
    success: true,
    data: {
      period: { from, to },
      sales: {
        rows: sales,
        total: total(sales),
        count: sales.length,
        payment_summary: paymentSummary,
      },
      cancelled_orders: {
        rows: cancelledOrders,
        total: total(cancelledOrders),
        count: cancelledOrders.length,
      },
      menu_sales: {
        rows: menuSales,
        total: total(menuSales),
        count: menuSales.length,
      },
      daily_sales: { rows: dailySales, total: total(dailySales) },
      hourly_sales: { rows: hourlySales, total: total(hourlySales) },
      cashier_sales: { rows: cashierSales, total: total(cashierSales) },
      special_customer_sales: {
        rows: specialCustomerSales,
        total: total(specialCustomerSales),
      },
      table_sales: { rows: tableSales, total: total(tableSales) },
      profit_by_item: { rows: profitByItem, total: total(profitByItem) },
      low_stock: { rows: lowStock, total: total(lowStock) },
      stock_movements: { rows: stockMovements, total: total(stockMovements) },
      purchases: { rows: purchases, total: total(purchases) },
      purchase_by_supplier: {
        rows: purchaseBySupplier,
        total: total(purchaseBySupplier),
      },
      expenses: { rows: expenses, total: total(expenses) },
      expense_by_category: {
        rows: expenseByCategory,
        total: total(expenseByCategory),
      },
      payment_transactions: {
        rows: paymentTransactions,
        total: total(paymentTransactions),
        count: paymentTransactions.length,
      },
      cash_shifts: {
        rows: cashShifts,
        total: total(cashShifts, "cash_sales"),
      },
      net_operating_result: total(sales) - total(expenses),
    },
  });
}
export async function expenses(req, res) {
  const b = resolveBranchId(req);
  const [rows] = await pool.execute(
    "SELECT e.*,c.name category_name FROM expenses e JOIN expense_categories c ON c.id=e.category_id WHERE e.branch_id=? ORDER BY e.expense_date DESC",
    [b],
  );
  res.json({ success: true, data: rows });
}
export async function createExpense(req, res) {
  const b = resolveBranchId(req);
  const x = await withTransaction(async (db) => {
    const [[method]] = await db.execute(
      "SELECT code,requires_reference FROM payment_methods WHERE branch_id=? AND code=? AND is_active=1",
      [b, req.body.payment_method],
    );
    if (!method) throw new ApiError(422, "Payment method unavailable");
    if (
      method.requires_reference &&
      !String(req.body.reference_no || "").trim()
    )
      throw new ApiError(422, "Transaction reference is required");
    const no = await nextNumber(db, b, "expense");
    const rate =
      req.body.currency_code === "KHR" ? Number(req.body.exchange_rate) : 1;
    const [r] = await db.execute(
      `INSERT INTO expenses(branch_id,category_id,expense_no,title,description,amount,currency_code,exchange_rate,base_amount,payment_method,reference_no,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        b,
        req.body.category_id,
        no,
        req.body.title,
        req.body.description || null,
        req.body.amount,
        req.body.currency_code || "USD",
        rate,
        Number(req.body.amount) / rate,
        req.body.payment_method,
        req.body.reference_no || null,
        req.body.status || "paid",
        req.user.id,
      ],
    );
    return { id: r.insertId, expense_no: no };
  });
  res.status(201).json({ success: true, data: x });
}
export async function reservations(req, res) {
  const b = resolveBranchId(req);
  const [rows] = await pool.execute(
    `SELECT r.*,t.code table_code,t.name table_name,c.name customer_name,c.name_kh customer_name_kh,
            o.id order_id,o.order_no,o.status order_status,o.total_amount,o.balance_amount,
            ci.full_name checked_in_by_name,co.full_name completed_by_name
       FROM reservations r
       LEFT JOIN restaurant_tables t ON t.id=r.table_id
       LEFT JOIN customers c ON c.id=r.customer_id
       LEFT JOIN orders o ON o.id=(SELECT oo.id FROM orders oo WHERE oo.reservation_id=r.id ORDER BY oo.id DESC LIMIT 1)
       LEFT JOIN users ci ON ci.id=r.checked_in_by
       LEFT JOIN users co ON co.id=r.completed_by
      WHERE r.branch_id=? ORDER BY r.reservation_at DESC LIMIT 300`,
    [b],
  );
  res.json({ success: true, data: rows });
}

function reservationValues(body) {
  const guestName = String(body.guest_name || "").trim();
  const guestPhone = String(body.guest_phone || "").trim();
  const guestCount = Number(body.guest_count || 1);
  const duration = Number(body.duration_minutes || 90);
  const deposit = Number(body.deposit_amount || 0);
  const status = body.status || "pending";
  if (!guestName || !guestPhone)
    throw new ApiError(422, "Guest name and phone are required");
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 100)
    throw new ApiError(422, "Guest count must be between 1 and 100");
  if (!Number.isInteger(duration) || duration < 30 || duration > 720)
    throw new ApiError(422, "Duration must be between 30 and 720 minutes");
  if (!Number.isFinite(deposit) || deposit < 0)
    throw new ApiError(422, "Deposit amount cannot be negative");
  if (
    !body.reservation_at ||
    Number.isNaN(Date.parse(String(body.reservation_at).replace(" ", "T")))
  )
    throw new ApiError(422, "Valid reservation date and time are required");
  if (!["pending", "confirmed"].includes(status))
    throw new ApiError(422, "Invalid reservation status");
  if (status === "confirmed" && !body.table_id)
    throw new ApiError(422, "A table is required to confirm a reservation");
  return { guestName, guestPhone, guestCount, duration, deposit, status };
}

async function assertReservationTable(
  db,
  branchId,
  tableId,
  reservation,
  excludeId = 0,
) {
  if (!tableId) return null;
  const [[table]] = await db.execute(
    "SELECT * FROM restaurant_tables WHERE id=? AND branch_id=? FOR UPDATE",
    [tableId, branchId],
  );
  if (
    !table ||
    !table.is_active ||
    ["inactive", "cleaning"].includes(table.status)
  )
    throw new ApiError(409, "Table is unavailable");
  if (Number(table.capacity) < Number(reservation.guestCount))
    throw new ApiError(409, "Table capacity is smaller than the guest count");
  const [[conflict]] = await db.execute(
    `SELECT id,reservation_no FROM reservations
      WHERE branch_id=? AND table_id=? AND id<>?
        AND status IN('confirmed','seated')
        AND reservation_at<TIMESTAMPADD(MINUTE,?,?)
        AND TIMESTAMPADD(MINUTE,duration_minutes,reservation_at)>?
      LIMIT 1`,
    [
      branchId,
      tableId,
      excludeId,
      reservation.duration,
      reservation.reservationAt,
      reservation.reservationAt,
    ],
  );
  if (conflict)
    throw new ApiError(
      409,
      `Table already reserved: ${conflict.reservation_no}`,
    );
  return table;
}

export async function createReservation(req, res) {
  const b = resolveBranchId(req);
  const values = reservationValues(req.body);
  const data = await withTransaction(async (db) => {
    const reservation = {
      ...values,
      reservationAt: req.body.reservation_at,
    };
    const table = await assertReservationTable(
      db,
      b,
      req.body.table_id || null,
      reservation,
    );
    if (values.status === "confirmed" && table?.status === "occupied")
      throw new ApiError(409, "Table currently has an open order");
    const no = await nextNumber(db, b, "reservation");
    const [r] = await db.execute(
      `INSERT INTO reservations(branch_id,customer_id,table_id,reservation_no,guest_name,guest_phone,guest_count,reservation_at,duration_minutes,deposit_amount,status,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        b,
        req.body.customer_id || null,
        req.body.table_id || null,
        no,
        values.guestName,
        values.guestPhone,
        values.guestCount,
        req.body.reservation_at,
        values.duration,
        values.deposit,
        values.status,
        req.body.notes || null,
        req.user.id,
      ],
    );
    if (req.body.table_id && values.status === "confirmed")
      await db.execute(
        "UPDATE restaurant_tables SET status='reserved' WHERE id=? AND branch_id=? AND status='available'",
        [req.body.table_id, b],
      );
    return { id: r.insertId, reservation_no: no };
  });
  res.status(201).json({ success: true, data });
}

export async function confirmReservation(req, res) {
  const b = resolveBranchId(req);
  const result = await withTransaction(async (db) => {
    const [[reservation]] = await db.execute(
      "SELECT * FROM reservations WHERE id=? AND branch_id=? FOR UPDATE",
      [req.params.id, b],
    );
    if (!reservation) throw new ApiError(404, "Reservation not found");
    if (reservation.status === "confirmed")
      return {
        id: reservation.id,
        status: reservation.status,
        table_id: reservation.table_id,
        idempotent: true,
      };
    if (reservation.status !== "pending")
      throw new ApiError(409, "Only a pending reservation can be confirmed");
    const tableId = Number(req.body.table_id || reservation.table_id || 0);
    if (!tableId) throw new ApiError(422, "Select a table before confirmation");
    const table = await assertReservationTable(
      db,
      b,
      tableId,
      {
        guestCount: reservation.guest_count,
        duration: reservation.duration_minutes,
        reservationAt: reservation.reservation_at,
      },
      reservation.id,
    );
    if (table.status === "occupied")
      throw new ApiError(409, "Table currently has an open order");
    await db.execute(
      "UPDATE reservations SET table_id=?,status='confirmed' WHERE id=?",
      [tableId, reservation.id],
    );
    await db.execute(
      "UPDATE restaurant_tables SET status='reserved' WHERE id=? AND branch_id=?",
      [tableId, b],
    );
    return { id: reservation.id, status: "confirmed", table_id: tableId };
  });
  const room = req.app.get("io").to(`branch:${b}`);
  room.emit("reservation:updated", result);
  room.emit("table:updated", { tableId: result.table_id, status: "reserved" });
  res.json({ success: true, data: result });
}

export async function checkInReservation(req, res) {
  const b = resolveBranchId(req);
  const result = await withTransaction(async (db) => {
    const [[reservation]] = await db.execute(
      "SELECT * FROM reservations WHERE id=? AND branch_id=? FOR UPDATE",
      [req.params.id, b],
    );
    if (!reservation) throw new ApiError(404, "Reservation not found");
    const [[existing]] = await db.execute(
      "SELECT id,order_no,status,table_id FROM orders WHERE reservation_id=? ORDER BY id DESC LIMIT 1 FOR UPDATE",
      [reservation.id],
    );
    if (existing && !["cancelled", "voided"].includes(existing.status))
      return {
        reservation_id: reservation.id,
        status: "seated",
        order_id: existing.id,
        order_no: existing.order_no,
        table_id: existing.table_id,
        idempotent: true,
      };
    if (!["pending", "confirmed"].includes(reservation.status))
      throw new ApiError(409, "Reservation cannot be checked in");
    if (!reservation.table_id)
      throw new ApiError(422, "Assign a table before check-in");
    const [[table]] = await db.execute(
      "SELECT * FROM restaurant_tables WHERE id=? AND branch_id=? FOR UPDATE",
      [reservation.table_id, b],
    );
    if (
      !table ||
      !table.is_active ||
      ["occupied", "cleaning", "inactive"].includes(table.status)
    )
      throw new ApiError(409, "Table is unavailable for check-in");
    const [[openOrder]] = await db.execute(
      "SELECT id FROM orders WHERE table_id=? AND branch_id=? AND status NOT IN('paid','cancelled','voided') LIMIT 1",
      [table.id, b],
    );
    if (openOrder) throw new ApiError(409, "Table already has an open order");
    let customerDiscount = 0;
    if (reservation.customer_id) {
      const [[customer]] = await db.execute(
        "SELECT default_discount_percent FROM customers WHERE id=? AND is_active=1",
        [reservation.customer_id],
      );
      customerDiscount = Math.min(
        100,
        Math.max(0, Number(customer?.default_discount_percent || 0)),
      );
    }
    const [[serviceSetting]] = await db.execute(
      `SELECT setting_value FROM settings WHERE setting_key='service_charge_rate'
        AND (branch_id=? OR branch_id IS NULL)
        ORDER BY branch_id IS NOT NULL DESC,id DESC LIMIT 1`,
      [b],
    );
    const serviceRate = Number(serviceSetting?.setting_value || 0);
    const orderNo = await nextNumber(db, b, "order");
    const [created] = await db.execute(
      `INSERT INTO orders(branch_id,table_id,customer_id,reservation_id,order_no,order_type,status,guest_count,
        discount_type,discount_value,discount_reason,discount_applied_by,discount_applied_at,
        service_charge_rate,notes,opened_by)
       VALUES(?,?,?,?,?,'dine_in','open',?,?,?,?,?,?,?,?,?)`,
      [
        b,
        table.id,
        reservation.customer_id || null,
        reservation.id,
        orderNo,
        reservation.guest_count,
        customerDiscount > 0 ? "percent" : "none",
        customerDiscount,
        customerDiscount > 0 ? "បញ្ចុះតម្លៃលំនាំដើមរបស់អតិថិជន" : null,
        customerDiscount > 0 ? req.user.id : null,
        customerDiscount > 0 ? new Date() : null,
        serviceRate,
        reservation.notes || null,
        req.user.id,
      ],
    );
    await db.execute(
      "UPDATE reservations SET status='seated',checked_in_at=NOW(),checked_in_by=? WHERE id=?",
      [req.user.id, reservation.id],
    );
    await db.execute(
      "UPDATE restaurant_tables SET status='occupied' WHERE id=?",
      [table.id],
    );
    return {
      reservation_id: reservation.id,
      status: "seated",
      order_id: created.insertId,
      order_no: orderNo,
      table_id: table.id,
    };
  });
  const room = req.app.get("io").to(`branch:${b}`);
  room.emit("reservation:updated", result);
  room.emit("order:updated", {
    id: result.order_id,
    status: "open",
    table_id: result.table_id,
  });
  room.emit("table:updated", { tableId: result.table_id, status: "occupied" });
  res
    .status(result.idempotent ? 200 : 201)
    .json({ success: true, data: result });
}

export async function cancelReservation(req, res) {
  const b = resolveBranchId(req);
  const result = await withTransaction(async (db) => {
    const [[reservation]] = await db.execute(
      "SELECT * FROM reservations WHERE id=? AND branch_id=? FOR UPDATE",
      [req.params.id, b],
    );
    if (!reservation) throw new ApiError(404, "Reservation not found");
    if (reservation.status === "cancelled")
      return {
        id: reservation.id,
        status: "cancelled",
        table_id: reservation.table_id,
        idempotent: true,
      };
    if (!["pending", "confirmed"].includes(reservation.status))
      throw new ApiError(
        409,
        "Checked-in or completed reservations cannot be cancelled here",
      );
    await db.execute(
      "UPDATE reservations SET status='cancelled',cancelled_at=NOW(),cancelled_by=?,notes=CONCAT_WS(' | ',notes,?) WHERE id=?",
      [
        req.user.id,
        String(req.body.reason || "Cancelled").trim(),
        reservation.id,
      ],
    );
    if (reservation.table_id) {
      const [[active]] = await db.execute(
        `SELECT id FROM reservations WHERE table_id=? AND branch_id=? AND id<>? AND status IN('confirmed','seated') LIMIT 1`,
        [reservation.table_id, b, reservation.id],
      );
      const [[open]] = await db.execute(
        "SELECT id FROM orders WHERE table_id=? AND branch_id=? AND status NOT IN('paid','cancelled','voided') LIMIT 1",
        [reservation.table_id, b],
      );
      if (!active && !open)
        await db.execute(
          "UPDATE restaurant_tables SET status='available' WHERE id=?",
          [reservation.table_id],
        );
    }
    return {
      id: reservation.id,
      status: "cancelled",
      table_id: reservation.table_id,
    };
  });
  const room = req.app.get("io").to(`branch:${b}`);
  room.emit("reservation:updated", result);
  room.emit("table:updated", { tableId: result.table_id });
  res.json({ success: true, data: result });
}
export async function recipes(req, res) {
  const [rows] = await pool.execute(
    `SELECT r.*,i.name ingredient_name,u.code unit_code FROM recipes r JOIN ingredients i ON i.id=r.ingredient_id JOIN units u ON u.id=i.unit_id WHERE r.menu_item_id=? ORDER BY r.id`,
    [req.params.menuItemId],
  );
  res.json({ success: true, data: rows });
}
export async function saveRecipe(req, res) {
  await withTransaction(async (db) => {
    await db.execute("DELETE FROM recipes WHERE menu_item_id=?", [
      req.params.menuItemId,
    ]);
    for (const x of req.body.items || [])
      await db.execute(
        "INSERT INTO recipes(menu_item_id,ingredient_id,quantity,wastage_percent,notes) VALUES(?,?,?,?,?)",
        [
          req.params.menuItemId,
          x.ingredient_id,
          x.quantity,
          x.wastage_percent || 0,
          x.notes || null,
        ],
      );
  });
  res.json({ success: true });
}
export async function uploadMenuImage(req, res) {
  if (!req.file) throw new ApiError(422, "Menu image is required");
  res.status(201).json({
    success: true,
    data: { url: `/uploads/menu/${req.file.filename}` },
  });
}
export async function uploadBrandLogo(req, res) {
  if (!req.file) throw new ApiError(422, "Logo image is required");
  res.status(201).json({
    success: true,
    data: { url: `/uploads/branding/${req.file.filename}` },
  });
}
