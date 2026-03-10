import type { RegisteredAction, ActionContext } from "./types.ts";

export function createActions(callbacks: {
  onDeleteRow: (id: string) => void;
  onToggleStatus: (id: string, newStatus: "planned" | "confirmed") => void;
  onDuplicateRow?: (id: string) => void;
  onEditCell: (rowId: string, col: number) => void;
  getRow: (id: string) => { status: string } | undefined;
}): RegisteredAction[] {
  const { onDeleteRow, onToggleStatus, onDuplicateRow, onEditCell, getRow } = callbacks;

  const actions: RegisteredAction[] = [
    {
      id: "delete",
      label: "Delete",
      shortcut: "d",
      dangerous: true,
      supportsBulk: true,
      enabled: (ctx) => !!ctx.focusedRowId || ctx.selectedIds.size > 0,
      execute: (ctx) => {
        if (ctx.selectedIds.size > 0) {
          for (const id of ctx.selectedIds) onDeleteRow(id);
        } else if (ctx.focusedRowId) {
          onDeleteRow(ctx.focusedRowId);
        }
      },
    },
    {
      id: "toggle-status",
      label: "Toggle Status",
      shortcut: "s",
      supportsBulk: true,
      enabled: (ctx) => !!ctx.focusedRowId || ctx.selectedIds.size > 0,
      execute: (ctx) => {
        const toggleOne = (id: string) => {
          const row = getRow(id);
          if (!row) return;
          const next = row.status === "confirmed" ? "planned" : "confirmed";
          onToggleStatus(id, next as "planned" | "confirmed");
        };
        if (ctx.selectedIds.size > 0) {
          for (const id of ctx.selectedIds) toggleOne(id);
        } else if (ctx.focusedRowId) {
          toggleOne(ctx.focusedRowId);
        }
      },
    },
    {
      id: "edit-payee",
      label: "Edit Payee",
      shortcut: "e",
      enabled: (ctx) => !!ctx.focusedRowId,
      execute: (ctx) => {
        if (ctx.focusedRowId) onEditCell(ctx.focusedRowId, 0);
      },
    },
    {
      id: "edit-category",
      label: "Edit Category",
      shortcut: "c",
      enabled: (ctx) => !!ctx.focusedRowId,
      execute: (ctx) => {
        if (ctx.focusedRowId) onEditCell(ctx.focusedRowId, 2);
      },
    },
  ];

  if (onDuplicateRow) {
    actions.push({
      id: "duplicate",
      label: "Duplicate",
      shortcut: "Cmd+D",
      enabled: (ctx) => !!ctx.focusedRowId,
      execute: (ctx) => {
        if (ctx.focusedRowId) onDuplicateRow(ctx.focusedRowId);
      },
    });
  }

  return actions;
}
