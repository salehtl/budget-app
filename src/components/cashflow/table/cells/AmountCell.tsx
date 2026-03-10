import { useState, useRef, useEffect } from "react";
import { CellWrapper } from "./CellWrapper.tsx";
import { formatCurrency } from "../../../../lib/format.ts";

interface AmountCellProps {
  value: number;
  isPlanned: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onCommit: (value: number) => void;
  onCancel: () => void;
  onAdvance: (direction: 1 | -1) => void;
}

export function AmountCell({
  value,
  isPlanned,
  isEditing,
  onStartEdit,
  onCommit,
  onCancel,
  onAdvance,
}: AmountCellProps) {
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(String(value));
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isEditing, value]);

  function commit() {
    const num = parseFloat(draft);
    if (isNaN(num) || num <= 0) {
      onCancel();
      return;
    }
    if (num !== value) {
      onCommit(num);
    } else {
      onCancel();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    else if (e.key === "Tab") { e.preventDefault(); commit(); onAdvance(e.shiftKey ? -1 : 1); }
  }

  return (
    <CellWrapper
      isEditing={isEditing}
      onClick={onStartEdit}
      display={
        <span className={`text-[13px] font-medium tabular-nums text-right block ${isPlanned ? "text-text-muted" : "text-text"}`}>
          {formatCurrency(value)}
        </span>
      }
      editor={
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          className="w-full text-[13px] text-right tabular-nums text-text py-0.5 bg-transparent outline-none border-b border-accent/30 focus:border-accent transition-colors"
        />
      }
    />
  );
}
