import { useState } from "react";
import { Modal } from "../ui/Modal.tsx";
import { Input } from "../ui/Input.tsx";
import { Select } from "../ui/Select.tsx";
import { Button } from "../ui/Button.tsx";
import { getCurrentMonth, getToday } from "../../lib/format.ts";
import type { RecurringTransaction } from "../../types/database.ts";

const FREQUENCIES: { value: RecurringTransaction["frequency"]; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

interface AddRowDialogProps {
  open: boolean;
  onClose: () => void;
  month: string;
  categories: { id: string; name: string; is_income: number; parent_id: string | null }[];
  onSubmit: (data: {
    payee: string;
    type: "income" | "expense";
    amount: number;
    category_id: string | null;
    date: string;
    status: "planned" | "confirmed";
    group_name: string;
    recurring?: {
      frequency: RecurringTransaction["frequency"];
      custom_interval_days?: number | null;
      end_date?: string | null;
    };
  }) => Promise<void>;
}

export function AddRowDialog({ open, onClose, month, categories, onSubmit }: AddRowDialogProps) {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(() => {
    const today = getToday();
    const currentMonth = getCurrentMonth();
    // If viewing the current month, default to today; otherwise, first of the month
    return month === currentMonth ? today : `${month}-01`;
  });
  const [status, setStatus] = useState<"planned" | "confirmed">("confirmed");
  const [groupName, setGroupName] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurringTransaction["frequency"]>("monthly");
  const [submitting, setSubmitting] = useState(false);

  const filteredCategories = categories
    .filter((c) => (type === "income" ? c.is_income : !c.is_income))
    .map((c) => ({
      value: c.id,
      label: c.parent_id ? `  ${c.name}` : c.name,
    }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!payee.trim() || !amt || amt <= 0) return;

    setSubmitting(true);
    await onSubmit({
      payee: payee.trim(),
      type,
      amount: amt,
      category_id: categoryId || null,
      date,
      status,
      group_name: groupName.trim(),
      ...(isRecurring
        ? { recurring: { frequency, custom_interval_days: null, end_date: null } }
        : {}),
    });
    setSubmitting(false);

    // Reset
    setPayee("");
    setAmount("");
    setCategoryId("");
    setGroupName("");
    setIsRecurring(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Transaction">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type toggle */}
        <div className="flex items-center gap-1.5">
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

        <Input
          label="Payee"
          placeholder="e.g., DEWA, Etisalat"
          required
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
        />

        <Input
          label="Amount (AED)"
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <Input
          label="Date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <Select
          label="Category"
          options={filteredCategories}
          placeholder="Optional"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        />

        <Input
          label="Group"
          placeholder="Optional group name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />

        {/* Status toggle */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-muted">Status</label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatus("confirmed")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                status === "confirmed"
                  ? "bg-success/15 text-success border border-success/30"
                  : "bg-surface-alt text-text-muted hover:text-text"
              }`}
            >
              Confirmed
            </button>
            <button
              type="button"
              onClick={() => setStatus("planned")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                status === "planned"
                  ? "bg-surface-alt text-text border border-border-dark"
                  : "bg-surface-alt text-text-muted hover:text-text"
              }`}
            >
              Planned
            </button>
          </div>
        </div>

        {/* Recurring toggle */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is-recurring"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="is-recurring" className="text-sm text-text-muted">
              Recurring transaction
            </label>
          </div>

          {isRecurring && (
            <div className="flex flex-wrap gap-1.5 pl-6">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFrequency(f.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    frequency === f.value
                      ? "bg-accent text-white"
                      : "bg-surface-alt text-text-muted hover:text-text"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
