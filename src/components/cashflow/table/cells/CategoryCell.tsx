import { useEscapeKey } from "../../../../hooks/useClickOutside.ts";
import { CategoryCombo } from "../../../ui/CategoryCombo.tsx";
import type { Category } from "../../../../types/database.ts";

interface CategoryCellProps {
  value: string | null;
  displayName: string | null;
  categories: Category[];
  isEditing: boolean;
  onStartEdit: () => void;
  onCommit: (categoryId: string | null) => void;
  onCancel: () => void;
  onCreateCategory?: (name: string) => Promise<string>;
}

export function CategoryCell({
  value,
  displayName,
  categories,
  isEditing,
  onStartEdit,
  onCommit,
  onCancel,
  onCreateCategory,
}: CategoryCellProps) {
  useEscapeKey(onCancel, isEditing);

  function handleChange(id: string) {
    const newValue = id || null;
    if (newValue !== value) {
      onCommit(newValue);
    } else {
      onCancel();
    }
  }

  if (isEditing) {
    return (
      <div className="hidden sm:block relative" onKeyDown={(e) => e.stopPropagation()}>
        <CategoryCombo
          value={value ?? ""}
          onChange={handleChange}
          categories={categories}
          variant="edit"
          onCreateCategory={onCreateCategory}
          autoOpen
        />
      </div>
    );
  }

  return (
    <div
      className="hidden sm:block cursor-default"
      onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
    >
      <span className="text-[11px] text-text-muted text-center truncate block" title={displayName ?? undefined}>
        {displayName ?? "\u2014"}
      </span>
    </div>
  );
}
