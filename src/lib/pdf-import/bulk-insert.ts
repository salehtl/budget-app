import type { DbClient } from "../../db/client.ts";
import type { ParsedTransaction } from "./types.ts";
import { emitDbEvent } from "../db-events.ts";

export async function bulkInsertTransactions(
  db: DbClient,
  transactions: ParsedTransaction[],
): Promise<number> {
  const selected = transactions.filter((t) => t.selected);
  if (selected.length === 0) return 0;

  await db.exec("BEGIN TRANSACTION;");
  try {
    for (const t of selected) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.exec(
        `INSERT INTO transactions (id, amount, type, category_id, date, payee, notes, recurring_id, status, group_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'confirmed', '', ?, ?)`,
        [id, t.amount, t.type, t.category_id, t.date, t.payee, t.notes, now, now],
      );
    }
    await db.exec("COMMIT;");
  } catch (e) {
    await db.exec("ROLLBACK;");
    throw e;
  }

  emitDbEvent("transactions-changed");
  return selected.length;
}
