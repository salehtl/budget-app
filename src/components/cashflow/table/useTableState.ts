import { useReducer, useCallback, useMemo } from "react";
import type { TableState, TableAction } from "./types.ts";
import { TABBABLE_COLUMNS, COLUMN_INDEX } from "./types.ts";

export interface TableColumnConfig {
  tabbableColumns: readonly string[];
  columnIndex: Record<string, number>;
}

const DEFAULT_CONFIG: TableColumnConfig = {
  tabbableColumns: TABBABLE_COLUMNS,
  columnIndex: COLUMN_INDEX,
};

const INITIAL_STATE: TableState = {
  focusedRowId: null,
  focusedCol: null,
  editingCell: null,
  selectedIds: new Set(),
  lastSelectedId: null,
};

function createReducer(config: TableColumnConfig) {
  return function tableReducer(state: TableState, action: TableAction): TableState {
    switch (action.type) {
      case "FOCUS_ROW":
        return {
          ...state,
          focusedRowId: action.rowId,
          focusedCol: null,
          editingCell: null,
        };

      case "FOCUS_CELL":
        return {
          ...state,
          focusedRowId: action.rowId,
          focusedCol: action.col,
          editingCell: null,
        };

      case "EDIT_CELL":
        return {
          ...state,
          focusedRowId: action.rowId,
          focusedCol: action.col,
          editingCell: { rowId: action.rowId, col: action.col },
        };

      case "COMMIT_CELL":
      case "CANCEL_CELL":
        return {
          ...state,
          editingCell: null,
        };

      case "ADVANCE_CELL": {
        if (!state.editingCell) return state;
        const { rowId, col } = state.editingCell;
        const currentTabIdx = config.tabbableColumns.indexOf(
          Object.entries(config.columnIndex).find(([, v]) => v === col)?.[0] as string
        );
        const nextTabIdx = currentTabIdx + action.direction;
        if (nextTabIdx < 0 || nextTabIdx >= config.tabbableColumns.length) {
          return { ...state, editingCell: null };
        }
        const nextCol = config.columnIndex[config.tabbableColumns[nextTabIdx]!] ?? 0;
        return {
          ...state,
          focusedCol: nextCol,
          editingCell: { rowId, col: nextCol },
        };
      }

      case "TOGGLE_SELECT": {
        const next = new Set(state.selectedIds);
        if (next.has(action.rowId)) {
          next.delete(action.rowId);
        } else {
          next.add(action.rowId);
        }
        return {
          ...state,
          selectedIds: next,
          lastSelectedId: action.rowId,
        };
      }

      case "RANGE_SELECT": {
        if (!state.lastSelectedId) {
          const next = new Set(state.selectedIds);
          next.add(action.rowId);
          return { ...state, selectedIds: next, lastSelectedId: action.rowId };
        }
        const startIdx = action.orderedIds.indexOf(state.lastSelectedId);
        const endIdx = action.orderedIds.indexOf(action.rowId);
        if (startIdx === -1 || endIdx === -1) return state;
        const lo = Math.min(startIdx, endIdx);
        const hi = Math.max(startIdx, endIdx);
        const next = new Set(state.selectedIds);
        for (let i = lo; i <= hi; i++) {
          next.add(action.orderedIds[i]!);
        }
        return { ...state, selectedIds: next, lastSelectedId: action.rowId };
      }

      case "SELECT_ALL":
        return {
          ...state,
          selectedIds: new Set(action.ids),
          lastSelectedId: action.ids[action.ids.length - 1] ?? null,
        };

      case "CLEAR_SELECTION":
        return {
          ...state,
          selectedIds: new Set(),
          lastSelectedId: null,
        };

      case "CLEAR_FOCUS":
        return {
          ...state,
          focusedRowId: null,
          focusedCol: null,
          editingCell: null,
        };

      default:
        return state;
    }
  };
}

export function useTableState(config?: TableColumnConfig) {
  const resolvedConfig = config ?? DEFAULT_CONFIG;
  const reducer = useMemo(() => createReducer(resolvedConfig), [resolvedConfig]);
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const hasSelection = state.selectedIds.size > 0;

  const clearAll = useCallback(() => {
    dispatch({ type: "CLEAR_SELECTION" });
    dispatch({ type: "CLEAR_FOCUS" });
  }, []);

  return { state, dispatch, hasSelection, clearAll };
}
