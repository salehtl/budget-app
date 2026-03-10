import Database from "better-sqlite3";
import { CREATE_TABLES, SCHEMA_VERSION } from "../db/schema";

export interface TestDb {
  exec: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; changes: number }>;
  close: () => void;
}

export function createTestDb(): TestDb {
  const raw = new Database(":memory:");
  // Disable foreign keys during schema creation because CREATE_TABLES
  // defines `transactions` (which references `recurring_transactions`)
  // before `recurring_transactions` exists.
  raw.pragma("foreign_keys = OFF");
  raw.exec(CREATE_TABLES);

  // No need to run MIGRATIONS — they are upgrade-only (e.g. migration 2
  // ALTERs columns that already exist in the current CREATE_TABLES DDL).
  // The full current schema is already captured in CREATE_TABLES.
  raw.pragma(`user_version = ${SCHEMA_VERSION}`);

  // Re-enable foreign keys for all subsequent operations
  raw.pragma("foreign_keys = ON");

  return {
    exec: async <T = Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): Promise<{ rows: T[]; changes: number }> => {
      const stmt = raw.prepare(sql);
      if (stmt.reader) {
        const rows = (params ? stmt.all(...params) : stmt.all()) as T[];
        return { rows, changes: 0 };
      } else {
        const result = params ? stmt.run(...params) : stmt.run();
        return { rows: [] as T[], changes: result.changes };
      }
    },
    close: () => raw.close(),
  };
}
