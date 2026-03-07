import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { PageHeader } from "../components/layout/PageHeader.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Select } from "../components/ui/Select.tsx";
import { CategoryCombo } from "../components/ui/CategoryCombo.tsx";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.tsx";
import { DatePicker } from "../components/ui/Calendar.tsx";
import { useToast } from "../components/ui/Toast.tsx";
import { useRecurring } from "../hooks/useRecurring.ts";
import { useCategories } from "../hooks/useCategories.ts";
import { formatCurrency, formatDate } from "../lib/format.ts";
import { formatFrequency } from "../lib/recurring.ts";
import type { RecurringTransaction, Category } from "../types/database.ts";
import { emitDbEvent } from "../lib/db-events.ts";

export const Route = createFileRoute("/recurring")({
  component: RecurringPage,
});

const FREQUENCIES: { value: RecurringTransaction["frequency"]; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const FREQ_SHORT: Record<string, string> = {
  weekly: "Wk",
  biweekly: "2W",
  monthly: "Mo",
  quarterly: "Qt",
  yearly: "Yr",
  daily: "D",
  custom: "C",
};

function RecurringPage() {
  const { items, loading, add, update, remove, stopRecurrence } = useRecurring();
  const { categories, add: addCategory } = useCategories();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const active = items.filter((r) => r.is_active);
  const inactive = items.filter((r) => !r.is_active);

  async function handleCreateCategory(name: string): Promise<string> {
    const id = await addCategory({ name, color: "#64748b", is_income: false });
    return id;
  }

  async function handleToggleActive(item: RecurringTransaction) {
    if (item.is_active) {
      await stopRecurrence(item.id);
      toast("Recurring rule paused");
    } else {
      await update(item.id, { is_active: true });
      emitDbEvent("recurring-changed");
      toast("Recurring rule resumed");
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Recurring" />
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Recurring"
        action={
          !showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <PlusIcon className="w-4 h-4 mr-1.5" />
              New rule
            </Button>
          )
        }
      />

      {showForm && (
        <RecurringForm
          categories={categories}
          onCreateCategory={handleCreateCategory}
          onSubmit={async (data) => {
            await add(data);
            emitDbEvent("transactions-changed");
            setShowForm(false);
            toast("Recurring rule created");
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Active rules */}
      {active.length === 0 && !showForm && (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <p className="text-text-muted text-sm mb-3">No recurring rules yet</p>
          <Button size="sm" onClick={() => setShowForm(true)}>
            Create your first rule
          </Button>
        </div>
      )}

      {active.length > 0 && (
        <div className="bg-surface rounded-xl border border-border">
          {/* Header */}
          <div className="grid grid-cols-[1fr_100px_88px_96px_96px_100px_72px] gap-2 px-4 py-2.5 border-b border-border bg-surface-alt rounded-t-xl text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            <div>Payee</div>
            <div>Amount</div>
            <div>Frequency</div>
            <div>Category</div>
            <div>Start</div>
            <div>End</div>
            <div className="text-right">Actions</div>
          </div>

          {active.map((item) =>
            editingId === item.id ? (
              <RecurringForm
                key={item.id}
                categories={categories}
                onCreateCategory={handleCreateCategory}
                initial={item}
                inline
                onSubmit={async (data) => {
                  await update(item.id, data);
                  emitDbEvent("transactions-changed");
                  setEditingId(null);
                  toast("Rule updated");
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <RecurringRow
                key={item.id}
                item={item}
                categories={categories}
                onEdit={() => setEditingId(item.id)}
                onToggleActive={() => handleToggleActive(item)}
                onDelete={() => setDeleteId(item.id)}
              />
            )
          )}
        </div>
      )}

      {/* Inactive rules */}
      {inactive.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowInactive(!showInactive)}
            className="flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text transition-colors cursor-pointer mb-2"
          >
            <ChevronIcon className={`w-4 h-4 transition-transform ${showInactive ? "rotate-90" : ""}`} />
            Inactive ({inactive.length})
          </button>

          {showInactive && (
            <div className="bg-surface rounded-xl border border-border opacity-75">
              <div className="grid grid-cols-[1fr_100px_88px_96px_96px_100px_72px] gap-2 px-4 py-2.5 border-b border-border bg-surface-alt rounded-t-xl text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                <div>Payee</div>
                <div>Amount</div>
                <div>Frequency</div>
                <div>Category</div>
                <div>Start</div>
                <div>End</div>
                <div className="text-right">Actions</div>
              </div>
              {inactive.map((item) => (
                <RecurringRow
                  key={item.id}
                  item={item}
                  categories={categories}
                  onEdit={() => setEditingId(item.id)}
                  onToggleActive={() => handleToggleActive(item)}
                  onDelete={() => setDeleteId(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            await remove(deleteId);
            emitDbEvent("transactions-changed");
            toast("Rule deleted");
          }
        }}
        title="Delete recurring rule"
        message="This will delete the rule permanently. Existing transactions created by this rule will remain."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

// --- Row ---

function RecurringRow({
  item,
  categories,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  item: RecurringTransaction;
  categories: Category[];
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cat = categories.find((c) => c.id === item.category_id);
  const isIncome = item.type === "income";

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const today = new Date().toISOString().split("T")[0]!;
  const isDue = item.is_active && item.next_occurrence <= today;

  return (
    <div
      className="grid grid-cols-[1fr_100px_88px_96px_96px_100px_72px] gap-2 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-surface-alt/50 transition-colors group items-center"
      onDoubleClick={onEdit}
    >
      {/* Payee + type badge */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={`shrink-0 text-[9px] font-bold uppercase px-1 py-0.5 rounded ${
          isIncome ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
        }`}>
          {isIncome ? "IN" : "EX"}
        </span>
        <span className="truncate text-sm font-medium">{item.payee || "Untitled"}</span>
        {isDue && (
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-warning animate-pulse" title="Due" />
        )}
      </div>

      {/* Amount */}
      <div className={`text-sm tabular-nums ${isIncome ? "text-success" : ""}`}>
        {isIncome ? "+" : ""}{formatCurrency(item.amount)}
      </div>

      {/* Frequency */}
      <div className="text-sm text-text-muted">
        {FREQ_SHORT[item.frequency] || item.frequency}
      </div>

      {/* Category */}
      <div className="flex items-center gap-1.5 min-w-0">
        {cat && (
          <>
            <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
            <span className="text-xs text-text-muted truncate">{cat.name}</span>
          </>
        )}
      </div>

      {/* Start */}
      <div className="text-xs text-text-muted tabular-nums">
        {formatShortDate(item.start_date)}
      </div>

      {/* End */}
      <div className="text-xs text-text-muted tabular-nums">
        {item.end_date ? formatShortDate(item.end_date) : (
          <span className="text-text-light">Open</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 relative">
        <button
          type="button"
          onClick={onEdit}
          className="p-1 text-text-light hover:text-accent rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
          title="Edit"
        >
          <PencilIcon className="w-3.5 h-3.5" />
        </button>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 text-text-light hover:text-text rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
          >
            <DotsIcon className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 z-[70] min-w-[140px] animate-slide-up">
              <button
                type="button"
                onClick={() => { onToggleActive(); setMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-alt transition-colors cursor-pointer"
              >
                {item.is_active ? "Pause" : "Resume"}
              </button>
              <button
                type="button"
                onClick={() => { onDelete(); setMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-surface-alt transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Form ---

interface FormData {
  amount: number;
  type: "income" | "expense";
  category_id: string | null;
  payee: string;
  notes: string;
  frequency: RecurringTransaction["frequency"];
  start_date: string;
  end_date: string | null;
  mode: "reminder" | "auto";
}

function RecurringForm({
  categories,
  onCreateCategory,
  initial,
  inline,
  onSubmit,
  onCancel,
}: {
  categories: Category[];
  onCreateCategory: (name: string) => Promise<string>;
  initial?: RecurringTransaction;
  inline?: boolean;
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [type, setType] = useState<"income" | "expense">(initial?.type ?? "expense");
  const [payee, setPayee] = useState(initial?.payee ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [frequency, setFrequency] = useState<string>(initial?.frequency ?? "monthly");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? new Date().toISOString().split("T")[0]!);
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [hasEndDate, setHasEndDate] = useState(!!initial?.end_date);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const payeeRef = useRef<HTMLInputElement>(null);

  const filteredCategories = categories.filter((c) =>
    type === "income" ? c.is_income : !c.is_income
  );

  useEffect(() => {
    requestAnimationFrame(() => payeeRef.current?.focus());
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payee.trim() || !amount || !frequency) return;
    setSaving(true);
    try {
      await onSubmit({
        amount: Math.abs(parseFloat(amount)),
        type,
        category_id: categoryId || null,
        payee: payee.trim(),
        notes: notes.trim(),
        frequency: frequency as RecurringTransaction["frequency"],
        start_date: startDate,
        end_date: hasEndDate && endDate ? endDate : null,
        mode: "auto",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  const wrapperClass = inline
    ? "border-b border-border bg-accent/[0.03] px-4 py-3"
    : "bg-surface rounded-xl border border-border p-4 mb-4 animate-slide-up";

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className={wrapperClass}>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-x-6 gap-y-3">
        {/* Left column */}
        <div className="space-y-3">
          {/* Type toggle + Payee */}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setType(type === "income" ? "expense" : "income")}
              className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-2 rounded cursor-pointer border transition-colors ${
                type === "income"
                  ? "border-success/30 bg-success/10 text-success hover:bg-success/20"
                  : "border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
              }`}
            >
              {type === "income" ? "IN" : "EX"}
            </button>
            <div className="flex-1">
              <Input
                ref={payeeRef}
                label="Payee"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                placeholder="e.g. Rent, Salary, Netflix"
              />
            </div>
          </div>

          {/* Amount + Frequency */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            <Select
              label="Frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              options={FREQUENCIES}
            />
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-muted">Category</label>
            <CategoryCombo
              value={categoryId}
              onChange={setCategoryId}
              categories={filteredCategories}
              variant="form"
              onCreateCategory={onCreateCategory}
            />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-3">
          {/* Start date */}
          <DatePicker
            label="Start date"
            value={startDate}
            onChange={setStartDate}
          />

          {/* End date */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-text-muted">End date</label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasEndDate}
                  onChange={(e) => setHasEndDate(e.target.checked)}
                  className="accent-accent"
                />
                <span className="text-xs text-text-muted">Set end date</span>
              </label>
            </div>
            {hasEndDate ? (
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                min={startDate}
              />
            ) : (
              <div className="px-3 py-2 text-sm text-text-light border border-border rounded-lg bg-surface-alt">
                Open-ended (no end date)
              </div>
            )}
          </div>

          {/* Notes */}
          <Input
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
        <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" type="submit" disabled={saving || !payee.trim() || !amount}>
          {saving ? "Saving..." : initial ? "Save changes" : "Create rule"}
        </Button>
      </div>
    </form>
  );
}

// --- Helpers ---

function formatShortDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-AE", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

// --- Icons ---

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function DotsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
