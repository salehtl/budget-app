import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "../components/layout/PageHeader.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.tsx";
import { useToast } from "../components/ui/Toast.tsx";
import { CashflowToolbar, type ViewMode } from "../components/cashflow/CashflowToolbar.tsx";
import { CashflowChart } from "../components/cashflow/CashflowChart.tsx";
import { MultiMonthView } from "../components/cashflow/MultiMonthView.tsx";
import { SingleMonthView } from "../components/cashflow/SingleMonthView.tsx";
import { AddRowDialog } from "../components/cashflow/AddRowDialog.tsx";
import { useCashflow } from "../hooks/useCashflow.ts";
import { useCategories } from "../hooks/useCategories.ts";
import { getCurrentMonth } from "../lib/format.ts";

type CashflowSearch = {
  mode?: "multi" | "single";
  start?: string;
  end?: string;
  month?: string;
};

export const Route = createFileRoute("/cashflow")({
  validateSearch: (search: Record<string, unknown>): CashflowSearch => ({
    mode: (search.mode as "multi" | "single") || undefined,
    start: (search.start as string) || undefined,
    end: (search.end as string) || undefined,
    month: (search.month as string) || undefined,
  }),
  component: CashflowPage,
});

function getDefaultStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-01`;
}

function getDefaultEnd(): string {
  const now = new Date();
  return `${now.getFullYear()}-12`;
}

function CashflowPage() {
  const search = useSearch({ from: "/cashflow" });
  const navigate = useNavigate({ from: "/cashflow" });
  const { toast } = useToast();
  const { categories } = useCategories();

  const viewMode: ViewMode = search.mode ?? "multi";
  const startMonth = search.start ?? getDefaultStart();
  const endMonth = search.end ?? getDefaultEnd();
  const singleMonth = search.month ?? getCurrentMonth();

  // For the hook, use the range that matches the view
  const effectiveStart = viewMode === "single" ? singleMonth : startMonth;
  const effectiveEnd = viewMode === "single" ? singleMonth : endMonth;

  const { grid, loading, addItem, removeItem, getMonthTransactions } = useCashflow(effectiveStart, effectiveEnd);
  const [showAddRow, setShowAddRow] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string[] | null>(null);

  function updateSearch(updates: Partial<CashflowSearch>) {
    navigate({ search: (prev: CashflowSearch) => ({ ...prev, ...updates }) });
  }

  function handleDeleteRow(rowId: string) {
    // Find the row in the grid to get its dbIds
    if (!grid) return;
    const allGroups = [...grid.incomeGroups, ...grid.expenseGroups];
    for (const group of allGroups) {
      for (const row of group.rows) {
        if (row.id === rowId && row.dbIds.length > 0) {
          setDeleteTarget(row.dbIds);
          return;
        }
      }
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    for (const id of deleteTarget) {
      await removeItem(id);
    }
    toast("Cashflow row deleted");
    setDeleteTarget(null);
  }

  const hasData = grid && (grid.incomeGroups.length > 0 || grid.expenseGroups.length > 0);

  return (
    <div>
      <PageHeader title="Cashflow" />

      <CashflowToolbar
        mode={viewMode}
        onModeChange={(mode) => updateSearch({ mode })}
        startMonth={startMonth}
        endMonth={endMonth}
        onStartChange={(start) => updateSearch({ start })}
        onEndChange={(end) => updateSearch({ end })}
        singleMonth={singleMonth}
        onSingleMonthChange={(month) => updateSearch({ month })}
        onAddRow={() => setShowAddRow(true)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-text-muted">Loading cashflow data...</p>
        </div>
      ) : !hasData ? (
        <EmptyState
          title="No cashflow data"
          description="Add recurring transactions or cashflow rows to see your financial projections"
        />
      ) : (
        <>
          {/* Chart — show in multi-month mode */}
          {viewMode === "multi" && grid && <CashflowChart grid={grid} />}

          {viewMode === "multi" && grid ? (
            <MultiMonthView
              grid={grid}
              onDeleteRow={handleDeleteRow}
            />
          ) : viewMode === "single" && grid ? (
            <SingleMonthView
              grid={grid}
              month={singleMonth}
              onLoadTransactions={getMonthTransactions}
              onDeleteRow={handleDeleteRow}
            />
          ) : null}
        </>
      )}

      {showAddRow && (
        <AddRowDialog
          open={showAddRow}
          onClose={() => setShowAddRow(false)}
          categories={categories}
          onSubmit={async (data) => {
            await addItem(data);
            toast("Cashflow row added");
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Row"
        message="Are you sure you want to delete this cashflow row? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
