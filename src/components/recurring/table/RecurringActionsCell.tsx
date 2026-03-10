import { useState, useRef, useCallback } from "react";
import { useClickOutside } from "../../../hooks/useClickOutside.ts";

interface RecurringActionsCellProps {
  isActive: boolean;
  onToggleActive: () => void;
  onDelete: () => void;
}

export function RecurringActionsCell({
  isActive,
  onToggleActive,
  onDelete,
}: RecurringActionsCellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useClickOutside(menuRef, closeMenu, menuOpen);

  return (
    <div className="relative flex items-center justify-end" ref={menuRef} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="p-1 rounded-md text-text-light hover:text-text-muted sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 z-[70] min-w-[140px] rounded-lg border border-border bg-surface shadow-lg py-1 animate-slide-up">
          <button
            onClick={() => { onToggleActive(); setMenuOpen(false); }}
            className="w-full text-left px-3 py-2 sm:py-1.5 text-xs text-text-muted hover:bg-surface-alt hover:text-text transition-colors cursor-pointer"
          >
            {isActive ? "Pause" : "Resume"}
          </button>
          <button
            onClick={() => { onDelete(); setMenuOpen(false); }}
            className="w-full text-left px-3 py-2 sm:py-1.5 text-xs text-danger hover:bg-danger-light/30 transition-colors cursor-pointer"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
