import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "../components/layout/PageHeader.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Select } from "../components/ui/Select.tsx";
import { Modal } from "../components/ui/Modal.tsx";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.tsx";
import { useToast } from "../components/ui/Toast.tsx";
import { useDb } from "../context/DbContext.tsx";
import { useCategories } from "../hooks/useCategories.ts";
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

const COLORS = [
  "#6366f1", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6",
  "#14b8a6", "#0ea5e9", "#f97316", "#64748b", "#16a34a",
  "#84cc16", "#06b6d4", "#a855f7", "#e11d48",
];

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

      {/* Categories section */}
      <CategoriesSection />

      {/* AI Integration section */}
      <AIIntegrationSection />

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
          <p>Budget App v2.0.0</p>
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

// --- AI Integration section ---

function AIIntegrationSection() {
  const db = useDb();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [savedProxy, setSavedProxy] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      getSetting(db, "anthropic_api_key"),
      getSetting(db, "anthropic_proxy_url"),
    ]).then(([key, url]) => {
      setApiKey(key ?? "");
      setProxyUrl(url ?? "");
      setSavedKey(key ?? "");
      setSavedProxy(url ?? "");
      setLoaded(true);
    });
  }, [db]);

  const hasChanges = apiKey !== savedKey || proxyUrl !== savedProxy;

  async function handleSave() {
    if (apiKey !== savedKey) {
      await setSetting(db, "anthropic_api_key", apiKey);
      setSavedKey(apiKey);
    }
    if (proxyUrl !== savedProxy) {
      await setSetting(db, "anthropic_proxy_url", proxyUrl);
      setSavedProxy(proxyUrl);
    }
    toast("Settings saved");
  }

  if (!loaded) return null;

  return (
    <section className="bg-surface rounded-xl border border-border p-4 mb-4">
      <h2 className="text-sm font-bold mb-3">AI Integration</h2>
      <p className="text-xs text-text-muted mb-3">
        Used for PDF statement import. Your API key is stored locally and never sent to any server except Anthropic's API.
      </p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            Anthropic API Key
          </label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            Proxy URL
          </label>
          <Input
            value={proxyUrl}
            onChange={(e) => setProxyUrl(e.target.value)}
            placeholder="/api/anthropic (default, uses dev proxy or CF worker)"
          />
          <p className="text-[10px] text-text-light mt-1">
            Required in production due to COEP headers. Leave empty to use the default.
          </p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
          Save
        </Button>
      </div>
    </section>
  );
}

// --- Categories section ---

function CategoriesSection() {
  const { categories, add, update, remove } = useCategories();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const expenseCategories = useMemo(
    () => categories.filter((c) => !c.is_income),
    [categories]
  );
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.is_income),
    [categories]
  );

  const editCat = editId ? categories.find((c) => c.id === editId) : null;
  const parentOptions = categories
    .filter((c) => !c.parent_id)
    .map((c) => ({ value: c.id, label: c.name }));

  function renderCategoryList(cats: typeof categories, label: string) {
    const parents = cats.filter((c) => !c.parent_id);
    return (
      <div className="mb-3">
        <h3 className="text-xs font-medium text-text-muted mb-1.5">{label}</h3>
        {parents.length === 0 ? (
          <p className="text-xs text-text-light">No categories</p>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {parents.map((parent) => {
              const children = cats.filter((c) => c.parent_id === parent.id);
              return (
                <div key={parent.id}>
                  <div
                    className="flex items-center justify-between px-3 py-2 hover:bg-surface-alt cursor-pointer"
                    onClick={() => {
                      if (parent.is_system) return;
                      setEditId(parent.id);
                      setShowForm(true);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: parent.color }}
                      />
                      <span className="text-sm font-medium">{parent.name}</span>
                      {parent.is_system ? (
                        <span className="text-[10px] text-text-light bg-surface-alt px-1.5 py-0.5 rounded">
                          System
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {children.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center justify-between px-3 py-2 pl-8 hover:bg-surface-alt cursor-pointer"
                      onClick={() => {
                        if (child.is_system) return;
                        setEditId(child.id);
                        setShowForm(true);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: child.color }}
                        />
                        <span className="text-sm text-text-muted">{child.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="bg-surface rounded-xl border border-border p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold">Categories</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditId(null);
            setShowForm(true);
          }}
        >
          + Add
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-text-light">No categories</p>
      ) : (
        <>
          {renderCategoryList(expenseCategories, "Expense Categories")}
          {renderCategoryList(incomeCategories, "Income Categories")}
        </>
      )}

      {showForm && (
        <CategoryForm
          open={showForm}
          onClose={() => {
            setShowForm(false);
            setEditId(null);
          }}
          initial={
            editCat
              ? {
                  name: editCat.name,
                  parent_id: editCat.parent_id,
                  color: editCat.color,
                  is_income: !!editCat.is_income,
                }
              : undefined
          }
          parentOptions={parentOptions}
          onSubmit={async (data) => {
            if (editId) {
              await update(editId, data);
              toast("Category updated");
            } else {
              await add(data);
              toast("Category added");
            }
            setShowForm(false);
            setEditId(null);
          }}
          onDelete={
            editId && editCat && !editCat.is_system
              ? () => {
                  setShowForm(false);
                  setDeleteId(editId);
                  setEditId(null);
                }
              : undefined
          }
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            await remove(deleteId);
            toast("Category deleted");
          }
        }}
        title="Delete Category"
        message="Deleting this category will set related transactions to uncategorized. Continue?"
        confirmLabel="Delete"
      />
    </section>
  );
}

function CategoryForm({
  open,
  onClose,
  initial,
  parentOptions,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  initial?: {
    name: string;
    parent_id: string | null;
    color: string;
    is_income: boolean;
  };
  parentOptions: { value: string; label: string }[];
  onSubmit: (data: {
    name: string;
    parent_id?: string | null;
    color: string;
    is_income: boolean;
  }) => Promise<void>;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [parentId, setParentId] = useState(initial?.parent_id ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]!);
  const [isIncome, setIsIncome] = useState(initial?.is_income ?? false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit({
      name: name.trim(),
      parent_id: parentId || null,
      color,
      is_income: isIncome,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit Category" : "Add Category"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Select
          label="Parent Category"
          options={parentOptions}
          placeholder="None (top-level)"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-muted">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full cursor-pointer transition-transform ${
                  color === c ? "ring-2 ring-offset-2 ring-accent scale-110" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is-income"
            checked={isIncome}
            onChange={(e) => setIsIncome(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="is-income" className="text-sm text-text-muted">
            Income category
          </label>
        </div>

        <div className="flex justify-between pt-2">
          {onDelete ? (
            <Button type="button" variant="danger" onClick={onDelete}>
              Delete
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{initial ? "Save" : "Add"}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
