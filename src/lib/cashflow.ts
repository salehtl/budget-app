import type { RecurringTransaction, CashflowItem } from "../types/database.ts";
import type { MonthActual } from "../db/queries/cashflow.ts";
import { getNextOccurrence } from "./recurring.ts";

// --- Types ---

export interface CashflowCell {
  amount: number;
  isProjected: boolean;
}

export interface CashflowRow {
  id: string;
  label: string;
  source: "recurring" | "actual" | "adhoc";
  type: "income" | "expense";
  groupName: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  recurringId: string | null;
  monthValues: Map<string, CashflowCell>;
  /** Database IDs for adhoc cashflow_items (used for edit/delete) */
  dbIds: string[];
}

export interface CashflowGroup {
  name: string;
  categoryId: string | null;
  rows: CashflowRow[];
  monthTotals: Map<string, number>;
}

export interface CashflowGrid {
  months: string[];
  incomeGroups: CashflowGroup[];
  expenseGroups: CashflowGroup[];
  monthTotals: Map<string, { income: number; expense: number; net: number }>;
}

// --- Helpers ---

export function generateMonthRange(start: string, end: string): string[] {
  const months: string[] = [];
  const [sy, sm] = start.split("-").map(Number) as [number, number];
  const [ey, em] = end.split("-").map(Number) as [number, number];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthStart(month: string): string {
  return `${month}-01`;
}

function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const lastDay = new Date(y, m, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

// --- Projection ---

export function projectRecurring(
  recurring: RecurringTransaction[],
  months: string[],
  currentMonth: string
): Map<string, Map<string, CashflowCell>> {
  // key: recurringId -> month -> cell
  const projections = new Map<string, Map<string, CashflowCell>>();

  for (const rec of recurring) {
    if (!rec.is_active) continue;

    const rowMap = new Map<string, CashflowCell>();
    projections.set(rec.id, rowMap);

    for (const month of months) {
      if (month < currentMonth) continue; // past months use actuals only

      const mStart = monthStart(month);
      const mEnd = monthEnd(month);

      // Walk occurrences that fall in this month
      let occ = rec.next_occurrence;
      // If occurrence is before this month, advance forward
      while (occ < mStart) {
        occ = getNextOccurrence(occ, rec.frequency, rec.custom_interval_days);
        if (rec.end_date && occ > rec.end_date) break;
      }

      let monthTotal = 0;
      while (occ >= mStart && occ <= mEnd) {
        if (rec.end_date && occ > rec.end_date) break;
        monthTotal += rec.amount;
        occ = getNextOccurrence(occ, rec.frequency, rec.custom_interval_days);
      }

      if (monthTotal > 0) {
        rowMap.set(month, { amount: monthTotal, isProjected: month >= currentMonth });
      }
    }
  }

  return projections;
}

// --- Grid Builder ---

export function buildCashflowGrid(
  months: string[],
  actuals: MonthActual[],
  recurring: RecurringTransaction[],
  adhocItems: CashflowItem[],
  currentMonth: string
): CashflowGrid {
  const projections = projectRecurring(recurring, months, currentMonth);

  // Build rows from different sources
  const rowsMap = new Map<string, CashflowRow>();

  // 1. Recurring-based rows (projected)
  for (const rec of recurring) {
    if (!rec.is_active) continue;
    const key = `recurring:${rec.id}`;
    const proj = projections.get(rec.id);
    if (!proj || proj.size === 0) continue;

    rowsMap.set(key, {
      id: key,
      label: rec.payee || "Unnamed",
      source: "recurring",
      type: rec.type,
      groupName: "",
      categoryId: rec.category_id,
      categoryName: null,
      categoryColor: null,
      recurringId: rec.id,
      monthValues: new Map(proj),
      dbIds: [],
    });
  }

  // 2. Actuals — merge into recurring rows or create standalone
  for (const actual of actuals) {
    if (actual.recurring_id) {
      const key = `recurring:${actual.recurring_id}`;
      const existing = rowsMap.get(key);
      if (existing) {
        // Merge actual into recurring row — actuals override projections for past/current months
        const cell = existing.monthValues.get(actual.month);
        if (cell) {
          if (actual.month <= currentMonth) {
            cell.amount = actual.total;
            cell.isProjected = false;
          }
        } else {
          existing.monthValues.set(actual.month, {
            amount: actual.total,
            isProjected: false,
          });
        }
        if (!existing.categoryName && actual.category_name) {
          existing.categoryName = actual.category_name;
          existing.categoryColor = actual.category_color;
        }
        continue;
      }
    }

    // Non-recurring actual → group by payee+category+type
    const key = `actual:${actual.type}:${actual.category_id ?? "none"}:${actual.payee}`;
    const existing = rowsMap.get(key);
    if (existing) {
      existing.monthValues.set(actual.month, {
        amount: actual.total,
        isProjected: false,
      });
    } else {
      const vals = new Map<string, CashflowCell>();
      vals.set(actual.month, { amount: actual.total, isProjected: false });
      rowsMap.set(key, {
        id: key,
        label: actual.payee || actual.category_name || "Uncategorized",
        source: "actual",
        type: actual.type,
        groupName: "",
        categoryId: actual.category_id,
        categoryName: actual.category_name,
        categoryColor: actual.category_color,
        recurringId: null,
        monthValues: vals,
        dbIds: [],
      });
    }
  }

  // 3. Adhoc items — merge items with same label+type+group into one row
  for (const item of adhocItems) {
    const mergeKey = `adhoc:${item.type}:${item.group_name}:${item.label}`;
    const existing = rowsMap.get(mergeKey);

    if (existing) {
      existing.dbIds.push(item.id);
      if (item.month) {
        existing.monthValues.set(item.month, { amount: item.amount, isProjected: false });
      } else {
        for (const month of months) {
          existing.monthValues.set(month, { amount: item.amount, isProjected: false });
        }
      }
    } else {
      const vals = new Map<string, CashflowCell>();
      if (item.month) {
        vals.set(item.month, { amount: item.amount, isProjected: false });
      } else {
        for (const month of months) {
          vals.set(month, { amount: item.amount, isProjected: false });
        }
      }

      rowsMap.set(mergeKey, {
        id: mergeKey,
        label: item.label,
        source: "adhoc",
        type: item.type,
        groupName: item.group_name,
        categoryId: item.category_id,
        categoryName: null,
        categoryColor: null,
        recurringId: item.recurring_id,
        monthValues: vals,
        dbIds: [item.id],
      });
    }
  }

  // Group rows
  const incomeRows: CashflowRow[] = [];
  const expenseRows: CashflowRow[] = [];

  for (const row of rowsMap.values()) {
    if (row.type === "income") {
      incomeRows.push(row);
    } else {
      expenseRows.push(row);
    }
  }

  // Sort by total amount descending
  const sortByTotal = (a: CashflowRow, b: CashflowRow) => {
    const totalA = Array.from(a.monthValues.values()).reduce((s, c) => s + c.amount, 0);
    const totalB = Array.from(b.monthValues.values()).reduce((s, c) => s + c.amount, 0);
    return totalB - totalA;
  };
  incomeRows.sort(sortByTotal);
  expenseRows.sort(sortByTotal);

  // Build groups by category
  function groupRows(rows: CashflowRow[]): CashflowGroup[] {
    const groupMap = new Map<string, CashflowGroup>();

    for (const row of rows) {
      const groupKey = row.groupName || row.categoryName || "Other";
      let group = groupMap.get(groupKey);
      if (!group) {
        group = {
          name: groupKey,
          categoryId: row.categoryId,
          rows: [],
          monthTotals: new Map(),
        };
        groupMap.set(groupKey, group);
      }
      group.rows.push(row);

      for (const [month, cell] of row.monthValues) {
        group.monthTotals.set(month, (group.monthTotals.get(month) ?? 0) + cell.amount);
      }
    }

    // Sort groups by total
    return Array.from(groupMap.values()).sort((a, b) => {
      const totalA = Array.from(a.monthTotals.values()).reduce((s, v) => s + v, 0);
      const totalB = Array.from(b.monthTotals.values()).reduce((s, v) => s + v, 0);
      return totalB - totalA;
    });
  }

  const incomeGroups = groupRows(incomeRows);
  const expenseGroups = groupRows(expenseRows);

  // Month totals
  const monthTotals = new Map<string, { income: number; expense: number; net: number }>();
  for (const month of months) {
    let income = 0;
    let expense = 0;
    for (const row of rowsMap.values()) {
      const cell = row.monthValues.get(month);
      if (cell) {
        if (row.type === "income") income += cell.amount;
        else expense += cell.amount;
      }
    }
    monthTotals.set(month, { income, expense, net: income - expense });
  }

  return { months, incomeGroups, expenseGroups, monthTotals };
}
