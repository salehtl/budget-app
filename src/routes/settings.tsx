import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "../components/layout/PageHeader.tsx";
import { Button } from "../components/ui/Button.tsx";
import { useToast } from "../components/ui/Toast.tsx";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.tsx";
import { useDb } from "../context/DbContext.tsx";
import { exportJSON, exportCSV, downloadFile } from "../lib/export.ts";
import { importJSON } from "../lib/import.ts";
import {
  isFileSystemAccessSupported,
  pickDirectory,
  getStoredDirectory,
  autoExport,
} from "../lib/fs-sync.ts";
import { getSetting, setSetting } from "../db/queries/settings.ts";
import { emitDbEvent } from "../lib/db-events.ts";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const db = useDb();
  const { toast } = useToast();

  const [lastExport, setLastExport] = useState<string | null>(null);
  const [hasDir, setHasDir] = useState(false);
  const [autoExportEnabled, setAutoExportEnabled] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importData, setImportData] = useState<string | null>(null);

  useEffect(() => {
    getSetting(db, "last_export").then(setLastExport);
    getSetting(db, "auto_export").then((v) => setAutoExportEnabled(v === "true"));
    getStoredDirectory().then((h) => setHasDir(!!h));
  }, [db]);

  async function handleExportJSON() {
    try {
      const json = await exportJSON(db);
      downloadFile(json, `budget-backup-${new Date().toISOString().split("T")[0]}.json`, "application/json");
      const now = new Date().toISOString();
      await setSetting(db, "last_export", now);
      setLastExport(now);
      toast("JSON exported successfully");
    } catch {
      toast("Export failed", "error");
    }
  }

  async function handleExportCSV() {
    try {
      const csv = await exportCSV(db);
      downloadFile(csv, `transactions-${new Date().toISOString().split("T")[0]}.csv`, "text/csv");
      toast("CSV exported successfully");
    } catch {
      toast("Export failed", "error");
    }
  }

  function handleImportSelect() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      setImportData(text);
      setShowImportConfirm(true);
    };
    input.click();
  }

  async function handleImportConfirm() {
    if (!importData) return;
    try {
      await importJSON(db, importData);
      emitDbEvent("transactions-changed");
      emitDbEvent("categories-changed");
      emitDbEvent("recurring-changed");
      emitDbEvent("settings-changed");
      toast("Data imported successfully");
    } catch (e: any) {
      toast(`Import failed: ${e.message}`, "error");
    }
    setImportData(null);
  }

  async function handlePickDirectory() {
    const handle = await pickDirectory();
    if (handle) {
      setHasDir(true);
      toast("Directory linked for auto-export");
    }
  }

  async function handleForceExport() {
    const success = await autoExport(db);
    if (success) {
      const now = new Date().toISOString();
      await setSetting(db, "last_export", now);
      setLastExport(now);
      toast("Exported to directory");
    } else {
      toast("Export failed - check directory permissions", "error");
    }
  }

  async function toggleAutoExport() {
    const newValue = !autoExportEnabled;
    await setSetting(db, "auto_export", String(newValue));
    setAutoExportEnabled(newValue);
  }

  return (
    <div>
      <PageHeader title="Settings" />

      {/* Auto-export section */}
      {isFileSystemAccessSupported() && (
        <section className="bg-surface rounded-xl border border-border p-4 mb-4">
          <h2 className="text-sm font-bold mb-3">Auto-Export to Directory</h2>
          <p className="text-xs text-text-muted mb-3">
            Automatically save a backup file to a chosen directory after each change.
            Great for syncing with iCloud, Dropbox, etc.
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={handlePickDirectory}>
                {hasDir ? "Change Directory" : "Choose Directory"}
              </Button>
              {hasDir && (
                <span className="text-xs text-success">Directory linked</span>
              )}
            </div>
            {hasDir && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto-export"
                    checked={autoExportEnabled}
                    onChange={toggleAutoExport}
                    className="rounded"
                  />
                  <label
                    htmlFor="auto-export"
                    className="text-sm text-text-muted"
                  >
                    Enable auto-export
                  </label>
                </div>
                <Button variant="secondary" size="sm" onClick={handleForceExport}>
                  Export Now
                </Button>
              </>
            )}
          </div>
        </section>
      )}

      {/* Manual export/import */}
      <section className="bg-surface rounded-xl border border-border p-4 mb-4">
        <h2 className="text-sm font-bold mb-3">Export & Import</h2>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={handleExportJSON}>
              Export JSON
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportCSV}>
              Export CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={handleImportSelect}>
              Import JSON
            </Button>
          </div>
          {lastExport && (
            <p className="text-xs text-text-light">
              Last export: {new Date(lastExport).toLocaleString()}
            </p>
          )}
        </div>
      </section>

      {/* About */}
      <section className="bg-surface rounded-xl border border-border p-4">
        <h2 className="text-sm font-bold mb-3">About</h2>
        <div className="space-y-1.5 text-xs text-text-muted">
          <p>Budget App v1.0.0</p>
          <p>Storage: {db.storageType.toUpperCase()}</p>
          <p>Currency: AED (UAE Dirham)</p>
          <p>All data stored locally on this device.</p>
        </div>
      </section>

      <ConfirmDialog
        open={showImportConfirm}
        onClose={() => {
          setShowImportConfirm(false);
          setImportData(null);
        }}
        onConfirm={handleImportConfirm}
        title="Import Data"
        message="This will replace ALL existing data with the imported backup. This cannot be undone. Continue?"
        confirmLabel="Import"
        variant="danger"
      />
    </div>
  );
}
