import { useState, useEffect, useCallback } from "react";
import { useDb } from "../context/DbContext.tsx";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../db/queries/categories.ts";
import { emitDbEvent, onDbEvent } from "../lib/db-events.ts";
import type { Category } from "../types/database.ts";

export function useCategories() {
  const db = useDb();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const cats = await getCategories(db);
    setCategories(cats);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    refresh();
    return onDbEvent("categories-changed", refresh);
  }, [refresh]);

  const add = useCallback(
    async (cat: {
      name: string;
      parent_id?: string | null;
      color: string;
      icon?: string;
      is_income: boolean;
    }) => {
      const id = `cat-${crypto.randomUUID()}`;
      await createCategory(db, { id, ...cat });
      emitDbEvent("categories-changed");
      return id;
    },
    [db]
  );

  const update = useCallback(
    async (
      id: string,
      updates: Parameters<typeof updateCategory>[2]
    ) => {
      await updateCategory(db, id, updates);
      emitDbEvent("categories-changed");
    },
    [db]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteCategory(db, id);
      emitDbEvent("categories-changed");
      emitDbEvent("transactions-changed");
    },
    [db]
  );

  const expenseCategories = categories.filter((c) => !c.is_income);
  const incomeCategories = categories.filter((c) => c.is_income);
  const parentCategories = categories.filter((c) => !c.parent_id);

  return {
    categories,
    expenseCategories,
    incomeCategories,
    parentCategories,
    loading,
    add,
    update,
    remove,
    refresh,
  };
}
