import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "../components/layout/PageHeader.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Select } from "../components/ui/Select.tsx";
import { Modal } from "../components/ui/Modal.tsx";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { useToast } from "../components/ui/Toast.tsx";
import { useCategories } from "../hooks/useCategories.ts";

export const Route = createFileRoute("/categories")({
  component: CategoriesPage,
});

const COLORS = [
  "#6366f1", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6",
  "#14b8a6", "#0ea5e9", "#f97316", "#64748b", "#16a34a",
  "#84cc16", "#06b6d4", "#a855f7", "#e11d48",
];

function CategoriesPage() {
  const { categories, add, update, remove } = useCategories();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const expenseCategories = useMemo(
    () => categories.filter((c) => !c.is_income),
    [categories]
  );
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.is_income),
    [categories]
  );

  const editCat = editId ? categories.find((c) => c.id === editId) : null;
  const parentOptions = categories
    .filter((c) => !c.parent_id)
    .map((c) => ({ value: c.id, label: c.name }));

  function renderCategoryList(cats: typeof categories, label: string) {
    const parents = cats.filter((c) => !c.parent_id);
    return (
      <div className="mb-6">
        <h2 className="text-sm font-medium text-text-muted mb-2">{label}</h2>
        {parents.length === 0 ? (
          <p className="text-sm text-text-light">No categories</p>
        ) : (
          <div className="bg-surface rounded-xl border border-border divide-y divide-border">
            {parents.map((parent) => {
              const children = cats.filter(
                (c) => c.parent_id === parent.id
              );
              return (
                <div key={parent.id}>
                  <div
                    className="flex items-center justify-between px-4 py-3 hover:bg-surface-alt cursor-pointer"
                    onClick={() => {
                      if (parent.is_system) return;
                      setEditId(parent.id);
                      setShowForm(true);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: parent.color }}
                      />
                      <span className="text-sm font-medium">
                        {parent.name}
                      </span>
                      {parent.is_system ? (
                        <span className="text-[10px] text-text-light bg-surface-alt px-1.5 py-0.5 rounded">
                          System
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {children.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center justify-between px-4 py-2.5 pl-10 hover:bg-surface-alt cursor-pointer"
                      onClick={() => {
                        if (child.is_system) return;
                        setEditId(child.id);
                        setShowForm(true);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: child.color }}
                        />
                        <span className="text-sm text-text-muted">
                          {child.name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        action={
          <Button
            onClick={() => {
              setEditId(null);
              setShowForm(true);
            }}
          >
            + Add
          </Button>
        }
      />

      {categories.length === 0 ? (
        <EmptyState title="No categories" description="Add your first category" />
      ) : (
        <>
          {renderCategoryList(expenseCategories, "Expense Categories")}
          {renderCategoryList(incomeCategories, "Income Categories")}
        </>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <CategoryForm
          open={showForm}
          onClose={() => {
            setShowForm(false);
            setEditId(null);
          }}
          initial={
            editCat
              ? {
                  name: editCat.name,
                  parent_id: editCat.parent_id,
                  color: editCat.color,
                  is_income: !!editCat.is_income,
                }
              : undefined
          }
          parentOptions={parentOptions}
          onSubmit={async (data) => {
            if (editId) {
              await update(editId, data);
              toast("Category updated");
            } else {
              await add(data);
              toast("Category added");
            }
            setShowForm(false);
            setEditId(null);
          }}
          onDelete={
            editId && editCat && !editCat.is_system
              ? () => {
                  setShowForm(false);
                  setDeleteId(editId);
                  setEditId(null);
                }
              : undefined
          }
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            await remove(deleteId);
            toast("Category deleted");
          }
        }}
        title="Delete Category"
        message="Deleting this category will set related transactions to uncategorized. Continue?"
        confirmLabel="Delete"
      />
    </div>
  );
}

function CategoryForm({
  open,
  onClose,
  initial,
  parentOptions,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  initial?: {
    name: string;
    parent_id: string | null;
    color: string;
    is_income: boolean;
  };
  parentOptions: { value: string; label: string }[];
  onSubmit: (data: {
    name: string;
    parent_id?: string | null;
    color: string;
    is_income: boolean;
  }) => Promise<void>;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [parentId, setParentId] = useState(initial?.parent_id ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]!);
  const [isIncome, setIsIncome] = useState(initial?.is_income ?? false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit({
      name: name.trim(),
      parent_id: parentId || null,
      color,
      is_income: isIncome,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit Category" : "Add Category"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Select
          label="Parent Category"
          options={parentOptions}
          placeholder="None (top-level)"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-muted">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full cursor-pointer transition-transform ${
                  color === c ? "ring-2 ring-offset-2 ring-accent scale-110" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is-income"
            checked={isIncome}
            onChange={(e) => setIsIncome(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="is-income" className="text-sm text-text-muted">
            Income category
          </label>
        </div>

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
            <Button type="submit">{initial ? "Save" : "Add"}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
