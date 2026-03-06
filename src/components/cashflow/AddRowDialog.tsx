import { useState } from "react";
import { Modal } from "../ui/Modal.tsx";
import { Input } from "../ui/Input.tsx";
import { Select } from "../ui/Select.tsx";
import { Button } from "../ui/Button.tsx";
import { MonthPicker } from "../ui/MonthPicker.tsx";
import { getCurrentMonth } from "../../lib/format.ts";

interface AddRowDialogProps {
  open: boolean;
  onClose: () => void;
  categories: { id: string; name: string; is_income: number; parent_id: string | null }[];
  onSubmit: (data: {
    label: string;
    type: "income" | "expense";
    amount: number;
    category_id: string | null;
    group_name: string;
    month: string | null;
  }) => Promise<void>;
}

export function AddRowDialog({ open, onClose, categories, onSubmit }: AddRowDialogProps) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [month, setMonth] = useState("");

  const filteredCategories = categories
    .filter((c) => (type === "income" ? c.is_income : !c.is_income))
    .map((c) => ({
      value: c.id,
      label: c.parent_id ? `  ${c.name}` : c.name,
    }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!label.trim() || !amt || amt <= 0) return;
    await onSubmit({
      label: label.trim(),
      type,
      amount: amt,
      category_id: categoryId || null,
      group_name: groupName.trim(),
      month: month || null,
    });
    // Reset
    setLabel("");
    setAmount("");
    setCategoryId("");
    setGroupName("");
    setMonth("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Cashflow Row">
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
          label="Label"
          placeholder="e.g., Side project revenue"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
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

        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-muted">Month</label>
          <div className="flex items-center gap-2">
            {month ? (
              <>
                <MonthPicker value={month} onChange={setMonth} />
                <button
                  type="button"
                  onClick={() => setMonth("")}
                  className="text-xs text-text-light hover:text-text-muted cursor-pointer"
                >
                  Clear
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setMonth(getCurrentMonth())}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-surface px-2.5 py-1.5 text-xs text-text-light hover:text-text-muted hover:border-border-dark transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Pick a month
              </button>
            )}
          </div>
          <p className="text-[11px] text-text-light">Leave blank to apply to all months</p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add</Button>
        </div>
      </form>
    </Modal>
  );
}
