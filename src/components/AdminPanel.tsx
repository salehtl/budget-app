import { useState, useEffect, useCallback } from "react";
import { useDb } from "../context/DbContext.tsx";
import { Modal } from "./ui/Modal.tsx";
import { Button } from "./ui/Button.tsx";
import { emitDbEvent } from "../lib/db-events.ts";
import { CREATE_TABLES, SCHEMA_VERSION } from "../db/schema.ts";
import { getSeedSQL, getCashflowSeedSQL } from "../db/seed.ts";

const ALL_TABLES = [
  "transaction_tags",
  "tags",
  "transactions",
  "budgets",
  "recurring_transactions",
  "categories",
  "settings",
];

function emitAllDbEvents() {
  emitDbEvent("transactions-changed");
  emitDbEvent("categories-changed");
  emitDbEvent("recurring-changed");
  emitDbEvent("settings-changed");
  emitDbEvent("tags-changed");
}

async function execStatements(
  db: { exec: (sql: string, params?: unknown[]) => Promise<unknown> },
  sql: string,
) {
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await db.exec(stmt + ";");
  }
}

type TableCounts = Record<string, number>;

export function AdminPanel() {
  if (!import.meta.env.VITE_DEV_TOOLS) return null;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [tableCounts, setTableCounts] = useState<TableCounts | null>(null);
  const [sqlInput, setSqlInput] = useState("");
  const [sqlResult, setSqlResult] = useState<string | null>(null);
  const db = useDb();

  const fetchTableCounts = useCallback(async () => {
    try {
      const counts: TableCounts = {};
      for (const table of ALL_TABLES) {
        const rows = await db.exec<{ count: number }>(
          `SELECT COUNT(*) as count FROM ${table};`,
        );
        counts[table] = rows[0]?.count ?? 0;
      }
      setTableCounts(counts);
    } catch {
      setTableCounts(null);
    }
  }, [db]);

  useEffect(() => {
    if (open) fetchTableCounts();
  }, [open, fetchTableCounts]);

  async function dropAndRecreate() {
    for (const table of ALL_TABLES) {
      await db.exec(`DROP TABLE IF EXISTS ${table};`);
    }
    await execStatements(db, CREATE_TABLES);
    await db.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }

  async function handleClearOnly() {
    setLoading("clear");
    setResult(null);
    try {
      await dropAndRecreate();
      emitAllDbEvents();
      await fetchTableCounts();
      setResult("Database cleared (empty tables, no seed data).");
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    } finally {
      setLoading(null);
    }
  }

  async function handleClearAndReseed() {
    setLoading("reseed");
    setResult(null);
    try {
      await dropAndRecreate();
      await execStatements(db, getSeedSQL());
      await execStatements(db, getCashflowSeedSQL());
      emitAllDbEvents();
      await fetchTableCounts();
      setResult("Database cleared and re-seeded successfully.");
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    } finally {
      setLoading(null);
    }
  }

  async function handleRunSQL() {
    if (!sqlInput.trim()) return;
    setSqlResult(null);
    try {
      const rows = await db.exec(sqlInput.trim());
      if (Array.isArray(rows) && rows.length > 0) {
        setSqlResult(JSON.stringify(rows, null, 2));
      } else {
        setSqlResult("Query executed successfully. No rows returned.");
      }
      emitAllDbEvents();
      await fetchTableCounts();
    } catch (e: any) {
      setSqlResult(`Error: ${e.message}`);
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-12 h-12 rounded-full bg-primary text-white shadow-lg hover:bg-primary-light transition-colors flex items-center justify-center cursor-pointer"
        title="Dev Tools"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {/* Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Dev Tools">
        <div className="space-y-5">
          {/* Table Counts */}
          {tableCounts && (
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                Table Rows
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_TABLES.map((table) => (
                  <div
                    key={table}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-surface rounded text-sm"
                  >
                    <span className="text-text-muted font-mono text-xs">
                      {table}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {tableCounts[table]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Database Actions */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
              Database Actions
            </h3>
            <div className="space-y-2">
              <Button
                variant="danger"
                onClick={handleClearOnly}
                disabled={loading !== null}
                className="w-full"
              >
                {loading === "clear"
                  ? "Clearing..."
                  : "Clear DB (No Seed)"}
              </Button>
              <Button
                variant="danger"
                onClick={handleClearAndReseed}
                disabled={loading !== null}
                className="w-full"
              >
                {loading === "reseed"
                  ? "Clearing & Seeding..."
                  : "Clear DB & Re-seed"}
              </Button>
            </div>

            {result && (
              <p
                className={`text-sm mt-2 ${result.startsWith("Error") ? "text-danger" : "text-success"}`}
              >
                {result}
              </p>
            )}
          </div>

          {/* SQL Console */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
              SQL Console
            </h3>
            <textarea
              value={sqlInput}
              onChange={(e) => setSqlInput(e.target.value)}
              placeholder="SELECT * FROM categories LIMIT 5;"
              className="w-full h-24 px-3 py-2 bg-surface border border-border rounded-lg font-mono text-xs resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  handleRunSQL();
                }
              }}
            />
            <Button
              variant="secondary"
              onClick={handleRunSQL}
              disabled={!sqlInput.trim()}
              className="w-full mt-1.5"
            >
              Run Query
            </Button>
            {sqlResult && (
              <pre className="mt-2 p-2.5 bg-surface border border-border rounded-lg text-xs font-mono max-h-48 overflow-auto whitespace-pre-wrap">
                {sqlResult}
              </pre>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
