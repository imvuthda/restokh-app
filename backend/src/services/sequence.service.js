import { ApiError } from "../utils/api-error.js";
export async function nextNumber(db, branchId, type) {
  const [[seq]] = await db.execute(
    `SELECT id,prefix,separator_text,number_length,next_number,reset_period,last_reset_date FROM invoice_sequences WHERE branch_id=? AND document_type=? AND is_active=1 LIMIT 1 FOR UPDATE`,
    [branchId, type],
  );
  if (!seq) throw new ApiError(409, `Missing active sequence: ${type}`);
  let n = seq.next_number;
  const today = new Date().toISOString().slice(0, 10);
  if (seq.reset_period !== "never" && seq.last_reset_date !== today) n = 1;
  await db.execute(
    "UPDATE invoice_sequences SET next_number=?,last_reset_date=? WHERE id=?",
    [n + 1, today, seq.id],
  );
  return `${seq.prefix}${seq.separator_text}${String(n).padStart(seq.number_length, "0")}`;
}
