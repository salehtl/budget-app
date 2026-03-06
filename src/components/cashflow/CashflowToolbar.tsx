import { Button } from "../ui/Button.tsx";
import { MonthPicker } from "../ui/MonthPicker.tsx";
import { MonthRangePicker } from "../ui/MonthRangePicker.tsx";

export type ViewMode = "multi" | "single";

interface CashflowToolbarProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  startMonth: string;
  endMonth: string;
  onStartChange: (month: string) => void;
  onEndChange: (month: string) => void;
  singleMonth: string;
  onSingleMonthChange: (month: string) => void;
  onAddRow: () => void;
}

function stepMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function CashflowToolbar({
  mode,
  onModeChange,
  startMonth,
  endMonth,
  onStartChange,
  onEndChange,
  singleMonth,
  onSingleMonthChange,
  onAddRow,
}: CashflowToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* View mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
          <button
            onClick={() => onModeChange("multi")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              mode === "multi"
                ? "bg-accent text-white"
                : "bg-surface text-text-muted hover:text-text"
            }`}
          >
            Multi-Month
          </button>
          <button
            onClick={() => onModeChange("single")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer border-l border-border ${
              mode === "single"
                ? "bg-accent text-white"
                : "bg-surface text-text-muted hover:text-text"
            }`}
          >
            Single Month
          </button>
        </div>

        {/* Date pickers */}
        {mode === "multi" ? (
          <MonthRangePicker
            startMonth={startMonth}
            endMonth={endMonth}
            onStartChange={onStartChange}
            onEndChange={onEndChange}
          />
        ) : (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onSingleMonthChange(stepMonth(singleMonth, -1))}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-alt transition-colors cursor-pointer"
              title="Previous month"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <MonthPicker value={singleMonth} onChange={onSingleMonthChange} />
            <button
              onClick={() => onSingleMonthChange(stepMonth(singleMonth, 1))}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-alt transition-colors cursor-pointer"
              title="Next month"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <Button size="sm" onClick={onAddRow} className="self-start sm:self-auto">
        + Add Row
      </Button>
    </div>
  );
}
