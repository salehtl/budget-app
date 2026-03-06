import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { z } from "zod/v4";
import { PageHeader } from "../components/layout/PageHeader.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Select } from "../components/ui/Select.tsx";
import { Modal } from "../components/ui/Modal.tsx";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { useToast } from "../components/ui/Toast.tsx";
import { useTransactions } from "../hooks/useTransactions.ts";
import { useCategories } from "../hooks/useCategories.ts";
import {
  formatCurrency,
  formatDate,
  getCurrentMonth,
  getToday,
} from "../lib/format.ts";

const searchSchema = z.object({
  month: z.string().optional(),
  category: z.string().optional(),
  type: z.enum(["income", "expense"]).optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/transactions")({
  component: TransactionsPage,
  validateSearch: (search) => searchSchema.parse(search),
});

function TransactionsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const filters = useMemo(
    () => ({
      month: search.month || getCurrentMonth(),
      categoryId: search.category,
      type: search.type,
      search: search.q,
    }),
    [search.month, search.category, search.type, search.q]
  );

  const { transactions, add, update, remove } = useTransactions(filters);
  const { categories } = useCategories();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Quick add state
  const [quickAmount, setQuickAmount] = useState("");
  const [quickCategory, setQuickCategory] = useState("");

  const expenseCategories = categories.filter((c) => !c.is_income && !c.parent_id);
  const allCategories = categories.filter((c) => !c.parent_id);

  const categoryOptions = allCategories.map((c) => ({
    value: c.id,
    label: `${c.is_income ? "[Income] " : ""}${c.name}`,
  }));

  // Group by date
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof transactions>();
    for (const txn of transactions) {
      const list = groups.get(txn.date) ?? [];
      list.push(txn);
      groups.set(txn.date, list);
    }
    return [...groups.entries()];
  }, [transactions]);

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(quickAmount);
    if (!amount || amount <= 0) return;
    await add({
      amount,
      type: "expense",
      category_id: quickCategory || null,
      date: getToday(),
    });
    setQuickAmount("");
    setQuickCategory("");
    toast("Transaction added");
  }

  const editTxn = editId ? transactions.find((t) => t.id === editId) : null;

  return (
    <div>
      <PageHeader
        title="Transactions"
        action={
          <Button onClick={() => { setEditId(null); setShowForm(true); }}>
            + Add
          </Button>
        }
      />

      {/* Quick add bar */}
      <form
        onSubmit={handleQuickAdd}
        className="flex gap-2 mb-4"
      >
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="Amount"
          value={quickAmount}
          onChange={(e) => setQuickAmount(e.target.value)}
          className="w-32"
        />
        <Select
          options={expenseCategories.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Category"
          value={quickCategory}
          onChange={(e) => setQuickCategory(e.target.value)}
          className="w-40"
        />
        <Button type="submit" size="md">
          Add
        </Button>
      </form>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select
          options={[
            { value: "income", label: "Income" },
            { value: "expense", label: "Expense" },
          ]}
          placeholder="All types"
          value={search.type ?? ""}
          onChange={(e) =>
            navigate({
              search: (prev: Record<string, unknown>) => ({
                ...prev,
                type: e.target.value || undefined,
              }),
            })
          }
          className="w-32"
        />
        <Select
          options={categoryOptions}
          placeholder="All categories"
          value={search.category ?? ""}
          onChange={(e) =>
            navigate({
              search: (prev: Record<string, unknown>) => ({
                ...prev,
                category: e.target.value || undefined,
              }),
            })
          }
          className="w-40"
        />
        <Input
          placeholder="Search..."
          value={search.q ?? ""}
          onChange={(e) =>
            navigate({
              search: (prev: Record<string, unknown>) => ({
                ...prev,
                q: e.target.value || undefined,
              }),
            })
          }
          className="w-40"
        />
      </div>

      {/* Transaction list */}
      {transactions.length === 0 ? (
        <EmptyState
          title="No transactions"
          description="Add your first transaction using the form above"
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, txns]) => (
            <div key={date}>
              <h3 className="text-xs font-medium text-text-muted mb-2">
                {formatDate(date)}
              </h3>
              <div className="bg-surface rounded-xl border border-border divide-y divide-border">
                {txns.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-surface-alt cursor-pointer"
                    onClick={() => {
                      setEditId(txn.id);
                      setShowForm(true);
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            txn.category_color ?? "#94a3b8",
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {txn.payee || txn.category_name || "Uncategorized"}
                        </p>
                        {txn.notes && (
                          <p className="text-xs text-text-light truncate">
                            {txn.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-sm font-medium shrink-0 ${
                        txn.type === "income"
                          ? "text-success"
                          : "text-danger"
                      }`}
                    >
                      {txn.type === "income" ? "+" : "-"}
                      {formatCurrency(txn.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <TransactionForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditId(null);
        }}
        categories={categories}
        initial={editTxn ?? undefined}
        onSubmit={async (data) => {
          if (editId) {
            await update(editId, data);
            toast("Transaction updated");
          } else {
            await add(data);
            toast("Transaction added");
          }
          setShowForm(false);
          setEditId(null);
        }}
        onDelete={
          editId
            ? () => {
                setShowForm(false);
                setDeleteId(editId);
                setEditId(null);
              }
            : undefined
        }
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            await remove(deleteId);
            toast("Transaction deleted");
          }
        }}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}

function TransactionForm({
  open,
  onClose,
  categories,
  initial,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  categories: { id: string; name: string; is_income: number; parent_id: string | null }[];
  initial?: {
    amount: number;
    type: "income" | "expense";
    category_id: string | null;
    date: string;
    payee: string;
    notes: string;
  };
  onSubmit: (data: {
    amount: number;
    type: "income" | "expense";
    category_id: string | null;
    date: string;
    payee: string;
    notes: string;
  }) => Promise<void>;
  onDelete?: () => void;
}) {
  const [type, setType] = useState<"income" | "expense">(initial?.type ?? "expense");
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [date, setDate] = useState(initial?.date ?? getToday());
  const [payee, setPayee] = useState(initial?.payee ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  // Reset form when initial changes
  const key = initial ? `${initial.date}-${initial.amount}` : "new";

  const filteredCategories = categories
    .filter((c) => (type === "income" ? c.is_income : !c.is_income))
    .map((c) => ({
      value: c.id,
      label: c.parent_id
        ? `  ${c.name}`
        : c.name,
    }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setSubmitting(true);
    try {
      await onSubmit({
        amount: amt,
        type,
        category_id: categoryId || null,
        date,
        payee,
        notes,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit Transaction" : "Add Transaction"}
      key={key}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setType("expense")}
            className={`flex-1 py-2 text-sm font-medium transition-colors cursor-pointer ${
              type === "expense"
                ? "bg-danger text-white"
                : "text-text-muted hover:bg-surface-alt"
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setType("income")}
            className={`flex-1 py-2 text-sm font-medium transition-colors cursor-pointer ${
              type === "income"
                ? "bg-success text-white"
                : "text-text-muted hover:bg-surface-alt"
            }`}
          >
            Income
          </button>
        </div>

        <Input
          label="Amount (AED)"
          type="number"
          step="0.01"
          min="0"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <Select
          label="Category"
          options={filteredCategories}
          placeholder="Select category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        />

        <Input
          label="Date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <Input
          label="Payee"
          placeholder="e.g., Carrefour, ADNOC"
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
        />

        <Input
          label="Notes"
          placeholder="Optional notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex justify-between pt-2">
          {onDelete ? (
            <Button type="button" variant="danger" onClick={onDelete}>
              Delete
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {initial ? "Save" : "Add"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
