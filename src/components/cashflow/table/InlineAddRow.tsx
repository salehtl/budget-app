import { useState, useRef, useEffect, useMemo } from "react";
import type { CashflowGroup } from "../../../lib/cashflow.ts";
import type { Category, RecurringTransaction } from "../../../types/database.ts";
import type { SingleMonthViewProps } from "../SingleMonthView.tsx";
import { GRID_COLS, FREQUENCIES } from "./types.ts";
import { CategoryCombo } from "../../ui/CategoryCombo.tsx";
import { DatePicker } from "../../ui/Calendar.tsx";
import { StatusPill } from "../../ui/StatusPill.tsx";
import { getToday } from "../../../lib/format.ts";

import { inputBase, inputUnderlineIdle } from "../../ui/input-styles.ts";

interface InlineAddRowProps {
  type: "income" | "expense";
  month: string;
  categories?: Category[];
  groups: CashflowGroup[];
  onAddRow: SingleMonthViewProps["onAddRow"];
  onCreateCategory?: SingleMonthViewProps["onCreateCategory"];
}

export function InlineAddRow({
  type,
  month,
  categories,
  groups,
  onAddRow,
  onCreateCategory,
}: InlineAddRowProps) {
  const draftKey = `cashflow-draft-${type}`;

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
  const [date, setDate] = useState(draft?.date ?? getToday());
  const [categoryId, setCategoryId] = useState(draft?.categoryId ?? "");
  const [frequency, setFrequency] = useState(draft?.frequency ?? "");
  const [status, setStatus] = useState<"planned" | "confirmed">((draft?.status as "planned" | "confirmed") ?? "confirmed");
  const [statusManual, setStatusManual] = useState(draft?.statusManual === "true");
  const [groupName, setGroupName] = useState(draft?.groupName ?? "");
  const [saving, setSaving] = useState(false);
  const payeeRef = useRef<HTMLInputElement>(null);

  // Persist draft to sessionStorage on changes
  useEffect(() => {
    if (!active) {
      sessionStorage.removeItem(draftKey);
      return;
    }
    sessionStorage.setItem(draftKey, JSON.stringify({
      payee, amount, date, categoryId, frequency, status, statusManual: String(statusManual), groupName,
    }));
  }, [active, payee, amount, date, categoryId, frequency, status, statusManual, groupName, draftKey]);

  const filteredCategories = useMemo(
    () => (categories ?? []).filter((c) => (type === "income" ? c.is_income : !c.is_income)),
    [categories, type]
  );
  const existingGroups = useMemo(
    () => [...new Set(groups.map((g) => g.name).filter(Boolean))],
    [groups]
  );

  useEffect(() => {
    if (active) requestAnimationFrame(() => payeeRef.current?.focus());
  }, [active]);

  function handleDateChange(newDate: string) {
    setDate(newDate);
    if (!statusManual) {
      setStatus(newDate > getToday() ? "planned" : "confirmed");
    }
  }

  function handleStatusToggle() {
    setStatusManual(true);
    setStatus(status === "planned" ? "confirmed" : "planned");
  }

  function resetFields() {
    setPayee("");
    setAmount("");
    setDate(getToday());
    setCategoryId("");
    setFrequency("");
    setStatus("confirmed");
    setStatusManual(false);
    setGroupName("");
  }

  function reset() {
    resetFields();
    setActive(false);
  }

  async function handleSubmit() {
    const amt = parseFloat(amount);
    if (!payee.trim() || !amt || amt <= 0) return;

    setSaving(true);
    await onAddRow({
      payee: payee.trim(),
      type,
      amount: amt,
      category_id: categoryId || null,
      date,
      status,
      group_name: groupName.trim(),
      ...(frequency
        ? { recurring: { frequency: frequency as RecurringTransaction["frequency"], custom_interval_days: null, end_date: null } }
        : {}),
    });
    setSaving(false);
    resetFields();
    requestAnimationFrame(() => payeeRef.current?.focus());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    e.stopPropagation(); // prevent table keyboard handler
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
        <span className="text-xs">Add item</span>
      </button>
    );
  }

  return (
    <div className="border-t border-dashed border-accent/30 bg-accent/[0.03]" onKeyDown={handleKeyDown}>
      <div className={`grid ${GRID_COLS} gap-x-3 items-center px-3 h-9`}>
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

        {/* Date */}
        <div className="hidden sm:block">
          <DatePicker
            value={date}
            onChange={handleDateChange}
            variant="inline"
            disabled={saving}
          />
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

        {/* Recurring */}
        <div className="relative hidden sm:block">
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className={`w-full appearance-none text-[10px] text-center py-0.5 cursor-pointer pr-3 ${inputBase} border-b ${
              frequency ? "text-accent font-semibold border-accent/40" : "text-text-light border-transparent focus:border-accent/40"
            }`}
            disabled={saving}
          >
            <option value="">&mdash;</option>
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>{f.short}</option>
            ))}
          </select>
          <svg className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-text-light/60 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
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

        {/* Status */}
        <div className="flex justify-center">
          <StatusPill status={status} onClick={handleStatusToggle} disabled={saving} />
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

      {/* Group selector (secondary row, only when groups exist) */}
      {existingGroups.length > 0 && (
        <div className="flex items-center gap-2 px-3 pb-1.5 pt-0.5">
          <div className="relative">
            <select
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="appearance-none pl-2 pr-5 py-0.5 rounded border border-border bg-surface text-[11px] text-text-muted outline-none focus:border-accent cursor-pointer"
              disabled={saving}
            >
              <option value="">Group...</option>
              {existingGroups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <svg className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-text-light pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
          <span className="text-[10px] text-text-light/40 hidden sm:block">Enter to add / Esc to cancel</span>
        </div>
      )}
    </div>
  );
}
