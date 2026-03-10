import type { RecurringTransaction } from "../../../types/database.ts";

// --- Grid layout ---

export const GRID_COLS = "grid-cols-[16px_3fr_1.2fr_1.5fr_52px_1.5fr_56px_48px]";

// --- Frequency options ---

export const FREQUENCIES: { value: RecurringTransaction["frequency"]; label: string; short: string }[] = [
  { value: "weekly", label: "Weekly", short: "Wk" },
  { value: "biweekly", label: "Biweekly", short: "2W" },
  { value: "monthly", label: "Monthly", short: "Mo" },
  { value: "quarterly", label: "Quarterly", short: "Qt" },
  { value: "yearly", label: "Yearly", short: "Yr" },
];

// --- Column definitions ---

export const COLUMNS = ["payee", "date", "category", "frequency", "amount", "status"] as const;
export type ColumnId = (typeof COLUMNS)[number];

export const COLUMN_INDEX: Record<ColumnId, number> = {
  payee: 0,
  date: 1,
  category: 2,
  frequency: 3,
  amount: 4,
  status: 5,
};

// Columns that participate in Tab navigation (status is always-interactive, actions skipped)
export const TABBABLE_COLUMNS: ColumnId[] = ["payee", "date", "category", "frequency", "amount"];

// --- Table state ---

export interface TableState {
  focusedRowId: string | null;
  focusedCol: number | null;
  editingCell: { rowId: string; col: number } | null;
  selectedIds: Set<string>;
  lastSelectedId: string | null;
}

export type TableAction =
  | { type: "FOCUS_ROW"; rowId: string }
  | { type: "FOCUS_CELL"; rowId: string; col: number }
  | { type: "EDIT_CELL"; rowId: string; col: number }
  | { type: "COMMIT_CELL" }
  | { type: "CANCEL_CELL" }
  | { type: "ADVANCE_CELL"; direction: 1 | -1 }
  | { type: "TOGGLE_SELECT"; rowId: string }
  | { type: "RANGE_SELECT"; rowId: string; orderedIds: string[] }
  | { type: "SELECT_ALL"; ids: string[] }
  | { type: "CLEAR_SELECTION" }
  | { type: "CLEAR_FOCUS" };

// --- Action registry ---

export interface ActionContext {
  focusedRowId: string | null;
  selectedIds: Set<string>;
}

export interface RegisteredAction {
  id: string;
  label: string;
  shortcut?: string;
  dangerous?: boolean;
  supportsBulk?: boolean;
  enabled: (ctx: ActionContext) => boolean;
  execute: (ctx: ActionContext) => void | Promise<void>;
}
