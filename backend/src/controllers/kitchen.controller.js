import { pool } from "../config/database.js";
import { resolveBranchId } from "../middleware/permission.middleware.js";
import { ApiError } from "../utils/api-error.js";
export async function queue(req, res) {
  const b = resolveBranchId(req);
  const args = [b];
  let extra = "";
  if (req.query.station_id) {
    extra = " AND kt.kitchen_station_id=?";
    args.push(req.query.station_id);
  }
  const [rows] = await pool.execute(
    `SELECT kt.*,o.order_no,o.table_id,rt.name table_name,ks.name station_name FROM kitchen_tickets kt JOIN orders o ON o.id=kt.order_id LEFT JOIN restaurant_tables rt ON rt.id=o.table_id JOIN kitchen_stations ks ON ks.id=kt.kitchen_station_id WHERE kt.branch_id=? AND kt.status NOT IN('completed','cancelled')${extra} ORDER BY kt.sent_at`,
    args,
  );
  for (const x of rows) {
    const [items] = await pool.execute(
      `SELECT oi.* FROM kitchen_ticket_items kti JOIN order_items oi ON oi.id=kti.order_item_id WHERE kti.kitchen_ticket_id=?`,
      [x.id],
    );
    x.items = items;
  }
  res.json({ success: true, data: rows });
}
export async function status(req, res) {
  const b = resolveBranchId(req);
  const map = {
    accepted: "accepted_at",
    ready: "ready_at",
    completed: "completed_at",
  };
  if (
    !["accepted", "preparing", "ready", "completed", "cancelled"].includes(
      req.body.status,
    )
  )
    throw new ApiError(422, "Invalid status");
  const [[t]] = await pool.execute(
    "SELECT * FROM kitchen_tickets WHERE id=? AND branch_id=?",
    [req.params.id, b],
  );
  if (!t) throw new ApiError(404, "Ticket not found");
  const time = map[req.body.status];
  await pool.execute(
    `UPDATE kitchen_tickets SET status=?${time ? `,` + time + "=NOW()" : ""} WHERE id=?`,
    [req.body.status, t.id],
  );
  const itemStatus =
    req.body.status === "completed" ? "served" : req.body.status;
  await pool.execute(
    `UPDATE order_items oi JOIN kitchen_ticket_items kti ON kti.order_item_id=oi.id SET oi.kitchen_status=? WHERE kti.kitchen_ticket_id=?`,
    [itemStatus, t.id],
  );
  req.app
    .get("io")
    .to(`branch:${b}`)
    .emit("kitchen:updated", { ticketId: t.id, status: req.body.status });
  res.json({ success: true });
}
