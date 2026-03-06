import { useState, useCallback } from "react";
import type { CashflowGrid, CashflowGroup, CashflowRow } from "../../lib/cashflow.ts";
import type { MonthTransaction } from "../../db/queries/cashflow.ts";
import { formatCurrency, formatDate } from "../../lib/format.ts";

interface SingleMonthViewProps {
  grid: CashflowGrid;
  month: string;
  onLoadTransactions: (
    month: string,
    categoryId?: string | null,
    recurringId?: string | null
  ) => Promise<MonthTransaction[]>;
  onDeleteRow?: (rowId: string) => void;
}

function splitActualProjected(groups: CashflowGroup[], month: string) {
  let actual = 0;
  let projected = 0;
  for (const group of groups) {
    for (const row of group.rows) {
      const cell = row.monthValues.get(month);
      if (cell) {
        if (cell.isProjected) projected += cell.amount;
        else actual += cell.amount;
      }
    }
  }
  return { actual, projected };
}

export function SingleMonthView({ grid, month, onLoadTransactions, onDeleteRow }: SingleMonthViewProps) {
  const totals = grid.monthTotals.get(month) ?? { income: 0, expense: 0, net: 0 };
  const incomeSplit = splitActualProjected(grid.incomeGroups, month);
  const expenseSplit = splitActualProjected(grid.expenseGroups, month);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label="Income" amount={totals.income} variant="income" actual={incomeSplit.actual} projected={incomeSplit.projected} />
        <SummaryCard label="Expenses" amount={totals.expense} variant="expense" actual={expenseSplit.actual} projected={expenseSplit.projected} />
        <SummaryCard
          label="Net"
          amount={totals.net}
          variant={totals.net >= 0 ? "income" : "expense"}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-light">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-text" />
          Actual
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-text-light border border-dashed border-text-light" />
          Projected
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          Recurring
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
          </svg>
          Manual
        </div>
      </div>

      {/* Income section */}
      {grid.incomeGroups.length > 0 && (
        <Section
          title="Income"
          groups={grid.incomeGroups}
          month={month}
          variant="income"
          onLoadTransactions={onLoadTransactions}
          onDeleteRow={onDeleteRow}
        />
      )}

      {/* Expense section */}
      {grid.expenseGroups.length > 0 && (
        <Section
          title="Expenses"
          groups={grid.expenseGroups}
          month={month}
          variant="expense"
          onLoadTransactions={onLoadTransactions}
          onDeleteRow={onDeleteRow}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  amount,
  variant,
  actual,
  projected,
}: {
  label: string;
  amount: number;
  variant: "income" | "expense";
  actual?: number;
  projected?: number;
}) {
  const hasBreakdown = actual !== undefined && projected !== undefined && projected > 0;

  return (
    <div className="bg-surface rounded-xl border border-border p-3 flex sm:block items-center gap-3">
      <div className="sm:mb-0 min-w-0">
        <p className="text-[11px] text-text-muted font-medium">{label}</p>
        <p className={`text-base sm:text-lg font-bold tabular-nums ${variant === "income" ? "text-success" : "text-danger"}`}>
          {formatCurrency(amount)}
        </p>
      </div>
      {hasBreakdown && (
        <div className="ml-auto sm:ml-0 sm:mt-1 flex items-center gap-2 text-[10px] text-text-light shrink-0">
          <span>{formatCurrency(actual!)} actual</span>
          <span className="italic">+{formatCurrency(projected!)} proj.</span>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  groups,
  month,
  variant,
  onLoadTransactions,
  onDeleteRow,
}: {
  title: string;
  groups: CashflowGroup[];
  month: string;
  variant: "income" | "expense";
  onLoadTransactions: SingleMonthViewProps["onLoadTransactions"];
  onDeleteRow?: (rowId: string) => void;
}) {
  return (
    <div>
      <h3 className={`text-xs font-bold uppercase tracking-wide mb-2 ${
        variant === "income" ? "text-success" : "text-danger"
      }`}>
        {title}
      </h3>
      <div className="bg-surface rounded-xl border border-border divide-y divide-border">
        {groups.map((group) => (
          <GroupSection
            key={group.name}
            group={group}
            month={month}
            onLoadTransactions={onLoadTransactions}
            onDeleteRow={onDeleteRow}
          />
        ))}
      </div>
    </div>
  );
}

function GroupSection({
  group,
  month,
  onLoadTransactions,
  onDeleteRow,
}: {
  group: CashflowGroup;
  month: string;
  onLoadTransactions: SingleMonthViewProps["onLoadTransactions"];
  onDeleteRow?: (rowId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const groupTotal = group.monthTotals.get(month) ?? 0;

  if (groupTotal === 0) return null;

  return (
    <div>
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-surface-alt"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3.5 h-3.5 text-text-light transition-transform ${expanded ? "rotate-90" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-sm font-medium">{group.name}</span>
        </div>
        <span className="text-sm font-medium tabular-nums">
          {formatCurrency(groupTotal)}
        </span>
      </div>

      {expanded && (
        <div className="border-t border-border/50">
          {group.rows.map((row) => (
            <ExpandableRow
              key={row.id}
              row={row}
              month={month}
              onLoadTransactions={onLoadTransactions}
              onDeleteRow={onDeleteRow}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExpandableRow({
  row,
  month,
  onLoadTransactions,
  onDeleteRow,
}: {
  row: CashflowRow;
  month: string;
  onLoadTransactions: SingleMonthViewProps["onLoadTransactions"];
  onDeleteRow?: (rowId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [transactions, setTransactions] = useState<MonthTransaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  const cell = row.monthValues.get(month);
  if (!cell) return null;

  const canDelete = row.source === "adhoc" && onDeleteRow;

  const handleExpand = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (transactions.length === 0) {
      setLoadingTxns(true);
      const txns = await onLoadTransactions(month, row.categoryId, row.recurringId);
      setTransactions(txns);
      setLoadingTxns(false);
    }
  }, [expanded, transactions.length, month, row.categoryId, row.recurringId, onLoadTransactions]);

  return (
    <div className="group">
      <div
        className="flex items-center justify-between pl-10 pr-4 py-2 cursor-pointer hover:bg-surface-alt"
        onClick={handleExpand}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {row.source === "recurring" && (
            <svg className="w-3 h-3 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          )}
          {row.source === "adhoc" && (
            <svg className="w-3 h-3 text-warning shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          <span className={`text-sm truncate ${cell.isProjected ? "text-text-light italic" : "text-text-muted"}`}>
            {row.label}
          </span>
          {cell.isProjected && (
            <span className="text-[10px] text-accent/70 bg-accent/8 px-1.5 py-0.5 rounded border border-dashed border-accent/20 shrink-0">
              Projected
            </span>
          )}
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteRow!(row.id);
              }}
              className="ml-1 shrink-0 p-0.5 rounded text-text-light hover:text-danger opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
              title="Delete row"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
        <span className={`text-sm tabular-nums shrink-0 ${cell.isProjected ? "text-text-light italic" : ""}`}>
          {formatCurrency(cell.amount)}
        </span>
      </div>

      {expanded && (
        <div className="pl-14 pr-4 pb-2">
          {loadingTxns ? (
            <p className="text-xs text-text-light py-1">Loading...</p>
          ) : transactions.length === 0 ? (
            <p className="text-xs text-text-light py-1">
              {cell.isProjected ? "No transactions yet (projected)" : "No transactions found"}
            </p>
          ) : (
            <div className="space-y-1">
              {transactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between text-xs py-1">
                  <div className="text-text-muted">
                    <span className="text-text-light">{formatDate(txn.date)}</span>
                    {txn.payee && <span> &middot; {txn.payee}</span>}
                    {txn.notes && <span className="text-text-light"> &middot; {txn.notes}</span>}
                  </div>
                  <span className="tabular-nums shrink-0 ml-2">{formatCurrency(txn.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
