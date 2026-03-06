import type { DbClient } from "../db/client.ts";

export async function exportJSON(db: DbClient): Promise<string> {
  const [categories, transactions, recurring, settings, tags] =
    await Promise.all([
      db.exec("SELECT * FROM categories"),
      db.exec("SELECT * FROM transactions"),
      db.exec("SELECT * FROM recurring_transactions"),
      db.exec("SELECT * FROM settings"),
      db.exec("SELECT * FROM tags"),
    ]);

  const data = {
    version: 1,
    exported_at: new Date().toISOString(),
    categories: categories.rows,
    transactions: transactions.rows,
    recurring_transactions: recurring.rows,
    settings: settings.rows,
    tags: tags.rows,
  };

  return JSON.stringify(data, null, 2);
}

export async function exportCSV(db: DbClient): Promise<string> {
  const { rows } = await db.exec(
    `SELECT t.date, t.type, t.amount, t.payee, t.notes,
            COALESCE(c.name, '') as category
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     ORDER BY t.date DESC`
  );

  const headers = ["Date", "Type", "Amount", "Payee", "Notes", "Category"];
  const csvRows = rows.map((row: any) =>
    [row.date, row.type, row.amount, csvEscape(row.payee), csvEscape(row.notes), csvEscape(row.category)].join(",")
  );

  return [headers.join(","), ...csvRows].join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
