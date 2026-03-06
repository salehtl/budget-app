import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "../components/layout/PageHeader.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Select } from "../components/ui/Select.tsx";
import { Modal } from "../components/ui/Modal.tsx";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { useToast } from "../components/ui/Toast.tsx";
import { useRecurring } from "../hooks/useRecurring.ts";
import { useCategories } from "../hooks/useCategories.ts";
import { formatCurrency, formatDate, formatDateShort } from "../lib/format.ts";
import { formatFrequency, getNextOccurrence } from "../lib/recurring.ts";
import type { RecurringTransaction } from "../types/database.ts";

export const Route = createFileRoute("/recurring")({
  component: RecurringPage,
});

function RecurringPage() {
  const { items, add, update, remove, processDue } = useRecurring();
  const { categories } = useCategories();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const editItem = editId ? items.find((i) => i.id === editId) : null;

  return (
    <div>
      <PageHeader
        title="Recurring"
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                const due = await processDue();
                if (due.length > 0) {
                  toast(`Processed ${due.length} recurring transaction(s)`);
                } else {
                  toast("No recurring transactions due", "info");
                }
              }}
            >
              Process Due
            </Button>
            <Button
              onClick={() => {
                setEditId(null);
                setShowForm(true);
              }}
            >
              + Add
            </Button>
          </div>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="No recurring transactions"
          description="Set up recurring income or expenses to track scheduled payments"
        />
      ) : (
        <div className="bg-surface rounded-xl border border-border divide-y divide-border">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-surface-alt cursor-pointer"
              onClick={() => {
                setEditId(item.id);
                setShowForm(true);
              }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">
                    {item.payee || "Unnamed"}
                  </p>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      item.mode === "auto"
                        ? "bg-accent/10 text-accent"
                        : "bg-warning-light text-warning"
                    }`}
                  >
                    {item.mode}
                  </span>
                  {!item.is_active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-alt text-text-light">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-light mt-0.5">
                  {formatFrequency(item.frequency, item.custom_interval_days)}
                  {" \u00b7 Next: "}
                  {formatDate(item.next_occurrence)}
                </p>
              </div>
              <span
                className={`text-sm font-medium shrink-0 ${
                  item.type === "income" ? "text-success" : "text-danger"
                }`}
              >
                {item.type === "income" ? "+" : "-"}
                {formatCurrency(item.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <RecurringForm
          open={showForm}
          onClose={() => {
            setShowForm(false);
            setEditId(null);
          }}
          categories={categories}
          initial={editItem ?? undefined}
          onSubmit={async (data) => {
            if (editId) {
              await update(editId, data);
              toast("Recurring transaction updated");
            } else {
              await add(data);
              toast("Recurring transaction added");
            }
            setShowForm(false);
            setEditId(null);
          }}
          onDelete={
            editId
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
            toast("Recurring transaction deleted");
          }
        }}
        title="Delete Recurring Transaction"
        message="Are you sure? This will not delete past transactions created by this rule."
        confirmLabel="Delete"
      />
    </div>
  );
}

const FREQUENCIES: { value: RecurringTransaction["frequency"]; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "2 Weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

function useSchedulePreview(
  startDate: string,
  frequency: RecurringTransaction["frequency"],
  customDays: string,
) {
  const days = frequency === "custom" ? parseInt(customDays) || null : null;
  if (!startDate) return [];
  const dates: string[] = [startDate];
  let current = startDate;
  for (let i = 0; i < 2; i++) {
    current = getNextOccurrence(current, frequency, days);
    dates.push(current);
  }
  return dates;
}

function RecurringForm({
  open,
  onClose,
  categories,
  initial,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  categories: { id: string; name: string; is_income: number; parent_id: string | null }[];
  initial?: RecurringTransaction;
  onSubmit: (data: {
    amount: number;
    type: "income" | "expense";
    category_id: string | null;
    payee: string;
    notes: string;
    frequency: RecurringTransaction["frequency"];
    custom_interval_days?: number | null;
    start_date: string;
    end_date?: string | null;
    mode: "reminder" | "auto";
  }) => Promise<void>;
  onDelete?: () => void;
}) {
  const [type, setType] = useState<"income" | "expense">(initial?.type ?? "expense");
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [payee, setPayee] = useState(initial?.payee ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [frequency, setFrequency] = useState<RecurringTransaction["frequency"]>(
    initial?.frequency ?? "monthly"
  );
  const [customDays, setCustomDays] = useState(
    initial?.custom_interval_days?.toString() ?? ""
  );
  const [startDate, setStartDate] = useState(
    initial?.start_date ?? new Date().toISOString().split("T")[0]!
  );
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [mode, setMode] = useState<"reminder" | "auto">(initial?.mode ?? "reminder");

  const preview = useSchedulePreview(startDate, frequency, customDays);

  const filteredCategories = categories
    .filter((c) => (type === "income" ? c.is_income : !c.is_income))
    .map((c) => ({
      value: c.id,
      label: c.parent_id ? `  ${c.name}` : c.name,
    }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    await onSubmit({
      amount: amt,
      type,
      category_id: categoryId || null,
      payee,
      notes,
      frequency,
      custom_interval_days: frequency === "custom" ? parseInt(customDays) || null : null,
      start_date: startDate,
      end_date: endDate || null,
      mode,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit Recurring" : "Add Recurring"}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Amount + Type */}
        <div className="text-center py-2">
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                type === "expense"
                  ? "bg-danger text-white"
                  : "bg-surface-alt text-text-muted hover:text-text"
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType("income")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                type === "income"
                  ? "bg-success text-white"
                  : "bg-surface-alt text-text-muted hover:text-text"
              }`}
            >
              Income
            </button>
          </div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-sm font-medium text-text-muted">AED</span>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`text-3xl font-bold text-center bg-transparent outline-none w-48 tabular-nums
                placeholder:text-border-dark ${
                type === "income" ? "text-success" : "text-text"
              }`}
            />
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Who / What */}
        <div className="space-y-3">
          <Input
            label="Payee"
            placeholder="e.g., DEWA, Etisalat"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
          />
          <Select
            label="Category"
            options={filteredCategories}
            placeholder="Select category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          />
          <Input
            label="Notes"
            placeholder="Optional"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="h-px bg-border" />

        {/* Schedule */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-text-muted">Frequency</label>
          <div className="flex flex-wrap gap-1.5">
            {FREQUENCIES.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFrequency(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  frequency === f.value
                    ? "bg-accent text-white"
                    : "bg-surface-alt text-text-muted hover:text-text hover:bg-border/50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {frequency === "custom" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">Every</span>
              <input
                type="number"
                min="1"
                required
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                className="w-16 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-center
                  outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
              <span className="text-sm text-text-muted">days</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Schedule Preview */}
          {preview.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted py-1">
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {preview.map((d, i) => (
                <span key={d} className="flex items-center gap-1.5">
                  <span className={i === 0 ? "font-medium text-text" : ""}>
                    {formatDateShort(d)}
                  </span>
                  {i < preview.length - 1 && (
                    <span className="text-border-dark">&rarr;</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Mode */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-muted">When due</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("auto")}
              className={`rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                mode === "auto"
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-border-dark"
              }`}
            >
              <div className={`text-sm font-medium ${mode === "auto" ? "text-accent" : "text-text"}`}>
                Auto-create
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                Transaction added automatically
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("reminder")}
              className={`rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                mode === "reminder"
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-border-dark"
              }`}
            >
              <div className={`text-sm font-medium ${mode === "reminder" ? "text-accent" : "text-text"}`}>
                Reminder
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                Notifies you when due
              </div>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-1">
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
