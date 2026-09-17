import { pool, withTransaction } from "../config/database.js";
import { resolveBranchId } from "../middleware/permission.middleware.js";
import { nextNumber } from "../services/sequence.service.js";
import { ApiError } from "../utils/api-error.js";
export async function list(req, res) {
  const b = resolveBranchId(req);
  const [rows] = await pool.execute(
    "SELECT p.*,s.name supplier_name FROM purchases p JOIN suppliers s ON s.id=p.supplier_id WHERE p.branch_id=? ORDER BY p.purchase_date DESC",
    [b],
  );
  res.json({ success: true, data: rows });
}
export async function create(req, res) {
  const b = resolveBranchId(req);
  const data = await withTransaction(async (db) => {
    const no = await nextNumber(db, b, "purchase");
    let subtotal = 0;
    for (const x of req.body.items)
      subtotal +=
        Number(x.ordered_quantity) * Number(x.unit_cost) -
        Number(x.discount_amount || 0) +
        Number(x.tax_amount || 0);
    const total =
      subtotal -
      Number(req.body.discount_amount || 0) +
      Number(req.body.tax_amount || 0);
    const [r] = await db.execute(
      `INSERT INTO purchases(branch_id,supplier_id,purchase_no,supplier_invoice_no,status,subtotal,discount_amount,tax_amount,total_amount,due_amount,notes,created_by) VALUES(?,?,?,?, 'draft',?,?,?,?,?,?,?)`,
      [
        b,
        req.body.supplier_id,
        no,
        req.body.supplier_invoice_no || null,
        subtotal,
        req.body.discount_amount || 0,
        req.body.tax_amount || 0,
        total,
        total,
        req.body.notes || null,
        req.user.id,
      ],
    );
    for (const x of req.body.items)
      await db.execute(
        `INSERT INTO purchase_items(purchase_id,ingredient_id,ordered_quantity,unit_cost,discount_amount,tax_amount,line_total) VALUES(?,?,?,?,?,?,?)`,
        [
          r.insertId,
          x.ingredient_id,
          x.ordered_quantity,
          x.unit_cost,
          x.discount_amount || 0,
          x.tax_amount || 0,
          Number(x.ordered_quantity) * Number(x.unit_cost) -
            Number(x.discount_amount || 0) +
            Number(x.tax_amount || 0),
        ],
      );
    return { id: r.insertId, purchase_no: no };
  });
  res.status(201).json({ success: true, data });
}
export async function receive(req, res) {
  const b = resolveBranchId(req);
  await withTransaction(async (db) => {
    const [[p]] = await db.execute(
      "SELECT * FROM purchases WHERE id=? AND branch_id=? FOR UPDATE",
      [req.params.id, b],
    );
    if (!p || !["draft", "ordered", "partially_received"].includes(p.status))
      throw new ApiError(409, "Purchase cannot be received");
    const [items] = await db.execute(
      "SELECT * FROM purchase_items WHERE purchase_id=? FOR UPDATE",
      [p.id],
    );
    for (const x of items) {
      const qty = Number(
        (req.body.items || []).find((i) => Number(i.purchase_item_id) === x.id)
          ?.quantity ?? x.ordered_quantity - x.received_quantity,
      );
      if (qty <= 0) continue;
      await db.execute(
        `INSERT INTO inventory(branch_id,ingredient_id,quantity_on_hand,average_cost,last_movement_at) VALUES(?,?,?, ?,NOW()) ON DUPLICATE KEY UPDATE average_cost=((quantity_on_hand*average_cost)+(VALUES(quantity_on_hand)*VALUES(average_cost)))/(quantity_on_hand+VALUES(quantity_on_hand)),quantity_on_hand=quantity_on_hand+VALUES(quantity_on_hand),last_movement_at=NOW()`,
        [b, x.ingredient_id, qty, x.unit_cost],
      );
      const [[inv]] = await db.execute(
        "SELECT * FROM inventory WHERE branch_id=? AND ingredient_id=?",
        [b, x.ingredient_id],
      );
      await db.execute(
        `INSERT INTO stock_movements(branch_id,ingredient_id,movement_type,quantity,unit_cost,balance_after,reference_type,reference_id,created_by) VALUES(?,?,'purchase',?,?,?,'purchase',?,?)`,
        [
          b,
          x.ingredient_id,
          qty,
          x.unit_cost,
          inv.quantity_on_hand,
          p.id,
          req.user.id,
        ],
      );
      await db.execute(
        "UPDATE purchase_items SET received_quantity=received_quantity+? WHERE id=?",
        [qty, x.id],
      );
    }
    const [[left]] = await db.execute(
      "SELECT SUM(ordered_quantity-received_quantity) remaining FROM purchase_items WHERE purchase_id=?",
      [p.id],
    );
    await db.execute(
      `UPDATE purchases SET status=?,received_by=?,received_at=IF(?='received',NOW(),received_at) WHERE id=?`,
      [
        Number(left.remaining) <= 0 ? "received" : "partially_received",
        req.user.id,
        Number(left.remaining) <= 0 ? "received" : "partially_received",
        p.id,
      ],
    );
  });
  res.json({ success: true });
}
