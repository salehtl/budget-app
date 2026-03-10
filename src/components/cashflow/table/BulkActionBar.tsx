import { useState } from "react";
import type { Category } from "../../../types/database.ts";

interface BulkActionBarProps {
  selectedIds: Set<string>;
  categories?: Category[];
  onDelete: (ids: string[]) => void;
  onChangeStatus: (ids: string[], status: "planned" | "confirmed") => void;
  onChangeCategory: (ids: string[], categoryId: string | null) => void;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedIds,
  categories,
  onDelete,
  onChangeStatus,
  onChangeCategory,
  onClearSelection,
}: BulkActionBarProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const ids = Array.from(selectedIds);
  const count = ids.length;

  return (
    <div className="fixed bottom-14 sm:bottom-0 left-0 right-0 z-[50] flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto mx-4 mb-4 flex items-center gap-3 rounded-xl border border-border bg-surface shadow-xl px-4 py-2.5 animate-slide-up">
        <span className="text-sm font-medium text-text tabular-nums">
          {count} selected
        </span>

        <div className="w-px h-5 bg-border" />

        {/* Status dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowStatusMenu(!showStatusMenu); setShowCategoryMenu(false); }}
            className="text-xs font-medium text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-alt transition-colors cursor-pointer"
          >
            Status
          </button>
          {showStatusMenu && (
            <div className="absolute bottom-full left-0 mb-1 z-[60] min-w-[120px] rounded-lg border border-border bg-surface shadow-lg py-1">
              <button
                onClick={() => { onChangeStatus(ids, "confirmed"); setShowStatusMenu(false); onClearSelection(); }}
                className="w-full text-left px-3 py-1.5 text-xs text-text-muted hover:bg-surface-alt cursor-pointer"
              >
                Confirmed
              </button>
              <button
                onClick={() => { onChangeStatus(ids, "planned"); setShowStatusMenu(false); onClearSelection(); }}
                className="w-full text-left px-3 py-1.5 text-xs text-text-muted hover:bg-surface-alt cursor-pointer"
              >
                Planned
              </button>
            </div>
          )}
        </div>

        {/* Category dropdown — hidden when categories is undefined (e.g. mixed income+expense selection) */}
        {categories !== undefined && (
          <div className="relative">
            <button
              onClick={() => { setShowCategoryMenu(!showCategoryMenu); setShowStatusMenu(false); }}
              className="text-xs font-medium text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-alt transition-colors cursor-pointer"
            >
              Category
            </button>
            {showCategoryMenu && (
              <div className="absolute bottom-full left-0 mb-1 z-[60] min-w-[160px] max-h-48 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg py-1">
                <button
                  onClick={() => { onChangeCategory(ids, null); setShowCategoryMenu(false); onClearSelection(); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-text-light italic hover:bg-surface-alt cursor-pointer"
                >
                  None
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { onChangeCategory(ids, c.id); setShowCategoryMenu(false); onClearSelection(); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-text-muted hover:bg-surface-alt cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Delete */}
        <button
          onClick={() => { onDelete(ids); onClearSelection(); }}
          className="text-xs font-medium text-danger hover:bg-danger-light/30 px-2 py-1 rounded transition-colors cursor-pointer"
        >
          Delete
        </button>

        <div className="w-px h-5 bg-border" />

        {/* Clear */}
        <button
          onClick={onClearSelection}
          className="p-1 text-text-light hover:text-text-muted cursor-pointer"
          title="Clear selection"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
