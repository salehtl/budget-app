import type { CashflowSummary } from "../../lib/cashflow.ts";
import { formatCurrency } from "../../lib/format.ts";

interface SummaryStripProps {
  summary: CashflowSummary;
}

export function SummaryStrip({ summary }: SummaryStripProps) {
  return (
    <div className="flex items-stretch gap-3 overflow-x-auto">
      <SummaryCard
        label="Income"
        amount={summary.income}
        variant="income"
        confirmed={summary.confirmedIncome}
        planned={summary.plannedIncome}
      />
      <SummaryCard
        label="Expenses"
        amount={summary.expenses}
        variant="expense"
        confirmed={summary.confirmedExpenses}
        planned={summary.plannedExpenses}
      />
      <SummaryCard
        label="Net"
        amount={summary.net}
        variant={summary.net >= 0 ? "income" : "expense"}
      />
    </div>
  );
}

function SummaryCard({
  label,
  amount,
  variant,
  confirmed,
  planned,
}: {
  label: string;
  amount: number;
  variant: "income" | "expense";
  confirmed?: number;
  planned?: number;
}) {
  const hasBreakdown = confirmed !== undefined && planned !== undefined && planned > 0;

  return (
    <div className="flex-1 min-w-[130px] bg-surface rounded-xl border border-border p-3">
      <p className="text-[11px] text-text-muted font-medium tracking-wide uppercase">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${variant === "income" ? "text-success" : "text-danger"}`}>
        {formatCurrency(amount)}
      </p>
      <div className={`mt-1.5 flex items-center gap-2 text-[10px] text-text-light h-4 ${hasBreakdown ? "visible" : "invisible"}`}>
        <span>{formatCurrency(confirmed ?? 0)} conf.</span>
        <span className="italic">+{formatCurrency(planned ?? 0)} plan.</span>
      </div>
    </div>
  );
}
