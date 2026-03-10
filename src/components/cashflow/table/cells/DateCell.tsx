import { useRef, useCallback } from "react";
import { Calendar } from "../../../ui/Calendar.tsx";
import { formatDateShort } from "../../../../lib/format.ts";
import { useClickOutside, useEscapeKey } from "../../../../hooks/useClickOutside.ts";

interface DateCellProps {
  value: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function DateCell({
  value,
  isEditing,
  onStartEdit,
  onCommit,
  onCancel,
}: DateCellProps) {
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

  return (
    <div className="hidden sm:block relative">
      <div
        className="cursor-default"
        onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
      >
        <span className="text-[11px] text-text-light text-center block tabular-nums">
          {formatDateShort(value)}
        </span>
      </div>

      {isEditing && (
        <div
          ref={popoverRef}
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[60] rounded-xl border border-border bg-surface shadow-lg p-3 animate-slide-up"
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Calendar value={value} onChange={handleSelect} />
        </div>
      )}
    </div>
  );
}
