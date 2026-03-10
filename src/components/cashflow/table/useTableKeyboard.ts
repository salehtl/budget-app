import { useCallback, useRef, useEffect } from "react";
import type { TableState, TableAction } from "./types.ts";
import { COLUMN_INDEX, COLUMNS } from "./types.ts";
import type { RegisteredAction } from "./types.ts";
import type { CashflowRow } from "../../../lib/cashflow.ts";

interface UseTableKeyboardOpts {
  state: TableState;
  dispatch: (action: TableAction) => void;
  orderedRowIds: string[];
  actions: RegisteredAction[];
  columnsCount?: number;
  defaultEditCol?: number;
  getRow: (id: string) => CashflowRow | undefined;
  onDuplicateRow?: (row: CashflowRow) => void;
  onCopy?: (ids: string[]) => void;
  onPaste?: () => void;
}

// Module-scoped clipboard for copy/paste across both income/expense tables.
// Intentionally shared: copying from expense and pasting into income duplicates the row there.
let copiedRows: CashflowRow[] = [];

export function useTableKeyboard({ state, dispatch, orderedRowIds, actions, columnsCount, defaultEditCol, getRow, onDuplicateRow, onCopy, onPaste }: UseTableKeyboardOpts) {
  // Use a ref so the callback doesn't depend on the state object identity
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  return useCallback(
    (e: React.KeyboardEvent) => {
      const { editingCell, focusedRowId, focusedCol, selectedIds } = stateRef.current;

      // If an editor is open, let it handle its own keys
      if (editingCell) return;

      // Don't intercept if target is an input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const currentIdx = focusedRowId ? orderedRowIds.indexOf(focusedRowId) : -1;

      // Navigation
      switch (e.key) {
        case "ArrowDown":
        case "j": {
          e.preventDefault();
          const nextIdx = currentIdx < orderedRowIds.length - 1 ? currentIdx + 1 : 0;
          const nextId = orderedRowIds[nextIdx];
          if (nextId) {
            if (focusedCol !== null) {
              dispatch({ type: "FOCUS_CELL", rowId: nextId, col: focusedCol });
            } else {
              dispatch({ type: "FOCUS_ROW", rowId: nextId });
            }
          }
          return;
        }
        case "ArrowUp":
        case "k": {
          e.preventDefault();
          const prevIdx = currentIdx > 0 ? currentIdx - 1 : orderedRowIds.length - 1;
          const prevId = orderedRowIds[prevIdx];
          if (prevId) {
            if (focusedCol !== null) {
              dispatch({ type: "FOCUS_CELL", rowId: prevId, col: focusedCol });
            } else {
              dispatch({ type: "FOCUS_ROW", rowId: prevId });
            }
          }
          return;
        }
        case "ArrowRight":
        case "l": {
          e.preventDefault();
          if (!focusedRowId) return;
          const maxCol = (columnsCount ?? COLUMNS.length) - 1;
          const nextCol = focusedCol !== null ? Math.min(focusedCol + 1, maxCol) : 0;
          dispatch({ type: "FOCUS_CELL", rowId: focusedRowId, col: nextCol });
          return;
        }
        case "ArrowLeft":
        case "h": {
          e.preventDefault();
          if (!focusedRowId) return;
          const prevCol = focusedCol !== null ? Math.max(focusedCol - 1, 0) : 0;
          dispatch({ type: "FOCUS_CELL", rowId: focusedRowId, col: prevCol });
          return;
        }
        case "Enter": {
          e.preventDefault();
          if (focusedRowId) {
            const col = focusedCol ?? defaultEditCol ?? COLUMN_INDEX.payee;
            dispatch({ type: "EDIT_CELL", rowId: focusedRowId, col });
          }
          return;
        }
        case "Escape": {
          e.preventDefault();
          if (selectedIds.size > 0) {
            dispatch({ type: "CLEAR_SELECTION" });
          } else if (focusedRowId) {
            dispatch({ type: "CLEAR_FOCUS" });
          }
          return;
        }
        case " ":
        case "x": {
          e.preventDefault();
          if (focusedRowId) {
            dispatch({ type: "TOGGLE_SELECT", rowId: focusedRowId });
          }
          return;
        }
      }

      // Cmd/Ctrl shortcuts
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "a": {
            e.preventDefault();
            dispatch({ type: "SELECT_ALL", ids: orderedRowIds });
            return;
          }
          case "d": {
            e.preventDefault();
            const dupAction = actions.find((a) => a.id === "duplicate");
            if (dupAction) {
              const ctx = { focusedRowId, selectedIds };
              if (dupAction.enabled(ctx)) dupAction.execute(ctx);
            }
            return;
          }
          case "c": {
            e.preventDefault();
            if (onCopy) {
              const ids = selectedIds.size > 0 ? Array.from(selectedIds) : focusedRowId ? [focusedRowId] : [];
              onCopy(ids);
            } else {
              const ids = selectedIds.size > 0 ? Array.from(selectedIds) : focusedRowId ? [focusedRowId] : [];
              copiedRows = ids.map(getRow).filter((r): r is CashflowRow => !!r);
            }
            return;
          }
          case "v": {
            e.preventDefault();
            if (onPaste) {
              onPaste();
            } else if (onDuplicateRow && copiedRows.length > 0) {
              for (const row of copiedRows) {
                onDuplicateRow(row);
              }
            }
            return;
          }
        }
        return;
      }

      // Single-key shortcuts (only when no modifier)
      if (e.altKey) return;

      const matchedAction = actions.find((a) => a.shortcut === e.key);
      if (matchedAction) {
        const ctx = { focusedRowId, selectedIds };
        if (matchedAction.enabled(ctx)) {
          e.preventDefault();
          matchedAction.execute(ctx);
        }
      }
    },
    [dispatch, orderedRowIds, actions, columnsCount, defaultEditCol, getRow, onDuplicateRow, onCopy, onPaste]
  );
}
