import { useState, useEffect, useCallback } from "react";
import { useDb } from "../context/DbContext.tsx";
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getMonthSummary,
  getCategoryBreakdown,
  getMonthlyTrends,
  type TransactionFilters,
  type TransactionWithCategory,
} from "../db/queries/transactions.ts";
import { emitDbEvent, onDbEvent } from "../lib/db-events.ts";

export function useTransactions(filters?: TransactionFilters) {
  const db = useDb();
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const txns = await getTransactions(db, filters);
    setTransactions(txns);
    setLoading(false);
  }, [db, filters?.month, filters?.categoryId, filters?.type, filters?.search]);

  useEffect(() => {
    refresh();
    return onDbEvent("transactions-changed", refresh);
  }, [refresh]);

  const add = useCallback(
    async (txn: {
      amount: number;
      type: "income" | "expense";
      category_id: string | null;
      date: string;
      payee?: string;
      notes?: string;
      recurring_id?: string | null;
    }) => {
      const id = crypto.randomUUID();
      await createTransaction(db, { id, ...txn });
      emitDbEvent("transactions-changed");
      return id;
    },
    [db]
  );

  const update = useCallback(
    async (
      id: string,
      updates: Parameters<typeof updateTransaction>[2]
    ) => {
      await updateTransaction(db, id, updates);
      emitDbEvent("transactions-changed");
    },
    [db]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteTransaction(db, id);
      emitDbEvent("transactions-changed");
    },
    [db]
  );

  return { transactions, loading, add, update, remove, refresh };
}

export function useMonthSummary(month: string) {
  const db = useDb();
  const [summary, setSummary] = useState({ total_income: 0, total_expenses: 0 });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getMonthSummary(db, month);
    setSummary(data);
    setLoading(false);
  }, [db, month]);

  useEffect(() => {
    refresh();
    return onDbEvent("transactions-changed", refresh);
  }, [refresh]);

  return { ...summary, net: summary.total_income - summary.total_expenses, loading };
}

export function useCategoryBreakdown(month: string, type: "income" | "expense" = "expense") {
  const db = useDb();
  const [breakdown, setBreakdown] = useState<
    { category_id: string; category_name: string; category_color: string; total: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getCategoryBreakdown(db, month, type);
    setBreakdown(data);
    setLoading(false);
  }, [db, month, type]);

  useEffect(() => {
    refresh();
    return onDbEvent("transactions-changed", refresh);
  }, [refresh]);

  return { breakdown, loading };
}

export function useMonthlyTrends(months: number = 6) {
  const db = useDb();
  const [trends, setTrends] = useState<
    { month: string; income: number; expenses: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getMonthlyTrends(db, months);
    setTrends(data);
    setLoading(false);
  }, [db, months]);

  useEffect(() => {
    refresh();
    return onDbEvent("transactions-changed", refresh);
  }, [refresh]);

  return { trends, loading };
}
