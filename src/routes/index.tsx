import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "../components/layout/PageHeader.tsx";
import {
  useMonthSummary,
  useCategoryBreakdown,
  useMonthlyTrends,
  useTransactions,
} from "../hooks/useTransactions.ts";
import {
  formatCurrency,
  formatMonth,
  getCurrentMonth,
  getPreviousMonth,
  getNextMonth,
  formatDateShort,
} from "../lib/format.ts";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [month, setMonth] = useState(getCurrentMonth);

  return (
    <div>
      <PageHeader title="Dashboard" />
      <MonthSelector month={month} onChange={setMonth} />
      <SummaryCards month={month} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <CategoryDonutChart month={month} />
        <SpendingBarChart month={month} />
      </div>
      <div className="mt-4">
        <TrendLineChart />
      </div>
      <div className="mt-4">
        <RecentTransactions month={month} />
      </div>
    </div>
  );
}

function MonthSelector({
  month,
  onChange,
}: {
  month: string;
  onChange: (m: string) => void;
}) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <button
        onClick={() => onChange(getPreviousMonth(month))}
        className="p-1.5 rounded-lg hover:bg-surface-alt text-text-muted cursor-pointer"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <span className="text-base font-medium min-w-[160px] text-center">
        {formatMonth(month)}
      </span>
      <button
        onClick={() => onChange(getNextMonth(month))}
        className="p-1.5 rounded-lg hover:bg-surface-alt text-text-muted cursor-pointer"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}

function SummaryCards({ month }: { month: string }) {
  const { total_income, total_expenses, net } = useMonthSummary(month);

  const cards = [
    { label: "Income", value: total_income, color: "text-success" },
    { label: "Expenses", value: total_expenses, color: "text-danger" },
    { label: "Net", value: net, color: net >= 0 ? "text-success" : "text-danger" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-surface rounded-xl border border-border p-4"
        >
          <p className="text-xs text-text-muted font-medium">{card.label}</p>
          <p className={`text-lg font-bold mt-1 ${card.color}`}>
            {formatCurrency(card.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function CategoryDonutChart({ month }: { month: string }) {
  const { breakdown } = useCategoryBreakdown(month);

  if (breakdown.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="text-sm font-medium text-text-muted mb-3">Expenses by Category</h3>
        <p className="text-sm text-text-light text-center py-8">No expenses this month</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <h3 className="text-sm font-medium text-text-muted mb-3">Expenses by Category</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={breakdown}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            dataKey="total"
            nameKey="category_name"
            paddingAngle={2}
          >
            {breakdown.map((entry) => (
              <Cell key={entry.category_id} fill={entry.category_color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
              fontSize: "12px",
            }}
          />
          <Legend
            formatter={(value: string) => (
              <span className="text-xs">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function SpendingBarChart({ month }: { month: string }) {
  const { breakdown } = useCategoryBreakdown(month);

  if (breakdown.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="text-sm font-medium text-text-muted mb-3">Spending by Category</h3>
        <p className="text-sm text-text-light text-center py-8">No expenses this month</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <h3 className="text-sm font-medium text-text-muted mb-3">Spending by Category</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={breakdown} layout="vertical" margin={{ left: 80 }}>
          <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="category_name" tick={{ fontSize: 11 }} width={75} />
          <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-border)", fontSize: "12px" }} />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {breakdown.map((entry) => (
              <Cell key={entry.category_id} fill={entry.category_color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendLineChart() {
  const { trends } = useMonthlyTrends(6);

  if (trends.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="text-sm font-medium text-text-muted mb-3">Monthly Trends</h3>
        <p className="text-sm text-text-light text-center py-8">No data yet</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <h3 className="text-sm font-medium text-text-muted mb-3">Monthly Trends</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={trends}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-border)", fontSize: "12px" }} />
          <Legend />
          <Line type="monotone" dataKey="income" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="expenses" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function RecentTransactions({ month }: { month: string }) {
  const { transactions } = useTransactions({ month });
  const recent = transactions.slice(0, 8);

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <h3 className="text-sm font-medium text-text-muted mb-3">Recent Transactions</h3>
      {recent.length === 0 ? (
        <p className="text-sm text-text-light text-center py-4">No transactions this month</p>
      ) : (
        <div className="space-y-2">
          {recent.map((txn) => (
            <div
              key={txn.id}
              className="flex items-center justify-between py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: txn.category_color ?? "#94a3b8" }}
                />
                <span className="text-sm truncate">
                  {txn.payee || txn.category_name || "Uncategorized"}
                </span>
                <span className="text-xs text-text-light">
                  {formatDateShort(txn.date)}
                </span>
              </div>
              <span
                className={`text-sm font-medium shrink-0 ${
                  txn.type === "income" ? "text-success" : "text-danger"
                }`}
              >
                {txn.type === "income" ? "+" : "-"}
                {formatCurrency(txn.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
