import { useRef, useCallback } from "react";
import { Calendar } from "../../ui/Calendar.tsx";
import { formatDateShort } from "../../../lib/format.ts";
import { useClickOutside, useEscapeKey } from "../../../hooks/useClickOutside.ts";

interface EndDateCellProps {
  value: string | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onCommit: (value: string | null) => void;
  onCancel: () => void;
}

export function EndDateCell({
  value,
  isEditing,
  onStartEdit,
  onCommit,
  onCancel,
}: EndDateCellProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useClickOutside(popoverRef, onCancel, isEditing);
  useEscapeKey(onCancel, isEditing);

  const handleSelect = useCallback((newDate: string) => {
    if (newDate !== value) {
      onCommit(newDate);
    } else {
      onCancel();
    }
  }, [value, onCommit, onCancel]);

  const handleClear = useCallback(() => {
    if (value !== null) {
      onCommit(null);
    } else {
      onCancel();
    }
  }, [value, onCommit, onCancel]);

  return (
    <div className="hidden sm:block relative">
      <div
        className="cursor-default"
        onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
      >
        {value ? (
          <span className="text-[11px] text-text-light text-center block tabular-nums">
            {formatDateShort(value)}
          </span>
        ) : (
          <span className="text-[11px] text-text-light/50 text-center block">Open</span>
        )}
      </div>

      {isEditing && (
        <div
          ref={popoverRef}
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[60] rounded-xl border border-border bg-surface shadow-lg p-3 animate-slide-up"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Calendar value={value ?? ""} onChange={handleSelect} />
          {value && (
            <button
              onClick={handleClear}
              className="w-full mt-2 text-xs text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-alt transition-colors cursor-pointer text-center"
            >
              Clear end date
            </button>
          )}
          {!value && (
            <div className="mt-2 text-[10px] text-text-light/50 text-center">
              Select a date or leave open
            </div>
          )}
        </div>
      )}
    </div>
  );
}
