import { Button } from "../ui/Button.tsx";
import { MonthPicker } from "../ui/MonthPicker.tsx";
import type { GroupBy } from "../../lib/cashflow.ts";

interface CashflowToolbarProps {
  month: string;
  onMonthChange: (month: string) => void;
  groupBy: GroupBy;
  onGroupByChange: (groupBy: GroupBy) => void;
  onAddRow: () => void;
}

function stepMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function CashflowToolbar({
  month,
  onMonthChange,
  groupBy,
  onGroupByChange,
  onAddRow,
}: CashflowToolbarProps) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 mb-4">
      {/* Month navigation */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onMonthChange(stepMonth(month, -1))}
          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-alt transition-colors cursor-pointer"
          title="Previous month"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <MonthPicker value={month} onChange={onMonthChange} />
        <button
          onClick={() => onMonthChange(stepMonth(month, 1))}
          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-alt transition-colors cursor-pointer"
          title="Next month"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Group by */}
      <div className="relative">
        <select
          value={groupBy}
          onChange={(e) => onGroupByChange(e.target.value as GroupBy)}
          className="appearance-none pl-2 pr-7 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text-muted outline-none focus:border-accent cursor-pointer"
        >
          <option value="none">No grouping</option>
          <option value="category">By category</option>
          <option value="group_name">By group</option>
          <option value="type">By type</option>
        </select>
        <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-light pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      <div className="flex-1" />

      <Button size="sm" onClick={onAddRow}>
        + Add
      </Button>
    </div>
  );
}
