import type { TableColumnConfig } from "../../cashflow/table/useTableState.ts";

// --- Grid layout ---
// Checkbox | Payee | Amount | Frequency | Category | Start | End | Actions
export const RECURRING_GRID_COLS = "grid-cols-[16px_1fr_100px_52px_1fr_96px_100px_48px]";

// --- Column definitions ---

export const RECURRING_COLUMNS = ["payee", "amount", "frequency", "category", "start_date", "end_date"] as const;
export type RecurringColumnId = (typeof RECURRING_COLUMNS)[number];

export const RECURRING_COLUMN_INDEX: Record<RecurringColumnId, number> = {
  payee: 0,
  amount: 1,
  frequency: 2,
  category: 3,
  start_date: 4,
  end_date: 5,
};

export const RECURRING_TABBABLE_COLUMNS: RecurringColumnId[] = [
  "payee", "amount", "frequency", "category", "start_date", "end_date",
];

export const RECURRING_TABLE_CONFIG: TableColumnConfig = {
  tabbableColumns: RECURRING_TABBABLE_COLUMNS,
  columnIndex: RECURRING_COLUMN_INDEX,
};
