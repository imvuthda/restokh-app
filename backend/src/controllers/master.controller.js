import bcrypt from "bcryptjs";
import { pool, withTransaction } from "../config/database.js";
import { crudService } from "../services/crud.service.js";
import { resolveBranchId } from "../middleware/permission.middleware.js";
import { ApiError } from "../utils/api-error.js";

const configs = {
  branches: {
    table: "branches",
    fields: [
      "code",
      "name",
      "name_kh",
      "phone",
      "email",
      "address",
      "address_kh",
      "tax_number",
      "logo",
      "currency_code",
      "timezone",
      "is_head_office",
      "is_active",
    ],
    searchFields: ["code", "name", "name_kh"],
  },
  areas: {
    table: "dining_areas",
    branchScoped: true,
    fields: ["code", "name", "name_kh", "sort_order", "is_active"],
    searchFields: ["code", "name", "name_kh"],
  },
  shapes: {
    table: "table_shapes",
    branchScoped: true,
    fields: [
      "code",
      "name",
      "name_kh",
      "shape_type",
      "sort_order",
      "is_active",
    ],
    searchFields: ["code", "name", "name_kh"],
  },
  tables: {
    table: "restaurant_tables",
    branchScoped: true,
    fields: [
      "dining_area_id",
      "code",
      "name",
      "capacity",
      "shape",
      "position_x",
      "position_y",
      "status",
      "qr_token",
      "is_active",
    ],
    searchFields: ["code", "name"],
  },
  categories: {
    table: "menu_categories",
    fields: [
      "parent_id",
      "code",
      "name",
      "name_kh",
      "image",
      "color",
      "sort_order",
      "is_active",
    ],
    searchFields: ["code", "name", "name_kh"],
  },
  menuItems: {
    table: "menu_items",
    fields: [
      "category_id",
      "kitchen_station_id",
      "sku",
      "barcode",
      "name",
      "name_kh",
      "description",
      "image",
      "item_type",
      "base_price",
      "cost_price",
      "tax_rate",
      "preparation_minutes",
      "track_stock",
      "allow_discount",
      "is_available",
      "is_active",
    ],
    searchFields: ["sku", "barcode", "name", "name_kh"],
  },
  stations: {
    table: "kitchen_stations",
    branchScoped: true,
    fields: ["code", "name", "name_kh", "printer_name", "is_active"],
    searchFields: ["code", "name"],
  },
  units: {
    table: "units",
    fields: ["code", "name", "name_kh", "decimal_places"],
    searchFields: ["code", "name"],
  },
  ingredients: {
    table: "ingredients",
    fields: [
      "unit_id",
      "sku",
      "barcode",
      "name",
      "name_kh",
      "average_cost",
      "minimum_stock",
      "is_active",
    ],
    searchFields: ["sku", "barcode", "name", "name_kh"],
  },
  suppliers: {
    table: "suppliers",
    fields: [
      "code",
      "name",
      "contact_name",
      "phone",
      "email",
      "address",
      "tax_number",
      "credit_limit",
      "opening_balance",
      "is_active",
    ],
    searchFields: ["code", "name", "phone"],
  },
  customers: {
    table: "customers",
    fields: [
      "code",
      "name",
      "name_kh",
      "phone",
      "email",
      "gender",
      "date_of_birth",
      "address",
      "customer_type",
      "default_discount_percent",
      "loyalty_points",
      "credit_limit",
      "current_balance",
      "is_active",
    ],
    searchFields: ["code", "name", "name_kh", "phone"],
  },
  paymentMethods: {
    table: "payment_methods",
    branchScoped: true,
    fields: [
      "code",
      "name",
      "name_kh",
      "method_type",
      "requires_reference",
      "is_default",
      "sort_order",
      "is_active",
    ],
    searchFields: ["code", "name", "name_kh"],
    orderBy: "sort_order ASC,id ASC",
  },
  expenseCategories: {
    table: "expense_categories",
    fields: ["code", "name", "name_kh", "is_active"],
    searchFields: ["code", "name"],
  },
};
const service = (k) => {
  if (!configs[k]) throw new ApiError(404, "Resource not found");
  return crudService(configs[k]);
};
const branch = (req, k) =>
  configs[k].branchScoped ? resolveBranchId(req) : null;

function normalizeSku(value) {
  const sku = String(value || "")
    .trim()
    .toUpperCase();
  if (sku && !/^[A-Z0-9._-]{1,60}$/.test(sku))
    throw new ApiError(
      422,
      "SKU may contain only A-Z, numbers, dot, underscore and hyphen",
    );
  return sku;
}

function normalizeCustomer(data) {
  const discount = Number(data.default_discount_percent ?? 0);
  if (!Number.isFinite(discount) || discount < 0 || discount > 100)
    throw new ApiError(
      422,
      "Customer discount must be between 0 and 100 percent",
    );
  const allowedTypes = ["regular", "vip", "staff", "partner"];
  const customerType = String(data.customer_type || "regular");
  if (!allowedTypes.includes(customerType))
    throw new ApiError(422, "Invalid customer type");
  return {
    ...data,
    customer_type: customerType,
    default_discount_percent: discount,
  };
}

function normalizePaymentMethod(data) {
  const code = String(data.code || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9_-]{2,50}$/.test(code))
    throw new ApiError(
      422,
      "Payment method code may contain a-z, numbers, _ and -",
    );
  if (!String(data.name || "").trim())
    throw new ApiError(422, "Payment method name is required");
  if (
    !["cash", "qr", "card", "bank", "credit", "other"].includes(
      data.method_type,
    )
  )
    throw new ApiError(422, "Invalid payment method type");
  return {
    ...data,
    code,
    requires_reference: Number(data.requires_reference || 0) ? 1 : 0,
    is_default: Number(data.is_default || 0) ? 1 : 0,
    sort_order: Number(data.sort_order || 0),
    is_active:
      data.is_active === undefined ? 1 : Number(data.is_active) ? 1 : 0,
  };
}

async function nextSku(db, resourceType, table) {
  const [[sequence]] = await db.execute(
    "SELECT * FROM sku_sequences WHERE resource_type=? FOR UPDATE",
    [resourceType],
  );
  if (!sequence)
    throw new ApiError(409, "Missing SKU sequence. Run 19_auto_sku.sql");
  let number = Number(sequence.next_number);
  let sku;
  do {
    sku = `${sequence.prefix}${sequence.separator_text}${String(number).padStart(sequence.number_length, "0")}`;
    number += 1;
    const [[exists]] = await db.execute(
      `SELECT id FROM ${table} WHERE sku=? LIMIT 1`,
      [sku],
    );
    if (!exists) break;
  } while (true);
  await db.execute("UPDATE sku_sequences SET next_number=? WHERE id=?", [
    number,
    sequence.id,
  ]);
  return sku;
}

export async function skuPreview(req, res) {
  const resources = {
    menu_item: { table: "menu_items", permission: "menu.view" },
    ingredient: { table: "ingredients", permission: "inventory.view" },
  };
  const config = resources[req.params.type];
  if (!config) throw new ApiError(404, "SKU resource not found");
  if (
    !req.user.isSuperAdmin &&
    !req.user.permissions.includes(config.permission)
  )
    throw new ApiError(403, "Permission denied");
  const [[sequence]] = await pool.execute(
    "SELECT prefix,separator_text,number_length,next_number FROM sku_sequences WHERE resource_type=? LIMIT 1",
    [req.params.type],
  );
  if (!sequence)
    throw new ApiError(409, "Missing SKU sequence. Run 19_auto_sku.sql");
  let number = Number(sequence.next_number);
  let sku;
  do {
    sku = `${sequence.prefix}${sequence.separator_text}${String(number).padStart(sequence.number_length, "0")}`;
    number += 1;
    const [[exists]] = await pool.execute(
      `SELECT id FROM ${config.table} WHERE sku=? LIMIT 1`,
      [sku],
    );
    if (!exists) break;
  } while (true);
  res.json({ success: true, data: { sku } });
}

async function createWithAutoSku(data, configKey, resourceType) {
  const config = configs[configKey];
  if (!String(data.name || "").trim())
    throw new ApiError(422, "Name is required");
  if (configKey === "menuItems" && !data.category_id)
    throw new ApiError(422, "Category is required");
  if (configKey === "ingredients" && !data.unit_id)
    throw new ApiError(422, "Unit is required");
  return withTransaction(async (db) => {
    const allowed = new Set(config.fields);
    const clean = Object.fromEntries(
      Object.entries(data).filter(
        ([key, value]) => allowed.has(key) && value !== undefined,
      ),
    );
    clean.sku =
      normalizeSku(clean.sku) ||
      (await nextSku(db, resourceType, config.table));
    const [[duplicate]] = await db.execute(
      `SELECT id FROM ${config.table} WHERE sku=? LIMIT 1`,
      [clean.sku],
    );
    if (duplicate) throw new ApiError(409, `SKU ${clean.sku} already exists`);
    const keys = Object.keys(clean);
    const [result] = await db.execute(
      `INSERT INTO ${config.table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
      Object.values(clean),
    );
    const [[item]] = await db.execute(
      `SELECT * FROM ${config.table} WHERE id=?`,
      [result.insertId],
    );
    return item;
  });
}

function normalizeShape(data) {
  const code = String(data.code || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9_-]{1,40}$/.test(code))
    throw new ApiError(422, "Shape code may contain a-z, numbers, _ and -");
  if (!String(data.name || "").trim())
    throw new ApiError(422, "Shape name is required");
  return { ...data, code };
}

async function validateTableReferences(req, currentId = null) {
  const branchId = branch(req, "tables");
  let areaId = Number(req.body.dining_area_id || 0);
  let shape = String(req.body.shape || "")
    .trim()
    .toLowerCase();
  if (currentId && (!areaId || !shape)) {
    const current = await service("tables").get(currentId, branchId);
    areaId ||= Number(current.dining_area_id);
    shape ||= current.shape;
  }
  const [[area]] = await pool.execute(
    "SELECT id FROM dining_areas WHERE id=? AND branch_id=? AND is_active=1",
    [areaId, branchId],
  );
  if (!area) throw new ApiError(422, "Active dining area is required");
  const [[tableShape]] = await pool.execute(
    "SELECT code FROM table_shapes WHERE code=? AND branch_id=? AND is_active=1",
    [shape, branchId],
  );
  if (!tableShape) throw new ApiError(422, "Active table shape is required");
  req.body.dining_area_id = areaId;
  req.body.shape = shape;
}
export async function list(req, res) {
  if (req.params.resource === "branches" && !req.user.isSuperAdmin) {
    const [rows] = await pool.execute("SELECT * FROM branches WHERE id=?", [
      req.user.branch_id,
    ]);
    return res.json({
      success: true,
      data: {
        items: rows,
        pagination: { page: 1, limit: 1, total: rows.length, pages: 1 },
      },
    });
  }
  res.json({
    success: true,
    data: await service(req.params.resource).list(
      req.query,
      branch(req, req.params.resource),
    ),
  });
}
export async function get(req, res) {
  if (
    req.params.resource === "branches" &&
    !req.user.isSuperAdmin &&
    Number(req.params.id) !== Number(req.user.branch_id)
  )
    throw new ApiError(403, "Cannot access another branch");
  res.json({
    success: true,
    data: await service(req.params.resource).get(
      req.params.id,
      branch(req, req.params.resource),
    ),
  });
}
export async function create(req, res) {
  if (req.params.resource === "branches" && !req.user.isSuperAdmin)
    throw new ApiError(403, "Only super admin can create branches");
  if (req.params.resource === "branches") {
    if (!req.body.code || !req.body.name)
      throw new ApiError(422, "Branch code and name are required");
    const data = await withTransaction(async (db) => {
      const [result] = await db.execute(
        `INSERT INTO branches(code,name,name_kh,phone,email,address,address_kh,tax_number,currency_code,timezone,is_head_office,is_active)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          req.body.code,
          req.body.name,
          req.body.name_kh || null,
          req.body.phone || null,
          req.body.email || null,
          req.body.address || null,
          req.body.address_kh || null,
          req.body.tax_number || null,
          req.body.currency_code || "USD",
          req.body.timezone || "Asia/Phnom_Penh",
          req.body.is_head_office ? 1 : 0,
          req.body.is_active ?? 1,
        ],
      );
      const branchId = result.insertId;
      await db.execute(
        "INSERT INTO cash_registers(branch_id,code,name) VALUES(?,'POS-01','Main Cashier')",
        [branchId],
      );
      await db.execute(
        `INSERT INTO payment_methods(branch_id,code,name,name_kh,method_type,requires_reference,is_default,sort_order) VALUES
         (?,'cash','Cash','សាច់ប្រាក់','cash',0,1,1),
         (?,'aba_khqr','ABA KHQR','ABA KHQR','qr',1,0,2),
         (?,'acleda','ACLEDA','អេស៊ីលីដា','qr',1,0,3),
         (?,'wing','Wing','វីង','qr',1,0,4),
         (?,'card','Card','កាត','card',1,0,5),
         (?,'bank_transfer','Bank Transfer','ផ្ទេរធនាគារ','bank',1,0,6),
         (?,'credit','Credit','ជំពាក់','credit',0,0,7),
         (?,'other','Other','ផ្សេងៗ','other',0,0,8)`,
        [
          branchId,
          branchId,
          branchId,
          branchId,
          branchId,
          branchId,
          branchId,
          branchId,
        ],
      );
      await db.execute(
        `INSERT INTO table_shapes(branch_id,code,name,name_kh,shape_type,sort_order) VALUES
         (?,'square','Square','ការ៉េ','square',1),
         (?,'rectangle','Rectangle','ចតុកោណ','rectangle',2),
         (?,'round','Round','មូល','round',3),
         (?,'oval','Oval','ពងក្រពើ','oval',4)`,
        [branchId, branchId, branchId, branchId],
      );
      const sequences = [
        ["order", "ORD"],
        ["payment", "PAY"],
        ["purchase", "PUR"],
        ["purchase_payment", "PPY"],
        ["expense", "EXP"],
        ["refund", "REF"],
        ["adjustment", "ADJ"],
        ["reservation", "RSV"],
        ["kitchen_ticket", "KIT"],
      ];
      for (const [type, prefix] of sequences)
        await db.execute(
          "INSERT INTO invoice_sequences(branch_id,document_type,prefix,next_number) VALUES(?,?,?,1)",
          [branchId, type, prefix],
        );
      return { id: branchId };
    });
    return res.status(201).json({ success: true, data });
  }
  if (req.params.resource === "menuItems")
    return res.status(201).json({
      success: true,
      data: await createWithAutoSku(req.body, "menuItems", "menu_item"),
    });
  if (req.params.resource === "ingredients")
    return res.status(201).json({
      success: true,
      data: await createWithAutoSku(req.body, "ingredients", "ingredient"),
    });
  if (req.params.resource === "shapes") req.body = normalizeShape(req.body);
  if (req.params.resource === "customers")
    req.body = normalizeCustomer(req.body);
  if (req.params.resource === "paymentMethods")
    req.body = normalizePaymentMethod(req.body);
  if (req.params.resource === "tables") await validateTableReferences(req);
  const branchId = branch(req, req.params.resource);
  const data = await service(req.params.resource).create(req.body, branchId);
  if (req.params.resource === "paymentMethods" && data.is_default)
    await pool.execute(
      "UPDATE payment_methods SET is_default=(id=?) WHERE branch_id=?",
      [data.id, branchId],
    );
  res.status(201).json({ success: true, data });
}
export async function update(req, res) {
  if (
    req.params.resource === "branches" &&
    !req.user.isSuperAdmin &&
    Number(req.params.id) !== Number(req.user.branch_id)
  )
    throw new ApiError(403, "Cannot access another branch");
  if (["menuItems", "ingredients"].includes(req.params.resource)) {
    req.body = { ...req.body };
    const sku = normalizeSku(req.body.sku);
    if (sku) req.body.sku = sku;
    else delete req.body.sku;
  }
  if (req.params.resource === "customers")
    req.body = normalizeCustomer(req.body);
  if (req.params.resource === "paymentMethods")
    req.body = normalizePaymentMethod(req.body);
  if (req.params.resource === "shapes") {
    req.body = normalizeShape(req.body);
    const branchId = branch(req, "shapes");
    const current = await service("shapes").get(req.params.id, branchId);
    if (current.code !== req.body.code) {
      const [[used]] = await pool.execute(
        "SELECT COUNT(*) total FROM restaurant_tables WHERE branch_id=? AND shape=?",
        [branchId, current.code],
      );
      if (Number(used.total))
        throw new ApiError(
          409,
          "Shape code cannot be changed while tables are using it",
        );
    }
  }
  if (req.params.resource === "tables")
    await validateTableReferences(req, req.params.id);
  const branchId = branch(req, req.params.resource);
  const data = await service(req.params.resource).update(
    req.params.id,
    req.body,
    branchId,
  );
  if (req.params.resource === "paymentMethods" && data.is_default)
    await pool.execute(
      "UPDATE payment_methods SET is_default=(id=?) WHERE branch_id=?",
      [data.id, branchId],
    );
  res.json({ success: true, data });
}
export async function remove(req, res) {
  if (req.params.resource === "branches" && !req.user.isSuperAdmin)
    throw new ApiError(403, "Only super admin can deactivate branches");
  if (req.params.resource === "paymentMethods") {
    const branchId = branch(req, "paymentMethods");
    const target = await service("paymentMethods").get(req.params.id, branchId);
    if (target.is_active) {
      const [[active]] = await pool.execute(
        "SELECT COUNT(*) total FROM payment_methods WHERE branch_id=? AND is_active=1",
        [branchId],
      );
      if (Number(active.total) <= 1)
        throw new ApiError(
          409,
          "At least one payment method must remain active",
        );
    }
    await service("paymentMethods").deactivate(target.id, branchId);
    return res.json({ success: true, message: "Payment method deactivated" });
  }
  if (req.params.resource === "branches") {
    const [[target]] = await pool.execute(
      "SELECT is_head_office FROM branches WHERE id=?",
      [req.params.id],
    );
    if (target?.is_head_office)
      throw new ApiError(409, "Head office cannot be deactivated");
  }
  if (["areas", "shapes"].includes(req.params.resource)) {
    const branchId = branch(req, req.params.resource);
    const target = await service(req.params.resource).get(
      req.params.id,
      branchId,
    );
    const [[used]] =
      req.params.resource === "areas"
        ? await pool.execute(
            "SELECT COUNT(*) total FROM restaurant_tables WHERE dining_area_id=? AND branch_id=?",
            [target.id, branchId],
          )
        : await pool.execute(
            "SELECT COUNT(*) total FROM restaurant_tables WHERE shape=? AND branch_id=?",
            [target.code, branchId],
          );
    if (!Number(used.total)) {
      const table =
        req.params.resource === "areas" ? "dining_areas" : "table_shapes";
      await pool.execute(`DELETE FROM ${table} WHERE id=? AND branch_id=?`, [
        target.id,
        branchId,
      ]);
      return res.json({ success: true, message: "Record deleted" });
    }
    await service(req.params.resource).deactivate(target.id, branchId);
    return res.json({
      success: true,
      message: "Record is in use and was safely deactivated",
    });
  }
  if (req.params.resource === "tables") {
    const branchId = branch(req, "tables");
    const target = await service("tables").get(req.params.id, branchId);
    const [[openOrder]] = await pool.execute(
      `SELECT id FROM orders WHERE table_id=? AND branch_id=?
       AND status NOT IN('paid','cancelled','voided') LIMIT 1`,
      [target.id, branchId],
    );
    if (openOrder)
      throw new ApiError(409, "Cannot delete a table with an open order");
    const [[activeReservation]] = await pool.execute(
      `SELECT reservation_no FROM reservations WHERE table_id=? AND branch_id=?
       AND status IN('confirmed','seated') ORDER BY reservation_at LIMIT 1`,
      [target.id, branchId],
    );
    if (activeReservation)
      throw new ApiError(
        409,
        `Cannot delete a table with active reservation ${activeReservation.reservation_no}`,
      );
    const [[history]] = await pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM orders WHERE table_id=?) +
         (SELECT COUNT(*) FROM reservations WHERE table_id=?) +
         (SELECT COUNT(*) FROM table_transfers WHERE from_table_id=? OR to_table_id=?) total`,
      [target.id, target.id, target.id, target.id],
    );
    if (!Number(history.total)) {
      await pool.execute(
        "DELETE FROM restaurant_tables WHERE id=? AND branch_id=?",
        [target.id, branchId],
      );
      return res.json({ success: true, message: "Table deleted" });
    }
    await pool.execute(
      "UPDATE restaurant_tables SET is_active=0,status='inactive' WHERE id=? AND branch_id=?",
      [target.id, branchId],
    );
    return res.json({
      success: true,
      message: "Table has history and was safely deactivated",
    });
  }
  await service(req.params.resource).deactivate(
    req.params.id,
    branch(req, req.params.resource),
  );
  res.json({ success: true, message: "Record deactivated" });
}

export async function users(req, res) {
  const branchId = req.user.isSuperAdmin
    ? Number(req.query.branch_id || 0)
    : req.user.branch_id;
  const args = [];
  let where = "";
  if (branchId) {
    where = " WHERE u.branch_id=?";
    args.push(branchId);
  }
  const [rows] = await pool.execute(
    `SELECT u.id,u.branch_id,u.role_id,u.employee_code,u.username,u.full_name,u.full_name_kh,u.phone,u.email,u.preferred_language,u.last_login_at,u.is_active,r.code role_code,r.name role_name FROM users u JOIN roles r ON r.id=u.role_id${where} ORDER BY u.id DESC`,
    args,
  );
  res.json({ success: true, data: rows });
}
export async function auditLogs(req, res) {
  const branchId = resolveBranchId(req);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50));
  const where = [
    req.user.isSuperAdmin
      ? "(a.branch_id=? OR a.branch_id IS NULL)"
      : "a.branch_id=?",
  ];
  const args = [branchId];
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || "")) {
    where.push("a.created_at>=?");
    args.push(req.query.from);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || "")) {
    where.push("a.created_at<DATE_ADD(?,INTERVAL 1 DAY)");
    args.push(req.query.to);
  }
  if (req.query.user_id) {
    where.push("a.user_id=?");
    args.push(Number(req.query.user_id));
  }
  if (req.query.action) {
    where.push("a.action=?");
    args.push(String(req.query.action));
  }
  if (req.query.entity_type) {
    where.push("a.entity_type=?");
    args.push(String(req.query.entity_type));
  }
  if (req.query.search) {
    where.push(
      "(u.username LIKE ? OR u.full_name LIKE ? OR a.action LIKE ? OR a.entity_type LIKE ? OR a.ip_address LIKE ?)",
    );
    for (let i = 0; i < 5; i++) args.push(`%${req.query.search}%`);
  }
  const sqlWhere = `WHERE ${where.join(" AND ")}`;
  const [[count]] = await pool.execute(
    `SELECT COUNT(*) total FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ${sqlWhere}`,
    args,
  );
  const [[summary]] = await pool.execute(
    `SELECT
       SUM(a.action='login') login_success,
       SUM(a.action='login_failed') login_failed,
       SUM(a.action='logout') logout_count
     FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ${sqlWhere}`,
    args,
  );
  const [rows] = await pool.execute(
    `SELECT a.*,u.username,u.full_name,u.full_name_kh,b.name branch_name,b.name_kh branch_name_kh
       FROM audit_logs a
       LEFT JOIN users u ON u.id=a.user_id
       LEFT JOIN branches b ON b.id=a.branch_id
       ${sqlWhere}
      ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    [...args, limit, (page - 1) * limit],
  );
  res.json({
    success: true,
    data: {
      items: rows,
      pagination: {
        page,
        limit,
        total: Number(count.total),
        pages: Math.ceil(Number(count.total) / limit),
      },
      summary: {
        login_success: Number(summary.login_success || 0),
        login_failed: Number(summary.login_failed || 0),
        logout_count: Number(summary.logout_count || 0),
      },
    },
  });
}
export async function createUser(req, res) {
  if (!req.body.username || !req.body.full_name || !req.body.role_id)
    throw new ApiError(422, "Username, full name and role are required");
  if (String(req.body.password || "").length < 8)
    throw new ApiError(422, "Password must contain at least 8 characters");
  const [[role]] = await pool.execute(
    "SELECT code FROM roles WHERE id=? AND is_active=1",
    [req.body.role_id],
  );
  if (!role) throw new ApiError(422, "Role unavailable");
  if (role.code === "super_admin" && !req.user.isSuperAdmin)
    throw new ApiError(403, "Cannot assign super admin");
  const branchId = req.user.isSuperAdmin
    ? role.code === "super_admin"
      ? null
      : Number(req.body.branch_id || 0)
    : req.user.branch_id;
  if (role.code !== "super_admin" && !branchId)
    throw new ApiError(422, "Branch is required for this role");
  const hash = await bcrypt.hash(req.body.password, 12);
  const [r] = await pool.execute(
    `INSERT INTO users(branch_id,role_id,employee_code,username,password_hash,full_name,full_name_kh,phone,email,preferred_language,is_active) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [
      branchId,
      req.body.role_id,
      req.body.employee_code || null,
      req.body.username,
      hash,
      req.body.full_name,
      req.body.full_name_kh || null,
      req.body.phone || null,
      req.body.email || null,
      req.body.preferred_language || "km",
      req.body.is_active ?? 1,
    ],
  );
  res.status(201).json({ success: true, data: { id: r.insertId } });
}
export async function roles(_req, res) {
  const [rows] = await pool.query(
    `SELECT r.*,COUNT(rp.permission_id) permission_count FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id GROUP BY r.id ORDER BY r.id`,
  );
  res.json({ success: true, data: rows });
}
export async function permissions(_req, res) {
  const [rows] = await pool.query(
    "SELECT * FROM permissions ORDER BY module,action",
  );
  res.json({ success: true, data: rows });
}
export async function setRolePermissions(req, res) {
  const [[role]] = await pool.execute("SELECT code FROM roles WHERE id=?", [
    req.params.id,
  ]);
  if (!role) throw new ApiError(404, "Role not found");
  if (role.code === "super_admin")
    throw new ApiError(409, "Super admin always has every permission");
  if (!Array.isArray(req.body.permission_ids))
    throw new ApiError(422, "permission_ids must be an array");
  const ids = [...new Set(req.body.permission_ids.map(Number))].filter(
    Number.isInteger,
  );
  if (ids.length !== req.body.permission_ids.length)
    throw new ApiError(422, "Invalid or duplicate permission id");
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    const [[count]] = await pool.execute(
      `SELECT COUNT(*) total FROM permissions WHERE id IN (${placeholders})`,
      ids,
    );
    if (Number(count.total) !== ids.length)
      throw new ApiError(422, "Unknown permission id");
  }
  await withTransaction(async (db) => {
    await db.execute("DELETE FROM role_permissions WHERE role_id=?", [
      req.params.id,
    ]);
    for (const id of ids)
      await db.execute(
        "INSERT INTO role_permissions(role_id,permission_id) VALUES(?,?)",
        [req.params.id, id],
      );
  });
  res.json({ success: true });
}
export async function getUser(req, res) {
  const [[row]] = await pool.execute(
    `SELECT u.id,u.branch_id,u.role_id,u.employee_code,u.username,u.full_name,u.full_name_kh,u.phone,u.email,u.preferred_language,u.last_login_at,u.is_active,r.code role_code,r.name role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`,
    [req.params.id],
  );
  if (!row) throw new ApiError(404, "User not found");
  if (
    !req.user.isSuperAdmin &&
    Number(row.branch_id) !== Number(req.user.branch_id)
  )
    throw new ApiError(403, "Cannot access another branch");
  res.json({ success: true, data: row });
}
export async function updateUser(req, res) {
  const target = await getUserAccess(req);
  const username = String(req.body.username || "").trim();
  const fullName = String(req.body.full_name || "").trim();
  if (!/^[A-Za-z0-9._-]{3,80}$/.test(username))
    throw new ApiError(
      422,
      "Username must be 3-80 characters using letters, numbers, ., _ or -",
    );
  if (fullName.length < 2) throw new ApiError(422, "Full name is required");
  if (Number(target.id) === Number(req.user.id) && !req.body.is_active)
    throw new ApiError(409, "You cannot deactivate your own account");
  const [[role]] = await pool.execute(
    "SELECT code FROM roles WHERE id=? AND is_active=1",
    [req.body.role_id],
  );
  if (!role) throw new ApiError(422, "Role unavailable");
  if (role.code === "super_admin" && !req.user.isSuperAdmin)
    throw new ApiError(403, "Cannot assign super admin");
  const branchId = req.user.isSuperAdmin
    ? role.code === "super_admin"
      ? null
      : Number(req.body.branch_id || 0) || null
    : req.user.branch_id;
  if (role.code !== "super_admin" && !branchId)
    throw new ApiError(422, "Branch is required for this role");
  if (
    target.role_code === "super_admin" &&
    (role.code !== "super_admin" || !req.body.is_active)
  ) {
    const [[remaining]] = await pool.execute(
      `SELECT COUNT(*) total FROM users u JOIN roles r ON r.id=u.role_id
       WHERE r.code='super_admin' AND u.is_active=1 AND u.id<>?`,
      [target.id],
    );
    if (!Number(remaining.total))
      throw new ApiError(409, "At least one active super admin is required");
  }
  await withTransaction(async (db) => {
    await db.execute(
      `UPDATE users SET branch_id=?,role_id=?,employee_code=?,username=?,full_name=?,full_name_kh=?,phone=?,email=?,preferred_language=?,is_active=? WHERE id=?`,
      [
        branchId,
        req.body.role_id,
        req.body.employee_code || null,
        username,
        fullName,
        req.body.full_name_kh || null,
        req.body.phone || null,
        req.body.email || null,
        req.body.preferred_language || "km",
        req.body.is_active ?? 1,
        req.params.id,
      ],
    );
    if (
      Number(target.role_id) !== Number(req.body.role_id) ||
      Number(target.branch_id || 0) !== Number(branchId || 0) ||
      !req.body.is_active
    )
      await db.execute(
        "UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL",
        [target.id],
      );
  });
  res.json({ success: true, data: { id: target.id } });
}
export async function setUserStatus(req, res) {
  const target = await getUserAccess(req);
  if (Number(target.id) === Number(req.user.id) && !req.body.is_active)
    throw new ApiError(409, "You cannot deactivate your own account");
  await pool.execute("UPDATE users SET is_active=? WHERE id=?", [
    req.body.is_active ? 1 : 0,
    target.id,
  ]);
  if (!req.body.is_active)
    await pool.execute(
      "UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL",
      [target.id],
    );
  res.json({ success: true });
}
export async function resetUserPassword(req, res) {
  const target = await getUserAccess(req);
  if (String(req.body.new_password || "").length < 8)
    throw new ApiError(422, "Password must contain at least 8 characters");
  await pool.execute(
    "UPDATE users SET password_hash=?,password_changed_at=NOW(),failed_login_attempts=0,locked_until=NULL WHERE id=?",
    [await bcrypt.hash(req.body.new_password, 12), target.id],
  );
  await pool.execute(
    "UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL",
    [target.id],
  );
  res.json({ success: true, message: "Password reset" });
}
async function getUserAccess(req) {
  const [[row]] = await pool.execute(
    `SELECT u.id,u.branch_id,u.role_id,u.is_active,r.code role_code
       FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`,
    [req.params.id],
  );
  if (!row) throw new ApiError(404, "User not found");
  if (
    !req.user.isSuperAdmin &&
    Number(row.branch_id) !== Number(req.user.branch_id)
  )
    throw new ApiError(403, "Cannot access another branch");
  return row;
}
export async function getRole(req, res) {
  const [[role]] = await pool.execute("SELECT * FROM roles WHERE id=?", [
    req.params.id,
  ]);
  if (!role) throw new ApiError(404, "Role not found");
  const [permissions] = await pool.execute(
    "SELECT permission_id FROM role_permissions WHERE role_id=?",
    [role.id],
  );
  res.json({
    success: true,
    data: { ...role, permission_ids: permissions.map((x) => x.permission_id) },
  });
}
export async function createRole(req, res) {
  if (!req.body.code || !req.body.name)
    throw new ApiError(422, "Code and name are required");
  const [r] = await pool.execute(
    "INSERT INTO roles(code,name,description,is_system,is_active) VALUES(?,?,?,0,1)",
    [req.body.code, req.body.name, req.body.description || null],
  );
  res.status(201).json({ success: true, data: { id: r.insertId } });
}
export async function updateRole(req, res) {
  const [[role]] = await pool.execute("SELECT * FROM roles WHERE id=?", [
    req.params.id,
  ]);
  if (!role) throw new ApiError(404, "Role not found");
  if (role.code === "super_admin" && !req.user.isSuperAdmin)
    throw new ApiError(403, "Cannot edit super admin");
  if (role.code === "super_admin" && !req.body.is_active)
    throw new ApiError(409, "Super admin role cannot be deactivated");
  await pool.execute(
    "UPDATE roles SET name=?,description=?,is_active=? WHERE id=?",
    [
      req.body.name,
      req.body.description || null,
      req.body.is_active ?? 1,
      role.id,
    ],
  );
  res.json({ success: true });
}
