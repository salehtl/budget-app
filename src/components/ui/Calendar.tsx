import { useState, useRef, useEffect, useCallback } from "react";

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface CalendarProps {
  value: string; // "YYYY-MM-DD"
  onChange: (date: string) => void;
  min?: string;
  max?: string;
}

function parseDate(value: string): { year: number; month: number; day: number } {
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  return { year: y, month: m, day: d };
}

function fmt(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

function getToday(): string {
  const d = new Date();
  return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function Calendar({ value, onChange, min, max }: CalendarProps) {
  const parsed = value ? parseDate(value) : null;
  const [viewYear, setViewYear] = useState(() => parsed?.year ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parsed?.month ?? new Date().getMonth() + 1);
  const [focusDay, setFocusDay] = useState(() => parsed?.day ?? 1);
  const gridRef = useRef<HTMLDivElement>(null);

  const today = getToday();
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  // Sync view when value changes externally
  useEffect(() => {
    if (value) {
      const p = parseDate(value);
      setViewYear(p.year);
      setViewMonth(p.month);
      setFocusDay(p.day);
    }
  }, [value]);

  function isDisabled(dateStr: string): boolean {
    if (min && dateStr < min) return true;
    if (max && dateStr > max) return true;
    return false;
  }

  function prevMonth() {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
    setFocusDay(1);
  }

  function nextMonth() {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
    setFocusDay(1);
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let newDay = focusDay;
      let newMonth = viewMonth;
      let newYear = viewYear;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          newDay--;
          break;
        case "ArrowRight":
          e.preventDefault();
          newDay++;
          break;
        case "ArrowUp":
          e.preventDefault();
          newDay -= 7;
          break;
        case "ArrowDown":
          e.preventDefault();
          newDay += 7;
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          {
            const dateStr = fmt(viewYear, viewMonth, focusDay);
            if (!isDisabled(dateStr)) onChange(dateStr);
          }
          return;
        default:
          return;
      }

      // Handle month overflow
      if (newDay < 1) {
        if (newMonth === 1) {
          newYear--;
          newMonth = 12;
        } else {
          newMonth--;
        }
        newDay = getDaysInMonth(newYear, newMonth) + newDay;
      } else if (newDay > getDaysInMonth(newYear, newMonth)) {
        newDay -= getDaysInMonth(newYear, newMonth);
        if (newMonth === 12) {
          newYear++;
          newMonth = 1;
        } else {
          newMonth++;
        }
      }

      setFocusDay(newDay);
      setViewMonth(newMonth);
      setViewYear(newYear);
    },
    [focusDay, viewMonth, viewYear, onChange],
  );

  // Build day cells
  const cells: Array<{ day: number; dateStr: string; isCurrentMonth: boolean }> = [];

  // Previous month trailing days
  if (firstDay > 0) {
    const prevDays = getDaysInMonth(
      viewMonth === 1 ? viewYear - 1 : viewYear,
      viewMonth === 1 ? 12 : viewMonth - 1,
    );
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevDays - i;
      const m = viewMonth === 1 ? 12 : viewMonth - 1;
      const y = viewMonth === 1 ? viewYear - 1 : viewYear;
      cells.push({ day: d, dateStr: fmt(y, m, d), isCurrentMonth: false });
    }
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: fmt(viewYear, viewMonth, d), isCurrentMonth: true });
  }

  // Next month leading days
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 12 ? 1 : viewMonth + 1;
      const y = viewMonth === 12 ? viewYear + 1 : viewYear;
      cells.push({ day: d, dateStr: fmt(y, m, d), isCurrentMonth: false });
    }
  }

  return (
    <div className="w-[280px]">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-surface-alt text-text-muted hover:text-text transition-colors cursor-pointer"
        >
          <ChevronLeftIcon />
        </button>
        <span className="text-sm font-semibold">
          {MONTH_NAMES[viewMonth - 1]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-surface-alt text-text-muted hover:text-text transition-colors cursor-pointer"
        >
          <ChevronRightIcon />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-text-muted py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        ref={gridRef}
        role="grid"
        aria-label="Calendar"
        className="grid grid-cols-7"
        onKeyDown={handleKeyDown}
      >
        {cells.map((cell, i) => {
          const isSelected = cell.dateStr === value;
          const isToday = cell.dateStr === today;
          const disabled = isDisabled(cell.dateStr);
          const isFocused = cell.isCurrentMonth && cell.day === focusDay;

          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              tabIndex={isFocused ? 0 : -1}
              aria-selected={isSelected}
              disabled={disabled}
              onClick={() => {
                if (!disabled) {
                  if (!cell.isCurrentMonth) {
                    const p = parseDate(cell.dateStr);
                    setViewYear(p.year);
                    setViewMonth(p.month);
                    setFocusDay(p.day);
                  }
                  onChange(cell.dateStr);
                }
              }}
              className={`
                relative h-9 w-9 mx-auto text-[13px] rounded-lg
                transition-colors cursor-pointer
                outline-none focus-visible:ring-2 focus-visible:ring-accent
                disabled:opacity-30 disabled:cursor-not-allowed
                ${
                  isSelected
                    ? "bg-accent text-white font-semibold"
                    : isToday
                      ? "bg-accent/10 text-accent font-semibold"
                      : cell.isCurrentMonth
                        ? "text-text hover:bg-surface-alt"
                        : "text-text-light/40 hover:bg-surface-alt/50"
                }
              `}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- DatePicker (Calendar + popover trigger) ---

interface DatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (date: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  variant?: "default" | "inline";
  className?: string;
}

function formatDisplayDate(value: string): string {
  if (!value) return "";
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" });
}

function formatInlineDate(value: string): string {
  if (!value) return "";
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString("en-AE", { day: "numeric", month: "short" });
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder = "Pick a date",
  label,
  variant = "default",
  className = "",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  function handleSelect(date: string) {
    onChange(date);
    setOpen(false);
  }

  if (variant === "inline") {
    return (
      <div ref={ref} className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className="text-[11px] text-text-muted text-center py-0.5 cursor-pointer bg-transparent border-b border-transparent hover:border-border-dark focus:border-accent outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
        >
          {value ? formatInlineDate(value) : <span className="text-text-light">Date</span>}
        </button>
        {open && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[60] rounded-xl border border-border bg-surface shadow-lg p-3 animate-slide-up">
            <Calendar value={value} onChange={handleSelect} min={min} max={max} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-text-muted">{label}</label>
      )}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className={`w-full flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-left
            outline-none transition-colors
            hover:bg-surface-alt focus:border-accent focus:ring-1 focus:ring-accent
            disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
        >
          <CalendarIcon className="w-4 h-4 text-text-light shrink-0" />
          {value ? (
            <span className="text-text">{formatDisplayDate(value)}</span>
          ) : (
            <span className="text-text-light">{placeholder}</span>
          )}
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 z-[60] rounded-xl border border-border bg-surface shadow-lg p-3 animate-slide-up">
            <Calendar value={value} onChange={handleSelect} min={min} max={max} />
          </div>
        )}
      </div>
    </div>
  );
}

// --- Icons ---

function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
