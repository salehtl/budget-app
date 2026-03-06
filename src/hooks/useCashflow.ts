import { useState, useEffect, useCallback } from "react";
import { useDb } from "../context/DbContext.tsx";
import {
  getActualsForRange,
  getCashflowItems,
  createCashflowItem,
  updateCashflowItem,
  deleteCashflowItem,
  getTransactionsForMonth,
  type MonthTransaction,
} from "../db/queries/cashflow.ts";
import { getRecurringTransactions } from "../db/queries/recurring.ts";
import { buildCashflowGrid, generateMonthRange, getCurrentMonth, type CashflowGrid } from "../lib/cashflow.ts";
import { emitDbEvent, onDbEvent } from "../lib/db-events.ts";
import type { CashflowItem } from "../types/database.ts";

export function useCashflow(startMonth: string, endMonth: string) {
  const db = useDb();
  const [grid, setGrid] = useState<CashflowGrid | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [actuals, recurring, adhocItems] = await Promise.all([
      getActualsForRange(db, startMonth, endMonth),
      getRecurringTransactions(db),
      getCashflowItems(db),
    ]);

    const currentMonth = getCurrentMonth();
    const months = generateMonthRange(startMonth, endMonth);

    const result = buildCashflowGrid(months, actuals, recurring, adhocItems, currentMonth);
    setGrid(result);
    setLoading(false);
  }, [db, startMonth, endMonth]);

  useEffect(() => {
    refresh();
    const unsubs = [
      onDbEvent("transactions-changed", refresh),
      onDbEvent("recurring-changed", refresh),
      onDbEvent("cashflow-changed", refresh),
      onDbEvent("categories-changed", refresh),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [refresh]);

  const addItem = useCallback(
    async (item: {
      label: string;
      type: "income" | "expense";
      amount: number;
      category_id?: string | null;
      group_name?: string;
      month?: string | null;
      sort_order?: number;
    }) => {
      const id = crypto.randomUUID();
      await createCashflowItem(db, { id, ...item });
      emitDbEvent("cashflow-changed");
      return id;
    },
    [db]
  );

  const updateItem = useCallback(
    async (id: string, updates: Parameters<typeof updateCashflowItem>[2]) => {
      await updateCashflowItem(db, id, updates);
      emitDbEvent("cashflow-changed");
    },
    [db]
  );

  const removeItem = useCallback(
    async (id: string) => {
      await deleteCashflowItem(db, id);
      emitDbEvent("cashflow-changed");
    },
    [db]
  );

  const getMonthTransactions = useCallback(
    async (
      month: string,
      categoryId?: string | null,
      recurringId?: string | null
    ): Promise<MonthTransaction[]> => {
      return getTransactionsForMonth(db, month, categoryId, recurringId);
    },
    [db]
  );

  return { grid, loading, refresh, addItem, updateItem, removeItem, getMonthTransactions };
}
