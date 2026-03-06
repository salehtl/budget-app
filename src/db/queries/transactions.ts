import type { DbClient } from "../client.ts";
import type { Transaction } from "../../types/database.ts";

export interface TransactionFilters {
  month?: string; // YYYY-MM
  categoryId?: string;
  type?: "income" | "expense";
  search?: string;
}

export interface TransactionWithCategory extends Transaction {
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
}

export async function getTransactions(
  db: DbClient,
  filters?: TransactionFilters
): Promise<TransactionWithCategory[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters?.month) {
    where.push("t.date LIKE ?");
    params.push(filters.month + "%");
  }
  if (filters?.categoryId) {
    where.push("(t.category_id = ? OR c.parent_id = ?)");
    params.push(filters.categoryId, filters.categoryId);
  }
  if (filters?.type) {
    where.push("t.type = ?");
    params.push(filters.type);
  }
  if (filters?.search) {
    where.push("(t.payee LIKE ? OR t.notes LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows } = await db.exec<TransactionWithCategory>(
    `SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     ${whereClause}
     ORDER BY t.date DESC, t.created_at DESC`,
    params
  );
  return rows;
}

export async function getTransactionById(
  db: DbClient,
  id: string
): Promise<Transaction | undefined> {
  const { rows } = await db.exec<Transaction>(
    "SELECT * FROM transactions WHERE id = ?",
    [id]
  );
  return rows[0];
}

export async function createTransaction(
  db: DbClient,
  txn: {
    id: string;
    amount: number;
    type: "income" | "expense";
    category_id: string | null;
    date: string;
    payee?: string;
    notes?: string;
    recurring_id?: string | null;
  }
): Promise<void> {
  await db.exec(
    `INSERT INTO transactions (id, amount, type, category_id, date, payee, notes, recurring_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      txn.id,
      txn.amount,
      txn.type,
      txn.category_id,
      txn.date,
      txn.payee ?? "",
      txn.notes ?? "",
      txn.recurring_id ?? null,
    ]
  );
}

export async function updateTransaction(
  db: DbClient,
  id: string,
  updates: {
    amount?: number;
    type?: "income" | "expense";
    category_id?: string | null;
    date?: string;
    payee?: string;
    notes?: string;
  }
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.amount !== undefined) {
    sets.push("amount = ?");
    params.push(updates.amount);
  }
  if (updates.type !== undefined) {
    sets.push("type = ?");
    params.push(updates.type);
  }
  if (updates.category_id !== undefined) {
    sets.push("category_id = ?");
    params.push(updates.category_id);
  }
  if (updates.date !== undefined) {
    sets.push("date = ?");
    params.push(updates.date);
  }
  if (updates.payee !== undefined) {
    sets.push("payee = ?");
    params.push(updates.payee);
  }
  if (updates.notes !== undefined) {
    sets.push("notes = ?");
    params.push(updates.notes);
  }

  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  params.push(id);

  await db.exec(
    `UPDATE transactions SET ${sets.join(", ")} WHERE id = ?`,
    params
  );
}

export async function deleteTransaction(
  db: DbClient,
  id: string
): Promise<void> {
  await db.exec("DELETE FROM transactions WHERE id = ?", [id]);
}

export async function getMonthSummary(
  db: DbClient,
  month: string
): Promise<{ total_income: number; total_expenses: number }> {
  const { rows } = await db.exec<{
    total_income: number;
    total_expenses: number;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses
     FROM transactions
     WHERE date LIKE ?`,
    [month + "%"]
  );
  return rows[0] ?? { total_income: 0, total_expenses: 0 };
}

export async function getCategoryBreakdown(
  db: DbClient,
  month: string,
  type: "income" | "expense" = "expense"
): Promise<
  { category_id: string; category_name: string; category_color: string; total: number }[]
> {
  const { rows } = await db.exec<{
    category_id: string;
    category_name: string;
    category_color: string;
    total: number;
  }>(
    `SELECT
       COALESCE(CASE WHEN c.parent_id IS NOT NULL THEN c.parent_id ELSE c.id END, 'uncategorized') as category_id,
       COALESCE(CASE WHEN c.parent_id IS NOT NULL THEN p.name ELSE c.name END, 'Uncategorized') as category_name,
       COALESCE(CASE WHEN c.parent_id IS NOT NULL THEN p.color ELSE c.color END, '#94a3b8') as category_color,
       SUM(t.amount) as total
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN categories p ON c.parent_id = p.id
     WHERE t.date LIKE ? AND t.type = ?
     GROUP BY category_id
     ORDER BY total DESC`,
    [month + "%", type]
  );
  return rows;
}

export async function getMonthlyTrends(
  db: DbClient,
  months: number = 6
): Promise<{ month: string; income: number; expenses: number }[]> {
  const { rows } = await db.exec<{
    month: string;
    income: number;
    expenses: number;
  }>(
    `SELECT
       substr(date, 1, 7) as month,
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
     FROM transactions
     WHERE date >= date('now', ? || ' months')
     GROUP BY month
     ORDER BY month`,
    [`-${months}`]
  );
  return rows;
}
