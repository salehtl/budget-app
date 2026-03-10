import { useState, useRef, useEffect } from "react";
import { CellWrapper } from "./CellWrapper.tsx";

interface PayeeCellProps {
  value: string;
  categoryColor: string | null;
  isPlanned: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
  onAdvance: (direction: 1 | -1) => void;
}

export function PayeeCell({
  value,
  categoryColor,
  isPlanned,
  isEditing,
  onStartEdit,
  onCommit,
  onCancel,
  onAdvance,
}: PayeeCellProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(value);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isEditing, value]);

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      onCancel();
      return;
    }
    if (trimmed !== value) {
      onCommit(trimmed);
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
      className="flex items-center gap-1.5 min-w-0"
      display={
        <>
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: categoryColor ?? "var(--color-border-dark)" }}
          />
          <span className={`text-[13px] truncate ${isPlanned ? "text-text-muted" : "text-text"}`}>
            {value}
          </span>
        </>
      }
      editor={
        <>
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: categoryColor ?? "var(--color-border-dark)" }}
          />
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commit}
            className="flex-1 min-w-0 text-[13px] text-text py-0.5 bg-transparent outline-none border-b border-accent/30 focus:border-accent transition-colors"
          />
        </>
      }
    />
  );
}
