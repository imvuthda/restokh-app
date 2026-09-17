import { pool } from "../config/database.js";
import { ApiError } from "../utils/api-error.js";
import { pagination } from "../utils/pagination.js";

export function crudService({
  table,
  fields,
  searchFields = [],
  branchScoped = false,
  orderBy = "id DESC",
}) {
  const allowed = new Set(fields);
  return {
    async list(query, branchId = null) {
      const { page, limit, offset } = pagination(query);
      const where = [];
      const args = [];
      if (branchScoped) {
        where.push("branch_id=?");
        args.push(branchId);
      }
      if (query.search && searchFields.length) {
        where.push(`(${searchFields.map((f) => `${f} LIKE ?`).join(" OR ")})`);
        searchFields.forEach(() => args.push(`%${query.search}%`));
      }
      if (query.is_active !== undefined && allowed.has("is_active")) {
        where.push("is_active=?");
        args.push(Number(query.is_active));
      }
      const sqlWhere = where.length ? ` WHERE ${where.join(" AND ")}` : "";
      const [[count]] = await pool.execute(
        `SELECT COUNT(*) total FROM ${table}${sqlWhere}`,
        args,
      );
      const [rows] = await pool.execute(
        `SELECT * FROM ${table}${sqlWhere} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      );
      return {
        items: rows,
        pagination: {
          page,
          limit,
          total: count.total,
          pages: Math.ceil(count.total / limit),
        },
      };
    },
    async get(id, branchId = null) {
      const args = [id];
      let sql = `SELECT * FROM ${table} WHERE id=?`;
      if (branchScoped) {
        sql += " AND branch_id=?";
        args.push(branchId);
      }
      const [[row]] = await pool.execute(sql, args);
      if (!row) throw new ApiError(404, "Record not found");
      return row;
    },
    async create(data, branchId = null) {
      const clean = Object.fromEntries(
        Object.entries(data).filter(
          ([k, v]) => allowed.has(k) && v !== undefined,
        ),
      );
      if (branchScoped) clean.branch_id = branchId;
      const keys = Object.keys(clean);
      if (!keys.length) throw new ApiError(422, "No valid fields");
      const [r] = await pool.execute(
        `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
        Object.values(clean),
      );
      return this.get(r.insertId, branchId);
    },
    async update(id, data, branchId = null) {
      await this.get(id, branchId);
      const clean = Object.fromEntries(
        Object.entries(data).filter(
          ([k, v]) => allowed.has(k) && k !== "branch_id" && v !== undefined,
        ),
      );
      const keys = Object.keys(clean);
      if (!keys.length) throw new ApiError(422, "No valid fields");
      await pool.execute(
        `UPDATE ${table} SET ${keys.map((k) => `${k}=?`).join(",")} WHERE id=?`,
        [...Object.values(clean), id],
      );
      return this.get(id, branchId);
    },
    async deactivate(id, branchId = null) {
      if (!allowed.has("is_active"))
        throw new ApiError(405, "Deactivate is unavailable");
      await this.get(id, branchId);
      await pool.execute(`UPDATE ${table} SET is_active=0 WHERE id=?`, [id]);
    },
  };
}
