import { useState, useRef, useEffect, useMemo } from "react";
import type { Category, RecurringTransaction } from "../../../types/database.ts";
import { RECURRING_GRID_COLS } from "./types.ts";
import { FREQUENCIES } from "../../cashflow/table/types.ts";
import { CategoryCombo } from "../../ui/CategoryCombo.tsx";
import { DatePicker } from "../../ui/Calendar.tsx";
import { getToday } from "../../../lib/format.ts";
import { inputBase, inputUnderlineIdle } from "../../ui/input-styles.ts";

interface RecurringInlineAddRowProps {
  type: "income" | "expense";
  categories?: Category[];
  onAdd: (data: {
    amount: number;
    type: "income" | "expense";
    category_id: string | null;
    payee: string;
    notes: string;
    frequency: RecurringTransaction["frequency"];
    start_date: string;
    end_date: string | null;
    mode: "auto";
    is_variable?: boolean;
  }) => Promise<void>;
  onCreateCategory?: (name: string, isIncome: boolean) => Promise<string>;
}

export function RecurringInlineAddRow({
  type,
  categories,
  onAdd,
  onCreateCategory,
}: RecurringInlineAddRowProps) {
  const draftKey = `recurring-draft-${type}`;

  function loadDraft() {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) return JSON.parse(raw) as Record<string, string>;
    } catch { /* ignore */ }
    return null;
  }

  const draft = loadDraft();
  const [active, setActive] = useState(!!draft);
  const [payee, setPayee] = useState(draft?.payee ?? "");
  const [amount, setAmount] = useState(draft?.amount ?? "");
  const [frequency, setFrequency] = useState(draft?.frequency ?? "monthly");
  const [categoryId, setCategoryId] = useState(draft?.categoryId ?? "");
  const [startDate, setStartDate] = useState(draft?.startDate ?? getToday());
  const [endDate, setEndDate] = useState(draft?.endDate ?? "");
  const [hasEndDate, setHasEndDate] = useState(draft?.hasEndDate === "true");
  const [saving, setSaving] = useState(false);
  const payeeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!active) {
      sessionStorage.removeItem(draftKey);
      return;
    }
    sessionStorage.setItem(draftKey, JSON.stringify({
      payee, amount, frequency, categoryId, startDate, endDate, hasEndDate: String(hasEndDate),
    }));
  }, [active, payee, amount, frequency, categoryId, startDate, endDate, hasEndDate, draftKey]);

  const filteredCategories = useMemo(
    () => (categories ?? []).filter((c) => (type === "income" ? c.is_income : !c.is_income)),
    [categories, type]
  );

  useEffect(() => {
    if (active) requestAnimationFrame(() => payeeRef.current?.focus());
  }, [active]);

  function resetFields() {
    setPayee("");
    setAmount("");
    setFrequency("monthly");
    setCategoryId("");
    setStartDate(getToday());
    setEndDate("");
    setHasEndDate(false);
  }

  function reset() {
    resetFields();
    setActive(false);
  }

  async function handleSubmit() {
    const amt = parseFloat(amount);
    if (!payee.trim() || !amt || amt <= 0 || !frequency) return;

    setSaving(true);
    await onAdd({
      amount: Math.abs(amt),
      type,
      category_id: categoryId || null,
      payee: payee.trim(),
      notes: "",
      frequency: frequency as RecurringTransaction["frequency"],
      start_date: startDate,
      end_date: hasEndDate && endDate ? endDate : null,
      mode: "auto",
    });
    setSaving(false);
    resetFields();
    requestAnimationFrame(() => payeeRef.current?.focus());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
    if (e.key === "Escape") reset();
  }

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className="w-full flex items-center gap-2 px-3 h-9 text-text-light hover:text-text-muted hover:bg-surface-alt/60 transition-colors cursor-pointer group"
      >
        <svg className="w-3.5 h-3.5 text-border-dark group-hover:text-text-light transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span className="text-xs">Add rule</span>
      </button>
    );
  }

  return (
    <div className="border-t border-dashed border-accent/30 bg-accent/[0.03]" onKeyDown={handleKeyDown}>
      <div className={`grid ${RECURRING_GRID_COLS} gap-x-3 items-center px-3 h-9`}>
        {/* Checkbox placeholder */}
        <span />

        {/* Payee */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-accent/40 shrink-0" />
          <input
            ref={payeeRef}
            type="text"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            placeholder="Payee..."
            className={`flex-1 min-w-0 text-[13px] text-text placeholder:text-text-light/50 py-0.5 ${inputBase} ${inputUnderlineIdle}`}
            disabled={saving}
          />
        </div>

        {/* Amount */}
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className={`text-[13px] text-right tabular-nums text-text placeholder:text-text-light/50 py-0.5 ${inputBase} ${inputUnderlineIdle}`}
          disabled={saving}
        />

        {/* Frequency */}
        <div className="relative hidden sm:block">
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className={`w-full appearance-none text-[10px] text-center py-0.5 cursor-pointer pr-3 ${inputBase} border-b ${
              frequency ? "text-accent font-semibold border-accent/40" : "text-text-light border-transparent focus:border-accent/40"
            }`}
            disabled={saving}
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>{f.short}</option>
            ))}
          </select>
          <svg className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-text-light/60 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
        </div>

        {/* Category */}
        <div className="hidden sm:block">
          <CategoryCombo
            value={categoryId}
            onChange={setCategoryId}
            categories={filteredCategories}
            variant="add"
            disabled={saving}
            onCreateCategory={onCreateCategory ? (name) => onCreateCategory(name, type === "income") : undefined}
          />
        </div>

        {/* Start Date */}
        <div className="hidden sm:block">
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            variant="inline"
            disabled={saving}
          />
        </div>

        {/* End Date (simplified for inline) */}
        <div className="hidden sm:flex items-center gap-1">
          {hasEndDate ? (
            <DatePicker
              value={endDate || getToday()}
              onChange={setEndDate}
              variant="inline"
              disabled={saving}
              min={startDate}
            />
          ) : (
            <button
              type="button"
              onClick={() => setHasEndDate(true)}
              className="text-[10px] text-text-light/50 hover:text-text-muted cursor-pointer transition-colors"
              disabled={saving}
            >
              Set end
            </button>
          )}
        </div>

        {/* Add / Cancel */}
        <div className="flex justify-center gap-px">
          <button
            onClick={handleSubmit}
            disabled={saving || !payee.trim() || !amount || parseFloat(amount) <= 0}
            className="p-1 rounded-md text-accent hover:bg-accent/10 disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
            title="Add (Enter)"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button
            onClick={reset}
            className="p-1 rounded-md text-text-light hover:bg-surface-alt hover:text-text-muted cursor-pointer"
            title="Cancel (Esc)"
            disabled={saving}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
