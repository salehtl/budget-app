import { useState } from "react";
import type { CashflowGrid, CashflowGroup, CashflowRow as CashflowRowType } from "../../lib/cashflow.ts";
import { formatCurrency } from "../../lib/format.ts";
import { getCurrentMonth } from "../../lib/cashflow.ts";

interface MultiMonthViewProps {
  grid: CashflowGrid;
  onEditRow?: (rowId: string, month: string, amount: number) => void;
  onDeleteRow?: (rowId: string) => void;
}

function formatMonthHeader(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(y, m - 1).toLocaleDateString("en-AE", { month: "short", year: "2-digit" });
}

export function MultiMonthView({ grid, onDeleteRow }: MultiMonthViewProps) {
  const currentMonth = getCurrentMonth();

  // Running balance
  const runningBalances = new Map<string, number>();
  let balance = 0;
  for (const month of grid.months) {
    const totals = grid.monthTotals.get(month);
    balance += totals?.net ?? 0;
    runningBalances.set(month, balance);
  }

  return (
    <div className="overflow-x-auto border border-border rounded-xl bg-surface">
      <div
        className="min-w-max"
        style={{
          display: "grid",
          gridTemplateColumns: `minmax(140px, 1.2fr) repeat(${grid.months.length}, minmax(88px, 1fr))`,
        }}
      >
        {/* Header */}
        <div className="sticky left-0 z-10 bg-surface-alt px-3 py-2 text-xs font-medium text-text-muted border-b border-border">
          Item
        </div>
        {grid.months.map((month) => (
          <div
            key={month}
            className={`px-3 py-2 text-xs font-medium text-text-muted text-right border-b border-border ${
              month === currentMonth
                ? "bg-accent/5 border-b-2 border-b-accent"
                : "bg-surface-alt"
            }`}
          >
            {formatMonthHeader(month)}
            {month === currentMonth && (
              <span className="ml-1 text-[9px] text-accent font-bold align-top">NOW</span>
            )}
          </div>
        ))}

        {/* Income section */}
        <SectionHeader label="Income" months={grid.months} variant="income" currentMonth={currentMonth} />
        {grid.incomeGroups.map((group) => (
          <GroupBlock key={group.name} group={group} months={grid.months} currentMonth={currentMonth} onDeleteRow={onDeleteRow} />
        ))}

        {/* Income total */}
        <TotalRow
          label="Total Income"
          months={grid.months}
          getAmount={(m) => grid.monthTotals.get(m)?.income ?? 0}
          variant="income"
          currentMonth={currentMonth}
        />

        {/* Expense section */}
        <SectionHeader label="Expenses" months={grid.months} variant="expense" currentMonth={currentMonth} />
        {grid.expenseGroups.map((group) => (
          <GroupBlock key={group.name} group={group} months={grid.months} currentMonth={currentMonth} onDeleteRow={onDeleteRow} />
        ))}

        {/* Expense total */}
        <TotalRow
          label="Total Expenses"
          months={grid.months}
          getAmount={(m) => grid.monthTotals.get(m)?.expense ?? 0}
          variant="expense"
          currentMonth={currentMonth}
        />

        {/* Net row */}
        <TotalRow
          label="Net"
          months={grid.months}
          getAmount={(m) => grid.monthTotals.get(m)?.net ?? 0}
          variant="net"
          currentMonth={currentMonth}
        />

        {/* Running balance row */}
        <div className="sticky left-0 z-10 bg-primary/5 px-3 py-2 text-xs font-bold border-t-2 border-accent/30 text-accent">
          Running Balance
        </div>
        {grid.months.map((month) => {
          const bal = runningBalances.get(month) ?? 0;
          return (
            <div
              key={month}
              className={`px-3 py-2 text-xs font-bold text-right border-t-2 border-accent/30 tabular-nums ${
                bal >= 0 ? "text-success" : "text-danger"
              } ${month === currentMonth ? "bg-accent/5" : ""}`}
            >
              {formatCurrency(bal)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionHeader({
  label,
  months,
  variant,
  currentMonth,
}: {
  label: string;
  months: string[];
  variant: "income" | "expense";
  currentMonth: string;
}) {
  return (
    <>
      <div
        className={`sticky left-0 z-10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide border-b border-border ${
          variant === "income" ? "text-success bg-success/5" : "text-danger bg-danger/5"
        }`}
      >
        {label}
      </div>
      {months.map((month) => (
        <div
          key={month}
          className={`border-b border-border ${
            variant === "income" ? "bg-success/5" : "bg-danger/5"
          } ${month === currentMonth ? "!bg-accent/5" : ""}`}
        />
      ))}
    </>
  );
}

function GroupBlock({
  group,
  months,
  currentMonth,
  onDeleteRow,
}: {
  group: CashflowGroup;
  months: string[];
  currentMonth: string;
  onDeleteRow?: (rowId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <>
      {/* Group header */}
      <div
        className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-xs font-semibold text-text border-b border-border cursor-pointer flex items-center gap-1.5 hover:bg-surface-alt"
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          className={`w-3 h-3 text-text-light transition-transform ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {group.name}
      </div>
      {months.map((month) => (
        <div
          key={month}
          className={`px-3 py-1.5 text-xs font-medium text-right border-b border-border tabular-nums ${
            month === currentMonth ? "bg-accent/5" : ""
          }`}
        >
          {group.monthTotals.get(month)
            ? formatCurrency(group.monthTotals.get(month)!)
            : <span className="text-text-light">&mdash;</span>}
        </div>
      ))}

      {/* Individual rows */}
      {expanded &&
        group.rows.map((row) => (
          <RowCells key={row.id} row={row} months={months} currentMonth={currentMonth} onDeleteRow={onDeleteRow} />
        ))}
    </>
  );
}

function RowCells({
  row,
  months,
  currentMonth,
  onDeleteRow,
}: {
  row: CashflowRowType;
  months: string[];
  currentMonth: string;
  onDeleteRow?: (rowId: string) => void;
}) {
  const canDelete = row.source === "adhoc" && onDeleteRow;

  return (
    <>
      <div className="sticky left-0 z-10 bg-surface pl-8 pr-3 py-1 text-xs text-text-muted border-b border-border/50 flex items-center gap-1.5 group">
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
        <span className="truncate min-w-0">{row.label}</span>
        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteRow!(row.id);
            }}
            className="ml-auto shrink-0 p-0.5 rounded text-text-light hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Delete row"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>
      {months.map((month) => {
        const cell = row.monthValues.get(month);
        return (
          <div
            key={month}
            className={`px-3 py-1 text-xs text-right border-b border-border/50 tabular-nums ${
              month === currentMonth ? "bg-accent/5" : ""
            } ${
              cell?.isProjected
                ? "text-text-light italic border-l-2 border-l-accent/20"
                : "text-text"
            }`}
          >
            {cell ? formatCurrency(cell.amount) : <span className="text-border-dark">&mdash;</span>}
          </div>
        );
      })}
    </>
  );
}

function TotalRow({
  label,
  months,
  getAmount,
  variant,
  currentMonth,
}: {
  label: string;
  months: string[];
  getAmount: (month: string) => number;
  variant: "income" | "expense" | "net";
  currentMonth: string;
}) {
  const colorClass =
    variant === "income"
      ? "text-success"
      : variant === "expense"
        ? "text-danger"
        : "";

  return (
    <>
      <div className={`sticky left-0 z-10 bg-surface-alt px-3 py-2 text-xs font-bold border-b border-border ${colorClass}`}>
        {label}
      </div>
      {months.map((month) => {
        const amount = getAmount(month);
        const netColor =
          variant === "net"
            ? amount >= 0
              ? "text-success"
              : "text-danger"
            : colorClass;
        return (
          <div
            key={month}
            className={`px-3 py-2 text-xs font-bold text-right border-b border-border bg-surface-alt tabular-nums ${netColor} ${
              month === currentMonth ? "!bg-accent/5" : ""
            }`}
          >
            {formatCurrency(amount)}
          </div>
        );
      })}
    </>
  );
}
