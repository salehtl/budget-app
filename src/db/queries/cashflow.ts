import type { DbClient } from "../client.ts";
import type { CashflowItem } from "../../types/database.ts";

export interface MonthActual {
  month: string;
  type: "income" | "expense";
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  recurring_id: string | null;
  payee: string;
  total: number;
  count: number;
}

export interface MonthTransaction {
  id: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  payee: string;
  notes: string;
  category_id: string | null;
  recurring_id: string | null;
}

export async function getActualsForRange(
  db: DbClient,
  startMonth: string,
  endMonth: string
): Promise<MonthActual[]> {
  const { rows } = await db.exec<MonthActual>(
    `SELECT
       substr(t.date, 1, 7) as month,
       t.type,
       t.category_id,
       c.name as category_name,
       c.color as category_color,
       t.recurring_id,
       t.payee,
       SUM(t.amount) as total,
       COUNT(*) as count
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE substr(t.date, 1, 7) >= ? AND substr(t.date, 1, 7) <= ?
     GROUP BY month, t.type, t.category_id, t.recurring_id, t.payee
     ORDER BY month, t.type, total DESC`,
    [startMonth, endMonth]
  );
  return rows;
}

export async function getTransactionsForMonth(
  db: DbClient,
  month: string,
  categoryId?: string | null,
  recurringId?: string | null
): Promise<MonthTransaction[]> {
  const where = ["substr(t.date, 1, 7) = ?"];
  const params: unknown[] = [month];

  if (categoryId !== undefined) {
    if (categoryId === null) {
      where.push("t.category_id IS NULL");
    } else {
      where.push("t.category_id = ?");
      params.push(categoryId);
    }
  }
  if (recurringId !== undefined) {
    if (recurringId === null) {
      where.push("t.recurring_id IS NULL");
    } else {
      where.push("t.recurring_id = ?");
      params.push(recurringId);
    }
  }

  const { rows } = await db.exec<MonthTransaction>(
    `SELECT t.id, t.amount, t.type, t.date, t.payee, t.notes, t.category_id, t.recurring_id
     FROM transactions t
     WHERE ${where.join(" AND ")}
     ORDER BY t.date DESC`,
    params
  );
  return rows;
}

export async function getCashflowItems(
  db: DbClient
): Promise<CashflowItem[]> {
  const { rows } = await db.exec<CashflowItem>(
    "SELECT * FROM cashflow_items ORDER BY sort_order, created_at"
  );
  return rows;
}

export async function createCashflowItem(
  db: DbClient,
  item: {
    id: string;
    label: string;
    type: "income" | "expense";
    amount: number;
    category_id?: string | null;
    group_name?: string;
    month?: string | null;
    recurring_id?: string | null;
    sort_order?: number;
  }
): Promise<void> {
  await db.exec(
    `INSERT INTO cashflow_items (id, label, type, amount, category_id, group_name, month, recurring_id, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.label,
      item.type,
      item.amount,
      item.category_id ?? null,
      item.group_name ?? "",
      item.month ?? null,
      item.recurring_id ?? null,
      item.sort_order ?? 0,
    ]
  );
}

export async function updateCashflowItem(
  db: DbClient,
  id: string,
  updates: Partial<{
    label: string;
    type: "income" | "expense";
    amount: number;
    category_id: string | null;
    group_name: string;
    month: string | null;
    sort_order: number;
  }>
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      params.push(value);
    }
  }

  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  params.push(id);

  await db.exec(
    `UPDATE cashflow_items SET ${sets.join(", ")} WHERE id = ?`,
    params
  );
}

export async function deleteCashflowItem(
  db: DbClient,
  id: string
): Promise<void> {
  await db.exec("DELETE FROM cashflow_items WHERE id = ?", [id]);
}
