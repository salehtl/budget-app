import { useMemo } from "react";
import type { CashflowGroup, CashflowRow, CashflowSummary } from "../../lib/cashflow.ts";
import type { Category, RecurringTransaction } from "../../types/database.ts";
import { SummaryStrip } from "./SummaryStrip.tsx";
import { ReviewBanner } from "./ReviewBanner.tsx";
import { TransactionTable } from "./table/TransactionTable.tsx";

export interface SingleMonthViewProps {
  incomeGroups: CashflowGroup[];
  expenseGroups: CashflowGroup[];
  summary: CashflowSummary;
  month: string;
  categories?: Category[];
  onToggleStatus: (id: string, newStatus: "planned" | "confirmed" | "review") => void;
  onDeleteRow: (id: string) => void;
  onStopRecurrence?: (recurringId: string) => void;
  onEditRow: (id: string, updates: { payee?: string; amount?: number; type?: "income" | "expense"; category_id?: string | null; date?: string; group_name?: string; status?: "planned" | "confirmed" | "review" }) => void;
  onAddRow: (data: {
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
  }) => void | Promise<void>;
  onDuplicateRow?: (row: CashflowRow) => void;
  onCreateCategory?: (name: string, isIncome: boolean) => Promise<string>;
}

export function SingleMonthView({
  incomeGroups,
  expenseGroups,
  summary,
  month,
  categories,
  onToggleStatus,
  onDeleteRow,
  onStopRecurrence,
  onEditRow,
  onAddRow,
  onDuplicateRow,
  onCreateCategory,
}: SingleMonthViewProps) {
  const reviewCount = useMemo(() => {
    let count = 0;
    for (const group of incomeGroups)
      for (const row of group.rows)
        if (row.status === "review") count++;
    for (const group of expenseGroups)
      for (const row of group.rows)
        if (row.status === "review") count++;
    return count;
  }, [incomeGroups, expenseGroups]);

  return (
    <div className="space-y-5">
      <SummaryStrip summary={summary} />
      <ReviewBanner count={reviewCount} />

      <TransactionTable
        title="Income"
        variant="income"
        total={summary.income}
        groups={incomeGroups}
        month={month}
        categories={categories}
        onToggleStatus={onToggleStatus}
        onDeleteRow={onDeleteRow}
        onStopRecurrence={onStopRecurrence}
        onEditRow={onEditRow}
        onAddRow={onAddRow}
        onDuplicateRow={onDuplicateRow}
        onCreateCategory={onCreateCategory}
      />

      <TransactionTable
        title="Expenses"
        variant="expense"
        total={summary.expenses}
        groups={expenseGroups}
        month={month}
        categories={categories}
        onToggleStatus={onToggleStatus}
        onDeleteRow={onDeleteRow}
        onStopRecurrence={onStopRecurrence}
        onEditRow={onEditRow}
        onAddRow={onAddRow}
        onDuplicateRow={onDuplicateRow}
        onCreateCategory={onCreateCategory}
      />
    </div>
  );
}
