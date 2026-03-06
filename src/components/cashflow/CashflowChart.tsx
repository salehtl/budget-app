import { useState } from "react";
import {
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import type { CashflowGrid } from "../../lib/cashflow.ts";
import { formatCurrency } from "../../lib/format.ts";
import { getCurrentMonth } from "../../lib/cashflow.ts";

interface CashflowChartProps {
  grid: CashflowGrid;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(y, m - 1).toLocaleDateString("en-AE", { month: "short" });
}

export function CashflowChart({ grid }: CashflowChartProps) {
  const [collapsed, setCollapsed] = useState(false);
  const currentMonth = getCurrentMonth();

  const data = grid.months.map((month) => {
    const totals = grid.monthTotals.get(month) ?? { income: 0, expense: 0, net: 0 };
    return {
      month,
      label: formatMonthLabel(month),
      income: totals.income,
      expense: totals.expense,
      net: totals.net,
      isCurrent: month === currentMonth,
    };
  });

  // Calculate running balance
  let runningBalance = 0;
  for (const d of data) {
    runningBalance += d.net;
    (d as Record<string, unknown>).balance = runningBalance;
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full flex items-center gap-2 px-3 py-2 mb-4 rounded-xl border border-border bg-surface text-xs text-text-muted hover:bg-surface-alt transition-colors cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        Show chart
      </button>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">Cashflow Trend</h3>
        <button
          onClick={() => setCollapsed(true)}
          className="text-text-light hover:text-text-muted p-1 rounded cursor-pointer"
          title="Collapse chart"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-text-light)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => {
              if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
              return String(v);
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            formatter={(value: number, name: string) => [
              formatCurrency(value),
              name === "balance" ? "Running Balance" : name.charAt(0).toUpperCase() + name.slice(1),
            ]}
            labelFormatter={(_label: string, payload: Array<{ payload?: { month?: string } }>) => {
              const item = payload[0]?.payload;
              if (!item?.month) return _label;
              const [y, m] = item.month.split("-").map(Number) as [number, number];
              return new Date(y, m - 1).toLocaleDateString("en-AE", { month: "long", year: "numeric" });
            }}
          />
          <ReferenceLine y={0} stroke="var(--color-border-dark)" strokeDasharray="3 3" />
          <Bar dataKey="income" fill="var(--color-success)" radius={[3, 3, 0, 0]} barSize={20} opacity={0.85} />
          <Bar dataKey="expense" fill="var(--color-danger)" radius={[3, 3, 0, 0]} barSize={20} opacity={0.85} />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--color-accent)", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "var(--color-accent)", strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-2">
        <Legend color="var(--color-success)" label="Income" />
        <Legend color="var(--color-danger)" label="Expenses" />
        <Legend color="var(--color-accent)" label="Running Balance" isLine />
      </div>
    </div>
  );
}

function Legend({ color, label, isLine }: { color: string; label: string; isLine?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
      {isLine ? (
        <div className="w-4 h-0.5 rounded" style={{ backgroundColor: color }} />
      ) : (
        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color, opacity: 0.85 }} />
      )}
      {label}
    </div>
  );
}
