import type { DbClient } from "../client.ts";

export async function getSetting(
  db: DbClient,
  key: string
): Promise<string | null> {
  const { rows } = await db.exec<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [key]
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(
  db: DbClient,
  key: string,
  value: string
): Promise<void> {
  await db.exec(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
    [key, value, value]
  );
}

export async function getAllSettings(
  db: DbClient
): Promise<Record<string, string>> {
  const { rows } = await db.exec<{ key: string; value: string }>(
    "SELECT * FROM settings"
  );
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}
