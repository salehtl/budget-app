import type { RegisteredAction } from "../../cashflow/table/types.ts";
import { RECURRING_COLUMN_INDEX } from "./types.ts";

export function createRecurringActions(callbacks: {
  onDelete: (id: string) => void;
  onToggleActive: (id: string) => void;
  onEditCell: (rowId: string, col: number) => void;
}): RegisteredAction[] {
  const { onDelete, onToggleActive, onEditCell } = callbacks;

  return [
    {
      id: "delete",
      label: "Delete",
      shortcut: "d",
      dangerous: true,
      supportsBulk: true,
      enabled: (ctx) => !!ctx.focusedRowId || ctx.selectedIds.size > 0,
      execute: (ctx) => {
        if (ctx.selectedIds.size > 0) {
          for (const id of ctx.selectedIds) onDelete(id);
        } else if (ctx.focusedRowId) {
          onDelete(ctx.focusedRowId);
        }
      },
    },
    {
      id: "toggle-active",
      label: "Pause/Resume",
      shortcut: "p",
      supportsBulk: true,
      enabled: (ctx) => !!ctx.focusedRowId || ctx.selectedIds.size > 0,
      execute: (ctx) => {
        if (ctx.selectedIds.size > 0) {
          for (const id of ctx.selectedIds) onToggleActive(id);
        } else if (ctx.focusedRowId) {
          onToggleActive(ctx.focusedRowId);
        }
      },
    },
    {
      id: "edit-payee",
      label: "Edit Payee",
      shortcut: "e",
      enabled: (ctx) => !!ctx.focusedRowId,
      execute: (ctx) => {
        if (ctx.focusedRowId) onEditCell(ctx.focusedRowId, RECURRING_COLUMN_INDEX.payee);
      },
    },
    {
      id: "edit-category",
      label: "Edit Category",
      shortcut: "c",
      enabled: (ctx) => !!ctx.focusedRowId,
      execute: (ctx) => {
        if (ctx.focusedRowId) onEditCell(ctx.focusedRowId, RECURRING_COLUMN_INDEX.category);
      },
    },
  ];
}
