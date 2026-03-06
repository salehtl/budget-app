import { useState, useRef, useEffect } from "react";

interface MonthPickerProps {
  value: string; // "YYYY-MM"
  onChange: (value: string) => void;
  className?: string;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseMonth(value: string): { year: number; month: number } {
  const [y, m] = value.split("-").map(Number) as [number, number];
  return { year: y, month: m };
}

function formatDisplay(value: string): string {
  const { year, month } = parseMonth(value);
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

export function MonthPicker({ value, onChange, className = "" }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => parseMonth(value).year);
  const ref = useRef<HTMLDivElement>(null);
  const { year: selectedYear, month: selectedMonth } = parseMonth(value);

  // Sync viewYear when value changes externally
  useEffect(() => {
    setViewYear(parseMonth(value).year);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function selectMonth(month: number) {
    onChange(`${viewYear}-${String(month).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text hover:bg-surface-alt transition-colors cursor-pointer outline-none focus:border-accent"
      >
        <svg className="w-3.5 h-3.5 text-text-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {formatDisplay(value)}
        <svg className={`w-3 h-3 text-text-light transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-[240px] rounded-xl border border-border bg-surface shadow-lg animate-slide-up">
          {/* Year nav */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              className="p-1 rounded hover:bg-surface-alt text-text-muted hover:text-text transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="text-sm font-semibold tabular-nums">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              className="p-1 rounded hover:bg-surface-alt text-text-muted hover:text-text transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-1 p-2">
            {MONTH_LABELS.map((label, i) => {
              const m = i + 1;
              const isSelected = viewYear === selectedYear && m === selectedMonth;
              const now = new Date();
              const isCurrent = viewYear === now.getFullYear() && m === now.getMonth() + 1;

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => selectMonth(m)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-accent text-white"
                      : isCurrent
                        ? "bg-accent/10 text-accent hover:bg-accent/20"
                        : "text-text hover:bg-surface-alt"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
