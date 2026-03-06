import { useState } from "react";
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
  "cashflow_items",
  "recurring_transactions",
  "categories",
  "settings",
];

export function AdminPanel() {
  if (!import.meta.env.VITE_DEV_TOOLS) return null;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const db = useDb();

  async function handleClearAndReseed() {
    setLoading(true);
    setResult(null);
    try {
      // Drop all tables in dependency order
      for (const table of ALL_TABLES) {
        await db.exec(`DROP TABLE IF EXISTS ${table};`);
      }

      // Re-create tables
      const createStatements = CREATE_TABLES.split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const stmt of createStatements) {
        await db.exec(stmt + ";");
      }

      // Set schema version
      await db.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);

      // Re-seed
      const seedStatements = getSeedSQL()
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const stmt of seedStatements) {
        await db.exec(stmt + ";");
      }

      const cashflowStatements = getCashflowSeedSQL()
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const stmt of cashflowStatements) {
        await db.exec(stmt + ";");
      }

      // Notify all hooks to refresh
      emitDbEvent("transactions-changed");
      emitDbEvent("categories-changed");
      emitDbEvent("recurring-changed");
      emitDbEvent("settings-changed");
      emitDbEvent("tags-changed");
      emitDbEvent("cashflow-changed");

      setResult("Database cleared and re-seeded successfully.");
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-12 h-12 rounded-full bg-primary text-white shadow-lg hover:bg-primary-light transition-colors flex items-center justify-center cursor-pointer"
        title="Admin Panel"
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
      <Modal open={open} onClose={() => setOpen(false)} title="Admin Panel">
        <div className="space-y-4">
          <div className="p-3 bg-danger-light/30 border border-danger/20 rounded-lg">
            <p className="text-sm font-medium text-danger">
              This will permanently delete all data and re-seed with defaults.
            </p>
          </div>

          <Button
            variant="danger"
            onClick={handleClearAndReseed}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Clearing..." : "Clear DB & Re-seed"}
          </Button>

          {result && (
            <p
              className={`text-sm ${result.startsWith("Error") ? "text-danger" : "text-success"}`}
            >
              {result}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
