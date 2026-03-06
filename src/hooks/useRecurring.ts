import { useState, useEffect, useCallback } from "react";
import { useDb } from "../context/DbContext.tsx";
import {
  getRecurringTransactions,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  getDueRecurring,
} from "../db/queries/recurring.ts";
import { createTransaction } from "../db/queries/transactions.ts";
import { emitDbEvent, onDbEvent } from "../lib/db-events.ts";
import { getNextOccurrence } from "../lib/recurring.ts";
import type { RecurringTransaction } from "../types/database.ts";

export function useRecurring() {
  const db = useDb();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getRecurringTransactions(db);
    setItems(data);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    refresh();
    return onDbEvent("recurring-changed", refresh);
  }, [refresh]);

  const add = useCallback(
    async (rec: {
      amount: number;
      type: "income" | "expense";
      category_id: string | null;
      payee?: string;
      notes?: string;
      frequency: RecurringTransaction["frequency"];
      custom_interval_days?: number | null;
      start_date: string;
      end_date?: string | null;
      mode?: "reminder" | "auto";
    }) => {
      const id = crypto.randomUUID();
      await createRecurring(db, {
        id,
        ...rec,
        next_occurrence: rec.start_date,
      });
      emitDbEvent("recurring-changed");
      return id;
    },
    [db]
  );

  const update = useCallback(
    async (
      id: string,
      updates: Parameters<typeof updateRecurring>[2]
    ) => {
      await updateRecurring(db, id, updates);
      emitDbEvent("recurring-changed");
    },
    [db]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteRecurring(db, id);
      emitDbEvent("recurring-changed");
    },
    [db]
  );

  const stopRecurrence = useCallback(
    async (recurringId: string) => {
      await updateRecurring(db, recurringId, { is_active: false });
      emitDbEvent("recurring-changed");
    },
    [db]
  );

  const processDue = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0]!;
    const due = await getDueRecurring(db, today);

    for (const rec of due) {
      if (rec.mode === "auto") {
        await createTransaction(db, {
          id: crypto.randomUUID(),
          amount: rec.amount,
          type: rec.type,
          category_id: rec.category_id,
          date: rec.next_occurrence,
          payee: rec.payee,
          notes: rec.notes,
          recurring_id: rec.id,
          status: "confirmed",
        });
      }

      const next = getNextOccurrence(
        rec.next_occurrence,
        rec.frequency,
        rec.custom_interval_days
      );

      if (rec.end_date && next > rec.end_date) {
        await updateRecurring(db, rec.id, { is_active: false });
      } else {
        await updateRecurring(db, rec.id, { next_occurrence: next });
      }
    }

    if (due.length > 0) {
      emitDbEvent("transactions-changed");
      emitDbEvent("recurring-changed");
    }

    return due;
  }, [db]);

  return { items, loading, add, update, remove, stopRecurrence, processDue, refresh };
}
